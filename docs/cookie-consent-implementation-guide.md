# Cookie Consent Banner — Implementation Guide

**Effective Date:** April 1, 2026  
**Last Updated:** April 1, 2026

> **Internal Document — Not for Public Distribution**

---

## Current State (as of April 2026)

**No cookie consent banner is implemented, and none is currently required.**

Souvenir uses only strictly necessary cookies (`appSession` via Auth0) and one functional cookie (`ob_{user_id}` for onboarding). All user preferences (model history, sidebar state, theme, etc.) are stored in **`localStorage`**, not in cookies. No analytics, behavioral tracking, or third-party performance monitoring scripts are active.

The live public-facing policy is at [`/front-end/docs/cookie-and-tracking-policy.md`](./cookie-and-tracking-policy.md) and linked from Settings → Help & Legal at `/legal/cookie-policy`.

This guide documents what to implement **when analytics or performance tracking tools are added**.

---

## 1. Tool

**Recommended:** Cookiebot (cookiebot.com) — ~$10–15/month  
**Alternative:** Termly (termly.io)

> **Status: Not yet set up.** Complete setup only when an analytics or APM tool is integrated.

---

## 2. Current Cookie & Storage Inventory

### Actual Cookies (set server-side)

| Cookie | Category | Set By | Default | Notes |
|---|---|---|---|---|
| `appSession` | Strictly Necessary | Auth0 (`@auth0/nextjs-auth0`) | Always ON | `HttpOnly`, `Secure`, `SameSite=Lax`. Cannot be blocked. |
| `ob_{user_id}` | Functional | Souvenir (`POST /api/onboarding/complete`) | Always ON | 1-year expiry. Records onboarding completion. |

### Browser Storage (not cookies — no consent required)

All stored client-side only, never transmitted as tracking data:

| Key | Storage | Category | Contents |
|---|---|---|---|
| `chatModelHistory` | `localStorage` | Functional | Recently selected AI model identifiers |
| `leftSidebarCollapsed` | `localStorage` | Functional | Sidebar collapsed/expanded preference |
| `activeChatId` | `localStorage` | Functional | Most recently active chat session |
| `settingsScrollTop` | `localStorage` | Functional | Scroll position in settings panel |
| `PINS_CACHE_KEY` | `localStorage` | Functional | Cached pinned items list |
| `allPersonas`, `allChats`, `allPins`, `allModels` | `localStorage` | Functional | Workflow dialog client-side caches |
| `workflow` | `localStorage` | Functional | Draft workflow canvas state |
| `personaAvatar` | `sessionStorage` | Functional | Temp avatar blob URL; cleared after save |
| `startNewChatOnLogin` | `sessionStorage` | Functional | One-time flag for post-login routing |

### Auth Tokens

JWT access tokens are held **in memory only** (`/src/lib/jwt-utils.ts`). Never written to cookies, `localStorage`, or `sessionStorage`. Cleared on logout or page refresh.

---

## 3. Planned Categories (when third-party tools are added)

When any of the following are integrated, implement Cookiebot before deploying the script.

| Category | Scripts to Block | Pre-blocked? | Default |
|---|---|---|---|
| Strictly Necessary | None (always active) | No | Always ON |
| Functional | Theme, language, model prefs (currently localStorage) | Yes | OFF |
| Analytics | Mixpanel SDK, Google Analytics | Yes | OFF |
| Performance | Sentry (error tracking), APM tools | Yes | OFF |

> **Note:** Mixpanel and Google Analytics are **not currently integrated**. Sentry exists only as a commented placeholder in `/src/components/error-boundary.tsx:48–50`. The CSP in `next.config.ts` would need to be updated to allow external analytics endpoints before any of these will function.

---

## 4. Banner Text (for future implementation)

```
"We use cookies to keep you logged in and improve Souvenir AI. Accept all,
reject non-essential, or customize. See our Cookie Policy."
```

**Buttons:** `[Accept All]` `[Reject Non-Essential]` `[Manage Preferences]`

---

## 5. Implementation Steps (when analytics are added)

1. Sign up at cookiebot.com, add `getsouvenir.com`
2. Add `<script>` tag to `/src/app/layout.tsx` `<head>` — **before** any analytics scripts
3. Enable auto-blocking mode in Cookiebot dashboard
4. Set default consent to **Deny** for all non-essential categories
5. Update CSP in `next.config.ts` to allowlist analytics domains under `connect-src` and `script-src`
6. Add footer link: **Manage Cookie Preferences** (currently no site-wide footer; the only legal links are in Settings → Help & Legal at `/src/app/settings/help-and-legal/page.tsx:51–54`)
7. Update `/front-end/docs/cookie-and-tracking-policy.md` to reflect new cookies/scripts
8. **Test:** incognito window — verify GA/Mixpanel blocked before Accept, fires after

---

## 6. Consent Logging

Cookiebot logs all consent records automatically. Retain for **24+ months** for audit compliance.

---

## 7. Maintenance

| Cadence | Task |
|---|---|
| Monthly | Review Cookiebot scan results |
| On new scripts | Verify categorization before deploying |
| On policy changes | Update `/front-end/docs/cookie-and-tracking-policy.md` and notify users (14-day notice required per policy Section 10) |

---

## 8. Key File Locations

| File | Purpose |
|---|---|
| [`/src/app/layout.tsx`](../src/app/layout.tsx) | Root layout — add Cookiebot `<script>` here |
| [`/src/app/settings/help-and-legal/page.tsx`](../src/app/settings/help-and-legal/page.tsx) | Cookie Policy link lives here (line 51–54) |
| [`/src/components/error-boundary.tsx`](../src/components/error-boundary.tsx) | Sentry placeholder at line 48–50 |
| [`next.config.ts`](../next.config.ts) | CSP headers — update when adding analytics domains |
| [`/src/app/api/onboarding/logout/route.ts`](../src/app/api/onboarding/logout/route.ts) | Clears `appSession` and `ob_{user_id}` on logout |
| [`/docs/cookie-and-tracking-policy.md`](./cookie-and-tracking-policy.md) | Live public-facing cookie policy |
