# Slack: System Design Audit

Scope: `app/(app)/souvenir-slack` (admin config: `page.tsx` 161, `layout.tsx` 26, `SlackWorkspaceConfig.tsx` 520, `SlackAppPanel.tsx` 349, `SlackConnectorsPanel.tsx` 244, `SlackAutomationsPanel.tsx` 209, `SlackEmptyState.tsx`, `slack-config.module.css`), `app/(app)/slack/link/page.tsx` (203, member identity link/unlink), `components/FlatSidebarSlackConnector`, `lib/api/slack.ts` (500). About 2,300 lines.
Method: `lib/api/slack.ts`, the layout guard, the link page and the page's load logic read; panels checked by grep. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~44% (14.4 / 33 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.5 | 50% |
| 2. Architecture | 8 | 3.7 | 46% |
| 3. Component Patterns | 2 | 0.8 | 40% |
| 4. Data Model | 7 | 3.2 | 46% |
| 5. Interfaces and APIs | 6 | 3.6 | 60% |
| 6. Optimizations | 7 | 1.6 | 23% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, virtualisation, cursor pagination, debounce.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Runtime validation (#35) | Most responses parsed with Zod schemas that cite the backend schema they mirror (`SlackChannelItem`, `SlackWorkspaceStatus`, channel summary, connectors, automations, app config, channel settings) |
| Anti-corruption layer | Snake_case wire types mapped to camelCase domain types (`normalizeChannel`, `normalizeStatus`, `toWorkspaceChannel`, `toScopeConnector`); `connected` derived from the workspace list |
| API-layer separation (#40) | All HTTP in one module with doc comments naming each endpoint; components never touch `fetch` |
| BFF / auth (#41, #42) | Calls go through the app proxy with the user's session; org id passed explicitly per call |
| OAuth redirect flow | Install URL fetched from the backend (`getSlackInstallUrl`), the browser is sent to Slack, and the return leg is handled by the link page via `state` / `authorized=1` |
| State machine (#40) | Link page has an explicit `PageState` (`linking`, `authorizing`, `linked`, `missing`, `error`, `disconnected`), the initial state decided at first render (no synchronous `setState` in an effect), and a `linkedOnce` ref against StrictMode double invocation |
| Role gate (#42) | Admin-only layout guard redirects non-admins to chat |
| Reconnect signalling | `missing_scopes` and `needs_reinstall` carried in the status type so the UI can request reinstall |
| Lazy per-feature panels | Panels split by concern (app, connectors, automations, workspace config) |
| Tests | `slack.test.ts` for the API module |
| Image handling | `next/image` used in the empty state and workspace config |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Server state (#30, #38) | Every panel fetches in `useEffect` and copies into `useState`: status (page, again in `SlackWorkspaceConfig`), channels, summaries, connectors, automations, config. The page fetches org status in two effects plus a refresh | React Query keyed by `orgId` (`["slack","status",orgId]`, `["slack","channels",orgId]`, ...); mutations invalidate |
| Component architecture (#12) | `SlackWorkspaceConfig` 520 lines with 16 `useState` and 8 API calls; `SlackConnectorsPanel` 10 `useState` | Container hooks per panel (`useSlackChannels`, `useSlackConnectors`) and presentational parts |
| Optimistic updates (#33) | None; renames, lend/remove connector, config edits and skill upload wait for the server and then refetch | Optimistic update with rollback for rename, lend and remove |
| Error handling (#45) | Two hand-copied blocks parse `{detail, message, error}` from failed responses (`removeOrgSlackInstallation`, `deleteProjectSlackChannel`) with empty `catch {}`; `friendlyApiError` exists but is not used everywhere (verify) | One `throwApiError(response)` helper in `client.ts` |
| Error boundaries (#19) | Layout-level only | Boundary around each panel so a failing connectors list does not hide the app config |
| Accessibility (#20) | `aria-*` counts: workspace config 10, app panel 3, connectors 2, automations 1, page 0; link page has none (a full-page state change with no live region) | `role="status"` for link states, labels for panels, focus management in modals |
| Style management (#16) | Link page defines `cardStyle`/`titleStyle`/`bodyStyle` inline objects with raw rgba shadows; config uses a CSS module | Shared page-card/empty-state component and tokens |
| Observability (#55) | No analytics events anywhere in the feature | Typed events: install started, install completed, link/unlink, channel created, connector lent, skill uploaded |
| Role gate rendering (#42) | `layout.tsx` redirects in an effect and renders `null` while not ready or not admin, so non-admins see a blank flash before redirect | Server-side check in a server layout (session role) or render a "no access" state; keep backend authority |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Link/disconnect responses not validated | `SlackLinkResponseRaw` and `SlackDisconnectResponseRaw` are bare TypeScript interfaces, not Zod schemas, while every other response is parsed | Add schemas; the link response carries an `authorization_url` that the UI navigates to, so it should be validated (and checked to be an `https://slack.com` URL) |
| Navigating to a backend-provided URL | The install and authorization URLs are opened as returned | Validate host allowlist (`slack.com`) with `sanitizeURL`-style check before `window.location`/`open` |
| Duplicated org status fetch | Page and workspace config both call `getOrgSlackStatus(orgId)`; the page re-fetches after actions via local effects and a `updating` flag | Single query; invalidate after install/remove |
| Two parallel "Slack" concepts | `/souvenir-slack` (workspace/org admin app config) and `/slack/link` (member identity link) share a module and names; the sidebar item is a third entry | Document and name consistently (`slack-admin` vs `slack-identity`), or split the API module |
| `.catch(() => {})` patterns | Empty catch blocks while reading error bodies hide malformed responses | Log at debug level and fall back to status text |
| Client-only authorisation | Hiding UI by role is cosmetic; enforcement must remain in the backend (it appears to be) | Keep, and add a test that non-admin API calls return 403 handling in the UI |
| Skill upload | `uploadSlackSkill(orgId, file)` has no client-side size/type validation shown (verify) | Zod/file constraints before upload; progress and error state |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Code splitting (#46, #48) | The config panels and modals load with the route; lazy-load `SlackWorkspaceConfig` tabs and the skill-upload dialog |
| `error.tsx` / `loading.tsx` | Route-level states for `/souvenir-slack` and `/slack/link` |
| Suspense / skeletons (#7) | Loading skeleton for panels (currently spinners via `statusLoading`) |
| Form state (#35) | RHF + Zod for channel creation (name rules: lowercase, length, characters) and app config |
| Tests | Page and panel behaviour: install return flow, reinstall banner, role redirect, link page states, rollback on failure |
| Polling after install | After returning from Slack, re-check status until the workspace appears (similar to the connectors poll), with timeout |
| Permissions helper | `canManageSlack(role)` shared with the sidebar and layout |
| Core Web Vitals / budget (#8, #56) | Budget for the admin route |
| Empty and error copy | Distinct states for "not installed", "needs reinstall", "missing scopes" (verify coverage) |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 44% → ~57%)
1. Zod schemas for link/disconnect responses; allowlist-check Slack URLs before navigating. (+1.0)
2. One `throwApiError` helper replacing the duplicated body-parsing blocks. (+0.5)
3. Replace the effect-based role redirect with a server layout check or a visible "no access" state. (+0.6)
4. `role="status"` live regions and labels on the link page and panels. (+0.5)
5. `error.tsx`, `loading.tsx` and per-panel error boundaries. (+0.8)
6. Typed analytics events for install, link, unlink, channel and connector actions. (+0.6)

### Phase 2: Data layer (M, → ~74%)
1. Move status, channels, summaries, connectors, automations and app config to React Query keyed by `orgId`. (+2.0)
2. Mutations with invalidation; optimistic rename, lend and remove with rollback. (+1.0)
3. Poll status after returning from Slack until the workspace appears. (+0.5)
4. One status query shared by the page, sidebar item and config. (+0.4)

### Phase 3: Components and forms (M, → ~90%)
1. Split `SlackWorkspaceConfig` and `SlackConnectorsPanel` into container hooks plus presentational parts, none above ~300 lines. (+1.2)
2. RHF + Zod forms for channel creation and app config; file constraints for skill upload. (+0.8)
3. Shared card/empty-state component and tokens instead of inline style objects. (+0.5)
4. Lazy-load tabs and dialogs; skeleton loaders. (+0.6)
5. Shared `canManageSlack` helper. (+0.2)

### Phase 4: Governance (S, → 100%)
1. Tests for the link state machine, role redirect, reinstall flow and rollback paths. (+0.8)
2. Performance budget and Web Vitals for the route. (+0.4)
3. Accessibility audit (axe plus screen reader). (+0.4)
4. Confirm distinct UI for missing scopes and reinstall states. (+0.2)

Re-score after each phase and settle all "(verify)" items first.
