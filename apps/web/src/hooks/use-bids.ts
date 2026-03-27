'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type UseQueryOptions,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type {
  Bid,
  BidWithDetails,
  BidFilter,
  BidAnalytics,
  CreateBidInput,
  PaginatedResponse,
} from '@freelancer/shared';

// ─── Re-export a lean paginated type that matches our API wrapper ─────────────

export interface BidPage {
  data: BidWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const bidKeys = {
  all: ['bids'] as const,
  lists: () => [...bidKeys.all, 'list'] as const,
  list: (filters: Partial<BidFilter>) =>
    [...bidKeys.lists(), filters] as const,
  myBids: (filters?: Partial<BidFilter>) =>
    [...bidKeys.all, 'my', filters ?? {}] as const,
  projectBids: (projectId: string, filters?: Partial<BidFilter>) =>
    [...bidKeys.all, 'project', projectId, filters ?? {}] as const,
  detail: (id: string) => [...bidKeys.all, 'detail', id] as const,
  analytics: (projectId: string) =>
    [...bidKeys.all, 'analytics', projectId] as const,
  infinite: (filters: Partial<BidFilter>) =>
    [...bidKeys.all, 'infinite', filters] as const,
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchMyBids(
  filters: Partial<BidFilter> = {},
): Promise<BidPage> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const response = await api.get<{
    success: boolean;
    message: string;
    data: BidWithDetails[];
    pagination: BidPage['pagination'];
  }>(`/bids/my?${params.toString()}`);

  return {
    data: response.data.data,
    pagination: response.data.pagination,
  };
}

async function fetchProjectBids(
  projectId: string,
  filters: Partial<BidFilter> = {},
): Promise<BidPage> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const response = await api.get<{
    success: boolean;
    message: string;
    data: BidWithDetails[];
    pagination: BidPage['pagination'];
  }>(`/projects/${projectId}/bids?${params.toString()}`);

  return {
    data: response.data.data,
    pagination: response.data.pagination,
  };
}

async function fetchBidById(bidId: string): Promise<BidWithDetails> {
  const response = await api.get<{
    success: boolean;
    message: string;
    data: BidWithDetails;
  }>(`/bids/${bidId}`);
  return response.data.data;
}

async function fetchBidAnalytics(projectId: string): Promise<BidAnalytics> {
  const response = await api.get<{
    success: boolean;
    message: string;
    data: BidAnalytics;
  }>(`/projects/${projectId}/bids/analytics`);
  return response.data.data;
}

// ─── useMyBids ────────────────────────────────────────────────────────────────

/**
 * Returns the current authenticated user's bids, with optional filtering.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useMyBids({ status: BidStatus.PENDING });
 * ```
 */
export function useMyBids(
  filters: Partial<BidFilter> = {},
  options?: Omit<UseQueryOptions<BidPage, Error>, 'queryKey' | 'queryFn'>,
) {
  const { isAuthenticated } = useAuthStore();

  return useQuery<BidPage, Error>({
    queryKey: bidKeys.myBids(filters),
    queryFn: () => fetchMyBids(filters),
    enabled: isAuthenticated && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 2, // 2 minutes — bids update frequently
    ...options,
  });
}

/**
 * Infinite scroll version of useMyBids.
 * Useful for "load more" pagination patterns.
 */
