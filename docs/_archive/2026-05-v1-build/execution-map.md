# SouvenirAI - Front-End Revamp Execution Map
**Target directory:** `front-end-new/`  
**Source:** `front-end/` (old codebase) + `design-system/` (Kaya Design System)  
**Window:** 13 working days (10 core + 3 settings)  
**Stack:** Next.js 16 · React 19 · TypeScript 5 · Tailwind v4 · @auth0/nextjs-auth0 v4 · KDS components

---

## Progress Tracker

| Day | Focus | Status | Completed |
|---|---|---|---|
| Day 1  | Environment Setup | ✅ Complete | 2026-04-30 |
| Day 2  | Auth0 + Auth Context | ✅ Complete | 2026-04-30 |
| Day 3  | API Client & Infrastructure | ✅ Complete | 2026-04-30 |
| Day 4  | App Layout & Sidebar | ✅ Complete | 2026-05-01 |
| Day 5  | Chat Infrastructure (Streaming Core) | ✅ Complete | 2026-05-01 |
| Day 6  | Chat UI Components | ✅ Complete | 2026-05-01 |
| Day 7  | Chat UX Features | ✅ Complete | 2026-05-01 |
| Day 8  | Chat Polish + Personas Foundation | ⬜ Pending | - |
| Day 9  | Personas Full Feature | ⬜ Pending | - |
| Day 10 | Security Review & Hardening | ⬜ Pending | - |
| Day 11 | Settings Shell + Lightweight Pages | ⬜ Pending | - |
| Day 12 | Settings: Account + AI & Models + Routing + Teams + Security | ⬜ Pending | - |
| Day 13 | Settings: Usage & Billing + Security Review | ⬜ Pending | - |

---

## 0. Governing Principles

1. **Old code is reference, not copy-paste.** Read the pattern, rewrite against KDS tokens and components.
2. **KDS is the component layer.** Every UI element that has a KDS equivalent must use it - no raw `<button>` / `<div>` when `Button` / `Sidebar` / `ChatInput` exist.
3. **React Compiler is on.** Zero manual `useMemo` / `useCallback`. Trust the compiler.
4. **No dark mode yet.** KDS tokens are light-mode only. Do not build dark mode. Leave the hook point (`class="dark"` on `<html>`) but no logic.
5. **Security first.** Every API response or user input rendered as HTML goes through `security.ts` before render. No exceptions.
6. **Feature parity, not feature copy.** Workflows are out of scope for this window. Scaffold the route as a stub. All 14 Settings subsections are fully built (Days 11–13).

---

## 1. Complete Folder Structure

```
front-end-new/
├── public/
│   ├── avatars/               # copied from old repo
│   ├── fonts/                 # copied from old repo
│   ├── icons/logo/            # copied from old repo
│   ├── personas/              # persona placeholder images
│   └── FrameworkLoading.json  # lottie loader
│
├── scripts/
│   └── load-secrets.mjs       # exact copy - AWS Secrets Manager fetcher
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # root: font, providers, GA
│   │   ├── globals.css                    # KDS token imports + kaya-scrollbar util
│   │   ├── page.tsx                       # redirect → /chat or /onboarding
│   │   │
│   │   ├── api/
│   │   │   ├── chat/route.ts              # streaming proxy (Next API route)
│   │   │   ├── csrf/route.ts              # CSRF token issuer
│   │   │   └── link-metadata/route.ts     # og-tag scraper
│   │   │
│   │   ├── auth/
│   │   │   └── [auth0]/route.ts           # Auth0 SDK catch-all handler
│   │   │
│   │   ├── onboarding/
│   │   │   ├── layout.tsx
│   │   │   ├── username/page.tsx
│   │   │   ├── role/page.tsx
│   │   │   ├── tone/page.tsx
│   │   │   ├── org-size/page.tsx
│   │   │   └── pricing/
│   │   │       ├── page.tsx
│   │   │       └── confirmation/page.tsx
│   │   │
│   │   └── (app)/                         # route group - all authenticated pages
│   │       ├── layout.tsx                 # AppLayout (sidebar + topbar)
│   │       ├── chat/
│   │       │   └── page.tsx               # main chat (new or most-recent)
│   │       ├── personas/
│   │       │   ├── page.tsx               # persona gallery
│   │       │   ├── new/
│   │       │   │   ├── page.tsx           # step 1: basic info
│   │       │   │   └── configure/page.tsx # step 2: prompt + settings
│   │       │   ├── [personaId]/
│   │       │   │   └── chat/page.tsx      # persona chat full-page
│   │       │   └── admin/page.tsx         # admin view stub
│   │       ├── settings/
│   │       │   ├── layout.tsx                          # settings shell: left nav + content area
│   │       │   ├── page.tsx                            # redirect → /settings/account
│   │       │   ├── account/page.tsx                    # profile + delete account
│   │       │   ├── ai-and-models/page.tsx              # model list + block toggles
│   │       │   ├── appearance/page.tsx                 # theme stub (token hook point)
│   │       │   ├── automations/page.tsx                # stub
│   │       │   ├── files-and-data/page.tsx             # storage + retention UI
│   │       │   ├── help-and-legal/page.tsx             # Formspree modals + legal links
│   │       │   ├── integrations/page.tsx               # integration cards + connect state
│   │       │   ├── memory-and-context/page.tsx         # memory toggles + context viz
│   │       │   ├── notifications/page.tsx              # 6-event × 2-channel matrix
│   │       │   ├── routing/page.tsx                    # routing prefs + per-task model
│   │       │   ├── security/page.tsx                   # 2FA + sessions + password
│   │       │   ├── teams-and-roles/page.tsx            # member list + role picker
│   │       │   └── usage-and-billing/
│   │       │       ├── page.tsx                        # plan card + credits + invoices
│   │       │       └── change-plan/
│   │       │           ├── page.tsx                    # pricing cards grid
│   │       │           └── confirmation/page.tsx       # post-Stripe confirmation
│   │       └── workflows/
│   │           └── page.tsx               # stub
│   │
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx          # root chat page composition
│   │   │   ├── ChatMessage.tsx            # single message row (user + AI)
│   │   │   ├── ChatInput.tsx              # KDS ChatInput wrapper w/ toolbar
│   │   │   ├── StreamingMessage.tsx       # AI message with streaming cursor
│   │   │   ├── ReasoningBlock.tsx         # collapsible thinking block
│   │   │   ├── CodeBlock.tsx              # highlight.js + copy button
│   │   │   ├── LaTeXRenderer.tsx          # KaTeX inline + block
│   │   │   ├── CitationsPanel.tsx         # right panel: sources + citations
│   │   │   ├── AttachmentManager.tsx      # file attach UI + preview
│   │   │   ├── ModelSelector.tsx          # KDS PresetModelSelector wrapper
│   │   │   ├── ModelSwitchDialog.tsx      # confirmation when switching mid-chat
│   │   │   ├── PinMentionDropdown.tsx     # @ mention overlay
│   │   │   ├── InitialPrompts.tsx         # empty-state suggestions
│   │   │   ├── ReferenceBanner.tsx        # "viewing shared / pinned" banner
│   │   │   ├── LinkPreviewCard.tsx        # og-tag preview chip
│   │   │   └── ClarificationPrompt.tsx    # "did you mean" suggestion strip
│   │   │
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx              # shell: sidebar + main content
│   │   │   ├── LeftSidebar.tsx            # KDS Sidebar + chat history list
│   │   │   ├── ChatHistoryItem.tsx        # KDS SidebarMenuItem variant=chat-item
│   │   │   ├── TopBar.tsx                 # breadcrumb + model chip + actions
│   │   │   ├── DeleteChatDialog.tsx       # confirmation dialog
│   │   │   └── AppDialogs.tsx             # global dialog manager
│   │   │
│   │   ├── personas/
│   │   │   ├── PersonaCard.tsx            # KDS card for gallery
│   │   │   ├── PersonaRow.tsx             # admin table row
│   │   │   ├── PersonaChatInterface.tsx   # persona-flavored chat UI
│   │   │   ├── PersonaForm.tsx            # step-1 form fields
│   │   │   ├── PersonaConfigure.tsx       # step-2 prompt + knobs
│   │   │   └── BulkActionBar.tsx          # floating bulk action strip
│   │   │
│   │   ├── settings/
│   │   │   ├── SettingsNav.tsx            # left nav (KDS SidebarMenuItem links)
│   │   │   ├── SettingsSection.tsx        # shared section wrapper (title + description + content slot)
│   │   │   ├── account/
│   │   │   │   ├── ProfileForm.tsx        # first/last name fields + dirty tracking + save
│   │   │   │   └── DeleteAccountDialog.tsx
│   │   │   ├── ai-models/
│   │   │   │   ├── ModelRow.tsx           # single model: name, provider, toggle, plan badge
│   │   │   │   └── ModelSearchBar.tsx
│   │   │   ├── billing/
│   │   │   │   ├── PlanCard.tsx           # dark plan summary card (status + dates)
│   │   │   │   ├── CreditsDisplay.tsx     # credits bar + reset date
│   │   │   │   ├── InvoiceTable.tsx       # sortable invoice history table
│   │   │   │   ├── StatusBanner.tsx       # past-due / canceled / incomplete banners
│   │   │   │   ├── PricingCardsGrid.tsx   # plan selection grid (settings variant)
│   │   │   │   ├── ChangePlanDialog.tsx   # inline plan picker dialog
│   │   │   │   └── DowngradeBlockedDialog.tsx
│   │   │   ├── routing/
│   │   │   │   ├── TaskModelPicker.tsx    # per-task model dropdown row
│   │   │   │   └── RoutingPreferenceRow.tsx
│   │   │   └── shared/
│   │   │       ├── FeedbackModals.tsx     # ReportBugModal + FeatureRequestModal (Formspree)
│   │   │       └── SettingsToggle.tsx     # reusable labeled toggle row (label + description + switch)
│   │   │
│   │   ├── shared/
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── MixpanelProvider.tsx
│   │   │   └── LoadingSpinner.tsx         # KDS skeleton fallback
│   │   │
│   │   └── ui/                            # KDS re-exports + shadcn primitives
│   │       └── index.ts                   # barrel: Button, Badge, Tooltip …
│   │
│   ├── context/
│   │   └── auth-context.tsx               # Auth0 user + billing state
│   │
│   ├── hooks/
│   │   ├── use-streaming-chat.ts          # SSE stream + abort + token counting
│   │   ├── use-chat-state.ts              # message list, optimistic updates
│   │   ├── use-chat-history.ts            # sidebar chat list + pagination
│   │   ├── use-model-selection.ts         # model picker state + persistence
│   │   ├── use-pin-operations.ts          # pin create/fetch/mention
│   │   ├── use-file-drop.ts               # drag-and-drop onto chat input
│   │   ├── use-sidebar-events.ts          # cross-component sidebar open/close
│   │   ├── use-mobile.ts                  # responsive breakpoint hook
│   │   ├── use-tags.ts                    # tag management
│   │   ├── useActivePersonas.ts           # personas available to current user
│   │   └── useHighlightJs.ts              # lazy highlight.js loader
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts                  # apiFetch() - base fetch + auth headers
│   │   │   ├── chat.ts                    # chat CRUD + message ops
│   │   │   ├── messages.ts                # message fetch + delete
│   │   │   ├── models.ts                  # available models
│   │   │   ├── personas.ts                # persona CRUD
│   │   │   ├── pins.ts                    # pin CRUD + folder ops
│   │   │   ├── user.ts                    # user profile + onboarding
│   │   │   ├── documents.ts               # file/document upload
│   │   │   └── images.ts                  # image upload
│   │   │
│   │   ├── normalizers/
│   │   │   ├── message-transformer.ts     # API message → UI message shape
│   │   │   └── normalize-utils.ts
│   │   │
│   │   ├── parsers/
│   │   │   └── content-parser.ts          # thinking blocks, citations, sources
│   │   │
│   │   ├── utils/
│   │   │   ├── avatar-utils.ts
│   │   │   ├── format-utils.ts
│   │   │   └── tag-utils.ts
│   │   │
│   │   ├── api-client.ts                  # rate limiter + circuit breaker wrapper
│   │   ├── auth0.ts                       # Auth0 server-side helpers
│   │   ├── config.ts                      # ALL endpoint constants (110+)
│   │   ├── security.ts                    # DOMPurify sanitization presets
│   │   ├── jwt-utils.ts                   # token refresh + expiry logic
│   │   ├── throttle.ts                    # CircuitBreaker, RequestQueue, backoff
│   │   ├── logger.ts                      # structured console logger
│   │   ├── utils.ts                       # cn() + misc
│   │   ├── ai-models.ts                   # model metadata + icons
│   │   ├── greetings.ts                   # random greeting strings
│   │   ├── highlight.ts                   # highlight.js setup
│   │   ├── streaming.ts                   # SSE parse utilities
│   │   ├── thinking.ts                    # reasoning block parse utilities
│   │   ├── onboarding-access.ts           # onboarding gate logic
│   │   ├── plan-config.ts                 # plan limits, features, credits, helpers
│   │   ├── plan-tier.ts                   # parsePlanTierFromApi() normalizer
│   │   ├── plan-downgrade-limits.ts       # re-exports + legacy compat
│   │   ├── pricing-cards-config.ts        # CARD_CONFIG + getPlanChangeButtonState()
│   │   ├── workspace-usage-counts.ts      # fetchWorkspaceUsageCounts()
│   │   └── markdown-utils.tsx             # remark/rehype pipeline
│   │
│   └── types/
│       ├── ai-model.ts
│       ├── chat.ts                        # Message, Chat, Attachment interfaces
│       ├── persona.ts                     # Persona, PersonaChat interfaces
│       ├── user.ts                        # AuthUser + billing fields
│       ├── billing.ts                     # Invoice, Subscription, PlanTier interfaces
│       ├── settings.ts                    # NotificationSettings, RoutingPreferences interfaces
│       └── css.d.ts
│
├── .env.local.example                     # document required env vars
├── CLAUDE.md                              # updated architecture doc
├── components.json                        # shadcn/ui config (new-york, neutral)
├── eslint.config.mjs
├── next.config.ts                         # React Compiler + CSP headers
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

---

## 2. Day-by-Day Execution Plan

### Day 1 - Environment Setup ✅ COMPLETE

> **Status:** All checkpoints passed. `npm run dev` starts without errors. KDS CSS variables confirmed in the built stylesheet.
>
> **Checkpoints:**
> - ✅ 2.1.1 Scaffold - Next.js 16.2.4 + React 19.2.4 + TypeScript 5 + Tailwind v4 scaffolded
> - ✅ 2.1.2 Dependencies - all packages installed (`@auth0/nextjs-auth0`, `@aws-sdk/client-secrets-manager`, `isomorphic-dompurify`, `katex`, `highlight.js`, `react-markdown`, `remark-*`, `rehype-*`, `framer-motion`, `mixpanel-browser`, `sonner`, `@radix-ui/*`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`)
> - ✅ 2.1.3 Tailwind v4 + KDS Token Integration - `globals.css` imports all four token layers; `kaya-scrollbar` + `kaya-chat-textarea` utilities defined; KDS tokens confirmed in build output (`--neutral-*`, `--blue-*`, `--shadow-*`, semantic aliases, font tokens)
> - ✅ 2.1.3 Turbopack cross-root fix - `turbopack.root` set to parent `New Design System/` dir in `next.config.ts`; `src/styles/tokens/` junction created → `design-system/src/styles/tokens/`
> - ✅ 2.1.4 `next.config.ts` - React Compiler enabled, CSP + security headers configured (`X-Frame-Options: DENY`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Content-Security-Policy`)
> - ✅ 2.1.5 Secrets Pipeline - `scripts/load-secrets.mjs` copied from old repo; `predev` + `prebuild` hooks wired in `package.json`
> - ✅ 2.1.5 `.env.local.example` - AWS bootstrap + Auth0 env vars documented
> - ✅ 2.1.6 TypeScript Config - `paths: { "@/*": ["./src/*"] }` confirmed
> - ✅ Root layout - `metadata` set to SouvenirAI; no dark mode logic; `h-full antialiased` body
> - ✅ Root page - `redirect("/chat")` via Next.js `redirect()`

**Goal:** A running Next.js 16 shell with KDS tokens loaded, Tailwind v4 configured, and the secrets pipeline wired.

#### 2.1.1 Scaffold

```bash
npx create-next-app@latest front-end-new \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*"
```

Then immediately update to Next.js 16 + React 19 if the scaffolder hasn't done so.

#### 2.1.2 Dependencies to Install

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@auth0/nextjs-auth0": "^4.0.0",
    "isomorphic-dompurify": "^2.x",
    "katex": "^0.16.x",
    "highlight.js": "^11.x",
    "react-markdown": "^9.x",
    "remark-gfm": "^4.x",
    "remark-math": "^6.x",
    "rehype-katex": "^7.x",
    "rehype-highlight": "^7.x",
    "framer-motion": "^12.x",
    "mixpanel-browser": "^2.x",
    "sonner": "^1.x",
    "@radix-ui/react-slot": "^1.x",
    "@radix-ui/react-dialog": "^1.x",
    "@radix-ui/react-dropdown-menu": "^2.x",
    "@radix-ui/react-tooltip": "^1.x",
    "@radix-ui/react-scroll-area": "^1.x",
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x",
    "lucide-react": "^0.x",
    "@strange-huge/icons": "workspace:*"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.x",
    "typescript": "^5.x",
    "@types/react": "^19.x",
    "@types/node": "^22.x",
    "@types/katex": "^0.16.x",
    "eslint": "^9.x",
    "eslint-config-next": "^16.x"
  }
}
```

#### 2.1.3 Tailwind v4 + KDS Token Integration

`postcss.config.mjs` - identical to old repo (just `@tailwindcss/postcss`).

`src/app/globals.css`:
```css
@import "@tailwindcss/postcss";

/* KDS Design Tokens - import order is mandatory */
@import "../../design-system/src/styles/tokens/primitives.css";
@import "../../design-system/src/styles/tokens/aliases.css";
@import "../../design-system/src/styles/tokens/semantic.css";
@import "../../design-system/src/styles/tokens/typography.css";

