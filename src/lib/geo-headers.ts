import type { NextRequest } from "next/server";

/**
 * Pull the client-supplied `X-User-*` context headers off an incoming request
 * so a bespoke proxy route can forward them to the FastAPI backend.
 *
 * The backend's `extract_geo` reads these — `x-user-timezone` drives the
 * "current time" line, so dates render in the user's zone instead of UTC. The
 * generic `/api/backend` rewrite forwards every header already; the chat /
 * brain-chat / persona-chat routes rebuild headers from scratch, so they drop
 * these unless we re-add them here.
 */
export function forwardGeoHeaders(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of [
    "x-user-timezone",
    "x-user-locale",
    "x-user-city",
    "x-user-region",
    "x-user-country",
  ]) {
    const value = request.headers.get(name);
    if (value) out[name] = value;
  }
  return out;
}

/**
 * Best-effort location/time context for the backend's extract_geo, derived
 * entirely from the browser — no permission prompt, no network call.
 *   - timezone: the IANA zone (drives the "current time" line)
 *   - locale:   navigator.language
 *   - city:     the timezone's representative city (America/Chicago → Chicago)
 *   - country:  the locale's region, expanded to a country name when possible
 *
 * Coarse on purpose (city follows the timezone, not GPS) — it's prompt context
 * only, never trusted for billing/access. Names must match extract_geo (X-User-*).
 * Every browser→backend transport must send these; the chat XHR path in
 * use-streaming-chat bypasses apiClient, so it calls this directly.
 */
export function clientGeoHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      out["X-User-Timezone"] = tz;
      const parts = tz.split("/");
      if (parts.length > 1) {
        const city = parts[parts.length - 1].replace(/_/g, " ").trim();
        if (city) out["X-User-City"] = city;
      }
    }
  } catch { /* timezone unavailable — skip */ }
  try {
    const locale = navigator.language;
    if (locale) {
      out["X-User-Locale"] = locale;
      const loc = new Intl.Locale(locale);
      const region = loc.region ?? loc.maximize().region;
      if (region) {
        let country = region;
        try {
          country = new Intl.DisplayNames([locale], { type: "region" }).of(region) ?? region;
        } catch { /* DisplayNames unavailable — fall back to the region code */ }
        out["X-User-Country"] = country;
      }
    }
  } catch { /* locale unavailable — skip */ }
  return out;
}
