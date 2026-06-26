# Feature Audit Log

Running log of anomalies found per feature. Each entry has severity, file references, impact, and fix status.

---

## Onboarding

Audited: 2026-06-26

### Fixed

| ID | What was wrong | Fix |
|----|---------------|-----|
| O-F1 | `normalizePlan` always read prepaid fields (`total_credits = 0`) for postpaid enterprise plans. Org on `billing_model: postpaid` showed 0 credits everywhere. | Read `included_usage_usd / provider_usage_usd / included_usage_remaining_usd` when `billing_model === 'postpaid'` in `src/lib/api/organization.ts` |
| O-F2 | `creditsTotal \|\| null` treated `0` as falsy, falling through to Stripe billing's 10,000-credit value. | Changed to `??` (nullish coalescing) in `src/app/(app)/settings/(shell)/billing/page.tsx` |
| O-F3 | `liveReady` fired prematurely — `orgPlanSettled` is `true` while `orgId` is still resolving, allowing the billing page to render before `orgPlan` loaded. | Added `orgReady` requirement to `liveReady` gate |
| O-F4 | Billing snapshot saved to sessionStorage before `orgPlan` loaded (stale Stripe data), never re-saved with correct plan. | Added `orgPlan?.totalCredits, orgPlan?.remaining, orgPlan?.used` to persistence effect deps |
| O-F5 | `POST /organizations` returned 409 during team onboarding — `createOrganization` was called at both `pricing/confirmation` (correctly guarded) and `invite` (unguarded). | Added `!user?.orgId` guard in `src/app/(onboarding)/onboarding/invite/page.tsx` |
| O-F6 | `/onboarding/tone` was unreachable — `account-type` routed individual users directly to `/import`, skipping the tone selection step entirely. `ai_tone` was always submitted as `null`. | `account-type` now routes individual users to `/tone` first, then `/tone` routes to `/import` |
| O-F7 | Team users who landed on `/onboarding/import` (via back-navigation or browser history) were redirected to `/onboarding/plans`, restarting the Stripe payment flow. | Redirect changed to `/onboarding/workspace` in `src/app/(onboarding)/onboarding/import/page.tsx` |
| O-F8 | Invite page collected emails and role but never called any API — invites were silently discarded. | `submitOnboarding` in `invite/page.tsx` now fetches org teams and calls `inviteTeamMembers` (best-effort, non-blocking) |
| O-F9 | `updateOnboarding({ role_fit: 'just_me' })` was called in `account-type` even though `import` already sends `role_fit` in the terminal save — three calls with overlapping fields. | Removed redundant `updateOnboarding` call (and the import of `updateOnboarding`) from `account-type/page.tsx` |

### Open

| ID | Severity | What is wrong | Files |
|----|----------|--------------|-------|
| O-1 | Low | `workspace/page.tsx` back button routes to `/onboarding/account-type` but the user arrived from `/onboarding/pricing/confirmation`. Pressing back sends them through `account-type → plans → Stripe` again instead of returning to the confirmation screen. | `src/app/(onboarding)/onboarding/workspace/page.tsx:110` |
| O-2 | Low | Email invites in the team flow use the first team returned by `fetchTeams`. If the backend does not auto-create a default team on org creation, invites are silently skipped with only a console error. Needs BE verification or a `createTeam` call as fallback. | `src/app/(onboarding)/onboarding/invite/page.tsx:51` |

---

## Chats

Audited: 2026-06-26

### Fixed

None yet.

### Open

