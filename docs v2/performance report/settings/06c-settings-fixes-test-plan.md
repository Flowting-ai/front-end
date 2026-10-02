# Settings — Fixes Test Plan

Test cases for every fix logged in `06-settings-feature-report.md` §10, organized by phase. Each case states the precondition, steps, expected result (before vs. after), and how it was actually verified — automated/live/code-review — versus what still needs manual QA. Same format and honesty standard as `../connectors/05c-connectors-fixes-test-plan.md`.

---

## Phase 1 — P0: `SettingsSidebar.tsx` hydration fix

### TC-1.1 — Raw JS semantics of the pre-fix code (the most rigorous case in this plan)
- **Precondition:** none — a language-level test, not an app test.
- **Steps:** ran `node -e "try { const r = window?.sessionStorage?.getItem('x'); console.log('NO THROW', r); } catch (e) { console.log('THREW:', e.constructor.name, e.message); }"` in a plain Node process with no `window` global defined.
- **Expected (if the finding is real):** a `ReferenceError`, not a silent `undefined`.
- **Actual:** `THREW: ReferenceError window is not defined`.
- **How verified:** directly executed, output captured and quoted verbatim in `06b-settings-before-scan.md` §2.2. This is the strongest possible confirmation available short of a production crash: it proves the *language construct itself* is unsafe, independent of anything Next.js-specific.

### TC-1.2 — Does the pre-fix code actually crash **this app's** production build/server render?
- **Precondition:** the disposable pre-fix worktree (`../settings-before-check`, reconstructed via `git worktree add --detach HEAD` + a scoped `git diff`/`git apply` — see `06b` intro) built and running on port 3001.
- **Steps:** (a) `npm run build` in that worktree; (b) live `page.goto()` to all 10 settings pages via Playwright, post-login, checking HTTP status/console errors/hydration warnings.
- **Expected if it crashed:** a 500 status, a build failure, or a console "Hydration failed" warning.
- **Actual:** build exited 0, all settings routes marked `○ Static` (successfully prerendered); all 10 live pages returned 200 with correct headings, zero hydration warnings, only the known CSP/Facebook-pixel console warning.
- **How verified:** real `npm run build` output + a real Playwright driver script's JSON results, both captured in `06b` §1 and §2.2. **Honest conclusion, not overclaimed**: this specific bundling doesn't let the bug reach a live crash today — the fix closes a genuine latent-risk bug class (proven in TC-1.1) and a real hydration-*value* mismatch risk (an `isTeamUser`-derived UI difference for a team account with an unresolved `orgId`), not an active production incident.

### TC-1.3 — Post-fix: value now starts identically on server and client, populates after mount
- **Precondition:** post-fix code (`billingSnap` as `useState(null)` + populating `useEffect`).
- **Steps:** code-review confirmed `useState<{ isTeamAccount?: boolean } | null>(null)` — the same literal `null` is what both the server's evaluation and the client's very first (hydration) render see, by construction; no branching on `window` remains anywhere in the render body.
- **Expected:** no hydration-mismatch is possible for this value, by construction (identical on both sides), and the real cached value populates one tick after mount.
- **How verified:** code review (the strongest available proof for "no mismatch is possible" is showing the two initial values are textually identical, not sampling outputs) + the same TC-1.2 live re-run against the post-fix build (port 3000): identical 200/heading/zero-error results, confirming no regression.