export function useMyBidsInfinite(
  filters: Omit<Partial<BidFilter>, 'page'> = {},
  pageSize: number = 10,
) {
  const { isAuthenticated } = useAuthStore();

  return useInfiniteQuery<
    BidPage,
    Error,
    InfiniteData<BidPage>,
    ReturnType<typeof bidKeys.infinite>,
    number
  >({
    queryKey: bidKeys.infinite({ ...filters, limit: pageSize }),
    queryFn: ({ pageParam }) =>
      fetchMyBids({ ...filters, page: pageParam, limit: pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext
        ? lastPage.pagination.page + 1
        : undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage.pagination.hasPrev
        ? firstPage.pagination.page - 1
        : undefined,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── useProjectBids ───────────────────────────────────────────────────────────

/**
 * Returns all bids for a specific project.
 * Typically used by clients to review incoming bids.
 *
 * @example
 * ```tsx
 * const { data } = useProjectBids(projectId, { sort: BidSortField.AMOUNT });
 * ```
 */
export function useProjectBids(
  projectId: string,
  filters: Partial<BidFilter> = {},
  options?: Omit<UseQueryOptions<BidPage, Error>, 'queryKey' | 'queryFn'>,
) {
  const { isAuthenticated } = useAuthStore();

  return useQuery<BidPage, Error>({
    queryKey: bidKeys.projectBids(projectId, filters),
    queryFn: () => fetchProjectBids(projectId, filters),
    enabled: isAuthenticated && !!projectId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

/**
 * Returns a single bid by its ID.
 */
export function useBid(
  bidId: string,
  options?: Omit<
    UseQueryOptions<BidWithDetails, Error>,
    'queryKey' | 'queryFn'
  >,
) {
  const { isAuthenticated } = useAuthStore();

  return useQuery<BidWithDetails, Error>({
    queryKey: bidKeys.detail(bidId),
    queryFn: () => fetchBidById(bidId),
    enabled: isAuthenticated && !!bidId && (options?.enabled ?? true),
    ...options,
  });
}

// ─── useBidAnalytics ──────────────────────────────────────────────────────────

/**
 * Returns aggregated bid analytics for a project (total bids, average amount,
 * lowest/highest, etc.). Used on the project detail page.
 */
export function useBidAnalytics(
  projectId: string,
  options?: Omit<
    UseQueryOptions<BidAnalytics, Error>,
    'queryKey' | 'queryFn'
  >,
) {
  const { isAuthenticated } = useAuthStore();

  return useQuery<BidAnalytics, Error>({
    queryKey: bidKeys.analytics(projectId),
    queryFn: () => fetchBidAnalytics(projectId),
    enabled: isAuthenticated && !!projectId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// ─── useCreateBid ─────────────────────────────────────────────────────────────

export interface CreateBidVariables extends CreateBidInput {
  projectId: string;
}

export interface CreateBidResponse {
  success: boolean;
  message: string;
  data: BidWithDetails;
}

/**
 * Mutation to submit a new bid on a project.
 *
 * Automatically invalidates:
 * - My bids list
 * - The target project's bid list
 * - The project's bid analytics
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useCreateBid();
 * mutate({ projectId, amount, deliveryDays, coverLetter });
 * ```
 */
export function useCreateBid() {
  const queryClient = useQueryClient();

  return useMutation<CreateBidResponse, Error, CreateBidVariables>({
    mutationFn: async (variables) => {
      const response = await api.post<CreateBidResponse>('/bids', variables);
      return response.data;
    },
    onSuccess: (response, variables) => {
      const newBid = response.data;

      // ── Optimistically inject the new bid into my-bids cache ──────────
      queryClient.setQueriesData<BidPage>(
        { queryKey: bidKeys.myBids() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: [newBid, ...old.data],
            pagination: {
              ...old.pagination,
              total: old.pagination.total + 1,
            },
          };
        },
      );

      // ── Invalidate stale data ─────────────────────────────────────────
      void queryClient.invalidateQueries({
        queryKey: bidKeys.myBids(),
      });
      void queryClient.invalidateQueries({
        queryKey: bidKeys.projectBids(variables.projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: bidKeys.analytics(variables.projectId),
      });
      // Refresh project to update bidCount
      void queryClient.invalidateQueries({
        queryKey: ['projects', 'detail', variables.projectId],
      });
    },
  });
}

// ─── useWithdrawBid ───────────────────────────────────────────────────────────

export interface WithdrawBidVariables {
  bidId: string;
  projectId: string;
  reason?: string;
}

export interface WithdrawBidResponse {
  success: boolean;
  message: string;
  data: Bid;
}

/**
 * Mutation to withdraw a pending bid.
 *
 * Performs an optimistic update — the bid is immediately marked as WITHDRAWN
 * in the UI and rolled back if the request fails.
 *
 * @example
 * ```tsx
 * const { mutate } = useWithdrawBid();
 * mutate({ bidId, projectId });
 * ```
 */
export function useWithdrawBid() {
  const queryClient = useQueryClient();

  return useMutation<
    WithdrawBidResponse,
    Error,
    WithdrawBidVariables,
    { previousMyBids: unknown; previousProjectBids: unknown }
  >({
    mutationFn: async ({ bidId, reason }) => {
      const response = await api.patch<WithdrawBidResponse>(
        `/bids/${bidId}/withdraw`,
        { reason },
      );
      return response.data;
    },
    onMutate: async ({ bidId, projectId }) => {
      // Cancel in-flight fetches to avoid race conditions
      await queryClient.cancelQueries({ queryKey: bidKeys.myBids() });
      await queryClient.cancelQueries({
        queryKey: bidKeys.projectBids(projectId),
      });

      // Snapshot current state for rollback
      const previousMyBids = queryClient.getQueriesData({
        queryKey: bidKeys.myBids(),
      });
      const previousProjectBids = queryClient.getQueriesData({
        queryKey: bidKeys.projectBids(projectId),
      });

      // Optimistic update — mark bid as WITHDRAWN
      const setWithdrawn = (old: BidPage | undefined): BidPage | undefined => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((b) =>
            b.id === bidId ? { ...b, status: 'WITHDRAWN' as const } : b,
          ),
        };
      };

      queryClient.setQueriesData<BidPage>(
        { queryKey: bidKeys.myBids() },
        setWithdrawn,
      );
      queryClient.setQueriesData<BidPage>(
        { queryKey: bidKeys.projectBids(projectId) },
        setWithdrawn,
      );

      return { previousMyBids, previousProjectBids };
    },
    onError: (_err, { projectId }, context) => {
      // Roll back optimistic updates on failure
      if (context?.previousMyBids) {
        (context.previousMyBids as Array<[unknown, BidPage]>).forEach(
          ([queryKey, data]) => {
            queryClient.setQueryData(queryKey as Parameters<typeof queryClient.setQueryData>[0], data);
          },
        );
      }
      if (context?.previousProjectBids) {
        (context.previousProjectBids as Array<[unknown, BidPage]>).forEach(
          ([queryKey, data]) => {
            queryClient.setQueryData(queryKey as Parameters<typeof queryClient.setQueryData>[0], data);
          },
        );
      }
    },
    onSettled: (_data, _err, { projectId }) => {
      // Always refetch to ensure consistency
      void queryClient.invalidateQueries({ queryKey: bidKeys.myBids() });
      void queryClient.invalidateQueries({
        queryKey: bidKeys.projectBids(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: bidKeys.analytics(projectId),
      });
    },
  });
}

// ─── useAwardBid ──────────────────────────────────────────────────────────────

export interface AwardBidVariables {
  bidId: string;
  projectId: string;
}

export interface AwardBidResponse {
  success: boolean;
  message: string;
  data: {
    bid: BidWithDetails;
    contractId: string;
  };
}

/**
 * Mutation for a CLIENT to award a bid to a freelancer.
 * This creates a contract between the client and the winning freelancer.
 *
 * Invalidates:
 * - All bids on the project (status changes cascade)
 * - The project detail
 * - The contracts list
 *
 * @example
 * ```tsx
 * const { mutate } = useAwardBid();
 * mutate({ bidId, projectId });
 * ```
 */
export function useAwardBid() {
  const queryClient = useQueryClient();

  return useMutation<AwardBidResponse, Error, AwardBidVariables>({
    mutationFn: async ({ bidId }) => {
      const response = await api.post<AwardBidResponse>(
        `/bids/${bidId}/award`,
        {},
      );
      return response.data;
    },
    onSuccess: (_response, { projectId }) => {
      // Invalidate all bids for the project — accepted bid + rejected others
      void queryClient.invalidateQueries({
        queryKey: bidKeys.projectBids(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: bidKeys.analytics(projectId),
      });
      // Project status changes to IN_PROGRESS
      void queryClient.invalidateQueries({
        queryKey: ['projects', 'detail', projectId],
      });
      // A contract has been created
      void queryClient.invalidateQueries({
        queryKey: ['contracts'],
      });
    },
  });
}

// ─── useUpdateBid ─────────────────────────────────────────────────────────────

export interface UpdateBidVariables {
  bidId: string;
  projectId: string;
  amount?: number;
  deliveryDays?: number;
  coverLetter?: string;
  attachments?: string[];
}

export interface UpdateBidResponse {
  success: boolean;
  message: string;
  data: BidWithDetails;
}

/**
 * Mutation to update an existing bid (freelancer only, while bid is PENDING).
 */
export function useUpdateBid() {
  const queryClient = useQueryClient();

  return useMutation<UpdateBidResponse, Error, UpdateBidVariables>({
    mutationFn: async ({ bidId, projectId: _projectId, ...updates }) => {
      const response = await api.patch<UpdateBidResponse>(
        `/bids/${bidId}`,
        updates,
      );
      return response.data;
    },
    onSuccess: (response, { projectId }) => {
      const updated = response.data;

      // Update the bid in detail cache
      queryClient.setQueryData<BidWithDetails>(
        bidKeys.detail(updated.id),
        updated,
      );

      void queryClient.invalidateQueries({ queryKey: bidKeys.myBids() });
      void queryClient.invalidateQueries({
        queryKey: bidKeys.projectBids(projectId),
      });
    },
  });
}

// ─── useMarkBidsRead ──────────────────────────────────────────────────────────

export interface MarkBidsReadVariables {
  bidIds: string[];
  projectId: string;
}

/**
 * Mutation to mark a list of bids as read (from the client perspective).
 */
export function useMarkBidsRead() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; message: string },
    Error,
    MarkBidsReadVariables
  >({
    mutationFn: async ({ bidIds }) => {
      const response = await api.post<{ success: boolean; message: string }>(
        '/bids/mark-read',
        { bidIds },
      );
      return response.data;
    },
    onSuccess: (_data, { projectId }) => {
      // Optimistically mark bids as read in the project bids cache
      queryClient.setQueriesData<BidPage>(
        { queryKey: bidKeys.projectBids(projectId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((b) => ({ ...b, isRead: true })),
          };
        },
      );
    },
  });
}

// ─── Convenience selector helpers ─────────────────────────────────────────────

/**
 * Returns the flattened list of all bids from an infinite query result.
 */
export function flattenBidPages(
  data: InfiniteData<BidPage> | undefined,
): BidWithDetails[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

/**
 * Returns whether there are more pages to fetch in an infinite bid query.
 */
export function hasMoreBids(
  data: InfiniteData<BidPage> | undefined,
): boolean {
  if (!data || data.pages.length === 0) return false;
  return data.pages[data.pages.length - 1].pagination.hasNext;
}

/**
 * Returns the total bid count from a paginated result.
 */
export function getTotalBidCount(page: BidPage | undefined): number {
  return page?.pagination.total ?? 0;
}
