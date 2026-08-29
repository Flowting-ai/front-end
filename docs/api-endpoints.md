# Front-end API endpoint catalog

Freshly scanned from the front-end source (not copied from the backend doc) — every backend endpoint constant the app actually knows about, plus the front-end's own Next.js API routes. Two sources define backend paths:

- `src/lib/config.ts` — the canonical, centralized source. Almost every endpoint constant lives here as `withBase('/path')` or a `(id) => withBase('/path/${id}')` factory.
- Two files build their own local constants the same way instead of importing from `config.ts`: `src/lib/api/automations.ts` and `src/lib/api/brain.ts`.

No other file in `src/` constructs a backend path outside of these three.

---

## Chats — `src/lib/api/chat.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `CHATS_ENDPOINT` | GET | `/chats` |
| `CHATS_CREATE_ENDPOINT` | POST | `/chats/create` |
| `CHATS_RENAME_ENDPOINT` | PATCH | `/chats/rename` |
| `CHAT_MESSAGES_ENDPOINT(id)` | GET | `/chats/{id}/messages` |
| `CHAT_STREAM_ENDPOINT(id)` | POST | `/chats/{id}/stream` |
| `CHAT_STOP_ENDPOINT(id)` | POST | `/chats/{id}/stop` |
| `CHAT_DELETE_ENDPOINT(id)` | DELETE | `/chats/{id}` |
| `CHAT_VISIBILITY_ENDPOINT(id)` | PATCH | `/chats/{id}/visibility` |
| `CHAT_COPY_ENDPOINT(id)` | POST | `/chats/{id}/copy` |
| `CHAT_STAR_ENDPOINT(id)` | PATCH | `/chats/{id}/star` |
| `DELETE_MESSAGE_ENDPOINT(id)` | DELETE | `/chats/message/{id}` |
| `CHAT_SAVE_TO_DRIVE_ENDPOINT(id)` | POST | `/chats/files/{id}/save-to-drive` |
| `CHAT_PROMPT_RESPOND_ENDPOINT(id)` | POST | `/chats/prompts/{id}` |

## Brain — `src/lib/api/brain.ts` (local constants, not in `config.ts`)

| Constant | Method(s) | Path |
|---|---|---|
| `BRAIN_BASE` | GET/DELETE | `/brain` |
| `BRAIN_CREATE` | POST | `/brain/create` |
| `BRAIN_RENAME` | PATCH | `/brain/rename` |
| `BRAIN_STREAM(id)` | POST | `/brain/{id}/stream` |
| `BRAIN_MESSAGES(id)` | GET | `/brain/{id}/messages` |
| `BRAIN_STOP(id)` | POST | `/brain/{id}/stop` |
| `BRAIN_STAR(id)` | PATCH | `/brain/{id}/star` |
| `PROMPT_RESPOND(id)` | POST | `/chats/prompts/{id}` *(duplicate of `CHAT_PROMPT_RESPOND_ENDPOINT` above — same path, defined twice)* |

