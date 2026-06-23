'use client'

import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'

// ── Credit lifecycle events ──────────────────────────────────────────────────
// Dispatched on `window`; the AuthProvider listens for CREDITS_UPDATED and
// refreshes the user profile so balances update app-wide without a page reload.

/** Fire after any operation that changes the credit balance (e.g. a topup). */
export const CREDITS_UPDATED_EVENT = 'credits:updated'
/** Fire to surface the "credits exhausted" modal imperatively (e.g. a blocked send). */
export const CREDITS_EXHAUSTED_EVENT = 'credits:exhausted'

/** Broadcast that the credit balance changed → triggers a profile refresh. */
export function notifyCreditsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CREDITS_UPDATED_EVENT))
  }
}

// ── Status derivation ────────────────────────────────────────────────────────

export type CreditLevel = 'normal' | 'low' | 'exhausted'

/** Warn once the user has consumed this fraction of their allocation. */
const LOW_REMAINING_FRACTION = 0.1 // ≤10% remaining ⇒ ≥90% used

export interface CreditStatus {
  /**
   * Whether the individual credit/topup model governs this user. Applies to all
   * individual (non-org) users with a credit balance — trial AND subscribers:
   * both can exhaust credits and recharge via a topup. Org/teams users are
   * gated by the workspace pool (useOrg().plan.poolStatus) elsewhere, so they
   * stay excluded to avoid double-gating.
   */
  applies:   boolean
  level:     CreditLevel
  /** Fraction of allocated credits consumed (0..1). */
  pctUsed:   number
  remaining: number | null
  total:     number | null
  /** True when usage must be hard-blocked (an exhausted credit/topup user). */
  blocked:   boolean
}

/** Minimal subset of the auth user needed to derive credit status. */
export interface CreditStatusInput {
  creditsTotal?:     number | null
  creditsRemaining?: number | null
  orgId?:            string | null
}

/**
 * Pure derivation of the individual credit/topup balance state — a warning
 * level (≥90% used) and a hard-block (exhausted) flag. Kept side-effect-free
 * and exported so it can be unit-tested without React. See use-credit-status.test.ts.
 *
 * `creditsTotal`/`creditsRemaining` are topup-aware (see auth-context
 * mapProfileToUser), so a successful topup raises `remaining`, dropping the
 * level back to normal and clearing `blocked`.
 */
export function deriveCreditStatus(user: CreditStatusInput | null | undefined): CreditStatus {
  const total     = user?.creditsTotal ?? null
  const remaining = user?.creditsRemaining ?? null
  const hasEverHadCredits = total !== null && total > 0

  // All individual (non-org) credit users — trial and subscribers alike.
  const applies = hasEverHadCredits && user?.orgId == null

  const remainingFrac =
    total && total > 0 && remaining !== null ? Math.max(remaining, 0) / total : 1
  const pctUsed = Math.min(Math.max(1 - remainingFrac, 0), 1)

  let level: CreditLevel = 'normal'
  if (applies && remaining !== null) {
    if (remaining <= 0) level = 'exhausted'
    else if (remainingFrac <= LOW_REMAINING_FRACTION) level = 'low'
  }

  return {
    applies,
    level,
    pctUsed,
    remaining,
    total,
    blocked: applies && level === 'exhausted',
  }
}

/**
 * Single source of truth for the individual credit/topup balance state.
 * Thin React wrapper over {@link deriveCreditStatus} reading the auth user.
 *
 * Org members are gated by the workspace pool (useOrg().plan) — never the
 * individual credit/topup model — so the "you've used all your credits, buy a
 * top-up" modal/toast must not fire for them. `deriveCreditStatus` already
 * excludes them via `orgId == null`, but `/users/me` doesn't always include
 * `org_id`, which would wrongly engage individual gating for (e.g.) an
 * Enterprise account. The OrgProvider resolves the real org id (falling back to
 * listOrganizations), so we suppress individual gating whenever an org is
 * resolved — and also while resolution is still pending, to avoid a wrong flash.
 */
export function useCreditStatus(): CreditStatus {
  const { user } = useAuth()
  const { orgId, orgReady } = useOrg()
  const status = deriveCreditStatus(user)

  const orgGated = !orgReady || orgId != null
  if (orgGated && status.applies) {
    return { ...status, applies: false, level: 'normal', blocked: false }
  }
  return status
}
