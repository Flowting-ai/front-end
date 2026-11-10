# Connectors Feature — Detailed Report

**Scope:** the third-party integration catalog — browsing, connecting, and managing tool connectors (CRMs, marketing tools, Slack, etc.) that agents and chats can use. Single-page app surface backed by a large catalog and an OAuth-style linking flow.

**How this was produced:** live, logged-in Playwright run against the local dev server, Lighthouse against the same authenticated session, and a static-analysis pass (`react-doctor`) filtered to this feature's files.

---

## 1. Pages in this feature

| Route | File | Purpose |
|---|---|---|
| `/connectors` | `src/app/(app)/connectors/page.tsx` | The entire feature — single page, tabbed (All / Connected / Not connected), searchable catalog grid |

Unlike every other feature audited so far, Connectors has **no sub-routes** — everything (browsing, connecting, account management, removal) happens via modals/panels layered over this one page (`ConnectorDetailView`, `AccountDetailView`, `SetupModal`, `RemoveModal`, `ConnectionsView`), orchestrated by `ConnectorsExperience.tsx`.

**Core components:** `ConnectorsExperience.tsx` (orchestrator), `ConnectorDetailView.tsx`, `AccountDetailView.tsx`, `ConnectionsView.tsx`, `SetupModal.tsx`, `RemoveModal.tsx`, plus catalog-card components `ConnectorCard/`, `ConnectorRow/`, `ConnectorRequestRow/`, `ConnectorRequestModal/` (the last two for requesting a connector that doesn't exist yet in the catalog).

**State/data layer:** `lib/useConnectorSetupFlow.ts` (drives the OAuth-style connect flow, including a `window.open` call — see §6 security note).

---

## 2. All API calls used by this feature

From `src/lib/config.ts` (`/connectors` block):

| Endpoint | Method | Used for |
|---|---|---|
| `/connectors` | GET | Catalog list — confirmed live with real query params: `?limit=100&linked=true` (Connected tab) and `?limit=10&linked=false` (catalog browse) |
| `/connectors/{slug}` | GET | Single connector detail |
| `/connectors/{slug}/link` | POST | Start the OAuth-style link flow |
| `/connectors/{slug}/complete` | POST | Complete linking after the OAuth redirect returns |
| `/connectors/accounts/{accountId}` | GET | Linked account detail (`AccountDetailView`) |

Smallest, simplest API surface of any feature audited so far — five endpoints, no versioning, no nested CRUD tree like Agents' `/persona/*` or Projects' `/projects/*`.

---

## 3. Live functional test results

### 3.1 `/connectors` — catalog, populated
Renders cleanly with a real, large third-party catalog: OCodeKit, 1CRM, 2Chat, 2markdown, 302.AI, 360NRS, 46elks, 4Dem, 8x8 Connect, Descript, and more, each with icon, name, one-line description, and a "+" connect affordance. Tabs (All / Connected / Not connected), search box, and a sort toggle all present and functional-looking. No visual defects.

**Confirmed via live network capture:** the page correctly issues two separate calls with different `linked=` query params — one for the "Connected" count/tab, one for the general catalog — rather than fetching everything and filtering client-side. This is a good, deliberate pattern, worth noting as a positive data point rather than only cataloguing problems.

**Recurring backend flakiness, again:** a live 502 was captured during this pass (same `devapi.getsouvenir.com` intermittent-timeout pattern documented in the Chats and Projects reports) — this is now confirmed across **four of the five** features audited (Chats, Brain/Tasks indirectly via `/brain`, Projects, Connectors), reinforcing that this is backend/infra-wide, not feature-specific.

### 3.2 Card interaction — **confirmed working, retested**
A follow-up pass targeted the "+" affordance specifically (rather than the card body, which the first attempt clicked): it correctly opens `SetupModal` — "Connect Ocodekit," an optional account-name field, and a clear "Who can use it?" choice between Shared and Private visibility, with "You can change this later from the account's Access tab" reassurance copy. Clean, well-designed, no defects. A follow-up click on "Continue to Ocodekit" was attempted to verify the OAuth-popup handoff itself, but that second click didn't land reliably within this pass (the modal isn't guaranteed to be in the same state across separate script runs) — the OAuth-popup leg specifically (and therefore whether the `window.open`-without-`noopener` finding in `useConnectorSetupFlow.ts` manifests as an exploitable issue in practice, versus just being present in the source) remains unverified. The setup-modal entry point itself, previously flagged inconclusive, is now confirmed working.

