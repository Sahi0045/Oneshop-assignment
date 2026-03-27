import { z } from "zod";
import {
  ProjectType,
  ProjectVisibility,
  ProjectStatus,
  ProjectSortField,
} from "../types/project.types";

// ─── Milestone Schema ────────────────────────────────────────────────────────

export const createMilestoneSchema = z.object({
  title: z
    .string({ required_error: "Milestone title is required" })
    .min(3, "Milestone title must be at least 3 characters")
    .max(200, "Milestone title must not exceed 200 characters")
    .trim(),
  description: z
    .string({ required_error: "Milestone description is required" })
    .min(10, "Milestone description must be at least 10 characters")
    .max(1000, "Milestone description must not exceed 1000 characters")
    .trim(),
  amount: z
    .number({ required_error: "Milestone amount is required" })
    .positive("Milestone amount must be a positive number")
    .multipleOf(0.01, "Milestone amount must have at most 2 decimal places"),
  currency: z
    .string({ required_error: "Currency is required" })
    .length(3, "Currency must be a 3-letter ISO code")
    .toUpperCase(),
  dueDate: z.coerce
    .date()
    .refine((date) => date > new Date(), {
      message: "Milestone due date must be in the future",
    })
    .optional(),
  order: z
    .number({ required_error: "Milestone order is required" })
    .int("Milestone order must be an integer")
    .min(1, "Milestone order must be at least 1"),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = createMilestoneSchema.partial();

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

// ─── Project Schemas ─────────────────────────────────────────────────────────

/**
 * Raw object shape — no refinements yet, so derived schemas can call
 * .omit() / .partial() / .extend() before adding their own refinements.
 */
const projectBaseObject = z.object({
  title: z
    .string({ required_error: "Project title is required" })
    .min(10, "Title must be at least 10 characters")
    .max(200, "Title must not exceed 200 characters")
    .trim(),
  description: z
    .string({ required_error: "Project description is required" })
    .min(50, "Description must be at least 50 characters")
    .max(5000, "Description must not exceed 5000 characters")
    .trim(),
  type: z.nativeEnum(ProjectType, {
    required_error: "Project type is required",
    invalid_type_error: "Invalid project type",
  }),
  budgetMin: z
    .number({ required_error: "Minimum budget is required" })
    .positive("Minimum budget must be a positive number")
    .multipleOf(0.01, "Minimum budget must have at most 2 decimal places"),
  budgetMax: z
    .number({ required_error: "Maximum budget is required" })
    .positive("Maximum budget must be a positive number")
    .multipleOf(0.01, "Maximum budget must have at most 2 decimal places"),
  currency: z
    .string({ required_error: "Currency is required" })
    .length(3, "Currency must be a 3-letter ISO code")
    .toUpperCase()
    .default("USD"),
  deadline: z.coerce
    .date()
    .refine((date) => date > new Date(), {
      message: "Deadline must be a future date",
    })
    .optional(),
  skills: z
    .array(
      z
        .string()
        .min(1, "Skill name must not be empty")
        .max(50, "Skill name must not exceed 50 characters")
        .trim(),
      { required_error: "At least one skill is required" },
    )
    .min(1, "At least one skill is required")
    .max(15, "A maximum of 15 skills can be specified"),
  categoryId: z.string().cuid("Invalid category ID").optional(),
  visibility: z
    .nativeEnum(ProjectVisibility, {
      required_error: "Visibility is required",
      invalid_type_error: "Invalid visibility value",
    })
    .default(ProjectVisibility.PUBLIC),
  attachments: z
    .array(z.string().url("Each attachment must be a valid URL"))
    .max(10, "A maximum of 10 attachments are allowed")
    .default([]),
  milestones: z
    .array(createMilestoneSchema)
    .max(20, "A maximum of 20 milestones are allowed")
    .optional(),
});

export const createProjectSchema = projectBaseObject
  .refine((data) => data.budgetMax >= data.budgetMin, {
    message: "Maximum budget must be greater than or equal to minimum budget",
    path: ["budgetMax"],
  })
  .refine(
    (data) => {
      if (data.milestones && data.milestones.length > 0) {
        const totalMilestoneAmount = data.milestones.reduce(
          (sum, m) => sum + m.amount,
          0,
        );
        return totalMilestoneAmount <= data.budgetMax;
      }
      return true;
    },
    {
      message: "Total milestone amounts must not exceed the maximum budget",
      path: ["milestones"],
    },
  )
  .refine(
    (data) => {
      if (data.milestones && data.milestones.length > 0) {
        const orders = data.milestones.map((m) => m.order);
        const uniqueOrders = new Set(orders);
        return uniqueOrders.size === orders.length;
      }
      return true;
    },
    {
      message: "Milestone order values must be unique",
      path: ["milestones"],
    },
  );

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Update schema: built from the raw base object (before refinements)
 * so that .omit() and .partial() are available, then extended with an
 * optional status field and its own cross-field refinement.
 */
export const updateProjectSchema = projectBaseObject
  .omit({ milestones: true })
  .partial()
  .extend({
    status: z
      .nativeEnum(ProjectStatus, {
        invalid_type_error: "Invalid project status",
      })
      .optional(),
    milestones: z
      .array(createMilestoneSchema)
      .max(20, "A maximum of 20 milestones are allowed")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.budgetMin !== undefined && data.budgetMax !== undefined) {
        return data.budgetMax >= data.budgetMin;
      }
      return true;
    },
    {
      message: "Maximum budget must be greater than or equal to minimum budget",
      path: ["budgetMax"],
    },
  );

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ─── Project Filter / Search Schema ──────────────────────────────────────────

export const filterProjectSchema = z.object({
  search: z
    .string()
    .max(200, "Search query must not exceed 200 characters")
    .trim()
    .optional(),
  type: z
    .nativeEnum(ProjectType, { invalid_type_error: "Invalid project type" })
    .optional(),
  status: z
    .nativeEnum(ProjectStatus, { invalid_type_error: "Invalid project status" })
    .optional(),
  budgetMin: z.coerce
    .number()
    .positive("Minimum budget filter must be positive")
    .optional(),
  budgetMax: z.coerce
    .number()
    .positive("Maximum budget filter must be positive")
    .optional(),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code")
    .toUpperCase()
    .optional(),
  skills: z
    .union([
      z.array(z.string().trim()),
      z.string().transform((val) =>
        val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ])
    .optional(),
  categoryId: z.string().cuid("Invalid category ID").optional(),
  country: z.string().max(100).trim().optional(),
  clientId: z.string().cuid("Invalid client ID").optional(),
  visibility: z
    .nativeEnum(ProjectVisibility, {
      invalid_type_error: "Invalid visibility value",
    })
    .optional(),
  page: z.coerce
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .default(1),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must not exceed 100")
    .default(20),
  sort: z
    .nativeEnum(ProjectSortField, {
      invalid_type_error: "Invalid sort field",
    })
    .default(ProjectSortField.CREATED_AT),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type FilterProjectInput = z.infer<typeof filterProjectSchema>;

// ─── Project ID Param Schema ─────────────────────────────────────────────────

export const projectIdSchema = z.object({
  projectId: z.string().cuid("Invalid project ID"),
});

export type ProjectIdParam = z.infer<typeof projectIdSchema>;

// ─── Change Project Status Schema ────────────────────────────────────────────

export const changeProjectStatusSchema = z.object({
  projectId: z.string().cuid("Invalid project ID"),
  status: z.nativeEnum(ProjectStatus, {
    required_error: "Status is required",
    invalid_type_error: "Invalid project status",
  }),
  reason: z
    .string()
    .max(500, "Reason must not exceed 500 characters")
    .trim()
    .optional(),
});

export type ChangeProjectStatusInput = z.infer<
  typeof changeProjectStatusSchema
>;
