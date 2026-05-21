# End-to-End Testing Checklist — ds-new Branch

> Generated May 2026 · Covers performance phases 1–4 + React Doctor health  
> React Doctor baseline: **99/100** (1780 issues; 843 deferred `no-inline-exhaustive-style`, 46 deferred `no-giant-component`)  
> Mark each item `[x]` when verified, `[~]` partial/known-flaky, `[!]` regression found.

---

## How to Use This File

Run `npm run dev` unless a test explicitly needs a production build.  
Open React DevTools Profiler for render-count tests.  
Open DevTools → Network for bundle/request tests.

---

## Part A — Critical Fixes Needed Before Merge

These are blocking issues discovered in the current scan (`react_doctor_current.json`).

---

### A.1 `rules-of-hooks` — ChatRow inner component naming

**Issue:** `ChatRow/index.tsx` lines 238–264 define hooks inside a function named `_ChatRow`. React Doctor (and the Rules of Hooks lint rule) flag any function starting with `_` as a non-component, causing false violations. This must be resolved before merge.

**Fix:** Rename the inner function from `_ChatRow` to `ChatRow` (or use the anonymous arrow form inside `React.memo`):
```tsx
// bad
const _ChatRow = (props) => { ... }
export const ChatRow = React.memo(_ChatRow)

// good
export const ChatRow = React.memo(function ChatRow(props) { ... })
```

- [ ] Run `grep -n "_ChatRow" src/components/ChatRow/index.tsx` — confirm the naming pattern.
- [ ] Rename/refactor so the inner function has a proper PascalCase name.
- [ ] Re-run React Doctor — zero `rules-of-hooks` violations remain.
- [ ] `ChatRow` still renders correctly on `/chats` (star, rename, delete, select all work).
- [ ] React DevTools shows the component name as `ChatRow` in the tree (not `_ChatRow`).

---

### A.2 `use-lazy-motion` — regressions in ds-new files

**Issue:** 95 files show `motion` imported instead of `m + LazyMotion` after ds-new performance changes. Key regressions confirmed in:
- `src/app/(app)/persona/configure/components/ExampleConversationModal.tsx`

- [ ] Run: `npx grep -rn "from 'framer-motion'" src --include="*.tsx" --include="*.ts" | grep "import.*motion"` and identify files using `motion` directly instead of `m`.
- [ ] For each file on the ds-new branch that re-introduced `motion` imports, convert to `m + LazyMotion` pattern consistent with the root layout provider.
- [ ] Re-run React Doctor — `use-lazy-motion` count drops to zero (or back to previously acceptable baseline).

---

### A.3 `no-react19-deprecated-apis` — regressions in ds-new files

**Issue:** 30 files show `forwardRef` / legacy `useContext` after ds-new changes; previously fixed to near-zero.

- [ ] Run: `npx grep -rn "forwardRef\|React.forwardRef" src --include="*.tsx"` on changed files.
- [ ] Convert any `forwardRef` wrappers in ds-new-modified files to direct `ref` prop (React 19 pattern).
- [ ] Run: `npx grep -rn "useContext(" src --include="*.tsx"` — convert to `use(Context)` where applicable.
- [ ] Re-run React Doctor — `no-react19-deprecated-apis` back to ≤ 3 (the pre-ds-new baseline).

---

## Part B — New Issues (not present before ds-new)

---

### B.1 `nextjs-image-missing-sizes` — 14 instances

**Issue:** `next/image` with `fill` prop but no `sizes` attribute — browser downloads the largest image variant.

**Files affected:**
- `src/components/Button/index.tsx:459`
- `src/app/(app)/persona/configure/instructions/page.tsx` (3 instances: lines 1170, 1434, 1584)
- `src/components/ChatThumbnail/index.tsx:386`
- `src/app/(app)/personas/published/page.tsx:382`
- `src/components/ChatInput/index.tsx:200`
- `src/app/(app)/persona/configure/components/ProfileTab.tsx:211`
- `src/components/chat/AttachmentManager.tsx:236`
- `src/components/SidebarMenuItem/index.tsx:532`
- `src/components/PersonaCard/index.tsx` (2 instances: lines 185, 439)
- `src/templates/Brain/ContextRail.tsx:204`
- `src/templates/Brain/PersonaSelectionCard.tsx:299`

