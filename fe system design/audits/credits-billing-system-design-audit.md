# Credits and Billing: System Design Audit

Scope: `lib/api/billing.ts` (386), `billing-schemas.ts` (126), `stripe.ts` (43), `lib/api/user.ts` (billing/checkout functions), `lib/credits.ts` (73), `hooks/use-credit-status.ts`, `use-workspace-credit-notice.ts`, `use-individual-plan.ts`, `lib/plan.ts`, `plan-tier.ts`, `plan-config.ts` (166), `format-credits.ts`, `model-usage.ts`; UI: `settings/(shell)/plans-and-billing` (1,663), `billing`, `usage` (274), `billing/confirmation`, `(standalone)/org/change-plan` (778), `onboarding/plans` (774), `onboarding/pricing/confirmation` (316), `CreditStatusBanner`, `ExhaustionBanner`, `InlineCreditNotice`, `CardBrandLogo`, `ContactSalesModal`. About 5,500 lines.
Method: credits logic, status hook, billing API head, façade, plan config and checkout-cookie usage read; large pages checked by grep metrics. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~46% (14.3 / 31 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 2 | 1.3 | 65% |
| 2. Architecture | 8 | 3.7 | 46% |
| 3. Component Patterns | 3 | 1.5 | 50% |
| 4. Data Model | 8 | 4.1 | 51% |
| 5. Interfaces and APIs | 5 | 2.8 | 56% |
| 6. Optimizations | 5 | 0.9 | 18% |

Not applicable: SSR, SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, virtualisation, cursor pagination, optimistic updates (money flows should not be optimistic).

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Runtime validation (#35) | `billing-schemas.ts` Zod schemas for usage, credit summary, trial, payment method, invoices, upcoming invoice, billing info; parsed in `Usage.parse`, `Billing.parse` |
| Domain classes | `Usage`, `CategorySpend`, `TeamsTier`, `PaymentMethod`, `Invoice`, `UpcomingInvoice`, `CreditSummary`, `Billing` wrap wire data; UI calls getters instead of raw fields |
| Pure, tested business logic | `creditsFromUsage`, `creditsFromBilling`, `deriveCreditStatus` are side-effect free; `credits.test.ts`, `use-credit-status.test.ts`, `plan.test.ts`, `billing.test.ts` exist |
| Single money conversion | `dollarsToCredits` (`Math.max(0, Math.round(usd * 1000))`) is the one place dollars become credits; avoids float drift in display |
| No card data in the app (#21) | Payment goes through server-created checkout sessions and the billing portal (`createCheckoutSession`, `openBillingPortal`, `setupEnterprisePayment` return URLs the browser redirects to); no card fields or Stripe.js in the codebase |
| Sentinel handling | `ENTERPRISE_INTERMAX` documented with an explicit rule to render "Unlimited" instead of ~2.15 trillion credits |
| Gating clarity | `useCreditStatus` documents who is gated (individual vs org pool), suppresses individual gating while the org is unresolved (avoids a wrong "you're out of credits" flash), and distinguishes `low` (≥90% used) from `exhausted` |
| Cross-app refresh | `notifyCreditsUpdated()` event lets any flow (top-up) refresh the profile so banners update without reload |
| Graduated UI | Separate `CreditStatusBanner`, `ExhaustionBanner`, `InlineCreditNotice` for warning, blocked, inline contexts; `use-workspace-credit-notice` for the org pool |
| Façade for callers | `stripe.ts` gives one import path for billing functions |
| Post-checkout reconciliation | After returning from checkout the page reloads billing at 1.2 s, 3 s, 6 s to catch the webhook delay |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | `plans-and-billing/page.tsx` 1,663 lines (21 `useState`, 8 `useEffect`); `change-plan` 778; `onboarding/plans` 774 | Split into plan cards, invoices table, payment method, usage, cancel/resume dialogs, with `useBilling()` |
| Three plan-picker UIs | Settings plans-and-billing, standalone `org/change-plan`, and onboarding `plans` each implement plan selection, checkout and confirmation separately (plus a `settings/billing/change-plan` route and two confirmation pages) | One `PlanPicker` and one `CheckoutReturn` component with variants |
| Server state (#30, #38) | Billing, usage and invoices loaded imperatively (`fetchBilling`, `Usage.fetch`) with local state; credits also live on the auth user, refreshed via a `window` event | React Query: `["billing"]`, `["usage"]`; `notifyCreditsUpdated` becomes invalidation; one credits source of truth |
| API layering | Three overlapping layers: `lib/api/billing.ts` (classes), `lib/api/user.ts` (`fetchBilling`, `updatePlan`, `createCheckoutSession`, `startTrial`...), and the `stripe.ts` re-export façade; `billingInfoSchema` lives in user.ts while schemas are in billing-schemas.ts | One module per domain: billing (classes plus actions), user (profile only) |
| Error handling (#45) | `setupEnterprisePayment` reads `response.json()` with no `ok` check shown (verify); actions return `Promise<string \| null>` for portal (null on failure loses the reason) | Throw typed `ApiError`; UI shows reason and retry |
| Accessibility (#20) | Plan grid, toggles (monthly/annual), billing tables need labels and live regions for payment status (aria counts: 4, 5, 1 on the three big pages) | Radio-group semantics for plans, announce success/failure |
| Error boundaries (#19) | Layout-level only; a failed invoice parse can blank billing | Boundary around each billing section |
| Observability (#55) | Few events (1 to 3 per page); none for checkout started/succeeded/failed, plan change, cancel/resume, top-up | Typed events with plan id and outcome |
| Plan constants (#12) | `PLAN_LIMITS`, `PLAN_CREDITS`, `PLAN_RANK` and checkout ids (`"50"`, `"100"`, ...) are hard-coded in the client | Serve from a backend plans endpoint, or generate from the OpenAPI spec; add a contract test |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Cookie flag decides a gate | `souvenir_checkout_complete=1` is set from page scripts (`max-age` 600 / 3600 s) and `proxy.ts` matches it by substring to skip the onboarding redirect; it is unsigned and script-settable (see Auth audit) | Server-confirmed state after Stripe return (backend webhook sets plan, gate reads `/users/me`); remove the cookie |
| Timed reloads for webhook lag | Fixed `setTimeout` list `[1200, 3000, 6000]` and then stops; a slow webhook leaves stale billing | Poll with backoff until `subscription_status` changes or a timeout, with a visible "confirming your payment" state (the connectors poll pattern) |
| Client hard-blocks | `blocked` in `deriveCreditStatus` stops usage in the UI; correct only if the backend enforces the same rule (stated elsewhere, verify) | Keep UI block as convenience; add a test that a backend 402/403 produces the same exhausted screen |
| Credits recomputed from heterogeneous shapes | `creditsFromUsage` branches on `trial`, `plan_credits`, `credits`, `topup_credits` with local casts (`UsageWithTrial`) and `spent_this_period` fallbacks, so several backend shapes feed one balance | Backend returns one `CreditBalance`; frontend only maps it |
| Unused server SDK | `stripe` ^21 (Node SDK) is listed in `package.json` dependencies but no source imports it (verify) | Remove; keep out of the client bundle |
| Currency and rounding | `USAGE_RATIO = 1/1.15` hard-coded markup constant in the client (`billing.ts`) | Backend-provided figures; remove client margin math |
| Plan name string checks | Other code (Files page) infers limits from `planName.includes('pro')` | Use plan ids and `plan-config` helpers only |
| Duplicate confirmation routes | `billing/confirmation`, `plans-and-billing/confirmation`, `org/plans/confirmation`, `(org)/plans/confirmation`, `onboarding/pricing/confirmation` | One confirmation route handling all sources via query |
| Contact sales modal | Own form handling (Formspree dependency elsewhere) with no shared form schema (verify) | RHF + Zod |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | Plan picker flows, checkout return reconciliation, cancel/resume, exhausted-state banners, invoice parse failures; contract tests for plan constants vs backend |
| Code splitting (#46, #48) | Lazy-load invoice table, payment method display (`CardBrandLogo` 199 lines of SVGs), contact-sales modal, change-plan flows |
| Loading/error routes | `loading.tsx`/`error.tsx` for billing; skeleton exists in settings |
| `useTransition` (#54) | Monthly/annual toggle recalculating plan prices |
| Idempotency | Disable buttons and send an idempotency key on checkout/plan-change/top-up to avoid double charges (verify) |
| Cross-tab sync | After checkout in another tab, refresh balances (`BroadcastChannel`/focus refetch) |
| Receipts and invoices | Download link states, empty state, pagination for invoices (verify) |
| Taxes and currency display | `Intl.NumberFormat` with currency from backend; `format-credits.ts` is 6 lines, check locale handling |
| Low-balance notifications | Email/in-app thresholds configurable (ties to Notifications settings, which are unwired) |
| Core Web Vitals / budget (#8, #56) | Budget for billing routes |
| Audit of third-party scripts | Ensure no analytics receive payment identifiers |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 46% → ~58%)
1. Replace fixed timed reloads with backoff polling until the plan changes, plus a "confirming payment" state. (+0.8)
2. Remove the unused `stripe` dependency (after verification) and the client `USAGE_RATIO` margin math. (+0.3)
3. Typed events for checkout started/succeeded/failed, plan change, cancel/resume, top-up. (+0.6)
4. Throw typed errors from `setupEnterprisePayment`/`openBillingPortal`; show reasons. (+0.5)
5. Idempotency keys and disabled-while-pending on all payment actions. (+0.5)
6. Tests for checkout return and exhausted/low banners. (+0.8)
7. Labels and live regions on plan picker and billing tables. (+0.5)

### Phase 2: Data layer and API shape (M, → ~74%)
1. React Query for billing, usage, invoices; replace `notifyCreditsUpdated` with invalidation; one credits source. (+1.8)
2. Consolidate API layers into one billing module; move `billingInfoSchema` beside the others. (+0.7)
3. Plans/limits/credits served by the backend (or generated) with a contract test. (+0.8)
4. Backend returns a single credit balance shape; delete branching in `creditsFromUsage`. (+0.5, backend request)
5. Server-confirmed checkout state; remove `souvenir_checkout_complete` cookie from the gate. (+0.7)

### Phase 3: Components (M-L, → ~90%)
1. One `PlanPicker` and one `CheckoutReturn` replacing three implementations and five confirmation routes. (+1.5)
2. Split `plans-and-billing/page.tsx` into sections with `useBilling()`, none above ~350 lines. (+1.2)
3. Lazy-load invoice table, card logos, dialogs, contact sales; `loading.tsx`/`error.tsx`. (+0.8)
4. Contact-sales form on RHF + Zod; `useTransition` for the billing-interval toggle. (+0.4)

### Phase 4: Governance (S, → 100%)
1. Performance budget and Web Vitals for billing routes. (+0.5)
2. Accessibility audit (axe plus screen reader) of plan picker and tables. (+0.4)
3. Cross-tab balance sync; invoice paging and download states. (+0.4)
4. Review third-party scripts for payment-data leakage; Locale-aware currency formatting. (+0.3)

Re-score after each phase and settle all "(verify)" items first.