| ID | Severity | What is wrong | Files |
|----|----------|--------------|-------|
| C-1 | High | `response_blocks` (structured blocks: tables, charts, steps) are visible during the live stream via SSE but permanently lost on any page reload. The `GetMessages` BE schema has no `response_blocks` field and the `get_chat_messages` query doesn't select the column. | `back-end/services/chat/schemas.py:97`, `back-end/services/chat/repository.py:134`, `front-end/src/lib/api/chat.ts:274` |
| C-2 | High | Chat sidebar timestamps (`created_at`, `updated_at`, `last_message_at`) are never returned by the BE. The `ChatsResponse` schema and `get_chats` query both omit these fields. The FE fallback is `new Date().toISOString()`, so every chat in the sidebar shows the current time on each page load. Sort order is correct (BE orders by `updated_at`) but displayed values are wrong. | `back-end/services/chat/schemas.py:59`, `back-end/services/chat/repository.py:27`, `front-end/src/lib/api/chat.ts:59` |
| C-3 | Medium | The web search toggle in the UI does nothing. The FE sends `web_search=true` to the proxy which forwards it as `web_search=true` to the BE, but the BE router doesn't declare it as a Form parameter and ignores it. Web search is unconditionally provided to all tool-capable models regardless of the toggle. | `front-end/src/app/api/chat/route.ts:85`, `back-end/services/chat/router.py:108`, `back-end/services/chat/service.py:902` |
| C-4 | Medium | `setChatVisibility('team')` without a `teamId` sends `{ visibility: 'team' }` with no `team_id`. The BE stores this with `team_id = NULL`, creating an unresolvable team-visibility chat. No FE guard prevents this. | `front-end/src/lib/api/chat.ts:486` |
| C-5 | Medium | Proxy sends `system_prompt` to BE, but the BE Form parameter is `system_instruction`. The field is silently ignored. Currently harmless (all callers pass `null`/`undefined`), but any future direct system prompt override won't reach the model. | `front-end/src/app/api/chat/route.ts:87`, `back-end/services/chat/router.py:116` |
| C-6 | Low | `ChatsResponse` schema and the `get_chats` DB query omit the `model` field. `raw.model` is always `undefined` in the FE normalizer. Any UI that shows which model was used per chat will always be blank. | `back-end/services/chat/schemas.py:59`, `front-end/src/lib/api/chat.ts:62` |
| C-7 | Low | File attachment `file_name` is never included in the message history response. The `get_chat_messages` JSON aggregation only emits `s3_key, mime_type, file_size, origin`. File URLs display correctly but filenames are missing for reloaded messages. | `back-end/services/chat/repository.py:118`, `back-end/services/chat/schemas.py:74` |
| C-8 | Low | Cursor/pagination is dead code on both sides. FE sends `?cursor=...` to `GET /chats` and `GET /chats/{id}/messages`; both BE endpoints ignore it and return plain arrays. FE has dead branches for `{results}` and `{chats}/{messages}` response shapes that are never reached. | `front-end/src/lib/api/chat.ts:70-110`, `back-end/services/chat/router.py:99,165` |

---

## Projects

Audited: 2026-06-26

### Individual vs Team behaviour

**Individual users** (no org): can create and manage private projects only. All permission checks pass correctly. Visibility controls are not shown (`canManageVisibility = false` for non-owners). No individual-specific bugs beyond the shared ones below.

**Team users** (org members): BE permission logic is solid — `can_edit_project` correctly gates editors, `can_contribute_to_project` lets viewers upload files, `require_project_editor` protects mutations. `canManageVisibility` is correctly owner-only. The team-specific anomalies are noted below.

### Fixed

None yet.

### Open

