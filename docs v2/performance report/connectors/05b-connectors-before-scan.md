# Connectors Feature — Pre-Fix Production Baseline Scan

Companion to `05-connectors-feature-report.md` (the original findings — dev-mode Lighthouse only, the OAuth-popup handoff unverified, `react-doctor` run against an earlier snapshot of the code). This is a from-scratch, live, logged-in session against a clean **production build**, following the methodology established by the Chats/Agents/Brain-Tasks/Projects/Pinboard engagements. No code changes existed yet when everything in this document was captured — see `05-connectors-feature-report.md` §10 for what happened next, `05d-connectors-before-after-comparison.md` for the re-scan.

**Methodology note on how "before" was captured without a two-pass rebuild of the same tree.** This session's fix pass (§10 of the main report) was implemented first, directly in `front-end/`. To still get a genuine pre-fix production build for this baseline — rather than reasoning about "before" purely from reading diffs — a second, disposable checkout was created via `git worktree add --detach ../connectors-before-check HEAD` (a plain, non-destructive git operation; no `git stash`/`reset`/`checkout` was run against the main working tree, which still holds this session's other in-progress and unrelated uncommitted work throughout). `HEAD` predates every change in this session, so every Connectors-relevant file in that worktree is byte-for-byte the pre-fix version. `node_modules` was junction-linked from the main tree (no separate `npm install`), `.env.local`/`.env.development.local`/`.env.production.local` were seeded via the project's own `load-secrets` script plus a copy to `.env.production.local` (mirroring how the main tree already had one from a prior session — production `next start` doesn't read `.env.development.local`). Built with `npm run build` and served with `npm run start` on port 3000, fully separate from the main tree. This means the "before" and "after" builds in this report pair are genuinely two different, independently-built production servers, not the same server re-labeled.

Baseline gates (run against the **main tree**, i.e. this session's in-progress fix work, before continuing further): `npx tsc --noEmit` clean, `npm run test` (vitest) 279/279 passing — both already true at the point this document was written, since the fix pass and this baseline scan were interleaved (fixes first, then this disposable pre-fix build for comparison purposes only). The 279-test baseline is unchanged from the Pinboard engagement's own final count — this pass did not add new test files (all its fixes are refactors/behavior-preserving restructurings verified via `tsc`, `vitest`, `eslint`, and live testing, not new unit-testable surface).

The `front-end:react-doctor` skill was **not available in this session's tool list at all** (matching this whole series' "inconsistently available" pattern). Every finding below was re-derived from first principles: direct file reads, `grep` sweeps for each original finding's pattern, and a direct `eslint` run against this feature's files using `eslint-config-next`'s bundled `eslint-plugin-react-hooks` (which — confirmed this session — ships the React Compiler's own `set-state-in-effect` and `refs`/`no-ref-current-in-render` diagnostics natively; it does **not** expose a standalone `react-compiler` rule, so the `todo` React-Compiler-parse-error findings from the original report were re-derived by pattern-matching against the known `try/finally` parser gap documented in the Agents engagement, not by re-running the same tool).

---

## 1. `/connectors` catalog — confirmed live, matches the original report

