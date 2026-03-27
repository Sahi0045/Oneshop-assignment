'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type {
  Contract,
  ContractWithDetails,
  Milestone,
  Transaction,
  ContractFilter,
  ContractStats,
  EscrowSummary,
} from '@freelancer/shared';

// ─── Response shapes ──────────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ─── Mutation input types ─────────────────────────────────────────────────────

export interface SubmitMilestoneInput {
  milestoneId: string;
  contractId: string;
  submissionNote: string;
  submissionAttachments?: string[];
}

export interface ApproveMilestoneInput {
  milestoneId: string;
  contractId: string;
  reviewNote?: string;
}

export interface RequestRevisionInput {
  milestoneId: string;
  contractId: string;
  reviewNote: string;
}

export interface DisputeMilestoneInput {
  milestoneId: string;
  contractId: string;
  reason: string;
}

export interface CreateContractInput {
  projectId: string;
  bidId: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  terms: string;
  milestones: Array<{
    title: string;
    description: string;
    amount: number;
    dueDate?: string;
    order: number;
  }>;
}

export interface UpdateContractInput {
  contractId: string;
  title?: string;
  description?: string;
  terms?: string;
}

export interface PauseResumeContractInput {
  contractId: string;
  reason?: string;
}

export interface CancelContractInput {
  contractId: string;
  reason: string;
}

export interface OpenDisputeInput {
  contractId: string;
  title: string;
  description: string;
  attachments?: string[];
}

export interface CreateMilestoneInput {
  contractId: string;
  title: string;
  description: string;
  amount: number;
  dueDate?: string;
  order: number;
}

export interface UpdateMilestoneInput {
  milestoneId: string;
  contractId: string;
  title?: string;
  description?: string;
  amount?: number;
  dueDate?: string;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (filters?: ContractFilter) =>
    [...contractKeys.lists(), filters] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (id: string) => [...contractKeys.details(), id] as const,
  milestones: (contractId: string) =>
    [...contractKeys.detail(contractId), 'milestones'] as const,
  transactions: (contractId: string) =>
    [...contractKeys.detail(contractId), 'transactions'] as const,
  escrow: (contractId: string) =>
    [...contractKeys.detail(contractId), 'escrow'] as const,
  stats: () => [...contractKeys.all, 'stats'] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's contracts (paginated, filterable).
 */
export function useContracts(
  filters?: ContractFilter,
): UseQueryResult<PaginatedResponse<Contract>> {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: contractKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.projectId) params.set('projectId', filters.projectId);
      if (filters?.clientId) params.set('clientId', filters.clientId);
      if (filters?.freelancerId)
        params.set('freelancerId', filters.freelancerId);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.sort) params.set('sort', filters.sort);
      if (filters?.order) params.set('order', filters.order);

      const query = params.toString();
      const url = `/contracts${query ? `?${query}` : ''}`;
      const response = await api.get<PaginatedResponse<Contract>>(url);
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Fetch a single contract with full details (milestones, transactions, parties).
 */
export function useContract(
  contractId: string | undefined,
): UseQueryResult<ApiResponse<ContractWithDetails>> {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: contractKeys.detail(contractId ?? ''),
    queryFn: async () => {
      const response =
        await api.get<ApiResponse<ContractWithDetails>>(
          `/contracts/${contractId}`,
        );
      return response.data;
    },
    enabled: isAuthenticated && Boolean(contractId),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Fetch milestones for a specific contract.
 */
export function useContractMilestones(
  contractId: string | undefined,
): UseQueryResult<ApiResponse<Milestone[]>> {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: contractKeys.milestones(contractId ?? ''),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Milestone[]>>(
        `/contracts/${contractId}/milestones`,
      );
      return response.data;
    },
    enabled: isAuthenticated && Boolean(contractId),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Fetch transaction history for a specific contract.
 */
export function useContractTransactions(
  contractId: string | undefined,
): UseQueryResult<ApiResponse<Transaction[]>> {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: contractKeys.transactions(contractId ?? ''),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Transaction[]>>(
        `/contracts/${contractId}/transactions`,
      );
      return response.data;
    },
    enabled: isAuthenticated && Boolean(contractId),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch escrow summary for a specific contract.
 */
export function useEscrowSummary(
  contractId: string | undefined,
): UseQueryResult<ApiResponse<EscrowSummary>> {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: contractKeys.escrow(contractId ?? ''),
    queryFn: async () => {
      const response = await api.get<ApiResponse<EscrowSummary>>(
        `/contracts/${contractId}/escrow`,
      );
      return response.data;
    },
    enabled: isAuthenticated && Boolean(contractId),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Fetch contract statistics for the current user.
 */
export function useContractStats(): UseQueryResult<ApiResponse<ContractStats>> {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: contractKeys.stats(),
    queryFn: async () => {
      const response =
        await api.get<ApiResponse<ContractStats>>('/contracts/stats');
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Milestone mutations ──────────────────────────────────────────────────────

/**
 * Freelancer submits a milestone for client review.
 */
export function useSubmitMilestone(): UseMutationResult<
  ApiResponse<Milestone>,
  Error,
  SubmitMilestoneInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, contractId, ...body }: SubmitMilestoneInput) => {
      const response = await api.post<ApiResponse<Milestone>>(
        `/contracts/${contractId}/milestones/${milestoneId}/submit`,
        body,
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate contract detail so milestones list re-fetches
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.milestones(variables.contractId),
      });
      // Also refresh the contracts list (status may have changed)
      void queryClient.invalidateQueries({
        queryKey: contractKeys.lists(),
      });

      // Optimistically update the cached milestone status
      queryClient.setQueryData<ApiResponse<ContractWithDetails>>(
        contractKeys.detail(variables.contractId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              milestones: old.data.milestones.map((m) =>
                m.id === variables.milestoneId
                  ? {
                      ...m,
                      status: 'SUBMITTED' as const,
                      submissionNote: variables.submissionNote,
                      submissionAttachments:
                        variables.submissionAttachments ?? [],
                    }
                  : m,
              ),
            },
          };
        },
      );
    },
  });
}

