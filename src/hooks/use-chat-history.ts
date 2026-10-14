"use client";

import { usePathname } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listChats,
  createChat,
  renameChat,
  deleteChat,
  starChat,
  archiveChat,
} from "@/lib/api/chat";
import {
  flattenChats,
  isPlaceholderTitle,
  nextChatCursor,
  patchChat,
  prependChat,
  removeChats,
  type ChatPages,
} from "@/lib/chat/chat-history-cache";
import { queryKeys } from "@/lib/query-keys";
import { STALE_STATIC_MS } from "@/lib/query-policy";
import type { Chat } from "@/types/chat";

export interface UseChatHistoryResult {
  chats: Chat[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  create: (model?: string) => Promise<Chat | null>;
  rename: (chatId: string, title: string) => Promise<void>;
  renameLocal: (chatId: string, title: string) => void;
  /** Move a chat to the top of the list without resetting its title. */
  moveToTop: (chatId: string) => void;
  /** Returns true on success, false on failure (already toasted internally) — lets
   *  per-row callers show their own success toast only when the delete actually happened. */
  remove: (chatId: string) => Promise<boolean>;
  /** Remove one or more chats from the local list without calling the backend delete API. */
  removeLocal: (...chatIds: string[]) => void;
  star: (chatId: string) => Promise<void>;
  /** Returns true on success, false on failure (already toasted internally).
   *  Flips visibility in place rather than removing the chat — archiving is
   *  one-way (no unarchive endpoint exists yet), but the chat must stay in
   *  this list for the Archived tab (and any other consumer) to see it. */
  archive: (chatId: string) => Promise<boolean>;
  addOptimistic: (chat: Chat) => void;
  /** Fetch the backend title for a specific chat and update local state if it has changed. */
  refreshChatTitle: (chatId: string) => Promise<void>;
}

const LIST_KEY = queryKeys.chats.list();

/**
 * The sidebar chat list. Server state is one React Query infinite query
 * (GET /chats pages), so every caller shares the same data and requests; the
 * pure page operations live in lib/chat/chat-history-cache.ts. Optimistic
 * writes cancel an in-flight page fetch first and roll back only the chat they
 * touched.
 */
export function useChatHistory(): UseChatHistoryResult {
  const qc = useQueryClient();

  // Settings pages never show the chat list, so keep it off their first-paint connections
  // (88 KB, the slowest shell call); it loads as soon as the user leaves /settings.
  const onSettings = (usePathname() ?? "").startsWith("/settings");
  const query = useInfiniteQuery({
    queryKey: LIST_KEY,
    queryFn: ({ pageParam }) => listChats(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextChatCursor,
    enabled: !onSettings,
    // Every loaded page refetches together, and this is the heaviest shell call,
    // so keep the old cost: load once, refresh on demand (refresh()), not on focus.
    staleTime: STALE_STATIC_MS,
    refetchOnWindowFocus: false,
  });
  const chats = flattenChats(query.data as ChatPages | undefined);

  const write = (fn: (data: ChatPages | undefined) => ChatPages | undefined) =>
    qc.setQueryData<ChatPages>(LIST_KEY, fn);
  const findChat = (chatId: string) => flattenChats(qc.getQueryData<ChatPages>(LIST_KEY)).find((c) => c.id === chatId);
  /** Stop a page fetch that would land after (and overwrite) an optimistic write. */
  const hold = () => qc.cancelQueries({ queryKey: LIST_KEY, exact: true });

  const handleCreate = async (model?: string): Promise<Chat | null> => {
    try {
      const chat = await createChat(model);
      await hold();
      write((data) => prependChat(data, chat.id, chat));
      return chat;
    } catch {
      toast.error("Failed to create chat");
      return null;
    }
  };

  const handleRename = async (chatId: string, title: string): Promise<void> => {
    const rollback = findChat(chatId)?.title ?? title;
    await hold();
    write((data) => patchChat(data, chatId, { title }));
    try {
      await renameChat(chatId, title);
      toast.success("Chat renamed");
    } catch {
      write((data) => patchChat(data, chatId, { title: rollback }));
      toast.error("Failed to rename chat");
    }
  };

  const handleDelete = async (chatId: string): Promise<boolean> => {
    const snapshot = qc.getQueryData<ChatPages>(LIST_KEY);
    await hold();
    write((data) => removeChats(data, [chatId]));
    try {
      await deleteChat(chatId);
      return true;
    } catch {
      qc.setQueryData(LIST_KEY, snapshot);
      toast.error("Failed to delete chat");
      return false;
    }
  };

  const handleStar = async (chatId: string): Promise<void> => {
    const chat = findChat(chatId);
    if (!chat) return;
    const next = !chat.starred;
    await hold();
    write((data) => patchChat(data, chatId, { starred: next }));
    try {
      await starChat(chatId);
      toast.success(next ? "Chat pinned" : "Chat unpinned");
    } catch {
      write((data) => patchChat(data, chatId, { starred: !next }));
      toast.error("Failed to update pin");
    }
  };

  const handleArchive = async (chatId: string): Promise<boolean> => {
    const rollback = findChat(chatId)?.visibility;
    await hold();
    write((data) => patchChat(data, chatId, { visibility: "archived" }));
    try {
      await archiveChat(chatId);
      toast.success("Chat archived");
      return true;
    } catch {
      write((data) => patchChat(data, chatId, { visibility: rollback }));
      toast.error("Failed to archive chat");
      return false;
    }
  };

  /**
   * Fetch the first page and, if this chat's title is no longer the
   * placeholder, update it in the list. Concurrent calls (the staggered 2.5 s /
   * 5 s timers) share one request through fetchQuery; a chat that already has
   * a real title is left alone.
   */
  const refreshChatTitle = async (chatId: string): Promise<void> => {
    if (!isPlaceholderTitle(findChat(chatId)?.title)) return;
    try {
      const res = await qc.fetchQuery({ queryKey: queryKeys.chats.titleProbe(), queryFn: () => listChats(undefined), staleTime: 0 });
      const found = (res.chats ?? []).find((c) => c.id === chatId);
      if (found && !isPlaceholderTitle(found.title)) write((data) => patchChat(data, chatId, { title: found.title }));
    } catch {
      // non-fatal — sidebar will show correct title on next full refresh
    }
  };

  return {
    chats,
    isLoading: query.isFetching,
    hasMore: query.hasNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refresh: () => { void query.refetch(); },
    create: handleCreate,
    rename: handleRename,
    renameLocal: (chatId, title) => write((data) => patchChat(data, chatId, { title })),
    moveToTop: (chatId) => write((data) => prependChat(data, chatId)),
    remove: handleDelete,
    removeLocal: (...chatIds) => write((data) => removeChats(data, chatIds)),
    star: handleStar,
    archive: handleArchive,
    addOptimistic: (chat) => write((data) => prependChat(data, chat.id, chat)),
    refreshChatTitle,
  };
}