---

## 4. Lighthouse performance report

Same dev-mode caveat as the other four reports.

| Metric | `/connectors` |
|---|---|
| **Performance score** | **37 / 100** |
| Accessibility score | 84 / 100 |
| Best Practices score | 92 / 100 |
| SEO score | 100 / 100 |
| First Contentful Paint | 1.1 s |
| Largest Contentful Paint | 56.9 s ⚠️ dev-mode artifact |
| Total Blocking Time | **1,950 ms** |
| Cumulative Layout Shift | 0.138 (needs improvement) |
| Speed Index | 5.8 s |
| Time to Interactive | 58.0 s ⚠️ dev-mode artifact |
| Server response time (root doc) | 70 ms |

Mid-pack relative to the other four features — meaningfully better than Chats (19) and Projects (15-19), worse than Brain/Tasks (39-43). Server response time of 70ms is excellent — the best root-document time recorded in this whole audit series, notably contrasting with Projects' 5,370ms on a structurally similar single-page layout.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 12 files (2,865 LOC — the smallest feature by far):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **160** | **5** |
| **Share of styling touchpoints** | **96.97%** | **3.03%** |

Consistent with all four prior reports — no new information here; confirms the codebase-wide ~97/3 ratio holds even in the smallest feature examined.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**39 findings** (18 Performance, 5 Bugs, 5 Maintainability, 10 Accessibility, 1 Security; 9 errors / 30 warnings). Smallest total finding count of any feature, proportionate to its small file footprint — but the *density* (39 findings / 2,865 LOC ≈ 1 per 73 lines) is actually higher than Chats (231/21,576 ≈ 1 per 93) or Projects (85/7,522 ≈ 1 per 88), making this the **most finding-dense feature per line of code** audited so far.

### Highest-volume issues

| Count | Category/Severity | Rule | What it means | Where |
|---|---|---|---|---|
| 6 | Performance/error | React Compiler can't parse (`todo`) | Blocks auto-memoization | `AccountDetailView.tsx` (4×), `ConnectorsExperience.tsx` (2×) |
| 5 | Maintainability/warning | `no-high-complexity-react-function` | High control-flow complexity | `ConnectorCard/index.tsx`, `ConnectorRow/index.tsx`, `ConnectionsView.tsx`, `ConnectorsExperience.tsx`, `SetupModal.tsx` |
| 5 | Performance/warning | `set-state-in-effect` | Blocks React Compiler optimization | `AccountDetailView.tsx`, `ConnectionsView.tsx` (2×), `ConnectorsExperience.tsx` (2×) |
| 4 | Accessibility/warning | `label-has-associated-control` | Label missing associated control | all 4 in `ConnectorRequestModal/index.tsx` |
| 3 | Performance/warning | `use-lazy-motion` | Full Framer Motion import | `ConnectorCard`, `ConnectorRequestRow`, `ConnectorRow` |
| 3 | Performance/error | `no-layout-property-animation` | Layout-property animation | all 3 in `ConnectorRow/index.tsx:373-375` |

### Notable single findings

