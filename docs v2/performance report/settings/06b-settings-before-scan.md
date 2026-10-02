# Settings — Before-Fix Production Scan

Companion to `06-settings-feature-report.md`. This is a from-scratch, live, logged-in pass against a genuine **pre-fix production build**, run before any of this engagement's code changes, to re-verify the original report's backlog against current reality and establish an honest baseline for the `06d` after-comparison.

**Methodology note (read this first):** by the time this engagement started, the working tree already had this session's own Settings edits applied (made before this document was written, per the engagement's own checkpoint-discipline instructions). `git stash` was blocked by this sandbox's destructive-action classifier — same as the Connectors engagement hit — so a **non-destructive worktree reconstruction** was used instead, extending the Connectors engagement's own `git worktree add --detach HEAD` technique one step further:

1. `git worktree add --detach ../settings-before-check HEAD` — a fresh, disposable checkout at the last commit (additive, never touches the main tree).
2. `git diff HEAD -- . ':(exclude)src/app/(app)/settings' ':(exclude)src/components/layout/SettingsSidebar.tsx' > other-uncommitted.patch` followed by `git apply` inside the new worktree — this reconstructs **every other already-uncommitted change currently sitting in the main tree** (the bundle-size fix, the completed Pinboard engagement, the completed Connectors engagement) *except* this session's own Settings edits, which is exactly the "before" state this scan needs: current reality minus only the fixes this pass is about to make, not a stale snapshot from whenever the main branch was last committed.
3. A handful of genuinely new (untracked) files the other engagements added (`src/components/HighlightCard/colors.ts`, `src/components/Pinboard/constants.ts`, `src/components/Pinboard/enter-animation-defaults.ts`, `src/components/chat/LazyPresetModelSelectorDialog.tsx`, `src/hooks/use-brain-home-digest.ts`, `src/lib/export-pins.test.ts`, `src/types/hugeicons-core-free-icons.d.ts`) aren't part of a tracked-file diff, so they were copied over individually (confirmed via `git status --porcelain`'s `??` list — no overlap with Settings).
4. `node_modules` was shared via a Windows directory junction (`mklink /J`) rather than a fresh `npm install`, and `.env.local`/`.env.production.local` were copied over (the latter — not tracked by git — already held real secrets from a prior session's `load-secrets` run, needed for Auth0 to work in `next start` production mode).
5. `npm run build` in the new worktree — succeeded clean, confirming the pre-fix code compiles and static-prerenders correctly (see §2 for why this specific result matters).

This produced a genuine second production server (port 3001, pre-fix) running side-by-side with the main tree's own post-fix build (port 3000), both logged in via the same real `.env.local` test account, for true apples-to-apples before/after testing — not a reconstruction from memory or a guess.

---

## 1. Live functional re-test — all 10 pages, pre-fix build

Re-tested the original report's 8 pages plus both org pages (`/settings/general`, `/settings/members`) against the pre-fix production build (port 3001), via a headless Playwright/`playwright-core` driver script doing a real Auth0 identifier-then-password login (`.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`), then a fresh `page.goto()` to each URL (a genuine hard navigation, not a client-side transition — the meaningful case for hydration-mismatch risk).

| Path | HTTP status | Heading rendered | Console errors | Failed requests (4xx/5xx) | Hydration warning |
|---|---|---|---|---|---|
| `/settings/account` | 200 | "Account" | 1 | 0 | No |
| `/settings/preferences` | 200 | "Preferences" | 1 | 0 | No |
| `/settings/security` | 200 | "Security" | 1 | 0 | No |
| `/settings/notifications` | 200 | "Notifications" | 1 | 0 | No |
| `/settings/files` | 200 | "Files & Data" | 1 | 0 | No |
| `/settings/plans-and-billing` | 200 | "Plan & Billing" | 1 | 0 | No |
| `/settings/help` | 200 | "Help & Legal" | 1 | 0 | No |
| `/settings/usage` | 200 | "Usage" | 1 | 0 | No |
| `/settings/general` (org) | 200 | "General" | 1 | 0 | No |
| `/settings/members` (org) | 200 | "Members" | 1 | 0 | No |

**The test account has real org/admin access** — `/settings/general` and `/settings/members` both rendered their real admin content (not a permission-denied placeholder), confirming the original report's own live coverage of these pages is reproducible this session too.

**The "1 console error per page" is the same recurring CSP/Facebook-pixel warning documented on every page of every feature in this entire audit series** (`Loading the script 'https://connect.facebook.net/en_US/fbevents.js' violates the following Content Security Policy directive...`) — confirmed by inspecting the actual error text on all 10 pages, not assumed. **Zero hydration-mismatch warnings, zero 502s, zero other backend errors** — the original report's "first fully clean live run in the series" finding **still holds on a genuine pre-fix build**, re-verified live this session, not just carried forward from the original report's prose.

---

## 2. `SettingsSidebar.tsx:140` — the headline P0 fix, traced precisely

### 2.1 Exact current (pre-fix) code

```tsx
const billingSnap = (() => {
  try { const r = window?.sessionStorage?.getItem('kaya:billing:snapshot:v2'); return r ? JSON.parse(r) : null } catch { return null }
})()
const isTeamUser = Boolean(
  orgId ||
  user?.orgId ||
  user?.roleFit === 'small_team' ||
  user?.roleFit === 'large_team' ||
  billingSnap?.isTeamAccount
)
```

This is an IIFE evaluated **unconditionally on every render**, including the server/hook-init render — not gated behind `useEffect`, `useState`'s lazy initializer executed only once, or any `typeof window` guard. `billingSnap` feeds `isTeamUser`, which feeds `planLabel`/`planWarning`/`planTypeLabel`/`accountCredits` — all of which affect what's actually painted (the workspace name row, the "Free Plan" tag, the credit count in the bottom `AccountMenu`).

### 2.2 Is this a crash, or "just" a hydration mismatch? — tested both ways, precisely

**(a) Raw JavaScript semantics, confirmed empirically in plain Node** (no Next.js involved — this isolates whether the *language construct itself* is safe):

```
$ node -e "try { const r = window?.sessionStorage?.getItem('x'); console.log('NO THROW', r); } catch (e) { console.log('THREW:', e.constructor.name, e.message); }"
THREW: ReferenceError window is not defined
```

This is not a guess — optional chaining (`?.`) only short-circuits once the **base expression has already resolved to `null`/`undefined`**; it cannot protect against the base identifier itself being unbound. `window` is not "a variable holding `undefined`" in a Node context — it's an undeclared identifier — so referencing it bare, even before any `?.`, throws `ReferenceError` immediately. This confirms the `no-unguarded-browser-global-in-render-or-hook-init` finding is a real, correctly-flagged bug class, not a lint nitpick: the exact code shape here **would** crash the render pass outright in any plain server-side React render (e.g. a unit test using `renderToString` directly, or a different bundler/runtime than this app's current one).

