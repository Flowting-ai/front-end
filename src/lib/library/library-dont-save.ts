// "Don't save files from this chat" (the chat's More menu), per chat. Files sent in such a chat go with
// `saveToLibrary=false` and the sender sees "Not saved. This chat doesn't save files." The backend keeps
// it on the chat (`GET`/`PATCH /chats/{id}` `libraryDontSave`, and it refuses to list a file from such a
// chat whatever the send says). This module is the in-page copy the menu and the send read from.

import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { apiFetchJson } from "@/lib/api/client";
import { CHAT_DELETE_ENDPOINT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { CHAT_MESSAGES } from "./messages";

type ChatLibraryState = { id: string; libraryDontSave: boolean };

const listeners = new Set<() => void>();
let chats: ReadonlyMap<string, boolean> = new Map();
const loading = new Set<string>();

function write(chatId: string, on: boolean): void {
  const next = new Map(chats);
  next.set(chatId, on);
  chats = next;
  listeners.forEach((listener) => listener());
}

/** A real chat id (not the composer's "temp-" placeholder before the first send). */
function isSavedChat(chatId: string | undefined): chatId is string {
  return !!chatId && !chatId.startsWith("temp-");
}

export function isDontSaveChat(chatId: string | undefined): boolean {
  return !!chatId && chats.get(chatId) === true;
}

/** Reads the chat's value from the server once per page. */
async function load(chatId: string): Promise<void> {
  if (loading.has(chatId) || chats.has(chatId)) return;
  loading.add(chatId);
  try {
    const state = await apiFetchJson<ChatLibraryState>(CHAT_DELETE_ENDPOINT(chatId));
    if (!chats.has(chatId)) write(chatId, state.libraryDontSave === true);
  } catch (error) {
    // Not the caller's chat, or the backend is down: leave it off, as the server would.
    logger.warn("[library] could not read Don't save for chat", { chatId, error });
  } finally {
    loading.delete(chatId);
  }
}

/** Turns the setting on or off. The menu flips at once and flips back if the server refuses. */
export async function setDontSaveChat(chatId: string, on: boolean): Promise<void> {
  const before = isDontSaveChat(chatId);
  write(chatId, on);
  if (!isSavedChat(chatId)) return;
  try {
    const state = await apiFetchJson<ChatLibraryState>(CHAT_DELETE_ENDPOINT(chatId), {
      method: "PATCH",
      body: JSON.stringify({ libraryDontSave: on }),
    });
    write(chatId, state.libraryDontSave === true);
  } catch {
    write(chatId, before);
    toast.error(CHAT_MESSAGES.dontSaveFailed);
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDontSaveChat(chatId: string | undefined): boolean {
  useEffect(() => {
    if (isSavedChat(chatId)) void load(chatId);
  }, [chatId]);
  return useSyncExternalStore(subscribe, () => isDontSaveChat(chatId), () => false);
}
