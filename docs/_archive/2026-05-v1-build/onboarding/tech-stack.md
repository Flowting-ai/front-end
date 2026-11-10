# Tech Stack — Plain-English Guide for a New Environment

You're setting up a new project that's a sibling/fork of this one. This doc tells
you (or the coding agent you hand this to) exactly which tools and libraries to
use, so the new project stays compatible with this one instead of drifting off in
its own direction.

You don't need to understand *how* any of this works under the hood. Just make
sure whoever (or whatever) is building this new project uses the same pieces
listed below, at the same versions. If you're briefing a coding agent, you can
paste this whole document to it as-is.

---

## 1. The basics

This is a **Next.js** app — Next.js is the framework that runs a React website,
handles the pages/routing, and talks to the server. Written in **TypeScript**
(basically JavaScript with extra safety checks).

| What | Version to use |
|---|---|
| Node.js (the engine everything runs on) | 20 or 22 (the "LTS" releases — LTS means long-term-supported, i.e. the stable choice) |
| Next.js | 16 |
| React | 19 |
| TypeScript | 5 |

Don't let an agent casually "upgrade to the latest version" of any of these —
each of these had big changes recently, and mixing versions is the #1 way a new
project breaks in ways that are hard to debug.

## 2. Styling — Tailwind CSS

Styling (colors, spacing, layout) is done with **Tailwind CSS**, version 4. Tailwind
is a way of styling things using short utility classes directly in the code
(`text-lg`, `bg-blue-500`, etc.) instead of separate CSS files.

The colors/fonts/spacing are defined once, in a small set of shared files (called
"design tokens"), and everything else in the app pulls from those instead of
having colors typed in by hand all over the place. That's what makes dark mode
and re-theming possible without redoing every screen. **Rule for whoever builds
this: never hardcode a color value directly in a component — always use the
shared tokens.**

## 3. Components — use shadcn/ui, not a packaged UI kit

This is the one decision worth understanding, because it affects how every button,
dropdown, and dialog in the new app gets built.

**Use shadcn/ui.** In practice this means: instead of installing a UI component
library as a black-box dependency, you run a command that generates the actual
component code and drops it straight into your project's files. You end up
owning plain, editable source files for every component — not a locked package
you have to work around.

### Why not Hero UI (or similar all-in-one UI kits)?

Hero UI (and kits like it — Material UI, Chakra, etc.) work the opposite way:
you `npm install` the whole library, and your buttons/dialogs/menus come from
inside that package. That sounds convenient, but it causes real problems:

- **You can't fully customize it.** Want a button that looks slightly different
  from what the library gives you? You're fighting the library's built-in styling
  system instead of just editing a file.
- **Upgrades can break your app.** When the library ships a new version, it can
  change how things look or behave everywhere at once, with no warning specific
  to your project.
- **It's heavier.** You ship all of the library's internal styling machinery,
  even the parts you don't use.
- **It fights our styling system.** Hero UI comes with its own separate theming
  setup, which doesn't play nicely with the Tailwind-based token system described
  above — you'd end up maintaining two competing "sources of truth" for colors
  and spacing.

**shadcn/ui avoids all of that** because the components are just plain code
living in your own project — there's nothing to "upgrade," nothing hidden, and
no separate theming system to fight. It uses the same Tailwind styling as
everything else. If you want to change how a button looks, you open the button's
file and change it — same as editing any other page.

Icon set to pair with it: **lucide-react** (this is also shadcn's default icon
set, so it's a natural fit — no need to add a second icon library).

## 4. Handling data (talking to the server, forms, etc.)

| Tool | What it's for, in plain terms |
|---|---|
| TanStack Query | Fetching data from the backend and keeping it in sync/cached, so pages don't refetch everything constantly |
| Zod | Checking that data (from a form, or from the server) actually looks the way it's supposed to, before the app trusts it |

## 5. Login, payments, and other services

| Tool | What it's for |
|---|---|
| Auth0 | Handles user login/sign-up |
| Stripe | Handles payments/subscriptions |
| Framer Motion | Animations (things sliding in, fading, etc.) |
| Sonner | Small pop-up notifications ("toasts") |

Only add these if the new project actually needs them — don't install
everything from this list just because the original project has it.

## 6. Keeping secrets out of the code

Real credentials (API keys, passwords) are never typed directly into the code or
committed to git. Instead:

1. A small local file holds just enough info to *fetch* the real secrets (which
   cloud secret-storage account to talk to).
2. When the app starts up locally, a script automatically pulls the real secrets
   from that cloud storage and writes them to a second local file that also never
   gets committed.
3. On the actual hosting platform (Vercel), the real secrets are provided
   directly by the platform, so this fetching step is skipped there.

If you're setting up a new project, keep this same two-step pattern rather than
pasting real API keys straight into a config file.

## 7. Testing and code quality

| Tool | What it's for |
|---|---|
| Vitest | Runs automated tests to check the app still works as expected |
| ESLint | Automatically flags sloppy or risky code patterns |

## 8. Things NOT to copy from this project

- This project also has an internal design-system pipeline (referred to
  elsewhere as "Kaya DS") that's specific to this team's own private design
  system and Figma setup. A new/forked project won't have access to that — use
  shadcn/ui (section 3) as the equivalent instead.
- This project also has a couple of older icon libraries left over from before —
  that's leftover baggage, not something to copy into a new project. Just use
  lucide-react.

---

**Summary for a coding agent:** Next.js 16 + React 19 + TypeScript 5, styled with
Tailwind CSS 4 and a shared design-token system (no hardcoded colors), components
built with shadcn/ui (not Hero UI or any other packaged UI kit) using lucide-react
icons, TanStack Query + Zod for data, Auth0/Stripe only if needed, secrets pulled
from cloud storage at startup rather than hardcoded, Vitest + ESLint for quality.
