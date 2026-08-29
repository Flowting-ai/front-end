# Onboarding v1.5 — New Flow Spec

**Status:** All four cases (A1, A2, B1, B2) are built in code — see the Build log at the bottom for exact files/node IDs and every flagged assumption. What's left is not implementation but **backend/product confirmation**: see "Open items" below and the per-case "PENDING CONFIRMATION" notes in the Build log — none of them block the code from running, but several endpoints/decisions are being stood in for with the closest existing contract rather than a purpose-built one. This still describes the flow that replaces the previous onboarding implementation under `src/app/(onboarding)/onboarding/**` (see [master-api.md](../docs/api/master-api.md) and the Users/Organizations surfaces there for how the previous flow's `updateOnboarding`/`updateOrg`/`createOrganization` calls work — those backend contracts were the starting point for this rebuild, not necessarily its final shape).

**Terminology shift — read this before touching any code, copy, or naming:** the product is dropping "team" as a concept. What used to be a **team** account is now a **workspace** account. There is no more individual-vs-team branch with different plans/vocabulary — every account is a workspace (a solo user is simply a workspace of one). Concretely, this means:
- Do not introduce new code, routes, component names, or copy using "team" for this flow. Prefer "workspace."
- Existing backend fields/enums (`role_fit: small_team | large_team | just_me`, `org_id`, `/organizations/*`, `/team-invite/*`) are legacy names from the team model — confirm with backend whether they're being renamed for v1.5 or whether the frontend just maps "workspace" copy onto the existing enums. **Do not assume — this needs an explicit answer before wiring any page to real endpoints.**
- The existing `/onboarding/team/[inviteId]/*` route tree and `/onboarding/account-type`, `/onboarding/workspace`, `/onboarding/connectors`, `/onboarding/invite`, `/onboarding/tone`, `/onboarding/import` pages are the *previous* flow (documented in the previous turn of this conversation) and are expected to be superseded by what's below, not extended.

Figma source: [Onboarding v1](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1) (node IDs per page below).

---

## Case A1 — Fresh self-serve signup (creating a new workspace)

Entry point: someone signs up with no existing invite and no existing workspace membership. **This is the complete A1 flow — exactly these 7 pages, nothing else.** No account-type fork, no plans/Stripe step, no tone step, no import step, no connectors step — those belong to the *previous* flow (see the terminology-shift note above) and are not part of A1.

**Auth0 pages** (hosted by Auth0, not this app):

1. Auth0 login / signup
2. Auth0 terms and privacy

**Souvenir WebApp pages:**

