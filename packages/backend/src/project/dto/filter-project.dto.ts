import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsPositive,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Enums (mirrored locally to avoid build-order dependency on @freelancer/shared)
// ---------------------------------------------------------------------------

export enum ProjectTypeFilter {
  FIXED_PRICE = 'FIXED_PRICE',
  HOURLY      = 'HOURLY',
}

export enum ProjectStatusFilter {
  OPEN        = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED   = 'COMPLETED',
  CANCELLED   = 'CANCELLED',
}

export enum SortByField {
  CREATED_AT = 'createdAt',
  BUDGET     = 'budget',
  BID_COUNT  = 'bidCount',
  VIEW_COUNT = 'viewCount',
}

export enum SortOrder {
  ASC  = 'asc',
  DESC = 'desc',
}

export enum ExperienceLevelFilter {
  ENTRY        = 'ENTRY',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT       = 'EXPERT',
}

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

/**
 * FilterProjectDto
 *
 * Represents all supported query parameters for `GET /projects`.
 * All fields are optional — omitting a field means "no filter on that dimension".
 *
 * Example URL:
 *   GET /projects?search=react+dashboard&type=FIXED_PRICE&minBudget=500&maxBudget=5000
 *                &skills=React,TypeScript&page=1&limit=20&sortBy=createdAt&sortOrder=desc
 */
export class FilterProjectDto {
  // ─── Full-text search ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Full-text search query matched against project title and description (case-insensitive).',
    example: 'react dashboard',
  })
  @IsOptional()
  @IsString({ message: 'search must be a string.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  // ─── Project type ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Filter by project billing type.',
    enum: ProjectTypeFilter,
    example: ProjectTypeFilter.FIXED_PRICE,
  })
  @IsOptional()
  @IsEnum(ProjectTypeFilter, {
    message: `type must be one of: ${Object.values(ProjectTypeFilter).join(', ')}.`,
  })
  type?: ProjectTypeFilter;

  // ─── Project status ───────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Filter by project status. Defaults to OPEN when not provided so that ' +
      'the default listing shows only projects accepting bids.',
    enum: ProjectStatusFilter,
    example: ProjectStatusFilter.OPEN,
  })
  @IsOptional()
  @IsEnum(ProjectStatusFilter, {
    message: `status must be one of: ${Object.values(ProjectStatusFilter).join(', ')}.`,
  })
  status?: ProjectStatusFilter;

  // ─── Budget range ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Minimum budget in USD. Filters projects whose budgetMin is >= this value.',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'minBudget must be a number.' })
  @Min(0, { message: 'minBudget must be at least 0.' })
  minBudget?: number;

  @ApiPropertyOptional({
    description:
      'Maximum budget in USD. Filters projects whose budgetMax is <= this value.',
    example: 10000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maxBudget must be a number.' })
  @Min(0, { message: 'maxBudget must be at least 0.' })
  maxBudget?: number;

  // ─── Skills ───────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Comma-separated list of required skill names. Returns projects that require ' +
      'at least one of the listed skills (OR logic). ' +
      'Example: `skills=React,TypeScript,NestJS`',
    example: 'React,TypeScript',
    isArray: true,
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map((v: string) => v.trim()).filter(Boolean);
    if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
    return value;
  })
  @IsArray({ message: 'skills must be an array of strings.' })
  @IsString({ each: true, message: 'Each skill must be a string.' })
  skills?: string[];

  // ─── Category ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Filter by category UUID.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID('4', { message: 'categoryId must be a valid UUID v4.' })
  categoryId?: string;

  // ─── Experience level ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Filter by the desired freelancer experience level.',
    enum: ExperienceLevelFilter,
    example: ExperienceLevelFilter.INTERMEDIATE,
  })
  @IsOptional()
  @IsEnum(ExperienceLevelFilter, {
    message: `experienceLevel must be one of: ${Object.values(ExperienceLevelFilter).join(', ')}.`,
  })
  experienceLevel?: ExperienceLevelFilter;

  // ─── Remote filter ────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'When true, returns only remote-friendly projects.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isRemote?: boolean;

  // ─── Client ID (narrow to a specific client's projects) ──────────────────────

  @ApiPropertyOptional({
    description: "Filter to show only a specific client's projects (UUID or 'me' for current user).",
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Allow "me" as a special value
    if (value === 'me') return 'me';
    return value;
  })
  @IsString({ message: 'clientId must be a string.' })
  clientId?: string;

  // ─── Pagination ───────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Page number (1-based). Defaults to 1.',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer.' })
  @Min(1, { message: 'page must be at least 1.' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of results per page. Defaults to 20, max 100.',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer.' })
  @Min(1,   { message: 'limit must be at least 1.' })
  @Max(100, { message: 'limit must not exceed 100.' })
  limit?: number = 20;

  // ─── Sorting ──────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Field to sort results by. ' +
      '`createdAt` sorts by posting date, `budget` by minimum budget, ' +
      '`bidCount` by number of bids, `viewCount` by popularity.',
    enum: SortByField,
    example: SortByField.CREATED_AT,
    default: SortByField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortByField, {
    message: `sortBy must be one of: ${Object.values(SortByField).join(', ')}.`,
  })
  sortBy?: SortByField = SortByField.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort direction. Defaults to `desc` (newest / highest first).',
    enum: SortOrder,
    example: SortOrder.DESC,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder, {
    message: `sortOrder must be one of: ${Object.values(SortOrder).join(', ')}.`,
  })
  sortOrder?: SortOrder = SortOrder.DESC;
}
