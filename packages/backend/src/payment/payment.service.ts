import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { StripeService } from './stripe.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum TransactionType {
  ESCROW_DEPOSIT    = 'ESCROW_DEPOSIT',
  ESCROW_RELEASE    = 'ESCROW_RELEASE',
  PLATFORM_FEE      = 'PLATFORM_FEE',
  REFUND            = 'REFUND',
  WITHDRAWAL        = 'WITHDRAWAL',
  DISPUTE_HOLD      = 'DISPUTE_HOLD',
  DISPUTE_RELEASE   = 'DISPUTE_RELEASE',
}

export enum TransactionStatus {
  PENDING   = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED    = 'FAILED',
  REFUNDED  = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum MilestoneStatus {
  PENDING            = 'PENDING',
  IN_PROGRESS        = 'IN_PROGRESS',
  SUBMITTED          = 'SUBMITTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  APPROVED           = 'APPROVED',
  CANCELLED          = 'CANCELLED',
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
  PAYMENT_RECEIVED:       'payment.received',
  PAYMENT_FAILED:         'payment.failed',
  MILESTONE_SUBMITTED:    'milestone.submitted',
  MILESTONE_APPROVED:     'milestone.approved',
  MILESTONE_REVISION:     'milestone.revision_requested',
  WITHDRAWAL_REQUESTED:   'withdrawal.requested',
  ESCROW_FUNDED:          'escrow.funded',
} as const;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PaginationQuery {
  page?:       number;
  limit?:      number;
  type?:       string;
  status?:     string;
  startDate?:  string;
  endDate?:    string;
}

export interface PaginatedResult<T> {
  items:      T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface WithdrawalDto {
  amount:    number;
  currency?: string;
  note?:     string;
}

export interface SubmitMilestoneDto {
  deliverableUrl?:  string;
  deliverableUrls?: string[];
  note?:            string;
}

export interface ApproveMilestoneDto {
  rating?: number;
  note?:   string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDEMPOTENCY_KEY_TTL = 86_400; // 24 hours — matches Stripe's dedup window

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  /** Platform fee percentage (default 10 %) read from env. */
  private readonly platformFeePercent: number;

