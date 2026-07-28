# Performance Optimization Reference — SouvenirAI Front-End

> Last updated: May 2026 | Stack: Next.js 16, React 19, Tailwind 4, Framer Motion 12, Vercel

---

## Root Causes (Why It Is Slow)

Three compounding problems drive most of the slowness:

1. **Framer Motion is imported in 40+ components** — the entire ~130–180 KB library ends up in the shared vendor bundle on every page.
2. **The entire app is `"use client"`** — no server components, no pre-rendered HTML, no server-side data fetching. The browser must download, parse, execute, and hydrate everything before the user sees anything.
3. **Every chat message re-renders on every streaming token** — no `React.memo`, no memoization, and `react-markdown` re-parses the entire AST ~20 times per second during generation.

These three multiply each other. Large bundle → slow parse → client waterfall → thrashing reconciler.

---

## Risk Classification

Before the findings, understand the risk of each type of change:

| Change Type | UI/Logic Risk | Notes |
|---|---|---|
| `useCallback` / `useMemo` (correct deps) | None | React ignores hint if deps are wrong — no regression |
| `React.memo` on leaf components | Low | Safe only if all data comes through props — audit each before wrapping |
| RAF convergence guards | None | Visual only, imperceptible |
| `dynamic()` lazy loading | Low | Needs a proper `loading` fallback or you get blank flashes |
| `next/image` replacing `<img>` | Low–Medium | Requires explicit dimensions per image — do image by image |
| Framer Motion → CSS transitions | Visual only | Animations look different (snappier, less springy) — needs design sign-off |
| Streaming update batching | Low | May add 1–16 ms latency to visible streaming — test against current feel |
| Context splitting | Medium | Every consumer must be updated — silent stale-data bugs if any are missed |
| `useReducer` consolidation | Medium | Reducer must exactly replicate previous `useState` semantics |
| **Virtualization** | **High** | Removes off-screen DOM nodes — breaks CSS sibling selectors, Framer Motion AnimatePresence on list items, drag-and-drop, focus/tab order, scroll-to-item. Needs a dedicated test pass per feature. |

---

## Issues by Feature Area

---

### 1. Chat Interface

**File:** `src/components/chat/ChatInterface.tsx`

#### No message list virtualization
During a long conversation (50+ messages), the entire message list is in the DOM at all times. Even past messages that are not visible are mounted and can re-render.
- **Fix:** `@tanstack/react-virtual` or `react-window` `FixedSizeList`
- **Risk:** High — confirm no CSS `:nth-child` selectors depend on full DOM; AnimatePresence on message entrance will need reworking; scroll-to-bottom logic must be updated

#### No `React.memo` on `<ChatMessage>`
During streaming, `setMessages` fires every 50 ms. Without memoization all messages in the list re-render on every flush even if their content did not change.
- **Fix:** `export default React.memo(ChatMessage, (prev, next) => prev.message.id === next.message.id && prev.message.content === next.message.content)`
- **Risk:** Low — verify message receives all data through props, not closure

#### Inline `onUploadProgress` object recreated in `handleSend` (~line 405)
Every call to `handleSend` creates a new object `{ onUploadProgress: () => {...} }`, which invalidates downstream memoization.
- **Fix:** `useCallback` wrapping `handleSend` with correct deps
- **Risk:** None

#### Pin dropdown listener re-registered on every `showPinDropdown` change (~line 268)
`addEventListener` + `removeEventListener` is called each time the boolean flips.
- **Fix:** `useCallback` to stabilize the handler reference; the effect re-runs but at least the function identity is stable
- **Risk:** None

#### Multiple `setAttachments` calls not batched when absorbing `addMenuFiles` (~line 316)
Rapid successive state updates before React 19's automatic batching takes effect can cause intermediate renders.
- **Fix:** Merge into a single `setAttachments(prev => [...prev, ...newFiles])` call
- **Risk:** None

