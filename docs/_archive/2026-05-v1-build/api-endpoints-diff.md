# Diff: `api-endpoints.md` vs. `api-endpoints-test.md`

These two docs aren't structurally parallel, so a plain line-diff wouldn't mean much — this file reconciles them into one useful answer: **for every endpoint the front-end actually calls, does it still work if the backend switches from `back-end` (main) to the `test` branch?**

- `api-endpoints.md` = every backend path the **front-end** knows about (scanned from `config.ts` + `automations.ts`/`brain.ts`).
- `api-endpoints-test.md` = every path the **`test`-branch backend** actually serves (scanned from its `main.py`/`router.py` files).

Only `services/organizations/router.py` and `services/connectors/schemas.py` differ between the two backends (per the test doc's own scan) — every other router is identical. So this diff only touches organizations/teams/connectors call sites; everything else in `api-endpoints.md` (chats, brain, persona, persona-shares, stripe, llm, pins, projects, highlights, memory, users, automations, docx-adjacent, slack install/status/link) is unaffected either way and isn't repeated below.

---

## 🟢 Fixed by the test branch (broken on main today, would start working)

| Front-end constant | Path | Main (`back-end`) | Test branch |
|---|---|---|---|
| `ORG_INVITES_ENDPOINT(id)` | `POST /organizations/{id}/invites` | 🔴 404 — main requires `/organizations/{id}/teams/{team_id}/invites` | 🟢 Exists exactly as called — invites are flat in the test branch |

## 🔴 Would newly break on the test branch (works on main today, would 404 after switching)

| Front-end constant | Path | Main (`back-end`) | Test branch |
|---|---|---|---|
| `TEAM_INVITE_PREVIEW_ENDPOINT(id)` | `GET /team-invite/{id}` | 🟢 Works | 🔴 Router renamed to `/org-invite` — `/team-invite/*` no longer exists |
| `TEAM_INVITE_ACCEPT_ENDPOINT(id)` | `POST /team-invite/{id}/accept` | 🟢 Works | 🔴 Same — now `POST /org-invite/{id}/accept`, and returns `OrganizationResponse` not `TeamResponse` |
| `ORG_CONNECTOR_PERSONAL_REQUEST_ENDPOINT(orgId, slug)` | `POST /organizations/{id}/connectors/{slug}/personal-request` | 🟢 Works (added this session, see `useConnectorSetupFlow.ts`'s `requestPersonalAccess`) | 🔴 Entire personal-request family removed — no replacement endpoint |
| `ORG_CONNECTOR_PERSONAL_REQUEST_REVIEW_ENDPOINT(orgId, id)` | `PATCH /organizations/{id}/connectors/personal-requests/{id}` | 🟢 Works | 🔴 Removed, same as above |
| `ORG_TEAMS_ENDPOINT(orgId)` | `GET /organizations/{id}/teams` | 🟢 Works | 🔴 No `/teams` route exists at all |
| `ORG_TEAM_CONNECTORS_ENDPOINT(orgId, teamId)` | `GET/POST /organizations/{id}/teams/{teamId}/connectors` | 🟢 Works | 🔴 Gone |
| `ORG_TEAM_CONNECTOR_STATUS_ENDPOINT(orgId, teamId, slug)` | `PATCH/DELETE /organizations/{id}/teams/{teamId}/connectors/{slug}` | 🟢 Works | 🔴 Gone |

These three connector/team constants back the *legacy* code paths already flagged as such in prior scans (`org-connectors.ts`'s `listOrgTeams`/`requestTeamConnector`/etc., used by the dead onboarding page and nothing else live) — so the practical blast radius is smaller than it looks, but they'd be fully non-functional on the test branch.

The two `personal-request` endpoints are **not legacy** — they're the fix wired in this session's "personal-access-gate" work (`useConnectorSetupFlow.requestPersonalAccess`). Switching to the test branch would silently break that self-heal flow (falls through to `outcome === 'failed'`, which today just shows the raw 403 again — not a crash, but the self-heal stops working).

## ⚪ Broken on both branches — no change either way

| Front-end constant | Path | Main | Test branch |
|---|---|---|---|
| `ORG_PROJECT_MEMBERS_ENDPOINT(id, p)` / `ORG_PROJECT_MEMBER_ENDPOINT(id, p, m)` | `/organizations/{id}/projects/{p}/members[/{m}]` | 🔴 404 — main's real route is team-scoped (`/teams/{team_id}/projects/{p}/members`) | 🔴 Still 404 — this endpoint family doesn't exist at all anymore (not even team-scoped), since project membership is now supposed to be a plain list, not a separate CRUD surface |
| `ORG_SLACK_CHANNELS_ENDPOINT(id)` / `ORG_SLACK_CHANNEL_MAPPING_ENDPOINT(id, ch)` | `/organizations/{id}/slack/channels[/{ch}/mapping]` | 🔴 404 — never existed | 🔴 Still never existed (Slack router is identical on both branches) |

## 🟢 Unaffected — present and correct on both branches

Everything else under `/organizations` that the front-end calls is untouched by the Team-removal: `ORGANIZATIONS_ENDPOINT`, `ORG_ENDPOINT`, `ORG_SETTINGS_ENDPOINT`, `ORG_PLAN_ENDPOINT`, `ORG_PLAN_POOL_CAP_ENDPOINT`/`ORG_POOL_CAP_ENDPOINT`, `ORG_PLAN_USAGE_ENDPOINT`, `ORG_POOL_STATUS_ENDPOINT`, `ORG_AUDIT_ENDPOINT`, `ORG_TRANSFER_OWNER_ENDPOINT`, `ORG_MEMBERS_ENDPOINT`, `ORG_MEMBER_ENDPOINT`, `ORG_MEMBER_ROLE_ENDPOINT`, all of `CONNECTORS_ENDPOINT`/`CONNECTOR_DETAIL_ENDPOINT`/`CONNECTOR_LINK_ENDPOINT`, `ORG_CATALOG_ENDPOINT`, `ORG_CONNECTOR_ACCOUNTS_ENDPOINT`, `ORG_CONNECTOR_ACCOUNT_ENDPOINT`, `ORG_CONNECTOR_USED_BY_ENDPOINT`, all of `CHAT_SHARES_*`, `ORG_SLACK_PROJECT_CHANNEL_ENDPOINT`, `ORG_SLACK_INSTALLATION_ENDPOINT`.

Note one behavioral (not path) change on a path in this "unaffected" list: `ORG_CONNECTOR_ACCOUNT_ENDPOINT`'s `PATCH` body currently sends `organization_wide` (`org-connectors.ts`'s `updateOrgConnectorAccount`). The path still exists on the test branch, but the field is gone from `UpdateOrganizationConnectionRequest` there — see below.

---

## Schema-level changes that matter to front-end code, not just paths

The test branch's `connectors/schemas.py` changed independently of any route path:

| | Main (`back-end`) | Test branch |
|---|---|---|
| `AccountScope` | `"personal" \| "shared_team" \| "shared_org"` | `"personal" \| "shared"` |
| `organization_wide` field | Present on `ConnectorAccount`, settable via PATCH | **Removed entirely** — no smaller scope exists to distinguish from |
| `team_ids` / `team_names` | Present on `OrganizationConnectorAccountResponse` / `ConnectorAccountOption` | **Removed** |

Front-end code that will need updating whenever the backend actually cuts over to this model:
- `src/lib/api/connectors.ts` — `accountScopeSchema = z.enum(['personal', 'shared_team', 'shared_org'])` → becomes `z.enum(['personal', 'shared'])`; `organization_wide` field on `orgConnectorAccountSchema` gets dropped.
- `src/lib/api/org-connectors.ts` — `OrgConnectorAccount.organizationWide`, `updateOrgConnectorAccount`'s `organizationWide` param, and the `organization_wide: true` PATCH sent from `useConnectorSetupFlow.connectShared` all become unnecessary (shared already *is* workspace-wide, unconditionally).
- `src/lib/connectorsUnified.ts` — `accountFromOption`'s `option.scope === 'personal' ? 'private' : 'shared'` mapping already works unchanged for the 2-value enum (this was written defensively in this session specifically so it wouldn't need to change here — confirmed still correct).

---

## Summary

| Category | Count |
|---|---|
| 🟢 Fixed by switching to test | 1 (`ORG_INVITES_ENDPOINT`) |
| 🔴 Newly broken by switching to test | 6 (2 team-invite, 2 personal-request, 2 team-connectors) |
| ⚪ Broken on both, unaffected by the switch | 2 (project-members, slack-channels) |
| 🟢 Unaffected, correct on both | ~25 remaining `/organizations`, `/connectors`, `/chat-shares` constants, plus every non-organizations router (chats, brain, persona, stripe, llm, pins, projects, highlights, memory, users, automations, slack install/status/link) |

Net: switching the backend to the `test` branch **today, with zero front-end changes**, would trade one fixed endpoint for six newly-broken ones — three of which (the two personal-request endpoints and the team-invite pair) back real, currently-working features from this session, not just legacy dead code. The connectors schema simplification (`AccountScope` → 2 values, `organization_wide` gone) is a separate, smaller front-end update once that cutover is actually planned.
