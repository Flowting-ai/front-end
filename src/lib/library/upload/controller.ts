"use client";

// Runs uploads: create the server upload, send the parts straight to storage (3 at a time, each
// retried with backoff), complete, then follow processing with ONE batch poll for every upload in
// flight (so ten attachments cost one request every few seconds, not ten). It pauses when the
// browser goes offline and resumes by sending only the parts that have not landed. Every outside
// dependency is injected, so the whole flow runs in tests with fake timers and a fake transport.

import { ApiError } from "@/lib/api/client";
import { FILE_CONSTRAINTS } from "@/hooks/use-file-upload";
import { getLibraryApi, type LibraryApi } from "../api";
import { captureError } from "../observability";
import { UPLOAD_FAILURE_REASONS, type Limits, type UploadFailureReason, type UploadInit } from "../schemas";
import { guessFormat, validateFile } from "./validate";
import { newUploadItem } from "./machine";
import { uploadStore, type UploadStore } from "./store";
import { PartTransportError, defaultTransport, type PartTransport } from "./transport";

export type UploadDeps = {
  getApi: () => Promise<LibraryApi>;
  transport: PartTransport;
  store: UploadStore;
  getLimits: () => Promise<Limits>;
  now: () => number;
  random: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  isOnline: () => boolean;
  isHidden: () => boolean;
  makeId: () => string;
  partConcurrency: number;
  maxPartRetries: number;
};

export type StartOptions = { draftKey: string; chatId?: string };

export type UploadController = {
  /** Adds the file to the queue and starts it. Returns the local attachment id. */
  start(file: File, options: StartOptions): string;
  cancel(id: string): void;
  /** Starts a failed attachment again from scratch. */
  retry(id: string): void;
  /** Drops one attachment (and its File) after the person dismissed it, e.g. a failure notice. */
  forget(id: string): void;
  /** Drops every attachment of a draft once its message has been sent. */
  release(draftKey: string): void;
  pauseAll(): void;
  resumeAll(): void;
  /** Stops everything and empties the queue (sign-out, workspace switch). */
  abortAll(): void;
  /** Re-checks processing right now (the tab became visible again). */
  pollNow(): void;
};

type Runtime = {
  file: File;
  options: StartOptions;
  abort: AbortController;
  init?: UploadInit;
  etags: Map<number, string>;
  partLoaded: Map<number, number>;
  lastProgressAt: number;
  paused: boolean;
  cancelled: boolean;
  misses: number;
};

const PROGRESS_INTERVAL_MS = 100;
const POLL_FAST_MS = 2000;
const POLL_MEDIUM_MS = 5000;
const POLL_SLOW_MS = 10_000;
const POLL_BATCH = 50;

export const DEFAULT_LIMITS: Limits = {
  maxFileBytes: FILE_CONSTRAINTS.maxSizeBytes,
  allowedFormats: ["pdf", "document", "sheet", "slides", "text", "web", "email", "image", "audio"],
  maxFilesPerMessage: FILE_CONSTRAINTS.maxFiles,
};

/** Exponential backoff with jitter, capped, so many parts failing at once do not retry in lockstep. */
export function backoffDelay(attempt: number, random: number): number {
  const base = Math.min(8000, 500 * 2 ** attempt);
  return Math.round(base / 2 + random * (base / 2));
}

