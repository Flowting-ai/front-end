import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryApi } from "../api";
import { FORMATS, type UploadStatus } from "../schemas";
import { backoffDelay, createUploadController, type UploadController } from "./controller";
import { createUploadStore, type UploadStore } from "./store";
import { PartTransportError, type PartRequest, type PartTransport } from "./transport";
import { ApiError } from "@/lib/api/client";

const MB = 1_000_000;
const PART_BYTES = 8 * MB;

/**
 * The upload half of the Library API, in memory. A file's name picks its outcome: "slow" stays
 * processing (flagged slow after 3 s), "password" fails, anything else is ready 1.5 s after completing.
 */
function fakeUploadApi() {
  let seq = 0;
  const uploads = new Map<string, { name: string; parts: number; completedAt?: number }>();
  const statusOf = (id: string): UploadStatus => {
    const record = uploads.get(id)!;
    if (record.completedAt === undefined) return { id, phase: "uploading", slow: false };
    const elapsed = Date.now() - record.completedAt;
    if (record.name.includes("slow")) return { id, phase: "processing", slow: elapsed > 3000 };
    if (elapsed < 1500) return { id, phase: "processing", slow: false };
    if (record.name.includes("password")) return { id, phase: "failed", slow: false, failureReason: "password_protected" };
    return { id, phase: "ready", slow: false, fileId: `file_${id}` };
  };
  return {
    async getLimits() {
      return { maxFileBytes: 30 * MB, allowedFormats: [...FORMATS], extensions: { pdf: "pdf", xlsx: "sheet" } as const, maxFilesPerMessage: 10 };
    },
    async createUpload(request: { name: string; sizeBytes: number }) {
      const id = `up_${seq++}`;
      const parts = Math.max(1, Math.ceil(request.sizeBytes / PART_BYTES));
      uploads.set(id, { name: request.name, parts });
      return { id, partSize: PART_BYTES, parts: Array.from({ length: parts }, (_, index) => ({ partNumber: index + 1, url: `mock://upload/${id}/${index + 1}` })) };
    },
    async completeUpload(id: string) {
      uploads.get(id)!.completedAt = Date.now();
    },
    async cancelUpload(id: string) {
      uploads.delete(id);
    },
    async getUploadStatuses(ids: string[]) {
      return ids.filter((id) => uploads.has(id)).map(statusOf);
    },
  };
}

/** Parts never land, so the attachment stays "uploading" until it is aborted. */
const hangingTransport = (calls: PartRequest[]): PartTransport => ({
  putPart(request) {
    calls.push(request);
    return new Promise<string>((_, reject) => {
      request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  },
});

function file(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: "application/octet-stream" });
}

type Harness = {
  controller: UploadController;
  store: UploadStore;
  api: ReturnType<typeof fakeUploadApi>;
  calls: PartRequest[];
  online: { value: boolean };
  hidden: { value: boolean };
  flush: () => Promise<void>;
};

function harness(transportFor?: (calls: PartRequest[]) => PartTransport): Harness {
  const store = createUploadStore();
  const api = fakeUploadApi();
  const calls: PartRequest[] = [];
  const transport: PartTransport = transportFor
    ? transportFor(calls)
    : {
        async putPart(request) {
          calls.push(request);
          request.onProgress(request.body.size);
          return `etag-${calls.length}`;
        },
      };
  const online = { value: true };
  const hidden = { value: false };
  let seq = 0;
  const controller = createUploadController({
    api: api as unknown as LibraryApi,
    transport,
    store,
    getLimits: async () => api.getLimits(),
    random: () => 0,
    isOnline: () => online.value,
    isHidden: () => hidden.value,
    makeId: () => `local-${++seq}`,
  });
  return { controller, store, api, calls, online, hidden, flush: () => vi.advanceTimersByTimeAsync(0) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a successful upload", () => {
  it("sends every part, completes, then follows processing to ready", async () => {
    const h = harness();
    const id = h.controller.start(file("Price list.xlsx", 17 * MB), { draftKey: "new" });
    await h.flush();
    expect(h.calls).toHaveLength(3); // 17 MB in 8 MB parts
    expect(h.store.get(id)?.status).toBe("processing");
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.store.get(id)).toMatchObject({ status: "ready", progress: 1 });
    expect(h.store.get(id)?.fileId).toBeDefined();
  });

  it("passes each part body and progress callback to the injected transport", async () => {
    const h = harness();
    h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await h.flush();
    expect(h.calls[0].url.startsWith("mock://upload/")).toBe(true);
    expect(Object.keys(h.calls[0]).sort()).toEqual(["body", "onProgress", "signal", "url"]);
  });

  it("drops the File once the attachment is ready", async () => {
    const h = harness();
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(2500);
    expect(h.store.get(id)?.status).toBe("ready");
    h.controller.retry(id); // nothing to retry: no runtime, no change
    expect(h.store.get(id)?.status).toBe("ready");
  });
});