  constructor(
    private readonly prisma:        PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly redisService:  RedisService,
  ) {
    this.platformFeePercent = this.configService.get<number>(
      'PLATFORM_FEE_PERCENTAGE',
      10,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // createPaymentIntent — fund the escrow wallet
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a Stripe PaymentIntent representing the escrow deposit a client
   * must make before work on a contract begins.
   *
   * Steps:
   *   1. Validate the contract exists and the caller is the client.
   *   2. Ensure the contract is not already funded (idempotency via Redis).
   *   3. Create the Stripe PaymentIntent.
   *   4. Persist a PENDING ESCROW_DEPOSIT Transaction in the database.
   *   5. Return the client secret so the frontend can confirm the payment.
   */
  async createPaymentIntent(
    dto:    CreatePaymentDto,
    userId: string,
  ): Promise<{ clientSecret: string; transactionId: string; paymentIntentId: string }> {
    const { contractId, amount, currency = 'usd', description } = dto;

    // ── 1. Fetch contract ─────────────────────────────────────────────────────
    const contract = await this.prisma.contract.findUnique({
      where:   { id: contractId },
      include: {
        project:    { select: { id: true, title: true } },
        client:     { select: { id: true, email: true, firstName: true, lastName: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" was not found.`);
    }

    // ── 2. Only the client can fund escrow ────────────────────────────────────
    if ((contract as any).clientId !== userId) {
      throw new ForbiddenException('Only the contract client can fund the escrow.');
    }

    if ((contract as any).status !== ContractStatus.ACTIVE) {
      throw new ConflictException(
        `Escrow can only be funded for ACTIVE contracts. ` +
          `This contract is currently ${(contract as any).status}.`,
      );
    }

    // ── 3. Idempotency — prevent double-funding the same contract ─────────────
    const idempotencyKey  = `pi:contract:${contractId}`;
    const existingPiId    = await this.redisService.get(idempotencyKey);

    if (existingPiId) {
      this.logger.warn(
        `Duplicate PaymentIntent request for contract ${contractId}. ` +
          `Returning existing intent: ${existingPiId}`,
      );

      const existingIntent = await this.stripeService.retrievePaymentIntent(existingPiId);
      const existingTx     = await this.prisma.transaction.findFirst({
        where: { stripePaymentIntentId: existingPiId },
      });

      return {
        clientSecret:    existingIntent.client_secret!,
        transactionId:   existingTx?.id ?? '',
        paymentIntentId: existingPiId,
      };
    }

    // ── 4. Create Stripe PaymentIntent ────────────────────────────────────────
    // Stripe amounts are in the smallest currency unit (cents).
    const amountCents = Math.round(amount * 100);
    const client      = (contract as any).client;
    const project     = (contract as any).project;

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripeService.createPaymentIntent(
        amountCents,
        currency,
        {
          contractId,
          clientId:        userId,
          freelancerId:    (contract as any).freelancerId,
          projectId:       project.id,
          projectTitle:    project.title,
          clientEmail:     client.email,
          description:     description ?? `Escrow funding for: ${project.title}`,
        },
        idempotencyKey,
      );
    } catch (err) {
      this.logger.error('Stripe createPaymentIntent failed', err);
      throw new InternalServerErrorException(
        'Failed to create payment intent. Please try again.',
      );
    }

    // ── 5. Store idempotency key in Redis (24 h TTL) ──────────────────────────
    await this.redisService
      .setex(idempotencyKey, IDEMPOTENCY_KEY_TTL, intent.id)
      .catch((err) =>
        this.logger.warn(`Failed to cache idempotency key for intent ${intent.id}: ${err.message}`),
      );

    // ── 6. Persist PENDING transaction ────────────────────────────────────────
    const transaction = await this.prisma.transaction.create({
      data: {
        contractId,
        userId,
        type:                 TransactionType.ESCROW_DEPOSIT,
        status:               TransactionStatus.PENDING,
        amount,
        currency:             currency.toLowerCase(),
        stripePaymentIntentId: intent.id,
        description:          description ?? `Escrow deposit for contract ${contractId}`,
        metadata: {
          projectId:    project.id,
          projectTitle: project.title,
          freelancerId: (contract as any).freelancerId,
        },
      },
    });

    this.logger.log(
      `PaymentIntent created: ${intent.id} | ` +
        `contract: ${contractId} | amount: $${amount} ${currency.toUpperCase()}`,
    );

    return {
      clientSecret:    intent.client_secret!,
      transactionId:   transaction.id,
      paymentIntentId: intent.id,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // handleStripeWebhook — process incoming Stripe events
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handles Stripe webhook events delivered to `POST /payments/webhooks`.
   *
   * The raw request body (Buffer) and the `stripe-signature` header are required
   * for signature verification.  Supported event types:
   *
   *   • payment_intent.succeeded   — mark transaction COMPLETED, update contract
   *   • payment_intent.payment_failed — mark transaction FAILED, notify client
   *   • transfer.created           — log the transfer for audit trail
   *   • account.updated            — sync freelancer's Connect account status
   */
  async handleStripeWebhook(
    rawBody:   Buffer,
    signature: string,
  ): Promise<{ received: boolean }> {
    let event: Stripe.Event;

    // ── 1. Verify webhook signature ───────────────────────────────────────────
    try {
      event = this.stripeService.constructEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Stripe webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${(err as Error).message}`);
    }

    this.logger.log(`Processing Stripe webhook: ${event.type} | id: ${event.id}`);

    // ── 2. Idempotency — skip already-processed events ────────────────────────
    const processedKey = `stripe:event:${event.id}`;
    const alreadyProcessed = await this.redisService.get(processedKey).catch(() => null);

    if (alreadyProcessed) {
      this.logger.debug(`Stripe event ${event.id} already processed — skipping.`);
      return { received: true };
    }

    // ── 3. Route to specific handler ─────────────────────────────────────────
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.onPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'transfer.created':
          await this.onTransferCreated(event.data.object as Stripe.Transfer);
          break;

        case 'account.updated':
          await this.onConnectedAccountUpdated(event.data.object as Stripe.Account);
          break;

        default:
          this.logger.debug(`Unhandled Stripe webhook type: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(
        `Error processing Stripe webhook ${event.type} (${event.id}): ${err.message}`,
        err.stack,
      );
      // Return 200 to Stripe to prevent retries for application-level errors.
      // Stripe retries on non-2xx responses, which can cause duplicate processing.
      return { received: true };
    }

    // ── 4. Mark event as processed (24 h TTL) ────────────────────────────────
    await this.redisService
      .setex(processedKey, IDEMPOTENCY_KEY_TTL, '1')
      .catch((err) =>
        this.logger.warn(`Failed to mark event ${event.id} as processed: ${err.message}`),
      );

    return { received: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // releaseMilestone — client triggers Stripe Transfer after approval
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Releases payment for an approved milestone by creating a Stripe Transfer
   * to the freelancer's Connect account (minus the platform fee).
   *
   * Business rules:
   *   1. The milestone must be in SUBMITTED status (not yet APPROVED).
   *   2. The caller must be the contract client.
   *   3. The freelancer must have a Stripe Connect account ID on file.
   *   4. The platform fee is deducted before the transfer.
   *   5. An ESCROW_RELEASE transaction is created, and a PLATFORM_FEE
   *      transaction records the fee taken.
   */
  async releaseMilestone(
    milestoneId: string,
    clientId:    string,
  ): Promise<{ transfer: Stripe.Transfer; transaction: any }> {
    // ── 1. Fetch milestone with contract ──────────────────────────────────────
    const milestone = await this.prisma.milestone.findUnique({
      where:   { id: milestoneId },
      include: {
        contract: {
          include: {
            client:     { select: { id: true, email: true } },
            freelancer: { select: { id: true, stripeAccountId: true, email: true, firstName: true } },
          },
        },
      },
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone with ID "${milestoneId}" was not found.`);
    }

    // ── 2. Authorization — only the contract client can release payment ────────
    if ((milestone.contract as any).clientId !== clientId) {
      throw new ForbiddenException('Only the contract client can release milestone payment.');
    }

    // ── 3. Milestone must be in SUBMITTED state ───────────────────────────────
    if ((milestone as any).status !== MilestoneStatus.SUBMITTED) {
      throw new ConflictException(
        `Milestone must be in SUBMITTED status to release payment. ` +
          `Current status: ${(milestone as any).status}.`,
      );
    }

    // ── 4. Freelancer must have a Stripe Connect account ─────────────────────
    const stripeAccountId = (milestone.contract as any).freelancer?.stripeAccountId;
    if (!stripeAccountId) {
      throw new ConflictException(
        'The freelancer has not yet connected their Stripe account. ' +
          'Payment cannot be released until they complete Stripe onboarding.',
      );
    }

    // ── 5. Calculate platform fee and net amount ──────────────────────────────
    const grossAmount = (milestone as any).amount as number;
    const feeAmount   = Math.round((grossAmount * this.platformFeePercent) / 100 * 100) / 100;
    const netAmount   = Math.round((grossAmount - feeAmount) * 100) / 100;

    const netAmountCents = Math.round(netAmount * 100);

    // ── 6. Create Stripe Transfer ─────────────────────────────────────────────
    let transfer: Stripe.Transfer;
    try {
      transfer = await this.stripeService.createTransfer(
        netAmountCents,
        'usd',
        stripeAccountId,
        {
          milestoneId,
          contractId:  (milestone as any).contractId,
          clientId,
          freelancerId: (milestone.contract as any).freelancerId,
          grossAmount:  grossAmount.toString(),
          feeAmount:    feeAmount.toString(),
          netAmount:    netAmount.toString(),
        },
        `contract:${(milestone as any).contractId}`,  // transfer_group
        `milestone:release:${milestoneId}`,            // idempotency key
      );
    } catch (err) {
      this.logger.error(`Stripe transfer failed for milestone ${milestoneId}`, err);
      throw new InternalServerErrorException(
        'Failed to transfer funds to the freelancer. Please try again or contact support.',
      );
    }

    // ── 7. Update milestone status + create transaction records ──────────────
    const [updatedMilestone, escrowReleaseTx] = await this.prisma.$transaction([
      // Mark milestone APPROVED
      this.prisma.milestone.update({
        where: { id: milestoneId },
        data:  { status: MilestoneStatus.APPROVED, paidAt: new Date(), updatedAt: new Date() },
      }),

      // Record the escrow release
      this.prisma.transaction.create({
        data: {
          contractId:      (milestone as any).contractId,
          userId:          (milestone.contract as any).freelancerId,
          type:            TransactionType.ESCROW_RELEASE,
          status:          TransactionStatus.COMPLETED,
          amount:          netAmount,
          currency:        'usd',
          stripeTransferId: transfer.id,
          description:     `Milestone payment: ${(milestone as any).title ?? milestoneId}`,
          metadata: {
            milestoneId,
            stripeAccountId,
            grossAmount,
            platformFee:    feeAmount,
          },
        },
      }),
    ]);

    // Also record the platform fee as a separate ledger entry
    this.prisma.transaction.create({
      data: {
        contractId:  (milestone as any).contractId,
        userId:      clientId,
        type:        TransactionType.PLATFORM_FEE,
        status:      TransactionStatus.COMPLETED,
        amount:      feeAmount,
        currency:    'usd',
        description: `Platform fee (${this.platformFeePercent}%) for milestone: ${milestoneId}`,
        metadata:    { milestoneId },
      },
    }).catch((err) =>
      this.logger.warn(`Failed to record platform fee transaction: ${err.message}`),
    );

    // ── 8. Check if all milestones are approved → mark contract COMPLETED ──────
    this.checkAndCompleteContract((milestone as any).contractId).catch((err) =>
      this.logger.warn(`Failed to check contract completion: ${err.message}`),
    );

    // ── 9. Emit Kafka event ───────────────────────────────────────────────────
    this.emitKafkaEvent(KAFKA_TOPICS.PAYMENT_RECEIVED, {
      milestoneId,
      contractId:  (milestone as any).contractId,
      freelancerId: (milestone.contract as any).freelancerId,
      clientId,
      grossAmount,
      netAmount,
      feeAmount,
      stripeTransferId: transfer.id,
      occurredAt:  new Date().toISOString(),
    }).catch((err) => this.logger.error('Kafka emit PAYMENT_RECEIVED failed', err));

    this.logger.log(
      `Milestone payment released: ${milestoneId} | ` +
        `net: $${netAmount} → ${stripeAccountId} | transfer: ${transfer.id}`,
    );

    return { transfer, transaction: escrowReleaseTx };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // submitMilestone — freelancer marks work as done
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Allows the freelancer to submit a milestone for client review.
   * The milestone must be IN_PROGRESS or REVISION_REQUESTED.
   *
   * @param milestoneId   UUID of the milestone.
   * @param freelancerId  UUID of the authenticated freelancer.
   * @param dto           Optional deliverable URLs and a submission note.
   */
  async submitMilestone(
    milestoneId:  string,
    freelancerId: string,
    dto?:         SubmitMilestoneDto,
  ): Promise<any> {
    // ── 1. Fetch milestone ────────────────────────────────────────────────────
    const milestone = await this.prisma.milestone.findUnique({
      where:   { id: milestoneId },
      include: {
        contract: {
          select: {
            freelancerId: true,
            clientId:     true,
            status:       true,
          },
        },
      },
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone with ID "${milestoneId}" was not found.`);
    }

    // ── 2. Authorization ──────────────────────────────────────────────────────
    if ((milestone.contract as any).freelancerId !== freelancerId) {
      throw new ForbiddenException('Only the contract freelancer can submit a milestone.');
    }

    // ── 3. Contract must be active ────────────────────────────────────────────
    if ((milestone.contract as any).status !== ContractStatus.ACTIVE) {
      throw new ConflictException(
        `Cannot submit a milestone for a ${(milestone.contract as any).status} contract.`,
      );
    }

    // ── 4. Milestone must be in a submittable state ───────────────────────────
    const allowedStatuses: string[] = [
      MilestoneStatus.IN_PROGRESS,
      MilestoneStatus.REVISION_REQUESTED,
    ];

    if (!allowedStatuses.includes((milestone as any).status)) {
      throw new ConflictException(
        `Milestone can only be submitted when it is IN_PROGRESS or REVISION_REQUESTED. ` +
          `Current status: ${(milestone as any).status}.`,
      );
    }

    // ── 5. Build deliverables list ────────────────────────────────────────────
    const deliverableUrls = dto?.deliverableUrls
      ?? (dto?.deliverableUrl ? [dto.deliverableUrl] : []);

    // ── 6. Update milestone ───────────────────────────────────────────────────
    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status:          MilestoneStatus.SUBMITTED,
        submittedAt:     new Date(),
        submissionNote:  dto?.note ?? null,
        deliverableUrls: deliverableUrls.length > 0 ? deliverableUrls : undefined,
        updatedAt:       new Date(),
      },
    });

    // ── 7. Emit Kafka event ───────────────────────────────────────────────────
    this.emitKafkaEvent(KAFKA_TOPICS.MILESTONE_SUBMITTED, {
      milestoneId,
      contractId:  (milestone as any).contractId,
      freelancerId,
      clientId:    (milestone.contract as any).clientId,
      occurredAt:  new Date().toISOString(),
    }).catch((err) => this.logger.error('Kafka emit MILESTONE_SUBMITTED failed', err));

    this.logger.log(
      `Milestone submitted: ${milestoneId} | freelancer: ${freelancerId}`,
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // approveMilestone — client approves submitted work
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * The client approves a submitted milestone.
   * Approval automatically triggers payment release via releaseMilestone().
   *
   * @param milestoneId  UUID of the milestone.
   * @param clientId     UUID of the authenticated client.
   * @param dto          Optional approval note and rating.
   */
  async approveMilestone(
    milestoneId: string,
    clientId:    string,
    dto?:        ApproveMilestoneDto,
  ): Promise<{ milestone: any; transfer: Stripe.Transfer; transaction: any }> {
    // ── 1. Fetch milestone ────────────────────────────────────────────────────
    const milestone = await this.prisma.milestone.findUnique({
      where:   { id: milestoneId },
      include: {
        contract: {
          select: { clientId: true, status: true },
        },
      },
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone with ID "${milestoneId}" was not found.`);
    }

    // ── 2. Authorization ──────────────────────────────────────────────────────
    if ((milestone.contract as any).clientId !== clientId) {
      throw new ForbiddenException('Only the contract client can approve a milestone.');
    }

    // ── 3. Milestone must be SUBMITTED ────────────────────────────────────────
    if ((milestone as any).status !== MilestoneStatus.SUBMITTED) {
      throw new ConflictException(
        `Only SUBMITTED milestones can be approved. ` +
          `Current status: ${(milestone as any).status}.`,
      );
    }

    // ── 4. Record approval note ───────────────────────────────────────────────
    if (dto?.note) {
      await this.prisma.milestone.update({
        where: { id: milestoneId },
        data:  { approvalNote: dto.note, updatedAt: new Date() },
      });
    }

    // ── 5. Trigger payment release ────────────────────────────────────────────
    const { transfer, transaction } = await this.releaseMilestone(milestoneId, clientId);

    // ── 6. Emit Kafka event ───────────────────────────────────────────────────
    this.emitKafkaEvent(KAFKA_TOPICS.MILESTONE_APPROVED, {
      milestoneId,
      contractId:  (milestone as any).contractId,
      clientId,
      rating:      dto?.rating,
      occurredAt:  new Date().toISOString(),
    }).catch((err) => this.logger.error('Kafka emit MILESTONE_APPROVED failed', err));

    const updatedMilestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    return { milestone: updatedMilestone, transfer, transaction };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // requestRevision — client requests changes
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * The client requests a revision on a submitted milestone.
   * The milestone status is set back to REVISION_REQUESTED, and the freelancer
   * is notified via a Kafka event.
   *
   * @param milestoneId  UUID of the milestone.
   * @param clientId     UUID of the authenticated client.
   * @param note         Description of what changes are required.
   */
  async requestRevision(
    milestoneId: string,
    clientId:    string,
    note:        string,
  ): Promise<any> {
    // ── 1. Fetch milestone ────────────────────────────────────────────────────
    const milestone = await this.prisma.milestone.findUnique({
      where:   { id: milestoneId },
      include: {
        contract: {
          select: { clientId: true, freelancerId: true, status: true },
        },
      },
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone with ID "${milestoneId}" was not found.`);
    }

    // ── 2. Authorization ──────────────────────────────────────────────────────
    if ((milestone.contract as any).clientId !== clientId) {
      throw new ForbiddenException('Only the contract client can request a revision.');
    }

    // ── 3. Milestone must be SUBMITTED ────────────────────────────────────────
    if ((milestone as any).status !== MilestoneStatus.SUBMITTED) {
      throw new ConflictException(
        `Revisions can only be requested on SUBMITTED milestones. ` +
          `Current status: ${(milestone as any).status}.`,
      );
    }

    if (!note || note.trim().length < 10) {
      throw new BadRequestException(
        'A revision note is required and must be at least 10 characters long.',
      );
    }

    // ── 4. Update milestone ───────────────────────────────────────────────────
    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status:       MilestoneStatus.REVISION_REQUESTED,
        revisionNote: note.trim(),
        updatedAt:    new Date(),
      },
    });

    // ── 5. Emit Kafka event ───────────────────────────────────────────────────
    this.emitKafkaEvent(KAFKA_TOPICS.MILESTONE_REVISION, {
      milestoneId,
      contractId:  (milestone as any).contractId,
      clientId,
      freelancerId: (milestone.contract as any).freelancerId,
      revisionNote: note,
      occurredAt:  new Date().toISOString(),
    }).catch((err) => this.logger.error('Kafka emit MILESTONE_REVISION failed', err));

    this.logger.log(
      `Revision requested: ${milestoneId} | client: ${clientId}`,
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getTransactions — paginated transaction history
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of transactions for the authenticated user.
   * Both clients (deposits, fees, refunds) and freelancers (releases, withdrawals)
   * can query their own transaction history.
   *
   * @param userId  UUID of the authenticated user.
   * @param query   Optional pagination and filter parameters.
   */
  async getTransactions(
    userId: string,
    query:  PaginationQuery = {},
  ): Promise<PaginatedResult<any>> {
    const {
      page      = 1,
      limit     = 20,
      type,
      status,
      startDate,
      endDate,
    } = query;

    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip      = (safePage - 1) * safeLimit;

    // ── Build where clause ────────────────────────────────────────────────────
    const where: any = { userId };

    if (type) {
      const validTypes = Object.values(TransactionType) as string[];
      if (!validTypes.includes(type.toUpperCase())) {
        throw new BadRequestException(
          `Invalid transaction type. Allowed values: ${validTypes.join(', ')}.`,
        );
      }
      where.type = type.toUpperCase();
    }

    if (status) {
      const validStatuses = Object.values(TransactionStatus) as string[];
      if (!validStatuses.includes(status.toUpperCase())) {
        throw new BadRequestException(
          `Invalid transaction status. Allowed values: ${validStatuses.join(', ')}.`,
        );
      }
      where.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate)   where.createdAt.lte = new Date(endDate);
    }

    // ── Execute paginated query ───────────────────────────────────────────────
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take:    safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          contract: {
            select: {
              id:      true,
              project: { select: { id: true, title: true } },
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items,
      total,
      page:       safePage,
      limit:      safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // requestWithdrawal — freelancer cash-out
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Initiates a withdrawal for a freelancer — moves available funds from their
   * Stripe Connect account to their connected bank account.
   *
   * @param freelancerId  UUID of the authenticated freelancer.
   * @param dto           Withdrawal amount, currency, and optional note.
   */
  async requestWithdrawal(
    freelancerId: string,
    dto:          WithdrawalDto,
  ): Promise<{ withdrawal: any }> {
    const { amount, currency = 'usd', note } = dto;

    if (amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than 0.');
    }

    // ── 1. Fetch freelancer's Stripe account ──────────────────────────────────
    const freelancer = await this.prisma.user.findUnique({
      where:  { id: freelancerId },
      select: { id: true, stripeAccountId: true, email: true, firstName: true },
    });

    if (!freelancer) {
      throw new NotFoundException(`User with ID "${freelancerId}" was not found.`);
    }

    if (!(freelancer as any).stripeAccountId) {
      throw new ConflictException(
        'You must connect your Stripe account before requesting a withdrawal. ' +
          'Please complete the Stripe Connect onboarding.',
      );
    }

    const stripeAccountId = (freelancer as any).stripeAccountId as string;

    // ── 2. Check available balance ────────────────────────────────────────────
    let balance: Stripe.Balance;
    try {
      balance = await this.stripeService.retrieveConnectedAccountBalance(stripeAccountId);
    } catch (err) {
      this.logger.error(`Failed to retrieve balance for account ${stripeAccountId}`, err);
      throw new InternalServerErrorException(
        'Failed to check your Stripe balance. Please try again.',
      );
    }

    const availableBalance =
      balance.available.find((b) => b.currency === currency.toLowerCase())?.amount ?? 0;

    const requestedCents = Math.round(amount * 100);

    if (requestedCents > availableBalance) {
      throw new ConflictException(
        `Insufficient balance. Available: $${(availableBalance / 100).toFixed(2)} ${currency.toUpperCase()}. ` +
          `Requested: $${amount.toFixed(2)} ${currency.toUpperCase()}.`,
      );
    }

    // ── 3. Create Stripe Payout ───────────────────────────────────────────────
    let payout: Stripe.Payout;
    try {
      payout = await this.stripeService.createPayout(
        requestedCents,
        currency,
        stripeAccountId,
        undefined,
        {
          freelancerId,
          note: note ?? '',
        },
      );
    } catch (err) {
      this.logger.error(`Stripe payout failed for freelancer ${freelancerId}`, err);
      throw new InternalServerErrorException(
        'Failed to initiate withdrawal. Please try again or contact support.',
      );
    }

    // ── 4. Record WITHDRAWAL transaction ──────────────────────────────────────
    const withdrawal = await this.prisma.transaction.create({
      data: {
        userId:          freelancerId,
        contractId:      null,
        type:            TransactionType.WITHDRAWAL,
        status:          TransactionStatus.PENDING,
        amount,
        currency:        currency.toLowerCase(),
        stripePayoutId:  payout.id,
        description:     note ?? `Withdrawal of $${amount} ${currency.toUpperCase()}`,
        metadata: {
          stripeAccountId,
          stripePayoutStatus: payout.status,
        },
      },
    });

    // ── 5. Emit Kafka event ───────────────────────────────────────────────────
    this.emitKafkaEvent(KAFKA_TOPICS.WITHDRAWAL_REQUESTED, {
      freelancerId,
      amount,
      currency,
      stripePayoutId: payout.id,
      occurredAt:     new Date().toISOString(),
    }).catch((err) => this.logger.error('Kafka emit WITHDRAWAL_REQUESTED failed', err));

    this.logger.log(
      `Withdrawal initiated: $${amount} ${currency.toUpperCase()} ` +
        `| freelancer: ${freelancerId} | payout: ${payout.id}`,
    );

    return { withdrawal };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private — Stripe webhook sub-handlers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Called when `payment_intent.succeeded` webhook arrives.
   * Marks the corresponding Transaction as COMPLETED and, if applicable,
   * emits a ESCROW_FUNDED event so the project/contract service can unlock
   * milestone submissions.
   */
  private async onPaymentIntentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { stripePaymentIntentId: intent.id },
    });

    if (!transaction) {
      this.logger.warn(
        `payment_intent.succeeded: no local transaction found for intent ${intent.id}. ` +
          `This may be a test event.`,
      );
      return;
    }

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data:  { status: TransactionStatus.COMPLETED, updatedAt: new Date() },
    });

    this.logger.log(
      `Transaction marked COMPLETED: ${transaction.id} | intent: ${intent.id}`,
    );

    // Emit ESCROW_FUNDED so contract service can start milestone timers
    await this.emitKafkaEvent(KAFKA_TOPICS.ESCROW_FUNDED, {
      transactionId: transaction.id,
      contractId:    (transaction as any).contractId,
      amount:        intent.amount / 100,
      currency:      intent.currency,
      occurredAt:    new Date().toISOString(),
    });
  }

  /**
   * Called when `payment_intent.payment_failed` webhook arrives.
   * Marks the Transaction as FAILED and emits a PAYMENT_FAILED event
   * so the client can be notified to retry.
   */
  private async onPaymentIntentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { stripePaymentIntentId: intent.id },
    });

    if (!transaction) {
      this.logger.warn(
        `payment_intent.payment_failed: no local transaction found for intent ${intent.id}.`,
      );
      return;
    }

    const failureMessage =
      intent.last_payment_error?.message ?? 'Payment failed. No further details available.';

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status:    TransactionStatus.FAILED,
        failureReason: failureMessage,
        updatedAt: new Date(),
      },
    });

