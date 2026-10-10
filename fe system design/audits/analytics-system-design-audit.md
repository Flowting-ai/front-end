# Analytics: System Design Audit

"Analytics" in `features.md` covers two things, audited together:
- **A. Usage dashboard** (admin): `settings/(shell)/(org)/analytics/page.tsx` (753), `components/ChartCard`, `DeltaPill`, `DateRangePill`, `UsageBarChart`, `Sparkline`.
- **B. Product analytics instrumentation** (Mixpanel): `lib/analytics/{mixpanel,events,screens,stamps}.ts` (405 lines), `components/Analytics/{MixpanelProvider,OrgStamps}.tsx`, the `/dispatch` proxy route, and the call sites across the app. Rules are in `AGENTS.md` and `docs/analytics/*`.
About 1,900 lines. Chat's own chart widgets (`XmlChart`, `AnimatedBarChart`) belong to the Chat audit.
Method: dashboard page logic, `ChartCard`, `events.ts`, `screens.ts`, the head of `mixpanel.ts` read; call-site coverage counted by grep. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~49% (12.7 / 26 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 2 | 1.3 | 65% |
| 2. Architecture | 8 | 4.4 | 55% |
| 3. Component Patterns | 3 | 1.7 | 57% |
| 4. Data Model | 4 | 1.5 | 38% |
| 5. Interfaces and APIs | 3 | 1.8 | 60% |
| 6. Optimizations | 6 | 2.0 | 33% |

Not applicable: SSR, SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, virtualisation, pagination, optimistic updates.

## Headline findings

1. **The usage-by-feature chart is synthetic.** The backend gives only the cycle's total `used` credits, per-member totals, and no time series. `buildFeatureSeries()` splits that total into Chat / Slack / Automations with fixed constants (`FEATURE_SPLIT` 68% / 20% / 12%) and shapes the daily bars with `sin`/`cos` weights ("deterministic... no Math.random"). The code is candid, and a caption says "estimated... (no per-day breakdown yet)", but the chart looks like measured data and the per-feature split is invented. For 1, 3 and 6 months the windows clamp to the same cycle total.
2. **Instrumentation is well designed but under-wired.** Of 18 declared browser events, 6 have no call site (`activation_milestone`, `brain_run_stopped`, `team_member_invited`, `connector_connect_attempted`, `credit_cap_set`, `model_toggled_off`). Of 22 controlled feature names, 7 have none (`share_button`, `pin_drag`, `project_agent_attached`, `context_panel_opened`, `permission_level_changed`, `flashcards`, `output_viewed`). These are the same gaps found in the Organizations, Connectors and AI Models audits.

---

## 1. Already applied well

**A. Dashboard**

| Principle | Evidence |
|---|---|
| Reusable chart shell (#25) | `ChartCard` is generic over the range id type with slots for `chart`, `toolbarLeft`, delta pill and range tabs; also used by Agents and other pages |
| Honest derivation notes | Long comments explain which numbers are real (`used`, per-member `creditUsed`) and which are derived; the page explains why member totals can exceed the limit (utility usage is metered but not charged) |
| Reconciliation copy | Caption states when the window equals the Monthly Limits total |
| Billing cycle awareness | `cycleRange()` uses the real `currentPeriodEnd` when available, calendar month as a fallback |
| Enterprise branch | Different framing when there is no credit pool |
| Skeleton | `AnalyticsPageSkeleton` with the same row count as the real top-users list |
| Deterministic rendering | No `Math.random`; stable between renders |
| Accessibility basics | Range tabs labelled (`aria-label="Usage date range"`), info buttons labelled, color swatches `aria-hidden` |

**B. Instrumentation**

| Principle | Evidence |
|---|---|
| Typed vocabulary (#40, #55) | `ScreenName`, `FeatureName` and `BrowserEvent` unions are the single source of truth; adding coverage means adding a name first (doc, then union, then call site) |
| Privacy by design (#21) | "No free text in properties (IDs/enums only)", autocapture and session replay off, `distinct_id` = Auth0 `sub` never email, no `people.set` before identify |
| Fail-safe SDK wrapper | Only `mixpanel.ts` imports `mixpanel-browser`; no-op without a token; server calls ignored; every SDK call in try/catch; failures logged in dev only |
| Blocker-resistant ingestion (#9, #41) | First-party `/dispatch` proxy with aliased routes (`evt`/`usr`/`grp`) because filter lists match tracking paths; matcher excludes `/dispatch` so beacons skip the auth gate; complete `api_routes` object (SDK shallow-merge pitfall documented) |
| Layered model | Layer 1 screens, Layer 3 decisions, Layer 4 feature use; backend-originated events kept out of the browser file with a contract doc |
| Route to screen mapping | `screens.ts` maps routes to concept names; unmapped routes return `null` and are surfaced in dev |
| Super-properties | Stamps (`surface`, plan or `org_id` + `org_tier`) ride on every event via `OrgStamps` |
| Identity lifecycle | `identify` before `register`, `reset` on logout, in `MixpanelProvider` mounted inside `AuthProvider` |
| Tests | None found specifically, but helpers are pure and typed (see missing) |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Server state (#30) | Dashboard fetches `Billing.fetch()` in an effect and swallows errors (`.catch(() => {})`), reads the rest from `useOrg()` | React Query `["billing"]`; show an error or fallback-cycle notice |
| Component architecture (#12) | `analytics/page.tsx` 753 lines: data derivation (utilisation, top users, gap notes), chart config, and layout together | `useOrgUsage()` hook returning derived data; presentational cards |
| Observability coverage (#55) | 6 of 18 browser events and 7 of 22 features unwired (see headline); screens missing for schedules, connectors, compare, templates, shared pages (verify against `screens.ts` tail) | Wire or remove each name; add a CI check (script) that every union member has a call site or a documented "backend only" tag |
| Event props | `EventProps` is `Record<string, string \| number \| boolean \| undefined>`; the type does not forbid free text, only convention does | Per-event prop types (discriminated union) so `trackFeature("effort_level_changed", { level })` is checked, and a lint rule against passing titles/prompts |
| Charts accessibility (#20) | Recharts output has no text alternative; the bar chart conveys data by color and position only | Visually hidden data table or `aria-describedby` summary; patterns or labels beyond color |
| Error boundaries (#19) | Layout-level only | Boundary around chart cards |
| Dev feedback | Gaps are "surfaced in dev" via warn, easy to miss | A dev-only overlay or test failing on unmapped routes |
| Components | `Sparkline`, `UsageBarChart` import Recharts statically | Lazy-load the chart components on pages that need them |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Fabricated feature split and daily curve | `FEATURE_SPLIT` and sin/cos weights present invented per-day and per-feature numbers beside real totals; admins may make decisions (limits, seat changes) based on them | Remove the synthetic chart until the backend provides a series, or render a single measured series (total used, per-member bars) and mark the rest "not available"; at minimum a visible "Estimated" badge on the chart itself, not only a caption |
| Same total across ranges | Selecting 1/3/6 months returns identical bars (windows clamp to the cycle total), so the control looks functional but changes nothing | Disable unavailable ranges with a tooltip, or request historical data from the backend |
| `utilisation` redefined | The Figma "20% utilisation" metric is replaced by "share of active members who spent any credits", explained in copy | Rename the card to match the real definition |
| Swallowed billing error | `Billing.fetch().catch(() => {})` hides the 403 case on purpose, but also hides network errors | Distinguish 403/null (fallback) from failures (retry notice) |
| Date math with `new Date()` in render | `new Date()` called in render and `useMemo` (`cycleRange(..., new Date())`, `buildFeatureSeries(..., new Date())`), and local-time month boundaries (`getFullYear/getMonth`) vs backend UTC cycles | Pass `now` once; compute cycle boundaries in UTC from backend dates |
| `trackFeature` free-form props | Call sites can attach any string; no review for IDs-only compliance | Typed props per event; PR check |
| Name drift | Screen names such as `org_manage` absorb many routes (`general`, `members`, `plans`, `analytics`, `activity`); the doc rule says redesigns keep names | Acceptable, but add `tab` property so funnels can separate pages |
| Comment-heavy logic | Business rules live in 20-line comments inside the page | Move rule documentation to a docs note; keep short why-comments |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | `buildFeatureSeries` (if kept), `cycleRange`, top-users and gap messages, `screens.ts` route mapping table, `events.ts` helper no-op behavior, proxy route (strips cookie, forwards IP), identify/reset ordering |
| Server-provided analytics | Request org usage time series (per day, per feature, per member) from the backend; then query by range with React Query |
| Export | CSV export of usage per member; date-range and member filters |
| Real-time budget alerts | Link the usage view to credit cap alerts (`credit_cap_set` event exists but unwired) |
| Consent | Cookie/consent gate for analytics where required (verify with the Meta Pixel TODO in Onboarding audit) |
| Performance | Budget for the analytics route; chart libs lazily loaded; INP on range switch (`useTransition`) |
| Coverage report | Script comparing declared events with call sites (counts above), run in CI |
| Funnel docs | Link each event to the funnel it serves (activation, upgrade, collaboration) |
| `error.tsx` / `loading.tsx` | Route states |
| Data retention and deletion | Document Mixpanel retention and a user deletion path (GDPR) |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Honesty and wiring (S, 49% → ~62%)
1. Mark or remove the synthetic per-feature chart; disable ranges that have no data; fix card naming. (+1.0)
2. Wire or delete the 6 unwired browser events and 7 unwired feature names (team invite, connector connect attempted, credit cap, model toggled off, etc.). (+0.8)
3. Add a CI script that fails when a declared event has no call site and no "backend only" tag. (+0.4)
4. Distinguish 403 from network failure on the billing fetch; show a retry notice. (+0.3)
5. Tests for `cycleRange`, `screens.ts` mapping and the analytics no-op paths. (+0.8)
6. Chart text alternative (hidden table or summary). (+0.4)

### Phase 2: Typing and data (M, → ~76%)
1. Per-event prop types (discriminated unions), review rule for IDs only. (+0.8)
2. React Query for billing and org usage; remove the swallowed catch. (+0.8)
3. Backend time-series endpoint (request) and real feature breakdown; delete `FEATURE_SPLIT` and sin/cos weights. (+1.2, backend request)
4. UTC cycle math and a single `now`. (+0.3)
5. Add `tab` property to `org_manage` screen events; fill missing screens (schedules, connectors, compare, templates). (+0.4)

### Phase 3: Components and performance (M, → ~90%)
1. `useOrgUsage()` hook plus presentational cards; page under ~300 lines. (+0.8)
2. Lazy-load chart components and Recharts; `useTransition` on range change. (+0.8)
3. Error boundary around chart cards; `loading.tsx`/`error.tsx`. (+0.5)
4. CSV export and member/date filters. (+0.4)
5. Shorten comments, move rules to docs. (+0.3)

### Phase 4: Governance (S, → 100%)
1. Performance budget and Web Vitals on the analytics route; INP check on range switch. (+0.5)
2. Consent gating and retention/deletion documentation. (+0.4)
3. Accessibility audit (axe plus screen reader) for charts. (+0.4)
4. Funnel documentation linking events to goals; dashboards in Mixpanel match the vocabulary. (+0.3)

Re-score after each phase and settle all "(verify)" items first.
