import { describe, it, expect } from "vitest";
import { creditsFromUsage, creditsFromBilling, EMPTY_CREDIT_BALANCE } from "@/lib/credits";
import type { UserUsage, BillingCredits } from "@/lib/api/user";

// Helpers to build partial fixtures without the full type surface.
const usage = (u: Partial<UserUsage> & Record<string, unknown>) => u as unknown as UserUsage;
const billing = (b: Partial<BillingCredits> & Record<string, unknown>) => b as unknown as BillingCredits;

describe("creditsFromUsage (/users/me usage)", () => {
  it("individual subscriber: credits is REMAINING, allowance = remaining + used", () => {
    // Real account values from /users/me.
    const b = creditsFromUsage(usage({ credits: 18.668632, spent_this_period: 23.385462, topup_credits: 0 }));
    expect(b).toEqual({ total: 42054, used: 23385, remaining: 18669, isTrial: false });
  });

  it("trial: stacks top-ups onto the trial pool", () => {
    const b = creditsFromUsage(usage({ spent_this_period: 0.5, topup_credits: 2, trial: { remaining: 0.5 } }));
    // remaining = (0.5 + 2) * 1000 = 2500; used = 500; total = remaining + used (no amount in usage.trial)
    expect(b).toEqual({ total: 3000, used: 500, remaining: 2500, isTrial: true });
  });

  it("free / no credits → empty", () => {
    expect(creditsFromUsage(usage({ credits: 0, spent_this_period: 0 }))).toEqual(EMPTY_CREDIT_BALANCE);
    expect(creditsFromUsage(null)).toEqual(EMPTY_CREDIT_BALANCE);
  });
});

describe("creditsFromBilling (/stripe/billing credits)", () => {
  it("individual (current shape): explicit remaining + scalar used; total = allowance", () => {
    // Real account values from the live /stripe/billing response.
    const b = creditsFromBilling(
      billing({
        total_credits: 37.674907,
        plan_credits: 37.674907,
        topup_credits: 0,
        used: 19.006275,
        remaining: 18.668632,
        trial: null,
        by_category: { chat: 10.885994, persona: 8.211451, brain: 4.288017 },
      }),
    );
    expect(b).toEqual({ total: 37675, used: 19006, remaining: 18669, isTrial: false });
  });

  it("individual (legacy shape): total_credits is REMAINING; used = Σ per-category", () => {
    const b = creditsFromBilling(
      billing({
        total_credits: 18.668632,
        plan_credits: 18.668632,
        topup_credits: 0,
        trial: null,
        used: { chat: 10.885994, persona: 8.211451, brain: 4.288017 },
      }),
    );
    expect(b).toEqual({ total: 42054, used: 23385, remaining: 18669, isTrial: false });
  });

  it("trial: uses explicit amount/remaining/used and stacks top-ups", () => {
    const b = creditsFromBilling(
      billing({ total_credits: 1, plan_credits: 1, topup_credits: 0, trial: { amount: 1, remaining: 0.4, used: 0.6 } }),
    );
    expect(b).toEqual({ total: 1000, used: 600, remaining: 400, isTrial: true });
  });

  it("null → empty", () => {
    expect(creditsFromBilling(null)).toEqual(EMPTY_CREDIT_BALANCE);
  });
});
