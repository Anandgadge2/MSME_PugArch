import { QueryClient, keepPreviousData } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60_000, // 15 minutes default stale time
      gcTime: 60 * 60_000, // 1 hour garbage collection time
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      placeholderData: keepPreviousData,
    },
    mutations: {
      retry: 0,
    },
  },
});
