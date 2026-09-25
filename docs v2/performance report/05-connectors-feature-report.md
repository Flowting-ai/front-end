# Connectors Feature — Detailed Report

**Scope:** the third-party integration catalog — browsing, connecting, and managing tool connectors (CRMs, marketing tools, Slack, etc.) that agents and chats can use. Single-page app surface backed by a large catalog and an OAuth-style linking flow.

**How this was produced:** live, logged-in Playwright run against the local dev server, Lighthouse against the same authenticated session, and a static-analysis pass (`react-doctor`) filtered to this feature's files.

---

## 1. Pages in this feature

| Route | File | Purpose |
|---|---|---|
| `/connectors` | `src/app/(app)/connectors/page.tsx` | The entire feature — single page, tabbed (All / Connected / Not connected), searchable catalog grid |

Unlike every other feature audited so far, Connectors has **no sub-routes** — everything (browsing, connecting, account management, removal) happens via modals/panels layered over this one page (`ConnectorDetailView`, `AccountDetailView`, `SetupModal`, `RemoveModal`, `ConnectionsView`), orchestrated by `ConnectorsExperience.tsx`.

**Core components:** `ConnectorsExperience.tsx` (orchestrator), `ConnectorDetailView.tsx`, `AccountDetailView.tsx`, `ConnectionsView.tsx`, `SetupModal.tsx`, `RemoveModal.tsx`, plus catalog-card components `ConnectorCard/`, `ConnectorRow/`, `ConnectorRequestRow/`, `ConnectorRequestModal/` (the last two for requesting a connector that doesn't exist yet in the catalog).

**State/data layer:** `lib/useConnectorSetupFlow.ts` (drives the OAuth-style connect flow, including a `window.open` call — see §6 security note).

---

## 2. All API calls used by this feature

From `src/lib/config.ts` (`/connectors` block):

| Endpoint | Method | Used for |
|---|---|---|
| `/connectors` | GET | Catalog list — confirmed live with real query params: `?limit=100&linked=true` (Connected tab) and `?limit=10&linked=false` (catalog browse) |
| `/connectors/{slug}` | GET | Single connector detail |
| `/connectors/{slug}/link` | POST | Start the OAuth-style link flow |
| `/connectors/{slug}/complete` | POST | Complete linking after the OAuth redirect returns |
| `/connectors/accounts/{accountId}` | GET | Linked account detail (`AccountDetailView`) |

Smallest, simplest API surface of any feature audited so far — five endpoints, no versioning, no nested CRUD tree like Agents' `/persona/*` or Projects' `/projects/*`.

---

## 3. Live functional test results

### 3.1 `/connectors` — catalog, populated
Renders cleanly with a real, large third-party catalog: OCodeKit, 1CRM, 2Chat, 2markdown, 302.AI, 360NRS, 46elks, 4Dem, 8x8 Connect, Descript, and more, each with icon, name, one-line description, and a "+" connect affordance. Tabs (All / Connected / Not connected), search box, and a sort toggle all present and functional-looking. No visual defects.

**Confirmed via live network capture:** the page correctly issues two separate calls with different `linked=` query params — one for the "Connected" count/tab, one for the general catalog — rather than fetching everything and filtering client-side. This is a good, deliberate pattern, worth noting as a positive data point rather than only cataloguing problems.

**Recurring backend flakiness, again:** a live 502 was captured during this pass (same `devapi.getsouvenir.com` intermittent-timeout pattern documented in the Chats and Projects reports) — this is now confirmed across **four of the five** features audited (Chats, Brain/Tasks indirectly via `/brain`, Projects, Connectors), reinforcing that this is backend/infra-wide, not feature-specific.

### 3.2 Card interaction — **confirmed working, retested**
A follow-up pass targeted the "+" affordance specifically (rather than the card body, which the first attempt clicked): it correctly opens `SetupModal` — "Connect Ocodekit," an optional account-name field, and a clear "Who can use it?" choice between Shared and Private visibility, with "You can change this later from the account's Access tab" reassurance copy. Clean, well-designed, no defects. A follow-up click on "Continue to Ocodekit" was attempted to verify the OAuth-popup handoff itself, but that second click didn't land reliably within this pass (the modal isn't guaranteed to be in the same state across separate script runs) — the OAuth-popup leg specifically (and therefore whether the `window.open`-without-`noopener` finding in `useConnectorSetupFlow.ts` manifests as an exploitable issue in practice, versus just being present in the source) remains unverified. The setup-modal entry point itself, previously flagged inconclusive, is now confirmed working.