/**
 * Client approves a submitted milestone (triggers escrow release).
 */
export function useApproveMilestone(): UseMutationResult<
  ApiResponse<Milestone>,
  Error,
  ApproveMilestoneInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, contractId, ...body }: ApproveMilestoneInput) => {
      const response = await api.post<ApiResponse<Milestone>>(
        `/contracts/${contractId}/milestones/${milestoneId}/approve`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.milestones(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.transactions(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.escrow(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.lists(),
      });

      // Optimistic update
      queryClient.setQueryData<ApiResponse<ContractWithDetails>>(
        contractKeys.detail(variables.contractId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              milestones: old.data.milestones.map((m) =>
                m.id === variables.milestoneId
                  ? {
                      ...m,
                      status: 'APPROVED' as const,
                      reviewNote: variables.reviewNote,
                    }
                  : m,
              ),
              completedMilestones: old.data.completedMilestones + 1,
            },
          };
        },
      );
    },
  });
}

/**
 * Client requests a revision on a submitted milestone.
 */
export function useRequestRevision(): UseMutationResult<
  ApiResponse<Milestone>,
  Error,
  RequestRevisionInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, contractId, ...body }: RequestRevisionInput) => {
      const response = await api.post<ApiResponse<Milestone>>(
        `/contracts/${contractId}/milestones/${milestoneId}/request-revision`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.milestones(variables.contractId),
      });

      // Optimistic update
      queryClient.setQueryData<ApiResponse<ContractWithDetails>>(
        contractKeys.detail(variables.contractId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              milestones: old.data.milestones.map((m) =>
                m.id === variables.milestoneId
                  ? {
                      ...m,
                      status: 'REVISION_REQUESTED' as const,
                      reviewNote: variables.reviewNote,
                    }
                  : m,
              ),
            },
          };
        },
      );
    },
  });
}

/**
 * Dispute a specific milestone.
 */
export function useDisputeMilestone(): UseMutationResult<
  ApiResponse<Milestone>,
  Error,
  DisputeMilestoneInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, contractId, ...body }: DisputeMilestoneInput) => {
      const response = await api.post<ApiResponse<Milestone>>(
        `/contracts/${contractId}/milestones/${milestoneId}/dispute`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.milestones(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.lists(),
      });
    },
  });
}

/**
 * Add a new milestone to an existing contract.
 */
export function useCreateMilestone(): UseMutationResult<
  ApiResponse<Milestone>,
  Error,
  CreateMilestoneInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, ...body }: CreateMilestoneInput) => {
      const response = await api.post<ApiResponse<Milestone>>(
        `/contracts/${contractId}/milestones`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.milestones(variables.contractId),
      });
    },
  });
}

/**
 * Update an existing milestone.
 */
export function useUpdateMilestone(): UseMutationResult<
  ApiResponse<Milestone>,
  Error,
  UpdateMilestoneInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, contractId, ...body }: UpdateMilestoneInput) => {
      const response = await api.patch<ApiResponse<Milestone>>(
        `/contracts/${contractId}/milestones/${milestoneId}`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.milestones(variables.contractId),
      });
    },
  });
}

// ─── Contract mutations ───────────────────────────────────────────────────────

/**
 * Create a new contract from an accepted bid.
 */
export function useCreateContract(): UseMutationResult<
  ApiResponse<Contract>,
  Error,
  CreateContractInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateContractInput) => {
      const response = await api.post<ApiResponse<Contract>>('/contracts', body);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contractKeys.stats() });
    },
  });
}

/**
 * Update contract metadata (title, description, terms).
 */
export function useUpdateContract(): UseMutationResult<
  ApiResponse<Contract>,
  Error,
  UpdateContractInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, ...body }: UpdateContractInput) => {
      const response = await api.patch<ApiResponse<Contract>>(
        `/contracts/${contractId}`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}

/**
 * Pause an active contract.
 */
export function usePauseContract(): UseMutationResult<
  ApiResponse<Contract>,
  Error,
  PauseResumeContractInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, ...body }: PauseResumeContractInput) => {
      const response = await api.post<ApiResponse<Contract>>(
        `/contracts/${contractId}/pause`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}

/**
 * Resume a paused contract.
 */
export function useResumeContract(): UseMutationResult<
  ApiResponse<Contract>,
  Error,
  PauseResumeContractInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, ...body }: PauseResumeContractInput) => {
      const response = await api.post<ApiResponse<Contract>>(
        `/contracts/${contractId}/resume`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}

/**
 * Cancel a contract.
 */
export function useCancelContract(): UseMutationResult<
  ApiResponse<Contract>,
  Error,
  CancelContractInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, ...body }: CancelContractInput) => {
      const response = await api.post<ApiResponse<Contract>>(
        `/contracts/${contractId}/cancel`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contractKeys.stats() });
    },
  });
}

/**
 * Open a dispute on a contract.
 */
export function useOpenDispute(): UseMutationResult<
  ApiResponse<Contract>,
  Error,
  OpenDisputeInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, ...body }: OpenDisputeInput) => {
      const response = await api.post<ApiResponse<Contract>>(
        `/contracts/${contractId}/dispute`,
        body,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contractId),
      });
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}