---

### 2. New Chat (ChatInput)

**File:** `src/components/chat/ChatInput.tsx`

#### `ChatInput` (forwardRef) not wrapped in `React.memo`
Any parent re-render causes a full ChatInput reconciliation pass even when props have not changed.
- **Fix:** `export default React.memo(React.forwardRef(ChatInputInner))`
- **Risk:** Low

#### `handleMentionChange`, `handlePinNavigate` recreated on every render (~line 200)
These callbacks are passed as props to child components. Without `useCallback`, child components that are memoized see new prop references on every render and re-render anyway.
- **Fix:** `useCallback` on both handlers
- **Risk:** None

#### `AudioWaveDisplay` RAF loop has no convergence guard (~line 83)
The decay loop animates bars toward zero but uses a multiplicative decay (`bar * 0.85`) which mathematically never reaches exactly `0`. The RAF loop runs indefinitely even when the waveform is visually flat.
- **Fix:**
  ```ts
  if (bars.every(b => Math.abs(b) < 0.001) && !isActive) {
    cancelAnimationFrame(rafId)
    return
  }
  ```
- **Risk:** None — change is imperceptible at sub-0.1% bar height

---

### 3. Chat Board (Chats List)

**File:** `src/app/(app)/chats/page.tsx`

#### No virtualization on chat list (~line 240)
A user with 100+ chats renders all `ChatRow` components unconditionally.
- **Fix:** `react-window` `FixedSizeList`
- **Risk:** High — same concerns as message list (see above)

#### `ChatRow` not wrapped in `React.memo`
Any state change in the parent (e.g. selection mode toggle) re-renders every row.
- **Fix:** `React.memo(ChatRow)`
- **Risk:** Low

#### `pinCountMap` built as a plain object (~line 42)
`useMemo` is correctly used, but lookups inside `ChatRow` are `O(1)` with object keys anyway — low impact. The bigger issue is that `pinCountMap` recalculates when `pins` array reference changes even if pin counts did not.
- **Fix:** No change needed if `pins` is already stable. If not, consider a `Map` and stable reference.
- **Risk:** None

---

### 4. Projects

**File:** `src/app/(app)/projects/page.tsx`

#### Single `useMemo` for filter + sort (~line 45)
Filter and sort are combined in one `useMemo`. A change to the sort order recalculates the filter and vice versa. With large project lists this is wasteful.
- **Fix:** Split into two memos: `filteredProjects = useMemo(filter, [projects, filterTerm])` then `sortedProjects = useMemo(sort, [filteredProjects, sortOrder])`
- **Risk:** None

#### `ProjectCard` not wrapped in `React.memo`
Grid re-renders every card on any parent state change (e.g. sort order dropdown toggle).
- **Fix:** `React.memo(ProjectCard)`
- **Risk:** Low — confirm card reads all data from props

---

### 5. Personas

**File:** `src/app/(app)/personas/page.tsx`

#### No virtualization on persona grid (~line 589)
Renders all personas as a grid regardless of scroll position.
- **Fix:** `@tanstack/react-virtual` with grid support
- **Risk:** High — CSS grid layout and multi-column virtualization is non-trivial; must verify no sibling-selector CSS

#### Complex filter + sort in single `useMemo` (~line 283)
Multiple filter conditions (status, tags, search text, sort) recalculate together. Adding a tag filter re-runs the sort on every keystroke.
- **Fix:** Chain: `tagFiltered → statusFiltered → searchFiltered → sorted`, each as its own `useMemo`
- **Risk:** None

#### Skeleton items lack stable keys (~line 514)
Using index as key on skeleton grid. Not a crash but causes unnecessary DOM reconciliation when count changes.
- **Fix:** `Array.from({ length: 12 }, (_, i) => <SkeletonCard key={`sk-${i}`} />)`
- **Risk:** None

---

### 6. Pinboard

**File:** `src/components/Pinboard/index.tsx`