## Personas / agents — `src/lib/api/personas.ts`, `persona-repo.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `PERSONAS_ENDPOINT` | GET/POST | `/persona` |
| `PERSONA_DETAIL_ENDPOINT(id)` | GET/DELETE | `/persona/{id}` |
| `PERSONA_USE_ENDPOINT(id)` | POST | `/persona/{id}/use` |
| `PERSONA_ENHANCE_ENDPOINT` | POST | `/persona/enhance-prompt` |
| `PERSONA_STARTER_ENDPOINT` | POST | `/persona/starter` |
| `PERSONA_PAUSE_ENDPOINT(id)` | PATCH | `/persona/{id}/pause` |
| `PERSONA_ACTIVE_ENDPOINT(id)` | PATCH | `/persona/{id}/active` |
| `PERSONA_PUBLISH_ENDPOINT(id)` | POST | `/persona/{id}/publish` |
| `PERSONA_GUIDE_ENDPOINT(id)` | POST | `/persona/{id}/guide` |
| `PERSONA_VISIBILITY_ENDPOINT(id)` | PATCH | `/persona/{id}/visibility` |
| `PERSONA_VERSIONS_ENDPOINT(id)` | GET/POST | `/persona/{id}/versions` |
| `PERSONA_VERSION_DETAIL_ENDPOINT(id, v)` | GET/PATCH/DELETE | `/persona/{id}/versions/{v}` |
| `PERSONA_VERSION_TEST_ENDPOINT(id, v)` | POST | `/persona/{id}/versions/{v}/test` |
| `PERSONA_VERSION_DOCUMENT_ENDPOINT(id, v)` | POST | `/persona/{id}/versions/{v}/document` |
| `PERSONA_VERSION_DOCUMENT_DELETE_ENDPOINT(id, v, d)` | DELETE | `/persona/{id}/versions/{v}/document/{d}` |
| `PERSONA_VERSION_KNOWLEDGE_URL_ENDPOINT(id, v)` | POST | `/persona/{id}/versions/{v}/knowledge-url` |
| `PERSONA_VERSION_FILES_ENDPOINT(id, v)` | PUT | `/persona/{id}/versions/{v}/files` |
| `PERSONA_VERSION_BLOCKED_CONNECTORS_ENDPOINT(id, v)` | PATCH | `/persona/{id}/versions/{v}/blocked-connectors` |
| `PERSONA_VERSION_BLOCKED_CONNECTOR_ENDPOINT(id, v, slug)` | DELETE | `/persona/{id}/versions/{v}/blocked-connectors/{slug}` |
| `PERSONA_CHATS_ENDPOINT(id)` | GET/DELETE | `/persona/{id}/chats` |
| `PERSONA_CHATS_CREATE_ENDPOINT(id)` | POST | `/persona/{id}/chats/create` |
| `PERSONA_CHAT_MESSAGES_ENDPOINT(id, c)` | GET | `/persona/{id}/chats/{c}/messages` |
| `PERSONA_CHAT_STREAM_ENDPOINT(id, c)` | POST | `/persona/{id}/chats/{c}/stream` |
| `PERSONA_CHAT_STOP_ENDPOINT(id, c)` | POST | `/persona/{id}/chats/{c}/stop` |
| `PERSONA_CHATS_RENAME_ENDPOINT(id)` | PATCH | `/persona/{id}/chats/rename` |
| `PERSONA_CHAT_DELETE_MESSAGE_ENDPOINT(id, c, m)` | DELETE | `/persona/{id}/chats/{c}/message/{m}` |

⚠ Not covered by any constant: backend also has `PUT /persona/{repo_id}/versions/{persona_id}/connectors`, `PATCH .../connector-hints`, and `PUT .../document/{document_id}/org-knowledge` (confirmed in the backend scan) — no front-end call site found for these three.

## Persona shares — `src/lib/api/persona-shares.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `PERSONA_SHARES_ENDPOINT` | GET/POST | `/persona-shares` |
| `PERSONA_SHARES_RECEIVED_ENDPOINT` | GET | `/persona-shares/received` |
| `PERSONA_SHARES_SENT_ENDPOINT` | GET | `/persona-shares/sent` |
| `PERSONA_SHARES_DASHBOARD_ENDPOINT` | GET | `/persona-shares/dashboard` |
| `PERSONA_SHARE_DETAIL_ENDPOINT(id)` | GET/DELETE | `/persona-shares/{id}` |
| `PERSONA_SHARE_ACCEPT_ENDPOINT(id)` | POST | `/persona-shares/{id}/accept` |

## Connectors — `src/lib/api/connectors.ts`, `org-connectors.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `CONNECTORS_ENDPOINT` | GET | `/connectors` |
| `CONNECTOR_DETAIL_ENDPOINT(slug)` | GET/PATCH/DELETE | `/connectors/{slug}` |
| `CONNECTOR_LINK_ENDPOINT(slug)` | POST | `/connectors/{slug}/link` |
| `ORG_CATALOG_ENDPOINT(orgId)` | GET | `/organizations/{orgId}/connectors/catalog` |
| `ORG_CONNECTOR_ACCOUNTS_ENDPOINT(orgId, slug)` | GET/POST | `/organizations/{orgId}/connectors/{slug}/accounts` |
| `ORG_CONNECTOR_ACCOUNT_ENDPOINT(orgId, id)` | PATCH/DELETE | `/organizations/{orgId}/connectors/accounts/{id}` |
| `ORG_CONNECTOR_USED_BY_ENDPOINT(orgId, slug)` | GET | `/organizations/{orgId}/connectors/{slug}/used-by` |
| `ORG_CONNECTOR_PERSONAL_REQUEST_ENDPOINT(orgId, slug)` | POST | `/organizations/{orgId}/connectors/{slug}/personal-request` |
| `ORG_CONNECTOR_PERSONAL_REQUEST_REVIEW_ENDPOINT(orgId, id)` | PATCH | `/organizations/{orgId}/connectors/personal-requests/{id}` |
| `ORG_TEAMS_ENDPOINT(orgId)` | GET | `/organizations/{orgId}/teams` |
| `ORG_TEAM_CONNECTORS_ENDPOINT(orgId, teamId)` | GET/POST | `/organizations/{orgId}/teams/{teamId}/connectors` |
| `ORG_TEAM_CONNECTOR_STATUS_ENDPOINT(orgId, teamId, slug)` | PATCH/DELETE | `/organizations/{orgId}/teams/{teamId}/connectors/{slug}` |

