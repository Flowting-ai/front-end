# Mixpanel — Browser-Proof Ingestion (First-Party Proxy)

**Status: ✅ shipped & verified in a real browser with uBlock Origin active.**

This document covers the *browser-proof* workstream specifically: why ad/tracker
blockers were silently dropping analytics, the methodology used to fix it, the
implementation, every gotcha we hit, and how to verify/maintain it. It complements:

- `mixpanel-frontend-implementation.md` — the full frontend tracker (this proxy is its **R3**).
- `mixpanel-setup-notion.txt` — the product/analytics spec.
- `AGENTS.md` → *Analytics (Mixpanel)* — the short rules for future agents.

---

## 1. The problem

The Mixpanel browser SDK sends every event to `api-js.mixpanel.com` — a third-party
tracking domain that is on **every** ad/tracker blocklist (uBlock Origin, Brave
Shields, Dia, EasyPrivacy, etc.). Result: any user running a blocker is **invisible**
in our data — their events never leave the browser.

Why this matters for us specifically: our real users include agency ops people who
commonly run blockers. Losing them isn't a rounding error — it silently biases every
funnel, retention, and "is this org active?" answer. The whole point of the analytics
initiative (see the setup doc) is a reliable feedback loop; a blocker-shaped hole in
the data defeats it.

**Measured symptom (Chrome + uBlock):** requests to the SDK endpoint showed
`Status: (blocked)`, `Size: 0.0 kB` in the Network tab.

---

## 2. The idea: make the traffic first-party

Blockers work primarily by **domain** (block anything to `*.mixpanel.com`) and
secondarily by **path** (block any URL matching `/track`, `/ingest`, `/e/`, `/collect`, …).

The fix is to make the traffic genuinely first-party:

```
Browser ──POST /dispatch/evt──▶  our own origin (Next.js route handler)
                                        │  (server-side, no blocker can see this hop)
                                        ▼
                                 api-js.mixpanel.com/track
```

The browser only ever talks to **our own domain**, on a **generic path**. There is
no third-party domain and no tracking-flavoured path for a blocker to match — so
nothing is blocked, in every browser, for every user.

---

## 3. Methodology

We treated this as *verify-before-implement*, then *verify-against-runtime*:

1. **Source-level verification first.** Before writing code we read the actual
   codebase and the installed SDK source (`mixpanel-browser@2.78`) to confirm every
   assumption — how the middleware matcher behaves, why the repo avoids `rewrites()`,
   how `api_host`/`api_routes` resolve, which endpoints actually fire. This caught
   several issues the "obvious" implementation would have shipped broken (§5).
2. **Server-side runtime tests.** Drove the endpoint with `curl` against a running
   dev server: confirmed 200s from Mixpanel, correct route aliasing, auth-gate
   bypass, and — via a temporary header-echo upstream — that the session cookie is
   stripped and the client IP is forwarded.
3. **Real-browser test (the decisive one).** `curl` cannot reproduce a blocker —
   ad-block filter lists only run in the browser. So the final gate was Chrome with
   uBlock Origin: watch the Network tab for `200`s instead of `(blocked)`. **This is
   what caught the path-name problem that every server-side test passed (§5.7).**

Takeaway encoded for the future: **a first-party analytics proxy is not "done" until
it's been loaded in a real browser with a blocker enabled.**

---

## 4. Architecture / implementation

| Piece | File | What it does |
|---|---|---|
| Proxy route | `src/app/dispatch/[...path]/route.ts` | Node route handler. Forwards `/dispatch/*` → `https://api-js.mixpanel.com/*`, reversing the path aliases, forwarding the client IP, and stripping sensitive headers. Fails quiet (502, never surfaces to the user). |
| SDK config | `src/lib/analytics/mixpanel.ts` | `api_host:"/dispatch"` + a complete `api_routes` alias map so the SDK posts to our proxy on generic paths. |
| Middleware exclusion | `src/proxy.ts` | `dispatch` excluded from the proxy (middleware) matcher, so beacons bypass the onboarding/auth gate. |

### Path & alias scheme

