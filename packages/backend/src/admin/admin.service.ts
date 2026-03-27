import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReviewService } from '../review/review.service';
import { DisputeService } from '../dispute/dispute.service';
import { ResolveDisputeDto } from '../dispute/dto/create-dispute.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewService: ReviewService,
    private readonly disputeService: DisputeService,
  ) {}

  async getStats() {
    const [
      totalUsers,
      activeProjects,
      openDisputes,
      activeBids,
      payments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.project.count({ where: { status: 'OPEN' } }),
      this.prisma.dispute.count({ where: { status: 'OPEN' } }),
      this.prisma.bid.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    const gmv = payments._sum.amount || 0;
    const platformRevenue = Number(gmv) * 0.1; // 10% platform fee

    return {
      totalUsers,
      activeProjects,
      openDisputes,
      activeBids,
      gmv,
      platformRevenue,
    };
  }

  async getUsers(filters?: { search?: string; filter?: string }) {
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.filter && filters.filter !== 'all') {
      switch (filters.filter) {
        case 'verified':
          where.isKycVerified = true;
          break;
        case 'unverified':
          where.isKycVerified = false;
          break;
        case 'banned':
          where.isBanned = true;
          break;
        case 'freelancer':
          where.role = 'FREELANCER';
          break;
        case 'client':
          where.role = 'CLIENT';
          break;
      }
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isKycVerified: true,
        isActive: true,
        isBanned: true,
        createdAt: true,
        avatar: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isKycVerified: true },
    });
  }

  async banUser(userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        banReason: reason,
        bannedAt: new Date(),
      },
    });
  }

  async warnUser(userId: string, message: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create a notification/warning record
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'WARNING',
        title: 'Warning from Admin',
        message,
      },
    });

    return { success: true, message: 'Warning sent' };
  }

  async getDisputes() {
    return this.disputeService.getDisputes({ status: 'OPEN' });
  }

  async resolveDispute(disputeId: string, adminId: string, dto: ResolveDisputeDto) {
    return this.disputeService.resolveDispute(disputeId, adminId, dto);
  }

  async getPendingReviews(page = 1, limit = 20) {
    return this.reviewService.getPendingReviews(page, limit);
  }

  async moderateReview(reviewId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    return this.reviewService.moderateReview(reviewId, status, reason);
  }

  async getAnalytics() {
    // Revenue trend (last 6 months)
    const revenueTrend = await this.getRevenueTrend();

    // User growth (last 6 months)
    const userGrowth = await this.getUserGrowth();

    // Project distribution by type
    const projectDistribution = await this.prisma.project.groupBy({
      by: ['type'],
      _count: true,
    });

    // Platform metrics
    const [avgProjectValue, completionRate, avgRating, disputeRate] = await Promise.all([
      this.getAverageProjectValue(),
      this.getCompletionRate(),
      this.getAverageRating(),
      this.getDisputeRate(),
    ]);

    return {
      revenueTrend,
      userGrowth,
      projectDistribution: projectDistribution.map((p) => ({
        name: p.type,
        value: p._count,
      })),
      avgProjectValue,
      completionRate,
      avgRating,
      disputeRate,
      churnRate: 2.5, // Placeholder
    };
  }

  private async getRevenueTrend() {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const result = await this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: 'RELEASED',
        },
      });

      months.push({
        month: date.toLocaleString('default', { month: 'short' }),
        revenue: (Number(result._sum.amount) || 0) * 0.1, // 10% platform fee
      });
    }
    return months;
  }

  private async getUserGrowth() {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const count = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      months.push({
        month: date.toLocaleString('default', { month: 'short' }),
        users: count,
      });
    }
    return months;
  }

  private async getAverageProjectValue() {
    const result = await this.prisma.project.aggregate({
      _avg: { budgetMin: true },
    });
    return Math.round(Number(result._avg.budgetMin) || 0);
  }

  private async getCompletionRate() {
    const [total, completed] = await Promise.all([
      this.prisma.contract.count(),
      this.prisma.contract.count({ where: { status: 'COMPLETED' } }),
    ]);
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  private async getAverageRating() {
    const result = await this.prisma.review.aggregate({
      _avg: { rating: true },
      where: { status: 'APPROVED' },
    });
    return Math.round((Number(result._avg.rating) || 0) * 10) / 10;
  }

  private async getDisputeRate() {
    const [total, disputes] = await Promise.all([
      this.prisma.contract.count(),
      this.prisma.dispute.count(),
    ]);
    return total > 0 ? Math.round((disputes / total) * 100) : 0;
  }

  async getFeatureFlags() {
    return (this.prisma as any).featureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFeatureFlag(data: { name: string; description: string; enabled: boolean }) {
    return (this.prisma as any).featureFlag.create({
      data,
    });
  }

  async updateFeatureFlag(featureId: string, enabled: boolean) {
    return (this.prisma as any).featureFlag.update({
      where: { id: featureId },
      data: { enabled, updatedAt: new Date() },
    });
  }
}
