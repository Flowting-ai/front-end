import { beforeAll, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { ResponseShapeError, parseOrThrow, queryRetryDelay, shouldRetryQuery } from "@/lib/query-policy";
import { orgScope, queryKeys, libraryKeys } from "@/lib/query-keys";
import {
  clearOrgScopedCache,
  clearUserScopedCache,
  invalidateCredits,
  invalidateModels,
  startCrossTabInvalidation,
} from "@/lib/query-invalidation";

describe("shouldRetryQuery", () => {
  it("retries transient API errors once", () => {
    expect(shouldRetryQuery(0, new ApiError(503, "x", "down"))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError(429, "x", "slow"))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError(503, "x", "down"))).toBe(false);
  });
  it("never retries client errors, shape errors or aborts", () => {
    expect(shouldRetryQuery(0, new ApiError(404, "x", "gone"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(403, "x", "no"))).toBe(false);
    expect(shouldRetryQuery(0, new ResponseShapeError("thing", []))).toBe(false);
    expect(shouldRetryQuery(0, new DOMException("aborted", "AbortError"))).toBe(false);
    expect(shouldRetryQuery(0, new Error("bug"))).toBe(false);
  });
  it("retries a network failure once", () => {
    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
  });
});

describe("queryRetryDelay", () => {
  it("honors Retry-After, capped", () => {
    expect(queryRetryDelay(0, new ApiError(429, "x", "m", undefined, { retryAfterSeconds: 3 }))).toBe(3000);
    expect(queryRetryDelay(0, new ApiError(429, "x", "m", undefined, { retryAfterSeconds: 120 }))).toBe(10_000);
  });
  it("backs off exponentially with jitter in [base/2, base]", () => {
    expect(queryRetryDelay(0, new Error(), () => 0)).toBe(500);
    expect(queryRetryDelay(0, new Error(), () => 1)).toBe(1000);
    expect(queryRetryDelay(2, new Error(), () => 1)).toBe(4000);
    expect(queryRetryDelay(10, new Error(), () => 1)).toBe(10_000);
  });
});

describe("parseOrThrow", () => {
  it("returns parsed data or throws ResponseShapeError", () => {
    const schema = z.object({ id: z.string() });
    expect(parseOrThrow(schema, { id: "a" }, "thing")).toEqual({ id: "a" });
    expect(() => parseOrThrow(schema, { id: 1 }, "thing")).toThrow(ResponseShapeError);
  });
});

describe("queryKeys", () => {
  it("nests detail keys under their root so prefix invalidation reaches them", () => {
    const org = orgScope("o1");
    expect(queryKeys.billing.usage(org).slice(0, 2)).toEqual(queryKeys.billing.all(org));
    expect(queryKeys.orgs.members(org).slice(0, 2)).toEqual(queryKeys.orgs.all(org));
  });
  it("scopes workspace data by org", () => {
    expect(orgScope(null)).toBe("personal");
    expect(queryKeys.billing.all(orgScope("a"))).not.toEqual(queryKeys.billing.all(orgScope("b")));
  });
});

function seeded(): QueryClient {
  const qc = new QueryClient();
  const keys = [
    queryKeys.me(),
    queryKeys.models.all(),
    queryKeys.billing.usage("o1"),
    queryKeys.orgs.plan("o1"),
    queryKeys.orgs.members("o1"),
    libraryKeys.lists("o1"),
  ];
  for (const k of keys) qc.setQueryData(k, { v: 1 });
  return qc;
}
const invalidated = (qc: QueryClient, key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated;

describe("invalidation helpers", () => {
  // Node has a real BroadcastChannel; the module caches its sender, so stub before first use.
  const channels: FakeChannel[] = [];
  class FakeChannel {
    onmessage?: (e: MessageEvent) => void;
    constructor() { channels.push(this); }
    postMessage(msg: unknown) {
      for (const c of channels) if (c !== this) c.onmessage?.({ data: msg } as MessageEvent);
    }
    close() { channels.splice(channels.indexOf(this), 1); }
  }
  beforeAll(() => vi.stubGlobal("BroadcastChannel", FakeChannel));

  it("credits invalidates profile, billing and the org pool only", () => {
    const qc = seeded();
    invalidateCredits(qc);
    expect(invalidated(qc, queryKeys.me())).toBe(true);
    expect(invalidated(qc, queryKeys.billing.usage("o1"))).toBe(true);
    expect(invalidated(qc, queryKeys.orgs.plan("o1"))).toBe(true);
    expect(invalidated(qc, queryKeys.orgs.members("o1"))).toBe(false);
    expect(invalidated(qc, queryKeys.models.all())).toBe(false);
    expect(invalidated(qc, libraryKeys.lists("o1"))).toBe(false);
  });

  it("models invalidates only the catalogue", () => {
    const qc = seeded();
    invalidateModels(qc);
    expect(invalidated(qc, queryKeys.models.all())).toBe(true);
    expect(invalidated(qc, queryKeys.me())).toBe(false);
  });

  it("clearUserScopedCache empties the cache", () => {
    const qc = seeded();
    clearUserScopedCache(qc);
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });

  it("clearOrgScopedCache drops one workspace and keeps user-level data", () => {
    const qc = seeded();
    qc.setQueryData(queryKeys.billing.usage("o2"), { v: 2 });
    clearOrgScopedCache(qc, "o1");
    expect(qc.getQueryData(queryKeys.billing.usage("o1"))).toBeUndefined();
    expect(qc.getQueryData(libraryKeys.lists("o1"))).toBeUndefined();
    expect(qc.getQueryData(queryKeys.billing.usage("o2"))).toEqual({ v: 2 });
    expect(qc.getQueryData(queryKeys.me())).toEqual({ v: 1 });
  });

  it("forwards named invalidations to other tabs", () => {
    const otherTab = seeded();
    const stop = startCrossTabInvalidation(otherTab);
    invalidateModels(seeded());
    expect(invalidated(otherTab, queryKeys.models.all())).toBe(true);
    expect(invalidated(otherTab, queryKeys.me())).toBe(false);
    stop();
  });
});
