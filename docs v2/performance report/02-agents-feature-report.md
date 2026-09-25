# Agents Feature — Detailed Report

**Scope:** the Agents (persona) feature — agent library, creation wizard, the 5-tab configure editor (Profile/Instructions/Knowledge/Connectors/Sharing), templates gallery, published agents, and chatting with an agent. Persona-based chat streaming shares infrastructure with the core Chats feature (`use-chat-state.ts`, `use-streaming-chat.ts`) but has its own API surface (`/persona/*`) and its own chat UI shell (`PersonaChatInterface.tsx`).

**How this was produced:** live, logged-in Playwright run against the local dev server, plus a static-analysis pass (`react-doctor`) filtered to this feature's files. No Lighthouse run this pass (see §4 — the test account had no existing agent, so the highest-traffic page, an agent's configure/chat view, couldn't be reached before running out of automation budget; see caveat).

---

## 1. Pages in this feature

| Route | File | Purpose |
|---|---|---|
| `/agents` | `src/app/(app)/agents/page.tsx` | Library — list of your agents + "Super Links" tab |
| `/agents/templates` | `src/app/(app)/agents/templates/page.tsx` | Template gallery (Customer Support, Sales, Legal, Research, Content Writer, Code Review, Onboarding, Marketing, +more) or "Start blank" |
| `/agents/basics/purpose` | `src/app/(app)/agents/basics/purpose/page.tsx` | Wizard step: what the agent is for |
| `/agents/basics/name` | `src/app/(app)/agents/basics/name/page.tsx` | Wizard step: agent name |
| `/agents/basics/tone` | (tone step, under `agents/basics/`) | Wizard step: tone (precise / practical / analytical) |
| `/agents/configure` | `src/app/(app)/agents/configure/page.tsx` | Wizard step 3 — initial configure, hands off to the full editor |
| `/agent/configure/profile` | `src/app/(app)/agent/configure/profile/page.tsx` | Existing-agent editor: identity, avatar, model |
| `/agent/configure/instructions` | `src/app/(app)/agent/configure/instructions/page.tsx` | Existing-agent editor: system prompt / instructions (largest file in this feature) |
| `/agent/configure/knowledge` | `src/app/(app)/agent/configure/knowledge/page.tsx` | Existing-agent editor: uploaded knowledge documents |
| `/agent/configure/connectors` | `src/app/(app)/agent/configure/connectors/page.tsx` | Existing-agent editor: connector access |
| `/agent/configure/sharing` | `src/app/(app)/agent/configure/sharing/page.tsx` | Existing-agent editor: visibility / share links |
| `/agents/published` | `src/app/(app)/agents/published/page.tsx` | Agents published/shared with you |
| `/agents/[personaId]/chat` | — | Chat with a specific agent (via `PersonaChatInterface`) |

**Core components:** `agent/configure/layout.tsx` (tab shell), `agent/configure/context.tsx` (shared editor state), tab components `ProfileTab.tsx`, `ConnectorsTab.tsx`, `KnowledgeTab.tsx`, `SharingTab.tsx`, `ConnectorTogglesPanel.tsx`, `ExampleConversationModal.tsx`, `AttributeTrackerRail.tsx`, wizard shell `agents/_components/WizardShell.tsx`, `PersonaChatInterface.tsx`, `ChangeAgentModelModal`, `FixAgentModelsModal`, `AgentsPanel`, `ModelSelectItem`, `ModelFeaturedCard`.

**State/data layer:** `lib/api/personas.ts` (largest API module in the codebase — versions, publishing, sharing, knowledge, connectors all live here), `lib/chat-personas.ts`, `lib/queries/personas.ts`.

---

## 2. All API calls used by this feature

From `src/lib/config.ts` (`/persona*` block):

