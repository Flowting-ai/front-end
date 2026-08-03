# Performance Optimization — Feature Testing Checklist

> All 4 phases · Generated May 2026  
> Mark each item `[x]` when verified, `[~]` for partial/known-flaky, `[!]` for a regression found.

---

## How to Use This File

Each section maps to one optimisation change. For each item:

1. **Precondition** — what state the app must be in before the test.
2. **Action** — what to do.
3. **Expected** — what a passing result looks like.
4. **Regression signal** — what a failure looks like.

Run the dev server (`npm run dev`) unless the test explicitly needs a production build.

---

## Phase 1 — Zero/Low Risk, No UI Change

---

### 1.1 KaTeX + Highlight.js CSS moved to `(app)/layout.tsx`

**What changed:** `import "katex/dist/katex.min.css"` and `import "highlight.js/styles/atom-one-light.css"` moved from `src/app/layout.tsx` to `src/app/(app)/layout.tsx`.

- [ ] Open the landing / login page in a new private window. In DevTools → Network → filter by "katex" — **no katex CSS request should appear** before the user is inside the app shell.
- [ ] Log in and navigate to `/chat`. Verify `katex.min.css` and the highlight theme CSS **are** loaded after entering the app shell.
- [ ] Render a message containing a `$$…$$` math block. Verify it renders with correct KaTeX typography and no missing-style artefacts.
- [ ] Render a message containing a fenced code block (e.g. ` ```python `). Verify syntax highlighting colours appear correctly.
- [ ] Hard-refresh `/chat`. Math and code highlighting still appear on reload (no flash of unstyled content).

---

### 1.2 `@aws-sdk` moved to `devDependencies`

**What changed:** `@aws-sdk/client-secrets-manager` is no longer a production dependency.

- [ ] Run `npm run build`. Build should complete without errors.
- [ ] Inspect `.next/server` — confirm no `aws-sdk` or `@aws-sdk` directory appears in the server-function bundle.
- [ ] Run the app in production mode (`npm run start`). App loads without AWS-related errors in the server console.

---

### 1.3 `remarkPlugins` / `rehypePlugins` / `components` at module level

**What changed:** Markdown renderer plugin arrays and component maps are defined once at module scope, not recreated per render.

- [ ] Open a chat with at least 3 completed assistant messages. In React DevTools Profiler, record a fresh message send. Confirm `MarkdownRenderer` (or `ReactMarkdown`) **does not re-render** for messages that are not the active streaming one.
- [ ] A completed message containing a table renders correctly (GFM plugin active).
- [ ] A completed message containing a math formula renders correctly (KaTeX plugin active).
- [ ] A completed message containing a code block renders with syntax highlighting (highlight plugin active).
- [ ] All three tests still pass after navigating away and back to the chat.

---

### 1.4 Squircle clip-path cache

**What changed:** `useSquircle` caches computed SVG clip paths in a module-level `Map` keyed by `{width, height, cornerRadius}`.

- [ ] Open a page with multiple `<Button>` components (e.g. `/chats`). In DevTools Performance, record a scroll or hover. Confirm `ResizeObserver` callbacks are not firing on every frame (should fire at most once per unique button size on mount).
- [ ] Buttons still render with the correct squircle shape (no sharp corners, no oval shape).
- [ ] Resize the browser window. Buttons whose dimensions change recalculate correctly (the cache is not stale across size changes).

---

### 1.5 Favicon URL cache in `CitationChip`

**What changed:** `extractDomain` and the Google S2 favicon URL are cached in a module-level `Map`. Subsequent renders for the same domain return the cached URL without a new network request.

- [ ] Send a message that returns citations with repeated domains (e.g. two `nytimes.com` citations). In DevTools Network, confirm only **one** `www.google.com/s2/favicons?domain=nytimes.com` request fires, not two.
- [ ] Favicon icons render correctly for all citation chips.
- [ ] Navigate away and back. Favicons still render on the re-visit (cache survives within the session).

---

### 1.6 `AudioWaveDisplay` RAF convergence guard

**What changed:** The decay animation loop cancels itself when all bar heights are within 0.1 of their resting value, rather than running infinitely at sub-pixel heights.

- [ ] Open a chat. Start voice input. Speak so bars animate. **Stop speaking** (release the mic button).
- [ ] In DevTools Performance → record 2 seconds after stopping. Confirm no `requestAnimationFrame` tasks appear for `AudioWaveDisplay` during the idle period.
- [ ] Bars visually return to their resting heights and stop moving.
- [ ] Repeat in the Compare Models panel (same `AudioWaveDisplay` component, different location).
- [ ] Start voice again after the idle period. Bars resume animating immediately (RAF restarts on analyser change).

---

### 1.7 Skeleton items — stable keys in Personas page

**What changed:** Persona skeleton cards use `key={sk-${i}}` instead of array index.

- [ ] Navigate to `/personas` on a slow connection (DevTools → Network → Slow 3G). Observe the loading skeleton.
- [ ] No React key-related warning appears in the console.
- [ ] The skeleton grid transitions to real cards without any flash or layout shift.

---

### 1.8 Pinboard tag-filter dropdown — keys by `id` not index

**What changed:** Tag dropdown items are keyed by `tag.id`, not by array position.

- [ ] Open the Pinboard. Open the filter dropdown.
- [ ] Type in the tag search input. Filter results update.
- [ ] No React key-duplication warning in the console while filtering.
- [ ] Selecting a tag adds it to the active filters. Clearing the search restores the full tag list with correct selection state (selected items remain highlighted).

---

### 1.9 Split `useMemo` chains — Personas and Projects pages

**What changed:** Personas page: `statusFiltered → tagFiltered → searched → sorted` as separate memos. Projects page: `filteredProjects` and `sortedProjects` are separate memos.

- [ ] **Personas:** Change the sort order (Activity → A to Z). Only the sort memo should re-run; filter memo should not. Validate in React DevTools Profiler (sort change does not cause `statusFiltered` / `tagFiltered` to recompute — they show 0 ms render time).
- [ ] **Personas:** Type in search. Results filter correctly without re-sorting.
- [ ] **Personas:** Toggle status filter. Sort order is preserved.
- [ ] **Projects:** Sort projects. Filter result stays unchanged (no persona vanishes from filter incorrectly).
- [ ] **Projects:** Filter by name. Sorted order within the filtered results is correct.

---

### 1.10 PinboardExpanded — six dropdown states → single `openDropdown`

**What changed:** `isExportOpen`, `isMoveOpen`, etc. replaced with `openDropdown: string | null`.

- [ ] Open the expanded Pinboard (`PinboardExpanded`).
- [ ] Open the Export dropdown. It opens.
- [ ] Without closing Export, click the Move dropdown. Export closes and Move opens (only one dropdown open at a time).
- [ ] Press Escape. The active dropdown closes. No other dropdown opens.
- [ ] Click outside any open dropdown. It closes.
- [ ] Each dropdown (Export, Move, Sort, Filter, Tag, View) opens and closes independently.
- [ ] No console errors about missing state or undefined `openDropdown` value.

---

### 1.11 `useCallback` pass — stable handler references

**What changed:** `handleSend`, `handleMentionChange`, `handlePinNavigate`, `TagSearchInput.onKeyDown`, `endDrag`, `handleScroll`, and similar callbacks wrapped in `useCallback`.

- [ ] In React DevTools Profiler, record a keystroke inside `ChatInput`. Confirm `PinMentionDropdown` does **not** show a render (its `onSelect`/`onHighlight` prop references are stable).
- [ ] In the Pinboard, drag-scroll the tab bar. Confirm no excessive re-renders in the profiler (stable `endDrag` ref).
- [ ] Send a chat message. `ChatInput`, `AttachmentManager`, and `CitationsPanel` do not re-render unnecessarily between sends.

---

## Phase 2 — Low Risk, Needs Visual QA

---

### 2.1 `React.memo` on `ChatMessage`

**What changed:** `ChatMessageMemo` uses a custom comparator: re-renders only when `message.id`, `message.content`, `message.role`, or `isStreaming` change.

- [ ] Open a chat with 5+ completed messages. Send a new message. In React DevTools Profiler, confirm that only the **last two** messages (user + streaming assistant) show renders; earlier messages show grey/no highlight.
- [ ] Completed messages that are not being edited do not re-render during streaming of a new message.
- [ ] Editing a completed user message (if edit UI exists): only that message re-renders.
- [ ] Regenerating the last assistant message: only the last message re-renders.
- [ ] Citations still expand/collapse correctly on completed messages (click does not stop working after memoisation).
- [ ] Copy/actions buttons on a memoised message still fire correctly.

---

### 2.2 `React.memo` on `ChatRow`

**What changed:** `ChatRow` wrapped in `React.memo`.

- [ ] On the Chats page, toggle selection mode. In React Profiler, confirm all `ChatRow` components that are **not** the toggled one do **not** re-render.
- [ ] Starring a chat updates only that row (not all rows).
- [ ] Renaming a chat inline updates only that row.
- [ ] Searching/filtering chats re-renders only the visible rows, not all rows.

---

### 2.3 `React.memo` on `PersonaCard`

**What changed:** `PersonaCard` wrapped in `React.memo`.

- [ ] Open `/personas`. Change the sort order. In Profiler, confirm cards whose props did not change do **not** re-render.
- [ ] Toggling pause/resume on one card re-renders only that card.
- [ ] Deleting a persona re-renders the grid without flashing all other cards.

---

### 2.4 `React.memo` on `ProjectCard`

**What changed:** `ProjectCard` wrapped in `React.memo`.

- [ ] Open the Projects page. Open a dropdown (sort). Confirm non-target `ProjectCard` components show no render highlight in Profiler.
- [ ] Hover over a card. Only that card re-renders (hover state is internal).
- [ ] Opening the ⋮ menu on one card does not re-render other cards.

---

### 2.5 `React.memo` on `SourceCard` (ResponseBlocks)

**What changed:** `SourceCard = React.memo(...)` with `extractDomain` memoised.

- [ ] Send a message that returns search results with source cards. In Profiler, confirm that as the streaming assistant message updates, the `SourceCard` components (which are in a completed, prior message or the sources panel) do **not** re-render.
- [ ] Source card favicons load and display correctly.
- [ ] Clicking a source card opens the correct URL.

---

### 2.6 `dynamic()` lazy imports — modals and panels

**What changed:** `CompareModels`, `CitationsPanel`, `PinboardExpanded`, `PresetModelSelectorDialog`, `SystemInstructionsModal`, `EditProjectModal` loaded with `next/dynamic({ ssr: false })`.

- [ ] Hard refresh `/chat`. In Network tab, confirm no bundle chunk for `CompareModels` is requested until the Compare button is clicked.
- [ ] Click Compare. A loading state (spinner or skeleton) appears briefly, then `CompareModels` renders correctly.
- [ ] Close and reopen Compare. No loading state on reopen (component is already in memory).
- [ ] Click on citations count. `CitationsPanel` loads and displays sources.
- [ ] Open Pinboard expanded view. `PinboardExpanded` loads correctly.
- [ ] Open system instructions modal. Content loads correctly.
- [ ] All dynamically-loaded panels close and dismiss correctly via Escape / backdrop click / close button.

---

### 2.7 Defer pin tag enrichment to pinboard open

**What changed:** Pin tags are not fetched on app mount. `getPin(id)` calls are deferred until the Pinboard panel opens.

- [ ] Hard-refresh `/chat`. In Network tab, confirm **no** `/api/backend/pins/…` individual-pin requests fire on mount (only the list call `listPins` fires, if it fires at all).
- [ ] Open the Pinboard sidebar. Pin tag enrichment requests fire now (visible in Network tab as `GET /api/backend/pins/{id}`).
- [ ] Once loaded, tags display correctly on pins.
- [ ] Close and reopen the Pinboard. Tags are already in state — no second batch of enrichment requests.
- [ ] Pins without tags (during the brief pre-enrichment window) display gracefully (no crash, no missing layout).

---

### 2.8 `AudioWaveDisplay` extracted as shared component

**What changed:** Duplicated component removed from `ChatInput.tsx` and `CompareModels.tsx`; both import from `src/components/shared/AudioWaveDisplay.tsx`.

- [ ] Voice recording in `ChatInput` → waveform animates while speaking, decays after stop.
- [ ] Voice recording in `CompareModels` → same behaviour.
- [ ] Both waveforms use identical bar geometry (7 bars, same heights at rest).
- [ ] Switching between voice mode in ChatInput while CompareModels is open: no conflict between the two instances (each has its own `analyser` prop).

---

### 2.9 Memoised markdown for completed messages

**What changed:** `ReactMarkdown` output is memoised per completed message; only recomputes when `content` changes.

- [ ] In Profiler, send a new message. Completed prior messages should show **0 ms render time** for their `ReactMarkdown` subtree.
- [ ] Editing a completed message clears the memo and re-renders with new content.
- [ ] Code blocks, tables, math, and GFM lists all render correctly in memoised output.
- [ ] A very long completed message (>2000 chars) with code blocks renders without truncation.

---

### 2.10 Settings sub-pages lazy-loaded

**What changed:** Settings sub-pages (`connectors`, `model-config`, etc.) are loaded with `dynamic()`.

- [ ] Navigate to `/settings`. In Network tab, confirm no chunk for `connectors/page` is requested until that tab is clicked.
- [ ] Click the Connectors tab. Page loads (with or without loading skeleton, no blank flash).
- [ ] Switch between Settings tabs. Already-loaded tabs do not reload.
- [ ] All settings forms save correctly (no regression from lazy loading).

---

## Phase 3 — Medium Risk, Needs Full Test Pass

---

### 3.1 Highlight context split — `HighlightDataContext` + `HighlightActionsContext`

**What changed:** Single `HighlightContext` split into `HighlightDataContext` (highlights array + isOpen + filterMode) and `HighlightActionsContext` (stable action callbacks). `useHighlight()` remains backward-compatible. New `useHighlightActions()` hook for action-only consumers.

- [ ] Highlight some text in a message. The highlight appears in the Highlights panel.
- [ ] Delete a highlight from the panel. It disappears from both the panel and the message.
- [ ] Copy a highlight. Clipboard contains the correct text.
- [ ] Change filter mode (This chat → All). Panel switches views correctly.
- [ ] `loadForChat` fires when navigating to a chat; `loadAll` fires when switching to "All" mode.
- [ ] In Profiler, add a highlight. Components that only call `useHighlightActions()` (action-only consumers) do **not** re-render (their context value is stable).
- [ ] Components that call `useHighlight()` (combined) still re-render correctly when data changes.
- [ ] Optimistic insert appears immediately; server ID replaces temp ID without re-mount (renderKey stays stable, no animation replay).
- [ ] On server error during add: optimistic entry rolls back and a toast appears.
- [ ] On server error during delete: entry is restored and a toast appears.
- [ ] `filterMode === 'all'`: opening a per-chat page does **not** override the global view.

---

### 3.2 Highlight.js lazy language loading

**What changed:** 10 core languages (JS, TS, Python, Bash, JSON, XML, CSS, Markdown, YAML, Plaintext) are registered eagerly. 26 others are loaded on first use via `ensureLanguage()` + dynamic imports. Concurrent requests for the same language are deduplicated.

- [ ] Open a chat with a Python code block. `highlight.js/lib/languages/python` chunk is **not** in the initial bundle (check Network → JS). It is requested when the code block first renders.
- [ ] Open a chat with a JavaScript code block. JS **is** highlighted immediately (no async delay — it is a core language).
- [ ] A TypeScript block highlights immediately.
- [ ] A Bash/shell block highlights immediately.
- [ ] An SQL block triggers an async chunk load on first render, then highlights correctly.
- [ ] A Rust block loads and highlights correctly.
- [ ] A Dockerfile block loads and highlights correctly.
- [ ] An unknown/unrecognised language (e.g. ` ```xyz `) does not throw an error; falls back to plain text.
- [ ] Two code blocks with the same lazy language (e.g. two Java blocks) trigger only **one** chunk request (deduplication via `_pending` Map).
- [ ] After the language chunk loads, subsequent code blocks in the same session highlight immediately (no second network request).
- [ ] Highlighting still applies correctly after `removeAttribute("data-highlighted")` is used to re-highlight a block (streaming path).

