import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { classifyEnhanceFailure, enhanceOutcomeProps, latencyBucket } from "./enhance-outcome";

describe("classifyEnhanceFailure", () => {
  it("treats an aborted request as silent", () => {
    const abort = Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
    expect(classifyEnhanceFailure(abort)).toBe("aborted");
  });

  it("maps a 402 or an insufficient-credits message to the billing path", () => {
    expect(classifyEnhanceFailure(new ApiError(402, "payment_required", "Payment required", ""))).toBe("credits");
    expect(classifyEnhanceFailure(new Error("Insufficient credits for this request"))).toBe("credits");
  });

  it("falls back to the local check for anything else", () => {
    expect(classifyEnhanceFailure(new ApiError(500, "server", "boom", ""))).toBe("error");
    expect(classifyEnhanceFailure(new Error("Failed to fetch"))).toBe("error");
    expect(classifyEnhanceFailure(undefined)).toBe("error");
  });
});

describe("latencyBucket", () => {
  it("buckets at the 2/5/15/45 s edges", () => {
    expect(latencyBucket(0)).toBe("lt_2s");
    expect(latencyBucket(1_999)).toBe("lt_2s");
    expect(latencyBucket(2_000)).toBe("2_5s");
    expect(latencyBucket(5_000)).toBe("5_15s");
    expect(latencyBucket(15_000)).toBe("15_45s");
    expect(latencyBucket(45_000)).toBe("gt_45s");
  });
});

describe("enhanceOutcomeProps", () => {
  it("carries enums and counts only", () => {
    expect(enhanceOutcomeProps({ outcome: "applied", source: "backend", startedAt: 1_000, now: 7_000, questionsAnswered: 2 })).toEqual({
      outcome: "applied",
      source: "backend",
      latency: "5_15s",
      questions_answered: 2,
    });
  });

  it("handles a missing start time and clock skew", () => {
    expect(enhanceOutcomeProps({ outcome: "closed", source: "local", startedAt: null, now: 5, questionsAnswered: 0 }).latency).toBe("lt_2s");
    expect(enhanceOutcomeProps({ outcome: "closed", source: "local", startedAt: 10, now: 5, questionsAnswered: 0 }).latency).toBe("lt_2s");
  });
});