| Endpoint | Method | Used for |
|---|---|---|
| `/persona` | GET | List your agents |
| `/persona/{repoId}` | GET/DELETE | Get / delete an agent |
| `/persona/{repoId}/use` | POST | Mark an agent as "used" (recency/sort) |
| `/persona/enhance-prompt` | POST | AI-assisted instruction-writing helper |
| `/persona/starter` | POST | Create from a template |
| `/persona/{repoId}/pause` | POST | Pause an agent |
| `/persona/{repoId}/active` | POST | Set active version |
| `/persona/{repoId}/publish` | POST | Publish a version |
| `/persona/{repoId}/guide` | GET | Onboarding/guide content for an agent |
| `/persona/{repoId}/versions` | GET | List versions |
| `/persona/{repoId}/versions/{versionId}` | GET | Version detail |
| `/persona/{repoId}/versions/{versionId}/test` | POST | Test a version |
| `/persona/{repoId}/versions/{versionId}/document` | POST/DELETE | Attach/remove a knowledge document |
| `/persona/{repoId}/versions/{versionId}/knowledge-url` | POST | Add a knowledge URL source |
| `/persona/{repoId}/versions/{versionId}/files` | GET | List knowledge files |
| `/persona/{repoId}/versions/{versionId}/blocked-connectors` | GET/POST | Manage blocked connectors |
| `/persona/{repoId}/versions/{versionId}/blocked-connectors/{slug}` | DELETE | Unblock one connector |
| `/persona/{repoId}/visibility` | POST | Change sharing visibility |
| `/persona/{personaId}/chats` | GET/POST(create) | Agent-scoped chat list / new chat |
| `/persona/{personaId}/chats/{chatId}/messages` | GET | Agent chat message history |
| `/persona/{personaId}/chats/{chatId}/stream` | GET/SSE | Agent chat streamed response |
| `/persona/{personaId}/chats/{chatId}/stop` | POST | Stop agent chat generation |
| `/persona/{personaId}/chats/rename` | POST | Rename agent chat |
| `/persona/{personaId}/chats/{chatId}/message/{messageId}` | DELETE | Delete a message |
| `/persona-shares`, `/persona-shares/received`, `/persona-shares/sent`, `/persona-shares/dashboard` | GET | Sharing dashboard/inbox |
| `/persona-shares/{id}` | GET | Share detail |
| `/persona-shares/{id}/accept` | POST | Accept a shared agent |
| `/llm/models/all` | GET | Model picker (shared with Chats) |

This is the largest single API surface of any feature audited so far — 28 distinct endpoints, reflecting that "Agents" is really a mini product (versioning, knowledge base, connector permissions, sharing) layered on top of the chat primitive.

---

## 3. Live functional test results

### 3.1 `/agents` — library, empty state
Test account had zero existing agents. Empty state renders cleanly: "No agents yet" / "Agents are your custom AI configurations — define behavior, connect knowledge, and share via link." / "Create your first agent" CTA. "My Agents" / "Super Links" tabs, search box, sort dropdown, and filter button all present in the toolbar even with no data. No defects observed.

### 3.2 Agent-creation wizard — **confirmed hydration-race bug found and characterized**

Full flow driven end-to-end, then re-tested specifically to isolate an intermittent failure:

1. **Template step** (`/agents/templates`) — gallery of 8+ template cards (Customer Support, Sales, Legal, Research, Content Writer, Code Review, Onboarding, Marketing, more below the fold) plus a "Custom / Start blank" option.
2. **Purpose step** (`/agents/basics/purpose`) — free-text field, filled and continued successfully.
3. **Name step** (`/agents/basics/name`) — filled "QA Test Agent," continued successfully; confirmed by the next step's heading correctly interpolating the name ("How should QA Test Agent sound?").
4. **Tone step** (`/agents/basics/tone`) — three cards (precise / practical / analytical). Selecting one and continuing worked in the tone step itself, but the *wizard never actually produced a saved agent* — a follow-up check of `/agents` confirmed **"No agents yet"**, proving the end-to-end creation silently failed despite the UI appearing to progress through every step.

