# Frontend Guide: Organization Connector Logic

This document is the FE-facing contract for connector management across personal accounts, organization catalog allowlists, org shared accounts, and team workspace connections.

Sources of truth in backend code:

- `services/connectors/router.py`
- `services/connectors/schemas.py`
- `services/connectors/service.py`
- `services/connectors/models.py`
- `services/organizations/router.py`
- `services/organizations/schemas.py`
- `services/organizations/service.py`
- `services/organizations/models.py`
- `services/organizations/dependencies.py`
- `services/organizations/roles.py`

All endpoints require the authenticated user JWT through `get_current_user`.

## Mental Model

There are four related but distinct connector concepts:

1. Personal connector
   - A connector linked by the current user.
   - API surface: `/connectors`.
   - Stored in `UserConnection`.
   - Used in solo chats and also wins over a team shared connector when both exist.

2. Organization connector catalog
   - The org-level allowlist of connector slugs that normal members can see/request/use.
   - API surface: `/organizations/{organization_id}/connectors/catalog`.
   - Stored in `OrganizationConnectorAccess`.
   - Admin controlled.

3. Organization shared account
   - A reusable account owned by the organization, such as "Support Gmail" or "Main Shopify Store".
   - API surface: `/organizations/{organization_id}/connectors/{slug}/accounts`.
   - Stored in `OrganizationConnectorAccount`.
   - Created/updated by org admins.
   - Can be attached to one or more approved team connector rows.

4. Team connector and team connection
   - A team connector is the approval row: pending, approved, or denied.
   - API surface: `/organizations/{organization_id}/teams/{team_id}/connectors`.
   - Stored in `TeamConnector`.
   - A team connection is the attached shared account plus permissions for an approved connector.
   - API surface: `/organizations/{organization_id}/teams/{team_id}/connections`.

Main flow:

```text
Admin enables connector in org catalog
  -> team member/editor requests connector for a team, or admin adds it directly
  -> admin approves team connector if needed
  -> admin creates an org shared account
  -> team editor/admin attaches sharedAccountId to the approved team connector
  -> team members can use it in team chat unless their own personal connector exists
```

## Roles And Visibility

Backend authorization is DB-driven, not Auth0-role-driven.

Role ladder:

- `owner`: all admin powers plus owner-only billing/payment actions.
- `admin`: org management, member management, connector catalog, team approvals, shared account management, all teams.
- `member`: baseline org member. Can act in teams only through project membership.
- `editor`: a member with `TeamEditor` grants. Can manage connections for the granted team.

Relevant gates:

- Org member: can read basic org/team data and request team or personal connector access where allowed.
- Org admin/owner: can list/update org connector catalog, review personal connector requests, approve/deny team connectors, create/update/delete org shared accounts.
- Org editor/admin/owner: can list org shared accounts and check connector blast radius.
- Team editor/admin/owner: can attach/detach team connections and edit team-level connector permissions.

Important role behavior:

- `require_organization_admin` allows owner and admin.
- `require_organization_editor` allows owner/admin and any team editor.
- `require_team_editor` allows owner/admin or editor of that specific team.
- Plain project members can request a team connector for a team they are affiliated with, but cannot attach shared accounts.

## Shared Types

### ConnectorCatalogEntry

Returned by personal connector list/get, org catalog, and team connections.

```json
{
  "slug": "gmail",
  "display_name": "Gmail",
  "auth_mode": "oauth2",
  "description": "Read and send Gmail messages",
  "tools": [
    { "slug": "GMAIL_FETCH_EMAILS", "policy": "ask" }
  ],
  "api_key_fields": [
    {
      "name": "api_key",
      "label": "API Key",
      "help": "Paste your API key",
      "secret": true,
      "required": true
    }
  ],
  "linked": false,
  "workspace_linked": false,
  "workspace_linked_by": null,
  "shared_account_id": null,
  "account_label": null,
  "account_identifier": null,
  "accounts": [],
  "org_enabled": true,
  "personal_access_status": "approved"
}
```

Field notes:

- `linked`: current user's personal connector is linked, or team shared slot is linked when returned from team connection endpoints.
- `workspace_linked`: a shared team account exists for this connector in the current view.
- `workspace_linked_by`: user id that linked the team/shared workspace account.
- `shared_account_id`: org shared account currently attached to the team connector, when present.
- `account_label`: admin-friendly label from the attached org shared account.
- `account_identifier`: best-effort real provider identity, such as email/login. Admin can override it.
- `accounts`: org shared accounts grouped under this connector. Admin/team connection UIs should use this list.
- `org_enabled`: whether the slug is enabled in the org catalog. Present in org/personal catalog views when an org membership applies.
- `personal_access_status`: `pending`, `approved`, `denied`, or `null`.

### ToolEntry

```json
{
  "slug": "GMAIL_FETCH_EMAILS",
  "policy": "ask"
}
```

Allowed policies:

- `allow`
- `block`
- `ask`
- `allow_once`

The backend also accepts connector wildcard policy keys internally, but the FE should normally send concrete tool slugs returned in `tools`.

### OrganizationConnectorAccountResponse

```json
{
  "id": "3dc39d72-2d7b-4e4e-a145-527f0b59a01e",
  "organization_id": "a9cf7a10-fd14-47c0-b934-a76bb5a6d0be",
  "connector_slug": "gmail",
  "account_label": "Support Gmail",
  "account_identifier": "support@example.com",
  "connected": true,
  "scope": "shared_team",
  "status": "active",
  "version": 2,
  "team_ids": [
    "60a06adb-bf3f-41e6-af90-c783a8817167"
  ],
  "linked_by_user_id": "auth0|owner",
  "created_at": "2026-06-17T14:00:00Z",
  "updated_at": "2026-06-17T14:05:00Z"
}
```

Field notes:

- `scope` is always `shared_team` for org shared accounts.
- `connected=false` means the account row exists but OAuth/API-key completion is not done.
- `status` is account lifecycle: `active`, `disabled`, or `expired`.
- `version` increments on every shared-account update. Use it with `expectedVersion` to avoid overwriting another admin's edit.
- `team_ids` tells the FE which teams currently use this account.

### LinkResponse

```json
{
  "connector_slug": "gmail",
  "redirect_url": "https://...",
  "shared_account_id": "3dc39d72-2d7b-4e4e-a145-527f0b59a01e"
}
```

Field notes:

- `redirect_url` present: FE should send user/admin to hosted OAuth/connect flow.
- `redirect_url=null`: no redirect is needed. This can mean already linked, or API-key credentials must be submitted by PATCH.
- `shared_account_id` is returned when creating an org shared account.

### TeamConnectorResponse

```json
{
  "team_id": "60a06adb-bf3f-41e6-af90-c783a8817167",
  "connector_slug": "gmail",
  "status": "pending",
  "requested_by_user_id": "auth0|member",
  "requested_by_name": "Ava Member",
  "requested_by_email": "ava@example.com",
  "note": "Needed for customer support",
  "created_at": "2026-06-17T14:00:00Z",
  "updated_at": "2026-06-17T14:00:00Z"
}
```

`status` values:

- `pending`
- `approved`
- `denied`

### PersonalConnectorRequestResponse

```json
{
  "id": "691389d6-b3df-498d-abee-2226c041765c",
  "organization_id": "a9cf7a10-fd14-47c0-b934-a76bb5a6d0be",
  "user_id": "auth0|member",
  "user_name": "Ava Member",
  "user_email": "ava@example.com",
  "connector_slug": "github",
  "status": "pending",
  "note": "I need this for deploy investigation",
  "requested_by_user_id": "auth0|member",
  "reviewed_by_user_id": null,
  "created_at": "2026-06-17T14:00:00Z",
  "updated_at": "2026-06-17T14:00:00Z"
}
```

## Personal Connector Endpoints

These endpoints are for the current user's personal connector account.

### GET `/connectors`

Lists connector catalog entries visible to the current user.

Response:

```json
{
  "connectors": [
    {
      "slug": "gmail",
      "display_name": "Gmail",
      "auth_mode": "oauth2",
      "description": "",
      "tools": [],
      "api_key_fields": [],
      "linked": true,
      "workspace_linked": true,
      "workspace_linked_by": "auth0|admin",
      "shared_account_id": "3dc39d72-2d7b-4e4e-a145-527f0b59a01e",
      "account_label": "Support Gmail",
      "account_identifier": "support@example.com",
      "accounts": [],
      "org_enabled": true,
      "personal_access_status": null
    }
  ]
}
```

Visibility rules:

- Non-org users see the full active connector catalog.
- Org admins/owners see the full active catalog.
- Ordinary org members/editors see only org-enabled slugs plus approved personal exceptions.
- Shared team connections are included as workspace fallback metadata.

Side effect:

- For OAuth connectors, listing can reconcile provider-active accounts into local `UserConnection` rows after the hosted connect flow completes. This is the FE polling point after redirect.

Cache:

- The backend caches list/get for 10 seconds per user. Link/update/delete clears that user's connector cache.

### GET `/connectors/{slug}`

Returns one visible `ConnectorCatalogEntry`.

Common errors:

- `404`: unknown connector or hidden from this org member.

### POST `/connectors/{slug}/link`

Starts personal link for OAuth/Nango connectors.

Request body:

```json
{
  "init_data": {
    "subdomain": "my-shop",
    "client_id": "optional-byoa-client-id",
    "client_secret": "optional-byoa-client-secret"
  }
}
```

Body can be omitted for most OAuth connectors.

Response:

```json
{
  "connector_slug": "shopify",
  "redirect_url": "https://hosted-connect.example/...",
  "shared_account_id": null
}
```

FE behavior:

- If `redirect_url` is non-null, navigate the user there.
- After returning from provider/hosted flow, poll `GET /connectors/{slug}` or `GET /connectors` until `linked=true`.
- If `redirect_url=null`, treat as already connected.

Validation:

- If the connector declares required `api_key_fields` for OAuth init, send those values in `init_data`.
- Missing init fields returns `400`.
- API-key connectors cannot use this endpoint unless they are Nango-hosted. For regular API-key connectors, use `PATCH /connectors/{slug}` with `credentials`.

Org member gate:

- Plain org members/editors can link personal accounts only when the slug is org-enabled or they have an approved personal exception.
- Admins/owners and non-members can link any active connector.

### PATCH `/connectors/{slug}`

Updates personal credentials and/or tool permission policies.

Request body:

```json
{
  "credentials": {
    "api_key": "secret-value"
  },
  "permissions": [
    { "slug": "GMAIL_FETCH_EMAILS", "policy": "allow" },
    { "slug": "GMAIL_SEND_EMAIL", "policy": "ask" }
  ]
}
```

Response: `ConnectorCatalogEntry`.

Rules:

- Sending `credentials` links an API-key connector.
- OAuth connectors reject credentials with `400`.
- Credentials are validated against required `api_key_fields`.
- Invalid tool slugs or policies return `400`.
- For custom connectors, credentials are stored encrypted in SouvenirAI.
- For Composio connectors, credentials are stored in Composio and local row stores the connected account id.

### DELETE `/connectors/{slug}`

Unlinks the current user's personal connector.

Response:

- `204 No Content`

Common errors:

- `404`: no linked account for slug or unknown connector.
- `502`: provider-side disconnect failed.

## Organization Catalog Endpoints

These endpoints control which connectors are enabled for the org.

### GET `/organizations/{organization_id}/connectors/catalog`

Admin-only.

Returns a list of `ConnectorCatalogEntry`.

Response example:

```json
[
  {
    "slug": "gmail",
    "display_name": "Gmail",
    "auth_mode": "oauth2",
    "description": "",
    "tools": [],
    "api_key_fields": [],
    "linked": false,
    "workspace_linked": false,
    "workspace_linked_by": null,
    "shared_account_id": null,
    "account_label": null,
    "account_identifier": null,
    "accounts": [
      {
        "id": "3dc39d72-2d7b-4e4e-a145-527f0b59a01e",
        "organization_id": "a9cf7a10-fd14-47c0-b934-a76bb5a6d0be",
        "connector_slug": "gmail",
        "account_label": "Support Gmail",
        "account_identifier": "support@example.com",
        "connected": true,
        "scope": "shared_team",
        "status": "active",
        "version": 1,
        "team_ids": [],
        "linked_by_user_id": "auth0|owner",
        "created_at": "2026-06-17T14:00:00Z",
        "updated_at": "2026-06-17T14:00:00Z"
      }
    ],
    "org_enabled": true,
    "personal_access_status": null
  }
]
```