Logged in fresh (`.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, real Auth0-hosted identifier-then-password universal login flow), navigated to `/connectors` on the pre-fix production build. The catalog rendered cleanly: OCodeKit, 1CRM, 2Chat, 2markdown, 302.AI, 360NRS, 46elks, 4Dem, 8x8 Connect, Descript, pagination controls, search, sort — no visual defects, matching the original report's §3.1 exactly.

**The two-separate-API-calls-with-different-`linked=`-params pattern still holds, confirmed via live network capture:**

| Call | Status |
|---|---|
| `GET /api/backend/connectors?limit=100&linked=true` | 200 |
| `GET /api/backend/connectors?limit=10&linked=false` | 200 |

This positive pattern is untouched by this pass's fixes (per the engagement brief's explicit instruction not to "fix" it) and confirmed still correct on both the pre-fix and post-fix builds.

No 502 was captured this session on `/connectors` itself (the original report's own 502 was a one-off transient capture, already understood as backend infra flakiness, not something to chase down further).

---

## 2. The OAuth-popup handoff — closed out, live, with a definitive answer

This is the gap the original report's own live testing left open (§3.2: "a follow-up click on 'Continue to Ocodekit' was attempted... but that second click didn't land reliably"). This session's driver reliably reproduced the full sequence against the pre-fix build:

1. Clicked the catalog card's "+"/`aria-label="Connect 0codekit"` affordance → `SetupModal` opened correctly (title, account-name field, Shared/Private visibility choice — matching the original report's own description, still accurate).
2. Clicked **"Continue to 0codekit"** → this fired `POST /api/backend/connectors/_0codekit/link` (200) and opened a real popup window.
3. **The popup opens.** Immediately after the click it is `about:blank` (the code's own documented two-step pattern: open a blank popup synchronously inside the click handler — required so the browser doesn't treat it as an unrequested popup — then navigate it once `initiateLink()`'s response comes back).
4. **The popup's target, once navigated:** `https://pipedream.com/_static/connect.html?connectLink=true&token=ctok_512e5215722b412eaefea5fd20957a0a&app=_0codekit` — confirming these connectors are OAuth-brokered through **Pipedream Connect**, a third-party OAuth aggregator, not a direct per-connector OAuth redirect.
5. **`window.opener` in the popup: live-verified, definitively non-null (`window.opener === null` evaluated to `false`), both immediately after opening and after the navigation to the real Pipedream origin settled.** This is exactly the vulnerability the original report could not confirm live — now directly confirmed: `useConnectorSetupFlow.ts`'s popup keeps a live, usable `window.opener` reference back to this app's own tab for the entire duration of the third-party OAuth flow, on a real, working connect flow (not a dead/unreachable code path).
6. **Closing the popup without completing auth:** the parent tab recovered cleanly — still fully rendering (body content present, ~54KB of DOM, not blank/hung) roughly 4 seconds after the popup closed, and showed cancellation-related copy consistent with `useConnectorSetupFlow.ts`'s own documented `closedCheck` handling (a closed popup on a `hosted` — Pipedream/Zapier-style — flow is treated as an outright cancellation, distinct from the grace-window retry it gives non-hosted flows). No console error, no stuck spinner, no need to reload the page.

**Verdict: the P0 security finding is now definitively confirmed live, not just present in source.** Fix verification (post-fix `window.opener === null` re-check) is in `05d-connectors-before-after-comparison.md`/`05c-connectors-fixes-test-plan.md`.

---

## 3. Codebase-wide `window.open(` grep — full catalog

Every `window.open(` call site under `front-end/src`, current as of the start of this session (before any fix in this pass), with its `noopener`/`noreferrer` status and reachability:

| # | File:line | 3rd arg (features) at time of scan | `noopener`? | Reachable / live? |
|---|---|---|---|---|
| 1 | `src/lib/useConnectorSetupFlow.ts:80` | `'width=900,height=700'` | **No** | **Yes — the Connectors OAuth-linking popup, confirmed exploitable live in §2 above.** |
| 2 | `src/lib/useConnectorSetupFlow.ts:110` | *(none)* | **No** | Yes — fallback path when the pre-opened popup was blocked/closed by the browser. Return value unused. |
| 3 | `src/components/chat/ConnectorPrompts.tsx:154` | `'width=900,height=700'` | **No** | **Yes — the Chats-feature connector-connect-prompt's own OAuth popup, same deferred-navigation shape as #1, same reverse-tabnabbing exposure.** The original Chats report (`01-chats-feature-report.md`) flagged a `window.open` finding at this file's *other* call site (line ~179 at the time); confirmed via `git log`/`git show` (commit `da89ccd2`) that that *other* site (the popup-blocked fallback, now line 181) was already fixed in a prior session (`window.open(openUrl, '_blank', 'noopener')`) — but this primary popup was never touched and carries the identical exposure as #1. |
| 4 | `src/app/(app)/brain/page.tsx:646` | `'width=900,height=700'` | **No** | Yes — Brain/Tasks' own inline connector-connect handler (a third, independent implementation of the same OAuth-popup pattern, not sharing code with `useConnectorSetupFlow.ts` or `ConnectorPrompts.tsx`). Reachable from `/brain`. |
| 5 | `src/app/(app)/agent/configure/knowledge/page.tsx:368` | *(none, but `newTab` reference retained for a later `.location.href` assignment)* | **No** | Yes — file-preview-in-new-tab flow on the Agent Configure Knowledge tab. Different threat shape (previews a *remote file URL*, not a third-party OAuth page) but the same reverse-tabnabbing mechanism applies since the reference is retained and later navigated. |
| 6 | `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx:610` | *(none)* | **No** | Yes — "Manage billing" → Stripe portal link. Return value unused. |
| 7 | `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx:1175` | *(none)* | **No** | Yes — a second, near-identical `handleStripePortal` in the same file (a different view/component). Return value unused. |
| 8 | `src/app/(app)/settings/(shell)/help/page.tsx:114` | *(none)* | **No** | Yes — Help & Legal page's external-link "View" buttons. Return value unused. |
| 9 | `src/templates/Brain/BrainContentRenderer.tsx:130` | `'noopener,noreferrer'` | Yes | Already correct — no fix needed. |
| 10 | `src/components/chat/AttachmentManager.tsx:123` | `'noopener,noreferrer'` | Yes | Already correct. |
| 11 | `src/components/chat/ChatMessage.tsx:936` | `'noopener,noreferrer'` | Yes | Already correct. |
| 12 | `src/components/chat/ConnectorPrompts.tsx:181` | `'noopener'` | Yes | Already correct (the prior session's fix, confirmed via `git blame`). |
| 13 | `src/components/chat/CitationChip.tsx:43` | `'noopener,noreferrer'` | Yes | Already correct. |
| 14 | `src/app/(app)/brain/page.tsx:1011` | `'noopener'` | Yes | Already correct. |
| 15 | `src/app/(app)/souvenir-slack/SlackConnectorsPanel.tsx:119` | `'noopener'` | Yes | Already correct. |
| 16 | `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx:627` | `'noopener,noreferrer'` | Yes | Already correct. |
| 17 | `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx:1187` | `'noopener,noreferrer'` | Yes | Already correct. |
| 18 | `src/components/SlackConnectModal/index.tsx:108` | `'noopener,noreferrer'` | Yes | Already correct. |
| 19 | `src/app/(app)/agent/configure/layout.tsx:665` | `'noopener,noreferrer'` | Yes | Already correct. |
| 20 | `src/app/(app)/agent/configure/layout.tsx:675` | `'noopener,noreferrer'` | Yes | Already correct. |
| 21 | `src/app/(app)/agent/configure/knowledge/page.tsx:357` | `'noopener,noreferrer'` | Yes | Already correct. |
| 22 | `src/app/(app)/agent/configure/knowledge/page.tsx:363` | `'noopener,noreferrer'` | Yes | Already correct. |

**22 total call sites, 8 missing `noopener` (#1–8), 14 already correct.** Of the 8: 3 (#1, #3, #4) are the "pre-open blank, later navigate" popup shape, which can't simply take `'noopener'` as a `window.open()` feature (that makes most browsers return `null`, breaking the later `.location.href` assignment these all rely on) — these need the `popup.opener = null` post-open technique instead. #5 is the same shape via a plain-variable `newTab`. #2, #6, #7, #8 are one-shot calls whose return value is never used, so a plain `'noopener'` (or `'noopener,noreferrer'` to match the codebase's own more common convention) is a direct, risk-free addition. This is the exact input list Phase 2 of `05-connectors-feature-report.md` §10 works through.

---

## 4. `connectors/page.tsx`'s `useSearchParams()`/Suspense finding — re-verified, already fixed, not a live bug

Current file (`src/app/(app)/connectors/page.tsx`, 25 lines) already wraps its `useSearchParams()`-calling component in a proper `<Suspense fallback={null}>` boundary — the textbook-correct Next.js App Router pattern:

```tsx
function ConnectorsPageContent() {
  const searchParams = useSearchParams()
  return <ConnectorsExperience initialSearch={searchParams.get('q') ?? ''} />
}

export default function ConnectorsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectorsPageContent />
    </Suspense>
  )
}
```

`git log`/`git show` on this file traces this Suspense wrapper back to commit `f0d94b76` (Aug 30, well before this engagement), carried through the later `112887d5` consolidation commit unchanged. **This means the original report's P0 finding here does not hold against current code — it was either already fixed by an intervening, unrelated commit between the original scan and now, or reflects a stale/inaccurate static-analysis snapshot.** Either way: confirmed correct, live, no code change needed or made. What `initialSearch` is actually used for was also traced: it pre-fills the catalog search box from a `?q=` deep link (e.g. a "quick action" elsewhere in the app linking straight to `/connectors?q=slack`) — this still works correctly (see §6's `ConnectionsView` finding, which is a *different*, real gap in how that same value is consumed downstream, not related to the Suspense boundary itself).

---

## 5. `ConnectorsExperience.tsx:77`'s `nextjs-no-client-side-redirect` finding — investigated, confirmed a benign URL-sync pattern

Current line 77 (`ConnectorsExperience.tsx`) is inside this effect:

```tsx
useEffect(() => {
  const isTabView = view === 'permissions' || view === 'access' || view === 'settings'
  const nextTab = isTabView ? view : null
  if (searchParams.get('tab') === nextTab) return
  const params = new URLSearchParams(searchParams.toString())
  if (nextTab) params.set('tab', nextTab)
  else params.delete('tab')
  const query = params.toString()
  router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })  // ← line 77
}, [view, pathname, router, searchParams])
```

This is **not** a redirect in the sense the rule is built to catch (an imperative "you're not allowed here, send the user elsewhere" navigation, the kind that causes a flash-of-wrong-content or should be a middleware/server redirect instead). It's a one-way **URL-state sync**: whenever the in-memory `view` state changes to/from a tab view, this keeps the address bar's `?tab=` query param in sync with it — using `router.replace` (not `push`, so it doesn't pollute browser history) and `{ scroll: false }` (so it doesn't jump the viewport), specifically so the current tab is shareable/bookmarkable/back-button-safe. There is no "wrong content flashes before the real destination loads" symptom here — the rendered content never depends on this effect running; it's purely cosmetic URL bookkeeping. **Confirmed a legitimate pattern, not a bug — left unchanged**, matching the same reasoning discipline as this series' other investigated-and-confirmed-fine static findings (e.g. Pinboard's `collapseSignal` pattern, Brain-Tasks' `ScheduleEditModal` `aria-labelledby` case).

---

## 6. The 6 `todo` (React-Compiler-can't-parse) findings — re-derived, confirmed the same `try/finally` parser gap as the Agents engagement

`next.config.ts` has `reactCompiler: true`. A grep for `try {` / `} finally {` pairs across `AccountDetailView.tsx` and `ConnectorsExperience.tsx` found:

- `AccountDetailView.tsx`: 4 `try/finally` blocks (lines ~201-213, ~304-312, ~320-332, ~421-430 at scan time) — **exact match to the original report's "4×"**.
- `ConnectorsExperience.tsx`: 2 `try/finally` blocks (lines ~55-62, ~167-179 at scan time) — **exact match to the original report's "2×"**.

4 + 2 = 6, exactly matching the original count. This is the identical, already-documented React Compiler limitation the Agents engagement's `02c-agents-fixes-test-plan.md` TC-4.1 traced for its own 27 `todo` findings (all attributed to the same `try/finally`-parsing gap in this version of `babel-plugin-react-compiler`). **Confirmed a genuine tooling limitation, not a fixable code pattern** — restructuring every `try/finally` in these two files into a shape the compiler can parse (typically means hoisting cleanup logic out of `finally` into explicit calls on every exit path) would meaningfully hurt readability and correctness-safety for a purely cosmetic auto-memoization win the app doesn't currently rely on. Not fixed, per the Agents engagement's own precedent.

---

## 7. Revised backlog going into the fix pass

**Confirmed and requiring a real fix in Phase 2:**
- P0: all 8 `window.open` call sites missing `noopener` (§3), headlined by the now-live-confirmed `useConnectorSetupFlow.ts:80` OAuth popup (§2) and the still-open Chats sibling (`ConnectorPrompts.tsx:154`).
- P1: 5 `set-state-in-effect` findings (`AccountDetailView.tsx` ×1, `ConnectionsView.tsx` ×2, `ConnectorsExperience.tsx` ×2) — re-confirmed via a direct `eslint` run (`react-hooks/set-state-in-effect`), exact match to the original count and file distribution.
- P1: 3 `no-layout-property-animation` findings, `ConnectorRow/index.tsx:373-375` — re-confirmed, exact line match, unchanged from the original report.
- P1: 3 uncontrolled Framer Motion imports (`ConnectorCard`, `ConnectorRequestRow`, `ConnectorRow`) — re-confirmed.
- P2: 2 `no-derived-useState` findings (`AccountDetailView.tsx:413`, `ConnectionsView.tsx:192`) — re-confirmed, exact line match on `AccountDetailView.tsx` (413 unchanged); `ConnectionsView.tsx`'s `no-derived-useState` line is unchanged too (192).
- P3: 4 `label-has-associated-control` findings, all in `ConnectorRequestModal/index.tsx` — re-confirmed.

**Investigated and confirmed already correct / false positive — no code change:**
- `connectors/page.tsx:15`'s `useSearchParams()`-without-Suspense — already fixed by a prior, unrelated commit (§4).
- `ConnectorsExperience.tsx:77`'s `nextjs-no-client-side-redirect` — a legitimate URL-state-sync pattern, not a real anti-pattern (§5).
- The 6 `todo` React-Compiler-parse findings — a genuine, already-documented `try/finally` tooling limitation (§6), not fixed.

**A significant, honest scoping correction discovered this session, not in the original report:**
- **`ConnectorCard/index.tsx` and `ConnectorRequestRow/index.tsx` (2 of the 3 `use-lazy-motion` findings, plus `ConnectorRequestModal/index.tsx`, all 4 `label-has-associated-control` findings) are dead code — not imported anywhere in the live application.** Confirmed via a codebase-wide grep for their import paths: zero import sites for any of the three. (`ConnectorCard`'s own onboarding-page namesake, `src/app/(onboarding)/onboarding/connectors/page.tsx`, defines an unrelated *local* `function ConnectorCard(...)` — a naming coincidence, not a usage of the shared component.) Only `ConnectorRow/index.tsx` (the 3rd `use-lazy-motion` finding, and all 3 `no-layout-property-animation` findings) is genuinely live — rendered by `src/app/(app)/agent/configure/components/ConnectorsTab.tsx`, i.e. the **Agent Configure** feature's own connectors tab, not the `/connectors` route this report series otherwise scopes to. This means: (a) fixing `ConnectorCard`/`ConnectorRequestRow`/`ConnectorRequestModal` is still worthwhile (real source files, will matter if/when they're wired up, and cost nothing to fix correctly) but has **zero live user-facing effect today** and will not show up in any Lighthouse/live-test verification on any route; (b) the `ConnectorRow` fix (layout animation + lazy motion) **is** live, but the page to verify it on is `/agent/configure/connectors` (via ConnectorsTab), not `/connectors`. This is exactly the kind of "the static scanner grouped files by name, not by reachability" gap this series' own methodology (e.g. Pinboard's `ChatInterface`-scoping finding) is meant to catch — flagged here explicitly rather than silently verifying against the wrong page.

**Not part of this pass's required coverage, explicitly deferred (per the engagement brief):**
- `SetupModal.tsx`/`RemoveModal.tsx`'s `prefer-html-dialog` findings — no shared Dialog primitive exists in this codebase; a cross-feature refactor, out of scope.
- The 5 `no-high-complexity-react-function` / giant-component-adjacent findings (`ConnectorCard`, `ConnectorRow`, `ConnectionsView`, `ConnectorsExperience`, `SetupModal`) — no decomposition pass planned this engagement.
- The two-API-calls catalog-fetch pattern — confirmed still correct, deliberately not touched (§1).

See `05-connectors-feature-report.md` §10 for the phase-by-phase fix log, `05c-connectors-fixes-test-plan.md` for per-fix test cases, `05d-connectors-before-after-comparison.md` for the post-fix production Lighthouse re-scan, and `05e-connectors-manual-qa-checklist.md` for the hands-on click-through.

---

## 8. Lighthouse — pre-fix production baseline, `/connectors`, "All" tab

Methodology: `lighthouse` v13.5.0's `startFlow` API (Navigation mode) driven by a `puppeteer-core`-launched (not CDP-attached) Chromium, `--no-sandbox --disable-gpu --disable-dev-shm-usage`, `throttlingMethod: 'provided'` (zeroed) — the exact combination the Pinboard engagement's own `07b` established as avoiding both the `TARGET_CRASHED` failure mode and the simulated-throttling LCP/TTI inflation artifact seen in the Agents engagement. 3 consecutive runs against the disposable pre-fix worktree build on port 3000:

| Metric | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Performance score | 99 | 100 | 93 |
| Accessibility score | 84 | 84 | 84 |
| Best Practices score | 92 | 92 | 92 |
| SEO score | 100 | 100 | 100 |
| First Contentful Paint | 0.5 s | 0.5 s | 2.5 s |
| Largest Contentful Paint | 0.5 s | 0.5 s | 2.5 s |
| Total Blocking Time | 0 ms | 10 ms | 20 ms |
| Cumulative Layout Shift | 0.067 | 0.007 | 0.067 |
| Speed Index | 0.8 s | 0.9 s | 0.9 s |
| Time to Interactive | 0.6 s | 0.6 s | 2.6 s |
| Server response time (root doc) | 10 ms | 10 ms | 1,940 ms |

**Dramatically better than the original report's dev-mode numbers (Performance 37/100, TBT 1,950ms, CLS 0.138)** — confirming, once again, this whole series' own established dev-vs-prod finding: dev-mode Lighthouse numbers on this app are not representative of real production performance. Run 3's slow server-response (1,940ms) and correspondingly worse FCP/LCP/TTI is consistent with the `devapi.getsouvenir.com` intermittent-backend-latency pattern documented across 4-5 of the prior features in this series — not a frontend regression, and not something this pass's fixes could address (backend/infra, as noted in the original report). Accessibility (84) is unchanged from the original report's own dev-mode figure — expected, since Lighthouse's accessibility audits are largely DOM-structure-based and not sensitive to dev-vs-prod build differences the way performance timing metrics are.

The "Connected" tab was not independently re-measured this pass (time-boxed against the OAuth-popup live test and the codebase-wide `window.open` grep, both higher-priority per the engagement brief) — flagged as not done rather than fabricated.
