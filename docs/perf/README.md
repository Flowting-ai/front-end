# Bundle performance

How the app keeps its initial JavaScript small, how to measure it, and how to keep it that way.
Background and the full before/after: `fe system design/audits/bundle-performance-fix-plan.md`.

## Rules of thumb

1. **A heavy library must not be a static import in code that loads with the app shell or the chat page.**
   Load it with a dynamic `import()` the first time it is needed. ESLint (`no-restricted-imports`) blocks the
   static imports listed below; dynamic imports are always allowed.

   | Package | Size (raw / gzip) | How it is loaded |
   |---|---|---|
   | `@strange-huge/icons/llm` | 10.3 MB / 6.7 MB | Never imported. `src/lib/llm-icons.generated.ts` holds the 15 provider logos the app renders. |
   | `beautiful-mermaid` | 1.4 MB / 0.42 MB | `await import()` inside `MermaidDiagram` on first diagram. |
   | `mixpanel-browser` | 0.4 MB / 0.12 MB | `await import()` inside `src/lib/analytics/mixpanel.ts`, when the browser is idle. Never downloaded without a token. |
   | `recharts` | 0.29 MB / 0.09 MB | Only inside `components/Sparkline/SparklineChart` (lazy via `React.lazy`) and the admin analytics chart. |

2. **Adding a model-provider logo:** add its id to `LLM_ICON_IDS` in `scripts/generate-llm-icons.mjs`, run
   `npm run generate:llm-icons`, commit the regenerated file. `src/lib/llm-icon-ids.test.ts` fails when a resolver
   (`toLlmIconId`, `getModelLlmId`, or a literal `llm: '...'`) can return an id that is not generated.

3. **Not changed on purpose** (measured or judged not worth the risk): KaTeX (rendered synchronously in several
   renderers and in the markdown pipeline; about 75 KB gzip), Framer Motion (`domMax` is already required by `layout`
   and `drag` users, so `motion` vs `m` saves nothing), `optimizePackageImports` (`lucide-react` is optimised by
   default, the Hugeicons imports are already per icon).

## Measuring

```bash
npx next build --webpack          # needs the env files; see package.json "build"
npm run perf:bundle               # report from .next (no build, no network)
npm run perf:bundle -- --json docs/perf/bundle-latest.json
npm run perf:bundle:check         # fails when perf-budget.json is exceeded
```

`perf:bundle` lists, for every **prerendered** page, the scripts its HTML loads on first paint (the real initial
JavaScript), plus the largest chunks. Dynamic pages (chat, agents, ...) have no static HTML, so measure those in a
browser (Playwright, count the JavaScript responses on `/chat`).
`/reasoning-verify` is prerendered and renders the same chat components, so it stands in for the chat page's component
graph in the budget.

`bundle-baseline.json` is the measurement taken before the fixes (build `aIyZWu-6DP5ju67GcMFJQ`).

## Budget

`perf-budget.json` (project root):

- `maxInitialChunkKB`: no chunk loaded on first paint by any prerendered page may exceed this raw size.
- `allowedLargeChunkNames`: chunk file names exempt from that limit (none today).
- `pages`: per-page limits on initial JavaScript, raw and gzip.

Raise a limit only with a reason in the pull request.
