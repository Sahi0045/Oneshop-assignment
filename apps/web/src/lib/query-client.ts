import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error: unknown) => {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError?.response?.status === 401) return false;
        if (axiosError?.response?.status === 404) return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: unknown) => {
        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        console.error(
          'Mutation error:',
          axiosError?.response?.data?.message ?? axiosError?.message ?? 'Unknown error'
        );
      },
    },
  },
});
