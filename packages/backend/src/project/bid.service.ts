import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { BidCreditsService } from './bid-credits.service';
import { BidAnalyticsService } from './bid-analytics.service';
import { MilestoneService } from './milestone.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { UpdateBidDto } from './dto/update-bid.dto';

// ---------------------------------------------------------------------------
// Enums (kept local so the module compiles without @freelancer/shared)
// ---------------------------------------------------------------------------

export enum BidStatus {
  PENDING   = 'PENDING',
  ACCEPTED  = 'ACCEPTED',
  REJECTED  = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum ProjectStatus {
  OPEN        = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED   = 'COMPLETED',
  CANCELLED   = 'CANCELLED',
}

export enum ContractStatus {
  ACTIVE    = 'ACTIVE',
  PAUSED    = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DISPUTED  = 'DISPUTED',
}

// ---------------------------------------------------------------------------
// Kafka topic constants
// ---------------------------------------------------------------------------

const KAFKA_TOPICS = {
  BID_RECEIVED:      'bid.received',
  BID_WITHDRAWN:     'bid.withdrawn',
  CONTRACT_STARTED:  'contract.started',
  BID_AWARDED:       'bid.awarded',
  BIDS_REJECTED:     'bids.rejected',
} as const;

// ---------------------------------------------------------------------------
// BidService
// ---------------------------------------------------------------------------

@Injectable()
export class BidService {
  private readonly logger = new Logger(BidService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly bidCreditsService: BidCreditsService,
    private readonly bidAnalyticsService: BidAnalyticsService,
    private readonly milestoneService: MilestoneService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // createBid
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Submits a new bid from a freelancer on an open project.
   *
   * Business rules:
   *   1. The project must exist and be in OPEN status.
   *   2. The freelancer cannot bid on their own project (safety check).
   *   3. The freelancer can only have one non-WITHDRAWN bid per project.
   *   4. After creation the project's bidCount counter is atomically incremented.
   *   5. A BID_RECEIVED Kafka event is emitted for downstream consumers
   *      (e.g. the notification service).
   */
  async createBid(
    freelancerId: string,
    projectId: string,
    dto: CreateBidDto,
  ): Promise<any> {
    // ── 1. Check bid credits ─────────────────────────────────────────────────
    const hasCredits = await this.bidCreditsService.hasCredits(freelancerId);
    if (!hasCredits) {
      throw new ConflictException(
        'Insufficient bid credits. Please purchase more credits to place a bid.',
      );
    }

    // ── 2. Fetch project ──────────────────────────────────────────────────────
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${projectId}" was not found.`);
    }

    // ── 3. Project must be OPEN ───────────────────────────────────────────────
    if ((project as any).status !== ProjectStatus.OPEN) {
      throw new ConflictException(
        `Bids can only be placed on OPEN projects. This project is currently ${(project as any).status}.`,
      );
    }

    // ── 4. Freelancer cannot bid on their own project ─────────────────────────
    if ((project as any).clientId === freelancerId) {
      throw new ForbiddenException('You cannot bid on your own project.');
    }

    // ── 5. No duplicate active bid ────────────────────────────────────────────
    const existingBid = await this.prisma.bid.findFirst({
      where: {
        projectId,
        freelancerId,
        status: { not: BidStatus.WITHDRAWN },
      },
    });

    if (existingBid) {
      throw new ConflictException(
        'You already have an active bid on this project. ' +
          'Withdraw your existing bid before placing a new one.',
      );
    }

    // ── 6. Calculate skill match score ────────────────────────────────────────
    const skillMatchScore = await this.bidAnalyticsService.calculateSkillMatch(
      freelancerId,
      projectId,
    );

    // ── 7. Deduct bid credit ──────────────────────────────────────────────────
    await this.bidCreditsService.deductCredit(freelancerId);

    // ── 8. Create bid + increment bidCount inside a transaction ───────────────
    const [bid] = await this.prisma.$transaction([
      (this.prisma.bid as any).create({
        data: {
          projectId,
          freelancerId,
          amount: dto.amount,
          deliveryDays: dto.deliveryDays,
          coverLetter: dto.coverLetter,
          // milestones: (dto as any).milestones ?? [], // Milestone not in Bid model
          attachments: (dto as any).attachments ?? [],
          skillMatchScore,
          status: BidStatus.PENDING,
        },
        include: {
          freelancer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              hourlyRate: true,
              rating: true,
              totalReviews: true,
              bio: true,
              skills: { include: { skill: { select: { name: true } } } },
            },
          },
          project: {
            select: {
              id: true,
              title: true,
              status: true,
              client: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      }),

      // Atomically increment the denormalised bid counter on the project
      this.prisma.project.update({
        where: { id: projectId },
        data: { bidCount: { increment: 1 } },
      }),
    ]);

    // ── 9. Invalidate analytics cache ─────────────────────────────────────────
    await this.redisService
      .del(`bid_analytics:${projectId}`)
      .catch(() => null);

    // ── 10. Emit Kafka event (non-blocking) ───────────────────────────────────
    this.emitKafkaEvent(KAFKA_TOPICS.BID_RECEIVED, {
      bidId: bid.id,
      projectId,
      freelancerId,
      amount: dto.amount,
      deliveryDays: dto.deliveryDays,
      skillMatchScore,
      clientId: (bid as any).project?.client?.id,
      occurredAt: new Date().toISOString(),
    }).catch((err) => this.logger.error('Kafka emit BID_RECEIVED failed', err));

    this.logger.log(
      `Bid created: ${bid.id} | project: ${projectId} | freelancer: ${freelancerId} | skill match: ${skillMatchScore}%`,
    );

    return bid;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // updateBid
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Allows a freelancer to update the amount, delivery days, or cover letter
   * of their own bid, but only while it is still PENDING.
   */
  async updateBid(
    bidId: string,
    freelancerId: string,
    dto: Partial<UpdateBidDto>,
  ): Promise<any> {
    // ── Fetch bid ─────────────────────────────────────────────────────────────
    const bid = await this.findBidOrFail(bidId);

    // ── Ownership check ───────────────────────────────────────────────────────
    if ((bid as any).freelancerId !== freelancerId) {
      throw new ForbiddenException('You are not authorized to update this bid.');
    }

    // ── Status guard ──────────────────────────────────────────────────────────
    if ((bid as any).status !== BidStatus.PENDING) {
      throw new ConflictException(
        `Only PENDING bids can be edited. This bid is currently ${(bid as any).status}.`,
      );
    }

    // ── Allowed update fields ─────────────────────────────────────────────────
    const { amount, deliveryDays, coverLetter } = dto as any;

    const updated = await this.prisma.bid.update({
      where: { id: bidId },
      data: {
        ...(amount       !== undefined ? { amount }       : {}),
        ...(deliveryDays !== undefined ? { deliveryDays } : {}),
        ...(coverLetter  !== undefined ? { coverLetter }  : {}),
        updatedAt: new Date(),
      },
      include: {
        freelancer: {
          select: {
            id:         true,
            firstName:  true,
            lastName:   true,
            avatar:     true,
            hourlyRate: true,
            rating:     true,
          },
        },
      },
    });

    this.logger.log(
      `Bid updated: ${bidId} | freelancer: ${freelancerId}`,
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // withdrawBid
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Allows a freelancer to withdraw their own PENDING bid.
   * The project's bidCount is decremented accordingly.
   */
  async withdrawBid(bidId: string, freelancerId: string): Promise<any> {
    const bid = await this.findBidOrFail(bidId);

    // ── Ownership check ───────────────────────────────────────────────────────
    if ((bid as any).freelancerId !== freelancerId) {
      throw new ForbiddenException('You are not authorized to withdraw this bid.');
    }

    // ── Status guard ──────────────────────────────────────────────────────────
    if ((bid as any).status === BidStatus.WITHDRAWN) {
      throw new ConflictException('This bid has already been withdrawn.');
    }

    if ((bid as any).status === BidStatus.ACCEPTED) {
      throw new ConflictException(
        'An accepted bid cannot be withdrawn. Please contact support if you need to cancel.',
      );
    }

    const projectId = (bid as any).projectId;

    // Withdraw bid + decrement bidCount + refund credit in a single transaction
    const [withdrawn] = await this.prisma.$transaction([
      this.prisma.bid.update({
        where: { id: bidId },
        data: { status: BidStatus.WITHDRAWN, updatedAt: new Date() },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: { bidCount: { decrement: 1 } },
      }),
    ]);

    // Refund bid credit
    await this.bidCreditsService.refundCredit(freelancerId);

    // Invalidate analytics cache
    await this.redisService
      .del(`bid_analytics:${projectId}`)
      .catch(() => null);

    // Emit Kafka event (non-blocking)
    this.emitKafkaEvent(KAFKA_TOPICS.BID_WITHDRAWN, {
      bidId,
      projectId,
      freelancerId,
      occurredAt: new Date().toISOString(),
    }).catch((err) =>
      this.logger.error('Kafka emit BID_WITHDRAWN failed', err),
    );

    this.logger.log(
      `Bid withdrawn: ${bidId} | project: ${projectId} | freelancer: ${freelancerId} | credit refunded`,
    );

    return withdrawn;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // awardBid
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Awards a bid — the core "hire" action on the platform.
   *
   * Steps (all inside a single DB transaction):
   *   1. Verify the calling user is the project owner (client).
   *   2. Set the chosen bid's status to ACCEPTED.
   *   3. Set all other non-WITHDRAWN bids to REJECTED.
   *   4. Create a Contract record linking the project, client, and freelancer.
   *   5. Move the project to IN_PROGRESS.
   *
   * After the transaction, a CONTRACT_STARTED Kafka event is emitted for
   * the notification and payment services.
   */
  async awardBid(bidId: string, clientId: string): Promise<any> {
    // ── Fetch bid with project ────────────────────────────────────────────────
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        project: {
          select: {
            id:        true,
            clientId:  true,
            status:    true,
            title:     true,
            budgetMin: true,
            budgetMax: true,
            type:      true,
          },
        },
      },
    });

    if (!bid) {
      throw new NotFoundException(`Bid with ID "${bidId}" was not found.`);
    }

    // ── Client ownership check ────────────────────────────────────────────────
    if ((bid.project as any).clientId !== clientId) {
      throw new ForbiddenException(
        'Only the project owner can award a bid.',
      );
    }

    // ── Project must be OPEN ──────────────────────────────────────────────────
    if ((bid.project as any).status !== ProjectStatus.OPEN) {
      throw new ConflictException(
        `A bid can only be awarded when the project is OPEN. ` +
          `This project is currently ${(bid.project as any).status}.`,
      );
    }

    // ── Bid must be PENDING ───────────────────────────────────────────────────
    if ((bid as any).status !== BidStatus.PENDING) {
      throw new ConflictException(
        `Only PENDING bids can be awarded. This bid is currently ${(bid as any).status}.`,
      );
    }

    const projectId    = (bid.project as any).id;
    const freelancerId = (bid as any).freelancerId;

    // ── Run everything in a single transaction ────────────────────────────────
    const [acceptedBid, contract] = await this.prisma.$transaction(async (tx) => {
      // 1. Accept the winning bid
      const accepted = await tx.bid.update({
        where: { id: bidId },
        data: { status: BidStatus.ACCEPTED, updatedAt: new Date() },
      });

      // 2. Reject all other non-WITHDRAWN bids on this project
      await tx.bid.updateMany({
        where: {
          projectId,
          id: { not: bidId },
          status: { not: BidStatus.WITHDRAWN },
        },
        data: { status: BidStatus.REJECTED, updatedAt: new Date() },
      });

      // 3. Create the Contract
      const newContract = await tx.contract.create({
        data: {
          projectId,
          clientId,
          freelancerId,
          bidId,
          title:        (bid as any).project?.title ?? 'Contract for ' + projectId,
          description:  (bid as any).project?.description ?? null,
          currency:     (bid as any).project?.currency ?? 'usd',
          terms:        (bid as any).coverLetter ?? null,
          status: ContractStatus.ACTIVE,
          amount: (bid as any).amount,
          startDate: new Date(),
        },
      });

      // 4. Move project to IN_PROGRESS and link the contract
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.IN_PROGRESS,
          contract: { connect: { id: newContract.id } },
          updatedAt: new Date(),
        },
      });

      return [accepted, newContract];
    });

