# Account Settings Integration — Change Log

## Overview

This document covers the changes made to wire `/settings/account` to the real backend API, and the supporting changes across `auth-context.tsx` and a new `models.ts` API file. The account page went from a static UI with no persistence to a fully functional profile editor with save, deactivation, and an active-status banner.

---

## Files Changed

### 1. `src/context/auth-context.tsx`

#### What changed

Added `active?: boolean | null` to the `AuthUser` interface:

```ts
active?: boolean | null;
```

Mapped it in `mapProfileToUser`:

```ts
active: profile.active,
```

#### Why

The `GET /users/me` response includes an `active` boolean. When `active: false`, the user's account has been soft-deleted. Without surfacing this field through the auth context, no component could show a deactivated-account banner or conditionally disable the deactivate button.

---

### 2. `src/lib/api/models.ts` — new file

#### What changed

Created a new API module for the LLM models endpoints. Contains two functions and the `LLMModel` type:

**`fetchAllModels()`**

```ts
GET /llm/models/all
```

Returns every model in the system with its `blocked` field included. Used by `/settings/ai-and-models` so users can see and toggle all models, including ones they've blocked. Distinct from `GET /llm/models` (used elsewhere) which silently excludes blocked models.

**`toggleBlockModel(model_id)`**

```ts
PATCH /llm/models/block
Body: { model_id: string }
Returns: { blocked: boolean }
```

Toggles the blocked state of a model for the current user. Returns the actual new state from the backend — important because the API is a toggle, not a set, so the frontend uses the response to reconcile rather than assuming.

#### Why

The existing `workflow-api.ts` only fetched `GET /llm/models` (non-blocked models only) and had no block/unblock capability. Putting the new functions in a dedicated `src/lib/api/models.ts` keeps model API concerns separate from user/billing concerns in `user.ts`, and avoids touching the workflow API which is used in many other places.

---

### 3. `src/app/settings/account/page.tsx`

This is the primary change. The page previously rendered a form with no persistence — the "Save" button didn't exist, the "Delete" button did nothing, and the fields didn't map to the API's actual field names.

#### What changed

---

##### Profile form — separate fields, PATCH wired up

**Before:** Single "Username" input combining first and last name. No save mechanism.

**After:** Four fields — Email (read-only), First name, Last name, Phone number — each mapped to the PATCH body fields the backend expects:

```ts
PATCH /users/me
Body: { first_name, last_name, phone_number }
```

Dirty tracking compares trimmed field values against the current `user.*` context values. The "Save changes" button is disabled until at least one field has been changed, preventing unnecessary API calls:

```ts
const isDirty =
  firstName.trim() !== (user?.firstName ?? "").trim() ||
  lastName.trim()  !== (user?.lastName  ?? "").trim() ||
  phoneNumber.trim() !== (user?.phoneNumber ?? "").trim();
```

On save:
1. Calls `updateUser({ first_name, last_name, phone_number })` from `src/lib/api/user.ts`
2. On success → calls `refreshUser()` so the auth context immediately reflects the new name (avatar initials, sidebar display name, etc.)
3. Shows a success toast or an error toast with the backend's message

---

##### Deactivate account — DELETE wired up with confirmation dialog

**Before:** "Delete Account" button with no handler.

**After:** "Deactivate" button opens a Radix `Dialog` confirmation before calling the API.

The API is `DELETE /users/me` which is a **soft delete** — it sets `active: false` and returns `204 No Content`. The button label was changed from "Delete" to "Deactivate" to accurately reflect this.

Flow:
1. User clicks "Deactivate" → confirmation dialog opens showing their email
2. User confirms → calls `deleteUser()` from `src/lib/api/user.ts`
3. On success → success toast → `logout()` called after 1 second delay (so toast is visible)
4. `logout()` redirects to `/auth/login`

The deactivate button is disabled when `user.active === false` (account already deactivated) to prevent calling a no-op.

---

##### Active-account banner

When `user.active === false`, a red banner is shown at the top of the page:

> **Account deactivated** — Your account has been deactivated. Contact support to restore access.

This is driven by the `active` field now mapped through the auth context (see change #1 above).

---

##### Form state sync

The form uses `useEffectEvent` (React 19 experimental, already used in the original file) to sync field values when the user object first loads from the auth context after hydration. Without this, fields would initialize to empty strings since `user` is `null` on the first render.

---

## API Endpoints Used

| Endpoint | Method | When |
|---|---|---|
| `/users/me` | GET | Auth context on app load + after save via `refreshUser()` |
| `/users/me` | PATCH | On "Save changes" — sends `first_name`, `last_name`, `phone_number` |
| `/users/me` | DELETE | On "Deactivate" confirmation — soft-deletes the account |

---

## What Is Not Handled Here

- **Avatar upload** — the upload button exists in the UI but has no handler. The backend does not have a documented avatar endpoint in this API reference.
- **Email/password change** — the "Edit your Email & Password" button has no handler. This is managed through Auth0 and would require a redirect to Auth0's hosted change-password flow or a custom Auth0 Management API call.
- **Account restore** — after deactivation, restoration requires contacting support. There is no self-serve restore endpoint in the current API.
