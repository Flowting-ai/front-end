import type { UserUsage, BillingCredits } from "@/lib/api/user";

/**
 * INDIVIDUAL credit balance — the single source of truth for the personal
 * (non-organization) credit/top-up model.
 *
 * This module deliberately covers only the INDIVIDUAL environment, which has two
 * states of the *same* balance:
 *   • trial      — an explicit trial grant (amount / remaining / used)
 *   • subscriber — a paid personal plan drawing down a credit balance
 * A free user with no credits resolves to all-zero.
 *
 * The ORGANIZATION (team) environment is intentionally NOT handled here — team
 * credits come from the shared org pool via `getOrgPlan` / `org-context`. Keeping
 * the two apart is the whole point: never derive personal credits from org data
 * or vice-versa.
 *
 * ── Backend semantics (verified against live /users/me `usage` and
 *    /stripe/billing `credits`) ──────────────────────────────────────────────
 *   • /users/me: `usage.credits` is the REMAINING balance (NOT the allowance),
 *     and `usage.spent_this_period` is what's been consumed; the period
 *     allowance is reconstructed as remaining + spent.
 *   • /stripe/billing (current shape): sends an explicit `remaining`, a scalar
 *     `used` (= allowance − remaining), and `total_credits` = the full period
 *     ALLOWANCE. Per-category spend moved to `by_category`. We use these
 *     explicit fields directly.
 *   • /stripe/billing (legacy shape, still handled): `total_credits` WAS the
 *     remaining balance and `used` was a per-category object; allowance was
 *     reconstructed as remaining + Σused.
 *   • Values arrive in dollars; the UI displays credits at 1000 per dollar.
 *   • Trial is the exception: `credits.trial` carries an explicit
 *     { amount, remaining, used }; `usage.trial` carries only { remaining },
 *     so its allowance is reconstructed as remaining + used.
 */

const CREDITS_PER_DOLLAR = 1000;

export interface CreditBalance {
  /** Period allowance, in credits. */
  total: number;
  /** Credits consumed this period. */
  used: number;
  /** Remaining credits — the authoritative balance from the backend. */
  remaining: number;
  /** True when this balance is a trial grant. */
  isTrial: boolean;
}

export const EMPTY_CREDIT_BALANCE: CreditBalance = {
  total: 0,
  used: 0,
  remaining: 0,
  isTrial: false,
};

const toCredits = (dollars: number | null | undefined): number =>
  Math.max(0, Math.round((dollars ?? 0) * CREDITS_PER_DOLLAR));

function build(
  remainingDollars: number | null | undefined,
  usedDollars: number | null | undefined,
  isTrial: boolean,
  allowanceDollars?: number | null,
): CreditBalance {
  const remaining = toCredits(remainingDollars);
  const used = toCredits(usedDollars);
  // Allowance: trial has an explicit amount; otherwise it's remaining + used
  // (because the backend's "total" is actually the remaining balance).
  const total = allowanceDollars != null ? toCredits(allowanceDollars) : remaining + used;
  return { total, used, remaining, isTrial };
}

/**
 * /users/me carries `trial` and `topup_credits` on the usage object at runtime
 * (spread through from the raw API payload) even though they aren't on the type.
 */
type UsageWithExtras = UserUsage & {
  trial?: { remaining?: number; amount?: number } | null;
  topup_credits?: number;
};

/**
 * Derive the personal credit balance from the `/users/me` `usage` object.
 * This is the global source (auth-context → sidebar, gating, etc.).
 *
 * Top-ups: `usage.credits` already folds in remaining top-up balance, so the
 * subscriber/free path needs no extra add. Trial keeps its pool separate, so
 * top-ups are stacked onto the trial balance explicitly.
 */
export function creditsFromUsage(usage: UserUsage | null | undefined): CreditBalance {
  if (!usage) return EMPTY_CREDIT_BALANCE;
  const u = usage as UsageWithExtras;
  const topup = u.topup_credits ?? 0;
  if (u.trial) {
    return build(
      (u.trial.remaining ?? 0) + topup,
      usage.spent_this_period,
      true,
      u.trial.amount != null ? u.trial.amount + topup : null,
    );
  }
  // Subscriber / free: usage.credits is the all-in REMAINING (plan + top-up).
  return build(usage.credits, usage.spent_this_period, false);
}

/**
 * Derive the personal credit balance from the `/stripe/billing` `credits`
 * object. Used by the personal Billing page.
 *
 * `total_credits` already includes remaining top-up balance; trial stacks
 * top-ups on top of the trial pool.
 */
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
  // Current backend shape: explicit `remaining` + scalar `used`, with
  // `total_credits` as the full allowance.
  if (typeof credits.remaining === "number") {
    const used =
      typeof credits.used === "number"
        ? credits.used
        : credits.total_credits - credits.remaining;
    return build(credits.remaining, used, false, credits.total_credits);
  }
  // Legacy shape: `total_credits` is the REMAINING balance and `used` is a
  // per-category object; allowance = remaining + Σused.
  const usedObj =
    credits.used && typeof credits.used === "object" ? credits.used : null;
  const used =
    (usedObj?.chat ?? 0) + (usedObj?.persona ?? 0) + (usedObj?.brain ?? 0);
  return build(credits.total_credits, used, false);
}