FE usage:

- Render all active connectors for admins.
- Use `org_enabled` for the org-level enable toggle.
- Use `accounts` for the shared account management table.

### PUT `/organizations/{organization_id}/connectors/catalog`

Admin-only.

Replaces the org connector allowlist.

Request body:

```json
{
  "connectorSlugs": ["gmail", "slack", "shopify"]
}
```

Response: updated list of `ConnectorCatalogEntry`.

Rules:

- Request can also use `connector_slugs`, but FE should prefer `connectorSlugs`.
- Duplicates are de-duped preserving first occurrence.
- Unknown or inactive slugs return `400`.
- Disabling a slug removes it from the org allowlist. Existing accounts/rows are not deleted automatically, but approvals/use paths require the slug to still be org-enabled.

### GET `/organizations/{organization_id}/connectors/{slug}/used-by`

Editor-or-admin.

Returns teams that would lose this connector if it is removed/disabled.

Response:

```json
[
  {
    "surface": "team",
    "id": "60a06adb-bf3f-41e6-af90-c783a8817167",
    "name": "Growth"
  }
]
```

FE usage:

- Show blast radius before disabling a connector or deleting shared account flows.

## Organization Shared Account Endpoints

Org shared accounts are created by admins and then attached to team connections.

### GET `/organizations/{organization_id}/connectors/{slug}/accounts`

Editor-or-admin.

Lists shared accounts for a connector.

Response: `OrganizationConnectorAccountResponse[]`.

Side effect:

- For OAuth connectors, this can reconcile hosted connect completion into the pending account row. This is the FE polling point after an admin returns from OAuth.

Common errors:

- `404`: unknown connector.

### POST `/organizations/{organization_id}/connectors/{slug}/accounts`

Admin-only.

Creates a shared account row and, for OAuth/Nango connectors, starts hosted linking.

Request body:

```json
{
  "accountLabel": "Support Gmail",
  "accountIdentifier": "support@example.com",
  "init_data": {
    "subdomain": "my-shop"
  }
}
```

Fields:

- `accountLabel`: required, 1 to 255 chars.
- `accountIdentifier`: optional, max 255 chars. Admin-entered real identity, can later be replaced by provider-detected identity.
- `init_data`: optional fields required by certain OAuth connectors.

Response for OAuth:

```json
{
  "connector_slug": "gmail",
  "redirect_url": "https://hosted-connect.example/...",
  "shared_account_id": "3dc39d72-2d7b-4e4e-a145-527f0b59a01e"
}
```

Response for API-key connector:

```json
{
  "connector_slug": "fireflies",
  "redirect_url": null,
  "shared_account_id": "3dc39d72-2d7b-4e4e-a145-527f0b59a01e"
}
```

Rules:

- The connector slug must exist.
- The slug must be enabled in the org catalog.
- OAuth with required init fields validates before creating the pending row.
- API-key connectors return a pending shared account with `connected=false`; FE must PATCH credentials next.
- Nango connectors return a connect-session URL and create the pending row.

FE behavior:

- Store `shared_account_id`.
- If `redirect_url` exists, navigate admin to it.
- After return, poll `GET /organizations/{organization_id}/connectors/{slug}/accounts` until that account has `connected=true`.
- For API-key connectors, show credential inputs from the connector's `api_key_fields`, then PATCH the account with `credentials`.

### PATCH `/organizations/{organization_id}/connectors/accounts/{account_id}`

Admin-only.

Updates shared account metadata, credentials, or lifecycle status.

Request body:

```json
{
  "accountLabel": "Support Gmail",
  "accountIdentifier": "support@example.com",
  "credentials": {
    "api_key": "secret-value"
  },
  "status": "active",
  "expectedVersion": 2
}
```