#### No virtualization — critical (~line 73)
The pinboard grid can contain 50–200+ pins. Every pin is mounted in the DOM at all times.
- **Fix:** `react-window` `FixedSizeGrid`
- **Risk:** High — pinboard has drag-and-drop and CSS grid layout. Virtualization removes off-screen DOM nodes, which breaks most DnD libraries. This needs a dedicated implementation using a virtualization-aware DnD solution (e.g. dnd-kit with virtual support).

#### `onKeyDown` handler with `stopPropagation` recreated per render in `TagSearchInput` (~line 175)
- **Fix:** `useCallback`
- **Risk:** None

#### Dropdown tag list items keyed by index when filter changes (~line 197)
When the user types in the tag search, filtered list items get wrong keys, causing React to reuse DOM nodes incorrectly.
- **Fix:** Key by tag `id` or tag text, not by array index
- **Risk:** None — pure correctness fix, no visual change

---

### 7. Extended Pinboard

**File:** `src/components/PinboardExpanded/index.tsx`

#### Six separate `useState` for dropdown open states (~line 213)
Each dropdown toggle causes 2 state updates (close previous, open next) × 6 = up to 12 `useState` calls for what is conceptually one piece of state (`activeDropdown: string | null`).
- **Fix:**
  ```ts
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  // Usage: setOpenDropdown('export') / setOpenDropdown(null)
  ```
- **Risk:** Medium — must map every existing `isXxxOpen` reference to the new pattern. Verify close-on-same-toggle behavior is preserved.

#### `ResizeObserver` re-created on every `personalFolders` change (~line 226)
The observer is set up in an effect that depends on `personalFolders`. Any folder rename/add/remove tears down and re-creates the observer unnecessarily.
- **Fix:** Separate the DOM observation (depends only on the ref) from the data (depends on `personalFolders`). Use `useLayoutEffect` for the observer and a separate `useEffect` for folder data.
- **Risk:** Low

---

### 8. Compare Models

**File:** `src/components/compare/CompareModels.tsx`

#### `transformModelForCompare` not memoized (~line 228)
This function allocates arrays and transforms model data on every render, even when the model data has not changed.
- **Fix:** `useMemo(() => transformModelForCompare(model), [model])`
- **Risk:** None

#### Inline style object + `CHIP_COLORS` lookup per render in `Chip` (~line 148)
Each `<Chip>` creates a new style object `{ backgroundColor: CHIP_COLORS[type] }` on every render.
- **Fix:** `const style = useMemo(() => ({ backgroundColor: CHIP_COLORS[type] }), [type])`
- **Risk:** None

#### Duplicate `AudioWaveDisplay` component (same as ChatInput)
Same RAF convergence issue as ChatInput (see Section 2). This component is copy-pasted.
- **Fix:** Extract to `src/components/shared/AudioWaveDisplay.tsx`, fix the convergence guard once, import in both places.
- **Risk:** None — refactor only, no behavior change

---

### 9. Highlights

**File:** `src/context/highlight-context.tsx`

#### Single global context causes cascading re-renders
Any highlight add/remove/update triggers a re-render of every component subscribed to the context — including components that only display highlights and never mutate them.
- **Fix:** Split into two contexts:
  ```ts
  const HighlightsDataContext = createContext<Highlight[]>([])     // read
  const HighlightsActionsContext = createContext<Actions>(null)     // write (stable ref)
  ```
  Components that only display highlights subscribe to `HighlightsDataContext`. The actions object is stable and never causes re-renders.
- **Risk:** Medium — every current consumer (`useHighlights()`) must be audited and updated to use the correct sub-context. Silent stale-data bugs if any are missed.

---

### 10. Settings

**File:** `src/app/(app)/settings/page.tsx`

The settings shell itself is a redirect — no issues. Sub-pages (Connectors, Model Config, etc.) are the concern.

