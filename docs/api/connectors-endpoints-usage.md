# Connector Endpoints — Frontend Usage Map

Cross-references every "connector" backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), and [`projects-endpoints-usage.md`](./projects-endpoints-usage.md).

This doc covers 15 endpoints: 5 personal-connector + 10 org-connector. The 4 persona-version-connector endpoints (block/unblock, connector-hints, bulk connectors PUT) are **not** repeated here — see [`persona-endpoints-usage.md`](./persona-endpoints-usage.md#f-version-connectors) §F. **13 of 15 are actively used; 2 are dead** (one imported but never called, one built with no UI ever wired to it).

Personal-connector wrappers live in `src/lib/api/connectors.ts`; org-connector wrappers live in `src/lib/api/org-connectors.ts` — except the catalog GET, which lives in `connectors.ts` alongside the personal wrappers despite being an org-nested path (worth knowing if you go looking for it in the "wrong" file). The main UI surface is `src/app/(app)/connectors/page.tsx` (org connectors: Org Access + Shared Accounts tabs) and `src/app/(app)/settings/(shell)/connectors/page.tsx` (personal connectors). The org page keeps its approval-status index in an inline `OrgConnectorStatusContext` defined in the page file itself, not a separate context module.

---

## Personal connectors

### `GET /connectors` (List Connectors)
- **`config.ts`**: `CONNECTORS_ENDPOINT`
- **Wrapper**: `listConnectors()` (`connectors.ts`, 30s cache + in-flight dedupe; also populates the catalog lookup used by `resolveConnector`/`resolveConnectors`)
- **Used by**:
  - `settings/(shell)/connectors/page.tsx` — populating the personal "My connectors" / "Available" grid.
  - `connectors/page.tsx` — the org page's catalog source for **non-admin** members (admins use the org catalog instead — see below).
  - `brain/page.tsx` — resolving slugs to display name/logo/connected-status for the Brain chat's context-rail connector snapshot.
  - `agent/configure/components/ConnectorsTab.tsx` — loading the catalog to build the persona's connector chip list (combined with the version's blocked-connector list, documented in the persona doc).
- **Note**: also called from `ConnectorTogglesPanel.tsx`, but that whole component is an orphan never rendered anywhere (already flagged in the persona doc) — doesn't affect this endpoint's liveness since 4 other real call sites exist.

### `GET /connectors/{slug}` (Get Connector)
- **`config.ts`**: `CONNECTOR_DETAIL_ENDPOINT(slug)`
- **Wrapper**: `getConnector(slug)` (`connectors.ts`) — also the poll target inside `pollConnectorUntilActive()`.
- **Used by**:
  - `settings/(shell)/connectors/page.tsx` — inside the "Manage connector" modal, lazily fetching the full tool-permission list for a connected long-tail connector.
  - `components/chat/ConnectorPrompts.tsx` — fetching `api_key_fields` when the user opens the credential form on a mid-chat "Connect X" prompt (rendered from `ChatMessage.tsx`, `CompareModels.tsx`, `agent/configure/layout.tsx`).
  - `brain/page.tsx`'s `ToolConnectCard` — same lazy field-fetch for a mid-turn tool-connect prompt.
  - Indirectly via `pollConnectorUntilActive` — polling for OAuth completion after the user clicks **Connect**, from all three surfaces above.

### `PATCH /connectors/{slug}` (Update Connector)
- **`config.ts`**: `CONNECTOR_DETAIL_ENDPOINT(slug)` (same constant, PATCH)
- **Wrapper**: `updateConnector(slug, body)` (`connectors.ts`, busts the catalog cache)
- **Used by**:
  - `settings/(shell)/connectors/page.tsx` — flipping a single tool's permission (Allow/Ask/Block) or clicking **Allow all** in the Manage-connector modal; also submitting the API-key credential form for an `api_key`-auth connector.
  - `ConnectorPrompts.tsx` and `brain/page.tsx`'s `ToolConnectCard` — submitting credentials on their respective mid-chat/mid-turn connect prompts for an api_key connector.

### `DELETE /connectors/{slug}` (Unlink Connector)
- **`config.ts`**: `CONNECTOR_DETAIL_ENDPOINT(slug)` (same constant, DELETE)
- **Wrapper**: `unlinkConnector(slug)` (`connectors.ts`, busts the catalog cache)
- **Used by**: `settings/(shell)/connectors/page.tsx` — **Disconnect** inside the Manage-connector modal, and **Disconnect** from a connector card's kebab (⋮) menu (guarded by a `window.confirm`).

