import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

export interface BidAnalytics {
  totalBids: number;
  averageBid: number;
  medianBid: number;
  lowestBid: number;
  highestBid: number;
  averageDeliveryDays: number;
  bidDistribution: {
    range: string;
    count: number;
  }[];
  topFreelancers: {
    id: string;
    name: string;
    avatar: string | null;
    rating: number;
    bidAmount: number;
    skillMatchScore: number;
  }[];
}

@Injectable()
export class BidAnalyticsService {
  private readonly logger = new Logger(BidAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Calculate comprehensive bid analytics for a project
   */
  async calculateBidAnalytics(projectId: string): Promise<BidAnalytics> {
    // Check cache first
    const cacheKey = `bid_analytics:${projectId}`;
    const cached = await this.redisService.get(cacheKey).catch(() => null);

    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch all non-withdrawn bids
    const bids = await this.prisma.bid.findMany({
      where: {
        projectId,
        status: { not: 'WITHDRAWN' },
      },
      include: {
        freelancer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            rating: true,
          },
        },
      },
      orderBy: { amount: 'asc' },
    });

    if (bids.length === 0) {
      return this.getEmptyAnalytics();
    }

    const amounts = bids.map((b) => parseFloat(b.amount.toString()));
    const deliveryDays = bids.map((b) => b.deliveryDays);

    // Calculate statistics
    const totalBids = bids.length;
    const averageBid = amounts.reduce((a, b) => a + b, 0) / totalBids;
    const medianBid = this.calculateMedian(amounts);
    const lowestBid = Math.min(...amounts);
    const highestBid = Math.max(...amounts);
    const averageDeliveryDays =
      deliveryDays.reduce((a, b) => a + b, 0) / totalBids;

    // Bid distribution (group by ranges)
    const bidDistribution = this.calculateBidDistribution(amounts);

    // Top freelancers (sorted by skill match score, then rating)
    const topFreelancers = bids
      .map((bid) => ({
        id: bid.freelancer.id,
        name: `${bid.freelancer.firstName} ${bid.freelancer.lastName}`,
        avatar: bid.freelancer.avatar,
        rating: parseFloat(bid.freelancer.rating.toString()),
        bidAmount: parseFloat(bid.amount.toString()),
        skillMatchScore: bid.skillMatchScore
          ? parseFloat(bid.skillMatchScore.toString())
          : 0,
      }))
      .sort((a, b) => {
        // Sort by skill match first, then rating
        if (b.skillMatchScore !== a.skillMatchScore) {
          return b.skillMatchScore - a.skillMatchScore;
        }
        return b.rating - a.rating;
      })
      .slice(0, 5); // Top 5

    const analytics: BidAnalytics = {
      totalBids,
      averageBid: Math.round(averageBid * 100) / 100,
      medianBid: Math.round(medianBid * 100) / 100,
      lowestBid: Math.round(lowestBid * 100) / 100,
      highestBid: Math.round(highestBid * 100) / 100,
      averageDeliveryDays: Math.round(averageDeliveryDays),
      bidDistribution,
      topFreelancers,
    };

    // Cache for 5 minutes
    await this.redisService
      .setex(cacheKey, 300, JSON.stringify(analytics))
      .catch(() => null);

