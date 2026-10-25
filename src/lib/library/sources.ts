// Pure logic for Library inside a chat and a routine: citation chips, the Sources panel, sent-file
// chips, the save prompt, the delete-chat file list and the routine notes. Typed against the chat
// contract in docs v2/library (02 section "Citations", 04 sections 5 and 5b): the stream sends
// citations as `{ fileId, locator }`, `sourceEvents` when access changes mid-chat, `groundedness`
// on the answer, `savedFileIds` after a send and `ask_save` in "Ask each time" mode. Most of these
// do not exist on the backend yet; the components that use them stay inert until they do.

import { LIBRARY_FILE_ROUTE } from "@/lib/routes";
import { citeQuery, formatTimestamp } from "./cite";
import { formatDateTime } from "./format";
import { CHAT_MESSAGES, MESSAGES } from "./messages";
import type { CiteLocator, Format } from "./schemas";

// ── Contract shapes (proposed; add to SSE_EVENTS v2.md with the backend) ─────────

/** One Library citation on an answer. A citation that failed server-side verification never arrives. */
export type LibraryCitation = { fileId: string; locator?: CiteLocator | null };

/** Access or deletion changed since the file was used in this chat (re-checked on the next message). */
export type SourceEvent = { fileId: string; state: "removed" | "locked" };

export type Groundedness = "grounded" | "partial" | "none";

/** "Ask each time": the files on a sent message waiting for Save or Don't save. */
export type AskSaveEvent = { messageId: string; fileIds: string[] };

/**
 * What a chat may show about a file. Mirrors `GET /library/files/names?ids=`: a title only when the
 * viewer may open it, otherwise only the state, so a locked or deleted file never leaks its name.
 */
export type FileRef =
  | {
      id: string;
      state: "open";
      title: string;
      format: Format;
      extension?: string;
      /** Files still on their way in (composer and just-sent messages only). */
      phase?: "uploading" | "processing" | "ready";
      createdAt?: string;
      /** True for a chat Output or run output (made by Souvenir). */
      generated?: boolean;
    }
  | { id: string; state: "locked" }
  | { id: string; state: "deleted" };

export type OpenFileRef = Extract<FileRef, { state: "open" }>;

export function isOpenRef(ref: FileRef | undefined): ref is OpenFileRef {
  return ref?.state === "open";
}

// ── Citations ────────────────────────────────────────────────────────────────

/** The File page with the passage, row or time highlighted. */
export function citationHref(fileId: string, locator?: CiteLocator | null): string {
  const base = LIBRARY_FILE_ROUTE(fileId);
  return locator ? `${base}?${citeQuery(locator)}` : base;
}

/** Chip text: the file name only; an audio citation adds the time ("Supplier call - Acme, 0:42"). Never a title for a locked or deleted file. */
export function citationLabel(ref: FileRef, locator?: CiteLocator | null): string {
  if (ref.state === "deleted") return CHAT_MESSAGES.fileDeleted;
  if (ref.state === "locked") return CHAT_MESSAGES.lockedFile;
  if (locator?.type === "time" && /^\d+$/.test(locator.value)) return `${ref.title}, ${formatTimestamp(Number(locator.value))}`;
  return ref.title;
}

/** Apply `sourceEvents` from the stream: removed reads as deleted, lost access as locked. Earlier answers keep their text; only chips change. */
export function applySourceEvents(refs: Record<string, FileRef>, events: SourceEvent[]): Record<string, FileRef> {
  if (events.length === 0) return refs;
  const next = { ...refs };
  for (const event of events) next[event.fileId] = { id: event.fileId, state: event.state === "removed" ? "deleted" : "locked" };
  return next;
}

// ── Sources panel ────────────────────────────────────────────────────────────

export type SourceStatus = "deleted" | "locked" | "processing" | "cited" | "attached" | "found";

export type SourceRow = {
  id: string;
  ref: FileRef | undefined;
  status: SourceStatus;
  off: boolean;
  /** Visible name: the title, or "File deleted" / "Locked file". */
  name: string;
  /** Line under the name. */
  detail: string;
  /** Only files the viewer can open can be switched off. */
  canToggle: boolean;
};

export type SourcesInput = {
  /** Files in the chat's scope (attached or found in Library), in the order they came in. */
  scopeIds: string[];
  /** Files any answer cited. */
  citedIds: string[];
  /** Files a person attached to a message. */
  attachedIds: string[];
  /** Files switched off for this chat. */
  offIds: string[];
  refs: Record<string, FileRef>;
  now?: number;
  timeZone?: string;
};

const STATUS_DETAIL: Record<SourceStatus, string> = {
  deleted: CHAT_MESSAGES.deleted,
  locked: CHAT_MESSAGES.lockedFileTip,
  processing: CHAT_MESSAGES.processing,
  cited: CHAT_MESSAGES.citedInAnswer,
  attached: CHAT_MESSAGES.attached,
  found: CHAT_MESSAGES.foundInLibrary,
};

