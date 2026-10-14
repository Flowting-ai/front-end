"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient, getQueryClient } from "@/lib/query-client";
import { startCrossTabInvalidation } from "@/lib/query-invalidation";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Shared with non-React helpers (fetchPersonas etc.) so there is one cache.
  const [queryClient] = useState(() =>
    typeof window === "undefined" ? createQueryClient() : getQueryClient(),
  );

  // Credits/models invalidated in another tab refetch here too.
  useEffect(() => startCrossTabInvalidation(queryClient), [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export default QueryProvider;