---

### 3.3 Button — CSS tap animation

**What changed:** `motion.span` wrapper replaced with a plain `<span>` that uses `isPressed` state + pointer events. `ButtonSpinner` uses CSS `animation: kaya-spin` instead of Framer Motion `rotate`. `motion` import removed.

**Visual regression tests:**

- [ ] Click and hold any `variant="default"` button. It scales down to ~0.98 while held.
- [ ] Release. It springs back to scale 1.
- [ ] Click a `variant="secondary"` button — same scale behaviour.
- [ ] Click a `variant="danger"` button — same scale behaviour.
- [ ] Click a `variant="ghost"` button — same scale behaviour.
- [ ] Click a `variant="outline"` button — same scale behaviour.
- [ ] Disabled button: no scale down on click.
- [ ] Loading spinner (`loading={true}`): spinner rotates continuously; rotation looks smooth (CSS `kaya-spin` keyframe).
- [ ] Loading spinner: same speed and easing as before (`1s cubic-bezier(0.25,0.1,0.25,1) infinite`).
- [ ] Tab to a button via keyboard; focus ring appears. Click via Space/Enter; no scale (pointer event never fires for keyboard activation).
- [ ] `asChild` (renders as Next.js Link): tap scale still works.
- [ ] `fluid` variant: button fills width; tap scale does not break layout.
- [ ] Mouse enters → corrosion glow activates. Mouse leaves → glow fades. (Verifies `motion` removal did not break `useCorrosion`.)

