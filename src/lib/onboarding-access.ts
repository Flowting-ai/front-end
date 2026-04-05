/**
 * Single source of truth for "may use the main app" vs "still in onboarding".
 * Stripe webhooks often set plan/subscription before onboarding.completed flips.
 */

import { parsePlanTierFromApi } from "@/lib/plan-tier";

const PAID_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function normalizeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Stripe-backed access: paid plan plus a subscription state that can use the product. */
export function hasActivePaidSubscription(
  planType: "starter" | "pro" | "power" | null | undefined,
  subscriptionStatus: string | null | undefined,
): boolean {
  if (!planType) return false;
  const s = (subscriptionStatus ?? "").trim().toLowerCase();
  return PAID_SUBSCRIPTION_STATUSES.has(s);
}

/**
 * Parses GET /users/me (or equivalent) JSON root object — same shape as
 * {@link normalizeUserProfile} / onboarding state builders.
 */
export function userMeRootAllowsMainApp(root: Record<string, unknown>): boolean {
  const onboardingNested =
    root.onboarding && typeof root.onboarding === "object"
      ? (root.onboarding as Record<string, unknown>)
      : null;

  const metadata =
    onboardingNested?.metadata && typeof onboardingNested.metadata === "object"
      ? (onboardingNested.metadata as Record<string, unknown>)
      : {};

  const completed =
    Boolean(onboardingNested?.completed) || metadata.status === "complete";

  if (completed) return true;

  const planFromRoot = parsePlanTierFromApi(root.plan_type);
  const statusFromRoot = normalizeStatus(root.subscription_status);

  const sub =
    onboardingNested?.subscription &&
    typeof onboardingNested.subscription === "object"
      ? (onboardingNested.subscription as Record<string, unknown>)
      : null;

  const planFromNested = parsePlanTierFromApi(sub?.plan_type);
  const statusFromNested = normalizeStatus(sub?.subscription_status);

  const plan = planFromRoot ?? planFromNested;
  const status = statusFromRoot || statusFromNested;

  return hasActivePaidSubscription(plan, status);
}