- [ ] Add appropriate `sizes` to each `fill` image (e.g. `sizes="(max-width: 768px) 40px, 48px"` for avatars, `sizes="100vw"` for full-width).
- [ ] Persona avatar images load at the correct resolution — not oversized (check Network → Img, confirm the correct variant was downloaded).
- [ ] Brain page persona selection cards: images render at correct size.
- [ ] Sidebar menu items: favicon/avatar images load at icon size, not full-res.
- [ ] AttachmentManager preview thumbnails load correctly.

---

### B.2 `no-layout-transition-inline` — 6 instances

**Issue:** CSS `transition` on `width` causes layout thrash every frame. Use `transform: scaleX()` or clip instead.

**Files:**
- `src/components/EnhancePromptField/index.tsx:257`
- `src/app/(app)/persona/configure/components/SharingTab.tsx:174`
- `src/components/Sidebar/index.tsx:554`
- `src/components/TokenBudgetBar/index.tsx:68`
- `src/components/chat/XmlChart.tsx:224`
- `src/templates/ChatBoard/index.tsx:513`

- [ ] **Sidebar width transition** (`Sidebar/index.tsx:554`): open/close sidebar. Record in DevTools Performance — no layout reflow (purple bars) during the transition.
- [ ] **TokenBudgetBar** (`TokenBudgetBar/index.tsx:68`): token budget animates from 0 → filled without triggering layout. Verify in Performance panel.
- [ ] **EnhancePromptField** (`EnhancePromptField/index.tsx:257`): field expand/collapse transitions smoothly without jank.
- [ ] **ChatBoard** (`ChatBoard/index.tsx:513`): panel resizing does not cause layout reflow jank.
- [ ] **SharingTab** (`SharingTab.tsx:174`): sharing toggle animation is smooth.
- [ ] **XmlChart** (`XmlChart.tsx:224`): chart bar animations are smooth.

---

### B.3 `js-index-maps` — 4 instances in `use-streaming-chat.ts`

**Issue:** `array.find()` called inside loops at lines 540, 675, 892, 1009 of `src/hooks/use-streaming-chat.ts` — O(n²) complexity that degrades with large message lists.

- [ ] Open a chat with 50+ messages. Stream a new response. In DevTools Performance, confirm no long-task spikes (> 50 ms) in the JS thread during streaming.
- [ ] After fix: build a `Map` keyed by message ID before the loop, replacing `.find()` calls. Streaming performance is equal or better.
- [ ] Edge case: message with no matching ID in the Map returns `undefined` correctly (no crash, graceful fallback).

---

### B.4 `no-usememo-simple-expression` — 3 instances

**Issue:** `useMemo` wrapping trivially cheap expressions (property access / ternary) — memo overhead exceeds the computation.

**Files:**
- `src/app/(app)/persona/configure/hooks/use-instruction-history.ts:21-22`
- `src/components/SidebarMenuSkeleton/index.tsx:25`

- [ ] Remove the `useMemo` wrappers and inline the expressions directly.
- [ ] Instruction history hook still works correctly after removal (undo/redo in the persona configure instructions page functions as expected).
- [ ] Sidebar menu skeleton renders correctly (no visual change).

---

### B.5 `rendering-usetransition-loading` — 3 instances

**Issue:** `useState` for `isLoading` where `useTransition` would give a better UX (deferred state updates without blocking the UI).

**Files:**
- `src/components/layout/LeftSidebar.tsx:477`
- `src/hooks/use-chat-history.ts:36`
- `src/hooks/use-pin-operations.ts:16`

