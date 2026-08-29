# Stripe (Billing) Endpoints — Frontend Usage Map

Cross-references every `/stripe/*` backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), and [`users-endpoints-usage.md`](./users-endpoints-usage.md).

8 endpoints exist in this group. **All 8 are actively used** — the rare fully-live feature area, same as `highlights`. All raw wrappers live in `src/lib/api/user.ts`; a second file, `src/lib/api/stripe.ts`, is a thin compatibility layer re-exporting most of them as-is plus three object-argument adapters (`createCheckout`, `createTopUp`, `chargeTopUp`) over the positional-argument originals — its own header comment explains why: *"single implementation, two historical import paths."* One of those three adapters, `createTopUp`, turns out to have zero callers even though its sibling adapters do — see below.

---

## `POST /stripe/checkout` (Create Checkout)
- **`config.ts`**: `STRIPE_CHECKOUT_ENDPOINT`
- **Wrapper**: `createCheckoutSession(plan, billing)` (`user.ts`, positional args) — re-exported via `stripe.ts`'s `createCheckout({ plan, billing })` (object arg). Body is deliberately just `{ plan, billing }`; sending a price ID directly previously caused "No such price" failures in test/live mismatches. Used for both first-time signup and switching an existing plan.
- **Used by** (all via `stripe.ts`'s `createCheckout`):
  - `onboarding/plans/page.tsx` — selecting a plan during onboarding and continuing to checkout.
  - `settings/billing/change-plan/page.tsx` and `(standalone)/org/change-plan/page.tsx` — choosing a new plan tier from the change-plan screen (both the in-app settings flow and the standalone org variant; each has two call sites for monthly/annual toggles).

## `POST /stripe/topup` (Create Topup)
- **`config.ts`**: `STRIPE_TOPUP_ENDPOINT`
- **Wrapper**: `createTopUpSession(amount_usd)` (`user.ts`) — also re-exported via `stripe.ts` as the object-arg `createTopUp({ amount_usd })`, but **that adapter is never called** (see Dead section below); the app calls the raw `user.ts` version directly instead.
- **Used by**: `components/BuyCreditsModal/index.tsx`'s `handlePay()` — the fallback path when the user has no saved payment method: redirects to a new Stripe Checkout session for the chosen top-up amount.

## `POST /stripe/topup/charge` (Charge Topup Now)
- **`config.ts`**: `STRIPE_TOPUP_CHARGE_ENDPOINT`
- **Wrapper**: `chargeTopUp(amount_usd)` (`user.ts`, positional) — re-exported via `stripe.ts` as an object-arg adapter of the same name, `chargeTopUp({ amount_usd })`.
- **Used by**:
  - `BuyCreditsModal/index.tsx`'s `handlePay()` (raw `user.ts` version) — the primary path when a payment method is already on file: charges immediately without leaving the app, then fires a `credits:updated` event to refresh balances everywhere.
  - `settings/(org)/plans/page.tsx` (the `stripe.ts` object-arg version) — the org "Plans & Usage" page's top-up flow, same immediate-charge behavior for an org admin.

## `GET /stripe/billing` (Get My Billing)
- **`config.ts`**: `STRIPE_BILLING_ENDPOINT`
- **Wrapper**: `fetchBilling()` (`user.ts`) — zod-validated snapshot of payment method, invoices, upcoming invoice, and cancel state; kept separate from `/users/me`.
- **Used by**:
  - `settings/billing/page.tsx` — the individual Billing settings page's initial load and its `reload()` (called after every mutating action: cancel, resume, claim trial, portal return).
  - `settings/(org)/plans/page.tsx` — same pattern for the org "Plans & Usage" page (initial load + `reloadBilling()` after mutations).
  - `onboarding/pricing/confirmation/page.tsx`, `settings/billing/confirmation/page.tsx`, `settings/(org)/plans/confirmation/page.tsx` — all three "returned from Stripe Checkout" confirmation pages fire-and-forget refresh billing state once the redirect lands.

## `POST /stripe/portal` (Open Billing Portal)
- **`config.ts`**: `STRIPE_PORTAL_ENDPOINT`
- **Wrapper**: `openBillingPortal()` (`user.ts`) — creates a Stripe-hosted billing-portal session and returns its URL.
- **Used by**:
  - `settings/billing/page.tsx`'s `handleOpenPortal()` — clicking **Manage payment method** (or similar) on the individual Billing page; gated behind `canManageBilling`.
  - `settings/(org)/plans/page.tsx`'s equivalent handler — same action on the org Plans & Usage page, gated to the org owner ("Only the organization owner can manage billing").
  - `BuyCreditsModal/index.tsx`'s `handleEditPayment()` — clicking **Edit payment method** inside the top-up modal.

## `DELETE /stripe/subscription` (Cancel My Subscription)
- **`config.ts`**: `STRIPE_SUBSCRIPTION_ENDPOINT`
- **Wrapper**: `cancelSubscription()` (`user.ts`)
- **Used by**: `settings/billing/page.tsx`'s `handleCancelSubscription()` and `settings/(org)/plans/page.tsx`'s equivalent — confirming cancellation in each page's cancel-subscription dialog. Access continues until the current period ends; both pages reload the billing snapshot afterward.

## `POST /stripe/subscription/resume` (Resume My Subscription)
- **`config.ts`**: `STRIPE_SUBSCRIPTION_RESUME_ENDPOINT`
- **Wrapper**: `resumeSubscription()` (`user.ts`)
- **Used by**: `settings/billing/page.tsx`'s `handleResumeSubscription()` and `settings/(org)/plans/page.tsx`'s equivalent — clicking **Resume subscription** after a previously-scheduled cancellation, shown while the subscription is still in its cancel-pending window.

## `POST /stripe/trial` (Start My Trial)
- **`config.ts`**: `STRIPE_TRIAL_ENDPOINT`
- **Wrapper**: `startTrial()` (`user.ts`) — grants 1,000 free trial credits.
- **Used by**: `settings/billing/page.tsx`'s `handleClaimTrial()` — clicking the **Claim free credits** action shown to eligible accounts on the individual Billing page. (No equivalent action exists on the org Plans & Usage page — trials are individual-account only.)

---

## Adjacent dead code worth knowing

`stripe.ts`'s `createTopUp({ amount_usd })` — the object-arg adapter over `createTopUpSession()` — has **zero callers**. Verified via grep: its only match in `src/` is its own definition in `stripe.ts`. Every real top-up-session call site (`BuyCreditsModal`) uses the raw `createTopUpSession()` from `user.ts` directly instead, even though the equivalent adapters for checkout (`createCheckout`) and immediate-charge (`chargeTopUp`) *are* both used elsewhere. Not a dead endpoint — `POST /stripe/topup` itself is very much alive — just a redundant, unused wrapper sitting next to two wrappers that aren't.

---

## Summary

| Endpoint | Status |
|---|---|
| `POST /stripe/checkout` | Live — `createCheckoutSession()` / `createCheckout()` |
| `POST /stripe/topup` | Live — `createTopUpSession()` (the `stripe.ts` `createTopUp()` adapter is unused) |
| `POST /stripe/topup/charge` | Live — `chargeTopUp()` (both the raw and object-arg forms are used, in different pages) |
| `GET /stripe/billing` | Live — `fetchBilling()` |
| `POST /stripe/portal` | Live — `openBillingPortal()` |
| `DELETE /stripe/subscription` | Live — `cancelSubscription()` |
| `POST /stripe/subscription/resume` | Live — `resumeSubscription()` |
| `POST /stripe/trial` | Live — `startTrial()` |

All 8 endpoints are actively used; the only dead surface in this group is the redundant `createTopUp()` wrapper adapter, not an endpoint itself.
