import { IsString, IsUUID, IsArray, IsOptional } from 'class-validator';

export class CreateDisputeDto {
  @IsUUID()
  contractId: string;

  @IsString()
  reason: string;

  @IsString()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  evidence?: string[];
}

export class ResolveDisputeDto {
  @IsString()
  resolution: 'REFUND_CLIENT' | 'RELEASE_TO_FREELANCER' | 'PARTIAL_REFUND' | 'REJECT';

  @IsOptional()
  refundAmount?: number;

  @IsString()
  @IsOptional()
  adminNotes?: string;
}
