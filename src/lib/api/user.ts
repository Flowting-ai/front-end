"use client";

import {
  USER_CHECKOUT_ENDPOINT,
  USER_CREATE_ENDPOINT,
  USER_ENDPOINT,
  USER_SUBSCRIPTION_ENDPOINT,
} from "@/lib/config";
import { apiFetch } from "./client";

export type UserPlanType = "standard" | "pro" | "power";

export interface UserPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  funding?: string;
  is_default?: boolean;
}

export interface UserInvoiceLine {
  description?: string;
  amount: number;
  currency: string;
}

export interface UserInvoice {
  id: string;
  number?: string | null;
  amount_paid: number;
  amount_due?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  currency: string;
  status: string;
  paid?: boolean;
  created: string;
  period_start?: string;
  period_end?: string;
  invoice_url: string;
  invoice_pdf: string;
  payment_method?: Partial<UserPaymentMethod>;
  lines?: UserInvoiceLine[];
}

export interface UserUpcomingInvoice {
  amount_due: number;
  currency: string;
  next_payment_date?: string | null;
  lines?: UserInvoiceLine[];
}

export interface UserUsage {
  monthly_limit: number;
  monthly_used: number;
  monthly_remaining: number;
  monthly_used_pct?: number;
  daily_limit: number;
  daily_used: number;
  daily_remaining: number;
  daily_used_pct?: number;
  last_reset_date?: string;
  by_category?: {
    chat?: number;
    persona?: number;
    workflow?: number;
  };
  daily_by_category?: {
    chat?: number;
    persona?: number;
    workflow?: number;
  };
}

export interface UserProfile {
  auth0_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  plan_type: UserPlanType | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  payment_methods?: UserPaymentMethod[];
  invoices?: UserInvoice[];
  upcoming_invoice?: UserUpcomingInvoice | null;
  usage?: UserUsage | null;
  billing_portal_url?: string | null;
  created_at: string | null;
  active: boolean | null;
}

function normalizeUserProfile(raw: unknown): UserProfile {
  const payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const root = ((payload.data ?? payload.user ?? payload) &&
    typeof (payload.data ?? payload.user ?? payload) === "object"
    ? (payload.data ?? payload.user ?? payload)
    : payload) as Record<string, unknown>;

  const paymentMethods = Array.isArray(root.payment_methods)
    ? (root.payment_methods as UserPaymentMethod[])
    : root.payment_method && typeof root.payment_method === "object"
      ? [root.payment_method as UserPaymentMethod]
      : [];

  return {
    auth0_id: String(root.auth0_id ?? ""),
    first_name:
      typeof root.first_name === "string" ? root.first_name : null,
    last_name:
      typeof root.last_name === "string" ? root.last_name : null,
    email: typeof root.email === "string" ? root.email : null,
    phone_number:
      typeof root.phone_number === "string" ? root.phone_number : null,
    plan_type:
      root.plan_type === "standard" ||
      root.plan_type === "pro" ||
      root.plan_type === "power"
        ? root.plan_type
        : null,
    subscription_status:
      typeof root.subscription_status === "string"
        ? root.subscription_status
        : null,
    current_period_end:
      typeof root.current_period_end === "string"
        ? root.current_period_end
        : null,
    cancel_at_period_end: Boolean(root.cancel_at_period_end),
    payment_methods: paymentMethods,
    invoices: Array.isArray(root.invoices) ? (root.invoices as UserInvoice[]) : [],
    upcoming_invoice:
      root.upcoming_invoice && typeof root.upcoming_invoice === "object"
        ? (root.upcoming_invoice as UserUpcomingInvoice)
        : null,
    usage:
      root.usage && typeof root.usage === "object"
        ? (root.usage as UserUsage)
        : null,
    billing_portal_url:
      typeof root.billing_portal_url === "string"
        ? root.billing_portal_url
        : null,
    created_at:
      typeof root.created_at === "string" ? root.created_at : null,
    active: typeof root.active === "boolean" ? root.active : null,
  };
}

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
}

export interface UpdateSubscriptionResponse {
  status: string;
  new_plan: UserPlanType;
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const response = await apiFetch(USER_ENDPOINT, { method: "GET" });
  if (!response.ok) return null;
  const json = await response.json();
  return normalizeUserProfile(json);
}

export async function createUser(): Promise<UserProfile | null> {
  const response = await apiFetch(USER_CREATE_ENDPOINT, { method: "POST" });
  if (!response.ok) return null;
  const json = await response.json();
  return normalizeUserProfile(json);
}

export async function updateUser(payload: {
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
}): Promise<UserProfile | null> {
  const response = await apiFetch(USER_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;
  const json = await response.json();
  return normalizeUserProfile(json);
}

export async function deleteUser(): Promise<void> {
  await apiFetch(USER_ENDPOINT, { method: "DELETE" });
}

export async function createCheckoutSession(
  plan_type: UserPlanType,
): Promise<CheckoutSessionResponse> {
  const response = await apiFetch(USER_CHECKOUT_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ plan_type }),
  });

  const data = (await response.json()) as
    | CheckoutSessionResponse
    | { error?: string };

  if (!response.ok || !("checkout_url" in data)) {
    throw new Error(
      ("error" in data && data.error) || "Failed to create checkout session.",
    );
  }

  return data;
}

export async function updateSubscriptionPlan(
  plan_type: UserPlanType,
): Promise<UpdateSubscriptionResponse | CheckoutSessionResponse> {
  const response = await apiFetch(USER_SUBSCRIPTION_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify({ plan_type }),
  });

  const data = (await response.json()) as
    | UpdateSubscriptionResponse
    | CheckoutSessionResponse
    | { error?: string };

  if (!response.ok) {
    throw new Error(
      ("error" in data && data.error) || "Failed to update subscription.",
    );
  }

  return data as UpdateSubscriptionResponse | CheckoutSessionResponse;
}

export async function cancelSubscription(): Promise<{ status: string }> {
  const response = await apiFetch(USER_SUBSCRIPTION_ENDPOINT, {
    method: "DELETE",
  });

  const data = (await response.json()) as { status?: string; detail?: string };

  if (!response.ok) {
    throw new Error(data.detail || "Failed to cancel subscription.");
  }

  return { status: data.status ?? "canceled" };
}
