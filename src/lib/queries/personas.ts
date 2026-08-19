"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPersonas, PERSONAS_LIST_UPDATED_EVENT } from "@/lib/api/personas";

// Single shared cache entry for the personas list, replacing each consumer's own
// useState + mount-fetch + PERSONAS_LIST_UPDATED_EVENT listener. Still backed by
// fetchPersonas() itself, so the 30s TTL, in-flight dedupe, and per-team detail
// enrichment in src/lib/api/personas.ts are unchanged — this hook only changes
// how components subscribe to that data, not how it's fetched or cached.
export const PERSONAS_QUERY_KEY = ["personas"] as const;

export function usePersonas() {
  const queryClient = useQueryClient();

  // bustPersonasCache() (called from delete/pause/publish flows) still dispatches
  // the same window event it always has — bridge that into a query invalidation
  // so every usePersonas() consumer refetches, matching today's per-component
  // event-listener behavior without changing the invalidation trigger itself.
  useEffect(() => {
    const handleListUpdated = () => {
      queryClient.invalidateQueries({ queryKey: PERSONAS_QUERY_KEY });
    };
    window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, handleListUpdated);
    return () => window.removeEventListener(PERSONAS_LIST_UPDATED_EVENT, handleListUpdated);
  }, [queryClient]);

  return useQuery({
    queryKey: PERSONAS_QUERY_KEY,
    queryFn: fetchPersonas,
    // Old code never retried a failed fetchPersonas() call (just logged and gave
    // up) — override the app-wide retry default so this migration doesn't
    // silently add retries that weren't there before.
    retry: false,
  });
}
