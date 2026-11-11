/**
 * Hands a Library file to the new-chat page. A File cannot travel in a URL or sessionStorage, so it waits
 * here, in memory, for the one client-side navigation that follows. The chat page takes it once.
 */
export interface LibraryChatHandoff {
  /** The file as a File, or null when it could not be fetched (the chat then opens without it). */
  file: File | null
  /** What the person typed; empty when they only asked to start a chat about the file. */
  text: string
}

let pending: LibraryChatHandoff | null = null

export function stashLibraryChat(handoff: LibraryChatHandoff): void {
  pending = handoff
}

/** Returns the waiting hand-off and clears it, so a reload or a back-navigation never replays it. */
export function takeLibraryChat(): LibraryChatHandoff | null {
  const handoff = pending
  pending = null
  return handoff
}
