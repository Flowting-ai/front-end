# Connectors

Third-party app integrations (Gmail, Google Calendar, ClickUp, Shopify, …) exposed to the LLM as tools. Built on top of [Composio](https://composio.dev) — Composio owns OAuth, credential storage, and the per-app action catalog. We own the curated allowlist, the per-tool permission gate, and the LLM-facing meta-dispatch surface.

Backend code lives in [services/connectors/](../services/connectors/). The matching frontend integration walkthrough is [services/connectors/FRONTEND_FLOW.md](../services/connectors/FRONTEND_FLOW.md) (kept as the canonical UI-facing doc).

---

## Table of contents

1. [Core concepts](#core-concepts)
2. [Architecture overview](#architecture-overview)
3. [Data flow](#data-flow)
4. [Module reference](#module-reference)
5. [REST API](#rest-api)
6. [LLM meta-dispatch](#llm-meta-dispatch)
7. [SSE events](#sse-events)
8. [Permission model](#permission-model)
9. [Database schema](#database-schema)
10. [Adding a new connector](#adding-a-new-connector)
11. [Operational notes](#operational-notes)

---

## Core concepts

| Term | Meaning |
|---|---|
| **Connector** | A third-party app, identified by `slug` (e.g. `gmail`, `clickup`). Declared in [catalog.py](../services/connectors/catalog.py). |
| **Tool** | A single Composio action inside a connector (e.g. `GMAIL_SEND_EMAIL`). Synced from Composio into the `ConnectorTool` table. |
| **Linked** | Whether the user has an ACTIVE Composio connected account for this connector. Composio is the source of truth — we never cache this. |
| **Permission** | Per-tool policy: `allow`, `block`, `ask`, `allow_once`. Stored in `UserConnectorPermission`. Default is `ask`. |
| **Auth mode** | `oauth2` (redirect flow) or `api_key` (form fields submitted via PATCH). |
| **Meta-dispatch** | The LLM sees only three generic tools (`list_connectors`, `list_connector_tools`, `run_connector_tool`) instead of one tool per Composio action. Lets us scale to hundreds of actions without blowing the context budget. |

---

## Architecture overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                  │
│                                                                        │
│   Connector settings UI       Chat UI (SSE consumer)                   │
└──────────┬──────────────────────────────┬──────────────────────────────┘
           │ REST (/connectors)           │ SSE: tool_connect_prompt,
           │                              │       tool_permission_prompt
           ▼                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       services/connectors/                             │
│                                                                        │
│   router.py   ───►  service.py  ───►  repository.py  ──►  Postgres    │
│                          │                                             │
│                          ├──► composio_client.py  ──►  Composio API   │
│                          │                                             │
│                          └──► permissions.py + tool_factory.py        │
│                                       ▲                                │
│                                       │  (called by chat handler)      │
│                              catalog.py meta-dispatch                  │
└────────────────────────────────────────────────────────────────────────┘
```

Two distinct entry points:

- **Settings UI** uses [router.py](../services/connectors/router.py) (REST). Drives link / unlink / permissions.
- **Chat tool calls** use [catalog.py](../services/connectors/catalog.py)'s `build_connector_tools_and_handlers` (in-process). The chat handler imports this to produce the LLM tool list and dispatch table.

---

## Data flow

### Linking an OAuth connector

```
UI  ── POST /connectors/gmail/link ──►  service.initiate_link
                                            │
                                            ├─ composio_client.delete_stale_connections (prune INITIATED/EXPIRED)
                                            └─ composio_client.initiate_connection
                                                    │
                                                    ▼
                                        Composio returns redirect_url
                                            │
UI  ◄── { redirect_url } ──────────────────┘
UI  ── window.open(redirect_url) ──►  Composio OAuth host
UI  ── poll GET /connectors ─────►  linked: true (once Composio reports ACTIVE)
```

`linked` derives from `composio_client.list_active_connections` on every list call — no DB write happens at link time. That's why polling works.

### Executing a tool from chat

```
LLM ── run_connector_tool({tool_slug, arguments}) ──► catalog.handle_run_connector_tool
                                                          │
                                                          ▼
                                         tool_factory.execute_connector_action
                                                          │
                                                          ├─ permissions.resolve  ──►  Composio (linked?) + DB (policy)
                                                          │
                                  ┌───────────────────────┼───────────────────────┐
                                  ▼                       ▼                       ▼
                          needs_connect              policy = ask              policy = allow
                                  │                       │                       │
                          emit tool_connect_       emit tool_permission_         composio_client.execute_tool
                          prompt SSE event          prompt SSE event                     │
                          return NOT_CONNECTED     return PERMISSION_REQUIRED            ▼
                          sentinel                 sentinel                       JSON result back to LLM
```

After a successful execute, if the policy was `allow_once`, [repository.consume_allow_once](../services/connectors/repository.py#L99) flips it back to `ask`.

A successful execute also "promotes" the tool: the chat-local `tool_memory` cache records the schema so on the next turn the model can call e.g. `gmail_send_email` directly without the three-hop meta-dispatch. See [catalog.py:299-313](../services/connectors/catalog.py#L299-L313).

---

## Module reference

### [catalog.py](../services/connectors/catalog.py)

Owns the curated catalog of supported connectors and the LLM meta-dispatch surface.

| Symbol | What it does |
|---|---|
| `ConnectorSpec` | Frozen dataclass: `slug`, `display_name`, `auth_mode`, `description`, `api_key_fields`. |
| `CATALOG` | Tuple of every supported connector. |
| `BY_SLUG` | `dict[slug, ConnectorSpec]` lookup. |
| `get_connector(slug)` | Lookup or `None`. |
| `build_connector_tools_and_handlers(user_id, queue, chat_id)` | Returns `(tools, handlers)` consumed by the chat tool loop. Tools = three meta-tools + any promoted tools from `tool_memory`. |

Meta-tools exposed to the LLM:

| Tool | Purpose |
|---|---|
| `list_connectors()` | Returns every connector summary (slug, display_name, description, auth_mode). |
| `list_connector_tools(connector_slug)` | Returns `[{tool_slug, summary}]` — parameter schemas are deliberately omitted to keep the response small. |
| `run_connector_tool(tool_slug, arguments)` | Executes one action. On argument errors, the response includes the full `schema` so the model can retry. |

### [composio_client.py](../services/connectors/composio_client.py)

Thin wrapper around the Composio Python SDK. Single lazily-constructed global client (`get_client()`). `COMPOSIO_API_KEY` is read from env / AWS Secrets via `core`.

| Function | Purpose |
|---|---|
| `get_client()` | Lazy singleton — first call fails loudly if API key missing. |
| `paginate(list_fn, **kwargs)` | Walks Composio's cursor-paginated list endpoints. SDK doesn't auto-paginate; without this we silently truncate at ~20. |
| `list_active_connections(user_id) → {toolkit_slug: account_id}` | **Source of truth for `linked`.** Async wrapper over `fetch_active`. |
| `delete_stale_connections(user_id, slug) → int` | Prunes non-ACTIVE accounts (INITIATED, EXPIRED, FAILED, REVOKED). Called before re-link and on unlink. |
| `initiate_connection(slug, user_id) → redirect_url` | Kicks off OAuth, returns the redirect URL. |
| `create_api_key_connection(slug, user_id, credentials)` | Submits API-key form fields as the auth config. |
| `update_connection_credentials(account_id, credentials)` | Rotates credentials in place on an existing account. |
| `delete_connection(account_id)` | Hard-delete a connected account. |
| `list_tools_for_toolkit(toolkit_slug, user_id="registry")` | Fetch all OpenAI-shaped tool schemas for a toolkit. Designed for startup sync; `user_id` is a dummy entity since schemas are toolkit-level. |
| `execute_tool(tool_slug, user_id, arguments, connected_account_id=None)` | Run an action. Passes `dangerously_skip_version_check=True` so runtime matches the schemas we synced at startup. |
| `get_tool_schema(tool_slug, user_id)` | Fetch a single tool's schema. |

### [service.py](../services/connectors/service.py)

REST orchestration. Pure async; no FastAPI imports beyond `HTTPException`.

| Function | Purpose |
|---|---|
| `list_user_connectors(auth0_id, db)` | Build the full catalog response for a user: `linked` from Composio, per-tool policies from DB, available tool slugs from `ConnectorTool`. |
| `get_user_connector(auth0_id, slug, db)` | Same shape as list, single connector. 404 on unknown slug. |
| `initiate_link(auth0_id, slug, db)` | OAuth-only. Prunes stale → calls Composio → returns `{connector_slug, redirect_url}`. Rejects api_key connectors with 400. |
| `update_connector(...)` | Applies `credentials` and/or `permissions`. Returns the refreshed entry. |
| `apply_credentials(...)` | api_key only. Validates required fields. If already linked → rotate; else → prune stale + create. |
| `apply_permissions(...)` | Validates each `tool_slug` against `ConnectorTool` for the connector, then upserts. |
| `unlink(auth0_id, slug, db)` | Delete the active connected account + prune stale + wipe the user's permissions for the connector. Returns `False` if nothing was linked (router translates to 404). |

### [router.py](../services/connectors/router.py)

FastAPI router under `/connectors`. All routes require auth via `get_current_user`. Thin shim — delegates everything to `service`.

### [repository.py](../services/connectors/repository.py)

All DB access for `UserConnectorPermission` and `ConnectorTool`.

| Function | Purpose |
|---|---|
| `get_permission(auth0_id, tool_slug, db)` | One row or `None`. |
| `list_permissions(auth0_id, db)` | All policies for a user (across connectors). |
| `upsert_permissions(auth0_id, connector_slug, entries, db)` | Batch upsert in a single commit. Also re-stamps `connector_slug` in case it shifted. |
| `delete_permissions_for_connector(auth0_id, slug, db)` | Used by unlink. |
| `list_tools(db)` / `list_tools_for_connector(slug, db)` | Read `ConnectorTool`. |
| `get_tool_by_slug(slug, db)` | Used by `run_connector_tool` to fetch the schema for fallback responses. |
| `replace_tools_for_connector(slug, tools, db)` | Wipe + rewrite all tool rows for one connector in a single txn. Cheaper than diff-upsert. |
| `consume_allow_once(auth0_id, tool_slug, db)` | Post-execute hook: flip `allow_once` → `ask`. |

### [permissions.py](../services/connectors/permissions.py)

Single-purpose: resolve the policy for a (user, connector, tool) triple.

```python
Decision(needs_connect: bool, policy: ToolPolicy, connected_account_id: str | None)
```

`needs_connect` short-circuits: you can't grant policy on an unlinked connector. Link state comes from Composio every call (no cache).

### [tool_factory.py](../services/connectors/tool_factory.py)

The gated execute path. Used by `handle_run_connector_tool` and by promoted-tool handlers.

| Function | Purpose |
|---|---|
| `tool_name(tool_slug)` | Lowercased Composio slug — used as the OpenAI function name. |
| `normalize_schema(schema, spec, slug)` | Deep-copy + lowercase name + tag description with display name (`"[Gmail] …"`). |
| `execute_connector_action(...)` | The orchestrator. Resolve policy → emit prompts on `needs_connect`/`ask`/`block` → call `composio_client.execute_tool` → consume `allow_once` → JSON-serialize the result. Returns either the JSON payload or one of the sentinels (`NOT_CONNECTED:`, `PERMISSION_REQUIRED:`, `BLOCKED:`, `Tool error:`). |

### [curation.py](../services/connectors/curation.py)

Hand-picked allowlist of Composio actions per connector (`CURATED_TOOLS: dict[str, tuple[str, ...]]`). The DB prune migration ([alembic/versions/c9e5a7d2f1b3_prune_connector_tools.py](../alembic/versions/c9e5a7d2f1b3_prune_connector_tools.py)) deletes everything not in this allowlist from `ConnectorTool`. Without curation, Composio exposes 100–400 actions per app — far more than fits in a single `list_connector_tools` response.

`all_curated_slugs()` is a flat tuple of every allowed slug.

### [models.py](../services/connectors/models.py)

SQLAlchemy ORM:

- `ToolPolicy(enum)` — `allow | block | ask | allow_once`.
- `ConnectorTool` — `(tool_slug PK, connector_slug, schema JSONB, updated_at)`. The schema column is the OpenAI-shaped tool dict the LLM consumes.
- `UserConnectorPermission` — `(id PK, auth0_id FK, connector_slug, tool_slug, policy, created_at, updated_at)`. Unique on `(auth0_id, tool_slug)`.

### [schemas.py](../services/connectors/schemas.py)

Pydantic request/response models — see [REST API](#rest-api) below.

---

## REST API

All routes under `/connectors`, JWT-authenticated via `get_current_user`.

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/connectors` | – | `{ connectors: ConnectorCatalogEntry[] }` |
| `GET` | `/connectors/{slug}` | – | `ConnectorCatalogEntry` |
| `POST` | `/connectors/{slug}/link` | – | `{ connector_slug, redirect_url }` (OAuth only) |
| `PATCH` | `/connectors/{slug}` | `{ permissions?, credentials? }` | `ConnectorCatalogEntry` |
| `DELETE` | `/connectors/{slug}` | – | `204` (or `404` if nothing was linked) |

### Response types

```ts
ConnectorCatalogEntry {
  slug: string;
  display_name: string;
  auth_mode: "oauth2" | "api_key";
  description: string;
  tools: { slug: string; policy: "allow"|"block"|"ask"|"allow_once" }[];
  api_key_fields: string[];   // non-empty only for api_key connectors
  linked: boolean;            // from Composio on every call
}

LinkResponse {
  connector_slug: string;
  redirect_url: string | null;   // short-lived, do not store
}

UpdateConnectorRequest {
  permissions?: { slug: string; policy: "allow"|"block"|"ask"|"allow_once" }[];
  credentials?: Record<string, string>;
}
```

### Error contract

| Status | When |
|---|---|
| `400` | Wrong auth mode for the endpoint, missing api-key fields, unknown tool slug in `permissions`, invalid policy. |
| `404` | Unknown connector slug; `DELETE` on a connector that isn't linked. |
| `502` | Underlying Composio call failed (initiate / apply credentials / delete). Message is forwarded verbatim. |

---

## LLM meta-dispatch

The LLM never sees one tool per Composio action. It sees three generic tools, defined in [catalog.py](../services/connectors/catalog.py).

| Tool | Purpose | Returns |
|---|---|---|
| `list_connectors()` | Discovery: what apps exist for this user. | JSON array of `{slug, display_name, description, auth_mode}`. |
| `list_connector_tools(connector_slug)` | Drill-down: what actions live inside a connector. | JSON array of `{tool_slug, summary}` — schemas omitted. |
| `run_connector_tool(tool_slug, arguments)` | Execute. On arg-error returns `{error, schema}`. On unlinked/ask/block, emits an SSE event and returns a sentinel string. | JSON result, or sentinel + schema. |

Why three tools instead of one tool per action: with ~50–100 curated actions, a flat tool list costs a few hundred KB of schema in every LLM request. Three-tool dispatch costs ~3 schemas (~few hundred tokens) and recovers parameter schemas lazily on argument errors.

### Promotion

Once an action runs successfully in a chat, `tool_memory.record` saves the normalized schema so that next turn the model gets a direct tool (e.g. `gmail_send_email`) alongside the three meta-tools. Skips the meta-dispatch hop for repeat usage in the same chat. See [catalog.py:286-296](../services/connectors/catalog.py#L286-L296).

If a promoted tool later returns `NOT_CONNECTED:` (user revoked between turns), the handler calls `tool_memory.forget_one` to demote it.

---

## SSE events

The chat stream emits two connector-specific events. Schemas in `core/sse_schemas`.

### `tool_connect_prompt` — connector not linked

```ts
{
  connector_slug: string;
  display_name: string;
  auth_mode: "oauth2" | "api_key";
  tool_name: string;       // the Composio action the model tried to run
  request_id: string;
}
```

UI should render a "Connect <display_name>" CTA inline in the assistant message. Click → run OAuth or API-key flow → user resends.

### `tool_permission_prompt` — policy is `ask`

```ts
{
  connector_slug: string;
  display_name: string;
  tool_name: string;
  request_id: string;
  suggested_args: object;   // what the model was about to send
}
```

UI should render Allow / Block / Allow once buttons. Click → `PATCH /connectors/{connector_slug}` with the chosen policy → user resends.

`allow_once` is one-shot: the next successful execute flips it back to `ask` via `consume_allow_once`.

---

## Permission model

Resolution order ([permissions.py](../services/connectors/permissions.py)):

1. Is the connector linked in Composio? If no → `needs_connect`, emit `tool_connect_prompt`, stop.
2. Look up `UserConnectorPermission` for `(auth0_id, tool_slug)`. Missing row → policy = `ask` (default).
3. Branch on policy:
   - `allow` → execute.
   - `allow_once` → execute, then flip to `ask`.
   - `block` → return `BLOCKED:` sentinel, no execute.
   - `ask` → emit `tool_permission_prompt`, return `PERMISSION_REQUIRED:` sentinel, no execute.

The sentinels are returned **as the tool result** so the LLM can read them and respond ("I've shown you a connect prompt — please click it and resend").

---

## Database schema

### `ConnectorTool`

Synced from Composio (intended at app startup; today populated by the prune migration). One row per allowed action.

| Column | Type | Notes |
|---|---|---|
| `tool_slug` | `VARCHAR(128)` PK | Composio action slug, e.g. `GMAIL_SEND_EMAIL`. |
| `connector_slug` | `VARCHAR(64)` | Catalog slug. Indexed (`ix_connectortool_connector`). |
| `schema` | `JSONB` | OpenAI tool dict (`{type:"function", function:{name, description, parameters}}`). |
| `updated_at` | `TIMESTAMP` | Stamped on insert/update. |

### `UserConnectorPermission`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `auth0_id` | `VARCHAR(255)` FK → `User.auth0_id` | Indexed. |
| `connector_slug` | `VARCHAR(64)` | |
| `tool_slug` | `VARCHAR(128)` | Unique with `auth0_id` (`uq_userconnectorpermission_user_tool`). |
| `policy` | `connectortoolpolicy` enum | `allow | block | ask | allow_once`. Default `ask`. |
| `created_at`, `updated_at` | `TIMESTAMP` | |

There is intentionally no `UserConnectorAccount` table — Composio is the source of truth for linkage state; mirroring it in our DB was previously a source of drift.

---

## Adding a new connector

1. **Add the `ConnectorSpec` entry** in [catalog.py:30](../services/connectors/catalog.py#L30) — `slug`, `display_name`, `auth_mode`, `description`. For api_key, list the required form fields in `api_key_fields`.
2. **Curate its actions** in [curation.py:14](../services/connectors/curation.py#L14) — pick the Composio action slugs you want exposed. Don't dump the whole toolkit; the goal of curation is to keep `list_connector_tools` responses small enough to be useful.
3. **Sync `ConnectorTool` rows** for the new slugs. Today the prune migration handles this; if you add a connector after deploy, you'll need to populate rows manually (call `composio_client.list_tools_for_toolkit(slug)` filtered by your curated list and write them via `repository.replace_tools_for_connector`).
4. **Verify Composio supports the toolkit** in your Composio dashboard and the OAuth/API-key config is provisioned there.
5. **No frontend code changes required** for OAuth connectors. API-key connectors get a generated form from `api_key_fields`.

---

## Operational notes

- **`COMPOSIO_API_KEY` is required.** Missing key doesn't break app startup (lazy client construction in `get_client()`) but the first connector call will raise `RuntimeError`. Set it in env or AWS Secrets via `core`.
- **OAuth redirect URLs are short-lived.** Do not store them. If the user closes the tab, call `POST /link` again.
- **Composio is the source of truth for `linked`.** Every list / get / link / unlink call asks Composio. Do not add a DB mirror — past drift bugs came from exactly this.
- **Pagination is mandatory.** Composio's SDK silently truncates at ~20 items per page. Always go through `composio_client.paginate`.
- **Version pinning is off by design.** `execute_tool` passes `dangerously_skip_version_check=True` so runtime matches the schemas the LLM was handed at sync time. Re-sync schemas if you upgrade the SDK or notice drift.
- **Stale-account pruning runs before link + on unlink.** Keeps Composio's account list clean per user — abandoned INITIATED / EXPIRED / FAILED / REVOKED rows do not accumulate.
- **Connector module is import-light at top level.** [__init__.py](../services/connectors/__init__.py) deliberately does no submodule imports so `alembic/env.py` can import `services.connectors.models` without pulling in the Composio SDK.
