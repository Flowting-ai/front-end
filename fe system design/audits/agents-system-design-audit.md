# Agents Feature: System Design Audit

Scope: `app/(app)/agents` (list, new, templates, published, `[personaId]/edit`), `app/(app)/agent/configure` (legacy multi-tab editor: instructions, profile, knowledge, connectors, sharing), `components/AgentEditor`, `AgentsPanel`, `AgentShareModal`, `ChangeAgentModelModal`, `FixAgentModelsModal`, `PersonaCard`, `lib/api/personas.ts`, `lib/queries/personas.ts`, `lib/agent-*.ts`, `hooks/use-agent-*`.
Method: structural scan (sizes, greps, key sections), not a line-by-line review. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~43% (16.5 / 38 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.5 | 50% |
| 2. Architecture | 8 | 3.2 | 40% |
| 3. Component Patterns | 3 | 1.2 | 40% |
| 4. Data Model | 9 | 3.8 | 42% |
| 5. Interfaces and APIs | 6 | 3.9 | 65% |
| 6. Optimizations | 9 | 2.9 | 32% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, cursor pagination.

Size context: ~23,400 lines in the agent surface. Largest files: `agents/page.tsx` 2359, `configure/instructions/page.tsx` 1891, `configure/layout.tsx` 1350, `configure/context.tsx` 1164, `PersonaCard/index.tsx` 1042, `lib/api/personas.ts` 1553.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| API-layer separation (#40, #45) | All HTTP in `lib/api/personas.ts` via `apiFetch`/`apiFetchJson`; components never call `fetch` directly |
| Runtime validation (#35 Zod) | Responses parsed with `personaRepoSchema` / `personaVersionSchema` before use |
| Non-2xx guard | Delete/pause/visibility explicitly check `res.ok` because `apiFetch` does not throw |
| BFF / auth (#41, #42) | Calls go through the app's proxy with the Auth0 session |
| Server-state start (#30) | `usePersonas()` in `lib/queries/personas.ts` is a clean shared cache entry with an event-to-invalidation bridge |
| Cache dedupe | 30s TTL plus in-flight dedupe for persona list and detail |
| URL as state (#34) | Editor is route-based (`/agent/configure/...`, `/agents/[id]/edit`), tabs and repo in the URL |
| Navigation guard | `useNavGuard` dirty-state interception for unsaved edits |
| Virtualisation (#51) | `useVirtualizer` on the agents list |
| Reduced motion (#20) | `useReducedMotion` in the animated avatar and hero scenes |
| Tests | 15 test files (page tests for new/edit/templates, AgentEditor, CreateAgentInChat, sidebar) |
| Helper separation | Pure logic lives in `lib/agent-*.ts` (draft, save, sync, intent, generate), each small |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | Four files over 1,000 lines mixing data, state, effects, markup; `agents/page.tsx` has 33 `useState` + 12 `useEffect` | Split into container hook + presentational sections (filters, grid, empty states, dialogs) |
| Local state (#27) | `configure/context.tsx` 37 `useState` + 20 `useEffect`; `instructions/page.tsx` 26 + 26 | `useReducer` per concern (draft, test-chat, tabs); derive instead of syncing in effects |
| Provider pattern (#24) | One 1,164-line context carries editing state, test-chat streaming, tab visits, model fetch, nav guard | Split into draft, test-chat and tabs providers so consumers re-render selectively |
| Server state (#30, #38) | React Query only in `usePersonas`, used by 3 files (sidebar, context panel, identity); the list page, editor, templates, search/highlight contexts call `fetchPersonas`/`getPersonaRepo` directly | Move detail, versions and list consumers to queries; then retire the window event |
| Storage (#32) | Ad-hoc keys such as `persona_configure_saved_${repoId}` in localStorage and visited-tabs in sessionStorage, outside `storage-keys.ts` | Centralise keys; add versioning/cleanup for per-repo keys (they accumulate) |
| Optimistic updates (#33) | Partial; pause/delete/publish bust the cache then refetch | `onMutate` + rollback via mutations |
| Error boundaries (#19) | Layout-level only | Boundary per tab and around the test-chat pane |
| Accessibility (#20) | Few `aria-*` in the list page (12 hits across 2359 lines); drag/carousel/avatar pickers need keyboard and label review (verify) | Roles, keyboard paths, live region for test-chat stream and autosave status |
| Images (#49) | Mixed `next/image` and raw `<img>` (1 raw in PersonaCard/list) | Standardise; set sizes |
| Observability (#55) | Analytics on new/templates pages only | Track create, publish, test-run, save failures |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Two editors in parallel | New `AgentEditor`/`agents/[personaId]/edit` plus legacy `/agent/configure` (instructions, profile, knowledge, connectors, sharing) ship together | Set a deprecation date; route all entry points to one editor; delete the other (about 8-10k lines) |
| Double caching | Hand-rolled TTL cache in `personas.ts` sits under React Query, which then needs `retry: false` to preserve old behaviour and a `window` event bridge to invalidate | One cache: React Query. Drop `_personasCache`, the in-flight maps and the event |
| Custom event bus for invalidation | `PERSONAS_LIST_UPDATED_EVENT` on `window` is a hidden global dependency | Query invalidation from mutations |
| Giant API module | `lib/api/personas.ts` is 1,553 lines (repos, versions, knowledge, sharing, streaming, caching, copy-dedupe) | Split by resource: repo, versions, knowledge, sharing, stream, cache |
| Autosave and save logic spread across files | Autosave in Instructions tab, tab-switch autosave in layout, dirty tracking in context, nav guard elsewhere (verify the conflict paths) | One save state machine (idle, dirty, saving, saved, error) with a single owner |
| Raw `fetch` in API module | `urlToImageFile` and another path use plain `fetch` (lines ~505, 553), bypassing `apiFetch` retry/auth handling | Use the shared client, or document why not |
| Static preset data | `template-presets.ts` is 337 lines of content in the client bundle | Serve templates from the backend or lazy-load |
| Heavy decorative components in main chunk | `PersonaCard` plus `scenes.tsx` and `job-scenes.tsx` (about 2,500 lines) with framer-motion | Lazy-load scenes; render a static avatar first |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Code splitting (#46, #48) | No `dynamic()`/`lazy` in the agent surface: split each configure tab, share modal, FineTune and Example-conversation modals, avatar scenes |
| `useTransition` (#54) | Filtering/searching agents, tab switching |
| Debounce (#53) | Verify list search and handle availability check are debounced |
| Form state (#35) | React Hook Form + Zod for profile/instructions (many fields, 26 states in one page) |
| Core Web Vitals / perf budget (#8, #56) | Budget for list and editor routes; INP while typing instructions |
| Suspense / loading (#7) | `loading.tsx` and skeletons for list/editor |
| `error.tsx` per route | List, edit, configure |
| Data normalisation (#31) | Normalise personas by id so list, sidebar, editor and search read the same record |
| Permissions layer | One `can(user, action, persona)` helper (owner vs team copy vs viewer) instead of scattered checks (`isPersonaOwnedByViewer`, role checks) |
| Test coverage | Context (draft/save/autosave), `personas.ts` caching, sharing modal, model-health fix flows |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 43% → ~55%)
1. Add `error.tsx` / `loading.tsx` for `agents`, `agents/[id]/edit`, `agent/configure`; error boundary around test-chat. (+1.0)
2. Dynamic-import configure tabs, modals and avatar scenes; check with the bundle analyzer. (+1.5)
3. Move per-repo storage keys into `storage-keys.ts` with cleanup. (+0.5)
4. Debounce/`useTransition` on list search and filters. (+1.0)
5. Aria roles, keyboard paths, live region for save status and test-chat. (+1.0)
6. Decide and publish the legacy-editor retirement date. (+0.5)

### Phase 2: Data layer (M, → ~68%)
1. Migrate list, detail, versions and templates reads to React Query; add mutations (create, pause, delete, publish, visibility) with optimistic updates and rollback. (+2.0)
2. Delete the hand-rolled TTL cache, in-flight maps and `PERSONAS_LIST_UPDATED_EVENT`. (+1.0)
3. Split `lib/api/personas.ts` by resource and keep Zod parse on every response. (+0.5)
4. Normalised persona selectors shared by list, sidebar, search, highlight context. (+0.5)
5. Central `can()` permission helper. (+0.5)

### Phase 3: Consolidate editors and components (L, → ~88%)
1. Migrate remaining legacy tabs (knowledge, connectors, sharing) into the new editor, then delete `/agent/configure`. (+2.0)
2. Split `agents/page.tsx` and `PersonaCard` into container hooks + presentational parts, nothing above about 400 lines. (+1.5)
3. Replace the 1,164-line context with three focused providers plus a save state machine. (+1.5)
4. React Hook Form + Zod for profile/instructions/sharing forms. (+1.0)

### Phase 4: Governance (M, → 100%)
1. Analytics for create, publish, test-run, save errors; Web Vitals on list and editor. (+1.0)
2. Performance budget and bundle-size CI check for agent routes. (+1.0)
3. Tests for save machine, cache/mutation flows, permissions, sharing. (+1.0)
4. Accessibility audit (axe plus screen reader) on the editor and avatar picker. (+0.5)

Re-score after each phase and settle all "(verify)" items first.
