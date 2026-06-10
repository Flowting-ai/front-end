"use client";

import {
  STRIPE_BILLING_ENDPOINT,
  STRIPE_CHECKOUT_ENDPOINT,
  STRIPE_PORTAL_ENDPOINT,
  STRIPE_SUBSCRIPTION_ENDPOINT,
  STRIPE_SUBSCRIPTION_RESUME_ENDPOINT,
  STRIPE_TOPUP_ENDPOINT,
  STRIPE_TOPUP_CHARGE_ENDPOINT,
  STRIPE_TRIAL_ENDPOINT,
} from "@/lib/config";
import { apiFetch, apiFetchJson, ApiError } from "./client";

// ── Schemas (match OpenAPI components.schemas) ────────────────────────────────

export type PlanType = "starter" | "pro" | "power" | "trial";

export interface CreateCheckoutSessionRequest {
  plan_type: PlanType;
  /** Default 'monthly'. */
  billing?:  string;
}

export interface CreateCheckoutSessionResponse {
  checkout_url: string;
  session_id:   string;
}

export interface CreateTopUpSessionRequest {
  /** Dollars to add as credit (1:1). Stripe minimum: $1. */
  amount_usd: number;
}

export interface CreateTopUpSessionResponse {
  checkout_url: string;
}

export interface TopUpChargeResponse {
  status: string;
  client_secret?: string | null;
}

export interface SubscriptionActionResponse {
  status: string;
  plan_type?: string | null;
  current_period_end?: string | null;
}

export interface TrialSummary {
  remaining: number;
  expires_at: string;
}

export interface UsageResponse {
  credits: number;
  plan_credits: number;
  topup_credits: number;
  used: number;
  spent_this_period: number;
  trial?: TrialSummary | null;
  by_category?: { chat?: number; persona?: number; brain?: number };
}

export interface BillingPortalResponse {
  portal_url: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * POST /stripe/checkout — start a checkout session for the given plan.
 * Use this both for initial signup and to switch plans.
 */
export async function createCheckout(
  body: CreateCheckoutSessionRequest,
): Promise<CreateCheckoutSessionResponse> {
  return apiFetchJson<CreateCheckoutSessionResponse>(STRIPE_CHECKOUT_ENDPOINT, {
    method: "POST",
    body:   JSON.stringify({ billing: "monthly", ...body }),
  });
}

/** POST /stripe/topup — start a checkout session to add prepaid credit. */
export async function createTopUp(
  body: CreateTopUpSessionRequest,
): Promise<CreateTopUpSessionResponse> {
  return apiFetchJson<CreateTopUpSessionResponse>(STRIPE_TOPUP_ENDPOINT, {
    method: "POST",
    body:   JSON.stringify(body),
  });
}

/** POST /stripe/topup/charge — charge the saved payment method immediately. */
export async function chargeTopUp(
  body: CreateTopUpSessionRequest,
): Promise<TopUpChargeResponse> {
  return apiFetchJson<TopUpChargeResponse>(STRIPE_TOPUP_CHARGE_ENDPOINT, {
    method: "POST",
    body:   JSON.stringify(body),
  });
}

/** POST /stripe/trial — grant 1000 free trial credits. */
export async function startTrial(): Promise<UsageResponse> {
  return apiFetchJson<UsageResponse>(STRIPE_TRIAL_ENDPOINT, { method: "POST" });
}

/** DELETE /stripe/subscription — cancel the current user's subscription. */
export async function cancelSubscription(): Promise<SubscriptionActionResponse> {
  const res = await apiFetch(STRIPE_SUBSCRIPTION_ENDPOINT, { method: "DELETE" });

  let data: SubscriptionActionResponse & { error?: string } = { status: "" };
  try {
    data = (await res.json()) as SubscriptionActionResponse & { error?: string };
  } catch {
    // non-JSON body
  }

  if (!res.ok || !data.status) {
    throw new ApiError(
      res.status,
      "stripe_cancel_failed",
      data.error || "Failed to cancel subscription.",
    );
  }

  return { status: data.status, plan_type: data.plan_type, current_period_end: data.current_period_end };
}

/** POST /stripe/subscription/resume — re-activate a cancelled subscription. */
export async function resumeSubscription(): Promise<SubscriptionActionResponse> {
  const res = await apiFetch(STRIPE_SUBSCRIPTION_RESUME_ENDPOINT, { method: "POST" });

  let data: SubscriptionActionResponse & { error?: string } = { status: "" };
  try {
    data = (await res.json()) as SubscriptionActionResponse & { error?: string };
  } catch {
    // non-JSON body
  }

  if (!res.ok || !data.status) {
    throw new ApiError(
      res.status,
      "stripe_resume_failed",
      data.error || "Failed to resume subscription.",
    );
  }

  return { status: data.status, plan_type: data.plan_type, current_period_end: data.current_period_end };
}

/** GET /stripe/billing — payment method, invoices, upcoming invoice. */
export async function fetchBilling(): Promise<Record<string, unknown> | null> {
  const res = await apiFetch(STRIPE_BILLING_ENDPOINT, { method: "GET" });
  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}

/** POST /stripe/portal — create a Stripe-hosted billing portal session. */
export async function openBillingPortal(): Promise<string | null> {
  const res = await apiFetch(STRIPE_PORTAL_ENDPOINT, { method: "POST" });
  if (!res.ok) return null;
  const data = (await res.json()) as BillingPortalResponse;
  return data.portal_url ?? null;
}
