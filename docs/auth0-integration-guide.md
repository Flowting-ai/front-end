# Auth0 Integration Guide

The codebase has been fully stripped of the old custom JWT/CSRF auth system and replaced with clean stubs.
This document lists every file that needs to change, exactly what to do, and the exact code to slot in.

---

## Step 0 — Install the SDK

```bash
npm install @auth0/nextjs-auth0
```

---

## Step 1 — Environment Variables

Add to `.env.local`:

```env
AUTH0_SECRET='use-a-long-random-secret-here'     # openssl rand -hex 32
AUTH0_BASE_URL='http://localhost:3000'
AUTH0_ISSUER_BASE_URL='https://YOUR_DOMAIN.auth0.com'
AUTH0_CLIENT_ID='YOUR_CLIENT_ID'
AUTH0_CLIENT_SECRET='YOUR_CLIENT_SECRET'
```

---

## Step 2 — Create the Auth0 Route Handler

**Create:** `src/app/api/auth/[auth0]/route.ts`

```ts
import { handleAuth } from "@auth0/nextjs-auth0";
export const GET = handleAuth();
```

This single file handles `/api/auth/login`, `/api/auth/logout`, `/api/auth/callback`, and `/api/auth/me` automatically.

---

## Step 3 — Wrap the App with `<UserProvider>`

**File:** [`src/app/layout.tsx`](../src/app/layout.tsx)

Replace `<AuthProvider>` with Auth0's `<UserProvider>`:

```tsx
// Remove:
import { AuthProvider } from "@/context/auth-context";

// Add:
import { UserProvider } from "@auth0/nextjs-auth0/client";
```

```tsx
// Before:
<AuthProvider>
  <TokenProvider>
    ...
  </TokenProvider>
</AuthProvider>

// After:
<UserProvider>
  <TokenProvider>
    ...
  </TokenProvider>
</UserProvider>
```

> Once `<UserProvider>` is in place you can delete `<AuthProvider>` entirely.
> `token-context.tsx` still uses `useAuth()` — update it (see Step 6).

---

## Step 4 — Wire the Token into All API Requests

**File:** [`src/lib/jwt-utils.ts`](../src/lib/jwt-utils.ts)

This is the **single insertion point** for Auth0 tokens. Every API call in the app flows through this function.

```ts
// Current stub (no token):
export function getAuthHeaders(
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  return { ...additionalHeaders };
}
```

Replace with (requires calling context — see note below):

```ts
// Option A: Use inside a React component / hook (client-side)
import { useAuth0 } from "@auth0/nextjs-auth0/client";

// Inside a component:
const { getAccessTokenSilently } = useAuth0();
const token = await getAccessTokenSilently();
// Pass token to getAuthHeaders:
getAuthHeaders({ Authorization: `Bearer ${token}` });
```

Because `getAuthHeaders` is called from non-React context (API client), the recommended pattern is:

```ts
// Replace src/lib/jwt-utils.ts entirely:
let _accessToken: string | null = null;

/** Called once from a top-level component after Auth0 initialises. */
export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAuthHeaders(
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  if (_accessToken) {
    return { Authorization: `Bearer ${_accessToken}`, ...additionalHeaders };
  }
  return { ...additionalHeaders };
}
```

Then in a top-level client component (e.g., a new `src/components/auth/TokenSync.tsx`):

```tsx
"use client";
import { useEffect } from "react";
import { useAuth0 } from "@auth0/nextjs-auth0/client";
import { setAccessToken } from "@/lib/jwt-utils";

export function TokenSync() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  useEffect(() => {
    if (!isAuthenticated) return;
    getAccessTokenSilently()
      .then(setAccessToken)
      .catch(() => setAccessToken(null));
  }, [isAuthenticated, getAccessTokenSilently]);
  return null;
}
```

Mount `<TokenSync />` once inside `layout.tsx`.

---

## Step 5 — Auth0 Route Handler for the Chat API Proxy

**File:** [`src/app/api/chat/route.ts`](../src/app/api/chat/route.ts)

This file already forwards the `Authorization` header from the incoming browser request to the backend:

```ts
...(incomingHeaders.get("authorization")
  ? { authorization: incomingHeaders.get("authorization") as string }
  : {}),
```

No changes needed here — as long as the browser request carries the Auth0 `Bearer` token (which `getAuthHeaders()` will inject once Step 4 is done), it will propagate automatically.

---

## Step 6 — Replace `useAuth()` with `useUser()`

