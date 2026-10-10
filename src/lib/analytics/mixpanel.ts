"use client";

// Thin, fail-safe wrapper around mixpanel-browser. This is the ONLY module that
// imports the SDK directly — everything else calls these helpers.
//
// Design guarantees (see the plan / docs/analytics/mixpanel-setup-notion.txt):
//  - No-op unless a project token is present (`analyticsEnabled`). Production sends
//    nothing until a PROD token is provisioned, so nothing breaks and prod stays clean.
//  - Browser-only. Server/SSR calls are ignored.
//  - Every SDK call is wrapped in try/catch: an analytics failure can NEVER bubble up
//    and break the app. Failures are swallowed (logged in dev only).
//  - autocapture OFF and session-replay OFF by design (Layers 1+4 replace autocapture
//    with named coverage; replay is a later phase). We deliberately diverge from
//    Mixpanel's quickstart snippet here.
//  - The SDK (~400 KB raw / ~115 KB gzip) is NOT part of the initial bundle. It is loaded
//    with a dynamic import once the browser is idle after `initAnalytics()`. Calls made in
//    between are queued and replayed in order, so callers never need to know whether the
//    SDK has arrived. Without a token the SDK is never downloaded at all.

import { mixpanelToken, analyticsEnabled } from "@/lib/config";
import { STAMP, SURFACE_WEB, ORG_GROUP_KEY } from "./stamps";

type Sdk = typeof import("mixpanel-browser").default;
type Op = (sdk: Sdk) => void;

const isDev = process.env.NODE_ENV === "development";
// SDK debug logging is opt-in (it logs every call to the console), even in dev.
const sdkDebug = process.env.NEXT_PUBLIC_MIXPANEL_DEBUG === "true";

/** Longest the SDK load may be postponed waiting for an idle moment. */
const IDLE_TIMEOUT_MS = 1500;
/** Calls kept while the SDK loads. A page makes a handful; the cap only bounds a runaway caller. */
const MAX_PENDING = 200;

let sdk: Sdk | null = null; // set once the SDK has loaded AND been initialised
let started = false; // initAnalytics() has been called
let failed = false; // the SDK failed to load or initialise; stay inert
const pending: Array<{ label: string; op: Op }> = [];

function warn(label: string, err: unknown): void {
  if (isDev) console.warn(`[analytics] ${label}`, err);
}

function exec(label: string, op: Op, target: Sdk): void {
  try {
    op(target);
  } catch (err) {
    warn(label, err);
  }
}

/** Run an SDK call now if the SDK is ready, queue it if the SDK is on its way, drop it otherwise. */
function run(label: string, op: Op): void {
  if (!analyticsEnabled || typeof window === "undefined" || failed) return;
  if (sdk) {
    exec(label, op, sdk);
    return;
  }
  // Before initAnalytics() nothing is queued — same as before the SDK existed in the bundle.
  if (!started) return;
  if (pending.length < MAX_PENDING) pending.push({ label, op });
}

async function loadSdk(): Promise<void> {
  try {
    const mod = await import("mixpanel-browser");
    const mixpanel: Sdk = (mod as { default?: Sdk }).default ?? (mod as unknown as Sdk);
    mixpanel.init(mixpanelToken, {
      // First-party proxy: send every request through our own origin instead of
      // api-js.mixpanel.com, so tracker/ad blockers (uBlock, Brave, Dia,
      // EasyPrivacy, …) have no third-party domain to block. The server route at
      // src/app/dispatch/[...path]/route.ts forwards to Mixpanel and preserves the
      // client IP for geolocation. See docs/analytics/mixpanel-frontend-implementation.md.
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
      debug: sdkDebug,
      // TODO(privacy): gate initialization behind cookie consent before we have
      // EU/UK users, mirroring the note in src/components/MetaPixel/index.tsx.
    });
    // `surface` is constant for the browser door and must ride on EVERY event,
    // including pre-auth screens — register it up front.
    mixpanel.register({ [STAMP.surface]: SURFACE_WEB });
    sdk = mixpanel;
    // Replay everything that was asked for while the SDK was loading, in order.
    for (const { label, op } of pending.splice(0)) exec(label, op, mixpanel);
  } catch (err) {
    failed = true;
    pending.length = 0;
    warn("init failed", err);
  }
}

/**
 * Initialize once. Safe to call repeatedly and safe when disabled. Returns immediately; the SDK
 * loads when the browser is idle (or after IDLE_TIMEOUT_MS at the latest).
 */
export function initAnalytics(): void {
  if (started || !analyticsEnabled || typeof window === "undefined") return;
  started = true;
  const load = () => {
    void loadSdk();
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(load, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(load, 1);
  }
}

/** Track a named event with metadata-only properties. */
export function track(event: string, props?: Record<string, unknown>): void {
  run(`track("${event}") failed`, (s) => s.track(event, props));
}

/** Identify the current user by their stable primary id (Auth0 sub — never email). */
export function identifyUser(distinctId: string): void {
  if (!distinctId) return;
  run("identify failed", (s) => s.identify(distinctId));
}

/** Set super properties (stamps) attached to every subsequent event. Omit blanks —
 *  callers pass only keys with a real value; use `clearStamps` to remove. */
export function registerStamps(props: Record<string, unknown>): void {
  run("register failed", (s) => s.register(props));
}

/** Remove super properties (e.g. clear `plan` for an org member, or org stamps for an
 *  individual) so we never emit stale or contradictory stamps. */
export function clearStamps(keys: string[]): void {
  run("unregister failed", (s) => {
    for (const key of keys) s.unregister(key);
  });
}

/** Update the current (identified) user's People profile. Never call for anonymous
 *  users — callers gate on an identified distinct_id first. Metadata only. */
export function setPeople(props: Record<string, unknown>): void {
  run("people.set failed", (s) => s.people.set(props));
}

/** Associate the user with their organization for Group Analytics (org-level rollups).
 *  Requires the Group Analytics add-on to be useful; harmless if not enabled. */
export function setOrgGroup(orgId: string): void {
  if (!orgId) return;
  run("set_group failed", (s) => s.set_group(ORG_GROUP_KEY, orgId));
}

/** Clear identity + super properties on logout so the next (anonymous) session is not
 *  merged with the previous user. Re-registers the constant `surface` stamp after. */
export function resetAnalytics(): void {
  run("reset failed", (s) => {
    s.reset();
    s.register({ [STAMP.surface]: SURFACE_WEB });
  });
}