- **1× `no-derived-useState` × 2** (`AccountDetailView.tsx:413`, `ConnectionsView.tsx:192`) — same recurring props-into-state anti-pattern flagged in every prior report.
- **2× `prefer-html-dialog`** (`RemoveModal.tsx`, `SetupModal.tsx`) — same no-shared-Dialog-primitive pattern flagged repeatedly since the Chats report.
- **1× `nextjs-no-use-search-params-without-suspense`** (`connectors/page.tsx:15`) — a real Next.js correctness issue: `useSearchParams()` outside a `<Suspense>` boundary can break static rendering/cause a full-page client-render fallback.
- **1× `nextjs-no-client-side-redirect`** (`ConnectorsExperience.tsx:77`).
- **1× `window.open` without `noopener`** (`useConnectorSetupFlow.ts:110`, **Security**) — this is the connector OAuth-popup flow specifically; a reverse-tabnabbing risk on the exact code path that opens a third-party OAuth page, which is a more sensitive context for this bug class than the similar findings in the Chats report (`ConnectorPrompts.tsx:179`) since it's opening authentication flows to external services, not just external links.

Full file/line detail for all 39 findings is in the raw JSON generated this session (see §8).

---

## 7. Backlog — prioritized

**P0 — correctness/security**
1. `useConnectorSetupFlow.ts:110` — `window.open` without `noopener` on the OAuth-linking popup specifically. This is the second instance of this exact bug class found (first was Chats' `ConnectorPrompts.tsx`), but this one opens an actual authentication flow, raising the stakes slightly above the Chats instance.
2. `connectors/page.tsx:15` — `useSearchParams()` without a Suspense boundary; real Next.js correctness issue, not just a lint nit.
3. `SetupModal` itself is now confirmed working (§3.2); the remaining unverified leg is specifically the OAuth-popup handoff and `/connectors/{slug}/complete` callback — worth a follow-up with a real third-party OAuth target to close out.

**P1 — performance**
4. 6× React-Compiler-blocking findings concentrated in `AccountDetailView.tsx` (4 of 6) — the single file most responsible for this feature's Performance-error count, similar to how one file dominated in each prior report.
5. 3× layout-property animation, all three in the same three consecutive lines of `ConnectorRow/index.tsx` — a single, cheap fix (one animated property, one component) clears this feature's entire layout-animation finding count.
6. 3× uncontrolled Framer Motion imports, matching the pattern in every other feature's list-row components.

**P2 — maintainability**
7. `ConnectorCard`, `ConnectorRow`, `ConnectionsView`, `ConnectorsExperience`, and `SetupModal` are all flagged high-complexity — five files out of twelve, the highest *proportion* of complexity findings of any feature examined (5/12 ≈ 42% of this feature's files, vs. e.g. Projects' 7/16 ≈ 44% — comparable, both notably higher than Chats' or Agents' proportions).

**P3 — accessibility**
8. 4× label-association gaps concentrated entirely in `ConnectorRequestModal.tsx` — the "request a missing connector" form. One component, one fix, clears the finding.
9. Same `prefer-html-dialog` gap as three other features — reinforces the case for a shared Dialog primitive as a codebase-wide fix rather than five separate patches.

---

## 8. Cross-feature pattern check (now 5 features in)

Patterns confirmed independently across **all five** features (Chats, Agents, Brain/Tasks, Projects, Connectors):
- ~96-97% inline-style / ~3-4% Tailwind (now conclusively a codebase constant — no further per-feature measurement planned).
- Array-index/props-into-state/giant-component/uncontrolled-Framer-Motion/no-shared-Dialog patterns, each independently reappearing.
- Backend 502s from the same intermittent `devapi.getsouvenir.com` timeout — now observed in 4 of 5 features tested, essentially confirming it's a standing environment condition, not a per-feature fluke.

**New this report:** the `window.open`-without-`noopener` finding has now appeared **twice**, both times on flows that open third-party windows (a connector prompt in Chats, and the actual OAuth linking flow here) — this specific pattern is worth a codebase-wide grep for every `window.open(` call rather than treating each occurrence as independent, since the fix (`, 'noopener'` in the third arg, or `rel="noopener"` on an anchor equivalent) is identical everywhere.

---

## 9. Artifacts backing this report

Raw data (screenshots, Lighthouse JSON, network captures, full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.

---

## 10. Fixes applied (post-report follow-up)

Everything below was implemented in a later session, working through `05b-connectors-before-scan.md`'s revised backlog (which re-verified this report's own §7 backlog against live current code and a real production build, closing out two items as already-fixed-elsewhere and surfacing one significant scoping correction — see Phase 6 below) phase by phase, with the same verification gate at every checkpoint: `npx tsc --noEmit` (clean at every checkpoint), the full `vitest` suite (279 tests, unchanged from the Pinboard engagement's own final count — green at every checkpoint, zero regressions), a direct `eslint` run against every touched file (using `eslint-config-next`'s bundled `eslint-plugin-react-hooks`, which ships the React Compiler's own `set-state-in-effect`/`refs` diagnostics — the closest available substitute for `react-doctor`, which **was not available in this session's tool list at all**), and live Playwright testing against two independently-built production servers: a disposable pre-fix build (a `git worktree add --detach ../connectors-before-check HEAD` checkout — a non-destructive, additive git operation; the main tree's other in-progress/uncommitted work was never touched) and the main tree's own post-fix build. See `05b-connectors-before-scan.md` for the full pre-fix baseline this phase log works from.

### Phase 1 — P0: codebase-wide `window.open` sweep — 8 of 8 missing-`noopener` sites fixed

1. **Grepped the entire `front-end/src` tree for every `window.open(` call — 22 total, 8 missing `noopener`** (full catalog in `05b-connectors-before-scan.md` §3). Two distinct fix shapes were needed, decided per call site by whether its return value is used afterward:
   - **One-shot calls whose return value is never read** (`useConnectorSetupFlow.ts:110`'s popup-blocked fallback, `settings/plans-and-billing/page.tsx` ×2, `settings/help/page.tsx`) — fixed with a plain `'noopener'` (or `'noopener,noreferrer'`, matching the codebase's own more common convention on the billing/help pages) appended to the existing feature string, with each call site's existing arguments (target names, popup dimensions) individually verified first so nothing was clobbered.
   - **"Open blank, retain the reference, navigate it later" popups** (`useConnectorSetupFlow.ts:80`, `ConnectorPrompts.tsx:154`, `brain/page.tsx`'s own inline connect handler, `agent/configure/knowledge/page.tsx`'s file-preview tab) — these can't simply pass `'noopener'` to `window.open()`, since that makes the call return `null` in most browsers, breaking the later `popup.location.href = …` assignment every one of these relies on (this is exactly why each was left unprotected in the first place, per their own code comments). Fixed instead with `if (popup) { try { popup.opener = null } catch {} }` immediately after opening — `Window.opener` is settable cross-origin without invalidating the caller's own reference, so this severs the popup's own `window.opener` (closing the reverse-tabnabbing vector) while `popup.location`/`.closed`/`.close()` all keep working exactly as before.
2. **The Connectors OAuth popup (`useConnectorSetupFlow.ts:80`) — this pass's headline fix — live-verified precisely, on a real, working connect flow, not a synthetic reproduction.** Using the pre-fix disposable build: clicked "Connect 0codekit" → `SetupModal` → "Continue to 0codekit" → a real popup opened, navigated to `https://pipedream.com/_static/connect.html?connectLink=true&token=…&app=_0codekit` (confirming these connectors broker OAuth through Pipedream Connect) → `popup.evaluate(() => window.opener === null)` returned **`false`**, both immediately after opening and after the navigation to the real third-party origin settled — a live, direct confirmation of the exact vulnerability the original report's own live testing couldn't close out. Re-ran the identical script against the post-fix build: same flow, same real popup, same real Pipedream URL — `window.opener === null` now returns **`true`** at both checkpoints. Closing the popup without completing auth was also exercised on both builds: the parent tab recovers cleanly either way (full DOM still present, a cancellation-related message shown, no hang, no console error) — this specific recovery behavior was never broken and isn't part of what changed.
3. **The still-open Chats-feature sibling (`ConnectorPrompts.tsx:154`) — fixed as part of this same sweep, per the engagement brief's explicit instruction.** `git log`/`git show` (commit `da89ccd2`) confirmed the *other* `window.open` call in this same file (the popup-blocked fallback, now line 181) was already fixed in a prior session — but the primary, deferred-navigation popup at line 154 carries the identical exposure as the Connectors instance and had never been touched. Fixed with the same `popup.opener = null` technique. Not independently re-verified against a live third-party connector prompt in the Chats feature this session (out of this engagement's primary scope, and the mechanism is identical and already proven against the Connectors flow) — the fix is a direct, mechanical application of the same proven pattern.
4. **`brain/page.tsx`'s own inline connector-connect handler — fixed, same technique.** This is a third, independent implementation of the OAuth-popup pattern (doesn't share code with `useConnectorSetupFlow.ts` or `ConnectorPrompts.tsx`) discovered only by the codebase-wide grep this engagement's brief called for — exactly the kind of instance a file-by-file fix (rather than a grep-driven sweep) would have missed.
5. **`agent/configure/knowledge/page.tsx`'s file-preview-in-new-tab flow — fixed, same technique**, applied to `newTab` rather than a `popup`-named variable; same reasoning (a remote file's rendered content could otherwise reach back into the parent tab via `window.opener`).

