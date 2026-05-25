"use client";

import {
  STRIPE_CHECKOUT_ENDPOINT,
  STRIPE_SUBSCRIPTION_ENDPOINT,
  STRIPE_TOPUP_ENDPOINT,
} from "@/lib/config";
import { apiFetch, apiFetchJson, ApiError } from "./client";

// ── Schemas (match OpenAPI components.schemas) ────────────────────────────────

export type PlanType = "starter" | "pro" | "power";

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

/** DELETE /stripe/subscription — cancel the current user's subscription. */
export async function cancelSubscription(): Promise<{ status: string }> {
  const res = await apiFetch(STRIPE_SUBSCRIPTION_ENDPOINT, { method: "DELETE" });

  let data: { status?: string; error?: string } = {};
  try {
    data = (await res.json()) as { status?: string; error?: string };
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

  return { status: data.status };
}
