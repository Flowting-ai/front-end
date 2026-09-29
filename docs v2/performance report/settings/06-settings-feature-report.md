# Settings Feature — Detailed Report

**Scope:** account/workspace settings — 19 route files spanning personal settings (Account, Preferences, Security, Notifications, Files, Usage), workspace/org settings (General, Members, Plans & Billing, Usage, Analytics, Activity), and Help & Support. The largest single feature by page count of the six audited so far.

**How this was produced:** live, logged-in Playwright run across 8 representative settings pages, Lighthouse against 3 of them, and a static-analysis pass (`react-doctor`) filtered to this feature's files.

---

## 1. Pages in this feature

| Route | File | Purpose |
|---|---|---|
| `/settings` | `settings/(shell)/page.tsx` | Settings landing/index |
| `/settings/account` | `settings/(shell)/account/page.tsx` | Profile, avatar, personalization style |
| `/settings/preferences` | `settings/(shell)/preferences/page.tsx` | App preferences |
| `/settings/security` | `settings/(shell)/security/page.tsx` | Sign-in methods, security settings |
| `/settings/notifications` | `settings/(shell)/notifications/page.tsx` | Notification preferences |
| `/settings/files` | `settings/(shell)/files/page.tsx` | Files & Data |
| `/settings/usage` | `settings/(shell)/usage/page.tsx` | Personal usage stats |
| `/settings/help` | `settings/(shell)/help/page.tsx` | Help & Legal, report a bug, feature request |
| `/settings/(org)/general` | `settings/(shell)/(org)/general/page.tsx` | Workspace/org name, settings — **the single largest file in this feature** (findings reference lines past 750+) |
| `/settings/(org)/members` | `settings/(shell)/(org)/members/page.tsx` | Org member list/roles — findings reference lines past 1,100+, second-largest file |
| `/settings/(org)/plans` | `settings/(shell)/(org)/plans/page.tsx` | Org plan selection |
| `/settings/(org)/activity` | `settings/(shell)/(org)/activity/page.tsx` | Org activity log |
| `/settings/(org)/analytics` | `settings/(shell)/(org)/analytics/page.tsx` | Org analytics |
| `/settings/plans-and-billing` | `settings/(shell)/plans-and-billing/page.tsx` | Unified plan/billing view — findings reference lines past 1,500+, largest-behavior file in the feature |
| `/settings/billing/change-plan` | `settings/billing/change-plan/page.tsx` | Plan-change flow |
| Plus `/settings/billing`, `/settings/ai`, confirmation sub-routes for plans/billing | — | Legacy/alternate billing routes — worth confirming which of `billing`, `plans-and-billing`, and `(org)/plans` is the live one vs. deprecated (three separate billing-adjacent route trees exist) |

**Core components:** `SettingsSidebar.tsx` (nav shell, shared across every settings page), `SettingsSkeleton.tsx` (loading state).

**State/data layer:** `lib/api/billing.ts`, `lib/api/user.ts`.

---

## 2. All API calls used by this feature

Settings' API surface is spread across `USER_*`, `STRIPE_*`, and `ORG_*` endpoint groups in `config.ts` rather than a single `settings`-prefixed block:

| Endpoint | Method | Used for |
|---|---|---|
| `/users/me` | GET | Profile bootstrap (fired app-wide, not settings-specific) |
| `/users/me/onboarding` | — | Onboarding-state read/write |
| `/stripe/checkout` | POST | Start a Stripe checkout session |
| `/stripe/plan` | GET | Current plan |
| `/stripe/subscription` | GET | Subscription detail |
| `/stripe/subscription/resume` | POST | Resume a cancelled subscription |
| `/stripe/billing` | GET | Billing detail |
| `/stripe/invoices` | GET | Invoice history |
| `/stripe/usage` | GET | Usage-based billing data |
| `/stripe/portal` | GET | Stripe customer portal link |
| `/stripe/trial` | POST | Start a free trial |
| `/organizations/{id}/settings` | GET/POST | Workspace General settings |
| `/organizations/{id}/plan`, `/plan/pool-cap`, `/plan/usage` | GET | Org plan/usage data |
| `/organizations/{id}/pool-status` | GET | Credit pool status |
| `/organizations/{id}/audit` | GET | Activity/audit log |
| `/organizations/{id}/members`, `/members/{id}`, `/members/{id}/role` | GET/DELETE/POST | Member management |
| `/organizations/{id}/invites`, `/invites/{id}` | GET/POST/DELETE | Invite management |

