# Users Endpoints — Frontend Usage Map

Cross-references every `/users/*` backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), and [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md).

5 endpoints exist in this group, all wrapped in `src/lib/api/user.ts`. **4 are actively used; 1 (`DELETE /users/me`) has a defined wrapper with zero callers** — the account-deletion UI it would back exists but is an intentional, unwired stub. Two unrelated paths that also match "user" in the OpenAPI spec (`POST /memory/user`, `GET /slack/user/authorize`) are out of scope — they belong to the memory and Slack-connector features respectively, not the users resource.

Structural note: `src/lib/api/current-user.ts` wraps `fetchCurrentUser()` in a small `CurrentUser` class (`currentUser` singleton) that adds a 30s TTL cache + in-flight-request dedupe on top of the raw GET — every consumer goes through this singleton (`currentUser.load()`/`.refresh()`), not the raw wrapper directly, except `auth-context.tsx` itself.

---

## `GET /users/me` (Get Me)
- **`config.ts`**: `USER_ENDPOINT`
- **Wrapper**: `fetchCurrentUser()` (`user.ts`) — always wrapped via the `currentUser` singleton (`current-user.ts`).
- **Used by**:
  - `context/auth-context.tsx` — `currentUser.load()` fires once after hydration (deliberately not re-triggered by the 30s token-refresh timer, only by explicit `refreshUser()` calls) to populate `user` on the auth context.
  - `auth-context.tsx`'s `refreshUser()` — calls `currentUser.refresh()` (bypasses the TTL). Triggered by:
    - a `credits:updated` window event (e.g. after a credit top-up), so balances update app-wide without a page reload.
    - `settings/account/page.tsx`'s `handleSave()` — after saving name/avatar/role/tone changes.
    - `billing/page.tsx`, `billing/confirmation/page.tsx`, `settings/(org)/plans/confirmation/page.tsx`, `onboarding/pricing/confirmation/page.tsx` — after returning from a Stripe checkout/plan-change flow, to pick up the new plan/credits.
    - `onboarding/team/[inviteId]/page.tsx`, `components/onboarding/WelcomeModal.tsx`, `context/org-context.tsx` — reconciling the profile at various onboarding/org-switch points.

## `POST /users/create` (Create User)
- **`config.ts`**: `USER_CREATE_ENDPOINT`
- **Wrapper**: `createUser()` (`user.ts`)
- **Used by**: the two "first screen after signup" entry points into onboarding —
  - `onboarding/hello/page.tsx` — fired (fire-and-forget, `void createUser()`) as soon as the Hello step mounts, provisioning the backend user record before the rest of onboarding collects profile data.
  - `onboarding/team/[inviteId]/profile/page.tsx` — same fire-and-forget call, for someone landing on an invite link who doesn't have a user record yet.

## `PATCH /users/me` (Update Me)
- **`config.ts`**: `USER_ENDPOINT` (same constant as GET, PATCH verb)
- **Wrapper**: `updateUser(payload)` (`user.ts`) — accepts `first_name`/`last_name`/`nickname`/`phone_number`/`profile_picture`.
- **Used by**:
  - Onboarding name-capture steps — `onboarding/hello/page.tsx`, `onboarding/import/page.tsx`, `onboarding/tone/page.tsx`, `onboarding/invite/page.tsx`, `onboarding/team/[inviteId]/profile/page.tsx` — each saves `first_name`/`last_name` once the user enters their name on that step.
  - `settings/account/page.tsx`'s `handleSave()` — clicking **Save** on the Account settings page after editing display name and/or uploading a new avatar (avatars are downscaled/center-cropped client-side to a 256×256 JPEG data URL and sent as `profile_picture` — there's no separate file-upload endpoint).
  - `settings/(org)/members/page.tsx` — a background self-healing effect: if the viewer's own row in the org member list shows a stale/placeholder name (empty or literally "Someone"), it silently PATCHes the real name up from the auth context, then updates local state to match.

## `PATCH /users/me/onboarding` (Patch My Onboarding)
- **`config.ts`**: `USER_ONBOARDING_ENDPOINT`
- **Wrapper**: `updateOnboarding(payload)` (`user.ts`) — accepts `user_role`/`ai_tone`/`role_fit`/`onboarding_completed`; maps frontend display labels (e.g. "Marketer", "Warm") to backend enum values (`marketing_sales`, `empathetic`) via `ROLE_API_MAP`/`TONE_API_MAP`, and silently drops `role_fit` if it isn't one of the three valid enum values (avoids 422s from stale/free-text values). The reverse maps (`roleDisplayLabel()`/`toneDisplayLabel()`) are also exported and used wherever a raw enum needs to render as a friendly label.
- **Used by**:
  - `onboarding/hello/page.tsx`, `onboarding/import/page.tsx`, `onboarding/invite/page.tsx`, `onboarding/team/[inviteId]/profile/page.tsx` — saving `user_role` as each onboarding step collects it.
  - `onboarding/workspace/page.tsx` — saving `role_fit` (team-size) once selected.
  - `onboarding/tone/page.tsx` — saving `ai_tone` (and the accumulated role/tone payload) as the final onboarding step.
  - `onboarding/team/[inviteId]/page.tsx` — `onboarding_completed: true`, fired when a team-invite recipient finishes the invite-acceptance flow.
  - `settings/account/page.tsx`'s `handleSave()` — saving role/tone edits made from the Account settings page after initial onboarding.

## `DELETE /users/me` (Delete Me) — dead
- **`config.ts`**: `USER_ENDPOINT` (same constant, DELETE verb)
- **Wrapper**: `deleteUser()` (`user.ts`) — defined, zero call sites anywhere (verified via grep: the only match in `src/` is its own definition).
- **Why it's dead, not just missing:** `settings/account/page.tsx` already has the "Delete account" UI — a danger-zone card with copy reading *"Permanently delete your account and all associated data, personas, workflows, and pins. This action cannot be undone,"* and a **Delete account** button. But its `onClick` handler, `handleDeleteAccount`, is an explicit stub:
  ```ts
  const handleDeleteAccount = () => {
    // TODO: open confirmation dialog before proceeding
  }
  ```
  The button and copy are shipped; the confirmation dialog and the `deleteUser()` call it would make are not wired up yet.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /users/me` | Live — `fetchCurrentUser()` via the `currentUser` cache singleton |
| `POST /users/create` | Live — `createUser()` |
| `PATCH /users/me` | Live — `updateUser()` |
| `PATCH /users/me/onboarding` | Live — `updateOnboarding()` |
| `DELETE /users/me` | **Dead** — `deleteUser()` defined, zero callers; UI exists but its handler is an unimplemented TODO stub |
