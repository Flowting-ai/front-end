# Souvenir in Slack Feature — Detailed Report

**Scope:** the Slack integration — connecting a workspace's Slack, and mapping Slack channels to Projects so Tasks/Brain can use project context automatically inside Slack. Smallest feature audited in this series (1 page, 774 LOC).

**How this was produced:** live, logged-in Playwright run, Lighthouse against the same session, and a static-analysis pass (`react-doctor`) filtered to this feature's files.

---

## 1. Pages in this feature

| Route | File | Purpose |
|---|---|---|
| `/souvenir-slack` | `src/app/(app)/souvenir-slack/page.tsx` | The entire feature — connect Slack workspace, manage per-project Slack channel mapping |

**Core components:** `FlatSidebarSlackConnector/index.tsx` (the sidebar entry point/status indicator, labeled "Souvenir in Slack" with an "Add" action).

No dedicated state/context module — this feature's logic lives directly in the single page file.

---

## 2. All API calls used by this feature

From `src/lib/config.ts` (`SLACK_*` / `ORG_SLACK_*` block):

| Endpoint | Method | Used for |
|---|---|---|
| `/slack/install` | — | Start the Slack app install/OAuth flow |
| `/slack/status` | GET | Connection status |
| `/slack/link` | — | Link flow |
| `/organizations/{id}/slack/channels` | GET | List Slack channels available for mapping |
| `/organizations/{id}/slack/channels/{channelId}/mapping` | — | Map/unmap a channel to a project |
| `/organizations/{id}/slack/installation` | GET | **Confirmed live — see §3, called 3× on a single page load** |
| `/organizations/{id}/slack/projects/{projectId}/channel` | — | Per-project channel assignment |

---

## 3. Live functional test results

### 3.1 `/souvenir-slack` — clean render, not-connected state
Renders correctly: "Slack project channels" heading, explanatory copy ("Create one Slack channel per project so Tasks can use that project context automatically"), a clear "Slack is not connected yet" empty-state card, and a "Connect Slack workspace" CTA with the Slack icon. No visual defects, no console errors beyond the recurring CSP warning.

### 3.2 **Confirmed live: the same endpoint fetched 3 times on one single page load, no navigation involved**

`GET /organizations/{orgId}/slack/installation` fired **three separate times** (990ms, 885ms, 1,807ms) during one static page load of `/souvenir-slack` — not across multiple page visits like the redundant-fetch pattern documented in the Chats and Brain/Tasks reports, but **three calls for the same data within a single render**. This is the most concentrated instance of the "no request caching/deduplication" pattern found anywhere in this report series — every other feature's version of this finding involved navigating between pages; this one doesn't even require that. Strongly suggests either (a) the connector-status check is duplicated across the page component, the sidebar's `FlatSidebarSlackConnector`, and possibly a third consumer, all independently fetching the same org-scoped status, or (b) a render-loop-adjacent re-fetch bug. Either way, this is a clean, cheap, high-confidence fix target — three redundant calls to the *same* endpoint in one page load is unambiguous, unlike the more debatable "should this really be cached across navigations" cases elsewhere in the series.

Not connected in the test account. A follow-up pass clicked "Connect Slack workspace" directly: it correctly opens an in-app **"Connect Souvenir to Slack"** confirmation dialog first — Slack's real branding, a clear, itemized permissions disclosure ("Establish a connection... Send scheduled summaries, notifications, and AI-generated content to channels... Read channel names and members for message routing and @mentions"), a privacy-policy/ToS consent line, and "Cancel"/"Accept and Connect" actions. This is good, transparent UX — scopes are disclosed before any OAuth redirect happens, not hidden behind a generic "Connect" button. The next leg (clicking "Accept and Connect" → actual Slack OAuth popup → callback) requires a real Slack workspace to complete and remains unverified, same category of gap as the Connectors report's OAuth handoff.

---

## 4. Lighthouse performance report

Same dev-mode caveat as the other eight reports.

| Metric | `/souvenir-slack` |
|---|---|
| **Performance score** | **40 / 100** |
| Accessibility score | 88 / 100 |
| Best Practices score | 92 / 100 |
| SEO score | 100 / 100 |
| First Contentful Paint | 1.1 s |
| Largest Contentful Paint | 57.1 s ⚠️ dev-mode artifact |
| Total Blocking Time | **2,100 ms** |
| Cumulative Layout Shift | 0.138 (needs improvement) |
| Speed Index | 4.1 s |
| Time to Interactive | 57.4 s ⚠️ dev-mode artifact |
| Server response time (root doc) | 70 ms |

Mid-pack — roughly tied with Brain/Tasks (39-43) and Connectors (37), notably better than Chats/Projects (15-30). TBT of 2.1s is real and, combined with the confirmed 3x redundant fetch in §3.2, is at least partly explained by that specific bug — this is one of the few features in the series where a single, concrete, already-identified cause plausibly accounts for a meaningful share of the TBT number, rather than TBT being a diffuse consequence of many small issues.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 3 files (774 LOC):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **46** | **10** |
| **Share of styling touchpoints** | **82.14%** | **17.86%** |

