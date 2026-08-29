# Persona Shares (Super Links) — Frontend Usage Map

Cross-references every `/persona-shares/*` backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Split out from [`persona-endpoints-usage.md`](./persona-endpoints-usage.md) (its former §I) since persona sharing is its own feature surface — "Super Links," the shareable-agent-link system separate from persona CRUD/versions.

8 endpoints exist in this group. **7 are actively used; 1 (`GET /persona-shares/sent`) has a defined wrapper with zero call sites.**

All wrappers live in `src/lib/api/persona-shares.ts`, backed by the constants at `src/lib/config.ts:239-244`.

---

## `GET /persona-shares` (List Shares) & `POST /persona-shares` (Create Share)
- **`config.ts`**: `PERSONA_SHARES_ENDPOINT`
- **Wrappers**: `listShares()` (GET), `createShare()` (POST — fires `agent_shared` analytics event)
- **Used by**:
  - **List**: `agent/configure/components/SharingTab.tsx` — loading the current version's active Super Link + email invites when the Sharing tab mounts.
  - **List**: `agents/page.tsx` — populating the Super Link filter-panel data whenever the "My Personas" tab is active.
  - **List**: `agents/published/page.tsx` — loading an existing link share right after a version is published.
  - **List**: `components/AgentsPanel/index.tsx` — computing which personas already have an active Super Link, to show a badge in the chat @-mention agent picker.
  - **Create**: `SharingTab.tsx`'s `handleGenerateLink()` — clicking **Generate link** to turn on the Super Link toggle.
  - **Create**: `SharingTab.tsx`'s `handleSendEmailInvite()` — clicking **Send invite** in the Email Invite section.
  - **Create**: `agents/published/page.tsx` — generating a Super Link directly from the "published successfully" screen.

## `GET /persona-shares/dashboard` (Dashboard)
- **`config.ts`**: `PERSONA_SHARES_DASHBOARD_ENDPOINT`
- **Wrapper**: `fetchDashboard()` — accepts a 7/30/90-day window param.
- **Used by**: `agents/page.tsx` — fired whenever the **Super Links** tab is active or the date-range selector changes, and by its manual refresh button (`handleRefreshDashboard()`).

## `GET /persona-shares/received` (List Received)
- **`config.ts`**: `PERSONA_SHARES_RECEIVED_ENDPOINT`
- **Wrapper**: `listReceived()`
- **Used by**: `agents/page.tsx` — fired when the Super Links tab becomes active, populating its "Shared with me" section.

## `GET /persona-shares/sent` (List Sent) — dead
- **`config.ts`**: `PERSONA_SHARES_SENT_ENDPOINT`
- **Wrapper**: `listSent()` — defined, zero call sites. Verified via grep: `listSent` appears exactly once in `src/`, at its own definition (`persona-shares.ts:179`). No import, no consumer anywhere. There's no "Sent" view distinct from the dashboard/received views in the current Super Links UI.

## `GET /persona-shares/{share_id}` (Preview Share)
- **`config.ts`**: `PERSONA_SHARE_DETAIL_ENDPOINT(shareId)`
- **Wrapper**: `getSharePreview()`
- **Used by**: `app/(app)/share/[id]/page.tsx` — fetched automatically on load of the public Super Link landing page, rendering the persona-preview card before the visitor accepts it.

## `DELETE /persona-shares/{share_id}` (Revoke Share)
- **`config.ts`**: `PERSONA_SHARE_DETAIL_ENDPOINT(shareId)`
- **Wrapper**: `revokeShare()` — builds a custom `ApiError` on failure and explicitly handles an empty 204 response body.
- **Used by**:
  - `SharingTab.tsx`'s `handleRevokeLink()` — clicking **Revoke link** on the Super Link row.
  - `SharingTab.tsx`'s `handleRevokeEmailShare()` — clicking **Revoke** on an individual email-invite row.
  - `agents/published/page.tsx` — revoking a Super Link from the "published successfully" screen.
  - `agents/page.tsx`'s `SuperLinkDrawer` `onStatusChange` callback — choosing **Revoke** inside the link-detail drawer opened from the Super Links dashboard tab.

## `POST /persona-shares/{share_id}/accept` (Accept Share)
- **`config.ts`**: `PERSONA_SHARE_ACCEPT_ENDPOINT(shareId)`
- **Wrapper**: `acceptShare()`
- **Used by**: `share/[id]/page.tsx`'s `handleAccept()` — clicking **Accept & copy agent** on the public Super Link landing page, which clones the shared persona into the visitor's own account.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /persona-shares` | Live — `listShares()` |
| `POST /persona-shares` | Live — `createShare()` |
| `GET /persona-shares/dashboard` | Live — `fetchDashboard()` |
| `GET /persona-shares/received` | Live — `listReceived()` |
| `GET /persona-shares/sent` | **Dead** — `listSent()` defined, zero callers |
| `GET /persona-shares/{share_id}` | Live — `getSharePreview()` |
| `DELETE /persona-shares/{share_id}` | Live — `revokeShare()` |
| `POST /persona-shares/{share_id}/accept` | Live — `acceptShare()` |