    // ── Create milestones if provided in bid ──────────────────────────────────
    const bidMilestones = (bid as any).milestones;
    if (bidMilestones && Array.isArray(bidMilestones) && bidMilestones.length > 0) {
      await this.milestoneService.createMilestonesFromBid(
        projectId,
        contract.id,
        bidMilestones,
      );
    }

    // ── Invalidate analytics cache ────────────────────────────────────────────
    await this.redisService
      .del(`bid_analytics:${projectId}`)
      .catch(() => null);

    // ── Emit Kafka events (non-blocking) ──────────────────────────────────────
    const occurredAt = new Date().toISOString();

    this.emitKafkaEvent(KAFKA_TOPICS.BID_AWARDED, {
      bidId,
      projectId,
      clientId,
      freelancerId,
      amount:     (bid as any).amount,
      occurredAt,
    }).catch((err) =>
      this.logger.error('Kafka emit BID_AWARDED failed', err),
    );

    this.emitKafkaEvent(KAFKA_TOPICS.CONTRACT_STARTED, {
      contractId:  contract.id,
      projectId,
      clientId,
      freelancerId,
      bidId,
      amount:      (bid as any).amount,
      projectTitle:(bid.project as any).title,
      occurredAt,
    }).catch((err) =>
      this.logger.error('Kafka emit CONTRACT_STARTED failed', err),
    );