**File:** [`src/context/auth-context.tsx`](../src/context/auth-context.tsx)

The current `AuthProvider` / `useAuth()` is a stub. After `<UserProvider>` is in the tree (Step 3), replace all `useAuth()` calls with `useUser()` from Auth0.

```ts
// Replace across the codebase:
import { useAuth } from "@/context/auth-context";
const { user, logout } = useAuth();

// With:
import { useUser } from "@auth0/nextjs-auth0/client";
const { user, isLoading } = useUser();
```

Map Auth0's user object to the existing `AuthUser` interface:

```ts
import type { UserProfile } from "@auth0/nextjs-auth0/client";

function mapAuth0User(auth0User: UserProfile): AuthUser {
  return {
    id: auth0User.sub,
    email: auth0User.email,
    name: auth0User.name,
    // Budget/billing fields come from your own backend (token-context.tsx already handles this)
  };
}
```

**Files that call `useAuth()`** (all currently import from `@/context/auth-context`):

| File | What it uses |
|---|---|
| [`src/context/token-context.tsx`](../src/context/token-context.tsx) | `isHydrated`, `user`, `setUser` |
| [`src/components/layout/app-layout.tsx`](../src/components/layout/app-layout.tsx) | `user` |
| [`src/components/layout/left-sidebar.tsx`](../src/components/layout/left-sidebar.tsx) | `user`, `logout` |
| [`src/app/personaAdmin/page.tsx`](../src/app/personaAdmin/page.tsx) | `user` |
| [`src/app/personas/new/configure/page.tsx`](../src/app/personas/new/configure/page.tsx) | `user` |

---

## Step 7 — Login / Logout / Signup Pages

**File:** [`src/app/auth/login/page.tsx`](../src/app/auth/login/page.tsx)

```tsx
// Replace the TODO comment with:
useEffect(() => {
  router.push("/api/auth/login");
}, [router]);
```

Or delete the file entirely — Auth0's Universal Login replaces it.

**File:** [`src/app/auth/signup/page.tsx`](../src/app/auth/signup/page.tsx)

```tsx
useEffect(() => {
  router.push("/api/auth/login?screen_hint=signup");
}, [router]);
```

**Logout** — In [`src/context/auth-context.tsx`](../src/context/auth-context.tsx), the `logout()` stub:

```ts
const logout = useCallback(() => {
  clearAuth();
  // TODO: Replace with Auth0 logout redirect:
  //   router.push("/api/auth/logout");
}, [clearAuth]);
```

Replace with:

```ts
const logout = useCallback(() => {
  router.push("/api/auth/logout");
}, [router]);
```

---

## Step 8 — Protect Routes (Middleware)

**Create:** `src/middleware.ts`

```ts
import { withMiddlewareAuthRequired } from "@auth0/nextjs-auth0/edge";

export default withMiddlewareAuthRequired();

export const config = {
  matcher: [
    "/chat/:path*",
    "/personas/:path*",
    "/personaAdmin/:path*",
    "/workflows/:path*",
    "/settings/:path*",
  ],
};
```

This redirects unauthenticated users to Auth0 login for all protected routes.

---

## Step 9 — Verify `token-context.tsx` Polling

**File:** [`src/context/token-context.tsx`](../src/context/token-context.tsx)

Currently fires `fetchCurrentUser()` when `isHydrated` is true. After Auth0 is wired:

- Change the `if (!isHydrated)` guard to `if (!isAuthenticated)` (from `useAuth0()`).
- The `fetchCurrentUser()` call already sends `getAuthHeaders()`, so it will automatically carry the Bearer token once Step 4 is done. No other changes needed.

---

---

## Appendix — What Was Removed (CSRF / Custom JWT Cleanup)

All of the following changes were made prior to Auth0 integration to strip out the old custom Django-backed JWT + CSRF authentication system. This is recorded here so you know exactly what was deleted and why nothing will break when Auth0 is wired in.

---

### Core Auth Infrastructure

#### `src/lib/jwt-utils.ts` — **Fully replaced**
- **Removed:** `getJwtToken()`, `setJwtToken()`, `getRefreshToken()`, `setRefreshToken()`, `clearTokens()`, `tryRefreshTokens()`, all localStorage read/write.
- **Now contains:** A single `getAuthHeaders()` stub that returns empty headers. Auth0 token slots in here (see Step 4).