    this.logger.warn(
      `Transaction marked FAILED: ${transaction.id} | intent: ${intent.id} | ` +
        `reason: ${failureMessage}`,
    );

    await this.emitKafkaEvent(KAFKA_TOPICS.PAYMENT_FAILED, {
      transactionId: transaction.id,
      contractId:    (transaction as any).contractId,
      userId:        (transaction as any).userId,
      failureReason: failureMessage,
      occurredAt:    new Date().toISOString(),
    });
  }

  /**
   * Called when `transfer.created` webhook arrives.
   * Logs the transfer for audit purposes; the Transaction record was already
   * created synchronously in releaseMilestone().
   */
  private async onTransferCreated(transfer: Stripe.Transfer): Promise<void> {
    this.logger.log(
      `Stripe transfer confirmed: ${transfer.id} | ` +
        `amount: ${transfer.amount} ${transfer.currency.toUpperCase()} ` +
        `→ ${transfer.destination}`,
    );

    // Update the transaction's stripeTransferId if it wasn't set (race-condition safety)
    await this.prisma.transaction
      .updateMany({
        where: {
          stripeTransferId: null,
          metadata: { path: ['milestoneId'], equals: transfer.metadata?.milestoneId },
        },
        data: { stripeTransferId: transfer.id },
      })
      .catch((err) =>
        this.logger.warn(`Could not backfill stripeTransferId for transfer ${transfer.id}: ${err.message}`),
      );
  }

