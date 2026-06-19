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
  USER_CREATE_ENDPOINT,
  USER_ENDPOINT,
  USER_ONBOARDING_ENDPOINT,
} from "@/lib/config";
import { parsePlanTierFromApi } from "@/lib/plan-tier";
import { apiFetch } from "./client";

export type UserPlanType = "starter" | "pro" | "power";
/**
 * Every plan key accepted by `POST /stripe/checkout` — individual tiers plus the
 * six Team volume tiers. The backend maps this key to the correct Stripe price
 * (the FE must NOT send price ids / tier / interval separately).
 */
export type CheckoutPlan =
  | "starter" | "pro" | "power"
  | "team_125" | "team_250" | "team_500" | "team_1000" | "team_1500" | "team_2000"
  | "enterprise";
export type BillingPlan = "monthly" | "annual";

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
  /** Plan allowance in dollars (API field `plan_credits`). Present on current API shape. */
  plan_credits?: number;
  /** Purchased top-up balance in dollars (API field `topup_credits`), additive
   *  on top of the plan allowance. Preserved verbatim by normalizeUserProfile. */
  topup_credits?: number;
  /** Credits used in dollars (API field `used`). Present on current API shape. */
  used?: number;
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
  expires_at: string;
}

export interface BillingCredits {
  /** Period allowance (plan + top-up). NOTE: in the legacy shape this carried the
   *  *remaining* balance; the current backend sends the full allowance and a
   *  separate `remaining` field. */
  total_credits: number;
  plan_credits: number;
  topup_credits: number;
  trial?: TrialCredits | null;
  /** Remaining balance. Current backend sends this explicitly; absent in the
   *  legacy shape (where `total_credits` was the remaining value). */
  remaining?: number;
  /** Credits drawn down this period (= allowance − remaining). Current backend
   *  sends a scalar; the legacy shape sent a per-category object here (now moved
   *  to `by_category`). Kept as a union for back-compat. */
  used?:
    | number
    | { chat?: number; persona?: number; brain?: number }
    | null;
  /** Period spend by source area. Current backend field (replaces the legacy
   *  per-category `used` object). */
  by_category?: {
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
  /** Full name as returned by Auth0 / backend (e.g. "given_name family_name"). Used as a fallback when first_name is null. */
  name?: string | null;
  nickname?: string | null;
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
  /** Set when the user belongs to a teams / enterprise organisation. */
  org_id?: string | null;
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
    name: typeof root.name === "string" ? root.name : null,
    nickname: typeof root.nickname === "string" ? root.nickname : null,
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
            // Mirror the server proxy's completion notion (userMeRootAllowsMainApp):
            // a `metadata.status === "complete"` counts as complete even if the
            // boolean `completed` flag lags. Keeping these in sync prevents the
            // client OnboardingGuard from disagreeing with the proxy and causing
            // an infinite /chat ⇄ /onboarding redirect loop.
            const metadata =
              o.metadata && typeof o.metadata === "object"
                ? (o.metadata as Record<string, unknown>)
                : {};
            const completed = Boolean(o.completed) || metadata.status === "complete";
            return {
              completed,
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
                      expires_at: typeof t.expires_at === "string" ? t.expires_at : "",
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
    org_id: typeof root.org_id === "string" ? root.org_id : null,
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
  nickname?: string | null;
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

// Reverse of ROLE_API_MAP / TONE_API_MAP: backend enum → friendly display label.
// Used by Settings → Account so the role reads "Marketer" rather than the raw
// enum "marketing_sales". Unknown/custom values pass through unchanged.
const ROLE_DISPLAY_MAP: Record<string, string> = {
  founder: "Founder",
  marketing_sales: "Marketer",
  creator: "Designer",
  engineer: "Engineer",
  enterprise: "Operator",
  researcher: "Student / Researcher",
  student: "Student / Researcher",
  other: "Other",
};

const TONE_DISPLAY_MAP: Record<string, string> = {
  concise: "Direct",
  balanced: "Balanced",
  empathetic: "Warm",
};

/** Backend role enum → display label (e.g. "marketing_sales" → "Marketer"). */
export function roleDisplayLabel(value: string | null | undefined): string {
  if (!value) return "";
  return ROLE_DISPLAY_MAP[value] ?? value;
}

/** Backend tone enum → display label (e.g. "concise" → "Direct"). */
export function toneDisplayLabel(value: string | null | undefined): string {
  if (!value) return "";
  return TONE_DISPLAY_MAP[value] ?? value;
}

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

/**
 * POST /stripe/checkout — start a Stripe Checkout session for `plan`.
 *
 * Identity comes from the JWT (auto-attached by apiFetch); the backend owns the
 * Stripe price ids. The body is exactly `{ plan, billing }` — we deliberately do
 * NOT send user/auth0 ids, a tier, or a price_id (sending price ids previously
 * caused the test/live "No such price" failures). Used for both initial signup
 * and switching plans.
 *
 * Errors: 422 — plan/billing not in the allowed enum; 400 — already subscribed
 * this period, or no price configured for the plan.
 */
export async function createCheckoutSession(
  plan: CheckoutPlan,
  billing: BillingPlan = "monthly",
): Promise<CheckoutSessionResponse> {
  const response = await apiFetch(STRIPE_CHECKOUT_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ plan, billing }),
  });

