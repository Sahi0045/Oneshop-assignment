import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Currency enum — ISO 4217 codes supported by the platform
// ---------------------------------------------------------------------------

export enum SupportedCurrency {
  USD = 'usd',
  EUR = 'eur',
  GBP = 'gbp',
  CAD = 'cad',
  AUD = 'aud',
}

// ---------------------------------------------------------------------------
// CreatePaymentDto
// ---------------------------------------------------------------------------

/**
 * CreatePaymentDto
 *
 * Payload sent by a CLIENT to create a Stripe PaymentIntent that funds
 * the escrow wallet for a specific contract.
 *
 * Flow
 * ────
 * 1. The client calls POST /payments/intent with this DTO.
 * 2. PaymentService creates a Stripe PaymentIntent and a PENDING
 *    ESCROW_DEPOSIT Transaction record in the database.
 * 3. The `clientSecret` is returned to the frontend.
 * 4. The frontend uses Stripe.js to confirm the payment with the
 *    `clientSecret` (card details never touch our server).
 * 5. Stripe delivers a `payment_intent.succeeded` webhook once the
 *    payment clears, at which point the transaction is marked COMPLETED
 *    and milestone submissions are unlocked.
 *
 * Amount handling
 * ───────────────
 * • `amount` is in whole currency units (e.g. 2500 = $2 500.00).
 * • PaymentService converts to the smallest unit (cents) before calling
 *   the Stripe SDK (2500 → 250000 cents).
 * • The minimum fundable amount is $1.00 (Stripe minimum).
 * • There is no platform-enforced maximum — the Stripe account limit applies.
 */
export class CreatePaymentDto {
  // ─── Contract ID ─────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'UUID of the contract this escrow deposit is funding. ' +
      'The contract must exist, be in ACTIVE status, and the authenticated user ' +
      'must be the client on that contract.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID('4', { message: 'contractId must be a valid UUID v4.' })
  @IsNotEmpty({ message: 'contractId must not be empty.' })
  contractId: string;

  // ─── Amount ───────────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Amount to deposit into escrow, in whole currency units (e.g. 2500 = $2 500.00). ' +
      'This should match the contracted amount. ' +
      'A platform fee of PLATFORM_FEE_PERCENTAGE % will be deducted when milestone ' +
      'payments are released to the freelancer — the full contracted amount is ' +
      'held in escrow.',
    example: 2500,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount must be a number with at most 2 decimal places.' },
  )
  @IsPositive({ message: 'amount must be greater than 0.' })
  amount: number;

  // ─── Currency ─────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'ISO 4217 currency code in lowercase. Defaults to `usd`. ' +
      'Both the client and freelancer must be in a Stripe-supported region ' +
      'for non-USD currencies.',
    enum: SupportedCurrency,
    example: SupportedCurrency.USD,
    default: SupportedCurrency.USD,
  })
  @IsOptional()
  @IsEnum(SupportedCurrency, {
    message: `currency must be one of: ${Object.values(SupportedCurrency).join(', ')}.`,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  currency?: SupportedCurrency = SupportedCurrency.USD;

  // ─── Description ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Human-readable description of this payment. ' +
      'Appears on the Stripe payment record and in the client\'s bank statement ' +
      '(subject to bank truncation). ' +
      'Defaults to "Escrow funding for contract {contractId}".',
    example: 'Escrow deposit — SaaS Dashboard project (contract acct_xxx)',
    minLength: 5,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'description must be a string.' })
  @MinLength(5,   { message: 'description must be at least 5 characters long.' })
  @MaxLength(255, { message: 'description must not exceed 255 characters.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  // ─── Idempotency Key (optional — generated server-side if omitted) ────────────

  @ApiPropertyOptional({
    description:
      'Optional client-supplied idempotency key for this payment request. ' +
      'If omitted, the server generates one automatically based on the contractId. ' +
      'Use a unique, stable key (e.g. a UUID) to safely retry failed requests ' +
      'without creating duplicate charges. ' +
      'Keys are cached for 24 hours (matching Stripe\'s deduplication window).',
    example: 'client-idempotency-key-abc123',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'idempotencyKey must be a string.' })
  @MaxLength(255, { message: 'idempotencyKey must not exceed 255 characters.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  idempotencyKey?: string;

  // ─── Return URL (for redirect-based payment methods) ──────────────────────────

  @ApiPropertyOptional({
    description:
      'URL the user is redirected to after completing (or cancelling) a ' +
      'redirect-based payment method (e.g. iDEAL, Bancontact, SEPA). ' +
      'Not required for card payments. ' +
      'Must be an absolute HTTPS URL pointing to your frontend.',
    example: 'https://app.freelancerplatform.com/contracts/abc123/payment/confirm',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString({ message: 'returnUrl must be a string.' })
  @MaxLength(2048, { message: 'returnUrl must not exceed 2 048 characters.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  returnUrl?: string;
}
