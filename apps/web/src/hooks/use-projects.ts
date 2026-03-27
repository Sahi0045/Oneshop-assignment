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
import type {
  Project,
  ProjectWithDetails,
  ProjectFilter,
  ProjectMilestone,
} from '@freelancer/shared';
import { ProjectStatus, ProjectType, ProjectVisibility } from '@freelancer/shared';

// ─── Re-export enums for consumer convenience ─────────────────────────────────

export { ProjectStatus, ProjectType, ProjectVisibility };

// ─── API response types ───────────────────────────────────────────────────────

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

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  title: string;
  description: string;
  type: ProjectType;
  categoryId?: string;
  budgetMin: number;
  budgetMax: number;
  currency?: string;
  deadline?: string | Date;
  skills: string[];
  visibility?: ProjectVisibility;
  attachments?: string[];
  milestones?: Array<{
    title: string;
    description: string;
    amount: number;
    dueDate?: string | Date;
    order: number;
  }>;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  status?: ProjectStatus;
}

export interface ProjectsPage {
  projects: ProjectWithDetails[];
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

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: Partial<ProjectFilter>) =>
    [...projectKeys.lists(), filters] as const,
  infiniteLists: () => [...projectKeys.all, 'infinite'] as const,
  infiniteList: (filters: Partial<ProjectFilter>) =>
    [...projectKeys.infiniteLists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  myProjects: (userId?: string) =>
    [...projectKeys.all, 'mine', userId] as const,
  byClient: (clientId: string) =>
    [...projectKeys.all, 'client', clientId] as const,
  featured: () => [...projectKeys.all, 'featured'] as const,
  stats: (projectId: string) =>
    [...projectKeys.all, 'stats', projectId] as const,
} as const;

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchProjects(
  filters: Partial<ProjectFilter> = {},
): Promise<PaginatedResponse<ProjectWithDetails>> {
  const params = new URLSearchParams();

  if (filters.search)     params.set('search',     filters.search);
  if (filters.type)       params.set('type',        filters.type);
  if (filters.status)     params.set('status',      filters.status);
  if (filters.categoryId) params.set('categoryId',  filters.categoryId);
  if (filters.clientId)   params.set('clientId',    filters.clientId);
  if (filters.country)    params.set('country',     filters.country);
  if (filters.currency)   params.set('currency',    filters.currency);
  if (filters.sort)       params.set('sort',        filters.sort);
  if (filters.order)      params.set('order',       filters.order);
  if (filters.visibility) params.set('visibility',  filters.visibility);

  if (filters.budgetMin !== undefined)
    params.set('budgetMin', String(filters.budgetMin));
  if (filters.budgetMax !== undefined)
    params.set('budgetMax', String(filters.budgetMax));
  if (filters.page  !== undefined) params.set('page',  String(filters.page));
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));

  if (filters.skills?.length) {
    filters.skills.forEach((s) => params.append('skills', s));
  }

  const query = params.toString();
  const url   = `/projects${query ? `?${query}` : ''}`;

  const response = await api.get<PaginatedResponse<ProjectWithDetails>>(url);
  return response.data;
}

async function fetchProjectById(id: string): Promise<ProjectWithDetails> {
  const response =
    await api.get<ApiResponse<ProjectWithDetails>>(`/projects/${id}`);
  return response.data.data;
}

// ─── 1. useProjects — paginated list ─────────────────────────────────────────

/**
 * Fetches a paginated list of projects with optional filters.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useProjects({ status: 'OPEN', page: 1 });
 * ```
 */
