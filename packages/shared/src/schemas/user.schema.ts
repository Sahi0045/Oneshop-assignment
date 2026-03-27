import { z } from 'zod';
import { UserRole } from '../types/user.types';

// ─── Reusable field validators ────────────────────────────────────────────────

const emailField = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Please provide a valid email address');

const passwordField = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'Password must contain at least one number',
  })
  .refine((val) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val), {
    message: 'Password must contain at least one special character',
  });

const firstNameField = z
  .string({ required_error: 'First name is required' })
  .trim()
  .min(2, 'First name must be at least 2 characters')
  .max(50, 'First name must be at most 50 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes');

const lastNameField = z
  .string({ required_error: 'Last name is required' })
  .trim()
  .min(2, 'Last name must be at least 2 characters')
  .max(50, 'Last name must be at most 50 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes');

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  firstName: firstNameField,
  lastName: lastNameField,
  role: z.nativeEnum(UserRole, {
    required_error: 'Role is required',
    invalid_type_error: 'Role must be CLIENT or FREELANCER',
  }).refine(
    (role) => role !== UserRole.ADMIN,
    { message: 'Cannot register as admin' }
  ),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z
      .string({ required_error: 'Reset token is required' })
      .min(1, 'Reset token is required'),
    newPassword: passwordField,
    confirmPassword: z
      .string({ required_error: 'Please confirm your password' })
      .min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'Current password is required' })
      .min(1, 'Current password is required'),
    newPassword: passwordField,
    confirmPassword: z
      .string({ required_error: 'Please confirm your new password' })
      .min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z
    .string({ required_error: 'Verification token is required' })
    .min(1, 'Verification token is required'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// ─── Profile Schemas ──────────────────────────────────────────────────────────

const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD', 'AED', 'JPY', 'BRL',
] as const;

export const updateProfileSchema = z.object({
  firstName: firstNameField.optional(),
  lastName: lastNameField.optional(),
  bio: z
    .string()
    .trim()
    .max(500, 'Bio must be at most 500 characters')
    .optional()
    .nullable(),
  avatar: z
    .string()
    .url('Avatar must be a valid URL')
    .max(2048, 'URL is too long')
    .optional()
    .nullable(),
  coverImage: z
    .string()
    .url('Cover image must be a valid URL')
    .max(2048, 'URL is too long')
    .optional()
    .nullable(),
  hourlyRate: z
    .number({
      invalid_type_error: 'Hourly rate must be a number',
    })
    .positive('Hourly rate must be greater than 0')
    .max(10_000, 'Hourly rate cannot exceed 10,000')
    .optional()
    .nullable(),
  currency: z
    .enum(SUPPORTED_CURRENCIES, {
      errorMap: () => ({
        message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
      }),
    })
    .optional(),
  country: z
    .string()
    .trim()
    .min(2, 'Country must be at least 2 characters')
    .max(100, 'Country must be at most 100 characters')
    .optional()
    .nullable(),
  city: z
    .string()
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be at most 100 characters')
    .optional()
    .nullable(),
  timezone: z
    .string()
    .trim()
    .max(100, 'Timezone must be at most 100 characters')
    .optional()
    .nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Skill Schemas ────────────────────────────────────────────────────────────

import { SkillLevel } from '../types/user.types';

export const addUserSkillSchema = z.object({
  skillId: z
    .string({ required_error: 'Skill ID is required' })
    .cuid('Invalid skill ID'),
  level: z.nativeEnum(SkillLevel, {
    required_error: 'Skill level is required',
    invalid_type_error: `Skill level must be one of: ${Object.values(SkillLevel).join(', ')}`,
  }),
});

export type AddUserSkillInput = z.infer<typeof addUserSkillSchema>;

export const updateUserSkillSchema = z.object({
  level: z.nativeEnum(SkillLevel, {
    required_error: 'Skill level is required',
    invalid_type_error: `Skill level must be one of: ${Object.values(SkillLevel).join(', ')}`,
  }),
});

export type UpdateUserSkillInput = z.infer<typeof updateUserSkillSchema>;

export const bulkAddUserSkillsSchema = z.object({
  skills: z
    .array(addUserSkillSchema)
    .min(1, 'At least one skill is required')
    .max(30, 'Cannot add more than 30 skills at once'),
});

export type BulkAddUserSkillsInput = z.infer<typeof bulkAddUserSkillsSchema>;

// ─── Admin Schemas ────────────────────────────────────────────────────────────

export const adminUpdateUserSchema = z.object({
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export const createSkillSchema = z.object({
  name: z
    .string({ required_error: 'Skill name is required' })
    .trim()
    .min(2, 'Skill name must be at least 2 characters')
    .max(100, 'Skill name must be at most 100 characters'),
  category: z
    .string({ required_error: 'Category is required' })
    .trim()
    .min(2, 'Category must be at least 2 characters')
    .max(100, 'Category must be at most 100 characters'),
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;

// ─── Query / Filter Schemas ───────────────────────────────────────────────────

export const userFilterSchema = z.object({
  search: z.string().trim().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isVerified: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  country: z.string().trim().optional(),
  city: z.string().trim().optional(),
  minHourlyRate: z.coerce.number().positive().optional(),
  maxHourlyRate: z.coerce.number().positive().optional(),
  skills: z
    .union([z.array(z.string()), z.string().transform((v) => [v])])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['createdAt', 'updatedAt', 'firstName', 'lastName', 'hourlyRate', 'completionRate'])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type UserFilterInput = z.infer<typeof userFilterSchema>;

// ─── OAuth Schemas ────────────────────────────────────────────────────────────

export const oauthCallbackSchema = z.object({
  code: z.string({ required_error: 'Authorization code is required' }).min(1),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;
