"use client";

// Server state for Library. Every hook returns a narrow object (never a raw UseQueryResult) so the
// components stay independent of the query library, and none of them copies data into useState.
// The workspace id is part of every key (useLibraryViewer), so switching workspace shows a clean slate.

import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { libraryApi } from "./api";
import { flattenPages } from "./cache";
import { libraryRetry } from "./errors";
import { libraryKeys, type PickerParams } from "./keys";
import { MIN_SEARCH_LENGTH, isSearching, toListParams, type LibraryQuery, type ListParams } from "./query-params";
import type { PreviewRequest } from "./schemas";
import type { LibraryFile } from "./file";
import { useLibraryViewer } from "./viewer";
import { syncWarmScope, takeWarmFile, takeWarmPreview } from "./warm";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export type ListStatus = "loading" | "error" | "ready";

function listStatus(isPending: boolean, isError: boolean, hasData: boolean): ListStatus {
  // Stale rows stay visible when a background refetch fails; the error state is for "nothing to show".
  if (hasData) return "ready";
  if (isPending) return "loading";
  return isError ? "error" : "ready";
}

export type FileList = {
  files: LibraryFile[];
  status: ListStatus;
  /** A refetch (new filter, refresh) is running while the previous rows are still shown. */
  isRefreshing: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  error: unknown;
};

/** All files / Shared, and search results. Disabled on Suggested unless a search is running. */
export function useLibraryFiles(query: LibraryQuery): FileList {
  const { orgKey, ready } = useLibraryViewer();
  const params = toListParams(query);
  const enabled = ready && (query.tab !== "suggested" || isSearching(query));
  const result = useInfiniteQuery({
    queryKey: libraryKeys.list(orgKey, params),
    queryFn: async ({ pageParam, signal }) => libraryApi.listFiles(params, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled,
    retry: libraryRetry,
  });
  const files = flattenPages(result.data);
  return {
    files,
    status: !ready ? "loading" : enabled ? listStatus(result.isPending, result.isError, result.data !== undefined) : "ready",
    isRefreshing: result.isFetching && !result.isFetchingNextPage && result.data !== undefined,
    hasNextPage: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    fetchNextPage: () => void result.fetchNextPage(),
    refetch: () => void result.refetch(),
    error: result.error,
  };
}

export function useSuggested() {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.suggested(orgKey),
    enabled: ready,
    queryFn: async ({ signal }) => libraryApi.getSuggested(signal),
    staleTime: MINUTE,
    retry: libraryRetry,
  });
}

/**
 * Whether anything is shared with or by the viewer. The Shared tab only appears once it has something,
 * so this is a cheap one-row check, not the tab's list (that is a different query shape and key).
 */
export function useHasShared(): { hasShared: boolean; hasUnread: boolean; isSettled: boolean; isSuccess: boolean } {
  const { orgKey, ready } = useLibraryViewer();
  const result = useQuery({
    queryKey: libraryKeys.hasShared(orgKey),
    enabled: ready,
    queryFn: async ({ signal }) => {
      const page = await libraryApi.listFiles(
        // The Shared tab appears once something is shared WITH the person, which is exactly what `tab=shared` lists.
        { tab: "shared", q: "", sources: [], types: [], sort: "shared", dir: "desc", unreadFirst: true },
        null,
        signal,
      );
      return { has: page.items.length > 0, unread: page.items.some((file) => file.unread) };
    },
    staleTime: MINUTE,
    retry: libraryRetry,
  });
  return { hasShared: result.data?.has === true, hasUnread: result.data?.unread === true, isSettled: !result.isPending, isSuccess: result.isSuccess };
}

