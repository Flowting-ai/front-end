# Auth0 — End-to-End Authentication Spec

This document mirrors the **complete** Auth0 implementation that ships in [`front-end/`](../front-end/) so the same system can be recreated, identically, in [`front-end-new/`](.). The system is built on `@auth0/nextjs-auth0` v4 against Next.js 16 (App Router, React Compiler enabled). Routing in Next.js 16 uses **`src/proxy.ts`** (the renamed `middleware.ts`) — the file name is the only change versus 15.x, the behavior is identical.

The reference implementation lives at:

- [`front-end/src/lib/auth0.ts`](../front-end/src/lib/auth0.ts)
- [`front-end/src/proxy.ts`](../front-end/src/proxy.ts)
- [`front-end/src/app/auth/[auth0]/route.ts`](../front-end/src/app/auth/%5Bauth0%5D/route.ts)
- [`front-end/src/app/auth/access-token/route.ts`](../front-end/src/app/auth/access-token/route.ts)
- [`front-end/src/lib/jwt-utils.ts`](../front-end/src/lib/jwt-utils.ts)
- [`front-end/src/context/auth-context.tsx`](../front-end/src/context/auth-context.tsx)
- [`front-end/src/lib/api/client.ts`](../front-end/src/lib/api/client.ts)
- [`front-end/src/lib/onboarding-access.ts`](../front-end/src/lib/onboarding-access.ts)
- [`front-end/src/app/api/onboarding/logout/route.ts`](../front-end/src/app/api/onboarding/logout/route.ts)
- [`front-end/src/app/api/stripe/checkout/route.ts`](../front-end/src/app/api/stripe/checkout/route.ts)
- [`front-end/src/app/api/stripe/subscription/route.ts`](../front-end/src/app/api/stripe/subscription/route.ts)
- [`front-end/scripts/load-secrets.mjs`](../front-end/scripts/load-secrets.mjs)
- [`front-end/next.config.ts`](../front-end/next.config.ts)

---

## 1. High-level architecture

```
                          ┌──────────────────────────────────────────┐
                          │       Auth0 Tenant (dev-…us.auth0.com)   │
                          │   ┌─────────────┐    ┌─────────────────┐ │
                          │   │ Universal   │    │  M2M / Audience │ │
                          │   │ Login UI    │    │ "https://server-│ │
                          │   │             │    │  access"        │ │
                          │   └──────▲──────┘    └─────▲───────────┘ │
                          └──────────┼──────────────────┼────────────┘
                                     │ OIDC redirect    │ JWT (RS256)
                                     │                  │
                       ┌─────────────┼──────────────────┼────────────┐
                       │  Next.js (front-end-new)       │            │
                       │                                │            │
                       │   /auth/[auth0]/route.ts ──────┘            │
                       │     (login / logout / callback /            │
                       │      profile / access-token — handled by    │
                       │      Auth0Client.middleware)                │
                       │                                              │
                       │   /auth/access-token/route.ts                │
                       │     (explicit override that returns          │
                       │     { token } for the configured audience)   │
                       │                                              │
                       │   src/proxy.ts                               │
                       │     - Calls auth0.getSession() / getAccess-  │
                       │       Token() to gate the app                │
                       │     - Reads /users/me from backend with      │
                       │       Bearer token to compute onboarding     │
                       │       state                                  │
                       │     - Redirects to /auth/login or            │
                       │       /onboarding/<step> as needed           │
                       │                                              │
                       │   src/context/auth-context.tsx               │
                       │     - Hydrates an in-memory access token     │
                       │     - Refresh timer (every 30 s)             │
                       │     - Fetches /users/me once authenticated   │
                       │     - Exposes useAuth()                      │
                       │                                              │
                       │   src/lib/api/client.ts                      │
                       │     - apiFetch()/apiFetchJson() inject the   │
                       │       Bearer header, retry once on 401,      │
                       │       and emit "auth:session-expired"        │
                       └─────────────┬──────────────────────────┬─────┘
                                     │ Bearer <JWT>             │ Bearer <JWT>
                                     ▼                          ▼
                       ┌──────────────────────────┐  ┌──────────────────────────┐
                       │ Stripe (server-only,     │  │ Backend API              │
                       │ session via              │  │ devapi.getsouvenir.com   │
                       │ auth0.getSession())      │  │ /users/me, /chats, …     │
                       └──────────────────────────┘  └──────────────────────────┘
```

**Two token surfaces, on purpose:**

