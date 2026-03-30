"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useState, Suspense } from "react";
import { CheckCircle } from "lucide-react";

function ConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const plan = searchParams.get("plan") ?? "your";
  const billing = searchParams.get("billing");

  const handleContinue = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } catch {
      // Cookie will be set server-side; if it fails, proxy will redirect back
    }
    router.push("/");
  }, [router]);

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const billingLabel = billing === "annual" ? "Annual" : "Monthly";

  return (
    <section className="w-full min-h-screen bg-[#FAF9F8] flex items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col items-center gap-8 py-16">
        {/* Success icon */}
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
          <CheckCircle size={48} className="text-green-600" />
        </div>

        {/* Title & description */}
        <div className="text-center space-y-3">
          <h1 className="font-besley text-3xl md:text-4xl text-black">
            Payment Successful!
          </h1>
          <p className="font-geist text-sm md:text-base text-[#525252]">
            You{"'"}re now subscribed to the{" "}
            <span className="font-semibold text-[#171717]">{planLabel}</span>{" "}
            plan
            {billing ? ` (${billingLabel})` : ""}
            . Your workspace is ready to go.
          </p>
        </div>

        {/* Continue button */}
        <button
          type="button"
          onClick={handleContinue}
          className="font-geist w-full max-w-xs cursor-pointer bg-black text-[#F2F2F0] rounded-[8px] py-3 text-sm font-medium hover:bg-[#0A0A0A] transition-colors"
        >
          Continue to App
        </button>
      </div>
    </section>
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
      <ConfirmationContent />
    </Suspense>
  );
}
