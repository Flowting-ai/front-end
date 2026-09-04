import { describe, expect, it } from "vitest";
import { Billing, CategorySpend, TeamsTier, Usage } from "./billing";
import { billingInfoSchema, usageResponseSchema } from "./billing-schemas";

describe("usageResponseSchema", () => {
  it("requires chat / slack / brain and rejects persona", () => {
    const parsed = usageResponseSchema.parse({
      credits: 40,
      spent_this_period: 4,
      by_category: { chat: 1, slack: 2, brain: 1 },
    });
    expect(parsed.by_category).toEqual({ chat: 1, slack: 2, brain: 1 });
  });
});

describe("Usage", () => {
  it("exposes own spend and remaining as display credits", () => {
    const usage = Usage.parse({
      credits: 56,
      plan_credits: 56,
      topup_credits: 0,
      used: 4,
      spent_this_period: 4,
      by_category: { chat: 0, slack: 4, brain: 0 },
    });
    expect(usage).toBeInstanceOf(Usage);
    expect(usage.byCategory).toBeInstanceOf(CategorySpend);
    expect(usage.remainingCredits).toBe(56000);
    expect(usage.ownSpendCredits).toBe(4000);
    expect(usage.byCategory.slackCredits).toBe(4000);
    expect(usage.byCategory.chatCredits).toBe(0);
  });
});

describe("billingInfoSchema", () => {
  it("matches the backend BillingInfo wire and ignores invented entity fields", () => {
    const parsed = billingInfoSchema.parse({
      plan_id: "250",
      plan_type: "teams",
      cancel_at_period_end: false,
      credits: {
        remaining: 200,
        used: 0,
        total_credits: 200,
        by_category: { chat: 0, slack: 0, brain: 0 },
      },
    });
    expect(parsed.plan_id).toBe("250");
    expect(parsed.credits.by_category.slack).toBe(0);
    expect("entity" in parsed).toBe(false);
  });
});

describe("Billing", () => {
  it("constructs camelCase fields from the validated wire", () => {
    const billing = Billing.parse({
      plan_id: "100",
      plan_type: "teams",
      payment_method: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 },
      invoices: [{ amount_paid: 100, currency: "usd", status: "paid", created: "2026-09-01T00:00:00Z" }],
      credits: { remaining: 80, used: 0, total_credits: 80 },
    });
    expect(billing).toBeInstanceOf(Billing);
    expect(billing.planId).toBe("100");
    expect(billing.paymentMethod?.last4).toBe("4242");
    expect(billing.paymentMethod?.label).toBe("Card ending in 4242");
    expect(billing.invoices[0]?.isPaid).toBe(true);
    expect(billing.teamsTier?.price).toBe(100);
  });
});

describe("TeamsTier", () => {
  it("is 80% of the catalog price in display credits", () => {
    expect(TeamsTier.fromPlanId("50")?.credits).toBe(40000);
    expect(TeamsTier.fromCredits(200000)?.planId).toBe("250");
  });
});
