# Org Settings — API Integration Status

Source spec: `docs/openapi/api_yaml/organizations.yaml`

---

## Integrated (fully wired to API)

| Area | Endpoint | Notes |
|------|----------|-------|
| Org identity | `GET /organizations/{id}` | Loads name, slug, role into General settings |
| Update org name/slug | `PATCH /organizations/{id}` | Saves on "Save changes" in General |
| Org settings | `GET /organizations/{id}/settings` | Loads AI instructions, allowed domains, default visibilities |
| Update org settings | `PUT /organizations/{id}/settings` | Saves instructions, domains, visibility defaults as separate sections |
| Plan & credit pool | `GET /organizations/{id}/plan` | Populates Plans page totals, pool status, member list |
| Per-member credit cap | `PUT /organizations/{id}/members/{memberId}/cap` | Inline editable cap on Plans page |
| Plan usage by team | `GET /organizations/{id}/plan/usage` | Drives "Usage by team" ranked list on Analytics page |
| Audit log | `GET /organizations/{id}/audit` | Activity log page with dynamic action-type filter |
| Settings sidebar | — | Re-enabled, admin-gated, shows under "Team" badge |

---

## Not integrated — no backend endpoint in spec

| Feature | Location | Reason |
|---------|----------|--------|
| Stripe billing portal | Plans page | No Stripe portal URL endpoint in spec; button is UI-only |
| Cancel plan | Plans page Danger Zone | No `DELETE /organizations/{id}/plan` in spec |
| Buy more credits / top-up | Plans page | No top-up endpoint in spec |
| Org avatar / logo upload | General → Change Avatar | No file-upload endpoint; `logo_url` field exists on PATCH but no upload URL |
| Invite member | Plans / Analytics pages | No `POST /organizations/{id}/members` in spec |
| Time-series usage chart | Analytics → feature chart | No time-series/history endpoint; chart is a static placeholder |
| Pool status management | — | `GET /organizations/{id}/pool-status` exists but no write endpoint |
| Actor display names in audit log | Activity page | Log shows raw `actorUserId` (UUID); no `/users/{id}` lookup endpoint in spec |

---

## Missing pages — endpoints exist, no UI yet

| Page needed | Endpoints available |
|-------------|---------------------|
| Members management (list + remove) | `GET /organizations/{id}/members` · `DELETE /organizations/{id}/members/{memberId}` |
| Teams management | `GET/POST/PATCH/DELETE /organizations/{id}/teams/…` (data already in org context, no dedicated settings page) |
