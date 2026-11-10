# Bundle Performance Fix Plan (with before and after)

Goal: remove the heavy libraries from the main (initial) JavaScript of the chat page and every authenticated page, then keep it that way with budgets.
Basis: a fresh production build (`ANALYZE=true next build --webpack`, Oct 10 2026, exit 0) plus reading the import chains.

> **Status (Oct 11 2026): implemented.** Phases 0 to 4 are done and verified; see `bundle-fix-test-report.md` for the test cases, the measured before/after and what was deliberately skipped (KaTeX, Framer Motion, `optimizePackageImports`, KaTeX CSS relocation).

## 1. Before (measured)

Measured from the prerendered HTML of pages (their `<script>` tags are the real initial JS), chunk files in `.next/static/chunks`, and gzip/brotli of those files.

| Item | Before |
|---|---|
| All JS chunks combined | 18.5 MB raw, 9.2 MB gzip |
| Largest chunk | **10.3 MB raw / 6.7 MB gzip / 6.4 MB brotli**: the LLM logo data (`@strange-huge/icons/llm`) |
| 2nd largest | 1.4 MB raw / 423 KB gzip: ELK graph-layout engine inside `beautiful-mermaid` |
| Maplibre | 1.0 MB raw / 268 KB gzip (already lazy, fine) |
| Mixpanel | 403 KB raw / 117 KB gzip, in the initial JS of **every** page |
| `/reasoning-verify` (renders `ReasoningBlock`, same component graph as chat) | **13.8 MB raw / 7.8 MB gzip** initial JS |
| Non-chat pages (`/onboarding/*`, `_not-found`) | 1.5–1.7 MB raw / 440–520 KB gzip initial JS |
| Chat page (`/chat`) | Not loadable without login, so not directly measured. Its static imports (`ChatInput`, `ReasoningBlock`, `ModelMenu` → `ModelIcon` → `@strange-huge/icons/llm`) are the same chain as `/reasoning-verify`, so expect **at least 7.8 MB gzip** |

Why the icon chunk is so large: the package holds 295 logos in three maps (color 0.57 MB, mono 0.42 MB, **avatar 9.5 MB**). The app only renders `color` and `mono` for about 15 providers, and I found no `variant="avatar"` use. About 95% of the chunk is data the app never shows.

## 2. After (target, estimated)

Targets come from subtracting the measured chunk sizes below. They are estimates until the same measurement is rerun.

| Item | Before | After (target) | Change |
|---|---|---|---|
| Largest initial chunk | 10,302 KB | about 320 KB | −97% |
| Icon data on first load | 10,302 KB raw / 6,722 KB gz | about 45 KB raw / about 12 KB gz (15 providers, color and mono) | −99.8% |
| `/reasoning-verify` (chat proxy) initial JS | 13.8 MB raw / 7.8 MB gz | about 1.4 MB raw / about 0.5 MB gz | about −93% |
| Chat page initial JS (estimate) | ≥ 15.5 MB raw / ≥ 7.8 MB gz | about 3 MB raw / about 0.9–1.2 MB gz | about −85–88% |
| Non-chat pages initial JS | 1.6 MB raw / about 490 KB gz | about 1.2 MB raw / about 370 KB gz | about −25% (Mixpanel deferred) |
| Mermaid/ELK | in chat's first load | loaded only when a diagram renders | −423 KB gz from first load |
| KaTeX | static JS + CSS on every authenticated page | loaded when math appears | about −70–80 KB gz (typical size; confirm) |

Rough load-time effect (computed from bandwidth, not measured): downloading 8 MB gzip takes about 6.4 s at 10 Mbps and 3.2 s at 20 Mbps; 1 MB takes about 0.8 s and 0.4 s. Parsing and executing 15 MB of JS on a mid-range phone adds more seconds on top, versus about 3 MB after. Repeat visits reduce the download cost (hashed, cacheable files) but not the parse and execution cost.

---

## 3. The plan

Effort assumes one developer working with Claude. Each phase is independently shippable, can be reverted on its own, and ends with a re-measurement.

### Phase 0: Baseline and guardrails (0.5 day)

1. Save the "Before" numbers as `docs/perf/bundle-baseline.json` (chunk list, per-page script lists with sizes). Use the same Node snippet each time so comparisons are like for like.
2. Keep `/reasoning-verify` as the **performance fixture**: it is prerendered, renders the chat components, and gives a repeatable measurement of chat's component graph without a login. Do not delete it. Confirm it renders `notFound()` in production if you do not want it public (see the Internal routes audit).
3. Add `npm run perf:bundle`: runs the Node measurement over `.next/server/app/*.html` and prints raw/gzip per page plus the top 10 chunks.
4. Playwright script (using the existing login recipe) that loads `/chat` and records transferred JS bytes and LCP/INP, so the true chat number can be captured before and after.

Done when: baseline file committed (with your permission) and `perf:bundle` reproduces the table in section 1.

### Phase 1: Replace the LLM icon data (1 day, the biggest win)

