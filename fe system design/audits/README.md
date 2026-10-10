# Feature System Design Audits

One audit per feature in `../features.md`, scored against the 56 principles in `../principles` (6 folders). Each report lists what is applied well, what needs improvement, what is applied wrongly, what is missing, an efficiency percentage, and a 4-phase plan to 100%.

Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only. Scores come from a structural scan, not a line-by-line review; "(verify)" marks items needing a closer look.

| # | Feature | Report | Efficiency |
|---|---|---|---|
| 1 | Chat | [chat-system-design-audit.md](chat-system-design-audit.md) | ~56% |
| 2 | Compare | [compare-system-design-audit.md](compare-system-design-audit.md) | ~43% |
| 3 | Agents | [agents-system-design-audit.md](agents-system-design-audit.md) | ~43% |
| 4 | Projects | [projects-system-design-audit.md](projects-system-design-audit.md) | ~42% |
| 5 | Templates | [templates-system-design-audit.md](templates-system-design-audit.md) | ~63% |
| 6 | Schedules | [schedules-system-design-audit.md](schedules-system-design-audit.md) | ~46% |
| 7 | Pinboard and Highlights | [pinboard-system-design-audit.md](pinboard-system-design-audit.md) | ~47% |
| 8 | Global search | [global-search-system-design-audit.md](global-search-system-design-audit.md) | ~40% |
| 9 | Connectors | [connectors-system-design-audit.md](connectors-system-design-audit.md) | ~55% |
| 10 | Slack | [slack-system-design-audit.md](slack-system-design-audit.md) | ~44% |
| 11 | AI Models view | [ai-models-system-design-audit.md](ai-models-system-design-audit.md) | ~46% |
| 12 | Auth | [auth-system-design-audit.md](auth-system-design-audit.md) | ~59% |
| 13 | Onboarding | [onboarding-system-design-audit.md](onboarding-system-design-audit.md) | ~48% |
| 14 | Organizations | [organizations-system-design-audit.md](organizations-system-design-audit.md) | ~42% |
| 15 | Settings | [settings-system-design-audit.md](settings-system-design-audit.md) | ~43% |
| 16 | Credits and billing | [credits-billing-system-design-audit.md](credits-billing-system-design-audit.md) | ~46% |
| 17 | Analytics (dashboard and Mixpanel) | [analytics-system-design-audit.md](analytics-system-design-audit.md) | ~49% |
| 18 | Notifications | [notifications-system-design-audit.md](notifications-system-design-audit.md) | ~57% |
| 19 | Prompt enhancement | [prompt-enhancement-system-design-audit.md](prompt-enhancement-system-design-audit.md) | ~49% |
| 20 | Personas and Share | [personas-share-system-design-audit.md](personas-share-system-design-audit.md) | ~45% |
| 21 | Internal and API routes | [internal-api-routes-system-design-audit.md](internal-api-routes-system-design-audit.md) | ~54% |

All 21 feature areas in `features.md` are now audited. See the cross-cutting summary below.

Note: the Auth audit corrects an overstatement in earlier reports. The `/api/backend` proxy is not a token-hiding BFF: the access token lives in browser memory and the client adds the `Authorization` header. Read "BFF" credit in earlier audits as partial.

## Cross-cutting summary

Scores range from 40% (Global search) to 63% (Templates); the average is about 48%. The same gaps recur across features:

1. **No shared server-state layer.** React Query is installed but used in one hook (`usePersonas`). Nearly every feature hand-rolls fetch-in-effect, module caches and `window` events. Adopting it once removes most of the "needs improvement" items in 15+ audits.
2. **God components and contexts.** Files over 1,000 lines (ChatInterface, agents page, plans-and-billing, settings general/members) with 15 to 37 `useState` each.
3. **Unvalidated API boundaries.** Zod is strong in connectors, billing, Slack and personas but missing for projects, chat shares, persona shares, models, pins, highlights, automations.
4. **Auth and server exposure.** Access token in browser memory; `/api/*` not behind the login gate; unauthenticated `/api/download` and `/api/lab`; unvalidated ids in proxy URLs; a client-set cookie that skips the onboarding gate.
5. **UI that is not real.** Settings Preferences/Notifications/Security/Files and the Analytics per-feature chart show static or synthetic data.
6. **Observability gaps.** 6 of 18 browser analytics events and 7 of 22 feature names are never emitted; no error tracking or Web Vitals.
7. **Missing route-level files.** No `error.tsx`, `loading.tsx`, `not-found.tsx` anywhere under `app/`.
8. **Duplicate generations.** Legacy and new agent editors, three plan pickers, old and v1.5 onboarding, four sharing mechanisms.
9. **Low test coverage on pages**; business logic libs are well tested.

Suggested order of work across the codebase: (1) close the open API routes and token exposure, (2) remove or label non-functional UI, (3) introduce the React Query layer and shared `apiRequest`/Zod boundary, (4) add route `error`/`loading` files and boundaries, (5) split the large components, (6) observability and budgets.

## Bundle performance work

- Plan: [bundle-performance-fix-plan.md](bundle-performance-fix-plan.md)
- Implemented and verified: [bundle-fix-test-report.md](bundle-fix-test-report.md) (`/chat` JS 8,464 KB to 1,077 KB, 19 of 19 browser cases passing before and after)
