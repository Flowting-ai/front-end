# Bundle fix: test cases, results and before/after

Companion to `bundle-performance-fix-plan.md`. Everything here was run on 2026-10-10/11 against a production build (`next build --webpack` + `next start`) of the front-end, with the dev API (`devapi.getsouvenir.com`).

## 1. What changed

| Phase | Change | Files |
|---|---|---|
| 0 | Baseline and measuring tools | `scripts/perf-bundle.mjs`, `docs/perf/bundle-baseline.json`, `docs/perf/README.md`, npm scripts `perf:bundle`, `perf:bundle:check` |
| 1 | Provider logos come from a generated 15-provider subset instead of the 295-logo package (10.3 MB / 6.7 MB gz chunk removed) | `scripts/generate-llm-icons.mjs`, `src/lib/llm-icons.generated.ts`, `src/components/ThemedLlmIcon/index.tsx`, npm script `generate:llm-icons`, stale comments in `TopBar`, `AppDialogs`, `DropdownMenuItem`, `LazyPresetModelSelectorDialog` |
| 2 | `beautiful-mermaid` (ELK layout engine, 1.4 MB / 423 KB gz) loads on the first diagram | `src/components/chat/MermaidDiagram.tsx` |
| 3 | Mixpanel SDK (403 KB / 117 KB gz) loads when the browser is idle, calls queued and replayed in order; never downloaded without a token | `src/lib/analytics/mixpanel.ts` |
| 3 | Recharts (290 KB / 89 KB gz) loads when a sparkline first renders, fixed-size placeholder meanwhile | `src/components/Sparkline/index.tsx` (lazy wrapper), `src/components/Sparkline/SparklineChart.tsx` (previous implementation) |
| 4 | Guardrails | `eslint.config.mjs` (static imports of the four heavy packages are errors), `perf-budget.json` with `npm run perf:bundle:check` |

Deliberately **not** changed (judged not worth the risk or no benefit; details in `docs/perf/README.md`): KaTeX (rendered synchronously in several renderers and the markdown pipeline, about 75 KB gz), KaTeX/highlight CSS in the app layout (about 6 KB gz), Framer Motion (`domMax` is required by `layout`/`drag` users, so `motion` to `m` saves nothing, and async features can leave content invisible if the chunk fails), `optimizePackageImports` (`lucide-react` is optimised by default, Hugeicons imports are already per icon), icon-library consolidation.

## 2. Test cases and results

### 2.1 Automated checks

| Check | Before | After |
|---|---|---|
| Unit tests (vitest) | 102 of 103 files, 1,088 passed, 1 failed, 2 skipped | 105 of 106 files, **1,161 passed**, 1 failed, 2 skipped (+73 new tests) |
| The 1 failing test | `theme.test.tsx`: "theme.css is out of date" | Same test, same message. Pre-existing, unrelated to this work. |
| TypeScript (`tsc --noEmit`) | 0 errors | 0 errors |
| ESLint (`src`) | 191 errors, 219 warnings | 191 errors, 219 warnings; no file got a new error or warning |
| Production build | passes | passes (same single pre-existing `@auth0` "critical dependency" warning) |
| `generate:llm-icons --check` | n/a | up to date |
| Bundle budget check | n/a | passes; fails as it should when limits are lowered (verified) |

New tests:
- `ThemedLlmIcon.test.tsx` (5): markup for 16 ids × 2 sizes × theming on/off, plus props cases, compared **byte for byte** against a fixture captured from the original implementation before any change. Passes unchanged after the change.
- `llm-icon-ids.test.ts` (52): the two id resolvers pinned; every id they (or any literal `llm: '...'` in a component) can return exists in the generated subset; subset artwork identical to the package; size guard.
- `analytics/mixpanel.test.ts` (16): 9 behaviour tests written against the **old synchronous implementation** and passing unchanged on the new deferred one (init config, event forwarding, no-op without token or before init, identity/stamps/people/group/reset, call order, SDK errors never throw); plus 7 for deferral (not loaded synchronously, idle callback, ordered replay, SDK imported once or never, queue bound).

### 2.2 Browser regression suite (Playwright, production build, logged-in test user)

Run before the changes, after the changes, and again on the final build. The dev API currently answers plain chat requests with `RUN_ERROR 'NoneType' object is not iterable` (backend issue, outside this repo), so the assistant reply in E04 to E07 is a deterministic mocked AG-UI stream; rendering is real.