⚠ Not called from the front-end at all (real backend routes, no client): `GET /organizations/{id}/connectors/personal-requests` (list, admin), the whole `/organizations/{id}/teams/{id}/connections/*` family, team editors, team invites/overflow, `/organizations/{id}/teams/{id}/persona-shares`.

## Organizations & members — `src/lib/api/organization.ts`, `teams.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `ORGANIZATIONS_ENDPOINT` | GET/POST | `/organizations` |
| `ORG_ENDPOINT(id)` | GET/PATCH/DELETE | `/organizations/{id}` |
| `ORG_SETTINGS_ENDPOINT(id)` | GET/PATCH | `/organizations/{id}/settings` |
| `ORG_PLAN_ENDPOINT(id)` | GET | `/organizations/{id}/plan` |
| `ORG_PLAN_POOL_CAP_ENDPOINT(id)` / `ORG_POOL_CAP_ENDPOINT(id)` | PATCH | `/organizations/{id}/plan/pool-cap` *(two constants, identical path)* |
| `ORG_PLAN_USAGE_ENDPOINT(id)` | GET | `/organizations/{id}/plan/usage` |
| `ORG_POOL_STATUS_ENDPOINT(id)` | GET | `/organizations/{id}/pool-status` |
| `ORG_AUDIT_ENDPOINT(id)` | GET | `/organizations/{id}/audit` |
| `ORG_TRANSFER_OWNER_ENDPOINT(id)` | POST | `/organizations/{id}/transfer-owner` |
| `ORG_MEMBERS_ENDPOINT(id)` | GET | `/organizations/{id}/members` |
| `ORG_MEMBER_ENDPOINT(id, m)` | DELETE | `/organizations/{id}/members/{m}` |
| `ORG_MEMBER_ROLE_ENDPOINT(id, m)` | PATCH | `/organizations/{id}/members/{m}/role` |
| `ORG_INVITES_ENDPOINT(id)` | POST | `/organizations/{id}/invites` |
| `ORG_PROJECT_MEMBERS_ENDPOINT(id, p)` | GET/POST | `/organizations/{id}/projects/{p}/members` |
| `ORG_PROJECT_MEMBER_ENDPOINT(id, p, m)` | DELETE | `/organizations/{id}/projects/{p}/members/{m}` |
| `TEAM_INVITE_PREVIEW_ENDPOINT(id)` | GET | `/team-invite/{id}` |
| `TEAM_INVITE_ACCEPT_ENDPOINT(id)` | POST | `/team-invite/{id}/accept` |

🔴 **Confirmed broken against the current backend** (cross-checked live against `services/organizations/router.py`):
- `ORG_INVITES_ENDPOINT` calls `POST /organizations/{id}/invites` — the real route is **team-scoped**: `POST /organizations/{id}/teams/{team_id}/invites`. No bare org-level invites route exists. This will 404.
- `ORG_PROJECT_MEMBERS_ENDPOINT` / `ORG_PROJECT_MEMBER_ENDPOINT` call `/organizations/{id}/projects/{p}/members` — the real route is also **team-scoped**: `/organizations/{id}/teams/{team_id}/projects/{p}/members`. Will 404.

Both are called from `src/lib/api/teams.ts` and are presumably leftover from the pre-flattening org/team model discussed elsewhere in this session.

## Chat shares — `src/lib/api/chat-shares.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `CHAT_SHARES_ENDPOINT` | GET/POST | `/chat-shares` |
| `CHAT_SHARES_SHARED_WITH_ME_ENDPOINT` | GET | `/chat-shares/shared-with-me` |
| `CHAT_SHARE_ENDPOINT(id)` | GET/DELETE | `/chat-shares/{id}` |
| `CHAT_SHARE_FORK_ENDPOINT(id)` | POST | `/chat-shares/{id}/fork` |