**Functional tests:**

- [ ] `onClick` fires on pointer release (not on press).
- [ ] `onMouseEnter` / `onMouseLeave` still work (hover state drives shadow/bg changes).
- [ ] `leftIcon` and `rightIcon` are invisible during `loading`, label stays visible (stable width).
- [ ] `disabled` button cannot be clicked.

---

### 3.4 Checkbox — CSS tap animation

**What changed:** `motion.span` wrapper replaced with plain `<span>` + `isPressed` state. `motion` import removed.

- [ ] Click and hold a checkbox. It scales down to ~0.9 while held.
- [ ] Release. It returns to full size.
- [ ] Disabled checkbox: no scale on click.
- [ ] Check state toggles correctly on click (controlled and uncontrolled modes).
- [ ] Check state toggles on Space key (Radix default).
- [ ] Check state toggles on Enter key (custom `onKeyDown` handler).
- [ ] Focus ring appears on keyboard focus (`Tab` navigation), not on mouse click.
- [ ] Focus ring disappears on `Blur`.
- [ ] `TickTwoIcon` draw animation plays on check, undraw on uncheck, with the `TICK_DRAW_DELAY_MS` two-beat timing.

---

### 3.5 Tooltip — CSS slide animation

**What changed:** `motion.div` replaced with plain `<div>` using `opacity` + `transform` CSS transitions. Double-RAF for enter state. `onTransitionEnd` triggers unmount on close. `motion` and `springs` imports removed.

