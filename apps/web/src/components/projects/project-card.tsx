'use client';

import React from 'react';
import Link from 'next/link';
import {
  Clock,
  Users,
  DollarSign,
  Calendar,
  ArrowRight,
  Gavel,
  Eye,
  MapPin,
  CheckCircle,
} from 'lucide-react';
import { cn, formatCurrency, formatRelativeTime, formatDeadline, truncateText, getDaysUntil } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import type { ProjectWithDetails, ProjectType } from '@freelancer/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectCardProps {
  project: ProjectWithDetails;
  /** When true shows "Place Bid" button; otherwise shows "View Details". */
  isFreelancer?: boolean;
  /** Whether the current user has already bid on this project. */
  hasBid?: boolean;
  /** Compact mode — smaller padding, fewer details. */
  compact?: boolean;
  /** Called when the user clicks "Place Bid". */
  onBid?: (projectId: string) => void;
  className?: string;
}

// ─── Project type label map ────────────────────────────────────────────────────

const PROJECT_TYPE_CONFIG: Record<
  ProjectType,
  { label: string; variant: 'fixed' | 'hourly' | 'contest' }
> = {
  FIXED_PRICE: { label: 'Fixed Price', variant: 'fixed' },
  HOURLY: { label: 'Hourly', variant: 'hourly' },
  CONTEST: { label: 'Contest', variant: 'contest' },
};

// ─── Deadline badge ───────────────────────────────────────────────────────────

function DeadlineBadge({ deadline }: { deadline: Date | string }) {
  const days = getDaysUntil(deadline);
  const isUrgent = days <= 3;
  const isSoon = days <= 7;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isUrgent
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : isSoon
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
          : 'bg-muted text-muted-foreground',
      )}
    >
      <Calendar className="h-3 w-3" aria-hidden="true" />
      {formatDeadline(deadline)}
    </span>
  );
}

// ─── Skills list ──────────────────────────────────────────────────────────────

const MAX_VISIBLE_SKILLS = 4;

function SkillsList({ skills }: { skills: string[] }) {
  if (!skills || skills.length === 0) return null;

  const visible = skills.slice(0, MAX_VISIBLE_SKILLS);
  const overflow = skills.length - MAX_VISIBLE_SKILLS;

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Required skills">
      {visible.map((skill) => (
        <Badge key={skill} variant="skill" size="sm">
          {skill}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" size="sm" className="text-muted-foreground">
          +{overflow} more
        </Badge>
      )}
    </div>
  );
}

// ─── Bid count indicator ──────────────────────────────────────────────────────

