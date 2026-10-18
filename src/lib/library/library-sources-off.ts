// Library files switched off in a chat's Sources panel, per chat. Every message of that chat sends the
// list (`librarySourcesOff`) so the backend leaves those files out of the answer. The backend is meant
// to keep the list itself (LIBRARY_FLOW_A_BACKEND_TICKET.md Part 3 A10); until it does, this copy lives in
// sessionStorage so a reload in the same tab keeps it.

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