| # | Page | Purpose | Figma |
|---|---|---|---|
| 3 | Continue onboarding in Slack / within the app | Choice screen — continue onboarding inside the Slack app, or continue in the Souvenir web app | [node 181-7750](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=181-7750&t=OvOwJ1KK3HrJA5rG-4) |
| 4 | Setup your workspace | Collects **workspace name** (required) + **workspace size** (defaults to "Just Me") | [node 27-1196](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=27-1196&t=OvOwJ1KK3HrJA5rG-4) / [error state 55-2726](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=55-2726&t=OvOwJ1KK3HrJA5rG-4) |
| 5 | Create your profile | Collects **first name**, **last name** (both required), **role** (reuses the existing role list — don't invent a new one) | [node 11-459](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=11-459&t=OvOwJ1KK3HrJA5rG-4) / [error state 55-2680](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=55-2680&t=OvOwJ1KK3HrJA5rG-4) |
| 6 | Invite your team | Collects email addresses to send invitations | [node 27-1353](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=27-1353&t=OvOwJ1KK3HrJA5rG-4) |
| 7 | Main app home page + "Add Souvenir to Slack" modal | Lands on the home / new-chat page; a modal (dark overlay behind it) prompts **"Add Souvenir to Slack"** | [node 55-2475](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=55-2475&t=OvOwJ1KK3HrJA5rG-4) |

**Open item:** production-grade URLs for each step in this flow need to be defined (route naming under whatever replaces `/onboarding/*`) — flagged by the requester as a to-do, not yet decided.

---

## Case A2 — Join an existing workspace

Entry point: distinct from A1 — presumably someone who signs up and is offered/finds an existing workspace to join rather than creating a new one (e.g. matching email domain).

| # | Page | Purpose | Figma |
|---|---|---|---|
| 1 | Join a workspace | Collects workspace name and workspace size | [node 66-4387](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=66-4387&t=OvOwJ1KK3HrJA5rG-4) |
| 2 | Create your profile | Collects first name, last name, role | [node 66-4341](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=66-4341&t=OvOwJ1KK3HrJA5rG-4) |
| 3 | Into the app / Slack modal | Home / new-chat page, "Add Souvenir to Slack" modal (dark overlay) | [node 182-10127](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=182-10127&t=OvOwJ1KK3HrJA5rG-4) |

These are distinct Figma frames from A1's steps 2/3/5, not shared node IDs — confirm during build whether the underlying *components* should still be shared (same form, different copy/props) or are genuinely separate designs once the frames are pulled.

---

## Case B1 — Invite flow: user has already signed up, invited to a workspace

Single screen. Figma: [node 55-2884](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=55-2884&t=OvOwJ1KK3HrJA5rG-4)

---

## Case B2 — Invite flow: user has *not* signed up, invited to a workspace

Single screen. Figma: [node 58-4249](https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=58-4249&t=OvOwJ1KK3HrJA5rG-4)

Presumably: Auth0 signup happens first, then this one screen (likely closer to a combined profile/into-the-app step than a fresh workspace-creation step, since the workspace already exists) — confirm once pulled.

---

## Implementation requirements (apply to every page above)

- **Design fidelity:** build 1:1 from the Figma frames above using the Figma MCP connector (personal access token stored as `FIGMA` in `.env.local`) — pull each node's real layout/spacing/copy rather than approximating from this doc's summaries.
- **Back / Continue button audit:** for each page, check the actual Figma frame for whether Back and/or Continue are present, and only wire the ones that exist — don't assume every step has both (e.g. the current flow's first screen has no Back).
- **Progress indicator:** the dot-slider / active-slide carousel element shown across steps needs a correct, reusable implementation — active-dot state should track the current step accurately across whichever step sequence a given case actually has (A1's 5 steps vs. A2's 3, etc. — don't hardcode a single step count).
- **Animations:** production-level transitions between steps (matching existing onboarding polish, not a bare instant swap).
- **Design system reuse:** build from existing components in `front-end/src/components/**` (e.g. `Button` at `src/components/Button/index.tsx`) rather than one-off markup — consistent with how the current onboarding pages are built.

## Open items (build is done; these are confirmation/decision items, not blockers)

1. ~~Per-screen breakdown (with node IDs) for A2's two screens, and both B1/B2 frames~~ — resolved: A2 has all 3 node IDs; B1/B2 confirmed as single screens each and built.
2. Decision on whether backend enums/routes get renamed team→workspace, or only the frontend copy changes.
3. ~~Production route naming for the new flow (A1's open item)~~ — cut over: `src/proxy.ts`'s `determineNextOnboardingPath()` (the server-side gate) and `src/components/shared/OnboardingGuard.tsx` (its client-side mirror) now send un-onboarded users into the v1.5 flow (`/onboarding/setup` → `role_fit` missing; `/onboarding/profile` → `first_name`/`last_name` missing; `/onboarding/invite` → otherwise), not the old `hello`/`account-type`/`plans`/`tone`/`import` chain. `/onboarding` (bare index) also now redirects to `/onboarding/setup`. `/invite/<id>` (B1/B2) is unaffected by this gate — see its own proxy.ts exemption above. **New pending-confirmation risk introduced by this cutover:** the gate now infers "finished the profile step" from `first_name`/`last_name` being non-empty on `/users/me`, since `user_role` is optional in the new profile page and can't be used as that signal any more. Auth0 sometimes auto-populates `first_name` to the account's email on signup (existing, documented behavior in `auth-context.tsx`) — this gate can't distinguish that placeholder from a real name, so such a user could be silently skipped past `/onboarding/profile`. Worth a real fix (e.g. a dedicated `profile_completed` flag) rather than inferring from name fields.
4. ~~Confirmation on whether A2 and A1 share workspace/profile components or are separate implementations.~~ — resolved for screens 2/3: A2's "Create your profile" and "Into the app" screens are the exact same instances as A1's (same components, same routes). A2's "Join a workspace" screen (node 66-4387) is a genuinely different design (blue-highlighted "detected workspace" card with an avatar stack + inline join button, not a plain name/size form) and has its own implementation (see Build log).
5. **No backend signal for "does this invited email already have a Souvenir account"** — needed to pick B1 vs. B2 at invite-link-generation time. See the B1/B2 Build log entry for the interim `?existingAccount=1` query-param approach.
6. **`getTeamInviteOnboarding`/`GET /team-invite/{id}` anonymous-access assumption** — reused as A2 screen 1's "detected workspace" data source (authenticated) and, separately, as B1/B2's pre-login invite-preview data source (unauthenticated). Confirm the backend route actually permits a logged-out request; the frontend client itself doesn't force one.

## Build log

- **Figma access method:** pulled via the Figma REST API directly (`X-Figma-Token` header, PAT stored as `FIGMA` in `.env.local`) — not the claude.ai Figma MCP connector, which is not used for this task. `/v1/files/:key/nodes?ids=...` for exact layout/copy/color, `/v1/images/:key?ids=...&format=png` for rendered screenshots to visually confirm each state (icon visibility, dot-indicator position, error-state copy) before writing code.
- **A1 — done, all 5 screens:**
  - Screen 1 (`src/app/(onboarding)/onboarding/setup/page.tsx`, node 181:7750) — Slack/Souvenir choice. One icon (`GridIcon`) is still a placeholder for "Set up in Souvenir"'s glyph, flagged in-code — not yet re-verified via the PAT/REST approach.
  - Screen 2 (`src/app/(onboarding)/onboarding/workspace/page.tsx`, nodes 27:1196 / 55:2726) — workspace name + size.
  - Screen 3 (`src/app/(onboarding)/onboarding/profile/page.tsx`, nodes 11:459 / 55:2680) — first/last name + role dropdown.
  - Screen 4 (`src/app/(onboarding)/onboarding/invite/page.tsx`, node 27:1353) — invite emails; this is also where `onboarding_completed` is set (mirrors the old flow's invite step) since screen 5 isn't a distinct route.
  - Screen 5 (`src/app/(onboarding)/onboarding/_components/add-to-slack-modal.tsx`, node 55:2475) — "Add Souvenir to Slack" modal, wired into `/welcome` behind `?slack=1` (set by screen 4's completion redirect). The decorative Slack-composer illustration behind the copy is a static PNG export (`public/onboarding/slack-preview.png`), not a rebuilt Slack UI mockup — it's non-interactive in the design.
  - Shared: `_components/step-shell.tsx` (dots, header, field label/error, footer with optional Back/Skip/Next), `context/workspace-onboarding-context.tsx` (client-side form state for the 3 real steps).
  - Confirmed via screenshots, not assumed: Back is `variant="ghost"` (no border); decorative left/right icon slots on text inputs are hidden in the actual render (JSON showed generic icon-instance scaffolding, screenshots showed none); the profile screen's dot indicator shows the *first* dot active in its own static Figma frame (same as the workspace screen) rather than the second — read as a static/default component state left un-updated by the designer, not a deliberate 1-of-3 vs 2-of-3 signal, since the invite screen's frame does correctly show its dot in the third position. Code uses the logical sequence (workspace=0, profile=1, invite=2), which the invite screen's own dot state corroborates.
- **A2 — all 3 screens done:**
  - Screen 2 ("Create your profile", node 66:4341) = the exact same instance as A1 screen 3 (`src/app/(onboarding)/onboarding/profile/page.tsx`) — no new code, confirmed identical by the requester.
  - Screen 3 ("Into the app" / Slack modal, node 182:10127) = the exact same instance as A1 screen 5 (`_components/add-to-slack-modal.tsx`, `/welcome?slack=1`) — no new code, confirmed identical.
  - Screen 1 ("Join a workspace", node 66-4387, `src/app/(onboarding)/onboarding/join/page.tsx`) — built from geometry confirmed via the requester's raw SVG export (3-segment dot indicator with the **middle** segment active, a 402×101 white card with a **blue** `#0D6EB2` border) plus copy given directly by the requester (header "Join a Workspace"; card shows "{Inviter Name}'s Workspace" / "{x} members" + a 3-avatar stack + a "Join" button; a Back button only, no page-level Next). The Figma export's text is outlined to vector paths with no live `<text>` content, so this screen was built from requester-supplied copy rather than pulled from Figma directly.
    - **PENDING CONFIRMATION:** there's no existing backend contract for "the workspace this signup's email domain matches." The page assumes an `inviteId` query param is present on arrival and reuses the team-invite contract (`getTeamInviteOnboarding`/`acceptTeamInvite` from `lib/api/teams.ts`), since that happens to return exactly the fields this card needs (org name, member count, avatars, inviter name). If A2 is meant to work off pure domain-matching with no invite record, this needs a real endpoint.
    - Back calls `logout()` (this is the first screen of the A2 flow, same convention as `onboarding/hello`'s and the old invite page's "first screen" Back buttons).
  - **Fixed:** the profile page's Back button previously hardcoded `push(ONBOARDING_WORKSPACE_ROUTE)` (wrong for A2). `workspace-onboarding-context` now tracks an `entryFlow: "create" | "join"` flag, set by whichever screen-1 the user lands on; the profile page's Back branches on it.
- **B1 (55-2884) / B2 (58-4249) — done.** Figma access unblocked once the file was shared with the MCP account as editor. Both nodes have *live* `<text>` content in `get_metadata` (unlike A2 screen 1's vector-outlined export), so exact copy came straight from Figma, confirmed visually via `get_screenshot`: logo mark, serif "You're on the list!" title, bold "You have been invited to join {inviter}'s workspace." line, a workspace card (name / member count / avatar stack — no Join button, unlike A2's card), a body paragraph that differs by variant, a full-width dark button, and a small footer logo + "By continuing you agree to our Terms and Privacy Policy." No dot indicator and no Back/Next footer on either screen — this isn't a numbered onboarding step, it's a standalone pre-login landing page. One shared component covers both variants: `src/app/invite/[inviteId]/page.tsx`.
  - **Real blocker found and fixed:** B1/B2 are pre-*login* screens (the whole point is deciding Sign in vs. Sign up), but `src/proxy.ts` unconditionally redirected every logged-out request on every route to `/auth/login` with no public-route exemption — so this page would have been unreachable dead code. Added an explicit exemption for `INVITE_LANDING_BASE_ROUTE` (`/invite`, `lib/routes.ts`) in `proxy.ts`, ahead of the session check, mirroring the existing `/auth/*` and `/api/*` bypasses. Confirmed via a local dev-server request that `/invite/<id>` now returns 200 instead of a redirect while logged out.
  - **PENDING CONFIRMATION:** there is no existing signal anywhere (frontend or in `getTeamInviteOnboarding`'s response shape) for "does this invited email already have a Souvenir account" — that's what actually decides B1 vs. B2. The page reads it from an `?existingAccount=1` query param, which the backend would need to set when generating the invite email's link (it already knows the recipient's email at send time). Missing/invalid values default to B2 (Sign up), since that fails softer (Auth0's own duplicate-email check on signup just bounces to sign-in) than defaulting an unregistered visitor to Sign in (dead end). Separately, `getTeamInviteOnboarding` is reused here as the public invite-preview call — it's *structurally* safe to call while logged out (the auth header is just omitted, not force-attached), but whether the backend route itself permits an anonymous request is unverified from the frontend alone.
  - Sign up wires to `/auth/login?screen_hint=signup&returnTo=...`, relying on the `@auth0/nextjs-auth0` v4 SDK's default `/auth/login` handler forwarding query params to Auth0's `/authorize` call — standard v4 behavior, not custom code added here, but worth a smoke test against the real Auth0 tenant. Both variants' `returnTo` point at the existing authenticated accept-invite screen (`ONBOARDING_TEAM_WELCOME_ROUTE(inviteId)`, i.e. `/onboarding/team/<id>`), reusing that flow rather than building a new post-login step.
