import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ReviewModule } from '../review/review.module';
import { DisputeModule } from '../dispute/dispute.module';

@Module({
  imports: [PrismaModule, ReviewModule, DisputeModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
