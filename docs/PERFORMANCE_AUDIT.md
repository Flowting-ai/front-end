# Performance Audit - SouvenirAI Front-End

> Audited: May 2026 | Stack: Next.js 16, React 19, Tailwind 4, Vercel

---

## THE MAIN REASON IT IS SLOW

> **Framer Motion is imported in 40+ components, the entire app is client-side only, and every chat message re-renders on every streaming token with no memoization.**

Those three things compound each other. The JS bundle is huge, it all executes on the client, and then it thrashes the React reconciler dozens of times per second during streaming.

---

## Issues - Ranked by Impact

### 🔴 CRITICAL

---

#### 1. Framer Motion imported in 40+ files

**What:** `framer-motion` v12 is used in virtually every component - Button, Checkbox, Chip, Tooltip, Tabs, Sidebar, ChatInput, ChatMessage, ReasoningBlock, ResponseBlocks, XmlChart, XmlTable, ActivityRow, FloatingMenu, HighlightPanel, and more.

**Why it hurts:** framer-motion is ~130–180 KB gzipped. Because it is imported across the entire component tree, Next.js cannot split it into per-route chunks - it ends up in the shared vendor bundle that ships on every page load. Every `<motion.div>` also registers a JS animation loop, consuming main-thread budget even for trivial transitions.

**Files:**
```
src/components/Button/index.tsx
src/components/Checkbox/index.tsx
src/components/Chip/index.tsx
src/components/Tooltip/index.tsx
src/components/chat/ChatMessage.tsx
src/components/chat/ResponseBlocks.tsx
src/components/chat/ReasoningBlock.tsx
src/components/chat/XmlChart.tsx
src/components/chat/XmlTable.tsx
src/components/layout/RightSidebar.tsx
src/components/layout/LeftSidebar.tsx
... (40+ more)
```

**Fix:** Replace simple open/close transitions with CSS transitions or the View Transitions API. Reserve framer-motion only for genuinely complex spring physics (e.g. the pinboard drag). Saves 130–180 KB gzipped.

---

#### 2. No React.memo / virtualization on chat messages

**What:** During streaming the `useStreamingChat` hook calls `setMessages` every 50 ms. The `messages` array is stored in component state and passed down without memoization. Every flush causes all `<ChatMessage>` components in the list to re-render, even past messages that have not changed.

**Why it hurts:** A chat with 20 messages = 20 full React subtree re-renders every 50 ms = ~400 reconciliations per second. Each `<ChatMessage>` runs `react-markdown`, the custom rehype highlight-marks plugin, and framer-motion spring physics on every tick.

**Files:**
```
src/hooks/use-streaming-chat.ts  - FLUSH_INTERVAL_MS = 50
src/components/chat/ChatInterface.tsx  - no React.memo, no stable keys
src/components/chat/ChatMessage.tsx    - no React.memo
src/lib/markdown-utils.tsx            - new Components object every render
```

**Fix:**
- Wrap `<ChatMessage>` in `React.memo` with a custom comparator that ignores stable past messages.
- Extract `remarkPlugins` and `rehypePlugins` arrays to module-level constants (they already are in markdown-utils, but the `components` object is recreated per render).
- Virtualize the message list with `react-window` or `@tanstack/react-virtual` once chats grow long.

---

#### 3. All pages are `"use client"` - zero server components

**What:** Every page, layout, and component has `"use client"` at the top. Next.js App Router is designed around React Server Components (RSC) that render on the server and ship zero JS to the client. This app ships the entire UI as JS.

**Why it hurts:** On first load, the browser must download, parse, execute, and hydrate the entire application JS before the user sees anything interactive. On Vercel this means a full round-trip JS payload before first paint. There is no pre-rendered HTML beyond an empty shell.

**Files:**
```
src/app/layout.tsx        - could have server portions
src/app/(app)/layout.tsx  - entirely client, wraps 6 providers
src/components/layout/AppLayout.tsx - "use client"
```

**Fix:** Identify leaf components that only display data and have no interactivity - convert them to server components. Move data fetching (chat list, pins, highlights) to server components / Route Handlers and pass data as props. Only components that need `useState`/`useEffect`/event handlers stay as `"use client"`.

---

### 🟠 HIGH

---

#### 4. Two icon libraries + a private GitHub package

**What:**
- `@hugeicons/react` + `@hugeicons/core-free-icons` - HugeIcons v4 ships thousands of icon definitions; each icon is a component imported from the monorepo.
- `@strange-huge/icons` (`github:strange-rock/strange-huge-icons`) - a private package pulled from GitHub at install time, no CDN caching, unknown bundle size.

**Why it hurts:** Even with tree-shaking, icon libraries that export barrel files can defeat bundlers. The private GitHub package is not on npm so Vercel re-downloads it on every build. It is also completely opaque to bundle analysis.