### TC-1.4 — Hard reload vs. client-side navigation (the specific check this fix class calls for)
- **Precondition:** post-fix production build running.
- **Steps:** (a) hard `page.goto()` directly to `/settings/account` (exercises the real SSR/hydration path); (b) for comparison, the same page reached via an in-app client-side transition from `/chat` would use no SSR/hydration at all for the already-mounted-JS case (a pure CSR render), so no mismatch is structurally possible there either way — the *meaningful* test is exclusively the hard-reload path.
- **Expected:** zero "Warning: Text content did not match..." / "Hydration failed because the initial UI does not match..." console messages on the hard-reload path.
- **Actual:** zero such messages on all 10 hard-reloaded pages, both pre-fix and post-fix builds (the `hydrationWarning` flag in the Playwright driver's JSON output, computed via an `/hydrat/i` regex over every captured console message, is `false` for every one of the 20 page-loads across both builds).
- **How verified:** live, both builds, real regex-matched console capture — not assumed clean.

### TC-1.5 — Codebase-wide occurrence count, finalized
- **Precondition:** none — a documentation cross-reference.
- **Steps:** read each of the other 4 prior engagements' own fix logs directly (`01-chats-feature-report.md` §10, `03-brain-tasks-feature-report.md` §9, `04-projects-feature-report.md` §10, `02-agents-feature-report.md` §6/§9).
- **Expected/Actual:** 3 of 4 exact-rule-class instances already closed before this session (Chats, Brain-Tasks, Projects); this session closes the 4th; the 5th (Agents, a related-but-distinct rule) remains open in a different feature's backlog.
- **How verified:** direct reads, quoted precisely in `06b` §2.3 — not inferred from summary counts.

---

## Phase 2 — P0: `settings/files/page.tsx` conditional-hook-call

### TC-2.1 — Confirm real bug, not a naming-collision false positive
- **Precondition:** pre-fix code.
- **Steps:** read the component body directly; confirmed `if (!user) return <FilesSkeleton />` executes before 2 `useState` calls; ran `eslint` and confirmed `react-hooks/rules-of-hooks` fires on exactly those 2 lines, with the standard "called conditionally" message (not the Agents engagement's naming-heuristic message shape).
- **Expected:** a genuine hook-order violation, confirmed by both a manual trace and the linter agreeing.
- **How verified:** direct code read + `eslint` output, both quoted in `06b` §3.

### TC-2.2 — Post-fix: hooks always called, page still renders correctly for both auth states
- **Precondition:** post-fix code (both `useState` calls moved above the early return).
- **Steps:** (a) fresh `eslint` run — zero `rules-of-hooks` findings remain on this file; (b) live Playwright load of `/settings/files` on the post-fix build.
- **Expected:** page renders "Files & Data" heading correctly, no console errors.
- **Actual:** confirmed — `/settings/files` → 200, heading "Files & Data", 1 console error (the known CSP warning only).
- **How verified:** `eslint` re-run + live Playwright result in `06b` §1's post-fix-equivalent smoke test (same driver run against port 3000).
- **Not separately re-tested live:** the specific pre-auth-resolved render (the actual moment the bug mattered) — this happens for a fraction of a second before `useAuth()` resolves and isn't independently observable via a full-page navigation check; the fix's correctness rests on the hook-order argument itself (hooks now always called, full stop) rather than on catching the bug mid-flight a second time.

---

## Phase 3 — P0: billing route trees

### TC-3.1 — Confirm canonical vs. stub routes
- **Precondition:** none.
- **Steps:** read `src/lib/routes.ts`'s own comments for `ORG_PLANS_ROUTE`/`SETTINGS_BILLING_ROUTE`; read both `settings/(shell)/billing/page.tsx` and `settings/(shell)/(org)/plans/page.tsx` in full (15 lines each).
- **Expected/Actual:** both are real, deliberate `useEffect(() => replace(ORG_PLANS_ROUTE), [replace])` redirect stubs with their own explanatory comments; `/settings/plans-and-billing` is canonical, linked from `SettingsSidebar.tsx`.
- **How verified:** direct source reads, quoted in full in `06b` §4. No code change was made — this test case is a documentation confirmation, not a fix verification.

---

## Phase 4 — P0: `window.open` findings

### TC-4.1 — Confirm already fixed by the Connectors sweep
- **Precondition:** none.
- **Steps:** `grep -n "window.open(" plans-and-billing/page.tsx help/page.tsx` — read all 5 matches directly.
- **Expected/Actual:** all 5 already carry `'noopener,noreferrer'`; cross-referenced against `05-connectors-feature-report.md` §10 Phase 1 item 1, which explicitly names these exact files as already fixed by that engagement's own sweep.
- **How verified:** direct grep + read, cross-referenced against the other report's own fix log text (quoted in `06b` §5). No code change needed or made.

---

## Phase 5 — P1: `todo` React-Compiler-parse findings

### TC-5.1 — Confirm known tooling limitation, not a fixable bug
- **Precondition:** none.
- **Steps:** `grep -c "} finally {"` across every settings route file; compared the total (19) against the original report's count (20).
- **Expected:** a close match, consistent with ordinary file drift since the original report (the same tolerance every `*b` report in this series has applied to its own re-scan).
- **Actual:** 19 vs. 20 — within tolerance. Root cause (the specific `babel-plugin-react-compiler` version's inability to parse `try/finally`) already independently diagnosed and documented by the Agents and Brain-Tasks engagements; not re-derived from scratch, cross-referenced instead.
- **How verified:** direct grep counts, cross-referenced reasoning. **Deliberately not fixed** — a documentation/confirmation test case, not a code-change verification.

---

## Phase 6 — P1: the 4+4 `mounted`-gate findings (help/notifications/preferences/security)

### TC-6.1 — Confirm the shared pattern and its (lack of) justification
- **Precondition:** pre-fix code, all 4 files.
- **Steps:** read all 4 files in full; grepped each for `useAuth|fetch(|localStorage|useEffect(` to check whether any genuinely async/client-only data feeds the gated state.
- **Expected:** if the original report's hypothesis holds, at least some API/localStorage dependency should appear.
- **Actual:** none found in any of the 4 files — every piece of gated state is a hardcoded static default. The `mounted` gate had zero actual justification.
- **How verified:** direct reads + grep, quoted in `06b` §6.2.

### TC-6.2 — Post-fix: real content renders on first paint, no flicker
- **Precondition:** post-fix code (gate removed in all 4 files).
- **Steps:** live Playwright load of all 4 pages on both pre-fix (port 3001) and post-fix (port 3000) builds; DOM/heading check immediately after `networkidle`.
- **Expected:** correct heading and real content visible with no separate "skeleton-then-flip" step observable.
- **Actual:** confirmed on both builds — `/settings/help` → "Help & Legal", `/settings/notifications` → "Notifications", `/settings/preferences` → "Preferences", `/settings/security` → "Security", all with zero console errors beyond the known CSP warning.
- **How verified:** live, both builds, same driver script.

### TC-6.3 — No unused imports left behind
- **Precondition:** post-fix code.
- **Steps:** `npx tsc --noEmit` (unused imports don't fail `tsc` by default, so this alone wasn't sufficient) + a direct `eslint` run, which does flag `@typescript-eslint/no-unused-vars`.
- **Expected:** zero unused-import findings introduced by this fix.
- **Actual:** confirmed clean — `useEffect`/`useState`/`*Skeleton` imports were explicitly pruned per file where no longer used, verified in the eslint diff.
- **How verified:** `eslint` before/after diff.

---

## Phase 7 — P2: `refs`/`no-ref-current-in-render` (4 instances)

### TC-7.1 — `account/page.tsx`'s `isDirtyRef` and `handleSaveRef`
- **Precondition:** pre-fix code (direct `.current =` writes during render).
- **Steps:** `eslint` before/after; confirmed both refs are only ever *read* from inside a `beforeunload` listener or a `setSaveHandler`-registered callback, never during render, so wrapping the write in a deps-less `useEffect` cannot introduce a stale-read bug.
- **Expected:** zero `react-hooks/refs` findings on these 2 lines post-fix.
- **Actual:** confirmed.
- **How verified:** `eslint` diff + manual trace of every read site.

### TC-7.2 — `(org)/general/page.tsx`'s `isIdentityDirtyRef` and `handleSaveIdentityRef`
- Same shape, same verification method as TC-7.1, applied to the org General page's identical pattern.

### TC-7.3 — Live: unsaved-changes guard and Save-handler wiring still work
- **Precondition:** post-fix build, logged in as an org admin (test account).
- **Steps:** live-navigated to `/settings/account` and `/settings/general`; confirmed both pages render correctly with no console errors post-fix (same Playwright smoke-test pass covering these paths' render).
- **Not independently exercised this session:** actually triggering the dirty state (editing a field) and confirming the nav-guard modal appears, or closing the tab to trigger `beforeunload` — these require interactive form-filling + a real unsaved-navigation attempt, which is exactly the kind of thing flagged for the manual QA checklist (`06e`) rather than claimed as automated-verified here. The one-commit-delay reasoning (TC-7.1) is what this fix's correctness actually rests on, not a live repro of the dirty-guard UI.

---

## Phase 8 — P2: `plans-and-billing/page.tsx` decomposition

### TC-8.1 — Extraction correctness: `CancelSubscriptionDialog`
- **Precondition:** pre-fix code (two near-identical ~35-line inline dialogs in `OrgBillingView`/`PersonalBillingView`).
- **Steps:** diffed the two original inline blocks against each other (identical except for the date-label expression); confirmed the new shared component's props (`open`, `periodEndLabel`, `isCanceling`, `onKeep`, `onConfirmCancel`) cover every value either call site used; confirmed both call sites updated to pass the same values they previously inlined (`nextBilling` vs. `fmtDate(periodEnd)` for the date label).
- **Expected:** byte-for-byte equivalent rendered output for both account types.
- **How verified:** code-level diff review (both original blocks were nearly textually identical, confirming a safe 1:1 extraction) + `tsc`/`eslint`/`vitest` all green.
- **Live-verified:** the org-admin-view path is reachable with the test account and renders `/settings/plans-and-billing` correctly post-fix (heading "Plan & Billing", zero console errors). **Not live-verified:** the personal (non-org) account branch — the test account is an org member, so `PersonalBillingView` isn't reachable live this session; its correctness rests on the code-level diff review, not a live click-through. Flagged for the manual QA checklist.

---

## Phase 9 — P2: `(org)/general/page.tsx` fetch-without-status-check

### TC-9.1 — Status check added, existing fallback behavior preserved
- **Precondition:** pre-fix code (`fetch(preview)` consumed unconditionally).
- **Steps:** code review confirming the new `if (!previewRes.ok) throw new Error(...)` is caught by the same immediately-enclosing `catch` block that already existed for "compression unsupported" fallback — so a bad-status response now correctly falls through to the exact same recovery path a thrown exception already used.
- **Expected:** no behavior change on the success path; a bad-status response (unlikely for a `data:` URL fetch, but now handled regardless) now falls back to the original file instead of silently trying to build a `Blob` from a failed response.
- **How verified:** code review (this path isn't easily forced live without a genuinely malformed data URL) + `tsc`/`vitest` green.
- **Live-verified:** the success path — uploading a logo on `/settings/general` — was not exercised live this session (would require a real file picker interaction against a real org); reasoning-verified only. Flagged for manual QA.

---

## Phase 10 — P2: `SettingsSkeleton.tsx` nested component

### TC-10.1 — Hoisted component renders identically, no closure dependency broken
- **Precondition:** pre-fix code (`NotifGroupHeader` defined inside `NotificationsSkeleton`).
- **Steps:** confirmed via read that `NotifGroupHeader` references only `Section`/`Bone`, both already module-scoped function declarations (hoisted, so declaration order doesn't matter); `eslint` before/after diff.
- **Expected:** zero `react-hooks/static-components` findings post-fix; identical skeleton markup.
- **Actual:** confirmed — 3 findings (at the 3 call sites) resolved to 0.
- **How verified:** `eslint` diff + code read. **Live-verified indirectly**: the skeleton only renders while `NotificationsSkeleton`'s own gating condition is true (a very brief window during data load); not independently screenshot-captured mid-load this session, but the change is a pure structural hoist with no logic difference, so the render output is provably identical by construction.

---

## Phase 11 — P2: accessibility label fixes

### TC-11.1 — `InputField` (`plans-and-billing/page.tsx`)
- **Steps:** code review confirming `useId()` generates a unique id per render-stable across re-renders, `aria-labelledby` on the `<input>` points to the same id as the `<p>`.
- **How verified:** code review; not independently tested with a real screen reader this session (no screen-reader-equipped environment available) — the `id`/`aria-labelledby` pairing is a standard, well-understood WAI-ARIA association, and the fix's correctness is structural (both attributes reference the same generated string), not behavioral.

### TC-11.2 — Change-plan sliders' `aria-label`s
- **Steps:** confirmed both sliders now have distinct, descriptive `aria-label`s reflecting their actual purpose ("Monthly credits — individual plan" / "— team plan").
- **How verified:** code review.

### TC-11.3 — Security page's 3-dot menu button
- **Steps:** confirmed `aria-label="Session actions"` added; live-loaded `/settings/security` on the post-fix build, confirmed page still renders correctly with no visual change (the label is non-visual).
- **How verified:** code review + live render check (heading "Security", zero new console errors).

### TC-11.4 — The two investigated-and-confirmed-correct `no-static-element-interactions` instances
- **Steps:** read `preferences/page.tsx`'s theme-card markup (confirmed a real `Checkbox` component provides the actual accessible control) and `plans-and-billing/page.tsx`'s modal backdrops (confirmed real, fully-keyboard-accessible Keep-plan/Cancel buttons exist inside).
- **Expected/Actual:** both already correctly `eslint-disable`d with an explanatory comment; no code change made.
- **How verified:** code review only — this is a "confirm, don't fix" case per the engagement's own honesty standard for already-correct patterns.

---

## Phase 12 — P3: `prefer-html-dialog`

### TC-12.1 — Confirm still open, confirm not touched
- **Steps:** `grep -n 'role="dialog"'` on `(org)/members/page.tsx` — 3 matches, lines 308/589/765.
- **Expected/Actual:** still present, confirmed unfixed, no code change made — matches the engagement's explicit scope limit (no shared-Dialog-primitive refactor attempted).
- **How verified:** direct grep.

---

## Coverage summary

| Phase | Fix | Automated (`tsc`/`vitest`/`eslint`) | Live (Playwright, real build) | Code-review only | Manual QA still recommended |
|---|---|---|---|---|---|
| 1 | SettingsSidebar hydration fix | Yes | Yes (both builds, 10 pages) | — | — |
| 2 | files/page.tsx hook order | Yes | Yes (page load) | — | Pre-auth-resolved render timing (sub-second, not independently observable) |
| 3 | Billing routes confirmed | — | — | Yes | — |
| 4 | window.open already fixed | — | — | Yes | — |
| 5 | `todo` findings confirmed known limitation | — | — | Yes | — |
| 6 | mounted-gate removal (4 files) | Yes | Yes (all 4 pages, both builds) | — | — |
| 7 | refs/no-ref-current-in-render (4 sites) | Yes | Partial (page loads only) | Yes (read-site trace) | Actually triggering the dirty-state guard UI |
| 8 | plans-and-billing decomposition | Yes | Partial (org view only) | Yes (personal view) | Personal (non-org) account's Cancel flow |
| 9 | general/page.tsx fetch status check | Yes | — | Yes | Real logo upload with a malformed response |
| 10 | SettingsSkeleton nested component | Yes | — | Yes | — |
| 11 | 4× accessibility labels | — | Partial (2 of 4) | Yes | Screen-reader spot check |
| 12 | prefer-html-dialog confirmed open | — | — | Yes | — |

**Every fix is at minimum code-review-verified and `tsc`/`vitest`-green; the headline Phase 1 fix and the Phase 6 mounted-gate removal are the most thoroughly live-verified (both pre-fix and post-fix builds, all affected pages). The items most worth a real human click-through before considering this fully closed are the personal (non-org) billing view's Cancel-subscription flow and the four ref-guarded unsaved-changes flows** — both flagged explicitly here and again in `06e-settings-manual-qa-checklist.md`.
