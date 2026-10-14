/**
 * Every server route handler under `app/`, with who may call it. `proxy.ts`
 * enforces "session" for all of `/api/*` (JSON 401); the handlers that call the
 * backend also check the token themselves. `route-inventory.test.ts` fails when
 * a route file exists that is not listed here, so a new route has to decide.
 */
export type RouteAccess =
  /** proxy.ts returns 401 without a session. */
  | "session"
  /** Served by the Auth0 SDK middleware; the file is a fallback. */
  | "auth0-sdk"
  /** Deliberately public; the reason is in `note`. */
  | "public"

export const ROUTE_INVENTORY: Record<string, { access: RouteAccess; upstream: string; note: string }> = {
  "api/backend/[...path]": { access: "session", upstream: "backend (any path)", note: "Streaming pass-through; drops cookies, forwards the browser's Bearer." },
  "api/chat": { access: "session", upstream: "backend /chats", note: "Local-dev chat transport; deployed builds stream direct to the backend." },
  "api/persona-chat": { access: "session", upstream: "backend /persona/{id}/chats", note: "Agent chat transport, as above." },
  "api/template/[uuid]": { access: "session", upstream: "backend /templates/{id}/html", note: "Served under a sandbox CSP." },
  "api/download": { access: "session", upstream: "Souvenir S3 buckets", note: "Exact hosts, no redirects, 200 MB cap." },
  "api/lab/[...path]": { access: "session", upstream: "127.0.0.1:8777", note: "Dev only: 404 in production; three known paths." },
  "auth/[auth0]": { access: "auth0-sdk", upstream: "Auth0", note: "SDK login/callback/profile." },
  "auth/logout": { access: "auth0-sdk", upstream: "Auth0", note: "Federated logout with an allowlisted returnTo." },
  "dispatch/[...path]": { access: "public", upstream: "api-js.mixpanel.com", note: "Analytics beacons fire before login; five known routes, 1 MB cap, cookies stripped." },
}
