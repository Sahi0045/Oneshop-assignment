import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

export interface BidCreditConfig {
  freeTierCredits: number;
  creditCostUSD: number;
  creditPackages: {
    credits: number;
    price: number;
    discount: number;
  }[];
}

@Injectable()
export class BidCreditsService {
  private readonly logger = new Logger(BidCreditsService.name);
  private readonly config: BidCreditConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    // Load configuration from environment or use defaults
    this.config = {
      freeTierCredits: this.configService.get<number>(
        'BID_FREE_TIER_CREDITS',
        5,
      ),
      creditCostUSD: this.configService.get<number>('BID_CREDIT_COST_USD', 2),
      creditPackages: [
        { credits: 10, price: 15, discount: 25 }, // $1.50 per credit
        { credits: 25, price: 30, discount: 40 }, // $1.20 per credit
        { credits: 50, price: 50, discount: 50 }, // $1.00 per credit
        { credits: 100, price: 80, discount: 60 }, // $0.80 per credit
      ],
    };
  }

  /**
   * Check if user has enough bid credits
   */
  async hasCredits(userId: string, required: number = 1): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bidCredits: true },
    });

    return user ? user.bidCredits >= required : false;
  }

  /**
   * Get user's current bid credit balance
   */
  async getBalance(userId: string): Promise<{
    credits: number;
    totalBidsPlaced: number;
    freeTierUsed: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        bidCredits: true,
        totalBidsPlaced: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      credits: user.bidCredits,
      totalBidsPlaced: user.totalBidsPlaced,
      freeTierUsed: user.totalBidsPlaced >= this.config.freeTierCredits,
    };
  }

  /**
   * Deduct credits when placing a bid
   */
  async deductCredit(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bidCredits: true, totalBidsPlaced: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.bidCredits <= 0) {
      throw new ConflictException(
        'Insufficient bid credits. Please purchase more credits to continue bidding.',
      );
    }

    // Deduct credit and increment total bids placed
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        bidCredits: { decrement: 1 },
        totalBidsPlaced: { increment: 1 },
      },
      select: { bidCredits: true },
    });

    this.logger.log(
      `Deducted 1 bid credit from user ${userId}. Remaining: ${updated.bidCredits}`,
    );

    return updated.bidCredits;
  }

  /**
   * Refund credit when bid is withdrawn
   */
  async refundCredit(userId: string): Promise<number> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        bidCredits: { increment: 1 },
      },
      select: { bidCredits: true },
    });

    this.logger.log(
      `Refunded 1 bid credit to user ${userId}. New balance: ${updated.bidCredits}`,
    );

    return updated.bidCredits;
  }

  /**
   * Add credits to user account (purchase or admin grant)
   */
  async addCredits(
    userId: string,
    amount: number,
    reason: string = 'purchase',
  ): Promise<number> {
    if (amount <= 0) {
      throw new BadRequestException('Credit amount must be positive');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        bidCredits: { increment: amount },
      },
      select: { bidCredits: true },
    });

    this.logger.log(
      `Added ${amount} bid credits to user ${userId} (${reason}). New balance: ${updated.bidCredits}`,
    );

    return updated.bidCredits;
  }

  /**
   * Get available credit packages for purchase
   */
  getCreditPackages(): BidCreditConfig['creditPackages'] {
    return this.config.creditPackages;
  }

  /**
   * Calculate price for a credit package
   */
  calculatePackagePrice(credits: number): number {
    const pkg = this.config.creditPackages.find((p) => p.credits === credits);

    if (pkg) {
      return pkg.price;
    }

    // Custom amount - use base price with no discount
    return credits * this.config.creditCostUSD;
  }

  /**
   * Process credit purchase (integrates with payment service)
   */
  async purchaseCredits(
    userId: string,
    packageCredits: number,
  ): Promise<{
    credits: number;
    price: number;
    newBalance: number;
  }> {
    const price = this.calculatePackagePrice(packageCredits);

    // TODO: Integrate with payment service to process payment
    // For now, we'll just add the credits (assuming payment succeeded)

    const newBalance = await this.addCredits(
      userId,
      packageCredits,
      'purchase',
    );

    return {
      credits: packageCredits,
      price,
      newBalance,
    };
  }

  /**
   * Get credit usage statistics for a user
   */
  async getCreditStats(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        bidCredits: true,
        totalBidsPlaced: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const activeBids = await this.prisma.bid.count({
      where: {
        freelancerId: userId,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    });

    const withdrawnBids = await this.prisma.bid.count({
      where: {
        freelancerId: userId,
        status: 'WITHDRAWN',
      },
    });

    const acceptedBids = await this.prisma.bid.count({
      where: {
        freelancerId: userId,
        status: 'ACCEPTED',
      },
    });

    const successRate =
      user.totalBidsPlaced > 0
        ? Math.round((acceptedBids / user.totalBidsPlaced) * 100)
        : 0;

    return {
      currentBalance: user.bidCredits,
      totalBidsPlaced: user.totalBidsPlaced,
      activeBids,
      withdrawnBids,
      acceptedBids,
      successRate,
      freeTierRemaining: Math.max(
        0,
        this.config.freeTierCredits - user.totalBidsPlaced,
      ),
      memberSince: user.createdAt,
    };
  }

  /**
   * Admin: Grant free credits to a user
   */
  async grantFreeCredits(
    userId: string,
    amount: number,
    adminId: string,
  ): Promise<number> {
    const newBalance = await this.addCredits(
      userId,
      amount,
      `admin_grant_by_${adminId}`,
    );

    this.logger.log(
      `Admin ${adminId} granted ${amount} free credits to user ${userId}`,
    );

    return newBalance;
  }

  /**
   * Check if user needs to purchase credits (low balance warning)
   */
  async needsCreditWarning(userId: string): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance.credits <= 2; // Warn when 2 or fewer credits remain
  }
}
