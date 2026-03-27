import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum RefundReason {
  DUPLICATE = 'duplicate',
  FRAUDULENT = 'fraudulent',
  REQUESTED_BY_CUSTOMER = 'requested_by_customer',
  DISPUTE = 'dispute',
  PROJECT_CANCELLED = 'project_cancelled',
}

export class CreateRefundDto {
  @ApiProperty({
    description: 'Transaction ID to refund.',
    example: 'clxyz-transaction-uuid',
  })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiPropertyOptional({
    description: 'Amount to refund (omit for full refund). Must not exceed original transaction amount.',
    example: 1000,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Reason for the refund.',
    enum: RefundReason,
    example: RefundReason.REQUESTED_BY_CUSTOMER,
  })
  @IsOptional()
  @IsEnum(RefundReason)
  reason?: RefundReason;

  @ApiPropertyOptional({
    description: 'Additional notes about the refund.',
    example: 'Client requested cancellation before work started.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;
}

export class DisputeHoldDto {
  @ApiProperty({
    description: 'Contract ID to place on dispute hold.',
    example: 'clxyz-contract-uuid',
  })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({
    description: 'Reason for the dispute.',
    example: 'Work not delivered as per requirements.',
    minLength: 20,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason: string;
}

export class DisputeReleaseDto {
  @ApiProperty({
    description: 'Contract ID to release from dispute hold.',
    example: 'clxyz-contract-uuid',
  })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({
    description: 'Outcome of the dispute resolution.',
    enum: ['FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_FREELANCER'],
    example: 'PARTIAL_REFUND',
  })
  @IsEnum(['FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_FREELANCER'])
  outcome: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'RELEASE_TO_FREELANCER';

  @ApiPropertyOptional({
    description: 'Amount to refund (required for PARTIAL_REFUND).',
    example: 500,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  refundAmount?: number;

  @ApiProperty({
    description: 'Admin notes about the resolution.',
    example: 'Reviewed evidence. Partial refund approved as work was 50% complete.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  adminNotes: string;
}