**(b) Whether it actually crashes in *this app's* real Next.js production build — tested directly, not assumed:** the pre-fix worktree's `npm run build` (§ intro, step 5) completed with `[exited with code 0]`, and Next.js's own route summary marks every settings route `○ (Static) prerendered as static content` — meaning `SettingsSidebar` (part of every settings page's shared layout) **was** executed server-side during the build, and did not throw. The live pre-fix smoke test (§1) confirms the same thing at request time: all 10 pages return 200 with correct headings, zero hydration warnings.

**Honest conclusion:** this specific Next.js/webpack production bundling apparently doesn't let a bare `window` reference reach a true `ReferenceError` at runtime (likely a webpack `DefinePlugin`-style substitution for the server chunk, though this session didn't trace webpack's exact internals to confirm which mechanism) — so in *this* app, *today*, the bug manifests as a **latent risk**, not a live crash: nothing this session observed suggests users are currently seeing a 500 because of this line. That said, it is unambiguously the exact bug class the rule exists to catch, for two independent reasons that don't depend on today's particular bundler behavior: (1) it's one dependency-chain change away from a real crash (a different Next.js version, a different bundler, a stricter SSR test harness, or Server Actions/Edge runtime — none of which are guaranteed to provide the same incidental `window` handling), and (2) even without a crash, `billingSnap` genuinely can differ between the server's evaluation and the client's first (hydration) render **in the one case that matters**: a team account whose `orgId` hasn't resolved yet on the very first render, where `sessionStorage`'s cached flag is the only signal available — server always sees `null` (no browser at all), client's first render might already see a real cached value, a genuine hydration-value mismatch on the `isTeamUser`-derived UI. This is fixed at the root in `06-settings-feature-report.md` §10 Phase 1.

