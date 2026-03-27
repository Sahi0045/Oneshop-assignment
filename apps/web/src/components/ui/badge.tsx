import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ─── Variant definitions ──────────────────────────────────────────────────────

const badgeVariants = cva(
  // Base styles shared by all variants
  [
    'inline-flex items-center justify-center gap-1',
    'rounded-full border px-2.5 py-0.5',
    'text-xs font-semibold',
    'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'select-none whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        // ── shadcn/ui standard variants ──────────────────────────────────
        default: [
          'border-transparent bg-primary text-primary-foreground',
          'hover:bg-primary/80',
        ],
        secondary: [
          'border-transparent bg-secondary text-secondary-foreground',
          'hover:bg-secondary/80',
        ],
        destructive: [
          'border-transparent bg-destructive text-destructive-foreground',
          'hover:bg-destructive/80',
        ],
        outline: [
          'border-border text-foreground bg-transparent',
          'hover:bg-accent hover:text-accent-foreground',
        ],

        // ── Project / Bid status variants ─────────────────────────────────
        open: [
          'border-transparent',
          'bg-green-100 text-green-800',
          'dark:bg-green-900/30 dark:text-green-400',
          'hover:bg-green-200 dark:hover:bg-green-900/50',
        ],
        in_progress: [
          'border-transparent',
          'bg-blue-100 text-blue-800',
          'dark:bg-blue-900/30 dark:text-blue-400',
          'hover:bg-blue-200 dark:hover:bg-blue-900/50',
        ],
        completed: [
          'border-transparent',
          'bg-purple-100 text-purple-800',
          'dark:bg-purple-900/30 dark:text-purple-400',
          'hover:bg-purple-200 dark:hover:bg-purple-900/50',
        ],
        cancelled: [
          'border-transparent',
          'bg-red-100 text-red-800',
          'dark:bg-red-900/30 dark:text-red-400',
          'hover:bg-red-200 dark:hover:bg-red-900/50',
        ],
        disputed: [
          'border-transparent',
          'bg-orange-100 text-orange-800',
          'dark:bg-orange-900/30 dark:text-orange-400',
          'hover:bg-orange-200 dark:hover:bg-orange-900/50',
        ],
        draft: [
          'border-transparent',
          'bg-gray-100 text-gray-700',
          'dark:bg-gray-800 dark:text-gray-400',
          'hover:bg-gray-200 dark:hover:bg-gray-700',
        ],
        pending: [
          'border-transparent',
          'bg-yellow-100 text-yellow-800',
          'dark:bg-yellow-900/30 dark:text-yellow-400',
          'hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
        ],
        accepted: [
          'border-transparent',
          'bg-green-100 text-green-800',
          'dark:bg-green-900/30 dark:text-green-400',
          'hover:bg-green-200 dark:hover:bg-green-900/50',
        ],
        rejected: [
          'border-transparent',
          'bg-red-100 text-red-800',
          'dark:bg-red-900/30 dark:text-red-400',
          'hover:bg-red-200 dark:hover:bg-red-900/50',
        ],
        withdrawn: [
          'border-transparent',
          'bg-gray-100 text-gray-600',
          'dark:bg-gray-800 dark:text-gray-400',
          'hover:bg-gray-200 dark:hover:bg-gray-700',
        ],
        active: [
          'border-transparent',
          'bg-blue-100 text-blue-800',
          'dark:bg-blue-900/30 dark:text-blue-400',
          'hover:bg-blue-200 dark:hover:bg-blue-900/50',
        ],
        paused: [
          'border-transparent',
          'bg-gray-100 text-gray-700',
          'dark:bg-gray-800 dark:text-gray-400',
          'hover:bg-gray-200 dark:hover:bg-gray-700',
        ],
        submitted: [
          'border-transparent',
          'bg-yellow-100 text-yellow-800',
          'dark:bg-yellow-900/30 dark:text-yellow-400',
          'hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
        ],
        approved: [
          'border-transparent',
          'bg-green-100 text-green-800',
          'dark:bg-green-900/30 dark:text-green-400',
          'hover:bg-green-200 dark:hover:bg-green-900/50',
        ],
        revision_requested: [
          'border-transparent',
          'bg-orange-100 text-orange-800',
          'dark:bg-orange-900/30 dark:text-orange-400',
          'hover:bg-orange-200 dark:hover:bg-orange-900/50',
        ],

        // ── Project type variants ──────────────────────────────────────────
        fixed: [
          'border-blue-200 bg-blue-50 text-blue-700',
          'dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        ],
        hourly: [
          'border-violet-200 bg-violet-50 text-violet-700',
          'dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-400',
        ],
        contest: [
          'border-amber-200 bg-amber-50 text-amber-700',
          'dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
        ],

        // ── Skill / tag variant ────────────────────────────────────────────
        skill: [
          'border-transparent bg-primary/10 text-primary',
          'hover:bg-primary/20',
          'dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30',
        ],

        // ── Role badge variant ─────────────────────────────────────────────
        client: [
          'border-transparent bg-teal-100 text-teal-800',
          'dark:bg-teal-900/30 dark:text-teal-400',
        ],
        freelancer: [
          'border-transparent bg-indigo-100 text-indigo-800',
          'dark:bg-indigo-900/30 dark:text-indigo-400',
        ],
        admin: [
          'border-transparent bg-rose-100 text-rose-800',
          'dark:bg-rose-900/30 dark:text-rose-400',
        ],

        // ── Verification variant ───────────────────────────────────────────
        verified: [
          'border-transparent bg-emerald-100 text-emerald-700',
          'dark:bg-emerald-900/30 dark:text-emerald-400',
        ],
        unverified: [
          'border-gray-200 bg-gray-50 text-gray-500',
          'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500',
        ],

        // ── Info / neutral info ────────────────────────────────────────────
        info: [
          'border-transparent bg-sky-100 text-sky-800',
          'dark:bg-sky-900/30 dark:text-sky-400',
        ],
        success: [
          'border-transparent bg-green-100 text-green-800',
          'dark:bg-green-900/30 dark:text-green-400',
        ],
        warning: [
          'border-transparent bg-yellow-100 text-yellow-800',
          'dark:bg-yellow-900/30 dark:text-yellow-400',
        ],
        error: [
          'border-transparent bg-red-100 text-red-800',
          'dark:bg-red-900/30 dark:text-red-400',
        ],
      },

      size: {
        sm: 'px-1.5 py-0 text-[10px]',
        default: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

// ─── Component ────────────────────────────────────────────────────────────────

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** When true, renders a small dot indicator before the text. */
  dot?: boolean;
  /** Icon element rendered before the text (and dot, if present). */
  icon?: React.ReactNode;
}

function Badge({
  className,
  variant,
  size,
  dot,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className="block h-1.5 w-1.5 rounded-full bg-current opacity-75 shrink-0"
          aria-hidden="true"
        />
      )}
      {icon && (
        <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </div>
  );
}

// ─── Status-aware convenience component ──────────────────────────────────────

/**
 * Automatically maps a status string to the correct Badge variant.
 *
 * Supports: project statuses, bid statuses, contract statuses,
 * milestone statuses, user roles, verification statuses.
 *
 * @example
 * ```tsx
 * <StatusBadge status="OPEN" />
 * <StatusBadge status="FREELANCER" />
 * <StatusBadge status="APPROVED" dot />
 * ```
 */

type StatusString =
  | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'DRAFT'
  | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'
  | 'ACTIVE' | 'PAUSED'
  | 'SUBMITTED' | 'APPROVED' | 'REVISION_REQUESTED'
  | 'FIXED_PRICE' | 'HOURLY' | 'CONTEST'
  | 'CLIENT' | 'FREELANCER' | 'ADMIN'
  | 'VERIFIED' | 'UNVERIFIED'
  | string; // catch-all for unknown statuses

const STATUS_VARIANT_MAP: Record<
  string,
  VariantProps<typeof badgeVariants>['variant']
> = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
  DRAFT: 'draft',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  ACTIVE: 'active',
  PAUSED: 'paused',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REVISION_REQUESTED: 'revision_requested',
  // Project types
  FIXED_PRICE: 'fixed',
  FIXED: 'fixed',
  HOURLY: 'hourly',
  CONTEST: 'contest',
  // Roles
  CLIENT: 'client',
  FREELANCER: 'freelancer',
  ADMIN: 'admin',
  // Verification
  VERIFIED: 'verified',
  UNVERIFIED: 'unverified',
};

/** Human-readable labels for each status string. */
const STATUS_LABEL_MAP: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
  DRAFT: 'Draft',
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REVISION_REQUESTED: 'Revision Requested',
  FIXED_PRICE: 'Fixed Price',
  FIXED: 'Fixed Price',
  HOURLY: 'Hourly',
  CONTEST: 'Contest',
  CLIENT: 'Client',
  FREELANCER: 'Freelancer',
  ADMIN: 'Admin',
  VERIFIED: 'Verified',
  UNVERIFIED: 'Unverified',
};

export interface StatusBadgeProps
  extends Omit<BadgeProps, 'variant' | 'children'> {
  status: StatusString;
  /** Override the auto-derived label. */
  label?: string;
}

function StatusBadge({ status, label, ...props }: StatusBadgeProps) {
  const upper = status?.toUpperCase() ?? '';
  const variant: VariantProps<typeof badgeVariants>['variant'] =
    STATUS_VARIANT_MAP[upper] ?? 'draft';
  const displayLabel = label ?? STATUS_LABEL_MAP[upper] ?? status;

  return (
    <Badge variant={variant} {...props}>
      {displayLabel}
    </Badge>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Badge, StatusBadge, badgeVariants };
