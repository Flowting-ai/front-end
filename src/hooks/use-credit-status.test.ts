import { describe, it, expect } from "vitest";
import { deriveCreditStatus } from "./use-credit-status";

// Coverage for the individual credit/topup gating rules:
//  • warn at ≥90% used (low), hard-block at exhaustion
//  • only applies to non-org, non-subscribed users (no double-gating)
// See credits-topup-gating-architecture.

describe("deriveCreditStatus — warning thresholds", () => {
  it("is normal below 90% used", () => {
    const s = deriveCreditStatus({ creditsTotal: 1000, creditsRemaining: 500 });
    expect(s.applies).toBe(true);
    expect(s.level).toBe("normal");
    expect(s.blocked).toBe(false);
    expect(s.pctUsed).toBeCloseTo(0.5);
  });

  it("warns (low) at exactly 90% used / 10% remaining", () => {
    const s = deriveCreditStatus({ creditsTotal: 1000, creditsRemaining: 100 });
    expect(s.level).toBe("low");
    expect(s.blocked).toBe(false);
    expect(s.pctUsed).toBeCloseTo(0.9);
  });

  it("warns (low) just past 90% used", () => {
    expect(deriveCreditStatus({ creditsTotal: 1000, creditsRemaining: 50 }).level).toBe("low");
  });

  it("stays normal just under the 90% threshold", () => {
    expect(deriveCreditStatus({ creditsTotal: 1000, creditsRemaining: 101 }).level).toBe("normal");
  });
});

describe("deriveCreditStatus — exhaustion / hard block", () => {
  it("blocks at zero remaining", () => {
    const s = deriveCreditStatus({ creditsTotal: 1000, creditsRemaining: 0 });
    expect(s.level).toBe("exhausted");
    expect(s.blocked).toBe(true);
    expect(s.pctUsed).toBe(1);
  });

  it("blocks on negative remaining (overspend) and clamps pctUsed to 1", () => {
    const s = deriveCreditStatus({ creditsTotal: 1000, creditsRemaining: -20 });
    expect(s.level).toBe("exhausted");
    expect(s.blocked).toBe(true);
    expect(s.pctUsed).toBe(1);
  });

  it("unblocks after a topup restores the balance", () => {
    // Mirrors the post-topup refresh: remaining goes 0 → 500, gate clears.
    expect(deriveCreditStatus({ creditsTotal: 1000, creditsRemaining: 0 }).blocked).toBe(true);
    expect(deriveCreditStatus({ creditsTotal: 1000, creditsRemaining: 500 }).blocked).toBe(false);
  });
});

describe("deriveCreditStatus — scoping", () => {
  it("applies to subscribers too — they are blocked when exhausted", () => {
    // Subscribers can run out of plan credits and recharge via topup, so the
    // gate now covers them (creditsRemaining is topup-aware in auth-context).
    const s = deriveCreditStatus({ creditsTotal: 60000, creditsRemaining: 0 });
    expect(s.applies).toBe(true);
    expect(s.level).toBe("exhausted");
    expect(s.blocked).toBe(true);
  });

  it("does not apply to org/team members (gated by workspace pool)", () => {
    const s = deriveCreditStatus({ creditsTotal: 1000, creditsRemaining: 0, orgId: "org_123" });
    expect(s.applies).toBe(false);
    expect(s.blocked).toBe(false);
  });

  it("does not apply to fresh users with no allocation", () => {
    expect(deriveCreditStatus({ creditsTotal: 0, creditsRemaining: 0 }).applies).toBe(false);
    expect(deriveCreditStatus(null).applies).toBe(false);
    expect(deriveCreditStatus({}).applies).toBe(false);
  });
});