#### Sub-pages not lazy-loaded
All settings sub-pages are statically imported into the layout even when the user is on a different route.
- **Fix:** `dynamic(() => import('@/app/(app)/settings/connectors/page'), { ssr: false })` for each sub-page
- **Risk:** Low — needs a loading skeleton per sub-page

---

## Global Issues (All Areas)

---

### Framer Motion in 40+ components

**Files:** `Button/index.tsx`, `Checkbox/index.tsx`, `Chip/index.tsx`, `Tooltip/index.tsx`, `ChatMessage.tsx`, `ResponseBlocks.tsx`, `ReasoningBlock.tsx`, `XmlChart.tsx`, `XmlTable.tsx`, `LeftSidebar.tsx`, `RightSidebar.tsx` and ~30 more.

Framer Motion v12 is ~130–180 KB gzipped. Because it is imported across the component tree Next.js cannot chunk-split it — it lands in the shared vendor bundle on every page, including the auth/landing page.

Every `<motion.div>` also registers a JS animation loop on the main thread.

- **Fix:** Replace `motion.div` with CSS transitions in all primitive components (Button, Chip, Checkbox, Tooltip, Tabs). Keep Framer Motion only where spring physics genuinely add value: Pinboard drag-and-drop, streaming indicators, complex entrance animations.
- **Risk:** Visual — animations become CSS-timed instead of spring-physics. Faster and snappier but less "physical." Needs design review.

---

### All pages are `"use client"` — no server components

Every page, layout, and component has `"use client"`. Next.js App Router is built around React Server Components that render on the server and ship zero JS to the client. This app ships the entire UI as JavaScript.

On first load: download → parse → execute → hydrate → API waterfalls → interactive. No pre-rendered HTML.

- **Files:** `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/layout/AppLayout.tsx`
- **Fix:** Identify leaf display components (persona cards, project cards, model cards) that have no interactivity and convert them to server components. Move list fetching to server layouts. Only components with `useState`/`useEffect`/event handlers stay as `"use client"`.
- **Risk:** Architectural — large scope, must be done incrementally per route

---

### 20+ unoptimized `<img>` tags

Using plain `<img>` instead of `next/image` means: no WebP conversion, no automatic lazy loading, no size hints for LCP, no blur placeholder.

**Key files:**
- `src/components/chat/ActivityRow.tsx` line 103
- `src/components/chat/CitationsPanel.tsx` lines 209, 217
- `src/components/chat/ChatMessage.tsx` line 595
- `src/components/chat/ResponseBlocks.tsx` — favicon images in `CitationChip`
- Multiple persona/project card avatar images

- **Fix:** Replace with `import Image from 'next/image'` — set `width`/`height` for fixed-size images, or `fill` + positioned parent for fluid images. Whitelist external domains in `next.config.ts`.
- **Risk:** Low–Medium — each image needs manual dimension verification. Do image by image, not in bulk.

---

### react-markdown re-parses entire AST on every streaming token

During streaming, `ContentRenderer` → `MarkdownRenderer` → `<ReactMarkdown>` receives the growing content string every 50 ms. `react-markdown` re-parses the entire markdown AST from scratch on each call.

For a 2-second response at 50 ms intervals: 40 full markdown parses.

- **Files:** `src/lib/content-renderer.tsx`, `src/lib/markdown-utils.tsx`, `src/components/chat/ChatMessage.tsx`
- **Fix (short-term):** Memoize `<ReactMarkdown>` output for completed messages: `useMemo(() => <ReactMarkdown>{content}</ReactMarkdown>, [content])`. Move `components`, `remarkPlugins`, `rehypePlugins` to module-level constants (they recreate a new object reference per render today, defeating memoization).
- **Fix (proper):** Render raw text during streaming with no markdown parsing. Apply markdown only on the final flush when `isStreaming === false`.
- **Risk:** Medium — the "raw text during streaming" approach changes how code blocks and formatting appear mid-stream. Test that the final-flush transition is not jarring.

