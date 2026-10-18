"use client";

// Bridges the chat composer's attachments (PendingAttachment, one File each) to the Library upload
// queue. A file starts uploading into Library the moment it is attached, so its chip can show
// Uploading, then Processing, and Send waits until it is ready. The upload is keyed by the File
// object itself, so a file attached on the new-chat screen keeps its upload when the landing page
// hands the same File to ChatInterface. At send time the ready files go as `libraryFileIds`; a file
// whose upload failed is never sent (it left the draft with a message), and a file with no Library
// upload at all (a composer that never started one) still rides as bytes.

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { PendingAttachment } from "@/hooks/use-file-upload";
import { trackLibrary } from "../analytics";
import { sizeBucket } from "../observability";
import { getUploadController } from "./controller";
import { isInFlight, type UploadItem } from "./machine";
import { uploadStore, useDraftUploads } from "./store";

const DRAFT_KEY = "chat-composer";
const uploadIdByFile = new WeakMap<File, string>();

function itemFor(file: File): UploadItem | undefined {
  const id = uploadIdByFile.get(file);
  return id ? uploadStore.get(id) : undefined;
}

// Files picked with "Add from Library" are already Library files: they ride the composer as an empty
// placeholder File (so the chip strip and the hand-off to ChatInterface work unchanged), are never
// uploaded, and go out by id.
const pickedIdByFile = new WeakMap<File, string>();
const pickedSizeByFile = new WeakMap<File, number>();

/** The composer attachment for a file picked from Library. */
export function libraryPickAsFile(picked: { id: string; name: string; sizeBytes: number }): File {
  const file = new File([], picked.name);
  pickedIdByFile.set(file, picked.id);
  pickedSizeByFile.set(file, picked.sizeBytes);
  return file;
}

/** The Library id of a picked attachment, or undefined for a file from the device. */
export function pickedLibraryFileId(file: File): string | undefined {
  return pickedIdByFile.get(file);
}

/** Size to show on the chip: a picked file's real size, not its empty placeholder's. */
export function attachmentSizeBytes(file: File): number {
  return pickedSizeByFile.get(file) ?? file.size;
}

// The auto-save answer for a file's message (useSaveChoice): true = save to Library, false = keep in the chat.
const saveChoiceByFile = new WeakMap<File, boolean>();

export function markSaveChoice(files: readonly File[], save: boolean): void {
  for (const file of files) saveChoiceByFile.set(file, save);
}

/** The Library format of an attached file once its upload has validated it, for the "Save to Library?" list. */
export function composerUploadFormat(file: File) {
  return itemFor(file)?.format ?? null;
}

/**
 * Splits a turn's files into the Library ids of the ready uploads and the files that must still go as
 * bytes, plus the auto-save answer when one was given (false if any file is to stay in the chat).
 */
export function libraryRefsFor(files: readonly File[]): { libraryFileIds: string[]; files: File[]; saveToLibrary?: boolean } {
  const libraryFileIds: string[] = [];
  const rest: File[] = [];
  const choices: boolean[] = [];
  for (const file of files) {
    const picked = pickedIdByFile.get(file);
    if (picked) {
      libraryFileIds.push(picked);
      continue;
    }
    const item = itemFor(file);
    // Refused or cancelled: never sent (not even as bytes) and never saved.
    if (item?.status === "failed" || item?.status === "cancelled") continue;
    if (item?.status === "ready" && item.fileId) libraryFileIds.push(item.fileId);
    else rest.push(file);
    const choice = saveChoiceByFile.get(file);
    if (choice !== undefined) choices.push(choice);
  }
  const saveToLibrary = choices.length === 0 ? undefined : choices.every(Boolean);
  return { libraryFileIds, files: rest, saveToLibrary };
}

/** Clears the refusal messages above the composer (opening the + menu does this). */
export function clearComposerNotices(): void {
  const controller = getUploadController();
  for (const item of uploadStore.forDraft(DRAFT_KEY)) if (item.status === "failed") controller.forget(item.id);
}

/** Cancels the upload of an attachment removed with its X. */
export function cancelComposerUpload(file: File): void {
  const id = uploadIdByFile.get(file);
  if (!id) return;
  const item = uploadStore.get(id);
  if (item && isInFlight(item.status)) getUploadController().cancel(id);
  uploadIdByFile.delete(file);
}

/**
 * Starts a Library upload for every attachment that has none yet and returns the attachments with
 * their live upload state, plus whether Send must wait. A refused upload (unsupported, unsafe,
 * too large, unreadable, password-protected) leaves the draft: its chip goes and `notices` carries the
 * one-line message for UploadNotices, which never names the file and clears after six seconds.
 *
 * `chatId`: the open chat, so the file records where it was uploaded (its "Uploaded by You, <chat>" line).
 * A new chat has no id yet; the backend links those on send (LIBRARY_FLOW_A_BACKEND_TICKET.md Part 3 A5).
 */
export function useComposerUploads(
  attachments: readonly PendingAttachment[],
  setAttachments: Dispatch<SetStateAction<PendingAttachment[]>>,
  chatId?: string,
): {
  attachments: PendingAttachment[];
  uploadsBusy: boolean;
  notices: { items: readonly UploadItem[]; onDismiss: (id: string) => void };
} {
  // Re-render whenever an upload in the composer changes status or progress.
  const items = useDraftUploads(DRAFT_KEY);

  useEffect(() => {
    const controller = getUploadController();
    for (const { file } of attachments) {
      if (uploadIdByFile.has(file) || pickedIdByFile.has(file)) continue;
      uploadIdByFile.set(file, controller.start(file, { draftKey: DRAFT_KEY, chatId }));
      trackLibrary("upload_started", { sizeBucket: sizeBucket(file.size) });
    }
  }, [attachments, chatId]);

  // Read uploads from the `items` snapshot, never straight from the store: the React Compiler memoises
  // on what a callback reads, so a store read here would never re-render on progress.
  const statusOf = (file: File) => {
    const id = uploadIdByFile.get(file);
    return id ? items.find((item) => item.id === id) : undefined;
  };

  // A refused upload leaves the draft: drop its attachment (the message stays in the notices).
  useEffect(() => {
    const gone = new Set(attachments.filter(({ file }) => {
      const id = uploadIdByFile.get(file);
      const status = id ? items.find((item) => item.id === id)?.status : undefined;
      return status === "failed" || status === "cancelled";
    }).map(({ file }) => file));
    if (gone.size > 0) setAttachments((prev) => prev.filter((a) => !gone.has(a.file)));
  }, [attachments, items, setAttachments]);

  {
    const decorated = attachments.filter((attachment) => {
      const status = statusOf(attachment.file)?.status;
      return status !== "failed" && status !== "cancelled";
    }).map((attachment): PendingAttachment => {
      if (pickedIdByFile.has(attachment.file)) return { ...attachment, uploading: false, processing: false };
      const item = statusOf(attachment.file);
      // Not started yet (the effect runs after this render): already counts as uploading.
      if (!item) return { ...attachment, uploading: true, uploadProgress: 0, processing: false };
      if (!isInFlight(item.status)) return { ...attachment, uploading: false, processing: false };
      return item.status === "processing"
        ? { ...attachment, uploading: false, processing: true }
        : { ...attachment, uploading: true, uploadProgress: Math.round(item.progress * 100), processing: false };
    });
    const uploadsBusy = decorated.some((attachment) => attachment.uploading || attachment.processing);
    const notices = { items, onDismiss: (id: string) => getUploadController().forget(id) };
    return { attachments: decorated, uploadsBusy, notices };
  }
}
