// How the bytes of one upload part reach storage. The real transport PUTs straight to the presigned
// URL with a plain XMLHttpRequest: no Authorization header (our bearer token must never be sent to
// the storage origin), no proxy (large bodies would cost server bandwidth and hit function limits).
// It needs the bucket's CORS to allow PUT from the app origin and to expose the ETag header.

import { LIBRARY_MOCK } from "@/lib/feature-flags";

export type PartRequest = {
  url: string;
  body: Blob;
  signal: AbortSignal;
  /** Bytes of this part sent so far. */
  onProgress: (loaded: number) => void;
};

export class PartTransportError extends Error {
  constructor(
    message: string,
    /** The HTTP status, or 0 for a network failure. 403 usually means the presigned URL expired. */
    readonly status: number,
  ) {
    super(message);
    this.name = "PartTransportError";
  }
}

export type PartTransport = {
  /** Resolves with the part's ETag. Rejects with PartTransportError, or an AbortError when the signal fires. */
  putPart(request: PartRequest): Promise<string>;
};

export const xhrTransport: PartTransport = {
  putPart({ url, body, signal, onProgress }) {
    return new Promise<string>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const xhr = new XMLHttpRequest();
      const onAbort = () => xhr.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      const done = () => signal.removeEventListener("abort", onAbort);

      xhr.open("PUT", url);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded);
      };
      xhr.onload = () => {
        done();
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          if (etag) resolve(etag.replace(/"/g, ""));
          else reject(new PartTransportError("Storage did not return an ETag (check the bucket's CORS ExposeHeaders)", xhr.status));
        } else {
          reject(new PartTransportError(`Storage refused the part (${xhr.status})`, xhr.status));
        }
      };
      xhr.onerror = () => {
        done();
        reject(new PartTransportError("Network error while uploading", 0));
      };
      xhr.onabort = () => {
        done();
        reject(new DOMException("Aborted", "AbortError"));
      };
      xhr.send(body);
    });
  },
};

/** Simulates a part upload: progress in a few steps over a short time. For the mock API (urls start with mock://). */
export const mockTransport: PartTransport = {
  putPart({ body, signal, onProgress }) {
    return new Promise<string>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const steps = 5;
      let step = 0;
      const timer = setInterval(() => {
        step += 1;
        onProgress(Math.round((body.size * step) / steps));
        if (step >= steps) {
          clearInterval(timer);
          signal.removeEventListener("abort", onAbort);
          resolve(`mock-etag-${body.size}`);
        }
      }, 120);
      function onAbort() {
        clearInterval(timer);
        reject(new DOMException("Aborted", "AbortError"));
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });
  },
};

export function defaultTransport(): PartTransport {
  return LIBRARY_MOCK ? mockTransport : xhrTransport;
}
