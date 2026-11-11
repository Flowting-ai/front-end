# Backend ticket: gaps found while fixing the 2026-10-27 front-end bug scan

Date: 2026-10-28 · From: front-end bug-fix pass on `front-end-bug-scan.md` (tickets/2026-10-27).
Each item below has a front-end workaround or guard already in place. What's left needs a backend change.
The backend was only read, never changed. Item IDs match the scan log.

| # | Area | What the backend should do | Front-end state today | Priority |
|---|------|----------------------------|-----------------------|----------|
| BE-1 | Super Links (AG-1) | Add a way for a recipient to remove a received Super Link from their list (e.g. `DELETE /persona-shares/received/{share_id}`, or `POST …/dismiss`) | The Remove button is gone: it opened "Delete agent?" for the viewer's own copy. It comes back once this exists | High |
| BE-2 | Super Links (AG-2) | Refuse `POST /persona/{repo_id}/use` (the copy) when the received share is revoked, expired or over its credit limit (403/410) | "Use in chat" is disabled unless the link is Active, and the agent-chat check now runs before the copy. A direct API call still copies | Medium |
| BE-3 | Members (TM-1) | Refuse `DELETE /organizations/{id}/members/{user_id}` when it would leave the org with no admin, and refuse self-removal there (point to Leave). Return 409 with a clear `detail` | Remove is hidden on your own row. Not tested against the real endpoint, which would lock the test org | High |
| BE-4 | Library (LB-3, CH-7) | Files the assistant saves are stored with their sandbox folder in the title (`files/Draft_….docx`). Store the base name | The display strips a leading `files/`. Search, sort and exports still see the prefix | Medium |
| BE-5 | Org invites (MS-1) | Add an anonymous invite check (e.g. `GET /org-invite/{id}/exists` → 200/404/410, no org details) so the landing page can say "Invite not found" before sign-up | Only ids that aren't UUIDs are caught. A well-formed but used or unknown id still shows "You're on the list!" until after sign-in | Low |
| BE-6 | Shared chats (SH-1) | (a) Return `can_edit` (or `owner_user_id`) with `GET /chats/{id}/messages`, or let `GET /chats/{id}` answer readers with `can_edit:false`. (b) A send to a chat the caller can read but not write should be 403 "You can only view this chat", not 404 "Chat not found" | The front end uses "`GET /chats/{id}` is 404 but messages load" as the not-owner signal, and shows the read-only view with Make a copy. It costs one extra call for chats missing from the user's list | Medium |
| BE-7 | Custom APIs (CN-1) | Make `POST /connectors/custom` idempotent per user + name + base URL (return the existing unlinked one, or 409 with its slug), and offer cleanup for custom APIs that never got a token | The modal reuses an API it created when a retry has the same name and URL (in this browser session), and refreshes the list so a half-made API shows up | Medium |
| BE-8 | Notifications (DV-1) | Add the last few runs (or a `last_run_status` + `last_run_id`) to `GET /automations`, so the feed doesn't need `GET /automations/{id}` per schedule that ran | Overlapping polls now share one request. Per-schedule detail calls remain for schedules whose run counters changed | Low |
| BE-9 | Profile (AS-9) | Include the user's id (Auth0 `sub`) in `GET /users/me` | The org-id cache is now keyed by the token's `sub`. Before this, every account on a browser shared `souvenir:org-id:undefined` | Low |
| BE-10 | Chat stream (CH-1) | Confirm in the API contract that every finished run ends with `RUN_FINISHED` (or an error), including tool-only and image turns | The front end now treats a stream that closes without either as cut off ("The response was cut off before it finished. Please retry.") | Medium (confirm only) |
| BE-11 | Share / invite ids (MS-2) | Return 404, not 422, for an id that isn't a UUID on `/persona-shares/{id}` previews and `/organizations/invites/{id}` | The front end maps 422 to "Link not found" / "Invite not found" | Low |
| BE-12 | Billing (BL-1, FYI) | All Stripe `success_url`s point to `/onboarding/pricing/confirmation`. `/settings/billing/confirmation` and `/settings/plans-and-billing/confirmation` are never a Stripe target. Decide whether settings top-ups and plan changes should return there (with `?type=`/`?plan=`) | Those pages now show success only with `?type=` or `?plan=`, and redirect otherwise | Low |

## Details

### BE-1 · Remove a received Super Link
The recipient's "Shared Superlinks" table had a Remove button wired to the viewer's **own agent delete** (AG-1, High). With no endpoint to drop a received share, the front end removed the button.
Wanted: an endpoint that hides or deletes the recipient's row (`persona_shares` recipient link), returning 204, plus a `listReceived()` that no longer returns it.

### BE-2 · Copying from a dead link
`receivedShareStatus()` marks a share revoked (`is_active=false`) or expired/limit-reached (`is_available=false`). Live on 2026-10-27, `POST /persona/81c29c71-…/use` succeeded for a **revoked** share and created a second private copy.

### BE-3 · Last admin
Live (DELETE mocked): the sole admin could click Remove on their own row, and the page sent `DELETE /organizations/<org>/members/<own sub>`. Whether the real endpoint accepts it is untested. Please make sure it doesn't, for self or for the last admin.

### BE-6 · Read-only chats opened by URL
A member opening the owner's `/chat?id=` (shared with them) used to get a composer. Sends failed with 404 "Chat not found", which the UI shows as "This chat no longer exists — it may have been deleted."

### BE-7 · Custom API duplicates
Live (mocked): create succeeds, link fails → Cancel → reopen → submit again → a second `POST /connectors/custom`. The front-end fix only helps within one browser session.