## Slack — `src/lib/api/slack.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `SLACK_INSTALL_ENDPOINT` | GET | `/slack/install` |
| `SLACK_STATUS_ENDPOINT` | GET | `/slack/status` |
| `SLACK_LINK_ENDPOINT` | POST/DELETE | `/slack/link` |
| `ORG_SLACK_PROJECT_CHANNEL_ENDPOINT(id, p)` | GET/POST/PATCH/DELETE | `/organizations/{id}/slack/projects/{p}/channel` |
| `ORG_SLACK_INSTALLATION_ENDPOINT(id)` | GET/DELETE | `/organizations/{id}/slack/installation` |
| `ORG_SLACK_CHANNELS_ENDPOINT(id)` | GET | `/organizations/{id}/slack/channels` |
| `ORG_SLACK_CHANNEL_MAPPING_ENDPOINT(id, ch)` | (see below) | `/organizations/{id}/slack/channels/{ch}/mapping` |

🔴 **Confirmed broken against the current backend**: `ORG_SLACK_CHANNELS_ENDPOINT` and `ORG_SLACK_CHANNEL_MAPPING_ENDPOINT` are actively called from `slack.ts`, but no `/organizations/{id}/slack/channels` route exists anywhere in `services/organizations/router.py` — only the project-scoped `/slack/projects/{project_id}/channel` and `/slack/installation` exist. These two calls will 404 against the live backend.

## Automations — `src/lib/api/automations.ts` (local constants, not in `config.ts`)

| Constant | Method(s) | Path |
|---|---|---|
| `AUTOMATIONS_BASE` | GET | `/automations` |
| `AUTOMATION_BY_ID(id)` | GET/PATCH/DELETE | `/automations/{id}` |
| `AUTOMATION_RUN(id)` | POST | `/automations/{id}/run` |

## Users — `src/lib/api/user.ts`, `current-user.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `USER_ENDPOINT` | GET/PATCH | `/users/me` |
| `USER_CREATE_ENDPOINT` | POST | `/users/create` |
| `USER_ONBOARDING_ENDPOINT` | PATCH | `/users/me/onboarding` |

## Stripe — `src/lib/api/stripe.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `STRIPE_CHECKOUT_ENDPOINT` | POST | `/stripe/checkout` |
| `STRIPE_SUBSCRIPTION_ENDPOINT` | DELETE | `/stripe/subscription` |
| `STRIPE_SUBSCRIPTION_RESUME_ENDPOINT` | POST | `/stripe/subscription/resume` |
| `STRIPE_TOPUP_ENDPOINT` | POST | `/stripe/topup` |
| `STRIPE_TOPUP_CHARGE_ENDPOINT` | POST | `/stripe/topup/charge` |
| `STRIPE_BILLING_ENDPOINT` | GET | `/stripe/billing` |
| `STRIPE_PORTAL_ENDPOINT` | POST | `/stripe/portal` |
| `STRIPE_TRIAL_ENDPOINT` | POST | `/stripe/trial` |

## LLM models — `src/lib/api/models.ts`

| Constant | Method(s) | Path |
|---|---|---|
| `MODELS_ENDPOINT` | GET | `/llm/models` |
| `MODELS_ALL_ENDPOINT` | GET | `/llm/models/all` |
| `MODELS_BLOCK_ENDPOINT` | PATCH | `/llm/models/block` |
| `MODELS_TEST_ENDPOINT` | POST | `/llm/models/test` |

## Highlights, Pins, Projects, Memory

