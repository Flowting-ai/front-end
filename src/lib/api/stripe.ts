"use client";

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
  type BillingInvoice as InvoiceInfo,
  type BillingPaymentMethod as PaymentMethodInfo,
  type BillingPlan,
  type CheckoutPlan,
  type PlanInfo,
  type SubscriptionActionResponse,
  type UserPlanType as PlanType,
} from "./user";

export {
  Billing,
  Billing as BillingInfo,
  Invoice,
  Usage,
  TeamsTier,
} from "./billing";

export interface CreateCheckoutSessionRequest {
  planId: CheckoutPlan;
}

export async function createCheckout(
  body: CreateCheckoutSessionRequest,
): Promise<CheckoutSessionResponse> {
  return createCheckoutSession(body.planId);
}