    return analytics;
  }

  /**
   * Calculate skill match percentage between freelancer and project
   */
  async calculateSkillMatch(
    freelancerId: string,
    projectId: string,
  ): Promise<number> {
    // Get project required skills
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        skills: {
          select: { id: true, name: true },
        },
      },
    });

    if (!project || project.skills.length === 0) {
      return 0;
    }

    // Get freelancer skills
    const freelancer = await this.prisma.user.findUnique({
      where: { id: freelancerId },
      include: {
        skills: {
          include: {
            skill: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!freelancer || freelancer.skills.length === 0) {
      return 0;
    }

    const projectSkillIds = new Set(project.skills.map((s) => s.id));
    const freelancerSkillIds = new Set(
      freelancer.skills.map((us) => us.skill.id),
    );

    // Calculate intersection
    const matchingSkills = [...projectSkillIds].filter((id) =>
      freelancerSkillIds.has(id),
    );

    const matchPercentage =
      (matchingSkills.length / projectSkillIds.size) * 100;

    return Math.round(matchPercentage * 100) / 100;
  }

  /**
   * Update skill match score for a bid
   */
  async updateBidSkillMatch(bidId: string): Promise<number> {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      select: { freelancerId: true, projectId: true },
    });

    if (!bid) {
      return 0;
    }

    const skillMatchScore = await this.calculateSkillMatch(
      bid.freelancerId,
      bid.projectId,
    );

    await this.prisma.bid.update({
      where: { id: bidId },
      data: { skillMatchScore },
    });

    return skillMatchScore;
  }

  /**
   * Get bid insights for a freelancer
   */
  async getFreelancerBidInsights(
    freelancerId: string,
    projectId: string,
  ): Promise<any> {
    const [skillMatch, analytics, freelancerBid] = await Promise.all([
      this.calculateSkillMatch(freelancerId, projectId),
      this.calculateBidAnalytics(projectId),
      this.prisma.bid.findFirst({
        where: { freelancerId, projectId, status: { not: 'WITHDRAWN' } },
      }),
    ]);

    if (!freelancerBid) {
      return {
        skillMatchScore: skillMatch,
        analytics,
        bidPosition: null,
        competitiveness: null,
      };
    }

    const bidAmount = parseFloat(freelancerBid.amount.toString());

    // Calculate bid position (percentile)
    const lowerBids = await this.prisma.bid.count({
      where: {
        projectId,
        status: { not: 'WITHDRAWN' },
        amount: { lt: freelancerBid.amount },
      },
    });

    const bidPosition =
      analytics.totalBids > 0
        ? Math.round((lowerBids / analytics.totalBids) * 100)
        : 0;

    // Determine competitiveness
    let competitiveness = 'average';
    if (bidAmount <= analytics.lowestBid * 1.1) {
      competitiveness = 'very_competitive';
    } else if (bidAmount <= analytics.averageBid) {
      competitiveness = 'competitive';
    } else if (bidAmount >= analytics.highestBid * 0.9) {
      competitiveness = 'high';
    }

    return {
      skillMatchScore: skillMatch,
      analytics,
      yourBid: {
        amount: bidAmount,
        deliveryDays: freelancerBid.deliveryDays,
      },
      bidPosition, // Percentile (0-100)
      competitiveness,
      insights: {
        belowAverage: bidAmount < analytics.averageBid,
        differenceFromAverage: Math.round(
          ((bidAmount - analytics.averageBid) / analytics.averageBid) * 100,
        ),
        differenceFromMedian: Math.round(
          ((bidAmount - analytics.medianBid) / analytics.medianBid) * 100,
        ),
      },
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  private calculateBidDistribution(
    amounts: number[],
  ): { range: string; count: number }[] {
    if (amounts.length === 0) return [];

    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const range = max - min;

    // Create 5 buckets
    const bucketSize = range / 5;
    const buckets: { range: string; count: number }[] = [];

    for (let i = 0; i < 5; i++) {
      const start = min + i * bucketSize;
      const end = i === 4 ? max : start + bucketSize;

      const count = amounts.filter((a) => a >= start && a <= end).length;

      buckets.push({
        range: `$${Math.round(start)}-$${Math.round(end)}`,
        count,
      });
    }

    return buckets;
  }

  private getEmptyAnalytics(): BidAnalytics {
    return {
      totalBids: 0,
      averageBid: 0,
      medianBid: 0,
      lowestBid: 0,
      highestBid: 0,
      averageDeliveryDays: 0,
      bidDistribution: [],
      topFreelancers: [],
    };
  }
}