---

### N+1 API calls from PinboardContext on mount

**File:** `src/context/pinboard-context.tsx`

```ts
const apiPins = await listPins()                                // 1 call
const enrichments = await Promise.all(
  pinsWithoutTags.map(pin => getPin(pin.id))                   // up to N calls
)
```

A user with 50 pins without tags triggers 51 API calls on every app mount. These go through the `/api/backend/` Vercel proxy, saturating the connection pool.

- **Fix (backend preferred):** Have `listPins` return tags inline.
- **Fix (frontend fallback):** Defer tag enrichment — load it lazily when the pinboard panel is opened, not on app mount. Show pins without tags immediately.
- **Risk:** Low — deferred loading means tags briefly appear empty until the panel opens. Add a loading indicator on the tag field.

---

### KaTeX and Highlight.js CSS loaded globally

**File:** `src/app/layout.tsx`

```ts
import "katex/dist/katex.min.css"                // ~75 KB
import "highlight.js/styles/atom-one-light.css"  // ~8 KB
```

Both block rendering on every route, including auth/landing pages that never render math or code.

- **Fix:** Move these imports to `src/app/(app)/layout.tsx`. They only need to load inside the authenticated app shell.
- **Risk:** None

---

### Highlight.js registers 38 languages eagerly

**File:** `src/lib/highlight.ts`

All 38 language grammars (Python, Java, C++, Rust, Kotlin, Scala, Haskell, Elixir, Perl, Lua, etc.) are bundled into a single dynamic chunk. A user writing a Python chat never needs Haskell.

- **Fix:**
  ```ts
  const loaders: Record<string, () => Promise<unknown>> = {
    python:     () => import('highlight.js/lib/languages/python'),
    typescript: () => import('highlight.js/lib/languages/typescript'),
    // ...
  }
  async function loadLanguage(lang: string) {
    const loader = loaders[lang]
    if (loader) hljs.registerLanguage(lang, (await loader()).default)
  }
  ```
- **Risk:** Low — languages load on first use. First render of a code block in that language has a one-time async delay (imperceptible on fast connections).

---

### favicon fetching via Google S2 service on every citation chip

**File:** `src/components/chat/ResponseBlocks.tsx` — `CitationChip`

```
https://www.google.com/s2/favicons?domain=${effectiveDomain}&sz=32
```

A response with 10 citations = 10 third-party requests per message render. Each has its own DNS lookup and round-trip to Google's servers.

- **Fix:** Cache in a module-level `Map<string, string>` (domain → URL). First request fetches, subsequent renders use the cached URL.
- **Risk:** None

---

### `useSquircle` — ResizeObserver on every Button instance

**File:** `src/lib/useSquircle.ts`

A `ResizeObserver` is created per `<Button>` and `<IconButton>` instance to compute an SVG squircle clip path. A page with 20 buttons = 20 active ResizeObservers, all firing synchronously during layout.

- **Fix:** Cache computed paths by `{width, height, cornerRadius}` in a module-level `Map`. Most buttons are fixed size — the observer fires once and the path is reused everywhere.
- **Risk:** None

---

### `useCorrosion` — rAF physics loop on every hover

**File:** `src/lib/useCorrosion.ts`

A spring-physics ripple animation runs via `requestAnimationFrame` at 60 fps on every hover interaction across interactive elements. JS on the main thread at 60 fps competes with scroll, typing, and React state updates.

- **Fix:** Reimplement with CSS `radial-gradient` driven by a CSS custom property. A single `requestAnimationFrame` call updates one CSS variable; the browser compositor handles the visual update off the main thread.
- **Risk:** Visual — the effect will look slightly different. Low functional risk.

---

### No `dynamic()` imports for heavy modal/panel components

**Files:** `src/app/(app)/chat/page.tsx`, `src/app/(app)/layout.tsx`, `src/components/layout/AppLayout.tsx`

