import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  IsUUID,
  IsDateString,
  Min,
  Max,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum ProjectType {
  FIXED_PRICE = 'FIXED_PRICE',
  HOURLY      = 'HOURLY',
}

export enum ExperienceLevel {
  ENTRY       = 'ENTRY',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT      = 'EXPERT',
}

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export class CreateProjectDto {
  // ─── Title ───────────────────────────────────────────────────────────────────

  @ApiProperty({
    description: 'Project title — clear and descriptive so freelancers immediately understand the scope.',
    example: 'Build a SaaS Analytics Dashboard with React & NestJS',
    minLength: 10,
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty({ message: 'Project title must not be empty.' })
  @MinLength(10, { message: 'Title must be at least 10 characters long.' })
  @MaxLength(150, { message: 'Title must not exceed 150 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  // ─── Description ─────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Detailed project description. Include requirements, deliverables, tech stack preferences, ' +
      'and any other information that will help freelancers evaluate the project.',
    example:
      'We need a React-based analytics dashboard that pulls data from our NestJS API. ' +
      'The dashboard should include real-time charts (using Chart.js or Recharts), ' +
      'user management, and an export-to-CSV feature. The backend API is already built.',
    minLength: 50,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Project description must not be empty.' })
  @MinLength(50, { message: 'Description must be at least 50 characters long.' })
  @MaxLength(5000, { message: 'Description must not exceed 5 000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description: string;

  // ─── Type ─────────────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      '**FIXED_PRICE** — a single agreed fee for the whole project.\n' +
      '**HOURLY** — the freelancer is paid per hour worked.',
    enum: ProjectType,
    example: ProjectType.FIXED_PRICE,
  })
  @IsEnum(ProjectType, {
    message: `Project type must be one of: ${Object.values(ProjectType).join(', ')}.`,
  })
  type: ProjectType;

  // ─── Budget ───────────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Minimum budget in USD. For FIXED_PRICE projects this is the lower end of the ' +
      'acceptable range. For HOURLY projects this is the minimum hourly rate.',
    example: 1000,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Minimum budget must be a number.' })
  @IsPositive({ message: 'Minimum budget must be greater than 0.' })
  budgetMin: number;

  @ApiProperty({
    description:
      'Maximum budget in USD. Must be greater than or equal to budgetMin. ' +
      'For HOURLY projects this is the maximum hourly rate.',
    example: 3000,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Maximum budget must be a number.' })
  @IsPositive({ message: 'Maximum budget must be greater than 0.' })
  budgetMax: number;

  // ─── Deadline ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Project deadline (ISO 8601 date string). Must be in the future. ' +
      'Omit if no strict deadline is required.',
    example: '2025-06-30T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Deadline must be a valid ISO 8601 date string.' })
  deadline?: string;

  // ─── Experience Level ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Desired freelancer experience level.\n' +
      '**ENTRY** — suitable for newer freelancers.\n' +
      '**INTERMEDIATE** — some proven track record required.\n' +
      '**EXPERT** — high complexity work, senior professionals preferred.',
    enum: ExperienceLevel,
    example: ExperienceLevel.INTERMEDIATE,
  })
  @IsOptional()
  @IsEnum(ExperienceLevel, {
    message: `Experience level must be one of: ${Object.values(ExperienceLevel).join(', ')}.`,
  })
  experienceLevel?: ExperienceLevel;

  // ─── Skills ───────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'List of required skill names (e.g. "React", "TypeScript", "NestJS"). ' +
      'Skills are matched case-insensitively and created on-the-fly if not yet in the database.',
    type: [String],
    example: ['React', 'TypeScript', 'NestJS', 'PostgreSQL'],
    maxItems: 15,
  })
  @IsOptional()
  @IsArray({ message: 'Skills must be an array of strings.' })
  @ArrayMaxSize(15, { message: 'You can specify at most 15 required skills.' })
  @IsString({ each: true, message: 'Each skill must be a string.' })
  @IsNotEmpty({ each: true, message: 'Skill names must not be empty strings.' })
  @MaxLength(50, { each: true, message: 'Each skill name must not exceed 50 characters.' })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((v: string) => (typeof v === 'string' ? v.trim() : v))
      : value,
  )
  skills?: string[];

  // ─── Category ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'UUID of the project category (e.g. Web Development, Mobile, Design).',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Category ID must be a valid UUID v4.' })
  categoryId?: string;

  // ─── Duration ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Estimated project duration in days. Helps freelancers assess whether ' +
      'the timeline fits their current workload.',
    example: 30,
    minimum: 1,
    maximum: 730,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Duration must be a whole number of days.' })
  @Min(1,   { message: 'Duration must be at least 1 day.' })
  @Max(730, { message: 'Duration must not exceed 730 days (2 years).' })
  durationDays?: number;

  // ─── Attachments ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Array of S3 / CDN URLs for files attached to the project posting ' +
      '(e.g. design mockups, specification documents). ' +
      'Files should be uploaded first via the /uploads endpoint.',
    type: [String],
    example: [
      'https://s3.amazonaws.com/freelancer-platform-uploads/specs/brief.pdf',
      'https://s3.amazonaws.com/freelancer-platform-uploads/mockups/dashboard.png',
    ],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray({ message: 'Attachments must be an array of URLs.' })
  @ArrayMaxSize(10, { message: 'You can attach at most 10 files.' })
  @IsString({ each: true, message: 'Each attachment must be a URL string.' })
  attachments?: string[];

  // ─── Max Bids ─────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Maximum number of bids the client wants to receive before the project ' +
      'is automatically closed to new bids. Omit to allow unlimited bids.',
    example: 20,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'maxBids must be a whole number.' })
  @Min(1,   { message: 'maxBids must be at least 1.' })
  @Max(500, { message: 'maxBids must not exceed 500.' })
  maxBids?: number;

  // ─── Is Remote ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Whether the project can be done fully remotely. Defaults to true.',
    example: true,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  isRemote?: boolean = true;

  // ─── Location (if not remote) ─────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Physical location of the project if isRemote is false (e.g. "New York, NY, USA").',
    example: 'San Francisco, CA, USA',
    maxLength: 100,
  })
  @IsOptional()
  @ValidateIf((o) => o.isRemote === false)
  @IsString()
  @MaxLength(100, { message: 'Location must not exceed 100 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  location?: string;

  // ─── Tags ─────────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Freeform tags to improve discoverability (separate from skills). ' +
      'Keep tags concise and relevant.',
    type: [String],
    example: ['saas', 'dashboard', 'realtime', 'fintech'],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray({ message: 'Tags must be an array of strings.' })
  @ArrayMaxSize(10, { message: 'You can add at most 10 tags.' })
  @IsString({ each: true, message: 'Each tag must be a string.' })
  @MaxLength(30, { each: true, message: 'Each tag must not exceed 30 characters.' })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((v: string) => (typeof v === 'string' ? v.toLowerCase().trim() : v))
      : value,
  )
  tags?: string[];
}