    this.logger.log(
      `Bid awarded: ${bidId} | contract: ${contract.id} | ` +
        `project: ${projectId} | freelancer: ${freelancerId}`,
    );

    // ── Return the full contract with related data ─────────────────────────────
    const fullContract = await this.prisma.contract.findUnique({
      where: { id: contract.id },
      include: {
        project:    { select: { id: true, title: true, type: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        client:     { select: { id: true, firstName: true, lastName: true, avatar: true } },
        bid:        { select: { id: true, amount: true, deliveryDays: true } },
      },
    });

    return {
      bid:      acceptedBid,
      contract: fullContract,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getBidsForProject
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns all bids for a project.  Restricted to the project owner (clientId).
   * An optional status filter can narrow the result set.
   */
  async getBidsForProject(
    projectId: string,
    clientId: string,
    statusFilter?: string,
  ): Promise<any[]> {
    // Verify project exists and caller is the owner
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, clientId: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${projectId}" was not found.`);
    }

    if ((project as any).clientId !== clientId) {
      throw new ForbiddenException('Only the project owner can view all bids.');
    }

    const where: any = { projectId };

    if (statusFilter) {
      const validStatuses = Object.values(BidStatus) as string[];
      if (!validStatuses.includes(statusFilter.toUpperCase())) {
        throw new BadRequestException(
          `Invalid status filter. Allowed values: ${validStatuses.join(', ')}.`,
        );
      }
      where.status = statusFilter.toUpperCase();
    }

    const bids = await this.prisma.bid.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        freelancer: {
          select: {
            id:          true,
            firstName:   true,
            lastName:    true,
            avatar:      true,
            bio:         true,
            hourlyRate:  true,
            rating:      true,
            skills:      { include: { skill: { select: { name: true } } } },
            _count: {
              select: { contractsAsFreelancer: true },
            },
            totalReviews: true,
          },
        },
      },
    });

    return bids;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private async findBidOrFail(bidId: string): Promise<any> {
    const bid = await this.prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) {
      throw new NotFoundException(`Bid with ID "${bidId}" was not found.`);
    }
    return bid;
  }

  /**
   * Emits a Kafka event.
   *
   * In the current monolith setup this is a structured log stub.
   * When extracting the project/bid logic into its own microservice,
   * replace the body with a real @nestjs/microservices ClientKafka call:
   *
   *   await this.kafkaClient.emit(topic, {
   *     key:   payload.projectId ?? payload.bidId,
   *     value: JSON.stringify(payload),
   *   }).toPromise();
   */
  private async emitKafkaEvent(
    topic: string,
    payload: Record<string, any>,
  ): Promise<void> {
    this.logger.debug(
      `[Kafka] → topic: "${topic}"  payload: ${JSON.stringify(payload)}`,
    );
  }
}