`PresetModelSelectorDialog`, `SystemInstructionsModal`, `EditProjectModal`, `CompareModels`, `CitationsPanel`, `PinboardExpanded` are all statically imported. Their JS code is in the initial bundle even for users who never open them.

- **Fix:**
  ```ts
  const CompareModels = dynamic(
    () => import('@/components/compare/CompareModels'),
    { ssr: false }
  )
  ```
  Apply to every modal, drawer, and side-panel component.
- **Risk:** Low — needs a `loading` prop or skeleton so the UI does not flash blank. `ssr: false` can cause a hydration flicker — wrap in a `mounted` guard if needed.

---

### `@aws-sdk/client-secrets-manager` in production dependencies

**File:** `package.json`

The AWS SDK (~2–5 MB installed) is only used in `scripts/load-secrets.mjs` at build time. Listed as a production dependency means it is included in the Vercel Lambda function bundle.

- **Fix:** Move to `devDependencies`.
- **Risk:** None

---

### Missing `Cache-Control` headers on API responses

The Next.js route handlers and backend proxy do not set caching headers. Every sidebar render fetches a fresh chat list, models list, etc. even when nothing changed.

- **Fix:** Add `stale-while-revalidate` headers to the models list and chat list endpoints. Return cached responses for data that changes infrequently.
- **Risk:** Low — need to ensure cache is invalidated on mutations (new chat, model change)

---

## Estimated Bundle Weight

| Library / Pattern | Estimated gzipped size |
|---|---|
| framer-motion v12 (could be chunked) | ~130–180 KB |
| @hugeicons/react + core-free-icons | ~40–80 KB |
| @strange-huge/icons (private, unknown) | Unknown |
| react-markdown + remark-gfm + remark-math | ~60–80 KB |
| rehype-katex + katex | ~90–120 KB |
| highlight.js (38 languages, lazy chunk) | ~150–200 KB |
| AWS SDK (if accidentally bundled) | Up to 500 KB |
| **Total avoidable weight** | **~470–660 KB gzipped** |

> Current estimated first-load JS: 800 KB–1.2 MB gzipped. Target for a chat app: under 250 KB.

---

## Execution Plan

### Phase 1 — Zero/Low Risk, No UI Change (1–2 days)

| Task | File(s) | Risk |
|---|---|---|
| Move KaTeX + Highlight.js CSS to `(app)/layout.tsx` | `src/app/layout.tsx` | None |
| Move `@aws-sdk` to devDependencies | `package.json` | None |
| Move `remarkPlugins`/`rehypePlugins`/`components` to module-level constants | `src/lib/markdown-utils.tsx` | None |
| Cache squircle paths in module `Map` | `src/lib/useSquircle.ts` | None |
| Cache favicon URLs in module `Map` | `src/components/chat/ResponseBlocks.tsx` | None |
| Fix `AudioWaveDisplay` RAF convergence guard | `ChatInput.tsx`, `CompareModels.tsx` | None |
| Skeleton items — fix keys | `src/app/(app)/personas/page.tsx` | None |
| Dropdown tag list — fix keys | `src/components/Pinboard/index.tsx` | None |
| Split filter + sort into two `useMemo` chains | Personas, Projects pages | None |
| Six-dropdown state → single `openDropdown` state | `PinboardExpanded/index.tsx` | Medium |
| `useCallback` pass on all inline handlers | ChatInterface, ChatInput, Pinboard | None |

---

### Phase 2 — Low Risk, Needs Visual QA (3–5 days)