  /**
   * Called when `account.updated` webhook arrives.
   * Syncs the freelancer's Stripe Connect account status
   * (e.g. charges_enabled, payouts_enabled) to the database.
   */
  private async onConnectedAccountUpdated(account: Stripe.Account): Promise<void> {
    this.logger.debug(
      `Connected account updated: ${account.id} | ` +
        `charges_enabled: ${account.charges_enabled} | ` +
        `payouts_enabled: ${account.payouts_enabled}`,
    );

    await this.prisma.user
      .updateMany({
        where: { stripeAccountId: account.id },
        data: {
          stripeAccountStatus: account.charges_enabled && account.payouts_enabled
            ? 'ACTIVE'
            : 'PENDING',
          updatedAt: new Date(),
        },
      })
      .catch((err) =>
        this.logger.warn(`Could not sync Stripe account status for ${account.id}: ${err.message}`),
      );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private — contract completion check
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Checks whether all milestones in a contract are APPROVED.
   * If so, marks the contract COMPLETED.
   */
  private async checkAndCompleteContract(contractId: string): Promise<void> {
    const milestones = await this.prisma.milestone.findMany({
      where:  { contractId },
      select: { status: true },
    });

    if (milestones.length === 0) return;

    const allApproved = milestones.every(
      (m) => (m as any).status === MilestoneStatus.APPROVED,
    );

    if (allApproved) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data:  { status: ContractStatus.COMPLETED, endDate: new Date(), updatedAt: new Date() },
      });

