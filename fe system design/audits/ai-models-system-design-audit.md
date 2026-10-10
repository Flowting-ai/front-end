# AI Models View: System Design Audit

Scope: `components/AiModelsView` (661 lines, route `settings/(shell)/ai`), `ModelFeaturedCard` (343), `ModelSelectItem` (482), `ModelIcon`, `PresetModelSelector` (276), `chat/ModelSelector` (406), `chat/ModelMenu` (229), `chat/PresetModelSelectorDialog` (379), `context/model-selector-context.tsx` (267), `hooks/use-model-selection.ts` (177), `lib/api/models.ts` (87), `lib/ai-models.ts` (288), `lib/model-fallback.ts`, `lib/model-error.ts`, `lib/model-icons.ts`, `lib/agent-model-health.ts`. About 4,300 lines. The settings page is the catalogue and enable/disable screen; the selector components feed model choice into Chat, Compare and Agents.
Method: API modules, normaliser, selection hook and context, and the AiModelsView toggle and filter logic read; the selector components checked by grep. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~46% (15.8 / 34 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 2 | 1.3 | 65% |
| 2. Architecture | 8 | 3.9 | 49% |
| 3. Component Patterns | 3 | 1.5 | 50% |
| 4. Data Model | 8 | 3.3 | 41% |
| 5. Interfaces and APIs | 6 | 3.5 | 58% |
| 6. Optimizations | 7 | 2.3 | 33% |

Not applicable: SSR, SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, cursor pagination, virtualisation, forms, debounce.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Optimistic updates (#33) | Enable/disable toggle in `AiModelsView` updates immediately with rollback on failure, with a per-row `togglingId` guard against double clicks |
| Hydration safety | `ModelSelectorContext` reads localStorage in a mount-only effect (documented), avoiding server/client mismatch; `useModelSelection` shows a cached model snapshot for instant icon/name before the fetch completes |
| Stable keys | `stableKey()` prefers the semantic `modelId` over the numeric id; exported so Agents use the same key format |
| Graceful fallback logic | `model-fallback.ts` (`resolveStoredSelection`) and `model-error.ts` (`friendlyModelError`) handle a stored model that disappeared or errored; `pickDefaultModel` |
| Domain-aware icon mapping | `toLlmIconId` matches provider or model names by substring, survives version bumps, and returns `null` rather than stamping an unknown model with another provider's logo |
| Lazy loading (#46, #48) | `LazyPresetModelSelectorDialog` loads the preset dialog on demand; the Compare modal that carries the LLM icon set is dynamic |
| Tests | `model-fallback`, `model-error`, `chat-model-selection` have tests |
| Provider pattern (#24) | Selector open/anchor/effort/algorithm state is in a context rather than prop-drilled through chat |
| Pure helpers | Filtering and grouping done with `useMemo` over a single list; icons and names in small libs |
| Settings persistence | Per-model reasoning effort and algorithm choice persisted with centralised keys (verify keys are in `storage-keys.ts`) |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | `AiModelsView` 661 lines holds list, provider groups, toggle, search, tabs and presentational pieces; `ModelSelectItem` 482 | Split provider group, model row, header and filters; container hook `useModelCatalog()` |
| Duplicate selector variants | Five selector surfaces: `ModelSelector`, `PresetModelSelector`, `PresetModelSelectorDialog`, `ModelMenu`, `ModelSelectItem` (also `ModelFeaturedCard`) with overlapping state | Converge on one selector primitive with variants; share the list/search/keyboard logic |
| Server state (#30, #38) | Catalogue loaded in `useEffect` + `useState` in the settings view, a separate `useModelSelection` hook (module cache + `MODELS_CACHE_BUSTED_EVENT`), and a third path via `listModels()` | One React Query: `["models"]` with tier filtering; toggle as a mutation that updates that cache |
| Selection state | Selected model lives in `useModelSelection` (hook), `ModelSelectorContext` (context) and `active-chat-agent-store`; sources of truth overlap | One selection store; derive per-surface overrides (chat vs agent) from it |
| Accessibility (#20) | Few `aria-*` in the settings view (decorative `aria-hidden` dots only visible in grep); toggles and provider groups need roles/labels, and the selector needs listbox semantics and keyboard support (verify) | Switch role with label per model, `aria-expanded` on provider groups, listbox pattern in selectors |
| Observability (#55) | No analytics for model enabled/disabled, model picked, fallback triggered | Typed events with model id enum |
| Error boundaries (#19) | Layout-level only | Boundary around catalogue and selector popovers |
| Images (#49) | Icons come from `@strange-huge/icons/llm` (~10MB / 6.5MB gzip per the repo's own note) | Per-provider imports or sprite; verify it is not in the main chunk (analyzer) |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Errors swallowed into empty list | `fetchAllModels()` returns `[]` on any failure (network, 401, non-OK, non-array); the settings screen cannot tell "no models" from "failed to load" | Throw `ApiError`; show an error state with retry |
| No runtime validation | `GetModels` / `GetModelsWithStatus` are interfaces, payload is cast (`as GetModelsWithStatus[]`) with only an `Array.isArray` guard | Zod schema for the model wire type; `safeParse` per item so one bad model does not drop the list |
| Two normalisers, legacy field soup | `lib/ai-models.ts` `BackendModel` accepts both new (`model_name`) and legacy camelCase (`modelName`, `companyName`, `providerName`, `plan`, `callType`, `huggingfaceProvider`, `sdkLibrary`...) names with fallbacks, while `lib/api/models.ts` uses the new shape only | Drop the legacy branch once the backend is on the snake_case contract (verify which endpoints still emit it); one schema and one mapper |
| `"Unknown"` and `"Unknown Model"` defaults | Missing fields are shown as real strings | Reject or flag invalid models instead of rendering placeholders |
| Event-bus cache invalidation | `MODELS_CACHE_BUSTED_EVENT` on `window` (same pattern as `PERSONAS_LIST_UPDATED_EVENT`) | Query invalidation |
| Icon matching by substring | `s.includes("meta")` or `"google"` can match unrelated names (e.g. a model named "metadata..."); order of checks matters (`gemini` before `google`) | Match on `model_provider` ids from the backend, not display strings; add a table with tests |
| Selection and models cached as JSON in localStorage | `souvenir_selected_model_cache` stores a model snapshot that can go stale (renamed, blocked) | Store only the id; resolve from the catalogue; clear on logout |
| `testModels` returns `unknown` | The compare endpoint result is untyped | Zod schema shared with the compare feature |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | AiModelsView toggle rollback, filtering by tab/search, normaliser (both field shapes), `toLlmIconId` table, selection persistence and fallback when a model is blocked |
| `useTransition` / `useDeferredValue` (#54) | Search over the catalogue |
| Code splitting (#46) | Lazy-load the settings view's heavy parts; confirm icon set is split per provider |
| `error.tsx` / `loading.tsx` | Route states for `settings/ai` |
| Suspense / skeleton (#7) | Skeleton for provider groups (verify what exists) |
| URL as state (#34) | Tab and search in query params |
| Cross-tab sync | `storage` event so a model change in one tab updates others |
| Permissions | Block/unblock is per user; show org-level restrictions (org-enforced blocks) distinctly (verify backend field) |
| Pricing/capability display | Use `model_input_cost`, `model_output_cost`, `context_window` consistently in one `formatModelFacts` helper (cost fields exist in the API type but not in the normaliser) |
| Core Web Vitals / budget (#8, #56) | Budget for settings route and for the icon chunk |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 46% → ~58%)
1. Stop swallowing errors: `fetchAllModels` throws; settings view shows error and retry. (+0.7)
2. Zod model schema with per-item `safeParse`; used by both API paths. (+1.0)
3. Roles and labels: switch per model, listbox semantics in selectors, `aria-expanded` on provider groups. (+0.8)
4. Typed analytics (toggle, select, fallback). (+0.4)
5. Tests for toggle rollback, normaliser and icon table. (+0.8)
6. Route `error.tsx`/`loading.tsx` and boundaries around selector popovers. (+0.5)

### Phase 2: One data and selection layer (M, → ~75%)
1. `["models"]` React Query; toggle as optimistic mutation; delete `MODELS_CACHE_BUSTED_EVENT` and the module cache. (+2.0)
2. Single selection store (id only in localStorage, resolve against catalogue; cleared on logout); cross-tab `storage` sync. (+1.2)
3. Remove the legacy camelCase fallback path once backend contract is confirmed; one mapper. (+0.8)
4. Provider-id-based icon mapping with tests. (+0.4)
5. `formatModelFacts` for context window and pricing. (+0.3)

### Phase 3: Components (M, → ~90%)
1. One selector primitive with variants replacing `ModelSelector`, `PresetModelSelector`, `PresetModelSelectorDialog`, `ModelMenu`. (+1.5)
2. Split `AiModelsView` into provider group, model row, filters and header with a `useModelCatalog` hook, none above ~300 lines. (+1.0)
3. `useDeferredValue` for search; tab/search in URL params. (+0.6)
4. Per-provider icon imports and verified chunk split. (+0.7)

### Phase 4: Governance (S, → 100%)
1. Performance budget on the settings route and icon chunk; Web Vitals. (+0.6)
2. Accessibility audit (axe plus screen reader) of selectors. (+0.4)
3. Org-level blocked models shown distinctly (needs backend field). (+0.3)
4. Skeleton states verified; error logging structured. (+0.3)

Re-score after each phase and settle all "(verify)" items first.
