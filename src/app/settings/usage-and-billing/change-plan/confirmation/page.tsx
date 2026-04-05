"use client";

import React, { Suspense } from "react";
import { CheckoutConfirmationContent } from "@/components/pricing/checkout-confirmation-content";

function ConfirmationInner() {
  return (
    <CheckoutConfirmationContent
      flow="settings"
      redirectPath="/settings/usage-and-billing"
      continueLabelReady="Return to usage and billing"
      waitingMessage="Confirming plan change…"
      timeoutMessage="This is taking longer than usual. You can continue—open Usage & billing in a moment if your plan has not updated yet."
    />
  );
}

export default function ChangePlanConfirmationPage() {
  return (
    <div className="min-h-dvh bg-[#FAF9F8]">
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
