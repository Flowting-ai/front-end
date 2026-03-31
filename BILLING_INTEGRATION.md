# Stripe & Billing Integration — Change Log

## Overview

This document covers the three files changed to wire the Usage & Billing settings page to the real Stripe/backend API endpoints. The changes add plan management (subscribe, upgrade, downgrade), subscription cancellation, status banners, and live user data refresh — all sourced from `GET /users/me` and its companion mutation endpoints.

---

## Files Changed

### 1. `src/lib/api/user.ts`

#### What changed

**`updateSubscriptionPlan`** — return type widened from `UpdateSubscriptionResponse` to `UpdateSubscriptionResponse | CheckoutSessionResponse`.

The backend's `PATCH /users/me/subscription` has two possible success shapes:
- `{ status, new_plan }` — subscription updated in-place (existing subscriber)
- `{ checkout_url, session_id }` — no active subscription found, falls back to Stripe Checkout

The old implementation only accepted the first shape and would throw on the second. The new implementation returns either and lets the caller decide what to do.

**`cancelSubscription`** — new function added.

```ts
export async function cancelSubscription(): Promise<{ status: string }>
```

Calls `DELETE /users/me/subscription`. Throws with the backend's `detail` message on error (e.g. `"No active subscription found"`). On success, the subscription enters `cancel_at_period_end: true` state — it stays active until the billing period ends.

---

### 2. `src/context/auth-context.tsx`

#### What changed

**`mapProfileToUser` helper extracted** — the ~40-line inline mapping from `UserProfile → AuthUser` that lived inside a `useEffect` was pulled out into a module-level function. The `useEffect` now just calls `setUser(mapProfileToUser(profile))`.

This was necessary because the same mapping logic needed to run in two places (initial load and manual refresh) without duplicating code.

**`UserProfile` type imported** — added to the type import from `@/lib/api/user` so `mapProfileToUser`'s parameter is typed.

**`refreshUser` added to context**

```ts
const refreshUser = useCallback(async () => {
  const profile = await fetchCurrentUser();
  if (profile) setUser(mapProfileToUser(profile));
}, []);
```

Exposed on `AuthContextValue` as `refreshUser: () => Promise<void>`.

Any component can now call `refreshUser()` after a billing mutation to pull fresh subscription state, usage data, invoices, and payment methods — without a full page reload.

---

### 3. `src/app/settings/usage-and-billing/page.tsx`

This is the main change. The page was already rendering usage bars and invoice history from `user` context data, but had no mutation capabilities and no real API calls.

#### What changed and why

---

##### Subscription status banners

Four banners added at the top of the page, each conditionally rendered:

| Condition | Banner |
|---|---|
| `subscriptionStatus === "past_due"` | Red — payment failed, update card |
| `subscriptionStatus === "unpaid"` | Red — invoice unpaid, update card |
| `subscriptionStatus === "canceled"` and `cancelAtPeriodEnd === false` | Yellow — subscription has ended |
| `cancelAtPeriodEnd === true` | Yellow — cancels on `{currentPeriodEnd}` date |

These reflect the `subscription_status` and `cancel_at_period_end` fields from `GET /users/me`. Without these banners, users in a degraded billing state had no visible feedback.

---

##### Change plan dialog

A new `Dialog` (using the existing Radix-based component at `src/components/ui/dialog.tsx`) shows three plan options: Standard ($12/mo), Pro ($25/mo), Power ($100/mo).

Flow:
1. User clicks **"Change plan"** (shown when `hasActiveSubscription === true`) or **"Get a plan"** (no active subscription)
2. If active subscription → calls `PATCH /users/me/subscription` via `updateSubscriptionPlan(planType)`
   - If response has `checkout_url` (backend fallback) → `window.location.href = checkout_url`
   - If response has `status: "subscription updated"` → close dialog, show success toast, call `refreshUser()`
3. If no active subscription → calls `POST /users/me/checkout` via `createCheckoutSession(planType)` → redirect to `checkout_url`

The current plan is highlighted and disabled in the selector so users can't "change" to what they already have.

---

##### Cancel subscription flow