### 2.3 Codebase-wide count — how many of the "5 independent occurrences" are still open

Traced each of the other four instances the original report's own cross-reference named, reading each prior engagement's fix log directly rather than trusting the summary prose:

| Instance | Status as of this scan | Source |
|---|---|---|
| Chats' `chat/page.tsx:267` (`selectedPersona` lazy initializer branching on `typeof window`) | **Fixed.** Replaced with state starting `null` on both sides, populated via `useLayoutEffect`. | `01-chats-feature-report.md` §10 ("fixed the hydration-branch bug") |
| Brain/Tasks' `brain/page.tsx:1298` (`storedHistoryAttachments` reading `localStorage` in a `useMemo`) | **Fixed.** Converted to `useState({})` + a populating `useEffect`, identical pattern to the Chats fix. | `03-brain-tasks-feature-report.md` §9 Phase 2 |
| Projects' `project/[id]/chat/[chatId]/page.tsx:326` (`typeof window` check for `initialFiles`) | **Investigated, confirmed already benign — not the same live risk.** The file's one genuine hydration-mismatch-risk branch (a persona lazy-initializer) had already been fixed via a shared `usePendingPersonaHandoff` hook during the Chats engagement's own decomposition work; the remaining `typeof window === 'undefined'` check in this file is for `window.__pendingProjectChatFiles`, and was traced (not assumed) to be safe on both realistic paths: a client-side `push()` never runs a real SSR/hydration cycle, and a hard reload returns `[]` on both server and client since the in-memory global can't survive a reload. | `04-projects-feature-report.md` §10 Phase 1 |
| Agents' `agents/page.tsx:1643` (`rendering-hydration-mismatch-time` — a *related*, not identical, rule: a time/random value used directly in JSX) | **Still open** — not part of the exact `no-unguarded-browser-global-in-render-or-hook-init` rule (different static-analysis rule entirely, flagged by the Settings report's own §8 as merely "related"), and confirmed via the Agents report's own §9 fix log that it was never addressed in that engagement's fix pass. Out of scope for this Settings-focused engagement (different feature, different file). |  `02-agents-feature-report.md` §6, §9 |
| **Settings' `SettingsSidebar.tsx:140`** (this report) | Open as of this scan; fixed in `06-settings-feature-report.md` §10 Phase 1 (this engagement). | — |

**Net: of the 4 *exact*-rule-class instances (Chats, Brain, Projects, Settings), 3 were already closed by prior engagements before this scan started — Settings' was the only one still genuinely open.** The 5th "occurrence" the original report counted (Agents' `agents/page.tsx:1643`) is a related-but-distinct rule and remains open, but belongs to a different feature's backlog, not this one's.

---

## 3. `settings/files/page.tsx:437-438` — real bug or naming-collision false positive?

### 3.1 Current code (pre-fix)

```tsx
export default function FilesPage() {
  const { user } = useAuth()
  if (!user) return <FilesSkeleton />

  const planName    = user?.planName ?? 'Starter'
  // ... (derived values, no hooks) ...

  const [maxFileSize,    setMaxFileSize]    = useState('50 MB')   // line 437
  const [fileRetention,  setFileRetention]  = useState('30 days') // line 438

  return ( /* ... */ )
}
```

### 3.2 Verdict: **real bug, not a false positive** — unlike the Agents engagement's naming-collision instance

