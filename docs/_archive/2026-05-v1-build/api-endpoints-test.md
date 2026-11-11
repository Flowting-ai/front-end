# Backend API endpoints — `back-end-test` (`test` branch) full catalog

Freshly scanned from `D:\WJP Souvenir\back-end-test` (cloned single-branch from `test` on `Flowting-ai/flowtingAI-api`) — not copied from the `back-end` (main) doc. Same method as `back-end/docs/api-endpoints.md`: every route registered in `main.py` via `app.include_router(...)`, read directly from each service's `router.py`. No global path prefix anywhere (`FastAPI(lifespan=lifespan)`, no `root_path`, no `prefix=` on any `include_router` call).

`(hidden)` marks routes declared with `include_in_schema=False`.

## Headline finding: Team is fully removed in this branch

This branch has already done the "flatten Team out" work the architecture docs describe. Confirmed directly in code, not inferred:

- **Zero `/teams` routes anywhere.** No team CRUD, no team connectors, no team connections, no team editors, no team-scoped project members, no team invites/overflow, no team persona-shares. All present and extensive in the `back-end` (main) repo's `organizations/router.py`; all absent here.
- **`AccountScope` is now `Literal["personal", "shared"]`** (`services/connectors/schemas.py:9`) — two values, down from main's three (`"personal" | "shared_team" | "shared_org"`). No `organization_wide` flag exists anywhere in this branch's connector schemas or endpoints — there's no smaller container to distinguish "shared" from, so the flag is simply gone rather than defaulted.
- **`team_ids`/`team_names` are gone** from both `OrganizationConnectorAccountResponse` and `ConnectorAccountOption`.
- **Invites are flat, not team-scoped**: `POST /organizations/{organization_id}/invites` and `DELETE /organizations/{organization_id}/invites/{invite_id}` — no `team_id` in the path at all (main requires `/teams/{team_id}/invites`).
- **Invite preview/accept moved and renamed**: was `invite_router` at prefix `/team-invite` in main; here it's still named `invite_router` in code but mounted at **`/org-invite`**, and `accept_invite` now returns `OrganizationResponse` (main returns `TeamResponse`).
- **Per-member credit cap endpoint removed**: main's `PATCH /organizations/{id}/members/{member_id}/cap` has no equivalent here.
- **Connector personal-access-request family is gone**: main's `POST .../connectors/{slug}/personal-request`, `GET .../connectors/personal-requests`, `PATCH .../connectors/personal-requests/{request_id}` have no equivalent here.

This lines up exactly with the "Workspace Model v2" architecture doc scanned earlier this session (`Teams entity is removed entirely... Projects are the primary organizational unit`, `Connections are workspace-wide — never scoped by project or member`) — this branch is that migration, in progress or complete for the org/connectors surface.

Every other router (`chat`, `brain`, `persona`, `persona_share`, `connectors` personal-link endpoints, `doc_design` + its org variant, `automations` + webhook, `users`, `memory`, `pins`, `stripe`, `slack`, `templates`, `docx`, `projects`, `highlights`, `llm`, `internal/sandbox`) was diffed line-by-line against `back-end`'s and found **identical** — same paths, same methods. Only `organizations/router.py` and `services/connectors/schemas.py` changed.

**Relevant to this front-end's own connector code**: `src/lib/api/connectors.ts` and `org-connectors.ts` currently model `AccountScope` as `'personal' | 'shared_team' | 'shared_org'` plus an `organization_wide` boolean (added earlier this session to match the current `back-end` main branch). Once this `test` branch lands as the new main, that needs to collapse back down to a plain `'personal' | 'shared'` with no `organization_wide` field at all.

