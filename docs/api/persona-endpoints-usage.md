# Persona (Agent) Endpoints — Frontend Usage Map

Cross-references every "persona" backend endpoint (per `docs/openapi/devapi.json`) against how — or whether — the front-end calls it: `config.ts` constant, wrapper function/method, and every UI location that triggers it. Companion to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md) — persona-chat endpoints (`/persona/{repo_id}/chats/*`) are already covered there — and to [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md) — the 8 `/persona-shares/*` (Super Link) endpoints are covered there. Neither is repeated here.

This doc covers the remaining 29 persona-related paths (3 internal-sandbox + 26 real repo/version-management endpoints). **18 are actively used; 8 have no frontend caller at all; 6 free-function wrappers in `personas.ts` have a duplicate class-method sibling on `PersonaRepo` that's dead code** (production always goes through the free function, never the class method).

Structural note: recent code carries persona repos two ways — `src/lib/api/personas.ts` (the actively-used, free-function API surface) and `src/lib/api/persona-repo.ts` (a `PersonaRepo` class wrapping the same schemas, currently only exercised by its own test file). Where both exist for the same endpoint, the doc below calls out the live one and flags the class method as dead.

---

## A. Internal sandbox endpoints — all dead

`POST /internal/sandbox/persona/ask`, `POST /internal/sandbox/persona/find`, `POST /internal/sandbox/persona/wait`

No `config.ts` constant, no wrapper, no reference anywhere in `src/`. Backend-internal sandbox/testing infrastructure, never called from the frontend.

---

## B. Persona repo CRUD

### `GET /persona` (list) & `POST /persona` (create)
- **`config.ts`**: `PERSONAS_ENDPOINT`
- **Wrappers**: `fetchPersonaRepos()` (`persona-repo.ts`, returns a `PersonaRepoCollection`) → wrapped by `fetchPersonas()` (`personas.ts`, 30s TTL cache + in-flight dedupe, flattens to `Persona[]`). Create: `createPersonaRepo()` (`personas.ts`, multipart, direct-to-backend upload for the avatar image).
- **Used by** (`fetchPersonas()`):
  - `agents/page.tsx` — initial "My Personas" grid load, refetch on `PERSONAS_LIST_UPDATED_EVENT`, and Super Links tab activation.
  - `LeftSidebar.tsx` — sidebar's agents section list.
  - `context/search-context.tsx` / `context/highlight-context.tsx` — command palette (⌘K) and highlights indexing.
  - `brain/page.tsx` — chat's "@mention agent" chip menu and `ask_agent` tool-call resolution.
  - `ProjectAgentsPanel/index.tsx` — project sidebar's Agents panel.
  - `lib/chat-personas.ts` — shared persona-selection helper for the chat AddMenu.
  - `lib/queries/personas.ts` — the `usePersonas()` React Query hook, consumed in various components.
  - **Create**: `agents/basics/tone/page.tsx`'s `handleContinue()` — clicking **Continue** on the last step of the agent-creation wizard (Tone step), creating the repo + its initial version in one call.