/* KDS utility class - apply to every scrollable element */
.kaya-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--neutral-800-30) transparent;
}
.kaya-scrollbar::-webkit-scrollbar       { width: 3px; }
.kaya-scrollbar::-webkit-scrollbar-track { background: transparent; }
.kaya-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--neutral-800-30);
  border-radius: 999px;
}
.kaya-scrollbar::-webkit-scrollbar-thumb:hover { background-color: var(--neutral-800-50); }

/* Chat textarea custom scrollbar (on light surface) */
.kaya-chat-textarea {
  scrollbar-width: thin;
  scrollbar-color: var(--neutral-500-60) transparent;
}
.kaya-chat-textarea::-webkit-scrollbar       { width: 3px; }
.kaya-chat-textarea::-webkit-scrollbar-track { background: transparent; }
.kaya-chat-textarea::-webkit-scrollbar-thumb {
  background-color: var(--neutral-500-60);
  border-radius: 999px;
}
```

**Note on import path:** During development we import directly from the sibling `design-system/` folder. Before production, replace with the published `@kaya/design-system` package.

#### 2.1.4 `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,   // DO NOT add manual useMemo/useCallback
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://devapi.getsouvenir.com https://*.auth0.com",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

#### 2.1.5 Secrets Pipeline

Copy `scripts/load-secrets.mjs` verbatim from old repo. Add to `package.json`:

```json
{
  "scripts": {
    "predev": "node scripts/load-secrets.mjs",
    "dev": "next dev",
    "prebuild": "node scripts/load-secrets.mjs",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "load-secrets": "node scripts/load-secrets.mjs"
  }
}
```

`.env.local.example`:
```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_SECRET_NAME=souvenirai-frontend/development
```

#### 2.1.6 TypeScript Config

`tsconfig.json` - same as old repo. Key: `"paths": { "@/*": ["./src/*"] }`.

**Day 1 Deliverable:** ✅ `npm run dev` starts without errors. KDS CSS variables confirmed in the production build output CSS (`--neutral-*`, `--blue-*`, `--red-*`, `--shadow-*`, font + semantic aliases, `.kaya-scrollbar`, `.kaya-chat-textarea`).

---

### Day 2 - Auth0 + Auth Context ✅ COMPLETE

> **Status:** All checkpoints passed. Auth0 SDK wired, proxy guard active, AuthProvider in root layout.
>
> **Checkpoints:**
> - ✅ 2.2.1 Auth0 SDK - `@auth0/nextjs-auth0@^4.19.0` installed; env vars documented in `.env.local.example`
> - ✅ 2.2.2 Route Handler - `src/app/auth/[auth0]/route.ts` + `src/app/auth/access-token/route.ts` + `src/lib/auth0.ts`
> - ✅ 2.2.3 Proxy - `src/proxy.ts` (Next.js 16 uses `proxy.ts` instead of `middleware.ts`) with auth guard + onboarding gate + checkout-cookie passthrough
> - ✅ 2.2.4 Auth Context - `src/context/auth-context.tsx` with `AuthUser` merging Auth0 session + `GET /users/me` shape; `AuthProvider` wraps root layout; no `useMemo`/`useCallback` (React Compiler)
> - ✅ 2.2.5 JWT Utils - `src/lib/jwt-utils.ts` with `getAuthHeaders()`, in-memory token cache, 60s expiry buffer, proactive 30s refresh interval
> - ✅ Supporting libs - `src/lib/config.ts` (110+ endpoints), `src/lib/plan-tier.ts`, `src/lib/plan-config.ts`, `src/lib/utils/format-utils.ts`, `src/lib/onboarding-access.ts`, `src/lib/api/client.ts` (minimal), `src/lib/api/user.ts`

**Goal:** Full auth flow - login, callback, session, token refresh, onboarding gate - working end-to-end.

#### 2.2.1 Auth0 SDK Setup

```bash
npm i @auth0/nextjs-auth0@^4
```

Required env vars (fetched from AWS Secrets Manager, not hardcoded):
```
AUTH0_SECRET=
AUTH0_BASE_URL=
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=
```

#### 2.2.2 Route Handler - `src/app/auth/[auth0]/route.ts`

```ts
import { handlers } from "@/lib/auth0";
export const { GET, POST } = handlers;
```

`src/lib/auth0.ts`:
```ts
import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    scope: "openid profile email offline_access",
  },
});

export const { handlers, auth, signIn, signOut } = auth0;
```

#### 2.2.3 Proxy - `src/proxy.ts` (Next.js 16 routing file - replaces `middleware.ts`)

```ts
// src/proxy.ts - Next.js 16 uses proxy.ts instead of middleware.ts
import { auth0 } from "@/lib/auth0";
import { userMeRootAllowsMainApp } from "@/lib/onboarding-access";

export default async function proxy(request: Request) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/auth/") || pathname.startsWith("/api/")) {
    return await auth0.middleware(request);
  }

  const session = await auth0.getSession();

  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname || "/");
    return Response.redirect(loginUrl);
  }

  // Onboarding gate + checkout-cookie passthrough - see src/proxy.ts for full impl
  return await auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
```

#### 2.2.4 Auth Context - `src/context/auth-context.tsx`

Port from old repo exactly. `AuthUser` merges the Auth0 session (identity fields) with the `GET /users/me` API response (billing + onboarding fields):

```ts
// --- Auth0 session fields (from JWT / Auth0 userinfo) ---
interface Auth0SessionUser {
  sub: string;           // Auth0 user ID
  name: string;          // display name
  picture: string;       // avatar URL
  nickname: string;
}

// --- API: GET /users/me response shape ---
interface UsersMeResponse {
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;    // ISO timestamp
  active: boolean;

  // Billing
  plan_type: "starter" | "pro" | "power" | null;  // null = no paid plan
  subscription_status: string | null;              // "active" | "past_due" | "canceled" | "incomplete" | "unpaid" | null
  current_period_end: string | null;               // ISO timestamp
  cancel_at_period_end: boolean;
  invoices: Invoice[];
  upcoming_invoice: {
    amount_due: number;
    currency: string;
    next_payment_date: string;
  } | null;

  // Usage
  usage: {
    monthly_limit: number;
    monthly_used: number;
    monthly_used_pct: number;   // 0–100
    bonus_credits: number;
    effective_limit: number;
    by_category: {
      chat: number;
      persona: number;
      workflow: number;
    };
  };

  // Onboarding
  onboarding: {
    completed: boolean;
    user_role: string;    // raw API value - map through ROLE_LABELS before display
    ai_tone: string;
    role_fit: string;
  };
}

// --- Merged shape used throughout the app ---
interface AuthUser extends Auth0SessionUser, UsersMeResponse {}
```

> **Note on `plan_type`:** The API returns `null` for users on no paid plan (free tier). The plan union is `"starter" | "pro" | "power" | null` - never `"free"`. All plan-gating helpers in `plan-config.ts` must treat `null` as the free tier.

Context must expose: `user`, `isLoading`, `refreshUser()`, `logout()`.

#### 2.2.5 JWT Utils - `src/lib/jwt-utils.ts`

Port from old repo. Critical behaviors:
- `getAuthHeaders()` - returns `Authorization: Bearer <token>`, refreshes if within 60s of expiry
- `isTokenExpired(token)` - checks `exp` claim
- Token stored in memory (no localStorage). Refresh via Auth0 `/auth/access-token` route.

**Edge Cases:**
| Scenario | Handling |
|---|---|
| Token expired during active streaming | Stop stream, refresh token, show "Session refreshed - continue?" toast |
| Refresh request fails (network) | Retry once after 2s; on second failure redirect to login |
| Multiple simultaneous requests need refresh | Serialize behind a single in-flight refresh promise |
| User signs in on another tab | Broadcast logout via `BroadcastChannel("auth")` |
| Auth0 callback with `?error=access_denied` | Show user-facing error toast, redirect to `/` |