### `POST /connectors/{slug}/link` (Initiate Link)
- **`config.ts`**: `CONNECTOR_LINK_ENDPOINT(slug)`
- **Wrapper**: `initiateLink(slug, initData?)` (`connectors.ts`)
- **Used by**: `settings/(shell)/connectors/page.tsx` — clicking **Connect** on an OAuth connector card (or submitting the init-fields form for BYOA-style connectors like Shopify), opening the hosted OAuth popup; and the equivalent **Connect** action in `ConnectorPrompts.tsx` and `brain/page.tsx`'s `ToolConnectCard` for mid-chat/mid-turn prompts.

---

## Org connectors

### `GET /organizations/{organization_id}/connectors` (List Org Connectors)
- **`config.ts`**: `ORG_CONNECTORS_ENDPOINT(orgId)`
- **Wrapper**: `listOrgConnectorRequests(orgId)` (`org-connectors.ts`) — the org's per-slug request/approval rows.
- **Used by**: `connectors/page.tsx`'s `loadPageData()` — every load of the org Connectors page (admin and member views alike); drives the approval-status index, the pending-request badge count, and the Org Access tab's approve/deny UI.

### `POST /organizations/{organization_id}/connectors` (Request Org Connector)
- **`config.ts`**: `ORG_CONNECTORS_ENDPOINT(orgId)` (same constant, POST)
- **Wrapper**: `requestOrgConnector(orgId, slug, note?)` (`org-connectors.ts`)
- **Used by**:
  - `connectors/page.tsx`'s `handleOrgToggle()` — an admin flipping the "Org ON" switch for a connector (an admin's own request auto-approves server-side).
  - `connectors/page.tsx`'s `MemberBrowseView.requestAccess()` — a non-admin member clicking **Request access** on a connector card.
  - `onboarding/connectors/page.tsx` — clicking **Continue** on the onboarding connector picker, once per selected connector.

### `GET /organizations/{organization_id}/connectors/catalog` (List Connector Catalog)
- **`config.ts`**: `ORG_CATALOG_ENDPOINT(orgId)`
- **Wrapper**: `listOrgCatalog(orgId)` — **lives in `connectors.ts`**, not `org-connectors.ts` (worth knowing since every other org-connector wrapper lives in the latter file).
- **Used by**: `connectors/page.tsx`'s `loadPageData()` — the admin-view branch's catalog source (`isAdminView ? listOrgCatalog(...) : listConnectors()`); and `onboarding/connectors/page.tsx` — checking which onboarding connector cards are already linked/requested for the org.

### `PATCH /organizations/{organization_id}/connectors/{slug}` (Set Org Connector Status)
- **`config.ts`**: `ORG_CONNECTOR_REQUEST_ENDPOINT(orgId, slug)`
- **Wrapper**: `setOrgConnectorStatus(orgId, slug, status)` (`org-connectors.ts`)
- **Used by**, all on `connectors/page.tsx`'s Org Access tab:
  - `handleOrgToggle()` — flipping the "Org OFF" switch (`status: 'denied'`) — per the code's own comment, turning off is implemented as a deny, which also clears the org's shared connection for that slug.
  - `handleApprove()` / `handleDeny()` — an admin approving or denying a pending member request row.

### `DELETE /organizations/{organization_id}/connectors/{slug}` (Remove Org Connector) — dead
- **`config.ts`**: `ORG_CONNECTOR_REQUEST_ENDPOINT(orgId, slug)` (same constant, DELETE)
- **Wrapper**: `removeOrgConnector(orgId, slug)` (`org-connectors.ts`) — imported into `connectors/page.tsx`, but verified via grep: never actually invoked anywhere. The "turn a connector off" flow uses `setOrgConnectorStatus(..., 'denied')` (above) instead of this DELETE.

### `GET /organizations/{organization_id}/connectors/{slug}/accounts` (List Org Connector Accounts)
- **`config.ts`**: `ORG_CONNECTOR_ACCOUNTS_ENDPOINT(orgId, slug)`
- **Wrapper**: `listOrgConnectorAccounts(orgId, slug)` (`org-connectors.ts`) — also the poll driver inside `pollOrgConnectorAccountUntilConnected()`.
- **Used by**, all on the Shared Accounts tab of `connectors/page.tsx`:
  - `AddSharedAccountModal.handleSubmit()` — re-fetching right after creating an api_key account, to get its server-assigned version before the follow-up PATCH.
  - `ConnectorDetailView.loadAccounts()` — an admin opening a connector's detail view to populate the accounts table.
  - A refresh when returning from `AccountDetailView`, to pick up the latest state of the active account.
  - Indirectly via `pollOrgConnectorAccountUntilConnected` — polling after an OAuth-based shared account is started, waiting for the popup flow to complete.

