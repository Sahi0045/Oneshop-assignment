import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    // Verify contract exists and is completed
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      include: {
        client: true,
        freelancer: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'COMPLETED') {
      throw new BadRequestException('Can only review completed contracts');
    }

    // Verify user is part of the contract
    const isClient = contract.clientId === userId;
    const isFreelancer = contract.freelancerId === userId;

    if (!isClient && !isFreelancer) {
      throw new ForbiddenException('You are not authorized to review this contract');
    }

    // Verify reviewee is the other party
    const expectedRevieweeId = isClient
      ? contract.freelancerId
      : contract.clientId;

    if (dto.revieweeId !== expectedRevieweeId) {
      throw new BadRequestException('Invalid reviewee');
    }

    // Check if review already exists
    const existingReview = await this.prisma.review.findFirst({
      where: {
        contractId: dto.contractId,
        reviewerId: userId,
        revieweeId: dto.revieweeId,
      },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this contract');
    }

    // Calculate overall rating
    const overallRating =
      dto.communicationRating && dto.qualityRating && dto.timelinessRating
        ? (dto.communicationRating + dto.qualityRating + dto.timelinessRating) / 3
        : dto.rating;

    // Create review
    const review = await this.prisma.review.create({
      data: {
        contractId: dto.contractId,
        reviewerId: userId,
        revieweeId: dto.revieweeId,
        rating: overallRating,
        comment: dto.comment,
        communicationRating: dto.communicationRating,
        qualityRating: dto.qualityRating,
        timelinessRating: dto.timelinessRating,
        status: 'PENDING',
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Update user's average rating
    await this.updateUserRating(dto.revieweeId);

    // Invalidate cache
    await this.redis.del(`user:${dto.revieweeId}:reviews`);
    await this.redis.del(`user:${dto.revieweeId}:rating`);

    return review;
  }

  async getReviewsByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          revieweeId: userId,
          status: 'APPROVED',
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          contract: {
            include: {
              project: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.review.count({
        where: {
          revieweeId: userId,
          status: 'APPROVED',
        },
      }),
    ]);

    return {
      reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserRating(userId: string) {
    // Try cache first
    const cached = await this.redis.get(`user:${userId}:rating`);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.prisma.review.aggregate({
      where: {
        revieweeId: userId,
        status: 'APPROVED',
      },
      _avg: {
        rating: true,
        communicationRating: true,
        qualityRating: true,
        timelinessRating: true,
      },
      _count: true,
    });

    const rating = {
      averageRating: result._avg.rating || 0,
      totalReviews: result._count,
      communicationRating: result._avg.communicationRating || 0,
      qualityRating: result._avg.qualityRating || 0,
      timelinessRating: result._avg.timelinessRating || 0,
    };

    // Cache for 1 hour
    await this.redis.setex(`user:${userId}:rating`, 3600, JSON.stringify(rating));

    return rating;
  }

  async updateUserRating(userId: string) {
    const rating = await this.getUserRating(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        rating: rating.averageRating,
        totalReviews: rating.totalReviews,
      },
    });

    // Award badges based on rating
    if (rating.averageRating >= 4.8 && rating.totalReviews >= 10) {
      await this.awardBadge(userId, 'TOP_RATED');
    } else if (rating.averageRating >= 4.5 && rating.totalReviews >= 5) {
      await this.awardBadge(userId, 'RISING_TALENT');
    }
  }

  async awardBadge(userId: string, badgeType: string) {
    const existingBadge = await this.prisma.badge.findFirst({
      where: { userId, type: badgeType },
    });

    if (!existingBadge) {
      await this.prisma.badge.create({
        data: {
          userId,
          type: badgeType,
          name: badgeType.replace('_', ' '),
          description: `Awarded for ${badgeType.toLowerCase()}`,
        },
      });
    }
  }

  async moderateReview(reviewId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        status,
        moderationReason: reason,
        moderatedAt: new Date(),
      },
    });

    // Update user rating if approved
    if (status === 'APPROVED') {
      await this.updateUserRating(review.revieweeId);
    }

    // Invalidate cache
    await this.redis.del(`user:${review.revieweeId}:reviews`);
    await this.redis.del(`user:${review.revieweeId}:rating`);

    return updated;
  }

  async getPendingReviews(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { status: 'PENDING' },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          reviewee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          contract: {
            include: {
              project: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.review.count({
        where: { status: 'PENDING' },
      }),
    ]);

    return {
      reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