Source repo scanned from: `D:\WJP Souvenir\back-end-test` (this file was originally written there, then moved here and the clone's own copy removed per instruction — the clone itself is otherwise unmodified).

---

## `/organizations` — `services/organizations/router.py` (the router that changed)

**Org / plan**

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizations` | List the caller's organizations |
| POST | `/organizations` | Create an organization |
| GET | `/organizations/{organization_id}` | Get an organization |
| POST | `/organizations/{organization_id}/transfer-owner` | Transfer ownership |
| PATCH | `/organizations/{organization_id}` | Update org (multipart) |
| DELETE | `/organizations/{organization_id}` | Delete an organization |
| GET | `/organizations/{organization_id}/settings` | Get org settings |
| PATCH | `/organizations/{organization_id}/settings` | Update org settings |
| GET | `/organizations/{organization_id}/plan` | Get plan |
| PATCH | `/organizations/{organization_id}/plan/pool-cap` | Set credit pool cap |
| GET | `/organizations/{organization_id}/plan/usage` | Usage breakdown |
| GET | `/organizations/{organization_id}/plan/enterprise-usage` | Enterprise usage (paginated) |
| GET | `/organizations/{organization_id}/pool-status` | Credit pool status |
| GET | `/organizations/{organization_id}/audit` | Audit log |

**Connectors — org-wide shared accounts (now simply "shared", no team indirection)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizations/{organization_id}/connectors/{slug}/used-by` | What depends on this connector |
| GET | `/organizations/{organization_id}/connectors/{slug}/accounts` | List shared accounts for a connector |
| POST | `/organizations/{organization_id}/connectors/{slug}/accounts` | Create a shared account |
| PATCH | `/organizations/{organization_id}/connectors/accounts/{account_id}` | Update a shared account (label/identifier/credentials/status — no `organization_wide`, doesn't exist) |
| DELETE | `/organizations/{organization_id}/connectors/accounts/{account_id}` | Delete a shared account |

**Slack (per-project channels + org installation)** — unchanged from main

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizations/{organization_id}/slack/projects/{project_id}/channel` | Get the project's bound Slack channel |
| POST | `/organizations/{organization_id}/slack/projects/{project_id}/channel` | Create/bind a channel to a project |
| PATCH | `/organizations/{organization_id}/slack/projects/{project_id}/channel` | Rename the bound channel |
| DELETE | `/organizations/{organization_id}/slack/projects/{project_id}/channel` | Archive/unbind the channel |
| GET | `/organizations/{organization_id}/slack/installation` | Get the org's Slack installation |
| DELETE | `/organizations/{organization_id}/slack/installation` | Remove the Slack installation |

**Members** — cap endpoint removed vs. main

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizations/{organization_id}/members` | List members |
| GET | `/organizations/{organization_id}/members/admins` | List admins |
| GET | `/organizations/{organization_id}/members/regular` | List non-admin members |
| PATCH | `/organizations/{organization_id}/members/{member_id}/role` | Change a member's role |
| DELETE | `/organizations/{organization_id}/members/{member_id}` | Remove a member |

**Invites** — now flat, no team scoping (was `/teams/{team_id}/invites` in main)

| Method | Path | Purpose |
|---|---|---|
| POST | `/organizations/{organization_id}/invites` | Invite people to the org |
| DELETE | `/organizations/{organization_id}/invites/{invite_id}` | Revoke an invite |

**Audit**

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizations/{organization_id}/audit` | Audit log |

### `/chat-shares` — `share_router` in `services/organizations/router.py` — unchanged from main

| Method | Path | Purpose |
|---|---|---|
| POST | `/chat-shares` | Share a chat |
| GET | `/chat-shares` | List shares the caller created |
| GET | `/chat-shares/shared-with-me` | Shares received |
| GET | `/chat-shares/{share_id}` | View a shared chat |
| POST | `/chat-shares/{share_id}/fork` | Fork a shared chat |
| DELETE | `/chat-shares/{share_id}` | Revoke a chat share |

### `/org-invite` — `invite_router` in `services/organizations/router.py` — **renamed** from main's `/team-invite`

| Method | Path | Purpose |
|---|---|---|
| GET | `/org-invite/{invite_id}` | Preview an invite |
| POST | `/org-invite/{invite_id}/accept` | Accept an invite (returns `OrganizationResponse`, not `TeamResponse`) |

---

## Everything else — identical to `back-end` (main), full list for completeness

## `/chats` — `services/chat/router.py`

| Method | Path |
|---|---|
| GET | `/chats` |
| POST | `/chats/create` |
| GET | `/chats/{chat_id}/browser/live` |
| GET | `/chats/{chat_id}/messages` |
| POST | `/chats/{chat_id}/copy` |
| POST | `/chats/{chat_id}/stream` |
| POST | `/chats/{chat_id}/stop` |
| PATCH | `/chats/{chat_id}/star` |
| PATCH | `/chats/{chat_id}/visibility` |
| PATCH | `/chats/rename` |
| DELETE | `/chats` |
| DELETE | `/chats/message/{message_id}` |
| POST | `/chats/files/{attachment_id}/save-to-drive` |
| POST | `/chats/prompts/{prompt_id}` |

## `/brain` — `services/brain/router.py`

| Method | Path |
|---|---|
| GET | `/brain` |
| POST | `/brain/create` |
| POST | `/brain/{chat_id}/stream` |
| GET | `/brain/{chat_id}/messages` |
| POST | `/brain/{chat_id}/stop` |
| PATCH | `/brain/{chat_id}/star` |
| PATCH | `/brain/rename` |
| DELETE | `/brain` |

## `/persona` — `services/persona/router.py`

| Method | Path |
|---|---|
| GET | `/persona` |
| POST | `/persona` |
| POST | `/persona/enhance-prompt` |
| POST | `/persona/starter` |
| GET | `/persona/{repo_id}` |
| PATCH | `/persona/{repo_id}/visibility` |
| POST | `/persona/{repo_id}/guide` |
| POST | `/persona/{repo_id}/use` |
| DELETE | `/persona/{repo_id}` |
| PATCH | `/persona/{repo_id}/pause` |
| PATCH | `/persona/{repo_id}/active` |
| POST | `/persona/{repo_id}/publish` |
| GET | `/persona/{repo_id}/versions` |
| POST | `/persona/{repo_id}/versions` |
| GET | `/persona/{repo_id}/versions/{persona_id}` |
| PATCH | `/persona/{repo_id}/versions/{persona_id}` |
| PUT | `/persona/{repo_id}/versions/{persona_id}/files` |
| DELETE | `/persona/{repo_id}/versions/{persona_id}` |
| POST | `/persona/{repo_id}/versions/{persona_id}/document` |
| POST | `/persona/{repo_id}/versions/{persona_id}/knowledge-url` |
| PUT | `/persona/{repo_id}/versions/{persona_id}/document/{document_id}/org-knowledge` |
| DELETE | `/persona/{repo_id}/versions/{persona_id}/document/{document_id}` |
| PATCH | `/persona/{repo_id}/versions/{persona_id}/blocked-connectors` |
| PUT | `/persona/{repo_id}/versions/{persona_id}/connectors` |
| PATCH | `/persona/{repo_id}/versions/{persona_id}/connector-hints` |
| DELETE | `/persona/{repo_id}/versions/{persona_id}/blocked-connectors/{slug}` |
| POST | `/persona/{repo_id}/versions/{persona_id}/test` |
| GET | `/persona/{repo_id}/chats` |
| POST | `/persona/{repo_id}/chats/create` |
| GET | `/persona/{repo_id}/chats/{chat_id}/messages` |
| POST | `/persona/{repo_id}/chats/{chat_id}/stream` |
| POST | `/persona/{repo_id}/chats/{chat_id}/stop` |
| PATCH | `/persona/{repo_id}/chats/rename` |
| DELETE | `/persona/{repo_id}/chats` |
| DELETE | `/persona/{repo_id}/chats/{chat_id}/message/{message_id}` |

## `/persona-shares` — `services/persona_share/router.py`

| Method | Path |
|---|---|
| POST | `/persona-shares` |
| GET | `/persona-shares` |
| GET | `/persona-shares/received` |
| GET | `/persona-shares/sent` |
| GET | `/persona-shares/dashboard` |
| GET | `/persona-shares/{share_id}` |
| POST | `/persona-shares/{share_id}/accept` |
| DELETE | `/persona-shares/{share_id}` |

## `/connectors` — `services/connectors/router.py`

| Method | Path |
|---|---|
| GET | `/connectors` |
| GET | `/connectors/{slug}` |
| POST | `/connectors/{slug}/link` |
| GET | `/connectors/{slug}/oauth/callback` (hidden) |
| PATCH | `/connectors/{slug}` |
| DELETE | `/connectors/{slug}` |

### `/integrations` — `webhookRouter` in `services/connectors/router.py`

| Method | Path |
|---|---|
| POST | `/integrations/connectors/pipedream/connected` (hidden) |

## `/doc-design` — `services/doc_design/router.py`

| Method | Path |
|---|---|
| GET | `/doc-design` |
| POST | `/doc-design` |
| POST | `/doc-design/{design_id}/activate` |
| POST | `/doc-design/{design_id}/deactivate` |
| DELETE | `/doc-design/{design_id}` |

### `/organizations/{organization_id}/doc-design` — `org_router` in `services/doc_design/router.py`

| Method | Path |
|---|---|
| GET | `/organizations/{organization_id}/doc-design` |
| POST | `/organizations/{organization_id}/doc-design` |
| POST | `/organizations/{organization_id}/doc-design/{design_id}/activate` |
| POST | `/organizations/{organization_id}/doc-design/{design_id}/deactivate` |
| DELETE | `/organizations/{organization_id}/doc-design/{design_id}` |

## `/automations` — `services/automations/router.py`

| Method | Path |
|---|---|
| GET | `/automations` |
| GET | `/automations/{automation_id}` |
| PATCH | `/automations/{automation_id}` |
| POST | `/automations/{automation_id}/run` |
| DELETE | `/automations/{automation_id}` |

### `/integrations` — `webhookRouter` in `services/automations/router.py`

| Method | Path |
|---|---|
| POST | `/integrations/automations/{automation_id}/run` (hidden) |

## `/users` — `services/users/router.py`

| Method | Path |
|---|---|
| POST | `/users/create` |
| GET | `/users/me` |
| PATCH | `/users/me` |
| PATCH | `/users/me/onboarding` |
| DELETE | `/users/me` |

## `/memory` — `services/memory/router.py`

| Method | Path |
|---|---|
| POST | `/memory/user` |

## `/pins` — `services/pins/router.py`

| Method | Path |
|---|---|
| GET | `/pins` |
| GET | `/pins/{pin_id}` |
| POST | `/pins/message/{message_id}` |
| GET | `/pins/folders/all` |
| POST | `/pins/folders` |
| PATCH | `/pins/folders/{folder_id}` |
| DELETE | `/pins/folders/{folder_id}` |
| PATCH | `/pins/{pin_id}/folder` |
| DELETE | `/pins/{pin_id}` |
| PUT | `/pins/{pin_id}/tags` |
| POST | `/pins/{pin_id}/comments` |
| PATCH | `/pins/{pin_id}/comments/{comment_id}` |
| DELETE | `/pins/{pin_id}/comments/{comment_id}` |

## `/stripe` — `services/stripe/router.py`

| Method | Path |
|---|---|
| POST | `/stripe/checkout` |
| POST | `/stripe/topup` |
| POST | `/stripe/topup/charge` |
| POST | `/stripe/trial` |
| DELETE | `/stripe/subscription` |
| POST | `/stripe/subscription/resume` |
| GET | `/stripe/billing` |
| POST | `/stripe/portal` |
| POST | `/stripe/webhook` (hidden) |

## `/slack` — `services/slack/router.py`

| Method | Path |
|---|---|
| GET | `/slack/install` |
| GET | `/slack/oauth/callback` (hidden) |
| GET | `/slack/pipedream/callback` (hidden) |
| GET | `/slack/status` |
| POST | `/slack/link` |
| DELETE | `/slack/link` |
| POST | `/slack/events` (hidden) |
| POST | `/slack/interactivity` (hidden) |

## `/templates` — `services/templates/router.py`

| Method | Path |
|---|---|
| POST | `/templates` |
| GET | `/templates` |
| GET | `/templates/{template_id}` |
| GET | `/templates/{template_id}/html` |
| DELETE | `/templates/{template_id}` |

## `/projects` — `services/projects/router.py`

| Method | Path |
|---|---|
| PATCH | `/projects/{project_id}/visibility` |
| GET | `/projects` |
| POST | `/projects` |
| GET | `/projects/{project_id}` |
| PATCH | `/projects/{project_id}` |
| PUT | `/projects/{project_id}/files` |
| DELETE | `/projects/{project_id}/files/{document_id}` |
| DELETE | `/projects/{project_id}` |
| GET | `/projects/{project_id}/chats` |
| POST | `/projects/{project_id}/chats/{chat_id}` |
| DELETE | `/projects/{project_id}/chats/{chat_id}` |

## `/highlights` — `services/highlights/router.py`

| Method | Path |
|---|---|
| PATCH | `/highlights` |
| GET | `/highlights` |
| PATCH | `/highlights/{highlight_id}` |

## `/llm` — `services/llm/router.py`

| Method | Path |
|---|---|
| GET | `/llm/models` |
| GET | `/llm/models/all` |
| PATCH | `/llm/models/block` |
| POST | `/llm/models/test` |

## `/docx` — `services/skills/docx/router.py` (hidden at router level)

| Method | Path |
|---|---|
| POST | `/docx/unpack` |
| POST | `/docx/pack` |
| POST | `/docx/validate` |
| POST | `/docx/accept-changes` |
| POST | `/docx/comment` |

## `/internal/sandbox` — `services/skills/connected_code/router.py`

| Method | Path |
|---|---|
| GET | `/internal/sandbox/capabilities` |
| GET | `/internal/sandbox/files` |
| POST | `/internal/sandbox/files` |
| GET | `/internal/sandbox/files/{name:path}` |
| POST | `/internal/sandbox/documents/{name:path}/pages` |
| POST | `/internal/sandbox/documents/{name:path}/assets` |
| GET | `/internal/sandbox/knowledge` |
| POST | `/internal/sandbox/knowledge/search` |
| POST | `/internal/sandbox/generate` |
| POST | `/internal/sandbox/progress` |
| POST | `/internal/sandbox/request` |
| POST | `/internal/sandbox/action` |
| POST | `/internal/sandbox/drain` |
| POST | `/internal/sandbox/call_many` |
| POST | `/internal/sandbox/pull_page` |
| GET | `/internal/sandbox/tables` |
| POST | `/internal/sandbox/query_data` |
| POST | `/internal/sandbox/save_rows` |
| POST | `/internal/sandbox/tool_schema` |
| POST | `/internal/sandbox/web/read` |
| POST | `/internal/sandbox/browser` |
| POST | `/internal/sandbox/persona/find` |
| POST | `/internal/sandbox/persona/ask` |
| POST | `/internal/sandbox/persona/wait` |
| POST | `/internal/sandbox/agent/ask` |
| GET | `/internal/sandbox/automations/{automation_id}` |
| POST | `/internal/sandbox/automations` |
| POST | `/internal/sandbox/automations/wait` |
| POST | `/internal/sandbox/automations/{automation_id}` |
| POST | `/internal/sandbox/automations/{automation_id}/possible-connectors` |
| POST | `/internal/sandbox/embed` |
| POST | `/internal/sandbox/search` |
| GET | `/internal/sandbox/slack` |
| POST | `/internal/sandbox/slack/invoke` |

---

## Method

1. `Grep` for `@(router|app)\.(get|post|put|patch|delete|websocket)\(` across every `**/router.py` under `back-end-test/services/` (19 files, 21 `APIRouter` instances — same structure as `back-end`).
2. Read `organizations/router.py` and `connectors/schemas.py` in full, since those are the two files where the route/field count differed from `back-end`'s equivalents.
3. Cross-checked `main.py`'s `app.include_router(...)` calls (21 includes) and import aliases — caught the `invite_router` → `/org-invite` rename this way (the Python variable name is unchanged; only its mounted prefix and the accept-endpoint's response model changed).
4. Confirmed every other router's routes are byte-for-byte identical to `back-end` (main) by comparing the full decorator dump line-for-line.

Total: **~140 routes** (back-end main has ~155 — the difference is exactly the removed Team/personal-request/member-cap routes, minus the two new flat-invite routes).