**Day 2 Deliverable:** ✅ Login → callback → `/chat` redirect works. `useAuth()` hook returns populated user. Protected routes redirect unauthenticated visitors via `src/proxy.ts`.

---

### Day 3 - API Client & Infrastructure ✅ COMPLETE

> **Checkpoints:**
> - ✅ 2.3.1 Base Client - `src/lib/api/client.ts` with `apiFetch()`, `apiFetchJson<T>()`, typed `ApiError`, `friendlyApiError()`, 401 refresh + silent retry, `auth:session-expired` event, auto Content-Type, credentials
> - ✅ 2.3.2 Resilient Wrapper - `src/lib/api-client.ts` + `throttle.ts` with rate limiters (api 100/min, upload 10/min, chat 30/min), circuit breaker (CLOSED/OPEN/HALF_OPEN, threshold 5, window 30s, `retryInMs` for UI countdown), request queue (max 5 concurrent), exponential backoff
> - ✅ 2.3.3 Config - `src/lib/config.ts` with all endpoint constants (Users, Stripe, Chats, Models, Personas, Pins, Workflows including all chat sub-endpoints)
> - ✅ 2.3.4 Logger - `src/lib/logger.ts` (debug/info silenced in production; warn/error always fire; sensitive key redaction)
> - ✅ 2.3.5 Security Module - `src/lib/security.ts` with `sanitizeKaTeX`, `sanitizeHTML`, `sanitizeInlineMarkdown`, `sanitizeURL`, `escapeHTML`, `sanitizeFolderName`, `sanitizeTagName`, `sanitizeSearchInput`, `sanitizeFileName`, `sanitizeObjectKeys`, `clearSensitiveData`, `sanitizeJSON`, `RateLimiter`
> - ✅ 2.3.6 CSRF Route - `src/app/api/csrf/route.ts` - HMAC-SHA256 signed tokens (nonce + timestamp + signature), `validateCsrfToken()` exported for other route handlers, 24 h TTL, `timingSafeEqual` comparison, `Cache-Control: no-store`

**Goal:** Fully operational API layer with rate limiting, circuit breaker, auth header injection, and all endpoint constants.

#### 2.3.1 Base Client - `src/lib/api/client.ts`

```ts
// apiFetch<T>(url, options) - adds auth headers, handles 401 refresh, returns parsed JSON
// Throws typed ApiError with { status, code, message }
```

