"use client";

import { USER_ENDPOINT, USER_ONBOARDING_ENDPOINT } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import type { UserPlanType } from "@/lib/api/user";
import { hasActivePaidSubscription } from "@/lib/onboarding-access";
import { parsePlanTierFromApi } from "@/lib/plan-tier";

export type OnboardingStatus = "incomplete" | "complete";
export type OnboardingNextStep = "user_role" | "ai_tone" | "role_fit" | null;

export interface OnboardingMetadata {
  status: OnboardingStatus;
  next_step: OnboardingNextStep;
}

export interface OnboardingSubscription {
  plan_type: UserPlanType | null;
  subscription_status: string | null;
}

export interface OnboardingState {
  user_role: string | null;
  ai_tone: string | null;
  role_fit: string | null;
  terms_accepted: boolean;
  completed: boolean;
  metadata: OnboardingMetadata;
  subscription: OnboardingSubscription | null;
}

type OnboardingPayload = Partial<{
  user_role: string | null;
  ai_tone: string | null;
  role_fit: string | null;
  onboarding_completed: boolean | null;
}>;

function coerceNextStep(raw: unknown): OnboardingNextStep {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().replace(/-/g, "_");
  const direct: OnboardingNextStep[] = ["user_role", "ai_tone", "role_fit"];
  if (direct.includes(key as OnboardingNextStep)) return key as OnboardingNextStep;
  const aliases: Record<string, OnboardingNextStep> = {
    tone: "ai_tone",
    org_size: "role_fit",
    role: "user_role",
  };
  return aliases[key] ?? null;
}

function withInferredNextStep(state: OnboardingState): OnboardingState {
  if (state.completed) return state;

  const hasUserRole = Boolean(state.user_role?.length);
  const hasAiTone = Boolean(state.ai_tone?.length);
  const hasRoleFit = Boolean(state.role_fit?.length);

  let next: OnboardingNextStep = null;
  if (!hasUserRole) next = "user_role";
  else if (!hasAiTone) next = "ai_tone";
  else if (!hasRoleFit) next = "role_fit";

  return {
    ...state,
    metadata: { ...state.metadata, next_step: next },
  };
}

function mergeOnboardingPatch(
  state: OnboardingState,
  payload: OnboardingPayload,
): OnboardingState {
  return {
    ...state,
    ...(payload.user_role !== undefined ? { user_role: payload.user_role } : {}),
    ...(payload.ai_tone !== undefined ? { ai_tone: payload.ai_tone } : {}),
    ...(payload.role_fit !== undefined ? { role_fit: payload.role_fit } : {}),
    ...(payload.onboarding_completed !== undefined && payload.onboarding_completed !== null ? { terms_accepted: payload.onboarding_completed } : {}),
  };
}

function buildOnboardingState(raw: unknown): OnboardingState {
  const payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const root =
    (payload.data && typeof payload.data === "object"
      ? payload.data
      : payload.user && typeof payload.user === "object"
        ? payload.user
        : payload) as Record<string, unknown>;
  const onboarding =
    root.onboarding && typeof root.onboarding === "object"
      ? (root.onboarding as Record<string, unknown>)
      : root;

  const metadata =
    onboarding.metadata && typeof onboarding.metadata === "object"
      ? (onboarding.metadata as Record<string, unknown>)
      : {};
  const subscription =
    onboarding.subscription && typeof onboarding.subscription === "object"
      ? (onboarding.subscription as Record<string, unknown>)
      : null;

  const nestedPlan = subscription
    ? parsePlanTierFromApi(subscription.plan_type)
    : null;
  const nestedStatus =
    subscription && typeof subscription.subscription_status === "string"
      ? subscription.subscription_status
      : null;

  const rootPlan = parsePlanTierFromApi(root.plan_type);
  const rootStatus =
    typeof root.subscription_status === "string"
      ? root.subscription_status
      : null;

  const mergedPlan = nestedPlan ?? rootPlan;
  const mergedStatus = nestedStatus ?? rootStatus;

  const status = metadata.status === "complete" ? "complete" : "incomplete";
  const nextRaw = metadata.next_step ?? metadata.nextStep;
  const nextStep = coerceNextStep(nextRaw);

  const userRole =
    typeof onboarding.user_role === "string"
      ? onboarding.user_role
      : typeof onboarding.userRole === "string"
        ? onboarding.userRole
        : null;
  const aiTone =
    typeof onboarding.ai_tone === "string"
      ? onboarding.ai_tone
      : typeof onboarding.aiTone === "string"
        ? onboarding.aiTone
        : null;
  const roleFit =
    typeof onboarding.role_fit === "string"
      ? onboarding.role_fit
      : typeof onboarding.roleFit === "string"
        ? onboarding.roleFit
        : null;

  return {
    user_role: userRole,
    ai_tone: aiTone,
    role_fit: roleFit,
    terms_accepted: Boolean(onboarding.terms_accepted),
    completed:
      Boolean(onboarding.completed) || metadata.status === "complete",
    metadata: {
      status,
      next_step: nextStep,
    },
    subscription:
      mergedPlan || mergedStatus
        ? {
            plan_type: mergedPlan,
            subscription_status: mergedStatus,
          }
        : null,
  };
}

function normalizeOnboardingState(raw: unknown): OnboardingState {
  return withInferredNextStep(buildOnboardingState(raw));
}

/** Matches proxy gate: onboarding done, or active/trialing paid subscription. */
export function isOnboardingStateAppReady(state: OnboardingState | null): boolean {
  if (!state) return false;
  if (state.completed) return true;
  return hasActivePaidSubscription(
    state.subscription?.plan_type,
    state.subscription?.subscription_status,
  );
}

export async function fetchOnboardingState(): Promise<OnboardingState | null> {
  const response = await apiFetch(USER_ENDPOINT, { method: "GET" });
  if (!response.ok) return null;
  const json = await response.json();
  return normalizeOnboardingState(json);
}

export async function updateOnboardingState(
  payload: OnboardingPayload,
): Promise<OnboardingState | null> {
  const response = await apiFetch(USER_ONBOARDING_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;
  const json = await response.json();
  const merged = mergeOnboardingPatch(buildOnboardingState(json), payload);
  return withInferredNextStep(merged);
}
