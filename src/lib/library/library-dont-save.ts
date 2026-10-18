// "Don't save files from this chat" (the chat's More menu), per chat. Files sent in such a chat go with
// `saveToLibrary=false` and the sender sees "Not saved. This chat doesn't save files." The backend is
// meant to keep this per chat (LIBRARY_FLOW_A_BACKEND_TICKET.md Part 3 A14); until it does, this copy
// lives in localStorage for this browser.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "library:v1:dont-save-chats";
const listeners = new Set<() => void>();
let chats: ReadonlySet<string> = load();

function load(): ReadonlySet<string> {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function isDontSaveChat(chatId: string | undefined): boolean {
  return !!chatId && chats.has(chatId);
}

export function setDontSaveChat(chatId: string, on: boolean): void {
  const next = new Set(chats);
  if (on) next.add(chatId);
  else next.delete(chatId);
  chats = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Storage blocked: the setting still holds for this page.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDontSaveChat(chatId: string | undefined): boolean {
  return useSyncExternalStore(subscribe, () => isDontSaveChat(chatId), () => false);
}
