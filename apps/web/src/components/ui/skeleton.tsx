import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── Base Skeleton ────────────────────────────────────────────────────────────

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

// ─── Skeleton variants ────────────────────────────────────────────────────────

/** A skeleton that looks like a line of text. */
function SkeletonText({
  className,
  lines = 1,
  lastLineWidth = '75%',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  lines?: number;
  lastLineWidth?: string;
}) {
  if (lines === 1) {
    return (
      <Skeleton
        className={cn('h-4 w-full', className)}
        {...props}
      />
    );
  }

  return (
    <div className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{
            width: i === lines - 1 ? lastLineWidth : '100%',
          }}
        />
      ))}
    </div>
  );
}

/** A circular skeleton, useful for avatars. */
function SkeletonAvatar({
  className,
  size = 'md',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizeMap: Record<string, string> = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <Skeleton
      className={cn('rounded-full shrink-0', sizeMap[size], className)}
      {...props}
    />
  );
}

/** A skeleton shaped like a button. */
function SkeletonButton({
  className,
  size = 'md',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeMap: Record<string, string> = {
    sm: 'h-8 w-20',
    md: 'h-10 w-24',
    lg: 'h-12 w-32',
  };

  return (
    <Skeleton
      className={cn('rounded-md', sizeMap[size], className)}
      {...props}
    />
  );
}

/** A skeleton shaped like a badge / tag. */
function SkeletonBadge({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={cn('h-5 w-16 rounded-full', className)}
      {...props}
    />
  );
}

/** A skeleton shaped like an image / thumbnail. */
function SkeletonImage({
  className,
  aspectRatio = '16/9',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  aspectRatio?: '1/1' | '4/3' | '16/9' | '3/2';
}) {
  const aspectMap: Record<string, string> = {
    '1/1': 'aspect-square',
    '4/3': 'aspect-[4/3]',
    '16/9': 'aspect-video',
    '3/2': 'aspect-[3/2]',
  };

  return (
    <Skeleton
      className={cn('w-full rounded-lg', aspectMap[aspectRatio], className)}
      {...props}
    />
  );
}

// ─── Compound skeleton patterns ───────────────────────────────────────────────

/** Skeleton for a user profile header (avatar + name + subtitle). */
function SkeletonUserRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3', className)}
      aria-hidden="true"
      {...props}
    >
      <SkeletonAvatar size="md" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/** Skeleton for a project / listing card. */
function SkeletonCard({
  className,
  showImage = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  showImage?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 space-y-4',
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      {showImage && <SkeletonImage aspectRatio="16/9" />}

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2 min-w-0">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <SkeletonBadge />
      </div>

      {/* Body lines */}
      <SkeletonText lines={3} lastLineWidth="60%" />

      {/* Tags row */}
      <div className="flex flex-wrap gap-2">
        <SkeletonBadge className="w-14" />
        <SkeletonBadge className="w-20" />
        <SkeletonBadge className="w-12" />
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between pt-1">
        <SkeletonUserRow className="w-40" />
        <SkeletonButton size="sm" />
      </div>
    </div>
  );
}

/** Skeleton for a stat/metric card. */
function SkeletonStatCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 space-y-3',
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

/** Skeleton for a table row. */
function SkeletonTableRow({
  columns = 4,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  columns?: number;
}) {
  return (
    <div
      className={cn('flex items-center gap-4 py-3', className)}
      aria-hidden="true"
      {...props}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 flex-1"
          style={{ maxWidth: i === 0 ? '200px' : undefined }}
        />
      ))}
    </div>
  );
}

/** Skeleton for a table (header + N body rows). */
function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      className={cn('w-full space-y-2', className)}
      aria-hidden="true"
      {...props}
    >
      {/* Header */}
      <div className="flex items-center gap-4 pb-2 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-3 flex-1"
            style={{ maxWidth: i === 0 ? '200px' : undefined }}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </div>
  );
}

/** Skeleton for a chat message bubble. */
function SkeletonMessage({
  align = 'left',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: 'left' | 'right';
}) {
  const isRight = align === 'right';

  return (
    <div
      className={cn(
        'flex items-end gap-2',
        isRight ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      {!isRight && <SkeletonAvatar size="sm" />}
      <div
        className={cn(
          'space-y-1 max-w-[65%]',
          isRight ? 'items-end' : 'items-start',
          'flex flex-col',
        )}
      >
        <Skeleton className={cn('h-10 rounded-2xl', isRight ? 'w-48' : 'w-56')} />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/** Skeleton for a sidebar navigation item. */
function SkeletonNavItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3 px-3 py-2.5', className)}
      aria-hidden="true"
      {...props}
    >
      <Skeleton className="h-5 w-5 rounded-md shrink-0" />
      <Skeleton className="h-4 flex-1" />
    </div>
  );
}

/** Skeleton for a notification item. */
function SkeletonNotification({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-start gap-3 p-3', className)}
      aria-hidden="true"
      {...props}
    >
      <SkeletonAvatar size="sm" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonBadge,
  SkeletonImage,
  SkeletonUserRow,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonMessage,
  SkeletonNavItem,
  SkeletonNotification,
};
