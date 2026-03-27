import { IsString, IsNumber, IsUUID, Min, Max, IsOptional } from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  contractId: string;

  @IsUUID()
  revieweeId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  communicationRating?: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  qualityRating?: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  timelinessRating?: number;
}