Files: `src/components/ThemedLlmIcon/index.tsx` (the only direct importer), `src/lib/model-icons.ts`, `src/lib/ai-models.ts` (`toLlmIconId`), new `scripts/generate-llm-icons.mjs`, new `src/lib/llm-icons.generated.ts`.

1. **Allowlist** the ids the app can render. From `toLlmIconId`: Claude, Grok, OpenAI, Gemini, Google, Meta, Mistral, DeepSeek, Groq, Cohere, Perplexity. From `getModelLlmId`: add XAI, Moonshot, Kimi, Qwen. That is 15 ids, all present in the package (checked).
2. **Generate a subset file.** `generate-llm-icons.mjs` imports `LLM_COLOR` and `LLM_MONO` from the package, writes only the allowlisted entries to `llm-icons.generated.ts` (about 45 KB raw). Commit the generated file so builds do not depend on the script. Add `npm run generate:llm-icons`.
3. **Local component.** In `ThemedLlmIcon`, replace `import { LLM_MONO, LlmIcon } from '@strange-huge/icons/llm'` with the generated maps and a small `LlmIconLocal` that copies the package's render logic (size replacement and `<img>`/data-URL output; read the package source to match it exactly). Keep the `kds-llm-color` / `kds-llm-mono` classes so the dark-mode CSS in `theme.css` still works.
4. **Unknown ids** return `null` as the package does today (callers already fall back to the Souvenir mark in `ModelIcon`).
5. **Guard against drift.**
   - Unit test: every id that `toLlmIconId` and `getModelLlmId` can return exists in the generated subset.
   - ESLint `no-restricted-imports` for `@strange-huge/icons/llm` (allow only the generator script).
6. Remove the now-misleading comments that describe deferring the 10 MB chunk (`TopBar`, `AppDialogs`, `DropdownMenuItem`, `LazyPresetModelSelectorDialog`). The lazy wrappers can stay or be simplified.

Done when: `perf:bundle` shows no chunk above about 1.5 MB, `/reasoning-verify` initial JS is below 2 MB raw, and icons look identical in light and dark mode on chat, model selector, compare and settings (visual check or Playwright screenshots).
Risk: a provider id missing from the allowlist shows a fallback logo. The drift test prevents this. Rollback: revert the commit.

### Phase 2: Mermaid, KaTeX and global CSS (1 to 1.5 days)

1. **Mermaid.** In `MermaidDiagram.tsx`, replace the static `import { renderMermaidSVG } from "beautiful-mermaid"` with `await import("beautiful-mermaid")` inside the render effect, memoising the loader. In `CodeBlock.tsx`, load `MermaidDiagram` with `next/dynamic` (no SSR) only when the fence language is `mermaid`. Show the existing skeleton while loading.
2. **KaTeX JS.** Create `lib/katex-lazy.ts` with a memoised `loadKatex()`. Update `LaTeXRenderer`, `TextBlockContent`, `line-renderer` and `CompareModels` to render the raw expression first and swap in the HTML when the module resolves. For the `react-markdown` pipeline (`markdown-utils`, `pin-markdown`), keep `remark-math`/`rehype-katex` only in a lazily imported renderer variant used when the text contains `$` or `\(` (a cheap check). Measure KaTeX's real gzip size before deciding how far to take this part.
3. **Global CSS.** Remove `import "katex/dist/katex.min.css"` and `highlight.js/styles/atom-one-light.css` from `app/(app)/layout.tsx`. Import them from the lazy modules that need them (KaTeX CSS with `katex-lazy`, highlight CSS with the code block module). `CompareModels` already imports the KaTeX CSS itself; keep that one.
4. Keep Maplibre as it is (already dynamic).

