# Organizations Endpoints — Frontend Usage Map

Cross-references every "organizations" backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), [`projects-endpoints-usage.md`](./projects-endpoints-usage.md), [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md), [`brain-endpoints-usage.md`](./brain-endpoints-usage.md), [`slack-endpoints-usage.md`](./slack-endpoints-usage.md), and [`automations-endpoints-usage.md`](./automations-endpoints-usage.md).

This doc covers 25 endpoints. The 10 `/organizations/{id}/connectors...` endpoints and the 3 `/organizations/{id}/projects/{project_id}/members` endpoints are **not** repeated here — see [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md) and [`projects-endpoints-usage.md`](./projects-endpoints-usage.md#organizationsorganization_idprojectsproject_idmembers) respectively. Wrappers live in `src/lib/api/organization.ts` (most) and `src/lib/api/teams.ts` (invites, project members). Most consumers go through `context/org-context.tsx`'s `useOrg()` rather than calling wrappers directly — org name, plan, members, and role all live there.

**16 of 25 are actively used. 9 are not** — 4 have no frontend implementation at all, 2 are dead/duplicate `config.ts` constants, and 3 have a fully-wired wrapper *and* handler sitting behind UI that was never actually rendered (button/section missing or feature-flagged off).

---

## Org identity

### `GET /organizations` (List Organizations) & `POST /organizations` (Create Organization)
- **`config.ts`**: `ORGANIZATIONS_ENDPOINT`
- **Wrappers**: `listOrganizations()` (GET), `createOrganization()` (POST)
- **Used by**:
  - **List**: `org-context.tsx` — a fallback lookup whenever `/users/me` doesn't return an `orgId` (e.g. right after signup); `onboarding/invite/page.tsx` and `onboarding/connectors/page.tsx` use the same fallback when clicking **Send invites** / **Continue** with a still-missing org id.
  - **Create**: `onboarding/pricing/confirmation/page.tsx` — fired automatically (not a click) in a `useEffect` right after Stripe checkout completes for a Team-plan signup, guarded on `isTeamPlan && !user?.orgId`; errors are swallowed since the org may already exist.

### `GET /organizations/{id}` (Get Organization) & `PATCH /organizations/{id}` (Update Organization)
- **`config.ts`**: `ORG_ENDPOINT(orgId)`
- **Wrappers**: `getOrg()`, `updateOrg()` (multipart, logo sent as raw file bytes)
- **Used by**:
  - **Get**: `org-context.tsx` — auto-fetched whenever `orgId` resolves, populating org name/plan type and the viewer's role for app-wide capability gating; `settings/(org)/general/page.tsx` — populating the Workspace Identity card.
  - **Update**: `general/page.tsx`'s `handleLogoUpload()` (uploading a new logo) and `handleSaveIdentity()` (clicking **Save changes** on the Workspace Identity card); `onboarding/workspace/page.tsx` — clicking **Continue** on the "Set up your workspace" onboarding step, renaming the placeholder org to the entered company name.

### `DELETE /organizations/{id}` (Delete Organization) — dead in practice
- **`config.ts`**: `ORG_ENDPOINT(orgId)`
- **Wrapper**: `deleteOrg()` — fully implemented, with a `handleDeleteOrg` handler and supporting state (`deleteOrgInput`/`deletingOrg`/`canDeleteOrg`) in `general/page.tsx`.
- **No UI renders it.** Verified via grep: `handleDeleteOrg` appears only at its own definition in `general/page.tsx` — no button, danger-zone card, or confirmation dialog references it anywhere in the file's JSX, and no other file imports `deleteOrg`. There's currently no way to delete an organization from the app.

---

## Audit

### `GET /organizations/{id}/audit` (List Audit)
- **`config.ts`**: `ORG_AUDIT_ENDPOINT(orgId)`
- **Wrapper**: `listAudit(orgId, { limit, offset })`
- **Used by**: `settings/(org)/activity/page.tsx` — auto-fetched (`limit: 100`) whenever the Activity tab opens. Since the endpoint has no role-aware filtering, non-admin viewers get the result filtered down to their own actions client-side.

---

## Org "connections" — not implemented

### `GET/PATCH/DELETE/POST /organizations/{id}/connections...` (List/Update/Unlink/Link Org Connection)
- **No `config.ts` constant, no wrapper, no UI reference anywhere.** Verified via grep across `src/` for `/connections`, `ORG_CONNECTIONS`, and any `Connection`-named (singular) type — zero matches. This is a **distinct concept from `/organizations/{id}/connectors`**, which is fully built and documented in [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md) — don't confuse the two when reading the spec. All 4 "connections" endpoints have no frontend implementation whatsoever.

---

## Invites

### `POST /organizations/{id}/invites` (Create Invite)
- **`config.ts`**: `ORG_INVITES_ENDPOINT(orgId)`
- **Wrapper**: `inviteMembers(orgId, emails, role?, projectId?)` (`teams.ts`)
- **Used by**: `settings/(org)/members/page.tsx`'s `handleInvite()` — submitting the **Invite members** modal; `onboarding/invite/page.tsx` — clicking **Send invites** on the onboarding step.
- **Note**: `ORG_INVITES_ENDPOINT` is POST-only in this codebase — there's no wrapper making a GET to the same path. Pending invites are surfaced through the members list (see below), not a dedicated "list invites" call.

### `DELETE /organizations/{id}/invites/{invite_id}` (Revoke Invite)
- **`config.ts`**: `ORG_INVITE_ENDPOINT(orgId, inviteId)`
- **Wrapper**: `revokeInvite()`
- **Used by**: `members/page.tsx`'s `handleRevokeInvite()` — an admin clicking **Revoke** on a pending-invite row (falls back to `removeMember`, below, if the row is missing invite metadata).

---

## Members

### `GET /organizations/{id}/members` (List Members)
- **`config.ts`**: `ORG_MEMBERS_ENDPOINT(orgId)`
- **Wrapper**: `listMembers()`
- **Used by**: `org-context.tsx` — auto-fetched whenever `orgId` (or `refreshMembers()`) changes, feeding `useOrg().members` which `members/page.tsx`, `settings/(org)/analytics/page.tsx`, and `plans/page.tsx` all read rather than calling the wrapper directly; `components/ProjectMembersPanel/index.tsx` — computing which org members are eligible to add to a project.

### `GET /organizations/{id}/members/admins` (List Admin Members) & `GET /organizations/{id}/members/regular` (List Regular Members) — not implemented
- **No `config.ts` constant, no wrapper, no UI reference.** Verified via grep — zero matches for `members/admins`, `members/regular`, or related identifiers. The Members page derives admin/owner and regular-member counts by filtering the general `listMembers()` result client-side (`members.filter(m => m.orgRole === 'owner' || m.orgRole === 'admin')`) instead of calling these dedicated endpoints.

### `DELETE /organizations/{id}/members/{member_id}` (Remove Member)
- **`config.ts`**: `ORG_MEMBER_ENDPOINT(orgId, memberId)`
- **Wrapper**: `removeMember()`
- **Used by**: `members/page.tsx`'s `handleRemove()` — an admin confirming **Remove** on a member row; also the fallback path inside `handleRevokeInvite` when a pending-invite row lacks proper invite metadata.

### `PATCH /organizations/{id}/members/{member_id}/role` (Set Member Role)
- **`config.ts`**: `ORG_MEMBER_ROLE_ENDPOINT(orgId, memberId)`
- **Wrapper**: `setMemberRole()`
- **Used by**: `members/page.tsx`'s `handleManageRole()` — an admin changing a member's role (Admin/Member) via the **Manage role** modal and saving.

---

## Plan / billing pool

### `GET /organizations/{id}/plan` (Get Plan)
- **`config.ts`**: `ORG_PLAN_ENDPOINT(orgId)`
- **Wrapper**: `getOrgPlan()` (zod-validated against `planResponseSchema`)
- **Used by**: `org-context.tsx` — auto-fetched whenever `orgId` (or a plan-refresh token) changes, feeding `useOrg().plan`, which `plans/page.tsx` (credit pool, pool status, member burn table) and `analytics/page.tsx` (usage charts) both read. Also used as a fallback source of the plan's bundled member list if `listMembers()` fails.

### `GET /organizations/{id}/plan/enterprise-usage` (Get Enterprise Usage) — not implemented
- **No `config.ts` constant, no wrapper, no UI reference.** `analytics/page.tsx`'s enterprise-usage breakdowns are read off fields already bundled into the regular `GET /plan` response (`plan.includedUsageUsd`/`plan.providerUsageUsd`, etc.) rather than this dedicated endpoint.

### `PATCH /organizations/{id}/plan/pool-cap` (Set Pool Cap)
- **`config.ts`**: `ORG_PLAN_POOL_CAP_ENDPOINT(orgId)`
- **Wrapper**: `setOrgPoolCap()`
- **Used by**: `plans/page.tsx`'s `handleSaveCap()` — an owner clicking **Edit limit**, then **Save limit** in the spend-limit modal; `null` is sent as the sentinel max-int value to mean "unlimited."
- **Dead duplicate constant**: `ORG_POOL_CAP_ENDPOINT(orgId)` builds the *identical* path — verified via grep, it's never imported anywhere outside its own `config.ts` definition. A leftover duplicate, not a second route.

### `GET /organizations/{id}/plan/usage` (Get Plan Usage)
- **`config.ts`**: `ORG_PLAN_USAGE_ENDPOINT(orgId)`
- **Wrapper**: `getOrgPlanUsage()`
- **Used by**: `settings/(org)/analytics/page.tsx` — auto-fetched on mount of the Usage Analytics tab, populating the per-member credit-burn ranked list.

### `GET /organizations/{id}/pool-status` (Get Pool Status) — dead
- **`config.ts`**: `ORG_POOL_STATUS_ENDPOINT(orgId)` — defined, but verified via grep to appear only at its own definition. No wrapper, no caller anywhere.
- The pool-status data the UI actually shows (`healthy`/`warning_95`/`paused`) comes bundled in the `GET /plan` response instead (`plan.poolStatus`) — this dedicated endpoint was set up in `config.ts` but never wired to a wrapper.

---

## Settings

### `GET /organizations/{id}/settings` (Get Settings) & `PATCH /organizations/{id}/settings` (Update Settings)
- **`config.ts`**: `ORG_SETTINGS_ENDPOINT(orgId)`
- **Wrappers**: `getOrgSettings()`, `updateOrgSettings()`
- **Used by**:
  - **Get**: `general/page.tsx` (AI instructions / allowed-domains / default-visibility cards), `plans/page.tsx` (which admin billing sections a non-owner admin can see), `members/page.tsx` (validating invite emails against allowed domains).
  - **Update**, all in `general/page.tsx` except the last: clicking **Clear** or **Save** on the org AI-instructions card; clicking **Save domains** after adding/removing an allowed email domain; `plans/page.tsx`'s `handlePermToggle()` — an owner toggling one of the three admin-billing-permission switches (top-up / manage payment / view invoices).
  - **Partially unreachable**: a fourth update path, `handleSaveDefaults()` (clicking **Save defaults** on a "Workspace defaults" card), is fully implemented but that entire card is wrapped in `{false && (...)}` in `general/page.tsx` — feature-flagged off, never rendered.

---

## Ownership transfer

### `POST /organizations/{id}/transfer-owner` (Transfer Owner) — dead in practice
- **`config.ts`**: `ORG_TRANSFER_OWNER_ENDPOINT(orgId)`
- **Wrapper**: `transferOrgOwnership()` — fully implemented, with `handleTransferOwnership`/`handleOpenTransfer` handlers and supporting state (`transferOpen`/`transferTarget`/`transferring`) in `general/page.tsx`.
- **No UI renders it.** Verified via grep, same pattern as `deleteOrg` above: both handlers exist only as their own definitions in `general/page.tsx` — no button or dialog in the file's JSX calls them, and no other file imports `transferOrgOwnership`. There's currently no way to transfer org ownership from the UI, even though `handleOpenTransfer` would otherwise populate a member picker via `listMembers()`.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /organizations` | Live — `listOrganizations()` |
| `POST /organizations` | Live — `createOrganization()` |
| `GET /organizations/{id}` | Live — `getOrg()` |
| `PATCH /organizations/{id}` | Live — `updateOrg()` |
| `DELETE /organizations/{id}` | **Dead in practice** — `deleteOrg()` + handler exist, nothing renders a trigger |
| `GET /organizations/{id}/audit` | Live — `listAudit()` |
| `GET/PATCH/DELETE/POST /organizations/{id}/connections...` (×4) | **Not implemented** — no constant, no wrapper, no UI |
| `POST /organizations/{id}/invites` | Live — `inviteMembers()` |
| `DELETE /organizations/{id}/invites/{invite_id}` | Live — `revokeInvite()` |
| `GET /organizations/{id}/members` | Live — `listMembers()` |
| `GET /organizations/{id}/members/admins` | **Not implemented** — filtered client-side instead |
| `GET /organizations/{id}/members/regular` | **Not implemented** — filtered client-side instead |
| `DELETE /organizations/{id}/members/{member_id}` | Live — `removeMember()` |
| `PATCH /organizations/{id}/members/{member_id}/role` | Live — `setMemberRole()` |
| `GET /organizations/{id}/plan` | Live — `getOrgPlan()` |
| `GET /organizations/{id}/plan/enterprise-usage` | **Not implemented** — enterprise fields read off `GET /plan` instead |
| `PATCH /organizations/{id}/plan/pool-cap` | Live — `setOrgPoolCap()`; sibling `ORG_POOL_CAP_ENDPOINT` is a dead duplicate constant |
| `GET /organizations/{id}/plan/usage` | Live — `getOrgPlanUsage()` |
| `GET /organizations/{id}/pool-status` | **Dead** — constant defined, zero wrapper/caller; pool status comes from `GET /plan` instead |
| `GET /organizations/{id}/settings` | Live — `getOrgSettings()` |
| `PATCH /organizations/{id}/settings` | Live — `updateOrgSettings()`; one of its 4 call sites (`handleSaveDefaults`) sits behind a `{false && ...}` gate and never renders |
| `POST /organizations/{id}/transfer-owner` | **Dead in practice** — `transferOrgOwnership()` + handlers exist, nothing renders a trigger |

**16 of 25 live, 9 not reachable today** — 4 with zero frontend implementation (`connections` ×4), 3 more with zero implementation but derivable from other live endpoints (`members/admins`, `members/regular`, `plan/enterprise-usage`), 2 dead/duplicate `config.ts` constants (`ORG_POOL_CAP_ENDPOINT`, `ORG_POOL_STATUS_ENDPOINT`), and 2 fully-built-but-unreachable features (delete organization, transfer ownership — both have complete wrappers and handlers, just no button anywhere to trigger them).