The Agents engagement's `agents/page.tsx` false positive (`02-agents-feature-report.md` §9 Phase 1 item 1) involved plain `async function`s *named* with a `use*` prefix (`usePersonaRepo`/`usePersonaRepoDeduped`) that aren't hooks at all — `eslint-plugin-react-hooks` flags any `use[A-Z]…`-named call inside a conditional, hook or not. That is **not** what's happening here: `useState` genuinely is the real React hook, and it is genuinely called conditionally. `if (!user) return <FilesSkeleton />` on line 426 executes **before** the two `useState` calls on lines 437-438. On the very first render (before `useAuth()`'s `user` resolves), the component takes the early-return branch and calls **zero** hooks past `useAuth()` itself; on a later render once `user` arrives, it calls `useAuth()` **then two more hooks**. This is precisely the bug `rules-of-hooks` exists to catch — React requires the exact same hooks, in the exact same order, on every render, specifically so it can match each hook call to its slot in an ordered internal list; skipping hooks on some renders desyncs that list and can corrupt the state of every hook declared after the skipped ones, or crash outright in Strict Mode's double-invoke or any future concurrent-rendering change.

**Confirmed via a fresh `eslint` run** (not just a read): `react-hooks/rules-of-hooks` fires on both lines, quoting exactly this conditional-call scenario.

**Fix applied in `06-settings-feature-report.md` §10 Phase 1:** move both `useState` calls above the `if (!user)` early return, so they run unconditionally on every render regardless of whether `user` has resolved yet. A restructure, not a rename — this is a real bug, and the rename-vs-restructure branch point the engagement brief asked to resolve comes down clearly on the "restructure" side here.

---

## 4. The three billing route trees — traced, confirmed intentional, nothing orphaned or dead

Read `src/lib/routes.ts`'s own inline comments (not just the route list) plus each redirect page's source directly:

| Route | File | Status |
|---|---|---|
| `/settings/plans-and-billing` | `settings/(shell)/plans-and-billing/page.tsx` | **Canonical.** `ORG_PLANS_ROUTE` constant (despite the historical `ORG_` name prefix — kept per the file's own stated precedent of not touching every call site for a rename) points here. This is what `SettingsSidebar.tsx`'s WORKSPACE section's "Plans & Billing" nav item links to, for every account type (individual, org member, org admin) — the comment at `routes.ts:35-39` explicitly documents this as a deliberate merge of what used to be two separate pages. |
| `/settings/billing` | `settings/(shell)/billing/page.tsx` | **A real, working redirect stub**, not dead code. Full file is 15 lines: a client component whose only job is `useEffect(() => { replace(ORG_PLANS_ROUTE) }, [replace])`. Its own comment: *"Retired — merged into /settings/plans-and-billing... This stub keeps old bookmarks/links working."* |
| `/settings/(org)/plans` (→ URL `/settings/plans`, since `(org)` is a route group) | `settings/(shell)/(org)/plans/page.tsx` | **Also a real, working redirect stub**, same shape: `useEffect(() => { replace(ORG_PLANS_ROUTE) }, [replace])`. Comment: *"Moved to /settings/plans-and-billing... This stub keeps old bookmarks/links working."* |

**Verdict: this is intentional, not a migration leftover.** Both non-canonical trees are deliberate, documented, minimal (15-line) redirect stubs kept specifically so old bookmarked/shared links don't 404 — exactly the kind of "worth a five-minute check" the original report predicted, and the five minutes conclusively settle it. Their sub-routes (`/settings/billing/change-plan`, `/settings/billing/confirmation`, `/settings/(org)/plans/confirmation`) are real, still-linked-to pages (the change-plan flow is reached from `plans-and-billing/page.tsx` itself), not orphaned. **Nothing here needs deleting, flagging as dead, or changing** — confirmed, not assumed.

---

## 5. `plans-and-billing/page.tsx:610,1175` — `window.open` without `noopener`

Both exact original line numbers still match current code:

```tsx
// line 610
if (url) window.open(url, '_blank', 'noopener,noreferrer')
// line 1175 (same shape, second account-type branch)
if (url) window.open(url, '_blank', 'noopener,noreferrer')
```

**Already fixed** — both already carry `'noopener,noreferrer'` in the third argument. A full `grep -rn "window.open("` across this feature's own files found the same at lines 627/1187 (`handleExportAllInvoices`) and `settings/help/page.tsx:114`, all four already fixed. This matches the Connectors engagement's own fix log precisely: `05-connectors-feature-report.md` §10 Phase 1 item 1 explicitly lists `settings/plans-and-billing/page.tsx` ×2 and `settings/help/page.tsx` among the 8 call sites its codebase-wide sweep fixed, using a plain `'noopener'`/`'noopener,noreferrer'` feature string (not the `popup.opener = null` technique) — correctly, since none of these four calls retain the return value to navigate the popup afterward (each is a one-shot `window.open(url, ...)` whose result is discarded), unlike `useConnectorSetupFlow.ts`'s OAuth popup, which needed to keep controlling the popup's location after opening it. **No code change needed here — confirmed already closed, not re-fixed.**

---

## 6. Re-derived static-analysis backlog (react-doctor unavailable this session — same as several prior engagements)

The `front-end:react-doctor` skill was not available in this session's tool list (matching the "inconsistently available" pattern documented across this whole series). Re-derived findings from first principles: direct file reads, targeted `grep` sweeps, and a direct `npx eslint` run against this feature's files using `eslint-config-next`'s bundled `eslint-plugin-react-hooks` (which ships the React Compiler's own diagnostics) — the same fallback the Connectors and Pinboard engagements used.