| # | Case | Before | After |
|---|---|---|---|
| E01 | Auth0 login | PASS | PASS |
| E02 | `/chat` loads, composer visible, no page errors, no 5xx | PASS | PASS |
| E03 | Provider logos render in the opened model menu (7 visible) | PASS | PASS |
| E10 | Logo swaps colour to mono in dark theme (7 colour shown in light, 7 mono shown in dark) | PASS | PASS |
| E11 | Sidebar collapse/expand toggles | PASS | PASS |
| E04 | Chat message streams a reply | PASS | PASS |
| E05 | Mermaid fence renders as an SVG diagram | PASS | PASS |
| E06 | Inline math renders with KaTeX | PASS | PASS |
| E07 | Code fence renders as a code block | PASS | PASS |
| E08 | Route smoke, no page errors or 5xx: `/chats`, `/projects`, `/agents`, `/schedules`, `/connectors`, `/settings/account`, `/settings/ai`, `/settings/billing`, `/settings/notifications` | 9 of 9 PASS | 9 of 9 PASS |
| E12 | Settings tabs switch selection | PASS | PASS |
| E09 | Analytics beacons reach `/dispatch` | N/A (the default production build has no prod token) | PASS in a separate build with a token: `screen_viewed(chat)`, `$identify`, `screen_viewed(agent_library)` after a client-side navigation, all stamped `surface=web`. `/dispatch` was intercepted, nothing was sent to Mixpanel. |

Totals: **19 of 19 pass before, 19 of 19 pass after and on the final build.** Screenshots of the model menu before and after are visually identical.

## 3. Before and after (measured)

| Metric | Before | After | Change |
|---|---|---|---|
| All JS chunks combined | 18,514 KB raw / 9,242 KB gz | 8,131 KB raw / 2,491 KB gz | −56% raw, −73% gz |
| Largest chunk | 10,302 KB raw (6,722 KB gz) | 1,415 KB (lazy ELK, 423 KB gz) | −86% |
| **`/chat` JS transferred (real browser, gzip)** | **8,464 KB**, largest file 6,726 KB | **1,077 KB**, largest file 128 KB | **−87%** |
| `/reasoning-verify` initial JS (chat components) | 13,800 KB raw / 7,782 KB gz | 1,619 KB raw / 499 KB gz | −88% raw, −94% gz |
| `/onboarding/setup` initial JS | 1,602 KB raw / 487 KB gz | 1,178 KB raw / 364 KB gz | −26% raw, −25% gz |
| `/_not-found` initial JS | 1,474 KB raw / 441 KB gz | 1,050 KB raw / 318 KB gz | −29% raw, −28% gz |

Cold-cache `/chat` under a throttled connection (10 Mbps, 40 ms RTT, CPU 4× slower; median of 3 runs, browser cache disabled):

| Metric | Before | After | Change |
|---|---|---|---|
| Total transferred | 8,744 KB | 1,479 KB | −83% |
| Page `load` event | 7,707 ms | 1,508 ms | **−80%** |
| Largest contentful paint | 8,032 ms | 1,796 ms | **−78%** |
| Composer in the page (server HTML) | 1,119 ms | 301 ms | −73% |

On localhost with no throttling the load times are indistinguishable (bandwidth is effectively free); the saving is a bytes-and-parse-time saving that shows on real connections.

## 4. Caveats and findings

- The estimates in the plan held: predicted `/chat` initial JS of about 0.9–1.2 MB gz, measured 1.08 MB.
- Throttled timings are from one machine and a simulated link; treat them as representative, not exact.
- Mixpanel events fired in the first moments of a page are queued and sent when the SDK loads (idle, 1.5 s at most). A user who leaves within that window loses those events.
- `ThemedLlmIcon` now renders nothing for an id outside the 15 generated providers (before, any of the package's 295 ids rendered). No caller can produce such an id today; the drift tests fail if one is introduced without regenerating.
- Pre-existing, not touched: the failing `theme.test.tsx`; the dev backend `RUN_ERROR` on plain chats; the `@auth0` build warning; `/settings/billing` can take more than 5 s to show content.
- Nothing is committed. The working tree has the changes listed in section 1 plus the audit documents.