### `GET /persona/{repo_id}` (get) & `DELETE /persona/{repo_id}` (remove)
- **`config.ts`**: `PERSONA_DETAIL_ENDPOINT(repoId)`
- **Wrappers**: `getPersonaRepo()`/`getPersonaRepoWithCache()` (per-repo TTL cache) and `getPersona()` (flattened `Persona`) in `personas.ts`; `deletePersona()` (`personas.ts`, manual `res.ok` check + cache-bust).
- **Used by**:
  - `agent/configure/context.tsx` — configure-shell bootstrap (guide-model seeding, panel-unlock check, active/published version refresh).
  - `agent/configure/instructions/page.tsx`, `.../profile/page.tsx`, `.../components/SharingTab.tsx` — each tab's initial load.
  - `agents/published/page.tsx` — "published successfully" screen (name/avatar).
  - `components/layout/TopBar.tsx`, `PersonaChatInterface.tsx` — persona-chat header (shared with the chat-endpoints doc's scope).
  - **Delete**: `agents/page.tsx`'s `handleDelete()` — clicking **Delete** in an agent card's overflow menu.
- **Dead sibling**: `PersonaRepo.delete()` (`persona-repo.ts`) — same endpoint, zero callers outside `persona-repo.test.ts`.

---

## C. Version-pointer / lifecycle actions

### `PATCH /persona/{repo_id}/active` (set active version)
- **`config.ts`**: `PERSONA_ACTIVE_ENDPOINT`
- **Wrapper**: `setActiveVersion()` (`personas.ts`)
- **Used by**: `instructions/page.tsx`'s `executeSave()` — right after clicking **Save version**, to make the new version the repo's working version; `agent/configure/context.tsx`'s `handleRestoreVersion()` — clicking **Restore** on a past version row in the Versions panel.
- **Dead sibling**: `PersonaRepo.setWorkingVersion()`.

### `POST /persona/{repo_id}/publish`
- **`config.ts`**: `PERSONA_PUBLISH_ENDPOINT`
- **Wrapper**: `publishPersonaVersion()` (`personas.ts`, fires `agent_published` analytics event)
- **Used by**: the **Publish**/**Republish** button on all 5 configure tabs — Instructions, Profile, Knowledge, Connectors, Sharing.
- **Dead sibling**: `PersonaRepo.publish()`.

### `PATCH /persona/{repo_id}/pause`
- **`config.ts`**: `PERSONA_PAUSE_ENDPOINT`
- **Wrapper**: `togglePause()` (`personas.ts`)
- **Used by**: `agents/page.tsx`'s `handlePauseToggle()` — clicking **Pause**/**Resume** in an agent card's overflow menu (unpublished drafts can't be paused).
- **Dead sibling**: `PersonaRepo.pause()`.

### `PATCH /persona/{repo_id}/visibility`
- **`config.ts`**: `PERSONA_VISIBILITY_ENDPOINT`
- **Wrapper**: `setPersonaVisibility()` (`personas.ts`)
- **Used by**: `SharingTab.tsx`'s `handleSaveVisibility()` — clicking **Save visibility** after picking Private/Shared.
- **Dead sibling**: `PersonaRepo.setVisibility()`.

### `POST /persona/{repo_id}/use`
- **`config.ts`**: `PERSONA_USE_ENDPOINT`
- **Wrappers**: `usePersonaRepo()` and its deduped variant `usePersonaRepoDeduped()` (`personas.ts`, skips the POST if a localStorage-tracked prior copy still resolves)
- **Used by**:
  - `agents/page.tsx`'s `handleCopyAndEdit()` — **Duplicate & edit** on a team-shared agent card, and `handleUseTeamSharedInChat()` — opening a team-shared agent in chat the first time (chat creation is owner-only, so it's cloned first).
  - `ProjectAgentsPanel/index.tsx` — opening a team-shared agent from a project's Agents panel.
  - `lib/chat-personas.ts` — the chat @-mention/AddMenu resolution flow.

### `POST /persona/{repo_id}/guide`
- **`config.ts`**: `PERSONA_GUIDE_ENDPOINT`
- **Wrapper**: `guidePersonaStream()` (`personas.ts`, SSE)
- **Used by**: `agent/configure/context.tsx`'s `handleGuideSend()` — the **AI Suggestions** panel's chat input, opened via the configure layout's floating-menu icon.

---

## D. Persona starter / enhance

### `POST /persona/starter`
- **`config.ts`**: `PERSONA_STARTER_ENDPOINT`
- **Wrapper**: `personaStarter()` (`personas.ts`)
- **Used by**: `agents/basics/tone/page.tsx` — auto-fetched on mount to populate dynamic tone-option cards, and again inside `handleContinue()` to fetch final starter content right before `createPersonaRepo()`.

### `POST /persona/enhance-prompt` — dead
- **`config.ts`**: `PERSONA_ENHANCE_ENDPOINT`
- **Wrapper**: `enhancePrompt()` (`personas.ts`) — defined, zero call sites (verified: only its own definition/export in `personas.ts`, plus its schema in `persona-schemas.ts`).
- The `EnhancePromptField` component on the Instructions tab that its name suggests it'd power is actually backed by a separate, purely client-side rewrite module (`src/enhance/index.ts`) with no network calls at all — the naming similarity is coincidental.

---

## E. Version CRUD

