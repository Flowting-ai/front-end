"use client";

import {
  STRIPE_BILLING_ENDPOINT,
  STRIPE_CHECKOUT_ENDPOINT,
  STRIPE_PORTAL_ENDPOINT,
  STRIPE_SUBSCRIPTION_ENDPOINT,
  STRIPE_TOPUP_ENDPOINT,
  USER_CREATE_ENDPOINT,
  USER_ENDPOINT,
  USER_ONBOARDING_ENDPOINT,
} from "@/lib/config";
import { parsePlanTierFromApi } from "@/lib/plan-tier";
import { apiFetch } from "./client";

export type UserPlanType = "starter" | "pro" | "power";
export type BillingPlan = "monthly";

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
  /** Period credit allowance (API field `credits`). */
  credits: number;
  /** Credits consumed in the current period (API field `spent_this_period`). */
  spent_this_period: number;
  by_category?: {
    chat?: number;
    persona?: number;
    workflow?: number;
  };
  // ── Legacy mirrors (kept populated by normalizeUserProfile for back-compat) ──
  monthly_limit: number;
  monthly_used: number;
  monthly_remaining: number;
  monthly_used_pct?: number;
  bonus_credits?: number;
  effective_limit?: number;
  daily_limit: number;
  daily_used: number;
  daily_remaining: number;
  daily_used_pct?: number;
  last_reset_date?: string;
  daily_by_category?: {
    chat?: number;
    persona?: number;
    workflow?: number;
  };
}

export interface TrialCredits {
  amount: number;
  remaining: number;
  used: number;
  starts_at?: string | null;
  expires_at?: string | null;
}

export interface BillingCredits {
  total_credits: number;
  plan_credits: number;
  topup_credits: number;
  trial?: TrialCredits | null;
  used?: {
    chat?: number;
    persona?: number;
    brain?: number;
  } | null;
}

export interface UserOnboarding {
  completed: boolean;
  user_role?: string | null;
  ai_tone?: string | null;
  role_fit?: string | null;
}

export interface UserProfile {
  auth0_id?: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  profile_picture: string | null;
  plan_type: UserPlanType | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  next_billing_date?: string | null;
  cancel_at_period_end?: boolean;
  payment_methods?: UserPaymentMethod[];
  invoices?: UserInvoice[];
  upcoming_invoice?: UserUpcomingInvoice | null;
  usage?: UserUsage | null;
  onboarding?: UserOnboarding | null;
  credits?: BillingCredits | null;
  connections?: unknown[];
  billing_portal_url?: string | null;
  created_at: string | null;
  active: boolean | null;
}