### 6.1 Confirmed still-open, matching the original report

| Finding | Confirmed via |
|---|---|
| `react-hooks/refs` (`no-ref-current-in-render`), `(org)/general/page.tsx:512,645` and `account/page.tsx:448,563` — 4 total | Direct `eslint` output, exact lines matched |
| `react-hooks/set-state-in-effect` on the `setMounted(true)` mount-gate effects in `help/page.tsx:178`, `notifications/page.tsx:252`, `preferences/page.tsx:118`, `security/page.tsx:317` | Direct `eslint` output; each file's `mounted` state/effect/early-return read directly — confirms the original report's own hypothesis (see §6.2) |
| `react-hooks/static-components` (nested component definition) ×3, `SettingsSkeleton.tsx:448,472,480` (the 3 call sites of `NotifGroupHeader`, defined at line 422 inside `NotificationsSkeleton`) | Direct `eslint` output plus a direct read confirming `NotifGroupHeader` is declared inside its parent |
| `no-fetch-response-used-without-status-check`, `(org)/general/page.tsx` — the file's line numbers have shifted since the original report (now-current line ~568's `fetch(preview)` inside `handlePickLogo`, not literally line 611 anymore) | Direct read; only one `fetch(` call exists in this file |
| `control-has-associated-label` ×4 — `plans-and-billing/page.tsx`'s `InputField` (the "Cap overage at" control), `billing/change-plan/page.tsx`'s two `<input type="range">` credit sliders, `security/page.tsx`'s icon-only "3-dot" session-menu button | Direct reads of each file's `<input>`/`<button>` markup |
| `prefer-html-dialog` ×3, all in `(org)/members/page.tsx` | `grep` for `role="dialog"` — confirmed 3 hand-rolled `<div role="dialog">` overlays (lines 308, 589, 765), no native `<dialog>` element in use |

### 6.2 The 4+4 `rendering-hydration-no-flicker`/`no-initialize-state` pair — hypothesis confirmed exactly

Read all 4 files (`help`, `notifications`, `preferences`, `security`) directly. **All four share the identical copy-pasted shape**, confirming the original report's own prediction precisely:

```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => { setMounted(true) }, [])
if (!mounted) return <XSkeleton />
```

**But the original report's own guess at *why* this pattern was copy-pasted — "likely a 'load setting from API into local state via useEffect' idiom" — turned out to be not quite right on inspection: none of the 4 files actually load anything from an API or `localStorage` at all.** Every piece of state in all four pages is initialized from a hardcoded static default (`DEFAULTS`/`SESSIONS`/`'system'`/`'Balanced'`/`''`), confirmed via a `useAuth`/`fetch`/`localStorage` grep across all 4 files that came back empty (aside from `security/page.tsx`'s unrelated `useAuth()` call, used only for `logout`, not for gating this state). So the `mounted` gate in these 4 files isn't protecting against a genuine hydration-sensitive value at all — it's pure copy-pasted boilerplate that forces one extra, purposeless render pass (skeleton, then a flip to real content that was knowable from the very first render) on every page load. This is a *stronger* finding than the original report's own hypothesis: not just "one shared root cause, fixable once" but "a shared root cause with zero actual justification in any of the 4 files," making the fix a clean removal rather than a restructure. See `06-settings-feature-report.md` §10 Phase 6 for the fix.

