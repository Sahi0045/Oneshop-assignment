'use client';

import React from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Gavel,
  DollarSign,
  HandshakeIcon,
  Plus,
  Search,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  CalendarDays,
  Zap,
  Star,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useContracts, useContractStats } from '@/hooks/use-contracts';
import { useMyBids } from '@/hooks/use-bids';
import { useMyProjects } from '@/hooks/use-projects';
import { formatCurrency, formatRelativeTime, formatDeadline, cn, truncateText } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonCard, SkeletonStatCard } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import type { ContractWithDetails } from '@freelancer/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string; positive: boolean };
  color: string;
  bg: string;
  href?: string;
  loading?: boolean;
}

interface ActivityItem {
  id: string;
  type: 'bid' | 'contract' | 'milestone' | 'payment' | 'message';
  title: string;
  description: string;
  timestamp: Date | string;
  status?: string;
  amount?: number;
  currency?: string;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
  bg,
  href,
  loading = false,
}: StatCardProps) {
  const content = (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        href && 'hover:shadow-medium hover:-translate-y-0.5 cursor-pointer',
      )}
    >
      {/* Decorative gradient blob */}
      <div
        className={cn(
          'absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10',
          bg,
        )}
        aria-hidden="true"
      />

      <CardContent className="p-6">
        {loading ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  {title}
                </p>
                <p className={cn('mt-2 text-3xl font-extrabold tracking-tight', color)}>
                  {value}
                </p>
                {subtitle && (
                  <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
                )}
              </div>
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  bg,
                )}
              >
                <Icon className={cn('h-5 w-5', color)} />
              </div>
            </div>

            {trend && (
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                {trend.positive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
                )}
                <span
                  className={cn(
                    'font-semibold',
                    trend.positive ? 'text-green-600' : 'text-red-500',
                  )}
                >
                  {trend.positive ? '+' : ''}{trend.value}%
                </span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (href && !loading) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ─── Activity icon map ────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  const map: Record<ActivityItem['type'], { icon: React.ReactNode; bg: string }> = {
    bid: {
      icon: <Gavel className="h-4 w-4 text-blue-600" />,
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    contract: {
      icon: <HandshakeIcon className="h-4 w-4 text-violet-600" />,
      bg: 'bg-violet-100 dark:bg-violet-900/30',
    },
    milestone: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    payment: {
      icon: <DollarSign className="h-4 w-4 text-emerald-600" />,
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    message: {
      icon: <MessageSquare className="h-4 w-4 text-orange-600" />,
      bg: 'bg-orange-100 dark:bg-orange-900/30',
    },
  };

  const { icon, bg } = map[type];

  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        bg,
      )}
      aria-hidden="true"
    >
      {icon}
    </div>
  );
}

// ─── Milestone row ────────────────────────────────────────────────────────────

interface MilestoneRowProps {
  contractTitle: string;
  milestoneTitle: string;
  amount: number;
  currency: string;
  dueDate?: Date;
  status: string;
  contractId: string;
}