function normalizeUserProfile(raw: unknown): UserProfile {
  const payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const root = (
    (payload.data ?? payload.user ?? payload) &&
    typeof (payload.data ?? payload.user ?? payload) === "object"
      ? (payload.data ?? payload.user ?? payload)
      : payload
  ) as Record<string, unknown>;

  const paymentMethods = Array.isArray(root.payment_methods)
    ? (root.payment_methods as UserPaymentMethod[])
    : root.payment_method && typeof root.payment_method === "object"
      ? [root.payment_method as UserPaymentMethod]
      : [];

  // The API nests plan details under `plan` (PlanSummary). Older payloads kept
  // them flat on the root — read either, preferring the nested object.
  const planObj = (root.plan && typeof root.plan === "object"
    ? (root.plan as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const planType = parsePlanTierFromApi(planObj.plan_type ?? root.plan_type);

  return {
    auth0_id: String(root.auth0_id ?? ""),
    first_name: typeof root.first_name === "string" ? root.first_name : null,
    last_name: typeof root.last_name === "string" ? root.last_name : null,
    email: typeof root.email === "string" ? root.email : null,
    phone_number: typeof root.phone_number === "string" ? root.phone_number : null,
    profile_picture: typeof root.profile_picture === "string" ? root.profile_picture : null,
    plan_type: planType,
    subscription_status:
      typeof planObj.subscription_status === "string"
        ? planObj.subscription_status
        : typeof root.subscription_status === "string"
          ? root.subscription_status
          : null,
    current_period_end:
      typeof planObj.current_period_end === "string"
        ? planObj.current_period_end
        : typeof root.current_period_end === "string"
          ? root.current_period_end
          : null,
    next_billing_date:
      typeof root.next_billing_date === "string"
        ? root.next_billing_date
        : typeof root.next_billing_at === "string"
          ? root.next_billing_at
          : typeof root.next_billing === "string"
            ? root.next_billing
            : null,
    cancel_at_period_end: Boolean(root.cancel_at_period_end),
    payment_methods: paymentMethods,
    invoices: Array.isArray(root.invoices)
      ? (root.invoices as Record<string, unknown>[]).map((inv, idx) => ({
          ...(inv as object),
          id: typeof inv.id === "string" ? inv.id : `inv-${idx}`,
          paid: typeof inv.paid === "boolean" ? inv.paid : inv.status === "paid",
        } as UserInvoice))
      : [],
    upcoming_invoice:
      root.upcoming_invoice && typeof root.upcoming_invoice === "object"
        ? (root.upcoming_invoice as UserUpcomingInvoice)
        : null,
    usage:
      root.usage && typeof root.usage === "object"
        ? (() => {
            const u = root.usage as Record<string, unknown>;
            // Current API shape: { credits, spent_this_period, by_category{chat,persona} }.
            // `credits` is the period allowance; `spent_this_period` is consumption.
            // Older payloads used monthly_limit/monthly_used — fall back to those.
            const credits =
              typeof u.credits === "number"
                ? u.credits
                : typeof u.monthly_limit === "number"
                  ? u.monthly_limit
                  : 0;
            const spent =
              typeof u.spent_this_period === "number"
                ? u.spent_this_period
                : typeof u.monthly_used === "number"
                  ? u.monthly_used
                  : 0;
            const dl = typeof u.daily_limit === "number" ? u.daily_limit : 0;
            const du = typeof u.daily_used === "number" ? u.daily_used : 0;
            return {
              ...(u as object),
              credits,
              spent_this_period: spent,
              // Legacy mirrors so existing consumers (auth-context, sidebar) keep working.
              monthly_limit: credits,
              monthly_used: spent,
              monthly_remaining:
                typeof u.monthly_remaining === "number"
                  ? u.monthly_remaining
                  : credits - spent,
              bonus_credits: typeof u.bonus_credits === "number" ? u.bonus_credits : 0,
              effective_limit: typeof u.effective_limit === "number" ? u.effective_limit : credits,
              daily_limit: dl,
              daily_used: du,
              daily_remaining:
                typeof u.daily_remaining === "number" ? u.daily_remaining : dl - du,
            } as UserUsage;
          })()
        : null,
    onboarding:
      root.onboarding && typeof root.onboarding === "object"
        ? (() => {
            const o = root.onboarding as Record<string, unknown>;
            return {
              completed: Boolean(o.completed),
              user_role: typeof o.user_role === "string" ? o.user_role : null,
              ai_tone: typeof o.ai_tone === "string" ? o.ai_tone : null,
              role_fit: typeof o.role_fit === "string" ? o.role_fit : null,
            } as UserOnboarding;
          })()
        : null,
    credits:
      root.credits && typeof root.credits === "object"
        ? (() => {
            const c = root.credits as Record<string, unknown>;
            const trial =
              c.trial && typeof c.trial === "object"
                ? (() => {
                    const t = c.trial as Record<string, unknown>;
                    return {
                      amount: typeof t.amount === "number" ? t.amount : 0,
                      remaining: typeof t.remaining === "number" ? t.remaining : 0,
                      used: typeof t.used === "number" ? t.used : 0,
                      starts_at: typeof t.starts_at === "string" ? t.starts_at : null,
                      expires_at: typeof t.expires_at === "string" ? t.expires_at : null,
                    } as TrialCredits;
                  })()
                : null;
            const used =
              c.used && typeof c.used === "object"
                ? (c.used as { chat?: number; persona?: number; brain?: number })
                : null;
            return {
              total_credits: typeof c.total_credits === "number" ? c.total_credits : 0,
              plan_credits: typeof c.plan_credits === "number" ? c.plan_credits : 0,
              topup_credits: typeof c.topup_credits === "number" ? c.topup_credits : 0,
              trial,
              used,
            } as BillingCredits;
          })()
        : null,
    connections: Array.isArray(root.connections) ? root.connections : [],
    billing_portal_url:
      typeof root.billing_portal_url === "string" ? root.billing_portal_url : null,
    created_at: typeof root.created_at === "string" ? root.created_at : null,
    active: typeof root.active === "boolean" ? root.active : null,
  };
}

// ── Billing snapshot (GET /stripe/billing → BillingInfo) ──────────────────────

export interface BillingPaymentMethod {
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  funding?: string | null;
}

export interface BillingInvoice {
  amount_paid: number;
  currency: string;
  status: string | null;
  created: string | null;
  invoice_url: string | null;
  invoice_pdf: string | null;
}

export interface BillingUpcomingInvoice {
  amount_due: number;
  currency: string;
  next_payment_date: string | null;
}

export interface BillingInfo {
  plan_type: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  payment_method: BillingPaymentMethod | null;
  invoices: BillingInvoice[];
  upcoming_invoice: BillingUpcomingInvoice | null;
  credits: BillingCredits | null;
}

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
}

export interface TopUpSessionResponse {
  checkout_url: string;
}

export interface UpdateSubscriptionResponse {
  status: string;
  new_plan: UserPlanType;
}

export type UpdateSubscriptionResult =
  | UpdateSubscriptionResponse
  | CheckoutSessionResponse;

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const response = await apiFetch(USER_ENDPOINT, { method: "GET" });
  if (!response.ok) return null;
  const json = await response.json();
  if (process.env.NODE_ENV === "development") {
    const root = (json as Record<string, unknown>)?.data ?? (json as Record<string, unknown>)?.user ?? json;
    const u = (root as Record<string, unknown>)?.usage;
    console.log("[fetchCurrentUser] plan_type:", (root as Record<string, unknown>)?.plan_type, "usage:", JSON.stringify(u));
  }
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
  profile_picture?: string | null;
}): Promise<UserProfile | null> {
  const response = await apiFetch(USER_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;
  const json = await response.json();
  return normalizeUserProfile(json);
}

// Map frontend display roles → backend-accepted enum values.
// Backend valid values: founder | student | creator | engineer | marketing_sales |
//   researcher | enterprise | other
const ROLE_API_MAP: Record<string, string> = {
  Founder: "founder",
  Marketer: "marketing_sales",
  Designer: "creator",
  Engineer: "engineer",
  Operator: "enterprise",
  "Student / Researcher": "researcher",
  Other: "other",
};

// Map frontend display tones → backend-accepted enum values.
// Backend valid values: professional | balanced | casual | concise | creative |
//   academic | witty | socratic | empathetic | executive | teaching | other
const TONE_API_MAP: Record<string, string> = {
  Direct: "concise",
  Balanced: "balanced",
  Warm: "empathetic",
};

// `role_fit` is a backend enum describing team size — it is NOT free text.
// The onboarding UI has historically passed nicknames / "Other" role
// descriptions here, which the backend rejects with a 422. We drop any value
// that isn't a valid enum member before sending.
const VALID_ROLE_FIT = new Set(["just_me", "small_team", "large_team"]);

export async function updateOnboarding(payload: {
  user_role?: string | null;
  ai_tone?: string | null;
  role_fit?: string | null;
  onboarding_completed?: boolean;
}): Promise<UserOnboarding | null> {
  const mapped = {
    ...payload,
    user_role: payload.user_role
      ? (ROLE_API_MAP[payload.user_role] ?? payload.user_role)
      : payload.user_role,
    ai_tone: payload.ai_tone
      ? (TONE_API_MAP[payload.ai_tone] ?? payload.ai_tone)
      : payload.ai_tone,
    // Only forward role_fit when it is a valid enum value; free text (nicknames,
    // "Other" role descriptions) is dropped so it never triggers a 422.
    role_fit: payload.role_fit && VALID_ROLE_FIT.has(payload.role_fit)
      ? payload.role_fit
      : undefined,
  };

  // Send only fields that have a concrete value. Sending explicit `null` for
  // optional fields can trigger pydantic 422s on some backend versions, and is
  // also incorrect PATCH semantics ("omit field" ≠ "set field to null").
  const cleanPayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mapped)) {
    if (v !== null && v !== undefined) {
      cleanPayload[k] = v;
    }
  }

  // Nothing valid to send (e.g. a nickname-only write whose role_fit was
  // dropped) — skip the network round-trip entirely. Callers that send such
  // payloads are fire-and-forget and don't inspect the result.
  if (Object.keys(cleanPayload).length === 0) {
    return null;
  }

  const response = await apiFetch(USER_ONBOARDING_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify(cleanPayload),
  });

  if (!response.ok) {
    const errText = await response.clone().text();
    console.error(
      `[updateOnboarding] PATCH failed — status ${response.status}`,
      errText,
      "clean payload:", cleanPayload,
    );
    return null;
  }

  // API returns OnboardingSummary, not UserResponse — parse directly
  const json = (await response.json()) as Record<string, unknown>;
  return {
    completed: Boolean(json.completed),
    user_role: typeof json.user_role === "string" ? json.user_role : null,
    ai_tone: typeof json.ai_tone === "string" ? json.ai_tone : null,
    role_fit: typeof json.role_fit === "string" ? json.role_fit : null,
  };
}