/** Every file in the chat (scope first, then cited), once, each marked the way the prototype marks it. */
export function buildSourceRows(input: SourcesInput): SourceRow[] {
  const ids = Array.from(new Set([...input.scopeIds, ...input.citedIds]));
  const cited = new Set(input.citedIds);
  const attached = new Set(input.attachedIds);
  const off = new Set(input.offIds);
  const titles = ids.map((id) => {
    const ref = input.refs[id];
    return isOpenRef(ref) ? ref.title : null;
  });
  return ids.map((id, index) => {
    const ref = input.refs[id];
    const status: SourceStatus =
      !ref || ref.state === "deleted" ? "deleted" :
      ref.state === "locked" ? "locked" :
      ref.phase && ref.phase !== "ready" ? "processing" :
      cited.has(id) ? "cited" :
      attached.has(id) ? "attached" :
      "found";
    const open = isOpenRef(ref);
    const isOff = open && off.has(id);
    // Two files with the same name (duplicates are kept, PRD) are told apart by when they were added.
    const twin = open && titles.some((title, other) => other !== index && title === ref.title);
    const at = twin && open && ref.createdAt ? ` · ${formatDateTime(ref.createdAt, input.now, input.timeZone)}` : "";
    return {
      id,
      ref,
      status,
      off: isOff,
      name: open ? ref.title : status === "locked" ? CHAT_MESSAGES.lockedFile : CHAT_MESSAGES.fileDeleted,
      detail: isOff ? CHAT_MESSAGES.offForThisChat : `${STATUS_DETAIL[status]}${at}`,
      canToggle: open,
    };
  });
}

/** The header button count: distinct files in scope or cited. */
export function sourcesCount(scopeIds: string[], citedIds: string[]): number {
  return new Set([...scopeIds, ...citedIds]).size;
}

export function toggleSourceOff(offIds: string[], fileId: string): string[] {
  return offIds.includes(fileId) ? offIds.filter((id) => id !== fileId) : [...offIds, fileId];
}

/** Distinct cited file ids across answers, first citation first. */
export function citedFileIds(citations: LibraryCitation[]): string[] {
  return Array.from(new Set(citations.map((citation) => citation.fileId)));
}

// ── Sent files, save prompt, delete chat ─────────────────────────────────────

export type SentFileView =
  | { kind: "deleted"; label: string }
  | { kind: "locked"; label: string }
  | { kind: "open"; label: string; status: string | null };

export function sentFileView(ref: FileRef | undefined): SentFileView {
  if (!ref || ref.state === "deleted") return { kind: "deleted", label: CHAT_MESSAGES.fileDeleted };
  if (ref.state === "locked") return { kind: "locked", label: CHAT_MESSAGES.lockedFile };
  const status = ref.phase === "uploading" ? CHAT_MESSAGES.uploading : ref.phase === "processing" ? CHAT_MESSAGES.processing : null;
  return { kind: "open", label: ref.title, status };
}

export function askSaveTitle(count: number): string {
  return count === 1 ? "Save 1 file to Library?" : `Save ${count} files to Library?`;
}

export type AutoSaveMode = "always" | "ask" | "never";

/** What happens to staged files on send. Mirrors the server's promotion rule; the server decides, this only labels it. */
export function saveOutcome(input: { mode: AutoSaveMode; forcedOff: boolean; dontSaveChat: boolean }): { action: "save" | "ask" | "keep"; message: string | null } {
  if (input.dontSaveChat) return { action: "keep", message: CHAT_MESSAGES.notSavedDontSave };
  if (input.forcedOff) return { action: "keep", message: MESSAGES.adminTurnedAutoSaveOff };
  if (input.mode === "always") return { action: "save", message: null };
  if (input.mode === "ask") return { action: "ask", message: null };
  return { action: "keep", message: CHAT_MESSAGES.notSavedNever };
}

function plural(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

/** "1 saved file stays in Library." / "3 saved files stay in Library." */
export function savedFilesLine(count: number): string {
  return `${count} saved ${count === 1 ? "file stays" : "files stay"} in Library.`;
}

/** The toast after Delete chat. */
export function deleteChatToast(savedCount: number, alsoFiles: boolean): string {
  if (savedCount === 0) return CHAT_MESSAGES.chatDeleted;
  return alsoFiles ? `Chat deleted. ${plural(savedCount, "file")} in Trash.` : `Chat deleted. ${plural(savedCount, "file")} ${savedCount === 1 ? "stays" : "stay"} in Library.`;
}

// ── Routines ─────────────────────────────────────────────────────────────────

/** An attached file as the routine owner sees it. `title` is kept for a file in Trash (the owner knew it). */
export type RoutineAttachment = { id: string; state: "ok" | "trashed" | "deleted" | "locked"; title?: string; format?: Format };

export function isUnavailable(file: RoutineAttachment): boolean {
  return file.state !== "ok";
}

/** "Return policy 2026 is unavailable. The next run skips it." */
export function unavailableNote(files: RoutineAttachment[]): string | null {
  const gone = files.filter(isUnavailable);
  if (gone.length === 0) return null;
  const names = gone.map((file) => file.title ?? CHAT_MESSAGES.aDeletedFile).join(", ");
  const one = gone.length === 1;
  return `${names} ${one ? "is" : "are"} unavailable. The next run skips ${one ? "it" : "them"}.`;
}

/** The attached-files row text: the name (marked when in Trash), and its type or the skip note. */
export function attachmentRowText(file: RoutineAttachment, formatName: (format: Format) => string): { name: string; detail: string } {
  if (file.state === "ok") return { name: file.title ?? "", detail: file.format ? formatName(file.format) : "" };
  const name = !file.title ? CHAT_MESSAGES.aDeletedFile : file.state === "trashed" ? `${file.title} (in Trash)` : file.title;
  return { name, detail: CHAT_MESSAGES.nextRunSkipsIt };
}

export type RunKind = "output" | "message" | "test" | "fail";

export function runKindLabel(kind: RunKind): string {
  switch (kind) {
    case "fail":
      return "Failed";
    case "test":
      return "Test run";
    case "message":
      return "Message sent";
    default:
      return "Saved a Run output";
  }
}
