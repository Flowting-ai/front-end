import { describe, expect, it } from "vitest";
import { Billing, CategorySpend, Invoice, TeamsTier, UpcomingInvoice, Usage } from "./billing";
import { billingInfoSchema, parseInvoices, usageResponseSchema } from "./billing-schemas";

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

describe("parseInvoices", () => {
  it("keeps valid rows when one invoice is malformed", () => {
    const parsed = parseInvoices([
      { amount_paid: 100, amount_due: 0, currency: null, status: "paid", created: 1756684800 },
      { amount_paid: "not-a-number", created: {} },
      { amount_paid: 0, amount_due: 250, status: "open", created: "2026-09-01T00:00:00Z" },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.currency).toBe("usd");
    expect(parsed[0]?.created).toEqual(expect.any(String));
    expect(parsed[1]?.amount_due).toBe(250);
  });
});

describe("Invoice", () => {
  it("shows amount due until the invoice is paid", () => {
    const open = new Invoice({
      amount_paid: 0,
      amount_due: 250,
      currency: "usd",
      status: "open",
      created: "2026-09-01T00:00:00Z",
      invoice_url: null,
      invoice_pdf: null,
    });
    const paid = new Invoice({
      amount_paid: 250,
      amount_due: 0,
      currency: "usd",
      status: "paid",
      created: "2026-09-01T00:00:00Z",
      invoice_url: "https://example.com/inv",
      invoice_pdf: null,
    });
    expect(open.displayAmount).toBe(250);
    expect(open.statusLabel).toBe("Open");
    expect(paid.displayAmount).toBe(250);
    expect(paid.isPaid).toBe(true);
  });

  it("prepends the upcoming invoice onto issued history", () => {
    const issued = Invoice.parseAll([
      { amount_paid: 250, amount_due: 0, status: "paid", created: "2026-08-01T00:00:00Z" },
    ]);
    const upcoming = new UpcomingInvoice({
      amount_due: 250,
      currency: "usd",
      next_payment_date: "2026-10-01T00:00:00",
    });
    const rows = Invoice.history(issued, upcoming);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.isUpcoming).toBe(true);
    expect(rows[0]?.displayAmount).toBe(250);
    expect(rows[1]?.isPaid).toBe(true);
  });
});

describe("TeamsTier", () => {
  it("is 80% of the catalog price in display credits", () => {
    expect(TeamsTier.fromPlanId("50")?.credits).toBe(40000);
    expect(TeamsTier.fromCredits(200000)?.planId).toBe("250");
  });
});