| ID | Severity | Context | What is wrong | Files |
|----|----------|---------|--------------|-------|
| P-1 | High | Both | `ProjectSummary` (BE list endpoint) returns `created_at` but the FE normalizer never maps it. `ApiProjectSummary` has no `createdAt` field; `summaryToProject` uses `s.updatedAt` for `createdAt`. Every project in the list shows its last-update time as its creation date. Correct value only appears after `loadProject()` fetches the full `ProjectResponse`. | `back-end/services/projects/schemas.py:38`, `front-end/src/lib/api/projects.ts:74-133`, `front-end/src/context/projects-context.tsx:148` |
| P-2 | Medium | Both | Tags are fully supported by the BE (`ProjectSummary.tags`, `ProjectResponse.tags`, `UpdateProjectFields.tags`) but the FE normalizers don't map them and `updateProject` saves tags to localStorage only, never calling the BE. Tags are device-local: they disappear on other devices, different browsers, and after cache clear. | `back-end/services/projects/schemas.py:37,56,66`, `front-end/src/lib/api/projects.ts:119-150`, `front-end/src/context/projects-context.tsx:288` |
| P-3 | Medium | Both | `addChat` and `removeChat` in the projects context are silently fire-and-forget. If `addChatToProject` fails, the chat appears linked in the UI but isn't persisted — it disappears on the next `loadProjectChats`. If `removeChatFromProject` fails, the chat appears removed but reappears on refresh. No error toast is shown in either case. | `front-end/src/context/projects-context.tsx:449,461` |
| P-4 | Medium | Both | `ProjectDocumentResponse` BE schema has no `size_bytes` field — file sizes are never returned by the API. The FE works around this with HEAD requests for every file on `loadProject`, which is expensive (one extra HTTP request per document). | `back-end/services/projects/schemas.py:10-22`, `front-end/src/lib/api/projects.ts:17-23`, `front-end/src/context/projects-context.tsx:355-386` |
| P-5 | Low | Both | `ProjectChatSummary` (BE) returns `created_at` but `normalizeProjectChat` only maps `updated_at`. `apiChatToProjectChat` uses `updatedAt` for both `createdAt` and `updatedAt`. Chat creation timestamps inside projects are always wrong. | `back-end/services/projects/schemas.py:77`, `front-end/src/lib/api/projects.ts:152-162`, `front-end/src/context/projects-context.tsx:199` |
| P-6 | Low | Team | `setProjectVisibility('team')` without a `teamId` sends `{ visibility: 'team' }` with no `team_id`, creating a project with `visibility='team', team_id=NULL`. No FE guard prevents this (same pattern as C-4). | `front-end/src/lib/api/projects.ts:272` |

---

## Pinboard / Pins

Audited: 2026-06-26

### Individual vs Team behaviour

**Individual users** (no org): All pin/folder operations are user-scoped via `user_id` on the BE — correct for individual use. No team-specific concepts in the pins service.

**Team users** (org members): Same pin service, same endpoints. Pins are personal even in team accounts — no shared-pinboard concept. The bugs below affect everyone equally.

### Fixed

None yet.

### Open

| ID | Severity | Context | What is wrong | Files |
|----|----------|---------|--------------|-------|
| PIN-1 | Medium | Both | `removePin` and `removePinByMessage` are optimistic-delete with no rollback and no error toast. If `deletePin` API call fails, the pin disappears from the UI but persists in the DB — it reappears on the next load or from another device. Compare: `addPin` does roll back and shows a toast on failure. | `front-end/src/context/pinboard-context.tsx:311-333` |
| PIN-2 | Low | Both | `clonePin` creates a second DB record for the same `messageId`. On any subsequent `listPins()` refresh both clones appear. When the user later unpins the message, `removePinByMessage` removes all with that `messageId` from local state but calls `deletePin` only for the first one found — the second clone is orphaned in the DB and reappears on load or other devices. | `front-end/src/context/pinboard-context.tsx:283-307`, `front-end/src/context/pinboard-context.tsx:321-332` |
| PIN-3 | Low | Both | `listPins(search?)` API client sends `?search=...` to `GET /pins` but the BE router declares no `search` query parameter — the value is silently ignored. The pinboard context never passes a search arg anyway (`listPins()` called without args), so search filtering is local-only. Dead parameter in the API client. | `front-end/src/lib/api/pins.ts:133-139`, `back-end/services/pins/router.py:37-42` |
| PIN-4 | Low | Both | `updatePinCategory` is exposed in the pinboard context but never called by any component. No BE endpoint for category updates exists (category is LLM-assigned at creation). The method is dead context surface — if a component ever calls it, the change persists until next `listPins()` reload and is then silently overwritten. | `front-end/src/context/pinboard-context.tsx:365-367` |

---

## Highlights

Audited: 2026-06-26

### Individual vs Team behaviour

Highlights are user-scoped (`user_id` filter) on the BE with no team dimension. Behaviour is identical for individual and team users.

### Fixed

None yet.

### Open

| ID | Severity | Context | What is wrong | Files |
|----|----------|---------|--------------|-------|
| HL-1 | High | Both | `getAllHighlights()` calls `GET /highlights` without a `chat_id` query parameter. The BE makes `chat_id` mandatory (`Query(...)`), so this always returns 422. `loadAll()` in the context catches and silently ignores the error. When the user switches the filter to `"all"`, the highlight panel always renders empty — shown as "Nothing highlighted yet" rather than an error. `filterMode='all'` is completely broken. | `front-end/src/lib/api/highlights.ts:43-45`, `front-end/src/context/highlight-context.tsx:98-105`, `back-end/services/highlights/router.py:21-27` |