function reasonFromError(error: unknown): UploadFailureReason {
  if (error instanceof ApiError) {
    if ((UPLOAD_FAILURE_REASONS as readonly string[]).includes(error.code)) return error.code as UploadFailureReason;
    if (error.status === 413) return "too_large";
    if (error.status === 415) return "unsupported";
    if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) return "unreadable";
  }
  return "network";
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createUploadController(partial: Partial<UploadDeps> = {}): UploadController {
  let idSeq = 0;
  const deps: UploadDeps = {
    getApi: getLibraryApi,
    transport: defaultTransport(),
    store: uploadStore,
    getLimits: async () => (await getLibraryApi()).getLimits().catch(() => DEFAULT_LIMITS),
    now: () => Date.now(),
    random: () => Math.random(),
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
    isHidden: () => (typeof document === "undefined" ? false : document.hidden),
    makeId: () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `upload-${Date.now()}-${idSeq++}`),
    partConcurrency: 3,
    maxPartRetries: 3,
    ...partial,
  };
  const { store } = deps;
  const runtimes = new Map<string, Runtime>();

  const wait = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const handle = deps.setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      function onAbort() {
        deps.clearTimeout(handle);
        reject(new DOMException("Aborted", "AbortError"));
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });

  function fail(id: string, reason: UploadFailureReason): void {
    store.dispatch(id, { type: "fail", reason });
  }

  // ── Parts ──────────────────────────────────────────────────────────────

  function reportProgress(id: string, runtime: Runtime, force = false): void {
    const now = deps.now();
    if (!force && now - runtime.lastProgressAt < PROGRESS_INTERVAL_MS) return;
    runtime.lastProgressAt = now;
    let loaded = 0;
    for (const value of runtime.partLoaded.values()) loaded += value;
    const total = Math.max(1, runtime.file.size);
    // Never report 100% until the server has been told the upload is complete.
    store.dispatch(id, { type: "progress", value: Math.min(0.99, loaded / total) });
  }

  async function uploadPart(id: string, runtime: Runtime, api: LibraryApi, init: UploadInit, partNumber: number, initialUrl: string): Promise<void> {
    let url = initialUrl;
    const start = (partNumber - 1) * init.partSize;
    const body = runtime.file.slice(start, Math.min(runtime.file.size, start + init.partSize));
    for (let attempt = 0; ; attempt += 1) {
      runtime.partLoaded.set(partNumber, 0);
      try {
        const etag = await deps.transport.putPart({
          url,
          body,
          signal: runtime.abort.signal,
          onProgress: (loaded) => {
            runtime.partLoaded.set(partNumber, loaded);
            reportProgress(id, runtime);
          },
        });
        runtime.etags.set(partNumber, etag);
        runtime.partLoaded.set(partNumber, body.size);
        reportProgress(id, runtime, true);
        return;
      } catch (error) {
        if (isAbort(error)) throw error;
        if (attempt >= deps.maxPartRetries) throw error;
        // The presigned URL expired: ask for a fresh one for this part and try again.
        if (error instanceof PartTransportError && error.status === 403) {
          const fresh = await api.presignUploadParts(init.id, [partNumber]);
          const next = fresh.find((part) => part.partNumber === partNumber);
          if (!next) throw error;
          url = next.url;
        } else {
          await wait(backoffDelay(attempt, deps.random()), runtime.abort.signal);
        }
      }
    }
  }

  async function uploadAllParts(id: string, runtime: Runtime, api: LibraryApi, init: UploadInit): Promise<void> {
    const pending = init.parts.filter((part) => !runtime.etags.has(part.partNumber));
    let cursor = 0;
    let failure: unknown;
    const worker = async () => {
      while (failure === undefined && !runtime.abort.signal.aborted) {
        const part = pending[cursor++];
        if (!part) return;
        try {
          await uploadPart(id, runtime, api, init, part.partNumber, part.url);
        } catch (error) {
          failure ??= error;
          // One part is out of retries: stop its siblings instead of letting them finish for nothing.
          if (!isAbort(error)) runtime.abort.abort();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(deps.partConcurrency, pending.length) }, worker));
    if (failure !== undefined) throw failure;
  }

  // ── One upload, start to processing ────────────────────────────────────

  async function run(id: string): Promise<void> {
    const runtime = runtimes.get(id);
    if (!runtime) return;
    try {
      const api = await deps.getApi();
      if (!runtime.init) {
        const limits = await deps.getLimits();
        const reason = validateFile(runtime.file, limits);
        if (reason) {
          fail(id, reason);
          return;
        }
        store.dispatch(id, { type: "validated" });
        runtime.init = await api.createUpload({
          name: runtime.file.name,
          sizeBytes: runtime.file.size,
          mimeType: runtime.file.type || "application/octet-stream",
          chatId: runtime.options.chatId,
        });
        if (runtime.cancelled) {
          void api.cancelUpload(runtime.init.id).catch(() => undefined);
          return;
        }
        store.dispatch(id, { type: "created", serverId: runtime.init.id });
      }
      await uploadAllParts(id, runtime, api, runtime.init);
      if (runtime.paused || runtime.cancelled) return;
      const parts = [...runtime.etags.entries()].sort(([a], [b]) => a - b).map(([partNumber, etag]) => ({ partNumber, etag }));
      await api.completeUpload(runtime.init.id, parts);
      store.dispatch(id, { type: "uploaded" });
      schedulePoll(0);
    } catch (error) {
      if (runtime.cancelled) return;
      // An abort we caused (pausing, cancelling, sibling failure) is not a failure of its own; a resume picks the remaining parts up.
      if (isAbort(error)) return;
      if (!deps.isOnline()) {
        runtime.paused = true;
        runtime.abort = new AbortController();
        store.dispatch(id, { type: "paused" });
        return;
      }
      captureError(error, { boundary: "upload", action: "run" });
      fail(id, reasonFromError(error));
    }
  }

  // ── Processing: one batch poll for every upload in flight ───────────────

  let pollTimer: unknown;
  let pollCount = 0;

  function processingItems() {
    return store.all().filter((item) => item.status === "processing" && item.serverId !== undefined);
  }

  function nextDelay(): number {
    if (pollCount < 10) return POLL_FAST_MS;
    if (pollCount < 20) return POLL_MEDIUM_MS;
    return POLL_SLOW_MS;
  }

  function schedulePoll(delay: number): void {
    if (pollTimer !== undefined) return;
    pollTimer = deps.setTimeout(() => {
      pollTimer = undefined;
      void poll();
    }, delay);
  }

  async function poll(): Promise<void> {
    const items = processingItems();
    if (items.length === 0) {
      pollCount = 0;
      return;
    }
    // A hidden tab does not poll; the visibilitychange handler calls pollNow() when it returns.
    if (deps.isHidden()) {
      schedulePoll(POLL_SLOW_MS);
      return;
    }
    try {
      const api = await deps.getApi();
      for (let offset = 0; offset < items.length; offset += POLL_BATCH) {
        const batch = items.slice(offset, offset + POLL_BATCH);
        const statuses = await api.getUploadStatuses(batch.map((item) => item.serverId as string));
        const byServerId = new Map(statuses.map((status) => [status.id, status]));
        for (const item of batch) {
          const runtime = runtimes.get(item.id);
          const status = byServerId.get(item.serverId as string);
          if (!status) {
            // The server no longer knows this upload. Give it a few polls, then treat it as failed.
            if (runtime && ++runtime.misses >= 3) fail(item.id, "unreadable");
            continue;
          }
          if (runtime) runtime.misses = 0;
          const next = store.dispatch(item.id, {
            type: "server",
            phase: status.phase,
            slow: status.slow,
            fileId: status.fileId,
            failure: status.failureReason,
          });
          // A ready attachment no longer needs its File; a failed one keeps it so Retry can start over.
          if (next?.status === "ready") runtimes.delete(item.id);
        }
      }
    } catch (error) {
      // A failed poll is not a failed upload; try again on the normal cadence.
      captureError(error, { boundary: "upload", action: "poll" });
    }
    pollCount += 1;
    if (processingItems().length > 0) schedulePoll(nextDelay());
    else pollCount = 0;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  return {
    start(file, options) {
      const id = deps.makeId();
      runtimes.set(id, {
        file,
        options,
        abort: new AbortController(),
        etags: new Map(),
        partLoaded: new Map(),
        lastProgressAt: 0,
        paused: false,
        cancelled: false,
        misses: 0,
      });
      store.add(
        newUploadItem({
          id,
          draftKey: options.draftKey,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
          format: guessFormat(file.name),
          startedAt: deps.now(),
        }),
      );
      void run(id);
      return id;
    },

    cancel(id) {
      const runtime = runtimes.get(id);
      const item = store.get(id);
      if (runtime) {
        runtime.cancelled = true;
        runtime.abort.abort();
        runtimes.delete(id);
      }
      store.dispatch(id, { type: "cancel" });
      store.remove(id);
      const serverId = runtime?.init?.id ?? item?.serverId;
      if (serverId) void deps.getApi().then((api) => api.cancelUpload(serverId)).catch(() => undefined);
    },

    retry(id) {
      const runtime = runtimes.get(id);
      const item = store.get(id);
      if (!runtime || item?.status !== "failed") return;
      runtime.abort = new AbortController();
      runtime.init = undefined;
      runtime.etags.clear();
      runtime.partLoaded.clear();
      runtime.paused = false;
      runtime.misses = 0;
      store.dispatch(id, { type: "retry" });
      void run(id);
    },

    forget(id) {
      runtimes.delete(id);
      store.remove(id);
    },

    release(draftKey) {
      for (const item of store.forDraft(draftKey)) runtimes.delete(item.id);
      store.removeDraft(draftKey);
    },

    pauseAll() {
      for (const [id, runtime] of runtimes) {
        const item = store.get(id);
        if (item?.status !== "uploading") continue;
        runtime.paused = true;
        runtime.abort.abort();
        runtime.abort = new AbortController();
        store.dispatch(id, { type: "paused" });
      }
    },

    resumeAll() {
      for (const [id, runtime] of runtimes) {
        const item = store.get(id);
        if (item?.status !== "paused") continue;
        runtime.paused = false;
        store.dispatch(id, { type: "resumed" });
        void run(id);
      }
    },

    abortAll() {
      for (const runtime of runtimes.values()) {
        runtime.cancelled = true;
        runtime.abort.abort();
      }
      runtimes.clear();
      if (pollTimer !== undefined) deps.clearTimeout(pollTimer);
      pollTimer = undefined;
      pollCount = 0;
      store.clear();
    },

    pollNow() {
      if (pollTimer !== undefined) {
        deps.clearTimeout(pollTimer);
        pollTimer = undefined;
      }
      if (processingItems().length > 0) void poll();
    },
  };
}

/** The app-wide controller (created on first use, so importing this module costs nothing). */
let shared: UploadController | undefined;
export function getUploadController(): UploadController {
  shared ??= createUploadController();
  return shared;
}

