import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { ProjectService, PaginatedResult } from './project.service';
import { BidService } from './bid.service';
import { MilestoneService } from './milestone.service';
import { BidCreditsService } from './bid-credits.service';
import { BidAnalyticsService } from './bid-analytics.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { FilterProjectDto } from './dto/filter-project.dto';
import { CreateBidDto } from './dto/create-bid.dto';
import { UpdateBidDto } from './dto/update-bid.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

enum UserRole {
  CLIENT = 'CLIENT',
  FREELANCER = 'FREELANCER',
  ADMIN = 'ADMIN',
}

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectController {
  private readonly logger = new Logger(ProjectController.name);

  constructor(
    private readonly projectService: ProjectService,
    private readonly bidService: BidService,
    private readonly milestoneService: MilestoneService,
    private readonly bidCreditsService: BidCreditsService,
    private readonly bidAnalyticsService: BidAnalyticsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Projects — CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /projects
   * Public-ish: auth is required for personalization but the data itself is
   * visible to any authenticated user.
   */
  @Get()
  @ApiOperation({
    summary: 'List projects',
    description:
      'Returns a paginated list of projects. Supports full-text search and ' +
      'filtering by type, status, budget range, required skills, and category.',
  })
  @ApiQuery({ name: 'search',    required: false, type: String,  description: 'Full-text search across title and description.' })
  @ApiQuery({ name: 'type',      required: false, type: String,  description: 'Project type: FIXED_PRICE | HOURLY.' })
  @ApiQuery({ name: 'status',    required: false, type: String,  description: 'Project status: OPEN | IN_PROGRESS | COMPLETED | CANCELLED.' })
  @ApiQuery({ name: 'minBudget', required: false, type: Number,  description: 'Minimum budget (USD).' })
  @ApiQuery({ name: 'maxBudget', required: false, type: Number,  description: 'Maximum budget (USD).' })
  @ApiQuery({ name: 'skills',    required: false, type: [String],description: 'Filter by required skill names (comma-separated).' })
  @ApiQuery({ name: 'categoryId',required: false, type: String,  description: 'Filter by category UUID.' })
  @ApiQuery({ name: 'page',      required: false, type: Number,  description: 'Page number (1-based, default: 1).' })
  @ApiQuery({ name: 'limit',     required: false, type: Number,  description: 'Items per page (default: 20, max: 100).' })
  @ApiQuery({ name: 'sortBy',    required: false, type: String,  description: 'Sort field: createdAt | budget | bidCount (default: createdAt).' })
  @ApiQuery({ name: 'sortOrder', required: false, type: String,  description: 'Sort direction: asc | desc (default: desc).' })
  @ApiResponse({
    status: 200,
    description: 'Paginated project list returned successfully.',
    schema: {
      example: {
        success: true,
        data: {
          items: [
            {
              id: 'clxyz...',
              title: 'Build a SaaS Dashboard',
              description: 'Need a React dashboard with real-time charts.',
              type: 'FIXED_PRICE',
              status: 'OPEN',
              budgetMin: 1000,
              budgetMax: 3000,
              deadline: '2025-03-01T00:00:00.000Z',
              bidCount: 5,
              viewCount: 120,
              client: { id: 'cl...', firstName: 'Jane', lastName: 'Smith', avatar: null },
              skills: [{ name: 'React' }, { name: 'TypeScript' }],
              createdAt: '2024-12-01T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  })
  async findAll(
    @Query() filterDto: FilterProjectDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectService.findAll(filterDto, userId);
  }

  /**
   * POST /projects
   * Only CLIENTs can post projects.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a project',
    description:
      'Creates a new project posting. Restricted to users with the CLIENT role. ' +
      'Emits a PROJECT_CREATED Kafka event for downstream consumers.',
  })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'clxyz...',
          title: 'Build a SaaS Dashboard',
          status: 'OPEN',
          createdAt: '2024-12-01T00:00:00.000Z',
        },
        message: 'Project created successfully.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Only clients can post projects.' })
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser('id') clientId: string,
  ) {
    const project = await this.projectService.create(clientId, createProjectDto);
    return { data: project, message: 'Project created successfully.' };
  }

  /**
   * GET /projects/:id
   * Returns full project detail including bids and client info.
   * Also increments the view counter.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get project details',
    description:
      'Returns full project detail including the client profile, all active bids ' +
      '(with freelancer summaries), and required skills. Increments the view count.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Project UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Project detail returned successfully.',
  })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    // Non-blocking view count increment
    this.projectService.incrementViewCount(id).catch((err) =>
      this.logger.warn(`Failed to increment view count for project ${id}: ${err.message}`),
    );
    return this.projectService.findOne(id);
  }

  /**
   * PATCH /projects/:id
   * Only the project owner (client) can update their project.
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a project',
    description:
      'Updates project details. Only the project owner or an ADMIN can update. ' +
      'Cannot update a project that is IN_PROGRESS or COMPLETED.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Project UUID.' })
  @ApiResponse({ status: 200, description: 'Project updated.' })
  @ApiResponse({ status: 403, description: 'Not the project owner.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 409, description: 'Cannot edit an in-progress or completed project.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const project = await this.projectService.update(id, userId, updateProjectDto, userRole);
    return { data: project, message: 'Project updated successfully.' };
  }

  /**
   * DELETE /projects/:id
   * Owner or ADMIN can delete; only if project is still OPEN.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a project',
    description:
      'Soft-deletes a project. Only allowed when the project status is OPEN. ' +
      'The project owner or an ADMIN can perform this action.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Project UUID.' })
  @ApiResponse({ status: 200, description: 'Project deleted.' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete this project.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 409, description: 'Cannot delete a project that is in progress or completed.' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    await this.projectService.delete(id, userId, userRole);
    return { message: 'Project deleted successfully.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Bids
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /projects/:id/bids
   * Only the project owner (CLIENT) can see all bids.
   */
  @Get(':id/bids')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List bids for a project',
    description:
      'Returns all bids placed on the specified project. ' +
      'Restricted to the project owner and admins. ' +
      'Includes full freelancer profile for each bid.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Project UUID.' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter bids by status: PENDING | ACCEPTED | REJECTED | WITHDRAWN.' })
  @ApiResponse({
    status: 200,
    description: 'Bid list returned successfully.',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'bid-uuid',
            amount: 2500,
            deliveryDays: 14,
            coverLetter: 'I am an expert in React and TypeScript…',
            status: 'PENDING',
            freelancer: {
              id: 'user-uuid',
              firstName: 'Alice',
              lastName: 'Smith',
              avatar: 'https://...',
              hourlyRate: 80,
              rating: 4.9,
              skills: [{ name: 'React' }],
            },
            createdAt: '2024-12-01T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Only the project owner can view bids.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  async getBidsForProject(
    @Param('id', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') clientId: string,
    @Query('status') status?: string,
  ) {
    return this.bidService.getBidsForProject(projectId, clientId, status);
  }

  /**
   * POST /projects/:id/bids
   * Only FREELANCERs can place bids.
   */
  @Post(':id/bids')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Place a bid on a project',
    description:
      'Submits a new bid for an OPEN project. A freelancer can only have one ' +
      'active (PENDING) bid per project. Emits a BID_RECEIVED Kafka event.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Project UUID.' })
  @ApiResponse({
    status: 201,
    description: 'Bid placed successfully.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'bid-uuid',
          amount: 2500,
          deliveryDays: 14,
          status: 'PENDING',
          createdAt: '2024-12-01T00:00:00.000Z',
        },
        message: 'Bid placed successfully.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate bid.' })
  @ApiResponse({ status: 403, description: 'Only freelancers can place bids.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 409, description: 'You already have an active bid on this project.' })
  async createBid(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() createBidDto: CreateBidDto,
    @CurrentUser('id') freelancerId: string,
  ) {
    const bid = await this.bidService.createBid(freelancerId, projectId, createBidDto);
    return { data: bid, message: 'Bid placed successfully.' };
  }

  /**
   * PATCH /projects/:id/bids/:bidId
   *
   * Three distinct actions depending on the caller's role:
   *   CLIENT  → award the bid (sets bid ACCEPTED, others REJECTED, creates Contract)
   *   FREELANCER → update or withdraw their own bid
   *
   * The action is disambiguated via the `action` body field.
   */
  @Patch(':id/bids/:bidId')
  @ApiOperation({
    summary: 'Update or award a bid',
    description:
      'Multi-purpose bid update endpoint.\n\n' +
      '**CLIENT**: Pass `action: "award"` to accept a bid — this creates a Contract, ' +
      'moves the project to IN_PROGRESS, and rejects all other bids.\n\n' +
      '**FREELANCER**: Pass `action: "update"` to edit amount/cover letter (only while PENDING), ' +
      'or `action: "withdraw"` to withdraw the bid.',
  })
  @ApiParam({ name: 'id',    type: String, description: 'Project UUID.' })
  @ApiParam({ name: 'bidId', type: String, description: 'Bid UUID.' })
  @ApiResponse({ status: 200, description: 'Bid updated/awarded/withdrawn successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid action or bid is not in a mutable state.' })
  @ApiResponse({ status: 403, description: 'Not authorized to perform this action.' })
  @ApiResponse({ status: 404, description: 'Bid or project not found.' })
  async updateBid(
    @Param('id',    ParseUUIDPipe) projectId: string,
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Body() updateBidDto: UpdateBidDto,
    @CurrentUser('id')   userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const { action, ...rest } = updateBidDto as any;

    if (userRole === UserRole.CLIENT && action === 'award') {
      const result = await this.bidService.awardBid(bidId, userId);
      return { data: result, message: 'Bid awarded. Contract created successfully.' };
    }

    if (userRole === UserRole.FREELANCER && action === 'withdraw') {
      const result = await this.bidService.withdrawBid(bidId, userId);
      return { data: result, message: 'Bid withdrawn successfully.' };
    }

    if (userRole === UserRole.FREELANCER && (!action || action === 'update')) {
      const result = await this.bidService.updateBid(bidId, userId, rest);
      return { data: result, message: 'Bid updated successfully.' };
    }

    // Catch-all for unknown combinations
    return {
      message: 'No action taken. Provide a valid action: award | update | withdraw.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Bid Analytics
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id/analytics')
  @ApiOperation({
    summary: 'Get bid analytics for a project',
    description:
      'Returns comprehensive bid analytics including average bid, median, ' +
      'distribution, skill match scores, and top freelancers.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Project UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Bid analytics returned successfully.',
    schema: {
      example: {
        success: true,
        data: {
          totalBids: 12,
          averageBid: 2500,
          medianBid: 2300,
          lowestBid: 1500,
          highestBid: 4000,
          averageDeliveryDays: 14,
          bidDistribution: [
            { range: '$1500-$2000', count: 3 },
            { range: '$2000-$2500', count: 5 },
            { range: '$2500-$3000', count: 2 },
            { range: '$3000-$3500', count: 1 },
            { range: '$3500-$4000', count: 1 },
          ],
          topFreelancers: [
            {
              id: 'uuid',
              name: 'Alice Smith',
              avatar: 'https://...',
              rating: 4.9,
              bidAmount: 2200,
              skillMatchScore: 95,
            },
          ],
        },
      },
    },
  })
  async getBidAnalytics(@Param('id', ParseUUIDPipe) projectId: string) {
    return this.bidAnalyticsService.calculateBidAnalytics(projectId);
  }

  @Get(':id/bids/:bidId/insights')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Get bid insights for a freelancer',
    description:
      'Returns personalized insights for a freelancer including skill match score, ' +
      'bid position, competitiveness analysis, and comparison with other bids.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Project UUID.' })
  @ApiParam({ name: 'bidId', type: String, description: 'Bid UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Bid insights returned successfully.',
  })
  async getFreelancerBidInsights(
    @Param('id', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') freelancerId: string,
  ) {
    return this.bidAnalyticsService.getFreelancerBidInsights(
      freelancerId,
      projectId,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Bid Credits
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('credits/balance')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Get bid credit balance',
    description: 'Returns the current bid credit balance for the freelancer.',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit balance returned successfully.',
    schema: {
      example: {
        success: true,
        data: {
          credits: 8,
          totalBidsPlaced: 15,
          freeTierUsed: true,
        },
      },
    },
  })
  async getCreditBalance(@CurrentUser('id') userId: string) {
    return this.bidCreditsService.getBalance(userId);
  }

  @Get('credits/packages')
  @ApiOperation({
    summary: 'Get available credit packages',
    description: 'Returns available bid credit packages for purchase.',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit packages returned successfully.',
    schema: {
      example: {
        success: true,
        data: [
          { credits: 10, price: 15, discount: 25 },
          { credits: 25, price: 30, discount: 40 },
          { credits: 50, price: 50, discount: 50 },
          { credits: 100, price: 80, discount: 60 },
        ],
      },
    },
  })
  getCreditPackages() {
    return this.bidCreditsService.getCreditPackages();
  }

  @Post('credits/purchase')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Purchase bid credits',
    description:
      'Purchase a bid credit package. Integrates with payment service.',
  })
  @ApiResponse({
    status: 200,
    description: 'Credits purchased successfully.',
  })
  async purchaseCredits(
    @CurrentUser('id') userId: string,
    @Body() body: { credits: number },
  ) {
    const result = await this.bidCreditsService.purchaseCredits(
      userId,
      body.credits,
    );
    return { data: result, message: 'Credits purchased successfully.' };
  }

  @Get('credits/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Get credit usage statistics',
    description:
      'Returns detailed statistics about credit usage and bid success rate.',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit statistics returned successfully.',
  })
  async getCreditStats(@CurrentUser('id') userId: string) {
    return this.bidCreditsService.getCreditStats(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestones
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id/milestones')
  @ApiOperation({
    summary: 'Get project milestones',
    description: 'Returns all milestones for a project.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Project UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Milestones returned successfully.',
  })
  async getProjectMilestones(@Param('id', ParseUUIDPipe) projectId: string) {
    return this.milestoneService.getMilestonesByProject(projectId);
  }

  @Patch('milestones/:milestoneId/submit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Submit milestone for review',
    description: 'Freelancer submits a completed milestone for client review.',
  })
  @ApiParam({ name: 'milestoneId', type: String, description: 'Milestone UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Milestone submitted successfully.',
  })
  async submitMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @CurrentUser('id') freelancerId: string,
  ) {
    const result = await this.milestoneService.submitMilestone(
      milestoneId,
      freelancerId,
    );
    return { data: result, message: 'Milestone submitted for review.' };
  }

  @Patch('milestones/:milestoneId/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Approve milestone',
    description: 'Client approves a submitted milestone and releases payment.',
  })
  @ApiParam({ name: 'milestoneId', type: String, description: 'Milestone UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Milestone approved successfully.',
  })
  async approveMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @CurrentUser('id') clientId: string,
  ) {
    const result = await this.milestoneService.approveMilestone(
      milestoneId,
      clientId,
    );
    return { data: result, message: 'Milestone approved. Payment released.' };
  }

  @Patch('milestones/:milestoneId/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Reject milestone',
    description: 'Client rejects a submitted milestone with feedback.',
  })
  @ApiParam({ name: 'milestoneId', type: String, description: 'Milestone UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Milestone rejected.',
  })
  async rejectMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @CurrentUser('id') clientId: string,
    @Body() body: { reason?: string },
  ) {
    const result = await this.milestoneService.rejectMilestone(
      milestoneId,
      clientId,
      body.reason,
    );
    return { data: result, message: 'Milestone rejected.' };
  }

  @Patch('milestones/:milestoneId/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Start working on milestone',
    description: 'Freelancer marks a milestone as in progress.',
  })
  @ApiParam({ name: 'milestoneId', type: String, description: 'Milestone UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Milestone started.',
  })
  async startMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @CurrentUser('id') freelancerId: string,
  ) {
    const result = await this.milestoneService.startMilestone(
      milestoneId,
      freelancerId,
    );
    return { data: result, message: 'Milestone started.' };
  }
}