---

## Compare Models

Audited: 2026-06-26

### Individual vs Team behaviour

Compare Models is model-tier-gated — models available depend on the user's plan. Individual free users see fewer models. Team plan users see the full catalog. The bugs below affect all users with access to the feature.

### Fixed

None yet.

### Open

| ID | Severity | Context | What is wrong | Files |
|----|----------|---------|--------------|-------|
| CM-1 | High | Both | "Save pin" from compare results is silently broken. `handleSavePin` guards on both `content` AND `messageId`. `messageId` is populated from `message_id` in SSE payloads, but the BE `StreamEvent` schema has no `message_id` field. So `testMessageIds[modelId]` is always `undefined` and the guard `if (!content \|\| !messageId) return` fires on every call — the pin button is a no-op. | `front-end/src/components/compare/CompareModels.tsx:917-924`, `back-end/services/llm/schemas.py:206-229` |
| CM-2 | Medium | Both | Credits chip never appears in compare results. FE reads `credits_used`, `creditsUsed`, `credits`, or `cost` from the `"done"` SSE event. BE `StreamEvent.done` only has `usage: Optional[dict]` — credits are nested inside that dict, not at the top level. `testCredits` is never populated; the chip is never rendered. | `front-end/src/components/compare/CompareModels.tsx:1021-1027`, `back-end/services/llm/schemas.py:206-229` |
| CM-3 | Medium | Both | Tool-related SSE events from the BE (`"tool_call"`, `"tool_error"`, `"tool_executing"`, `"tool_complete"`, `"tool_calls_streaming"`) have no handler in the compare SSE parser — they are silently dropped. If a tool-capable model invokes a tool during compare, tool output never appears in the response column. | `front-end/src/components/compare/CompareModels.tsx:992-1067`, `back-end/services/llm/schemas.py:206-215` |
| CM-4 | Low | Both | `handleTestModels` silently returns when fewer than 2 models are selected (`selectedModels.length < 2`). No error message or UI feedback is shown — the send button does nothing if the user types a prompt but has only 1 model selected. | `front-end/src/components/compare/CompareModels.tsx:927` |

---

## Agents / Persona

Audited: 2026-06-26

### Individual vs Team behaviour

**Individual users** (no org): Full create/configure/publish/chat flow. Sharing tab is locked to Private visibility — no super link or email invite UI is shown. Library page shows only the user's own agents.

**Team users** (org members): Same flow plus Sharing tab unlocked — super links and email invites available. Agents can be set to `team` visibility (visible to specific teams). Both account types share the same bugs below.

### Fixed

Fixes 1–38 in `front-end/custom-logics/persona-logic.md` cover all previously identified and resolved issues (knowledge file sizes, profile description seeding, starter API call placement, cancel modal, panel locks, tag propagation, publish semantics, version duplication, timezone display, model ID in creation, avatar assignment, filter system, chat URL, autosave toast, share link badge, etc.).

### Open

| ID | Severity | Context | What is wrong | Files |
|----|----------|---------|--------------|-------|
| AG-1 | Medium | Both | `personaStarter()` is called twice on the tone page — once on load (to fetch `sounds` for display as tone cards) and once on Continue with `{ name, description, tone: selectedTone }`. The BE `PersonaStarterRequest` only declares `name: str` and `description: str` — `tone` is silently ignored. The `system_instruction` returned by the Continue call is generated without tone input; the user's tone selection has no effect on the AI-generated instruction content. | `front-end/src/app/(app)/agents/basics/tone/page.tsx:208-274`, `front-end/src/lib/api/personas.ts` (PersonaStarterRequest), `back-end/services/persona/schemas.py` (PersonaStarterRequest) |
| AG-2 | Medium | Both | Published page super-link lookup: `all.find(s => s.persona_id === versionId && s.share_type === 'link' && s.is_active)`. The share's `persona_id` is the version ID frozen at share creation time. After the user publishes a second (or later) version, any existing super link has an old `persona_id` that no longer matches the new `versionId` — the published page cannot find the active link and shows the "Generate link" CTA again, even though the previous super link is still live and consuming credits. | `front-end/src/app/(app)/agents/published/page.tsx:247` |
| AG-3 | Low | Both | `testVersionStream()` sends `disabled_connectors`, `connector_slugs`, and `model_id` as extra form/urlencoded fields to `POST /persona/{repo_id}/versions/{persona_id}/test`. The BE endpoint only declares `input` (str) and `files` (UploadFile[]) — the extra fields are silently ignored. Test-chat connector toggles work only because clicking each toggle calls the persistent `setVersionBlockedConnectors`/`unblockVersionConnector` APIs, not because the BE uses the sent slugs at stream time. `model_id` sent here is also ignored — BE determines the model from the stored version. | `front-end/src/lib/api/personas.ts:933-963` (buildStreamBody), `back-end/services/persona/router.py` (/test endpoint) |

