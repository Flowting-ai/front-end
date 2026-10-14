import { describe, expect, it } from "vitest";
import { TeamsTier } from "@/lib/api/plan";
import { friendlyApiError } from "@/lib/api/client";

/**
 * Mirrors back-end services/stripe/catalog.py `usageCredits`:
 * floor((price × (0.75 if annual)) / 1.15, 6 dp), then × 1000 credits, rounded.
 * The client still carries USAGE_RATIO because the backend has no plans
 * endpoint; this pins the two together until it does.
 */
function backendCredits(planId: string, interval: "monthly" | "annual"): number {
  const monthly = Number(planId) * (interval === "annual" ? 0.75 : 1);
  const usd = Math.floor((monthly / 1.15) * 1_000_000) / 1_000_000;
  return Math.max(0, Math.round(usd * 1000));
}

describe("TeamsTier credits match the backend catalog", () => {
  for (const tier of [...TeamsTier.all, ...TeamsTier.legacy]) {
    it(`plan ${tier.planId} monthly and annual`, () => {
      expect(tier.credits).toBe(backendCredits(tier.planId, "monthly"));
      expect(new TeamsTier(tier.planId, "annual").credits).toBe(backendCredits(tier.planId, "annual"));
    });
  }

  it("known values", () => {
    expect(TeamsTier.fromPlanId("100")?.credits).toBe(86957);
    expect(TeamsTier.fromPlanId("50")?.credits).toBe(43478);
  });
});

describe("backend 402 and the client exhausted state agree", () => {
  it("a 402 reads as out of credits", () => {
    expect(friendlyApiError("Request failed with status 402", 402)).toMatch(/run out of credits/);
    expect(friendlyApiError("Insufficient credits")).toMatch(/run out of credits/);
  });
});