function BidCount({ count }: { count: number }) {
  const label =
    count === 0
      ? 'No bids yet'
      : count === 1
      ? '1 bid'
      : `${count} bids`;

  const color =
    count === 0
      ? 'text-muted-foreground'
      : count < 5
      ? 'text-green-600 dark:text-green-400'
      : count < 15
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-orange-600 dark:text-orange-400';

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs font-medium', color)}
      aria-label={label}
    >
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

// ─── Average bid display ──────────────────────────────────────────────────────

function AverageBid({
  avg,
  currency,
}: {
  avg: number;
  currency: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
      Avg. {formatCurrency(avg, currency)}
    </span>
  );
}

// ─── Client info ──────────────────────────────────────────────────────────────

function ClientInfo({
  client,
}: {
  client: ProjectWithDetails['client'];
}) {
  return (
    <div className="flex items-center gap-2">
      <UserAvatar
        src={client.avatar}
        firstName={client.firstName}
        lastName={client.lastName}
        size="xs"
        isVerified={client.isVerified}
      />
      <div className="min-w-0">
        <span className="truncate text-xs font-medium text-foreground">
          {client.firstName} {client.lastName}
        </span>
        {client.country && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {client.country}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

export function ProjectCard({
  project,
  isFreelancer = false,
  hasBid = false,
  compact = false,
  onBid,
  className,
}: ProjectCardProps) {
  const {
    id,
    title,
    description,
    type,
    budgetMin,
    budgetMax,
    currency,
    deadline,
    skills,
    status,
    bidCount,
    viewCount,
    createdAt,
    client,
    averageBidAmount,
  } = project;

  const typeConfig = PROJECT_TYPE_CONFIG[type] ?? {
    label: type,
    variant: 'fixed' as const,
  };

  const isOpen = status === 'OPEN';
  const canBid = isFreelancer && isOpen && !hasBid;
  const budgetText =
    budgetMin === budgetMax
      ? formatCurrency(budgetMin, currency)
      : `${formatCurrency(budgetMin, currency)} – ${formatCurrency(budgetMax, currency)}`;

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-xl border border-border bg-card shadow-soft',
        'transition-all duration-200 hover:shadow-medium hover:-translate-y-0.5',
        'hover:border-primary/20',
        compact ? 'p-4' : 'p-5',
        className,
      )}
      aria-label={`Project: ${title}`}
    >
      {/* ── Gradient accent on hover ──────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-gradient-to-r from-primary via-purple-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      />

      {/* ── Header row ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          {/* Status + type badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={status} size="sm" dot />
            <Badge variant={typeConfig.variant} size="sm">
              {typeConfig.label}
            </Badge>
            {hasBid && (
              <Badge variant="info" size="sm" className="gap-1">
                <Gavel className="h-3 w-3" />
                Bid Placed
              </Badge>
            )}
          </div>

          {/* Title */}
          <Link
            href={`/projects/${id}`}
            className="block group/title"
            aria-label={`View project: ${title}`}
          >
            <h2
              className={cn(
                'font-semibold text-foreground leading-snug',
                'group-hover/title:text-primary transition-colors',
                compact ? 'text-sm' : 'text-base',
              )}
            >
              {truncateText(title, compact ? 70 : 90)}
            </h2>
          </Link>
        </div>

        {/* Budget */}
        <div className="shrink-0 text-right">
          <p
            className={cn(
              'font-bold text-foreground tabular-nums',
              compact ? 'text-base' : 'text-lg',
            )}
          >
            {budgetText}
          </p>
          <p className="text-xs text-muted-foreground">
            {type === 'HOURLY' ? '/hr' : 'budget'}
          </p>
        </div>
      </div>

      {/* ── Description ───────────────────────────────────────────────────── */}
      {!compact && (
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {truncateText(description, 180)}
        </p>
      )}

      {/* ── Skills ────────────────────────────────────────────────────────── */}
      {skills && skills.length > 0 && (
        <div className={cn('mt-3', compact && 'mt-2')}>
          <SkillsList skills={skills} />
        </div>
      )}

      {/* ── Meta row (bids, deadline, views) ──────────────────────────────── */}
      <div
        className={cn(
          'mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5',
          compact && 'mt-2',
        )}
      >
        <BidCount count={bidCount} />

        {averageBidAmount && averageBidAmount > 0 && (
          <AverageBid avg={averageBidAmount} currency={currency} />
        )}

        {viewCount !== undefined && viewCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {viewCount} views
          </span>
        )}

        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatRelativeTime(createdAt)}
        </span>

        {deadline && <DeadlineBadge deadline={deadline} />}
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className={cn('my-3 h-px bg-border', compact && 'my-2')} />

      {/* ── Footer: client info + actions ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        {/* Client info */}
        <ClientInfo client={client} />

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isFreelancer ? (
            <>
              {canBid ? (
                <>
                  {/* Place bid — primary action */}
                  {onBid ? (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        onBid(id);
                      }}
                      className="gap-1.5"
                      aria-label={`Place bid on ${title}`}
                    >
                      <Gavel className="h-3.5 w-3.5" />
                      Place Bid
                    </Button>
                  ) : (
                    <Link href={`/projects/${id}#bid`}>
                      <Button size="sm" className="gap-1.5">
                        <Gavel className="h-3.5 w-3.5" />
                        Place Bid
                      </Button>
                    </Link>
                  )}
                  {/* View details — secondary */}
                  <Link href={`/projects/${id}`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`View details for ${title}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </>
              ) : hasBid ? (
                /* Already bid — show view details */
                <Link href={`/projects/${id}`}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    View Bid
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              ) : (
                /* Closed/in-progress project */
                <Link href={`/projects/${id}`}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    View Details
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </>
          ) : (
            /* Client view */
            <Link href={`/projects/${id}`}>
              <Button
                size="sm"
                variant={isOpen ? 'default' : 'outline'}
                className="gap-1.5"
                aria-label={`View project: ${title}`}
              >
                {isOpen ? (
                  <>
                    <Users className="h-3.5 w-3.5" />
                    {bidCount > 0 ? `${bidCount} Bid${bidCount !== 1 ? 's' : ''}` : 'View Project'}
                  </>
                ) : (
                  <>
                    View Details
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── ProjectCardSkeleton ──────────────────────────────────────────────────────

export function ProjectCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-border bg-card shadow-soft',
        compact ? 'p-4' : 'p-5',
        'space-y-3',
      )}
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            <div className="h-5 w-14 rounded-full bg-muted animate-pulse" />
            <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
          </div>
          <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
        </div>
        <div className="space-y-1 text-right shrink-0">
          <div className="h-6 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-12 rounded bg-muted animate-pulse ml-auto" />
        </div>
      </div>

      {/* Description */}
      {!compact && (
        <div className="space-y-1.5">
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
        </div>
      )}

      {/* Skills */}
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-5 w-16 rounded-full bg-muted animate-pulse"
          />
        ))}
      </div>

      {/* Meta */}
      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-16 rounded bg-muted animate-pulse"
          />
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-muted" />

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
}

// ─── ProjectCardGrid ──────────────────────────────────────────────────────────

export interface ProjectCardGridProps {
  projects: ProjectWithDetails[];
  isLoading?: boolean;
  isFreelancer?: boolean;
  bidProjectIds?: Set<string>;
  onBid?: (projectId: string) => void;
  skeletonCount?: number;
  compact?: boolean;
  className?: string;
  emptyState?: React.ReactNode;
}

/**
 * Renders a responsive grid of ProjectCard components with optional loading
 * skeleton states and empty state fallback.
 */
export function ProjectCardGrid({
  projects,
  isLoading = false,
  isFreelancer = false,
  bidProjectIds = new Set(),
  onBid,
  skeletonCount = 6,
  compact = false,
  className,
  emptyState,
}: ProjectCardGridProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          className,
        )}
        aria-busy="true"
        aria-label="Loading projects"
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProjectCardSkeleton key={i} compact={compact} />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex w-full items-center justify-center py-16">
        {emptyState ?? (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Gavel className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                No projects found
              </p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or search terms.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
      role="list"
      aria-label={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
    >
      {projects.map((project) => (
        <div key={project.id} role="listitem">
          <ProjectCard
            project={project}
            isFreelancer={isFreelancer}
            hasBid={bidProjectIds.has(project.id)}
            onBid={onBid}
            compact={compact}
          />
        </div>
      ))}
    </div>
  );
}
