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

---

## 9. Fixes applied (post-report follow-up)

Everything below was implemented in a later session, working through the `02b-agents-before-scan.md` backlog (which itself re-verified and, in places, revised this report's own §7 backlog against live production code) phase by phase, using the same verification gate at every checkpoint: `npx tsc --noEmit` (clean throughout), the full `vitest` suite (277 tests, passing at every single checkpoint below — zero regressions at any point), and live Playwright testing against a real production build (`npm run build --webpack` + `npm run start`, fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`) wherever the fix's own reachability allowed it. Unlike the Projects engagement's fix pass, `react-doctor` was **not** blocked in this environment this session — every finding cited below (including exact current line numbers) is live tool output, cross-checked by hand against the actual file, not a first-principles re-derivation.

A from-scratch production Lighthouse baseline was run before any of this work started — see `02b-agents-before-scan.md` — following the same methodology the Chats and Projects engagements established. That baseline surfaced its own methodology finding worth restating here: this session's Lighthouse setup (a Playwright-launched, CDP-attached, persistently-authenticated Chromium, needed because there's no clean way to get Lighthouse's own chrome-launcher to inherit an Auth0-hosted login session) makes LCP and Time-to-Interactive unreliable — both report ~45-50s on every page including an unrelated cross-check page (`/chat`), while the same trace's own *observed* data (`lcp-breakdown-insight`) shows the real LCP landing in ~550ms. TBT/CLS/FCP/Speed-Index/server-response-time/byte-weight are unaffected (all observed-trace metrics) and are what this whole engagement's Lighthouse conclusions are actually based on — see `02b` §4.1 for the full trace.

### Phase 1 — P0 correctness

1. **3× `rules-of-hooks`, `agents/page.tsx:1007,1024,1054` — investigated, found to be a naming false positive, fixed by rename.** All three call sites invoke `usePersonaRepoDeduped` (and, one level down, `usePersonaRepo`) — plain `async function`s in `lib/api/personas.ts` that POST `/persona/{repoId}/use` to copy a persona into the caller's account. Neither is a React hook; `eslint-plugin-react-hooks`' `rules-of-hooks` rule flags *any* `use[A-Z]…`-named identifier called conditionally, regardless of whether it's actually a hook, and all three real call sites are — correctly — inside `try` blocks in async click handlers (`handleCopyAndEdit`, `handleUseTeamSharedInChat`, `handleUseReceivedShareInChat`). This was already a known nuisance: `hooks/use-persona-repos.ts` carried a defensive comment warning future readers about the naming collision before this fix existed. **Fixed by renaming, not suppressing** — `usePersonaRepo` → `copyPersonaRepo`, `usePersonaRepoDeduped` → `copyPersonaRepoDeduped`, across `lib/api/personas.ts`, `lib/chat-personas.ts`, and `agents/page.tsx` (4 call sites + a doc comment). This both resolves the lint false positive and removes a genuinely confusing name (a non-hook function that looked like one) — a real clarity improvement, not just noise suppression.
2. **`agent/configure/context.tsx` — 7× side-effect-in-state-updater + 4× impure-state-updater — fixed, all 4 locations.** Precisely 4 functions were responsible for all 11 findings (not spread evenly across the file): `toggleTestChat`, `toggleAiSuggest`, `toggleVersions` each called *other* state setters from inside their own `setState` updater callback (e.g. `setTestChatOpen(prev => { const next = !prev; if (next) { setAiSuggestOpen(false); ... }; return next })`) — a side effect (and, since it reads/writes sibling state, an impure computation) inside a function React may invoke more than once per commit under Strict Mode/concurrent rendering. Fixed by reading the current boolean directly (all three are plain `useState` values already in scope, now added to each callback's dependency array) and moving the sibling-closing calls into the callback body, not the updater. `addPendingChangeTag` wrote `pendingChangeTagsRef.current = next` from inside `_setPendingChangeTags`'s updater — fixed by introducing a mirror `useEffect(() => { pendingChangeTagsRef.current = pendingChangeTags }, [pendingChangeTags])`, matching the exact "ref mirrors state via effect" idiom already used elsewhere in this same file (`publishedVersionIdRef`, `guideHistoryRef`) — the updater itself is now a one-line pure function. **Confirmed nothing else in the file's ~30 other functional updaters needed the same fix** — e.g. `markFieldTouched`/`resetTouchedFields` call `.add()`/`.delete()` on a *freshly constructed* `new Set(prev[tab])`, never mutate `prev` itself, and react-doctor did not flag them; verified by hand this reasoning is correct, not just trusting the tool's silence.
3. **The hydration-race "Start blank" bug — root-caused with real reproduction data, fixed with a scoped, honest mitigation.** `02b-agents-before-scan.md` §1 has the full trace: unthrottled, the race is real but too narrow to reproduce reliably (0/5 attempts); CPU-throttled at 6x, it reproduces 3/8 times, with the two earliest-observed clicks (found at 1.2ms and 1.6ms — essentially the instant the static HTML paints, before client JS has plausibly run) both failing to navigate. The mechanism: `CustomCard`/`TemplateCard` in `agents/templates/page.tsx` are ordinary client-rendered `<button onClick>` elements with no special hydration handling — a click landing before `hydrateRoot()` finishes attaching the listener is silently lost, not queued or replayed. **This is a genuine framework-timing limitation that cannot be eliminated at this layer** (no amount of application code can make a listener exist before the JS that defines it has executed) — so the fix implemented is the standard, honest mitigation: both cards now start `disabled` (a `useState(false)` flipped to `true` only inside a `useEffect`, so the very first — server/static-rendered — paint has the *native* HTML `disabled` attribute on the button, before any client JS has run at all). A native `disabled` button never dispatches `click` regardless of whether a listener is attached yet, so a click landing anywhere in the pre-hydration window is now **visibly inert** (dimmed, default cursor) instead of silently absorbed. On a normal machine the disabled→enabled flip resolves in well under one frame and is imperceptible; it only matters on the slow/throttled devices where the race was reproducible. **Not claimed as eliminating the underlying race** — only as converting an invisible trap into a visible, self-explanatory loading state, which is the honest ceiling of what's fixable in application code for this class of bug.
4. **2× `no-create-object-url-without-revoke` — both fixed, with a nuance.** `KnowledgeTab.tsx`'s instance sits in a "local-state-only fallback" path (`if (onRawFilesSelected) { ...; return }`) that the feature's one real call site never takes (it always passes `onRawFilesSelected`) — confirmed dead code today, fixed anyway for defensive correctness (a `fallbackBlobUrlsRef` tracks every URL created there, revoked on unmount). `knowledge/page.tsx`'s instance (`fileUrlMapRef`, one blob URL per uploaded file, kept for inline preview) **was live and real** — fixed two ways: revoke + remove from the map when a file is explicitly deleted (`handleDeleteFile`), and revoke everything still tracked when the Knowledge tab unmounts.
5. **`knowledge/page.tsx:356` fetch-without-status-check — fixed.** Added `if (!res.ok) throw new Error(...)` before consuming the response body in `handlePreviewFile`'s remote-URL branch, so an error response (e.g. an expired/404 file URL) surfaces the existing `catch` block's "Preview not available" toast instead of silently trying to render a non-file blob.

### Phase 2 — P1 performance: the `instructions/page.tsx` `refs` cluster

6. **16 of the file's 20 `refs` findings, root-caused to one dominant cause, fixed at the root rather than patched 16 times.** `savedSnapshotRef.current` (the last-saved instruction/model/temperature) was read directly in the render body to compute `isDirty` — a value that must itself be render-reactive (it gates the Save/Publish buttons and the tab traffic-light dots). Reading a ref's `.current` during render is unsafe under concurrent rendering (the ref can mutate between render and commit, or read inconsistently across a Strict-Mode double-render) and is exactly what the compiler's `refs` diagnostic exists to catch — the taint then propagates through every effect and derived value downstream of `isDirty` (`needsRepublish`, `canSave`, `canPublish`, three separate `useEffect`s), accounting for the bulk of the 16. **Fixed with a small "version counter" pattern that keeps `savedSnapshotRef` a ref (used correctly everywhere else in the file — always read inside effects/handlers, never render) while making `isDirty` genuinely render-reactive:** a `snapshotVersion` state ticks up at each of the 6 `savedSnapshotRef.current = {...}` write sites (a one-line addition at each), and `isDirty` becomes `useState` + a `useEffect` that recomputes it from `savedSnapshotRef.current` whenever `[instruction, currentModelId, temperature, snapshotVersion]` change — covering both "the editable fields changed" and "the saved baseline itself moved" (e.g. right after a Save, where the editable fields *don't* change but the snapshot does). This introduces one render-tick of lag between a save/restore and `isDirty` reflecting it — imperceptible in practice, and the same accepted trade-off this whole audit series' "adjust state during render"-style fixes have made elsewhere (see e.g. `../projects/04-projects-feature-report.md` §10 Phase 3).
7. **The remaining 2 of the file's 6 `no-ref-current-in-render` findings — fixed.** `instructionAutoSaveRef.current = async () => {...}` and `instructionContinueRef.current = () => {...}` were assigned directly in the render body — mutating a ref during render, the write-side twin of the read-side issue above. Wrapped both in a deps-less `useEffect`, mirroring the `handlePublishRef` pattern already established earlier in this exact file — the ref still ends up pointing at a closure over the latest render's values, but the mutation itself now happens post-commit.
8. **The same ref-write-during-render pattern, 1 instance each in `connectors/page.tsx`, `knowledge/page.tsx`, `profile/page.tsx`, `sharing/page.tsx` — fixed identically.** Each configure tab has its own `xAutoSaveRef.current = async () => {...}` assigned directly in the render body; each wrapped in the same deps-less `useEffect`. Mechanical, identical fix across 4 files, zero logic changes.

### Phase 3 — P1 performance: layout-property animations

9. **9× `no-layout-property-animation`, `agent/configure/layout.tsx` (Versions/Test-chat/AI-suggestions panels) — a real runtime fix applied, with an honest note on what it does and doesn't resolve.** All 3 panels are Framer Motion `<m.div>`s animating `width` (0 → 400/448px) as part of a flex row — a genuine reflow-per-frame cost, and unlike a simple decorative element, the width change here is load-bearing: sibling content needs to visibly reflow as the panel opens, which rules out a naive `transform: scaleX` swap (scaling doesn't participate in layout, so siblings wouldn't move until the animation finished). The tool's own suggestion text names the actual fix: **added the `layout` prop to all 3 `<m.div>`s** (the app's `LazyMotion` bundle is already `domMax`, which includes layout-animation support) — this is Framer Motion's documented mechanism for animating layout changes via a FLIP-computed `transform` instead of a raw per-frame CSS property mutation, while still visually reflowing siblings correctly. **Honestly: the static finding count is unchanged after this fix** — react-doctor's `no-layout-property-animation` rule pattern-matches for a `width`/`height`/`top`/`left` key inside `animate`/`initial`/`exit`, and doesn't (can't, from static analysis alone) know that a sibling `layout` prop changes the runtime strategy Framer actually uses. This is the same category of "the tool doesn't see the real fix" finding as this whole audit series has hit before (Lighthouse's missing `nested-interactive` audit in the Projects report, dev-mode Lighthouse artifacts throughout) — the runtime behavior is genuinely improved, the static count just can't reflect it. Live-verified the 3 panels still open/close smoothly with no content distortion.

### Phase 4 — P1 performance: the `todo` compiler-blocking findings — investigated, confirmed a tool limitation, not fixed

10. **27 findings (`react-hooks-js/todo`) — investigated in depth, confirmed a genuine React Compiler parser gap, not a bug, and deliberately not force-fixed.** Pulled the tool's own per-finding diagnostic detail (not visible in the summary table): **all 27** carry the identical suggestion `Todo: (BuildHIR::lowerStatement) Handle TryStatement with a finalizer ('finally') clause` — the version of the React Compiler this tool bundles cannot yet parse `try { } finally { }` blocks inside component/hook bodies at all, regardless of what's inside them. `try/finally` is completely idiomatic, safe JavaScript — the standard "always run this cleanup, success or failure" pattern (e.g. `try { setLoading(true); await save() } finally { setLoading(false) }`, used throughout every configure tab's save/publish handlers). Rewriting 27 of these to dodge a compiler parser limitation would mean either duplicating cleanup logic across every success/catch branch (strictly worse, more error-prone code) or dropping the safety-net cleanup entirely (a real regression — a thrown error would then leave `isSaving`/`isPublishing` stuck `true` forever). **Deliberately left as-is** — this is the same honesty standard this whole engagement has applied to every "the tool flags correct code" finding (e.g. the Projects report's Sidebar-link-click investigation, or `01c-chats-before-after-comparison.md`'s dev-mode-artifact write-ups): documented and explained, not force-changed.

### Phase 5 — P2 maintainability: cross-file duplication check

11. **Checked 6 candidate components for unnoticed duplication elsewhere in the codebase** (the same kind of check that found `MentionChip`/`TemplateCard` duplicated 2-3× during the Projects engagement's own decomposition phase). 5 of 6 checked out as genuine, non-duplicate code: `ConnectorTogglesPanel` and `ExampleConversationModal` have no twin anywhere; `AttributeTrackerRail`/`AttributeTocRail` deliberately mirrors `ModelSelectItem`'s visual language for design consistency but is a functionally distinct component (TOC navigation + touched-field dots, not a model picker); `ModelSelectItem` is already correctly shared (imported from `@/components/ModelSelectItem`) and `ModelFeaturedCard`/`AgentsPanel` aren't used anywhere in the Agents feature at all (Chats/Projects-only); `PersonaChatInterface.tsx` vs. `ChatInterface.tsx` confirms the original report's framing but more precisely — it's not copy-pasted JSX so much as `PersonaChatInterface` hand-rolling its own parallel state layer (`messages`/`streamState`/`input`/`attachments` via raw `useState`) instead of the shared `useChatState` hook `ChatInterface` consolidated into, and it's missing virtualization/pin-mentions/analytics entirely — a genuinely divergent, less-featured implementation, not a stale-but-matching copy. Consolidating that one would mean retrofitting `useChatState` to support persona-chat's different data source — real, valuable future work, but high-risk and out of scope for this pass.
12. **1 of 6 was a real, low-risk find — fixed.** `agents/_components/CancelCreationModal.tsx` (72 lines, single call site) was a hand-rolled fixed-overlay confirm dialog — title, description, Cancel/Confirm buttons, Escape-to-close — nearly identical in shape and visual language to the app's own shared `ConfirmModal` (`src/components/ConfirmModal`), which is already reused by 8 other call sites across Chats/Projects/Settings/Knowledge. The only functional gap: `ConfirmModal` didn't have Escape-to-close, `CancelCreationModal` did. **Consolidated**: added Escape-to-close to `ConfirmModal` itself (a small, purely additive enhancement every one of its other 8 consumers now also gets, none of which previously had it), repointed `WizardShell.tsx` to use it directly, and deleted `CancelCreationModal.tsx` outright. Zero behavior change to the wizard's cancel flow (same title/description/button copy, same destructive-styling default); one net-new capability (Escape) added app-wide to every `ConfirmModal` consumer as a side benefit.

### Phase 6 — P2 maintainability: giant-component decomposition — investigated, deferred

13. **Every `/agent/configure/*` tab page + its matching `*Tab.tsx` component (10 files) remain flagged giant + high-complexity — investigated, deliberately not decomposed this pass.** Unlike Projects' `projects/page.tsx`/`project/[id]/page.tsx` decomposition (which found genuinely self-contained pure-utility and presentational extractions with zero behavioral coupling), a first read of `instructions/page.tsx` — the worst offender, and the file touched most heavily in Phases 2-4 above — shows its complexity is substantially *intrinsic*: the save/publish/auto-save/draft-restore/version-restore state machine, the change-tag detection, and the editor UI are all tightly interdependent through `savedSnapshotRef`/`isDirty`/`pendingChangeTags`, which this pass's own Phase 2 fix already had to trace carefully to touch safely. Forcing an extraction here now, immediately after a ref-to-render-reactive-state refactor of the exact same state machine, without a dedicated pass to first map which pieces are genuinely separable, risks relocating coupling rather than reducing it — precisely the failure mode the Projects engagement's own decomposition rule warns against. **Deferred, not skipped**: worth a dedicated follow-up pass once Phase 2's changes have had time to prove stable, using the Projects engagement's own playbook (`../projects/04-projects-feature-report.md` §10 Phase 5) as the template.

### Phase 7 — P3 accessibility

14. **10× `no-placeholder-only-field` + 5× `control-has-associated-label` — all 15 fixed.** Mechanical `aria-label` additions matching each field's already-existing visible label or evident purpose, no visual changes: search inputs on Connectors/Knowledge tabs and the `/agents` library (`aria-label="Search connectors"` / `"Search knowledge"` / `"Search agents"`), the Connectors search's clear button, the Knowledge file row's "File actions" menu button (`aria-label` + `aria-haspopup`/`aria-expanded`), the Example Conversation modal's "User says"/"Agent replies" fields, the Profile tab's tag-name input and per-tag remove buttons, the Sharing tab's Super Link/Email-invite credit-limit fields and email-address field, the wizard's Name/Purpose steps, and the Published page's credit-limit field.

### Phase 8 — UX gaps

15. **Step-tracker sub-step indication — fixed.** `WizardShell`'s `STEPS_BASICS` was a static 3-element array shared by all 3 "Basics" sub-step pages (Purpose/Name/Tone), giving no indication a user was on sub-step 1, 2, or 3 of that phase. Converted to a function `STEPS_BASICS(subStepCurrent)`, with each of the 3 pages now passing its own position (1/2/3); the tracker's `StepNode` renders a small "(n/3)" caption next to "Basics" whenever it's the active step and a `subStep` is supplied. Purely additive — the two other step configs (`STEPS_TEMPLATE`, `STEPS_CONFIGURE`) are untouched, and the visual change only appears during the 3 Basics screens.
16. **Deep-link guard gap (a direct navigation to e.g. `/agents/basics/name` shows "Template" as already completed) — investigated, deliberately deferred.** Fixing this properly means each of the 3 Basics sub-step pages independently deciding "was this phase legitimately reached," which the codebase doesn't currently track (session storage holds the wizard *draft*, not a reached-step marker) — adding that tracking is a small but real behavior change across 3 files for a cosmetic-only issue (a stray checkmark, no broken functionality, no data loss) that requires a URL a real user has no way to construct themselves (there is no in-app link to a mid-wizard sub-step — the only entry points are the Template gallery and the wizard's own internal navigation, both of which set the state correctly). Given the low real-world severity and the number of edge cases a robust guard would need to cover correctly (back-navigation, refresh mid-wizard, a `?template=` param with no prior Template visit) to avoid trading one confusing state for another, this was judged lower priority than the P0-P2 items above and left for a dedicated follow-up rather than rushed.

### Net result

3 real correctness fixes (a naming-driven false positive resolved by rename, not suppression; 4 impure/side-effecting state updaters made pure; a genuinely-reproduced hydration race converted from a silent trap to a visible loading state, with honest limits on what's fixable at this layer), 2 real resource-leak fixes (a dead-code path hardened defensively, a live leak fixed for real), 1 missing status check fixed, 18 `refs`/`no-ref-current-in-render` compiler-blocking findings fixed across 5 files (root-caused to 2 patterns, not patched 18 times independently), 9 layout-property-animation findings given a real runtime fix (with an honest note that the static finding count itself can't reflect it), 27 `todo` findings investigated and confirmed a genuine compiler limitation on correct code (not force-changed), 6 duplication candidates checked (1 real, consolidated; 5 confirmed non-duplicates), 15 accessibility label findings fixed, 1 UX gap fixed (sub-step indicator) and 1 deliberately deferred with reasoning (deep-link guard), and a documented, reasoned deferral of the giant-component decomposition pass. Zero regressions at any checkpoint — `tsc --noEmit` and the 277-test suite stayed green throughout, and every reachable fix was live-verified against a real production build.

See `02b-agents-before-scan.md` for the pre-fix production baseline, `02c-agents-fixes-test-plan.md` for the full test-case breakdown of every fix above, `02d-agents-before-after-comparison.md` for the after-fix Lighthouse re-scan, and `02e-agents-manual-qa-checklist.md` for a hands-on click-through of the whole feature post-fix.
