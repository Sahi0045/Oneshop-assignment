"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Gavel,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowRight,
  AlertCircle,
  ExternalLink,
  DollarSign,
  Calendar,
  ChevronRight,
  Search,
} from "lucide-react";
import { useMyBids, useWithdrawBid } from "@/hooks/use-bids";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import {
  formatCurrency,
  formatRelativeTime,
  formatDate,
  cn,
  truncateText,
} from "@/lib/utils";
import type { BidWithDetails } from "@freelancer/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabValue = "all" | "pending" | "accepted" | "rejected";

interface WithdrawDialogState {
  open: boolean;
  bidId: string;
  projectTitle: string;
}

// ─── Bid status config ────────────────────────────────────────────────────────

const BID_STATUS_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    tabLabel: string;
  }
> = {
  PENDING: {
    icon: Clock,
    iconColor: "text-yellow-500",
    tabLabel: "Pending",
  },
  ACCEPTED: {
    icon: CheckCircle2,
    iconColor: "text-green-500",
    tabLabel: "Accepted",
  },
  REJECTED: {
    icon: XCircle,
    iconColor: "text-red-500",
    tabLabel: "Rejected",
  },
  WITHDRAWN: {
    icon: MinusCircle,
    iconColor: "text-gray-400",
    tabLabel: "Withdrawn",
  },
};

// ─── Bid Card ─────────────────────────────────────────────────────────────────

interface BidCardProps {
  bid: BidWithDetails;
  onWithdraw: (bidId: string, projectTitle: string) => void;
  isWithdrawing: boolean;
}

