# Connectors — Frontend Flow

How the connector module works from the UI's point of view. Backend is at [services/connectors/](.).

## Concepts

- **Connector** — a third-party app (Gmail, ClickUp, Shopify, …). Identified by `slug`.
- **Tool** — a single Composio action inside a connector (e.g. `GMAIL_SEND_EMAIL`).
- **Account** — the user's link to a connector. Status: `pending | active | failed | revoked`.
- **Permission** — per-tool policy: `allow | block | ask | allow_once`. Default is `ask`.
- **Auth mode** — `oauth2` (redirect flow) or `api_key` (form fields).

## REST endpoints

All under `/connectors`, auth required ([router.py](router.py)).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/connectors` | List every catalog connector + per-user link/permission state |
| `GET` | `/connectors/{slug}` | Same shape as list, single connector |
| `POST` | `/connectors/{slug}/link` | Start an OAuth link — returns `redirect_url` |
| `PATCH` | `/connectors/{slug}` | Update permissions and/or submit API-key credentials |
| `DELETE` | `/connectors/{slug}` | Unlink (revokes on Composio + deletes the row) |

### Response shape ([schemas.py](schemas.py))

```ts
ConnectorCatalogEntry {
  slug: string;                  // "gmail"
  display_name: string;          // "Gmail"
  auth_mode: "oauth2" | "api_key";
  description: string;
  tools: { slug: string; policy: "allow"|"block"|"ask"|"allow_once" }[];
  api_key_fields: string[];      // only set when auth_mode === "api_key"
  linked: boolean;               // true only when status === "active"
  status: "pending" | "active" | "failed" | "revoked" | null;
  redirect_url: string | null;   // populated while status === "pending"
}
```

## UI states per connector

Drive the UI off `auth_mode` + `status`:

| `auth_mode` | `status` | UI |
|---|---|---|
| `oauth2` | `null` | "Connect" button → `POST /link` → open `redirect_url` |
| `oauth2` | `pending` | "Resume connecting" → reopen stored `redirect_url`, poll `GET /{slug}` |
| `oauth2` | `active` | Show tools list + permission toggles + "Disconnect" |
| `oauth2` | `failed`/`revoked` | "Reconnect" → same as `null` flow |
| `api_key` | `null`/`revoked`/`failed` | Render form for `api_key_fields` → `PATCH` with `credentials` |
| `api_key` | `active` | Show tools + "Update credentials" + "Disconnect" |

The backend self-heals: every list/get call asks Composio for the truth and rewrites the local row if it drifts ([service.py:61](service.py#L61)). The UI does not need to reconcile manually.

## Flow 1 — Link an OAuth connector

```
User clicks "Connect Gmail"
  └─► POST /connectors/gmail/link
        ◄── { redirect_url, connected_account_id, status: "INITIATED" }
  └─► window.open(redirect_url)         // Composio handles OAuth
  └─► poll GET /connectors/gmail
        ◄── status flips "pending" → "active"; linked: true
  └─► UI swaps to tools/permissions view
```

## Flow 2 — Link an API-key connector

```
User fills api_key_fields form (e.g. Shopify { shop, access_token })
  └─► PATCH /connectors/shopify   body: { credentials: { shop, access_token } }
        ◄── ConnectorCatalogEntry with status: "active", linked: true
```

Missing required fields → `400` with `Missing credential fields: [...]`.

## Flow 3 — Edit tool permissions

```
User toggles GMAIL_SEND_EMAIL from "ask" → "allow"
  └─► PATCH /connectors/gmail
        body: { permissions: [{ slug: "GMAIL_SEND_EMAIL", policy: "allow" }] }
        ◄── updated ConnectorCatalogEntry
```

Permissions are upserts: send only what changed. Invalid `tool_slug` → `400 Not exposed tools of <slug>`.

## Flow 4 — Unlink

```
User clicks "Disconnect"
  └─► DELETE /connectors/gmail   ◄── 204
```

The row is removed; the next `GET` will show `linked: false`, `status: null`.

## Chat-side SSE prompts

The LLM calls connector tools through three meta-tools (`list_connectors`, `list_connector_tools`, `run_connector_tool` — see [catalog.py:104](catalog.py#L104)). When a model tries to run something that isn't ready, the chat SSE stream emits one of two events the UI must handle ([tool_factory.py:46](tool_factory.py#L46)):

### `tool_connect_prompt` — account not linked
```ts
{ connector_slug, display_name, auth_mode, tool_name, request_id }
```
Render a "Connect <display_name>" CTA inline in the assistant message. On click run **Flow 1** or **Flow 2**, then ask the user to resend.

### `tool_permission_prompt` — policy is `ask`
```ts
{ connector_slug, display_name, tool_name, request_id, suggested_args }
```
Render three buttons inline: **Allow**, **Block**, **Allow once**. The click should:
1. `PATCH /connectors/{connector_slug}` with `{ permissions: [{ slug: tool_name, policy }] }`
2. Tell the user to resend (or auto-resend the last message).

`allow_once` is one-shot — backend flips it back to `ask` after the next execute ([tool_factory.py:111](tool_factory.py#L111)).

## Error contract

| Status | When |
|---|---|
| `400` | Wrong auth mode for endpoint, missing api-key fields, unknown tool slug in permissions, bad policy value |
| `404` | Unknown connector slug, or `DELETE` on a connector that wasn't linked |
| `502` | Composio call failed (initiate / credential apply) — surface the message verbatim |

## Backend reference

- [router.py](router.py) — endpoints
- [service.py](service.py) — orchestration + Composio reconciliation
- [catalog.py](catalog.py) — supported connectors + LLM meta-tools
- [permissions.py](permissions.py) — runtime gate (`needs_connect` / `allow` / `block` / `ask`)
- [tool_factory.py](tool_factory.py) — gated execute path that emits the SSE prompts
- [models.py](models.py) — `UserConnectorAccount`, `UserConnectorPermission`, `ConnectorTool`
- [schemas.py](schemas.py) — request/response Pydantic models