**Files:**
```
src/components/chat/ResponseBlocks.tsx  - @hugeicons/react + @hugeicons/core-free-icons
src/components/chat/ActivityRow.tsx     - both icon packages
src/app/(app)/chat/page.tsx             - @strange-huge/icons (many named imports)
src/components/layout/TopBar.tsx        - @strange-huge/icons
```

**Fix:**
- Publish `@strange-huge/icons` to a private npm registry so Vercel can cache it.
- Audit tree-shaking: ensure no `import * as Icons` pattern exists.
- Consider consolidating to a single icon library.
- For icons used in streaming paths (ActivityRow, ResponseBlocks), inline SVGs directly or use `dynamic()` lazy import.

---

#### 5. KaTeX and Highlight.js CSS loaded globally on every page

**What:** In `src/app/layout.tsx`:
```tsx
import "katex/dist/katex.min.css";          // ~75 KB
import "highlight.js/styles/atom-one-light.css";  // ~8 KB
```

Both are imported in the root layout, so every page - including the landing/auth page - pays the CSS cost even when no math or code blocks exist.

**Why it hurts:** ~83 KB of CSS that blocks rendering on every route.

**Fix:** Move these imports to the chat layout (`src/app/(app)/layout.tsx`) or lazy-load them dynamically inside the components that need them (`CodeBlock`, `LaTeXRenderer`). For KaTeX specifically, use a `<link rel="stylesheet">` with `media="print"` trick or CSS-in-JS scoping.

---

#### 6. Highlight.js registers 38 languages eagerly

**What:** `src/lib/highlight.ts` eagerly imports and registers 38 language grammars (Python, Java, C++, Rust, Kotlin, Scala, Haskell, Elixir, Perl, Lua, etc.).

**Why it hurts:** Even though `CodeBlock` dynamically imports this file, the single dynamic chunk contains all 38 grammars. A user writing a Python chat never needs Haskell or Elixir. This makes the lazy chunk much larger than it needs to be.

**Files:**
```
src/lib/highlight.ts  - 38 registerLanguage calls
src/components/chat/CodeBlock.tsx  - dynamic import of above
```

**Fix:** Use a language-detection registry that only loads grammars on demand:
```ts
const loaders: Record<string, () => Promise<unknown>> = {
  python: () => import('highlight.js/lib/languages/python'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  // ...
}
async function loadLanguage(lang: string) {
  const loader = loaders[lang]
  if (loader) hljs.registerLanguage(lang, (await loader()).default)
}
```

---

#### 7. N+1 API calls from PinboardContext on mount

**What:** In `src/context/pinboard-context.tsx`:
```tsx
// Load all pins
const apiPins = await listPins()

// Then for each pin that has no tags, fetch it individually
const enrichments = await Promise.all(
  pinsWithoutTags.map(pin => getPin(pin.id))
)
```

If a user has 50 pins without tags, this is 1 + 50 = 51 API calls on every app mount.

**Why it hurts:** Each call incurs a full round-trip to the backend via the Vercel `/api/backend/` proxy. 51 simultaneous requests saturate the backend connection pool and delay the app becoming interactive.

**Files:**
```
src/context/pinboard-context.tsx  - useEffect with Promise.all(pinsWithoutTags.map(getPin))
```

**Fix:** Fix the list endpoint to include tags in the list response (backend fix). If that's not possible, batch the tag-enrichment calls or defer them completely (load tags lazily when pinboard is opened, not on app mount).

---

#### 8. react-markdown re-parses on every streaming token

**What:** During streaming, `ContentRenderer` → `MarkdownRenderer` → `<ReactMarkdown>` is called with the growing `content` string on every 50 ms flush. ReactMarkdown re-parses the entire markdown AST from scratch on each render.

**Why it hurts:** For a long assistant response, each re-parse walks O(n) characters with remark/rehype plugins. At 50 ms intervals this runs ~20 times/second, meaning a 2-second response triggers ~40 full markdown parses.

**Files:**
```
src/lib/content-renderer.tsx  - segments re-parsed each render
src/lib/markdown-utils.tsx    - MarkdownRenderer re-creates components object
src/components/chat/ChatMessage.tsx  - no memoization of completed content
```

