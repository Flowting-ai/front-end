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
  remove: (chatId: string) => Promise<void>;
  star: (chatId: string) => Promise<void>;
  addOptimistic: (chat: Chat) => void;
}

export function useChatHistory(): UseChatHistoryResult {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadingRef = useRef(false);

  const loadChats = async (reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      const cursor = reset ? undefined : cursorRef.current;
      const res = await listChats(cursor);
      setChats((prev) => (reset ? res.chats : [...prev, ...res.chats]));
      cursorRef.current = res.next_cursor ?? undefined;
      setHasMore(res.has_more);
    } catch {
      // Silent — sidebar missing chats is non-fatal
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
      await starChat(chatId, next);
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

  return {
    chats,
    isLoading,
    hasMore,
    loadMore: () => loadChats(false),
    refresh: () => loadChats(true),
    create: handleCreate,
    rename: handleRename,
    remove: handleDelete,
    star: handleStar,
    addOptimistic,
  };
}