#### `src/context/auth-context.tsx` — **Fully replaced**
- **Removed:** `csrfToken`, `setCsrfToken`, `jwtToken`, `setJwtToken`, `refreshToken`, `setRefreshToken` from context, all localStorage/cookie reads on mount, token refresh on load.
- **Now contains:** `AuthUser` interface (all billing/budget fields preserved), `AuthProvider`, `useAuth()` — all as stubs with TODO comments pointing to Auth0 equivalents.
- **Context value is now:** `{ user, isHydrated, setUser, clearAuth, logout }`.

#### `src/lib/api/client.ts` — **Fully replaced**
- **Removed:** CSRF token injection into every request (`X-CSRFToken` header), `tryRefreshTokens()` mutex/retry on 401, 3rd `csrfToken` positional argument on `apiFetch()`.
- **Now contains:** `apiFetch(path, options)` — sets headers via `getAuthHeaders()`, dispatches `auth:session-expired` on 401 (Auth0 handles the actual refresh silently).

#### `src/lib/config.ts` — **Endpoints removed**
- **Removed constants:** `CSRF_INIT_ENDPOINT`, `LOGIN_ENDPOINT`, `SIGNUP_ENDPOINT`, `TOKEN_REFRESH_ENDPOINT`, `LOGOUT_ENDPOINT`.
- **Removed PATHS entries:** `csrfInit`, `login`, `signup`, `tokenRefresh`, `logout`.
- All data endpoints are untouched.

#### `src/lib/security.ts` — **Partial cleanup**
- **Removed:** `isValidCSRFToken()` function.
- All other sanitization utilities (XSS, URL validation, etc.) are preserved.

#### `src/lib/api-client.ts` — **Partial cleanup**
- **Removed:** Private `getJwtToken()` duplicate, `csrfToken` parameter and `X-CSRFToken` header injection from `securePost()` and `secureUpload()`.
- **Added:** `import { getAuthHeaders }` from `jwt-utils`.
- **Signature changes:**
  - `securePost(url, data, options?)` — was `securePost(url, data, csrfToken, options?)`
  - `secureUpload(url, file, options?)` — was `secureUpload(url, file, csrfToken, options?)`

#### `src/context/token-context.tsx` — **Cleaned**
- **Removed:** `csrfToken` and `jwtToken` from `useAuth()` destructure.
- Polling now fires when `isHydrated` is true (was gated on `jwtToken` being present).

---

### API Layer — All `csrfToken` Parameters Removed

Every function in `src/lib/api/` had its `csrfToken?: string | null` parameter removed. The internal `apiFetch()` call no longer accepts or needs it.

| File | Functions changed |
|---|---|
| [`src/lib/api/chat.ts`](../src/lib/api/chat.ts) | `fetchChatBoards()`, `fetchChatMessages()`, `createChat()`, `renameChat()` — also removed `extractCsrfToken()` helper and `csrfToken` field from `FetchChatBoardsResult` / `CreateChatResult` types |
| [`src/lib/api/pins.ts`](../src/lib/api/pins.ts) | All 11 functions. **Note:** `createPin()` signature changed — old `createPin(chatId, messageId, csrfToken?, options?)` is now `createPin(chatId, messageId, options?)` |
| [`src/lib/api/personas.ts`](../src/lib/api/personas.ts) | All 7 functions |
| [`src/lib/api/documents.ts`](../src/lib/api/documents.ts) | `uploadDocument()`, `searchDocuments()` — also removed from `UploadDocumentParams` type |
| [`src/lib/api/images.ts`](../src/lib/api/images.ts) | `generateImage()` — also removed from `GenerateImageParams` type |
| [`src/lib/api/messages.ts`](../src/lib/api/messages.ts) | `addReaction()`, `removeReaction()` |
| [`src/lib/api/tokens.ts`](../src/lib/api/tokens.ts) | All token-related functions |
| [`src/lib/api/user.ts`](../src/lib/api/user.ts) | `fetchCurrentUser()`, `updateUser()` |

---

### Auth Pages

#### `src/app/auth/login/page.tsx` — **Replaced with stub**
- Old page had a full login form posting credentials to the Django backend.
- Now: blank page with `TODO: router.push("/api/auth/login")` comment.

#### `src/app/auth/signup/page.tsx` — **Replaced with stub**
- Old page had a registration form.
- Now: blank page with `TODO: router.push("/api/auth/login?screen_hint=signup")` comment.

#### `src/app/api/chat/route.ts` — **CSRF forwarding removed**
- Was: extracted and forwarded `X-CSRFToken` header to the backend streaming endpoint.
- Now: only forwards `Authorization: Bearer ...` header.

---

