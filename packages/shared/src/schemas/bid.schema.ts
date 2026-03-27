import { z } from 'zod';
import { BidStatus, BidSortField } from '../types/project.types';

// ─── Reusable field validators ────────────────────────────────────────────────

const currencyField = z
  .string({ required_error: 'Currency is required' })
  .length(3, 'Currency must be a 3-letter ISO code')
  .toUpperCase();

const attachmentsField = z
  .array(
    z.string().url('Each attachment must be a valid URL').max(2048, 'URL is too long'),
  )
  .max(10, 'A maximum of 10 attachments are allowed')
  .default([]);

// ─── Create Bid Schema ────────────────────────────────────────────────────────

export const createBidSchema = z.object({
  projectId: z
    .string({ required_error: 'Project ID is required' })
    .cuid('Invalid project ID'),

  amount: z
    .number({ required_error: 'Bid amount is required', invalid_type_error: 'Bid amount must be a number' })
    .positive('Bid amount must be greater than 0')
    .max(1_000_000, 'Bid amount cannot exceed 1,000,000')
    .multipleOf(0.01, 'Bid amount must have at most 2 decimal places'),

  currency: currencyField,

  deliveryDays: z
    .number({
      required_error: 'Delivery days is required',
      invalid_type_error: 'Delivery days must be a number',
    })
    .int('Delivery days must be a whole number')
    .positive('Delivery days must be at least 1')
    .max(365, 'Delivery days cannot exceed 365'),

  coverLetter: z
    .string({ required_error: 'Cover letter is required' })
    .trim()
    .min(100, 'Cover letter must be at least 100 characters')
    .max(3000, 'Cover letter must not exceed 3000 characters'),

  attachments: attachmentsField.optional(),
});

export type CreateBidInput = z.infer<typeof createBidSchema>;

// ─── Update Bid Schema ────────────────────────────────────────────────────────

export const updateBidSchema = createBidSchema
  .omit({ projectId: true })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided to update' },
  );

export type UpdateBidInput = z.infer<typeof updateBidSchema>;

// ─── Bid Action Schema ────────────────────────────────────────────────────────

export const bidActionSchema = z.object({
  bidId: z
    .string({ required_error: 'Bid ID is required' })
    .cuid('Invalid bid ID'),

  action: z
    .enum([BidStatus.ACCEPTED, BidStatus.REJECTED], {
      required_error: 'Action is required',
      invalid_type_error: `Action must be one of: ${BidStatus.ACCEPTED}, ${BidStatus.REJECTED}`,
    }),

  reason: z
    .string()
    .trim()
    .max(500, 'Reason must not exceed 500 characters')
    .optional(),
});

export type BidActionInput = z.infer<typeof bidActionSchema>;

// ─── Withdraw Bid Schema ──────────────────────────────────────────────────────

export const withdrawBidSchema = z.object({
  bidId: z
    .string({ required_error: 'Bid ID is required' })
    .cuid('Invalid bid ID'),

  reason: z
    .string()
    .trim()
    .max(500, 'Reason must not exceed 500 characters')
    .optional(),
});

export type WithdrawBidInput = z.infer<typeof withdrawBidSchema>;

// ─── Bid ID Param Schema ──────────────────────────────────────────────────────

export const bidIdSchema = z.object({
  bidId: z.string().cuid('Invalid bid ID'),
});

export type BidIdParam = z.infer<typeof bidIdSchema>;

// ─── Bid Filter Schema ────────────────────────────────────────────────────────

export const filterBidSchema = z.object({
  projectId: z.string().cuid('Invalid project ID').optional(),

  freelancerId: z.string().cuid('Invalid freelancer ID').optional(),

  status: z
    .nativeEnum(BidStatus, { invalid_type_error: 'Invalid bid status' })
    .optional(),

  minAmount: z.coerce
    .number()
    .positive('Minimum amount must be positive')
    .optional(),

  maxAmount: z.coerce
    .number()
    .positive('Maximum amount must be positive')
    .optional(),

  currency: currencyField.optional(),

  maxDeliveryDays: z.coerce
    .number()
    .int('Delivery days must be a whole number')
    .positive('Max delivery days must be positive')
    .max(365, 'Max delivery days cannot exceed 365')
    .optional(),

  isRead: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),

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

  sort: z
    .nativeEnum(BidSortField, { invalid_type_error: 'Invalid sort field' })
    .default(BidSortField.CREATED_AT),

  order: z.enum(['asc', 'desc']).default('desc'),
});

export type FilterBidInput = z.infer<typeof filterBidSchema>;

// ─── Mark Bid As Read Schema ──────────────────────────────────────────────────

export const markBidReadSchema = z.object({
  bidIds: z
    .array(z.string().cuid('Invalid bid ID'))
    .min(1, 'At least one bid ID is required')
    .max(50, 'Cannot mark more than 50 bids as read at once'),
});

export type MarkBidReadInput = z.infer<typeof markBidReadSchema>;

// ─── Bid Comparison Schema ────────────────────────────────────────────────────

export const compareBidsSchema = z.object({
  projectId: z
    .string({ required_error: 'Project ID is required' })
    .cuid('Invalid project ID'),

  bidIds: z
    .array(z.string().cuid('Invalid bid ID'))
    .min(2, 'At least 2 bid IDs are required for comparison')
    .max(5, 'Cannot compare more than 5 bids at once'),
});

export type CompareBidsInput = z.infer<typeof compareBidsSchema>;
