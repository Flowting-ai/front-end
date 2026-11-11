import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch, ApiError } from "@/lib/api/client";
import { Billing, Invoice, Usage } from "@/lib/api/billing";
import { queryKeys } from "@/lib/query-keys";
import {
  billingInfoQuery,
  invoicesQuery,
  needsInvoiceList,
  personalBillingFingerprint,
  pickInvoices,
  usageQuery,
} from "./billing-queries";

const mockFetch = vi.mocked(apiFetch);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const billingWith = (invoices: unknown[]) =>
  Billing.parse({
    plan: { organization_id: "org-1", plan_type: "teams", plan_id: "100" },
    invoices,
    credits: { remaining: 80, used: 0, total_credits: 80 },
  });
const usage = Usage.parse({ credits: 56, used: 4, by_category: { chat: 1, slack: 0, automation: 0, subtask: 0 } });

afterEach(() => mockFetch.mockReset());

describe("billing query options", () => {
  it("keys by org scope and keeps usage always stale", () => {
    expect(billingInfoQuery("o1").queryKey).toEqual(queryKeys.billing.info("o1"));
    expect(invoicesQuery("o1").queryKey).toEqual(queryKeys.billing.invoices("o1"));
    expect(usageQuery("o1").staleTime).toBe(0);
    expect(usageQuery("o1", false).enabled).toBe(false);
  });
});

describe("loaders", () => {
  it("Billing.fetch maps 403 to null and throws ApiError on other failures", async () => {
    mockFetch.mockResolvedValueOnce(json(403, { detail: "admins only" }));
    await expect(Billing.fetch()).resolves.toBeNull();
    mockFetch.mockResolvedValueOnce(json(503, { detail: "down" }));
    await expect(Billing.fetch()).rejects.toBeInstanceOf(ApiError);
  });

  it("Usage.fetch and Invoice.list throw ApiError instead of returning empty data", async () => {
    mockFetch.mockResolvedValueOnce(json(500, {}));
    await expect(Usage.fetch()).rejects.toMatchObject({ status: 500 });
    mockFetch.mockResolvedValueOnce(json(502, {}));
    await expect(Invoice.list()).rejects.toMatchObject({ status: 502 });
  });
});

describe("invoice selection", () => {
  const invoice = { amount_paid: 100, currency: "usd", status: "paid", created: "2026-09-01T00:00:00Z" };

  it("prefers invoices embedded in /stripe/billing", () => {
    const billing = billingWith([invoice]);
    expect(needsInvoiceList(true, billing)).toBe(false);
    expect(pickInvoices(billing, [])).toHaveLength(1);
  });

  it("falls back to the standalone list once billing has loaded without invoices", () => {
    expect(needsInvoiceList(false, null)).toBe(false);
    expect(needsInvoiceList(true, null)).toBe(true);
    expect(needsInvoiceList(true, billingWith([]))).toBe(true);
    expect(pickInvoices(billingWith([]), undefined)).toEqual([]);
  });
});

describe("personalBillingFingerprint", () => {
  it("is null without usage and changes when credits change", () => {
    expect(personalBillingFingerprint(null, null)).toBeNull();
    const before = personalBillingFingerprint(usage, billingWith([]));
    const more = Usage.parse({ credits: 156, used: 4, by_category: { chat: 1, slack: 0, automation: 0, subtask: 0 } });
    expect(personalBillingFingerprint(more, billingWith([]))).not.toBe(before);
  });
});
