"use client";

// Server state for Library. Every hook returns a narrow object (never a raw UseQueryResult) so the
// components stay independent of the query library, and none of them copies data into useState.
// The workspace id is part of every key (useLibraryViewer), so switching workspace shows a clean slate.

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getLibraryApi } from "./api";
import { flattenPages } from "./cache";
import { libraryRetry } from "./errors";
import { libraryKeys, type PickerParams } from "./keys";
import { MIN_SEARCH_LENGTH, isSearching, toListParams, type LibraryQuery, type ListParams } from "./query-params";
import type { LibraryFileRow, PreviewRequest } from "./schemas";
import { useLibraryViewer } from "./viewer";

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
  files: LibraryFileRow[];
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
    queryFn: async ({ pageParam, signal }) => (await getLibraryApi()).listFiles(params, pageParam, signal),
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
    queryFn: async ({ signal }) => (await getLibraryApi()).getSuggested(signal),
    staleTime: MINUTE,
    retry: libraryRetry,
  });
}

/**
 * Whether anything is shared with or by the viewer. The Shared tab only appears once it has something,
 * so this is a cheap one-row check, not the tab's list (that is a different query shape and key).
 */
export function useHasShared(): { hasShared: boolean; hasUnread: boolean; isSettled: boolean } {
  const { orgKey, ready } = useLibraryViewer();
  const result = useQuery({
    queryKey: libraryKeys.hasShared(orgKey),
    enabled: ready,
    queryFn: async ({ signal }) => {
      const page = await (await getLibraryApi()).listFiles(
        { tab: "shared", q: "", sources: [], types: [], sort: "shared", dir: "desc" },
        null,
        signal,
      );
      return { has: page.items.length > 0, unread: page.items.some((file) => file.unread) };
    },
    staleTime: MINUTE,
    retry: libraryRetry,
  });
  return { hasShared: result.data?.has === true, hasUnread: result.data?.unread === true, isSettled: !result.isPending };
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
    queryFn: async ({ pageParam, signal }) => (await getLibraryApi()).listFiles(listParams, pageParam, signal),
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
    queryFn: async ({ pageParam, signal }) => (await getLibraryApi()).listTrash(pageParam, signal),
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
  return useQuery({
    queryKey: libraryKeys.detail(orgKey, id),
    enabled: ready,
    queryFn: async ({ signal }) => (await getLibraryApi()).getFile(id, signal),
    staleTime: 30 * SECOND,
    retry: libraryRetry,
    refetchInterval: (query) => (query.state.data && query.state.data.phase !== "ready" ? 3 * SECOND : false),
  });
}

/**
 * A preview. Its payload can hold short-lived storage URLs, so it is cached for less than the
 * URLs live and is never kept around after the viewer closes.
 */
export function useFilePreview(id: string, request: PreviewRequest, enabled: boolean) {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.preview(orgKey, id, request),
    queryFn: async ({ signal }) => (await getLibraryApi()).getPreview(id, request, signal),
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
    queryFn: async ({ signal }) => (await getLibraryApi()).getUsage(id, signal),
    enabled: enabled && ready,
    staleTime: 30 * SECOND,
    retry: libraryRetry,
  });
}

export function useFileAccess(id: string, enabled = true) {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.access(orgKey, id),
    queryFn: async ({ signal }) => (await getLibraryApi()).getAccess(id, signal),
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
    queryFn: async ({ signal }) => (await getLibraryApi()).getStorage(signal),
    staleTime: MINUTE,
    retry: libraryRetry,
  });
}

export function useLibraryLimits() {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.limits(orgKey),
    enabled: ready,
    queryFn: async ({ signal }) => (await getLibraryApi()).getLimits(signal),
    staleTime: 10 * MINUTE,
    gcTime: 30 * MINUTE,
    retry: libraryRetry,
  });
}

export function useLibraryFlags() {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.flags(orgKey),
    enabled: ready,
    queryFn: async ({ signal }) => (await getLibraryApi()).getFlags(signal),
    staleTime: 10 * MINUTE,
    gcTime: 30 * MINUTE,
    retry: libraryRetry,
  });
}

export function useLibraryPrefs() {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.prefs(orgKey),
    enabled: ready,
    queryFn: async ({ signal }) => (await getLibraryApi()).getPrefs(signal),
    staleTime: 5 * MINUTE,
    gcTime: 30 * MINUTE,
    retry: libraryRetry,
  });
}

/** Admin settings. Refetched on window focus so a second Admin's change shows up ("Changed by ..."). */
export function useOrgSettings(enabled = true) {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.orgSettings(orgKey),
    queryFn: async ({ signal }) => (await getLibraryApi()).getOrgSettings(signal),
    enabled: enabled && ready,
    staleTime: 15 * SECOND,
    gcTime: 30 * MINUTE,
    refetchOnWindowFocus: true,
    retry: libraryRetry,
  });
}

export function useLibraryMembers(enabled = true) {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.members(orgKey),
    queryFn: async ({ signal }) => (await getLibraryApi()).listMembers(signal),
    enabled: enabled && ready,
    staleTime: MINUTE,
    retry: libraryRetry,
  });
}

/** Whether the signed-in person has a removal waiting for their answer (the locked transfer question). */
export function useMyRemoval() {
  const { orgKey, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.myRemoval(orgKey),
    enabled: ready,
    queryFn: async ({ signal }) => (await getLibraryApi()).getMyRemoval(signal),
    staleTime: MINUTE,
    retry: libraryRetry,
  });
}

/** Share dialog typeahead over workspace members. */
export function useLibraryPeople(query: string, enabled: boolean) {
  const { orgKey, orgId, ready } = useLibraryViewer();
  return useQuery({
    queryKey: libraryKeys.people(orgKey, query),
    queryFn: async ({ signal }) => (await getLibraryApi()).listPeople(orgId, query, signal),
    enabled: enabled && ready,
    staleTime: MINUTE,
    placeholderData: keepPreviousData,
    retry: libraryRetry,
  });
}