export async function deleteUser(): Promise<void> {
  await apiFetch(USER_ENDPOINT, { method: "DELETE" });
}

export type StripeCheckoutFlow = "onboarding" | "settings_change_plan";

export async function createCheckoutSession(
  plan_type: UserPlanType,
  billing: BillingPlan = "monthly",
  options?: { checkoutFlow?: StripeCheckoutFlow },
): Promise<CheckoutSessionResponse> {
  const payload: Record<string, string> = { plan_type, billing };
  if (options?.checkoutFlow === "settings_change_plan") {
    payload.checkout_flow = "settings_change_plan";
  }

  const response = await apiFetch(STRIPE_CHECKOUT_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as CheckoutSessionResponse | { error?: string };

  if (!response.ok || !("checkout_url" in data)) {
    throw new Error(("error" in data && data.error) || "Failed to create checkout session.");
  }

  return data;
}

export async function updateSubscriptionPlan(
  plan_type: UserPlanType,
  options?: { checkoutFlow?: StripeCheckoutFlow },
): Promise<UpdateSubscriptionResult> {
  const payload: Record<string, string> = { plan_type };
  if (options?.checkoutFlow === "settings_change_plan") {
    payload.checkout_flow = "settings_change_plan";
  }

  const response = await apiFetch(STRIPE_SUBSCRIPTION_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as UpdateSubscriptionResult | { error?: string };

  if (!response.ok || (!("new_plan" in data) && !("checkout_url" in data))) {
    throw new Error(("error" in data && data.error) || "Failed to update subscription.");
  }

  return data as UpdateSubscriptionResult;
}

export async function createTopUpSession(amount_usd: number): Promise<TopUpSessionResponse> {
  const response = await apiFetch(STRIPE_TOPUP_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ amount_usd }),
  });

  const data = (await response.json()) as TopUpSessionResponse | { error?: string };

  if (!response.ok || !("checkout_url" in data)) {
    throw new Error(("error" in data && data.error) || "Failed to create top-up session.");
  }

  return data as TopUpSessionResponse;
}

