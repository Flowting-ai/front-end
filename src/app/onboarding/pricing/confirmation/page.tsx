"use client";

import React, { Suspense } from "react";
import { CheckoutConfirmationContent } from "@/components/pricing/checkout-confirmation-content";

function ConfirmationInner() {
  return (
    <CheckoutConfirmationContent
      flow="onboarding"
      redirectPath="/"
      continueLabelReady="Continue to App"
      waitingMessage="Waiting for subscription…"
      timeoutMessage="This is taking longer than usual. You can continue—the app will finish setup in the background. If you are sent back to onboarding, wait a moment and open the app again."
    />
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <section className="w-full min-h-screen bg-[#FAF9F8] flex items-center justify-center">
          <p className="font-geist text-sm text-[#525252]">Loading…</p>
        </section>
      }
    >
      <ConfirmationInner />
    </Suspense>
  );
}