- [ ] **LeftSidebar loading state**: sidebar transitions between loading/loaded states without freezing the rest of the UI (navigation still responds during load).
- [ ] **Chat history loading**: switching between chats does not block input; previous chat content fades out while new chat loads.
- [ ] **Pin operations**: pin create/delete operations show loading state without blocking scrolling.

---

### B.6 `design-no-three-period-ellipsis` — 1 instance

- [ ] Run: `npx grep -rn "\.\.\." src --include="*.tsx" | grep -v "//.*\.\.\."` — find literal `...` in JSX text.
- [ ] Replace with `…` (Unicode ellipsis `…`).
- [ ] Text renders correctly with the proper ellipsis glyph.

---

## Part C — Performance Phase Verification (Smoke Tests)

> Full coverage in `docs/PERF_TESTING_CHECKLIST.md`. Run these as a faster smoke pass.

---

### C.1 Phase 1 Smoke Tests

- [ ] **KaTeX CSS scoping (1.1):** On the login page, DevTools Network shows no `katex.min.css` request. Inside `/chat`, KaTeX CSS is loaded and math renders correctly.
- [ ] **Squircle cache (1.4):** On `/chats`, buttons render with squircle shape. No excessive `ResizeObserver` callbacks in Performance panel during scroll.
- [ ] **AudioWave RAF convergence (1.6):** After stopping voice input, no RAF tasks appear in Performance → Idle period.
- [ ] **Skeleton keys (1.7):** `/personas` on Slow 3G — no React key warnings in console during skeleton → cards transition.

---

### C.2 Phase 2 Smoke Tests

- [ ] **ChatMessage memo (2.1):** Send a message to a chat with 5+ prior messages. In Profiler, only the streaming message shows a render; earlier messages show no render highlight.
- [ ] **ChatRow memo (2.2):** On `/chats`, toggling selection mode — only the relevant row re-renders.
- [ ] **Dynamic imports (2.6):** Hard-refresh `/chat`. Open Compare Models — bundle chunk loads on demand (no chunk for CompareModels in initial network).
- [ ] **Settings lazy-load (2.10):** Open `/settings`. Click Connectors tab. Page loads without blank flash.

---

### C.3 Phase 3 Smoke Tests

- [ ] **Highlight context split (3.1):** Highlight text. Panel updates. Action-only consumers show 0 renders in Profiler.
- [ ] **Button CSS animation (3.3):** Click and hold any button — scale-down press animation works. Loading spinner rotates smoothly.
- [ ] **Tooltip CSS animation (3.5):** Hover tooltip fades in / fades out; removed from DOM after transition.
- [ ] **Tabs pill animation (3.7):** Switch tabs — white pill slides smoothly to new position.

---

### C.4 Phase 4 Smoke Tests

- [ ] **Chats virtualisation (4.1):** With 20+ chats, only ~10–15 `[role="listitem"]` elements in DOM. Scroll to bottom/top works. Search/filter updates the list.
- [ ] **Chat messages virtualisation (4.2):** With 50+ messages, only ~8–12 message elements in DOM. Scroll to bottom on load. Streaming stays at bottom.
- [ ] **Personas virtualisation (4.3):** With 9+ personas, only 3–5 grid rows in DOM. Filter/sort still works.
- [ ] **Pinboard virtualisation (4.4):** With 50+ pins, only ~8–12 pin elements in DOM. Expand/collapse re-measures height correctly.

---

## Part D — React Doctor Regression Verification

Spot-check that previously-fixed rules haven't silently regressed in files modified by the ds-new branch.

---

### D.1 Framer Motion removals held

- [ ] `grep -r "from 'framer-motion'" src/components/Button src/components/Checkbox src/components/Tooltip src/components/Chip src/components/Tabs` → **no matches**.
- [ ] `grep -r "from 'framer-motion'" src/context/highlight-context.tsx` → **no matches**.

---

### D.2 React 19 API usage