All fields are optional. Send only what changed.

Response: `OrganizationConnectorAccountResponse`.

Rules:

- `status` can be `active`, `disabled`, or `expired`.
- `expectedVersion` is optional. When present, backend updates only if the row is still at that version.
- Version mismatch returns `409` with detail: `This shared account was changed by someone else. Reload it and retry.`
- Updating metadata/status and credentials in one request consumes the version guard once; later writes are part of the same request.
- API-key credentials validate required fields.
- OAuth accounts reject credentials with `400`; create a replacement shared account through `POST /organizations/{organization_id}/connectors/{slug}/accounts`, attach it to teams, then delete or disable the old account.
- Updating an org account syncs attached team rows with the latest `connected_account_id`.

FE behavior:

- Include `expectedVersion` for admin edit forms.
- On `409`, refetch the account/list and show a retry message.
- If `status=disabled` or `expired`, execution fallback ignores that shared account.

### DELETE `/organizations/{organization_id}/connectors/accounts/{account_id}`

Admin-only.

Deletes a shared account.

Response:

- `204 No Content`

Rules:

- Before deleting, backend clears all team connections pointing at this account.
- The team connector approval rows remain; only the attached shared account columns are cleared.

Common errors:

- `404`: shared account not found.

## Personal Access Request Endpoints

These are for ordinary org members who need a personal connector outside the org allowlist.

### POST `/organizations/{organization_id}/connectors/{slug}/personal-request`

Org member.

Creates or updates the current user's personal connector access request.

Request body:

```json
{
  "note": "I need GitHub for deployment debugging"
}
```

Body can be omitted.

Response: `PersonalConnectorRequestResponse`.

Rules:

- Unknown connector returns `404`.
- Repeated requests upsert the same member/slug request.

### GET `/organizations/{organization_id}/connectors/personal-requests`

Admin-only.

Lists personal connector access requests for the org.

Response: `PersonalConnectorRequestResponse[]`.

### PATCH `/organizations/{organization_id}/connectors/personal-requests/{request_id}`

Admin-only.

Reviews a personal connector request.

Request body:

```json
{
  "status": "approved"
}
```

Response: `PersonalConnectorRequestResponse`.

Rules:

- `status` is `pending`, `approved`, or `denied`.
- `404` if request is not in this org.
- Approved personal exceptions make the slug visible/linkable to that member even if not org-enabled.

## Team Connector Approval Endpoints

Team connector approval controls whether a connector is allowed for a team. It does not necessarily mean an account is attached yet.

### GET `/organizations/{organization_id}/teams/{team_id}/connectors`

Org member who can act in the team.

Response: `TeamConnectorResponse[]`.

Rules:

- User must be affiliated with the team through admin/owner role, team editor grant, or project membership under the team.

### POST `/organizations/{organization_id}/teams/{team_id}/connectors`

Org member who can act in the team.

Requests or creates team connector approval.

Request body:

```json
{
  "slug": "gmail",
  "note": "Needed for customer support triage"
}
```

Response: `TeamConnectorResponse`.

Rules:

- Unknown connector returns `404`.
- Connector must be enabled in org catalog, otherwise `403`.
- Admin/owner request is approved immediately.
- Member/editor request is `pending`.
- If an existing row is not denied, a non-admin duplicate request returns `409`.
- A denied row can be requested again.
- Pending requests trigger best-effort email notification to org owner.

### PATCH `/organizations/{organization_id}/teams/{team_id}/connectors/{slug}`

Admin-only.

Approves, denies, or moves a team connector request back to pending.

Request body:

```json
{
  "status": "approved"
}
```

Response: `TeamConnectorResponse`.

Rules:

- `status` is `pending`, `approved`, or `denied`.
- Approving requires the slug to still be enabled in the org catalog.
- Unknown team returns `404`.
- Missing connector request returns `404`.

### DELETE `/organizations/{organization_id}/teams/{team_id}/connectors/{slug}`

Admin-only.

Deletes the team connector approval row.

Response:

- `204 No Content`

Rules:

- This removes approval and any attached connection data because both facets live on `TeamConnector`.