### `GET /persona/{repo_id}/versions` (list) & `POST .../versions` (create)
- **`config.ts`**: `PERSONA_VERSIONS_ENDPOINT`
- **Wrappers**: `listVersions()`, `createVersion()` (`personas.ts`, multipart direct-upload)
- **Used by**:
  - **List**: `agent/configure/context.tsx` — Versions panel bootstrap/open/refresh; `instructions/page.tsx` — fallback when a repo exists but no `versionId` is in the URL; `connectors/page.tsx` — resolving the latest version when `versionId` is absent.
  - **Create**: `instructions/page.tsx`'s `executeSave()` — clicking **Save version** on the Instructions tab is the only place a version is forked (the wizard's *initial* version is created via `createPersonaRepo`, not this).
- **Dead sibling**: `PersonaRepo.listVersions()`.

### `GET /persona/{repo_id}/versions/{persona_id}` (get)
- **`config.ts`**: `PERSONA_VERSION_DETAIL_ENDPOINT`
- **Wrapper**: `getVersion()` (`personas.ts`)
- **Used by**: `context.tsx` (guide-model bootstrap, restore-version flow), `instructions/page.tsx` (loading a specific/picked version), `knowledge/page.tsx` (loading documents/links, reload after upload), `ConnectorsTab.tsx` (loading `blocked_connectors`); plus internal helpers `documentToFile`/`inheritKnowledge`/`updatePersonaCopyToLatest` in `personas.ts`.

### `PATCH /persona/{repo_id}/versions/{persona_id}` (update)
- **`config.ts`**: `PERSONA_VERSION_DETAIL_ENDPOINT`
- **Wrapper**: `updateVersion()` (`personas.ts`, JSON PATCH; also triggers the Files PUT below when image/files/removeDocumentIds are present; fires `agent_edited` analytics)
- **Used by**: every configure tab's Save/Publish-flush/autosave-on-tab-switch — Instructions, Profile, Knowledge, Connectors, Sharing — plus `updatePersonaCopyToLatest()` refreshing a team-agent copy from its source's latest published content.

### `DELETE /persona/{repo_id}/versions/{persona_id}` (remove)
- **`config.ts`**: `PERSONA_VERSION_DETAIL_ENDPOINT`
- **Wrapper**: `deleteVersion()` (`personas.ts`)
- **Used by**: `instructions/page.tsx`'s `handleProceedWithOverwrite()` — clicking **Proceed** on the "oldest version will be deleted" modal at the 5-version cap; `agent/configure/layout.tsx`'s `handleDeleteVersion()` — clicking **Delete** on a version row in the Versions panel.

---

## F. Version connectors

### `PATCH .../blocked-connectors` (block) & `DELETE .../blocked-connectors/{slug}` (unblock)
- **`config.ts`**: `PERSONA_VERSION_BLOCKED_CONNECTORS_ENDPOINT`, `PERSONA_VERSION_BLOCKED_CONNECTOR_ENDPOINT`
- **Wrappers**: `setVersionBlockedConnectors()`, `unblockVersionConnector()` (`personas.ts`)
- **Used by**: `ConnectorsTab.tsx`'s `setEnabled()` — toggling a connector chip off (block) or on (unblock).
- **Orphaned component, not endpoint**: `agent/configure/components/ConnectorTogglesPanel.tsx` duplicates this same block/unblock logic but is never imported or rendered anywhere (verified: its name appears only in its own file). Doesn't make the endpoint dead — `ConnectorsTab.tsx`, which *is* live, calls the same wrappers.

### `PATCH .../connector-hints` — dead
No `config.ts` constant, no wrapper, no reference anywhere in `src/` (verified via grep for `connector-hints`/`connectorHints`). Never implemented on the frontend.

### `PUT .../connectors` (bulk set) — dead
No `config.ts` constant, no wrapper. The frontend only ever manages connectors per-version through the block/unblock pair above — this "replace the whole enabled list" endpoint has no caller.

---

## G. Version documents / knowledge

### `POST .../document` (upload) & `DELETE .../document/{document_id}` (remove)
- **`config.ts`**: `PERSONA_VERSION_DOCUMENT_ENDPOINT`, `PERSONA_VERSION_DOCUMENT_DELETE_ENDPOINT`
- **Wrappers**: `uploadDocument()`, `deleteDocument()` (`personas.ts`, direct-upload multipart)
- **Used by**: `knowledge/page.tsx`'s `uploadFiles()` — selecting file(s) via `KnowledgeTab`'s picker/drag-drop; `handleDeleteFile()` — clicking the remove/trash icon on a file row.