Billing/plan data alone touches **11 distinct Stripe-proxied endpoints** — the most fragmented single sub-area of any feature's API surface audited so far.

---

## 3. Live functional test results

### 3.1 All 8 core pages tested — clean across the board
`/settings/account`, `/settings/preferences`, `/settings/security`, `/settings/notifications`, `/settings/files`, `/settings/plans-and-billing`, `/settings/help`, `/settings/usage` all loaded correctly, each with the correct page heading and no console errors beyond the recurring CSP/Facebook-pixel warning seen on every page across all six reports. **No 502s or backend errors encountered this pass** — the first feature audit in this series with a fully clean live run.

### 3.2 `/settings/account` — populated, real data
Confirmed via screenshot: Profile Picture / Change Avatar, First Name / Last Name fields (pre-filled), "Shown in team chats and persona attribution" hint text, Role (pre-filled from onboarding, correctly read-only-looking), Email address ("Used for billing and notifications"), Edit Profile button, and a "Personalisation → Style" section below ("Balanced" dropdown, "How the interface should feel"). Clean, correctly populated, no defects.

### 3.3 Navigation sidebar — well-organized
Left rail groups cleanly into PERSONAL (Account, Usage), WORKSPACE (General, Members, Plans & Billing, Usage), and HELP & SUPPORT (Help & Legal, Report a bug, Feature request) — consistent across every page tested, correct active-state highlighting observed.

---

## 4. Lighthouse performance report

Same dev-mode caveat as the other five reports.

| Metric | `/settings/account` | `/settings/plans-and-billing` | `/settings/(org)/members` |
|---|---|---|---|
| **Performance score** | 43 / 100 | **52 / 100** | 46 / 100 |
| Accessibility score | 88 / 100 | 87 / 100 | 89 / 100 |
| Best Practices score | 92 / 100 | 92 / 100 | 92 / 100 |
| SEO score | 100 / 100 | 100 / 100 | 100 / 100 |
| First Contentful Paint | 1.1 s | 1.1 s | 1.1 s |
| Largest Contentful Paint | 56.8 s ⚠️ dev-mode artifact | 57.7 s ⚠️ dev-mode artifact | 57.7 s ⚠️ dev-mode artifact |
| Total Blocking Time | 1,200 ms | 1,030 ms | 1,290 ms |
| Cumulative Layout Shift | **0.001** | **0.001** | **0.001** |
| Speed Index | 8.6 s | 3.4 s | 5.3 s |
| Time to Interactive | 57.4 s ⚠️ dev-mode artifact | 57.8 s ⚠️ dev-mode artifact | 57.8 s ⚠️ dev-mode artifact |
| Server response time (root doc) | 2,180 ms | 50 ms | 1,570 ms |

**This is the best-performing feature audited across two dimensions:**
- **Highest Performance scores of any feature (43-52/100)**, beating Brain/Tasks' previous best of 39-43.
- **Best Cumulative Layout Shift by a wide margin (0.001, essentially zero) on all three pages tested** — versus Chats' 0.495, Projects' 0.578, Brain/Tasks' 0.138. Settings pages are almost entirely static forms rather than streaming/animated content, which plausibly explains the difference — worth treating as a positive existence-proof that this codebase *can* produce layout-stable pages, not just a settings-specific quirk.

TBT is still elevated (1.0-1.3s) — real, not dev-mode noise — consistent with the React-Compiler-blocking findings below.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 26 files (12,760 LOC):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **934** | **43** |
| **Share of styling touchpoints** | **95.60%** | **4.40%** |