## Team Connection Endpoints

Team connections are the shared account attachment and team-level permissions for approved connectors.

### GET `/organizations/{organization_id}/teams/{team_id}/connections`

Org member who can act in the team.

Returns `ConnectorCatalogEntry[]` for approved and org-enabled connector slugs.

Response example:

```json
[
  {
    "slug": "gmail",
    "display_name": "Gmail",
    "auth_mode": "oauth2",
    "description": "",
    "tools": [
      { "slug": "GMAIL_FETCH_EMAILS", "policy": "allow" }
    ],
    "api_key_fields": [],
    "linked": true,
    "workspace_linked": true,
    "workspace_linked_by": "auth0|editor",
    "shared_account_id": "3dc39d72-2d7b-4e4e-a145-527f0b59a01e",
    "account_label": "Support Gmail",
    "account_identifier": "support@example.com",
    "accounts": [
      {
        "id": "3dc39d72-2d7b-4e4e-a145-527f0b59a01e",
        "organization_id": "a9cf7a10-fd14-47c0-b934-a76bb5a6d0be",
        "connector_slug": "gmail",
        "account_label": "Support Gmail",
        "account_identifier": "support@example.com",
        "connected": true,
        "scope": "shared_team",
        "status": "active",
        "version": 2,
        "team_ids": [
          "60a06adb-bf3f-41e6-af90-c783a8817167"
        ],
        "linked_by_user_id": "auth0|owner",
        "created_at": "2026-06-17T14:00:00Z",
        "updated_at": "2026-06-17T14:05:00Z"
      }
    ],
    "org_enabled": null,
    "personal_access_status": null
  }
]
```

Visibility details:

- Approved team slugs are intersected with org-enabled slugs.
- Team editors/admins get `accounts` populated so they can attach shared accounts.
- Non-editing team members may see connection state, but `accounts` can be empty because they cannot manage attachments.

### POST `/organizations/{organization_id}/teams/{team_id}/connections/{slug}/link`

Team editor/admin.

Legacy endpoint. It currently always returns `400`.

Response detail:

```text
Team links now attach an existing org shared account. Create the shared account at the organization level, then PATCH the team connection with sharedAccountId.
```

FE should not use this for new flows.

### PATCH `/organizations/{organization_id}/teams/{team_id}/connections/{slug}`

Team editor/admin.

Attaches an org shared account and/or updates team-level permissions.

Request body:

```json
{
  "sharedAccountId": "3dc39d72-2d7b-4e4e-a145-527f0b59a01e",
  "permissions": [
    { "slug": "GMAIL_FETCH_EMAILS", "policy": "allow" },
    { "slug": "GMAIL_SEND_EMAIL", "policy": "ask" }
  ]
}
```

Response: `ConnectorCatalogEntry`.

Rules:

- Team must exist in the org.
- Caller must be admin/owner or editor of that specific team.
- Connector must be approved for this team.
- Connector must be enabled in org catalog.
- `sharedAccountId` must exist.
- Shared account connector slug must match the path slug.
- Shared account must have `connected=true`; pending accounts cannot attach.
- `credentials` are rejected with `400`; update credentials on the org shared account instead.
- Invalid tool slug or policy returns `400`.

FE behavior:

- Populate the account picker from `GET /teams/{team_id}/connections` entry `accounts` or from `GET /connectors/{slug}/accounts`.
- Disable attach button for accounts with `connected=false`, `status!="active"`, or mismatched slug.
- After PATCH, refresh team connections.

### DELETE `/organizations/{organization_id}/teams/{team_id}/connections/{slug}`

Team editor/admin.

Clears the attached shared account from the team connector.

Response:

- `204 No Content`

Rules:

- Approval row remains.
- If no linked team account exists, returns `404`.

## Execution Semantics In Chat

Frontend usually does not execute connector tools directly from these management endpoints, but the management state determines what Brain can use.

For a team chat:

- Backend resolves team billing/connector context through the team id.
- Allowed connector slugs are approved team connector slugs intersected with org-enabled slugs.
- A user's personal connector for a slug wins first.
- If no personal connector exists, an active shared team connection can be used.
- Shared fallback requires:
  - `TeamConnector.status == approved`
  - `TeamConnector.organization_connector_account_id` present
  - `TeamConnector.connected_account_id` present
  - linked `OrganizationConnectorAccount.connected_account_id` present
  - linked org account `status == active`
  - user can act in the team

For a solo chat by an org member/editor:

- Admins/owners and non-members are unrestricted by org catalog.
- Ordinary members/editors are limited to org-enabled connectors plus approved personal exceptions.

The system prompt block for Brain is built from:

- personal `UserConnection` rows
- active shared team connections available to the user
- optional persona/team allowlists and denylists

## Recommended FE Workflows

### Admin: Enable Connector For Organization

1. `GET /organizations/{organization_id}/connectors/catalog`
2. Toggle `org_enabled` in UI.
3. Send the full enabled slug list to `PUT /organizations/{organization_id}/connectors/catalog`.
4. Refresh catalog.

Payload:

```json
{
  "connectorSlugs": ["gmail", "slack"]
}
```

### Admin: Create OAuth Shared Account

1. `GET /organizations/{organization_id}/connectors/catalog`.
2. Read connector `api_key_fields`; collect any required `init_data`.
3. `POST /organizations/{organization_id}/connectors/{slug}/accounts`.
4. Navigate to `redirect_url`.
5. After return, poll `GET /organizations/{organization_id}/connectors/{slug}/accounts`.
6. Wait for the returned account `connected=true`.

### Admin: Create API-Key Shared Account

1. `POST /organizations/{organization_id}/connectors/{slug}/accounts` with `accountLabel`.
2. Response has `redirect_url=null` and `shared_account_id`.
3. Show credential form from connector `api_key_fields`.
4. `PATCH /organizations/{organization_id}/connectors/accounts/{account_id}` with `credentials` and `expectedVersion`.
5. Refresh accounts and confirm `connected=true`.

### Team Member: Request Connector For Team

1. `GET /organizations/{organization_id}/teams/{team_id}/connectors`.
2. If desired slug is missing or denied, send `POST /organizations/{organization_id}/teams/{team_id}/connectors`.
3. Show pending state until admin approves.

### Admin: Approve Team Connector

1. `GET /organizations/{organization_id}/teams/{team_id}/connectors`.
2. `PATCH /organizations/{organization_id}/teams/{team_id}/connectors/{slug}` with `{"status":"approved"}`.
3. Team editor/admin can now attach a shared account.

### Team Editor: Attach Shared Account To Team

1. `GET /organizations/{organization_id}/teams/{team_id}/connections`.
2. Find connector entry by slug.
3. Pick an account from `entry.accounts`.
4. `PATCH /organizations/{organization_id}/teams/{team_id}/connections/{slug}` with `sharedAccountId`.
5. Refresh connections and verify `workspace_linked=true`.

### Member: Request Personal Connector Exception

1. If connector is hidden or linking returns a 403 org gate, show "Request personal access".
2. `POST /organizations/{organization_id}/connectors/{slug}/personal-request` with optional note.
3. Admin reviews through `GET /organizations/{organization_id}/connectors/personal-requests`.
4. Once approved, member's `GET /connectors` includes the slug and `personal_access_status="approved"`.

## Error Handling Matrix

Common HTTP statuses:

- `400`: invalid payload, missing init fields, wrong auth mode, invalid tool policy, pending shared account attach attempt, legacy team link endpoint.
- `403`: user lacks required org/team role, connector not enabled in org catalog, team connector not approved.
- `404`: org/team/account/request/connector not found, or connector hidden from current member.
- `409`: duplicate non-admin team connector request or stale shared account `expectedVersion`.
- `502`: provider integration failure from Composio/Nango.

Important error details to surface:

```text
{slug} is not enabled in this organization's connector catalog.
```

```text
{slug} is not approved for this team - approve the connector first.
```

```text
Shared account is not connected yet
```

```text
This shared account was changed by someone else. Reload it and retry.
```

```text
Team links now attach an existing org shared account. Create the shared account at the organization level, then PATCH the team connection with sharedAccountId.
```

