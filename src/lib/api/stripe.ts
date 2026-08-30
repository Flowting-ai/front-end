"use client";

// Thin compatibility layer over the zod-validated billing client in ./user —
// single implementation, two historical import paths.

import {
  chargeTopUp as chargeTopUpAmount,
  createCheckoutSession,
  createTopUpSession,
  type CheckoutPlan,
  type CheckoutSessionResponse,
  type TopUpChargeResponse,
  type TopUpSessionResponse,
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

export interface CreateTopUpSessionRequest {
  amount_usd: number;
}

export async function createCheckout(
  body: CreateCheckoutSessionRequest,
): Promise<CheckoutSessionResponse> {
  return createCheckoutSession(body.planId);
}

export async function createTopUp(
  body: CreateTopUpSessionRequest,
): Promise<TopUpSessionResponse> {
  return createTopUpSession(body.amount_usd);
}

export async function chargeTopUp(
  body: CreateTopUpSessionRequest,
): Promise<TopUpChargeResponse> {
  return chargeTopUpAmount(body.amount_usd);
}
