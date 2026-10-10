# Equal-input renderer spike

Run `cd spikes && npm ci --legacy-peer-deps --ignore-scripts && npm run compare`. Raw output is in [`spikes/results.json`](spikes/results.json); source and frozen synthetic cases are in `spikes/compare.tsx`, `fixtures.ts`, and `catalog.ts`. The run used Node 26.7.0; production is Next 16/React 19, so this is an isolated integration smoke test.

## Controlled setup

The same diagnosis, comparison and approval case feeds five paths. Each case has a claim, evidence with source labels, uncertainty, next step, and an optional proposal-only action. The harness checks that every required literal appears in rendered HTML and that non-approval cases have no button. A separate Souvenir validator checks exact source/claim/action equality. The comparator deliberately uses one `OutputCard` per framework; it does **not** test how well a model composes many smaller widgets.

| Path | Actual integration exercised | Three-case text check | Important result |
|---|---|---|---|
| Existing frontend | Imported `parseContentSegments` from `ds-dev`, then rendered parsed text in a test wrapper | 3/3 | Baseline parser preserves the answer. This is not a full `ChatMessage` browser test. |
| json-render 0.21.0 | `defineCatalog`, catalog validation, registry, React renderer/provider | 3/3 | Zod props and spec render worked. Missing `claim` was rejected. |
| OpenUI 0.3.2 | Custom Zod library, one-shot parser, streaming parser, React renderer | 3/3 | Complete programs rendered and chunked parse ended with zero errors/unresolved IDs. An unknown component was reported. OpenUI requires `root = ...` and passes a `{props, statementId}` wrapper to custom components. |
| assistant-ui generative UI 0.1.0 | Custom approved library and `renderGenerativeUI` | 3/3 | Trees rendered; an unknown component produced no HTML. This does not exercise its chat runtime or model-facing `present` tool. |
| A2UI React 0.13.0 | v0.9 `MessageProcessor`, basic catalog, React surface in JSDOM | Text present in 3/3 | **Not a clean pass:** the harness needed browser globals and logged a missing Markdown renderer warning. Validate in Chromium with a custom Souvenir catalog before ranking it. |

The malformed-input checks also show: the existing parser retained leading text after an unfinished `<metrics>` tag; json-render rejected a missing required prop; OpenUI reported an unknown component; assistant-ui rendered an unknown type as empty. The source guard accepted all three untouched records and rejected altered claims and actions in all three.

## Measurements and limits

The raw JSON includes one-process render milliseconds and HTML byte counts. **Do not use them to rank performance:** the paths use different render modes, initialization and wrappers. Installed, unpacked package directories were approximately 296 KB (`react-lang`), 1.8 MB (json-render core + React), 2.9 MB (assistant-ui generative UI), and 20 MB (A2UI React + web core). Those are **not production bundle sizes** or total dependency sizes.

The browser comparison preview (`spikes/browser-app.tsx`) mounts all five paths in Chromium with the same three cases. `npm run test:browser` passed two tests: all lanes mount across all cases and show a fallback for the preview's malformed-component toggle; at 390 px the page has no horizontal overflow and axe found no serious or critical WCAG 2.0/2.1 A/AA violations on the approval case. The browser build produced one 841 KB minified JS chunk (245.54 KB gzip) for **all five frameworks together**; this is not a per-renderer or production bundle delta. The browser test used an existing Playwright Chromium binary via `PLAYWRIGHT_CHROMIUM_EXECUTABLE` because the installed Playwright version's default binary was missing.

The following gates remain open: live model selection and invalid model outputs, interrupted UI streams for every renderer, browser console errors, full axe/keyboard coverage for every case, reduced motion, interactions that round-trip through the production backend, bundle diffs in `ds-dev`, and engineer implementation time. The browser preview's malformed toggle supplies a readable text fallback for four lanes; it is not evidence that each framework's own recovery path works. A generated claim was not allowed to add facts in this spike; production must enforce that using authorized connector snapshots.

## Next controlled comparison

Move the browser preview into an isolated `ds-dev` gallery route using May Day styles. For each frozen case, replay: complete stream, chunk split inside a component, missing required prop, unknown component, changed source fact, duplicate event, interruption, and reload. Capture visual output, console and a11y results, semantic diff, per-adapter gzipped JS delta, and integration hours. Promote a renderer only if all three cases preserve facts and action boundaries, malformed output falls back to text, and interaction works through the existing chat backend without a second conflicting state store.