  const data = (await response.json().catch(() => ({}))) as
    | CheckoutSessionResponse
    | { detail?: string; error?: string };

  if (!response.ok || !("checkout_url" in data)) {
    const detail = "detail" in data ? data.detail : undefined;
    const error = "error" in data ? data.error : undefined;
    throw new Error(detail || error || "Failed to create checkout session.");
  }

  return data;
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
                    expires_at: typeof t.expires_at === "string" ? t.expires_at : "",
                  } as TrialCredits;
                })()
              : null;
          // `used` may be a scalar (current backend) or a per-category object
          // (legacy). Preserve whichever arrives.
          const used =
            typeof c.used === "number"
              ? c.used
              : c.used && typeof c.used === "object"
                ? (c.used as { chat?: number; persona?: number; brain?: number })
                : null;
          const byCategory =
            c.by_category && typeof c.by_category === "object"
              ? (c.by_category as { chat?: number; persona?: number; brain?: number })
              : null;
          return {
            total_credits: typeof c.total_credits === "number" ? c.total_credits : 0,
            plan_credits: typeof c.plan_credits === "number" ? c.plan_credits : 0,
            topup_credits: typeof c.topup_credits === "number" ? c.topup_credits : 0,
            remaining: typeof c.remaining === "number" ? c.remaining : undefined,
            trial,
            used,
            by_category: byCategory,
          } as BillingCredits;
        })()
      : null;
  // Normalise invoice fields: Stripe returns `created` as a Unix timestamp
  // (seconds), but our type and fmtDate() expect an ISO string. Convert any
  // number to ISO; leave strings untouched.
  const normalizeInvoiceDate = (raw: unknown): string | null => {
    if (typeof raw === "number") return new Date(raw * 1000).toISOString()
    if (typeof raw === "string" && raw.length > 0) return raw
    return null
  }

  const rawInvoices = Array.isArray(root.invoices)
    ? (root.invoices as Record<string, unknown>[]).map((inv): BillingInvoice => ({
        amount_paid:  typeof inv.amount_paid === "number"  ? inv.amount_paid  : 0,
        currency:     typeof inv.currency    === "string"  ? inv.currency     : "usd",
        status:       typeof inv.status      === "string"  ? inv.status       : null,
        created:      normalizeInvoiceDate(inv.created),
        invoice_url:  typeof inv.invoice_url === "string"  ? inv.invoice_url  : null,
        invoice_pdf:  typeof inv.invoice_pdf === "string"  ? inv.invoice_pdf  : null,
      }))
    : []

  return {
    plan_type: typeof root.plan_type === "string" ? root.plan_type : null,
    subscription_status:
      typeof root.subscription_status === "string" ? root.subscription_status : null,
    current_period_end:
      typeof root.current_period_end === "string" ? root.current_period_end : null,
    cancel_at_period_end: Boolean(root.cancel_at_period_end),
    payment_method: pm,
    invoices: rawInvoices,
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

export interface SubscriptionActionResponse {
  status: string;
  plan_type?: string | null;
  current_period_end?: string | null;
}

export async function cancelSubscription(): Promise<SubscriptionActionResponse> {
  const response = await apiFetch(STRIPE_SUBSCRIPTION_ENDPOINT, { method: "DELETE" });

  let data: SubscriptionActionResponse & { error?: string } = { status: "" };
  try {
    data = (await response.json()) as SubscriptionActionResponse & { error?: string };
  } catch {
    // non-JSON error body
  }

  if (!response.ok || !data.status) {
    throw new Error(data.error || "Failed to cancel subscription.");
  }

  return { status: data.status, plan_type: data.plan_type, current_period_end: data.current_period_end };
}

export async function resumeSubscription(): Promise<SubscriptionActionResponse> {
  const response = await apiFetch(STRIPE_SUBSCRIPTION_RESUME_ENDPOINT, { method: "POST" });

  let data: SubscriptionActionResponse & { error?: string } = { status: "" };
  try {
    data = (await response.json()) as SubscriptionActionResponse & { error?: string };
  } catch {
    // non-JSON error body
  }

  if (!response.ok || !data.status) {
    throw new Error(data.error || "Failed to resume subscription.");
  }

  return { status: data.status, plan_type: data.plan_type, current_period_end: data.current_period_end };
}

export interface TopUpChargeResponse {
  status: string;
  client_secret?: string | null;
}

/** Charge a top-up immediately using the saved payment method. */
export async function chargeTopUp(amount_usd: number): Promise<TopUpChargeResponse> {
  const response = await apiFetch(STRIPE_TOPUP_CHARGE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ amount_usd }),
  });

  const data = (await response.json()) as TopUpChargeResponse & { error?: string };

  if (!response.ok || !data.status) {
    throw new Error(data.error || "Failed to charge top-up.");
  }

  return data;
}

export interface TrialResponse {
  credits: number;
  plan_credits: number;
  topup_credits: number;
  used: number;
  spent_this_period: number;
  trial?: { remaining: number; expires_at: string } | null;
}

/** POST /stripe/trial — grant 1000 free trial credits. */
export async function startTrial(): Promise<TrialResponse> {
  const response = await apiFetch(STRIPE_TRIAL_ENDPOINT, { method: "POST" });

  const data = (await response.json()) as TrialResponse & { error?: string };

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || "Failed to start trial.");
  }

  return data;
}