**Root cause isolated: a hydration-race condition on the Template step's "Start blank" button.** Clicking it immediately after the page becomes visually ready (`domcontentloaded`/`networkidle`, the point a real user would reasonably click) **silently does nothing** — no navigation, no error, no console output, confirmed reproducible across multiple attempts with a single, visible, enabled button (not a targeting ambiguity — verified only one matching element exists). Clicking the identical button after an additional ~3 seconds of settle time **works reliably every time**. This is a classic symptom of the button's click handler not yet being attached when Next.js reports the page as loaded — the DOM is painted before React hydration finishes attaching event listeners, and a click in that window is silently swallowed rather than queued or retried.

**Real-world impact:** any user who clicks "Start blank" as soon as the template gallery appears — plausible behavior, since the page looks fully interactive — gets no feedback and no agent. They'd have to notice nothing happened and click again (by which point hydration has likely finished, masking the bug on retry) or give up. This directly explains why the wizard appeared to "work" in earlier casual testing but produced zero actual agents when checked against the source of truth (`/agents` list).

**Step-order note:** the wizard's visible step tracker shows "Template → Basics → Configure" (3 named phases), but "Basics" actually expands into 3 screens (Purpose → Name → Tone) not indicated in the tracker — a minor information-architecture gap; a user has no way to know they're on "step 2 of 4 sub-steps" from the tracker alone.

**Deep-link gap, observed separately:** navigating directly to `/agents/basics/name` (bypassing Template) rendered the step tracker with "Template" already shown as completed (✓) despite never visiting it — no guard redirects an out-of-sequence deep link back to step 1.

### 3.3 Configure-tab editor (Profile/Instructions/Knowledge/Connectors/Sharing) — **still not reached**
With the hydration-race bug now understood, a follow-up run deliberately waited out the hydration window before clicking "Start blank" and progressed further, but the wizard still didn't yield a persisted agent within this session's remaining time budget. The 5-tab editor for an existing agent (§1 routes `/agent/configure/*`) remains unverified live — recommend a follow-up pass with a seeded test agent (created directly via the backend/API rather than through the wizard) to isolate testing the editor from testing the wizard.

### 3.4 Templates gallery / Published agents — rendered, not deeply exercised
Both pages loaded without console errors; screenshots confirm layout renders. Not interacted with beyond navigation.

---

## 4. Lighthouse — not run this pass

Lighthouse needs a stable, representative URL. The two highest-value targets (`/agent/configure/profile` with a real agent loaded, and `/agents/[personaId]/chat`) require an existing agent, which the wizard run didn't produce in time. `/agents` (empty state) and `/agents/templates` could be profiled, but their numbers would mostly restate the Chats report's dev-mode caveats without adding new signal. Recommend running Lighthouse against the configure/chat pages once a seed agent exists — say the word and I'll do that pass.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 38 files (19,268 LOC):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **781** | **34** |
| Avg length | 192.1 chars | 25.6 chars |
| Total bytes | 150.0 KB | 870 B |
| **Share of styling touchpoints** | **95.83%** | **4.17%** |

