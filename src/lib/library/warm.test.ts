import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({ getFile: vi.fn(), getPreview: vi.fn() }));
vi.mock("./api", () => ({ libraryApi: api }));

import { DEFAULT_PREVIEW_REQUEST, forgetWarmFile, syncWarmScope, takeWarmFile, takeWarmPreview, warmFile } from "./warm";

let n = 0;
const nextId = () => `file-${++n}`;

beforeEach(() => {
  vi.useFakeTimers();
  api.getFile.mockReset().mockImplementation(async (id: string) => ({ id, call: api.getFile.mock.calls.length }));
  api.getPreview.mockReset().mockImplementation(async (id: string) => ({ id, call: api.getPreview.mock.calls.length }));
});
afterEach(() => vi.useRealTimers());

describe("warmFile", () => {
  it("starts details and the first preview once, and the first loads reuse them", async () => {
    const id = nextId();
    warmFile(id);
    warmFile(id);
    expect(api.getFile).toHaveBeenCalledTimes(1);
    expect(api.getPreview).toHaveBeenCalledTimes(1);
    await expect(takeWarmFile(id, true)).resolves.toEqual({ id, call: 1 });
    await expect(takeWarmPreview(id, { ...DEFAULT_PREVIEW_REQUEST }, true)).resolves.toEqual({ id, call: 1 });
    expect(api.getFile).toHaveBeenCalledTimes(1);
    expect(api.getPreview).toHaveBeenCalledTimes(1);
  });

  it("shares the request with a first load re-run right away, then lets later fetches through", async () => {
    const id = nextId();
    warmFile(id, { preview: false });
    await takeWarmFile(id, true);
    await takeWarmFile(id, true);
    expect(api.getFile).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_000);
    await expect(takeWarmFile(id, true)).resolves.toEqual({ id, call: 2 });
  });

  it("never answers a refetch: after a change the server is read again", async () => {
    const id = nextId();
    warmFile(id, { preview: false });
    await expect(takeWarmFile(id, false)).resolves.toEqual({ id, call: 2 });
  });

  it("forgets a file that changed, and everything when the workspace changes", async () => {
    const id = nextId();
    warmFile(id);
    forgetWarmFile(id);
    await expect(takeWarmFile(id, true)).resolves.toEqual({ id, call: 2 });
    await expect(takeWarmPreview(id, DEFAULT_PREVIEW_REQUEST, true)).resolves.toEqual({ id, call: 2 });

    const other = nextId();
    syncWarmScope("org-a");
    warmFile(other, { preview: false });
    syncWarmScope("org-b");
    await expect(takeWarmFile(other, true)).resolves.toEqual({ id: other, call: 4 });
  });

  it("retries a network failure once, but takes an API refusal as the answer", async () => {
    const id = nextId();
    api.getFile.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    warmFile(id, { preview: false });
    await expect(takeWarmFile(id, true)).resolves.toEqual({ id, call: 2 });

    const gone = nextId();
    api.getFile.mockRejectedValueOnce(new ApiError(404, "file_gone", "gone"));
    warmFile(gone, { preview: false });
    await expect(takeWarmFile(gone, true)).rejects.toBeInstanceOf(ApiError);
    expect(api.getFile).toHaveBeenCalledTimes(3);
  });

  it("fetches afresh once the warmed request went stale, and lets an unopened one go", async () => {
    const id = nextId();
    warmFile(id, { preview: false });
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(takeWarmFile(id, true)).resolves.toEqual({ id, call: 2 });
  });

  it("does not hand a different preview window the warmed one", async () => {
    const id = nextId();
    warmFile(id);
    await takeWarmPreview(id, { rowStart: 100, rowCount: 100 }, true);
    expect(api.getPreview).toHaveBeenCalledTimes(2);
  });
});