      this.logger.log(`Contract completed: ${contractId} — all milestones approved.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Refunds
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Issues a refund for a completed escrow deposit transaction.
   * Can be full or partial. Creates a REFUND transaction record.
   *
   * @param transactionId  UUID of the original ESCROW_DEPOSIT transaction.
   * @param userId         UUID of the user requesting the refund (must be client or admin).
   * @param amount         Amount to refund (omit for full refund).
   * @param reason         Refund reason.
   * @param note           Additional notes.
   */
  async createRefund(
    transactionId: string,
    userId: string,
    amount?: number,
    reason?: string,
    note?: string,
  ): Promise<{ refund: any; transaction: any }> {
    // ── 1. Fetch original transaction ─────────────────────────────────────────
    const originalTx = await this.prisma.transaction.findUnique({
      where:   { id: transactionId },
      include: {
        contract: {
          select: { id: true, clientId: true, status: true },
        },
      },
    });

    if (!originalTx) {
      throw new NotFoundException(`Transaction with ID "${transactionId}" was not found.`);
    }

    // ── 2. Validate transaction type and status ───────────────────────────────
    if ((originalTx as any).type !== TransactionType.ESCROW_DEPOSIT) {
      throw new ConflictException('Only ESCROW_DEPOSIT transactions can be refunded.');
    }

    if ((originalTx as any).status !== TransactionStatus.COMPLETED) {
      throw new ConflictException(
        `Transaction must be COMPLETED to refund. Current status: ${(originalTx as any).status}.`,
      );
    }

    // ── 3. Authorization — only client or admin can refund ────────────────────
    const isClient = (originalTx.contract as any)?.clientId === userId;
    // In production, check if userId has ADMIN role
    if (!isClient) {
      throw new ForbiddenException('Only the client or an admin can request a refund.');
    }

    // ── 4. Calculate refund amount ────────────────────────────────────────────
    const originalAmount = Number((originalTx as any).amount);
    const refundAmount = amount ?? originalAmount;

    if (refundAmount > originalAmount) {
      throw new BadRequestException(
        `Refund amount (${refundAmount}) cannot exceed original transaction amount (${originalAmount}).`,
      );
    }

    const refundAmountCents = Math.round(refundAmount * 100);

    // ── 5. Issue Stripe refund ────────────────────────────────────────────────
    const paymentIntentId = (originalTx as any).stripePaymentIntentId;
    if (!paymentIntentId) {
      throw new ConflictException('Original transaction has no Stripe PaymentIntent ID.');
    }

    let stripeRefund: any;
    try {
      stripeRefund = await this.stripeService.createRefund(
        paymentIntentId,
        refundAmountCents,
        reason as any,
        {
          transactionId,
          contractId: (originalTx as any).contractId,
          userId,
          note: note ?? '',
        },
      );
    } catch (err) {
      this.logger.error(`Stripe refund failed for transaction ${transactionId}`, err);
      throw new InternalServerErrorException(
        'Failed to process refund. Please try again or contact support.',
      );
    }

    // ── 6. Create REFUND transaction record ───────────────────────────────────
    const refundTx = await this.prisma.transaction.create({
      data: {
        contractId:      (originalTx as any).contractId,
        userId,
        type:            TransactionType.REFUND,
        status:          TransactionStatus.COMPLETED,
        amount:          refundAmount,
        currency:        (originalTx as any).currency,
        stripeRefundId:  stripeRefund.id,
        description:     note ?? `Refund for transaction ${transactionId}`,
        metadata: {
          originalTransactionId: transactionId,
          reason,
        },
      },
    });

    this.logger.log(
      `Refund processed: ${refundTx.id} | amount: ${refundAmount} | ` +
        `original: ${transactionId} | stripeRefund: ${stripeRefund.id}`,
    );

    return { refund: stripeRefund, transaction: refundTx };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Dispute Hold & Release
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Places a contract on dispute hold.
   * Prevents milestone releases until the dispute is resolved.
   *
   * @param contractId  UUID of the contract.
   * @param userId      UUID of the user filing the dispute.
   * @param reason      Reason for the dispute.
   */
  async placeDisputeHold(
    contractId: string,
    userId: string,
    reason: string,
  ): Promise<any> {
    // ── 1. Fetch contract ─────────────────────────────────────────────────────
    const contract = await this.prisma.contract.findUnique({
      where:   { id: contractId },
      include: {
        client:     { select: { id: true, email: true } },
        freelancer: { select: { id: true, email: true } },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" was not found.`);
    }

