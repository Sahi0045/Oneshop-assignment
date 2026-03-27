import { z } from 'zod';
import { DisputeReason } from '../types/review.types';
import { TransactionType } from '../types/contract.types';

// ─── Reusable Field Validators ────────────────────────────────────────────────

const currencyField = z
  .string({ required_error: 'Currency is required' })
  .length(3, 'Currency must be a 3-letter ISO code')
  .toUpperCase();

const amountField = (label = 'Amount') =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
    .positive(`${label} must be greater than 0`)
    .max(1_000_000, `${label} cannot exceed 1,000,000`)
    .multipleOf(0.01, `${label} must have at most 2 decimal places`);

const urlField = z.string().url('Each attachment must be a valid URL').max(2048, 'URL is too long');

// ─── Payment Intent ───────────────────────────────────────────────────────────

export const createPaymentIntentSchema = z.object({
  contractId: z
    .string({ required_error: 'Contract ID is required' })
    .cuid('Invalid contract ID'),
  milestoneId: z
    .string()
    .cuid('Invalid milestone ID')
    .optional(),
  amount: amountField('Amount'),
  currency: currencyField,
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .trim()
    .optional(),
  metadata: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;

// ─── Confirm Payment ──────────────────────────────────────────────────────────

export const confirmPaymentSchema = z.object({
  paymentIntentId: z
    .string({ required_error: 'Payment intent ID is required' })
    .min(1, 'Payment intent ID is required'),
  contractId: z
    .string({ required_error: 'Contract ID is required' })
    .cuid('Invalid contract ID'),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

// ─── Payout Methods ───────────────────────────────────────────────────────────

export const PayoutMethod = {
  BANK: 'BANK',
  UPI: 'UPI',
  PAYONEER: 'PAYONEER',
  PAYPAL: 'PAYPAL',
  STRIPE: 'STRIPE',
} as const;

export type PayoutMethod = (typeof PayoutMethod)[keyof typeof PayoutMethod];

// ─── Account Details Discriminated Union ─────────────────────────────────────

const bankAccountDetailsSchema = z.object({
  method: z.literal('BANK'),
  accountHolderName: z
    .string({ required_error: 'Account holder name is required' })
    .min(2, 'Account holder name must be at least 2 characters')
    .max(100, 'Account holder name must not exceed 100 characters')
    .trim(),
  accountNumber: z
    .string({ required_error: 'Account number is required' })
    .min(5, 'Account number must be at least 5 characters')
    .max(34, 'Account number must not exceed 34 characters')
    .regex(/^[A-Z0-9]+$/, 'Account number must only contain uppercase letters and digits'),
  bankName: z
    .string({ required_error: 'Bank name is required' })
    .min(2, 'Bank name must be at least 2 characters')
    .max(100, 'Bank name must not exceed 100 characters')
    .trim(),
  ifscCode: z
    .string()
    .length(11, 'IFSC code must be exactly 11 characters')
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format')
    .toUpperCase()
    .optional(),
  ibanCode: z
    .string()
    .min(15, 'IBAN must be at least 15 characters')
    .max(34, 'IBAN must not exceed 34 characters')
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/, 'Invalid IBAN format')
    .toUpperCase()
    .optional(),
  swiftCode: z
    .string()
    .min(8, 'SWIFT/BIC must be at least 8 characters')
    .max(11, 'SWIFT/BIC must not exceed 11 characters')
    .regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Invalid SWIFT/BIC format')
    .toUpperCase()
    .optional(),
  routingNumber: z
    .string()
    .length(9, 'US routing number must be exactly 9 digits')
    .regex(/^\d{9}$/, 'Routing number must contain only digits')
    .optional(),
  country: z
    .string({ required_error: 'Country is required' })
    .min(2, 'Country must be at least 2 characters')
    .max(100, 'Country must not exceed 100 characters')
    .trim(),
});

const upiAccountDetailsSchema = z.object({
  method: z.literal('UPI'),
  upiId: z
    .string({ required_error: 'UPI ID is required' })
    .min(5, 'UPI ID must be at least 5 characters')
    .max(100, 'UPI ID must not exceed 100 characters')
    .regex(
      /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/,
      'Invalid UPI ID format (e.g. name@bankname)',
    )
    .toLowerCase(),
  accountHolderName: z
    .string({ required_error: 'Account holder name is required' })
    .min(2, 'Account holder name must be at least 2 characters')
    .max(100, 'Account holder name must not exceed 100 characters')
    .trim(),
});

const payoneerAccountDetailsSchema = z.object({
  method: z.literal('PAYONEER'),
  payoneerId: z
    .string({ required_error: 'Payoneer ID is required' })
    .min(6, 'Payoneer ID must be at least 6 characters')
    .max(50, 'Payoneer ID must not exceed 50 characters'),
  email: z
    .string({ required_error: 'Payoneer email is required' })
    .email('Invalid Payoneer email address')
    .toLowerCase(),
  accountHolderName: z
    .string({ required_error: 'Account holder name is required' })
    .min(2, 'Account holder name must be at least 2 characters')
    .max(100, 'Account holder name must not exceed 100 characters')
    .trim(),
});

const paypalAccountDetailsSchema = z.object({
  method: z.literal('PAYPAL'),
  email: z
    .string({ required_error: 'PayPal email is required' })
    .email('Invalid PayPal email address')
    .toLowerCase(),
  accountHolderName: z
    .string({ required_error: 'Account holder name is required' })
    .min(2, 'Account holder name must be at least 2 characters')
    .max(100, 'Account holder name must not exceed 100 characters')
    .trim(),
});

const stripeAccountDetailsSchema = z.object({
  method: z.literal('STRIPE'),
  stripeAccountId: z
    .string({ required_error: 'Stripe account ID is required' })
    .startsWith('acct_', 'Stripe account ID must start with "acct_"')
    .min(10, 'Invalid Stripe account ID'),
  email: z
    .string({ required_error: 'Stripe account email is required' })
    .email('Invalid Stripe account email')
    .toLowerCase(),
  accountHolderName: z
    .string({ required_error: 'Account holder name is required' })
    .min(2, 'Account holder name must be at least 2 characters')
    .max(100, 'Account holder name must not exceed 100 characters')
    .trim(),
});

export const accountDetailsSchema = z.discriminatedUnion('method', [
  bankAccountDetailsSchema,
  upiAccountDetailsSchema,
  payoneerAccountDetailsSchema,
  paypalAccountDetailsSchema,
  stripeAccountDetailsSchema,
]);

export type AccountDetails = z.infer<typeof accountDetailsSchema>;
export type BankAccountDetails = z.infer<typeof bankAccountDetailsSchema>;
export type UpiAccountDetails = z.infer<typeof upiAccountDetailsSchema>;
export type PayoneerAccountDetails = z.infer<typeof payoneerAccountDetailsSchema>;
export type PaypalAccountDetails = z.infer<typeof paypalAccountDetailsSchema>;
export type StripeAccountDetails = z.infer<typeof stripeAccountDetailsSchema>;

// ─── Withdrawal Schema ────────────────────────────────────────────────────────

export const withdrawalSchema = z
  .object({
    amount: amountField('Withdrawal amount'),
    currency: currencyField,
    payoutMethod: z.nativeEnum(PayoutMethod, {
      required_error: 'Payout method is required',
      invalid_type_error: `Payout method must be one of: ${Object.values(PayoutMethod).join(', ')}`,
    }),
    accountDetails: accountDetailsSchema,
    note: z
      .string()
      .max(300, 'Note must not exceed 300 characters')
      .trim()
      .optional(),
  })
  .refine(
    (data) => data.accountDetails.method === data.payoutMethod,
    {
      message: 'Account details method must match the selected payout method',
      path: ['accountDetails'],
    },
  );

export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

// ─── Dispute Schema ───────────────────────────────────────────────────────────

const disputeAttachmentSchema = z.object({
  url: urlField,
  name: z
    .string({ required_error: 'Attachment name is required' })
    .min(1, 'Attachment name must not be empty')
    .max(255, 'Attachment name must not exceed 255 characters')
    .trim(),
  size: z
    .number({ required_error: 'Attachment size is required' })
    .int('Size must be an integer')
    .positive('Size must be positive')
    .max(50 * 1024 * 1024, 'Attachment size must not exceed 50 MB'),
  mimeType: z
    .string({ required_error: 'MIME type is required' })
    .regex(
      /^[a-zA-Z]+\/[a-zA-Z0-9!#$&\-^_]+(\.[a-zA-Z0-9!#$&\-^_]+)*(\+[a-zA-Z0-9!#$&\-^_]+)*$/,
      'Invalid MIME type format',
    ),
});

export type DisputeAttachmentInput = z.infer<typeof disputeAttachmentSchema>;

export const disputeSchema = z.object({
  contractId: z
    .string({ required_error: 'Contract ID is required' })
    .cuid('Invalid contract ID'),
  milestoneId: z
    .string()
    .cuid('Invalid milestone ID')
    .optional(),
  reason: z.nativeEnum(DisputeReason, {
    required_error: 'Dispute reason is required',
    invalid_type_error: `Dispute reason must be one of: ${Object.values(DisputeReason).join(', ')}`,
  }),
  description: z
    .string({ required_error: 'Description is required' })
    .min(100, 'Description must be at least 100 characters')
    .max(5000, 'Description must not exceed 5000 characters')
    .trim(),
  attachments: z
    .array(disputeAttachmentSchema)
    .max(10, 'A maximum of 10 attachments are allowed')
    .optional()
    .default([]),
});

export type DisputeInput = z.infer<typeof disputeSchema>;

// ─── Admin: Resolve Dispute Schema ───────────────────────────────────────────

export const resolveDisputeSchema = z.object({
  disputeId: z
    .string({ required_error: 'Dispute ID is required' })
    .cuid('Invalid dispute ID'),
  resolution: z
    .string({ required_error: 'Resolution is required' })
    .min(50, 'Resolution must be at least 50 characters')
    .max(5000, 'Resolution must not exceed 5000 characters')
    .trim(),
  adminNote: z
    .string()
    .max(2000, 'Admin note must not exceed 2000 characters')
    .trim()
    .optional(),
  refundAmount: amountField('Refund amount')
    .optional(),
  refundCurrency: currencyField.optional(),
});

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

// ─── Admin: Assign Dispute Schema ─────────────────────────────────────────────

export const assignDisputeSchema = z.object({
  disputeId: z
    .string({ required_error: 'Dispute ID is required' })
    .cuid('Invalid dispute ID'),
  adminId: z
    .string({ required_error: 'Admin ID is required' })
    .cuid('Invalid admin ID'),
});

export type AssignDisputeInput = z.infer<typeof assignDisputeSchema>;

// ─── Transaction Filter Schema ────────────────────────────────────────────────

export const transactionFilterSchema = z.object({
  contractId: z.string().cuid('Invalid contract ID').optional(),
  milestoneId: z.string().cuid('Invalid milestone ID').optional(),
  payerId: z.string().cuid('Invalid payer ID').optional(),
  payeeId: z.string().cuid('Invalid payee ID').optional(),
  type: z.nativeEnum(TransactionType, { invalid_type_error: 'Invalid transaction type' }).optional(),
  currency: currencyField.optional(),
  minAmount: z.coerce
    .number()
    .positive('Minimum amount filter must be positive')
    .optional(),
  maxAmount: z.coerce
    .number()
    .positive('Maximum amount filter must be positive')
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must not exceed 100')
    .default(20),
  sort: z.enum(['createdAt', 'amount', 'netAmount']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  },
).refine(
  (data) => {
    if (data.minAmount !== undefined && data.maxAmount !== undefined) {
      return data.maxAmount >= data.minAmount;
    }
    return true;
  },
  {
    message: 'Maximum amount must be greater than or equal to minimum amount',
    path: ['maxAmount'],
  },
);

export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;

// ─── Escrow Release Schema ────────────────────────────────────────────────────

export const releaseEscrowSchema = z.object({
  milestoneId: z
    .string({ required_error: 'Milestone ID is required' })
    .cuid('Invalid milestone ID'),
  contractId: z
    .string({ required_error: 'Contract ID is required' })
    .cuid('Invalid contract ID'),
  note: z
    .string()
    .max(500, 'Note must not exceed 500 characters')
    .trim()
    .optional(),
});

export type ReleaseEscrowInput = z.infer<typeof releaseEscrowSchema>;

// ─── Refund Schema ────────────────────────────────────────────────────────────

export const requestRefundSchema = z.object({
  transactionId: z
    .string({ required_error: 'Transaction ID is required' })
    .cuid('Invalid transaction ID'),
  amount: amountField('Refund amount').optional(),
  reason: z
    .string({ required_error: 'Refund reason is required' })
    .min(20, 'Reason must be at least 20 characters')
    .max(1000, 'Reason must not exceed 1000 characters')
    .trim(),
});

export type RequestRefundInput = z.infer<typeof requestRefundSchema>;
