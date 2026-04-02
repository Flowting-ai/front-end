"use client";

import { USER_ENDPOINT, USER_ONBOARDING_ENDPOINT } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import type { UserPlanType } from "@/lib/api/user";

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
  completed: boolean;
  metadata: OnboardingMetadata;
  subscription: OnboardingSubscription | null;
}

type OnboardingPayload = Partial<{
  user_role: string | null;
  ai_tone: string | null;
  role_fit: string | null;
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
    completed: Boolean(onboarding.completed),
    metadata: {
      status,
      next_step: nextStep,
    },
    subscription:
      subscription
        ? {
            plan_type:
              subscription.plan_type === "starter" ||
              subscription.plan_type === "pro" ||
              subscription.plan_type === "power"
                ? subscription.plan_type
                : null,
            subscription_status:
              typeof subscription.subscription_status === "string"
                ? subscription.subscription_status
                : null,
          }
        : null,
  };
}

function normalizeOnboardingState(raw: unknown): OnboardingState {
  return withInferredNextStep(buildOnboardingState(raw));
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
