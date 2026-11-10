# Onboarding: System Design Audit

Scope: `app/(onboarding)` (layout and 17 step pages: setup, workspace, join, profile, invite, hello, account-type, tone, connectors, import, plans, pricing/confirmation, team/[inviteId] flow), `_components/onboarding-shell`, `step-shell` (432), `add-to-slack-modal`, `app/(app)/welcome`, `components/onboarding/WelcomeModal` (612), `context/onboarding-context.tsx`, `workspace-onboarding-context.tsx`, `team-invite-onboarding-context.tsx`, `lib/onboarding-access.ts`, `lib/api/user.ts` (`updateOnboarding`), `app/api/onboarding/logout`, `components/MetaPixel`, and the onboarding gate in `proxy.ts` (see Auth audit). About 6,300 lines.
Method: contexts, access logic, logout route, Meta Pixel, `updateOnboarding` read in full; pages checked by grep metrics. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~48% (13.5 / 28 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.8 | 60% |
| 2. Architecture | 8 | 3.9 | 49% |
| 3. Component Patterns | 2 | 1.0 | 50% |
| 4. Data Model | 6 | 2.4 | 40% |
| 5. Interfaces and APIs | 4 | 2.4 | 60% |
| 6. Optimizations | 5 | 2.0 | 40% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, virtualisation, optimistic updates.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Step as route / URL as state (#34) | Each step is its own route (`/onboarding/setup`, `/workspace`, `/profile`, `/invite`...); back/forward and deep links work |
| Shared shells (#12, #15) | `onboarding-shell` and `step-shell` give every step the same layout, progress and navigation |
| Route group layout | `(onboarding)/layout.tsx` mounts the providers once for all steps; team-invite flow has its own nested layout |
| Server-side gate | `proxy.ts` decides the next step (`determineNextOnboardingPath`) and blocks re-entry once onboarded, with exceptions for pricing return, team invite, Slack link, and post-checkout |
| Enum safety in API (#45) | `updateOnboarding` maps display values to backend enums, drops invalid `role_fit` values, and omits empty fields (no explicit nulls), each with a comment about the 422 it prevents; "Other" detail kept in user memory instead of the enum |
| Single derivation helper | `deriveRoleFit()` is the one place mapping account type and company size to `role_fit` |
| Monotonic onboarded check | `userMeRootAllowsMainApp` covers completed flag, metadata status and active paid subscription, with the bounded cache described in the Auth audit |
| Privacy awareness | `MetaPixel` is not mounted and carries an explicit `TODO(privacy)`, noting CSP also blocks it; SPA PageView re-emit logic is thought through |
| Invite deep links | `pending_invite_id` routes un-onboarded invitees to the team welcome step before workspace creation |
| Accessibility baseline (#20) | `aria-*` on most steps; `step-shell` has the most (5); WelcomeModal 9 |
| Analytics | Tracking on `plans` and `import` steps |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Two flows in the code | Old team-onboarding (`onboarding-context`: individual/team, account-type, tone, connectors, import, plans) and the v1.5 workspace flow (`workspace-onboarding-context`: setup, workspace, profile, invite) are both mounted; the layout comment says the old one remains "until cut over" | Remove the unused flow and its pages once v1.5 is confirmed; one context |
| Component architecture (#12) | `plans/page.tsx` 774 lines (11 `useState`, 4 `useEffect`), `WelcomeModal` 612, `import/page.tsx` 417, `team/[inviteId]/profile` 337 (9 `useState`) | Split pricing cards, billing toggle, checkout handler; step form hooks |
| State persistence (#32) | Wizard state lives only in React state (`useState` in the providers). A refresh, an accidental tab close, or the Auth0 round trip loses entered names, role, tone, invite emails (the gate then restarts at the right step but with empty fields) | Persist drafts per step in `sessionStorage` (via `storage-keys.ts`) or save progress to the backend after each step |
| Form state (#35) | Every step hand-rolls fields, validation and error text; no Zod/RHF; the invite step manages chips and a draft input by hand | RHF + Zod per step with schemas shared between steps and API payloads |
| Server state (#30) | Steps call `updateOnboarding`/profile APIs imperatively; the next route is decided by the proxy and client replace calls in parallel | One `useOnboardingProgress()` query (from `/users/me`) driving step guards; mutations invalidate it |
| Error boundaries (#19) | Layout-level only; a failing pricing fetch blocks onboarding | Boundary and retry state per step, plus a "skip for now" where allowed |
| Accessibility (#20) | `workspace/page.tsx` has 0 `aria-*`; focus management between steps and error announcements not evident (verify) | Move focus to the heading on step change, `aria-live` for errors, `aria-invalid` on fields |
| Observability (#55) | Funnel events only on two steps; no step viewed/completed/abandoned events | Typed events per step with enum ids to measure drop-off |
| Setter boilerplate | Context exposes one setter per field (12 of them) recreated each render | Single `update(key, value)` or reducer; memoise value |
| Style management (#16) | Inline style objects on some pages (verify) | Tokens/shared components |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Onboarding completion inferred from names | The proxy decides "profile done" from non-empty first/last name, which Auth0 can pre-fill with the email; the code flags it as pending confirmation | Backend `onboarding.profile_completed` flag |
| Hard-coded production URL in logout | `app/api/onboarding/logout` redirects to `https://getsouvenir.com` and builds the Auth0 logout URL by hand (`client_id!`, `domain` unchecked) and deletes `appSession` / `appSession.0-4` cookies manually | Use the SDK's logout route with `returnTo` from `APP_BASE_URL`/marketing URL env; validate env at startup |
| Meta Pixel ID hard-coded | `PIXEL_ID` constant in source and a TODO to gate on consent; if re-mounted it would load for all visitors including authenticated routes | Env-driven ID, consent gate before mounting, CSP update in the same change |
| Role enum mapping in client | `ROLE_API_MAP`/`TONE_API_MAP` plus a `VALID_ROLE_FIT` set duplicate backend enums; free text is silently dropped | Generate types from the OpenAPI spec (`scripts/split-openapi.mjs` exists) and share enums |
| Business rules in UI strings | Company size buckets differ per flow (`1-10 / 11-50 / 51-200 / 200+` vs `just_me / 1-5 / 5-10 / 10+`); `deriveRoleFit` maps only the old buckets | One size taxonomy; drop the old one with the old flow |
| Unvalidated responses | `/users/me`-style onboarding objects read through `Record<string, unknown>` and casts in `userMeRootAllowsMainApp` | Zod schema (shared with Auth) |
| Pricing/checkout cookie and sessionStorage | Confirmation page uses 5 storage references plus a `souvenir_checkout_complete` cookie to bypass the gate (see Auth audit) | A server-confirmed state from the backend after Stripe return |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | None for onboarding (only proxy gate tests exist): step guards, `deriveRoleFit`, `updateOnboarding` mapping (422 prevention cases), invite flow, refresh resilience |
| Code splitting (#46) | Lazy-load pricing/plans (Stripe), import step and Slack modal; confirm onboarding chunk stays small |
| `loading.tsx` / `error.tsx` | Per route group |
| Resume and progress UI | Progress indicator derived from the same step list the proxy uses; "resume where you left off" copy |
| Skip/Back consistency | Back goes to the correct screen-1 (`entryFlow`), verify all paths incl. refresh |
| Validation UX | Inline errors, disabled state while submitting, double-submit guard |
| Idempotency | Org/workspace creation (`workspace` step) should be safe on retry (verify the backend returns the existing org) |
| Core Web Vitals / budget (#8, #56) | First step must be fast for new signups; budget it |
| Consent handling | Cookie banner before any marketing pixel; record consent |
| Telemetry for failures | Capture 422/5xx with step id and enum reasons |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 48% → ~60%)
1. Tests for `deriveRoleFit`, `updateOnboarding` mapping, `userMeRootAllowsMainApp`, step guards. (+1.0)
2. Env-driven logout URL via the SDK route; remove manual cookie deletion; validate env. (+0.5)
3. Typed funnel events for step viewed/completed/failed. (+0.7)
4. Focus management and `aria-live` errors across steps. (+0.5)
5. Double-submit guards and inline validation messages. (+0.4)
6. `loading.tsx`/`error.tsx` for the route group. (+0.4)

### Phase 2: Remove duplication and persist state (M, → ~75%)
1. Retire the old team-onboarding flow and its context, pages and size taxonomy once v1.5 is confirmed. (+1.5)
2. Persist step drafts (sessionStorage via `storage-keys.ts`) or save per-step progress to the backend. (+1.0)
3. `useOnboardingProgress()` query from `/users/me` used by proxy and client guards; backend `profile_completed` flag. (+1.0)
4. Zod schema for the onboarding user shape shared with Auth; generated enums from OpenAPI. (+0.7)

### Phase 3: Forms and components (M, → ~90%)
1. RHF + Zod per step (names, role, tone, workspace, invite emails). (+1.5)
2. Split `plans/page.tsx`, `WelcomeModal`, `import/page.tsx` into sections and hooks, none above ~300 lines. (+1.0)
3. Reducer-based context with memoised value; lazy-load pricing/import/Slack modal. (+0.8)
4. Progress indicator sourced from the shared step list. (+0.3)

### Phase 4: Governance (S, → 100%)
1. Consent banner and gated marketing pixel with env ID and CSP. (+0.5)
2. Performance budget on the first onboarding step; Web Vitals. (+0.5)
3. Accessibility audit (axe plus screen reader) across steps. (+0.4)
4. Idempotency checks for workspace creation and checkout return. (+0.3)

Re-score after each phase and settle all "(verify)" items first.