### `PUT .../document/{document_id}/org-knowledge` — dead
No `config.ts` constant, no wrapper, no reference anywhere in `src/` (verified via grep for `org-knowledge`/`orgKnowledge`). `KnowledgeTab.tsx` has no per-document "org knowledge" toggle.

### `PUT .../files` (update version files)
- **`config.ts`**: `PERSONA_VERSION_FILES_ENDPOINT`
- **Wrapper**: embedded inside `updateVersion()` (`personas.ts`) — fires additionally, alongside the metadata PATCH, only when an `image`/`files`/`removeDocumentIds` param is present.
- **Used by** (indirectly, via `updateVersion`'s image param): Instructions tab's Publish-flush/autosave when an avatar was set; Profile tab's Save-version/Publish-flush (avatar upload). Not used by the Knowledge tab — knowledge adds/removes go through the document endpoints above directly.

### `POST .../knowledge-url` (add version knowledge URL)
- **`config.ts`**: `PERSONA_VERSION_KNOWLEDGE_URL_ENDPOINT`
- **Wrapper**: `addKnowledgeUrl()` (`personas.ts`)
- **No direct UI button calls this.** Its only call site is internal — `inheritKnowledge()` in `personas.ts`, itself only called from `instructions/page.tsx`'s `executeSave()`. So it fires indirectly on **Save version**, only if the version being forked-from had URL-type knowledge to carry forward. `KnowledgeTab.tsx` only *displays* existing URL knowledge rows — despite the configure layout's help copy advertising "Add a URL... paste a webpage address," there is no wired control that calls this endpoint directly today.

---

## H. Version test stream

### `POST /persona/{repo_id}/versions/{persona_id}/test`
- **`config.ts`**: `PERSONA_VERSION_TEST_ENDPOINT`
- **Wrapper**: `testVersionStream()` (`personas.ts`, SSE; multipart when files attached)
- **Used by**: `agent/configure/context.tsx`'s `handleTestChatSend()` — the **Test Chat** panel's message input, opened via the configure layout's floating-menu icon.

---

## I. Persona shares (Super Links)

Moved to its own doc: [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md) — covers all 8 `/persona-shares/*` endpoints (list/create, dashboard, received, sent, preview/revoke, accept), including the one dead endpoint (`GET /persona-shares/sent`).

---

## Summary — what's actually dead

| Endpoint | Status |
|---|---|
| `POST /internal/sandbox/persona/ask` | No constant, no wrapper, no consumer |
| `POST /internal/sandbox/persona/find` | No constant, no wrapper, no consumer |
| `POST /internal/sandbox/persona/wait` | No constant, no wrapper, no consumer |
| `POST /persona/enhance-prompt` | Constant + wrapper (`enhancePrompt`) exist, zero call sites |
| `PATCH .../versions/{id}/connector-hints` | No constant, no wrapper, no consumer |
| `PUT .../versions/{id}/connectors` | No constant, no wrapper, no consumer |
| `PUT .../document/{id}/org-knowledge` | No constant, no wrapper, no consumer |
| `POST .../versions/{id}/knowledge-url` | Wired, but fires only indirectly via Save-version's `inheritKnowledge()` — no direct "Add URL" UI control exists despite help copy implying one |

(`GET /persona-shares/sent` is also dead but is documented in [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), which owns that group.)

**Dead class-method duplicates** (production always uses the `personas.ts` free function instead, never these `PersonaRepo` methods — referenced only from `persona-repo.test.ts`): `PersonaRepo.setWorkingVersion()`, `.publish()`, `.pause()`, `.setVisibility()`, `.delete()`, `.listVersions()`.

**Orphaned component** (not an endpoint issue): `agent/configure/components/ConnectorTogglesPanel.tsx` reimplements `ConnectorsTab.tsx`'s connector-toggle logic but is never imported or rendered anywhere.

All other 18 of the 26 real (non-sandbox) endpoints in this doc's scope are actively used.