### 6.3 The ~20 `todo` (React-Compiler-can't-parse) findings — same known tooling limitation as Agents/Brain-Tasks, re-confirmed

Grepped every settings page for `} finally {` (the exact construct the Agents engagement traced this tooling gap to — `babel-plugin-react-compiler`'s current version can't parse `try { } finally { }` blocks inside component/hook bodies at all): **19 matches across this feature's route files** (`plans-and-billing/page.tsx` — 8, `(org)/general/page.tsx` — 7, `account/page.tsx` — 2, `(org)/members/page.tsx` — 2), essentially matching the original report's count of 20 (within one, consistent with ordinary file drift since the original report — the same caveat every `*b` report in this series has noted for its own re-scan). **Not fixed** — same reasoning as the Agents (`02-agents-feature-report.md` §9 Phase 4) and Brain-Tasks engagements: rewriting genuinely-idiomatic `try/finally` cleanup blocks (every one of these is a `setSaving(true)` / `await …` / `setSaving(false)` guarantee) to dodge a compiler parser limitation would either duplicate logic across branches or drop the safety net entirely — a real regression for a purely cosmetic auto-memoization gain the app doesn't depend on.

### 6.4 Decomposition targets — confirmed, with the two-distinct-regions signal borne out exactly

`plans-and-billing/page.tsx`'s two flagged high-complexity locations (originally lines 468 and 1052) land precisely on `function OrgBillingView()` (line 468) and `function PersonalBillingView()` (line 1052) — **two genuinely separate top-level components for the two account types**, each independently declaring its own `showCancelDialog`/`isCanceling`/`handleCancelSubscription` state and rendering a near-byte-identical ~35-line cancel-subscription confirmation dialog inline (differing only in which date label it interpolates). This is exactly the kind of self-contained, zero-coupling-relocated extraction target prior engagements' decomposition rule calls for. See `06-settings-feature-report.md` §10 Phase 8 for the fix.

---

## 7. Revised backlog for the fix pass

**Closed out by this scan — no code change needed:**
- ~~`plans-and-billing/page.tsx:610,1175` `window.open` without `noopener`~~ — already fixed by the Connectors engagement's codebase-wide sweep.
- ~~Billing route "orphan" concern~~ — confirmed intentional, documented redirect stubs; nothing dead, nothing to delete.
- ~~3 of the "5" `no-unguarded-browser-global` occurrences (Chats, Brain, Projects)~~ — already closed by prior engagements.

**Still open, in priority order (matches the original report's numbering, carried into `06-settings-feature-report.md` §10):**
1. `SettingsSidebar.tsx:140` — unguarded browser-global read (confirmed real, root-caused precisely above).
2. `settings/files/page.tsx:437-438` — confirmed real conditional-hook-call bug (not a naming false positive).
3. 4+4 `mounted`-gate findings across `help`/`notifications`/`preferences`/`security` — confirmed one shared, unjustified root cause.
4. 4× `refs`/`no-ref-current-in-render` in `(org)/general/page.tsx` and `account/page.tsx`.
5. `(org)/general/page.tsx`'s fetch-without-status-check.
6. `SettingsSkeleton.tsx`'s nested `NotifGroupHeader` component definition.
7. `plans-and-billing/page.tsx` decomposition (the duplicated cancel-dialog extraction).
8. 4× `control-has-associated-label` accessibility findings.
9. ~19-20× `todo` findings — confirmed known tooling limitation, to be documented, not force-fixed.
10. `prefer-html-dialog` ×3 in `(org)/members/page.tsx` — to be confirmed/noted only, per the engagement's explicit scope limit.

See `06-settings-feature-report.md` §10 for the fix log, `06c-settings-fixes-test-plan.md` for test cases, `06d-settings-before-after-comparison.md` for the post-fix Lighthouse re-scan, and `06e-settings-manual-qa-checklist.md` for the manual click-through.
