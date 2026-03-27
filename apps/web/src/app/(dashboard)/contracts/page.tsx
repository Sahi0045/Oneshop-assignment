'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { HandshakeIcon, Search, ChevronRight, AlertCircle } from 'lucide-react';
import { useContracts } from '@/hooks/use-contracts';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/ui/avatar';
import { formatCurrency, formatDate, formatRelativeTime, cn } from '@/lib/utils';
import type { Contract } from '@freelancer/shared';

type TabValue = 'all' | 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';

interface ContractCardProps { contract: Contract; currentUserId?: string; isClient: boolean; }

function ContractCard({ contract, currentUserId, isClient }: ContractCardProps) {
  const c = contract as Contract & {
    client?: { firstName: string; lastName: string; avatar?: string };
    freelancer?: { firstName: string; lastName: string; avatar?: string };
    totalMilestones?: number; completedMilestones?: number;
  };
  const counterpart = isClient ? c.freelancer : c.client;
  const progress = c.totalMilestones ? (c.completedMilestones ?? 0) / c.totalMilestones * 100 : 0;

  return (
    <Link href={`/dashboard/contracts/${contract.id}`} className="group block">
      <Card className="hover:shadow-medium hover:-translate-y-0.5 transition-all duration-200">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{contract.title}</p>
              {counterpart && (
                <div className="flex items-center gap-2">
                  <UserAvatar src={counterpart.avatar} firstName={counterpart.firstName} lastName={counterpart.lastName} size="xs" />
                  <span className="text-xs text-muted-foreground">{counterpart.firstName} {counterpart.lastName}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="font-bold text-foreground tabular-nums">{formatCurrency(contract.amount, contract.currency)}</span>
              <StatusBadge status={contract.status} size="sm" />
            </div>
          </div>
          {c.totalMilestones && c.totalMilestones > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{c.completedMilestones ?? 0}/{c.totalMilestones} milestones</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} size="sm" />
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Started {formatRelativeTime(contract.startDate)}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-5 space-y-3">
          <div className="flex justify-between gap-3">
            <div className="space-y-2 flex-1"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
            <div className="space-y-1"><Skeleton className="h-5 w-20" /><Skeleton className="h-4 w-16" /></div>
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export default function ContractsPage() {
  const { user } = useAuthStore();
  const isClient = user?.role === 'CLIENT';
  const [tab, setTab] = useState<TabValue>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useContracts({ page: 1, limit: 50 });
  const allContracts = data?.data ?? [];

  const filtered = allContracts.filter(c => {
    const matchesTab = tab === 'all' || c.status === tab;
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const counts = {
    all: allContracts.length,
    ACTIVE: allContracts.filter(c => c.status === 'ACTIVE').length,
    COMPLETED: allContracts.filter(c => c.status === 'COMPLETED').length,
    PAUSED: allContracts.filter(c => c.status === 'PAUSED').length,
    CANCELLED: allContracts.filter(c => c.status === 'CANCELLED').length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contracts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage all your active and past contracts.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contracts..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabValue)}>
        <TabsList variant="underline" className="w-full justify-start">
          {(['all', 'ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED'] as TabValue[]).map(t => (
            <TabsTrigger key={t} value={t}>
              {t === 'all' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
            </TabsTrigger>
          ))}
        </TabsList>

        {(['all', 'ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED'] as TabValue[]).map(t => (
          <TabsContent key={t} value={t} className="mt-5">
            {isLoading && <SkeletonList />}
            {isError && (
              <Card className="border-destructive/30">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="font-semibold">Failed to load contracts</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Try Again</Button>
                </CardContent>
              </Card>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <Card><CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <HandshakeIcon className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">No contracts found</p>
                  <p className="text-sm text-muted-foreground">
                    {isClient ? 'Award a bid on one of your projects to create a contract.' : 'Win a bid to start a contract.'}
                  </p>
                </div>
                <Link href="/projects"><Button variant="outline" size="sm">Browse Projects</Button></Link>
              </CardContent></Card>
            )}
            {!isLoading && !isError && filtered.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {filtered.map(c => <ContractCard key={c.id} contract={c} currentUserId={user?.id} isClient={isClient} />)}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
