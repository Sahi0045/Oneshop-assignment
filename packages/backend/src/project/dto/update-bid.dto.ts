import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsInt,
  IsEnum,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BidMilestoneDto } from './create-bid.dto';

// ---------------------------------------------------------------------------
// Allowed bid actions
// ---------------------------------------------------------------------------

/**
 * BidAction
 *
 * Discriminates between the three possible operations on the
 * PATCH /projects/:id/bids/:bidId endpoint:
 *
 *   "update"   — Freelancer edits amount / deliveryDays / coverLetter (PENDING only)
 *   "withdraw" — Freelancer withdraws their PENDING bid
 *   "award"    — Client accepts this bid, creating a Contract and moving the
 *                project to IN_PROGRESS
 */
export enum BidAction {
  UPDATE   = 'update',
  WITHDRAW = 'withdraw',
  AWARD    = 'award',
}

// ---------------------------------------------------------------------------
// UpdateBidDto
// ---------------------------------------------------------------------------

/**
 * UpdateBidDto
 *
 * Payload for `PATCH /projects/:id/bids/:bidId`.
 *
 * The `action` field controls what operation is performed:
 *
 * | action     | who        | required extra fields              |
 * |------------|------------|------------------------------------|
 * | "update"   | FREELANCER | at least one of amount / deliveryDays / coverLetter |
 * | "withdraw" | FREELANCER | none                               |
 * | "award"    | CLIENT     | none                               |
 *
 * All mutable bid fields (amount, deliveryDays, coverLetter, etc.) are
 * optional — include only the ones you want to change.
 */
export class UpdateBidDto {
  // ─── Action discriminator ─────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'The operation to perform on the bid.\n\n' +
      '- **`update`** *(FREELANCER)* — edit amount, delivery days, or cover letter. ' +
      'The bid must still be PENDING.\n' +
      '- **`withdraw`** *(FREELANCER)* — withdraw a PENDING bid. ' +
      'This cannot be undone; you would need to place a new bid.\n' +
      '- **`award`** *(CLIENT)* — accept this bid. ' +
      'A Contract is created automatically, all other bids on the project are ' +
      'rejected, and the project moves to IN_PROGRESS.',
    enum: BidAction,
    example: BidAction.UPDATE,
  })
  @IsOptional()
  @IsEnum(BidAction, {
    message: `action must be one of: ${Object.values(BidAction).join(', ')}.`,
  })
  action?: BidAction;

  // ─── Bid Amount ───────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Revised total bid amount in USD (FIXED_PRICE) or hourly rate (HOURLY). ' +
      'Only valid when action is "update". Must be a positive number with at ' +
      'most 2 decimal places.',
    example: 2200,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount must be a number with at most 2 decimal places.' },
  )
  @IsPositive({ message: 'amount must be greater than 0.' })
  amount?: number;

  // ─── Delivery Time ────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Revised estimated number of calendar days to complete the project. ' +
      'Only valid when action is "update".',
    example: 10,
    minimum: 1,
    maximum: 730,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'deliveryDays must be a whole number.' })
  @Min(1,   { message: 'deliveryDays must be at least 1 day.' })
  @Max(730, { message: 'deliveryDays must not exceed 730 days.' })
  deliveryDays?: number;

  // ─── Cover Letter ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Revised cover letter / proposal text. ' +
      'Only valid when action is "update". ' +
      'Consider explaining why you are changing the bid and what additional ' +
      'value you are now offering.',
    example:
      'After reviewing the project requirements more carefully, I am lowering my ' +
      'bid to $2 200 and reducing the timeline to 10 days. I have already built a ' +
      'very similar dashboard for another client and can reuse tested components.',
    minLength: 50,
    maxLength: 3000,
  })
  @IsOptional()
  @IsString()
  @MinLength(50,   { message: 'coverLetter must be at least 50 characters long.' })
  @MaxLength(3000, { message: 'coverLetter must not exceed 3 000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  coverLetter?: string;

  // ─── Milestones ───────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Revised milestone schedule. ' +
      'Replaces the existing milestone list in its entirety — send the complete ' +
      'updated array, not just the changed items. ' +
      'Only valid when action is "update". Max 10 milestones.',
    type:    () => [BidMilestoneDto],
    example: [
      {
        title:        'Design & prototyping',
        description:  'Figma screens + clickable prototype.',
        amount:       600,
        durationDays: 4,
        order:        1,
      },
      {
        title:        'Development & QA',
        description:  'Full implementation, unit tests, and cross-browser QA.',
        amount:       1600,
        durationDays: 6,
        order:        2,
      },
    ],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray({ message: 'milestones must be an array.' })
  @ArrayMaxSize(10, { message: 'A bid can have at most 10 milestones.' })
  @ValidateNested({ each: true })
  @Type(() => BidMilestoneDto)
  milestones?: BidMilestoneDto[];

  // ─── Attachments ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Revised list of S3 / CDN attachment URLs. ' +
      'Replaces the existing attachment list. ' +
      'Only valid when action is "update". Max 5 attachments.',
    type:    [String],
    example: [
      'https://s3.amazonaws.com/freelancer-platform-uploads/portfolio/updated-sample.png',
    ],
    maxItems: 5,
  })
  @IsOptional()
  @IsArray({ message: 'attachments must be an array of URL strings.' })
  @ArrayMaxSize(5, { message: 'You can attach at most 5 files to a bid.' })
  @IsString({ each: true, message: 'Each attachment must be a URL string.' })
  attachments?: string[];

  // ─── Weekly Availability ──────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Revised weekly hours the freelancer plans to dedicate to this project. ' +
      'Only valid when action is "update".',
    example: 30,
    minimum: 1,
    maximum: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'weeklyHours must be a whole number.' })
  @Min(1,  { message: 'weeklyHours must be at least 1.' })
  @Max(80, { message: 'weeklyHours must not exceed 80.' })
  weeklyHours?: number;

  // ─── Questions ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Updated questions or clarifications for the client. ' +
      'Only valid when action is "update". Max 1 000 characters.',
    example: 'Has the scope changed since you posted the project? Any new requirements?',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'questions must not exceed 1 000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  questions?: string;
}
