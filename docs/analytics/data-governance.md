# Product analytics: data governance and funnels

Companion to `mixpanel-frontend-implementation.md` (the event table) and `mixpanel-backend-contract.md`.

## What is collected

- **Event properties are IDs, slugs, enums, counts and booleans only.** No message text, prompts, titles, names, file names or AI output. The per-event shapes are typed in `BrowserEventPropMap` (`src/lib/analytics/events.ts`), so a free-text property is a type error, not a review comment.
- **Identity:** the Auth0 user id (`sub`) after login (`MixpanelProvider`), and the org as a Mixpanel group. Nothing before login except an anonymous device id.
- **Screens are concepts, not URLs** (`routeToScreen`), so ids in paths never reach Mixpanel. `screen_viewed` adds `tab` for the shared `org_manage` concept.
- **Web Vitals:** a sampled `web_vital` event per metric (decision D6), tagged with the screen concept.
- **Not collected:** autocapture, page-view auto-tracking and Session Replay are off (`lib/analytics/mixpanel.ts`).
- **Transport:** first-party `/dispatch/*` proxy (cookies stripped, 1 MB cap, five known Mixpanel routes), so ad blockers and third-party cookie rules don't apply.

## Where it is stored and for how long

- Mixpanel, DEV project for local/preview builds, PROD project for production only (`lib/config.ts`). Nothing is sent when the token is unset.
- Browser: `localStorage` persistence (device id, super properties); `resetAnalytics()` clears identity on logout.
- **Retention** is a Mixpanel project setting (default: kept until deleted). Set it in Mixpanel → Project settings → Data retention, and record the value here. Decision D21 covers whether to gate collection by consent.

## Deleting a user's data

1. Get the user's Auth0 id (`sub`); it is their Mixpanel distinct id.
2. Mixpanel → Privacy → *Create deletion request* (or the GDPR API `POST /api/app/data-deletions/v3.0/` with the distinct id) in **both** DEV and PROD projects.
3. The backend's own events (`mixpanel-backend-contract.md`) use the same id, so one request covers both doors.

## Funnels: goals → events

| Goal | Funnel (in order) |
|---|---|
| Activation | `signup_completed` → `onboarding_step_completed` (each step) → first `chat_message_sent` |
| Agent adoption | `agent_created` → `agent_published` → `agent_shared` → `share_accepted` (`kind: agent`) |
| Connector value | `connector_connect_attempted` → `connector_connected` (drop-off: `connector_connect_failed` by `reason`, `connector_connect_cancelled`) |
| Automation | `schedule_created` → `schedule_run_now` / first run → `schedule_paused` (churn signal) |
| Monetisation | `checkout_started` → `checkout_confirmed` (failures: `checkout_failed`); retention: `subscription_canceled`, `subscription_resumed` |
| Session health | `auth_refresh_failed` (`suppressed`), `auth_session_expired`, `auth_session_timed_out` per active user |
| Performance | `web_vital` p75 by `screen` and `metric` (LCP < 2.5 s, INP < 200 ms, CLS < 0.1) |

Keep Mixpanel dashboard names in this vocabulary; when an event is renamed, update the funnel here in the same pull request.
