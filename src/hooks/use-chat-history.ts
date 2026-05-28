"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  listChats,
  createChat,
  renameChat,
  deleteChat,
  starChat,
} from "@/lib/api/chat";
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
  remove: (chatId: string) => Promise<void>;
  /** Remove one or more chats from the local list without calling the backend delete API. */
  removeLocal: (...chatIds: string[]) => void;
  star: (chatId: string) => Promise<void>;
  addOptimistic: (chat: Chat) => void;
  /** Fetch the backend title for a specific chat and update local state if it has changed. */
  refreshChatTitle: (chatId: string) => Promise<void>;
}

export function useChatHistory(): UseChatHistoryResult {
  const [chats, setChats] = useState<Chat[]>([]);
  // eslint-disable-next-line react-doctor/rendering-usetransition-loading -- guards async fetch, not a state transition
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadingRef = useRef(false);
  // Mirrors `chats` synchronously so refreshChatTitle can read current state
  // without stale-closure issues inside async callbacks / setTimeout handlers.
  const chatsRef = useRef<Chat[]>(chats);
  useEffect(() => { chatsRef.current = chats }, [chats]);

  const loadChats = async (reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      const cursor = reset ? undefined : cursorRef.current;
      const res = await listChats(cursor);
      // Exclude chats linked to a project — those belong to their project page,
      // not the global chat list. project_id is set by the backend when a chat
      // is successfully linked via POST /projects/{id}/chats/{chat_id}.
      const incoming = (res.chats ?? []).filter((c) => !c.project_id);
      setChats((prev) => {
        if (reset) return incoming;
        // Deduplicate: skip entries that are already present in `prev`
        const prevIds = new Set(prev.map((c) => c.id));
        return [...prev, ...incoming.filter((c) => !prevIds.has(c.id))];
      });
      cursorRef.current = res.next_cursor ?? undefined;
      setHasMore(res.has_more ?? false);
    } catch {
      // Silent - sidebar missing chats is non-fatal
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChats(true);
  }, []);

  const handleCreate = async (model?: string): Promise<Chat | null> => {
    try {
      const chat = await createChat(model);
      setChats((prev) => [chat, ...prev]);
      return chat;
    } catch {
      toast.error("Failed to create chat");
      return null;
    }
  };

  const handleRename = async (chatId: string, title: string): Promise<void> => {
    const rollback = chats.find((c) => c.id === chatId)?.title ?? title;
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title } : c)),
    );
    try {
      await renameChat(chatId, title);
    } catch {
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title: rollback } : c)),
      );
      toast.error("Failed to rename chat");
    }
  };

  const handleDelete = async (chatId: string): Promise<void> => {
    const snapshot = chats;
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    try {
      await deleteChat(chatId);
    } catch {
      setChats(snapshot);
      toast.error("Failed to delete chat");
    }
  };

  const handleStar = async (chatId: string): Promise<void> => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    const next = !chat.starred;
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, starred: next } : c)),
    );
    try {
      await starChat(chatId);
    } catch {
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, starred: !next } : c)),
      );
      toast.error("Failed to update star");
    }
  };

  const addOptimistic = (chat: Chat) => {
    setChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)]);
  };

  /**
   * Fetch the first page of chats from the backend and, if the title of the
   * given chat has been updated (i.e. is no longer the placeholder "New chat"),
   * update it locally.  Intentionally bypasses the loadingRef lock so it can
   * run concurrently with an ongoing sidebar load.
   *
   * Bails out early when local state already has a real title — prevents the
   * staggered second timeout (5 s) from firing a redundant listChats() after
   * the first timeout (2.5 s) already resolved it.
   */
  const refreshChatTitle = async (chatId: string): Promise<void> => {
    const current = chatsRef.current.find((c) => c.id === chatId);
    if (current?.title && current.title !== "New chat" && current.title !== "Untitled") return;
    try {
      const res = await listChats(undefined);
      const found = (res.chats ?? []).find((c) => c.id === chatId);
      if (
        found?.title &&
        found.title !== "New chat" &&
        found.title !== "Untitled"
      ) {
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, title: found.title } : c)),
        );
      }
    } catch {
      // non-fatal — sidebar will show correct title on next full refresh
    }
  };

  const renameLocal = (chatId: string, title: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title } : c)),
    );
  };

  const removeLocal = (...chatIds: string[]) => {
    const idSet = new Set(chatIds)
    setChats((prev) => prev.filter((c) => !idSet.has(c.id)))
  };

  const moveToTop = (chatId: string) => {
    setChats((prev) => {
      const existing = prev.find((c) => c.id === chatId);
      if (!existing) return prev;
      return [existing, ...prev.filter((c) => c.id !== chatId)];
    });
  };

  return {
    chats,
    isLoading,
    hasMore,
    loadMore: () => loadChats(false),
    refresh: () => loadChats(true),
    create: handleCreate,
    rename: handleRename,
    renameLocal,
    moveToTop,
    remove: handleDelete,
    removeLocal,
    star: handleStar,
    addOptimistic,
    refreshChatTitle,
  };
}
