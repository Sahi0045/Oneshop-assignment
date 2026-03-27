import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max, IsArray } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    description: 'User bio/description',
    example: 'Full-stack developer with 5 years of experience',
    required: false,
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({
    description: 'Hourly rate in USD',
    example: 75,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(10000)
  @IsOptional()
  hourlyRate?: number;

  @ApiProperty({
    description: 'Array of skill IDs',
    example: ['uuid-1', 'uuid-2'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skillIds?: string[];
}
