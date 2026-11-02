// Library files switched off in a chat's Sources panel, per chat. Every message of that chat sends the
// list (`librarySourcesOff`, an empty list too once the chat has one) and the backend stores it on the chat
// and leaves those files out of the answer (since 25 Oct). `GET /chats/{id}` returns the stored list, which
// seeds this copy when the chat opens. A switch flipped since the last send lives only here until the next
// message, so it is kept in sessionStorage and a reload in the same tab keeps it.

const STORAGE_KEY = "library:v1:sources-off";
const EMPTY: readonly string[] = Object.freeze([]);
const listeners = new Set<() => void>();
let byChat: Record<string, readonly string[]> = load();

function load(): Record<string, readonly string[]> {
  try {
    const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, ids]) => Array.isArray(ids) && ids.every((id) => typeof id === "string"))) as Record<string, readonly string[]>;
  } catch {
    return {};
  }
}

export function getSourcesOff(chatId: string): readonly string[] {
  return byChat[chatId] ?? EMPTY;
}

/** Whether the chat has a list at all (an empty one included), so a send can clear the server's copy. */
export function hasSourcesOff(chatId: string): boolean {
  return chatId in byChat;
}

/** The server's stored list, used unless this tab already holds a newer one. */
export function seedSourcesOff(chatId: string, ids: readonly string[]): void {
  if (!chatId || hasSourcesOff(chatId) || ids.length === 0) return;
  setSourcesOff(chatId, ids);
}

export function setSourcesOff(chatId: string, ids: readonly string[]): void {
  if (!chatId) return;
  byChat = { ...byChat, [chatId]: ids };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(byChat));
  } catch {
    // Storage blocked: the list still holds for this page.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSourcesOff(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
