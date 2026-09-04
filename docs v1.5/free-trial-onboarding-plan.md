# Wire the free trial into onboarding (accept/deny)

Status: **proposed, not started.** Parked here for later — do not implement
without re-confirming scope.

## Context

Backend already has a real, working free-trial mechanism: `POST /stripe/trial`
grants a one-time **$5 credit (5,000 credits) for 7 days** to a brand-new
individual user (`back-end/services/users/service.py:30-31,213-223`,
`back-end/services/stripe/account.py:232-242`). It's explicitly **individual-only**
— it 403s if the caller is an org member (`account.py:233-237`), and joining an
org later actively deletes any existing personal trial
(`back-end/services/organizations/organization.py:499`).

Nothing in onboarding calls it. The frontend *does* have a working call site —
`Usage.startTrial()` — but it's wired to a "Claim free 1,000 credits" button
buried in Settings → Billing
(`front-end/src/app/(app)/settings/(shell)/plans-and-billing/page.tsx:1044-1056,1130-1133`),
not onboarding. A new user finishes onboarding with **zero credits** and no
prompt to claim the trial unless they happen to find that button later.

Worse, the copy is already wrong there ("1,000 free trial credits" — the real
grant is 5,000 credits / $5), and the same wrong "1,000 free credits" figure
is hardcoded as decorative, non-interactive copy on the onboarding Plans page's
"Welcome gift" card (`front-end/src/app/(onboarding)/onboarding/plans/page.tsx:627-646`)
— that card sits right next to the "Start for free" button
(`handleIndividualPlan`, line 375-377) which today does nothing but navigate
onward. It's the natural, already-designed spot for this offer; it's just not
wired to anything real.

**Goal:** when a user picks the free/individual path in onboarding, give them
an explicit choice — claim the real trial now, or skip it — instead of silently
sending them into the app with nothing. Fix the copy bug in the two places it
appears while touching this code.

## Plan

### 1. `front-end/src/app/(onboarding)/onboarding/plans/page.tsx` — the main change

Only the Individual card's "Welcome gift" panel and its CTA area change; the
Team card and its real Stripe checkout (`handleTeamPlan`) are untouched.

- Import `Usage` from `@/lib/api/billing` (same class `plans-and-billing/page.tsx`
  already uses for this exact call).
- Fix the static "1,000 free credits" line in the Welcome gift card (line ~637)
  to the real number: **"5,000 free credits ($5 value, 7 days)"**. This is a
  hardcoded mirror of the backend's `TRIAL_AMOUNT`/`TRIAL_DAYS` constants —
  there's no endpoint to preview the trial size without granting it, so if
  those constants ever change, this copy needs a manual update too. Worth a
  one-line comment noting that coupling.
- Replace the single `Start for free` button (line 716-718) with two explicit
  actions, same visual slot:
  - **Primary: "Claim my free credits"** — `handleClaimTrial`, new function:
    ```
    setClaimingTrial(true)
    const toastId = toast.loading("Claiming your free credits…")
    try {
      await Usage.startTrial()
      toast.success("5,000 free credits added — expires in 7 days.", { id: toastId })
    } catch (err) {
      // Non-fatal — same tolerance as every other onboarding save step.
      // Don't block the flow over a trial-claim failure.
      console.error("Trial claim failed", err)
      toast.error(err instanceof Error ? err.message : "Couldn't claim your free credits — you can try again later in Settings.", { id: toastId })
    } finally {
      setClaimingTrial(false)
    }
    handleIndividualPlan() // continue regardless of outcome
    ```
    Reuses the loading-toast pattern already used on the workspace/profile/invite
    onboarding pages, and the exact error-tolerant shape every other onboarding
    step already uses.
  - **Secondary, text-link style: "No thanks, continue without it"** — just
    calls the existing `handleIndividualPlan()` (bare navigation), i.e. explicit
    deny with zero API call.
  - Both land on `ONBOARDING_TONE_ROUTE`, same as today — this doesn't change
    the flow shape, only what happens before that navigation.
- No new route, no new step, no new onboarding-progress dot. The Team path
  never sees this UI at all (different card, different button), so the
  "org members can't have a trial" backend rule is satisfied by construction —
  no extra eligibility gating needed.

### 2. `front-end/src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` — fix the same copy bug

- Line 1049: `'1,000 free trial credits added to your account.'` → `'5,000 free credits added — expires in 7 days.'`
- Line 1132: `Claim free 1,000 credits` → `Claim free 5,000 credits`
- No behavior change, `handleClaimTrial`/`Usage.startTrial()` here are already correct — purely a copy fix while touching the same wrong number.

### 3. Flag, don't silently change: `/org/change-plan`'s "FREE PLAN ACTIVE" box

A "FREE PLAN ACTIVE — You have been assigned $20 worth of free credits" box
was built into the org Workspace/Core card, matching the Figma mock exactly
per explicit instruction at the time. Now that trials are confirmed
individual-only and org members 403 on `/stripe/trial`, that box is
advertising something structurally impossible on the exact page it's shown on
(only org admins/members reach `/org/change-plan`). Not touched by this plan —
needs an explicit decision: leave as intentional Figma-fidelity marketing
copy, or remove/replace in a follow-up.

## Verification (when this is picked up)

- `npx tsc --noEmit` after the edits.
- Manually walk `/onboarding/hello` → account-type (individual) → plans →
  click "Claim my free credits" → confirm a loading toast → success toast →
  lands on `/onboarding/tone`. Repeat choosing "No thanks" → same destination,
  no toast, no API call (check Network tab for no `/stripe/trial` request).
- Confirm `/settings/plans-and-billing`'s trial-claim button/toast now read
  "5,000" everywhere.
- Not testable end-to-end without a real backend session — this is a
  code-correctness verification, not a live-payment/live-trial confirmation.