- [ ] Hover over any element with a `<Tooltip>`. Tooltip fades in and slides the correct direction (top → slides up from trigger, bottom → slides down, left → slides left, right → slides right).
- [ ] Move mouse away. Tooltip fades out; after the transition completes it is removed from the DOM (`mounted = false`).
- [ ] No tooltip lingers in the DOM after mouse leaves (check Elements panel).
- [ ] `disabled={true}` tooltip: tooltip never appears; trigger element is not remounted.
- [ ] Tooltip re-enables after `disabled` flips back to `false`.
- [ ] Tooltip content (`content` prop) renders plain text and ReactNode content correctly.
- [ ] `sideOffset` moves the tooltip the correct distance from the trigger.
- [ ] Tab focus on the trigger element opens the tooltip; Tab away closes it.
- [ ] Multiple tooltips on the same page do not interfere with each other.
- [ ] No layout shift while tooltip is mounting (initial state is `opacity: 0`, not visible).

---

### 3.6 Chip — CSS icon swap animation

**What changed:** `AnimatePresence` + two `motion.span` elements replaced with two always-mounted `position: absolute` spans using CSS `opacity`, `transform: scale()`, `filter: blur()` transitions. `useReducedMotion` inlined. Framer Motion import removed.

**Medium chip (default):**

