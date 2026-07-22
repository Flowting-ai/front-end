import { type NextRequest } from "next/server";

/**
 * First-party analytics proxy (browser-proof Mixpanel ingestion).
 *
 * The Mixpanel browser SDK is configured with `api_host: "/dispatch"` (see
 * src/lib/analytics/mixpanel.ts), so every event beacon is a SAME-ORIGIN request
 * to this route, forwarded server-side to Mixpanel's JS ingestion host.
 *
 * WHY THIS PATH IS DELIBERATELY BORING: same-origin alone is NOT enough to beat
 * tracker blockers. uBlock/EasyPrivacy also match by PATH, regardless of domain —
 * `/ingest`, `/e/`, `/track`, `/collect`, `/beacon` etc. are all on blocklists
 * (PostHog's `/ingest` + `/e/` are the classic examples). An earlier version used
 * `/ingest/e` and uBlock blocked it. So the endpoint (`/dispatch`) and the route
 * aliases (`evt`/`usr`/`grp`) must stay generic, non-tracking-looking tokens.
 * See docs/mixpanel-frontend-implementation.md (R3).
 *
 * We use a route handler rather than a `next.config.ts` rewrite deliberately: this
 * repo removed rewrites because Turbopack buffers them (breaking Brain SSE — see
 * the note in next.config.ts), and a handler lets us explicitly (a) forward the
 * client IP so Mixpanel geolocation still resolves and (b) strip the same-origin
 * session cookie so it never leaks to a third party.
 */

export const dynamic = "force-dynamic";
// Node runtime to match the sibling backend proxy; Mixpanel payloads are tiny so
// there is no streaming/body-size concern here.
export const runtime = "nodejs";
export const maxDuration = 30;

// Mixpanel's browser-SDK ingestion host — where the SDK would have gone directly.
const UPSTREAM = "https://api-js.mixpanel.com";

// Reverse the api_routes aliases set in mixpanel.ts (kept non-tracking so no
// request path contains "track"/"engage"/"e"). Anything not in the map (record,
// flags, or a future endpoint) is forwarded unchanged.
const ROUTE_ALIAS: Record<string, string> = {
  evt: "track",
  usr: "engage",
  grp: "groups",
};

// Never forwarded upstream. `cookie` / `authorization` matter most: because
// /dispatch is same-origin the browser auto-attaches the app's Auth0 session
// cookie, which must be stripped so it can never reach a third party. `referer`
// is dropped so the current page URL (may embed ids) is not leaked at the HTTP
// layer. Plus the usual hop-by-hop headers.
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "cookie",
  "authorization",
  "referer",
]);

const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  // Same-origin response — an upstream ACAO would be redundant/confusing.
  "access-control-allow-origin",
  "access-control-allow-credentials",
]);

/** Real client IP from the incoming request, so Mixpanel geolocation (the SDK
 *  sends `ip=1`) resolves the user's location rather than our server's. */
function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const segments = path ?? [];
  const first = segments[0] ?? "";
  const mapped = [ROUTE_ALIAS[first] ?? first, ...segments.slice(1)].join("/");
  const search = new URL(req.url).search;
  const target = `${UPSTREAM}/${mapped}${search}`;

  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }
  const ip = clientIp(req);
  if (ip) headers.set("x-forwarded-for", ip);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    console.error("[mixpanel-proxy] upstream fetch failed", err);
    // Fail quiet: analytics must never surface an error to the user.
    return new Response(null, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export { handler as GET, handler as POST, handler as OPTIONS };