Key behaviors from old repo:
- Reads `Authorization` header from `getAuthHeaders()`
- On `401` → refreshes token once and retries
- On `403` → throws immediately (don't retry)
- Parses `Content-Type: application/json` and `text/event-stream` differently
- Strips trailing slashes from `API_BASE_URL`

#### 2.3.2 Resilient Wrapper - `src/lib/api-client.ts`

Port `throttle.ts`, `security.ts` (RateLimiter), then wire `secureFetch`:

```
Rate limiters:
  - apiRateLimiter:    100 req / 60s
  - uploadRateLimiter:  10 req / 60s
  - chatRateLimiter:    30 req / 60s

Circuit Breaker:
  - threshold: 5 failures
  - reset window: 30s
  - States: CLOSED → OPEN → HALF_OPEN → CLOSED

Request Queue:
  - concurrency: 5 simultaneous
```

**Circuit Breaker Edge Cases:**
| State | Behavior |
|---|---|
| OPEN | Immediately reject with "Service temporarily unavailable" - do NOT show loading spinner |
| HALF_OPEN probe succeeds | Transition to CLOSED, clear failure count |
| HALF_OPEN probe fails | Return to OPEN, reset window |
| User tries to send chat during OPEN | Show inline banner in chat input: "API unreachable - retrying in Xs" with countdown |

#### 2.3.3 Config - `src/lib/config.ts`

Copy all 110+ endpoints verbatim from old repo. Group structure:
- Users, Chats, LLM Models, Personas, Pins, Documents, Images, Onboarding, Stripe

No changes to endpoint paths - backend contract is frozen.

#### 2.3.4 Logger - `src/lib/logger.ts`

Port from old repo. In production, `debug` and `info` are no-ops. `warn` and `error` always fire.

#### 2.3.5 Security Module - `src/lib/security.ts`

Port verbatim. Three presets:
- `sanitizeKaTeX(html)` - allows SVG tags for KaTeX output
- `sanitizeHTML(html)` - standard allow-list
- `sanitizeMarkdown(html)` - strict; no `<script>`, `<style>`, `<iframe>`

`RateLimiter` class is also in this file (sliding window).

#### 2.3.6 CSRF Route - `src/app/api/csrf/route.ts`

Issues a signed token per session. All non-GET API mutations from the browser include `X-CSRF-Token` header. Server validates before processing.

**Day 3 Deliverable:** ✅ `apiFetch("/users/me")` returns the current user's data. All rate limiters and circuit breaker are importable. Config is complete.

---

### Day 4 - App Layout & Sidebar ✅ COMPLETE (2026-05-01)

> **Checkpoints:**
> - ✅ 2.4.1 AppLayout - `src/components/layout/AppLayout.tsx` (sidebar + main slot + AppDialogs)
> - ✅ 2.4.2 LeftSidebar - `src/components/layout/LeftSidebar.tsx` (KDS Sidebar, new chat btn, search, history list, bottom nav, collapse persistence)
> - ✅ 2.4.3 ChatHistoryItem - `src/components/layout/ChatHistoryItem.tsx` (hover menu, optimistic rename, delete, star)
> - ✅ 2.4.4 TopBar - `src/components/layout/TopBar.tsx` (editable title, model chip, citations toggle, user dropdown)
> - ✅ `(app)` route group layout wired - `src/app/(app)/layout.tsx`

**Goal:** The authenticated shell - KDS Sidebar with chat history list, top bar, and responsive collapse.

#### 2.4.1 AppLayout - `src/components/layout/AppLayout.tsx`

Composes:
- `LeftSidebar` (KDS `<Sidebar>` + `<SidebarInset>`)
- `<main>` slot for page content
- `AppDialogs` (global dialog manager - DeleteChat, ModelSwitch, etc.)

Uses KDS `SidebarContext` for open/collapsed state.

#### 2.4.2 LeftSidebar - `src/components/layout/LeftSidebar.tsx`

Uses KDS `<Sidebar>` → `<SidebarProjectsSection>` → `<SidebarMenuItem>` chain.

Sections (top to bottom):
1. Logo + collapse button
2. "New Chat" button (`Button variant="outline"` in KDS)
3. Search input (KDS `InputField` small)
4. Chat history list → `ChatHistoryItem` list (virtual-scrolled via `ScrollArea`)
5. Bottom: Persona nav link, Settings nav link, User avatar + name

**Sidebar State Persistence:** Collapse state saved to `localStorage` key `sidebar_collapsed`.

#### 2.4.3 ChatHistoryItem - `src/components/layout/ChatHistoryItem.tsx`

Wraps KDS `<SidebarMenuItem variant="chat-item">`. On hover shows a `...` menu (rename, delete, star).

**Edge Cases:**
| Case | Handling |
|---|---|
| Title too long | Truncate at 40 chars with `…` |
| Chat is currently active | `isActive` prop → KDS active state styling |
| Optimistic rename | Update local state immediately; revert on API error |
| Delete with unsaved in-progress stream | Abort stream first, then delete |
| Starred chats | Show star icon badge on item |
| Empty history | Show "No chats yet" empty state (KDS `Badge` + muted text) |

#### 2.4.4 TopBar - `src/components/layout/TopBar.tsx`

Contains:
- Chat title (editable on double-click → inline `InputField`)
- Active model chip (KDS `Badge`)
- Citations toggle button
- User avatar → dropdown (settings, logout)

**Day 4 Deliverable:** ✅ Full-page shell renders, sidebar opens/closes, chat history loads and displays.

---

### Day 5 - Chat Infrastructure (Streaming Core) ✅ COMPLETE (2026-05-01)

> **Checkpoints:**
> - ✅ 2.5.1 Streaming Hook - `src/hooks/use-streaming-chat.ts` (SSE state machine, 50ms batch flush, abort + stop API call, chunk/reasoning/metadata/done/error events)
> - ✅ 2.5.2 Chat State Hook - `src/hooks/use-chat-state.ts` (UIMessage type, message list, optimistic insert, rollback)
> - ✅ 2.5.3 Content Parser - `src/lib/parsers/content-parser.ts` (thinking blocks, extractSources, mergeStreamingText in streaming.ts)
> - ✅ 2.5.4 Chat API Route - `src/app/api/chat/route.ts` (server-side JWT proxy via auth0.getAccessToken, ReadableStream passthrough, X-Chat-Id header forwarding)
> - ✅ Supporting - `src/lib/streaming.ts` (mergeStreamingText), `src/lib/normalizers/message-transformer.ts` (toUIMessage)

**Goal:** `use-streaming-chat.ts` and `use-chat-state.ts` fully operational. Messages render. Stop generation works.

#### 2.5.1 Streaming Hook - `src/hooks/use-streaming-chat.ts`

This is the most critical piece. Port carefully from old repo.

```
State machine:
  IDLE → WAITING → STREAMING → DONE
                             ↘ ABORTED
                             ↘ ERROR
```

Internal flow:
1. POST to `/api/chat` (Next route handler) which proxies to `CHAT_STREAM_ENDPOINT`
2. Parse SSE (`text/event-stream`) line by line
3. Parse each delta through `content-parser.ts` (thinking blocks, citations, text)
4. Append parsed delta to `streamingContent` ref - NEVER useState for each token (causes re-render storm)
5. Batch-flush to React state every 50ms via `setInterval` (throttled UI update)
6. On `[DONE]` or `error` event → finalize message, transition to DONE/ERROR

**Abort:**
- `AbortController` stored in ref
- `controller.abort()` on user "stop" click
- Also call `CHAT_STOP_ENDPOINT` to signal backend

**Edge Cases - Streaming:**
| Case | Handling |
|---|---|
| Network drops mid-stream | Catch `AbortError` vs network error - show "Connection lost" inline message, offer retry |
| Backend sends malformed JSON in event | Skip that delta, log warning, continue stream |
| Stream stalls >30s with no delta | Show "Still thinking…" inline indicator; after 60s show timeout error |
| User navigates away during stream | `useEffect` cleanup → abort + stop API call |
| Token limit hit mid-stream | Backend sends `{type:"error", code:"token_limit"}` event → show inline "Response cut off" notice |
| Multiple tabs open | Each tab has independent stream; no shared state |
| Race: user sends second message before first finishes | Abort first stream, start second |

#### 2.5.2 Chat State Hook - `src/hooks/use-chat-state.ts`

Manages:
- `messages: Message[]` array (full history)
- `streamingMessageId: string | null`
- Optimistic user message insertion before stream starts
- Message normalization via `message-transformer.ts`
- Rollback on error

#### 2.5.3 Content Parser - `src/lib/parsers/content-parser.ts`

Port from old repo. Handles:
- `<thinking>…</thinking>` blocks → `ReasoningBlock` data
- Citation markers `[1]`, `[2]` → link to source panel
- Plain text deltas

#### 2.5.4 Next API Route - `src/app/api/chat/route.ts`

Proxies the stream from backend to browser:
- Reads JWT from session (server-side only, never exposed to client)
- Adds `Authorization` header
- Streams response back via `ReadableStream` / `TransformStream`
- Sets `Content-Type: text/event-stream`

**Why a proxy route?** Auth token never leaves the server. Browser cannot read it from cookies directly.

**Day 5 Deliverable:** ⬜ Can send a message, see it stream in character by character, stop mid-stream.

---

### Day 6 - Chat UI Components ✅ COMPLETE

> **Checkpoints:**
> - ✅ 2.6.1 ChatMessage - `src/components/chat/ChatMessage.tsx` (user/assistant/system roles, edit, copy, regenerate)
> - ✅ 2.6.2 Markdown Renderer - remark/rehype pipeline in `src/lib/markdown-utils.tsx` (GFM, math, highlight, sanitize)
> - ✅ 2.6.3 CodeBlock - `src/components/chat/CodeBlock.tsx` (lazy highlight.js, copy, word-wrap toggle)
> - ✅ 2.6.4 LaTeXRenderer - `src/components/chat/LaTeXRenderer.tsx` (inline + display, `sanitizeKaTeX`, error fallback)
> - ✅ 2.6.5 ReasoningBlock - `src/components/chat/ReasoningBlock.tsx` (collapsible, typewriter animation, duration label)
> - ✅ 2.6.6 CitationsPanel - `src/components/chat/CitationsPanel.tsx` (Framer Motion slide-in, source list, scroll sync)
> - ✅ 2.6.7 AttachmentManager - `src/components/chat/AttachmentManager.tsx` (drag-drop, file-type/size guards, thumbnail preview)
> - ✅ 2.6.8 ChatInterface - `src/components/chat/ChatInterface.tsx` (root composition: messages, input, citations, drag overlay)
> - ✅ 2.6.9 ChatInput - `src/components/chat/ChatInput.tsx` (animated placeholder, auto-grow, toolbar, send/stop toggle)
> - ✅ 2.6.10 useHighlightJs - `src/hooks/useHighlightJs.ts` (lazy highlight.js loader with containerRef)
> - ✅ 2.6.11 highlight.ts - `src/lib/highlight.ts` (hljs/core with ~40 languages registered)
> - ✅ 2.6.12 useFileDrop - `src/hooks/use-file-drop.ts` (document-level drag/drop with counter-based state)

**Goal:** Complete chat message rendering layer - all content types display correctly.

#### 2.6.1 ChatMessage - `src/components/chat/ChatMessage.tsx`

Roles: `user` | `assistant` | `system`

User message:
- Text rendered as plain text (no markdown - user input is literal)
- Attachment chips if files attached
- Edit button on hover (replaces text with InputField inline)

Assistant message:
- Rendered through `MarkdownRenderer` (see below)
- `ReasoningBlock` if thinking content present
- Source count chip if citations present → opens `CitationsPanel`
- Copy button on hover
- Regenerate button on hover (last message only)

#### 2.6.2 Markdown Renderer

Remark/Rehype pipeline (port from `markdown-utils.tsx`):
```
remark-gfm → remark-math → rehype-katex → rehype-highlight → HTML
```

All rendered HTML passes through `sanitizeMarkdown()` before final render.

Custom renderers:
- `code` block → `<CodeBlock>` component
- `pre` → `<CodeBlock>` wrapper
- `math` → `<LaTeXRenderer>`
- `a` → open in new tab + `rel="noopener noreferrer"`

#### 2.6.3 CodeBlock - `src/components/chat/CodeBlock.tsx`

Uses `highlight.js` (lazy-loaded via `useHighlightJs`). Features:
- Language label (top-left)
- Copy button (top-right, shows "Copied!" for 2s)
- Word-wrap toggle
- Thin `kaya-scrollbar` when overflowing

**Edge Cases:**
| Case | Handling |
|---|---|
| Unknown language | Fallback to plain text, no highlight |
| Very long single line | Horizontal scroll, no wrap by default |
| Code contains backticks | Handled by remark, not a render concern |
| Highlight.js not yet loaded | Show unstyled code, apply highlight once loaded |

#### 2.6.4 LaTeXRenderer - `src/components/chat/LaTeXRenderer.tsx`

Uses KaTeX. Output passed through `sanitizeKaTeX()`.

**Edge Cases:**
| Case | Handling |
|---|---|
| Invalid LaTeX expression | Catch `katex.ParseError`, render raw expression in `<code>` with red badge "Invalid LaTeX" |
| Display-mode ($$…$$) | `displayMode: true` |
| Inline mode ($…$) | `displayMode: false` |

#### 2.6.5 ReasoningBlock - `src/components/chat/ReasoningBlock.tsx`

Collapsible section. Default: collapsed after stream completes; expanded during streaming.
- Header: "Reasoned for Xs" (duration from stream timing)
- Content: prose, same markdown pipeline without code highlighting

#### 2.6.6 CitationsPanel - `src/components/chat/CitationsPanel.tsx`

Right panel (slides in via Framer Motion). Contains:
- Source list (URL, title, favicon)
- Click → open in new tab
- `[N]` markers in message text scroll panel to that source
- Close button

**Edge Cases:**
| Case | Handling |
|---|---|
| Panel open on mobile | Full-screen overlay instead of side panel |
| Source URL fetch fails | Show domain only, no favicon |
| No citations | Panel button hidden |

#### 2.6.7 AttachmentManager - `src/components/chat/AttachmentManager.tsx`

Drag-and-drop + click-to-upload. Supported types: PDF, DOCX, TXT, PNG, JPG, WEBP.

**Edge Cases:**
| Case | Handling |
|---|---|
| File > 25MB | Reject before upload, show toast "File too large (max 25MB)" |
| Unsupported type | Reject, show list of supported types |
| Upload fails | Remove chip, show inline error retry |
| Duplicate file (same name + size) | Show "Already attached" - do not re-upload |
| 10+ attachments | Cap at 10, show "Max 10 files" toast |
| Image preview | Thumbnail in chip; click → lightbox |

**Day 6 Deliverable:** ✅ Every content type renders correctly - markdown tables, code blocks, LaTeX, collapsible reasoning, citations.

---

### Day 7 - Chat UX Features ✅ COMPLETE

> **Checkpoints:**
> - ✅ 2.7.1 ModelSelector - `src/components/chat/ModelSelector.tsx` (modal dialog, search, grouped by provider, model icons + plan badge)
> - ✅ 2.7.1b ModelSwitchDialog - `src/components/chat/ModelSwitchDialog.tsx` (AlertDialog confirming mid-chat model switch)
> - ✅ 2.7.2 PinMentionDropdown - `src/components/chat/PinMentionDropdown.tsx` (`@` trigger, keyboard nav, color dots, search highlight)
> - ✅ 2.7.3 InitialPrompts - `src/components/chat/InitialPrompts.tsx` (personalized greeting + 4 suggestion cards)
> - ✅ 2.7.4 Chat CRUD - `src/lib/api/chat.ts` (already complete from Day 5)
> - ✅ 2.7.5 useModelSelection - `src/hooks/use-model-selection.ts` (fetchModelsWithCache, localStorage persistence)
> - ✅ 2.7.6 usePinOperations - `src/hooks/use-pin-operations.ts` (lazy-load pins, search, refresh)
> - ✅ 2.7.7 Pins API - `src/lib/api/pins.ts` (Pin/PinFolder types, listPins, getPin, listPinFolders)
> - ✅ 2.7.8 AI Models - `src/lib/ai-models.ts` (normalizeModels, fetchModelsWithCache with 60s TTL)
> - ✅ 2.7.9 Model Icons - `src/lib/model-icons.ts` (getModelIcon by company/model/provider)
> - ✅ 2.7.10 Greetings - `src/lib/greetings.ts` (time-of-day greetings, day overrides, subheading categories)
> - ✅ 2.7.11 Chat Page - `src/app/(app)/chat/page.tsx` (full composition with model selector, switch dialog, initial prompts)

**Goal:** Model selection, pin/mention, initial prompts, link preview, clarification, chat management.

#### 2.7.1 ModelSelector - `src/components/chat/ModelSelector.tsx`

Wraps KDS `<PresetModelSelector>`. Data comes from `MODELS_ENDPOINT`.

Model switching mid-chat triggers `ModelSwitchDialog` (confirmation). After confirm, next message uses new model; conversation history is preserved.

**Edge Cases:**
| Case | Handling |
|---|---|
| Selected model becomes unavailable | Show warning badge on selector; block send until model changed |
| Plan doesn't include selected model | Show upgrade prompt instead of model dialog |
| Model switch dialog dismissed | Revert selector to previous model |
| API returns model list error | Use cached model list from last successful fetch |

#### 2.7.2 PinMentionDropdown - `src/components/chat/PinMentionDropdown.tsx`

Triggered by `@` in the input. Fetches pinned items from `PINS_ENDPOINT`.

KDS `<Dropdown>` / `<DropdownMenuItem>` chain.

**Edge Cases:**
| Case | Handling |
|---|---|
| No pins | Show "No pins yet" empty state in dropdown |
| Search returns no matches | Show "No results for '@query'" |
| Pin fetch fails | Hide dropdown silently, log error |
| Mention inserted, pin deleted later | Show broken mention chip in message (read-only) |

#### 2.7.3 InitialPrompts - `src/components/chat/InitialPrompts.tsx`

Shown only on new/empty chat. Suggested prompts grid (3-4 items). On click → populate chat input.

Uses `greetings.ts` for personalized greeting above prompts.

#### 2.7.4 Chat CRUD Operations

All wired through `src/lib/api/chat.ts`:

| Operation | Endpoint | UX |
|---|---|---|
| Create chat | `CHATS_CREATE_ENDPOINT` | Optimistic - add to sidebar immediately |
| Rename chat | `CHATS_RENAME_ENDPOINT` | Inline edit in sidebar; confirm on blur/Enter |
| Delete chat | `DELETE /chats/:id` | Confirmation dialog; redirect to new chat |
| Star/unstar | `CHAT_STAR_ENDPOINT` | Toggle in sidebar; starred section at top |
| Load messages | `CHAT_MESSAGES_ENDPOINT` | Paginated (cursor-based); load-more on scroll-to-top |
| Delete message | `DELETE_MESSAGE_ENDPOINT` | Soft-delete; remove from local state immediately |

**Day 7 Deliverable:** ✅ Full chat experience minus persona mode. Model switching works. Pins autocomplete. Chat CRUD is complete.

---

### Day 8 - Chat Polish + Personas Foundation ⬜ PENDING

> **Checkpoints:**
> - ⬜ 2.8.1 ChatInput - `src/components/chat/ChatInput.tsx` (KDS ChatInput wrapper, toolbar, stop button, token counter, IME guard)
> - ⬜ 2.8.2 use-chat-history - `src/hooks/use-chat-history.ts` (paginated, date-grouped, bump-to-top on stream complete)
> - ⬜ 2.8.3 Personas Gallery - `src/app/(app)/personas/page.tsx` + `PersonaCard.tsx` (grid, loading skeleton, empty state)

**Goal:** Finalize chat edge cases. Begin personas.

#### 2.8.1 Chat Input (KDS Integration)

The `ChatInput` KDS component is the primary text entry. Wrap it in `src/components/chat/ChatInput.tsx` which adds:
- Toolbar (attach, model, tone selector)
- Send button (disabled when streaming)
- Stop button (shown only when streaming)
- Character/token counter (soft limit at 80%, hard at 100%)
- `@` mention trigger detection

**Edge Cases:**
| Case | Handling |
|---|---|
| Paste very large text (>100KB) | Warn user, truncate at 50K chars |
| Enter key submits | Shift+Enter inserts newline |
| Empty submit | Button disabled, no API call |
| IME composition (Japanese/Chinese) | Do not submit on Enter during composition |
| Streaming in progress | Send button becomes Stop; input disabled |

#### 2.8.2 use-chat-history - `src/hooks/use-chat-history.ts`

Fetches from `CHATS_ENDPOINT` with pagination. Groups by date (Today, Yesterday, Last 7 days, Older).

Real-time update: when streaming completes, bump chat to top of "Today" group without refetch.

#### 2.8.3 Personas - Gallery Page

`src/app/(app)/personas/page.tsx` + `PersonaCard.tsx`

Grid of persona cards using KDS `ModelFeaturedCard` as the base pattern (closest existing atom for a card with icon + label + badge).

Each card shows:
- Avatar image (or initials fallback)
- Persona name
- Short description (2 lines, truncated)
- Status badge (Active / Paused)
- "Chat" button → `/personas/[id]/chat`

Fetch from `PERSONAS_ENDPOINT`. Loading state → KDS `SidebarMenuSkeleton` grid.

**Edge Cases:**
| Case | Handling |
|---|---|
| No personas | Empty state with "Create your first persona" CTA |
| Persona fetch fails | Error state with retry button |
| 50+ personas | Virtual grid with windowing |
| Mixed active/paused | Segment by status (active first) |

**Day 8 Deliverable:** ⬜ Chat input is fully wired (including stop, mentions, attachments). Personas gallery page loads.

---

### Day 9 - Personas Full Feature ⬜ PENDING

> **Checkpoints:**
> - ⬜ 2.9.1 Create Persona Step 1 - `src/app/(app)/personas/new/page.tsx` + `PersonaForm.tsx` (name, description, avatar upload, validation)
> - ⬜ 2.9.2 Configure Persona Step 2 - `src/app/(app)/personas/new/configure/page.tsx` + `PersonaConfigure.tsx` (system prompt, AI enhance, model, temperature, test slide-over)
> - ⬜ 2.9.3 Persona Chat - `PersonaChatInterface.tsx` + `src/app/(app)/personas/[personaId]/chat/page.tsx`
> - ⬜ 2.9.4 Pause / Activate Persona - optimistic toggle via `PERSONA_PAUSE_ENDPOINT`
> - ⬜ 2.9.5 Bulk Actions Bar - `BulkActionBar.tsx` (KDS FloatingMenu, Framer Motion slide-in)

**Goal:** Create, configure, and chat with personas - all flows complete.

#### 2.9.1 Create Persona - Step 1 (`/personas/new`)

Fields:
- Name (required, max 50 chars)
- Description (optional, max 200 chars)  
- Avatar upload (image, max 2MB, crop to 1:1)
- Category/tag selection

Validation runs on blur, not on keystroke. On submit → `POST /persona` → redirect to step 2 with new persona ID.

**Edge Cases:**
| Case | Handling |
|---|---|
| Name already taken | API 409 → show "Name already in use" inline error |
| Avatar upload fails | Clear selection, show error, allow retry |
| User navigates away | Show "Discard changes?" dialog |
| Avatar > 2MB | Client-side reject with toast |

#### 2.9.2 Configure Persona - Step 2 (`/personas/new/configure`)

Fields:
- System prompt (large textarea, max 4000 chars)
- AI Enhancement button → calls `PERSONA_ENHANCE_ENDPOINT` → streams improved prompt back into textarea
- Model selection (same selector as main chat)
- Temperature slider (0.0 → 1.0)
- Max tokens selector
- Tone selection

"Test" button → opens slide-over panel with a live test chat against `PERSONA_TEST_ENDPOINT`.

On save → `PATCH /persona/:id` → redirect to persona gallery.

**Edge Cases:**
| Case | Handling |
|---|---|
| Enhance prompt API fails | Show toast "Enhancement unavailable"; keep original prompt |
| Enhance streams then errors | Show partial result; allow user to keep or discard |
| Test chat in slide-over | Independent state from main chat; aborted on close |
| Form has unsaved changes on navigate | "Unsaved changes" dialog |
| Save fails (network) | Keep form state, show retry toast |

#### 2.9.3 Persona Chat - `PersonaChatInterface.tsx`

Same streaming core as main chat (`use-streaming-chat`). Differences:
- Endpoints: `PERSONA_CHAT_STREAM_ENDPOINT(personaId, chatId)`
- Sidebar shows persona-specific chat history (`PERSONA_CHATS_ENDPOINT`)
- Chat create: `PERSONA_CHATS_CREATE_ENDPOINT`
- Top bar shows persona avatar + name instead of model badge

Port `PersonaChatFullPage.tsx` from old repo, replacing all shadcn/ui primitives with KDS equivalents.

**Edge Cases:**
| Case | Handling |
|---|---|
| Persona paused | Show "This persona is paused" banner; disable chat input |
| Persona deleted while in chat | Redirect to personas gallery with toast |
| Persona chat history empty | Same InitialPrompts with persona-flavored suggestions |

#### 2.9.4 Pause / Activate Persona

Toggle from gear menu on persona card. Calls `PERSONA_PAUSE_ENDPOINT`. Optimistic UI - update badge immediately, revert on failure.

#### 2.9.5 Bulk Actions Bar

Appears when 1+ personas checked. Options: Delete (with confirmation), Activate, Pause.

Uses KDS `FloatingMenu` at bottom of viewport. Framer Motion slide-in from bottom.

**Day 9 Deliverable:** ⬜ Full persona lifecycle - create, configure, chat, pause, delete - working end-to-end.

---

### Day 10 - Security Review & Hardening (Mid-Point Audit) ⬜ PENDING

> **Checkpoints:**
> - ⬜ 2.10.1 Input Sanitization Audit - all `dangerouslySetInnerHTML` sites, API-sourced HTML, link/image src validation
> - ⬜ 2.10.2 Authentication Guards Audit - middleware, server components, route handlers, JWT expiry, token leakage
> - ⬜ 2.10.3 CSRF Protection Audit - token issuance, header injection, `SameSite=Strict`
> - ⬜ 2.10.4 Rate Limiting Audit - all three limiters enforced, circuit breaker UI, logging
> - ⬜ 2.10.5 CSP and HTTP Headers Audit - all headers present and correct
> - ⬜ 2.10.6 Dependency Audit - `npm audit --audit-level=moderate` clean (or exceptions documented)
> - ⬜ 2.10.7 Sensitive Data Audit - no secrets in source, no stack traces to client, proxy route confirmed

**Goal:** Systematic security audit of everything built in Days 1–9 before entering the settings sprint. No feature work on this day. All findings must be resolved before Day 11 begins.

#### 2.10.1 Input Sanitization Audit

**Checklist (every render site in chat + personas):**
- [ ] `dangerouslySetInnerHTML` only used with DOMPurify output
- [ ] All API-sourced strings rendered as HTML go through `sanitizeHTML()`, `sanitizeMarkdown()`, or `sanitizeKaTeX()`
- [ ] User-supplied content (chat messages, persona names/descriptions) is never rendered as HTML - always plain text or through the sanitized markdown pipeline
- [ ] Link `href` values from API validated (must start with `https://` or `/`)
- [ ] Image `src` values from API validated against allowed domains

#### 2.10.2 Authentication Guards Audit

**Checklist:**
- [ ] Every route under `(app)/` layout is covered by middleware auth check
- [ ] `auth()` called server-side in every server component that reads user data - never trust client-provided user ID
- [ ] All `src/app/api/` route handlers call `auth()` and return `401` if no session
- [ ] JWT `exp` is checked before every `getAuthHeaders()` call
- [ ] Auth token never logged, never included in error messages sent to client
- [ ] `BroadcastChannel("auth")` logout propagation works across tabs

#### 2.10.3 CSRF Protection Audit

**Checklist:**
- [ ] `/api/csrf/route.ts` issues token tied to session
- [ ] All state-mutating fetch calls from the browser include `X-CSRF-Token` header
- [ ] CSRF route validates token against session before processing
- [ ] `SameSite=Strict` on auth cookies

#### 2.10.4 Rate Limiting Audit

**Checklist:**
- [ ] `chatRateLimiter` (30 req/min) enforced before every stream request
- [ ] `uploadRateLimiter` (10 req/min) enforced before every file upload
- [ ] `apiRateLimiter` (100 req/min) enforced on all other API calls
- [ ] Rate limit errors surface as user-facing toasts - not silent failures, not raw 429 responses
- [ ] Circuit breaker OPEN state shows an inline banner in the chat UI with countdown
- [ ] Circuit breaker state transitions are logged via `logger`

#### 2.10.5 CSP and HTTP Headers Audit

**Checklist:**
- [ ] `Content-Security-Policy` configured via `next.config.ts` headers (not `<meta>` tags)
- [ ] `X-Frame-Options: DENY` present
- [ ] `X-Content-Type-Options: nosniff` present
- [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` present
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` present
- [ ] No `eval()` in source (React Compiler never emits it)
- [ ] GA and Mixpanel domains listed in `script-src` CSP directive
- [ ] Backend API domain listed in `connect-src`

#### 2.10.6 Dependency Audit

```bash
npm audit --audit-level=moderate
```

All `moderate` and above must be resolved or have a written justification committed to `docs/security-exceptions.md`.

#### 2.10.7 Sensitive Data Audit

**Checklist:**
- [ ] No secrets in source code or committed `.env` files (`.env.local` in `.gitignore`)
- [ ] `console.log` / `console.debug` calls containing user data are behind `NODE_ENV === "development"` guards
- [ ] Error messages sent to the client contain no stack traces, file paths, or internal details
- [ ] Auth0 client secret is never imported by any file in `src/` that is not a server-only route handler
- [ ] Streaming proxy route (`/api/chat`) injects the Auth token server-side - token is never visible in browser Network tab

**Day 10 Deliverable:** ⬜ All checklists green. Any exceptions documented. Codebase is clean before settings sprint begins.

---

### Day 11 - Settings Shell + Lightweight Pages ⬜ PENDING

> **Checkpoints:**
> - ⬜ 2.11.1 Settings Layout - `src/app/(app)/settings/layout.tsx` + `SettingsNav.tsx` + `SettingsSection.tsx` (mobile collapse to Select)
> - ⬜ 2.11.2 Notifications Page - 6-event × 2-channel toggle matrix, `SettingsToggle.tsx`
> - ⬜ 2.11.3 Memory & Context Page - 4 toggles, clear-all button, context priority list, context window viz
> - ⬜ 2.11.4 Files & Data Page - storage bar, file-size/type/retention dropdowns, export + clear actions
> - ⬜ 2.11.5 Help & Legal Page - `FeedbackModals.tsx` (Formspree), legal links, footer
> - ⬜ 2.11.6 Integrations Page - 7 integration cards, "Coming soon" tooltip on connect
> - ⬜ 2.11.7 Appearance Page - stub with theme hook point
> - ⬜ 2.11.8 Automations Page - stub

**Goal:** Settings navigation shell running. All UI-only or low-complexity pages (7 of 14) fully implemented.

#### 2.11.1 Settings Layout - `src/app/(app)/settings/layout.tsx`

Two-column shell: fixed left nav + scrollable content area.

Left nav built with KDS `<SidebarMenuItem>` links - one per settings section. Active route highlighted via Next.js `usePathname()`. Nav items:

| Label | Route | Icon |
|---|---|---|
| Account | /settings/account | PersonIcon |
| AI & Models | /settings/ai-and-models | SparkleIcon |
| Appearance | /settings/appearance | PaletteIcon |
| Automations | /settings/automations | BoltIcon |
| Files & Data | /settings/files-and-data | FolderIcon |
| Help & Legal | /settings/help-and-legal | QuestionMarkIcon |
| Integrations | /settings/integrations | LinkIcon |
| Memory & Context | /settings/memory-and-context | BrainIcon |
| Notifications | /settings/notifications | BellIcon |
| Routing | /settings/routing | RouteIcon |
| Security | /settings/security | LockIcon |
| Teams & Roles | /settings/teams-and-roles | PeopleIcon |
| Usage & Billing | /settings/usage-and-billing | CreditCardIcon |

On mobile: nav collapses to a `<Select>` dropdown above the content area (KDS `InputField` with dropdown).

**`SettingsSection.tsx`** - shared wrapper every page uses:
```tsx
// Props: title, description?, children
// Renders: page heading (typography token), optional muted description, content slot
// Adds consistent top/bottom padding and max-width constraint
```

#### 2.11.2 Notifications Page - `src/app/(app)/settings/notifications/page.tsx`

**Data shape:**
```ts
interface NotificationSettings {
  inApp: Record<NotificationEvent, boolean>;
  email:  Record<NotificationEvent, boolean>;
}
type NotificationEvent =
  | "automation-complete" | "automation-failed" | "file-processed"
  | "memory-updated"      | "budget-alert"      | "team-invite";
```

**Defaults:**
```ts
inApp: all true
email: { "automation-failed": true, "budget-alert": true, "team-invite": true }
```

UI: a table with event rows and two toggle columns (In-app, Email). Each cell is a KDS `Switch`. Rows separated by KDS `Divider`.

No API in v1 - state is local. Structure is built API-ready (future: `PATCH /users/me/notifications`).

**`SettingsToggle.tsx`** - `label + optional description + KDS Switch` in a flex row. Reused across Notifications, Memory, Files & Data, Security.

#### 2.11.3 Memory & Context Page - `src/app/(app)/settings/memory-and-context/page.tsx`

Sections (all local state, no API in v1):

**"What gets remembered" toggles (4 rows via `SettingsToggle`):**
- Pinned items (default on)
- User preferences (default on)
- Project facts (default on)
- Exclude sensitive info (default on)

**"Clear all memory" button** - KDS `Button variant="destructive"`. On click: confirmation dialog → success toast. No API in v1 (button scaffolded for `DELETE /users/me/memory`).

**Context assembly priority list** - ordered list of 5 items (Pinned Items → Current Chat → Connected docs → Persona Notes → Workspace Memory). Read-only in v1.

**Context window viz** - progress bar (65%, ~130K tokens label). KDS `Badge` for percentage chip.

#### 2.11.4 Files & Data Page - `src/app/(app)/settings/files-and-data/page.tsx`

All local state (API-ready structure). Sections:

**Storage** - "720 MB / 2 GB" with KDS progress bar. Plan label badge.

**Max file size** - KDS `InputField` with dropdown variant. Options: 10 MB, 30 MB, 50 MB (default).

**Allowed file types** - KDS `InputField` with dropdown. Options: All, Documents only, Spreadsheets, Images, Custom.

**File retention** - KDS `InputField` with dropdown. Options: 7, 30, 90, 270, 365 days (default 30).

**Export all data** - KDS `Button variant="outline"`. Future: triggers `GET /users/me/export`.

**Clear all files** - KDS `Button variant="destructive"` with confirmation dialog.

#### 2.11.5 Help & Legal Page - `src/app/(app)/settings/help-and-legal/page.tsx`

**Help section (4 rows):**
- Report a Bug → opens `ReportBugModal`
- Request a Feature → opens `FeatureRequestModal`
- Contact Support → `<a href="https://getsouvenir.com/contact" target="_blank">`
- Documentation → external link

**Legal section (3 rows):**
- Terms of Service → external link
- Privacy Policy → external link
- Cookie Policy → external link

**Footer:** `SouvenirAI v1.0.0 · © {year}`

**`FeedbackModals.tsx`** - two Formspree modals:

`ReportBugModal`:
- Formspree endpoint: `xjgjgopw`
- Fields: Name (KDS `InputField`), Email (KDS `InputField`), Message (KDS `InputGroup` with auto-resize textarea)
- Submit → Formspree POST → success view ("Thanks for reporting!")
- Error: inline validation messages

`FeatureRequestModal`:
- Formspree endpoint: `mrerelnz`
- Same field structure as bug modal
- Success view: "Thanks for the idea!"

**Edge Cases:**
| Case | Handling |
|---|---|
| Formspree rate limited | Show "Too many submissions - try again later" |
| Network error on submit | Keep form open, show error toast, allow retry |
| Email field invalid | Inline "Enter a valid email" error on blur |
| Message empty on submit | Inline "Message is required" |

#### 2.11.6 Integrations Page - `src/app/(app)/settings/integrations/page.tsx`

7 integration cards (Slack, GitHub, Notion, Google Drive, Jira, Linear, Figma). All disconnected by default.

Each card: logo initials in rounded box, name + description, KDS `Button` ("Connect" / "Connected"). Local state toggle in v1; wired to real OAuth in a future sprint.

On "Connect" click: show "Coming soon" `Tooltip` - do not navigate away.

#### 2.11.7 Appearance Page - `src/app/(app)/settings/appearance/page.tsx`

Stub with scaffolded structure only. One `SettingsSection` titled "Appearance" with "Theme customization coming soon" as a KDS `Badge`. Dark mode hook point left in layout: `class={theme}` on `<html>` (no logic yet).

#### 2.11.8 Automations Page - `src/app/(app)/settings/automations/page.tsx`

Stub - `SettingsSection` with "Automations coming soon" badge.

**Day 11 Deliverable:** ⬜ Settings nav works. Notifications, Memory, Files & Data, Help & Legal, Integrations, Appearance, and Automations pages are complete.

---

### Day 12 - Settings: Account + AI & Models + Routing + Teams + Security ⬜ PENDING

> **Checkpoints:**
> - ⬜ 2.12.1 Account Page - `ProfileForm.tsx` (dirty tracking, save, role badge), `DeleteAccountDialog.tsx`
> - ⬜ 2.12.2 AI & Models Page - `ModelRow.tsx` (plan gate, toggle), `ModelSearchBar.tsx`, optimistic toggle + revert
> - ⬜ 2.12.3 Routing Page - `RoutingPreferenceRow.tsx`, `TaskModelPicker.tsx` (5 per-task dropdowns), budget alert toggle
> - ⬜ 2.12.4 Security Page - 2FA toggle stub, change-password redirect, active sessions table (v1 placeholder)
> - ⬜ 2.12.5 Teams & Roles Page - member table with role dropdown, invite modal stub

**Goal:** All data-connected settings pages (except billing) fully operational.

#### 2.12.1 Account Page - `src/app/(app)/settings/account/page.tsx`

**Profile form (`ProfileForm.tsx`):**

Fields:
- Email - read-only `InputField`, pre-filled from `auth.user.email`. No edit (Auth0-managed).
- First Name - `InputField`, required, max 50 chars
- Last Name - `InputField`, optional, max 50 chars

Dirty tracking: compare trimmed current values against original. Save button disabled when no changes. Loading spinner on save.

On save: `PATCH /users/me` with `{ first_name, last_name }` → `refreshUser()` → success toast.

Role display: read from `fetchOnboardingState()`. Map raw API value through `ROLE_LABELS`:
```ts
const ROLE_LABELS: Record<string, string> = {
  founder: "Founder", student: "Student", creator: "Creator",
  engineer: "Engineer", marketing_sales: "Marketing / Sales",
  researcher: "Researcher", enterprise: "Enterprise", other: "Other",
};
```
Displayed as a read-only `Badge` below the name fields.

**Avatar section:**
- Initials avatar (first initial of firstName + first initial of lastName, or first two chars of email local-part if name empty)
- Background color deterministic from `sub` hash
- No upload in v1 (hook point scaffolded)

**Account deactivation (`DeleteAccountDialog.tsx`):**
- Trigger: "Deactivate account" link (destructive text styling, not a button)
- Dialog: confirms intent with user email displayed. KDS `Button variant="destructive"` to confirm.
- On confirm: `DELETE /users/me` → `logout()` with 1s delay → redirect to Auth0 logout
- If account already deactivated (API returns `account_status: "deactivated"`): show banner "Your account is deactivated - contact support to reactivate" and hide deactivation trigger

**Edge Cases:**
| Case | Handling |
|---|---|
| Save with network error | Keep form, show retry toast |
| First/last name contains only spaces | Trim before compare - treated as empty, revert to original |
| Delete fails (API error) | Close dialog, show error toast, do not logout |
| `fetchOnboardingState` fails | Skip role badge, do not error the whole page |
| User has no first/last name yet | Empty fields, save enabled immediately on first input |

#### 2.12.2 AI & Models Page - `src/app/(app)/settings/ai-and-models/page.tsx`

**Data fetch:** `fetchAllModels()` → `MODELS_ALL_ENDPOINT`. Returns all models (including blocked ones).

**`ModelRow.tsx`** - one row per model:
- Model name + provider (from `model_name`, `model_provider`)
- Context window badge (`model_context_window`)
- Capability chips: `model_inputs` list (text, image, file, etc.) rendered as KDS `Chip`
- Plan badge: if `requiresModelUpgrade(model.model_plan_type, user.plan_type)` → KDS `Badge` showing required plan (e.g. "Pro+")
- KDS `Switch` toggle: disabled if plan-gated; checked = not blocked

**Search bar (`ModelSearchBar.tsx`):** KDS `InputGroup` with search icon. Filters by `model_name` and `model_provider` (case-insensitive substring).

**Toggle behavior:**
1. Optimistic: flip switch state immediately
2. Call `toggleBlockModel(model_id)` → `POST /llm/models/block`
3. On error: revert switch, show toast "Failed to update model preference"

**Plan-gating:**
- Locked toggle shows `Tooltip` on hover: "Upgrade to Pro to enable this model"
- Click on locked toggle → upgrade prompt toast with link to `/settings/usage-and-billing/change-plan`

**Edge Cases:**
| Case | Handling |
|---|---|
| Models fetch fails | Error state + retry button |
| Toggle fails (network) | Revert + toast |
| Search returns no results | "No models match your search" empty state |
| All models blocked | Warning banner "No models are active - at least one is required" |
| User plan changes externally | `refreshUser()` on page focus, re-evaluate plan gates |

#### 2.12.3 Routing Page - `src/app/(app)/settings/routing/page.tsx`

**Sections:**

**Routing preference (`RoutingPreferenceRow.tsx`)** - KDS `InputField` with dropdown:
- Options: "Cost-Optimized", "Balanced" (default), "Quality-First"
- Local state only in v1

**Souvenir Algorithm** - same dropdown pattern:
- Options: "Advanced" (default), "Standard"
- Pro plan badge via KDS `Badge`; non-Pro users see it greyed with upgrade `Tooltip`

**Per-task model assignment (`TaskModelPicker.tsx`)** - 5 rows:

| Task | Default |
|---|---|
| Research & Analysis | Select model |
| Code Generation | Select model |
| Creative Writing | Select model |
| Quick Q&A | Select model |
| Data Processing | Select model |

Each row: task label + KDS `InputField` dropdown. Dropdown items built from `fetchModelsWithCache()` result - each item is a `ModelSelectItem`-patterned row (model name + provider). Searchable via `InputGroup` inside dropdown popover.

**Token & Budget Controls:**
- "Budget Alerts" `SettingsToggle` - default on
- Description: "Notify at 50%, 80%, and 100% of budget usage"

**Edge Cases:**
| Case | Handling |
|---|---|
| Model list fetch fails | Show "Could not load models" in each picker, retry on focus |
| Algorithm section on non-Pro | Show greyed section with upgrade badge; selection disabled |
| 5 pickers all set to same model | Allow - no constraint |

#### 2.12.4 Security Page - `src/app/(app)/settings/security/page.tsx`

**Two-Factor Authentication:**
- `SettingsToggle` - default off
- On enable click (future): redirect to Auth0 MFA enrollment. In v1: show "2FA setup coming soon" toast.

**Change Password:**
- KDS `Button variant="outline"` - "Change password"
- On click: redirect to Auth0 password change universal page
- Shows last-changed label: "Last changed 45 days ago" (placeholder in v1; future: read from Auth0 Management API)

**Active Sessions:**
- Table of device sessions: device name, browser, last active, IP (partially masked)
- Current session row: green "Current" KDS `Badge`
- Other sessions: "Revoke" KDS `Button variant="outline"` per row
- "Log out all other sessions" KDS `Button variant="destructive"`
- In v1: session data is placeholder. On "Revoke" / "Log out all" → show toast "Session revoked" (no API call). Future: `DELETE /auth/sessions/:id`.

**Edge Cases:**
| Case | Handling |
|---|---|
| Revoke own session | Disabled - "Current" row has no revoke button |
| "Log out all" with only 1 session (current) | Button hidden / disabled |

#### 2.12.5 Teams & Roles Page - `src/app/(app)/settings/teams-and-roles/page.tsx`

**Member table:**
- Columns: Avatar (initials), Name, Email, Role (dropdown), Actions
- Role dropdown: Owner, Admin, Member (KDS `InputField` variant dropdown)
- Owner row: role not changeable (read-only badge)

**"Invite Member" button** - KDS `Button`. On click: opens modal with email `InputField` + role selector. In v1: shows "Invitations coming soon" toast.

**In v1:** 4 placeholder members. Table structure is API-ready (`GET /teams/members` → normalized to member array).

**Edge Cases:**
| Case | Handling |
|---|---|
| Change own role | Disabled - cannot downgrade self |
| Only one Owner | Owner role change disabled |

**Day 12 Deliverable:** ⬜ Account (fully functional), AI & Models (live toggle), Routing (model pickers populated), Security, Teams - all pages complete.

---

### Day 13 - Settings: Usage & Billing + Security Review ⬜ PENDING

> **Checkpoints:**
> - ⬜ 2.13.1 Usage & Billing Page - `PlanCard.tsx`, `StatusBanner.tsx`, `CreditsDisplay.tsx`, `InvoiceTable.tsx`, cancel + change-plan flows
> - ⬜ 2.13.2 Change Plan Page - `PricingCardsGrid.tsx`, `getPlanChangeButtonState()`, downgrade protection flow, `DowngradeBlockedDialog.tsx`
> - ⬜ 2.13.3 Change Plan Confirmation Page - Stripe redirect handler, poll `GET /users/me` up to 30s
> - ⬜ 2.13.4 Billing lib files - `pricing-cards-config.ts`, `plan-config.ts`, `workspace-usage-counts.ts`, `billing.ts` types
> - ⬜ 2.13.5 Settings-Specific Security Pass - Stripe key server isolation, webhook signature, CSRF on mutations, no sensitive data in Formspree payloads

**Goal:** Full billing flow with Stripe, downgrade protection, and invoice history. Then final security hardening across the entire codebase.

#### 2.13.1 Usage & Billing Page - `src/app/(app)/settings/usage-and-billing/page.tsx`

**Data sources:**
- `GET /users/me` - `plan_type`, `subscription_status`, `next_billing_date`, `credits`, `total_credits`, `invoices[]`, `cancel_at_period_end`
- `GET /workspace/usage` - `totalPersonaCount`, `totalPinCount`, `totalWorkflowsCount`

**`PlanCard.tsx`** - dark-background card (uses `--neutral-900` surface token):
- Current plan label (e.g. "Pro Plan")
- Subscription status chip: Active / Past Due / Canceled / Incomplete (color-coded KDS `Badge`)
- Next billing date (formatted)
- Two actions: "Cancel plan" + "Change plan" / "Get a plan" (if no plan)

**`StatusBanner.tsx`** - contextual banners rendered above the plan card:

| Status | Banner |
|---|---|
| `past_due` | Amber warning - "Your payment failed. Update your payment method." |
| `unpaid` | Amber warning - "You have an unpaid invoice." |
| `canceled` | Red - "Your plan has been canceled. Resubscribe to restore access." |
| `cancel_at_period_end: true` | Yellow - "Your plan will end on {date}. Resubscribe to keep access." |
| `incomplete` | Blue info - "Payment pending - completing your setup." |

**`CreditsDisplay.tsx`:**
- "Your credits" heading
- KDS progress bar (blue fill) - `(credits / total_credits) * 100`%
- Label: "{credits} / {total_credits} credits remaining"
- "Resets on {date}" muted text

**`InvoiceTable.tsx`:**
- Columns: Date, Amount, Status, Invoice PDF
- Status: "Paid" (green `Badge`) / "Open" (amber `Badge`) / "Uncollectible" (red `Badge`)
- PDF: external link icon → opens Stripe-hosted PDF
- Sort: newest first (fixed)
- Empty state: "No invoices yet"

**Upcoming invoice row:** if `upcoming_invoice` in response → "Next payment: {date} · ${amount}" above the table.

**Cancel subscription flow:**
1. Click "Cancel plan" → confirmation dialog: "Are you sure? You'll lose access on {period_end}."
2. Confirm → `POST /subscriptions/cancel` → `refreshUser()` → success toast
3. `cancel_at_period_end` banner appears

**Change plan trigger:**
- "Change plan" → `/settings/usage-and-billing/change-plan`

**URL param handling:** `?from_checkout=1` → call `refreshUser()` on mount (Stripe redirects back with this param after checkout).

**Edge Cases:**
| Case | Handling |
|---|---|
| Cancel fails (API error) | Close dialog, show error toast |
| `invoices` array empty | Show "No invoices yet" empty state |
| `credits` field missing | Show "- credits" gracefully |
| `past_due` + no payment method | Show "Update payment method" button linking to Stripe Customer Portal |
| User on free plan | Hide credits section; show "Get a plan" CTA only |
| Cancel during `incomplete` status | Block - show "Complete your payment first" |

#### 2.13.2 Change Plan Page - `src/app/(app)/settings/usage-and-billing/change-plan/page.tsx`

**Background:** `--neutral-50` surface (beige).

**Payment error banner** - shown when URL has `?checkout=failed` or `?checkout=cancelled`:
- Amber alert with amber left border
- Message: "Your payment was not completed. Please try again or contact support."

**`PricingCardsGrid.tsx`** - 3 cards (Starter · Pro · Power):

Per card (from `CARD_CONFIG`):
- Plan name + subtitle
- Monthly price + "per month" label
- Feature list with check icons
- Action button via `getPlanChangeButtonState(currentPlan, targetPlan, { cancelAtPeriodEnd })`:

| Current → Target | Button State |
|---|---|
| No plan → any | "Get started" (purchase) |
| Same plan | "Current plan" (disabled) |
| Upgrade | "Upgrade to {plan}" |
| Downgrade | "Downgrade to {plan}" |
| `cancel_at_period_end: true` + same | "Resubscribe" |

**Downgrade protection flow:**
1. User clicks downgrade button
2. `fetchWorkspaceUsageCounts()` → compare against `PLAN_LIMITS[targetPlan]`
3. `isDowngradeBlockedByUsage(targetPlan, counts)` returns true → show `DowngradeBlockedDialog`
4. Dialog lists which resources exceed the target plan limit (e.g. "You have 7 personas - Starter allows 3")
5. User must delete excess resources before downgrade is allowed

**`DowngradeBlockedDialog.tsx`:**
- Title: "You're over the limit for {plan}"
- Body: bulleted list of exceeded resources with current count vs plan limit
- CTA buttons: "Manage personas" / "Manage pins" (navigate to relevant pages)
- No "Proceed anyway" option - hard block

**Purchase / upgrade flow:**
1. `createCheckoutSession(planId, "monthly", { checkoutFlow: "settings_change_plan" })`
2. Redirect to Stripe Checkout
3. Stripe redirects back to `/settings/usage-and-billing/change-plan/confirmation`

**Edge Cases:**
| Case | Handling |
|---|---|
| Workspace usage fetch fails | Allow purchase to proceed, skip downgrade check, log warning |
| Checkout session creation fails | Show "Payment unavailable" toast, stay on page |
| User already has target plan | Button disabled (handled by `getPlanChangeButtonState`) |
| Power → Starter downgrade | Both persona limit AND pin limit may block - show all blockers |

#### 2.13.3 Change Plan Confirmation Page - `src/app/(app)/settings/usage-and-billing/change-plan/confirmation/page.tsx`

Shown after Stripe redirects back on success. Wraps `CheckoutConfirmationContent` with:
```ts
{
  flow: "settings",
  redirectPath: "/settings/usage-and-billing?from_checkout=1",
  continueLabelReady: "Return to billing",
  deferredSyncHint: "Your new plan may take a moment to activate.",
}
```

Loading state (plan not yet synced from Stripe webhook): spinner + "Activating your plan…"

On `refreshUser()` returning updated plan: show "You're on {plan}!" confirmation card.

**Edge Cases:**
| Case | Handling |
|---|---|
| Webhook hasn't fired yet | Poll `GET /users/me` every 3s up to 30s; show spinner |
| User navigates back to confirmation | Redirect to `/settings/usage-and-billing` immediately (idempotent) |

#### 2.13.4 New lib files for Billing

**`src/lib/pricing-cards-config.ts`** - port verbatim:
```ts
export const CARD_CONFIG: PricingCard[] = [
  { id: "starter", title: "Starter", subtitle: "For daily AI power users",
    monthlyPrice: 12, annualPrice: 10, features: [...] },
  { id: "pro",     title: "Pro",     subtitle: "For serious builders",
    monthlyPrice: 29, annualPrice: 24, features: [...] },
  { id: "power",   title: "Power",   subtitle: "For teams and power users",
    monthlyPrice: 79, annualPrice: 65, features: [...] },
]
export function getPlanChangeButtonState(...)
export function planDisplayTitle(plan: string): string
```

**`src/lib/plan-config.ts`** - port verbatim. All helpers:
- `planRank()`, `isPlanUpgrade()`, `isPlanDowngrade()`
- `hasReachedLimit()`, `getLimit()`, `getPlanCredits()`
- `canAccessFeature()`, `requiresModelUpgrade()`
- `isDowngradeBlockedByUsage(targetPlan, counts)`

**`src/lib/workspace-usage-counts.ts`** - `fetchWorkspaceUsageCounts()` → `GET /workspace/usage`.

**`src/types/billing.ts`:**
```ts
export interface Invoice {
  id: string; date: string; amount: number;
  status: "paid" | "open" | "uncollectible";
  pdfUrl: string | null;
}
export interface SubscriptionStatus {
  status: "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  upcomingInvoice: { date: string; amount: number } | null;
}
export interface WorkspaceUsageCounts {
  totalPersonaCount: number;
  totalPinCount: number;
  totalWorkflowsCount: number;
}
```

#### 2.13.5 Settings-Specific Security Pass

Run these checks after the billing pages are complete, in addition to the global audit done on Day 10:

**Billing surface:**
- [ ] Stripe secret key is only read in `src/app/api/stripe/` route handlers - never in client components
- [ ] Stripe webhook validates `stripe-signature` header before processing any event
- [ ] `createCheckoutSession` is a server-side API route - the session URL is returned to the browser, never the secret key
- [ ] Invoice PDF links are Stripe-hosted (`https://invoice.stripe.com/…`) - validated before rendering as `<a href>`
- [ ] `plan_type` from `GET /users/me` is parsed through `parsePlanTierFromApi()` before any plan-gating decision - never trusted raw from URL params

**Settings mutation surface:**
- [ ] All `PATCH /users/me` calls include `X-CSRF-Token` header
- [ ] `DELETE /users/me` (account deactivation) requires active session - server validates before executing
- [ ] Formspree endpoints are public-facing and rate-limited at the Formspree level; no sensitive data (JWT, user ID) is included in the submission payload
- [ ] Integrations "Connect" buttons in v1 do not initiate OAuth - they show a toast. No redirect to any third-party auth URI is implemented yet.

**Day 13 Deliverable:** ⬜ Full billing flow works end-to-end (purchase, cancel, downgrade gate, Stripe redirect, confirmation). Settings-specific security pass complete.

---

## 3. Feature Deep-Dive: Chat

### 3.1 State Model

```
ChatPageState
├── chatId: string | null             # null = new unsaved chat
├── messages: Message[]               # full history
├── streamingContent: string          # current token buffer (ref, not state)
├── streamingState: StreamingState    # IDLE | WAITING | STREAMING | DONE | ABORTED | ERROR
├── activeModel: AIModel
├── attachments: Attachment[]
├── citationSources: Source[]
├── isCitationsPanelOpen: boolean
└── activePinMention: PinItem | null
```

### 3.2 Message Shape

```ts
interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;                       // raw text or markdown
  reasoning?: string;                    // thinking block content
  citations?: Citation[];
  attachments?: Attachment[];
  model?: string;                        // which model generated this
  createdAt: string;                     // ISO timestamp
  isStreaming?: boolean;                 // ephemeral - only during stream
  error?: string;                        // error message if failed
}
```

### 3.3 Complete Edge Case Register - Chat

| ID | Category | Scenario | Expected Behavior |
|---|---|---|---|
| C-01 | Streaming | Network drops mid-stream | Show "Connection lost" inline; offer Retry button |
| C-02 | Streaming | Backend sends malformed SSE event | Skip delta, continue stream |
| C-03 | Streaming | Stream stalls 30s with no delta | Show "Still thinking…"; after 60s timeout with error |
| C-04 | Streaming | User navigates away during stream | Cleanup: abort + stop API call |
| C-05 | Streaming | Token limit reached | Show "Response cut off" notice; message is partial |
| C-06 | Streaming | User sends second message before first completes | Abort first, start second |
| C-07 | Auth | Token expires during stream | Stop stream, refresh token, show "Session refreshed" toast, re-enable send |
| C-08 | Auth | 401 on stream start | Redirect to login |
| C-09 | Rate Limit | chatRateLimiter triggers | Inline message "Too many requests - try again in Xs" |
| C-10 | Rate Limit | Circuit breaker OPEN | Banner "API temporarily unavailable" with countdown |
| C-11 | Model | Active model unavailable | Warning badge, block send |
| C-12 | Model | Switch model mid-chat | Confirmation dialog; history preserved |
| C-13 | Attachment | File > 25MB | Client reject + toast |
| C-14 | Attachment | Upload fails | Remove chip, inline retry |
| C-15 | Attachment | 10+ files | Cap at 10, toast |
| C-16 | Input | Paste >100KB | Warn + truncate |
| C-17 | Input | Empty submit | No-op (button disabled) |
| C-18 | Input | IME composition active | Do not submit on Enter |
| C-19 | LaTeX | Invalid expression | Render raw in `<code>` with "Invalid LaTeX" badge |
| C-20 | Markdown | Script tag in API response | DOMPurify strips it; render continues |
| C-21 | Citations | Source URL fetch fails | Show domain only, no favicon |
| C-22 | Citations | No citations | Hide citations panel button |
| C-23 | History | Load-more scroll-to-top | Preserve scroll position after prepend |
| C-24 | History | Chat renamed concurrently | Optimistic rename reverts on conflict |
| C-25 | History | Delete chat with in-progress stream | Abort stream, then delete |
| C-26 | Mentions | Pin deleted after mention | Show broken chip (read-only, no link) |
| C-27 | Mentions | Pins endpoint fails | Hide dropdown silently |
| C-28 | Code | Unknown language | Plain text fallback, no highlight |
| C-29 | Code | Very long line | Horizontal scroll, no word-wrap by default |
| C-30 | Session | Same account, multiple tabs | Each tab streams independently |

---

## 4. Feature Deep-Dive: Personas

### 4.1 Persona State Model

```
PersonaPageState
├── personas: Persona[]
├── isLoading: boolean
├── selected: string[]              # for bulk actions
└── searchQuery: string

PersonaConfigState
├── persona: Persona
├── isSaving: boolean
├── isEnhancing: boolean
├── testChat: Message[]
├── isTestOpen: boolean
└── unsavedChanges: boolean
```

### 4.2 Persona Shape

```ts
interface Persona {
  id: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  tone: string;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
  chatCount: number;
  isOwner: boolean;
}
```

### 4.3 Complete Edge Case Register - Personas

| ID | Category | Scenario | Expected Behavior |
|---|---|---|---|
| P-01 | Create | Name already taken | API 409 → inline "Name in use" error |
| P-02 | Create | Avatar upload fails | Clear + toast + allow retry |
| P-03 | Create | Navigate away unsaved | "Discard changes?" dialog |
| P-04 | Create | Avatar > 2MB | Client reject + toast |
| P-05 | Configure | Enhance fails | Toast "Enhancement unavailable"; keep original |
| P-06 | Configure | Enhance streams then errors | Show partial; user keeps or discards |
| P-07 | Configure | Test chat errors | Show error in test panel; keep form state |
| P-08 | Configure | Unsaved changes navigate | "Unsaved changes?" dialog |
| P-09 | Configure | Save fails | Keep form, retry toast |
| P-10 | Chat | Persona paused | "Paused" banner, input disabled |
| P-11 | Chat | Persona deleted during chat | Redirect to gallery with toast |
| P-12 | Chat | Persona chat history empty | Persona-flavored InitialPrompts |
| P-13 | Gallery | 0 personas | Empty state + "Create" CTA |
| P-14 | Gallery | Fetch fails | Error state + retry |
| P-15 | Gallery | 50+ personas | Virtual scroll grid |
| P-16 | Bulk | Delete with active chat | Abort persona chat first, then delete |
| P-17 | Bulk | Activate/pause confirmation | Toast for each operation result |

---

## 5. Feature Deep-Dive: Settings

### 5.1 Settings State Model

Each settings page owns its own local state - there is no global settings store. Pages share one pattern:

```ts
// Per-page state shape
{
  // Fetched data (initial load)
  data: T | null;
  isLoading: boolean;
  fetchError: string | null;

  // Edit state
  draft: T;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
}
```

The auth context (`useAuth()`) is the source of truth for `user.plan_type`, `user.usage`, and `user.email`. Pages call `refreshUser()` after any mutation that affects billing or profile data.

### 5.2 Settings Navigation Model

```
/settings                       → 301 → /settings/account
/settings/account               → Day 12
/settings/ai-and-models         → Day 12
/settings/appearance            → Day 11 (stub)
/settings/automations           → Day 11 (stub)
/settings/files-and-data        → Day 11
/settings/help-and-legal        → Day 11
/settings/integrations          → Day 11
/settings/memory-and-context    → Day 11
/settings/notifications         → Day 11
/settings/routing               → Day 12
/settings/security              → Day 12
/settings/teams-and-roles       → Day 12
/settings/usage-and-billing     → Day 13
/settings/usage-and-billing/change-plan             → Day 13
/settings/usage-and-billing/change-plan/confirmation → Day 13
```

### 5.3 Shared Types

```ts
// src/types/settings.ts

export type NotificationEvent =
  | "automation-complete" | "automation-failed" | "file-processed"
  | "memory-updated"      | "budget-alert"      | "team-invite";

export interface NotificationSettings {
  inApp: Record<NotificationEvent, boolean>;
  email: Record<NotificationEvent, boolean>;
}

export interface RoutingPreferences {
  routingMode: "cost-optimized" | "balanced" | "quality-first";
  algorithm: "standard" | "advanced";
  taskModels: Record<TaskCategory, string | null>;
  budgetAlertsEnabled: boolean;
}

export type TaskCategory =
  | "research-analysis" | "code-generation" | "creative-writing"
  | "quick-qa" | "data-processing";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "owner" | "admin" | "member";
  isCurrentUser: boolean;
}

export interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  logoInitials: string;
  connected: boolean;
}
```

### 5.4 Plan Config Reference

```
Plan ranks: starter=0, pro=1, power=2

Resource limits:
  starter:  personas=3,   pins=100,      workflows=0
  pro:      personas=∞,   pins=2000,     workflows=2
  power:    personas=∞,   pins=∞,        workflows=∞

Monthly credits:
  starter=5,000    pro=12,000    power=60,000

Feature gates (pro+):
  modelCompare · advancedModels · advancedRouting
  sharedPersonas · unlimitedWebSearch

Feature gates (power only):
  mistralOcr · workflowSharing · advancedAnalytics · priorityCompute

Model plan ranks:
  standard=0    pro=1    power=2
```

### 5.5 Complete Edge Case Register - Settings

#### Account

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-ACC-01 | Save with no changes | Save button disabled |
| S-ACC-02 | Save with whitespace-only name | Trim → treat as empty, revert to original |
| S-ACC-03 | Save fails (network) | Keep form, show retry toast |
| S-ACC-04 | `fetchOnboardingState` fails | Skip role badge silently |
| S-ACC-05 | Account already deactivated on load | Show status banner, hide deactivation trigger |
| S-ACC-06 | Delete fails (API error) | Close dialog, error toast, no logout |
| S-ACC-07 | User has no first/last name set | Empty fields; save enabled on first keystroke |
| S-ACC-08 | Delete while streams active | Abort all in-flight streams first |

#### AI & Models

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-MOD-01 | Models fetch fails | Error state with retry button |
| S-MOD-02 | Toggle fails (network) | Revert switch optimistic state; error toast |
| S-MOD-03 | Plan-gated toggle clicked | Upgrade toast; no API call |
| S-MOD-04 | Search returns no results | "No models match" empty state |
| S-MOD-05 | All models blocked | Warning banner "No active models - at least one required" |
| S-MOD-06 | User plan updates (context refresh) | Re-evaluate all plan-gate badges without page reload |
| S-MOD-07 | Model list very large (50+) | Virtual scroll; search still instant |

#### Routing

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-ROU-01 | Model list fetch fails for pickers | "Could not load models" in each picker; retry on focus |
| S-ROU-02 | Algorithm section clicked by non-Pro | Greyed; tooltip "Upgrade to Pro"; no interaction |
| S-ROU-03 | Task picker model later blocked | Show stale selection with warning chip |

#### Security

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-SEC-01 | Revoke current session | Row has no revoke button; cannot self-revoke |
| S-SEC-02 | "Log out all" with only current session | Button hidden |
| S-SEC-03 | 2FA toggle in v1 | "2FA setup coming soon" toast; toggle stays off |
| S-SEC-04 | "Change password" click | Redirect to Auth0 password change page |

#### Teams & Roles

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-TEA-01 | Change own role | Disabled - cannot downgrade self |
| S-TEA-02 | Only one Owner | Owner role dropdown is read-only |
| S-TEA-03 | Invite member in v1 | "Invitations coming soon" toast |

#### Notifications / Memory / Files & Data

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-NOT-01 | Toggle all email off | Allowed; no minimum required |
| S-MEM-01 | Clear memory in v1 | Toast confirmation (no API call) |
| S-FIL-01 | Export data in v1 | Toast "Export coming soon" |
| S-FIL-02 | Clear files in v1 | Confirmation dialog + toast |

#### Help & Legal

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-HLP-01 | Formspree rate-limited | Toast "Too many submissions" |
| S-HLP-02 | Network error on Formspree submit | Keep modal open; retry toast |
| S-HLP-03 | Email field invalid format | Inline error on blur, block submit |
| S-HLP-04 | Message field empty on submit | Inline "Message is required" |

#### Usage & Billing

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-BIL-01 | Cancel fails (API error) | Close dialog, error toast |
| S-BIL-02 | Invoices array empty | "No invoices yet" empty state |
| S-BIL-03 | `credits` field missing from API | Show "- credits" gracefully |
| S-BIL-04 | `past_due` + no payment method | Show "Update payment method" → Stripe Portal |
| S-BIL-05 | Free plan user | Hide credits section; show "Get a plan" CTA |
| S-BIL-06 | Cancel during `incomplete` status | Block with "Complete your payment first" message |
| S-BIL-07 | `?from_checkout=1` on load | Call `refreshUser()` on mount |

#### Change Plan

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-CP-01 | Workspace usage fetch fails | Allow proceed; skip downgrade check; log warning |
| S-CP-02 | Checkout session creation fails | "Payment unavailable" toast; stay on page |
| S-CP-03 | Downgrade blocked by personas | Show `DowngradeBlockedDialog` with count |
| S-CP-04 | Downgrade blocked by pins AND personas | Show both blockers in same dialog |
| S-CP-05 | `?checkout=failed` URL param | Show amber payment-error banner |
| S-CP-06 | User already on target plan | Button disabled; no action |

#### Confirmation Page

| ID | Scenario | Expected Behavior |
|---|---|---|
| S-CON-01 | Webhook delay (plan not yet updated) | Poll `GET /users/me` every 3s, up to 30s |
| S-CON-02 | User navigates back to confirmation | Redirect to `/settings/usage-and-billing` |
| S-CON-03 | Poll exhausted (30s, no update) | Show "Plan activating - check back shortly" and link to billing |

---

## 6. KDS Component Mapping

| UI Surface | KDS Component(s) |
|---|---|
| Primary action buttons | `Button` (variant="default") |
| Secondary / ghost buttons | `Button` (variant="outline" / "ghost") |
| Icon-only buttons | `IconButton` |
| Sidebar shell | `Sidebar`, `SidebarInset` |
| Nav items | `SidebarMenuItem` |
| Project/history sections | `SidebarProjectsSection` |
| Sidebar loading skeleton | `SidebarMenuSkeleton` |
| Chat text input | `ChatInput` |
| Model selector | `PresetModelSelector` |
| Model list rows | `ModelSelectItem` |
| Model featured cards | `ModelFeaturedCard` |
| Status indicators | `Badge` |
| Keyboard shortcut chips | `Chip` |
| Context/right-click menus | `FloatingMenu`, `FloatingMenuItem` |
| Dropdown menus | `Dropdown`, `DropdownMenuItem`, `DropdownSection` |
| Tooltips | `Tooltip` |
| Tab navigation | `Tabs`, `TabItem` |
| Dividers | `Divider` |
| Text inputs | `InputField` |
| Input groups (icon + field) | `InputGroup` |
| Password fields | `PasswordInputField` |
| Popovers | `Popover` |
| Pinboard header | `PinboardHeader` |
| Pin items | `Pin`, `PinCategory` |
| Pin comment entry | `PinCommentField` |
| Pinboard container | `Pinboard` |
| Settings nav links | `SidebarMenuItem` (reused outside sidebar) |
| Settings section wrapper | Custom `SettingsSection` (KDS typography tokens) |
| Labeled toggle rows | `SettingsToggle` → KDS `Switch` + `Divider` |
| Settings text inputs | `InputField` |
| Settings dropdowns (routing, file type, etc.) | `InputField` with KDS `Dropdown` popover |
| Plan badges, status chips | `Badge` |
| Capability/feature chips | `Chip` |
| Model rows in AI & Models | Custom `ModelRow` → KDS `Switch` + `Badge` + `Chip` |
| Billing plan cards | Custom `PlanCard` (KDS tokens, dark surface) |
| Credits progress bar | HTML `<progress>` styled with KDS `--blue-600` token |
| Invoice table | Native `<table>` with KDS typography + `Badge` for status |
| Feedback form fields | `InputField` + `InputGroup` (textarea variant) |
| Confirmation / warning banners | `Badge` + KDS border tokens for colored left-border |

---

## 7. Environment Variables Reference

| Variable | Source | Used By |
|---|---|---|
| `AUTH0_SECRET` | AWS Secrets | Auth0 SDK (cookie signing) |
| `AUTH0_BASE_URL` | AWS Secrets | Auth0 SDK (callback URL) |
| `AUTH0_ISSUER_BASE_URL` | AWS Secrets | Auth0 SDK |
| `AUTH0_CLIENT_ID` | AWS Secrets | Auth0 SDK |
| `AUTH0_CLIENT_SECRET` | AWS Secrets | Auth0 SDK |
| `AUTH0_AUDIENCE` | AWS Secrets | JWT audience claim |
| `SERVER_URL` | AWS Secrets | `config.ts` API base |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | AWS Secrets | Analytics |
| `NEXT_PUBLIC_GA_ID` | AWS Secrets | Google Analytics |
| `STRIPE_SECRET_KEY` | AWS Secrets | Stripe server routes |
| `STRIPE_WEBHOOK_SECRET` | AWS Secrets | Stripe webhook validation |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | AWS Secrets | Stripe.js client |
| `AWS_ACCESS_KEY_ID` | `.env.local` | load-secrets.mjs only |
| `AWS_SECRET_ACCESS_KEY` | `.env.local` | load-secrets.mjs only |
| `AWS_REGION` | `.env.local` | load-secrets.mjs only |
| `AWS_SECRET_NAME` | `.env.local` | load-secrets.mjs only |

---

## 8. Out of Scope (This Window)

The following features exist in the old codebase but are **not built in this 13-day window**. Scaffold the routes as stubs (empty page with "Coming soon" layout placeholder) so navigation doesn't 404.

- Workflows (ReactFlow canvas + workflow chat)
- Compare Models view
- Onboarding pricing step (scaffold route, skip Stripe wiring)
- Pinboard (sidebar section visible, click goes to stub)
- Settings: Automations and Appearance are scaffolded as stubs - no functional content

**Settings pages that ARE fully built (Days 11–13):** Account · AI & Models · Files & Data · Help & Legal · Integrations · Memory & Context · Notifications · Routing · Security · Teams & Roles · Usage & Billing · Change Plan · Confirmation

---

## 9. Definition of Done per Requirement

| Req | Day(s) | Done When |
|---|---|---|
| 0. Env Setup | 1 | `npm run dev` starts, KDS tokens resolve, secrets load from AWS |
| 1. Auth0 | 2 | Login/logout cycle works; middleware blocks unauthenticated routes; token refresh handles expiry |
| 2. API Client | 3 | `apiFetch` returns typed data; rate limiter and circuit breaker engage correctly; all 110+ endpoints importable |
| 3a. Chat | 4–8 | User can send a message, see it stream, stop it, see code/LaTeX/citations render; chat CRUD works; model switching works |
| 3b. Personas | 8–9 | Create → configure → chat → pause/activate cycle works; bulk actions work |
| 3c. Settings (lightweight) | 11 | Notifications, Memory, Files & Data, Help & Legal, Integrations pages complete; settings nav works |
| 3c. Settings (data-connected) | 12 | Account save/delete works; AI & Models toggles live; Routing pickers populated; Security and Teams scaffolded |
| 3c. Settings (billing) | 13 | Full Stripe checkout + cancel + downgrade protection + confirmation polling works |
| 4. Security | 10 + 13 | All sanitization checklist items green; `npm audit` passes at `moderate`; CSP headers present in production build |

<!-- Create console logs for testing for each and remove before production -->