- [ ] At rest: persona image (or default logo icon) is visible; × remove button is hidden.
- [ ] Hover over the chip: logo icon fades/scales out with a blur; × button fades/scales in.
- [ ] Move mouse away: × fades out; logo icon returns.
- [ ] The transition is smooth (not an instant swap). Approximately 120 ms CSS transition.
- [ ] Click the × button: `onRemove` fires; chip is removed from wherever it is rendered (ChatInput chip row).
- [ ] Focus (Tab) on the chip: same hover-like swap occurs.
- [ ] Blur (Tab away): swap returns to rest state.
- [ ] `disabled` chip: no icon swap on hover; opacity 0.7; cursor not-allowed.
- [ ] `onExpand` prop: always-visible chevron-down ChipButton appears (no swap animation needed for this slot).
- [ ] `onChange` prop: right slot shows ExchangeOneIcon at rest, spinnable ChipButton on hover.
- [ ] `personaImage` url: image appears at rest; swaps to × on hover.
- [ ] `personaImage` broken URL: falls back to logo icon gracefully.

**Small chip:**

- [ ] No hover animation (Small variant uses always-visible × ChipButton).
- [ ] `onRemove` fires on × click.
- [ ] `onExpand` fires on chevron click.
- [ ] Color variants (Blue, Red, Green, Yellow, Purple, Brown, Neutral) all render correctly.

**Reduced motion:**

- [ ] With `prefers-reduced-motion: reduce` in OS/DevTools: the icon swap happens with opacity-only transition (no scale or blur).

---

### 3.7 Tabs — CSS pill animation

**What changed:** Two `motion.div` pill layers replaced with `div` elements driven by `useLayoutEffect` DOM mutations. `animate()` API calls for the scrollable shadow replaced with `el.style.transition` + direct DOM mutation. `animate`, `motion`, `springs` imports removed.