function MilestoneRow({
  contractTitle,
  milestoneTitle,
  amount,
  currency,
  dueDate,
  status,
  contractId,
}: MilestoneRowProps) {
  return (
    <Link
      href={`/dashboard/contracts/${contractId}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary/30 hover:bg-accent/50 transition-all duration-150"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <CalendarDays className="h-4 w-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {milestoneTitle}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {contractTitle}
        </p>
        {dueDate && (
          <p className="text-xs text-muted-foreground">
            {formatDeadline(dueDate)}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-bold text-foreground">
          {formatCurrency(amount, currency)}
        </span>
        <StatusBadge status={status} size="sm" />
      </div>

      <ChevronRight
        className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const { user } = useAuthStore();

  const isClient = user?.role === 'CLIENT';
  const isFreelancer = user?.role === 'FREELANCER';

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: contractsData, isLoading: contractsLoading } = useContracts({
    status: undefined,
    page: 1,
    limit: 10,
  });

  const { data: statsData, isLoading: statsLoading } = useContractStats();

  const { data: myBidsData, isLoading: bidsLoading } = useMyBids(
    { page: 1, limit: 5 },
    { enabled: isFreelancer },
  );

  const { data: myProjectsData, isLoading: projectsLoading } = useMyProjects(
    { page: 1, limit: 5 },
  );

  // ── Derived values ─────────────────────────────────────────────────────────

  const contracts = contractsData?.data ?? [];
  const stats = statsData?.data;

  const activeContracts = contracts.filter(
    (c) => c.status === 'ACTIVE',
  );

  const pendingBids = myBidsData?.data?.filter(
    (b) => b.status === 'PENDING',
  ) ?? [];

  const myProjects = myProjectsData?.data ?? [];

  // Upcoming milestones: collect from all active contracts
  const upcomingMilestones = activeContracts
    .flatMap((contract) => {
      const detailed = contract as unknown as ContractWithDetails;
      if (!detailed.milestones) return [];
      return detailed.milestones
        .filter((m) =>
          m.status === 'PENDING' ||
          m.status === 'IN_PROGRESS' ||
          m.status === 'SUBMITTED',
        )
        .map((m) => ({
          contractId: contract.id,
          contractTitle: contract.title,
          milestoneTitle: m.title,
          amount: m.amount,
          currency: m.currency,
          dueDate: m.dueDate,
          status: m.status,
          order: m.order,
        }));
    })
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return a.order - b.order;
    })
    .slice(0, 5);

  // Mock recent activity (in a real app, this would come from an activity feed API)
  const recentActivity: ActivityItem[] = [
    ...(contracts.slice(0, 2).map((c, i) => ({
      id: `contract-${c.id}`,
      type: 'contract' as const,
      title: 'Contract started',
      description: c.title,
      timestamp: c.createdAt,
      status: c.status,
    }))),
    ...(pendingBids.slice(0, 2).map((b) => ({
      id: `bid-${b.id}`,
      type: 'bid' as const,
      title: 'Bid submitted',
      description: truncateText((b as unknown as { project?: { title?: string } }).project?.title ?? 'Project', 50),
      timestamp: b.createdAt,
      status: b.status,
      amount: b.amount,
      currency: b.currency,
    }))),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const isStatsLoading = contractsLoading || statsLoading || bidsLoading || projectsLoading;

  const statCards: StatCardProps[] = isClient
    ? [
        {
          title: 'Active Projects',
          value: isStatsLoading ? '–' : (myProjects.filter(p => p.status === 'IN_PROGRESS').length),
          subtitle: `${myProjects.filter(p => p.status === 'OPEN').length} open for bids`,
          icon: Briefcase,
          color: 'text-blue-600',
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          href: '/dashboard/projects',
          loading: isStatsLoading,
        },
        {
          title: 'Active Contracts',
          value: isStatsLoading ? '–' : (stats?.activeContracts ?? activeContracts.length),
          subtitle: `${stats?.completedContracts ?? 0} completed`,
          icon: HandshakeIcon,
          color: 'text-violet-600',
          bg: 'bg-violet-100 dark:bg-violet-900/30',
          href: '/dashboard/contracts',
          loading: isStatsLoading,
          trend: {
            value: 12,
            label: 'vs last month',
            positive: true,
          },
        },
        {
          title: 'Total Spent',
          value: isStatsLoading
            ? '–'
            : formatCurrency(stats?.totalSpent ?? user?.totalSpent ?? 0, user?.currency ?? 'USD'),
          subtitle: 'All time',
          icon: DollarSign,
          color: 'text-emerald-600',
          bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          loading: isStatsLoading,
        },
        {
          title: 'Avg. Rating Given',
          value: '4.8',
          subtitle: 'From 24 reviews',
          icon: Star,
          color: 'text-amber-600',
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          loading: isStatsLoading,
        },
      ]
    : [
        {
          title: 'Active Contracts',
          value: isStatsLoading ? '–' : (stats?.activeContracts ?? activeContracts.length),
          subtitle: `${stats?.completedContracts ?? 0} completed all-time`,
          icon: HandshakeIcon,
          color: 'text-violet-600',
          bg: 'bg-violet-100 dark:bg-violet-900/30',
          href: '/dashboard/contracts',
          loading: isStatsLoading,
          trend: {
            value: 8,
            label: 'vs last month',
            positive: true,
          },
        },
        {
          title: 'Pending Bids',
          value: isStatsLoading ? '–' : pendingBids.length,
          subtitle: `${myBidsData?.pagination?.total ?? 0} total submitted`,
          icon: Gavel,
          color: 'text-blue-600',
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          href: '/dashboard/bids',
          loading: isStatsLoading,
        },
        {
          title: 'Total Earned',
          value: isStatsLoading
            ? '–'
            : formatCurrency(
                stats?.totalEarned ?? user?.totalEarned ?? 0,
                user?.currency ?? 'USD',
              ),
          subtitle: 'Lifetime earnings',
          icon: DollarSign,
          color: 'text-emerald-600',
          bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          loading: isStatsLoading,
          trend: {
            value: 24,
            label: 'vs last month',
            positive: true,
          },
        },
        {
          title: 'Profile Score',
          value: isStatsLoading ? '–' : `${user?.profileCompleteness ?? 0}%`,
          subtitle: 'Complete your profile',
          icon: TrendingUp,
          color: 'text-orange-600',
          bg: 'bg-orange-100 dark:bg-orange-900/30',
          href: '/dashboard/settings',
          loading: isStatsLoading,
        },
      ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ── Welcome header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Welcome back,{' '}
            <span className="text-primary">
              {user?.firstName ?? 'there'}
            </span>{' '}
            👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {isClient
              ? 'Here\'s an overview of your projects and contracts.'
              : 'Here\'s your freelance activity at a glance.'}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {isClient ? (
            <>
              <Link href="/projects/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Post Project
                </Button>
              </Link>
              <Link href="/contracts">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <HandshakeIcon className="h-4 w-4" />
                  Contracts
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/projects">
                <Button size="sm" className="gap-1.5">
                  <Search className="h-4 w-4" />
                  Browse Projects
                </Button>
              </Link>
              <Link href="/bids">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Gavel className="h-4 w-4" />
                  My Bids
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* ── Profile completeness banner (freelancer only) ──────────────────── */}
      {isFreelancer &&
        !isStatsLoading &&
        (user?.profileCompleteness ?? 0) < 80 && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Complete your profile to attract more clients
                  </p>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300 shrink-0">
                    {user?.profileCompleteness ?? 0}%
                  </span>
                </div>
                <Progress
                  value={user?.profileCompleteness ?? 0}
                  size="sm"
                  variant="warning"
                  className="bg-amber-200 dark:bg-amber-800/50"
                />
              </div>
              <Link href="/settings">
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/40"
                >
                  Complete Profile
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: Recent Activity ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                Recent Activity
              </h2>
            </div>
            <Link
              href={isClient ? '/dashboard/contracts' : '/dashboard/bids'}
              className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-4"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              {isStatsLoading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-4">
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Activity className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      No activity yet
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isClient
                        ? 'Post your first project to get started.'
                        : 'Browse projects and place your first bid.'}
                    </p>
                  </div>
                  <Link href={isClient ? '/dashboard/projects/new' : '/dashboard/projects'}>
                    <Button size="sm" className="gap-1.5">
                      {isClient ? (
                        <>
                          <Plus className="h-4 w-4" />
                          Post a Project
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          Browse Projects
                        </>
                      )}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-4 hover:bg-accent/30 transition-colors"
                    >
                      <ActivityIcon type={item.type} />

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">
                            {item.title}
                          </p>
                          {item.status && (
                            <StatusBadge
                              status={item.status}
                              size="sm"
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </p>
                        {item.amount !== undefined && (
                          <p className="text-xs font-semibold text-emerald-600">
                            {formatCurrency(item.amount, item.currency ?? 'USD')}
                          </p>
                        )}
                      </div>

                      <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Active Contracts Summary ─────────────────────────────────── */}
          {activeContracts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HandshakeIcon className="h-5 w-5 text-violet-600" />
                  <h2 className="text-base font-semibold text-foreground">
                    Active Contracts
                  </h2>
                </div>
                <Link
                  href="/contracts"
                  className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-4"
                >
                  View all
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="space-y-3">
                {activeContracts.slice(0, 3).map((contract) => {
                  const detailed = contract as unknown as ContractWithDetails;
                  const totalMilestones = detailed.totalMilestones ?? 0;
                  const completedMilestones = detailed.completedMilestones ?? 0;
                  const progress =
                    totalMilestones > 0
                      ? (completedMilestones / totalMilestones) * 100
                      : 0;

                  const counterpart = isClient
                    ? detailed.freelancer
                    : detailed.client;

                  return (
                    <Link
                      key={contract.id}
                      href={`/dashboard/contracts/${contract.id}`}
                      className="group block rounded-xl border border-border bg-card p-4 hover:border-violet-200 dark:hover:border-violet-800 hover:shadow-soft transition-all duration-150"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {contract.title}
                          </p>
                          {counterpart && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isClient ? 'Freelancer: ' : 'Client: '}
                              {counterpart.firstName} {counterpart.lastName}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-bold text-foreground">
                            {formatCurrency(contract.amount, contract.currency)}
                          </span>
                          <StatusBadge status={contract.status} size="sm" />
                        </div>
                      </div>

                      {/* Milestone progress */}
                      {totalMilestones > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              Milestones: {completedMilestones}/{totalMilestones}
                            </span>
                            <span className="font-medium text-foreground">
                              {Math.round(progress)}%
                            </span>
                          </div>
                          <Progress
                            value={progress}
                            size="sm"
                            variant="default"
                          />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: Quick Actions + Milestones ──────────────────────── */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4.5 w-4.5 h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isClient ? (
                <>
                  <QuickActionButton
                    href="/projects/new"
                    icon={<Plus className="h-4 w-4 text-blue-600" />}
                    iconBg="bg-blue-100 dark:bg-blue-900/30"
                    label="Post a New Project"
                    description="Get bids from top talent"
                  />
                  <QuickActionButton
                    href="/projects"
                    icon={<Briefcase className="h-4 w-4 text-violet-600" />}
                    iconBg="bg-violet-100 dark:bg-violet-900/30"
                    label="View My Projects"
                    description="Manage your open projects"
                  />
                  <QuickActionButton
                    href="/contracts"
                    icon={<HandshakeIcon className="h-4 w-4 text-emerald-600" />}
                    iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                    label="Manage Contracts"
                    description="Review active work"
                  />
                  <QuickActionButton
                    href="/messages"
                    icon={<MessageSquare className="h-4 w-4 text-orange-600" />}
                    iconBg="bg-orange-100 dark:bg-orange-900/30"
                    label="Messages"
                    description="Chat with freelancers"
                  />
                </>
              ) : (
                <>
                  <QuickActionButton
                    href="/projects"
                    icon={<Search className="h-4 w-4 text-blue-600" />}
                    iconBg="bg-blue-100 dark:bg-blue-900/30"
                    label="Browse Projects"
                    description="Find your next opportunity"
                  />
                  <QuickActionButton
                    href="/bids"
                    icon={<Gavel className="h-4 w-4 text-violet-600" />}
                    iconBg="bg-violet-100 dark:bg-violet-900/30"
                    label="My Bids"
                    description="Track pending proposals"
                  />
                  <QuickActionButton
                    href="/contracts"
                    icon={<HandshakeIcon className="h-4 w-4 text-emerald-600" />}
                    iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                    label="My Contracts"
                    description="View active engagements"
                  />
                  <QuickActionButton
                    href="/settings"
                    icon={<TrendingUp className="h-4 w-4 text-orange-600" />}
                    iconBg="bg-orange-100 dark:bg-orange-900/30"
                    label="Improve Profile"
                    description="Attract better clients"
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Milestones */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Upcoming Milestones
                </CardTitle>
                {upcomingMilestones.length > 0 && (
                  <Link
                    href="/contracts"
                    className="text-xs text-primary hover:underline underline-offset-4"
                  >
                    View all
                  </Link>
                )}
              </div>
              <CardDescription>
                Milestones requiring your attention
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contractsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-3.5 w-16" />
                    </div>
                  ))}
                </div>
              ) : upcomingMilestones.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      All clear!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No upcoming milestones right now.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingMilestones.map((milestone, index) => (
                    <MilestoneRow
                      key={`${milestone.contractId}-${index}`}
                      contractId={milestone.contractId}
                      contractTitle={milestone.contractTitle}
                      milestoneTitle={milestone.milestoneTitle}
                      amount={milestone.amount}
                      currency={milestone.currency}
                      dueDate={milestone.dueDate ? new Date(milestone.dueDate) : undefined}
                      status={milestone.status}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Summary (freelancer only) */}
          {isFreelancer && !isStatsLoading && stats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    label: 'Completion Rate',
                    value: stats.completionRate ?? user?.completionRate ?? 0,
                    color: 'default' as const,
                  },
                  {
                    label: 'Profile Completeness',
                    value: user?.profileCompleteness ?? 0,
                    color: 'info' as const,
                  },
                  {
                    label: 'Bid Success Rate',
                    value:
                      myBidsData?.pagination?.total
                        ? Math.round(
                            ((myBidsData.data?.filter(
                              (b) => b.status === 'ACCEPTED',
                            ).length ?? 0) /
                              myBidsData.pagination.total) *
                              100,
                          )
                        : 0,
                    color: 'success' as const,
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-foreground">
                        {value}%
                      </span>
                    </div>
                    <Progress value={value} size="sm" variant={color} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

interface QuickActionButtonProps {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description: string;
}

function QuickActionButton({
  href,
  icon,
  iconBg,
  label,
  description,
}: QuickActionButtonProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent transition-colors duration-100"
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
          iconBg,
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
          {label}
        </p>
        <p className="text-xs text-muted-foreground leading-tight">{description}</p>
      </div>
      <ChevronRight
        className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}