**New high for the series** — 17.86% Tailwind, surpassing Pinboard's previous high of 11.54%. Between Onboarding's 0.99% low and this feature's 17.86% high, the codebase's real-world Tailwind-adoption range now spans nearly 18 percentage points depending on feature — reinforcing the Pinboard report's conclusion that heavier Tailwind usage is an available, already-proven-out convention in this codebase, not a hypothetical.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**14 findings** (7 Performance, 1 Bugs, 2 Maintainability, 4 Accessibility; 7 errors / 7 warnings — an even 50/50 split, unique among the features audited). Smallest total count of any feature except Onboarding was comparable, but this feature packs its findings into **just 3 files**, giving it the **highest findings-per-file density of the entire series** (14/3 ≈ 4.7 per file, vs. e.g. Connectors' 39/12 ≈ 3.25).

### All findings (small enough to list in full)

| Category/Severity | Rule | Location | What it means |
|---|---|---|---|
| Accessibility/warning | `no-placeholder-only-field` | `page.tsx:192` | Field's only label is placeholder text |
| Accessibility/warning | `no-placeholder-only-field` | `page.tsx:251` | Same, second field |
| Maintainability/warning | `no-high-complexity-react-function` | `page.tsx:293` | High control-flow complexity |
| Maintainability/warning | `no-giant-component` | `page.tsx:293` | Too large to safely reason about — **the entire feature is one file, and that one file is already flagged giant** |
| Performance/error | `todo` (×6) | `page.tsx:356,370,401,430,447,463,467` | React Compiler blocked at 6 separate points in the same file |
| Bugs/warning | `no-loading-flag-reset-outside-finally` | `page.tsx:383` | Loading flag reset outside `finally` — same bug class flagged repeatedly across the series; plausibly related to the 3x-fetch bug in §3.2 if this loading flag governs the installation-status call |
| Accessibility/warning | `prefer-tag-over-role` | `page.tsx:553` | `role=` instead of a real HTML tag |
| Accessibility/warning | `html-no-nested-interactive` | `FlatSidebarSlackConnector/index.tsx:106` | Interactive control nested inside another focusable control — same bug class as the Projects report's 8-instance sidebar finding, confirming it's not isolated to that feature's sidebar components |

---

## 7. Backlog — prioritized

**P0 — performance, high-confidence, cheap**
1. **Fix the 3x redundant `GET .../slack/installation` call on a single page load.** This is the cleanest, most concrete, most cheaply-fixable finding in this entire report series — no ambiguity about whether caching-across-navigation is worth the complexity (the debate applicable to every other feature's version of this issue); this is the same data fetched three times in one render pass. Check `page.tsx` and `FlatSidebarSlackConnector/index.tsx` for independent fetch calls to the same endpoint and consolidate into one shared source (context, or lift the fetch up).
2. `page.tsx:383` — loading flag reset outside `finally`, plausibly the mechanism behind the 3x-fetch (an early-return or error path that skips resetting a "don't refetch" flag, causing a retry loop or duplicate calls on remount). Worth checking together with item 1.

**P1 — performance**
3. 6 React-Compiler-blocking findings, all in the feature's one file — clearing these is a single-file effort, unusually contained compared to every other feature's spread-across-many-files version of this finding.

**P2 — maintainability**
4. The entire feature being one ~774-line file already flagged both giant and high-complexity suggests it's a reasonable candidate for splitting into smaller pieces (e.g., separate "connect" and "channel mapping" sub-components) even though its total size is modest relative to other features' worst offenders.

**P3 — accessibility**
5. 2× placeholder-only-label fields, 1× role-instead-of-tag, 1× nested-interactive-control (same pattern as Projects' sidebar findings — worth fixing both together since they're the same component family, `FlatSidebar*`).

**Not verified — needs a connected test account**
6. The pre-OAuth confirmation dialog is now confirmed working and well-built (§3.2); the actual OAuth handoff and per-project channel-mapping flow past that point still need a real Slack workspace to verify, similar to the Connectors report's remaining gap.

---

## 8. Cross-feature pattern check (now 9 features in)

- `html-no-nested-interactive` on `FlatSidebar*` components — now confirmed in **2 features** (Projects' 8 instances, this feature's 1) — same component family, same bug, worth one shared fix.
- React-Compiler-blocking `todo` findings — present in **all 9** features audited, no exceptions.
- Tailwind composition range extended: **0.99% (Onboarding) to 17.86% (this feature)** — the new empirical bounds for the series.
- `no-loading-flag-reset-outside-finally` — recurring bug class (previously seen in the Chats and Agents reports' combined findings), here plausibly tied directly to a concrete, observed live bug (§3.2) rather than only a static-analysis abstraction — the clearest case yet of this specific rule mapping to a real, reproduced symptom.

---

## 9. Artifacts backing this report

Raw data (screenshot, Lighthouse JSON, network capture confirming the 3x redundant fetch, full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.
