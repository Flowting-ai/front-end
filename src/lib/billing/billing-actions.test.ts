import { describe, expect, it } from "vitest";
import {
  BillingActionError,
  billingErrorMessage,
  billingFingerprint,
  errorReason,
  pollUntilChanged,
  singleFlight,
} from "./billing-actions";

const noSleep = () => Promise.resolve();

describe("errorReason", () => {
  it("prefers detail, then error, then message", () => {
    expect(errorReason({ detail: "Card declined" }, "x")).toBe("Card declined");
    expect(errorReason({ error: "No customer" }, "x")).toBe("No customer");
    expect(errorReason({ message: "Oops" }, "x")).toBe("Oops");
  });

  it("falls back for empty, non-string or missing bodies", () => {
    expect(errorReason(null, "fallback")).toBe("fallback");
    expect(errorReason({ detail: [{ msg: "bad" }] }, "fallback")).toBe("fallback");
    expect(errorReason({ detail: "  " }, "fallback")).toBe("fallback");
  });
});

describe("billingErrorMessage", () => {
  it("shows the typed error's reason and keeps the status", () => {
    const err = new BillingActionError("Only admins can manage billing", 403);
    expect(err.status).toBe(403);
    expect(billingErrorMessage(err, "fallback")).toBe("Only admins can manage billing");
    expect(billingErrorMessage("nope", "fallback")).toBe("fallback");
  });
});

describe("singleFlight", () => {
  it("shares one in-flight request between concurrent calls", async () => {
    let calls = 0;
    let release!: (v: string) => void;
    const action = singleFlight(() => {
      calls += 1;
      return new Promise<string>((resolve) => { release = resolve; });
    });
    const a = action();
    const b = action();
    release("url");
    expect(await a).toBe("url");
    expect(await b).toBe("url");
    expect(calls).toBe(1);
  });

  it("allows a new call after the previous one settles, even on failure", async () => {
    let calls = 0;
    const action = singleFlight(async () => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return "ok";
    });
    await expect(action()).rejects.toThrow("boom");
    expect(await action()).toBe("ok");
    expect(calls).toBe(2);
  });
});

describe("checkout return polling", () => {
  const before = billingFingerprint({ planId: null, totalCredits: 1000 });
  const after = billingFingerprint({ planId: "100", totalCredits: 73913 });

  it("fingerprint changes when the plan or credits change", () => {
    expect(before).not.toBe(after);
    expect(billingFingerprint({ planId: "100", totalCredits: 73913 })).toBe(after);
    expect(billingFingerprint({ planId: "100", totalCredits: 73913, cancelAtPeriodEnd: true })).not.toBe(after);
  });

  it("stops as soon as the webhook has applied", async () => {
    const results = [before, before, after];
    let checks = 0;
    const outcome = await pollUntilChanged({
      initial: before,
      check: async () => results[checks++] ?? after,
      delays: [1, 1, 1, 1, 1],
      sleep: noSleep,
    });
    expect(outcome).toBe("changed");
    expect(checks).toBe(3);
  });

  it("treats failed checks as not-yet and times out after the last delay", async () => {
    let checks = 0;
    const outcome = await pollUntilChanged({
      initial: before,
      check: async () => {
        checks += 1;
        if (checks % 2) throw new Error("503");
        return before;
      },
      delays: [1, 1, 1, 1],
      sleep: noSleep,
    });
    expect(outcome).toBe("timeout");
    expect(checks).toBe(4);
  });

  it("ignores null (usage failed) results", async () => {
    const outcome = await pollUntilChanged({ initial: before, check: async () => null, delays: [1, 1], sleep: noSleep });
    expect(outcome).toBe("timeout");
  });

  it("stops when aborted (page left)", async () => {
    const controller = new AbortController();
    let checks = 0;
    const outcome = await pollUntilChanged({
      initial: before,
      check: async () => { checks += 1; controller.abort(); return before; },
      delays: [1, 1, 1],
      signal: controller.signal,
      sleep: noSleep,
    });
    expect(outcome).toBe("aborted");
    expect(checks).toBe(1);
  });
});