**Non-scrollable tabs:**

- [ ] Select a different tab. The white pill background slides to the new tab position with a smooth CSS transition (~300 ms).
- [ ] The inner shadow layer moves in sync with the white pill.
- [ ] On first mount / page load: pill snaps to the active tab with **no transition** (no animated slide on initial render).
- [ ] All tab content changes to the selected tab's content.
- [ ] Keyboard navigation (Left/Right arrows): pill slides to each tab as it receives focus.

**Scrollable tabs (`scrollable` prop):**

- [ ] The outer drop shadow element also slides when switching tabs.
- [ ] While drag-scrolling the tab bar: the shadow follows the pill's scroll position immediately (no spring delay during active drag).
- [ ] After drag scroll stops: selecting a tab animates the shadow to the new position.
- [ ] On first mount: shadow snaps to initial tab position with no transition.
- [ ] `overflowing` cursor: grab cursor appears when tabs overflow the container; grabbing cursor during drag.
- [ ] Clicking a tab (not dragging) still selects it correctly (the drag-prevention click re-issue logic works).

---

## Phase 4 — Architectural / Virtualisation

---

### 4.1 Chats page — virtualised list

**What changed:** `filteredChats.map()` replaced with `useVirtualizer`. Only visible `ChatRow` components are in the DOM. `scrollRef` added to the outer scroll container.

- [ ] Open `/chats` with 20+ chats. Scroll through the list. All chats are visible and accessible via scrolling.
- [ ] With 100+ chats, inspect Elements panel — confirm only ~10–15 `[role="listitem"]` elements are present in the DOM at any one time.
- [ ] Scroll to the bottom. Last chat is visible.
- [ ] Scroll to the top. First chat is visible.
- [ ] Search filters the list. Results appear immediately; virtual container height updates.
- [ ] Clear search. Full list is restored.
- [ ] Search with no results shows "No chats match…" message (outside virtual list; no crash).
- [ ] No chats at all (empty state): `<ChatRow isEmpty />` placeholder renders.
- [ ] Click a chat row. Navigation to `/chat?id=…` works.
- [ ] Star a chat from the row menu. Row updates in place.
- [ ] Rename a chat. Row updates in place.
- [ ] Delete a chat. Row disappears; list re-renders correctly.
- [ ] Selection mode: checkbox appears on each visible row. Selecting all / selecting individual rows works.
- [ ] Move to project modal opens and completes correctly in selection mode.
- [ ] Entering selection mode hides the search bar (AnimatePresence collapse still works).
- [ ] Pin count badge on a chat row displays correctly.
- [ ] `pinBoardOpen` highlight on a row works.

---

### 4.2 Chat messages — virtualised list

**What changed:** `AnimatePresence` removed; `messages.map()` replaced with `useVirtualizer(messages.length)`. Message heights measured dynamically via `measureElement`.

**Scroll behaviour:**

- [ ] Open an existing chat with 10+ messages. The view scrolls to the bottom message on load.
- [ ] Open an existing chat with 50+ messages. Bottom is shown on load (not the top).
- [ ] Send a new message. View scrolls to the bottom to show the user message and the streaming response.
- [ ] During streaming, view stays at the bottom as new tokens arrive.
- [ ] Scroll up manually during streaming. View does **not** auto-scroll back to bottom (user-initiated scroll is respected).
- [ ] After streaming completes, the "scroll to bottom" logic does not force-scroll if the user has scrolled up.
- [ ] Scroll to the very top. The "load more messages" pagination triggers (`hasMoreMessages` true scenario).
- [ ] After loading more messages, scroll position is preserved (does not jump to top or bottom).

**Rendering:**

- [ ] With 50+ messages, inspect Elements panel. Only ~8–12 message elements are in the DOM at a time.
- [ ] Scroll through all messages. Each message renders correctly when it comes into view.
- [ ] Short messages and long markdown messages both render at correct heights (no content clipping).
- [ ] Code blocks in messages are fully visible (not truncated by virtualiser row height).
- [ ] Long reasoning blocks expand and collapse; the virtual row re-measures and adjusts.
- [ ] Attachments (images, file chips) in user messages render correctly.
- [ ] Citations chips render correctly in assistant messages.
- [ ] Regenerate last message: last message is replaced; view scrolls to bottom.
- [ ] Edit user message: message updates in place; view does not jump.
- [ ] Loading spinner (`LoadingSpinner`) shows for pagination — positioned above virtual list.

---

### 4.3 Personas page — virtualised grid

