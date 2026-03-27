import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Mirrors the UserRole enum from @freelancer/shared.
 * Declared locally so the DTO compiles even if the shared package
 * hasn't been built yet, while still being compatible at runtime.
 */
export enum UserRole {
  CLIENT = 'CLIENT',
  FREELANCER = 'FREELANCER',
  ADMIN = 'ADMIN',
}

export class RegisterDto {
  // ─── Email ──────────────────────────────────────────────────────────────────

  @ApiProperty({
    description: 'Valid email address. Must be unique across the platform.',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  // ─── Password ────────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Password must be at least 8 characters and contain at least one uppercase letter, ' +
      'one lowercase letter, one digit, and one special character.',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, ' +
      'one number, and one special character.',
  })
  password: string;

  // ─── First Name ───────────────────────────────────────────────────────────────

  @ApiProperty({
    description: "User's first name.",
    example: 'John',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty({ message: 'First name must not be empty.' })
  @MinLength(2, { message: 'First name must be at least 2 characters long.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName: string;

  // ─── Last Name ────────────────────────────────────────────────────────────────

  @ApiProperty({
    description: "User's last name.",
    example: 'Doe',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name must not be empty.' })
  @MinLength(2, { message: 'Last name must be at least 2 characters long.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName: string;

  // ─── Role ────────────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Account role. Only CLIENT and FREELANCER are allowed during self-registration. ' +
      'ADMIN accounts are provisioned manually.',
    enum: [UserRole.CLIENT, UserRole.FREELANCER],
    example: UserRole.FREELANCER,
  })
  @IsEnum([UserRole.CLIENT, UserRole.FREELANCER], {
    message: `Role must be one of: ${UserRole.CLIENT}, ${UserRole.FREELANCER}`,
  })
  role: UserRole;

  // ─── Optional Referral Code ───────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Optional referral code provided by an existing user.',
    example: 'REF-ABC123',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