/** The picker ("Add from Library"): ready, active, accessible files only, by search and type. */
export function useLibraryPicker(params: PickerParams, enabled: boolean): FileList {
  const { orgKey, ready } = useLibraryViewer();
  const listParams: ListParams = {
    tab: "all",
    q: params.q.length >= MIN_SEARCH_LENGTH ? params.q : "",
    sources: params.generatedOnly ? ["generated"] : [],
    types: params.types,
    sort: "created",
    dir: "desc",
  };
  const result = useInfiniteQuery({
    queryKey: libraryKeys.picker(orgKey, params),
    queryFn: async ({ pageParam, signal }) => libraryApi.listFiles(listParams, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: enabled && ready,
    retry: libraryRetry,
  });
  return {
    files: flattenPages(result.data),
    status: !ready ? "loading" : enabled ? listStatus(result.isPending, result.isError, result.data !== undefined) : "ready",
    isRefreshing: result.isFetching && !result.isFetchingNextPage && result.data !== undefined,
    hasNextPage: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    fetchNextPage: () => void result.fetchNextPage(),
    refetch: () => void result.refetch(),
    error: result.error,
  };
}

export function useTrash() {
  const { orgKey, ready } = useLibraryViewer();
  const result = useInfiniteQuery({
    queryKey: libraryKeys.trash(orgKey),
    queryFn: async ({ pageParam, signal }) => libraryApi.listTrash(pageParam, signal),
    initialPageParam: null as string | null,
    enabled: ready,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: libraryRetry,
  });
  return {
    files: flattenPages(result.data),
    freesBytes: result.data?.pages[0]?.freesBytes ?? 0,
    status: listStatus(result.isPending, result.isError, result.data !== undefined),
    hasNextPage: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    fetchNextPage: () => void result.fetchNextPage(),
    refetch: () => void result.refetch(),
  };
}

/** One file. A file that is not Ready is re-read every few seconds until it is (processing is short). */
export function useLibraryFile(id: string) {
  const { orgKey, ready } = useLibraryViewer();
  const queryClient = useQueryClient();
  const queryKey = libraryKeys.detail(orgKey, id);
  return useQuery({
    queryKey,
    enabled: ready,
    queryFn: async ({ signal }) => {
      syncWarmScope(orgKey);
      return takeWarmFile(id, queryClient.getQueryData(queryKey) === undefined, signal);
    },
    staleTime: 30 * SECOND,
    retry: libraryRetry,
    // Poll while the file is still coming in (`phase: "uploading"`) or Library is still reading it.
    refetchInterval: (query) =>
      query.state.data?.processingPending || query.state.data?.phase === "uploading" ? 3 * SECOND : false,
  });
}

/**
 * A preview. Its payload can hold short-lived storage URLs, so it is cached for less than the
 * URLs live and is never kept around after the viewer closes.
 */
export function useFilePreview(id: string, request: PreviewRequest, enabled: boolean) {
  const { orgKey, ready } = useLibraryViewer();
  const queryClient = useQueryClient();
  const queryKey = libraryKeys.preview(orgKey, id, request);
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      syncWarmScope(orgKey);
      return takeWarmPreview(id, request, queryClient.getQueryData(queryKey) === undefined, signal);
    },
    enabled: enabled && ready,
    staleTime: 4 * MINUTE,
    gcTime: 4 * MINUTE,
    placeholderData: keepPreviousData,
    retry: libraryRetry,
  });
}

export function useFileUsage(id: string, enabled = true) {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.usage(orgKey, id),
    queryFn: async ({ signal }) => libraryApi.getUsage(id, signal),
    enabled: enabled && ready,
    staleTime: 30 * SECOND,
    retry: libraryRetry,
  });
}

/**
 * A text file's own bytes, for the previews that render it (HTML, Markdown, email, code). The
 * Library's text preview is the indexed copy, which trims and re-splits paragraphs, so anything
 * that depends on exact whitespace needs the original.
 */
export function useFileSource(id: string, enabled: boolean) {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.source(orgKey, id),
    queryFn: async ({ signal }) => {
      const url = await libraryApi.getDownloadUrl(id, signal);
      const response = await fetch(url, { signal, credentials: "omit" });
      if (!response.ok) throw new Error(`source ${response.status}`);
      return new TextDecoder("utf-8").decode(await response.arrayBuffer());
    },
    enabled: enabled && ready,
    staleTime: 4 * MINUTE,
    gcTime: 4 * MINUTE,
    retry: false,
  });
}

export function useFileAccess(id: string, enabled = true) {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.access(orgKey, id),
    queryFn: async ({ signal }) => libraryApi.getAccess(id, signal),
    enabled: enabled && ready,
    staleTime: 30 * SECOND,
    retry: libraryRetry,
  });
}

export function useStorage() {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.storage(orgKey),
    enabled: ready,
    queryFn: async ({ signal }) => libraryApi.getStorage(signal),
    staleTime: MINUTE,
    retry: libraryRetry,
  });
}

export function useLibraryLimits() {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.limits(orgKey),
    enabled: ready,
    queryFn: async ({ signal }) => libraryApi.getLimits(signal),
    staleTime: 10 * MINUTE,
    gcTime: 30 * MINUTE,
    retry: libraryRetry,
  });
}

/** Share dialog typeahead over workspace members. */
export function useLibraryPeople(query: string, enabled: boolean) {
  const { orgKey, orgId, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.people(orgKey, query),
    queryFn: () => libraryApi.listPeople(orgId, query),
    enabled: enabled && ready,
    staleTime: MINUTE,
    placeholderData: keepPreviousData,
    retry: libraryRetry,
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function useLibraryPrefs(enabled = true) {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.prefs(orgKey),
    enabled: enabled && ready,
    queryFn: async ({ signal }) => libraryApi.getPrefs(signal),
    staleTime: 5 * MINUTE,
    gcTime: 30 * MINUTE,
    retry: libraryRetry,
  });
}

export function useOrgSettings(enabled = true) {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.orgSettings(orgKey),
    queryFn: async ({ signal }) => libraryApi.getOrgSettings(signal),
    enabled: enabled && ready,
    staleTime: 15 * 1000,
    gcTime: 30 * MINUTE,
    refetchOnWindowFocus: true,
    retry: libraryRetry,
  });
}
