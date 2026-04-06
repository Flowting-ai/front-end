"use client";

import React, { Suspense } from "react";
import { CheckoutConfirmationContent } from "@/components/pricing/checkout-confirmation-content";

function ConfirmationInner() {
  return (
    <CheckoutConfirmationContent
      flow="settings"
      redirectPath="/settings/usage-and-billing?from_checkout=1"
      continueLabelReady="Return to usage and billing"
      waitingMessage="Loading…"
      deferredSyncHint="Payment succeeded. If Usage & billing still shows your previous plan, wait a moment and refresh that page after you continue."
    />
  );
}

export default function ChangePlanConfirmationPage() {
  return (
    <div className="min-h-dvh w-full bg-[#FAF9F8]">
      <Suspense
        fallback={
          <section className="w-full min-h-dvh flex items-center justify-center">
            <p className="font-geist text-sm text-[#525252]">Loading…</p>
          </section>
        }
      >
        <ConfirmationInner />
      </Suspense>
    </div>
  );
}
