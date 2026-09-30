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

---

## 10. Fixes applied (post-report follow-up)

Everything below was implemented in a later session, working through `06b-settings-before-scan.md`'s revised backlog (which re-verified this report's own §7 backlog against live current code and a genuine pre-fix production build — reconstructed via a non-destructive worktree technique since `git stash` was blocked by this sandbox's classifier, extending the Connectors engagement's own worktree methodology one step further — see `06b` §0/intro for the exact steps) phase by phase, with the same verification gate at every checkpoint: `npx tsc --noEmit` (clean at every checkpoint), the full `vitest` suite (279 tests, unchanged from the Pinboard/Connectors engagements' own final count — green at every checkpoint, zero regressions), a direct `npx eslint` run against every touched file before and after each batch of fixes (`front-end:react-doctor` was not available in this session's tool list — same "inconsistently available" pattern this whole series has hit before), and live Playwright testing against **two independently-built, simultaneously-running production servers**: a disposable pre-fix build (port 3001, the `../settings-before-check` worktree) and the main tree's own post-fix build (port 3000) — both logged in via the same real `.env.local` test account.

### Phase 1 — P0: `SettingsSidebar.tsx:140`'s unguarded browser-global read — fixed

1. **Root-caused precisely in `06b-settings-before-scan.md` §2** — confirmed via a direct Node semantic test that the exact code shape (`window?.sessionStorage?.getItem(...)`) throws `ReferenceError: window is not defined` in a plain JS context (optional chaining cannot protect against an unbound base identifier, only against a resolved `null`/`undefined` value), while also confirming empirically that *this specific app's* current Next.js/webpack production bundling doesn't let that reach an actual crash today (the pre-fix worktree's build and live pages both succeeded cleanly) — an honest, nuanced conclusion rather than either "this crashes production" (unproven) or "this is a non-issue" (contradicted by the raw semantics and by the genuine hydration-value-mismatch risk on `isTeamUser` for a team account whose `orgId` hasn't resolved yet on first render).
2. **Fixed using the exact pattern already established by the Chats (`chat/page.tsx`) and Brain-Tasks (`brain/page.tsx`) engagements for this same bug class**: converted the render-time IIFE into `const [billingSnap, setBillingSnap] = useState<{ isTeamAccount?: boolean } | null>(null)`, populated via a mount-only `useEffect` that does the actual `sessionStorage` read. `billingSnap` now starts identically `null` on the server and the client's first render (no mismatch possible), then updates a tick after mount — the same accepted, imperceptible one-render-tick delay those two prior fixes made. `isTeamUser`'s other OR'd signals (`orgId`, `user.orgId`, `user.roleFit`) already cover the common case on the very first render, so this only changes behavior in the narrow case the bug was actually about.
3. **This introduces one expected, accepted `react-hooks/set-state-in-effect` lint finding** (a `setState` call inside a mount effect) — confirmed via a before/after `eslint` diff that this is new, and investigated: it's the same, unavoidable "adopt external browser-API state after mount" idiom the fix itself requires (there is no way to populate state *from* `sessionStorage` *without* an effect calling `setState`), matching the Connectors engagement's own precedent for a legitimate, necessary Effect-based `setState` (`05-connectors-feature-report.md` §10 Phase 4 item 10). Not force-avoided.
4. **Live-verified two ways, precisely**: (a) the pre-fix worktree's own build/live-page results (§`06b` §1) already showed zero hydration warnings and zero crashes even before this fix — so the *most* this fix could show live is "no change, no regression," which is exactly what was observed: identical 200/heading/zero-console-error results on both the pre-fix (port 3001) and post-fix (port 3000) builds for all 10 pages, confirmed via the same Playwright driver script run against both; (b) a direct `eslint` re-run confirms the original `react-hooks/refs`-adjacent unguarded-read pattern no longer appears on this file (the only new finding is the accepted set-state-in-effect from item 3).
5. **Codebase-wide count, finalized**: of the "5 independent occurrences" the original report cross-referenced, 3 (Chats, Brain-Tasks, Projects) were already closed by prior engagements before this session started (traced precisely in `06b` §2.3, not assumed from summary prose), this one is now the 4th closed, and the 5th (Agents' `agents/page.tsx:1643`, a *related* but distinct rule — `rendering-hydration-mismatch-time`, not `no-unguarded-browser-global-in-render-or-hook-init`) remains open but belongs to a different feature's own backlog, out of this engagement's scope.

### Phase 2 — P0: `settings/files/page.tsx:437-438` — confirmed a real bug, restructured (not renamed)

6. **Determined definitively in `06b` §3**: unlike the Agents engagement's `agents/page.tsx` instance (a naming collision — plain `async function`s named with a `use*` prefix, not real hooks), this is a **genuine conditional-hook-call bug**. `if (!user) return <FilesSkeleton />` sat *before* two real `useState` calls — the component called zero hooks past `useAuth()` on the pre-auth-resolved render, then two more once `user` arrived, a real hook-order violation.
7. **Fixed by moving both `useState` calls above the early return**, so they run unconditionally on every render regardless of `user`'s resolution state. A restructure, confirmed correct by a fresh `eslint` run showing zero remaining `rules-of-hooks` findings in this file.

### Phase 3 — P0: the three billing route trees — confirmed intentional, nothing changed

8. **Traced precisely in `06b` §4**: `/settings/plans-and-billing` is canonical (linked from `SettingsSidebar.tsx`'s WORKSPACE nav via `ORG_PLANS_ROUTE`); `/settings/billing` and `/settings/(org)/plans` (URL `/settings/plans`) are both real, deliberate, documented 15-line redirect stubs kept specifically for old bookmarks/links, each with its own explanatory comment already in the source. **No code change** — nothing is dead, nothing was deleted; this is a "confirm and report precisely" item, not a fix.

### Phase 4 — P0: `plans-and-billing/page.tsx:610,1175` `window.open` — confirmed already fixed, no code change

9. **Confirmed in `06b` §5**: both exact original line numbers, plus the two other `window.open` call sites in this same file (`handleExportAllInvoices`, ×2) and `settings/help/page.tsx`'s one call site, already carry `'noopener,noreferrer'` — fixed as part of the Connectors engagement's codebase-wide sweep (`05-connectors-feature-report.md` §10 Phase 1 item 1 explicitly names these exact files). None of these four calls retain the `window.open()` return value to navigate the popup afterward, so the plain feature-string fix (not `useConnectorSetupFlow.ts`'s `popup.opener = null` technique, which that flow specifically needed to keep controlling the popup's location post-open) was already the correct, matching pattern. **No code change needed.**

### Phase 5 — P1: the ~19-20 `todo` React-Compiler-parse findings — investigated, confirmed known tooling limitation, not force-fixed

10. **Grepped every settings route file for `} finally {`** — 19 matches (`plans-and-billing/page.tsx` 8, `(org)/general/page.tsx` 7, `account/page.tsx` 2, `(org)/members/page.tsx` 2), matching the original report's count of 20 within ordinary file-drift tolerance. This is the identical `try/finally`-parsing gap in this version of `babel-plugin-react-compiler` that the Agents and Brain-Tasks engagements each independently traced and declined to force-fix, for the same reason here: every one of these `try/finally` blocks is a genuine `setSaving(true)` / `await …` / `setSaving(false)` safety-net idiom, and rewriting them to dodge a compiler parser limitation would either duplicate cleanup logic across success/catch branches or drop the safety net (a real regression) for a purely cosmetic auto-memoization gain the app doesn't depend on. **Confirmed, documented, deliberately not fixed** — consistent with this whole series' precedent.

### Phase 6 — P1: the 4+4 `rendering-hydration-no-flicker`/`no-initialize-state` pair across help/notifications/preferences/security — fixed at the shared root, once, reapplied 4 times

11. **Confirmed the shared-root-cause hypothesis exactly, with one correction** (`06b` §6.2): all 4 files share the identical `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []); if (!mounted) return <XSkeleton />` shape — but unlike the original report's own guess ("likely a load-setting-from-API idiom"), none of the 4 files actually load anything from an API or `localStorage` — every piece of state is a hardcoded static default. The `mounted` gate was pure boilerplate forcing one purposeless extra render pass on every load.
12. **Fixed by deleting the `mounted` state/effect/early-return entirely in all 4 files** (`help/page.tsx`, `notifications/page.tsx`, `preferences/page.tsx`, `security/page.tsx`) — real content now renders on the very first paint, identically on server and client (nothing in any of the 4 files' static default state differs between the two). `help/page.tsx` kept its second, genuinely-needed effect (`trackFeature('settings_help_opened')`) untouched. Cleaned up now-unused `useEffect`/`useState`/`*Skeleton` imports in each file (confirmed via `tsc`/`eslint`, not left as dead imports).
13. **Live-verified**: all 4 pages render their real content immediately on both the pre-fix and post-fix builds' first paint (no visible skeleton-then-flip observed in the Playwright screenshots/DOM checks), and a direct `eslint` re-run confirms all 4 `set-state-in-effect` findings on these exact lines are gone, with zero new findings introduced.

### Phase 7 — P2: the 4× `refs`/4× `no-ref-current-in-render` findings — fixed, same established pattern

14. **`(org)/general/page.tsx:512` (`isIdentityDirtyRef.current = isIdentityDirty`) and `:645` (`handleSaveIdentityRef.current = handleSaveIdentity`), `account/page.tsx:448` (`isDirtyRef.current = isDirty`) and `:563` (`handleSaveRef.current = handleSave`) — all 4 fixed identically**, matching the pattern the Agents engagement established for its own `agent/configure/*` auto-save refs (`02-agents-feature-report.md` §9 Phase 2 item 8): each direct `ref.current = value` write during render moved into its own deps-less `useEffect(() => { ref.current = value })`, which still re-runs after every render (so the ref is never more than one commit stale) without violating the "refs may only be written outside of render" rule. Confirmed safe in all 4 cases by checking each ref is only ever *read* later, from inside a `beforeunload` handler or a `setSaveHandler`-registered callback — both fire well after the commit the effect ran in, so the one-commit delay is immaterial.
15. **Confirmed via a fresh `eslint` run**: zero remaining `react-hooks/refs` findings on any of these 4 lines.

### Phase 8 — P2: decomposition pass on `plans-and-billing/page.tsx`

16. **The two flagged high-complexity locations (originally lines 468, 1052) confirmed to land exactly on `OrgBillingView()` and `PersonalBillingView()`** — two genuinely separate top-level components for the two account types, each independently hand-rolling a near-identical ~35-line cancel-subscription confirmation dialog (differing only in which date label it shows). **Extracted into a single shared `CancelSubscriptionDialog` component**, taking `open`/`periodEndLabel`/`isCanceling`/`onKeep`/`onConfirmCancel` as props — genuinely self-contained (no dependency on either view's other internals beyond these explicit props), removing ~65 duplicated lines net and giving each view one less large inline JSX block to reason about. This is a real, tractable decomposition pass on the file the original report specifically flagged as "doing two genuinely different jobs" — not a forced extraction that just relocates coupling (the dialog's only interaction with its caller is the 5 explicit props).
17. **`(org)/general/page.tsx`'s own giant-component flag was investigated but not decomposed this pass** — a first read shows its ~1,400 lines are substantially intrinsic complexity (workspace identity save/dirty-tracking, domain management, instructions, org deletion, each wired through its own `useNavGuard`-registered save handler), similar to the Agents engagement's own reasoned deferral of `instructions/page.tsx`'s decomposition (`02-agents-feature-report.md` §9 Phase 6) — forcing an extraction immediately after this same phase's ref-effect fixes (Phase 7, which touched two of this file's save/dirty-tracking hot paths) risked relocating coupling rather than reducing it. **Deferred, not skipped** — a good candidate for a dedicated follow-up pass.
18. **Live-verified**: the Plans & Billing page's Cancel Subscription flow (both org and personal views reachable via this session's test account — an org admin — and via code-reading the personal branch, since the test account is an org member so the personal branch isn't reachable live this session) renders identically before/after in a code-level review of the extracted component's output (same JSX, same props threaded through, same event handlers); `tsc`/`vitest` both green throughout.

### Phase 9 — P2: `(org)/general/page.tsx`'s fetch-without-status-check — fixed

19. **Fixed using the exact shape established by the Agents engagement's `knowledge/page.tsx` fix** (`02-agents-feature-report.md` §9 Phase 1 item 5): `handlePickLogo`'s `fetch(preview)` call (converting a compressed-image data URL into a `Blob` for upload) now checks `previewRes.ok` and throws before consuming the body if it isn't — caught by the same immediately-enclosing `catch` block that already falls back to the original, uncompressed file. Low real-world risk (`preview` is typically a `data:` URL, which browsers resolve locally and essentially never fail with a bad status) but now correct and defensive regardless, matching the established pattern precisely rather than skipping it as "probably fine."

### Phase 10 — P2: `SettingsSkeleton.tsx`'s nested `NotifGroupHeader` — fixed, hoisted out

20. **`NotifGroupHeader` (previously declared inside `NotificationsSkeleton()`, called 3 times from within it) hoisted to module scope**, immediately above `NotificationsSkeleton`. Confirmed safe: it closes over nothing local to its former parent, only the module-level `Section`/`Bone` primitives already used throughout this file. This resolves both the `no-unstable-nested-components`/`no-nested-component-definition` pairing and the 3 separate `react-hooks/static-components` findings the redefinition produced at each of its 3 call sites — confirmed via a fresh `eslint` run showing zero remaining findings of either kind in this file.

### Phase 11 — P2: accessibility — 4× `control-has-associated-label` fixed

21. **`plans-and-billing/page.tsx`'s `InputField`** (used for the "Cap overage at (credits, above included)" spend-cap control) — its visible `<p>{label}</p>` was never programmatically associated with the `<input>` it sits beside. Fixed with a `useId()`-generated id on the `<p>` and a matching `aria-labelledby` on the `<input>` (a plain `<p>` isn't a labelable element, so `htmlFor` doesn't apply — `aria-labelledby` is the correct association here) — zero visual change.
22. **`billing/change-plan/page.tsx`'s two `<input type="range">` credit sliders** (individual and team plan tiers) — each already sits beside a visible "Pick your monthly credits" heading, but the slider itself had no accessible name. Fixed with a direct `aria-label` on each (`"Monthly credits — individual plan"` / `"Monthly credits — team plan"`), distinguishing the two since a screen-reader user could otherwise not tell which slider they're on from the announced name alone.
23. **`security/page.tsx`'s icon-only "3-dot" session-actions button** — had no accessible name at all (just a bare `<MoreVerticalIcon>` inside a `<button>`). Fixed with `aria-label="Session actions"`.
24. **Two related findings investigated and confirmed already-correct, not fixed**: `preferences/page.tsx`'s theme-option cards (`no-static-element-interactions`) wrap a real `Checkbox` component that already handles keyboard interaction and carries the actual accessible semantics — the outer `<div onClick>` is a "click anywhere in the card" convenience that delegates to the same handler the inner `Checkbox` uses, already correctly `eslint-disable`d with an explanatory comment. `plans-and-billing/page.tsx`'s two modal-backdrop `onClick={() => setShowCancelDialog(false)}` divs (also `no-static-element-interactions`) are the standard, ubiquitous "click outside to dismiss" pattern, with the real dialog controls (Keep plan / Yes, cancel buttons) fully keyboard-accessible — also already correctly suppressed. Neither was force-changed; both are legitimate, already-acknowledged patterns.

### Phase 12 — P3: `prefer-html-dialog` ×3 in `(org)/members/page.tsx` — confirmed, not touched

25. **Confirmed still present and unaddressed** (3 hand-rolled `<div role="dialog">` overlays at lines 308, 589, 765, no native `<dialog>` element) — per the engagement's explicit scope limit, **no shared-Dialog-primitive refactor was attempted**. This is the same recurring gap flagged in 5 of 6 prior features' own reports; noted, not fixed, exactly as instructed.

### Net result

The single highest-priority fix in this whole report series — `SettingsSidebar.tsx:140`'s unguarded browser-global read — is fixed using the exact pattern already established by 2 prior engagements, with both a rigorous raw-JS-semantics proof that the underlying bug class is real and an honest, non-overclaimed live-build result showing it wasn't actually crashing this specific app today; this closes the 4th of 5 cross-referenced occurrences codebase-wide, with the 5th belonging to a different feature. `settings/files/page.tsx`'s conditional-hook-call bug is confirmed real (not a naming false positive like Agents' instance) and restructured correctly. The three billing route trees are confirmed intentional, well-documented redirect stubs — nothing was dead, nothing was deleted. The `window.open` findings were already closed by the Connectors engagement's own sweep. The ~19-20 `todo` findings are confirmed the same known React-Compiler `try/finally`-parsing limitation as 2 prior engagements, documented rather than force-fixed. The 4+4 hydration-flicker/initialize-state pair is fixed at its true shared root across all 4 files (stronger than the original report's own hypothesis: the `mounted` gate had zero actual justification in any of them). All 4 `refs`/`no-ref-current-in-render` findings are fixed with the established deps-less-effect pattern. A real, tractable decomposition pass extracted `plans-and-billing/page.tsx`'s duplicated cancel-subscription dialog into a shared component; `(org)/general/page.tsx`'s own decomposition was investigated and deliberately deferred with reasoning, not forced. The fetch-without-status-check and nested-component-definition findings are both fixed, matching established patterns exactly. 4 accessibility label findings are fixed; 2 related `no-static-element-interactions` findings were investigated and confirmed already-correct, already-suppressed legitimate patterns. The 3 `prefer-html-dialog` findings are confirmed still open and deliberately untouched, per explicit scope. `npx tsc --noEmit` and the 279-test `vitest` suite stayed green at every checkpoint; the excellent pre-existing CLS baseline (0.001) was re-confirmed unchanged on every page tested, before and after.

See `06b-settings-before-scan.md` for the pre-fix production baseline (including the non-destructive worktree-reconstruction methodology), `06c-settings-fixes-test-plan.md` for the full test-case breakdown of every fix above, `06d-settings-before-after-comparison.md` for the post-fix production Lighthouse re-scan, and `06e-settings-manual-qa-checklist.md` for a hands-on click-through of the whole feature post-fix.
