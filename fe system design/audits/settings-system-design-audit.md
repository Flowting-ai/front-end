# Settings: System Design Audit

Scope: personal settings under `app/(app)/settings/(shell)`: `account` (1,037), `preferences` (496), `security` (618), `notifications` (545), `files` (902), `usage` (274), `help` (301), `ai` (see AI Models audit), `SettingsSkeleton.tsx` (635), `layout.tsx`, `page.tsx`; `components/layout/SettingsSidebar`, `SettingsPageShell`, `SettingsTable`, `AccountMenu`, `AccountRow`; `context/theme-context.tsx`, `lib/theme.ts`, `lib/api/user.ts` (639), `context/nav-guard-context.tsx`. About 4,800 lines. Org admin pages (members, general, activity) are in the Organizations audit; plans/billing in Credits and billing.
Method: layout, home redirect, theme context, account page save/guard logic and the headers of every page read; others by grep. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~43% (14.3 / 33 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.9 | 63% |
| 2. Architecture | 8 | 3.6 | 45% |
| 3. Component Patterns | 3 | 1.6 | 53% |
| 4. Data Model | 8 | 3.4 | 43% |
| 5. Interfaces and APIs | 5 | 2.4 | 48% |
| 6. Optimizations | 6 | 1.4 | 23% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, virtualisation, cursor pagination.

## Headline finding

Only the **Account** page (profile, avatar, default model, tone) and the **theme** selector are wired to real data. By the pages' own comments and code:
- **Preferences**: tone preset and custom instructions are local `useState` (`'Balanced'`, `''`); the theme mode is real only when theming is enabled; the rest is a static default.
- **Notifications**: `prefs` and `budgetAlerts` start from `DEFAULTS` and are never read from or written to an API.
- **Security**: `sessions` come from a hard-coded `SESSIONS` constant in the file, so the "active sessions" list (and any sign-out-device action) is not real data (verify what the buttons do).
- **Files**: `storageUsedGB = 2.4` is hard-coded ("TODO: wire to files API"); the plan-derived limit is guessed from the plan name string.
- Four pages carry the same comment about removing a `mounted` flag because "every value below is a static default (no props/API/localStorage read)". That records the render-pass fix but also confirms nothing is loaded.

If these pages are visible to users, they present settings that do not persist and a fake security panel. Either wire them or hide them behind a flag (as the pins feature does with `PINS_ENABLED`).

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Theme architecture (#27, #28, #32) | `ThemeProvider` uses `useSyncExternalStore` over localStorage and `matchMedia('(prefers-color-scheme: dark)')`, an inline `THEME_INIT_SCRIPT` sets `data-theme` before first paint (no flash), and the provider only writes when the stored value changes |
| Unsaved-changes guard | Account page registers dirty state, a guard message and a save handler with the app-wide `nav-guard-context`, plus `beforeunload`; baselines come from the loaded profile so dirty means "differs from server" |
| Scoped error boundary (#19) | `settings/layout.tsx` wraps only the page content in `ErrorBoundary`, keeping the sidebar mounted (documented reason) |
| Shared shells (#15) | `SettingsSidebar`, `SettingsPageShell`, `SettingsTable`, `AccountRow` give consistent layout |
| Skeleton continuity | `/settings` redirector renders the destination's skeleton to avoid a blank flash; `SettingsSkeleton` has per-page skeletons |
| Save batching | Account save collects tasks (`updateUser`, `updateOnboarding`) and runs them together (verify error handling per task) |
| Feature flags | `PINS_ENABLED` gates pin-related settings rows |
| Route constants | All settings routes in `lib/routes.ts` |
| Enum mapping | `roleDisplayLabel` / `toneDisplayLabel` convert between UI labels and backend enums in one place |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | `account/page.tsx` 1,037 lines (15 `useState`, 8 `useEffect`, 19 dirty-tracking references), `files/page.tsx` 902 (inline `Dropdown`/row components), `preferences` 496, `security` 618 (mostly static markup) | Split into profile, avatar, default-model, tone sections with a `useAccountForm()` hook |
| Form state (#35) | Dirty detection by comparing field baselines by hand | RHF with `formState.isDirty` and Zod schema for names, role, tone |
| Server state (#30, #38) | Profile comes from `useAuth()` + `refreshUser()`; models via `fetchModelsWithCache` (module cache); no query layer | `["me"]` and `["models"]` queries; save mutation invalidates `["me"]` |
| Optimistic updates (#33) | Tone and profile wait for the server before updating the UI | Optimistic with rollback for tone/model changes |
| Accessibility (#20) | `preferences`, `notifications`, `help` have 0 `aria-*`; `account` 5; switches and checkboxes need labels, tab groups need roles; avatar upload needs keyboard path (verify) | Label every control, group with `fieldset`/`legend`, announce save results |
| Style management (#16) | Layout and card styling inline (`style={{...}}`) in the layout and many pages | Tokens/Tailwind and the shared shell components |
| Error handling | Save shows toasts; partial failure of the parallel save tasks leaves some fields saved and the form state ambiguous (verify) | `Promise.allSettled` and per-field status, rollback or retry |
| Settings redirector | `/settings` is a client component with an effect redirect; includes `window.location.href` for the login redirect | Server `redirect('/settings/account')` and rely on the proxy gate for auth |
| Observability (#55) | Tracking only on Help (3) | Typed events for profile saved, tone changed, theme changed |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Non-functional pages shown as real | Preferences (tone, custom instructions), Notifications (all toggles), Security (sessions list), Files (storage numbers) are static UI | Wire to APIs (e.g. `/users/me` preferences, notification settings, Auth0 sessions, files usage) or flag-gate and label "coming soon" |
| Fake security data | A hard-coded `SESSIONS` array rendered as the user's active sessions, with a `sessions` state that removes rows on click | Remove, or back with real session data; showing invented devices in a Security page erodes trust |
| Misleading storage | `storageUsedGB = 2.4` constant; limit inferred by `planName.includes('power'/'pro')` string matching | Use the files/usage API; plan limits from `plan-config.ts` keyed by plan id, not substring |
| Duplicate preference concepts | Tone exists on Account (wired through `updateOnboarding({ ai_tone })`) and again on Preferences (`tonePreset`, local) with different value sets (`Direct/Balanced/Warm` vs `TonePreset`) (verify) | One source and one component |
| Theme in two places | Account page shows Sun/Moon/Computer theme icons using `useTheme`, Preferences has its own `localThemeMode` fallback when theming is off | One `ThemeSelector` component; remove the "local non-functional selector" path |
| Comment archaeology | Four pages repeat the same long comment about the removed `mounted` flag | Delete; the code is the documentation |
| Heavy icon imports on account page | Mix of `@hugeicons/react`, `@hugeicons/core-free-icons`, `@strange-huge/icons` in one file | One icon set |
| Settings spread across trees | Personal settings in `settings/(shell)`, org admin in `settings/(shell)/(org)`, legacy `/org/*` stubs and `settings/billing` + `plans-and-billing` + `billing/confirmation` duplicates | One route map; retire duplicates (`billing/confirmation` vs `plans-and-billing/confirmation`, `(org)/plans/confirmation` vs `org/plans/confirmation`) |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | None under `settings`: account dirty tracking and save, nav guard integration, theme persistence/hydration, wiring tests for preferences/notifications once real |
| Code splitting (#46) | Lazy-load avatar cropper/upload, model picker and heavy sections |
| `loading.tsx` / `error.tsx` | Route-level states (skeleton components exist; use them as `loading.tsx`) |
| URL as state (#34) | Tabs inside pages (Preferences tabs) reflected in query params |
| Real security features | Session list from Auth0, sign out other sessions, MFA status, password change link (verify what the buttons do) |
| Notification persistence | Per-channel/event preference API, test-notification button |
| Data export/delete account | GDPR-style export and delete flows (verify existence elsewhere) |
| Cross-tab sync | Theme and profile changes between tabs (`storage` event for theme) |
| Debounce | Instructions autosave if introduced |
| Web Vitals / budget (#8, #56) | Budget for the settings shell |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Honesty and quick wins (S, 43% → ~56%)
1. Hide or label every non-wired page/section (flag-gated "coming soon"); remove the fake sessions list now. (+1.0)
2. Replace the `/settings` redirector with a server `redirect`; use `loading.tsx` with existing skeletons. (+0.5)
3. Label all controls (switches, checkboxes, tab groups), live region for save results. (+0.6)
4. Remove the four duplicate `mounted`-flag comments and unify the theme selector. (+0.3)
5. Typed analytics for profile save, tone change, theme change. (+0.4)
6. Tests for account dirty/save and theme init/hydration. (+0.8)

### Phase 2: Wire real data (M, → ~72%)
1. Preferences (tone, custom instructions) persisted via the user/preferences API; remove the duplicate tone control. (+1.0)
2. Notifications preferences API plus a query/mutation pair. (+0.8)
3. Files usage from the API; plan limits from `plan-config` by id. (+0.6)
4. Security: real sessions and sign-out via Auth0/backend, or remove the page. (+0.8)
5. `["me"]` and `["models"]` queries; save mutation with `Promise.allSettled` and per-field results; optimistic tone/model changes. (+1.2)

### Phase 3: Components and forms (M, → ~90%)
1. Split `account`, `files`, `preferences` into sections and hooks, none above ~350 lines. (+1.2)
2. RHF + Zod forms with `isDirty` feeding the nav guard. (+1.0)
3. Lazy-load avatar tools and heavy sections; one icon set; tokens in place of inline styles. (+0.8)
4. Retire duplicate billing/confirmation and org stub routes. (+0.4)
5. Tab state in URL params. (+0.3)

### Phase 4: Governance (S, → 100%)
1. Performance budget and Web Vitals for the settings shell. (+0.5)
2. Accessibility audit (axe plus screen reader). (+0.4)
3. Cross-tab theme/profile sync; data export/delete flows if in scope. (+0.4)
4. Contract tests for each settings API. (+0.3)

Re-score after each phase and settle all "(verify)" items first.
