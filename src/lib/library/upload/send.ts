"use client";

// The chat send's way into Library: every file picked in a composer becomes a Library file before the
// message goes, and the message refers to those files by id. The bytes go straight to storage through
// the upload controller (parts, retries, processing poll); this only waits for them to finish.

import { UPLOAD_FAILURE_MESSAGES } from "../messages";
import { getUploadController } from "./controller";
import { uploadStore } from "./store";
import type { UploadItem } from "./machine";

export class UploadFailed extends Error {
  constructor(readonly items: UploadItem[]) {
    super(items.map((item) => `${item.name}: ${UPLOAD_FAILURE_MESSAGES[item.failure ?? "unreadable"]}`).join(" "));
    this.name = "UploadFailed";
  }
}

const settled = (item: UploadItem) => item.status === "ready" || item.status === "failed" || item.status === "cancelled";

/**
 * Uploads `files` into Library and resolves with their file ids, in order, once every one is ready.
 * `onProgress` gets 0 to 100 over the bytes sent. Rejects with UploadFailed when any file is refused.
 */
export function uploadForSend(files: File[], options: { chatId?: string; onProgress?: (percent: number) => void } = {}): Promise<string[]> {
  if (files.length === 0) return Promise.resolve([]);
  const controller = getUploadController();
  const draftKey = `send:${crypto.randomUUID()}`;
  const ids = files.map((file) => controller.start(file, { draftKey, chatId: options.chatId }));
  return new Promise((resolve, reject) => {
    const check = () => {
      // An attachment that left the store (cancelled elsewhere) counts as settled and not ready.
      const current = ids.map((id) => uploadStore.get(id));
      const items = current.filter((item): item is UploadItem => item !== undefined);
      const total = items.reduce((sum, item) => sum + item.sizeBytes, 0);
      const sent = items.reduce((sum, item) => sum + item.sizeBytes * (settled(item) || item.status === "processing" ? 1 : item.progress), 0);
      options.onProgress?.(total ? Math.round((sent / total) * 100) : 100);
      if (!current.every((item) => item === undefined || settled(item))) return;
      unsubscribe();
      controller.release(draftKey);
      if (current.every((item) => item?.status === "ready")) resolve(items.map((item) => item.fileId as string));
      else reject(new UploadFailed(items.filter((item) => item.status !== "ready")));
    };
    const unsubscribe = uploadStore.subscribe(check);
    check();
  });
}
