# Changelog & Backend Asks — Billing, Activity Log, Org Sidebar

**Date:** 2026-06-15
**Area:** Frontend (`front-end/`) — billing, org activity log, left sidebar org/admin section
**Status legend:** ✅ Done & verified · 🟡 Done, pending backend · 🔴 Blocked on backend · 📝 Docs/spec

---

## 0. TL;DR

| # | Workstream | What changed | Status |
|---|------------|--------------|--------|
| 1 | Billing credits parsing | Frontend re-aligned to the live `/stripe/billing` `credits` shape (scalar `used`, explicit `remaining`, `by_category`) | ✅ Done (FE) / 🔴 Backend grant fix needed |
| 2 | "Monthly Credits" number | Billing page now reads the plan **allowance** from the backend instead of a derived value | 🟡 FE done; correct number depends on backend grant |
| 3 | Org Activity Log | Fixed negative timestamps + show member/team **names** instead of auth IDs | ✅ Done |
| 4 | Org sidebar (404 + tabs) | Org badge now opens an in-place "admin" section (no 404 / no navigation); added `/settings/org` redirect | ✅ Done |
| 5 | Org sidebar contents | Restored all 3 admin groups (Organization / Company Data / Models) per the design-system story, wired each item | ✅ Done |

> **Single biggest backend dependency:** the `power` plan account is only provisioned ~$37.67 of credits and the backend does not expose the fixed monthly allowance. See [§6 What we need from backend](#6-what-we-need-from-backend).

---

## 1. Billing credits — response-shape drift fix

### Problem
The live `GET /stripe/billing` `credits` object had changed shape, and the frontend (types, normalizer, derivation, OpenAPI, tests) still expected the old shape.

**Live response (verified against `devapi.getsouvenir.com`):**
```json
"credits": {
  "total_credits": 37.674907,   // now = ALLOWANCE (plan + topup)
  "plan_credits":  37.674907,
  "topup_credits": 0.0,
  "used":          19.006275,   // now a SCALAR (= total_credits − remaining)
  "remaining":     18.668632,   // NEW explicit field
  "trial":         null,
  "by_category": { "chat": 10.885994, "persona": 8.211451, "brain": 4.288017 } // NEW (was `used`)
}
```

| Field | Old (code expected) | New (live backend) |
|-------|---------------------|--------------------|
| `used` | object `{chat,persona,brain}` | **scalar** number |
| `remaining` | — (didn't exist) | explicit number |
| `by_category` | — (didn't exist) | per-category object (replaces old `used`) |
| `total_credits` | the *remaining* balance | the *allowance* |

**Symptoms:** per-category usage breakdown on the Billing page rendered `0 / 0 / 0`; `creditsFromBilling` returned `used: 0, remaining: full`.

### How we fixed it (frontend)
| File | Change |
|------|--------|
| `src/lib/api/user.ts` | Widened `BillingCredits` (scalar-or-object `used`; added `remaining`, `by_category`). Updated `fetchBilling` normalizer to capture all three. |
| `src/lib/credits.ts` | `creditsFromBilling` now uses explicit `remaining` + scalar `used` with `total_credits` as allowance; **legacy reconstruction kept as fallback**. |
| `src/app/(app)/settings/billing/page.tsx` | Per-category now reads `by_category` (fallback to legacy `used` object). |
| `src/lib/credits.test.ts` | Added a current-shape test using the real live values; legacy test retained. 7/7 pass. |
| `docs/openapi/api_yaml/stripe.yaml`, `docs/openapi/openapi.yaml` | `CreditSummary` schema updated (`remaining`, scalar `used`, `by_category`). |

**Verification:** `vitest` 7/7 green; `tsc --noEmit` clean.

### ⚠️ Backend data inconsistency surfaced (not a FE bug)
Two different "used" values exist in the same payload:
- `billing.used` = **19,006** (drawdown = `total_credits − remaining`)
- `Σ by_category` = `spent_this_period` = **23,385** (period spend)

They differ by ~4,379 credits and only the period-spend basis has a per-category breakdown. `remaining` is consistent across endpoints; `total`/`used` are not. → **Backend to clarify which basis is canonical for the Billing page.**

---

## 2. "Monthly Credits" showing the wrong number (42,054)

### Problem
The Billing page "Monthly Credits" showed `42,054`, a **derived** value (`remaining + spent_this_period`) from `/users/me` — not the plan's fixed monthly allowance. Expected (per product): pro ($25) = 60,000; power ($100) = 300,000.

### Decision
**Backend is the authoritative source** for the plan allowance (avoids FE/BE divergence).

### How we fixed it (frontend)
| File | Change |
|------|--------|
| `src/app/(app)/settings/billing/page.tsx` | "Monthly Credits" now reads the allowance from `/stripe/billing` `total_credits` (billing endpoint authoritative), with `/users/me`-derived values as fallback only. |

> The FE is now a correct mirror of the backend. It will display `300,000` (power) / `60,000` (pro) **automatically once the backend grants and reports the right allowance** (see §6). Until then it shows the backend's current (under-provisioned) `total_credits`.

### Notes
- Dead FE table `src/lib/plan-config.ts` `PLAN_CREDITS` (starter 5k / pro 12k / power 60k) is **unused for display** and is exactly 5× smaller than the expected values — flagged for backend/product reconciliation, not wired to the UI.

---

## 3. Org Activity Log — `/settings/org/activity`

### Problems
1. Times rendered as **`-258m ago`** (negative) — backend sends naive-UTC timestamps (no `Z`); `new Date()` parsed them as local time, pushing them into the future.
2. Actor column showed raw **`auth0|…`** IDs instead of names.

### How we fixed it (frontend) — `src/app/(app)/settings/org/activity/page.tsx`
- **Time:** switched `relativeTime` to the existing `parseServerDate` helper (appends `Z` to tz-less datetimes); added `just now` guard and `m/h/d/mo/y` buckets; tooltip now shows a formatted local date.
- **Actor name:** built a `user_id → name` map from `org-context` `members` (fallback: email → shortened id). Full id preserved on hover.
- **Bonus:** target team UUIDs resolved to team names (via `teams`); action verbs humanized (`invite_sent` → "Invite sent").

**Verification:** `tsc --noEmit` clean. Live name-resolution not exercised (test token's account has no org); logic verified by trace.

### Backend (optional, not blocking)
- Consider returning the **actor's display name** (and target name) directly on audit entries so the UI doesn't depend on the org member list being loaded / containing removed members.

---

## 4. Org sidebar — 404 fix + in-place admin section

### Problems
1. Clicking the org-name badge pushed to `/settings/org`, which **404'd** (no index route — only sub-pages like `general`, `members`, …).
2. The badge should switch the sidebar to an in-place "admin" section (like Chats/Agents/Brain tabs), **not navigate away**.

### Root cause
The `Sidebar` component already supports an in-place `admin` body section, but `onOrganisationClick` *also* navigated to the missing route, and the admin section was never fed its nav items.

### How we fixed it (frontend)
| File | Change |
|------|--------|
| `src/components/layout/LeftSidebar.tsx` | Removed the `/settings/org` navigation from the org badge → it now just switches to the in-place `admin` body section. Wired `onAdminSectionClick`. |
| `src/app/(app)/settings/org/page.tsx` | **New** index page; redirects to `/settings/org/general` (defensive — any direct hit to `/settings/org` no longer 404s). |

**Gating unchanged:** badge interactive for org admins only (`showAdmin`); org settings layout still redirects non-admins.

---

## 5. Org sidebar — admin section contents (per Storybook story)

**Reference:** design-system story `organisms/sidebar → Org section` (`may-day` Storybook).

### What changed — `src/components/layout/LeftSidebar.tsx`
Restored all **three default groups** (matching the story); stopped overriding `adminGroups` so the component's canonical content is used. Wired behavior via `onAdminSectionClick`:

| Group | Items | Action |
|-------|-------|--------|
| **Organization** | General, Members, Teams, Plans & Usage, Analytics, Connectors, Security, Activity Log | → `/settings/org/*` (real pages) |
| **Company Data** | Connected Data, Tools | → `/settings/org/connectors` |
| **Company Data** | Folders, Websites, Triggers | `"… — coming soon"` toast |
| **Models** | Model Providers | → `/settings/ai` |

**Decision recorded:** "Route where possible, toast the rest" — no dead clicks, no speculative routing, nothing breaks.

**Verification:** `tsc --noEmit` clean.

### Backend / product (future)
- Company Data (Connected Data, Folders, Websites, Tools, Triggers) and Models (Model Providers) have **no pages/features yet**. They are currently routed to the closest existing surface or a "coming soon" toast. Build real destinations when those features exist, then update the route map.

---

## 6. What we need from backend

> Ordered by priority. Items 1–2 are **blocking** correct billing numbers.

### 🔴 P0 — Plan credit allowance (blocks §1, §2)
1. **Grant the correct monthly credits at period start.** The `power` account is provisioned only ~**$37.67** of credit value (`plan_credits: 37.674907`); the advertised allowance is ~**$300** (300,000 credits). After a fix, `remaining + used = total_credits` should reconcile against the full grant.
2. **Expose the fixed monthly allowance** in `plan_credits` / `total_credits` on `/stripe/billing`, independent of consumption, so the FE can display it directly. Expected (confirm): starter $12, pro $25 → 60,000, power $100 → 300,000 credits (1000 credits per $1).

### 🟡 P1 — Data semantics clarification (§1)
3. **Disambiguate "used".** Payload contains both `used` (drawdown = `total − remaining` = 19,006) and `Σ by_category` (period spend = 23,385). Confirm which is canonical for the Billing page and whether per-category should sum to it.
4. **Confirm the canonical plan→credits table** lives server-side as the single source of truth (the FE `PLAN_CREDITS` constant is stale / unused).

### 🟢 P2 — Nice-to-have
5. **Audit entries:** include actor (and target) **display names** so the Activity Log doesn't depend on the org member list (§3).
6. **Org admin features:** build pages/APIs for Company Data (Connected Data, Folders, Websites, Tools, Triggers) and Models (Model Providers); FE will switch those items from "coming soon" to real routes (§5).

---

## 7. Files touched (this session)

```
front-end/
├─ src/lib/api/user.ts                              (§1)
├─ src/lib/credits.ts                                (§1, §2)
├─ src/lib/credits.test.ts                           (§1)
├─ src/app/(app)/settings/billing/page.tsx           (§1, §2)
├─ src/app/(app)/settings/org/activity/page.tsx      (§3)
├─ src/app/(app)/settings/org/page.tsx   [NEW]        (§4)
├─ src/components/layout/LeftSidebar.tsx              (§4, §5)
├─ docs/openapi/api_yaml/stripe.yaml                  (§1)
└─ docs/openapi/openapi.yaml                          (§1)
```

## 8. Verification summary
- `npx tsc --noEmit` — **clean** across all changes.
- `npx vitest run src/lib/credits.test.ts` — **7/7 pass**.
- Live `/stripe/billing` + `/users/me` validated with a real token (account: `admin008@email.com`, `power`).
- Not live-exercised: org activity name-resolution and the org admin sidebar (test token's account has **no organization**); both verified by code trace + typecheck. Recommend a final click-through on an org-admin account.

## 9. Open questions for product/backend
- Which "used" basis should the Billing page present (drawdown vs period spend)? (§6.3)
- Final credit allowances per plan tier — confirm 60k / 300k etc. (§6.2)
- Roadmap/owners for Company Data + Models admin features. (§6.6)
```