---

## Brain

Audited: 2026-06-26

### Individual vs Team behaviour

**Individual users** (no org): Full Brain access — create chats, run plans, schedule tasks, use connectors, reference pins and personas. All bugs below apply.

**Team users** (org members): Same access. No team-specific Brain concepts (Brain chats are personal, not shared). Bugs affect both equally.

### Fixed

None yet.

### Open

| ID | Severity | Context | What is wrong | Files |
|----|----------|---------|--------------|-------|
| BR-1 | High | Both | `getBrainBootstrap()` calls `GET /brain/bootstrap`. This endpoint does not exist in the BE brain router — only `GET /brain` (chat list) exists. Every bootstrap call returns 404. The brain home context (linked persona, recent pins, available connectors, loaded skills, project context) is never loaded. If the caller silently discards the error, `BrainBootstrap` is always null/empty. | `front-end/src/lib/api/brain.ts` (BRAIN_BOOTSTRAP, getBrainBootstrap), `back-end/services/brain/router.py` (no /bootstrap route) |
| BR-2 | Medium | Both | `BackendPlanStep.connector_slug` is a singular string field in the FE type. BE `PlanNode.connector_slugs` is a list (`connector_slugs: List[str]`). The serialized `plan_json` has the key `connector_slugs` (plural), not `connector_slug`. FE reads `step.connector_slug` → always `undefined`. Connector identity (name, logo) is never displayed for connector-type plan steps in the old plan format. | `front-end/src/lib/api/brain.ts:36-53` (BackendPlanStep), `back-end/services/brain/plan_schema.py` (PlanNode.connector_slugs) |
| BR-3 | Medium | Both | `BackendPlanNode` (new plan format via `plan_json.nodes`) has no `connector_slugs` field in the FE type. When a node has `kind === "connector"`, the FE can detect the type but cannot identify which connector — logo and name cannot be resolved for the step card. The raw `plan_json` does carry `connector_slugs` from BE `PlanNodeRun`, but the FE interface silently drops it. | `front-end/src/lib/api/brain.ts:57-69` (BackendPlanNode), `back-end/services/brain/plan_schema.py` (PlanNodeRun inherits connector_slugs) |
| BR-4 | Low | Both | `respondToPrompt(promptId, body)` constructs the POST URL from the hardcoded constant `PROMPT_RESPOND = (id) => '/chats/prompts/${id}'`. The SSE `UserPromptEvent` carries a `respond_url` field explicitly for routing, but FE ignores it. If BE routes different prompt types to different paths (e.g. approval-gate vs. tool-permission prompts), the hardcoded URL will hit the wrong handler or 404. | `front-end/src/lib/api/brain.ts:32` (PROMPT_RESPOND), `front-end/src/lib/api/brain.ts:852-864` (respondToPrompt), `front-end/src/lib/api/brain.ts:335-343` (UserPromptEvent.respond_url) |
| BR-5 | Low | Both | FE `BackendPlanStep.kind` union includes `'skill'` and `'synthesis'` as valid values. BE `PlanNode.kind` is a computed field that only ever returns `"connector"` (when `connector_slugs` is non-empty) or `"tool"`. FE rendering branches for `kind === "skill"` and `kind === "synthesis"` are never reached with current BE data. | `front-end/src/lib/api/brain.ts:36-53` (BackendPlanStep.kind), `back-end/services/brain/plan_schema.py` (PlanNode.kind computed field) |
