# Pinboard Feature — Pre-Fix Production Baseline Scan

Companion to `07-pinboard-feature-report.md` (original findings — no production Lighthouse, no user-flow measurement, panel-vs-eager-fetch distinction flagged but not nailed down to exact lines). This is a from-scratch, live, logged-in session against a clean **production build** (`npm run build` → `npm run start`), following the methodology established by the Chats/Projects/Agents/Brain-Tasks engagements. No code changes had been made yet when everything in this document was captured — see `07-pinboard-feature-report.md` §10 for what happened next, `07d-pinboard-before-after-comparison.md` for the re-scan.

**Methodology:** fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD` against the real Auth0-hosted login flow, driven by throwaway Node driver scripts kept in a local scratchpad (not committed) using `playwright-core` (already a transitive dependency in this repo's `node_modules`, so no download needed) for functional/network testing, and `puppeteer-core` + `lighthouse`'s programmatic `startFlow` API (both resolvable from the global npx cache in this environment) for the user-flow performance measurement. The `front-end:react-doctor` skill was **not available in this session's skill list at all** (matching the "inconsistently available" note — it worked for Agents/Brain-Tasks, was policy-blocked-but-listed for Projects, and simply doesn't appear this session) — every finding below was re-derived from first principles: direct code reads, `grep` sweeps for each original finding's specific pattern, and live Playwright verification. Baseline gates: `npx tsc --noEmit` clean, `npm run test` (vitest) 277/277 passing, both confirmed immediately before this scan.

---

## 1. The P0 eager-bootstrap-fetch finding — confirmed, exact mechanism nailed down

`src/context/pinboard-context.tsx`'s `PinboardProvider` wraps `src/app/(app)/layout.tsx` at line 35 — i.e. it wraps **every authenticated page in the app** (`/chat`, `/chats`, `/projects/new`, `/brain`, everything under the `(app)` route group), not just chat/panel surfaces.

The eager fetch fires from a mount-only `useEffect` at **lines 220-231**:

```ts
useEffect(() => {
  const snap = readCache();
  if (snap) {
    setPins(snap.pins);
    setFolders(snap.folders);
    setIsLoading(false);
    if (!isCacheFresh(snap)) load(false); // stale — revalidate in background
  } else {
    load(false); // no cache — fetch fresh
  }
}, []);
```

`load()` (lines 169-212) calls `Promise.all([listPins(), listPinFolders()])`, i.e. `GET /pins` and `GET /pins/folders/all`, completely independent of `isOpen` (the panel's own open/closed state) or any user action. The only thing standing between "every page load" and "a real network call" is a **stale-while-revalidate cache** (`CACHE_KEY = "sb_pinboard_v1"`, `CACHE_TTL_MS = 60_000`, lines 27-59) that this engagement's initial scan session did not know about at the time the original report was written — it means a *second* page navigation within 60 seconds of the first skips the fetch, which is almost certainly why the original report's own live test (opening the panel on `/chat` after some browsing) saw a "clean, on-demand-looking" fetch rather than a duplicate one. **The cache does not change the underlying bug**: it only narrows the window in which a fresh/stale-page-load fires the eager fetch — any first visit this session, or any page visited more than 60 seconds after the last one, still fires it unconditionally.

**Live-verified, precisely, this session** — a cold-cache visit (this session's driver script clears `localStorage`'s `sb_pinboard_v1` key, then reloads, simulating a first-ever visit or a >60s-stale one) to each of the three pages the Chats/Projects/original-Pinboard reports actually touched:

| Page | `GET /pins` fired? | `GET /pins/folders/all` fired? | Timing (from navigation start) |
|---|---|---|---|
| `/chats` | **Yes** | **Yes** | +339ms |
| `/projects/new` | **Yes** | **Yes** | +350ms |
| `/brain` | **Yes** | **Yes** | +406ms |

This is an exact, live reproduction of the cross-feature bug the Chats report and the Projects report each independently captured as a 502/`[PinboardContext] Failed to load pins` error on pages that have nothing to do with pins — confirmed here on **three different pages**, none of which ever opened the Pinboard panel. (This session's backend returned 200s, not 502s, for all these calls — the original reports' 502s were the backend's own transient flakiness, already documented repeatedly throughout this whole series; this session's contribution is nailing down that the *front-end* fires these calls unconditionally regardless of backend health, which is the actual, fixable, Pinboard-owned half of that bug.)

With a warm cache (navigating between pages within the same 60-second window), the calls correctly do **not** re-fire — confirmed by a second run hitting `/chats` → `/projects/new` → `/brain` in quick succession, where only the first page's load fired the two calls.

**Fix target for Phase 2:** move the `load()` call out of the unconditional mount effect and into something gated on the panel actually being needed — first `open()`/`toggle()`/`openForChat()` call, or the existing `prefetch()` (already wired to the rail button's `onMouseEnter` in `FloatingPanel.tsx:177`, but not to anything on plain page mount).

---

## 2. The 2 (really 3) impure-state-updater findings — confirmed, one more found

### 2.1 `addPin`, line 252 — confirmed, exact line match
```ts
const addPin = useCallback(async (pin: Omit<PinItem, "id" | "createdAt">) => {
  let tempId: string | null = null;
  setPins((prev) => {                                    // ← line 252
    if (prev.some((p) => p.messageId === pin.messageId)) return prev;
    const id = `pin-temp-${Date.now()}`;
    tempId = id;                                          // side effect: writes outer `tempId`
    return [{ ...pin, id, createdAt: new Date().toISOString() }, ...prev];
  });
  if (!tempId) return;
  ...
```
The updater mutates the outer-scope `tempId` variable as a side effect of computing the new state. If React invokes this updater more than once for a single state update (Strict Mode's intentional double-invoke, concurrent-rendering re-runs), `tempId` gets reassigned on the discarded invocation too — harmless in isolation here since the *value* would be the same on both invocations in the overwhelmingly common case (same `Date.now()` millisecond), but it's still a textbook purity violation the updater has no business performing, and closes over the exact same fragility class documented in the Brain report's `timelineSeqRef` findings.

### 2.2 `removePinByMessage`, line 331 — confirmed, exact line match
```ts
const removePinByMessage = useCallback((messageId: string, options?: { silent?: boolean }) => {
  let targetId: string | undefined;
  setPins((prev) => {                                     // ← line 331
    const pin = prev.find((p) => p.messageId === messageId);
    targetId  = pin?.id;                                   // side effect: writes outer `targetId`
    return prev.filter((p) => p.messageId !== messageId);
  });
  if (targetId && !targetId.startsWith("pin-temp-")) {
    deletePin(targetId)...
```
Same shape: `targetId` is written from inside the updater so the code after `setPins(...)` can read which pin was actually removed and fire its `DELETE /pins/{id}` call. A double-invoke here is more consequential than 2.1's: if the two invocations of the updater see *different* `prev` snapshots (possible under concurrent rendering, since React may re-run an updater against a newer state than the one queued), `targetId` could end up pointing at the wrong pin, and the wrong pin's delete-confirmation toast/API call could fire.

### 2.3 `updatePinComment`, lines ~401-441 — **newly discovered this session, more severe than either of the two the original scan caught**
```ts
const updatePinComment = useCallback((id: string, text: string) => {
  if (id.startsWith("pin-temp-")) return;
  setPins((prev) => {
    const pin = prev.find((p) => p.id === id);
    if (!pin) return prev;
    const existingComment = pin.comments?.[0];
    if (!text.trim()) {
      if (!existingComment) return prev;
      deletePinComment(id, existingComment.id).catch(...)      // ← network call inside updater
      return prev.map((p) => p.id === id ? { ...p, comments: [] } : p);
    }
    if (existingComment) {
      editPinComment(id, existingComment.id, text).then(...).catch(...)  // ← network call inside updater
      return prev.map(...);
    }
    addPinComment(id, text).then(...).catch(...)              // ← network call inside updater
    return prev.map(...);
  });
}, []);
```
This one doesn't just mutate a local variable — it fires a real network mutation (`deletePinComment`/`editPinComment`/`addPinComment`) **from inside the state-updater callback itself**. If React ever invokes this updater twice for one state transition, this fires the corresponding API call twice — a duplicate comment-delete, a duplicate comment-edit, or (worst case) two comments created server-side for what the user experienced as a single save. This almost certainly wasn't caught by the original `react-doctor` pass because the side-effecting calls are nested inside conditional branches rather than sitting as a single flat statement (the same shape of miss `react-doctor` had for the Brain engagement's tool-connect label finding, per that report's own honesty notes) — but it is a real, live code path, confirmed by direct read, not a static-tool artifact. **Flagged as a newly-discovered, higher-priority-than-either-original-finding fix target for Phase 2.**

All three share one root idiom: a side effect (local-variable write or a real API call) performed *inside* a `setState` updater instead of in the surrounding (impure-is-fine) callback scope. Fix approach for all three, decided in Phase 2: compute the side-effect-relevant value **before** calling `setPins`, so the updater itself becomes a pure function of `prev`.

---

## 3. `export-pins.ts:69`'s HTML-injection sink — traced in full; **not currently exploitable, but fragile**

Exact sink: `renderAndDownloadPdf()`, line 69:
```ts
const container = document.createElement("div")
...
container.innerHTML = docHtml            // ← line 69, the flagged dangerous-html-sink
document.body.appendChild(container)
```

`docHtml` is built by `buildDocHtml()` (lines 45-52), which concatenates the output of `buildPinCard()` (lines 25-43) for every pin being exported. **Traced every interpolation point that reaches this sink:**

| Field | User/AI-controllable? | Escaped before reaching the sink? |
|---|---|---|
| `pin.title` / `pin.content` (card heading + body) | **Yes** — pin content is a chat message or highlighted text, arbitrary user- or model-generated text | **Yes** — `escapeHtml(stripMarkdown(...))`, line 37-38 |
| `pin.category` | Nominally a closed union (`PinCategory`), but the API layer casts an untyped backend string into it (`pinboard-context.tsx:182`, `(p.category as PinCategory) ?? "Code"`) — not actually guaranteed safe at runtime | **Yes** — `escapeHtml(pin.category)`, line 31 |
| `pin.tags` | **Yes** — user-authored tag strings | **Yes** — `pin.tags.map(escapeHtml)`, line 29 |
| chat name (`chatNameById.get(...)` / `pin.chatName`) | **Yes** — a chat's title is user-editable | **Yes** — `escapeHtml(chatName)`, line 33 |
| `label` ("1 pin"/"N pins") and `now.toLocaleString()` in `buildDocHtml` | No — computed internally, not user data | N/A |

`escapeHtml()` (lines 4-11) is a standard, correct 5-entity escaper (`&`, `<`, `>`, `"`, `'`). **Concretely tested this session** (Phase 2, alongside the fix — see `07-pinboard-feature-report.md` §10): a pin titled `<img src=x onerror="alert(document.cookie)">` and a comment/tag containing `"><script>alert(1)</script>` both produce fully-neutralized, inert text in the constructed HTML — no tag, attribute, or script boundary survives escaping. **Concrete would-be exploit path, and why it's closed today:** if any one of the five interpolation points above were changed by a future edit to skip `escapeHtml` (e.g. someone adds a new field to the exported card and forgets to escape it — the exact kind of mistake this rule class exists to catch), a pin titled with an `<img onerror=...>` or `<script>` payload would execute in the exported document's DOM context during the brief window between `container.innerHTML = docHtml` and `html2canvas(container)` capturing it (lines 70-73) — a genuine, if narrow, self-XSS-via-export window (the exported HTML is only ever rendered in *this* user's own browser, off-screen, for ~milliseconds before being canvas-rendered and removed; it is never sent anywhere or rendered for another user, so the realistic blast radius is limited to the exporting user's own session, not a stored/shared XSS against other users).

**Verdict: not exploitable in the current code, every field is escaped — but the sink itself (`innerHTML` fed a hand-built string) is a fragile invariant that depends on every future contributor remembering to keep calling `escapeHtml`.** Per the engagement brief's instruction to fix properly rather than just relabel a false positive, Phase 2 restructures this to build real DOM nodes (`textContent`, not string interpolation) so the sink is removed at the root rather than merely trusted to stay escaped — see `07-pinboard-feature-report.md` §10.

---

## 4. The 12 layout-property-animation findings — confirmed exact count and locations

A full sweep for `height: 0` / `height: 'auto'` keyframe pairs across this feature's files found **exactly 3 sites, each with `initial`/`animate`/`exit` keyframes (3 props × 3 sites = 9)** ... plus one of the three sites is actually two near-identical sites in the same file, for **4 sites total, 3 × 4 = 12**:

| File | Site | Lines (pre-fix) |
|---|---|---|
| `HighlightPanel/index.tsx` | "Filter status line" (`<m.p key="filter-status">`) | 293-316 |
| `HighlightPanel/index.tsx` | "Search result count" (`<m.p key="result-count">`) | 319-344 |
| `Pinboard/index.tsx` | "Active-filter chip bar" (`<m.div key="filter-bar">`) | 1534-1547 |
| `PinboardExpanded/index.tsx` | "Expanded filter bar" (`<m.div key="expanded-filter-bar">`) | 1073-1079 |

4 sites × 3 keyframe props = **12**, matching the original report's total exactly (the original summary line's "HighlightPanel (6×), Pinboard (3×), PinboardExpanded +2" undercounted PinboardExpanded by one keyframe prop in its own shorthand — 2 sites in HighlightPanel account for its 6, 1 site in Pinboard accounts for its 3, and 1 site in PinboardExpanded accounts for 3, not "+2" — a minor arithmetic imprecision in the original summary's prose, not a finding that doesn't hold up). All 4 sites already use the code-splittable `m` import, and in every case the height animation is load-bearing — each is a filter-bar/status-line that pushes sibling content down as it expands, ruling out a naive `transform: scaleY` swap for the same reason the Brain and Agents engagements found for their own equivalent findings. **Fix approach for Phase 2:** Framer Motion's `layout` prop (this app's shared `MotionProvider` already loads `domMax`, confirmed by grep, same as the Brain-Tasks engagement's own equivalent fix).

---

## 5. The 4 `AnimatePresence` exit-animation-misuse findings — 3 confirmed real, 1 confirmed already-fixed

### 5.1 `HighlightPanel/index.tsx` — 2 real, confirmed bugs (lines 363-430)
```tsx
{isLoading ? (
  <m.div key="loading" ... exit={{ opacity: 0 }} ...>...</m.div>
) : hasError ? (
  <m.div key="error" ... exit={{ opacity: 0 }} ...>...</m.div>
) : (
  <>
    <AnimatePresence initial={false}>{filtered.map(...)}</AnimatePresence>
    <AnimatePresence initial={false}>{filtered.length === 0 && (...)}</AnimatePresence>
  </>
)}
```
The `loading` and `error` `m.div`s each declare an `exit` transition, but **neither is wrapped in any `AnimatePresence` at all** — they're two branches of a ternary that gets swapped for a completely different subtree (the `<>` fragment) the instant `isLoading`/`hasError` flips. React removes the old branch and mounts the new one in the same commit; with no `AnimatePresence` ancestor to intercept that removal, the `exit` props are dead code — the loading skeleton and the error state both just vanish instantly rather than fading out. This is the literal, textbook shape of `motion-animate-presence-must-outlive-child`: an animated child whose unmount is never actually governed by an `AnimatePresence`.

### 5.2 `Pin/index.tsx`, lines 1397-1447 — 1 real, confirmed bug (narrower, edge-case)
```tsx
<AnimatePresence initial={false}>
  {isExpanded && (
    <m.div key="expanded-content" ... exit={{ opacity: 0, transition: { duration: 0 } }}>
      ...
      <PinCommentField
        rightSlot={
          <AnimatePresence>                                    {/* ← nested */}
            {(commentDraft !== savedComment || commentSavedAnim) && (
              <m.div key="comment-save-btn" ...>...</m.div>
            )}
          </AnimatePresence>
        }
      />
    </m.div>
  )}
</AnimatePresence>
```
The inner `<AnimatePresence>` (governing the Save/Saved button's own enter/exit) only exists in the tree while `isExpanded` is true — it mounts and unmounts together with the entire `expanded-content` block, which itself exits with a **0ms** duration. So under the specific sequence "user has an unsaved comment draft, then collapses the pin" the Save button's own exit animation never gets to run — it disappears along with the whole expanded section, which is already animating away in 0ms anyway. **Narrower than 5.1**: the inner `AnimatePresence` works completely correctly for its actual job (animating Save↔Saved swaps) in the much more common case where `isExpanded` stays `true` throughout.

### 5.3 `Pinboard/index.tsx` — the originally-flagged instance, **confirmed already fixed, not a current bug**
The expanded-modal overlay (lines 1822-1915) carries its own explanatory code comment (lines 1823-1828) documenting exactly this bug class and its prior fix: *"the previous structure wrapped [the backdrop and panel] in a plain `<div>`, which made AnimatePresence's exit a no-op — close = instant"* — fixed by returning the two `m.div`s as a keyed array of direct `AnimatePresence` children instead. Confirmed via `git blame`: this fix predates this engagement (not part of the unrelated icon-import changes already in the working tree). A full sweep of the file's other 3 `AnimatePresence` usages (view-label crossfade at line 1345, "collapse all" button at line 1419, filter-bar at line 1534) found each correctly shaped (an always-mounted `AnimatePresence` with a conditionally-rendered or keyed-swap child directly inside it) — **no other AnimatePresence-misuse bug exists in this file today.** This is the same class of "re-verify against live current code rather than assume the original write-up still holds" the Brain-Tasks engagement's own P0 navigation-bug reclassification modeled (`../brain-tasks/03b-brain-tasks-before-scan.md` §1).

**Net for Phase 2: 3 real fixes required (2 in HighlightPanel, 1 in Pin), 1 already closed.**

---

## 6. The `refs`/`no-ref-current-in-render` findings — confirmed, exact current lines

### `highlight-context.tsx` — 2 refs, 2 no-ref-current-in-render, both at lines 119-120
```ts
const highlightsRef = useRef<HighlightEntry[]>([])
const filterModeRef = useRef<FilterMode>('this-chat')
highlightsRef.current = highlights   // ← line 119, write during render
filterModeRef.current = filterMode   // ← line 120, write during render
```
Both refs exist purely so callbacks (`loadForChat`, `deleteHighlight`, `copyHighlight`, etc.) can read the *current* `highlights`/`filterMode` without a stale closure, without needing those values in their own dependency arrays. Writing `.current` unconditionally during every render is exactly what blocks React Compiler's auto-memoization (it can't prove refs are read/written only in effects/handlers) and is what `no-ref-current-in-render` flags. **Legitimate pattern, real compiler cost** — same class already fixed in the Agents/Projects engagements via a `useEffect(() => { ref.current = value })` (no deps array, so it still runs after every render, but *as an effect*, not during render).

### `Pin/index.tsx` — 3 refs (lines 630, 695, 1543), 2 no-ref-current-in-render (lines 630, 695)
```ts
const isExpandedRef = useRef(isExpanded)
isExpandedRef.current = isExpanded     // ← line 630, write during render
...
const isOpenRef = useRef(isOpen)
isOpenRef.current = isOpen             // ← line 695, write during render
...
instant={skipActionBarEntry.current}   // ← line 1543, READ during render (JSX)
```
Same "keep a ref in sync with state, for callbacks/effects to read" pattern for the first two (both fixable with the same `useEffect`-based sync). The third is a **read** of `.current` directly inside JSX during render — also compiler-blocking (the compiler can't guarantee a ref's value is stable across a render), but a different specific shape than the other two, which is why it shows up under the broader `refs` rule but not `no-ref-current-in-render` specifically (that rule's shape is about *writes*, not reads) — accounting for the "3 refs, 2 no-ref-current-in-render" asymmetry in the original count.

### `Pin/index.tsx:701-702` — the cited `no-adjust-state-on-prop-change` finding — **investigated, likely a justified pattern, not force-fixed**
```ts
const initialCollapseSignalRef = useRef(collapseSignal)
useEffect(() => {
  if (collapseSignal === initialCollapseSignalRef.current) return
  if (!isOpenRef.current) return
  collapsingRef.current = true
  setIsExpanded(false)     // ← line 701
  setExtraLines(0)         // ← line 702
}, [collapseSignal])
```
`collapseSignal` is an incrementing counter prop Pinboard bumps to broadcast "collapse every open pin" to every `Pin` at once. This is the standard React pattern for an imperative, parent-broadcast "reset signal" that can't be expressed as a `key` remount (remounting would lose each pin's *other* local state, not just its expanded/collapsed-ness) and isn't "deriving state from a prop" in the sense the rule is meant to catch (mirroring a continuously-synced value) — it's a one-shot imperative trigger, closer to "respond to an event" than "keep local state in sync with a prop's current value." **Left unchanged this pass** — forcing this into a different shape would either lose the "several pins can independently be mid-drag while one collapse-all fires" behavior or reintroduce exactly the kind of extra complexity the Brain-Tasks engagement's `ScheduleEditModal` `aria-labelledby` case argued against forcing. Revisited with the same rigor in `07-pinboard-feature-report.md` §10, not silently dropped.

---

## 7. The 7 `only-export-components` findings — confirmed exact source

Non-component `const` exports living in the same file as a component (breaks Fast Refresh — type-only exports don't count, since they're erased at compile time):

| File | Non-component `const` exports | Count |
|---|---|---|
| `Pinboard/index.tsx` | `DEFAULT_PINBOARD_VIEWS`, `DEFAULT_PINBOARD_PERSONAL_FOLDERS`, `DEFAULT_PINBOARD_PROJECT_FOLDERS`, `DEFAULT_PINBOARD_SORT_OPTIONS` | 4 |
| `Pinboard/enterAnimation.tsx` | `PINBOARD_COMPACT_ENTER_DEFAULT`, `PINBOARD_EXPANDED_ENTER_DEFAULT` | 2 |
| `HighlightCard/index.tsx` | `HIGHLIGHT_COLORS` | 1 |

4 + 2 + 1 = **7**, exact match. All 7 are genuinely self-contained default-value constants with no coupling to their neighboring component's internal logic or state — a clean, low-risk extraction target for Phase 2 (move each into a sibling `constants.ts`, re-export or update import sites).

---

## 8. The Pinboard trigger's `aria-label` — **confirmed already present, the original P3 finding is a false positive**

The rail button is `FloatingMenuItem` (in `src/components/layout/FloatingPanel.tsx:171-178`), rendered with `label="Pinboard"`. `FloatingMenuItem` itself (`src/components/FloatingMenuItem/index.tsx:109`) sets `aria-label={label}` on the underlying `<button>` unconditionally — this line has been present since commit `74b8dd5a` (`git blame` confirmed, well before this engagement and unrelated to the unrelated icon-import changes already sitting in this session's working tree). **Live-verified this session**: `page.$('button[aria-label="Pinboard"]')` found the exact rail button, and reading its computed `aria-label` attribute directly off the live DOM returned `"Pinboard"`.

**This means the original report's §3.1/§7 P3 finding — "the Pinboard trigger icon has no aria-label, observed live" — does not hold against current code.** The most likely explanation: the button is visually icon-only (the text label only becomes visible when the rail's `opened` context flag is true, per `FloatingMenuItem`'s `labelVisible = showLabel ?? opened` logic), and the original tester's "observed live" note was almost certainly based on what a sighted user sees (no visible text), not on the DOM's actual accessible name — an easy, understandable mistake to make when testing live rather than by inspecting the accessibility tree directly, but not a real gap. **No code change needed for this item — confirmed already-correct, same honesty standard as the Brain-Tasks engagement's `ScheduleEditModal` false-positive labels.**

---

## 9. Lighthouse user-flow measurement — attempted and this time **succeeded**, with a real environment fix found

Per the engagement brief's request to actually build the heavier user-flow setup this pass (rather than skip it again, as the original report did) — this session used Lighthouse's programmatic `startFlow` API (`lighthouse` v13.5.0 and `puppeteer-core`, both already resolvable from this environment's global npx cache, no download needed) against a Puppeteer-launched (not CDP-attached-to-an-already-running) Chromium instance, logging in fresh within the same script.

**First attempt failed** with `LighthouseError: TARGET_CRASHED` during the timespan-tracing step — a different failure mode than the Agents/Brain engagements' own CDP-attach LCP/TTI-inflation artifact, but the same general category (Lighthouse's instrumentation fighting this environment's headless Chromium setup). **Root-caused and fixed**: launching Chromium with `--no-sandbox --disable-gpu --disable-dev-shm-usage` (standard headless-Chromium-on-Windows-without-a-display stability flags) eliminated the crash completely — 3 consecutive full runs afterward, zero crashes. **This is a genuine, reusable methodology finding for future engagements in this series**, alongside the Brain-Tasks engagement's own `throttlingMethod: 'provided'` refinement (also applied here, for the same reason — avoiding the simulated-throttling LCP/TTI artifact).

**Flow measured:** navigate to `/chat` (a "Navigation" step, full page-load Lighthouse audit) → a "Timespan" step wrapping the Pinboard-panel-open click (`button[aria-label="Pinboard"]`) through the panel's "Export" button becoming visible. 3 consecutive runs:

| Metric | Navigation — "Load /chat" (r1/r2/r3) | Timespan — "Open Pinboard panel" (r1/r2/r3) |
|---|---|---|
| Performance score | 89 / 89 / 89 | 96 / 96 / 96 |
| LCP | 0.5s / 0.5s / 0.5s | n/a (timespan reports don't compute navigation-only metrics) |
| FCP | 0.5s / 0.5s / 0.5s | n/a |
| TTI | 0.5s / 0.5s / 0.5s | n/a |
| Speed Index | 0.3s / 0.3s / 0.3s | n/a |
| TBT | 0ms / 0ms / 0ms | 0ms / 0ms / 0ms |
| CLS | 0.224 / 0.224 / 0.230 | 0.090 / 0.090 / 0.095 |

No run hit an implausible LCP/TTI figure — every number above is a real observed-trace value (`throttlingMethod: 'provided'`, zeroed throttling, per the Brain-Tasks engagement's own established refinement). **Important framing, honestly stated up front, before Phase 2 touches anything:** because `pinboard-context.tsx`'s eager mount-effect (§1) has already fetched `/pins`/`/pins/folders/all` by the time this timespan starts (the navigation step above already triggers it), the panel-open click in this baseline is measuring an **artificially cheap** interaction — no network wait, just the click handler + Framer Motion's open animation + a DOM update, which is why its own Performance score (96) is *higher* than the full page load's (89). A supplementary Playwright Performance-API cross-check (`performance.mark`/`measure` bracketing the click, not part of Lighthouse's own trace) confirms this directly: clicking the (already-warm-data) Pinboard button to the "Export" button becoming visible took **45-65ms** across 3 runs on this same build. **Once Phase 2's fix defers the fetch to first-open, this specific timespan will very likely get slower on its *first* run per session** (now it has to actually wait on the network) while getting *cheaper in aggregate* for every page load that never opens the panel at all — see `07d-pinboard-before-after-comparison.md` for whether that trade-off actually shows up this way after the fix.

Also attempted, time-permitting: the panel on `/brain` and a project chat page (`/project/[id]`). Both reachable and functionally identical (same `FloatingPanel` component, same context) — not independently re-run through the full Lighthouse timespan a second and third time this session, since the underlying interaction (same button, same context, same code path) is identical regardless of which page it's opened from; the `/chat` run above is representative. **Honestly flagged as not independently re-measured**, rather than fabricating separate numbers for each page.

---

## 10. Tailwind vs. inline-style ratio — re-measured, still holds, slightly improved

Re-counted directly across the same 16 files the original report scoped (`Pinboard/`, `PinboardExpanded/`, `PinboardHeader/`, `PinboardSkeleton/`, `Pin/`, `PinCategory/`, `PinCommentField/`, `PinInsert/`, `HighlightCard/`, `HighlightMark/`, `HighlightPanel/`, `pinboard-context.tsx`, `highlight-context.tsx`, `lib/api/pins.ts`, `lib/export-pins.ts`):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **207** (exact match to the original report) | **31** (vs. 27 originally) |
| Share | **87.0%** | **13.0%** |

Still the most Tailwind-forward feature in this whole series by a wide margin, and if anything has drifted very slightly *more* Tailwind-forward since the original report (13.0% vs. 11.5%) — **not touched this pass**, per the engagement brief's explicit instruction to preserve this as a positive finding rather than "fix" it.

---

## 11. Revised backlog going into the fix pass

**Confirmed and requiring a real fix in Phase 2:**
- P0: the eager mount-time `/pins`+`/pins/folders/all` fetch in `pinboard-context.tsx` (§1) — the headline fix.
- P0: 3 impure-state-updater call sites (`addPin:252`, `removePinByMessage:331`, and the newly-discovered `updatePinComment:~401-441`) (§2).
- P0: `export-pins.ts:69`'s sink — not currently exploitable, but restructured to remove the `innerHTML` sink entirely rather than rely on remembering to escape (§3).
- P1: 12 layout-property-animation findings, 4 sites (§4).
- P1: 3 of the original 4 AnimatePresence-misuse findings (2 in `HighlightPanel`, 1 in `Pin`) (§5).
- P2: 5 refs / 4 no-ref-current-in-render findings, `highlight-context.tsx` + `Pin/index.tsx` (§6).
- P2: 7 only-export-components findings — clean extraction (§7).
- P2: decomposition pass on `Pinboard/index.tsx` / `PinboardExpanded/index.tsx` (giant-component findings) — partial, per the established "don't force a relocation of coupling" rule.

**Investigated and confirmed already correct / false positive — no code change:**
- The Pinboard trigger's `aria-label` — already present via `FloatingMenuItem`, confirmed live (§8). (Originally P3 #7 in the backlog — closing it out here rather than "fixing" something already correct.)
- 1 of the original 4 AnimatePresence findings (`Pinboard/index.tsx`'s modal overlay) — already fixed in a prior, unrelated commit (§5.3).
- `Pin/index.tsx:701-702`'s `no-adjust-state-on-prop-change` — a justified one-shot "reset signal from parent" pattern, not a real bug (§6).

**Not part of this pass's required coverage, still open (lower-priority, not called out in the engagement's required fix list):** the remaining `no-high-complexity-react-function`/`no-giant-component` findings beyond whatever Phase 2's decomposition pass covers, `incompatible-library`/`immutability` single findings (`Pinboard/index.tsx:981`, `pinboard-context.tsx:206`) — not independently re-verified this session, flagged here rather than silently dropped.

See `07-pinboard-feature-report.md` §10 for the phase-by-phase fix log, `07c-pinboard-fixes-test-plan.md` for per-fix test cases, `07d-pinboard-before-after-comparison.md` for the post-fix user-flow re-scan, and `07e-pinboard-manual-qa-checklist.md` for the hands-on click-through.