| SDK call | Browser request | Proxy forwards to |
|---|---|---|
| track  | `POST /dispatch/evt` | `api-js.mixpanel.com/track` |
| engage | `POST /dispatch/usr` | `api-js.mixpanel.com/engage` |
| groups | `POST /dispatch/grp` | `api-js.mixpanel.com/groups` |

`record` / `flags` / `settings` are kept in the config for completeness but do not
fire under our settings (see §5.6). Any unmapped segment is forwarded unchanged.

### What the handler does, precisely
- **Reverses the alias** (`evt→track`, `usr→engage`, `grp→groups`; else passthrough).
- **Forwards the client IP** via `X-Forwarded-For` (first hop of the incoming header,
  or `x-real-ip`). The SDK sends `ip=1`; without this, Mixpanel geolocates every
  event to *our server's* IP and all geo data collapses.
- **Strips** `cookie`, `authorization`, `referer`, and hop-by-hop headers before
  forwarding. `cookie` is the critical one — see §5.4.
- **Streams the body through** and relays Mixpanel's status + body back unchanged
  (minus content-encoding/length so the re-emitted body isn't mis-framed).

### Why a route handler, not a `next.config` rewrite
The "textbook" Mixpanel/Next.js proxy is a `rewrites()` rule. We deliberately did
**not** use one:
- This repo **removed `rewrites()`** because Turbopack (`next dev`) buffers them,
  which broke Brain SSE — see the note in `next.config.ts`. The established pattern is
  a streaming route handler (see `src/app/api/backend/[...path]/route.ts`).
- A handler also lets us **explicitly** forward the client IP and strip the cookie —
  both of which a rewrite does not give us clean control over.

### No CSP change needed
The browser now connects only to `'self'` for analytics, which `connect-src 'self'`
already allows. (`https://*.mixpanel.com` remains in `connect-src` but is unused by
the browser for ingestion now — harmless.)

---

## 5. Gotchas & decisions (the important part)

Each of these would have produced a broken or leaky implementation if shipped naively.

### 5.1 The middleware would have eaten the beacons
`src/proxy.ts` is this Next 16 app's middleware (renamed "proxy"). Its matcher covers
**every extension-less path**, and **middleware runs before `next.config` rewrites/
routing**. So without an exclusion, `/dispatch/*` would hit the onboarding/auth gate:
pre-auth events (`screen_viewed` on welcome/login) get **302'd to `/auth/login` and
lost**, and authed events trigger a `/users/me` fetch each. **Fix:** exclude
`dispatch` from the matcher. *Verified:* the middleware logs `RUN` for `/` and
`/chat` but never for `/dispatch`.

### 5.2 Client IP must be forwarded or geo breaks
The SDK appends `ip=1`, asking Mixpanel to geolocate from the request IP. A proxy
makes all events appear to come from the server. **Fix:** set `X-Forwarded-For` to
the real client IP. *Verified* via a temporary echo upstream.

### 5.3 `api_routes` is shallow-merged — pass a COMPLETE object
Confirmed in the SDK source: `init` does `_.extend({}, DEFAULT_CONFIG, config)` — a
**shallow** merge. Overriding `api_routes` with a partial object drops the unlisted
defaults (they become `undefined` → `/dispatch/undefined`). **Fix:** always pass the
full object.

### 5.4 Same-origin means the session cookie auto-attaches — strip it
Because `/dispatch` is same-origin, the browser **automatically** attaches the app's
Auth0 session cookie to every beacon. Forwarded blindly, that cookie would leak to
Mixpanel. **Fix:** strip `cookie` (and `authorization`, `referer`) in the handler.
*Verified* via echo upstream: `cookie: None` received upstream.

### 5.5 Default route names carry a trailing slash → 308 → broken `sendBeacon`
The SDK's default routes are `track/`, `engage/`, etc. (trailing slash). With
`trailingSlash:false` (Next default), `/dispatch/track/` would **308-redirect** to
`/dispatch/track` — and `navigator.sendBeacon` (used on page unload) does **not**
follow redirects, so unload events would be silently dropped. Aliasing the routes
(no trailing slash) removes this entirely.

### 5.6 Not all SDK endpoints fire — don't over-engineer
Confirmed in source: `settings`/`flags`/`record` are only fetched when
`remote_settings_mode` ≠ `disabled` (it defaults to `disabled`), flags are enabled,
or session replay is on. Under our config (`autocapture:false`, `flags:false`,
`record_sessions_percent:0`) **only `track`/`engage`/`groups` fire**, all through the
proxy. No other Mixpanel-domain request is made from the browser (the SDK is bundled
via npm, not loaded from `cdn.mxpnl.com`).

### 5.7 ⚠️ Same-origin is NOT enough — blockers match by PATH too
**This is the one that only the real-browser test caught.** The first implementation
used `/ingest/e`. All server-side tests passed (200s), but in Chrome with uBlock the
requests were **`(blocked)`, 0 B**. Reason: `/ingest` and `/e/` are the exact paths
**PostHog** uses, so EasyPrivacy/uBlock block them **by path, regardless of domain**.
Same-origin defeated the *domain* rule; it did nothing against the *path* rule.

**Fix:** rename to a generic, non-tracking path and move the aliases off single
letters:

| Blocked (before) | Works (after) |
|---|---|
| `/ingest/e` | `/dispatch/evt` |
| `/ingest/u` | `/dispatch/usr` |
| `/ingest/g` | `/dispatch/grp` |

**Standing rule:** never rename the endpoint or aliases to anything
tracking-flavoured (`ingest`, `track`, `collect`, `beacon`, `analytics`, `e`, `tr`,
`pixel`, …). Keep them boring.

---

## 6. Verification results

### Server-side (curl, against `next dev`)
- `POST /dispatch/evt` → **200** `{"error":null,"status":1}` (Mixpanel accepted) — warm ~110ms.
- `POST /dispatch/usr` (engage), `/dispatch/grp` (groups) → **200** `status:1`.
- Unmapped passthrough (`/dispatch/track`) → **200** `status:1`.
- `/chat` → **302 → /auth/login** (auth gate still works for real routes).
- Old `/ingest/e` → **302** (path fully retired).
- Echo-upstream check: `cookie`/`authorization`/`referer` **stripped**; client IP
  (`203.0.113.77`) **forwarded**; body + content-type intact.
- `tsc --noEmit` — clean on all changed source.

### Real browser (Chrome + uBlock Origin — the decisive test)
- Network tab, filter `dispatch`: `dispatch/evt`, `dispatch/usr` → **Status 200,
  1.3 kB responses** (not `(blocked)`, not 0 B), with the blocker active.
- Events appear in the Mixpanel DEV project.

**Conclusion: browser-proof, empirically, in the environment that was previously failing.**

---

## 7. How to verify again (regression check)

Any time this area changes, re-run the real-browser gate — server tests alone are
insufficient (they can't reproduce a blocker):

1. `npm run dev` (Turbopack). *Avoid `next dev --webpack`* — it's slow here and trips
   an unrelated `beautiful-mermaid` resolution issue.
2. Chrome with **uBlock Origin** installed (EasyPrivacy enabled — it is by default).
3. Open the app, act, then DevTools → Network → filter **`dispatch`**.
   - **PASS:** `dispatch/evt` etc. are **200** with non-zero size (not `(blocked)`).
4. Toggle uBlock **off** → behaviour identical → confirms it's blocker-independent.
5. Check the event lands in Mixpanel Live View with **geo populated** (proves IP
   forwarding survived).
6. If ever `(blocked)` again: open uBlock's **Logger**, find the red `dispatch/…`
   row — the right-most column names the exact filter. Rename the path/aliases away
   from whatever it matched.

---

## 8. Remaining items (not part of this proxy, do not block it)

- **Prod token** — set `NEXT_PUBLIC_MIXPANEL_TOKEN_PROD` in the prod secret bundle
  (env only; prod is a no-op until then). The proxy works identically in dev and prod.
- **`beautiful-mermaid` webpack resolution** — pre-existing, unrelated. It only
  surfaces under `next dev --webpack` / `next build --webpack` (ESM package with an
  incomplete `exports` map); Turbopack resolves it fine. Fix if the prod build proves
  affected: `transpilePackages: ['beautiful-mermaid','maplibre-gl','@vis.gl/react-maplibre']`.