### Phase 2 — P0: `connectors/page.tsx`'s `useSearchParams()`/Suspense finding — confirmed already fixed, no code change

6. **Traced via `git log`/`git show`**: the file already wraps its `useSearchParams()`-calling component in a proper `<Suspense fallback={null}>` boundary, and has since commit `f0d94b76` (Aug 30 — well before this engagement). The original report's P0 finding here does not hold against current code. Confirmed what `initialSearch` is actually used for (pre-filling the catalog search box from a `?q=` deep link) before concluding this, per the engagement brief's instruction not to assume a trivial fix without checking real usage — see `05b-connectors-before-scan.md` §4.

### Phase 3 — P1: the 6 `todo` React-Compiler-parse findings — investigated, confirmed the same tooling limitation found in the Agents engagement, not fixed

7. **Grepped both flagged files for `try { … } finally { … }` blocks**: exactly 4 in `AccountDetailView.tsx`, exactly 2 in `ConnectorsExperience.tsx` — 4 + 2 = 6, an exact match to the original count and file split. `next.config.ts` confirms `reactCompiler: true`. This is the identical `try/finally`-parsing gap the Agents engagement traced for its own 27 `todo` findings (`02c-agents-fixes-test-plan.md` TC-4.1) in this version of `babel-plugin-react-compiler`. **Not fixed** — restructuring every `try/finally` in these files into a compiler-parseable shape would meaningfully hurt readability for a purely cosmetic auto-memoization gain the app doesn't depend on, matching the Agents engagement's own precedent exactly.

