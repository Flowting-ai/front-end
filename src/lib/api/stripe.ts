"use client";

import {
  createCheckoutSession,
  type CheckoutPlan,
  type CheckoutSessionResponse,
} from "./user";
import { singleFlight } from "@/lib/billing/billing-actions";

export {
  billingInfoSchema,
  cancelSubscription,
  openBillingPortal,
  resumeSubscription,
  startTrial,
  updatePlan,
  type BillingInvoice as InvoiceInfo,
  type BillingPaymentMethod as PaymentMethodInfo,
  type BillingPlan,
  type CheckoutPlan,
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
  billingInterval?: "monthly" | "annual";
}

/** Single-flight: a second click while a session is being created reuses the first request. */
export const createCheckout: (body: CreateCheckoutSessionRequest) => Promise<CheckoutSessionResponse> = singleFlight(
  (body: CreateCheckoutSessionRequest) => createCheckoutSession(body.planId, body.billingInterval),
);
