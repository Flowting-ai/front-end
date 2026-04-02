"use client";

import { USER_ONBOARDING_ENDPOINT } from "@/lib/config";
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

function normalizeOnboardingState(raw: unknown): OnboardingState {
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
  const nextStep =
    metadata.next_step === "user_role" ||
    metadata.next_step === "ai_tone" ||
    metadata.next_step === "role_fit"
      ? metadata.next_step
      : null;

  return {
    user_role:
      typeof onboarding.user_role === "string" ? onboarding.user_role : null,
    ai_tone: typeof onboarding.ai_tone === "string" ? onboarding.ai_tone : null,
    role_fit: typeof onboarding.role_fit === "string" ? onboarding.role_fit : null,
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

export async function fetchOnboardingState(): Promise<OnboardingState | null> {
  const response = await apiFetch(USER_ONBOARDING_ENDPOINT, { method: "GET" });
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
  return normalizeOnboardingState(json);
}
