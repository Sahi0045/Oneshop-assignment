import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Milestone sub-DTO (optional structured milestones within a bid)
// ---------------------------------------------------------------------------

/**
 * BidMilestoneDto
 *
 * Represents a single payment milestone proposed by the freelancer as part
 * of their bid.  Milestones allow the client to release funds incrementally
 * as deliverables are completed, rather than paying the full amount upfront.
 *
 * Example:
 *   Milestone 1 — "Initial design mockups"    — $500  — 7 days
 *   Milestone 2 — "Backend API integration"   — $1500 — 14 days
 *   Milestone 3 — "Final delivery & testing"  — $1000 — 7 days
 */
export class BidMilestoneDto {
  @ApiProperty({
    description: 'Short, descriptive title for this milestone.',
    example: 'Initial design mockups & wireframes',
    minLength: 5,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Milestone title must not be empty.' })
  @MinLength(5,   { message: 'Milestone title must be at least 5 characters.' })
  @MaxLength(100, { message: 'Milestone title must not exceed 100 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description of what will be delivered at this milestone.',
    example:
      'Complete high-fidelity Figma mockups for all dashboard views, ' +
      'reviewed and approved by the client before development begins.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Milestone description must not exceed 500 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiProperty({
    description:
      'Amount (in USD) to be released when this milestone is approved. ' +
      'The sum of all milestone amounts must equal the total bid amount.',
    example: 500,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Milestone amount must be a number.' })
  @IsPositive({ message: 'Milestone amount must be greater than 0.' })
  amount: number;

  @ApiProperty({
    description:
      'Number of calendar days from project start (or the previous milestone ' +
      'approval) until this milestone is expected to be completed.',
    example: 7,
    minimum: 1,
    maximum: 365,
  })
  @Type(() => Number)
  @IsInt({ message: 'Milestone duration must be a whole number of days.' })
  @Min(1,   { message: 'Milestone duration must be at least 1 day.' })
  @Max(365, { message: 'Milestone duration must not exceed 365 days.' })
  durationDays: number;

  @ApiPropertyOptional({
    description:
      'Order / sequence number of this milestone (1-based). ' +
      'Determines the order in which milestones are displayed and released.',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Milestone order must be a whole number.' })
  @Min(1, { message: 'Milestone order must be at least 1.' })
  order?: number;
}

// ---------------------------------------------------------------------------
// CreateBidDto
// ---------------------------------------------------------------------------

/**
 * CreateBidDto
 *
 * Payload sent by a freelancer when placing a bid on an OPEN project.
 *
 * Required fields:
 *   - amount        — total bid price (or hourly rate for HOURLY projects)
 *   - deliveryDays  — how many calendar days to complete the project
 *   - coverLetter   — personalised pitch to the client
 *
 * Optional fields:
 *   - milestones    — structured payment milestones (for FIXED_PRICE projects)
 *   - attachments   — URLs to supporting files (portfolio samples, etc.)
 *   - availability  — weekly hours the freelancer can dedicate
 */
export class CreateBidDto {
  // ─── Bid Amount ───────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Total bid amount in USD for FIXED_PRICE projects, or the hourly rate ' +
      'for HOURLY projects. Must be a positive number with up to 2 decimal places.',
    example: 2500,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a number with at most 2 decimal places.' },
  )
  @IsPositive({ message: 'Bid amount must be greater than 0.' })
  amount: number;

  // ─── Delivery Time ───────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Estimated number of calendar days to complete and deliver the project ' +
      'from the date the contract is started.',
    example: 14,
    minimum: 1,
    maximum: 730,
  })
  @Type(() => Number)
  @IsInt({ message: 'deliveryDays must be a whole number.' })
  @Min(1,   { message: 'Delivery time must be at least 1 day.' })
  @Max(730, { message: 'Delivery time must not exceed 730 days (2 years).' })
  deliveryDays: number;

  // ─── Cover Letter ─────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'A personalised cover letter / proposal addressed to the client. ' +
      'This is the most important part of the bid — explain your approach, ' +
      'relevant experience, and why you are the best person for this project. ' +
      'Be specific and avoid copy-pasting generic templates.',
    example:
      'Hi! I have 6 years of experience building React dashboards with real-time ' +
      'data visualisation using Recharts and WebSocket integration. I have reviewed ' +
      'your project requirements and I am confident I can deliver a polished, ' +
      'performant solution within the 14-day timeline. I will start with a short ' +
      'discovery call to clarify any open questions, then provide a detailed ' +
      'technical specification before writing a single line of code.',
    minLength: 50,
    maxLength: 3000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Cover letter must not be empty.' })
  @MinLength(50,   { message: 'Cover letter must be at least 50 characters long.' })
  @MaxLength(3000, { message: 'Cover letter must not exceed 3 000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  coverLetter: string;

  // ─── Milestones (optional structured payment schedule) ───────────────────────

  @ApiPropertyOptional({
    description:
      'Optional array of structured payment milestones proposed by the freelancer. ' +
      'When provided, the sum of all milestone amounts should equal the total bid amount. ' +
      'Applicable primarily to FIXED_PRICE projects. ' +
      'Maximum 10 milestones per bid.',
    type:     () => [BidMilestoneDto],
    example:  [
      {
        title:       'Design mockups',
        description: 'High-fidelity Figma mockups for all screens.',
        amount:      500,
        durationDays: 5,
        order:       1,
      },
      {
        title:       'Frontend implementation',
        description: 'React components wired to the REST API.',
        amount:      1500,
        durationDays: 9,
        order:       2,
      },
      {
        title:       'Final QA & delivery',
        description: 'Bug fixes, cross-browser testing, and handoff.',
        amount:      500,
        durationDays: 3,
        order:       3,
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
      'Array of S3 / CDN URLs for files attached to the bid. ' +
      'Use this to share portfolio samples, references, or a detailed proposal ' +
      'document. Files should be uploaded first via the /uploads endpoint.',
    type:    [String],
    example: [
      'https://s3.amazonaws.com/freelancer-platform-uploads/portfolio/dashboard-sample.png',
      'https://s3.amazonaws.com/freelancer-platform-uploads/proposals/technical-spec.pdf',
    ],
    maxItems: 5,
  })
  @IsOptional()
  @IsArray({ message: 'attachments must be an array of URL strings.' })
  @ArrayMaxSize(5, { message: 'You can attach at most 5 files to a bid.' })
  @IsString({ each: true, message: 'Each attachment must be a URL string.' })
  @IsNotEmpty({ each: true, message: 'Attachment URLs must not be empty strings.' })
  attachments?: string[];

  // ─── Weekly Availability ──────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Number of hours per week the freelancer plans to dedicate to this project. ' +
      'Helps the client understand the freelancer\'s commitment level.',
    example: 40,
    minimum: 1,
    maximum: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'weeklyHours must be a whole number.' })
  @Min(1,  { message: 'weeklyHours must be at least 1.' })
  @Max(80, { message: 'weeklyHours must not exceed 80 hours per week.' })
  weeklyHours?: number;

  // ─── Questions / Clarifications ───────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Optional questions the freelancer wants to ask the client before starting. ' +
      'Demonstrating that you\'ve read the brief and have thoughtful questions ' +
      'often makes a positive impression.',
    example:
      'Do you have an existing design system / component library we should adhere to? ' +
      'Will the backend API be stable during development, or are changes still expected?',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Questions must not exceed 1 000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  questions?: string;
}
