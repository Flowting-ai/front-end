"use client";

// What a composer needs from the upload system, as one narrow object: the attachments of its draft,
// whether Send may be pressed, and the actions. The queue itself (store.ts) and the work
// (controller.ts) stay private to lib/library/upload; the composer never sees XHRs or part numbers.

import { toast } from "sonner";
import { trackLibrary } from "../analytics";
import { sizeBucket } from "../observability";
import { useLibraryLimits } from "../queries";
import { getUploadController } from "./controller";
import { blockingCount, canSend, isInFlight, remainingSlots, type UploadItem } from "./machine";
import { useDraftUploads } from "./store";

export type DraftUploads = {
  items: readonly UploadItem[];
  /** False while any attachment is still uploading or processing. */
  canSend: boolean;
  blocking: number;
  inFlight: boolean;
  /** Staged file ids of the ready attachments: what the chat send refers to. */
  readyFileIds: string[];
  addFiles: (files: File[]) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  /** Dismiss one attachment (a failure notice that has been read). */
  forget: (id: string) => void;
  /** The message was sent: drop the attachments of this draft. */
  release: () => void;
};

export function useLibraryUploads(draftKey: string, chatId?: string): DraftUploads {
  const items = useDraftUploads(draftKey);
  const limits = useLibraryLimits();
  const max = limits.data?.maxFilesPerMessage ?? 10;
  const controller = getUploadController();

  return {
    items,
    canSend: canSend(items),
    blocking: blockingCount(items),
    inFlight: items.some((item) => isInFlight(item.status)),
    readyFileIds: items.flatMap((item) => (item.status === "ready" && item.fileId ? [item.fileId] : [])),
    addFiles: (files) => {
      const room = remainingSlots(items, max);
      const accepted = files.slice(0, room);
      if (accepted.length < files.length) toast.error(`You can attach up to ${max} files to a message.`);
      for (const file of accepted) {
        controller.start(file, { draftKey, chatId });
        trackLibrary("upload_started", { sizeBucket: sizeBucket(file.size) });
      }
    },
    cancel: (id) => controller.cancel(id),
    retry: (id) => controller.retry(id),
    forget: (id) => controller.forget(id),
    release: () => controller.release(draftKey),
  };
}
