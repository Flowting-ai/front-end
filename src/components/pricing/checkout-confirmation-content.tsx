"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  fetchOnboardingState,
  isOnboardingStateAppReady,
} from "@/lib/api/onboarding";
import { fetchCurrentUser, type UserPlanType } from "@/lib/api/user";

const VALID_PLANS: UserPlanType[] = ["starter", "pro", "power"];

function isUserPlanType(value: string | null): value is UserPlanType {
  return value !== null && VALID_PLANS.includes(value as UserPlanType);
}

export type CheckoutConfirmationFlow = "onboarding" | "settings";

export interface CheckoutConfirmationContentProps {
  flow: CheckoutConfirmationFlow;
  /** Post-success navigation target */
  redirectPath: string;
  /** Primary button label when ready */
  continueLabelReady: string;
  /** Shown on the button only while the one-time sync runs */
  waitingMessage: string;
  /** Optional note if the profile has not caught up to the new plan yet (no polling) */
  deferredSyncHint: string;
}

export function CheckoutConfirmationContent({
  flow,
  redirectPath,
  continueLabelReady,
  waitingMessage,
  deferredSyncHint,
}: CheckoutConfirmationContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [onboardingAppReady, setOnboardingAppReady] = useState(false);
  /** From a single GET after checkout (avoids polling and avoids stale `user` race). */
  const [settingsPlanMatchesBackend, setSettingsPlanMatchesBackend] =
    useState<boolean | null>(null);

  const planParam = searchParams.get("plan") ?? "your";
  const billing = searchParams.get("billing");
  const expectedPlan = isUserPlanType(planParam) ? planParam : null;

  const planLabel =
    planParam === "your"
      ? "your"
      : planParam.charAt(0).toUpperCase() + planParam.slice(1);
  const billingLabel = billing === "annual" ? "Annual" : "Monthly";

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (flow === "settings") {
          const profile = await fetchCurrentUser();
          if (!cancelled && expectedPlan !== null) {
            setSettingsPlanMatchesBackend(profile?.plan_type === expectedPlan);
          } else if (!cancelled) {
            setSettingsPlanMatchesBackend(true);
          }
        } else {
          const state = await fetchOnboardingState();
          if (!cancelled) {
            setOnboardingAppReady(isOnboardingStateAppReady(state));
          }
        }
      } finally {
        if (!cancelled) setInitialSyncDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [flow, expectedPlan]);

  const showDeferredHint =
    initialSyncDone &&
    ((flow === "settings" &&
      expectedPlan !== null &&
      settingsPlanMatchesBackend === false) ||
      (flow === "onboarding" && !onboardingAppReady));

  const handleContinue = useCallback(async () => {
    setLoading(true);
    try {
      await refreshUser();
      router.push(redirectPath);
    } finally {
      setLoading(false);
    }
  }, [redirectPath, refreshUser, router]);

  const continueDisabled = loading || !initialSyncDone;
  const continueLabel = loading
    ? flow === "onboarding"
      ? "Setting up your workspace…"
      : "Updating…"
    : !initialSyncDone
      ? waitingMessage
      : continueLabelReady;

  const successDescription =
    flow === "settings"
      ? `Your subscription is now on the ${planLabel} plan${billing ? ` (${billingLabel})` : ""}.`
      : `You${"'"}re now subscribed to the ${planLabel} plan${billing ? ` (${billingLabel})` : ""}. Your workspace is ready to go.`;

  return (
    <section className="w-full min-h-dvh bg-[#FAF9F8]">
      <div className="w-full min-h-dvh flex flex-col items-stretch justify-center px-6 sm:px-10 lg:px-16 xl:px-24 py-12 sm:py-16">
        <div className="w-full max-w-none flex flex-col items-center gap-8 lg:gap-10">
          <div className="flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-100 shrink-0">
            <CheckCircle
              className="w-12 h-12 sm:w-14 sm:h-14 text-green-600"
              strokeWidth={1.75}
            />
          </div>

          <div className="w-full text-center space-y-3 max-w-4xl mx-auto">
            <h1 className="font-besley text-3xl sm:text-4xl md:text-5xl text-black">
              Payment Successful!
            </h1>
            <p className="font-geist text-base md:text-lg text-[#525252]">
              {successDescription}
            </p>
            {!initialSyncDone ? (
              <p className="font-geist flex items-center justify-center gap-2 text-sm md:text-base text-[#525252]">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {flow === "onboarding"
                  ? "Checking your account…"
                  : "Syncing your account…"}
              </p>
            ) : null}
            {showDeferredHint ? (
              <p className="font-geist text-sm md:text-base text-[#92400E] bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 max-w-2xl mx-auto text-left">
                {deferredSyncHint}
              </p>
            ) : null}
          </div>

          <div className="w-full max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={continueDisabled}
              className="font-geist w-full cursor-pointer bg-black text-[#F2F2F0] rounded-[8px] py-3.5 md:py-4 text-sm md:text-base font-medium hover:bg-[#0A0A0A] transition-colors disabled:opacity-60"
            >
              {continueLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