---

## 4. Lighthouse performance report

Same dev-mode caveat as the other four reports.

| Metric | `/connectors` |
|---|---|
| **Performance score** | **37 / 100** |
| Accessibility score | 84 / 100 |
| Best Practices score | 92 / 100 |
| SEO score | 100 / 100 |
| First Contentful Paint | 1.1 s |
| Largest Contentful Paint | 56.9 s ⚠️ dev-mode artifact |
| Total Blocking Time | **1,950 ms** |
| Cumulative Layout Shift | 0.138 (needs improvement) |
| Speed Index | 5.8 s |
| Time to Interactive | 58.0 s ⚠️ dev-mode artifact |
| Server response time (root doc) | 70 ms |

Mid-pack relative to the other four features — meaningfully better than Chats (19) and Projects (15-19), worse than Brain/Tasks (39-43). Server response time of 70ms is excellent — the best root-document time recorded in this whole audit series, notably contrasting with Projects' 5,370ms on a structurally similar single-page layout.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 12 files (2,865 LOC — the smallest feature by far):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **160** | **5** |
| **Share of styling touchpoints** | **96.97%** | **3.03%** |

Consistent with all four prior reports — no new information here; confirms the codebase-wide ~97/3 ratio holds even in the smallest feature examined.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**39 findings** (18 Performance, 5 Bugs, 5 Maintainability, 10 Accessibility, 1 Security; 9 errors / 30 warnings). Smallest total finding count of any feature, proportionate to its small file footprint — but the *density* (39 findings / 2,865 LOC ≈ 1 per 73 lines) is actually higher than Chats (231/21,576 ≈ 1 per 93) or Projects (85/7,522 ≈ 1 per 88), making this the **most finding-dense feature per line of code** audited so far.

### Highest-volume issues

| Count | Category/Severity | Rule | What it means | Where |
|---|---|---|---|---|
| 6 | Performance/error | React Compiler can't parse (`todo`) | Blocks auto-memoization | `AccountDetailView.tsx` (4×), `ConnectorsExperience.tsx` (2×) |
| 5 | Maintainability/warning | `no-high-complexity-react-function` | High control-flow complexity | `ConnectorCard/index.tsx`, `ConnectorRow/index.tsx`, `ConnectionsView.tsx`, `ConnectorsExperience.tsx`, `SetupModal.tsx` |
| 5 | Performance/warning | `set-state-in-effect` | Blocks React Compiler optimization | `AccountDetailView.tsx`, `ConnectionsView.tsx` (2×), `ConnectorsExperience.tsx` (2×) |
| 4 | Accessibility/warning | `label-has-associated-control` | Label missing associated control | all 4 in `ConnectorRequestModal/index.tsx` |
| 3 | Performance/warning | `use-lazy-motion` | Full Framer Motion import | `ConnectorCard`, `ConnectorRequestRow`, `ConnectorRow` |
| 3 | Performance/error | `no-layout-property-animation` | Layout-property animation | all 3 in `ConnectorRow/index.tsx:373-375` |

### Notable single findings

