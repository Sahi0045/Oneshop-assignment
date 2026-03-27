import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface CreateMilestoneDto {
  title: string;
  description?: string;
  amount: number;
  durationDays: number;
  order?: number;
}

@Injectable()
export class MilestoneService {
  private readonly logger = new Logger(MilestoneService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create milestones for a project (from bid milestones)
   */
  async createMilestonesFromBid(
    projectId: string,
    contractId: string,
    bidMilestones: any[],
  ): Promise<any[]> {
    if (!bidMilestones || bidMilestones.length === 0) {
      return [];
    }

    const milestones = await Promise.all(
      bidMilestones.map((milestone, index) =>
        this.prisma.milestone.create({
          data: {
            projectId,
            contractId,
            title: milestone.title,
            description: milestone.description,
            amount: milestone.amount,
            durationDays: milestone.durationDays,
            order: milestone.order || index + 1,
            status: MilestoneStatus.PENDING,
          },
        }),
      ),
    );

    this.logger.log(
      `Created ${milestones.length} milestones for contract ${contractId}`,
    );

    return milestones;
  }

  /**
   * Get all milestones for a contract
   */
  async getMilestonesByContract(contractId: string): Promise<any[]> {
    return this.prisma.milestone.findMany({
      where: { contractId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Get all milestones for a project
   */
  async getMilestonesByProject(projectId: string): Promise<any[]> {
    return this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Get a single milestone
   */
  async getMilestone(milestoneId: string): Promise<any> {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
          },
        },
        contract: {
          select: {
            id: true,
            freelancerId: true,
            clientId: true,
          },
        },
      },
    });

    if (!milestone) {
      throw new NotFoundException(
        `Milestone with ID "${milestoneId}" not found`,
      );
    }

    return milestone;
  }

  /**
   * Freelancer submits a milestone for review
   */
  async submitMilestone(
    milestoneId: string,
    freelancerId: string,
  ): Promise<any> {
    const milestone = await this.getMilestone(milestoneId);

    // Verify freelancer owns this contract
    if (milestone.contract?.freelancerId !== freelancerId) {
      throw new ForbiddenException(
        'Only the assigned freelancer can submit this milestone',
      );
    }

    // Can only submit PENDING or IN_PROGRESS milestones
    if (
      milestone.status !== MilestoneStatus.PENDING &&
      milestone.status !== MilestoneStatus.IN_PROGRESS
    ) {
      throw new ConflictException(
        `Cannot submit milestone with status ${milestone.status}`,
      );
    }

    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    this.logger.log(
      `Milestone ${milestoneId} submitted by freelancer ${freelancerId}`,
    );

    return updated;
  }

  /**
   * Client approves a milestone
   */
  async approveMilestone(
    milestoneId: string,
    clientId: string,
  ): Promise<any> {
    const milestone = await this.getMilestone(milestoneId);

    // Verify client owns this contract
    if (milestone.contract?.clientId !== clientId) {
      throw new ForbiddenException(
        'Only the client can approve this milestone',
      );
    }

    // Can only approve SUBMITTED milestones
    if (milestone.status !== MilestoneStatus.SUBMITTED) {
      throw new ConflictException(
        `Can only approve SUBMITTED milestones. Current status: ${milestone.status}`,
      );
    }

    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    this.logger.log(
      `Milestone ${milestoneId} approved by client ${clientId}`,
    );

    // TODO: Trigger payment release via Payment Service
    // await this.paymentService.releaseMilestonePayment(milestoneId);

    return updated;
  }

  /**
   * Client rejects a milestone
   */
  async rejectMilestone(
    milestoneId: string,
    clientId: string,
    reason?: string,
  ): Promise<any> {
    const milestone = await this.getMilestone(milestoneId);

    // Verify client owns this contract
    if (milestone.contract?.clientId !== clientId) {
      throw new ForbiddenException(
        'Only the client can reject this milestone',
      );
    }

    // Can only reject SUBMITTED milestones
    if (milestone.status !== MilestoneStatus.SUBMITTED) {
      throw new ConflictException(
        `Can only reject SUBMITTED milestones. Current status: ${milestone.status}`,
      );
    }

    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.IN_PROGRESS,
        // Store rejection reason in metadata if needed
      },
    });

    this.logger.log(
      `Milestone ${milestoneId} rejected by client ${clientId}. Reason: ${reason}`,
    );

    return updated;
  }

  /**
   * Start working on a milestone
   */
  async startMilestone(
    milestoneId: string,
    freelancerId: string,
  ): Promise<any> {
    const milestone = await this.getMilestone(milestoneId);

    // Verify freelancer owns this contract
    if (milestone.contract?.freelancerId !== freelancerId) {
      throw new ForbiddenException(
        'Only the assigned freelancer can start this milestone',
      );
    }

    // Can only start PENDING milestones
    if (milestone.status !== MilestoneStatus.PENDING) {
      throw new ConflictException(
        `Can only start PENDING milestones. Current status: ${milestone.status}`,
      );
    }

    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.IN_PROGRESS,
      },
    });

    this.logger.log(
      `Milestone ${milestoneId} started by freelancer ${freelancerId}`,
    );

    return updated;
  }

  /**
   * Get milestone statistics for a contract
   */
  async getMilestoneStats(contractId: string): Promise<any> {
    const milestones = await this.getMilestonesByContract(contractId);

    const stats = {
      total: milestones.length,
      pending: 0,
      inProgress: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      totalAmount: 0,
      approvedAmount: 0,
      completionPercentage: 0,
    };

    milestones.forEach((milestone) => {
      stats.totalAmount += parseFloat(milestone.amount.toString());

      switch (milestone.status) {
        case MilestoneStatus.PENDING:
          stats.pending++;
          break;
        case MilestoneStatus.IN_PROGRESS:
          stats.inProgress++;
          break;
        case MilestoneStatus.SUBMITTED:
          stats.submitted++;
          break;
        case MilestoneStatus.APPROVED:
          stats.approved++;
          stats.approvedAmount += parseFloat(milestone.amount.toString());
          break;
        case MilestoneStatus.REJECTED:
          stats.rejected++;
          break;
      }
    });

    if (stats.total > 0) {
      stats.completionPercentage = Math.round(
        (stats.approved / stats.total) * 100,
      );
    }

    return stats;
  }
}