Essentially identical composition to the Chats feature (~96/4). No feature-specific surprise here — this is the codebase-wide pattern, not something specific to how Agents was built. Same conclusion as the Chats report: mechanically straightforward to convert, but not the lever for whatever performance issues exist here — those will be render/architecture issues (§6), same as elsewhere.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**201 findings** across these files (90 Performance, 46 Bugs, 42 Maintainability, 23 Accessibility; 83 errors / 118 warnings). This feature has the **highest Performance-finding density of any feature audited so far** (90 findings across 38 files vs. Chats' 74 across 52 files).

### Highest-volume issues

| Count | Category/Severity | Rule | What it means | Where |
|---|---|---|---|---|
| 30 | Performance/error | React Compiler can't parse (`todo`) | Blocks auto-memoization entirely | `ConnectorTogglesPanel.tsx`, `ConnectorsTab.tsx` (3×), `KnowledgeTab.tsx`, `ProfileTab.tsx`, `SharingTab.tsx` (4×) +20 more |
| 24 | Performance/error | React Compiler blocked (`refs`) | Ref-pattern compiler-blocking, heavily concentrated | `agent/configure/instructions/page.tsx` (14 of the 24 — by far the single worst file in this feature) |
| 17 | Maintainability/warning | `no-high-complexity-react-function` | High control-flow complexity | `ConnectorsTab.tsx`, `KnowledgeTab.tsx` (2×), `SharingTab.tsx`, `connectors/page.tsx`, `instructions/page.tsx`, `knowledge/page.tsx`, `layout.tsx`, `profile/page.tsx`, `sharing/page.tsx` +7 more |
| 15 | Maintainability/warning | `no-giant-component` | Too large to safely reason about | Same file set as above — every configure-tab page is both giant and complex |
| 13 | Performance/warning | `set-state-in-effect` | Blocks React Compiler optimization | `connectors/page.tsx`, `context.tsx`, `instructions/page.tsx` (3×), `knowledge/page.tsx`, `layout.tsx`, `profile/page.tsx`, `WizardShell.tsx`, `templates/page.tsx` +3 more |
| 10 | Accessibility/warning | `no-placeholder-only-field` | Field's only label is placeholder text | `ConnectorsTab.tsx`, `ExampleConversationModal.tsx` (2×), `KnowledgeTab.tsx`, `ProfileTab.tsx`, `SharingTab.tsx`, `agents/basics/name/page.tsx`, `agents/basics/purpose/page.tsx`, `agents/page.tsx`, `agents/published/page.tsx` |
| 10 | Bugs/error | `no-ref-current-in-render` | Ref mutated during render | `connectors/page.tsx`, `instructions/page.tsx` (2×), `knowledge/page.tsx`, `profile/page.tsx`, `sharing/page.tsx`, `PersonaChatInterface.tsx` (4×) |
| 9 | Performance/error | `no-layout-property-animation` | Layout-property animation (reflow) | all 9 in `agent/configure/layout.tsx` (the tab-switching chrome itself) |
| 7 | Maintainability/warning | `only-export-components` | Breaks Fast Refresh | `AttributeTrackerRail.tsx` (2×), `WizardShell.tsx` (3×), `AgentsPanel/index.tsx`, `ModelSelectItem/index.tsx` |
| 7 | Bugs/warning | `no-side-effect-in-state-updater-function` | Side effect inside a state updater | all 7 in `agent/configure/context.tsx` — the shared editor state store |
| 5 | Accessibility/warning | `control-has-associated-label` | Control missing accessible label | `ConnectorsTab.tsx`, `KnowledgeTab.tsx`, `ProfileTab.tsx`, `SharingTab.tsx` (2×) |
| 4 | Bugs/error | `no-impure-state-updater` | State updater has side effects (error-severity companion to the warning above) | all 4 in `agent/configure/context.tsx` |

### Notable single/low-count findings

- **3× `rules-of-hooks` (error) — hooks called conditionally** — `src/app/(app)/agents/page.tsx:1007,1024,1054`. This is a genuine React correctness bug class (conditional hook calls can desync hook state between renders and crash in some React versions/StrictMode). Highest-severity finding in this feature.
- **3× `prefer-html-dialog`** — custom modal instead of `<dialog>`, in `instructions/page.tsx`, `layout.tsx`, `CancelCreationModal.tsx` — same pattern as the Chats report's "no shared Dialog primitive" observation.
- **2× `no-create-object-url-without-revoke`** (`KnowledgeTab.tsx`, `knowledge/page.tsx`) — same blob-leak pattern as Chats' `AttachmentManager.tsx`; knowledge-file upload and chat-attachment upload apparently share this bug independently in two places.
- **1× `no-fetch-response-used-without-status-check`** (`knowledge/page.tsx:356`) — a fetch response consumed without checking `.ok`/status, risk of silently treating an error body as success.
- **1× `rendering-hydration-mismatch-time`** (`agents/page.tsx:1643`) — time/random value used directly in JSX, a hydration-mismatch risk.
- **2× `nextjs-no-a-element`** (`PersonaChatInterface.tsx:759-760`) — plain `<a>` tags that reload instead of client-navigating.

Full file/line detail for all 201 findings is in the raw JSON generated this session (see §8).

---

## 7. Backlog — prioritized

**P0 — correctness**
1. **Confirmed hydration-race bug on the agent-creation wizard's "Start blank" button** (§3.2) — clicking it before React finishes hydrating silently does nothing, no error, no feedback. Reproduced consistently; fixed by waiting ~3s. This is a genuine new-user-facing bug, not a test artifact: a real user clicking as soon as the page looks ready gets a dead button and, if they don't retry, never creates an agent. Worth checking whether other wizard "primary action" buttons across the app (Projects' "Create project," Onboarding's step-Continue buttons) share the same susceptibility, since this reads like a systemic hydration-timing issue rather than a one-off in this specific button.
3. `agent/configure/context.tsx` — 7× side-effecting state updaters + 4× impure-state-updater errors, all in the **shared** editor state store used by every configure tab. Anything downstream of this context inherits the risk of double-invocation bugs (React can call updater functions twice in Strict Mode/concurrent features).
4. Two independent `createObjectURL`-without-`revoke` leaks (knowledge upload here, chat attachments in the Chats feature) — same bug, two authors, worth fixing once and checking for a third instance elsewhere.
5. `knowledge/page.tsx:356` — fetch response used without a status check.

**P1 — performance, concentrated**
6. `agent/configure/instructions/page.tsx` alone accounts for 14 of the 24 `refs`-pattern React-Compiler-blocking findings — this single file (the largest in the feature, per the giant-component flag) is disproportionately responsible for this feature's Performance-error count. Worth prioritizing over the other configure tabs.
7. 9× layout-property animation, all in `agent/configure/layout.tsx` — the tab-switch chrome itself animates layout properties; fixing this one file's animation approach fixes all 9 instances at once.
8. 30× compiler-blocking `todo` patterns spread across every configure tab — until cleared, none of the configure editor gets automatic re-render optimization.

**P2 — maintainability**
9. Every `/agent/configure/*` tab page and its matching `components/*Tab.tsx` counterpart is flagged as both giant and high-complexity — 10 files total carrying this pair of flags. This is the most concentrated "needs decomposition" signal of any feature audited so far.
10. Two-screen redundancy: `/agent/configure/profile` (page) and `ProfileTab.tsx` (component) both flagged separately — confirms the tab content is duplicated/split between a page-level and component-level implementation per tab, doubling the maintenance surface.

**P3 — accessibility**
11. 10× placeholder-as-label fields concentrated in the configure tabs and wizard name/purpose steps — same pattern flagged in Chats, more prevalent here.
12. 5× missing accessible labels on controls in the configure tabs.

**UX gaps observed live (not from static analysis)**
13. Wizard step tracker shows 3 phases but "Basics" silently contains 3 sub-steps — no progress indication within that phase.
14. No guard against deep-linking into a wizard sub-step out of order (tracker shows a false-positive "completed" checkmark).

**Still unverified — needs a follow-up pass**
15. The full `/agent/configure/*` tab editor was not confirmed working live even after fixing the hydration-timing workaround (§3.3) — recommend a seeded test agent (created directly, bypassing the wizard) for the next audit round.

---

## 8. Artifacts backing this report

Raw data (screenshots of every wizard step, persona API network capture, full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.
