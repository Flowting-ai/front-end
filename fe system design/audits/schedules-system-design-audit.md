# Schedules Feature: System Design Audit

Scope: `app/(app)/schedules` (`page.tsx`, `[id]/page.tsx`, `SchedulesScreen.tsx` 589 lines, `ScheduleSkeletons.tsx`), `src/templates/Schedules/*` (list, card, detail, edit modal 595 lines, delete modal, loop history), `lib/api/automations.ts`, `lib/scheduleLinks.ts`. About 2,900 lines. Backend calls this "automations".
Method: structural scan plus reading the screen's load, toggle, delete and run flows and the API module. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~46% (12.9 / 28 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.7 | 57% |
| 2. Architecture | 8 | 3.6 | 45% |
| 3. Component Patterns | 1 | 0.4 | 40% |
| 4. Data Model | 7 | 3.7 | 53% |
| 5. Interfaces and APIs | 5 | 2.6 | 52% |
| 6. Optimizations | 4 | 0.9 | 23% |

Not applicable: SSG, ISR, RSC data fetching, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, cursor pagination, virtualisation, real-time state.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| URL as state (#34) | Each persisted schedule has its own route `/schedules/[id]`; legacy `?selected=` links (notifications, Slack) are redirected to it |
| Optimistic updates (#33) | Pause/resume updates list and detail immediately and reverts on failure (including the 409 "no future run" case) |
| Pessimistic where right | Delete keeps the modal and detail open with a spinner until the request resolves, with a comment explaining why |
| Loading UX (#7) | Dedicated `ScheduleSkeletons.tsx`; `Suspense` around the inner page (needed for `useSearchParams`) |
| Race safety | Detail load uses a `cancelled` flag in the effect cleanup |
| Access model | Owner sees full detail and runs; non-owners fall back to the read-only org row; org list loaded lazily on first visit |
| Defensive parsing | `Array.isArray` guard on list payload; `runSummary`/`failureReason` trim Python tracebacks to the last line for users |
| API layer (#40) | HTTP isolated in `lib/api/automations.ts`; doc comments map each function to its endpoint; non-2xx on `run` converted to `ApiError` |
| Timezone handling | `Intl` timezone detection and `supportedValuesOf` in the edit modal |
| Safe routing | `encodeURIComponent` on ids in pushed routes |
| Thin route files (#6) | `page.tsx` files only mount the screen and pass `params` |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | `SchedulesScreen` handles list, detail, org scope, local placeholders, copy, delete, toggle, run, edit, redirect and mapping in one file with 14+ `useState` and several effects; `ScheduleEditModal` 595 lines with 10 `useState` + 5 `useEffect` | Container hook `useSchedules()` + presentational list/detail; split the edit modal into frequency picker, time/timezone and prompt sections |
| Server state (#30, #38) | List, detail and org list fetched in effects and copied into `useState`; refresh after run is a manual second fetch | React Query: `["automations"]`, `["automation", id]`, `["automations","org"]`; mutations invalidate |
| Run-now feedback (#36) | After "Schedule triggered" the detail is refetched once; `is_running` and the new run appear only if the run is already recorded (verify), no polling | `refetchInterval` while `is_running` or any run is `running`, stopping on completion |
| Error handling (#45) | Generic toasts ("Failed to run schedule") hide the reason; `console.error` only; the detail effect treats *any* error from `getAutomation` as "not mine" and then tries the org list | Branch on `ApiError.status` (403/404 → org fallback; network/5xx → retry UI) |
| Error boundaries (#19) | Layout-level only; no `error.tsx` for `/schedules` | Add route `error.tsx` and a boundary around the detail pane |
| Accessibility (#20) | 9 `aria-*` across all files, cards likely click targets (verify keyboard/role); toggle and run states not announced | Buttons/links for cards, `aria-pressed` on toggle, live region for run status |
| Style management (#16) | Mix of inline styles and tokens (verify) | Move to shared components/tokens |
| Observability (#55) | `console.error` only; no analytics for create/pause/run/delete | Typed events via `trackFeature` |
| Form state (#35) | Edit modal hand-manages frequency, time, day, timezone, summary | React Hook Form + Zod; one schema for the form and the API body |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Schedule stored as `Record<string, unknown>` and parsed from text | `schedule_json` is untyped; the UI recovers frequency/time/timezone by regex on a description string (`(timezone)` match, named-day lookup in the modal) and derives "drift" from it | Define a typed `Schedule` schema (`{type, hour, minute, day, timezone}`) in Zod shared by display and edit; ask the backend for a structured field |
| No runtime validation | All automation responses are cast (`apiFetchJson<Automation[]>`), only an `Array.isArray` guard protects the list | Zod schemas for `Automation`, `AutomationDetail`, `AutomationRun`, org items |
| Local-only placeholder schedules | `localIdsRef` creates a second code path in every handler (select, delete, toggle, run) for rows with no backend id | Remove placeholders; create via the API (or a clear "creating" status) so one path remains |
| Link store in localStorage | `schedule_chat_links_v1` maps schedule to chat forever, bound "once" with no rebind and no cleanup; duplicated by the backend `chat_id` that is now authoritative | Rely on backend `chat_id` (list endpoint could return it); delete the store and its migration code |
| Mapping on every render path | `taskToListItem` formats dates and writes the link store as a side effect inside a mapper | Pure mapper; side effects separate |
| Org scope loaded imperatively | Scope switch triggers fetch inside an event handler and reverts scope on failure | Query keyed by scope; error state in the org tab |
| Storage keys outside `storage-keys.ts` | `schedule_chat_links_v1`, `schedule_pending_prompt:<id>` defined locally | Centralise |
| Dual home for UI | Components live in `src/templates/Schedules` (a name that now clashes with the Templates feature) while the screen is in `app/` | Move to `components/Schedules/` |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | None for the screen, mappers, `schedule_json` parsing, toggle revert, delete flow (only `XmlSchedule` in chat is tested). Add unit tests for `scheduleDescription`/drift/`failureReason` and integration tests for optimistic revert |
| Code splitting (#46) | Lazy-load edit and delete modals and run-history card |
| `loading.tsx` / `error.tsx` / `not-found.tsx` | Route-level states for `/schedules/[id]` (unknown id currently toasts and redirects) |
| Pagination / run-history paging (#39) | Runs come embedded in the detail; long histories need paging |
| Next/last run correctness | Show next run in the user's timezone consistently (verify the `formatNextRun` path across DST) |
| Core Web Vitals / budget (#8, #56) | Budget for the schedules routes |
| Permissions helper | One `canEdit(schedule, user)` for owner vs org viewer |
| Empty/zero states | First-run empty state with a "create from chat" prompt (verify) |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 46% → ~58%)
1. Zod schemas for every automation response; typed `Schedule` object replacing regex parsing where the backend allows. (+1.5)
2. Branch error handling on `ApiError.status`; show real reasons; stop treating every failure as "not mine". (+0.7)
3. `error.tsx`, `loading.tsx`, `not-found.tsx` for `/schedules` and `/schedules/[id]`. (+0.7)
4. Tests for mappers, `failureReason`, drift, toggle revert and delete flows. (+1.0)
5. Aria/keyboard fixes on cards, toggle, run status. (+0.5)
6. Lazy-load edit/delete modals. (+0.3)

### Phase 2: Data layer (M, → ~75%)
1. Move list, detail, org list to React Query with mutations (toggle optimistic with rollback, delete, run, update). (+2.0)
2. Poll while a run is in progress; show live status in list and detail. (+0.7)
3. Remove local placeholders and the localStorage link store; rely on backend `chat_id`. (+1.0)
4. Pure mappers; centralise storage keys for what remains. (+0.5)

### Phase 3: Components and forms (M, → ~90%)
1. Extract `useSchedules()` container; split `SchedulesScreen` into list pane, detail pane, org tab; none above ~300 lines. (+1.0)
2. Rebuild the edit modal on React Hook Form + Zod with sub-components. (+1.0)
3. Rename `src/templates/Schedules` to `components/Schedules`. (+0.3)
4. Shared `canEdit` permission helper. (+0.3)

### Phase 4: Governance (S, → 100%)
1. Typed analytics (created, paused, resumed, run now, deleted, copy from org) and structured error logging. (+0.8)
2. Run-history paging. (+0.4)
3. Performance budget and Web Vitals on the routes; DST/timezone tests for next-run display. (+0.5)
4. Accessibility audit (axe plus screen reader). (+0.3)

Re-score after each phase and settle all "(verify)" items first.