**What changed:** `filtered.map()` replaced with row-based `useVirtualizer` (3 cards per row). `personasScrollRef` added to the scroll container.

- [ ] Open `/personas` with 9+ personas. Scroll through the grid. All personas are visible.
- [ ] With 30+ personas, inspect Elements panel — confirm only 3–5 grid rows are in the DOM at a time (each row has 3 cards).
- [ ] Grid columns remain 3-across at all times (no layout shifts from virtualisation).
- [ ] Gaps between rows are correct (paddingBottom per virtual row simulates the CSS gap).
- [ ] Empty state ("No personas yet") renders correctly when no personas exist.
- [ ] "No personas matching…" message renders correctly for an active search with no results.
- [ ] Search filters the grid. Virtual container height updates to match filtered result count.
- [ ] Clearing the search restores the full grid.
- [ ] Sort (A to Z / Z to A / Activity) reorders cards correctly.
- [ ] Status filter (Active/Paused/All) filters cards correctly.
- [ ] Hover state on `PersonaCard` works (edit/use buttons appear on hover).
- [ ] Edit button navigates to the persona configuration page.
- [ ] Delete confirmation dialog opens and confirms deletion.
- [ ] Pause/Resume toggle updates the card correctly.
- [ ] Skeleton loading state (6 placeholder cards) shows while fetching.

---

### 4.4 Pinboard — virtualised pin list

**What changed:** `pins.map()` with `EnterChunk` replaced with `useVirtualizer(pins.length)`. The flex-column container (with `gap: 8`) replaced with a `position: relative, height: getTotalSize()` container. Each virtual item has `paddingBottom: 8` to restore the visual gap.

**Core list behaviour:**

- [ ] Open the Pinboard with 10+ pins. All pins are accessible by scrolling.
- [ ] With 50+ pins, inspect Elements panel — confirm only ~8–12 pin elements are in the DOM at a time.
- [ ] Scroll to the bottom. Last pin is visible.
- [ ] Scroll to the top. First pin is visible.
- [ ] Gap between pins is visually correct (8 px between each pin, matching the previous layout).

**Pin interactions:**

- [ ] Expand a pin (click to expand). Pin grows in height. Virtual row re-measures; container height adjusts. No content clipping.
- [ ] Collapse the pin. Row re-measures and shrinks.
- [ ] `collapseSignal` (collapse-all button): all visible pins collapse. Virtual heights update.
- [ ] Copy a pin content. Clipboard contains correct text.
- [ ] Delete a pin. It disappears from the list. Remaining pins shift up correctly.
- [ ] Edit pin tags. Tags update in place.

**Filtering:**

- [ ] Open the Filter panel. Select a category/tag. Only matching pins remain in the virtual list.
- [ ] "No pin match" message shows when filters return no results.
- [ ] Clear filters. Full pin list is restored.
- [ ] Active-filter chip bar animates open/close (`AnimatePresence` on the filter bar still works — only the pin list was virtualised).

**Scroll mechanics:**

- [ ] The top and bottom fade/blur overlays appear and disappear correctly based on scroll position.
- [ ] The `atTop` state (which controls the top overlay opacity) is correctly detected with virtualised scroll.
- [ ] `paddingTop: topH` and `paddingBottom: bottomH + 4` on the scroll container still provide correct offset below the filter overlay.
- [ ] Drag-to-scroll (horizontal drag if applicable) still works.

---

### 4.5 ProjectCard — RSC server/client split

**What changed:** `ProjectCardBody.tsx` created as a server component (no `'use client'`) containing tags, description, and footer. `index.tsx` client component imports `ProjectCardBody` for the static subtree. New optional `body` prop allows consumers to pass a pre-rendered server instance.

**Regression tests (existing functionality):**

- [ ] ProjectCard renders correctly: title, description (3-line clamp), tags (Badge components), footer (updatedAt + chatCount).
- [ ] Hover state: background changes to `--neutral-50`; ⋮ menu fades in.
- [ ] Focus state (Tab): background changes to blue tint; focus ring visible; ⋮ menu fades in.
- [ ] Active state (`active` prop): blue border ring renders.
- [ ] `onClick` fires when the card body is clicked.
- [ ] `onClick` does **not** fire when the ⋮ menu is clicked (event.stopPropagation works).
- [ ] ⋮ menu opens with Edit, Archive, Delete items.
- [ ] Edit menu item triggers `onEdit`.
- [ ] Delete menu item triggers `onDelete`.
- [ ] Archive menu item is disabled (no action).
- [ ] Card without tags: no tag row renders (no empty gap).
- [ ] Card without description: description area collapses gracefully.
- [ ] `chatCount: 1` shows "1 chat"; `chatCount: 3` shows "3 chats".

