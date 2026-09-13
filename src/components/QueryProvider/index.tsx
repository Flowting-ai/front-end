"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// staleTime matches the ~30s TTL convention already used by the module-level
// caches in src/lib/api/*.ts (personas.ts, teams.ts, ai-models.ts) — data
// migrated onto React Query should behave the same as it does today, not
// introduce a new freshness window.
const DEFAULT_STALE_TIME_MS = 30_000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: DEFAULT_STALE_TIME_MS,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export default QueryProvider;
