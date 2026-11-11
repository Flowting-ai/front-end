# Backend Requirements — Missing / To Create / To Update

Tracks every backend gap identified during the organizations module FE audit.
Cross-referenced against `organizations-frontend-guide.md` and `openapi/openapi.yaml`.

**Legend**
- 🔴 **Missing** — endpoint does not exist in the backend at all; must be created from scratch
- 🟡 **Incomplete** — endpoint exists but is missing a capability the FE needs
- 🟢 **Exists** — endpoint is implemented; listed here only for context where a related gap exists

---

## Table of Contents

1. [Connector Catalog (§8)](#connector-catalog-8)
2. [Personal Connector Requests (§10)](#personal-connector-requests-10)
3. [Credit Overflow — List endpoint (§17)](#credit-overflow--list-endpoint-17)

---

## Connector Catalog (§8)

The org allow-list that controls which connector slugs members may use at all. Nothing downstream (team approvals, shared accounts, personal requests) works for a slug that isn't in the catalog. Both catalog management endpoints are absent from the OpenAPI spec.

| Status | Method | Path | Gate | Purpose |
|--------|--------|------|------|---------|
| 🔴 Missing | `GET` | `/organizations/{organization_id}/connectors/catalog` | admin | Return every active connector with an `org_enabled` flag and any org shared accounts grouped under it |
| 🔴 Missing | `PUT` | `/organizations/{organization_id}/connectors/catalog` | admin | Full-replace the enabled connector slug set for the org |
| 🟢 Exists | `GET` | `/organizations/{organization_id}/connectors/{slug}/used-by` | editor | Blast-radius preview before disabling a slug — already implemented as `getConnectorUsedBy` |

### 8.1 GET /organizations/{organization_id}/connectors/catalog

**Request:** none (path param only)

**Response `200` — `ConnectorCatalogEntry[]`:**
```json
[
  {
    "slug": "shopify",
    "display_name": "Shopify",
    "auth_mode": "oauth2",
    "description": "Connect your Shopify store",
    "tools": [
      { "slug": "SHOPIFY_PULL_ORDERS", "policy": "ask" }
    ],
    "api_key_fields": [
      { "name": "subdomain", "label": "Store subdomain", "secret": false, "required": true }
    ],
    "linked": false,
    "org_enabled": true,
    "accounts": [ /* OrganizationConnectorAccountResponse[] — see §9 */ ]
  }
]
```

**Key fields:**
| Field | Type | Notes |
|-------|------|-------|
| `slug` | `string` | Connector identifier (e.g. `"shopify"`) |
| `display_name` | `string` | Human-readable name |
| `auth_mode` | `"oauth2" \| "api_key"` | Determines which connection flow to use |
| `description` | `string` | Short description shown in UI |
| `tools` | `{ slug, policy }[]` | Available tool actions for this connector |
| `api_key_fields` | `{ name, label, secret, required }[]` | Fields needed for api_key connectors; empty for oauth2 |
| `linked` | `boolean` | Whether the caller has a personal connection |
| `org_enabled` | `boolean` | Whether this slug is in the org's allow-list |
| `accounts` | `OrganizationConnectorAccountResponse[]` | Shared accounts scoped to this org for this slug |

**Errors:**
| Code | Condition |
|------|-----------|
| `403` | Caller is not an admin |
| `404` | Organization not found |

---

### 8.2 PUT /organizations/{organization_id}/connectors/catalog

**Request — `UpdateConnectorCatalogRequest`:**
```json
{ "connectorSlugs": ["gmail", "shopify", "slack"] }
```

| Field | Type | Notes |
|-------|------|-------|
| `connectorSlugs` | `string[]` | Complete desired set of enabled slugs; full-replace (not a patch) |

**Behaviour:**
- Replaces the org's enabled connector set entirely — slugs present in the old list but absent from the new list are **disabled**.
- Disabling a slug does **not** delete existing team approvals or shared accounts, but those slugs become inert on the chat path until re-enabled.
- Call `GET /connectors/{slug}/used-by` first to surface blast-radius warnings in the UI.

**Response `200` — `ConnectorCatalogEntry[]`** (the refreshed full catalog, same shape as 8.1)

**Errors:**
| Code | Condition |
|------|-----------|
| `400` | One or more slugs are unknown or inactive — `"Unknown or inactive connectors: gmail, foo"` |
| `403` | Caller is not an admin |

---

## Personal Connector Requests (§10)

Allows a member to request personal (non-shared, solo-turn) access to a connector that isn't broadly enabled. Admins review and approve or deny. All three endpoints are absent from the OpenAPI spec.

| Status | Method | Path | Gate | Purpose |
|--------|--------|------|------|---------|
| 🔴 Missing | `POST` | `/organizations/{organization_id}/connectors/{slug}/personal-request` | member | Submit or re-submit a personal access request |
| 🔴 Missing | `GET` | `/organizations/{organization_id}/connectors/personal-requests` | admin | List all personal requests for the org (admin review queue) |
| 🔴 Missing | `PATCH` | `/organizations/{organization_id}/connectors/personal-requests/{request_id}` | admin | Approve, deny, or reset a personal request |

**`PersonalConnectorRequestResponse` shape (used by all three):**
```json
{
  "id": "req-90…",
  "organization_id": "8f2c…",
  "user_id": "auth0|member456",
  "user_name": "Sam Rivera",
  "user_email": "sam@acme.com",
  "connector_slug": "gmail",
  "status": "pending",
  "note": "Need this for outreach",
  "requested_by_user_id": "auth0|member456",
  "reviewed_by_user_id": null,
  "created_at": "2026-06-17T12:00:00",
  "updated_at": "2026-06-17T12:00:00"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` (UUID) | Request identifier |
| `organization_id` | `string` (UUID) | |
| `user_id` | `string` (Auth0 sub) | The member the request is for |
| `user_name` / `user_email` | `string` | Display info for admin queue |
| `connector_slug` | `string` | The connector being requested |
| `status` | `"pending" \| "approved" \| "denied"` | |
| `note` | `string \| null` | Optional note from the member |
| `requested_by_user_id` | `string` (Auth0 sub) | Usually same as `user_id` |
| `reviewed_by_user_id` | `string \| null` | Set when admin acts |
| `created_at` / `updated_at` | ISO-8601 | |

---

### 10.1 POST /organizations/{organization_id}/connectors/{slug}/personal-request

**Gate:** any org member

**Request — `PersonalConnectorRequestBody`** (optional body):
```json
{ "note": "Need this for outreach" }
```

**Behaviour:**
- Creates a new request with `status: "pending"`.
- **Upserts** — re-requesting the same slug replaces the existing row (allows a denied member to re-apply after being denied). No `409`.
- `404` if the connector slug is unknown.

**Response `201` — `PersonalConnectorRequestResponse`**

**Errors:**
| Code | Condition |
|------|-----------|
| `404` | Unknown connector slug |
| `403` | Caller is not a member of the org |

---

### 10.2 GET /organizations/{organization_id}/connectors/personal-requests

**Gate:** admin

**Query params:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | `"pending" \| "approved" \| "denied"` | none (return all) | Filter by status — FE will use `pending` for the review queue |
| `limit` | `integer` | `100` | Pagination |
| `offset` | `integer` | `0` | Pagination |

**Response `200` — `PersonalConnectorRequestResponse[]`**

**Errors:**
| Code | Condition |
|------|-----------|
| `403` | Caller is not an admin |

---

### 10.3 PATCH /organizations/{organization_id}/connectors/personal-requests/{request_id}

**Gate:** admin

**Request — `ReviewPersonalConnectorRequest`:**
```json
{ "status": "approved" }
```

| Field | Type | Notes |
|-------|------|-------|
| `status` | `"approved" \| "denied" \| "pending"` | `pending` resets a prior decision |

**Behaviour on `approved`:**
- Widens that member's solo-turn connector allow-list: the effective set becomes `org_enabled_slugs ∪ approved_personal_slugs`.
- Admins and owners are unrestricted regardless.

**Response `200` — `PersonalConnectorRequestResponse`** (with `reviewed_by_user_id` set)

**Errors:**
| Code | Condition |
|------|-----------|
| `404` | Request not found or not in this org |
| `403` | Caller is not an admin |

---

## Credit Overflow — List Endpoint (§17)

The **approve** endpoint (`POST /organizations/{id}/overflow/{rid}/approve`) already exists in the spec and is implemented. The gap is that admins have **no way to discover open request IDs** — there is no list endpoint. Without it the approve action is unreachable from the frontend.

| Status | Method | Path | Gate | Purpose |
|--------|--------|------|------|---------|
| 🔴 Missing | `GET` | `/organizations/{organization_id}/overflow` | admin | List overflow requests for the org, filterable by status |
| 🟢 Exists | `POST` | `/organizations/{organization_id}/teams/{team_id}/overflow` | team editor | Submit an overflow request (already implemented) |
| 🟢 Exists | `POST` | `/organizations/{organization_id}/overflow/{request_id}/approve` | admin | Approve a request and raise the member's cap (already implemented, but unreachable without the list) |

### GET /organizations/{organization_id}/overflow

**Gate:** admin

**Query params:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | `"open" \| "resolved"` | none (return all) | FE will use `open` for the pending queue |
| `limit` | `integer` | `100` | |
| `offset` | `integer` | `0` | |

**Response `200` — `OverflowResponse[]`:**
```json
[
  {
    "id": "ovf-bb…",
    "team_id": "11…",
    "requested_by_user_id": "auth0|member456",
    "requested_by_name": "Sam Rivera",
    "requested_by_email": "sam@acme.com",
    "amount": 50.0,
    "note": "Big campaign week",
    "status": "open",
    "created_at": "2026-06-17T12:00:00"
  }
]
```

**Errors:**
| Code | Condition |
|------|-----------|
| `403` | Caller is not an admin |
| `404` | Organization not found |

**Why this unblocks the FE:**
The admin approval flow is: list open requests → display requester name, team, amount, note → admin enters grant amount (defaults to requested amount) → call `POST …/overflow/{id}/approve`. Without this list the flow cannot start.

---

## Summary

| # | Endpoint | Status | Unblocks |
|---|----------|--------|---------|
| 1 | `GET /organizations/{id}/connectors/catalog` | 🔴 Missing | Catalog management UI (§8) |
| 2 | `PUT /organizations/{id}/connectors/catalog` | 🔴 Missing | Enable/disable connectors UI (§8) |
| 3 | `POST /organizations/{id}/connectors/{slug}/personal-request` | 🔴 Missing | Member request flow (§10) |
| 4 | `GET /organizations/{id}/connectors/personal-requests` | 🔴 Missing | Admin review queue (§10) |
| 5 | `PATCH /organizations/{id}/connectors/personal-requests/{request_id}` | 🔴 Missing | Approve/deny personal requests (§10) |
| 6 | `GET /organizations/{id}/overflow` | 🔴 Missing | Admin overflow approval UI (§17) |
