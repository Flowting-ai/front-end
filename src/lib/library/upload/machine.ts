// The state machine for one attachment in the composer. It is a pure function (no timers, no
// network) so every transition is testable, and so a stray late event can never move a finished
// upload backwards: ready, failed and cancelled are final unless an explicit retry arrives.
//
//   validating -> uploading -> processing -> ready
//        |            |  ^          |
//        |            v  |          |
//        |          paused          |
//        +--------> failed <--------+      (failed -> uploading on retry; anything -> cancelled)

import type { Format, UploadFailureReason } from "../schemas";

export type UploadStatusKind = "validating" | "uploading" | "paused" | "processing" | "ready" | "failed" | "cancelled";

export type UploadItem = {
  /** Local id, stable for the life of the attachment (not the server's upload id). */
  id: string;
  /** The draft this belongs to: a chat id, or "new" for a chat that has no id yet. */
  draftKey: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  format: Format | null;
  status: UploadStatusKind;
  /** Bytes uploaded so far, 0 to 1. */
  progress: number;
  /** Processing has run past the "taking longer than usual" mark. */
  slow: boolean;
  /** The server's upload id, once created. */
  serverId?: string;
  /** The staged file the chat send refers to, once ready. */
  fileId?: string;
  failure?: UploadFailureReason;
  startedAt: number;
};

export type UploadEvent =
  | { type: "validated" }
  | { type: "created"; serverId: string }
  | { type: "progress"; value: number }
  | { type: "paused" }
  | { type: "resumed" }
  | { type: "uploaded" }
  | { type: "server"; phase: "uploading" | "processing" | "ready" | "failed"; slow: boolean; fileId?: string; failure?: UploadFailureReason }
  | { type: "fail"; reason: UploadFailureReason }
  | { type: "cancel" }
  | { type: "retry" };

const FINAL: ReadonlySet<UploadStatusKind> = new Set(["ready", "cancelled"]);

export function isFinal(status: UploadStatusKind): boolean {
  return FINAL.has(status);
}

export function isInFlight(status: UploadStatusKind): boolean {
  return status === "validating" || status === "uploading" || status === "paused" || status === "processing";
}

export function newUploadItem(init: Pick<UploadItem, "id" | "draftKey" | "name" | "sizeBytes" | "mimeType" | "format" | "startedAt">): UploadItem {
  return { ...init, status: "validating", progress: 0, slow: false };
}

export function reduceUpload(item: UploadItem, event: UploadEvent): UploadItem {
  // Nothing changes a finished attachment except a retry of a failure.
  if (isFinal(item.status)) return item;
  if (item.status === "failed" && event.type !== "retry" && event.type !== "cancel") return item;

  switch (event.type) {
    case "validated":
      return item.status === "validating" ? { ...item, status: "uploading" } : item;
    case "created":
      return item.status === "validating" || item.status === "uploading" ? { ...item, status: "uploading", serverId: event.serverId } : item;
    case "progress":
      if (item.status !== "uploading") return item;
      // Progress only ever moves forward, so a late or reordered event cannot make the bar jump back.
      return event.value > item.progress ? { ...item, progress: Math.min(1, event.value) } : item;
    case "paused":
      return item.status === "uploading" ? { ...item, status: "paused" } : item;
    case "resumed":
      return item.status === "paused" ? { ...item, status: "uploading" } : item;
    case "uploaded":
      return item.status === "uploading" ? { ...item, status: "processing", progress: 1 } : item;
    case "server": {
      if (item.status !== "processing" && item.status !== "uploading") return item;
      if (event.phase === "ready") return { ...item, status: "ready", progress: 1, slow: false, fileId: event.fileId };
      if (event.phase === "failed") return { ...item, status: "failed", failure: event.failure ?? "unreadable", slow: false };
      // "processing" from the server while the client still thinks it is uploading means the last part landed.
      if (event.phase === "processing") return { ...item, status: "processing", progress: 1, slow: event.slow };
      return item;
    }
    case "fail":
      return { ...item, status: "failed", failure: event.reason, slow: false };
    case "cancel":
      return { ...item, status: "cancelled" };
    case "retry":
      return item.status === "failed"
        ? { ...item, status: "validating", progress: 0, slow: false, failure: undefined, serverId: undefined, fileId: undefined }
        : item;
  }
}

/** Send stays off until every attachment is ready. Failed and cancelled ones are not blocking: they have left the draft. */
export function canSend(items: readonly UploadItem[]): boolean {
  return items.every((item) => item.status === "ready" || item.status === "failed" || item.status === "cancelled");
}

export function blockingCount(items: readonly UploadItem[]): number {
  return items.filter((item) => isInFlight(item.status)).length;
}

/** How many more files a draft can take before the per-message cap. Failed and cancelled ones no longer count. */
export function remainingSlots(items: readonly UploadItem[], max: number): number {
  const counting = items.filter((item) => item.status !== "failed" && item.status !== "cancelled").length;
  return Math.max(0, max - counting);
}

/** The label under an attachment's name: a status word, never colour alone. */
export function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case "validating":
      return "Preparing";
    case "uploading":
      return `Uploading ${Math.round(item.progress * 100)}%`;
    case "paused":
      return "Paused";
    case "processing":
      return item.slow ? "Taking longer than usual" : "Processing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
}