Consistent with all five prior reports — the codebase-wide ~96/4 ratio holds here too.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**108 findings** (46 Performance, 23 Bugs, 19 Maintainability, 18 Accessibility, 2 Security; 35 errors / 73 warnings). Second-highest error count of any feature audited (after Agents' 83), and the **highest error-to-finding ratio** (35/108 ≈ 32%, vs. e.g. Chats' 76/231 ≈ 33% — comparable, but notably front-loaded onto fewer, larger files).

### Highest-volume issues

| Count | Category/Severity | Rule | What it means | Where |
|---|---|---|---|---|
| 20 | Performance/error | React Compiler can't parse (`todo`) | Blocks auto-memoization | `(org)/general/page.tsx` (8×), `(org)/members/page.tsx` (2×) +10 more |
| 11 | Performance/warning | `set-state-in-effect` | Blocks React Compiler optimization | `(org)/general/page.tsx` (3×), `account/page.tsx`, `help/page.tsx`, `notifications/page.tsx`, `plans-and-billing/page.tsx`, `preferences/page.tsx`, `security/page.tsx`, `billing/change-plan/page.tsx` +1 |
| 10 | Maintainability/warning | `no-giant-component` | Too large to safely reason about | `(org)/general`, `(org)/members`, `account`, `files`, `plans-and-billing` (2×), `preferences`, `security`, `billing/change-plan`, `SettingsSidebar.tsx` — **9 of this feature's ~19 pages, plus the shared sidebar** |
| 7 | Maintainability/warning | `no-high-complexity-react-function` | High control-flow complexity | `analytics`, `(org)/general`, `account`, `plans-and-billing` (2×), `billing/change-plan`, `SettingsSidebar.tsx` |
| 4 | Bugs/error | `no-ref-current-in-render` | Ref mutated during render | `(org)/general/page.tsx` (2×), `account/page.tsx` (2×) |
| 4 | Performance/error | `refs` (React Compiler can't optimize) | Same ref-pattern issue | same 4 locations as above |
| 4 | Performance/warning | `rendering-hydration-no-flicker` | State sync flashes after paint | `help`, `notifications`, `preferences`, `security` — all 4 personal-settings pages share this exact pattern |
| 4 | Bugs/warning | `no-initialize-state` | State initialized from a mount effect | same 4 files as above — **paired findings, same root cause, same 4 files** |
| 4 | Accessibility/warning | `no-static-element-interactions` | Click handlers on non-interactive elements | `plans-and-billing/page.tsx` (3×), `preferences/page.tsx` |
| 4 | Accessibility/warning | `control-has-associated-label` | Control missing accessible label | `plans-and-billing`, `security`, `billing/change-plan` (2×) |

### Notable single/paired findings

- **2× `rules-of-hooks` (error) — hooks called conditionally**, both in `settings/files/page.tsx:437-438`. This is the **second** occurrence of this exact bug class across the audit series (first was `agents/page.tsx`, three separate lines). Worth a codebase-wide grep for conditional hook patterns rather than treating each as independent.
- **1× `no-unguarded-browser-global-in-render-or-hook-init`** (`SettingsSidebar.tsx:140`, **error**) — this makes **five** independent occurrences of this hydration-risk bug class across the audit (Chats' `chat/page.tsx`, Brain's `brain/page.tsx`, Projects' `chat/[chatId]/page.tsx`, and now here). At this point this is unambiguously worth a single codebase-wide fix pass, not five separate patches — it very likely traces back to one shared utility or one common copy-pasted guard pattern that's subtly wrong everywhere it's used.
- **2× `window.open` without `noopener`** (`plans-and-billing/page.tsx:610,1175`) — this is the **third and fourth** occurrence of this exact bug class (after Chats' `ConnectorPrompts.tsx` and Connectors' `useConnectorSetupFlow.ts`). Four independent instances now — strongly recommend a single `grep -rn "window.open("` pass across the whole codebase rather than continuing to discover these one feature at a time.
- **3× `prefer-html-dialog`**, all in `(org)/members/page.tsx` — same no-shared-Dialog-primitive pattern flagged in four prior reports (now confirmed in a 5th).
- **1× `no-fetch-response-used-without-status-check`** (`(org)/general/page.tsx:611`) — same pattern flagged once in the Agents report's `knowledge/page.tsx`.
- **1× `no-unstable-nested-components`** + **1× `no-nested-component-definition`** (paired findings, `SettingsSkeleton.tsx:422`) — a component defined inside another component, which recreates it (and loses its state) on every parent render.

Full file/line detail for all 108 findings is in the raw JSON generated this session (see §8).

---

## 7. Backlog — prioritized

**P0 — correctness**
1. `settings/files/page.tsx:437-438` — hooks called conditionally (error). Second codebase-wide occurrence of this bug class; fix alongside the Agents report's instance.
2. `SettingsSidebar.tsx:140` — unguarded browser-global read (error). This is the **fifth** confirmed instance of this hydration-risk pattern across the whole audit — by far the strongest "fix once, codebase-wide" candidate identified in this entire report series. Recommend this be the very first cross-cutting fix undertaken, before any feature-specific work, given its blast radius (it's in the shared settings shell, meaning every settings page inherits the risk) and its five independent confirmed occurrences elsewhere.
3. Confirm which of `settings/billing`, `settings/plans-and-billing`, and `settings/(org)/plans` is the canonical, currently-used billing route — three parallel route trees for what looks like one concern is either intentional (personal vs. org billing, legitimately separate) or leftover from a migration; worth a five-minute confirmation either way.

**P1 — performance**
4. 20× React-Compiler-blocking `todo` findings, 8 of them in `(org)/general/page.tsx` alone — the single biggest concentration in this feature.
5. 4× paired `rendering-hydration-no-flicker` / `no-initialize-state` findings, identical across `help`, `notifications`, `preferences`, and `security` pages — this reads as one shared pattern (likely a copy-pasted "load setting from API into local state via useEffect" idiom) reused across four files. Fixing the pattern once and reapplying should clear all 8 related findings (4+4) in one pass.

**P2 — maintainability**
6. **9 of this feature's ~19 route files, plus the shared `SettingsSidebar`, are flagged giant + high-complexity** — the highest raw count of "needs decomposition" files of any feature audited. Settings is the largest feature by page count, so raw counts are expected to be higher, but this is still the widest single blast radius for a maintainability push identified so far.
7. `plans-and-billing/page.tsx` is flagged as high-complexity at **two separate locations** (lines 468 and 1052) — meaning the giant-component detector found two distinct oversized regions within the same file, suggesting it may genuinely be doing two different jobs (plan display + billing management) that could be split.

**P3 — accessibility**
8. Same `prefer-html-dialog` gap as four other features, this time in `(org)/members/page.tsx` — sixth reinforcement of the shared-Dialog-primitive recommendation.
9. 4× missing accessible labels concentrated in the billing/plans area.

---

## 8. Cross-feature pattern check (now 6 features in)

The strongest, most-repeated finding across this entire report series, now confirmed:

- **`no-unguarded-browser-global-in-render-or-hook-init` — 5 independent occurrences** (Chats, Brain/Tasks, Projects, Settings, plus a related hydration-mismatch finding in Agents). This is no longer "a pattern worth watching" — it's the single highest-confidence, highest-value cross-cutting fix identified across all six feature reports. Recommend addressing this first, ahead of any per-feature backlog item.
- **`window.open` without `noopener` — 4 independent occurrences** (Chats, Connectors, and twice in Settings). Second-strongest cross-cutting candidate.
- **`prefer-html-dialog` (no shared Dialog primitive) — now confirmed in 5 of 6 features.**
- ~96% inline-style / ~4% Tailwind — holds in a 6th feature, unchanged.
- "Giant + high-complexity" on each feature's largest page(s) — holds again, most pronounced yet (9 files in this one feature alone).
- **New, positive signal:** Settings has both the best Lighthouse Performance scores (43-52) and by far the best CLS (0.001) of any feature — the first clearly positive comparative data point in this series, plausibly because these pages are mostly static forms rather than streaming/animated UI.

---

## 9. Artifacts backing this report

Raw data (screenshots of all 8 pages tested, Lighthouse JSON for 3 pages, full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.
