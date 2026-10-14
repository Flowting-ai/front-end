import { QueryClient } from "@tanstack/react-query";
import { STALE_DEFAULT_MS, queryRetryDelay, shouldRetryQuery } from "@/lib/query-policy";

// staleTime matches the ~30s TTL convention used across src/lib/api/*.ts so
// data on React Query behaves like the module-level caches it replaced.
// Tiers and retry rules live in lib/query-policy.ts.
export const DEFAULT_STALE_TIME_MS = STALE_DEFAULT_MS;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
      },
      // Mutations never retry on their own: a repeated POST can double-apply.
      mutations: { retry: 0 },
    },
  });
}

let sharedClient: QueryClient | undefined;

/**
 * The app-wide QueryClient, shared by <QueryProvider> and by plain (non-React)
 * API helpers such as fetchPersonas(), so there is a single cache and a single
 * in-flight request per resource. Those helpers rely on the browser session and
 * never run during SSR; <QueryProvider> still uses a fresh client per server
 * render so nothing can leak between requests.
 */
export function getQueryClient(): QueryClient {
  sharedClient ??= createQueryClient();
  return sharedClient;
}
