"use client";

import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettingsUsageAndBillingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isRedirectingToPricing, setIsRedirectingToPricing] = useState(false);
  const now = new Date();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const currentYear = now.getFullYear();
  const nextMonthName = monthNames[(now.getMonth() + 1) % 12];
  const normalizedPlanType = user?.planType ?? null;
  const hasActiveSubscription = Boolean(normalizedPlanType);
  const subscriptionStatus = user?.subscriptionStatus ?? (hasActiveSubscription ? "active" : "none");
  const cancelAtPeriodEnd = user?.cancelAtPeriodEnd ?? false;
  const planLabel =
    normalizedPlanType === "power"
      ? "Power"
      : normalizedPlanType === "pro"
      ? "Pro"
      : normalizedPlanType === "standard"
        ? "Standard"
        : "No Plan";

  const formatDate = (value: unknown) => {
    if (!value) return "-";
    if (typeof value !== "string" && typeof value !== "number") {
      return "-";
    }
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

  const handleGoToPricing = () => {
    if (isRedirectingToPricing) return;
    setIsRedirectingToPricing(true);
    router.push("/onboarding/pricing");
  };

  const handleBillingAction = () => {
    if (user?.billingPortalUrl) {
      window.location.href = user.billingPortalUrl;
      return;
    }
    handleGoToPricing();
  };

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-4">
          {/* Current plan summary */}
          <div className="flex flex-col gap-4">
            <div className="text-[#F5F5F5] bg-[#2C2C2C] border border-[#767676] rounded-[8px] flex justify-between px-4 py-3">
              <div className="flex flex-col gap-1">
                <div className="font-geist flex items-baseline gap-2">
                  <span className="text-3xl font-medium">{planLabel}</span>
                </div>
                <p className="text-sm text-[#B3B3B3]">
                  {hasActiveSubscription
                    ? `Status: ${subscriptionStatus}${cancelAtPeriodEnd ? " (cancels at period end)" : ""} • Next billing: ${formatDate(user?.currentPeriodEnd)}`
                    : "No active subscription"}
                </p>
              </div>
              <div className="flex items-center">
                <Button
                  type="button"
                  onClick={handleBillingAction}
                  disabled={isRedirectingToPricing}
                  className="h-auto px-4 py-2 rounded-[8px] bg-[#F5F5F5] text-[#0A0A0A] hover:bg-white"
                >
                  {isRedirectingToPricing
                    ? "Opening Pricing..."
                    : user?.billingPortalUrl
                      ? "Manage Plan"
                      : "Update Plan"}
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
              <h1 className="font-clash text-2xl">Your usage limits</h1>
              <p className="font-geist text-sm text-[#4B5563]">
                Track your monthly consumption.
              </p>
            </div>
          </div>

          {/* Token usage */}
          {(() => {
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
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center justify-between text-sm text-black">
                  <span>Daily Session</span>
                  <span className="text-[#1E1E1E]">{Math.round(dailyPct)}% Used</span>
                </div>
                <div className="w-full h-2 rounded-[8px] bg-zinc-100 shadow-inner shadow-zinc-300 flex items-center overflow-hidden">
                  <div className="max-w-full h-full bg-linear-to-b from-[#5A9CB5] via-[#5A9CB5]/75 via-25% to-[#5A9CB5]/90" style={{ width: `${seg1d}%` }} />
                  <div className="max-w-full h-full bg-linear-to-b from-[#FACE68] via-[#FACE68]/75 via-25% to-[#FACE68]/90" style={{ width: `${seg2d}%` }} />
                  <div className="max-w-full h-full bg-linear-to-b from-[#FA6868] via-[#FA6868]/60 via-25% to-[#FA6868]/90" style={{ width: `${seg3d}%` }} />
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div className="w-4 h-4 bg-linear-to-b from-[#5A9CB5] via-[#5A9CB5]/75 via-25% to-[#5A9CB5]/90 rounded"></div>
                      <p className="font-geist text-sm text-[#757575]">
                        Chat &ndash;{" "}
                        <span className="font-medium text-black">{seg1d}%</span>
                      </p>
                    </div>
                    <p className="text-[#D4D4D4]">|</p>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div className="w-4 h-4 bg-linear-to-b from-[#FACE68] via-[#FACE68]/75 via-25% to-[#FACE68]/90 rounded"></div>
                      <p className="font-geist text-sm text-[#757575]">
                        Persona &ndash;{" "}
                        <span className="font-medium text-black">{seg2d}%</span>
                      </p>
                    </div>
                    <p className="text-[#D4D4D4]">|</p>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div className="w-4 h-4 bg-linear-to-b from-[#FA6868] via-[#FA6868]/60 via-25% to-[#FA6868]/90 rounded"></div>
                      <p className="font-geist text-sm text-[#757575]">
                        Workflow &ndash;{" "}
                        <span className="font-medium text-black">{seg3d}%</span>
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-[#757575]">
                    Last reset {formatDate(user?.usage?.last_reset_date)}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Storage usage */}
          {(() => {
            const monthlyPct =
              user?.usage?.monthly_used_pct !== undefined
                ? normalizePct(user.usage.monthly_used_pct)
                : Math.min(user?.budgetConsumedPercent ?? 0, 100);
            const byCategory = user?.usage?.by_category;

            let seg1m = +(monthlyPct * 0.40).toFixed(1);
            let seg2m = +(monthlyPct * 0.35).toFixed(1);
            let seg3m = +(monthlyPct - seg1m - seg2m).toFixed(1);

            if (byCategory) {
              seg1m = +normalizePct(byCategory.chat).toFixed(1);
              seg2m = +normalizePct(byCategory.persona).toFixed(1);
              seg3m = +normalizePct(byCategory.workflow).toFixed(1);
            }
            return (
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center justify-between text-sm text-black">
                  <span>Monthly Limits</span>
                  <span className="text-[#1E1E1E]">{Math.round(monthlyPct)}% Used</span>
                </div>
                <div className="w-full h-2 rounded-[8px] bg-zinc-100 shadow-inner shadow-zinc-300 flex items-center overflow-hidden">
                  <div className="max-w-full h-full bg-linear-to-b from-[#5A9CB5] via-[#5A9CB5]/75 via-25% to-[#5A9CB5]/90" style={{ width: `${seg1m}%` }} />
                  <div className="max-w-full h-full bg-linear-to-b from-[#FACE68] via-[#FACE68]/75 via-25% to-[#FACE68]/90" style={{ width: `${seg2m}%` }} />
                  <div className="max-w-full h-full bg-linear-to-b from-[#FA6868] via-[#FA6868]/60 via-25% to-[#FA6868]/90" style={{ width: `${seg3m}%` }} />
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div className="w-4 h-4 bg-linear-to-b from-[#5A9CB5] via-[#5A9CB5]/75 via-25% to-[#5A9CB5]/90 rounded"></div>
                      <p className="font-geist text-sm text-[#757575]">
                        Chat &ndash;{" "}
                        <span className="font-medium text-black">{seg1m}%</span>
                      </p>
                    </div>
                    <p className="text-[#D4D4D4]">|</p>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div className="w-4 h-4 bg-linear-to-b from-[#FACE68] via-[#FACE68]/75 via-25% to-[#FACE68]/90 rounded"></div>
                      <p className="font-geist text-sm text-[#757575]">
                        Persona &ndash;{" "}
                        <span className="font-medium text-black">{seg2m}%</span>
                      </p>
                    </div>
                    <p className="text-[#D4D4D4]">|</p>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div className="w-4 h-4 bg-linear-to-b from-[#FA6868] via-[#FA6868]/60 via-25% to-[#FA6868]/90 rounded"></div>
                      <p className="font-geist text-sm text-[#757575]">
                        Workflow &ndash;{" "}
                        <span className="font-medium text-black">{seg3m}%</span>
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-[#757575]">
                    Resets {nextMonthName} 1, {currentYear}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Add more usage */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="font-medium text-base  text-black">Add more Tokens</p>
              <p className="text-sm text-[#757575]">
                Need more usage this month?
              </p>
            </div>
            <Button className="h-auto px-4 py-2 rounded-[8px] bg-[#171717] text-[#FAFAFA] hover:bg-[#0F0F0F]">
              Add more Usage
            </Button>
          </div>

          {/* Payment method */}
          <div className="flex flex-col gap-3 pt-4 border-t border-[#E5E5E5]">
            <div className="space-y-1 text-black">
              <h2 className="font-clash text-xl">Payment method</h2>
              <p className="font-geist text-sm text-[#4B5563]">
                Manage your payment details.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                {user?.defaultPaymentMethod ? (
                  <>
                    <p className="text-sm font-medium text-black">
                      {user.defaultPaymentMethod.brand.toUpperCase()} ending in {user.defaultPaymentMethod.last4}
                    </p>
                    <p className="text-xs text-[#757575]">
                      Expires {String(user.defaultPaymentMethod.exp_month).padStart(2, "0")}/{user.defaultPaymentMethod.exp_year}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-black">No payment method</p>
                    <p className="text-xs text-[#757575]">Add a paid plan to attach a card</p>
                  </>
                )}
              </div>
              <Button
                type="button"
                onClick={handleBillingAction}
                disabled={isRedirectingToPricing}
                className="h-auto px-4 py-2 rounded-[8px] bg-[#171717] text-[#FAFAFA] hover:bg-[#0F0F0F]"
              >
                {isRedirectingToPricing
                  ? "Opening Pricing..."
                  : user?.billingPortalUrl
                    ? "Manage Billing"
                    : "Change Card"}
              </Button>
            </div>
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
                          <td className="px-4 py-2">{formatAmount(invoice.amount_paid, invoice.currency)}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F5] px-2 py-1 text-xs font-medium text-[#14AE5C]">
                              <Check className="h-3 w-3" />
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
    </AppLayout>
  );
}
