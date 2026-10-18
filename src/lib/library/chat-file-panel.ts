// The file panel beside a chat, opened from a locked citation chip. One panel per page; the chat that
// owns it closes it when the chat changes. Reads go through useSyncExternalStore, never the variable.

let openFileId: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getChatFilePanel(): string | null {
  return openFileId;
}

export function openChatFilePanel(fileId: string): void {
  if (openFileId === fileId) return;
  openFileId = fileId;
  emit();
}

export function closeChatFilePanel(): void {
  if (openFileId === null) return;
  openFileId = null;
  emit();
}

export function subscribeChatFilePanel(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