A separate **"Cancel plan"** button appears in the plan summary card only when:
- `hasActiveSubscription === true`
- `cancelAtPeriodEnd === false` (not already canceling)
- `subscriptionStatus === "active"`

Clicking it opens a confirmation `Dialog` showing the exact date the plan will remain active until (`currentPeriodEnd`). On confirm:

1. Calls `cancelSubscription()` → `DELETE /users/me/subscription`
2. On success → shows toast with period-end date, closes dialog, calls `refreshUser()`
3. On error → shows error toast with the backend's message
4. The `cancel_at_period_end` banner then appears automatically because `refreshUser()` updates the context

---

##### Payment methods list

Previously only showed `user.defaultPaymentMethod` (a single card). Now iterates over `user.paymentMethods[]` and renders each card with:
- Brand + last 4 digits
- Expiry date
- Funding type (credit/debit)
- **Default** badge for the `is_default` card

The "Manage Billing" button (Stripe portal redirect) only renders when `user.billingPortalUrl` is present — the API may or may not return this depending on the backend configuration.

---

##### Invoice status coloring

Previously all invoice status badges were green regardless of `invoice.paid`. Now:
- `paid === true` → green badge with checkmark
- `paid === false` → red badge

---

##### "Add more Usage" and "Get a plan" buttons

Both now route to `/onboarding/pricing` — the existing pricing page that handles Stripe Checkout for new subscriptions.

---

## How to Use

### As a user

1. **No plan** — the page shows "Get a plan" and "Add a plan" buttons that send you to the pricing page.
2. **Active plan** — "Change plan" opens the inline selector. Pick a plan and confirm. If you already have a subscription, it changes immediately. If not, you're sent to Stripe Checkout.
3. **Cancel** — "Cancel plan" is next to "Change plan". A confirmation dialog shows your last active date. The plan stays active until then; you won't be charged again.
4. **Bad billing state** — a banner at the top tells you what's wrong (past due, unpaid, canceled) and what to do.

### As a developer

**Triggering a user data refresh after any billing action:**

```ts
const { refreshUser } = useAuth();

// After any mutation that changes billing state:
await refreshUser();
```

**Adding a new billing action:**

1. Add the API call to `src/lib/api/user.ts` using `apiFetch` (handles auth headers and token refresh automatically).
2. In the page, call the function, handle both success and error with `toast.success` / `toast.error`.
3. Call `await refreshUser()` on success so the UI reflects the new state without a page reload.

**Stripe Checkout redirect pattern:**

```ts
const checkout = await createCheckoutSession(planType);
window.location.href = checkout.checkout_url;
// Stripe redirects back to STRIPE_SUCCESS_URL / STRIPE_CANCEL_URL after payment
// On the success page, call refreshUser() to get the updated plan state
// (webhook processing may take a moment — poll GET /users/me if needed)
```

**Plan change (existing subscriber):**

```ts
const result = await updateSubscriptionPlan(planType);
if ("checkout_url" in result) {
  // Backend had no active subscription — redirect to Stripe
  window.location.href = result.checkout_url;
} else {
  // Subscription updated in-place
  toast.success(`Now on ${result.new_plan} plan`);
  await refreshUser();
}
```

---

## API Endpoints Used

| Endpoint | Method | When |
|---|---|---|
| `/users/me` | GET | On app load (auth context) and after every billing action (`refreshUser`) |
| `/users/me/checkout` | POST | New subscription — no active plan |
| `/users/me/subscription` | PATCH | Plan change — active subscriber |
| `/users/me/subscription` | DELETE | Cancel subscription |

---

## What Is Not Handled Here

- **Stripe webhook delay** — after a successful Stripe Checkout redirect, the `checkout.session.completed` webhook may take a few seconds. The success page should poll `GET /users/me` until `plan_type` is non-null if immediate feedback is required.
- **Annual billing toggle** — the pricing page supports monthly/annual but the billing page plan selector only shows monthly prices. Annual plan changes via the billing page are not implemented.
- **Adding / replacing a payment method** — done via Stripe's hosted billing portal (`billingPortalUrl`). If the backend does not return a portal URL, there is no in-app card management flow.