    // ── 2. Authorization — client or freelancer can file dispute ──────────────
    const isParty =
      (contract as any).clientId === userId || (contract as any).freelancerId === userId;

    if (!isParty) {
      throw new ForbiddenException('Only contract parties can file a dispute.');
    }

    // ── 3. Contract must be ACTIVE ────────────────────────────────────────────
    if ((contract as any).status !== ContractStatus.ACTIVE) {
      throw new ConflictException(
        `Cannot place dispute hold on a ${(contract as any).status} contract.`,
      );
    }

    // ── 4. Update contract status to DISPUTED ─────────────────────────────────
    const updated = await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status:       ContractStatus.DISPUTED,
        disputeReason: reason,
        disputedAt:   new Date(),
        updatedAt:    new Date(),
      },
    });

    // ── 5. Create DISPUTE_HOLD transaction record ─────────────────────────────
    await this.prisma.transaction.create({
      data: {
        contractId,
        userId,
        type:        TransactionType.DISPUTE_HOLD,
        status:      TransactionStatus.COMPLETED,
        amount:      0, // No money movement, just a status marker
        currency:    'usd',
        description: `Dispute hold placed on contract ${contractId}`,
        metadata: {
          reason,
          filedBy: userId,
        },
      },
    });

    this.logger.log(
      `Dispute hold placed: contract ${contractId} | filed by: ${userId}`,
    );

    return updated;
  }

  /**
   * Releases a contract from dispute hold after admin resolution.
   * Executes the outcome: full refund, partial refund, or release to freelancer.
   *
   * @param contractId   UUID of the contract.
   * @param adminId      UUID of the admin resolving the dispute.
   * @param outcome      Resolution outcome.
   * @param refundAmount Amount to refund (for PARTIAL_REFUND).
   * @param adminNotes   Admin notes about the resolution.
   */
  async releaseDisputeHold(
    contractId: string,
    adminId: string,
    outcome: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'RELEASE_TO_FREELANCER',
    refundAmount?: number,
    adminNotes?: string,
  ): Promise<any> {
    // ── 1. Fetch contract ─────────────────────────────────────────────────────
    const contract = await this.prisma.contract.findUnique({
      where:   { id: contractId },
      include: {
        client:     { select: { id: true, email: true } },
        freelancer: { select: { id: true, email: true, stripeAccountId: true } },
        milestones: { select: { id: true, status: true, amount: true } },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" was not found.`);
    }

    // ── 2. Contract must be DISPUTED ──────────────────────────────────────────
    if ((contract as any).status !== ContractStatus.DISPUTED) {
      throw new ConflictException(
        `Contract is not in DISPUTED status. Current status: ${(contract as any).status}.`,
      );
    }

    // ── 3. Execute outcome ────────────────────────────────────────────────────
    let result: any;

    switch (outcome) {
      case 'FULL_REFUND': {
        // Find the original escrow deposit transaction
        const escrowTx = await this.prisma.transaction.findFirst({
          where: {
            contractId,
            type:   TransactionType.ESCROW_DEPOSIT,
            status: TransactionStatus.COMPLETED,
          },
        });

        if (!escrowTx) {
          throw new NotFoundException('No completed escrow deposit found for this contract.');
        }

        result = await this.createRefund(
          escrowTx.id,
          (contract as any).clientId,
          undefined, // full refund
          'dispute',
          adminNotes,
        );
        break;
      }

      case 'PARTIAL_REFUND': {
        if (!refundAmount || refundAmount <= 0) {
          throw new BadRequestException('Refund amount is required for PARTIAL_REFUND outcome.');
        }

        const escrowTx = await this.prisma.transaction.findFirst({
          where: {
            contractId,
            type:   TransactionType.ESCROW_DEPOSIT,
            status: TransactionStatus.COMPLETED,
          },
        });

        if (!escrowTx) {
          throw new NotFoundException('No completed escrow deposit found for this contract.');
        }

        result = await this.createRefund(
          escrowTx.id,
          (contract as any).clientId,
          refundAmount,
          'dispute',
          adminNotes,
        );
        break;
      }

      case 'RELEASE_TO_FREELANCER': {
        // Release all pending milestones to the freelancer
        const pendingMilestones = (contract as any).milestones.filter(
          (m: any) => m.status === MilestoneStatus.SUBMITTED,
        );

        if (pendingMilestones.length === 0) {
          throw new ConflictException('No pending milestones to release.');
        }

        // Release each milestone
        const releases = await Promise.all(
          pendingMilestones.map((m: any) =>
            this.releaseMilestone(m.id, (contract as any).clientId),
          ),
        );

        result = { releases };
        break;
      }
    }

    // ── 4. Update contract status ─────────────────────────────────────────────
    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status:              ContractStatus.ACTIVE,
        disputeResolvedAt:   new Date(),
        disputeResolution:   outcome,
        disputeAdminNotes:   adminNotes,
        updatedAt:           new Date(),
      },
    });

    // ── 5. Create DISPUTE_RELEASE transaction record ──────────────────────────
    await this.prisma.transaction.create({
      data: {
        contractId,
        userId:      adminId,
        type:        TransactionType.DISPUTE_RELEASE,
        status:      TransactionStatus.COMPLETED,
        amount:      0,
        currency:    'usd',
        description: `Dispute resolved: ${outcome}`,
        metadata: {
          outcome,
          refundAmount,
          adminNotes,
          resolvedBy: adminId,
        },
      },
    });

    this.logger.log(
      `Dispute resolved: contract ${contractId} | outcome: ${outcome} | admin: ${adminId}`,
    );

    return { contract: updatedContract, result };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private — Kafka stub
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Emits a structured Kafka event.
   *
   * In the current monolith this is a debug-log stub.
   * Replace the body with a real ClientKafka.emit() call when splitting
   * this module into a standalone payment microservice.
   */
  private async emitKafkaEvent(
    topic:   string,
    payload: Record<string, any>,
  ): Promise<void> {
    this.logger.debug(
      `[Kafka] → topic: "${topic}"  payload: ${JSON.stringify(payload)}`,
    );

    // TODO: replace with real Kafka client
    // await this.kafkaClient.emit(topic, {
    //   key:   payload.contractId ?? payload.milestoneId,
    //   value: JSON.stringify(payload),
    // }).toPromise();
  }
}
