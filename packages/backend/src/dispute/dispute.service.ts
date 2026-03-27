import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateDisputeDto, ResolveDisputeDto } from './dto/create-dispute.dto';

@Injectable()
export class DisputeService {
  constructor(private readonly prisma: PrismaService) {}

  async createDispute(userId: string, dto: CreateDisputeDto) {
    // Verify contract exists
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      include: {
        client: true,
        freelancer: true,
        payment: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Verify user is part of the contract
    const isClient = contract.clientId === userId;
    const isFreelancer = contract.freelancerId === userId;

    if (!isClient && !isFreelancer) {
      throw new ForbiddenException('You are not authorized to dispute this contract');
    }

    // Check if dispute already exists
    const existingDispute = await this.prisma.dispute.findFirst({
      where: {
        contractId: dto.contractId,
        status: 'OPEN',
      },
    });

    if (existingDispute) {
      throw new ConflictException('An open dispute already exists for this contract');
    }

    // Create dispute
    const dispute = await this.prisma.dispute.create({
      data: {
        contractId: dto.contractId,
        initiatorId: userId,
        respondentId: isClient ? contract.freelancerId : contract.clientId,
        reason: dto.reason,
        description: dto.description,
        evidence: dto.evidence || [],
        status: 'OPEN',
      },
      include: {
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        contract: {
          include: {
            project: {
              select: {
                id: true,
                title: true,
                clientId: true,
                freelancerId: true,
              },
            },
          },
        },
      },
    });

    // Hold escrow if payment exists
    if ((contract as any).payment) {
      await (this.prisma as any).payment.update({
        where: { id: (contract as any).payment.id },
        data: { status: 'HELD' },
      });
    }

    // Update contract status
    await this.prisma.contract.update({
      where: { id: dto.contractId },
      data: { status: 'DISPUTED' },
    });

    return dispute;
  }

  async getDisputes(filters?: {
    status?: string;
    contractId?: string;
    userId?: string;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.contractId) {
      where.contractId = filters.contractId;
    }

    if (filters?.userId) {
      where.OR = [
        { initiatorId: filters.userId },
        { respondentId: filters.userId },
      ];
    }

    return this.prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        contract: {
          include: {
            project: {
              select: {
                id: true,
                title: true,
                client: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                freelancer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            payment: true,
          },
        },
      },
    });
  }

  async getDisputeById(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        contract: {
          include: {
            project: {
              include: {
                client: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
                freelancer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            payment: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    return dispute;
  }

  async resolveDispute(disputeId: string, adminId: string, dto: ResolveDisputeDto) {
    const dispute = await this.getDisputeById(disputeId);

    if (dispute.status !== 'OPEN') {
      throw new BadRequestException('Dispute is not open');
    }

    const contract = (dispute as any).contract;
    const payment = contract?.payment;

    // Handle resolution based on type
    switch (dto.resolution) {
      case 'REFUND_CLIENT':
        if (payment) {
          await (this.prisma as any).payment.update({
            where: { id: payment.id },
            data: {
              status: 'REFUNDED',
              refundAmount: dto.refundAmount || payment.amount,
            },
          });
        }
        break;

      case 'RELEASE_TO_FREELANCER':
        if (payment) {
          await (this.prisma as any).payment.update({
            where: { id: payment.id },
            data: { status: 'RELEASED' },
          });
        }
        break;

      case 'PARTIAL_REFUND':
        if (payment && dto.refundAmount) {
          await (this.prisma as any).payment.update({
            where: { id: payment.id },
            data: {
              status: 'PARTIALLY_REFUNDED',
              refundAmount: dto.refundAmount,
            },
          });
        }
        break;

      case 'REJECT':
        // No payment action needed
        break;
    }

    // Update dispute
    const resolved = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        // @ts-ignore
        status: (dto.resolution === 'REJECT' ? 'REJECTED' : 'RESOLVED') as any,
        resolution: dto.resolution,
        // @ts-ignore
        adminNote: dto.adminNotes, // Mapping DTO's adminNotes to schema's adminNote
        // @ts-ignore
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
      include: {
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update contract status
    await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: dto.resolution === 'REJECT' ? 'ACTIVE' : 'CANCELLED',
      },
    });

    return resolved;
  }
}
