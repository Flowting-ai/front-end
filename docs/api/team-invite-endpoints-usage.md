# Team Invite Endpoints — Frontend Usage Map

Cross-references every `/team-invite/*` backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), [`projects-endpoints-usage.md`](./projects-endpoints-usage.md), [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md), [`brain-endpoints-usage.md`](./brain-endpoints-usage.md), [`slack-endpoints-usage.md`](./slack-endpoints-usage.md), [`automations-endpoints-usage.md`](./automations-endpoints-usage.md), [`organizations-endpoints-usage.md`](./organizations-endpoints-usage.md), [`llm-endpoints-usage.md`](./llm-endpoints-usage.md), [`memory-endpoints-usage.md`](./memory-endpoints-usage.md), [`health-endpoints-usage.md`](./health-endpoints-usage.md), and [`internal-sandbox-endpoints-usage.md`](./internal-sandbox-endpoints-usage.md).

2 endpoints exist in this group, both wrapped in `src/lib/api/teams.ts`. **Both are actively used** — this is the org-invite acceptance flow, distinct from the onboarding invite-*sending* flow covered in [`organizations-endpoints-usage.md`](./organizations-endpoints-usage.md#invites) (`POST /organizations/{id}/invites`).

---

## `GET /team-invite/{invite_id}` (Preview Invite)
- **`config.ts`**: `TEAM_INVITE_PREVIEW_ENDPOINT(inviteId)`
- **Wrapper**: `getTeamInviteOnboarding(inviteId)` (`teams.ts`) — per its own comment, the backend returns the *full* invite payload from this preview path; there's no separate `/onboarding` endpoint despite the wrapper's name.
- **Used by**: `context/team-invite-onboarding-context.tsx`'s `TeamInviteOnboardingProvider` — fetched automatically whenever an invited user opens their invite link (`/onboarding/team/[inviteId]`). Drives the `status` state machine (`loading`/`ready`/`expired`/`not_found`/`error`, mapping `ApiError` status codes 404→`not_found` and 410→`expired`) that every screen in the team-invite onboarding flow reads via `useTeamInviteOnboarding()`.

## `POST /team-invite/{invite_id}/accept` (Accept Invite)
- **`config.ts`**: `TEAM_INVITE_ACCEPT_ENDPOINT(inviteId)`
- **Wrapper**: `acceptTeamInvite(inviteId)` (`teams.ts`) — the real response is an `OrganizationResponse`, but nothing reads it; the caller just re-fetches org state separately afterward.
- **Used by**: `onboarding/team/[inviteId]/page.tsx`'s `handleAccept()` — clicking **Accept invite** on the "You're invited to {org}" screen. This single action commits org membership *and* completes onboarding atomically: it calls `acceptTeamInvite()` immediately followed by `updateOnboarding({ onboarding_completed: true })` (see [`users-endpoints-usage.md`](./users-endpoints-usage.md#patch-usersmeonboarding-patch-my-onboarding)) and `refreshUser()`, so the invitee has full app access the instant they accept — the rest of the flow (join → profile → confirm) is optional orientation they can close out of at any point.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /team-invite/{invite_id}` | Live — `getTeamInviteOnboarding()` |
| `POST /team-invite/{invite_id}/accept` | Live — `acceptTeamInvite()` |

Both endpoints in this group are actively used — no dead code found here.