### Phase 4 — P1: the 5 `set-state-in-effect` findings — 4 fully fixed, 1 partially fixed with an honestly-documented remainder

8. **`AccountDetailView.tsx`'s `PermissionsTab` tools-fetch effect — fixed, and turned out to be a pure no-op removal, not a restructuring.** The flagged line (`setLoadingTools(false)` in the effect's early-return branch, when `tools.length > 0`) was provably redundant in every reachable case: `loadingTools`'s own initializer (`catalog.tools.length === 0`) already starts `false` whenever tools arrive pre-populated, and on every other path this same effect's own `.finally()` already flips it `false` the moment the fetch resolves — the early-return branch's own call could only ever re-set a value that was already correct. Replaced with a bare `return`.
9. **`ConnectionsView.tsx`'s pagination-reset effect (`setPage(1)`; `cursorsRef.current = [undefined]`) — fixed, converted to React's documented "adjust state when a dependency changes" render-time pattern.** A `paginationKey` (`` `${view}::${debouncedQuery}` ``) is compared against a tracked `syncedPaginationKey` during render; on a mismatch, both are updated and `setPage(1)` fires inline — no effect needed for the state half. The `cursorsRef` reset **couldn't** move into that same render-time block (`eslint` correctly flagged writing a ref's `.current` during render as its own violation, `react-hooks/refs` — refs may only be written in effects/handlers) — it stays in a small dedicated `useEffect(() => { cursorsRef.current = [undefined] }, [paginationKey])`, which runs in the same commit, in declaration order, before the browse-fetch effect that reads it (confirmed correct: effects fire in declaration order within one commit).
10. **`ConnectionsView.tsx`'s browse-fetch effect — the reset branch fixed, one legitimate remainder deliberately left as an Effect.** The originally-flagged line (an early `setBrowseItems([]); setBrowseHasMore(false); setBrowseBusy(false)` reset when the Connected tab has no search term — a case this component's own render logic already ignores `browseItems` for, since `source` falls back to `linkedRows` there) was converted to the same `skipBrowse`-vs-`syncedSkipBrowse` render-time-adjustment pattern as item 9. Re-running `eslint` after that fix surfaced a **second, previously-masked** violation on the same effect's own `setBrowseBusy(true)` fetch-kickoff line — `react-doctor`/this rule reports only the first synchronous `setState` found per effect, so fixing the first exposed the second rather than the tool having missed it originally. **Investigated and deliberately left as an Effect**: `setBrowseBusy(true)` immediately before an `await`-ing network call, with the flag flipped back in `.finally()`, is the textbook data-fetching pattern from React's own official documentation, not the "you might not need an Effect" anti-pattern the rule exists to catch — forcing every loading-flag toggle into a render-time derivation would fight the framework rather than fix a real bug, and this specific fetch genuinely needs to re-show its busy state on every subsequent search/pagination change, not just once at mount (ruling out the "already-true-at-declaration" trick used in item 11 below).
11. **`ConnectorsExperience.tsx`'s mount-fetch effect (`void fetchAll()`) — fixed by inlining the mount-only fetch logic directly, rather than by adding a flag to `fetchAll`.** An initial attempt (a `showLoading` boolean parameter, defaulting `true`, with the mount effect calling `fetchAll(false)`) did **not** satisfy the linter — confirmed by re-running `eslint`, which still flagged the call site — because the rule traces into the *callee's own body* for a reachable synchronous `setState`, regardless of the literal argument passed at a specific call site. Since `loading`'s own `useState` initializer already starts `true`, the mount effect never actually needed to set it again — only needed to flip it back to `false` once the request settles. Rewrote the mount effect to call `listLinkedConnectors()` directly, with `setCatalog`/`toast.error`/`setLoading(false)` only inside `.then()`/`.catch()`/`.finally()` — the documented, allowed "setState in an async callback" shape. `fetchAll` itself is untouched and still used as-is by `confirmRemove`/`handleSetupConnected`, both invoked from event handlers, which the rule doesn't scan.
12. **`ConnectorsExperience.tsx`'s view-validation-redirect effect (`if (!active || accountMissing) backToConnections()`) — fixed, converted to a self-terminating render-time adjustment.** This is a pure "does the current view still make sense given the data we have" check with nothing external to subscribe to — computed the same `invalidView` boolean during render and called `backToConnections()` directly, guarded by that boolean. Verified this terminates rather than looping: `backToConnections()` sets `view` to `'connections'`, which makes `invalidView` false on the very next evaluation (the same guarantee React's own docs describe for this pattern). This is also a small behavioral improvement on top of the compiler-rule fix: because the correction now happens *before* React commits the "invalid" render to the DOM (rather than after, via a post-commit effect), a user whose active connector/account just went missing no longer sees even a one-frame flash of the stale view before being bounced back.
13. **Net for this phase: 4 of 5 findings fully resolved to zero remaining `eslint` errors** (`AccountDetailView.tsx`, both `ConnectorsExperience.tsx` effects, `ConnectionsView.tsx`'s pagination effect); **the 5th (`ConnectionsView.tsx`'s browse-fetch effect) has its originally-flagged line fixed and confirmed correct, with one newly-surfaced, deliberately-undisturbed legitimate Effect usage documented rather than silently left unmentioned.**

