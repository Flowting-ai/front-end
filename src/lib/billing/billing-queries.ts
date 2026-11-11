import { queryOptions } from "@tanstack/react-query";
import { Billing, Invoice, Usage } from "@/lib/api/billing";
import { queryKeys } from "@/lib/query-keys";
import { STALE_DEFAULT_MS, STALE_REALTIME_MS } from "@/lib/query-policy";
import { billingFingerprint } from "@/lib/billing/billing-actions";

/**
 * React Query options for billing reads. `org` is `orgScope(orgId)`. Writes
 * (checkout, plan change, cancel, resume) stay in billing-actions / api/user and
 * are never optimistic; after one, call `invalidateCredits` or refetch `billing.all(org)`.
 */

/** GET /stripe/billing. Admin-only: null for members and solo users (403). */
export const billingInfoQuery = (org: string, enabled = true) =>
  queryOptions({
    queryKey: queryKeys.billing.info(org),
    queryFn: () => Billing.fetch(),
    staleTime: STALE_DEFAULT_MS,
    enabled,
  });

/** GET /stripe/usage. The balance should be current, so it is never treated as fresh. */
export const usageQuery = (org: string, enabled = true) =>
  queryOptions({
    queryKey: queryKeys.billing.usage(org),
    queryFn: () => Usage.fetch(),
    staleTime: STALE_REALTIME_MS,
    enabled,
  });

/** GET /stripe/invoices, used only when /stripe/billing carries no invoices. */
export const invoicesQuery = (org: string, enabled = true) =>
  queryOptions({
    queryKey: queryKeys.billing.invoices(org),
    queryFn: () => Invoice.list(),
    staleTime: STALE_DEFAULT_MS,
    enabled,
  });

/** Invoices from /stripe/billing when present, else from the standalone list. */
export function pickInvoices(billing: Billing | null | undefined, listed: Invoice[] | undefined): Invoice[] {
  if (billing && billing.invoices.length > 0) return billing.invoices;
  return listed ?? [];
}

/** Whether the standalone invoice list is needed (billing loaded and had none). */
export function needsInvoiceList(billingLoaded: boolean, billing: Billing | null | undefined): boolean {
  return billingLoaded && !(billing && billing.invoices.length > 0);
}

/** Fingerprint of what a Stripe purchase changes, for the checkout-return poll. Null when usage is unknown. */
export function personalBillingFingerprint(usage: Usage | null, billing: Billing | null): string | null {
  if (!usage) return null;
  return billingFingerprint({
    planId: billing?.plan?.planId,
    totalCredits: usage.totalCredits,
    cancelAtPeriodEnd: billing?.plan?.cancelAtPeriodEnd,
    paymentSetupComplete: billing?.paymentSetupComplete,
  });
}
