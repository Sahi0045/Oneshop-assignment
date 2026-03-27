"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Users,
  Eye,
  MapPin,
  CheckCircle,
  AlertCircle,
  Paperclip,
  BarChart3,
  TrendingUp,
  ChevronRight,
  Star,
  Gavel,
  MessageSquare,
  Shield,
  ExternalLink,
  Tag,
} from "lucide-react";
import { useProject } from "@/hooks/use-projects";
import { useProjectBids, useBidAnalytics, useAwardBid } from "@/hooks/use-bids";
import { useAuthStore } from "@/store/auth.store";
import { BidForm } from "@/components/projects/bid-form";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toaster";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  formatDeadline,
  getDaysUntil,
  cn,
  truncateText,
} from "@/lib/utils";
import type { BidWithDetails } from "@freelancer/shared";

// ─── Bid card (client view) ───────────────────────────────────────────────────

interface BidCardProps {
  bid: BidWithDetails;
  projectId: string;
  isAwarding: boolean;
  onAward: (bidId: string) => void;
}

function BidCard({ bid, projectId, isAwarding, onAward }: BidCardProps) {
  const { freelancer } = bid;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 transition-all duration-200",
        bid.status === "ACCEPTED"
          ? "border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10"
          : bid.status === "REJECTED"
            ? "border-muted opacity-60"
            : "border-border hover:border-primary/20 hover:shadow-soft",
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        {/* Freelancer info */}
        <div className="flex items-start gap-3">
          <UserAvatar
            src={freelancer.avatar}
            firstName={freelancer.firstName}
            lastName={freelancer.lastName}
            size="md"
            isVerified={freelancer.isVerified}
          />
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground text-sm">
                {freelancer.firstName} {freelancer.lastName}
              </p>
              {freelancer.isVerified && (
                <Badge variant="verified" size="sm">
                  Verified
                </Badge>
              )}
              <StatusBadge status={bid.status} size="sm" />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {freelancer.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {freelancer.country}
                </span>
              )}
              {freelancer.completionRate !== undefined && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {freelancer.completionRate}% completion
                </span>
              )}
              {(freelancer as { averageRating?: number }).averageRating !==
                undefined && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  {(
                    freelancer as { averageRating?: number }
                  ).averageRating?.toFixed(1)}
                  {(freelancer as { totalReviews?: number }).totalReviews !==
                    undefined && (
                    <span>
                      ({(freelancer as { totalReviews?: number }).totalReviews})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bid amount */}
        <div className="shrink-0 text-right space-y-0.5">
          <p className="text-xl font-extrabold text-foreground tabular-nums">
            {formatCurrency(bid.amount, bid.currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            in {bid.deliveryDays} day{bid.deliveryDays !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatRelativeTime(bid.createdAt)}
          </p>
        </div>
      </div>

      {/* ── Cover letter ───────────────────────────────────────────────────── */}
      <div className="mt-4 space-y-2">
        <p
          className={cn(
            "text-sm text-muted-foreground leading-relaxed",
            !expanded && "line-clamp-3",
          )}
        >
          {bid.coverLetter}
        </p>
        {bid.coverLetter.length > 200 && (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="text-xs text-primary hover:underline underline-offset-4 transition-colors"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {/* ── Attachments ────────────────────────────────────────────────────── */}
      {bid.attachments && bid.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {bid.attachments.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-accent transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              Attachment {i + 1}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          ))}
        </div>
      )}

      {/* ── Actions (client only) ───────────────────────────────────────────── */}
      {bid.status === "PENDING" && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => onAward(bid.id)}
            disabled={isAwarding}
            loading={isAwarding}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Award This Bid
          </Button>
          <Link href={`/dashboard/messages?freelancerId=${freelancer.id}`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Message
            </Button>
          </Link>
          <Link href={`/dashboard/freelancers/${freelancer.id}`}>
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
              View Profile
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      {bid.status === "ACCEPTED" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <span className="font-medium">
            This bid was awarded — contract created.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Bid analytics sidebar ────────────────────────────────────────────────────

interface BidAnalyticsCardProps {
  projectId: string;
  currency: string;
}

function BidAnalyticsCard({ projectId, currency }: BidAnalyticsCardProps) {
  const { data: analyticsData, isLoading } = useBidAnalytics(projectId);
  const analytics = analyticsData;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bid Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  const stats = [
    {
      label: "Total Bids",
      value: analytics.totalBids.toString(),
      icon: <Users className="h-4 w-4 text-blue-500" />,
    },
    {
      label: "Average Bid",
      value: formatCurrency(analytics.averageAmount, currency),
      icon: <BarChart3 className="h-4 w-4 text-violet-500" />,
    },
    {
      label: "Lowest Bid",
      value: formatCurrency(analytics.lowestAmount, currency),
      icon: <TrendingUp className="h-4 w-4 text-green-500" />,
    },
    {
      label: "Highest Bid",
      value: formatCurrency(analytics.highestAmount, currency),
      icon: <DollarSign className="h-4 w-4 text-amber-500" />,
    },
    {
      label: "Avg. Delivery",
      value: `${analytics.averageDeliveryDays} days`,
      icon: <Clock className="h-4 w-4 text-orange-500" />,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Bid Analytics
        </CardTitle>
        <CardDescription>Overview of received bids</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {icon}
              {label}
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {value}
            </span>
          </div>
        ))}

        {analytics.totalBids > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Bid range</p>
              <Progress
                value={
                  analytics.highestAmount > 0
                    ? (analytics.averageAmount / analytics.highestAmount) * 100
                    : 0
                }
                size="sm"
                showLabel
                renderLabel={(v) => (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    avg at {Math.round(v)}%
                  </span>
                )}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const isClient = user?.role === "CLIENT";
  const isFreelancer = user?.role === "FREELANCER";

  const { data: project, isLoading, isError, error } = useProject(id);

  const { data: bidsData, isLoading: bidsLoading } = useProjectBids(
    id,
    { page: 1, limit: 20 },
    { enabled: isClient && !!id },
  );

  const awardBidMutation = useAwardBid();

  const bids = bidsData?.data ?? [];
  const isProjectOwner = isClient && project?.clientId === user?.id;

  // ── Award bid handler ──────────────────────────────────────────────────────

  const handleAwardBid = (bidId: string) => {
    if (!id) return;
    awardBidMutation.mutate(
      { bidId, projectId: id },
      {
        onSuccess: () => {
          toast.success({
            title: "Bid awarded!",
            description: "Contract has been created successfully.",
          });
        },
        onError: (err) => {
          toast.error({
            title: "Failed to award bid",
            description: err.message,
          });
        },
      },
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {/* Back button skeleton */}
        <Skeleton className="h-8 w-32" />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (isError || !project) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              Project not found
            </p>
            <p className="text-sm text-muted-foreground">
              {(error as Error)?.message ??
                "This project may have been removed or is not accessible."}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const {
    title,
    description,
    type,
    status,
    budgetMin,
    budgetMax,
    currency,
    deadline,
    skills,
    bidCount,
    viewCount,
    createdAt,
    client,
    attachments,
    milestones,
    averageBidAmount,
    lowestBidAmount,
    highestBidAmount,
  } = project;

  const typeLabels: Record<string, string> = {
    FIXED_PRICE: "Fixed Price",
    HOURLY: "Hourly",
    CONTEST: "Contest",
  };

  const daysUntilDeadline = deadline ? getDaysUntil(deadline) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      {/* ── Back navigation ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link
            href="/projects"
            className="hover:text-foreground transition-colors"
          >
            Projects
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium text-foreground truncate max-w-[200px]">
            {title}
          </span>
        </nav>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: Project details ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project header */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} dot />
              <Badge
                variant={
                  type === "FIXED_PRICE"
                    ? "fixed"
                    : type === "HOURLY"
                      ? "hourly"
                      : "contest"
                }
              >
                {typeLabels[type] ?? type}
              </Badge>
              {project.category && (
                <Badge variant="outline" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {project.category.name}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              {title}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Posted {formatRelativeTime(createdAt)}
              </span>
              {deadline && (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    daysUntilDeadline !== null && daysUntilDeadline <= 3
                      ? "text-red-600 font-semibold"
                      : daysUntilDeadline !== null && daysUntilDeadline <= 7
                        ? "text-orange-500 font-medium"
                        : "",
                  )}
                >
                  <Calendar className="h-4 w-4" />
                  {formatDeadline(deadline)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {bidCount} bid{bidCount !== 1 ? "s" : ""}
              </span>
              {viewCount !== undefined && (
                <span className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  {viewCount} view{viewCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Project Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {description}
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          {skills && skills.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Required Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="skill">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Milestones */}
          {milestones && milestones.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Project Milestones</CardTitle>
                <CardDescription>
                  {milestones.length} milestone
                  {milestones.length !== 1 ? "s" : ""} planned
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {milestones.map((milestone, index) => (
                    <div
                      key={milestone.id}
                      className="flex items-start gap-4 rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="font-semibold text-sm text-foreground">
                          {milestone.title}
                        </p>
                        {milestone.description && (
                          <p className="text-xs text-muted-foreground">
                            {milestone.description}
                          </p>
                        )}
                        {milestone.dueDate && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Due {formatDate(milestone.dueDate)}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold text-sm text-foreground tabular-nums">
                          {formatCurrency(
                            milestone.amount,
                            milestone.currency ?? currency,
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          {attachments && attachments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments ({attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span>Attachment {i + 1}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Freelancer: Bid Form ────────────────────────────────────────── */}
          {isFreelancer && status === "OPEN" && (
            <div id="bid" className="scroll-mt-20">
              <BidForm
                projectId={id}
                projectTitle={title}
                projectBudgetMin={budgetMin}
                projectBudgetMax={budgetMax}
                currency={currency}
              />
            </div>
          )}

          {/* ── Client: Bids List ───────────────────────────────────────────── */}
          {isProjectOwner && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-primary" />
                  Received Bids
                  {bidCount > 0 && (
                    <Badge variant="secondary" className="tabular-nums">
                      {bidCount}
                    </Badge>
                  )}
                </h2>
              </div>

              {bidsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border p-5 space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-7 w-20 shrink-0" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  ))}
                </div>
              ) : bids.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      <Gavel
                        className="h-6 w-6 text-muted-foreground/50"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">
                        No bids yet
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Once freelancers submit bids, they&apos;ll appear here.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {bids.map((bid) => (
                    <BidCard
                      key={bid.id}
                      bid={bid}
                      projectId={id}
                      isAwarding={
                        awardBidMutation.isPending &&
                        (
                          awardBidMutation.variables as
                            | { bidId: string }
                            | undefined
                        )?.bidId === bid.id
                      }
                      onAward={handleAwardBid}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right column: sidebar ────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Budget card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Budget
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-3xl font-extrabold text-foreground tabular-nums">
                  {budgetMin === budgetMax
                    ? formatCurrency(budgetMin, currency)
                    : `${formatCurrency(budgetMin, currency)} – ${formatCurrency(budgetMax, currency)}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {type === "HOURLY" ? "per hour" : "fixed budget"}
                </p>
              </div>

              {/* Budget stats */}
              {averageBidAmount !== undefined && averageBidAmount > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  {[
                    {
                      label: "Avg. Bid",
                      value: formatCurrency(averageBidAmount, currency),
                    },
                    {
                      label: "Lowest",
                      value: lowestBidAmount
                        ? formatCurrency(lowestBidAmount, currency)
                        : "–",
                    },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {isFreelancer && status === "OPEN" && (
                <a href="#bid">
                  <Button className="w-full gap-1.5" size="sm">
                    <Gavel className="h-4 w-4" />
                    Place a Bid
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>

          {/* Project details card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "Status",
                  value: <StatusBadge status={status} />,
                },
                {
                  label: "Type",
                  value: (
                    <Badge
                      variant={
                        type === "FIXED_PRICE"
                          ? "fixed"
                          : type === "HOURLY"
                            ? "hourly"
                            : "contest"
                      }
                    >
                      {typeLabels[type] ?? type}
                    </Badge>
                  ),
                },
                {
                  label: "Posted",
                  value: (
                    <span className="text-sm text-foreground">
                      {formatDate(createdAt)}
                    </span>
                  ),
                },
                ...(deadline
                  ? [
                      {
                        label: "Deadline",
                        value: (
                          <span
                            className={cn(
                              "text-sm font-medium",
                              daysUntilDeadline !== null &&
                                daysUntilDeadline <= 3
                                ? "text-red-600"
                                : daysUntilDeadline !== null &&
                                    daysUntilDeadline <= 7
                                  ? "text-orange-500"
                                  : "text-foreground",
                            )}
                          >
                            {formatDate(deadline)}
                          </span>
                        ),
                      },
                    ]
                  : []),
                {
                  label: "Total Bids",
                  value: (
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {bidCount}
                    </span>
                  ),
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-xs text-muted-foreground">{label}</span>
                  {value}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Client info card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">About the Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={client.avatar}
                  firstName={client.firstName}
                  lastName={client.lastName}
                  size="md"
                  isVerified={client.isVerified}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-foreground">
                    {client.firstName} {client.lastName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {client.isVerified && (
                      <Badge variant="verified" size="sm">
                        Verified
                      </Badge>
                    )}
                    {client.country && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {client.country}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2.5">
                {client.totalSpent !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total spent</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatCurrency(client.totalSpent, currency)}
                    </span>
                  </div>
                )}
                {client.completionRate !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Hire rate</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {client.completionRate}%
                    </span>
                  </div>
                )}
              </div>

              {isFreelancer && (
                <Link
                  href={`/dashboard/messages?clientId=${client.id}`}
                  className="block"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message Client
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Bid analytics (client only) */}
          {isProjectOwner && bidCount > 0 && (
            <BidAnalyticsCard projectId={id} currency={currency} />
          )}

          {/* Escrow badge */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <Shield className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                Secured by Escrow
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Payments are held securely and released only when you approve
                the work.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