**Server component split tests:**

- [ ] `Badge` components inside `ProjectCardBody` render correctly (correct color variants).
- [ ] `ProjectCardBody` can be imported independently without requiring a client-side JS bundle.
- [ ] Passing `body={<ProjectCardBody {...props} />}` via the `body` prop renders identically to the default (no `body` prop) rendering.
- [ ] No TypeScript errors on `ProjectCardProps` (body prop is optional).

---

## Cross-Phase — Global Regression Tests

Run these after completing any phase.

---

### G.1 Full chat flow

- [ ] Create a new chat from `/chat`. First message sends correctly.
- [ ] Streaming response renders incrementally.
- [ ] Stop generation mid-stream. Partial response is preserved.
- [ ] Send a follow-up message. Response is contextual.
- [ ] Attachment upload (image or file). Preview shows in input. File is included in the send.
- [ ] Web search toggle ON: response includes citations.
- [ ] Compare models panel: both models stream responses side by side.

### G.2 Navigation and routing

- [ ] Navigate between `/chat`, `/chats`, `/personas`, `/projects`, `/settings` without errors.
- [ ] Browser back/forward works correctly after navigation.
- [ ] Deep-link to `/chat?id=…` opens the correct chat at the bottom.
- [ ] Hard refresh on any route: app rehydrates without console errors.

### G.3 No console errors

- [ ] No React `key` duplication warnings.
- [ ] No "Cannot update a component while rendering a different component" warnings.
- [ ] No `useEffect` dependency warnings (missing/extra deps) introduced by the changes.
- [ ] No `ResizeObserver loop limit exceeded` errors.
- [ ] No `AnimatePresence` or Framer Motion errors (the removed imports should not leave dangling references).

### G.4 Framer Motion removal verification

- [ ] Run `grep -r "from 'framer-motion'" src/components/Button src/components/Checkbox src/components/Tooltip src/components/Chip src/components/Tabs` — should return **no matches**.
- [ ] Run `grep -r "from 'framer-motion'" src/context/highlight-context.tsx` — should return **no matches**.
- [ ] Run `grep -r "from 'framer-motion'" src/lib/highlight.ts src/hooks/useHighlightJs.ts` — should return **no matches**.
- [ ] Run `grep -r "from \"framer-motion\"" src/components/chat/ChatInterface.tsx` — should return **no matches**.

### G.5 Virtualisation — no CSS sibling-selector regressions

- [ ] No `:nth-child` CSS rules target chat messages, chat rows, persona cards, or pins for visual styling. (Virtualised lists remove off-screen nodes, breaking sibling-count selectors.)
- [ ] No `~ sibling` or `+ adjacent` CSS rules target list items.
- [ ] Confirm with: `grep -r "nth-child\|nth-of-type\|+ .ChatRow\|~ .Pin" src/` — should return no matches targeting virtualised items.

### G.6 Accessibility

- [ ] Keyboard-navigate the chats list (Tab / Arrow keys). Focus moves through visible rows.
- [ ] Keyboard-navigate the personas grid. Focus moves through visible cards.
- [ ] Screen reader reads the chat message list correctly (virtual items have correct `role` / `aria-*`).
- [ ] Pinboard pins are reachable via keyboard.
- [ ] All focus rings are visible on keyboard focus across Button, Checkbox, Tooltip trigger, Chip, Tabs.

---

## Bundle Size Spot-Check

Run against a production build (`npm run build`).

```bash
# Install once
npm install --save-dev @next/bundle-analyzer

# In next.config.ts temporarily:
# const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: true })
# export default withBundleAnalyzer(nextConfig)

ANALYZE=true npm run build
```

- [ ] `framer-motion` chunk is **not** present in the pages that only use Button/Checkbox/Tooltip/Chip/Tabs (the five de-motioned components). It may still appear for pages that use Pinboard/Chat animations.
- [ ] `highlight.js` language files appear as many small chunks (one per language), not one monolithic chunk containing all 38 languages.
- [ ] `@tanstack/react-virtual` appears as a single small chunk (< 15 KB gzipped).
- [ ] `ProjectCardBody` does **not** appear in any client JS bundle when used from a server component consumer (verify via bundle analysis once a server-component consumer page is created).
- [ ] No `@aws-sdk` appears in any client bundle.
- [ ] KaTeX CSS is absent from the landing/auth page bundle.