/**
 * Billing snapshot — payment method, invoices, upcoming invoice, and cancel
 * state. Lives on the backend (proxied), separate from `/users/me`.
 */
export async function fetchBilling(): Promise<BillingInfo | null> {
  const response = await apiFetch(STRIPE_BILLING_ENDPOINT, { method: "GET" });
  if (!response.ok) return null;
  const raw = (await response.json()) as Record<string, unknown>;
  const root = (raw.data ?? raw) as Record<string, unknown>;
  const pm =
    root.payment_method && typeof root.payment_method === "object"
      ? (root.payment_method as BillingPaymentMethod)
      : null;
  const upcoming =
    root.upcoming_invoice && typeof root.upcoming_invoice === "object"
      ? (root.upcoming_invoice as BillingUpcomingInvoice)
      : null;
  const credits =
    root.credits && typeof root.credits === "object"
      ? (() => {
          const c = root.credits as Record<string, unknown>;
          const trial =
            c.trial && typeof c.trial === "object"
              ? (() => {
                  const t = c.trial as Record<string, unknown>;
                  return {
                    amount: typeof t.amount === "number" ? t.amount : 0,
                    remaining: typeof t.remaining === "number" ? t.remaining : 0,
                    used: typeof t.used === "number" ? t.used : 0,
                    starts_at: typeof t.starts_at === "string" ? t.starts_at : null,
                    expires_at: typeof t.expires_at === "string" ? t.expires_at : null,
                  } as TrialCredits;
                })()
              : null;
          const used =
            c.used && typeof c.used === "object"
              ? (c.used as { chat?: number; persona?: number; brain?: number })
              : null;
          return {
            total_credits: typeof c.total_credits === "number" ? c.total_credits : 0,
            plan_credits: typeof c.plan_credits === "number" ? c.plan_credits : 0,
            topup_credits: typeof c.topup_credits === "number" ? c.topup_credits : 0,
            trial,
            used,
          } as BillingCredits;
        })()
      : null;
  return {
    plan_type: typeof root.plan_type === "string" ? root.plan_type : null,
    subscription_status:
      typeof root.subscription_status === "string" ? root.subscription_status : null,
    current_period_end:
      typeof root.current_period_end === "string" ? root.current_period_end : null,
    cancel_at_period_end: Boolean(root.cancel_at_period_end),
    payment_method: pm,
    invoices: Array.isArray(root.invoices) ? (root.invoices as BillingInvoice[]) : [],
    upcoming_invoice: upcoming,
    credits,
  };
}

/** Create a Stripe hosted billing-portal session and return its URL. */
export async function openBillingPortal(): Promise<string | null> {
  const response = await apiFetch(STRIPE_PORTAL_ENDPOINT, { method: "POST" });
  if (!response.ok) return null;
  const data = (await response.json()) as { portal_url?: string } | Record<string, unknown>;
  return typeof data.portal_url === "string" ? data.portal_url : null;
}

export async function cancelSubscription(): Promise<{ status: string }> {
  const response = await apiFetch(STRIPE_SUBSCRIPTION_ENDPOINT, { method: "DELETE" });

  let data: { status?: string; error?: string } = {};
  try {
    data = (await response.json()) as { status?: string; error?: string };
  } catch {
    // non-JSON error body
  }

  if (!response.ok || !data.status) {
    throw new Error(data.error || "Failed to cancel subscription.");
  }

  return { status: data.status };
}
