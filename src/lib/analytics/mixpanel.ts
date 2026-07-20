"use client";

// Thin, fail-safe wrapper around mixpanel-browser. This is the ONLY module that
// imports the SDK directly — everything else calls these helpers.
//
// Design guarantees (see the plan / docs/mixpanel-setup-notion.txt):
//  - No-op unless a project token is present (`analyticsEnabled`). Production sends
//    nothing until a PROD token is provisioned, so nothing breaks and prod stays clean.
//  - Browser-only. Server/SSR calls are ignored.
//  - Every SDK call is wrapped in try/catch: an analytics failure can NEVER bubble up
//    and break the app. Failures are swallowed (logged in dev only).
//  - autocapture OFF and session-replay OFF by design (Layers 1+4 replace autocapture
//    with named coverage; replay is a later phase). We deliberately diverge from
//    Mixpanel's quickstart snippet here.

import mixpanel from "mixpanel-browser";
import { mixpanelToken, analyticsEnabled } from "@/lib/config";
import { STAMP, SURFACE_WEB, ORG_GROUP_KEY } from "./stamps";

const isDev = process.env.NODE_ENV === "development";
let initialized = false;

function warn(label: string, err: unknown): void {
  if (isDev) console.warn(`[analytics] ${label}`, err);
}

/** True only when the SDK has been initialized against a real token in the browser. */
function ready(): boolean {
  return initialized && analyticsEnabled && typeof window !== "undefined";
}

/** Initialize once. Safe to call repeatedly and safe when disabled. */
export function initAnalytics(): void {
  if (initialized || !analyticsEnabled || typeof window === "undefined") return;
  try {
    mixpanel.init(mixpanelToken, {
      // First-party proxy: send every request through our own origin instead of
      // api-js.mixpanel.com, so tracker/ad blockers (uBlock, Brave, Dia,
      // EasyPrivacy, …) have no third-party domain to block. The server route at
      // src/app/dispatch/[...path]/route.ts forwards to Mixpanel and preserves the
      // client IP for geolocation. See docs/mixpanel-frontend-implementation.md.
      //
      // The path is deliberately generic. Same-origin alone is NOT enough — uBlock
      // /EasyPrivacy also match by PATH regardless of domain, and `/ingest`, `/e/`,
      // `/track`, `/collect` are all on blocklists (uBlock blocked `/ingest/e` in
      // testing). So both the host (`/dispatch`) and the route aliases below
      // (`evt`/`usr`/`grp`) must avoid any tracking-flavoured token.
      api_host: "/dispatch",
      // A COMPLETE object is required: the SDK shallow-merges api_routes, so any
      // omitted key would fall through to `undefined` rather than its default.
      // The proxy reverses these (evt→track, usr→engage, grp→groups).
      api_routes: {
        track: "evt",
        engage: "usr",
        groups: "grp",
        record: "record",
        flags: "flags",
      },
      // Named, intentional coverage instead of autocapture (per the setup doc).
      autocapture: false,
      // We emit `screen_viewed` ourselves on every client-side navigation.
      track_pageview: false,
      // SPA-friendly persistence; avoids cross-subdomain cookie churn.
      persistence: "localStorage",
      // Session Replay is a later, masked phase — off for now.
      record_sessions_percent: 0,
      debug: isDev,
      // TODO(privacy): gate initialization behind cookie consent before we have
      // EU/UK users, mirroring the note in src/components/MetaPixel/index.tsx.
    });
    // `surface` is constant for the browser door and must ride on EVERY event,
    // including pre-auth screens — register it up front.
    mixpanel.register({ [STAMP.surface]: SURFACE_WEB });
    initialized = true;
  } catch (err) {
    warn("init failed", err);
  }
}

/** Track a named event with metadata-only properties. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!ready()) return;
  try {
    mixpanel.track(event, props);
  } catch (err) {
    warn(`track("${event}") failed`, err);
  }
}

/** Identify the current user by their stable primary id (Auth0 sub — never email). */
export function identifyUser(distinctId: string): void {
  if (!ready() || !distinctId) return;
  try {
    mixpanel.identify(distinctId);
  } catch (err) {
    warn("identify failed", err);
  }
}

/** Set super properties (stamps) attached to every subsequent event. Omit blanks —
 *  callers pass only keys with a real value; use `clearStamps` to remove. */
export function registerStamps(props: Record<string, unknown>): void {
  if (!ready()) return;
  try {
    mixpanel.register(props);
  } catch (err) {
    warn("register failed", err);
  }
}

/** Remove super properties (e.g. clear `plan` for an org member, or org stamps for an
 *  individual) so we never emit stale or contradictory stamps. */
export function clearStamps(keys: string[]): void {
  if (!ready()) return;
  try {
    for (const key of keys) mixpanel.unregister(key);
  } catch (err) {
    warn("unregister failed", err);
  }
}

/** Update the current (identified) user's People profile. Never call for anonymous
 *  users — callers gate on an identified distinct_id first. Metadata only. */
export function setPeople(props: Record<string, unknown>): void {
  if (!ready()) return;
  try {
    mixpanel.people.set(props);
  } catch (err) {
    warn("people.set failed", err);
  }
}

/** Associate the user with their organization for Group Analytics (org-level rollups).
 *  Requires the Group Analytics add-on to be useful; harmless if not enabled. */
export function setOrgGroup(orgId: string): void {
  if (!ready() || !orgId) return;
  try {
    mixpanel.set_group(ORG_GROUP_KEY, orgId);
  } catch (err) {
    warn("set_group failed", err);
  }
}

/** Clear identity + super properties on logout so the next (anonymous) session is not
 *  merged with the previous user. Re-registers the constant `surface` stamp after. */
export function resetAnalytics(): void {
  if (!ready()) return;
  try {
    mixpanel.reset();
    mixpanel.register({ [STAMP.surface]: SURFACE_WEB });
  } catch (err) {
    warn("reset failed", err);
  }
}