### Components — `csrfToken` and `getJwtToken` Removed

All `getJwtToken` direct imports were replaced with `getAuthHeaders`. All `csrfToken` destructures from `useAuth()` were removed.

| File | What changed |
|---|---|
| [`src/components/chat/chat-interface.tsx`](../src/components/chat/chat-interface.tsx) | Removed `csrfToken` from `useAuth()`, removed `getCsrfToken()` helper, removed `X-CSRFToken` from 3 fetch calls, removed `csrfToken` from `uploadDocument()` and `fetchPersonasApi()` |
| [`src/components/chat/model-switch-dialog.tsx`](../src/components/chat/model-switch-dialog.tsx) | `getJwtToken` → `getAuthHeaders()` for models fetch |
| [`src/components/chat/model-selector-dialog.tsx`](../src/components/chat/model-selector-dialog.tsx) | `getJwtToken` → `getAuthHeaders()` for models fetch |
| [`src/components/compare/compare-models.tsx`](../src/components/compare/compare-models.tsx) | `getJwtToken` → `getAuthHeaders()`, removed `useAuth` import, removed `csrfToken` from `apiFetch` call |
| [`src/components/personas/PersonaChatFullPage.tsx`](../src/components/personas/PersonaChatFullPage.tsx) | `getJwtToken` → `getAuthHeaders()`, removed `csrfToken` from `useAuth()` and request headers |
| [`src/components/layout/right-sidebar.tsx`](../src/components/layout/right-sidebar.tsx) | Removed `useAuth` import entirely, removed `csrfToken` from all 10 pin/folder operation call sites and dependency arrays |
| [`src/components/layout/left-sidebar.tsx`](../src/components/layout/left-sidebar.tsx) | Removed `csrfToken` from `useAuth()`, removed `if (csrfToken !== undefined)` guard, removed from `apiFetch` and `renameChat` calls |
| [`src/components/layout/app-layout.tsx`](../src/components/layout/app-layout.tsx) | Removed `csrfToken`, `setCsrfToken` from `useAuth()`, removed `csrfTokenRef`, removed sync `useEffect`, removed from `renameChat`, `apiFetch` (star toggle), `fetchChatMessages`, `fetchAllPins`, `fetchPersonasApi`, `createPin`, `deletePin`, `createChat` — also removed `freshToken` CSRF extraction from `createChat` result and the token-swap `if` block |
| [`src/app/personaAdmin/page.tsx`](../src/app/personaAdmin/page.tsx) | Removed `csrfToken` from `useAuth()`, removed `csrfTokenRef`, removed from `fetchPersonas`, `updatePersona`, `deletePersonaApi` |
| [`src/app/personas/page.tsx`](../src/app/personas/page.tsx) | Removed `csrfToken` from `useAuth()`, removed from `fetchPersonas` (×2) and `deletePersonaApi`, cleaned dependency arrays |
| [`src/app/personas/new/configure/page.tsx`](../src/app/personas/new/configure/page.tsx) | `getJwtToken` → `getAuthHeaders()`, removed `csrfToken` from `useAuth()`, removed from `fetchPersonaById`, `enhance()`, `updatePersona`, `createPersona`, cleaned dependency array |
| [`src/app/personas/new/configure/hooks/use-enhancement.ts`](../src/app/personas/new/configure/hooks/use-enhancement.ts) | Removed `csrfToken` param from `enhance()` interface and implementation, removed from `analyzePersona()` call |

---

## Summary Checklist

| # | Task | File(s) |
|---|---|---|
| 0 | `npm install @auth0/nextjs-auth0` | — |
| 1 | Add env vars to `.env.local` | `.env.local` |
| 2 | Create Auth0 route handler | `src/app/api/auth/[auth0]/route.ts` *(new)* |
| 3 | Add `<UserProvider>` to layout, remove `<AuthProvider>` | `src/app/layout.tsx` |
| 4 | Implement `getAuthHeaders()` with real token | `src/lib/jwt-utils.ts` + new `TokenSync.tsx` |
| 5 | Chat proxy — no change needed | `src/app/api/chat/route.ts` ✅ |
| 6 | Replace `useAuth()` with `useUser()` across app | See table above |
| 7 | Wire login/logout/signup redirects | `src/app/auth/login/page.tsx`, `signup/page.tsx`, `auth-context.tsx` |
| 8 | Add route protection middleware | `src/middleware.ts` *(new)* |
| 9 | Update `token-context.tsx` polling guard | `src/context/token-context.tsx` |