| Task | File(s) | Risk |
|---|---|---|
| `React.memo` on `ChatMessage` with custom comparator | `src/components/chat/ChatMessage.tsx` | Low |
| `React.memo` on `ChatRow`, `PersonaCard`, `ProjectCard`, `SourceCard` | Respective files | Low |
| `dynamic()` lazy imports for all modals and panels | `chat/page.tsx`, `layout.tsx`, `AppLayout.tsx` | Low |
| `next/image` replacement — one image at a time | 20+ files | Low–Medium |
| Defer pin tag enrichment to pinboard open event | `src/context/pinboard-context.tsx` | Low |
| Extract + deduplicate `AudioWaveDisplay` component | `ChatInput.tsx`, `CompareModels.tsx` | None |
| Batch streaming updates with microtask flush | `src/hooks/use-streaming-chat.ts` | Low |
| Memoize markdown output for completed messages | `src/lib/markdown-utils.tsx`, `ChatMessage.tsx` | Medium |
| Settings sub-pages lazy-loaded with `dynamic()` | `src/app/(app)/settings/*` | Low |

---

### Phase 3 — Medium Risk, Needs Full Test Pass (1–2 weeks)

| Task | File(s) | Risk |
|---|---|---|
| Split Highlights context into data + actions | `src/context/highlight-context.tsx` | Medium |
| Split pin operations context into data + operations | `src/hooks/use-pin-operations.ts` | Medium |
| Replace Framer Motion in primitive components with CSS transitions | `Button`, `Chip`, `Checkbox`, `Tooltip`, `Tabs` | Visual |
| Per-language dynamic imports for Highlight.js | `src/lib/highlight.ts` | Low |
| `useCorrosion` → CSS custom property ripple | `src/lib/useCorrosion.ts` | Visual |
| Streaming markdown: render raw text during stream, format on completion | `src/lib/content-renderer.tsx` | Medium |
| `stale-while-revalidate` on models + chat list endpoints | `src/lib/api/` | Low |

---

### Phase 4 — Architectural (2–4 weeks, incremental)

| Task | Notes | Risk |
|---|---|---|
| Virtualize chat message list | `@tanstack/react-virtual` — needs AnimatePresence + scroll-to-bottom rework | High |
| Virtualize chats list and persona grid | `react-window` — needs DnD audit | High |
| Virtualize pinboard grid | Requires DnD-aware virtualization (dnd-kit virtual) | High |
| Convert display-only components to React Server Components | Persona cards, project cards, model cards — start with one grid | Architectural |
| Move chat history + model list fetching to server layout | Eliminates loading waterfall on hard navigation | Architectural |
| Publish `@strange-huge/icons` to private npm registry | Required for Vercel build caching | Infra |

---

## How to Measure Progress

```bash
# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer

# next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
export default withBundleAnalyzer(nextConfig)

# Run
ANALYZE=true npm run build
# Open .next/analyze/client.html
```

Also add `@vercel/speed-insights` to measure real-user Core Web Vitals (LCP, FID, CLS) in production. Primary target: **LCP < 2.5 s on mobile**.

---

## Summary Table

| Area | Top Issue | Phase |
|---|---|---|
| Chat Interface | No `React.memo` on messages — 400 re-renders/sec during streaming | 2 |
| New Chat (ChatInput) | No `React.memo` on forwardRef component | 2 |
| Chat Board | No virtualization on chat list | 4 |
| Projects | Filter + sort not split | 1 |
| Personas | No virtualization; filter + sort not split | 1 / 4 |
| Pinboard | No virtualization; critical DnD conflict | 4 |
| Extended Pinboard | 6 separate dropdown states | 1 |
| Compare Models | `transformModelForCompare` not memoized | 1 |
| Highlights | Single context causes cascading re-renders | 3 |
| Settings | Sub-pages not lazy-loaded | 2 |
| Global | Framer Motion in 40+ files (~150 KB in shared bundle) | 3 |
| Global | All `"use client"` — no RSC, no pre-rendered HTML | 4 |
| Global | react-markdown re-parses every 50 ms during streaming | 2–3 |
| Global | N+1 pin tag calls on every app mount | 2 |
| Global | 20+ `<img>` tags without `next/image` | 2 |
