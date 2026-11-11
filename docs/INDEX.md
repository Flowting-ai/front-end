# Front-end documentation index

**Last updated:** 2026-11-10 · **Covers:** 393 files across four folders

Start here to find out which folder owns a topic and whether what you are reading
is still true. Every file is in exactly one of three states:

| State | Meaning |
|---|---|
| **Active** | Describes how the app works now, or work in flight. Keep it current. |
| **Reference** | Stable material that is looked up, not edited — API schemas, principles, research. |
| **Superseded** | Kept for history. Do not use it to answer "how does this work today". |

---

## The four folders

| Folder | State | Files | What lives there |
|---|---|---|---|
| [`docs/`](.) | Active + Reference | 184 | API contracts, analytics, design tokens, renderer contract, bundle budget — plus `_archive/` |
| [`docs-v1.5/`](../docs-v1.5) | Reference | 58 | UX research library, and five v1.5 plans still cited from source |
| [`docs-v2/`](../docs-v2) | **Active** | 83 | The current workstream: tickets, Library, QA, scope |
| [`fe-system-design/`](../fe-system-design) | Active + Reference | 86 | The 56 front-end principles and the per-feature audits scored against them |

---

## Active — current work

| Path | Newest | What it is |
|---|---|---|
| [`docs-v2/tickets/<YYYY-MM-DD>/`](../docs-v2/tickets) | 2026-11-10 | Backend tickets raised by the front end. **New tickets go in a dated folder here.** |
| [`docs-v2/library/`](../docs-v2/library) | 2026-10-16 | Library feature: product rules, build plan, implementation status, test results |
| [`docs-v2/qa/<YYYY-MM-DD>/`](../docs-v2/qa) | 2026-10-25 | QA checklists per run |
| [`docs-v2/scope/`](../docs-v2/scope) | 2026-10-04 | V2 scope of record |
| [`fe-system-design/audits/`](../fe-system-design/audits) | 2026-10-15 | One system-design audit per feature, with phase status. Start at its `README.md`. |
| [`docs/analytics/`](analytics) | 2026-10-15 | Mixpanel contract, front-end implementation, data governance |
| [`docs/ui/`](ui) | 2026-10-03 | Renderer contract — seven chat components link to `frontend-rendering.md` |
| [`docs/perf/`](perf) | 2026-10-11 | Bundle budget and baseline; the rules here are enforced by ESLint |
| [`docs/design-tokens-*.md`](.) | 2026-10-03 | Token audit, mapping and primitives used by the redesign |

## Reference — look up, rarely edit

| Path | Files | What it is |
|---|---|---|
| [`docs/api/`](api) | 21 | Per-endpoint usage notes; `master-api.md` is the hub |
| [`docs/openapi/`](openapi) | 18 | Generated API schemas (`openapi.yaml`, `devapi.json`, `api_yaml/`) |
| [`fe-system-design/principles/`](../fe-system-design/principles) | 56 | The principles the audits score against, in six numbered groups |
| [`docs-v1.5/ux-research/`](../docs-v1.5/ux%20research) | 53 | Product/UX research notes. Evergreen — not a record of this app's state. |

## Superseded — history only

Everything under [`docs/_archive/`](_archive), organised by when the work happened:

| Folder | Files | What it was |
|---|---|---|
| [`_archive/2026-05-v1-build/`](_archive/2026-05-v1-build) | 50 | The v1 revamp: execution map, start-here, sprint trackers, and the v1-era feature docs (testing, design-system, organizations, brain, connectors, persona, projects, auth, onboarding, features) |
| [`_archive/2026-08-v1.5/`](_archive/2026-08-v1.5) | 16 | v1.5 plans and flow diagrams, superseded by v2 |
| [`_archive/2026-10-performance-pass/`](_archive/2026-10-performance-pass) | 36 | The completed Oct-01 performance pass — reports, before/after comparisons and QA checklists. The fixes already shipped. |

### Superseded but still cited from source code

These eight are stale as documentation, but a code comment points at each one, so
they were left at their original paths rather than archived. Move one only if you
also update the comment that names it.

| File | Cited from |
|---|---|
| `docs/features/sidebar-current-state-audit.md` | `FlatSidebar`, `FlatSidebarRow`, `LeftSidebar` |
| `docs/features/personas-fetch-baseline-pre-react-query.md` | personas fetch layer |
| `docs-v1.5/connectors-v1.5-migration-plan.md` | six `components/connectors/*` files |
| `docs-v1.5/onboarding-v1.5-flow.md` | `(onboarding)/layout.tsx`, onboarding workspace page |
| `docs-v1.5/free-trial-onboarding-plan.md` | `org/change-plan/page.tsx` |
| `docs-v1.5/dropdown-scrollbar-gutter-fix.md` | dropdown styling |
| `docs-v1.5/sharing-model-v2-gap-audit.md` | sharing surfaces |
| `docs-v2/performance-report/pinboard/07-pinboard-feature-report.md` | pinboard (feature is hidden) |

---

## Conventions

- **No spaces anywhere.** Every folder and file is lowercase kebab-case, so paths need no
  quoting in a shell and no `%20` in a link.
- Dated work goes in a `YYYY-MM-DD` folder: `docs-v2/tickets/2026-11-10/`, `docs-v2/qa/2026-10-25/`.
- Archive folders are `YYYY-MM-topic`, named for when the work happened, not when it was filed.
- Numbered reference files are zero-padded (`01-…`, `02-…`) so they sort in reading order.
- Four links inside archived files point outside this repo (`../core/`, `../services/`,
  `../front-end/package.json`) and were already broken before archiving.