export function useProjects(
  filters: Partial<ProjectFilter> = {},
  options?: Partial<UseQueryOptions<PaginatedResponse<ProjectWithDetails>>>,
) {
  return useQuery<PaginatedResponse<ProjectWithDetails>>({
    queryKey: projectKeys.list(filters),
    queryFn:  () => fetchProjects(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
    placeholderData: (prev) => prev,
    ...options,
  });
}

// ─── 2. useInfiniteProjects — infinite scroll ────────────────────────────────

/**
 * Infinite-scrolling variant of `useProjects`.
 * Each page is fetched on demand via `fetchNextPage()`.
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useInfiniteProjects({ status: 'OPEN' });
 * ```
 */
export function useInfiniteProjects(
  filters: Omit<Partial<ProjectFilter>, 'page'> = {},
  limit = 12,
) {
  return useInfiniteQuery<
    PaginatedResponse<ProjectWithDetails>,
    Error,
    InfiniteData<PaginatedResponse<ProjectWithDetails>>,
    ReturnType<typeof projectKeys.infiniteList>,
    number
  >({
    queryKey:        projectKeys.infiniteList(filters),
    queryFn:         ({ pageParam }) =>
      fetchProjects({ ...filters, page: pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext
        ? lastPage.pagination.page + 1
        : undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage.pagination.hasPrev
        ? firstPage.pagination.page - 1
        : undefined,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── 3. useProject — single project detail ───────────────────────────────────

/**
 * Fetches the full detail for a single project by ID.
 * Prefills from the list cache when available.
 */
export function useProject(
  id: string | undefined | null,
  options?: Partial<UseQueryOptions<ProjectWithDetails>>,
) {
  const queryClient = useQueryClient();

  return useQuery<ProjectWithDetails>({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn:  () => fetchProjectById(id!),
    enabled:  !!id,
    staleTime: 1000 * 60 * 5,
    // Seed from list cache to avoid loading flash
    initialData: () => {
      if (!id) return undefined;

      const allListCaches = queryClient.getQueriesData<
        PaginatedResponse<ProjectWithDetails>
      >({ queryKey: projectKeys.lists() });

      for (const [, cache] of allListCaches) {
        const found = cache?.data?.find((p) => p.id === id);
        if (found) return found;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      if (!id) return undefined;
      const allListCaches = queryClient.getQueriesData<
        PaginatedResponse<ProjectWithDetails>
      >({ queryKey: projectKeys.lists() });

      for (const [key] of allListCaches) {
        const state = queryClient.getQueryState(key);
        if (state?.dataUpdatedAt) return state.dataUpdatedAt;
      }
      return undefined;
    },
    ...options,
  });
}

// ─── 4. useMyProjects — current user's projects ───────────────────────────────

/**
 * Fetches projects belonging to the currently authenticated user.
 * Clients see projects they've posted; freelancers see projects they've
 * engaged with (via bids/contracts).
 */
export function useMyProjects(
  extraFilters: Omit<Partial<ProjectFilter>, 'clientId'> = {},
) {
  return useQuery<PaginatedResponse<ProjectWithDetails>>({
    queryKey: projectKeys.myProjects(),
    queryFn:  () => fetchProjects({ ...extraFilters, clientId: 'me' }),
    staleTime: 1000 * 60 * 2,
  });
}

// ─── 5. useCreateProject ──────────────────────────────────────────────────────

/**
 * Creates a new project.
 * Invalidates the projects list cache on success.
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useCreateProject();
 * mutate({ title: 'My Project', ... });
 * ```
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<ProjectWithDetails>, Error, CreateProjectInput>({
    mutationFn: async (data) => {
      const response = await api.post<ApiResponse<ProjectWithDetails>>(
        '/projects',
        data,
      );
      return response.data;
    },
    onSuccess: (response) => {
      // Optimistically add the new project to the list cache
      queryClient.setQueryData<PaginatedResponse<ProjectWithDetails>>(
        projectKeys.list({}),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: [response.data, ...old.data],
            pagination: {
              ...old.pagination,
              total: old.pagination.total + 1,
            },
          };
        },
      );

      // Seed the detail cache immediately
      queryClient.setQueryData(
        projectKeys.detail(response.data.id),
        response.data,
      );

      // Invalidate paginated lists to keep counts accurate
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: projectKeys.infiniteLists(),
      });
      void queryClient.invalidateQueries({ queryKey: projectKeys.myProjects() });
    },
  });
}

// ─── 6. useUpdateProject ──────────────────────────────────────────────────────

/**
 * Updates an existing project by ID.
 * Performs an optimistic update on the detail cache.
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<ProjectWithDetails>,
    Error,
    { id: string; data: UpdateProjectInput }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch<ApiResponse<ProjectWithDetails>>(
        `/projects/${id}`,
        data,
      );
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      // Cancel in-flight queries for this project
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });

      // Snapshot current value for rollback
      const snapshot = queryClient.getQueryData<ProjectWithDetails>(
        projectKeys.detail(id),
      );

      // Optimistic update
      queryClient.setQueryData<ProjectWithDetails>(
        projectKeys.detail(id),
        (old) => (old ? { ...old, ...data } : old),
      );

      return { snapshot };
    },
    onError: (_err, { id }, context) => {
      // Roll back on error
      const ctx = context as { snapshot?: ProjectWithDetails } | undefined;
      if (ctx?.snapshot) {
        queryClient.setQueryData(projectKeys.detail(id), ctx.snapshot);
      }
    },
    onSuccess: (response, { id }) => {
      // Replace with the authoritative server response
      queryClient.setQueryData(projectKeys.detail(id), response.data);

      // Refresh list caches
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.myProjects() });
    },
  });
}

// ─── 7. useDeleteProject ──────────────────────────────────────────────────────

/**
 * Soft-deletes (cancels) a project by ID.
 * Removes it from all list caches on success.
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<{ deleted: boolean }>, Error, string>({
    mutationFn: async (id: string) => {
      const response = await api.delete<ApiResponse<{ deleted: boolean }>>(
        `/projects/${id}`,
      );
      return response.data;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });

      // Optimistically remove from list cache
      queryClient.setQueriesData<PaginatedResponse<ProjectWithDetails>>(
        { queryKey: projectKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter((p) => p.id !== id),
            pagination: {
              ...old.pagination,
              total: Math.max(0, old.pagination.total - 1),
            },
          };
        },
      );
    },
    onSuccess: (_data, id) => {
      // Remove the detail cache entry
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });

      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: projectKeys.infiniteLists(),
      });
      void queryClient.invalidateQueries({ queryKey: projectKeys.myProjects() });
    },
    onError: () => {
      // Re-fetch to restore correct state
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

// ─── 8. usePublishProject ─────────────────────────────────────────────────────

/**
 * Transitions a DRAFT project to OPEN status (publish it).
 */
export function usePublishProject() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<ProjectWithDetails>, Error, string>({
    mutationFn: async (id: string) => {
      const response = await api.patch<ApiResponse<ProjectWithDetails>>(
        `/projects/${id}/publish`,
      );
      return response.data;
    },
    onSuccess: (response, id) => {
      queryClient.setQueryData(projectKeys.detail(id), response.data);
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.myProjects() });
    },
  });
}

// ─── 9. useCloseProject ───────────────────────────────────────────────────────

/**
 * Closes an OPEN project without awarding a bid.
 */
export function useCloseProject() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<ProjectWithDetails>, Error, string>({
    mutationFn: async (id: string) => {
      const response = await api.patch<ApiResponse<ProjectWithDetails>>(
        `/projects/${id}/close`,
      );
      return response.data;
    },
    onSuccess: (response, id) => {
      queryClient.setQueryData(projectKeys.detail(id), response.data);
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.myProjects() });
    },
  });
}

// ─── 10. useProjectMilestones ─────────────────────────────────────────────────

/**
 * Fetches the milestone breakdown for a given project.
 */
export function useProjectMilestones(projectId: string | undefined | null) {
  return useQuery<ProjectMilestone[]>({
    queryKey: [...projectKeys.detail(projectId ?? ''), 'milestones'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<ProjectMilestone[]>>(
        `/projects/${projectId}/milestones`,
      );
      return response.data.data;
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─── 11. useFeaturedProjects ──────────────────────────────────────────────────

/**
 * Fetches featured / recommended projects for the landing page.
 */
export function useFeaturedProjects(limit = 6) {
  return useQuery<ProjectWithDetails[]>({
    queryKey: [...projectKeys.featured(), limit],
    queryFn: async () => {
      const response = await api.get<ApiResponse<ProjectWithDetails[]>>(
        `/projects/featured?limit=${limit}`,
      );
      return response.data.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes — rarely changes
  });
}

// ─── 12. Prefetch helper ──────────────────────────────────────────────────────

/**
 * Prefetches a project's detail into the cache.
 * Call from parent components (e.g. project list) for faster navigation.
 *
 * @example
 * ```tsx
 * const prefetch = usePrefetchProject();
 * <div onMouseEnter={() => prefetch(project.id)}>...</div>
 * ```
 */
export function usePrefetchProject() {
  const queryClient = useQueryClient();

  return (id: string) => {
    void queryClient.prefetchQuery({
      queryKey: projectKeys.detail(id),
      queryFn:  () => fetchProjectById(id),
      staleTime: 1000 * 60 * 5,
    });
  };
}

// ─── 13. useProjectStats ─────────────────────────────────────────────────────

interface ProjectStats {
  totalBids: number;
  averageBidAmount: number;
  lowestBidAmount: number;
  highestBidAmount: number;
  viewCount: number;
  uniqueFreelancers: number;
}

/**
 * Fetches bid & view statistics for a project (visible to the project owner).
 */
export function useProjectStats(projectId: string | undefined | null) {
  return useQuery<ProjectStats>({
    queryKey: projectKeys.stats(projectId ?? ''),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ProjectStats>>(
        `/projects/${projectId}/stats`,
      );
      return response.data.data;
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 1, // 1 minute — changes often
  });
}

// ─── 14. Selector helpers (derive data from queries) ─────────────────────────

/**
 * Returns only the projects array from a paginated response.
 * Useful when the caller only cares about items, not pagination metadata.
 */
export function useProjectsList(filters: Partial<ProjectFilter> = {}) {
  const query = useProjects(filters);
  return {
    ...query,
    projects:   query.data?.data ?? [],
    pagination: query.data?.pagination,
    isEmpty:    !query.isLoading && (query.data?.data?.length ?? 0) === 0,
  };
}

/**
 * Flattens all pages from the infinite projects query into a single array.
 */
export function useInfiniteProjectsList(
  filters: Omit<Partial<ProjectFilter>, 'page'> = {},
  limit = 12,
) {
  const query = useInfiniteProjects(filters, limit);

  const projects: ProjectWithDetails[] =
    query.data?.pages.flatMap((page) => page.data) ?? [];

  const totalCount = query.data?.pages[0]?.pagination.total ?? 0;

  return {
    ...query,
    projects,
    totalCount,
    isEmpty: !query.isLoading && projects.length === 0,
  };
}
