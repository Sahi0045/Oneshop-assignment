import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';

import { PaymentService, PaginationQuery, WithdrawalDto, SubmitMilestoneDto, ApproveMilestoneDto } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

enum UserRole {
  CLIENT     = 'CLIENT',
  FREELANCER = 'FREELANCER',
  ADMIN      = 'ADMIN',
}

// ---------------------------------------------------------------------------
// Inline DTOs for endpoints that don't warrant a separate file
// ---------------------------------------------------------------------------

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsArray,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
  Max,
  IsInt,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

class WithdrawalRequestDto implements WithdrawalDto {
  @ApiProperty({
    description: 'Amount to withdraw in USD.',
    example: 500,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with at most 2 decimal places.' })
  @IsPositive({ message: 'amount must be greater than 0.' })
  amount: number;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code (default: usd).',
    example: 'usd',
    default: 'usd',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  currency?: string = 'usd';

  @ApiPropertyOptional({
    description: 'Optional note or reference for this withdrawal.',
    example: 'Project ABC milestone payout',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'note must not exceed 255 characters.' })
  note?: string;
}

class SubmitMilestoneRequestDto implements SubmitMilestoneDto {
  @ApiPropertyOptional({
    description: 'Primary deliverable URL (S3 / CDN link).',
    example: 'https://s3.amazonaws.com/freelancer-platform-uploads/deliverables/dashboard.zip',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'deliverableUrl must not be an empty string.' })
  deliverableUrl?: string;

  @ApiPropertyOptional({
    description: 'Multiple deliverable URLs (replaces deliverableUrl when provided).',
    type: [String],
    example: [
      'https://s3.amazonaws.com/freelancer-platform-uploads/deliverables/dashboard.zip',
      'https://s3.amazonaws.com/freelancer-platform-uploads/deliverables/README.pdf',
    ],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray({ message: 'deliverableUrls must be an array of strings.' })
  @IsString({ each: true, message: 'Each deliverable URL must be a string.' })
  deliverableUrls?: string[];

  @ApiPropertyOptional({
    description:
      'A note to the client describing what was delivered, how to test it, ' +
      'and any relevant access credentials or instructions.',
    example:
      'The dashboard is live on staging at https://staging.example.com. ' +
      'Login: demo@example.com / Demo1234! ' +
      'All acceptance criteria from the brief have been implemented.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Submission note must not exceed 2 000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;
}

class ApproveMilestoneRequestDto implements ApproveMilestoneDto {
  @ApiPropertyOptional({
    description:
      'Optional rating of the freelancer\'s work on this milestone (1–5 stars).',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'rating must be a whole number.' })
  @Min(1, { message: 'rating must be at least 1.' })
  @Max(5, { message: 'rating must not exceed 5.' })
  rating?: number;

  @ApiPropertyOptional({
    description: 'Optional approval note or feedback for the freelancer.',
    example: 'Great work! The dashboard looks exactly as designed. Thanks for delivering on time.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Approval note must not exceed 1 000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;
}

class RequestRevisionDto {
  @ApiProperty({
    description:
      'Detailed description of the revisions required. ' +
      'Be as specific as possible so the freelancer clearly understands ' +
      'what needs to change.',
    example:
      'The chart colours need to match the brand palette (blue #1D4ED8, not the current purple). ' +
      'Also, the CSV export is missing the "Created At" column — please add it.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Revision note must not be empty.' })
  @MinLength(10, { message: 'Revision note must be at least 10 characters long.' })
  @MaxLength(2000, { message: 'Revision note must not exceed 2 000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note: string;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /payments/intent
  // Creates a Stripe PaymentIntent (escrow deposit) for a contract.
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a Stripe PaymentIntent (escrow deposit)',
    description:
      'Creates a Stripe PaymentIntent representing the escrow deposit a client must ' +
      'fund before work on a contract begins.\n\n' +
      '**Flow:**\n' +
      '1. Call this endpoint to obtain a `clientSecret`.\n' +
      '2. Pass the `clientSecret` to Stripe.js on the frontend to capture the card.\n' +
      '3. Stripe will send a `payment_intent.succeeded` webhook once the payment clears.\n' +
      '4. The platform unlocks milestone submissions once escrow is confirmed.\n\n' +
      '**Idempotency:** calling this endpoint a second time for the same contract ' +
      'returns the existing PaymentIntent rather than creating a duplicate.',
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({
    status: 201,
    description: 'PaymentIntent created successfully.',
    schema: {
      example: {
        success: true,
        data: {
          clientSecret:    'pi_3ABC123_secret_XYZ',
          transactionId:   'clxyz-transaction-uuid',
          paymentIntentId: 'pi_3ABC123',
        },
        message: 'PaymentIntent created. Use the clientSecret on the frontend to confirm.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Only clients can fund escrow.' })
  @ApiResponse({ status: 404, description: 'Contract not found.' })
  @ApiResponse({ status: 409, description: 'Contract is not in a fundable state.' })
  @ApiResponse({ status: 500, description: 'Stripe API error.' })
  async createPaymentIntent(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.paymentService.createPaymentIntent(createPaymentDto, userId);
    return {
      data:    result,
      message: 'PaymentIntent created. Use the clientSecret on the frontend to confirm.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /payments/webhooks
  // Stripe webhook handler — must NOT require JWT auth.
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Stripe webhook endpoint.
   *
   * IMPORTANT: This route must bypass the global JwtAuthGuard (Stripe has no JWT)
   * and must receive the raw request body for signature verification.
   *
   * In main.ts we set `rawBody: true` on NestFactory.create() which makes
   * `req.rawBody` available as a Buffer.
   *
   * The @UseGuards(JwtAuthGuard) is intentionally NOT applied here —
   * the class-level guard is overridden by the fact that this route uses
   * the Stripe signature as its own form of authentication.
   *
   * To make this truly public you would normally add @Public() here, but
   * since the controller already applies JwtAuthGuard at the class level,
   * in a production app you should either:
   *   a) Move this endpoint to a separate controller without JwtAuthGuard, or
   *   b) Apply @SkipAuth() / @Public() decorators from the IS_PUBLIC_KEY pattern.
   *
   * For simplicity in this example the route is kept here but decorated with
   * a note about the architectural decision.
   */
  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  // Intentionally bypass the class-level JwtAuthGuard for this route.
  // Stripe authenticates via HMAC signature — no Bearer token is present.
  @UseGuards() // empty guard array overrides the class-level guard
  @ApiOperation({
    summary: 'Stripe webhook receiver',
    description:
      'Receives and processes Stripe webhook events.\n\n' +
      '**Do not call this endpoint manually** — it is invoked exclusively by Stripe.\n\n' +
      'Supported event types:\n' +
      '- `payment_intent.succeeded` — marks escrow deposit as COMPLETED\n' +
      '- `payment_intent.payment_failed` — marks transaction as FAILED\n' +
      '- `transfer.created` — audit log for milestone payout transfers\n' +
      '- `account.updated` — syncs freelancer Stripe Connect account status\n\n' +
      '**Authentication:** Stripe HMAC-SHA256 signature via `stripe-signature` header ' +
      '(no JWT required).',
  })
  @ApiHeader({
    name:        'stripe-signature',
    description: 'Stripe webhook signature (set automatically by Stripe).',
    required:    true,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook received and processed.',
    schema: {
      example: {
        success: true,
        data: { received: true },
        message: 'Webhook processed.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Stripe signature or malformed payload.',
  })
  async stripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException(
        'Missing stripe-signature header. This endpoint is reserved for Stripe webhooks.',
      );
    }

    // req.rawBody is populated by the `rawBody: true` option in main.ts
    const rawBody = (req as any).rawBody as Buffer;

    if (!rawBody) {
      throw new BadRequestException(
        'Raw request body is unavailable. ' +
          'Ensure rawBody: true is set when creating the NestJS application.',
      );
    }

    const result = await this.paymentService.handleStripeWebhook(rawBody, signature);
    return { data: result, message: 'Webhook processed.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /payments/transactions
  // Paginated transaction history for the authenticated user.
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('transactions')
  @ApiOperation({
    summary: 'Get transaction history',
    description:
      'Returns a paginated ledger of all financial transactions for the authenticated user.\n\n' +
      '**Clients** see: escrow deposits, platform fees, refunds.\n' +
      '**Freelancers** see: milestone releases, withdrawals.\n\n' +
      'Results are ordered by `createdAt` descending (newest first).',
  })
  @ApiQuery({ name: 'page',      required: false, type: Number, description: 'Page number (1-based, default: 1).' })
  @ApiQuery({ name: 'limit',     required: false, type: Number, description: 'Items per page (default: 20, max: 100).' })
  @ApiQuery({ name: 'type',      required: false, type: String, description: 'Filter by type: ESCROW_DEPOSIT | ESCROW_RELEASE | PLATFORM_FEE | REFUND | WITHDRAWAL.' })
  @ApiQuery({ name: 'status',    required: false, type: String, description: 'Filter by status: PENDING | COMPLETED | FAILED | REFUNDED | CANCELLED.' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'ISO 8601 start date filter (inclusive).' })
  @ApiQuery({ name: 'endDate',   required: false, type: String, description: 'ISO 8601 end date filter (inclusive).' })
  @ApiResponse({
    status: 200,
    description: 'Transaction list returned successfully.',
    schema: {
      example: {
        success: true,
        data: {
          items: [
            {
              id:          'tx-uuid',
              type:        'ESCROW_DEPOSIT',
              status:      'COMPLETED',
              amount:      2500,
              currency:    'usd',
              description: 'Escrow deposit for contract contract-uuid',
              stripePaymentIntentId: 'pi_3ABC123',
              createdAt:   '2025-01-15T10:00:00.000Z',
              contract: {
                id:      'contract-uuid',
                project: { id: 'project-uuid', title: 'Build a SaaS Dashboard' },
              },
            },
          ],
          total:      1,
          page:       1,
          limit:      20,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query('page')      page?:      string,
    @Query('limit')     limit?:     string,
    @Query('type')      type?:      string,
    @Query('status')    status?:    string,
    @Query('startDate') startDate?: string,
    @Query('endDate')   endDate?:   string,
  ) {
    const query: PaginationQuery = {
      page:      page      ? parseInt(page, 10)  : 1,
      limit:     limit     ? parseInt(limit, 10) : 20,
      type,
      status,
      startDate,
      endDate,
    };

    return this.paymentService.getTransactions(userId, query);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestones
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /payments/milestones/:milestoneId/submit
   * FREELANCER submits a milestone for client review.
   */
  @Post('milestones/:milestoneId/submit')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Submit a milestone for review (FREELANCER)',
    description:
      'Marks a milestone as SUBMITTED, signalling to the client that the work is ' +
      'ready for review.\n\n' +
      'The milestone must be in **IN_PROGRESS** or **REVISION_REQUESTED** status.\n\n' +
      'Include deliverable URLs (S3 links, staging environment URL, etc.) and a ' +
      'clear submission note describing what was delivered.',
  })
  @ApiParam({ name: 'milestoneId', type: String, description: 'Milestone UUID.' })
  @ApiBody({ type: SubmitMilestoneRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Milestone submitted for review.',
    schema: {
      example: {
        success: true,
        data: {
          id:             'milestone-uuid',
          title:          'Frontend implementation',
          status:         'SUBMITTED',
          submittedAt:    '2025-01-20T14:30:00.000Z',
          submissionNote: 'Dashboard is live on staging. Login: demo@example.com / Demo1234!',
          deliverableUrls: ['https://s3.amazonaws.com/...'],
        },
        message: 'Milestone submitted for review.',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Only the contract freelancer can submit.' })
  @ApiResponse({ status: 404, description: 'Milestone not found.' })
  @ApiResponse({ status: 409, description: 'Milestone is not in a submittable state.' })
  async submitMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: SubmitMilestoneRequestDto,
    @CurrentUser('id') freelancerId: string,
  ) {
    const result = await this.paymentService.submitMilestone(milestoneId, freelancerId, dto);
    return { data: result, message: 'Milestone submitted for review.' };
  }

  /**
   * POST /payments/milestones/:milestoneId/approve
   * CLIENT approves a submitted milestone and triggers payment release.
   */
  @Post('milestones/:milestoneId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Approve a submitted milestone (CLIENT)',
    description:
      'Approves a SUBMITTED milestone. This automatically:\n' +
      '1. Triggers a Stripe Transfer to the freelancer\'s connected account ' +
      '(minus the platform fee).\n' +
      '2. Sets the milestone status to **APPROVED**.\n' +
      '3. Creates an ESCROW_RELEASE transaction record.\n' +
      '4. If all milestones in the contract are now APPROVED, marks the contract as ' +
      '**COMPLETED**.\n\n' +
      'The freelancer must have completed Stripe Connect onboarding for the transfer to succeed.',
  })
  @ApiParam({ name: 'milestoneId', type: String, description: 'Milestone UUID.' })
  @ApiBody({ type: ApproveMilestoneRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Milestone approved and payment released.',
    schema: {
      example: {
        success: true,
        data: {
          milestone: {
            id:      'milestone-uuid',
            title:   'Frontend implementation',
            status:  'APPROVED',
            paidAt:  '2025-01-20T16:00:00.000Z',
          },
          transfer: {
            id:     'tr_3ABC123',
            amount: 180000,
            currency: 'usd',
            destination: 'acct_freelancer123',
          },
          transaction: {
            id:     'tx-uuid',
            type:   'ESCROW_RELEASE',
            status: 'COMPLETED',
            amount: 1800,
          },
        },
        message: 'Milestone approved and payment of $1800.00 released to the freelancer.',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Only the contract client can approve milestones.' })
  @ApiResponse({ status: 404, description: 'Milestone not found.' })
  @ApiResponse({ status: 409, description: 'Milestone is not SUBMITTED or freelancer not onboarded.' })
  @ApiResponse({ status: 500, description: 'Stripe transfer failed.' })
  async approveMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: ApproveMilestoneRequestDto,
    @CurrentUser('id') clientId: string,
  ) {
    const result = await this.paymentService.approveMilestone(milestoneId, clientId, dto);

    const netAmount = result.transaction?.amount ?? 0;
    return {
      data:    result,
      message: `Milestone approved and payment of $${Number(netAmount).toFixed(2)} released to the freelancer.`,
    };
  }

  /**
   * POST /payments/milestones/:milestoneId/release
   * CLIENT manually triggers milestone payment release (alternative to /approve).
   *
   * The /approve endpoint is the preferred flow as it combines approval +
   * payment in one call. This endpoint exists as a standalone "release-only"
   * action for cases where the approval was recorded separately (e.g. via an
   * admin action) and funds just need to be transferred.
   */
  @Post('milestones/:milestoneId/release')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Release milestone payment (CLIENT)',
    description:
      'Releases escrow funds for a SUBMITTED milestone by creating a Stripe Transfer ' +
      'to the freelancer\'s connected account.\n\n' +
      '**Prefer `/approve` over this endpoint** — `/approve` both approves the work ' +
      'and releases the payment in one atomic step.\n\n' +
      'Use `/release` only when you need to release funds independently of the ' +
      'approval workflow (e.g. after an admin approval).\n\n' +
      '**Platform fee:** `PLATFORM_FEE_PERCENTAGE` (default 10 %) is deducted ' +
      'before the transfer is made.',
  })
  @ApiParam({ name: 'milestoneId', type: String, description: 'Milestone UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Milestone payment released.',
    schema: {
      example: {
        success: true,
        data: {
          transfer: {
            id:          'tr_3ABC123',
            amount:      225000,
            currency:    'usd',
            destination: 'acct_freelancer123',
            status:      'paid',
          },
          transaction: {
            id:     'tx-uuid',
            type:   'ESCROW_RELEASE',
            status: 'COMPLETED',
            amount: 2250,
          },
        },
        message: 'Milestone payment released successfully.',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Only the contract client can release payments.' })
  @ApiResponse({ status: 404, description: 'Milestone not found.' })
  @ApiResponse({ status: 409, description: 'Milestone is not SUBMITTED or freelancer not onboarded.' })
  @ApiResponse({ status: 500, description: 'Stripe transfer failed.' })
  async releaseMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @CurrentUser('id') clientId: string,
  ) {
    const result = await this.paymentService.releaseMilestone(milestoneId, clientId);
    return { data: result, message: 'Milestone payment released successfully.' };
  }

  /**
   * POST /payments/milestones/:milestoneId/request-revision
   * CLIENT requests changes from the freelancer.
   */
  @Post('milestones/:milestoneId/request-revision')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Request milestone revision (CLIENT)',
    description:
      'Requests a revision on a SUBMITTED milestone. Sets the milestone status to ' +
      '**REVISION_REQUESTED** and notifies the freelancer.\n\n' +
      'The freelancer can then re-submit the milestone after addressing the feedback.\n\n' +
      '**Note:** A revision note is mandatory — please be specific about what needs ' +
      'to change so the freelancer can act on the feedback immediately.',
  })
  @ApiParam({ name: 'milestoneId', type: String, description: 'Milestone UUID.' })
  @ApiBody({ type: RequestRevisionDto })
  @ApiResponse({
    status: 200,
    description: 'Revision requested.',
    schema: {
      example: {
        success: true,
        data: {
          id:           'milestone-uuid',
          status:       'REVISION_REQUESTED',
          revisionNote: 'Please change the chart colours to the brand palette and add the "Created At" column to the CSV export.',
          updatedAt:    '2025-01-21T09:00:00.000Z',
        },
        message: 'Revision requested. The freelancer has been notified.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Revision note is required and must be at least 10 characters.' })
  @ApiResponse({ status: 403, description: 'Only the contract client can request revisions.' })
  @ApiResponse({ status: 404, description: 'Milestone not found.' })
  @ApiResponse({ status: 409, description: 'Milestone is not in SUBMITTED status.' })
  async requestRevision(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: RequestRevisionDto,
    @CurrentUser('id') clientId: string,
  ) {
    const result = await this.paymentService.requestRevision(milestoneId, clientId, dto.note);
    return { data: result, message: 'Revision requested. The freelancer has been notified.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /payments/withdraw
  // FREELANCER requests a payout of their available Stripe Connect balance.
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Request a withdrawal (FREELANCER)',
    description:
      'Initiates a payout from the freelancer\'s Stripe Connect account to their ' +
      'connected bank account.\n\n' +
      '**Prerequisites:**\n' +
      '- The freelancer must have completed Stripe Connect Express onboarding.\n' +
      '- The requested amount must not exceed the available balance.\n\n' +
      '**Payout schedule:** Stripe transfers funds to the bank account according to ' +
      'the connected account\'s payout schedule (default: weekly on Fridays).\n\n' +
      '**Status tracking:** The withdrawal is initially PENDING. ' +
      'Stripe will send a webhook when it clears.',
  })
  @ApiBody({ type: WithdrawalRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal initiated.',
    schema: {
      example: {
        success: true,
        data: {
          withdrawal: {
            id:             'tx-uuid',
            type:           'WITHDRAWAL',
            status:         'PENDING',
            amount:         500,
            currency:       'usd',
            stripePayoutId: 'po_3ABC123',
            description:    'Withdrawal of $500 usd',
            createdAt:      '2025-01-22T08:00:00.000Z',
          },
        },
        message: 'Withdrawal of $500.00 USD initiated. Funds will arrive within 1-3 business days.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid amount or request body.' })
  @ApiResponse({ status: 403, description: 'Only freelancers can request withdrawals.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 409, description: 'Insufficient balance or Stripe account not connected.' })
  @ApiResponse({ status: 500, description: 'Stripe payout creation failed.' })
  async requestWithdrawal(
    @Body() dto: WithdrawalRequestDto,
    @CurrentUser('id') freelancerId: string,
  ) {
    const result = await this.paymentService.requestWithdrawal(freelancerId, dto);
    const currency = (dto.currency ?? 'usd').toUpperCase();
    return {
      data:    result,
      message: `Withdrawal of $${Number(dto.amount).toFixed(2)} ${currency} initiated. Funds will arrive within 1-3 business days.`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Refunds
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /payments/refunds
   * CLIENT or ADMIN issues a refund for an escrow deposit.
   */
  @Post('refunds')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Issue a refund (CLIENT / ADMIN)',
    description:
      'Issues a full or partial refund for a completed escrow deposit transaction.\n\n' +
      '**Use cases:**\n' +
      '- Project cancelled before work started\n' +
      '- Duplicate payment\n' +
      '- Dispute resolution\n\n' +
      '**Refund processing:** Stripe refunds typically arrive within 5-10 business days.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['transactionId'],
      properties: {
        transactionId: { type: 'string', example: 'tx-uuid' },
        amount: { type: 'number', example: 1000, description: 'Amount to refund (omit for full refund)' },
        reason: { type: 'string', enum: ['duplicate', 'fraudulent', 'requested_by_customer', 'dispute', 'project_cancelled'] },
        note: { type: 'string', example: 'Project cancelled before work started.' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Refund processed successfully.',
    schema: {
      example: {
        success: true,
        data: {
          refund: {
            id: 're_3ABC123',
            amount: 250000,
            currency: 'usd',
            status: 'succeeded',
          },
          transaction: {
            id: 'tx-refund-uuid',
            type: 'REFUND',
            status: 'COMPLETED',
            amount: 2500,
          },
        },
        message: 'Refund of $2500.00 processed successfully.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid refund amount or transaction type.' })
  @ApiResponse({ status: 403, description: 'Only the client or admin can issue refunds.' })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  @ApiResponse({ status: 409, description: 'Transaction is not in a refundable state.' })
  @ApiResponse({ status: 500, description: 'Stripe refund failed.' })
  async createRefund(
    @Body() dto: { transactionId: string; amount?: number; reason?: string; note?: string },
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.paymentService.createRefund(
      dto.transactionId,
      userId,
      dto.amount,
      dto.reason,
      dto.note,
    );

    const refundAmount = result.transaction?.amount ?? dto.amount ?? 0;
    return {
      data: result,
      message: `Refund of ${Number(refundAmount).toFixed(2)} processed successfully.`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Disputes
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /payments/disputes/hold
   * CLIENT or FREELANCER places a contract on dispute hold.
   */
  @Post('disputes/hold')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.FREELANCER)
  @ApiOperation({
    summary: 'Place contract on dispute hold (CLIENT / FREELANCER)',
    description:
      'Files a dispute and places the contract on hold. ' +
      'Prevents milestone releases until an admin resolves the dispute.\n\n' +
      '**Effect:** Contract status changes to DISPUTED. ' +
      'All pending milestone approvals are blocked.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['contractId', 'reason'],
      properties: {
        contractId: { type: 'string', example: 'contract-uuid' },
        reason: {
          type: 'string',
          example: 'Work not delivered as per requirements.',
          minLength: 20,
          maxLength: 1000,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Dispute hold placed successfully.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'contract-uuid',
          status: 'DISPUTED',
          disputeReason: 'Work not delivered as per requirements.',
          disputedAt: '2025-01-23T10:00:00.000Z',
        },
        message: 'Dispute filed. Contract is now on hold pending admin review.',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Only contract parties can file disputes.' })
  @ApiResponse({ status: 404, description: 'Contract not found.' })
  @ApiResponse({ status: 409, description: 'Contract is not in ACTIVE status.' })
  async placeDisputeHold(
    @Body() dto: { contractId: string; reason: string },
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.paymentService.placeDisputeHold(
      dto.contractId,
      userId,
      dto.reason,
    );

    return {
      data: result,
      message: 'Dispute filed. Contract is now on hold pending admin review.',
    };
  }

  /**
   * POST /payments/disputes/release
   * ADMIN resolves a dispute and releases the hold.
   */
  @Post('disputes/release')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Resolve dispute and release hold (ADMIN)',
    description:
      'Resolves a dispute by executing one of three outcomes:\n' +
      '1. **FULL_REFUND** — refund the entire escrow to the client\n' +
      '2. **PARTIAL_REFUND** — refund a portion to the client\n' +
      '3. **RELEASE_TO_FREELANCER** — release all pending milestones to the freelancer\n\n' +
      'After resolution, the contract status returns to ACTIVE.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['contractId', 'outcome', 'adminNotes'],
      properties: {
        contractId: { type: 'string', example: 'contract-uuid' },
        outcome: {
          type: 'string',
          enum: ['FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_FREELANCER'],
          example: 'PARTIAL_REFUND',
        },
        refundAmount: {
          type: 'number',
          example: 500,
          description: 'Required for PARTIAL_REFUND',
        },
        adminNotes: {
          type: 'string',
          example: 'Reviewed evidence. Partial refund approved as work was 50% complete.',
          minLength: 10,
          maxLength: 1000,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Dispute resolved successfully.',
    schema: {
      example: {
        success: true,
        data: {
          contract: {
            id: 'contract-uuid',
            status: 'ACTIVE',
            disputeResolvedAt: '2025-01-23T14:00:00.000Z',
            disputeResolution: 'PARTIAL_REFUND',
          },
          result: {
            refund: { id: 're_3ABC123', amount: 50000 },
            transaction: { id: 'tx-refund-uuid', type: 'REFUND' },
          },
        },
        message: 'Dispute resolved: PARTIAL_REFUND. Contract is now active.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid outcome or missing refund amount.' })
  @ApiResponse({ status: 403, description: 'Only admins can resolve disputes.' })
  @ApiResponse({ status: 404, description: 'Contract not found.' })
  @ApiResponse({ status: 409, description: 'Contract is not in DISPUTED status.' })
  async releaseDisputeHold(
    @Body()
    dto: {
      contractId: string;
      outcome: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'RELEASE_TO_FREELANCER';
      refundAmount?: number;
      adminNotes: string;
    },
    @CurrentUser('id') adminId: string,
  ) {
    const result = await this.paymentService.releaseDisputeHold(
      dto.contractId,
      adminId,
      dto.outcome,
      dto.refundAmount,
      dto.adminNotes,
    );

    return {
      data: result,
      message: `Dispute resolved: ${dto.outcome}. Contract is now active.`,
    };
  }
}
