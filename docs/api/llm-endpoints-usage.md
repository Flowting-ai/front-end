# LLM Model Endpoints — Frontend Usage Map

Cross-references every `/llm/models*` backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), [`projects-endpoints-usage.md`](./projects-endpoints-usage.md), [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md), [`brain-endpoints-usage.md`](./brain-endpoints-usage.md), [`slack-endpoints-usage.md`](./slack-endpoints-usage.md), [`automations-endpoints-usage.md`](./automations-endpoints-usage.md), and [`organizations-endpoints-usage.md`](./organizations-endpoints-usage.md).

All 4 wrappers live in `src/lib/api/models.ts`. **2 of 4 are live through their official wrapper; 1 is live but bypasses its wrapper entirely via an inline fetch elsewhere; 1 has zero callers anywhere.**

---

## `GET /llm/models/all` (List All Models)
- **`config.ts`**: `MODELS_ALL_ENDPOINT`
- **Wrapper**: `fetchAllModels()` (`models.ts`) — every model plus its per-user `blocked` flag; swallows errors to an empty array rather than throwing.
- **Used by**:
  - `components/AiModelsView/index.tsx` — populating the model list on mount of **Settings → AI Models**.
  - `app/(app)/agents/page.tsx`, `components/layout/PersonaChatInterface.tsx`, `components/layout/TopBar.tsx` — each independently loads the full model catalog to power a model-selection dropdown (persona configuration, persona chat header, and the main chat top bar respectively).

## `PATCH /llm/models/block` (Block Model)
- **`config.ts`**: `MODELS_BLOCK_ENDPOINT`
- **Wrapper**: `toggleBlockModel(model_id)` (`models.ts`)
- **Used by**: `AiModelsView/index.tsx`'s `handleToggle()` — an admin toggling a model on/off in the **Settings → AI Models** list (optimistic update, reconciled with the server's `blocked` value on response). On success it also busts the shared models cache so every other open model-selector picks up the change immediately.

## `POST /llm/models/test` (Test Models)
- **`config.ts`**: `MODELS_TEST_ENDPOINT`
- **Wrapper**: `testModels(body)` (`models.ts`) — **defined, but never called.** The endpoint itself is very much alive: `components/compare/CompareModels.tsx` hits it directly via `apiFetch(`${MODELS_ENDPOINT}/test`, ...)`, constructing the URL inline rather than importing the wrapper or the `MODELS_TEST_ENDPOINT` constant.
- **Used by**: `CompareModels.tsx` — the "Compare Models" feature fires one `POST` per selected model (1–3) in parallel, each returning its own SSE stream, so every column can stream its answer to the same prompt simultaneously. This is the same "dead official wrapper, live endpoint via inline bypass" pattern seen with `stopChat`/`stopPersonaChat` in [`chat-endpoints-usage.md`](./chat-endpoints-usage.md).

## `GET /llm/models` (List Models) — dead
- **`config.ts`**: `MODELS_ENDPOINT`
- **Wrapper**: `listModels()` (`models.ts`) — returns the bundled `{ all, recent, most_used }` shape, already tier-filtered server-side. Verified via grep: zero call sites anywhere in `src/` outside its own definition.
- Every current model-picker surface (`AiModelsView`, `agents/page.tsx`, `PersonaChatInterface.tsx`, `TopBar.tsx`) uses `fetchAllModels()` (`GET /llm/models/all`) instead, which returns the same underlying catalog plus a `blocked` flag — nothing on the frontend surfaces the "recent" or "most_used" groupings this endpoint would provide.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /llm/models` | **Dead** — `listModels()` defined, zero callers; `recent`/`most_used` groupings unused |
| `GET /llm/models/all` | Live — `fetchAllModels()`, 4 consumers |
| `PATCH /llm/models/block` | Live — `toggleBlockModel()` |
| `POST /llm/models/test` | Live — but via an inline fetch in `CompareModels.tsx`, not the `testModels()` wrapper |
