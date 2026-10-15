// Upload bodies go only to the configured API. S3 credentials and multipart
// operations remain on the server; deployed apps bypass the Next.js proxy.
import { API_BASE_URL } from "@/lib/config";
import { ensureFreshToken, getAuthHeaders } from "@/lib/jwt-utils";

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
    /** The HTTP status, or 0 for a network failure. 401/403 indicate an authentication or authorization failure. */
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
  async putPart({ url, body, signal, onProgress }) {
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const api = new URL(API_BASE_URL, origin);
    const target = new URL(url, origin);
    const prefix = `${api.pathname.replace(/\/$/, "")}/library/uploads/`;
    if (target.origin !== api.origin || target.username || target.password || !target.pathname.startsWith(prefix)
        || !/\/parts\/[1-9]\d*$/.test(target.pathname)) {
      throw new PartTransportError("Upload endpoint is outside the configured API", 400);
    }
    await ensureFreshToken();
    return new Promise<string>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const xhr = new XMLHttpRequest();
      const onAbort = () => xhr.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      const done = () => signal.removeEventListener("abort", onAbort);

      xhr.open("PUT", target.href);
      xhr.timeout = 120_000;
      for (const [name, value] of Object.entries(getAuthHeaders({ "Content-Type": "application/octet-stream" }))) {
        xhr.setRequestHeader(name, value);
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded);
      };
      xhr.onload = () => {
        done();
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          if (etag) resolve(etag.replace(/"/g, ""));
          else reject(new PartTransportError("Upload API did not return an ETag", xhr.status));
        } else {
          reject(new PartTransportError(`Upload API refused the part (${xhr.status})`, xhr.status));
        }
      };
      xhr.onerror = () => {
        done();
        reject(new PartTransportError("Network error while uploading", 0));
      };
      xhr.ontimeout = () => {
        done();
        reject(new PartTransportError("Upload request timed out", 0));
      };
      xhr.onabort = () => {
        done();
        reject(new DOMException("Aborted", "AbortError"));
      };
      xhr.send(body);
    });
  },
};
