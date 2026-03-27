'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ─── Variants ─────────────────────────────────────────────────────────────────

const progressVariants = cva(
  'relative w-full overflow-hidden rounded-full bg-secondary',
  {
    variants: {
      size: {
        xs: 'h-1',
        sm: 'h-1.5',
        default: 'h-2.5',
        md: 'h-3',
        lg: 'h-4',
        xl: 'h-5',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

const progressIndicatorVariants = cva(
  'h-full w-full flex-1 transition-all duration-500 ease-in-out rounded-full',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        destructive: 'bg-destructive',
        info: 'bg-blue-500',
        gradient:
          'bg-gradient-to-r from-primary to-purple-500',
        striped: [
          'bg-primary',
          'bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.15)_10px,rgba(255,255,255,0.15)_20px)]',
        ],
        animated: [
          'bg-primary',
          'bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.15)_10px,rgba(255,255,255,0.15)_20px)]',
          'animate-[progress-stripes_1s_linear_infinite]',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof progressIndicatorVariants> {
  /**
   * The progress value (0–100).
   * Pass `null` or `undefined` to show an indeterminate state.
   */
  value?: number | null;
  /** Show a label displaying the percentage to the right of the bar. */
  showLabel?: boolean;
  /** Custom label renderer. Receives the current value (0-100). */
  renderLabel?: (value: number) => React.ReactNode;
  /** Label position: 'right' (default) or 'top'. */
  labelPosition?: 'right' | 'top' | 'inside';
  /** Accessible label for screen-readers (e.g., "Upload progress"). */
  'aria-label'?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    {
      className,
      value,
      size,
      variant,
      showLabel = false,
      renderLabel,
      labelPosition = 'right',
      'aria-label': ariaLabel,
      ...props
    },
    ref,
  ) => {
    const clampedValue =
      value == null ? null : Math.min(100, Math.max(0, value));

    const labelContent = React.useMemo(() => {
      if (!showLabel && !renderLabel) return null;
      if (clampedValue == null) return null;

      if (renderLabel) return renderLabel(clampedValue);
      return (
        <span className="tabular-nums text-xs font-medium text-muted-foreground">
          {Math.round(clampedValue)}%
        </span>
      );
    }, [showLabel, renderLabel, clampedValue]);

    const bar = (
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          progressVariants({ size }),
          // Indeterminate animation when value is null
          clampedValue == null && 'animate-pulse',
          className,
        )}
        value={clampedValue ?? undefined}
        aria-label={ariaLabel}
        aria-valuenow={clampedValue ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(progressIndicatorVariants({ variant }))}
          style={{
            transform:
              clampedValue != null
                ? `translateX(-${100 - clampedValue}%)`
                : 'translateX(-30%)',
            transition:
              clampedValue != null
                ? 'transform 500ms ease-in-out'
                : undefined,
          }}
        />

        {/* Inside label */}
        {labelPosition === 'inside' && labelContent && clampedValue != null && (
          <span
            className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white drop-shadow"
            aria-hidden="true"
          >
            {Math.round(clampedValue)}%
          </span>
        )}
      </ProgressPrimitive.Root>
    );

    if (!showLabel && !renderLabel) return bar;
    if (labelPosition === 'inside') return bar;

    if (labelPosition === 'top') {
      return (
        <div className="w-full space-y-1">
          <div className="flex items-center justify-between">
            {labelContent}
          </div>
          {bar}
        </div>
      );
    }

    // Default: label to the right
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex-1">{bar}</div>
        {labelContent}
      </div>
    );
  },
);

Progress.displayName = ProgressPrimitive.Root.displayName;

// ─── Milestone Progress ───────────────────────────────────────────────────────

export interface MilestoneProgressProps {
  /** Total number of milestones. */
  total: number;
  /** Number of completed milestones. */
  completed: number;
  /** Number of milestones currently in-progress. */
  inProgress?: number;
  className?: string;
  showLabel?: boolean;
  size?: ProgressProps['size'];
}

/**
 * A specialised progress bar that visualises milestone completion.
 * Completed milestones are shown in primary colour, in-progress in amber.
 */
function MilestoneProgress({
  total,
  completed,
  inProgress = 0,
  className,
  showLabel = true,
  size = 'default',
}: MilestoneProgressProps) {
  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const inProgressPct = total > 0 ? (inProgress / total) * 100 : 0;

  return (
    <div className={cn('w-full space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {completed}/{total} milestones completed
          </span>
          <span className="font-medium text-foreground">
            {Math.round(completedPct)}%
          </span>
        </div>
      )}

      {/* Layered progress: completed (primary) + in-progress (amber) */}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-secondary',
          {
            'h-1': size === 'xs',
            'h-1.5': size === 'sm',
            'h-2.5': size === 'default',
            'h-3': size === 'md',
            'h-4': size === 'lg',
            'h-5': size === 'xl',
          },
        )}
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${completed} of ${total} milestones completed`}
      >
        {/* In-progress layer (behind completed) */}
        {inProgressPct > 0 && (
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-amber-400 transition-all duration-500"
            style={{ width: `${Math.min(completedPct + inProgressPct, 100)}%` }}
          />
        )}

        {/* Completed layer */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${completedPct}%` }}
        />
      </div>

      {/* Legend */}
      {showLabel && inProgress > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            Completed ({completed})
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
            In progress ({inProgress})
          </span>
          {total - completed - inProgress > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-secondary-foreground/20 inline-block" />
              Pending ({total - completed - inProgress})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step Progress ────────────────────────────────────────────────────────────

export interface StepProgressProps {
  /** Total number of steps. */
  steps: number;
  /** The currently active step (1-based). */
  currentStep: number;
  className?: string;
  /** Step labels (optional). */
  labels?: string[];
}

/**
 * A segmented step progress indicator.
 */
function StepProgress({
  steps,
  currentStep,
  className,
  labels,
}: StepProgressProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-1">
        {Array.from({ length: steps }).map((_, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          return (
            <React.Fragment key={stepNum}>
              {/* Step circle */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  'border-2 transition-all duration-200',
                  isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isActive
                    ? 'border-primary bg-background text-primary'
                    : 'border-muted bg-background text-muted-foreground',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? (
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>

              {/* Connector line */}
              {index < steps - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 rounded-full transition-all duration-300',
                    stepNum < currentStep ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Labels */}
      {labels && labels.length > 0 && (
        <div
          className="mt-2 flex justify-between"
          aria-hidden="true"
        >
          {labels.map((label, index) => {
            const stepNum = index + 1;
            const isCompleted = stepNum < currentStep;
            const isActive = stepNum === currentStep;

            return (
              <span
                key={label}
                className={cn(
                  'text-[10px] font-medium text-center',
                  isCompleted
                    ? 'text-primary'
                    : isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                  // First label left-aligned, last right-aligned
                  index === 0 && 'text-left',
                  index === labels.length - 1 && 'text-right',
                )}
                style={{
                  width: `${100 / labels.length}%`,
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Circular Progress ────────────────────────────────────────────────────────

export interface CircularProgressProps {
  value?: number | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

/**
 * SVG-based circular progress indicator.
 */
function CircularProgress({
  value,
  size = 48,
  strokeWidth = 4,
  className,
  showLabel = false,
  variant = 'default',
}: CircularProgressProps) {
  const clampedValue =
    value == null ? null : Math.min(100, Math.max(0, value));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    clampedValue != null
      ? circumference - (clampedValue / 100) * circumference
      : circumference * 0.75; // show 25% arc for indeterminate

  const strokeColorMap: Record<string, string> = {
    default: 'stroke-primary',
    success: 'stroke-green-500',
    warning: 'stroke-yellow-500',
    destructive: 'stroke-destructive',
  };

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      role="progressbar"
      aria-valuenow={clampedValue ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn(clampedValue == null && 'animate-spin')}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-secondary"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(
            'transition-all duration-500 ease-in-out',
            strokeColorMap[variant] ?? strokeColorMap.default,
          )}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      {showLabel && clampedValue != null && (
        <span
          className="absolute text-[10px] font-semibold tabular-nums text-foreground"
          aria-hidden="true"
        >
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Progress, MilestoneProgress, StepProgress, CircularProgress };
