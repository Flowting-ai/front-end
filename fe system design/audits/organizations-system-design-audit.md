# Organizations: System Design Audit

Scope: `context/org-context.tsx` (303), `lib/api/organization.ts` (460), `lib/api/teams.ts`, `lib/roles.ts` (139), admin pages under `settings/(shell)/(org)` (`members` 1,280, `general` 1,419, `activity` 322; `analytics` and `plans` belong to the Analytics and Credits/billing audits), legacy `/org/*` stubs and `org/layout.tsx`, `org-invite/[inviteId]`, `team-invite/[inviteId]`, `InviteModal` (574), `LeaveWorkspaceModal` (159), `OrgBadge`. About 5,000 lines in scope (the whole `settings` plus `org` tree is 11,700).
Method: `org-context`, `roles`, the layout guards, the invite landing and the API function list read; pages checked by grep metrics. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~42% (14.7 / 35 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.3 | 43% |
| 2. Architecture | 8 | 3.6 | 45% |
| 3. Component Patterns | 3 | 1.3 | 43% |
| 4. Data Model | 9 | 4.3 | 48% |
| 5. Interfaces and APIs | 6 | 3.5 | 58% |
| 6. Optimizations | 6 | 0.7 | 12% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, cursor pagination (members list is bounded by plan), virtualisation.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Permission model mirrored from backend (#42) | `lib/roles.ts` is a class ladder (`Member` to `Admin`) documented as a mirror of the backend `roles.py`, with capability methods (`canPublishToTeam`, `canEditProject`) instead of string comparisons; `roles.test.ts` covers it |
| Capability object in context | `caps` resolved once via `useMemo` from `orgRole`; consumers call `caps.can...()` |
| Explicit uncertainty flags | `orgReady`, `roleError`, `orgRoleResolved`, `orgPlanSettled` let consumers distinguish "not loaded", "failed", and "role unknown"; billing resolution has a separate `resolveOrgBillingRole` that prefers the billing snapshot when it matches the active org |
| Resilience | Role fetch retries once after 1 s, then records `roleError` rather than silently claiming admin; members fall back to the plan payload if `listMembers` fails |
| Instant org id | Org id comes from the profile, else a per-user localStorage cache, then `listOrganizations()` refreshes it (try/catch around storage) |
| Validation (#35) | Plan and members parsed with Zod (`planResponseSchema`, `memberResponseSchema`) and normalised |
| Optimistic updates (#33) | Members page has optimistic changes (5 references) |
| Accessibility (#20) | Members page has 15 `aria-*`, invite modal 9 |
| Static invite landing | `/org-invite/<id>` intentionally makes no API call (the preview endpoint needs auth), only routes into Auth0 with `returnTo`; documented with the reason |
| Tests | `organization.test.ts`, `roles.test.ts` |
| Redirects kept for old links | `/org/*` stubs redirect to `/settings/*` so bookmarks survive |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Provider design (#24) | `OrgProvider` holds 12+ `useState` and 4 effects (org id, role, plan, members, active project) and exposes 15+ fields; the context value and the `org` object are rebuilt every render (verify whether React Compiler memoises them), so all consumers re-render on any change; `activeProjectId` is unrelated to org and lives here | Split: `OrgIdentity` (id, role, caps), `OrgPlan`, `OrgMembers`; move `activeProjectId` to the project context; memoise values |
| Server state (#30, #38) | Org, plan and members fetched in effects with manual retry, flags and a `planRefreshToken` counter to refetch; `getOrgPlan` is called twice in the failure path | React Query: `["org", id]`, `["org", id, "plan"]`, `["org", id, "members"]`; `refreshMembers` becomes invalidation |
| Component architecture (#12) | `general/page.tsx` 1,419 lines (26 `useState`, 9 `useEffect`), `members/page.tsx` 1,280 (16 `useState`), `InviteModal` 574 | Sections (profile, logo, danger zone, credit cap, approval threshold) as components with form hooks |
| Form state (#35) | General settings, invite emails, role changes hand-managed with no Zod/RHF | RHF + Zod per section; shared schemas with `updateOrg` payloads |
| Error boundaries (#19) | Layout-level only | Per-section boundary on admin pages |
| Accessibility (#20) | `general/page.tsx` has 1 `aria-*` across 1,419 lines; `LeaveWorkspaceModal` 0; destructive confirmations need focus management and labelled dialogs (verify) | Dialog roles, labelled destructive flows, announcements |
| Observability (#55) | One tracking call in the whole area; no events for invite sent/revoked, role changed, member removed, org deleted | Typed events with ids/enums |
| Storage (#32) | `souvenir:org-id:<userId>` localStorage cache is never cleared on logout or org switch | Add to `storage-keys.ts`; clear in `clearAuth` |
| Pagination (#39) | Members, audit log (`listAudit`) and invites loaded wholesale or with page-like params (13 page/cursor references on members); verify limits at large orgs | Cursor paging, search on the server |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Role guard duplicated and effect-based | Three layouts (`org/layout`, `settings/(org)/layout`, `souvenir-slack/layout`) copy the same code: `useEffect` redirect plus `return null` until ready, which blanks the screen and flashes before redirect; client-only | One `<RequireAdmin>` component or a server layout check; render a "no access" state; backend stays authoritative |
| Role guessed from plan | With no org, `isTeamPlan` (`roleFit` is a team value) makes the user `admin`; with a missing role it falls back to `admin` for team plans | Never infer admin client-side for gating; use `orgRoleResolved === false` to show neutral UI and let the backend decide |
| Fail-open comment | Billing gates "fall back to optimistic access" when the role is unknown (documented) | Acceptable only if every action is backend-enforced (stated); add a test and show a soft warning |
| First org only | `listOrganizations()` then `orgs[0]`: a user in several orgs always gets the first, with no switcher or stored active org (verify whether multi-org is supported) | Explicit `activeOrgId` selection persisted and sent with requests, or document single-org rule |
| Identity key mismatch | `resolveRole(orgRole, { userId: user?.email })` identifies the user by email while analytics and sessions use the Auth0 `sub` and backend grants use user ids | Pass the backend user id |
| Legacy redirect stubs as client pages | Six `/org/*` pages are client components that `replace()` in an effect and render `null` | Use `redirects()` in `next.config.ts` (the file already has a `redirects` block) |
| Org object assembled in the provider | `DEFAULT_ORG` mixes hard-coded defaults (`plan: 'teams'`, `creditPool` zeros, `hitlThreshold`) with fetched data, so unloaded state looks like a real org with zero credits | `org: WorkspaceOrg \| null` until loaded; consumers show skeletons |
| Comments carry history | Several files include long narrative comments about past bugs (invite landing 2026-09-06, org layouts "moved from") | Move rationale to `docs/` or commit messages, keep the "why" in two lines |
| Retry by `setTimeout` | Manual single retry for `getOrg` | Query retry policy |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | Org provider (role resolution matrix: org id missing, role null, fetch error, team plan), guard behaviour, members page optimistic rollback, invite modal validation, leave workspace flows |
| Code splitting (#46, #48) | `InviteModal`, `LeaveWorkspaceModal`, delete-org dialog, and the heavy sections of `general`/`members` are lazy-loadable |
| `loading.tsx` / `error.tsx` | Route states for admin pages (skeleton file exists: `SettingsSkeleton`) |
| `useTransition` / debounce (#53, #54) | Member search and filters |
| Invite flows | Bulk invite validation (duplicates, existing members, domain rules), resend, expiry display (verify) |
| Audit log UX | Filters, export, cursor paging |
| Cross-tab sync | Role or org change in another tab (storage event) |
| Web Vitals / budget (#8, #56) | Budget for the admin pages |
| Destructive-action safeguards | Type-to-confirm on org delete (`deleteOrg(orgId, confirmName)` suggests it exists; verify UI), undo for member removal where possible |
| Permissions UI | Show read-only state to non-admins instead of redirecting them away |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 42% → ~55%)
1. One `<RequireAdmin>` replacing the three layout copies; no blank flash; "no access" state. (+0.8)
2. Move the six legacy `/org/*` stubs into `next.config.ts` redirects. (+0.4)
3. Stop inferring `admin` from plan; use unresolved-role UI. (+0.4)
4. Clear the org-id cache on logout; register key in `storage-keys.ts`. (+0.3)
5. Tests for the role resolution matrix and guards. (+1.0)
6. Typed analytics for invite, role change, remove, delete, leave. (+0.5)
7. Labelled dialogs and focus management on destructive flows. (+0.5)

### Phase 2: Data layer (M, → ~72%)
1. React Query for org, plan, members, audit; `refreshMembers` becomes invalidation; remove the counter and manual retry. (+2.0)
2. Split `OrgProvider` into identity/plan/members with memoised values; move `activeProjectId` out. (+1.0)
3. `org` is nullable until loaded; no fake defaults. (+0.5)
4. Use backend user id for capabilities; explicit active-org selection if multi-org is supported. (+0.5)
5. Cursor paging and server search for members and audit. (+0.7)

### Phase 3: Components and forms (L, → ~90%)
1. Split `general`, `members`, `InviteModal` into section components with hooks, none above ~350 lines. (+1.5)
2. RHF + Zod forms with schemas shared with API payloads. (+1.0)
3. Lazy-load dialogs and heavy sections; skeletons via `loading.tsx`. (+0.8)
4. Debounced/deferred member search. (+0.4)
5. Read-only views for non-admins where useful. (+0.3)

### Phase 4: Governance (S, → 100%)
1. Performance budget and Web Vitals for admin routes. (+0.5)
2. Accessibility audit (axe plus screen reader), especially destructive flows. (+0.4)
3. Cross-tab org/role sync; confirm type-to-confirm and undo patterns. (+0.4)
4. Trim narrative comments into docs. (+0.2)

Re-score after each phase and settle all "(verify)" items first.
