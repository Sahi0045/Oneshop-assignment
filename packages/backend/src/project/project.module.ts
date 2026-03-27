import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { BidService } from './bid.service';
import { MilestoneService } from './milestone.service';
import { BidCreditsService } from './bid-credits.service';
import { BidAnalyticsService } from './bid-analytics.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

/**
 * ProjectModule
 *
 * Encapsulates everything related to projects and bids:
 *   - Project CRUD (create, list, get, update, delete)
 *   - Bid lifecycle (place, update, withdraw, award)
 *   - Milestone management (create, submit, approve, reject)
 *   - Bid credits system (freemium model)
 *   - Bid analytics (avg bid, skill match %, distribution)
 *   - View-count tracking via Redis
 *   - Kafka event emission for async downstream consumers
 */
@Module({
  imports: [ConfigModule, PrismaModule, RedisModule],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    BidService,
    MilestoneService,
    BidCreditsService,
    BidAnalyticsService,
  ],
  exports: [
    ProjectService,
    BidService,
    MilestoneService,
    BidCreditsService,
    BidAnalyticsService,
  ],
})
export class ProjectModule {}