### `POST /organizations/{organization_id}/connectors/{slug}/accounts` (Create Org Connector Account)
- **`config.ts`**: `ORG_CONNECTOR_ACCOUNTS_ENDPOINT(orgId, slug)` (same constant, POST)
- **Wrapper**: `createOrgConnectorAccount(orgId, slug, params)` (`org-connectors.ts`)
- **Used by**: `connectors/page.tsx`'s `AddSharedAccountModal.handleSubmit()` — an admin filling in the "Add shared account" modal (label/identifier/credentials) and clicking **Create shared account** / **Start shared OAuth**.

### `PATCH /organizations/{organization_id}/connectors/accounts/{account_id}` (Update Org Connector Account)
- **`config.ts`**: `ORG_CONNECTOR_ACCOUNT_ENDPOINT(orgId, accountId)`
- **Wrapper**: `updateOrgConnectorAccount(orgId, accountId, params)` (`org-connectors.ts`)
- **Used by**, all on the Shared Accounts tab:
  - `AddSharedAccountModal.handleSubmit()` — PATCHing a newly created api_key account with its submitted credentials right after creation.
  - `AccountDetailView.saveLabel()` — an admin editing the account label and clicking **Save**.
  - `AccountDetailView.toggleStatus()` — an admin flipping the active/disabled Switch on a shared account.

### `DELETE /organizations/{organization_id}/connectors/accounts/{account_id}` (Delete Org Connector Account)
- **`config.ts`**: `ORG_CONNECTOR_ACCOUNT_ENDPOINT(orgId, accountId)` (same constant, DELETE)
- **Wrapper**: `deleteOrgConnectorAccount(orgId, accountId)` (`org-connectors.ts`)
- **Used by**: `connectors/page.tsx`'s `AccountDetailView.handleDelete()` — an admin typing the account's label to confirm and clicking **Delete**.

### `GET /organizations/{organization_id}/connectors/{slug}/used-by` (Connector Used By) — dead
- **`config.ts`**: `ORG_CONNECTOR_USED_BY_ENDPOINT(orgId, slug)`
- **Wrapper**: `getConnectorUsedBy(orgId, slug)` (`org-connectors.ts`) — defined, zero references anywhere outside its own definition (verified via grep for the function name and for `used-by`/`usedBy`).
- Per `docs/organizations/backend-requirements.md`, this was meant to back a "blast-radius preview" — warning an admin how many personas/agents depend on a connector before they disable it org-wide. The backend endpoint and its frontend wrapper both exist; the warning UI that would call it was never built.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /connectors` | Live — `listConnectors()` |
| `GET /connectors/{slug}` | Live — `getConnector()` |
| `PATCH /connectors/{slug}` | Live — `updateConnector()` |
| `DELETE /connectors/{slug}` | Live — `unlinkConnector()` |
| `POST /connectors/{slug}/link` | Live — `initiateLink()` |
| `GET /organizations/{org}/connectors` | Live — `listOrgConnectorRequests()` |
| `POST /organizations/{org}/connectors` | Live — `requestOrgConnector()` |
| `GET /organizations/{org}/connectors/catalog` | Live — `listOrgCatalog()` (lives in `connectors.ts`) |
| `PATCH /organizations/{org}/connectors/{slug}` | Live — `setOrgConnectorStatus()` |
| `DELETE /organizations/{org}/connectors/{slug}` | **Dead** — `removeOrgConnector()` imported, never called |
| `GET /organizations/{org}/connectors/{slug}/accounts` | Live — `listOrgConnectorAccounts()` |
| `POST /organizations/{org}/connectors/{slug}/accounts` | Live — `createOrgConnectorAccount()` |
| `PATCH /organizations/{org}/connectors/accounts/{account_id}` | Live — `updateOrgConnectorAccount()` |
| `DELETE /organizations/{org}/connectors/accounts/{account_id}` | Live — `deleteOrgConnectorAccount()` |
| `GET /organizations/{org}/connectors/{slug}/used-by` | **Dead** — `getConnectorUsedBy()` defined, zero callers; planned "blast radius" UI never built |