describe("refusals", () => {
  it("rejects an unsupported file before talking to the server", async () => {
    const h = harness();
    const create = vi.spyOn(h.api, "createUpload");
    const id = h.controller.start(file("tool.exe", 100), { draftKey: "new" });
    await h.flush();
    expect(h.store.get(id)).toMatchObject({ status: "failed", failure: "unsupported" });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before uploading", async () => {
    const h = harness();
    const big = file("big.pdf", 10);
    Object.defineProperty(big, "size", { value: 31 * MB });
    const id = h.controller.start(big, { draftKey: "new" });
    await h.flush();
    expect(h.store.get(id)).toMatchObject({ status: "failed", failure: "too_large" });
    expect(h.calls).toHaveLength(0);
  });

  it("fails processing for a password-protected file with that reason", async () => {
    const h = harness();
    const id = h.controller.start(file("password locked.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(2500);
    expect(h.store.get(id)).toMatchObject({ status: "failed", failure: "password_protected" });
  });

  it("keeps a failed file's draft usable: Send is no longer blocked by it", async () => {
    const h = harness();
    h.controller.start(file("tool.exe", 100), { draftKey: "new" });
    await h.flush();
    expect(h.store.forDraft("new").every((item) => item.status === "failed")).toBe(true);
  });
});

describe("part retries", () => {
  it("retries a failing part with backoff and then succeeds", async () => {
    let attempts = 0;
    const h = harness((calls) => ({
      async putPart(request) {
        calls.push(request);
        attempts += 1;
        if (attempts <= 2) throw new PartTransportError("blip", 0);
        request.onProgress(request.body.size);
        return "etag";
      },
    }));
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(attempts).toBe(3);
    expect(["processing", "ready"]).toContain(h.store.get(id)?.status);
  });

  it("gives up after the retry limit and reports a network failure", async () => {
    const h = harness((calls) => ({
      async putPart(request) {
        calls.push(request);
        throw new PartTransportError("down", 0);
      },
    }));
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.calls).toHaveLength(4); // first try + 3 retries
    expect(h.store.get(id)).toMatchObject({ status: "failed", failure: "network" });
  });

  it("surfaces a backend authorization failure without requesting storage links", async () => {
    const h = harness((calls) => ({ async putPart(request) {
      calls.push(request);
      throw new PartTransportError("forbidden", 403);
    } }));
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.calls).toHaveLength(1);
    expect(h.store.get(id)?.status).toBe("failed");
  });

  it("backs off with jitter, capped", () => {
    expect(backoffDelay(0, 0)).toBe(250);
    expect(backoffDelay(0, 1)).toBe(500);
    expect(backoffDelay(10, 0)).toBe(4000);
    expect(backoffDelay(10, 1)).toBe(8000);
  });
});

