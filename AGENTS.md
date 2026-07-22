<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design reference

Before creating or changing UI, review `C:\Users\kunals\may-day` for established design components, layouts, tokens, and interaction patterns. Reuse those patterns where they fit.

# Analytics (Mixpanel)

Product analytics is **Mixpanel** (`mixpanel-browser`), direct SDK. The spec is
`docs/mixpanel-setup-notion.txt`; the backend half is `docs/mixpanel-backend-contract.md`;
the first-party proxy (browser-proof ingestion) is `docs/mixpanel-browser-proof.md`.

- **Where the code lives:** `src/lib/analytics/` (core `mixpanel.ts`, vocabulary
  `events.ts`, route→screen `screens.ts`, stamp keys `stamps.ts`) and
  `src/components/Analytics/` (`MixpanelProvider` — init + identity + `screen_viewed`,
  mounted in `src/app/layout.tsx` inside `AuthProvider`; `OrgStamps` — org stamps,
  mounted in `src/app/(app)/layout.tsx` inside `OrgProvider`).
- **Never import `mixpanel-browser` directly** anywhere except `src/lib/analytics/mixpanel.ts`.
  Track via the typed helpers: `trackScreenView`, `trackFeature`, `trackBrowserEvent`.
- **Token:** read from env only (`NEXT_PUBLIC_MIXPANEL_TOKEN` dev / `NEXT_PUBLIC_MIXPANEL_TOKEN_PROD` prod)
  via `src/lib/config.ts`. Never hard-code a token. No token ⇒ full no-op.
- **First-party proxy:** the SDK sends to `/dispatch` (`api_host` in `mixpanel.ts`), not
  `api-js.mixpanel.com`, so ad/tracker blockers can't drop events. The proxy is the route
  handler `src/app/dispatch/[...path]/route.ts` (forwards to Mixpanel, preserves client IP,
  strips the session cookie). `dispatch` is excluded from the `src/proxy.ts` matcher so
  beacons bypass the auth gate. `api_routes` is aliased (`track→evt`/`engage→usr`/`groups→grp`)
  and must stay a **complete** object (the SDK shallow-merges it). **Keep the path + aliases
  generic** — uBlock/EasyPrivacy match tracking paths (`/ingest`, `/e/`, `/track`) by path
  regardless of domain, so never rename these to tracking-flavoured tokens.
- **Identity:** `distinct_id` = Auth0 `sub` — **never email**. `GET /users/me` does not return
  `auth0_id`, so `MixpanelProvider` derives the `sub` from the JWT access token
  (`decodeJwtSub` in `jwt-utils.ts`). `identify` before `people.set`/`register`; `reset` on
  logout. No `people.set` before identify, no profiles for anonymous users. Org stamps
  (`OrgStamps`) are super-properties only — no `people.set`/`set_group`.
- **The five stamps** ride on every event as super properties (`stamps.ts`):
  `surface` (`web`), `plan` (individuals) or `org_id`+`org_tier` (org members), plus the
  backend-only cost stamp.
- **Adding coverage:** add the name to `docs/mixpanel-setup-notion.txt` first, then to the
  union in `events.ts`, then wire the call site. New feature = one name in the
  `FeatureName` list — not a new event. **No free text** in properties (IDs/enums only);
  autocapture stays OFF.