**Fix:**
- During streaming: render the raw text without markdown parsing. Apply markdown formatting only on the final flush (`isStreaming === false`).
- Or: use a streaming-aware markdown parser that accepts append-only diffs.
- Memoize the `<ReactMarkdown>` output for completed messages with `useMemo(() => <ReactMarkdown>...`, [content])`.

---

### 🟡 MEDIUM

---

#### 9. useSquircle - ResizeObserver on every Button and IconButton

**What:** `src/lib/useSquircle.ts` creates a `ResizeObserver` per `<Button>` and `<IconButton>` instance to compute a custom SVG clip path for the squircle shape. A page with 20 buttons = 20 active ResizeObservers.

**Why it hurts:** ResizeObserver callbacks are synchronous with the browser layout phase. Having 20+ of them per page adds to layout cost. The SVG path is re-computed every time any button is resized.

**Fix:** Cache squircle paths by `{width, height, cornerRadius}` in a module-level `Map`. Most buttons are fixed size - the observer would fire once and never again. This turns a per-instance cost into a shared lookup.

---

#### 10. useCorrosion - rAF physics loop on every interactive element

**What:** `src/lib/useCorrosion.ts` runs a spring-physics animation loop via `requestAnimationFrame` for a "ripple spreading + healing" hover effect. The loop runs at 60fps during every hover interaction.

**Why it hurts:** JS on the main thread at 60fps during user interaction competes with scroll, typing, and React state updates. On lower-end devices this causes jank.

**Fix:** Reimplement with a CSS `radial-gradient` + CSS custom property driven by a single rAF call that only updates one CSS variable. Or use `will-change: clip-path` and let the browser compositor handle it.

---

#### 11. @aws-sdk/client-secrets-manager in production dependencies

**What:** `package.json` lists `@aws-sdk/client-secrets-manager` as a production dependency. It is only used in `scripts/load-secrets.mjs` to fetch env vars at build/start time.

**Why it hurts:** AWS SDK v3 is very large (~2–5 MB installed). It is a Node.js-only package, but if bundler hints fail, it can accidentally slip into the client bundle. Even if properly tree-shaken, it inflates the install size and Vercel function size.

**Fix:** Move it to `devDependencies` since it is only needed during the `npm run load-secrets` script (which runs before build/start, not at runtime). This keeps it out of the production Lambda bundle entirely.

---

#### 12. No `dynamic()` imports for heavy modal/dialog components

**What:** Components like `PresetModelSelectorDialog`, `SystemInstructionsModal`, `EditProjectModal`, `CompareModels`, `CitationsPanel` are all statically imported into their parent pages even though they only render occasionally (on user action).

**Why it hurts:** Their code is included in the initial JS bundle even for a user who never opens these dialogs.

**Files:**
```
src/app/(app)/chat/page.tsx  - imports PresetModelSelectorDialog, CompareModels
src/app/(app)/layout.tsx     - imports PresetModelSelectorDialog
src/components/layout/AppLayout.tsx  - imports multiple heavy panels
```

**Fix:**
```tsx
const PresetModelSelectorDialog = dynamic(
  () => import('@/components/chat/PresetModelSelectorDialog'),
  { ssr: false }
)
```
Apply to: modals, sidepanels, compare view, citations panel.

---

#### 13. favicon fetching via Google's favicon service in every citation chip

**What:** `CitationChip` in `src/components/chat/ResponseBlocks.tsx` fetches:
```
https://www.google.com/s2/favicons?domain=${effectiveDomain}&sz=32
```
for every inline citation in every message. A response with 10 citations = 10 third-party requests on render.

**Why it hurts:** Each favicon request goes to Google's servers (external, not cached by Vercel CDN). They also have their own DNS lookup cost and can block rendering if Google's endpoint is slow.

**Fix:** Cache favicon URLs in a module-level Map (domain → URL). Or use a self-hosted favicon proxy. Or fallback to a simple letter avatar.

---

#### 14. Three Google Fonts loaded in root layout

**What:**
```tsx
const besley  = Besley({ subsets: ["latin"], weight: "variable" })
const geist   = Geist({ subsets: ["latin"], weight: "variable" })
const geistMono = Geist_Mono({ subsets: ["latin"], weight: "variable" })
```

All three are loaded on every page. `Besley` is only used as a display/title font - it may not be needed on non-chat pages.

**Fix:** This is actually OK because `next/font/google` optimizes these at build time and serves them as self-hosted. The `display: "swap"` is set correctly. Low priority.

---

### 🟢 LOW / BEST PRACTICES

---

#### 15. ChatInput duplicated between chat/page.tsx and ChatInterface.tsx

`ChatInput` and the mention-chip/mention-dropdown logic is copy-pasted between `src/app/(app)/chat/page.tsx` and `src/components/chat/ChatInterface.tsx`. Double the code = double the bundle for that logic.

#### 16. Missing `Cache-Control` headers for API responses

The Next.js route handlers and backend proxy do not set caching headers. Every sidebar render fetches fresh chat list, models list, etc. even when nothing changed. Adding `stale-while-revalidate` would reduce perceived latency significantly.

#### 17. No Suspense boundaries inside chat routes

The chat page uses one top-level `<Suspense fallback={null}>` (in AppLayout for LeftSidebar). There are no Suspense boundaries around the message list, models dropdown, or pinboard. Loading states are managed entirely in JS with `isLoading` flags rather than native React streaming.

---

## Estimated Bundle Contribution

| Library / Pattern | Estimated gzipped size |
|---|---|
| framer-motion v12 | ~130–180 KB |
| @hugeicons/react + core-free-icons | ~40–80 KB |
| @strange-huge/icons (unknown) | unknown |
| react-markdown + remark-gfm + remark-math | ~60–80 KB |
| rehype-katex + katex | ~90–120 KB |
| highlight.js (38 languages) | ~150–200 KB (lazy chunk) |
| AWS SDK (if accidentally bundled) | up to 500 KB |
| **Total avoidable weight** | **~470–660 KB gzipped** |

> Current first-load JS is likely 800 KB–1.2 MB gzipped. The target for a chat app should be under 250 KB.

---

## Execution Plan

### Phase 1 - Quick Wins (1–2 days, no UI changes)

| Task | File(s) | Impact |
|---|---|---|
| Move `@aws-sdk/client-secrets-manager` to devDependencies | `package.json` | Reduces lambda size |
| Move KaTeX + highlight CSS imports to `(app)/layout.tsx` | `src/app/layout.tsx` | Saves ~83 KB CSS on auth page |
| Add `React.memo` to `ChatMessage` | `src/components/chat/ChatMessage.tsx` | Halves streaming re-renders |
| Move `remarkPlugins`/`rehypePlugins`/`components` to module-level constants | `src/lib/markdown-utils.tsx` | Stops object recreation per render |
| Add `dynamic()` for modals: PresetModelSelectorDialog, SystemInstructionsModal, EditProjectModal | respective parent files | Removes modal code from initial bundle |
| Cache squircle paths in module Map | `src/lib/useSquircle.ts` | Reduces ResizeObserver thrash |

---

### Phase 2 - Medium Effort (3–5 days)

| Task | File(s) | Impact |
|---|---|---|
| Replace framer-motion in Button, Checkbox, Chip, Tooltip with CSS transitions | component files | Removes ~130 KB from initial bundle |
| Keep framer-motion only in: Pinboard, PinboardExpanded, streaming indicators | - | |
| Split highlight.js into per-language dynamic imports | `src/lib/highlight.ts` | Reduces lazy chunk by 60–70% |
| Fix N+1 pin tags: defer tag loading to pinboard open event | `src/context/pinboard-context.tsx` | Eliminates 50+ API calls on mount |
| Batch/defer highlights + pins API calls behind auth ready | context files | Reduces mount waterfall |
| Add `stale-while-revalidate` to models list + chat list fetch | `src/lib/api/chat.ts`, `src/lib/api/models.ts` | Instant sidebar on repeat visits |
| Virtualize message list with @tanstack/react-virtual | `src/components/chat/ChatInterface.tsx` | Smooth scroll on long chats |

---

### Phase 3 - Architectural (1–2 weeks)

| Task | Notes | Impact |
|---|---|---|
| Convert static display components to React Server Components | Start with: sidebar skeleton, model cards, persona grid | Removes client JS for non-interactive parts |
| Move chat history / model list fetching to server layout | Use Next.js server-side fetch + pass as props | Eliminates loading waterfalls on hard nav |
| Implement streaming-aware markdown rendering | Only format markdown on stream completion | Eliminates re-parsing during generation |
| Replace useCorrosion with CSS-only ripple | CSS `@keyframes` + custom property | Removes rAF loops |
| Publish @strange-huge/icons to private npm registry | Required for build caching on Vercel | Faster Vercel builds |
| Add `next/bundle-analyzer` to measure progress | `npm install @next/bundle-analyzer -D` | Validates all improvements |

---

## How to Measure Progress

```bash
# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer

# In next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
export default withBundleAnalyzer(nextConfig)

# Run analysis
ANALYZE=true npm run build
```

Open the generated `client.html` in `.next/analyze/` - this shows every chunk and which library contributes what size.

Also use **Vercel Speed Insights** (add `@vercel/speed-insights` to the app) to measure real user Core Web Vitals: LCP, FID, CLS. The primary target is LCP < 2.5 s on mobile.

---

## Summary

| Issue | Root Cause |
|---|---|
| **Heavy initial load** | framer-motion in 40+ components + two icon libraries |
| **Slow during streaming** | No React.memo on messages + markdown re-parse every 50 ms |
| **Slow first interactive** | All client-side, no RSC, auth + 3 API waterfalls on mount |
| **Slow on repeat visit** | No response caching, N+1 pin tag calls every mount |
| **Big CSS** | KaTeX + highlight.js CSS on every page including auth |

The single biggest bang-for-buck fix: **add React.memo to ChatMessage + move framer-motion to CSS transitions in primitive components**. That alone will make streaming feel instant and cut the initial JS bundle in half.