describe("pausing when offline", () => {
  it("resumes when connectivity fails before upload initialization", async () => {
    const h = harness();
    vi.spyOn(h.api, "getLimits").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    h.online.value = false;
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await h.flush();
    expect(h.store.get(id)?.status).toBe("paused");
    h.online.value = true;
    h.controller.resumeAll();
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.store.get(id)?.status).toBe("ready");
  });

  it("keeps a late upload initialization paused until connectivity returns", async () => {
    const h = harness();
    const original = h.api.createUpload.bind(h.api);
    let release!: () => void;
    vi.spyOn(h.api, "createUpload").mockImplementation(async (request) => {
      await new Promise<void>((resolve) => { release = resolve; });
      return original(request);
    });
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await h.flush();
    h.controller.pauseAll();
    release();
    await h.flush();
    expect(h.store.get(id)?.status).toBe("paused");
    expect(h.calls).toHaveLength(0);
    h.controller.resumeAll();
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.store.get(id)?.status).toBe("ready");
    expect(h.api.createUpload).toHaveBeenCalledTimes(1);
  });

  it("does not create duplicate uploads when reconnecting during initialization", async () => {
    const h = harness();
    const original = h.api.createUpload.bind(h.api);
    const releases: Array<() => void> = [];
    vi.spyOn(h.api, "createUpload").mockImplementation(async (request) => {
      await new Promise<void>((resolve) => { releases.push(resolve); });
      return original(request);
    });
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await h.flush();
    h.controller.pauseAll();
    h.controller.resumeAll();
    await h.flush();
    expect(h.api.createUpload).toHaveBeenCalledTimes(1);
    releases[0]();
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.store.get(id)?.status).toBe("ready");
    expect(h.calls).toHaveLength(1);
  });

  it("pauses, then resumes by sending only the parts that have not landed", async () => {
    const releases: Array<() => void> = [];
    let landed = 0;
    const h = harness((calls) => ({
      putPart(request) {
        calls.push(request);
        return new Promise<string>((resolve, reject) => {
          request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
          releases.push(() => {
            landed += 1;
            resolve(`etag-${landed}`);
          });
        });
      },
    }));
    const id = h.controller.start(file("big.pdf", 17 * MB), { draftKey: "new" }); // 3 parts, all in flight
    await h.flush();
    expect(h.calls).toHaveLength(3);
    releases[0](); // part 1 lands
    await h.flush();
    h.online.value = false;
    h.controller.pauseAll();
    await h.flush();
    expect(h.store.get(id)?.status).toBe("paused");
    h.online.value = true;
    h.controller.resumeAll();
    await h.flush();
    expect(h.store.get(id)?.status).toBe("uploading");
    expect(h.calls).toHaveLength(5); // parts 2 and 3 only, not part 1 again
    expect(h.calls.slice(3).map((call) => call.body.size)).toEqual([8 * MB, 1 * MB]);
  });
});

