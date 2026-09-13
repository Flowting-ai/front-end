import type { UserUsage, BillingCredits } from "@/lib/api/user";
import { dollarsToCredits } from "@/lib/api/billing";

/**
 * Individual credit balance from `/users/me` usage or a Billing CreditSummary.
 * Org pool remaining for members also arrives on usage.credits — same remaining
 * number, different owner. Category spend is owned by the Usage class.
 */

export interface CreditBalance {
  total: number;
  used: number;
  remaining: number;
  isTrial: boolean;
}

export const EMPTY_CREDIT_BALANCE: CreditBalance = {
  total: 0,
  used: 0,
  remaining: 0,
  isTrial: false,
};

function build(
  remainingDollars: number | null | undefined,
  usedDollars: number | null | undefined,
  isTrial: boolean,
  allowanceDollars?: number | null,
): CreditBalance {
  const remaining = dollarsToCredits(remainingDollars ?? 0);
  const used = dollarsToCredits(usedDollars ?? 0);
  const total = allowanceDollars != null ? dollarsToCredits(allowanceDollars) : remaining + used;
  return { total, used, remaining, isTrial };
}

type UsageWithTrial = UserUsage & {
  trial?: { remaining?: number; amount?: number } | null;
  topup_credits?: number;
};

export function creditsFromUsage(usage: UserUsage | null | undefined): CreditBalance {
  if (!usage) return EMPTY_CREDIT_BALANCE;
  const extras = usage as UsageWithTrial;
  const topup = extras.topup_credits ?? 0;
  if (extras.trial) {
    return build(
      (extras.trial.remaining ?? 0) + topup,
      usage.spent_this_period,
      true,
      extras.trial.amount != null ? extras.trial.amount + topup : null,
    );
  }
  if (typeof usage.plan_credits === "number") {
    const usedDollars = usage.used ?? extras.spent_this_period ?? 0;
    const remainingDollars = usage.plan_credits + topup;
    return build(remainingDollars, usedDollars, false, remainingDollars + usedDollars);
  }
  return build(usage.credits, extras.spent_this_period, false);
}

export function creditsFromBilling(credits: BillingCredits | null | undefined): CreditBalance {
  if (!credits) return EMPTY_CREDIT_BALANCE;
  const topup = credits.topup_credits ?? 0;
  if (credits.trial) {
    return build(
      (credits.trial.remaining ?? 0) + topup,
      credits.trial.used,
      true,
      (credits.trial.amount ?? 0) + topup,
    );
  }
  return build(credits.remaining ?? 0, credits.used ?? 0, false, credits.total_credits);
}