| Constant | Method(s) | Path |
|---|---|---|
| `HIGHLIGHTS_ENDPOINT` | GET/PATCH | `/highlights` |
| `HIGHLIGHT_DETAIL_ENDPOINT(id)` | PATCH | `/highlights/{id}` |
| `PINS_ENDPOINT` | GET | `/pins` |
| `PIN_DETAIL_ENDPOINT(id)` | GET | `/pins/{id}` |
| `CREATE_PIN_ENDPOINT(m)` | POST | `/pins/message/{m}` |
| `PIN_FOLDERS_ENDPOINT` | GET | `/pins/folders/all` |
| `PIN_FOLDERS_CREATE_ENDPOINT` | POST | `/pins/folders` |
| `PIN_FOLDER_DETAIL_ENDPOINT(id)` | PATCH/DELETE | `/pins/folders/{id}` |
| `PIN_MOVE_ENDPOINT(id)` | PATCH | `/pins/{id}/folder` |
| `PIN_TAGS_ENDPOINT(id)` | PUT | `/pins/{id}/tags` |
| `PIN_COMMENT_ENDPOINT(id)` | POST | `/pins/{id}/comments` |
| `PIN_COMMENT_CRUD_ENDPOINT(id, c)` | PATCH/DELETE | `/pins/{id}/comments/{c}` |
| `PROJECTS_ENDPOINT` | GET/POST | `/projects` |
| `PROJECT_DETAIL_ENDPOINT(id)` | GET/PATCH/DELETE | `/projects/{id}` |
| `PROJECT_VISIBILITY_ENDPOINT(id)` | PATCH | `/projects/{id}/visibility` |
| `PROJECT_CHATS_ENDPOINT(id)` | GET | `/projects/{id}/chats` |
| `PROJECT_CHAT_LINK_ENDPOINT(id, c)` | POST/DELETE | `/projects/{id}/chats/{c}` |
| `PROJECT_FILES_ENDPOINT(id)` | PUT | `/projects/{id}/files` |
| `PROJECT_FILE_ENDPOINT(id, d)` | DELETE | `/projects/{id}/files/{d}` |
| `MEMORY_USER_ENDPOINT` | POST | `/memory/user` |
| `HEALTH_ENDPOINT` | GET | `/health` |

## Dead code — defined, never called from anywhere

| Constant(s) | Path(s) |
|---|---|
| `WORKFLOWS_ENDPOINT`, `WORKFLOW_DETAIL_ENDPOINT`, `WORKFLOW_PAUSE_ENDPOINT`, `WORKFLOW_EXECUTE_STREAM_ENDPOINT`, `WORKFLOW_CHATS_ENDPOINT`, `WORKFLOW_CHATS_CREATE_ENDPOINT`, `WORKFLOW_CHAT_MESSAGES_ENDPOINT`, `WORKFLOW_CHAT_STREAM_ENDPOINT`, `WORKFLOW_CHAT_STOP_ENDPOINT`, `WORKFLOW_CHATS_RENAME_ENDPOINT`, `WORKFLOW_CHAT_DELETE_MESSAGE_ENDPOINT` | `/workflow/*` — an entire family, only ever referenced inside `config.ts` itself. **The backend has no `/workflow` router at all** (confirmed: no `prefix="/workflow"` anywhere in `services/`). Fully dead. |

---

## Front-end's own Next.js API routes (not backend calls — these run on Vercel/Node, not FastAPI)

| Route | Method(s) | Purpose |
|---|---|---|
| `/api/backend/[...path]` | (proxy, all methods) | Same-origin proxy to the backend, used everywhere `API_BASE_URL` resolves to `/api/backend` (local dev / when direct CORS isn't set up) |
| `/api/chat` | POST | Bespoke chat-streaming proxy (bypasses the generic backend proxy, see `directUpload`/`shouldUseDirectBackend` in `config.ts`) |
| `/api/brain-chat` | POST | Same, for Brain chat streaming |
| `/api/persona-chat` | POST | Same, for persona/agent chat streaming |
| `/api/download` | GET | File-download passthrough |
| `/api/onboarding/logout` | GET | Onboarding-flow logout redirect |
| `/dispatch/[...path]` | GET/POST/OPTIONS | First-party Mixpanel ingestion proxy (see `AGENTS.md`'s Analytics section) — not a backend call at all |

---

## Method

1. Read `src/lib/config.ts` in full — the single centralized source for ~110 of the ~120 endpoint constants.
2. Grepped all of `src/` for `withBase(` to find endpoint constants defined *outside* `config.ts` — found exactly two extra files (`automations.ts`, `brain.ts`).
3. Grepped every `src/lib/api/*.ts` file for literal-string `apiFetch(Json)?("...")` calls to catch any endpoint built inline without a named constant — none found beyond the ones already in `config.ts`/`automations.ts`/`brain.ts`.
4. Spot-checked several constants against the backend's actual routes (from a prior fresh backend scan, `back-end/docs/api-endpoints.md`) to catch drift — found two confirmed-broken call sites (`ORG_SLACK_CHANNELS_ENDPOINT`/`ORG_SLACK_CHANNEL_MAPPING_ENDPOINT`, `ORG_INVITES_ENDPOINT`/`ORG_PROJECT_MEMBERS_ENDPOINT`) and one fully dead endpoint family (`WORKFLOW_*`). This was a spot check, not exhaustive — other drift may exist among the ~120 constants that weren't individually re-verified.
5. Found the front-end's own Next.js route handlers via `src/app/api/**/route.ts` and `src/app/dispatch/[...path]/route.ts`.
