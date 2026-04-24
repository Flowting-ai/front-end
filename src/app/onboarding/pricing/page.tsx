"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useState } from "react";
import { PricingCardsGrid } from "@/components/pricing/pricing-cards-grid";
import { createCheckoutSession, type UserPlanType } from "@/lib/api/user";
import type { PricingCardId } from "@/lib/pricing-cards-config";

function PricingPageInner() {
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get("checkout");
  const [loadingPlan, setLoadingPlan] = useState<PricingCardId | null>(null);

  const paymentIssueMessage =
    checkoutStatus === "failed"
      ? "Your payment could not be completed."
      : checkoutStatus === "cancelled"
        ? "Checkout was cancelled before payment finished."
        : null;

  const toApiPlanType = (planId: PricingCardId): UserPlanType => planId;

  const onSelectPlan = useCallback(async (planId: PricingCardId) => {
    setLoadingPlan(planId);
    try {
      const checkout = await createCheckoutSession(
        toApiPlanType(planId),
        "monthly",
      );
      window.location.href = checkout.checkout_url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoadingPlan(null);
    }
  }, []);

  return (
    <section className="w-full h-auto bg-[#FAF9F8] flex items-center justify-center px-4 mb-10 lg:mb-20">
      <div className="w-full flex flex-col items-center gap-8 py-10">
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
                  Choose a plan below to try again. If your card was declined,
                  use another payment method on the next Stripe checkout page.
                </p>
                <p className="text-[#78350f]">
                  To change your earlier setup steps (name, role, tone, org
                  size),{" "}
                  <Link
                    href="/onboarding/username"
                    className="font-medium text-[#92400e] underline underline-offset-2 hover:text-[#78350f]"
                  >
                    start onboarding from the beginning
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <section className="text-center space-y-3 max-w-2xl">
          <h1 className="font-besley text-3xl md:text-4xl text-black">
            You just saved your first thought
          </h1>
          <p className="font-geist text-sm md:text-base text-[#525252]">
            Choose a plan to keep building. Every conversation remembers the
            last.
          </p>
        </section>

        <PricingCardsGrid
          variant="onboarding"
          currentPlan={null}
          loadingPlan={loadingPlan}
          onSelectPlan={onSelectPlan}
        />

        <Link
          href="https://app.getsouvenir.com/auth/logout"
          className="inline-flex items-center gap-2 font-geist text-sm text-[#525252] hover:text-black transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Logout
        </Link>
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <section className="w-full min-h-[40vh] bg-[#FAF9F8] flex items-center justify-center px-4">
          <p className="font-geist text-sm text-[#525252]">Loading…</p>
        </section>
      }
    >
      <PricingPageInner />
    </Suspense>
  );
}