### Phase 5 — P1: the 3 `no-layout-property-animation` + 3 `use-lazy-motion` findings — fixed, with an honest reachability caveat

14. **`ConnectorRow/index.tsx:373-375`'s `height`/`opacity` keyframe animation — fixed with the `layout` prop**, the same mechanism established across every prior engagement in this series (the app's shared `MotionProvider` already loads Framer Motion's `domMax` feature set, confirmed via `grep`, so `layout` makes the OAuth-panel's expand/collapse animate via a FLIP-computed transform instead of a raw per-frame `height` mutation). This is a load-bearing height animation (the panel pushes sibling rows down as it expands) — ruling out a naive `transform: scaleY` swap, same reasoning as every prior feature's equivalent finding.
15. **All 3 `use-lazy-motion` findings (`ConnectorCard`, `ConnectorRequestRow`, `ConnectorRow`) — fixed, mechanical `motion`/`AnimatePresence` → `m`/`AnimatePresence` import swap.**
16. **A significant, honest scoping correction surfaced while verifying reachability for live-testing (not something the original report or this pass's own initial grep caught): `ConnectorCard/index.tsx` and `ConnectorRequestRow/index.tsx` are dead code — confirmed via a codebase-wide grep for their import paths, zero import sites for either, anywhere.** `ConnectorRequestModal/index.tsx` (the file with all 4 `label-has-associated-control` findings, Phase 7 below) is equally dead — referenced exactly once anywhere in `src`, in an unrelated code *comment*, never imported. Only `ConnectorRow/index.tsx` is genuinely live, rendered by `agent/configure/components/ConnectorsTab.tsx` — the **Agent Configure** feature's own connectors tab (`/agent/configure/connectors`), not the `/connectors` route this report otherwise scopes to. **This means the `ConnectorCard`/`ConnectorRequestRow`/`ConnectorRequestModal` fixes in this phase and Phase 7 are real, correct, worthwhile source changes with zero live user-facing effect today** — they will not show up in any Lighthouse run or manual click-through on any current route, since nothing renders them. Flagged explicitly rather than implying (or worse, fabricating) a live verification for code nothing currently mounts. `ConnectorRow`'s own fix **is** live — see Phase 9 for where it was actually exercised.

### Phase 6 — P2: the 2 `no-derived-useState` findings — fixed, both with a concrete "why this matters" scenario identified, not just a mechanical pattern swap

17. **`AccountDetailView.tsx:413`'s `SettingsTab` (`const [label, setLabel] = useState(account.nickname)`) — fixed.** Concrete gap this closes: `AccountDetailView` has no `key={account.id}`, and `PermissionsTab`'s `onChanged()` (fired after any permission/access/label edit) refetches via `loadDetail(active.slug)`, producing a new `account` object without remounting `SettingsTab` — a plain one-shot `useState(account.nickname)` would never notice if the account's true nickname changed underneath it. Converted to React's documented "adjust state when a prop changes" pattern: a tracked `syncedNickname` compared against `account.nickname` during render, re-adopting `label` on a real mismatch — deliberately comparing by *value*, not by the `account` object's identity, so an unrelated refetch (e.g. a tools/permission change on the same account) that leaves the nickname text unchanged does **not** clobber an in-progress, unsaved edit to the label field.
18. **`ConnectionsView.tsx:192`'s `Catalog` (`const [ownQuery, setOwnQuery] = useState(query)`) — fixed, same technique.** Concrete gap: `query` (the `initialSearch` deep-link, e.g. `/connectors?q=slack` from a quick action elsewhere in the app) only seeded the search box once; a second quick-action link changing the URL's `?q=` while `/connectors` stayed mounted (a client-side navigation, not a hard reload) would silently leave the search box showing the old term. Same render-time re-adoption pattern as item 17.

### Phase 7 — P3: the 4 `label-has-associated-control` findings — fixed, one component, real `htmlFor`/`id` associations

19. **All 4 labels in `ConnectorRequestModal/index.tsx`** ("Tool / service name", "Website or app URL", "What do you need it to do?", "How blocking is this?") **given real `id`/`htmlFor` pairings** to their respective controls (two `InputField`s, a `textarea`, and the `UrgencyDropdown`'s trigger `<button>` — `<label for>` is valid on a `<button>` per the HTML spec's list of labelable elements, so the urgency label now correctly focuses/activates its dropdown trigger). Kept each label's exact existing inline styling rather than switching to `InputField`'s own built-in `label`/`Field.Label` mechanism (which would have worked too, via Base UI's `Field.Root`, but pulls its color from a different design-token variable than the original hand-styled `var(--neutral-700)`, a visual difference not worth introducing for an accessibility-only fix). **Per Phase 5 item 16: this component is dead code today, zero live reachability — a correct fix with no current user-facing verification path.**

### Phase 8 — investigated and confirmed not a bug, no code change

20. **`ConnectorsExperience.tsx:77`'s `nextjs-no-client-side-redirect` finding.** Traced to a `router.replace(…, { scroll: false })` call that keeps the address bar's `?tab=` query param in sync with the currently-open account tab (permissions/access/settings) — a one-way URL-state-sync for shareable/bookmarkable/back-button-safe deep links, not an imperative "redirect the user elsewhere" the rule is built to catch. No flash-of-wrong-content symptom exists here since rendered content never depends on this effect running. Left unchanged — see `05b-connectors-before-scan.md` §5 for the full trace.

### Not attempted this pass (per the engagement brief's explicit scope limits)

21. A shared Dialog primitive to clear the `prefer-html-dialog` findings on `RemoveModal.tsx`/`SetupModal.tsx` — explicitly out of scope (cross-feature, too large for this pass). Still unaddressed; same recurring gap flagged in 3+ prior reports in this series.
22. The two-separate-API-calls catalog-fetch pattern — confirmed still correct on both the pre-fix and post-fix builds, deliberately not touched.
23. The `no-high-complexity-react-function`/giant-component findings on `ConnectorCard`, `ConnectorRow`, `ConnectionsView`, `ConnectorsExperience`, `SetupModal` — no decomposition pass planned or attempted this engagement.

### Net result

All 8 `window.open` call sites missing `noopener` fixed across the whole `front-end/src` tree (not just the two originally-flagged instances) — headlined by a live, direct, on-a-real-working-OAuth-flow confirmation that the Connectors popup's `window.opener` was genuinely non-null before this fix and is genuinely `null` after it, on both a disposable pre-fix production build and the real post-fix one; the Suspense finding confirmed already fixed by a prior, unrelated commit; the 6 `todo` findings confirmed a genuine, already-documented React-Compiler tooling limitation (not fixed, matching the Agents engagement's own precedent); 4 of 5 `set-state-in-effect` findings fully resolved to zero remaining lint errors, the 5th fixed at its originally-flagged line with one legitimate, necessary Effect usage knowingly left in place and explained; all 3 layout-property-animation and all 3 lazy-motion findings fixed; both `no-derived-useState` findings fixed with a concrete real-world staleness scenario identified for each; all 4 label-association findings fixed with real `htmlFor`/`id` pairings; the `nextjs-no-client-side-redirect` finding investigated and confirmed a legitimate pattern. **One significant, unplanned discovery**: 3 of the 12 files this feature's static analysis grouped together (`ConnectorCard`, `ConnectorRequestRow`, `ConnectorRequestModal`) are dead code, never imported anywhere in the live app — their fixes are real and correct but have no live surface to verify against today; `ConnectorRow` is live, but on the Agent Configure feature's own route, not `/connectors`. `npx tsc --noEmit` and the 279-test `vitest` suite stayed green at every checkpoint; zero regressions found in any live-reachable path tested.

See `05b-connectors-before-scan.md` for the pre-fix production baseline (including the disposable-worktree methodology and the full `window.open` catalog), `05c-connectors-fixes-test-plan.md` for the full test-case breakdown of every fix above, `05d-connectors-before-after-comparison.md` for the post-fix production Lighthouse re-scan, and `05e-connectors-manual-qa-checklist.md` for a hands-on click-through of the whole feature post-fix.
