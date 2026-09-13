# Slack Endpoints — Frontend Usage Map

Cross-references every "slack" backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), [`projects-endpoints-usage.md`](./projects-endpoints-usage.md), [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md), and [`brain-endpoints-usage.md`](./brain-endpoints-usage.md).

All Slack wrappers live in `src/lib/api/slack.ts`. There's a real discrepancy worth flagging up front: **4 org-Slack functions in that file (channel listing/mapping, install status/uninstall, per-project channel binding) target backend paths that do not appear anywhere in the current `docs/openapi/devapi.json`.** Every one of them has live, real UI callers — this isn't unused frontend code. Either the spec is missing this whole subsystem, or these routes have moved/changed on the backend since the wrappers were written; either way, this is worth confirming with the backend rather than treating as "resolved" by this doc.

---

## Endpoints present in the current spec

### `GET /slack/install` (Slack Install Url)
- **`config.ts`**: `SLACK_INSTALL_ENDPOINT`
- **Wrapper**: `getSlackInstallUrl()` (`slack.ts`) — returns the "Add to Slack" URL; the frontend opens it in a new tab and lets Slack's own OAuth flow redirect to the callback.
- **Used by**: `components/SlackConnectModal/index.tsx`'s `handleConnect()` — clicking **Connect Slack** in the shared connect modal (opened from `souvenir-slack/page.tsx` and `welcome/page.tsx`). After opening the install URL, the modal polls `getOrgSlackStatus`/`getSlackStatus` (below) every few seconds until the install completes or a timeout is hit.

### `GET /slack/status` (Slack Status)
- **`config.ts`**: `SLACK_STATUS_ENDPOINT`
- **Wrapper**: `getSlackStatus()` (`slack.ts`) — workspaces where the bot is installed for the current user (personal-scope status; distinct from the org-scope status below).
- **Used by**: `SlackConnectModal`'s post-install poll, when opened **without** an `orgId` (the personal/individual-account connect path, as opposed to the org path which uses `getOrgSlackStatus` instead).

### `POST /slack/link` (Slack Link) & `DELETE /slack/link` (Slack Unlink)
- **`config.ts`**: `SLACK_LINK_ENDPOINT` (same constant, method differentiates)
- **Wrappers**: `linkSlackIdentity(state)` (POST — completes a `/connect` deep link, binding the Slack identity carried in `state` to the logged-in account), `disconnectSlackIdentity()` (DELETE — unlinks the user's Slack identity from every workspace)
- **Used by**: `app/(app)/slack/link/page.tsx` — the landing page a user lands on after clicking a Slack-side "/connect" deep link (calls `linkSlackIdentity` with the `state` param from the URL), and the same page's disconnect action (calls `disconnectSlackIdentity`).

---

## Endpoints with no matching path in the current spec

These are fully implemented in `slack.ts`, with real UI callers, but every one targets an `/organizations/{organization_id}/slack/...` path that does not exist anywhere in `docs/openapi/devapi.json` today.

### `getOrgSlackStatus(orgId)` — targets `GET /organizations/{id}/slack/installation`
- **`config.ts`**: `ORG_SLACK_INSTALLATION_ENDPOINT(orgId)`
- **Used by**: `SlackConnectModal`'s post-install poll (org path), `components/layout/LeftSidebar.tsx` (checking connection status to light up the "Slack" entry in the flat sidebar's destinations section), and `souvenir-slack/page.tsx` (loading/refreshing the org's Slack connection state).

### `removeOrgSlackInstallation(orgId)` — targets `DELETE /organizations/{id}/slack/installation`
- **Used by**: `souvenir-slack/page.tsx`'s `handleRemoveSlack()` — an admin confirming a `window.confirm` warning ("uninstalled from the workspace and all project channels stop working") and clicking to remove the Slack bot from the organization.

### `listSlackChannels(orgId)` — targets `GET /organizations/{id}/slack/channels`
- **`config.ts`**: `ORG_SLACK_CHANNELS_ENDPOINT(orgId)`
- **Used by**: `settings/(shell)/(org)/general/page.tsx` — loading the org's Slack channel list (silently no-ops on a 404 if Slack isn't connected) to populate the channel-to-project mapping UI on the org General settings page.