- [ ] `grep -rn "React.forwardRef\|forwardRef(" src/components --include="*.tsx"` → zero matches in files modified on this branch.
- [ ] `grep -rn "useContext(" src --include="*.tsx"` → count should not exceed pre-ds-new baseline (3 deliberate exceptions).

---

### D.3 Array index keys not re-introduced

- [ ] `grep -rn "key={index}\|key={i}\b" src --include="*.tsx"` → zero matches without an `eslint-disable` comment.
- [ ] No new React key-duplication warnings appear on any route.

---

### D.4 `no-autofocus` not re-introduced

- [ ] `grep -rn "autoFocus" src --include="*.tsx"` → zero matches (or only pre-existing disabled ones).
- [ ] Modals and dialogs open without stealing focus unexpectedly.

---

### D.5 `no-giant-component` baseline maintained

- [ ] `no-giant-component` count in a fresh React Doctor scan is ≤ 46 (the pre-ds-new baseline — no new giant components added by performance changes).

---

### D.6 `no-z-index-9999` baseline maintained

- [ ] Count ≤ 31 (the pre-ds-new baseline). No new arbitrary z-index values (> 50) introduced in ds-new changes.
- [ ] In particular, `ExampleConversationModal.tsx` z-index: 200/201 was a new introduction — confirm these have been corrected to use the design token z-index scale.

---

## Part E — Full Feature Regression Tests

---

### E.1 Chat flow

- [ ] Create a new chat from `/chat`. First message sends and streams correctly.
- [ ] Stop generation mid-stream. Partial response is preserved.
- [ ] Send a follow-up message. Response is contextual.
- [ ] Attachment upload (image or file): preview shows in input; file is included in the send.
- [ ] Web search toggle ON: response includes citations. CitationsPanel opens and displays sources.
- [ ] Compare Models panel: both models stream side by side. Voice waveform animates correctly in compare mode.
- [ ] Math formula in response: renders with KaTeX typography.
- [ ] Code block in response: syntax highlighting applies (core languages instantly; lazy languages after first load).
- [ ] Table in response: GFM table renders with correct layout.

---

### E.2 Personas

- [ ] `/personas` page loads and displays persona grid. Skeleton → cards transition is clean.
- [ ] Create a new persona via wizard (name → purpose → tone). All wizard steps navigate correctly.
- [ ] Persona configure page: Profile, Instructions, Knowledge, Connectors, Sharing tabs all load and save correctly.
- [ ] Instructions page: undo/redo works after `use-instruction-history` `useMemo` simplification (B.4).
- [ ] Published personas page: images load at correct resolution (B.1 fix).
- [ ] Pause/Resume persona: card updates in place without full list re-render.
- [ ] Delete persona: card disappears; grid re-flows without flashing all other cards.

---

### E.3 Projects

- [ ] `/projects` page loads. ProjectCard renders title, description, tags, footer correctly.
- [ ] Click a card — navigates to project. ⋮ menu opens Edit/Archive/Delete.
- [ ] `ProjectCardBody` server/client split: `Badge` components render correct color variants.
- [ ] Sort/filter projects. `sortedProjects` and `filteredProjects` memos work independently.

---

### E.4 Pinboard

- [ ] Open Pinboard sidebar. Tag enrichment requests fire (not on app mount).
- [ ] Close and reopen — no second batch of enrichment requests.
- [ ] Expand and collapse a pin. Virtual row re-measures; no content clipping.
- [ ] Collapse-all button: all pins collapse. Heights update.
- [ ] Filter by category/tag. Virtual list updates. "No pin match" message shows when applicable.
- [ ] Delete a pin. List re-flows correctly.
- [ ] `PinboardExpanded` (`dynamic()` loaded) opens and closes correctly.

---

### E.5 Settings

- [ ] `/settings/account` — form saves correctly.
- [ ] `/settings/connectors` — lazy-loaded; no blank flash; connector toggle works.
- [ ] `/settings/billing` — loads without errors.
- [ ] `/settings/org/members` — member list renders.
- [ ] Settings tabs switch without re-fetching data.

