"use client";

import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { DowngradeBlockedDialog } from "@/components/pricing/downgrade-blocked-dialog";
import { PricingCardsGrid } from "@/components/pricing/pricing-cards-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import {
  cancelSubscription,
  createCheckoutSession,
  fetchCurrentUser,
  type UserPlanType,
} from "@/lib/api/user";
import {
  isDowngradeBlockedByUsage,
  isPlanDowngrade,
  isPlanUpgrade,
  type WorkspaceUsageCounts,
} from "@/lib/plan-downgrade-limits";
import type { PricingCardId } from "@/lib/pricing-cards-config";
import { toast } from "@/lib/toast-helper";
import { fetchWorkspaceUsageCounts } from "@/lib/workspace-usage-counts";

function formatPeriodEnd(value: string | null | undefined) {
  if (!value) return "the end of your billing period";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "the end of your billing period";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ChangePlanPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<PricingCardId | null>(null);
  const [planUiReady, setPlanUiReady] = useState(false);
  const [resolvedPlan, setResolvedPlan] = useState<UserPlanType | null>(null);
  const [periodEndLabel, setPeriodEndLabel] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const [downgradeBlockOpen, setDowngradeBlockOpen] = useState(false);
  const [downgradeBlockTarget, setDowngradeBlockTarget] = useState<
    "starter" | "pro" | null
  >(null);
  const [blockCounts, setBlockCounts] = useState<WorkspaceUsageCounts>({
    totalPersonaCount: 0,
    totalPinCount: 0,
    totalWorkflowsCount: 0,
  });

  const checkoutStatus = searchParams.get("checkout");
  const paymentIssueMessage =
    checkoutStatus === "failed"
      ? "Your payment could not be completed."
      : checkoutStatus === "cancelled"
        ? "Checkout was cancelled before payment finished."
        : null;

  const hasActiveSubscription = Boolean(resolvedPlan);

  const loadMe = useCallback(async () => {
    const profile = await fetchCurrentUser();
    setResolvedPlan(profile?.plan_type ?? null);
    setPeriodEndLabel(profile?.current_period_end ?? null);
    setCancelAtPeriodEnd(Boolean(profile?.cancel_at_period_end));
    await refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadMe();
      } finally {
        if (!cancelled) setPlanUiReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  const handleOpenCancelDialog = useCallback(() => {
    setShowCancelConfirm(true);
  }, []);

  const handleConfirmCancelSubscription = useCallback(async () => {
    setIsCanceling(true);
    try {
      await cancelSubscription();
      setShowCancelConfirm(false);
      toast.success("Subscription canceled", {
        description: `Your plan stays active until ${formatPeriodEnd(periodEndLabel)}. You will not be charged for future billing periods.`,
      });
      await loadMe();
      router.push("/settings/usage-and-billing");
    } catch (err) {
      toast.error("Could not cancel subscription", {
        description:
          err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsCanceling(false);
    }
  }, [loadMe, periodEndLabel, router]);

  const onSelectPlan = useCallback(
    async (planId: PricingCardId) => {
      if (resolvedPlan === planId) return;

      setLoadingPlan(planId);
      try {
        const startCheckout = async () => {
          const checkout = await createCheckoutSession(planId, "monthly", {
            checkoutFlow: "settings_change_plan",
          });
          window.location.href = checkout.checkout_url;
        };

        if (!hasActiveSubscription || !resolvedPlan) {
          await startCheckout();
          return;
        }

        const current = resolvedPlan;

        if (isPlanUpgrade(current, planId)) {
          await startCheckout();
          return;
        }

        if (isPlanDowngrade(current, planId)) {
          const counts = await fetchWorkspaceUsageCounts();
          const target = planId as "starter" | "pro";

          if (isDowngradeBlockedByUsage(target, counts)) {
            setBlockCounts(counts);
            setDowngradeBlockTarget(target);
            setDowngradeBlockOpen(true);
            return;
          }

          await startCheckout();
          return;
        }
      } catch (err) {
        toast.error("Could not change plan", {
          description:
            err instanceof Error ? err.message : "Please try again.",
        });
      } finally {
        setLoadingPlan(null);
      }
    },
    [hasActiveSubscription, resolvedPlan],
  );

  return (
    <div className="w-full min-h-dvh bg-[#FAF9F8] overflow-x-hidden">
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#171717]">
              Cancel subscription?
            </DialogTitle>
          </DialogHeader>
          <p className="font-geist text-sm text-[#6B7280] text-left">
            Your plan stays active until{" "}
            <span className="font-medium text-[#171717]">
              {formatPeriodEnd(periodEndLabel)}
            </span>{" "}
            (end of your current billing period). Future renewals are canceled
            in Stripe—you will not be charged again unless you subscribe again.
            Paid features remain until that date.
          </p>
          <DialogFooter className="mt-2 sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelConfirm(false)}
              disabled={isCanceling}
              className="border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5]"
            >
              Keep plan
            </Button>
            <Button
              onClick={() => void handleConfirmCancelSubscription()}
              disabled={isCanceling}
              className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
            >
              {isCanceling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Canceling…
                </>
              ) : (
                "Yes, cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DowngradeBlockedDialog
        open={downgradeBlockOpen}
        onOpenChange={setDowngradeBlockOpen}
        targetPlan={downgradeBlockTarget}
        counts={blockCounts}
      />

      <section className="w-full h-auto bg-[#FAF9F8] flex items-center justify-center px-4 mb-10 lg:mb-20">
        <div className="w-full flex flex-col items-center gap-8 py-10">
          <div className="w-full max-w-6xl flex justify-start">
            <Button
              type="button"
              variant="ghost"
              className="font-geist gap-2 text-[#525252] hover:text-black -ml-2"
              onClick={() => router.push("/settings/usage-and-billing")}
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
              Return to usage and billing
            </Button>
          </div>

          {paymentIssueMessage ? (
            <div
              role="alert"
              className="w-full max-w-2xl rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-left shadow-sm"
            >
              <div className="flex gap-3">
                <AlertCircle
                  className="h-5 w-5 shrink-0 text-amber-700 mt-0.5"
                  aria-hidden
                />
                <div className="space-y-2 font-geist text-sm text-[#422006]">
                  <p className="font-medium">{paymentIssueMessage}</p>
                  <p className="text-[#78350f]">
                    Choose a plan below to try again. If your card was
                    declined, use another payment method on the next Stripe
                    checkout page.
                  </p>
                  <p className="text-[#78350f]">
                    <Link
                      href="/settings/usage-and-billing"
                      className="font-medium text-[#92400e] underline underline-offset-2 hover:text-[#78350f]"
                    >
                      Return to usage and billing
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <section className="text-center space-y-3 max-w-2xl">
            <h1 className="font-besley text-3xl md:text-4xl text-black">
              Change your plan
            </h1>
            <p className="font-geist text-sm md:text-base text-[#525252]">
              Every plan switch uses secure Stripe checkout for the new plan.
              Before a lower tier, we check that your personas, pins, and
              workflows fit that plan&apos;s limits. Cancel uses your billing
              page and keeps access through the end of the current period.
            </p>
          </section>

          {planUiReady ? (
            <PricingCardsGrid
              variant="settings"
              currentPlan={resolvedPlan}
              loadingPlan={loadingPlan}
              onSelectPlan={onSelectPlan}
              onCancelSubscription={handleOpenCancelDialog}
              isCancelingSubscription={isCanceling}
              subscriptionCancelAtPeriodEnd={cancelAtPeriodEnd}
            />
          ) : (
            <div className="w-full min-h-[40vh] flex items-center justify-center">
              <p className="font-geist text-sm text-[#525252]">
                Loading your plan…
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ChangePlanFallback() {
  return (
    <div className="min-h-dvh bg-[#FAF9F8] flex items-center justify-center px-4">
      <p className="font-geist text-sm text-[#525252]">Loading…</p>
    </div>
  );
}

export default function ChangePlanPage() {
  return (
    <Suspense fallback={<ChangePlanFallback />}>
      <ChangePlanPageInner />
    </Suspense>
  );
}
