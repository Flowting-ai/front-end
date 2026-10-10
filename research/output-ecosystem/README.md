# Souvenir Output ecosystem research

Research branch: `research/output-reuse-atlas`, based on `ds-dev` at `c6fbe81693528e115285f70af59dee1da58a1122` (October 9, 2026). This branch is a research handoff, not a production renderer change. No live merchant data or business action is used.

## Read in order

1. [Souvenir inventory](INVENTORY.md) — what the production frontend and May Day already have.
2. [Reuse atlas](ATLAS.md) — ranked upstream projects, exact pinned spike packages, licenses, maintenance, and adoption boundaries.
   [Package ledger](INSTALLS.md) — exact versions, install methods, compatibility and working examples.
3. [Equal-input benchmark](BENCHMARK.md) — executable three-case comparison, results, and what the spike has not proved.
4. [Output Catalog contract](CATALOG.md) — the semantic record and approved component vocabulary.
5. [Engineer gallery](GALLERY.md) — Browse, Compose, Experience, and private fetching.
6. [Implementation handoff](HANDOFF.md) — ownership, sequence, decision gate, and release criteria.

Reproduce the local smoke comparison from `spikes/` with `npm ci --legacy-peer-deps --ignore-scripts`, `npm run typecheck`, `npm run compare`, and `npm run test:browser`. Run `npm run dev` for the five-lane browser preview. The lockfile pins the compared packages. This is a renderer smoke test, not a model-quality or human-usefulness study. Playwright requires Chromium; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing binary if the matching Playwright browser is unavailable.

## Status of the decision

**No composition engine selected.** The local spike demonstrated equal-input HTML output from the existing parser, json-render, OpenUI, and assistant-ui. A2UI's browser-dependent renderer was not clean in the Node/JSDOM harness; it mounted in the browser preview. The candidate choice remains open until malformed-stream checks, full accessibility review, and production integration cost are measured. AG-UI and CopilotKit are runtime candidates, not component catalogs.