---

### E.6 Brain page

- [ ] Brain page loads. `ContextRail` persona images render at correct size (B.1 fix — `sizes` prop present).
- [ ] `PersonaSelectionCard` images render at correct resolution.

---

### E.7 Navigation and routing

- [ ] Navigate between `/chat`, `/chats`, `/personas`, `/projects`, `/settings`, `/brain` — no errors.
- [ ] Browser back/forward works correctly after navigation.
- [ ] Hard refresh on any route: app rehydrates without console errors.
- [ ] Deep-link to `/chat?id=…` opens the correct chat scrolled to bottom.

---

## Part F — Console and Tooling Health

---

### F.1 Zero console errors baseline

- [ ] No React `key` duplication warnings on any route.
- [ ] No "Cannot update a component while rendering a different component" warnings.
- [ ] No `ResizeObserver loop limit exceeded` errors.
- [ ] No `AnimatePresence` / Framer Motion errors or missing-import warnings.
- [ ] No `rules-of-hooks` runtime errors (React strict mode dev warnings).

---

### F.2 React Doctor score

Run React Doctor (`npx react-doctor` or equivalent) after applying all Part A and Part B fixes.

- [ ] `rules-of-hooks` → **0** violations.
- [ ] `use-lazy-motion` → **0** violations (all framer-motion files use `m + LazyMotion`).
- [ ] `no-react19-deprecated-apis` → ≤ **3** (pre-ds-new baseline).
- [ ] `nextjs-image-missing-sizes` → **0** (all 14 fill images now have `sizes`).
- [ ] `no-usememo-simple-expression` → **0** (3 trivial memos removed).
- [ ] Overall score: **≥ 99/100** maintained.
- [ ] Total diagnostic count: ≤ **1780** (current baseline).

---

### F.3 Virtualisation CSS selector check

- [ ] `grep -rn "nth-child\|nth-of-type" src/` — no matches targeting chat messages, chat rows, persona cards, or pins.
- [ ] `grep -rn "+ .ChatRow\|~ .Pin" src/` — no matches.

---

## Part G — Bundle Size Spot-Check

Run after a production build (`npm run build`).

```bash
# Temporarily enable in next.config.ts:
# const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: true })
# export default withBundleAnalyzer(nextConfig)
ANALYZE=true npm run build
```

- [ ] `framer-motion` full bundle is **not** in pages that only use Button/Checkbox/Tooltip/Chip/Tabs. Only `m` (LazyMotion) chunks appear.
- [ ] `highlight.js` language files appear as many small chunks (~one per language), not one monolithic chunk.
- [ ] `@tanstack/react-virtual` appears as a single chunk (< 15 KB gzipped).
- [ ] No `@aws-sdk` in any client bundle.
- [ ] KaTeX CSS is absent from the landing/auth page bundle.
- [ ] `nextjs-image-missing-sizes` fix: no oversized image downloads in Network → Img (verify a persona avatar loads the correctly-sized variant, e.g. 48px not 1920px).

---

## Summary Scorecard

| Part | Area | Status |
|------|------|--------|
| A.1 | `rules-of-hooks` in ChatRow | [ ] |
| A.2 | `use-lazy-motion` regressions | [ ] |
| A.3 | `no-react19-deprecated-apis` regressions | [ ] |
| B.1 | `nextjs-image-missing-sizes` (14 images) | [ ] |
| B.2 | `no-layout-transition-inline` (6 files) | [ ] |
| B.3 | `js-index-maps` in use-streaming-chat | [ ] |
| B.4 | Trivial `useMemo` removed | [ ] |
| B.5 | `useTransition` loading states | [ ] |
| C   | Perf phases 1–4 smoke | [ ] |
| D   | React Doctor regressions clean | [ ] |
| E   | Full feature regression | [ ] |
| F   | Console clean + score ≥ 99 | [ ] |
| G   | Bundle size OK | [ ] |
