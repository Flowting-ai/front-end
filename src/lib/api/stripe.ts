"use client";

// Thin compatibility layer over the zod-validated billing client in ./user —
// single implementation, two historical import paths.

import {
  createCheckoutSession,
  type CheckoutPlan,
  type CheckoutSessionResponse,
} from "./user";

export {
  billingInfoSchema,
  cancelSubscription,
  fetchBilling,
  openBillingPortal,
  resumeSubscription,
  startTrial,
  updatePlan,
  type BillingInfo,
  type BillingInvoice as InvoiceInfo,
  type BillingPaymentMethod as PaymentMethodInfo,
  type BillingPlan,
  type BillingUpcomingInvoice as UpcomingInvoiceInfo,
  type CheckoutPlan,
  type PlanInfo,
  type SubscriptionActionResponse,
  type UserPlanType as PlanType,
} from "./user";

export interface CreateCheckoutSessionRequest {
  planId: CheckoutPlan;
}

export async function createCheckout(
  body: CreateCheckoutSessionRequest,
): Promise<CheckoutSessionResponse> {
  return createCheckoutSession(body.planId);
}
