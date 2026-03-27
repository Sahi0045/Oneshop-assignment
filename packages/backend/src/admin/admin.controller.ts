import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResolveDisputeDto } from '../dispute/dto/create-dispute.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private ensureAdmin(user: any) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  @Get('stats')
  async getStats(@Request() req) {
    this.ensureAdmin(req.user);
    return this.adminService.getStats();
  }

  @Get('users')
  async getUsers(
    @Request() req,
    @Query('search') search?: string,
    @Query('filter') filter?: string,
  ) {
    this.ensureAdmin(req.user);
    return this.adminService.getUsers({ search, filter });
  }

  @Post('users/:userId/verify')
  async verifyUser(@Request() req, @Param('userId') userId: string) {
    this.ensureAdmin(req.user);
    return this.adminService.verifyUser(userId);
  }

  @Post('users/:userId/ban')
  async banUser(
    @Request() req,
    @Param('userId') userId: string,
    @Body('reason') reason: string,
  ) {
    this.ensureAdmin(req.user);
    return this.adminService.banUser(userId, reason);
  }

  @Post('users/:userId/warn')
  async warnUser(
    @Request() req,
    @Param('userId') userId: string,
    @Body('message') message: string,
  ) {
    this.ensureAdmin(req.user);
    return this.adminService.warnUser(userId, message);
  }

  @Get('disputes')
  async getDisputes(@Request() req) {
    this.ensureAdmin(req.user);
    return this.adminService.getDisputes();
  }

  @Post('disputes/:disputeId/resolve')
  async resolveDispute(
    @Request() req,
    @Param('disputeId') disputeId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    this.ensureAdmin(req.user);
    return this.adminService.resolveDispute(disputeId, req.user.sub, dto);
  }

  @Get('reviews/pending')
  async getPendingReviews(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureAdmin(req.user);
    return this.adminService.getPendingReviews(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('reviews/:reviewId/moderate')
  async moderateReview(
    @Request() req,
    @Param('reviewId') reviewId: string,
    @Body('status') status: 'APPROVED' | 'REJECTED',
    @Body('reason') reason?: string,
  ) {
    this.ensureAdmin(req.user);
    return this.adminService.moderateReview(reviewId, status, reason);
  }

  @Get('analytics')
  async getAnalytics(@Request() req) {
    this.ensureAdmin(req.user);
    return this.adminService.getAnalytics();
  }

  @Get('features')
  async getFeatureFlags(@Request() req) {
    this.ensureAdmin(req.user);
    return this.adminService.getFeatureFlags();
  }

  @Post('features')
  async createFeatureFlag(
    @Request() req,
    @Body() data: { name: string; description: string; enabled: boolean },
  ) {
    this.ensureAdmin(req.user);
    return this.adminService.createFeatureFlag(data);
  }

  @Patch('features/:featureId')
  async updateFeatureFlag(
    @Request() req,
    @Param('featureId') featureId: string,
    @Body('enabled') enabled: boolean,
  ) {
    this.ensureAdmin(req.user);
    return this.adminService.updateFeatureFlag(featureId, enabled);
  }
}