## UI State Checklist

For connector cards:

- Show `display_name`, `description`, and auth mode.
- Show personal state from `linked`.
- Show workspace fallback state from `workspace_linked`, `account_label`, and `account_identifier`.
- For org admins, show org enablement from `org_enabled`.
- For members, show request state from `personal_access_status`.

For org shared account table:

- Primary label: `account_label`.
- Secondary identity: `account_identifier`.
- Connection state: `connected`.
- Lifecycle: `status`.
- Attachment count/list: `team_ids`.
- Stale edit guard: `version`.

For team connection page:

- Show approved connector entries from `GET /teams/{team_id}/connections`.
- Show attached account via `shared_account_id`.
- Show available attach choices from `accounts`.
- Disable account attach until account is connected and active.
- Let team editor/admin update `permissions`.

For team connector approval page:

- Use `GET /teams/{team_id}/connectors`.
- Show `pending`, `approved`, `denied`.
- Admin can PATCH status.
- Members/editors can POST requests.

## Field Naming Notes

Most response fields are snake_case because schemas use Python field names. Some request fields also accept camelCase aliases:

- `connectorSlugs` for org catalog update
- `accountLabel`
- `accountIdentifier`
- `sharedAccountId`
- `expectedVersion`
- `userId`, `teamId`, and similar org schemas outside connector management

For connector management FE code, prefer the camelCase request aliases above where they exist, and read response keys as returned by the API/OpenAPI client.

## Endpoint Summary

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/connectors` | authenticated | List current user's visible connectors |
| GET | `/connectors/{slug}` | authenticated | Get one visible connector |
| POST | `/connectors/{slug}/link` | authenticated plus org gate | Start personal OAuth/Nango link |
| PATCH | `/connectors/{slug}` | authenticated plus org gate for credentials | Update personal credentials or permissions |
| DELETE | `/connectors/{slug}` | authenticated | Unlink personal connector |
| GET | `/organizations/{organization_id}/connectors/catalog` | admin | List org connector catalog |
| PUT | `/organizations/{organization_id}/connectors/catalog` | admin | Replace org connector allowlist |
| GET | `/organizations/{organization_id}/connectors/{slug}/used-by` | editor/admin | Show teams using connector |
| GET | `/organizations/{organization_id}/connectors/{slug}/accounts` | editor/admin | List org shared accounts for slug |
| POST | `/organizations/{organization_id}/connectors/{slug}/accounts` | admin | Create shared account and maybe start link |
| PATCH | `/organizations/{organization_id}/connectors/accounts/{account_id}` | admin | Update shared account metadata, credentials, status |
| DELETE | `/organizations/{organization_id}/connectors/accounts/{account_id}` | admin | Delete shared account and clear team attachments |
| POST | `/organizations/{organization_id}/connectors/{slug}/personal-request` | org member | Request personal access |
| GET | `/organizations/{organization_id}/connectors/personal-requests` | admin | List personal access requests |
| PATCH | `/organizations/{organization_id}/connectors/personal-requests/{request_id}` | admin | Review personal access request |
| GET | `/organizations/{organization_id}/teams/{team_id}/connectors` | team-affiliated | List team connector approvals |
| POST | `/organizations/{organization_id}/teams/{team_id}/connectors` | team-affiliated | Request/add team connector |
| PATCH | `/organizations/{organization_id}/teams/{team_id}/connectors/{slug}` | admin | Approve/deny team connector |
| DELETE | `/organizations/{organization_id}/teams/{team_id}/connectors/{slug}` | admin | Delete team connector row |
| GET | `/organizations/{organization_id}/teams/{team_id}/connections` | team-affiliated | List approved connector connection entries |
| POST | `/organizations/{organization_id}/teams/{team_id}/connections/{slug}/link` | team editor/admin | Legacy, returns 400 |
| PATCH | `/organizations/{organization_id}/teams/{team_id}/connections/{slug}` | team editor/admin | Attach shared account or update permissions |
| DELETE | `/organizations/{organization_id}/teams/{team_id}/connections/{slug}` | team editor/admin | Clear team shared connection |