Done when: the ELK chunk (1.4 MB) is no longer in `/reasoning-verify` initial scripts, chat renders a diagram and a formula correctly (including SSR'd history), and no layout shift occurs when math upgrades from raw to rendered (reserve height or render inline fallback).
Risk: flash of unrendered LaTeX. Mitigate with a short skeleton or by rendering after hydration only. Rollback: revert the commit.

### Phase 3: Analytics, animation, charts, package imports (1 day)

1. **Mixpanel.** In `lib/analytics/mixpanel.ts`, load the SDK with a dynamic `import("mixpanel-browser")` inside `initAnalytics`, triggered from `requestIdleCallback` (or after first paint). Add a small in-memory queue (cap about 50 events) that `track`, `identify` and `register` write to until the SDK is ready, then flush in order. Keep the no-op behaviour when there is no token. Test: events fired before ready are delivered once, in order; nothing happens without a token.
2. **Framer Motion.** `MotionProvider` uses `domMax`. 129 files already use the small `m`, but 14 use the full `motion` (`Button`, `Tabs`, `Sidebar`, `FlatSidebar`, `SidebarMenuItem`, `TeamSwitcher`, `TeamSwitcherRow`, `ApprovalCard`, `CreditStatusBanner`, `InlineCreditNotice`, `SourceCitation`, `UndoToast`, members page, onboarding plans). Convert them to `m`, set `LazyMotion strict` so any future `motion` import fails loudly, and load features asynchronously: `features={() => import('framer-motion').then(r => r.domMax)}`. Keep `domMax` because `QuestionCard`, `FlatSidebar`, `Pin` and others use `layout`/`drag`.
3. **Recharts.** Lazy-load `Sparkline` and `UsageBarChart` (2 files) with `next/dynamic` and a fixed-height placeholder.
4. **`optimizePackageImports`.** In `next.config.ts` add `experimental.optimizePackageImports` for `lucide-react`, `@hugeicons/react`, `@hugeicons/core-free-icons`, `@strange-huge/icons` and `framer-motion`. Then check in the analyzer that icon packages are tree-shaken.
5. **Icon libraries.** Do not consolidate yet; first read the analyzer for what the three icon libraries actually cost (the main `@strange-huge/icons` set is imported in 182 files and its size is not measured yet). Decide after measuring.

Done when: Mixpanel (403 KB) is not in any page's initial scripts, no `motion` import remains outside an allowlist, and analytics events still reach Mixpanel (check in the Mixpanel live view).
Risk: events lost on very fast navigation before the SDK loads. The queue and a `pagehide` flush cover this. Rollback: revert the commit.

### Phase 4: Budgets so it stays fixed (0.5 to 1 day)

1. `scripts/check-bundle-budget.mjs` (run after `next build`) fails when:
   - any initial chunk exceeds a ceiling (start at about 400 KB raw, allowlist the few legitimate lazy chunks like maplibre and ELK),
   - `/reasoning-verify` initial JS gzip exceeds the target (start at 700 KB gzip),
   - a non-chat prerendered page exceeds its target (start at 420 KB gzip).
2. Add ESLint `no-restricted-imports` for heavy packages outside their wrappers: `@strange-huge/icons/llm`, `beautiful-mermaid`, `katex`, `recharts`, `mixpanel-browser`, `maplibre-gl`, plus `framer-motion`'s `motion` export.
3. Wire the check into CI next to the existing React Doctor workflow (advisory first, blocking after two clean weeks). Also run `ANALYZE=true` on a schedule and archive `.next/analyze/client.html`.
4. Add the Playwright chat measurement to CI (nightly), recording JS bytes, LCP and INP, so a regression shows up even if static analysis misses it.

### Phase 5: Verify in a real browser (0.5 day)

1. Repeat the Phase 0 Playwright measurement on `/chat`, `/agents`, `/projects`, `/settings/account` and the model selector open.
2. Lighthouse on `/chat` (mobile profile, throttled) before and after: LCP, TBT, total JS transferred.
3. Compare against section 2 and update this file with the measured "after". If chat is above 1.2 MB gzip, open the analyzer and find the next item (candidates: `@strange-huge/icons` main set, `rehype-*` pipeline, DOMPurify 103 KB gzip, the ~320 KB chunks).

---

## 4. Summary of changes and expected savings

| # | Change | Files touched | First-load saving (gzip) | Effort |
|---|---|---|---|---|
| 1 | Local subset of 15 logos instead of the 295-logo package | `ThemedLlmIcon`, generator script, generated file, tests, lint rule | about 6.7 MB | 1 day |
| 2 | Lazy Mermaid (ELK) | `MermaidDiagram`, `CodeBlock` | about 423 KB | 0.5 day |
| 3 | Lazy KaTeX JS and CSS | 5 renderer files, `(app)/layout.tsx` | about 70–80 KB (to confirm) | 0.5–1 day |
| 4 | Deferred Mixpanel with queue | `mixpanel.ts` | about 117 KB (every page) | 0.5 day |
| 5 | `motion` to `m`, async features | 14 components, `MotionProvider` | tens of KB (to confirm) | 0.5 day |
| 6 | Lazy charts, `optimizePackageImports` | 2 chart files, `next.config.ts` | about 100 KB for Recharts routes, others to confirm | 0.5 day |
| 7 | Budgets, lint rules, CI measurement | scripts, ESLint config, workflow | prevents regression | 0.5–1 day |

Total: about 4.5–6 days by one developer, roughly 2–3 days with Claude doing the edits and the developer reviewing visual parity.

## 5. What this plan does not cover

- The 1,000+ line components, re-render behaviour and data layer (see the other audits). They affect interaction speed (INP), not download size.
- Server response time (TTFB), caching headers and image optimisation.
- The remaining non-chat baseline of about 370 KB gzip. It is acceptable but worth one analyzer pass after Phase 3.

## 6. Open questions to settle before starting

1. Is `variant="avatar"` used anywhere, including by `ModelFeaturedCard` or `ModelSelectItem` through props I did not trace? (My grep found no use; confirm before dropping 9.5 MB of avatar data.)
2. Can the backend return providers outside the 15 allowlisted ids? If yes, decide the fallback (Souvenir mark, or a generic icon).
3. May `/reasoning-verify` stay as a performance fixture (guarded in production), or should the fixture live somewhere else?
4. Do you want the changes committed in separate commits per phase? I will not commit without your permission.
