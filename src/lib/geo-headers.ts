import type { NextRequest } from "next/server";

/**
 * Pull the client-supplied context headers off an incoming request so a bespoke
 * proxy route can forward them to the FastAPI backend.
 *
 * The backend's extractGeo reads these — `x-user-timezone` drives the "current
 * time" line, so dates render in the user's zone instead of UTC. The generic
 * `/api/backend` rewrite forwards every header already; the chat / brain-chat /
 * persona-chat routes rebuild headers from scratch, so they drop these unless
 * we re-add them here.
 *
 * `x-forwarded-for` carries the browser's address through this hop. Without it
 * the backend would geolocate the Vercel function instead of the user, since a
 * route handler opens its own connection. The ALB appends its own view to the
 * end, so the browser stays the first public entry — which is what extractGeo
 * reads.
 */
export function forwardGeoHeaders(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of ["x-user-timezone", "x-user-locale", "x-forwarded-for"]) {
    const value = request.headers.get(name);
    if (value) out[name] = value;
  }
  return out;
}

/**
 * Time context for the backend's extractGeo — the two things only the browser
 * knows, with no permission prompt and no network call.
 *   - timezone: the IANA zone (drives the "current time" line)
 *   - locale:   navigator.language
 *
 * Nothing geographic is derived here. City, region and country come from the
 * backend's IP lookup, which is the only source that can name a state and the
 * only one that reports the caller's actual city rather than the timezone's
 * representative one. The browser still owns the zone: an IP is wrong about it
 * behind a VPN, where the local clock stays right.
 *
 * Names must match extractGeo (X-User-*). Every browser→backend transport must
 * send these; the chat XHR path in use-streaming-chat bypasses apiClient, so it
 * calls this directly.
 */
export function clientGeoHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) out["X-User-Timezone"] = tz;
  } catch { /* timezone unavailable — skip */ }
  try {
    const locale = navigator.language;
    if (locale) out["X-User-Locale"] = locale;
  } catch { /* locale unavailable — skip */ }
  return out;
}
