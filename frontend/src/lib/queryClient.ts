import { QueryClient, keepPreviousData } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000, // 5 minutes default stale time
        gcTime: 60 * 60_000, // 1 hour garbage collection time
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: 'offlineFirst', // Read from cache first if network is down or slow
        retry: (failureCount, error: any) => {
          // Do not retry client 4xx errors
          if (error?.status >= 400 && error?.status < 500) return false;
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        placeholderData: keepPreviousData,
      },
      mutations: {
        networkMode: 'online', // Write actions require an active connection
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export const queryClient = getQueryClient();
