'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronRight, HandshakeIcon, DollarSign, Calendar,
  CheckCircle2, Clock, AlertCircle, MessageSquare, Pause, Play,
  XCircle, Flag, FileText, User, ChevronDown, ChevronUp, Paperclip,
} from 'lucide-react';
import {
  useContract, useSubmitMilestone, useApproveMilestone,
  useRequestRevision, usePauseContract, useResumeContract,
  useCancelContract,
} from '@/hooks/use-contracts';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toaster';
import { formatCurrency, formatDate, formatRelativeTime, cn } from '@/lib/utils';
import type { Milestone } from '@freelancer/shared';

// ─── Milestone row ────────────────────────────────────────────────────────────

interface MilestoneRowProps {
  milestone: Milestone;
  contractId: string;
  isClient: boolean;
  isFreelancer: boolean;
}

function MilestoneRow({ milestone, contractId, isClient, isFreelancer }: MilestoneRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [dialogType, setDialogType] = useState<'submit' | 'approve' | 'revision' | null>(null);

  const submitMutation = useSubmitMilestone();
  const approveMutation = useApproveMilestone();
  const revisionMutation = useRequestRevision();

  const statusColors: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-600',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    SUBMITTED: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REVISION_REQUESTED: 'bg-orange-100 text-orange-700',
    DISPUTED: 'bg-red-100 text-red-700',
  };

  const handleAction = async () => {
    if (dialogType === 'submit') {
      await submitMutation.mutateAsync({ milestoneId: milestone.id, contractId, submissionNote: note });
      toast.success({ title: 'Milestone submitted for review' });
    } else if (dialogType === 'approve') {
      await approveMutation.mutateAsync({ milestoneId: milestone.id, contractId, reviewNote: note });
      toast.success({ title: 'Milestone approved — payment released' });
    } else if (dialogType === 'revision') {
      await revisionMutation.mutateAsync({ milestoneId: milestone.id, contractId, reviewNote: note });
      toast.success({ title: 'Revision requested' });
    }
    setDialogType(null);
    setNote('');
  };

  const isPending = submitMutation.isPending || approveMutation.isPending || revisionMutation.isPending;

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {milestone.order}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">{milestone.title}</p>
              {milestone.dueDate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3" />
                  Due {formatDate(milestone.dueDate)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusColors[milestone.status] ?? 'bg-gray-100 text-gray-600')}>
              {milestone.status.replace(/_/g, ' ')}
            </span>
            <span className="font-bold text-sm text-foreground tabular-nums">
              {formatCurrency(milestone.amount, milestone.currency)}
            </span>
            <button type="button" onClick={() => setExpanded(p => !p)} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">{milestone.description}</p>
            {milestone.submissionNote && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Submission note:</p>
                <p className="text-yellow-700 dark:text-yellow-300">{milestone.submissionNote}</p>
              </div>
            )}
            {milestone.reviewNote && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">Review note:</p>
                <p className="text-blue-700 dark:text-blue-300">{milestone.reviewNote}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {isFreelancer && (milestone.status === 'PENDING' || milestone.status === 'IN_PROGRESS' || milestone.status === 'REVISION_REQUESTED') && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogType('submit')}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Submit for Review
            </Button>
          )}
          {isClient && milestone.status === 'SUBMITTED' && (
            <>
              <Button size="sm" className="gap-1.5" onClick={() => setDialogType('approve')}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve & Release
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogType('revision')}>
                <AlertCircle className="h-3.5 w-3.5" />
                Request Revision
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={!!dialogType} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'submit' ? 'Submit Milestone' : dialogType === 'approve' ? 'Approve Milestone' : 'Request Revision'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'submit' ? 'Describe what you completed for this milestone.' :
               dialogType === 'approve' ? 'Approving will release the escrow payment to the freelancer.' :
               'Explain what needs to be revised.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="action-note">Note {dialogType !== 'revision' && <span className="text-muted-foreground">(optional)</span>}</Label>
            <Textarea id="action-note" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleAction} disabled={isPending || (dialogType === 'revision' && !note.trim())} loading={isPending}>
              {dialogType === 'submit' ? 'Submit' : dialogType === 'approve' ? 'Approve & Release' : 'Request Revision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const isClient = user?.role === 'CLIENT';
  const isFreelancer = user?.role === 'FREELANCER';

  const { data, isLoading, isError } = useContract(id);
  const pauseMutation = usePauseContract();
  const resumeMutation = useResumeContract();
  const cancelMutation = useCancelContract();

  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const contract = data?.data;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !contract) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-semibold">Contract not found</p>
        <Button variant="outline" onClick={() => router.back()} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Go back
        </Button>
      </div>
    );
  }

  const milestones = contract.milestones ?? [];
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter(m => m.status === 'APPROVED').length;
  const progress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;
  const counterpart = isClient ? contract.freelancer : contract.client;

  const handlePauseResume = async () => {
    if (contract.status === 'ACTIVE') {
      await pauseMutation.mutateAsync({ contractId: id });
      toast.success({ title: 'Contract paused' });
    } else if (contract.status === 'PAUSED') {
      await resumeMutation.mutateAsync({ contractId: id });
      toast.success({ title: 'Contract resumed' });
    }
  };

  const handleCancel = async () => {
    await cancelMutation.mutateAsync({ contractId: id, reason: cancelReason });
    toast.success({ title: 'Contract cancelled' });
    setCancelDialog(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <Link href="/contracts" className="hover:text-foreground">Contracts</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground truncate max-w-[200px]">{contract.title}</span>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <HandshakeIcon className="h-5 w-5 text-violet-600" />
                <h1 className="text-xl font-bold text-foreground">{contract.title}</h1>
                <StatusBadge status={contract.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                Started {formatRelativeTime(contract.startDate)} · {formatCurrency(contract.amount, contract.currency)}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              {(contract.status === 'ACTIVE' || contract.status === 'PAUSED') && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePauseResume}
                  disabled={pauseMutation.isPending || resumeMutation.isPending}>
                  {contract.status === 'ACTIVE' ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
                </Button>
              )}
              <Link href={`/dashboard/messages?contractId=${id}`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Message
                </Button>
              </Link>
              {contract.status === 'ACTIVE' && (
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setCancelDialog(true)}>
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Progress */}
          {totalMilestones > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress: {completedMilestones}/{totalMilestones} milestones</span>
                <span className="font-medium text-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} size="sm" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Milestones */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Milestones
          </h2>
          {milestones.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No milestones defined</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {milestones.map(m => (
                <MilestoneRow key={m.id} milestone={m} contractId={id} isClient={isClient} isFreelancer={isFreelancer} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Counterpart */}
          {counterpart && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" /> {isClient ? 'Freelancer' : 'Client'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <UserAvatar src={counterpart.avatar} firstName={counterpart.firstName} lastName={counterpart.lastName} size="md" />
                  <div>
                    <p className="font-semibold text-sm">{counterpart.firstName} {counterpart.lastName}</p>
                    <p className="text-xs text-muted-foreground">{(counterpart as any).email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contract details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Contract Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: 'Value', value: formatCurrency(contract.amount, contract.currency) },
                { label: 'Start Date', value: formatDate(contract.startDate) },
                { label: 'End Date', value: contract.endDate ? formatDate(contract.endDate) : 'Ongoing' },
                { label: 'Status', value: <StatusBadge status={contract.status} size="sm" /> },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground text-right">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Terms */}
          {contract.terms && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Terms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{contract.terms}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Cancel dialog */}
      <Dialog open={cancelDialog} onOpenChange={o => !o && setCancelDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Contract</DialogTitle>
            <DialogDescription>This action cannot be undone. Please provide a reason.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">Reason <span className="text-destructive">*</span></Label>
            <Textarea id="cancel-reason" rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Why are you cancelling?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(false)}>Keep Contract</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={!cancelReason.trim() || cancelMutation.isPending} loading={cancelMutation.isPending}>
              Cancel Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