### `setSlackChannelMapping(orgId, channelId, projectId)` — targets `PUT /organizations/{id}/slack/channels/{channelId}/mapping`
- **`config.ts`**: `ORG_SLACK_CHANNEL_MAPPING_ENDPOINT(orgId, channelId)`
- **Used by**: `settings/(shell)/(org)/general/page.tsx`'s `handleSetSlackMapping()` — an admin picking which project a Slack channel should map to (or clearing the mapping) in that same channel list.

### `getProjectSlackChannel` / `createProjectSlackChannel` / `renameProjectSlackChannel` / `deleteProjectSlackChannel` — all target `.../organizations/{id}/slack/projects/{projectId}/channel`
- **`config.ts`**: `ORG_SLACK_PROJECT_CHANNEL_ENDPOINT(orgId, projectId)` (shared by all four HTTP verbs)
- **Used by**, all in `souvenir-slack/page.tsx` (the "Souvenir ↔ Slack" per-project channel binding page):
  - **Get**: loading each org-shared project's currently-bound channel (or `null`) when the page opens.
  - **Create**: `handleCreateChannel()` — an admin naming a new channel (with a private/public toggle) and creating it for a project that has no channel yet.
  - **Rename**: `handleEditSave()` — an admin editing a bound channel's name inline and saving.
  - **Delete**: `handleDeleteChannel()` — an admin confirming a `window.confirm` warning and deleting/unbinding a project's channel (archives it in Slack).

---

## Out of scope / not implemented at all

- `GET /slack/user/authorize` — no `config.ts` constant, no wrapper anywhere in `src/`. Unlike the other unused endpoints in this series, there isn't even a stub referencing it — it's simply not wired to the frontend at all.
- 8 `GET|POST /internal/sandbox/slack/*` paths (`slack`, `slack/channel`, `slack/channels`, `slack/dm`, `slack/people`, `slack/person`, `slack/post`, `slack/thread`) — backend-internal sandbox/testing infrastructure, same pattern as the internal sandbox paths already flagged in [`persona-endpoints-usage.md`](./persona-endpoints-usage.md#a-internal-sandbox-endpoints--all-dead) §A. No frontend reference of any kind.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /slack/install` | Live — `getSlackInstallUrl()` |
| `GET /slack/status` | Live — `getSlackStatus()` |
| `POST /slack/link` | Live — `linkSlackIdentity()` |
| `DELETE /slack/link` | Live — `disconnectSlackIdentity()` |
| `GET /slack/user/authorize` | Not implemented — no constant, no wrapper |
| `GET /organizations/{id}/slack/installation` | Frontend-live (`getOrgSlackStatus`) — **no matching path in current spec** |
| `DELETE /organizations/{id}/slack/installation` | Frontend-live (`removeOrgSlackInstallation`) — **no matching path in current spec** |
| `GET /organizations/{id}/slack/channels` | Frontend-live (`listSlackChannels`) — **no matching path in current spec** |
| `PUT /organizations/{id}/slack/channels/{channelId}/mapping` | Frontend-live (`setSlackChannelMapping`) — **no matching path in current spec** |
| `GET/POST/PATCH/DELETE /organizations/{id}/slack/projects/{projectId}/channel` | Frontend-live (4 functions) — **no matching path in current spec** |
| 8 `/internal/sandbox/slack/*` paths | Dead — backend-internal, no frontend reference |

**Flag for follow-up**: the entire org-Slack subsystem (7 of the "no matching path" rows above) is real, shipped, actively-used frontend code with no corresponding entry in the current OpenAPI spec. Worth a quick check with backend on whether the spec needs regenerating for this area, or whether these routes were quietly renamed/removed.
