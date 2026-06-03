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
