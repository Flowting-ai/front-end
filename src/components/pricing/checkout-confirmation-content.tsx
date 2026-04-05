"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  fetchOnboardingState,
  isOnboardingStateAppReady,
} from "@/lib/api/onboarding";
import { fetchCurrentUser, type UserPlanType } from "@/lib/api/user";

const POLL_MS = 2000;
const POLL_MAX_MS = 120_000;

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
  /** Shown while polling */
  waitingMessage: string;
  /** Timeout helper text */
  timeoutMessage: string;
}

export function CheckoutConfirmationContent({
  flow,
  redirectPath,
  continueLabelReady,
  waitingMessage,
  timeoutMessage,
}: CheckoutConfirmationContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [gateReady, setGateReady] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const planParam = searchParams.get("plan") ?? "your";
  const billing = searchParams.get("billing");
  const expectedPlan = isUserPlanType(planParam) ? planParam : null;

  const planLabel =
    planParam === "your"
      ? "your"
      : planParam.charAt(0).toUpperCase() + planParam.slice(1);
  const billingLabel = billing === "annual" ? "Annual" : "Monthly";

  const checkGate = useCallback(async (): Promise<boolean> => {
    if (flow === "settings" && expectedPlan) {
      const profile = await fetchCurrentUser();
      return profile?.plan_type === expectedPlan;
    }
    await refreshUser();
    const state = await fetchOnboardingState();
    return isOnboardingStateAppReady(state);
  }, [flow, expectedPlan, refreshUser]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (await checkGate()) {
        if (!cancelled) setGateReady(true);
        return;
      }
      startedAtRef.current = Date.now();
      pollIntervalRef.current = setInterval(() => {
        void (async () => {
          if (cancelled) return;
          if (await checkGate()) {
            if (!cancelled) setGateReady(true);
            if (pollIntervalRef.current !== null) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            return;
          }
          if (
            startedAtRef.current !== null &&
            Date.now() - startedAtRef.current > POLL_MAX_MS
          ) {
            if (!cancelled) setPollTimedOut(true);
            if (pollIntervalRef.current !== null) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        })();
      }, POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [checkGate]);

  const handleContinue = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await checkGate();
      if (ok) {
        await refreshUser();
        router.push(redirectPath);
        return;
      }
      if (pollTimedOut) {
        await refreshUser();
        router.push(redirectPath);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [checkGate, pollTimedOut, redirectPath, refreshUser, router]);

  const continueDisabled = loading || (!gateReady && !pollTimedOut);
  const continueLabel = loading
    ? flow === "onboarding"
      ? "Setting up your workspace…"
      : "Updating…"
    : !gateReady && !pollTimedOut
      ? waitingMessage
      : continueLabelReady;

  const successDescription =
    flow === "settings"
      ? `Your subscription is now on the ${planLabel} plan${billing ? ` (${billingLabel})` : ""}.`
      : `You${"'"}re now subscribed to the ${planLabel} plan${billing ? ` (${billingLabel})` : ""}. Your workspace is ready to go.`;

  return (
    <section className="w-full min-h-screen bg-[#FAF9F8] flex items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col items-center gap-8 py-16">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
          <CheckCircle size={48} className="text-green-600" />
        </div>

        <div className="text-center space-y-3">
          <h1 className="font-besley text-3xl md:text-4xl text-black">
            Payment Successful!
          </h1>
          <p className="font-geist text-sm md:text-base text-[#525252]">
            {successDescription}
          </p>
          {!gateReady && !pollTimedOut ? (
            <p className="font-geist flex items-center justify-center gap-2 text-sm text-[#525252]">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              {flow === "onboarding"
                ? "Activating your subscription…"
                : "Confirming your plan change…"}
            </p>
          ) : null}
          {pollTimedOut && !gateReady ? (
            <p className="font-geist text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              {timeoutMessage}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={continueDisabled}
          className="font-geist w-full max-w-xs cursor-pointer bg-black text-[#F2F2F0] rounded-[8px] py-3 text-sm font-medium hover:bg-[#0A0A0A] transition-colors disabled:opacity-60"
        >
          {continueLabel}
        </button>
      </div>
    </section>
  );
}