function BidCard({ bid, onWithdraw, isWithdrawing }: BidCardProps) {
  const config = BID_STATUS_CONFIG[bid.status] ?? BID_STATUS_CONFIG.PENDING;
  const Icon = config.icon;

  const project = (bid as BidWithDetails & { project?: { id: string; title: string; status: string; type: string } }).project;
  const projectTitle = project?.title ?? "Project";
  const projectId = project?.id ?? "";

  const isPending = bid.status === "PENDING";
  const isAccepted = bid.status === "ACCEPTED";

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card p-5 shadow-soft",
        "transition-all duration-200 hover:shadow-medium hover:-translate-y-0.5",
        isAccepted && "border-green-200 dark:border-green-800",
        bid.status === "REJECTED" && "opacity-70",
        bid.status === "WITHDRAWN" && "opacity-60",
      )}
      aria-label={`Bid on ${projectTitle}`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        {/* Status icon + project title */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              isAccepted
                ? "bg-green-100 dark:bg-green-900/30"
                : bid.status === "REJECTED"
                  ? "bg-red-100 dark:bg-red-900/30"
                  : bid.status === "WITHDRAWN"
                    ? "bg-gray-100 dark:bg-gray-800"
                    : "bg-yellow-100 dark:bg-yellow-900/30",
            )}
          >
            <Icon className={cn("h-5 w-5", config.iconColor)} />
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            {projectId ? (
              <Link
                href={`/dashboard/projects/${projectId}`}
                className="group/link block"
              >
                <h3 className="truncate text-base font-semibold text-foreground group-hover/link:text-primary transition-colors">
                  {truncateText(projectTitle, 80)}
                </h3>
              </Link>
            ) : (
              <h3 className="truncate text-base font-semibold text-foreground">
                {truncateText(projectTitle, 80)}
              </h3>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={bid.status} size="sm" dot />
              {project?.type && (
                <Badge
                  variant={
                    project.type === "FIXED_PRICE"
                      ? "fixed"
                      : project.type === "HOURLY"
                        ? "hourly"
                        : "contest"
                  }
                  size="sm"
                >
                  {project.type === "FIXED_PRICE"
                    ? "Fixed"
                    : project.type === "HOURLY"
                      ? "Hourly"
                      : "Contest"}
                </Badge>
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
            {bid.deliveryDays} day{bid.deliveryDays !== 1 ? "s" : ""} delivery
          </p>
        </div>
      </div>

      {/* ── Cover letter preview ────────────────────────────────────────────── */}
      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
        {bid.coverLetter}
      </p>

      {/* ── Attachments ────────────────────────────────────────────────────── */}
      {bid.attachments && bid.attachments.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          {bid.attachments.length} attachment
          {bid.attachments.length !== 1 ? "s" : ""} included
        </div>
      )}

      <Separator className="my-3" />

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        {/* Timestamps */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Submitted {formatRelativeTime(bid.createdAt)}
          </span>
          {bid.updatedAt !== bid.createdAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Updated {formatRelativeTime(bid.updatedAt)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isPending && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => onWithdraw(bid.id, projectTitle)}
              disabled={isWithdrawing}
              loading={isWithdrawing}
            >
              <MinusCircle className="h-3.5 w-3.5" />
              Withdraw
            </Button>
          )}

          {isAccepted && (
            <Link href={`/dashboard/contracts`}>
              <Button size="sm" className="gap-1.5" variant="outline">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                View Contract
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}

          {projectId && (
            <Link href={`/dashboard/projects/${projectId}`}>
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                View Project
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyBids({ tab }: { tab: TabValue }) {
  const config: Record<
    TabValue,
    { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; description: string; cta?: string; ctaHref?: string }
  > = {
    all: {
      icon: Gavel,
      title: "No bids yet",
      description:
        "You haven't submitted any bids. Browse open projects and place your first bid.",
      cta: "Browse Projects",
      ctaHref: "/dashboard/projects",
    },
    pending: {
      icon: Clock,
      title: "No pending bids",
      description:
        "You don't have any pending bids waiting for a response.",
      cta: "Browse Projects",
      ctaHref: "/dashboard/projects",
    },
    accepted: {
      icon: CheckCircle2,
      title: "No accepted bids",
      description:
        "None of your bids have been accepted yet. Keep bidding on projects that match your skills.",
      cta: "Browse Projects",
      ctaHref: "/dashboard/projects",
    },
    rejected: {
      icon: XCircle,
      title: "No rejected bids",
      description:
        "Great news — none of your bids have been rejected.",
    },
  };

  const { icon: Icon, title, description, cta, ctaHref } = config[tab];

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
        </div>
        <div className="space-y-1 max-w-xs">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
        {cta && ctaHref && (
          <Link href={ctaHref}>
            <Button size="sm" className="gap-1.5">
              <Search className="h-4 w-4" />
              {cta}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Skeleton list ────────────────────────────────────────────────────────────

function BidsSkeletonList() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          aria-hidden="true"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
              </div>
            </div>
            <div className="space-y-1 text-right shrink-0">
              <Skeleton className="h-7 w-20 ml-auto" />
              <Skeleton className="h-3 w-16 ml-auto" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Separator />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-36" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyBidsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [withdrawDialog, setWithdrawDialog] = useState<WithdrawDialogState>({
    open: false,
    bidId: "",
    projectTitle: "",
  });
  const [withdrawReason, setWithdrawReason] = useState("");

  // Guard: only freelancers should see this page
  const isFreelancer = user?.role === "FREELANCER";

  // ── Data ───────────────────────────────────────────────────────────────────

  const { data, isLoading, isError, error } = useMyBids(
    { page: 1, limit: 50 },
    { enabled: isFreelancer },
  );

  const withdrawBidMutation = useWithdrawBid();

  const allBids = data?.data ?? [];

  // Filter by tab
  const filteredBids: BidWithDetails[] =
    activeTab === "all"
      ? allBids
      : allBids.filter(
          (b) => b.status === activeTab.toUpperCase(),
        );

  // Tab counts
  const counts = {
    all: allBids.length,
    pending: allBids.filter((b) => b.status === "PENDING").length,
    accepted: allBids.filter((b) => b.status === "ACCEPTED").length,
    rejected: allBids.filter((b) => b.status === "REJECTED").length,
  };

  // ── Withdraw handlers ──────────────────────────────────────────────────────

  const openWithdrawDialog = (bidId: string, projectTitle: string) => {
    setWithdrawDialog({ open: true, bidId, projectTitle });
    setWithdrawReason("");
  };

  const closeWithdrawDialog = () => {
    setWithdrawDialog({ open: false, bidId: "", projectTitle: "" });
    setWithdrawReason("");
  };

  const handleWithdrawConfirm = () => {
    if (!withdrawDialog.bidId) return;

    // Find the bid to get its projectId
    const bid = allBids.find((b) => b.id === withdrawDialog.bidId);
    const projectId =
      (bid as BidWithDetails & { project?: { id: string } }).project?.id ?? "";

    withdrawBidMutation.mutate(
      {
        bidId: withdrawDialog.bidId,
        projectId,
        reason: withdrawReason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success({
            title: "Bid withdrawn",
            description: "Your bid has been successfully withdrawn.",
          });
          closeWithdrawDialog();
        },
        onError: (err) => {
          toast.error({
            title: "Failed to withdraw bid",
            description: err.message,
          });
        },
      },
    );
  };

  // ── Non-freelancer guard ────────────────────────────────────────────────────

  if (!isFreelancer) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                Bids are for freelancers
              </p>
              <p className="text-sm text-muted-foreground">
                This page is only available to freelancers. Switch your account
                role or log in as a freelancer.
              </p>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Bids
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage all your project proposals.
            {data?.pagination && (
              <span className="ml-1 font-medium text-foreground">
                ({data.pagination.total.toLocaleString()} total)
              </span>
            )}
          </p>
        </div>

        <Link href="/projects" className="shrink-0">
          <Button className="gap-1.5">
            <Search className="h-4 w-4" />
            Find Projects
          </Button>
        </Link>
      </div>

      {/* ── Stats summary ───────────────────────────────────────────────────── */}
      {!isLoading && allBids.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total Bids",
              value: counts.all,
              icon: Gavel,
              color: "text-blue-600",
              bg: "bg-blue-100 dark:bg-blue-900/30",
            },
            {
              label: "Pending",
              value: counts.pending,
              icon: Clock,
              color: "text-yellow-600",
              bg: "bg-yellow-100 dark:bg-yellow-900/30",
            },
            {
              label: "Accepted",
              value: counts.accepted,
              icon: CheckCircle2,
              color: "text-green-600",
              bg: "bg-green-100 dark:bg-green-900/30",
            },
            {
              label: "Rejected",
              value: counts.rejected,
              icon: XCircle,
              color: "text-red-600",
              bg: "bg-red-100 dark:bg-red-900/30",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="shadow-soft">
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    bg,
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5 h-5 w-5", color)} />
                </div>
                <div>
                  <p
                    className={cn(
                      "text-xl font-extrabold tabular-nums",
                      color,
                    )}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsList variant="underline" className="w-full justify-start">
          <TabsTrigger value="all" variant="underline" badge={counts.all || undefined}>
            All
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            variant="underline"
            badge={counts.pending || undefined}
          >
            Pending
          </TabsTrigger>
          <TabsTrigger
            value="accepted"
            variant="underline"
            badge={counts.accepted || undefined}
          >
            Accepted
          </TabsTrigger>
          <TabsTrigger
            value="rejected"
            variant="underline"
            badge={counts.rejected || undefined}
          >
            Rejected
          </TabsTrigger>
        </TabsList>

        {/* ── Tab content ─────────────────────────────────────────────────── */}
        {(["all", "pending", "accepted", "rejected"] as TabValue[]).map(
          (tab) => (
            <TabsContent key={tab} value={tab} className="mt-5">
              {/* Loading */}
              {isLoading && <BidsSkeletonList />}

              {/* Error */}
              {isError && !isLoading && (
                <Card className="border-destructive/30">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <div>
                      <p className="font-semibold text-foreground">
                        Failed to load bids
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {(error as Error)?.message ??
                          "Something went wrong. Please try again."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Empty state */}
              {!isLoading && !isError && filteredBids.length === 0 && (
                <EmptyBids tab={tab} />
              )}

              {/* Bids list */}
              {!isLoading && !isError && filteredBids.length > 0 && (
                <div className="space-y-4">
                  {filteredBids.map((bid) => (
                    <BidCard
                      key={bid.id}
                      bid={bid}
                      onWithdraw={openWithdrawDialog}
                      isWithdrawing={
                        withdrawBidMutation.isPending &&
                        (
                          withdrawBidMutation.variables as
                            | { bidId: string }
                            | undefined
                        )?.bidId === bid.id
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ),
        )}
      </Tabs>

      {/* ── Withdraw confirmation dialog ─────────────────────────────────── */}
      <Dialog
        open={withdrawDialog.open}
        onOpenChange={(open) => !open && closeWithdrawDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Bid</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw your bid on{" "}
              <span className="font-semibold text-foreground">
                {withdrawDialog.projectTitle}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="withdraw-reason">
              Reason{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="withdraw-reason"
              placeholder="Let the client know why you're withdrawing…"
              rows={3}
              maxLength={500}
              showCount
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
              disabled={withdrawBidMutation.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeWithdrawDialog}
              disabled={withdrawBidMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWithdrawConfirm}
              disabled={withdrawBidMutation.isPending}
              loading={withdrawBidMutation.isPending}
            >
              <MinusCircle className="h-4 w-4" />
              Withdraw Bid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
