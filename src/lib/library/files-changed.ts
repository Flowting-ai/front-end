// Library files can appear without Library having done anything: a chat turn that carries files
// ("New files ride with the message; the backend adds them to Library after the turn") saves them
// on the server only. Whoever causes that announces it here, and the always-mounted
// LibraryUploadHost refreshes every Library query, so Library never shows a list from before the
// chat. A plain window event keeps the chat code free of any dependency on React Query.

export const LIBRARY_FILES_CHANGED_EVENT = "library:files-changed"

/** Call when files may have been added to (or removed from) Library by something other than Library itself. */
export function notifyLibraryFilesChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(LIBRARY_FILES_CHANGED_EVENT))
}
