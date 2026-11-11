import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({ API_BASE_URL: "https://api.example.test" }));
const token = vi.hoisted(() => vi.fn(async () => "test-token"));
vi.mock("@/lib/jwt-utils", () => ({
  ensureFreshToken: token,
  getAuthHeaders: (headers: Record<string, string>) => ({ ...headers, Authorization: "Bearer test-token" }),
}));
import { xhrTransport } from "./transport";

class FakeXHR {
  static requests: FakeXHR[] = [];
  headers: Record<string, string> = {};
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number }) => void } = {};
  status = 204;
  timeout = 0;
  url = "";
  etag: string | null = '"stored-part"';
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  ontimeout?: () => void;
  constructor() { FakeXHR.requests.push(this); }
  open(method: string, url: string) { expect(method).toBe("PUT"); this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  getResponseHeader(name: string) { expect(name).toBe("ETag"); return this.etag; }
  send() {}
  abort() { this.onabort?.(); }
}

const url = "https://api.example.test/library/uploads/upload-id/parts/1";
const request = (target = url, signal = new AbortController().signal) => ({ url: target, body: new Blob(["part"]), signal, onProgress: vi.fn() });
beforeEach(() => { FakeXHR.requests = []; token.mockClear(); vi.stubGlobal("XMLHttpRequest", FakeXHR); });
afterEach(() => vi.unstubAllGlobals());

describe("backend upload transport", () => {
  it("authenticates only our API and reads its ETag", async () => {
    const input = request();
    const pending = xhrTransport.putPart(input);
    await Promise.resolve();
    const xhr = FakeXHR.requests[0];
    expect(token).toHaveBeenCalledOnce();
    expect(xhr.url).toBe(url);
    expect(xhr.headers).toEqual({ Authorization: "Bearer test-token", "Content-Type": "application/octet-stream" });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 4 });
    expect(input.onProgress).toHaveBeenCalledWith(4);
    xhr.onload?.();
    await expect(pending).resolves.toBe("stored-part");
  });

  it.each(["https://bucket.s3.amazonaws.com/private", "https://other.example.test/library/uploads/id/parts/1", "https://api.example.test/users/me"])("refuses %s before accessing credentials", async (target) => {
    await expect(xhrTransport.putPart(request(target))).rejects.toMatchObject({ status: 400 });
    expect(token).not.toHaveBeenCalled();
    expect(FakeXHR.requests).toHaveLength(0);
  });

  it("aborts an in-flight request", async () => {
    const abort = new AbortController();
    const pending = xhrTransport.putPart(request(url, abort.signal));
    await Promise.resolve();
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("reports a request timeout so the controller can retry the part", async () => {
    const pending = xhrTransport.putPart(request());
    await Promise.resolve();
    expect(FakeXHR.requests[0].timeout).toBe(120_000);
    FakeXHR.requests[0].ontimeout?.();
    await expect(pending).rejects.toMatchObject({ status: 0 });
  });
});