describe("processing polls", () => {
  it("surfaces a broken status contract instead of processing forever", async () => {
    const h = harness();
    vi.spyOn(h.api, "getUploadStatuses").mockRejectedValue(new ApiError(502, "contract_error", "Unexpected response"));
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.store.get(id)).toMatchObject({ status: "failed", failure: "unreadable" });
  });

  it("recovers from a transient status failure", async () => {
    const h = harness();
    vi.spyOn(h.api, "getUploadStatuses").mockRejectedValueOnce(new ApiError(503, "unavailable", "Try again"));
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(4000);
    expect(h.store.get(id)?.status).toBe("ready");
  });

  it("settles repeated status failures so sending does not hang", async () => {
    const h = harness();
    vi.spyOn(h.api, "getUploadStatuses").mockRejectedValue(new TypeError("Failed to fetch"));
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.store.get(id)).toMatchObject({ status: "failed", failure: "network" });
  });

  it("retries completion when the queue is temporarily unavailable", async () => {
    const h = harness();
    const complete = vi.spyOn(h.api, "completeUpload").mockRejectedValueOnce(new ApiError(503, "unavailable", "Try again"));
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(4000);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(h.calls).toHaveLength(1);
    expect(h.store.get(id)?.status).toBe("ready");
  });

  it("polls every upload in flight with one request per tick", async () => {
    const h = harness();
    const statuses = vi.spyOn(h.api, "getUploadStatuses");
    h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    h.controller.start(file("slow one.pdf", MB), { draftKey: "new" });
    h.controller.start(file("c.pdf", MB), { draftKey: "new" });
    await h.flush(); // first poll runs right after the uploads complete
    for (const [ids] of statuses.mock.calls) expect(ids.length).toBeLessThanOrEqual(3);
    const before = statuses.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses.mock.calls.length).toBe(before + 1); // one more request for all three, not three
    expect(statuses.mock.calls[statuses.mock.calls.length - 1][0]).toHaveLength(3); // all three asked about together
    // Two finished; only the slow one is still processing, so the next poll asks about just that one.
    expect(h.store.all().filter((item) => item.status === "processing")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses.mock.calls[statuses.mock.calls.length - 1][0]).toHaveLength(1);
  });

  it("does not poll in a hidden tab, and polls straight away when it returns", async () => {
    const h = harness();
    const statuses = vi.spyOn(h.api, "getUploadStatuses");
    h.hidden.value = true;
    h.controller.start(file("slow.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(statuses).not.toHaveBeenCalled();
    h.hidden.value = false;
    h.controller.pollNow();
    await h.flush();
    expect(statuses).toHaveBeenCalledTimes(1);
  });

  it("does not fail processing attachments while offline, and polls again on reconnect", async () => {
    const h = harness();
    const statuses = vi.spyOn(h.api, "getUploadStatuses");
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await h.flush();
    expect(h.store.get(id)?.status).toBe("processing");
    statuses.mockRejectedValue(new TypeError("Failed to fetch"));
    h.online.value = false;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.store.get(id)?.status).toBe("processing");
    statuses.mockRestore();
    h.online.value = true;
    h.controller.pollNow();
    await h.flush();
    expect(h.store.get(id)?.status).toBe("ready");
  });

  it("does not count status failures that happen as the connection drops", async () => {
    const h = harness();
    const statuses = vi.spyOn(h.api, "getUploadStatuses").mockImplementation(async () => {
      h.online.value = false;
      throw new TypeError("Failed to fetch");
    });
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    for (let i = 0; i < 10; i += 1) {
      h.online.value = true;
      h.controller.pollNow();
      await h.flush();
    }
    expect(statuses.mock.calls.length).toBeGreaterThanOrEqual(10);
    expect(h.store.get(id)?.status).toBe("processing");
  });

  it("flags a slow file after the server says so", async () => {
    const h = harness();
    const id = h.controller.start(file("slow.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.store.get(id)).toMatchObject({ status: "processing", slow: true });
  });
});

describe("cancelling and clearing", () => {
  it("cancel removes the attachment and tells the server", async () => {
    const h = harness(hangingTransport);
    const cancel = vi.spyOn(h.api, "cancelUpload");
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await h.flush();
    expect(h.store.get(id)?.status).toBe("uploading");
    h.controller.cancel(id);
    await h.flush();
    expect(h.store.get(id)).toBeUndefined();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("removing a processing attachment does not ask the server to cancel a finished upload", async () => {
    const h = harness();
    const cancel = vi.spyOn(h.api, "cancelUpload");
    const id = h.controller.start(file("slow.pdf", MB), { draftKey: "new" });
    await h.flush();
    expect(h.store.get(id)?.status).toBe("processing");
    h.controller.cancel(id);
    expect(h.store.get(id)).toBeUndefined();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("closes the server upload when parts run out of retries, and again before a retry starts over", async () => {
    let attempts = 0;
    const h = harness((calls) => ({
      async putPart(request) {
        calls.push(request);
        attempts += 1;
        if (attempts <= 4) throw new PartTransportError("down", 0);
        return "etag";
      },
    }));
    const cancel = vi.spyOn(h.api, "cancelUpload");
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.store.get(id)?.status).toBe("failed");
    expect(cancel).toHaveBeenCalledWith("up_0");
    h.controller.retry(id);
    expect(cancel).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(["processing", "ready"]).toContain(h.store.get(id)?.status);
  });

  it("abortAll closes unfinished server uploads but not completed ones", async () => {
    const h = harness();
    const cancel = vi.spyOn(h.api, "cancelUpload");
    h.controller.start(file("slow.pdf", MB), { draftKey: "new" }); // completes, then processes
    await h.flush();
    expect(h.calls).toHaveLength(1);
    const hung = harness(hangingTransport);
    const hungCancel = vi.spyOn(hung.api, "cancelUpload");
    hung.controller.start(file("b.pdf", MB), { draftKey: "new" });
    await hung.flush();
    h.controller.abortAll();
    hung.controller.abortAll();
    expect(cancel).not.toHaveBeenCalled();
    expect(hungCancel).toHaveBeenCalledTimes(1);
  });

  it("release drops a sent draft's attachments", async () => {
    const h = harness();
    h.controller.start(file("a.pdf", MB), { draftKey: "chat-1" });
    h.controller.start(file("b.pdf", MB), { draftKey: "chat-2" });
    await h.flush();
    h.controller.release("chat-1");
    expect(h.store.forDraft("chat-1")).toEqual([]);
    expect(h.store.forDraft("chat-2")).toHaveLength(1);
  });

  it("abortAll empties the queue and stops polling (sign-out, workspace switch)", async () => {
    const h = harness();
    const statuses = vi.spyOn(h.api, "getUploadStatuses");
    h.controller.start(file("slow.pdf", MB), { draftKey: "new" });
    await h.flush();
    const before = statuses.mock.calls.length;
    h.controller.abortAll();
    expect(h.store.all()).toEqual([]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(statuses.mock.calls.length).toBe(before);
  });

  it("retry starts a failed attachment again from scratch", async () => {
    let attempts = 0;
    const h = harness((calls) => ({
      async putPart(request) {
        calls.push(request);
        attempts += 1;
        if (attempts <= 4) throw new PartTransportError("down", 0);
        return "etag";
      },
    }));
    const id = h.controller.start(file("a.pdf", MB), { draftKey: "new" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.store.get(id)?.status).toBe("failed");
    h.controller.retry(id);
    await vi.advanceTimersByTimeAsync(5000);
    expect(["processing", "ready"]).toContain(h.store.get(id)?.status);
  });
});