- **1× `no-derived-useState` × 2** (`AccountDetailView.tsx:413`, `ConnectionsView.tsx:192`) — same recurring props-into-state anti-pattern flagged in every prior report.
- **2× `prefer-html-dialog`** (`RemoveModal.tsx`, `SetupModal.tsx`) — same no-shared-Dialog-primitive pattern flagged repeatedly since the Chats report.
- **1× `nextjs-no-use-search-params-without-suspense`** (`connectors/page.tsx:15`) — a real Next.js correctness issue: `useSearchParams()` outside a `<Suspense>` boundary can break static rendering/cause a full-page client-render fallback.
- **1× `nextjs-no-client-side-redirect`** (`ConnectorsExperience.tsx:77`).
- **1× `window.open` without `noopener`** (`useConnectorSetupFlow.ts:110`, **Security**) — this is the connector OAuth-popup flow specifically; a reverse-tabnabbing risk on the exact code path that opens a third-party OAuth page, which is a more sensitive context for this bug class than the similar findings in the Chats report (`ConnectorPrompts.tsx:179`) since it's opening authentication flows to external services, not just external links.

Full file/line detail for all 39 findings is in the raw JSON generated this session (see §8).

---

## 7. Backlog — prioritized

**P0 — correctness/security**
1. `useConnectorSetupFlow.ts:110` — `window.open` without `noopener` on the OAuth-linking popup specifically. This is the second instance of this exact bug class found (first was Chats' `ConnectorPrompts.tsx`), but this one opens an actual authentication flow, raising the stakes slightly above the Chats instance.
2. `connectors/page.tsx:15` — `useSearchParams()` without a Suspense boundary; real Next.js correctness issue, not just a lint nit.
3. `SetupModal` itself is now confirmed working (§3.2); the remaining unverified leg is specifically the OAuth-popup handoff and `/connectors/{slug}/complete` callback — worth a follow-up with a real third-party OAuth target to close out.

**P1 — performance**
4. 6× React-Compiler-blocking findings concentrated in `AccountDetailView.tsx` (4 of 6) — the single file most responsible for this feature's Performance-error count, similar to how one file dominated in each prior report.
5. 3× layout-property animation, all three in the same three consecutive lines of `ConnectorRow/index.tsx` — a single, cheap fix (one animated property, one component) clears this feature's entire layout-animation finding count.
6. 3× uncontrolled Framer Motion imports, matching the pattern in every other feature's list-row components.

**P2 — maintainability**
7. `ConnectorCard`, `ConnectorRow`, `ConnectionsView`, `ConnectorsExperience`, and `SetupModal` are all flagged high-complexity — five files out of twelve, the highest *proportion* of complexity findings of any feature examined (5/12 ≈ 42% of this feature's files, vs. e.g. Projects' 7/16 ≈ 44% — comparable, both notably higher than Chats' or Agents' proportions).

**P3 — accessibility**
8. 4× label-association gaps concentrated entirely in `ConnectorRequestModal.tsx` — the "request a missing connector" form. One component, one fix, clears the finding.
9. Same `prefer-html-dialog` gap as three other features — reinforces the case for a shared Dialog primitive as a codebase-wide fix rather than five separate patches.

---

## 8. Cross-feature pattern check (now 5 features in)

Patterns confirmed independently across **all five** features (Chats, Agents, Brain/Tasks, Projects, Connectors):
- ~96-97% inline-style / ~3-4% Tailwind (now conclusively a codebase constant — no further per-feature measurement planned).
- Array-index/props-into-state/giant-component/uncontrolled-Framer-Motion/no-shared-Dialog patterns, each independently reappearing.
- Backend 502s from the same intermittent `devapi.getsouvenir.com` timeout — now observed in 4 of 5 features tested, essentially confirming it's a standing environment condition, not a per-feature fluke.

**New this report:** the `window.open`-without-`noopener` finding has now appeared **twice**, both times on flows that open third-party windows (a connector prompt in Chats, and the actual OAuth linking flow here) — this specific pattern is worth a codebase-wide grep for every `window.open(` call rather than treating each occurrence as independent, since the fix (`, 'noopener'` in the third arg, or `rel="noopener"` on an anchor equivalent) is identical everywhere.

---

## 9. Artifacts backing this report

Raw data (screenshots, Lighthouse JSON, network captures, full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.
