"use client";

import AppLayout from "@/components/layout/app-layout";
import { DowngradeBlockedDialog } from "@/components/pricing/downgrade-blocked-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Check, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  isDowngradeBlockedByUsage,
  isPlanDowngrade,
  type WorkspaceUsageCounts,
} from "@/lib/plan-downgrade-limits";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  cancelSubscription,
  createCheckoutSession,
  createStripeTopup,
  type UserPlanType,
} from "@/lib/api/user";
import { toast } from "@/lib/toast-helper";
import { fetchWorkspaceUsageCounts } from "@/lib/workspace-usage-counts";

const PLAN_OPTIONS: { id: UserPlanType; label: string; monthlyPrice: number }[] =
  [
    { id: "starter", label: "Starter", monthlyPrice: 12 },
    { id: "pro", label: "Pro", monthlyPrice: 25 },
    { id: "power", label: "Power", monthlyPrice: 100 },
  ];

function SettingsUsageAndBillingPageInner() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const [showChangePlan, setShowChangePlan] = useState(false);
  const [changingToPlan, setChangingToPlan] = useState<UserPlanType | null>(null);
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
  const [buyCreditsAmount, setBuyCreditsAmount] = useState("");
  const [buyCreditsError, setBuyCreditsError] = useState("");
  const [isPurchasingCredits, setIsPurchasingCredits] = useState(false);
  const [showPurchaseConfirmation, setShowPurchaseConfirmation] = useState(false);
  const [purchaseReceipt, setPurchaseReceipt] = useState<{
    amount: number;
    paymentMethod: string;
    date: string;
    merchant: string;
    topupId: string;
  } | null>(null);

  const [downgradeBlockOpen, setDowngradeBlockOpen] = useState(false);
  const [downgradeBlockTarget, setDowngradeBlockTarget] = useState<
    "starter" | "pro" | null
  >(null);
  const [blockCounts, setBlockCounts] = useState<WorkspaceUsageCounts>({
    totalPersonaCount: 0,
    totalPinCount: 0,
    totalWorkflowsCount: 0,
  });

  useEffect(() => {
    if (searchParams.get("from_checkout") === "1") {
      void refreshUser().then(() => {
        router.replace("/settings/usage-and-billing", { scroll: false });
      });
    }
  }, [searchParams, refreshUser, router]);

  const now = new Date();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const currentYear = now.getFullYear();
  const nextMonthName = monthNames[(now.getMonth() + 1) % 12];

  const normalizedPlanType = user?.planType ?? null;
  const hasActiveSubscription = Boolean(normalizedPlanType);
  const subscriptionStatus = user?.subscriptionStatus ?? (hasActiveSubscription ? "active" : "none");
  const cancelAtPeriodEnd = user?.cancelAtPeriodEnd ?? false;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextBillingDate =
    user?.nextBillingDate ??
    user?.upcomingInvoice?.next_payment_date ??
    user?.currentPeriodEnd ??
    nextMonthDate.toISOString();
  const planLabel =
    normalizedPlanType === "power"
      ? "Power"
      : normalizedPlanType === "pro"
      ? "Pro"
      : normalizedPlanType === "starter"
        ? "Starter"
        : "No Plan";

  const formatDate = (value: unknown) => {
    if (!value) return "-";
    if (typeof value !== "string" && typeof value !== "number") return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount);

  const invoices = [...(user?.invoices ?? [])].sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
  );
  const upcomingInvoice = user?.upcomingInvoice ?? null;

  const normalizePct = (value: number | null | undefined) => {
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    const pct = value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(pct, 100));
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      await cancelSubscription();
      setShowCancelConfirm(false);
      toast.success("Subscription canceled", {
        description: `Your plan will remain active until ${formatDate(user?.currentPeriodEnd)}.`,
      });
      await refreshUser();
    } catch (err) {
      toast.error("Failed to cancel subscription", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const handleChangePlan = async (planType: UserPlanType) => {
    if (planType === normalizedPlanType) return;
    setChangingToPlan(planType);
    try {
      if (
        normalizedPlanType &&
        isPlanDowngrade(normalizedPlanType, planType)
      ) {
        const counts = await fetchWorkspaceUsageCounts();
        const target = planType as "starter" | "pro";
        if (isDowngradeBlockedByUsage(target, counts)) {
          setBlockCounts(counts);
          setDowngradeBlockTarget(target);
          setDowngradeBlockOpen(true);
          return;
        }
      }

      const checkout = await createCheckoutSession(planType, "monthly", {
        checkoutFlow: "settings_change_plan",
      });
      window.location.href = checkout.checkout_url;
    } catch (err) {
      toast.error("Failed to update plan", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setChangingToPlan(null);
    }
  };

  const validateBuyCreditsAmount = (rawAmount: string) => {
    const parsedAmount = Number.parseFloat(rawAmount);
    if (!rawAmount || Number.isNaN(parsedAmount)) {
      return "Please enter an amount between $1 and $10.";
    }
    if (parsedAmount < 1 || parsedAmount > 10) {
      return "Amount must be between $1 and $10.";
    }
    return "";
  };

  const handlePurchaseCredits = async () => {
    const validationError = validateBuyCreditsAmount(buyCreditsAmount);
    if (validationError) {
      setBuyCreditsError(validationError);
      return;
    }

    setBuyCreditsError("");
    setIsPurchasingCredits(true);
    try {
      const amount = Number.parseFloat(buyCreditsAmount);
      const topup = await createStripeTopup(amount);
      setShowBuyCreditsModal(false);
      setBuyCreditsAmount("");
      setBuyCreditsError("");
      setPurchaseReceipt({
        amount: topup.amount / 100,
        paymentMethod: "Card via Stripe",
        date: new Date().toLocaleString(),
        merchant: "Souvenir",
        topupId: topup.topup_id,
      });
      setShowPurchaseConfirmation(true);
    } catch (err) {
      toast.error("Failed to purchase credits", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsPurchasingCredits(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!purchaseReceipt) return;

    const receiptText = [
      "Souvenir Payment Receipt",
      "-------------------------",
      `Amount: $${purchaseReceipt.amount.toFixed(2)}`,
      `Payment method: ${purchaseReceipt.paymentMethod}`,
      `Date: ${purchaseReceipt.date}`,
      `Merchant: ${purchaseReceipt.merchant}`,
      `Reference: ${purchaseReceipt.topupId}`,
    ].join("\n");

    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `souvenir-receipt-${purchaseReceipt.topupId}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  // Status banners
  const showPastDueBanner = subscriptionStatus === "past_due";
  const showUnpaidBanner = subscriptionStatus === "unpaid";
  const showCanceledBanner =
    subscriptionStatus === "canceled" && !cancelAtPeriodEnd;
  const showCancelAtEndBanner =
    cancelAtPeriodEnd && subscriptionStatus !== "canceled";

  return (
    <AppLayout>
      <>
      <DowngradeBlockedDialog
        open={downgradeBlockOpen}
        onOpenChange={setDowngradeBlockOpen}
        targetPlan={downgradeBlockTarget}
        counts={blockCounts}
      />

      {/* Cancel confirmation dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-md bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-[#171717]">Cancel subscription?</DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Your plan will stay active until{" "}
              <span className="font-medium text-[#171717]">
                {formatDate(user?.currentPeriodEnd)}
              </span>
              . After that, you will lose access to paid features.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelConfirm(false)}
              disabled={isCanceling}
              className="border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5]"
            >
              Keep plan
            </Button>
            <Button
              onClick={handleCancelSubscription}
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

      {/* Change plan dialog */}
      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent className="max-w-md bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-[#171717]">Change plan</DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Select a new plan. You will complete payment on Stripe checkout
              (same flow as Change plan).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            {PLAN_OPTIONS.map((plan) => {
              const isCurrent = normalizedPlanType === plan.id;
              const isLoading = changingToPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  disabled={isCurrent || changingToPlan !== null}
                  onClick={() => handleChangePlan(plan.id)}
                  className={`flex items-center justify-between rounded-[8px] border px-4 py-3 text-left transition-colors ${
                    isCurrent
                      ? "border-[#171717] bg-[#F5F5F5] cursor-default"
                      : "border-[#E5E5E5] hover:border-[#171717] hover:bg-[#FAFAFA] cursor-pointer"
                  } disabled:opacity-60`}
                >
                  <div>
                    <p className="text-sm font-medium text-[#171717]">{plan.label}</p>
                    <p className="text-xs text-[#6B7280]">${plan.monthlyPrice}/mo</p>
                  </div>
                  {isCurrent ? (
                    <span className="text-xs font-medium text-[#6B7280]">Current</span>
                  ) : isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#171717]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showBuyCreditsModal}
        onOpenChange={(open) => {
          setShowBuyCreditsModal(open);
          if (!open) {
            setBuyCreditsAmount("");
            setBuyCreditsError("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-[20px] bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-clash text-2xl font-medium text-black">
              Buy extra credits
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280]">
              Get extra usage to keep using Souvenir when you hit a limit.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border-b border-[#E5E5E5] pb-4">
            <Input
              type="number"
              min={1}
              max={10}
              step="0.01"
              value={buyCreditsAmount}
              onChange={(e) => {
                setBuyCreditsAmount(e.target.value);
                if (buyCreditsError) {
                  setBuyCreditsError(validateBuyCreditsAmount(e.target.value));
                }
              }}
              placeholder="Add amount ($)"
              className="w-full"
            />
            {buyCreditsError && (
              <p className="mt-2 text-xs text-[#DC2626]">{buyCreditsError}</p>
            )}
          </div>

          <div className="pt-4">
            <Button
              type="button"
              onClick={handlePurchaseCredits}
              disabled={isPurchasingCredits}
              className="w-full bg-[#171717] text-center text-[#FAFAFA] hover:bg-[#0F0F0F]"
            >
              {isPurchasingCredits ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Purchasing...
                </>
              ) : (
                "Purchase"
              )}
            </Button>
            <p className="pt-3 text-xs leading-5 text-[#6B7280]">
              By clicking Purchase, you authorize us to initiate a secure Stripe
              top-up for the amount entered above.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPurchaseConfirmation} onOpenChange={setShowPurchaseConfirmation}>
        <DialogContent className="max-w-md rounded-[20px] bg-white p-6">
          <DialogHeader>
            <div className="mb-2 flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-[#16A34A]" />
            </div>
            <DialogTitle className="text-center font-clash text-2xl font-semibold text-black">
              Payment Successful!
            </DialogTitle>
            <DialogDescription className="pt-1 text-center text-xl text-[#6B7280]">
              Your payment has been processed successfully. You will receive a
              confirmation email shortly.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-3 border-y border-[#E5E5E5] py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B7280]">Amount</span>
              <span className="font-medium text-black">
                ${purchaseReceipt?.amount.toFixed(2) ?? "0.00"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B7280]">Payment method</span>
              <span className="font-medium text-black">
                {purchaseReceipt?.paymentMethod ?? "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B7280]">Date</span>
              <span className="font-medium text-black">{purchaseReceipt?.date ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B7280]">Merchant</span>
              <span className="font-medium text-black">{purchaseReceipt?.merchant ?? "-"}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => setShowPurchaseConfirmation(false)}
              className="w-full bg-[#171717] text-[#FAFAFA] hover:bg-[#0F0F0F]"
            >
              Continue
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadReceipt}
              className="w-full border-[#E5E5E5] bg-white text-[#171717] hover:bg-[#FAFAFA]"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Receipt
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-[#6B7280]">
            Need help? Contact our support team at contact@getsouvenir.com
          </p>
        </DialogContent>
      </Dialog>

      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-4">

          {/* Status banners */}
          {showPastDueBanner && (
            <div className="flex items-start gap-3 rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[#991B1B]">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Payment past due</p>
                <p className="text-xs mt-0.5">
                  Your last payment failed. Please update your payment method to
                  keep your subscription active.
                </p>
              </div>
            </div>
          )}
          {showUnpaidBanner && (
            <div className="flex items-start gap-3 rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[#991B1B]">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Invoice unpaid</p>
                <p className="text-xs mt-0.5">
                  Your invoice is unpaid. Update your payment method to restore
                  access.
                </p>
              </div>
            </div>
          )}
          {showCanceledBanner && (
            <div className="flex items-start gap-3 rounded-[8px] border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-[#92400E]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Subscription canceled</p>
                <p className="text-xs mt-0.5">
                  Your subscription has ended. Subscribe to a plan to restore
                  access.
                </p>
              </div>
            </div>
          )}
          {showCancelAtEndBanner && (
            <div className="flex items-start gap-3 rounded-[8px] border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-[#92400E]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Plan cancels at period end</p>
                <p className="text-xs mt-0.5">
                  Your plan will be canceled on{" "}
                  <span className="font-medium">{formatDate(user?.currentPeriodEnd)}</span>.
                  You will not be charged again.
                </p>
              </div>
            </div>
          )}
          {subscriptionStatus === "incomplete" && (
            <div className="flex items-start gap-3 rounded-[8px] border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-[#92400E]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Payment pending</p>
                <p className="text-xs mt-0.5">
                  Your subscription payment is being processed. This usually
                  resolves in a few minutes — refresh the page to check.
                </p>
              </div>
            </div>
          )}

          {/* Current plan summary */}
          <div className="flex flex-col gap-4">
            <div className="text-[#F5F5F5] bg-[#2C2C2C] border border-[#767676] rounded-[8px] flex justify-between px-4 py-3">
              <div className="flex flex-col gap-1">
                <div className="font-geist flex items-baseline gap-2">
                  <span className="text-3xl font-medium">{planLabel}</span>
                </div>
                <p className="text-sm text-[#B3B3B3]">
                  {hasActiveSubscription
                    ? `Status: ${subscriptionStatus}${cancelAtPeriodEnd ? " (cancels at period end)" : ""} • Next billing: ${formatDate(nextBillingDate)}`
                    : "No active subscription"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* hiding the plans buttons */}
                {hasActiveSubscription && !cancelAtPeriodEnd && subscriptionStatus === "active" && (
                  <Button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="h-auto px-4 py-2 rounded-[8px] bg-transparent border border-[#767676] text-[#B3B3B3] hover:bg-[#3C3C3C] hover:text-white"
                  >
                    Cancel plan
                  </Button>
                )}
                {/* hiding the plans buttons */}
                <Button
                  type="button"
                  onClick={() =>
                    router.push("/settings/usage-and-billing/change-plan")
                  }
                  className="h-auto px-4 py-2 rounded-[8px] bg-[#F5F5F5] text-[#0A0A0A] hover:bg-white"
                >
                  {hasActiveSubscription ? "Change plan" : "Get a plan"}
                </Button>
              </div>
            </div>

            {upcomingInvoice && (
              <div className="text-[#171717] bg-[#FAFAFA] border border-[#E5E7EB] rounded-[8px] flex justify-between px-4 py-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Upcoming invoice</p>
                  <p className="text-xs text-[#6B7280]">
                    {formatDate(upcomingInvoice.next_payment_date)}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatAmount(upcomingInvoice.amount_due, upcomingInvoice.currency)}
                </p>
              </div>
            )}

            {/* Usage limits header */}
            <div className="space-y-1 text-black">
              <h1 className="font-clash text-2xl">Your credits</h1>
              <p className="font-geist text-sm text-[#4B5563]">
                Track your monthly credit consumption.{" "}
                {user?.creditsDisplay && (
                  <span className="font-medium text-black">{user.creditsRemainingDisplay} / {user.creditsDisplay} credits remaining</span>
                )}
              </p>
            </div>
          </div>

          {/* Daily usage */}
          {/* {(() => {
            const usage = user?.usage;
            const dailyPct =
              usage?.daily_used_pct !== undefined
                ? normalizePct(usage.daily_used_pct)
                : (() => {
                    const dailyLimit = parseFloat(user?.dailyBudgetLimit ?? "0");
                    const dailyUsed = parseFloat(user?.dailyBudgetUsed ?? "0");
                    return dailyLimit > 0 ? Math.min((dailyUsed / dailyLimit) * 100, 100) : 0;
                  })();

            const dailyByCategory = usage?.daily_by_category;
            let seg1d = +(dailyPct * 0.40).toFixed(1);
            let seg2d = +(dailyPct * 0.35).toFixed(1);
            let seg3d = +(dailyPct - seg1d - seg2d).toFixed(1);

            if (dailyByCategory) {
              seg1d = +normalizePct(dailyByCategory.chat).toFixed(1);
              seg2d = +normalizePct(dailyByCategory.persona).toFixed(1);
              seg3d = +normalizePct(dailyByCategory.workflow).toFixed(1);
            }
            return (
              <div className="flex items-center gap-4 mb-4">
                <div className="w-36 shrink-0">
                  <p className="text-sm font-medium text-black">Daily Session</p>
                  <p className="text-xs text-[#757575]">Last reset {formatDate(user?.usage?.last_reset_date)}</p>
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-zinc-100 shadow-inner shadow-zinc-300 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#5A9CB5] transition-all duration-500"
                    style={{ width: `${dailyPct}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-sm text-[#757575]">{Math.round(dailyPct)}% used</span>
              </div>
            );
          })()} */}

          {/* Monthly usage */}
          {(() => {
            const creditsUsed = user?.creditsUsed ?? 0;
            const creditsTotal = user?.creditsTotal ?? 0;
            const creditsRemaining = user?.creditsRemaining ?? 0;
            const usedPct = creditsTotal > 0 ? Math.min((creditsUsed / creditsTotal) * 100, 100) : 0;

            return (
              <div className="flex items-center gap-4 mb-4">
                <div className="w-36 shrink-0">
                  <p className="text-sm font-medium text-black">Monthly Credits</p>
                  <p className="text-xs text-[#757575]">Resets {nextMonthName} 1, {currentYear}</p>
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-zinc-100 shadow-inner shadow-zinc-300 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#5A9CB5] transition-all duration-500"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-sm text-[#757575]">{creditsRemaining.toLocaleString()} left</span>
              </div>
            );
          })()}

          {/* Add more usage */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E5E5]">
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-base text-black">Add more credits</p>
              <p className="text-sm text-[#757575]">Need more credits for this month?</p>
            </div>
            <Button
            disabled
              onClick={() => setShowBuyCreditsModal(true)}
              className="h-auto px-4 py-2 rounded-[8px] bg-[#171717] text-[#FAFAFA] hover:bg-[#0F0F0F]"
            >
              Buy more Credits
            </Button>
          </div>

          {/* Invoice history */}
          <div className="flex flex-col gap-3 pt-4 border-t border-[#E5E5E5]">
            <div className="space-y-1 text-black">
              <h2 className="font-clash text-xl">Invoice history</h2>
              <p className="font-geist text-sm text-[#4B5563]">
                Download past invoices for your records.
              </p>
            </div>

            <div className="border border-[#E5E5E5] rounded-[8px]">
              <div className="max-h-68 overflow-y-auto customScrollbar2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-medium text-[#1E1E1E] border-b border-[#757575]">
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Amount</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr className="text-sm text-[#1E1E1E]">
                        <td className="px-4 py-3" colSpan={4}>
                          No invoices yet.
                        </td>
                      </tr>
                    ) : (
                      invoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="text-sm text-[#1E1E1E] even:bg-[#FAFAFA]"
                        >
                          <td className="px-4 py-2">
                            {invoice.number ? `${invoice.number} • ` : ""}
                            {formatDate(invoice.created)}
                          </td>
                          <td className="px-4 py-2">
                            {formatAmount(invoice.amount_paid, invoice.currency)}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                invoice.paid
                                  ? "bg-[#F0FDF4] text-[#15803D]"
                                  : "bg-[#FEF2F2] text-[#DC2626]"
                              }`}
                            >
                              {invoice.paid && <Check className="h-3 w-3" />}
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <a
                              href={invoice.invoice_pdf || invoice.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#111827] underline decoration-[#9CA3AF] underline-offset-2"
                            >
                              Download
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
    </AppLayout>
  );
}

export default function SettingsUsageAndBillingPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="w-full min-h-[40vh] flex items-center justify-center px-4">
            <p className="font-geist text-sm text-[#525252]">Loading…</p>
          </div>
        </AppLayout>
      }
    >
      <SettingsUsageAndBillingPageInner />
    </Suspense>
  );
}
