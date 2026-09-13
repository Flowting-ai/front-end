"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  listBrainChats,
  renameBrainChat,
  starBrainChat,
  deleteBrainChat,
  type BrainChatListItem,
} from "@/lib/api/brain";
import {
  BRAIN_THREAD_CREATED_EVENT,
  BRAIN_THREAD_TITLE_UPDATED_EVENT,
  BRAIN_THREAD_DELETED_EVENT,
  emitBrainThreadDeleted,
  type BrainThreadEventDetail,
  type BrainThreadDeletedEventDetail,
} from "@/hooks/use-sidebar-events";

export interface UseBrainThreadsResult {
  threads: BrainChatListItem[];
  isLoading: boolean;
  rename: (chatId: string, title: string) => Promise<void>;
  star: (chatId: string) => Promise<void>;
  /** Returns true on success, false on failure (already toasted internally) — lets
   *  per-row callers run their own follow-up (e.g. navigate away) only on success. */
  remove: (chatId: string) => Promise<boolean>;
}

/**
 * Single shared source of truth for Brain threads ("Tasks") — mirrors
 * useChatHistory's shape/pattern. Both the left sidebar's Tasks section
 * (FlatBrainSidebarSections) and the /chats page's Tasks mode consume this
 * SAME state via BrainThreadContext, so a rename/pin/delete from either
 * surface is instantly visible on the other — no window-event relay needed
 * for those three actions, since it's literally the same React state.
 *
 * The window-event bus (BRAIN_THREAD_CREATED_EVENT etc., src/hooks/use-sidebar-events.ts)
 * still exists for the Brain conversation page itself (src/app/(app)/brain/page.tsx),
 * which creates a thread / learns its generated title mid-stream, outside of
 * any list-rendering component — this hook listens for those the same way the
 * old per-surface state used to, just in one place now instead of two.
 */
export function useBrainThreads(): UseBrainThreadsResult {
  const [threads, setThreads] = useState<BrainChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);

  const loadThreads = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      setThreads(await listBrainChats());
    } catch {
      setThreads([]);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    const handleCreated = (e: Event) => {
      const { chatId, title } = (e as CustomEvent<BrainThreadEventDetail>).detail;
      setThreads((prev) =>
        prev.some((t) => t.id === chatId)
          ? prev
          : [{ id: chatId, chat_title: title || "New thread", starred: false }, ...prev],
      );
    };
    const handleTitleUpdated = (e: Event) => {
      const { chatId, title } = (e as CustomEvent<BrainThreadEventDetail>).detail;
      if (!title) return;
      setThreads((prev) =>
        prev.some((t) => t.id === chatId)
          ? prev.map((t) => (t.id === chatId ? { ...t, chat_title: title } : t))
          : [{ id: chatId, chat_title: title, starred: false }, ...prev],
      );
    };
    const handleDeleted = (e: Event) => {
      const { chatId } = (e as CustomEvent<BrainThreadDeletedEventDetail>).detail;
      setThreads((prev) => prev.filter((t) => t.id !== chatId));
    };
    window.addEventListener(BRAIN_THREAD_CREATED_EVENT, handleCreated);
    window.addEventListener(BRAIN_THREAD_TITLE_UPDATED_EVENT, handleTitleUpdated);
    window.addEventListener(BRAIN_THREAD_DELETED_EVENT, handleDeleted);
    return () => {
      window.removeEventListener(BRAIN_THREAD_CREATED_EVENT, handleCreated);
      window.removeEventListener(BRAIN_THREAD_TITLE_UPDATED_EVENT, handleTitleUpdated);
      window.removeEventListener(BRAIN_THREAD_DELETED_EVENT, handleDeleted);
    };
  }, []);

  const rename = async (chatId: string, title: string): Promise<void> => {
    const rollback = threads.find((t) => t.id === chatId)?.chat_title ?? title;
    setThreads((prev) => prev.map((t) => (t.id === chatId ? { ...t, chat_title: title } : t)));
    try {
      await renameBrainChat(chatId, title);
      toast.success("Task renamed");
    } catch {
      setThreads((prev) => prev.map((t) => (t.id === chatId ? { ...t, chat_title: rollback } : t)));
      toast.error("Failed to rename task");
    }
  };

  const star = async (chatId: string): Promise<void> => {
    const thread = threads.find((t) => t.id === chatId);
    if (!thread) return;
    const next = !thread.starred;
    setThreads((prev) => prev.map((t) => (t.id === chatId ? { ...t, starred: next } : t)));
    try {
      await starBrainChat(chatId);
      toast.success(next ? "Task pinned" : "Task unpinned");
    } catch {
      setThreads((prev) => prev.map((t) => (t.id === chatId ? { ...t, starred: !next } : t)));
      toast.error("Failed to update pin");
    }
  };

  const remove = async (chatId: string): Promise<boolean> => {
    const snapshot = threads;
    setThreads((prev) => prev.filter((t) => t.id !== chatId));
    try {
      await deleteBrainChat(chatId);
      emitBrainThreadDeleted({ chatId });
      toast.success("Task deleted");
      return true;
    } catch {
      setThreads(snapshot);
      toast.error("Failed to delete task");
      return false;
    }
  };

  return { threads, isLoading, rename, star, remove };
}
