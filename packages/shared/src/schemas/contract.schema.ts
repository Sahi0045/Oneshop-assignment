import { z } from 'zod';
import { ContractStatus, MilestoneStatus } from '../types/contract.types';

// ─── Reusable field validators ────────────────────────────────────────────────

const currencyField = z
  .string({ required_error: 'Currency is required' })
  .length(3, 'Currency must be a 3-letter ISO code')
  .toUpperCase();

const futureDateField = z.coerce
  .date()
  .refine((date) => date > new Date(), {
    message: 'Date must be in the future',
  });

const attachmentUrlArray = z
  .array(z.string().url('Each attachment must be a valid URL'))
  .max(20, 'A maximum of 20 attachments are allowed')
  .default([]);

// ─── Contract Schemas ─────────────────────────────────────────────────────────

export const createContractSchema = z.object({
  bidId: z
    .string({ required_error: 'Bid ID is required' })
    .cuid('Invalid bid ID'),
  terms: z
    .string({ required_error: 'Contract terms are required' })
    .min(50, 'Terms must be at least 50 characters')
    .max(10_000, 'Terms must not exceed 10,000 characters')
    .trim(),
  startDate: z.coerce
    .date({ required_error: 'Start date is required' })
    .refine((date) => date >= new Date(Date.now() - 60_000), {
      message: 'Start date cannot be in the past',
    }),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = z
  .object({
    terms: z
      .string()
      .min(50, 'Terms must be at least 50 characters')
      .max(10_000, 'Terms must not exceed 10,000 characters')
      .trim()
      .optional(),
    endDate: z.coerce
      .date()
      .optional(),
    status: z
      .nativeEnum(ContractStatus, {
        invalid_type_error: 'Invalid contract status',
      })
      .optional(),
  });

export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const contractIdSchema = z.object({
  contractId: z
    .string({ required_error: 'Contract ID is required' })
    .cuid('Invalid contract ID'),
});

export type ContractIdParam = z.infer<typeof contractIdSchema>;

// ─── Milestone Schemas ────────────────────────────────────────────────────────

export const createContractMilestoneSchema = z.object({
  contractId: z
    .string({ required_error: 'Contract ID is required' })
    .cuid('Invalid contract ID'),
  title: z
    .string({ required_error: 'Milestone title is required' })
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must not exceed 200 characters')
    .trim(),
  description: z
    .string({ required_error: 'Milestone description is required' })
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must not exceed 2,000 characters')
    .trim(),
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than 0')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  currency: currencyField,
  dueDate: futureDateField.optional(),
  order: z
    .number({ required_error: 'Order is required' })
    .int('Order must be an integer')
    .min(1, 'Order must be at least 1'),
});

export type CreateContractMilestoneInput = z.infer<typeof createContractMilestoneSchema>;

export const updateContractMilestoneSchema = createContractMilestoneSchema
  .omit({ contractId: true })
  .partial();

export type UpdateContractMilestoneInput = z.infer<typeof updateContractMilestoneSchema>;

export const milestoneIdSchema = z.object({
  milestoneId: z
    .string({ required_error: 'Milestone ID is required' })
    .cuid('Invalid milestone ID'),
});

export type MilestoneIdParam = z.infer<typeof milestoneIdSchema>;

// ─── Milestone Action Schemas ─────────────────────────────────────────────────

export const submitMilestoneSchema = z.object({
  milestoneId: z
    .string({ required_error: 'Milestone ID is required' })
    .cuid('Invalid milestone ID'),
  submissionNote: z
    .string({ required_error: 'Submission note is required' })
    .min(20, 'Submission note must be at least 20 characters')
    .max(3000, 'Submission note must not exceed 3,000 characters')
    .trim(),
  attachments: attachmentUrlArray.optional(),
});

export type SubmitMilestoneInput = z.infer<typeof submitMilestoneSchema>;

export const approveMilestoneSchema = z.object({
  milestoneId: z
    .string({ required_error: 'Milestone ID is required' })
    .cuid('Invalid milestone ID'),
  reviewNote: z
    .string()
    .max(2000, 'Review note must not exceed 2,000 characters')
    .trim()
    .optional(),
});

export type ApproveMilestoneInput = z.infer<typeof approveMilestoneSchema>;

export const requestRevisionSchema = z.object({
  milestoneId: z
    .string({ required_error: 'Milestone ID is required' })
    .cuid('Invalid milestone ID'),
  revisionNote: z
    .string({ required_error: 'Revision note is required' })
    .min(20, 'Revision note must be at least 20 characters')
    .max(3000, 'Revision note must not exceed 3,000 characters')
    .trim(),
});

export type RequestRevisionInput = z.infer<typeof requestRevisionSchema>;

export const disputeMilestoneSchema = z.object({
  milestoneId: z
    .string({ required_error: 'Milestone ID is required' })
    .cuid('Invalid milestone ID'),
  reason: z
    .string({ required_error: 'Dispute reason is required' })
    .min(20, 'Reason must be at least 20 characters')
    .max(3000, 'Reason must not exceed 3,000 characters')
    .trim(),
  attachments: attachmentUrlArray.optional(),
});

export type DisputeMilestoneInput = z.infer<typeof disputeMilestoneSchema>;

// ─── Contract Filter Schema ───────────────────────────────────────────────────

export const filterContractSchema = z.object({
  clientId: z.string().cuid('Invalid client ID').optional(),
  freelancerId: z.string().cuid('Invalid freelancer ID').optional(),
  projectId: z.string().cuid('Invalid project ID').optional(),
  status: z
    .nativeEnum(ContractStatus, { invalid_type_error: 'Invalid contract status' })
    .optional(),
  startDateFrom: z.coerce.date().optional(),
  startDateTo: z.coerce.date().optional(),
  endDateFrom: z.coerce.date().optional(),
  endDateTo: z.coerce.date().optional(),
  currency: currencyField.optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
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
    .enum(['createdAt', 'startDate', 'endDate', 'amount'], {
      invalid_type_error: 'Invalid sort field',
    })
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type FilterContractInput = z.infer<typeof filterContractSchema>;

// ─── Milestone Filter Schema ──────────────────────────────────────────────────

export const filterMilestoneSchema = z.object({
  contractId: z.string().cuid('Invalid contract ID').optional(),
  status: z
    .nativeEnum(MilestoneStatus, { invalid_type_error: 'Invalid milestone status' })
    .optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
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
    .enum(['createdAt', 'dueDate', 'amount', 'order'], {
      invalid_type_error: 'Invalid sort field',
    })
    .default('order'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type FilterMilestoneInput = z.infer<typeof filterMilestoneSchema>;

// ─── Contract Status Transition Schema ───────────────────────────────────────

/**
 * Valid status transitions:
 * ACTIVE  → COMPLETED | CANCELLED | PAUSED | DISPUTED
 * PAUSED  → ACTIVE | CANCELLED
 * DISPUTED → ACTIVE | CANCELLED | COMPLETED
 */
const VALID_CONTRACT_TRANSITIONS: Partial<Record<ContractStatus, ContractStatus[]>> = {
  [ContractStatus.ACTIVE]: [
    ContractStatus.COMPLETED,
    ContractStatus.CANCELLED,
    ContractStatus.PAUSED,
    ContractStatus.DISPUTED,
  ],
  [ContractStatus.PAUSED]: [ContractStatus.ACTIVE, ContractStatus.CANCELLED],
  [ContractStatus.DISPUTED]: [
    ContractStatus.ACTIVE,
    ContractStatus.CANCELLED,
    ContractStatus.COMPLETED,
  ],
};

export const changeContractStatusSchema = z
  .object({
    contractId: z
      .string({ required_error: 'Contract ID is required' })
      .cuid('Invalid contract ID'),
    currentStatus: z.nativeEnum(ContractStatus, {
      required_error: 'Current status is required',
      invalid_type_error: 'Invalid current contract status',
    }),
    newStatus: z.nativeEnum(ContractStatus, {
      required_error: 'New status is required',
      invalid_type_error: 'Invalid new contract status',
    }),
    reason: z
      .string()
      .min(10, 'Reason must be at least 10 characters')
      .max(500, 'Reason must not exceed 500 characters')
      .trim()
      .optional(),
  })
  .refine(
    (data) => {
      const allowed = VALID_CONTRACT_TRANSITIONS[data.currentStatus];
      return allowed !== undefined && allowed.includes(data.newStatus);
    },
    (data) => ({
      message: `Cannot transition contract from ${data.currentStatus} to ${data.newStatus}`,
      path: ['newStatus'],
    }),
  );

export type ChangeContractStatusInput = z.infer<typeof changeContractStatusSchema>;

// ─── Batch Milestone Update Schema ────────────────────────────────────────────

export const reorderMilestonesSchema = z.object({
  contractId: z
    .string({ required_error: 'Contract ID is required' })
    .cuid('Invalid contract ID'),
  milestones: z
    .array(
      z.object({
        id: z.string().cuid('Invalid milestone ID'),
        order: z.number().int().min(1, 'Order must be at least 1'),
      }),
    )
    .min(2, 'At least 2 milestones are required to reorder')
    .max(20, 'Cannot reorder more than 20 milestones at once')
    .refine(
      (items) => {
        const orders = items.map((m) => m.order);
        return new Set(orders).size === orders.length;
      },
      { message: 'Milestone order values must be unique' },
    )
    .refine(
      (items) => {
        const ids = items.map((m) => m.id);
        return new Set(ids).size === ids.length;
      },
      { message: 'Milestone IDs must be unique' },
    ),
});

export type ReorderMilestonesInput = z.infer<typeof reorderMilestonesSchema>;