1. **Browser (client) tokens** — fetched by `getAccessToken()` from `@auth0/nextjs-auth0/client` and held in a module-scoped variable in [`src/lib/jwt-utils.ts`](../front-end/src/lib/jwt-utils.ts). Used to attach `Authorization: Bearer …` headers to every backend API call.
2. **Server-side tokens** — fetched by `auth0.getAccessToken({ audience })` inside route handlers and `proxy.ts`. Used by the proxy to call `/users/me` to compute the onboarding gate, and by the override at `/auth/access-token` to return a JSON-wrapped token to the browser.

Both eventually end up passing the **same JWT** issued by the Auth0 tenant for the configured `AUTH0_AUDIENCE`.

---

## 2. Required environment variables

All of these are loaded from AWS Secrets Manager into `.env.development.local` by [`scripts/load-secrets.mjs`](../front-end/scripts/load-secrets.mjs) (a `predev` / `prebuild` / `prestart` hook). The bootstrap file `.env.local` only needs the AWS credentials.

| Var | Used by | Purpose |
| --- | --- | --- |
| `AUTH0_DOMAIN` | `Auth0Client`, `/api/onboarding/logout` | Tenant domain, e.g. `dev-ijkaxwzxou50ffmt.us.auth0.com`. SDK reads it implicitly; we also use it directly to build the universal-logout URL. |
| `AUTH0_CLIENT_ID` | `Auth0Client`, `/api/onboarding/logout` | OIDC client. Required for the universal logout query string. |
| `AUTH0_CLIENT_SECRET` | `Auth0Client` | Used by the SDK during the authorization-code exchange. |
| `AUTH0_SECRET` | `Auth0Client` | 32-byte hex value used to encrypt the session cookie (`appSession`). Generate with `openssl rand -hex 32`. |
| `AUTH0_AUDIENCE` | `Auth0Client`, `/auth/access-token`, `proxy.ts`, `jwt-utils.ts` | API identifier, e.g. `https://server-access`. Triggers issuance of an access token (not just an ID token). Re-exported via `next.config.ts` `env:` so `process.env.AUTH0_AUDIENCE` is readable on the client. |
| `AUTH0_SCOPE` | `Auth0Client` | Optional. Defaults to `"openid profile email offline_access"` — `offline_access` is **mandatory** so the SDK gets a refresh token. |
| `APP_BASE_URL` | `Auth0Client.onCallback`, Stripe routes | Public origin of the running app (`http://localhost:3000/` in dev). The SDK uses this for the callback redirect; Stripe uses it to build `success_url` / `cancel_url`. |
| `SERVER_URL` | `proxy.ts`, `src/lib/config.ts` | Backend base URL. Dev value: `https://devapi.getsouvenir.com/`. Re-exported via `next.config.ts` `env:` so client code can read it. |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*` | `/api/stripe/*` | Stripe server-only keys; checkout routes require an authenticated Auth0 session before they will create a session. |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | `mixpanel-provider` | Not auth, but loaded by the same secrets bootstrap. |

> **Why `AUTH0_AUDIENCE` is re-exported in `next.config.ts`:** the client-side `getAccessToken({ audience })` call in [`jwt-utils.ts`](../front-end/src/lib/jwt-utils.ts#L51-L57) needs to read `process.env.AUTH0_AUDIENCE` at runtime in the browser. Next.js does not automatically expose non-`NEXT_PUBLIC_*` envs to the client, so [`next.config.ts`](../front-end/next.config.ts#L60-L63) opts it in:
>
> ```ts
> env: {
>   AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
>   SERVER_URL: process.env.SERVER_URL,
> },
> ```

### CSP must allow Auth0

[`next.config.ts:23-24,44`](../front-end/next.config.ts#L23-L44) adds the Auth0 origin to `connect-src`:

```ts
const auth0Domain = process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}` : "";
const connectSrcOrigins = [
  backendOrigin,
  backendWsOrigin,
  "https://app.getsouvenir.com",
  ...(auth0Domain ? [auth0Domain] : ["https://*.us.auth0.com"]),
];
```

Without this, the silent token refresh from the SPA fails with a CSP violation.

---

## 3. NPM packages

From [`front-end/package.json`](../front-end/package.json#L16):

```json
"@auth0/nextjs-auth0": "^4.16.0"
```

That single package provides everything: the `Auth0Client` class (server entry), the `getAccessToken()` SPA hook (client entry), and the auto-mounted route handlers.

`front-end-new` should pin to the **same** major version (`^4.x`). The v3 → v4 API is materially different — the `proxy.ts` middleware surface, `Auth0Client` constructor, and the `getAccessToken({ audience })` overloads are all v4-only.

---

## 4. The single source of truth: `src/lib/auth0.ts`

```ts
// front-end/src/lib/auth0.ts
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

const audience = process.env.AUTH0_AUDIENCE?.trim();
const scope =
  process.env.AUTH0_SCOPE?.trim() || "openid profile email offline_access";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    ...(audience ? { audience } : {}),
    scope,
  },

  /**
   * After every Auth0 login/signup callback:
   *  - On error → /auth/login.
   *  - On success → "/" (the app shell). The proxy then routes the user
   *    into onboarding if the backend says it is incomplete.
   */
  onCallback: async (error) => {
    const baseUrl = process.env.APP_BASE_URL!;
    if (error) return NextResponse.redirect(new URL("/auth/login", baseUrl));
    return NextResponse.redirect(new URL("/", baseUrl));
  },
});
```

Key points:

- `audience` is omitted from `authorizationParameters` when unset so the SDK falls back to ID-token-only mode (the dev tenant always has it set).
- `offline_access` is included by default so the SDK receives a refresh token. Without it, `auth0.getAccessToken()` calls eventually fail with `missing_refresh_token` and `proxy.ts` triggers a re-auth (see §6).
- `onCallback` always sends users to `/` after successful login. The onboarding decision is **never** made here — it is made in the proxy on the next request, against the live backend state. This matters because Stripe webhooks may flip the user’s `subscription_status` to `active` before the `onboarding.completed` flag flips, and we want the user to land on the app immediately in that case.

[`front-end-new/src/lib/auth0.ts`](src/lib/auth0.ts) already contains a 1:1 copy of this file. **Do not deviate.**

---

## 5. Auth route handlers

### 5.1 The catch-all: `src/app/auth/[auth0]/route.ts`

```ts
import type { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function GET(request: NextRequest) {
  return auth0.middleware(request);
}

export async function POST(request: NextRequest) {
  return auth0.middleware(request);
}
```

This single handler is what makes the following endpoints work — the SDK matches on the dynamic `[auth0]` segment and dispatches internally:

| Endpoint | Method | Behavior |
| --- | --- | --- |
| `/auth/login` | GET | Redirects to Auth0's `/authorize` with PKCE. Honors `?returnTo=…`. |
| `/auth/logout` | GET | Clears the SDK session cookie and redirects to Auth0's `/v2/logout` (`returnTo` derived from `APP_BASE_URL`). |
| `/auth/callback` | GET | OAuth2 authorization-code exchange; runs `onCallback` from `auth0.ts`. |
| `/auth/profile` | GET | Returns the OIDC user profile JSON. |
| `/auth/access-token` | GET | Default SDK behavior: returns `{ accessToken, expiresAt }` for the configured audience — **but we override this** (see 5.2). |
| `/auth/backchannel-logout` | POST | Auth0 back-channel logout endpoint. |

The matcher in [`proxy.ts`](../front-end/src/proxy.ts#L98-L101) explicitly forwards every `/auth/*` request to `auth0.middleware(request)` so it never gets blocked by the onboarding gate.

### 5.2 The explicit override: `src/app/auth/access-token/route.ts`

```ts
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export const dynamic = "force-dynamic";

export async function GET() {
  const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined;

  try {
    const { token } = await auth0.getAccessToken({ audience });
    return NextResponse.json({ token });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch access token";
    return NextResponse.json(
      { error: { code: "access_token_error", message } },
      { status: 401 },
    );
  }
}
```

This file shadows the catch-all for `/auth/access-token` because:

1. We want a stable response shape (`{ token }`) instead of the SDK's `{ accessToken, expiresAt }` so the in-memory client cache decoder can stay simple.
2. We want a typed 401 error envelope (`{ error: { code, message } }`) instead of a string when the user has no refresh token — the client can act on this.
3. `dynamic = "force-dynamic"` prevents Next.js from caching the response, which would otherwise cap the lifetime of the token at the build cache.

### 5.3 The onboarding-only logout: `src/app/api/onboarding/logout/route.ts`

```ts
import { NextResponse } from "next/server";

export async function GET() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const returnTo = "https://getsouvenir.com";

  const logoutUrl = new URL(`https://${domain}/v2/logout`);
  logoutUrl.searchParams.set("client_id", clientId!);
  logoutUrl.searchParams.set("returnTo", returnTo);

  const response = NextResponse.redirect(logoutUrl.toString());
  response.cookies.delete("appSession");
  for (let i = 0; i < 5; i++) response.cookies.delete(`appSession.${i}`);
  return response;
}
```

A two-step logout used **only** by the onboarding pages:

1. Clear the SDK session cookie (`appSession`, plus the chunked variants `appSession.0` … `appSession.4` that the SDK uses when the cookie is large).
2. Browser-redirect to `https://<AUTH0_DOMAIN>/v2/logout?client_id=…&returnTo=…` to terminate the IdP session as well.

Anywhere outside onboarding the app uses `/auth/logout` (the SDK route) directly; see the `logout()` callback in [`auth-context.tsx`](../front-end/src/context/auth-context.tsx#L222-L228).

---

## 6. The proxy / middleware: `src/proxy.ts`

> Next.js 16 renames `middleware.ts` → **`proxy.ts`**. The export and matcher format are unchanged. The reference repo and `front-end-new` both already use the new name.

The full file is in [`front-end/src/proxy.ts`](../front-end/src/proxy.ts). Behavior, in order:

1. **Always pass `/auth/*` and `/api/*` through to `auth0.middleware(request)`.** The SDK middleware refreshes session cookies and signs them. Onboarding gating must never block these.
2. **Get the session.** `await auth0.getSession()` reads the encrypted `appSession` cookie. `null` means no session.
3. **Get the onboarding gate** by calling the backend (`fetchOnboardingState` below) — but only when there is a session.
4. **Re-auth detection.** If `auth0.getAccessToken()` throws with `code === "missing_refresh_token"`, redirect to `/auth/login?returnTo=<pathname>` so the user can re-consent and the SDK can mint a new refresh token.
5. **Block re-entry into completed onboarding.** If `pathname` starts with `/onboarding/`, the user has finished onboarding (`hasOnboarded`), and they are not on the pricing page, redirect them home (`/`).
6. **Allow incomplete-onboarding users into `/onboarding/*`.** Pass through the SDK middleware.
7. **Force incomplete onboarding for app routes.** If `session && hasKnownOnboardingState && !hasOnboarded && !justCompletedCheckout`, redirect to `onboarding.nextPath`.
8. **Drain the `souvenir_checkout_complete=1` cookie.** Stripe's success URL sets this short-lived cookie so the user can use the app for the seconds between checkout and the webhook flipping `subscription_status`. Once consumed, the cookie is cleared.
9. **Force login when there is no session.** Redirect to `/auth/login?returnTo=<pathname>`.
10. **Otherwise, pass through `auth0.middleware(request)`** so cookies stay refreshed.

```ts
async function fetchOnboardingState(): Promise<OnboardingStateResult> {
  try {
    if (!apiBaseUrl) return { data: null, requiresReauth: false };
    const { token } = await auth0.getAccessToken({ audience });
    if (!token) return { data: null, requiresReauth: false };

    const response = await fetch(`${apiBaseUrl}${ONBOARDING_ENDPOINT_PATH}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return { data: null, requiresReauth: false };

    const data = (await response.json()) as Record<string, unknown>;
    const root = (data.data ?? data.user ?? data) as Record<string, unknown>;

    return {
      data: {
        allowsMainApp: userMeRootAllowsMainApp(root),
        nextPath: determineNextOnboardingPath(root),
      },
      requiresReauth: false,
    };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "missing_refresh_token") return { data: null, requiresReauth: true };
    if (!hasLoggedOnboardingFetchFailure) {
      hasLoggedOnboardingFetchFailure = true;
      console.warn("Failed to fetch onboarding state", error);
    }
    return { data: null, requiresReauth: false };
  }
}
```

Key invariants:

- The proxy uses **`cache: "no-store"`** when calling `/users/me`. Stale onboarding state would let users into the app prematurely.
- It calls `auth0.getAccessToken({ audience })` (the **server-side** entry). On the proxy edge, the SDK reads the refresh token from the encrypted cookie and exchanges it with Auth0 if necessary.
- The matcher excludes static assets:

  ```ts
  export const config = {
    matcher: [
      "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
  };
  ```

### Onboarding step inference

`determineNextOnboardingPath(root)` reads the `/users/me` response and returns the next missing step:

| Missing field | Redirect to |
| --- | --- |
| `user_role` (or `userRole`) | `/onboarding/username` |
| `ai_tone` (or `aiTone`) | `/onboarding/tone` |
| `role_fit` (or `roleFit`) | `/onboarding/org-size` |
| (everything else filled) | `/onboarding/pricing` |

`userMeRootAllowsMainApp(root)` (from [`onboarding-access.ts`](../front-end/src/lib/onboarding-access.ts)) returns `true` when **either**:

1. `onboarding.completed === true` or `onboarding.metadata.status === "complete"`, **or**
2. The user has an active paid subscription (`plan_type ∈ {starter, pro, power}` **and** `subscription_status ∈ {active, trialing}`). This second branch is what lets the Stripe-just-completed user into the app even before the backend flips `onboarding.completed`.

---

## 7. Client-side token cache: `src/lib/jwt-utils.ts`

```ts
import { getAccessToken } from "@auth0/nextjs-auth0/client";
import { audience } from "@/lib/config";

let inMemoryAccessToken: string | null = null;
let tokenExpiresAt: number | null = null;
const EXPIRY_BUFFER_SECONDS = 60;

function parseTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch { return null; }
}

export function setInMemoryAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
  tokenExpiresAt = token ? parseTokenExpiry(token) : null;
}
export function getInMemoryAccessToken(): string | null { return inMemoryAccessToken; }
export function clearInMemoryAccessToken(): void { inMemoryAccessToken = null; tokenExpiresAt = null; }

export function isTokenExpiringSoon(): boolean {
  if (!inMemoryAccessToken || tokenExpiresAt === null) return true;
  return Math.floor(Date.now() / 1000) >= tokenExpiresAt - EXPIRY_BUFFER_SECONDS;
}

export async function getAuth0AccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const token = audience
      ? await getAccessToken({ audience })
      : await getAccessToken();
    const normalized = typeof token === "string" && token.length > 0 ? token : null;
    setInMemoryAccessToken(normalized);
    return normalized;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Failed to fetch Auth0 access token", error);
    }
    setInMemoryAccessToken(null);
    return null;
  }
}

export async function ensureFreshToken(): Promise<string | null> {
  if (isTokenExpiringSoon()) return getAuth0AccessToken();
  return inMemoryAccessToken;
}

export function getAuthHeaders(
  additional: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...additional };
  if (inMemoryAccessToken) headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  return headers;
}
```

Behavioral contract:

- The token lives only in module scope — never `localStorage`, never `sessionStorage`. Browser tabs are isolated by design.
- `getAccessToken({ audience })` from the SPA SDK is what calls the override endpoint at `/auth/access-token` under the hood. (The SDK reads the response body, sets the SPA cache, returns the token string.)
- `parseTokenExpiry` does a base64 decode of the JWT body. The 60-second buffer (`EXPIRY_BUFFER_SECONDS`) is wide enough to absorb clock skew without triggering an unnecessary refresh on every request.
- `getAuthHeaders()` is **synchronous** by design — it is called all over the codebase and adding `await` there would propagate. `ensureFreshToken()` is called once at the entry of `apiFetch` to make sure the cached value is up to date.

---

## 8. The provider: `src/context/auth-context.tsx`

The `AuthProvider` wraps the entire tree (mounted in [`src/app/layout.tsx`](../front-end/src/app/layout.tsx#L57-L62)). Responsibilities:

1. **Hydrate** on mount — call `getAuth0AccessToken()` once to populate the in-memory cache.
2. **Refresh timer** — every 30 s, if `isTokenExpiringSoon()`, fetch a new token. This handles idle tabs whose token would otherwise expire silently.
3. **Fetch user profile** — once `isHydrated && jwtToken`, call `/users/me` once and map it into an `AuthUser` (which includes plan, billing, credits, etc.). The mapping is in `mapProfileToUser`.
4. **Logout** — clears in-memory token + `setUser(null)`, then sets `window.location.href = "/auth/logout?returnTo=…"`. The SDK route handles cookie cleanup and IdP redirect.
5. **`auth:session-expired` listener** — when `apiFetch` decides the session is dead (see §9), it dispatches a custom event; the provider catches it and triggers `logout()`.

```tsx
const isAuthenticated = isHydrated && jwtToken !== null;
```

This boolean is what the rest of the app uses to gate UI. **No round-trip is required** — having a non-null in-memory token is the source of truth for "logged in" in the browser.

The `AuthUser` interface ([`auth-context.tsx:29-67`](../front-end/src/context/auth-context.tsx#L29-L67)) is a superset of the `/users/me` response that pre-computes display fields (`creditsDisplay`, `budgetConsumedPercent`, `nextBillingDate`).

---

## 9. The API client: `src/lib/api/client.ts`

```ts
export async function apiFetch(path, options = {}) {
  await ensureFreshToken();                 // keep token current
  const response = await doFetch(path, options);

  if (response.status === 401 && typeof window !== "undefined") {
    const refreshedToken = await getAuth0AccessToken();   // one silent retry
    if (refreshedToken) {
      const retryResponse = await doFetch(path, options);
      if (retryResponse.status !== 401) return retryResponse;
    }
    console.error("[apiFetch] session expired (401)");
    toast.error("Session expired", { description: "Signing you out…" });
    window.dispatchEvent(new Event("auth:session-expired"));
  }

  return response;
}
```

Inside `doFetch` ([`client.ts:83-109`](../front-end/src/lib/api/client.ts#L83-L109)):

- Absolute URLs (`http…`) pass through.
- Same-origin Next routes (`/api/…`) get prefixed with `window.location.origin`.
- Everything else gets prefixed with `API_BASE_URL` (i.e. `SERVER_URL`).
- `Content-Type: application/json` is added for non-`GET` non-`FormData` requests.
- `getAuthHeaders()` injects `Authorization: Bearer …`.
- `credentials: "include"` is on for every call.

`apiFetchJson<T>()` (in `front-end-new/src/lib/api/client.ts`) is the typed wrapper that throws an `ApiError(status, code, message)` on non-2xx and runs the response through `friendlyApiError`. Use it everywhere except for streaming endpoints (chat stream).

---

## 10. End-to-end request lifecycles

### 10.1 Cold first visit ("/")

1. Browser hits `/`.
2. `proxy.ts` runs. No `appSession` cookie → `session === null`. Skip onboarding fetch.
3. Proxy redirects to `/auth/login?returnTo=/`.
4. `/auth/[auth0]/route.ts` → `auth0.middleware(request)` → 302 to `https://<AUTH0_DOMAIN>/authorize?audience=…&scope=openid profile email offline_access&…`.
5. User authenticates on Auth0 universal login.
6. Auth0 → `/auth/callback?code=…&state=…`.
7. SDK exchanges the code, sets the encrypted `appSession` cookie, runs `onCallback` → 302 to `/`.
8. Browser hits `/` **again**. Now `session` is non-null.
9. Proxy calls `/users/me` with a Bearer token (server-side `auth0.getAccessToken`). Backend returns the user.
10. If `userMeRootAllowsMainApp(root) === true` → render `/`. Otherwise redirect to `/onboarding/<step>`.
11. Once `/` (or any client page) loads, `<AuthProvider>` mounts and calls the **client** `getAuth0AccessToken()` which hits `/auth/access-token`, gets `{ token }`, and stores it in memory. From this point every `apiFetch` attaches `Authorization: Bearer <token>`.

### 10.2 Idle-tab token refresh

- Every 30 s, the provider's `setInterval` calls `isTokenExpiringSoon()`. If the cached token is within 60 s of expiry, it calls `getAuth0AccessToken()` again. The SDK either returns a still-valid cached token or silently refreshes via the refresh-token grant (server side, through `/auth/access-token`).
- Independently, `apiFetch` calls `ensureFreshToken()` at the start of every request. If the user makes a call after a long idle, the token is refreshed inline before the actual API call.

### 10.3 401 from backend

- `apiFetch` retries **once** after explicitly calling `getAuth0AccessToken()` (forcing a fresh token).
- If the retry is also 401, we've hit a true session expiry. Emit `auth:session-expired`. The provider's listener fires `logout()`, which clears local state and redirects the browser to `/auth/logout?returnTo=…`.
- The SDK logout route deletes the cookie, hits Auth0's `/v2/logout`, and the user lands back at `/auth/login`.

### 10.4 Onboarding completion

- During onboarding, the backend's PATCH `/users/me/onboarding` updates step fields (`user_role`, `ai_tone`, `role_fit`).
- After `/onboarding/pricing`, the user is sent to Stripe Checkout. On success, Stripe returns to `/onboarding/pricing/confirmation?plan=…&billing=…`.
- The confirmation page is responsible for setting the short-lived cookie `souvenir_checkout_complete=1; path=/; max-age=…; SameSite=Lax`. (The cookie is **read** by the proxy and **cleared** by the proxy after a single transition into the app; see [`proxy.ts:139-156`](../front-end/src/proxy.ts#L139-L156).)
- The Stripe webhook on the backend flips `subscription_status` to `active`. From this moment, `userMeRootAllowsMainApp` returns `true` regardless of `onboarding.completed`.

---

## 11. Backend endpoints used by the auth/onboarding stack

All of these go through `apiFetch` (Bearer token). Defined in [`src/lib/config.ts`](../front-end/src/lib/config.ts):

| Constant | URL | Method(s) | Purpose |
| --- | --- | --- | --- |
| `USER_ENDPOINT` | `${SERVER_URL}/users/me` | `GET`, `PATCH`, `DELETE` | Get / update / delete the current user. Used by proxy for the onboarding gate (`GET`), by `auth-context` to populate `AuthUser` (`GET`), by onboarding pages (`PATCH`). |
| `USER_CREATE_ENDPOINT` | `${SERVER_URL}/users/create` | `POST` | First-time user creation (called when the backend has no row yet for the Auth0 ID). |
| `USER_ONBOARDING_ENDPOINT` | `${SERVER_URL}/users/me/onboarding` | `PATCH` | Save onboarding step fields. |
| `STRIPE_CHECKOUT_ENDPOINT` | `/stripe/checkout` (same-origin) | `POST` | Calls our Next route which calls Stripe. |
| `STRIPE_SUBSCRIPTION_ENDPOINT` | `/stripe/subscription` (same-origin) | `PATCH`, `DELETE` | Update / cancel subscription via our Next route. |

All non-auth backend endpoints (chats, models, personas, pins, workflows) follow the same pattern — see `config.ts` for the full list.

### Auth0-specific endpoints exposed by **this** Next.js app

| Path | Method | Source | Notes |
| --- | --- | --- | --- |
| `/auth/login` | GET | SDK (via `[auth0]` catch-all) | `?returnTo` honored. |
| `/auth/logout` | GET | SDK | Clears cookie + redirects to Auth0 `/v2/logout`. |
| `/auth/callback` | GET | SDK | OAuth code exchange → runs `onCallback`. |
| `/auth/profile` | GET | SDK | Returns the OIDC user profile. |
| `/auth/access-token` | GET | **Override** at `app/auth/access-token/route.ts` | Returns `{ token }` for the configured audience. 401 with `{ error: { code, message } }` on failure. |
| `/auth/backchannel-logout` | POST | SDK | Auth0 back-channel logout endpoint. |
| `/api/onboarding/logout` | GET | App route | Onboarding two-step logout. Clears `appSession*` cookies and redirects to `https://<AUTH0_DOMAIN>/v2/logout?client_id=…&returnTo=https://getsouvenir.com`. |

---

## 12. Stripe routes that depend on Auth0

[`src/app/api/stripe/checkout/route.ts`](../front-end/src/app/api/stripe/checkout/route.ts) and [`src/app/api/stripe/subscription/route.ts`](../front-end/src/app/api/stripe/subscription/route.ts) both gate every action on:

```ts
const session = await auth0.getSession();
if (!session || !session.user) {
  return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
}
```

They use `session.user.email` and `session.user.sub` to:

- Create Stripe customers (matched by email)
- Tag the Stripe checkout session metadata with `auth0_user_id: session.user.sub`

Same-origin requests from the browser carry the `appSession` cookie, so `auth0.getSession()` returns the active session without any extra plumbing.

---

## 13. AWS secrets bootstrap: `scripts/load-secrets.mjs`

The Next scripts run `load-secrets.mjs` first:

```json
{
  "predev":   "npm run load-secrets",
  "prebuild": "npm run load-secrets",
  "prestart": "npm run load-secrets",
  "load-secrets": "node scripts/load-secrets.mjs"
}
```

The script reads `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_SECRET_NAME` from `.env.local`, fetches the `souvenirai-frontend/development` secret bundle from AWS Secrets Manager, and writes every key to `.env.development.local` with `mode: 0o600`. **Never** commit `.env.local` or `.env.development.local`.

`front-end-new` already has [`scripts/load-secrets.mjs`](scripts/load-secrets.mjs) and the matching scripts in `package.json` — the secret bundle is the same.

---

## 14. Recreate-in-`front-end-new` checklist

Most of the wiring already exists in `front-end-new`. To bring it to feature parity with `front-end`:

1. **Confirm dependency.** `package.json` must pin `"@auth0/nextjs-auth0": "^4.16.0"`.
2. **Confirm env vars.** `.env.development.local` is auto-generated; `next.config.ts` must re-export `AUTH0_AUDIENCE` and `SERVER_URL`. CSP `connect-src` must include `https://${AUTH0_DOMAIN}`.
3. **Auth0 client.** [`src/lib/auth0.ts`](src/lib/auth0.ts) — already mirrors the reference. Keep `onCallback` redirecting to `/`.
4. **Catch-all route.** [`src/app/auth/[auth0]/route.ts`](src/app/auth/%5Bauth0%5D/route.ts) — must export `GET` and `POST` that call `auth0.middleware(request)`.
5. **Access-token override.** [`src/app/auth/access-token/route.ts`](src/app/auth/access-token/route.ts) — must return `{ token }` with `dynamic = "force-dynamic"` and 401 on failure.
6. **Proxy.** [`src/proxy.ts`](src/proxy.ts) — already mirrors the reference. Keep the matcher excluding `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt`. **Do not** rename the file back to `middleware.ts` — Next.js 16 routes from `proxy.ts`.
7. **Onboarding access utility.** [`src/lib/onboarding-access.ts`](src/lib/onboarding-access.ts) — must implement `userMeRootAllowsMainApp` with both branches (completed flag + active paid subscription).
8. **JWT utils.** [`src/lib/jwt-utils.ts`](src/lib/jwt-utils.ts) — in-memory cache, expiry decode, `ensureFreshToken`, `getAuthHeaders`.
9. **Auth provider.** [`src/context/auth-context.tsx`](src/context/auth-context.tsx) — hydration on mount, 30s refresh timer, `auth:session-expired` listener, `logout()` redirects to `/auth/logout`.
10. **API client.** [`src/lib/api/client.ts`](src/lib/api/client.ts) — `ensureFreshToken` before every call, retry once on 401, dispatch `auth:session-expired`.
11. **Onboarding logout helper.** Add `src/app/api/onboarding/logout/route.ts` if you have onboarding pages that need the two-step logout.
12. **Stripe routes.** Mirror [`src/app/api/stripe/checkout/route.ts`](../front-end/src/app/api/stripe/checkout/route.ts) and [`src/app/api/stripe/subscription/route.ts`](../front-end/src/app/api/stripe/subscription/route.ts) when the billing flow is ported.
13. **Layout.** Wrap the tree in `<AuthProvider>` in [`src/app/layout.tsx`](src/app/layout.tsx).
14. **Sanity test.**
    - Boot `npm run dev` (loads secrets first).
    - Hit `/` → expect redirect to `/auth/login` → universal login → callback → `/` (or onboarding redirect).
    - Confirm `localhost:3000/auth/access-token` returns `{ "token": "<JWT>" }`.
    - Confirm `apiFetch("/users/me")` returns 200 with the user record and the request carries `Authorization: Bearer …`.
    - Wait until the JWT is within 60 s of expiry; confirm the next API call refreshes silently.
    - Hit `/auth/logout` → cookie cleared → redirected to `/auth/login`.

---

## 15. Edge cases & gotchas (real ones from this codebase)

- **Refresh token absent.** If the user's session was minted before `offline_access` was added (or revoked by Auth0), `auth0.getAccessToken()` throws with `code: "missing_refresh_token"`. The proxy turns that into a `/auth/login?returnTo=…` redirect. Don't swallow it.
- **`appSession` is chunked.** The SDK splits cookies above ~4 KB into `appSession.0`, `appSession.1`, … . The onboarding logout deletes 5 of them defensively. Match this if you write any other custom logout.
- **`onCallback` does NOT decide onboarding.** The post-login redirect is always `/`. Onboarding routing is done by the proxy on the next request, against fresh backend state. Putting onboarding logic in `onCallback` is wrong because it bypasses the Stripe-just-completed cookie path.
- **`AUTH0_AUDIENCE` must reach the client.** Forgetting the `env:` re-export in `next.config.ts` makes `getAccessToken({ audience })` silently fall back to `getAccessToken()` (no audience), which then issues an opaque ID token instead of a JWT signed for the API. The backend will then 401 every call and the symptom looks like "the user is logged in but every fetch is 401".
- **The proxy fetches `/users/me` on every navigation.** This is intentional. `cache: "no-store"` is required. Caching here would let users into the app with stale plan data and break the onboarding gate.
- **`apiFetch` is for the browser.** Server components / route handlers should use `auth0.getAccessToken()` directly and call `fetch` themselves (see how `proxy.ts` does it). The in-memory token cache in `jwt-utils.ts` only exists in the browser tab.
- **Don't add `useMemo`/`useCallback` for token plumbing.** React Compiler is enabled (`reactCompiler: true` in `next.config.ts`); it handles memoization. The existing `useCallback`s in `auth-context.tsx` exist for stable identity passed into other hooks, not for performance.

---

## 16. Reference: minimal happy-path code map

```
src/
├── app/
│   ├── auth/
│   │   ├── [auth0]/route.ts          ← SDK catch-all (login/logout/callback/profile/…)
│   │   └── access-token/route.ts     ← override: returns { token }
│   ├── api/
│   │   ├── onboarding/
│   │   │   └── logout/route.ts       ← two-step onboarding logout
│   │   └── stripe/
│   │       ├── checkout/route.ts     ← gated by auth0.getSession()
│   │       └── subscription/route.ts ← gated by auth0.getSession()
│   └── layout.tsx                    ← wraps tree in <AuthProvider>
├── proxy.ts                          ← session + onboarding gate
├── context/
│   └── auth-context.tsx              ← in-browser auth + user state
└── lib/
    ├── auth0.ts                      ← Auth0Client config (single instance)
    ├── jwt-utils.ts                  ← in-memory token cache + helpers
    ├── onboarding-access.ts          ← userMeRootAllowsMainApp gate logic
    ├── api/
    │   └── client.ts                 ← apiFetch + apiFetchJson
    └── config.ts                     ← endpoint constants + audience export
```

That is the complete authentication system. Replicating these files (and the env / CSP / next.config wiring around them) reproduces the auth behavior of `front-end` exactly.
