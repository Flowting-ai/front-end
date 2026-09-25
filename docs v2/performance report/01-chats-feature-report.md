# Chats Feature — Detailed Report

**Scope:** the personal Chats feature — chat list/library, a single chat conversation (new + existing), and public chat-share links. Adjacent surfaces (Brain/Tasks, Agents, Project-scoped chat) are intentionally out of scope here and will get their own section/file.

**How this was produced:** live, logged-in Playwright run against the local dev server (`next dev`, not a production build — see caveats), Lighthouse runs against the same authenticated session, and a static-analysis pass (`react-doctor`) filtered to this feature's files. Nothing here is guessed.

---

## 1. Pages in this feature

| Route | File | Purpose |
|---|---|---|
| `/chats` | `src/app/(app)/chats/page.tsx` | Chat library — list, search, filter (All/Starred/Archived), bulk "move to project" |
| `/chat` | `src/app/(app)/chat/page.tsx` | Active conversation — new chat (`/chat`) or existing (`/chat?id=<uuid>`) |
| `/chat-shares/[shareId]` | `src/app/(app)/chat-shares/[shareId]/page.tsx` | Public/shared read view of a published chat |

Adjacent, not covered in this section: `/project/[id]/chat/[chatId]` (project-scoped chat — different API surface, `PROJECT_CHATS_ENDPOINT`), Brain/Tasks chat, Agent/Persona chat.

**Core components:** `ChatInterface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx` (two implementations exist — `src/components/chat/ChatInput.tsx` and a separate `src/components/ChatInput/index.tsx`), `ActivityRow.tsx`, `ResponseBlocks.tsx`, `ChatRow/index.tsx`, `ChatShareOverlay.tsx`, `ConnectorPrompts.tsx`, `AttachmentManager.tsx`, plus renderers (`LaTeXRenderer`, `MermaidDiagram`, `XmlTable`, `Xml*` family for structured message content).

**State/data layer:** `hooks/use-chat-state.ts`, `hooks/use-streaming-chat.ts`, `lib/api/chat.ts`, `lib/api/chat-shares.ts`, `lib/normalizers/message-transformer.ts`, `lib/stream-registry.ts`.

---

## 2. All API calls used by this feature

From `src/lib/api/chat.ts` / `src/lib/config.ts` (base path `/api/backend` locally, direct backend origin in production):

| Endpoint | Method | Used for |
|---|---|---|
| `/chats` | GET | List chats (library page, sidebar recents) |
| `/chats/create` | POST (multipart, streams) | Start a new chat — first message |
| `/chats/{id}/messages` | GET | Load a chat's message history |
| `/chats/{id}/stream` | GET/SSE | Streamed assistant response for an existing chat |
| `/chats/{id}/stop` | POST | Abort an in-flight generation |
| `/chats/{id}` | DELETE | Delete a chat |
| `/chats/{id}/share` | POST | Publish chat to its project (one-way; no "unshare" route exists — see code comment in `config.ts:138-143`) |
| `/chats/{id}/copy` | POST | Duplicate a chat |
| `/chats/{id}/star` | POST | Star/unstar |
| `/chats/{id}/archive` | POST | Archive |
| `/chats/rename` | POST | Rename |
| `/chats/message/{messageId}` | DELETE | Delete a single message |
| `/chats/files/{attachmentId}/save-to-drive` | POST | Save an attachment to Drive |
| `/chats/prompts/{promptId}` | (respond) | Answer an inline chat prompt/question card |
| `/llm/models/all` | GET | Populate model selector |
| `/highlights?chat_id=` | GET | Load highlight/pin markers for the open chat |
| `/recommendations/chat` | GET | Suggested-prompt chips on a fresh chat |

Also fired on every authenticated page load regardless of feature (org/user bootstrap, not chat-specific): `/users/me`, `/organizations`, `/organizations/{id}`, `/organizations/{id}/members`, `/organizations/{id}/plan`, `/organizations/{id}/slack/installation`, `/projects`, `/brain`, `/pins`, `/pins/folders/all`.

---

## 3. Live functional test results

### 3.1 `/chats` — library page
Loaded correctly, real screenshot confirms: title, "Task/Chat" segmented toggle, "Move to project" / "New chat" actions, filter dropdown ("All chats"), search icon, one existing chat row rendered with relative timestamp ("8m ago"). No visual defects observed.

**Note:** chat rows are `<div>`/`<button>`-based client-side navigation, not real `<a href>` anchors — this is a minor SEO/accessibility/testability gap (no middle-click-to-open-in-new-tab, no crawlable links, harder to script/test), consistent with the `prefer-tag-over-role` findings below (9 instances on this exact page).

### 3.2 `/chat` — new conversation — **critical bug found live**

Sent a message ("Reply with exactly the word 'pong'.") on a fresh chat. Sequence observed:

1. Message sent, UI shows "Assistant response complete." label with **no visible assistant reply content** rendered.
2. On revisiting the same chat (`/chat?id=<uuid>`) shortly after, the entire message thread renders **blank** — no user message, no assistant message — despite the sidebar correctly showing the chat's title.
3. Dev overlay shows a "1 Issue" badge.
4. Backend proxy log shows the actual cause:
   ```
   [backend-proxy] upstream fetch failed https://devapi.getsouvenir.com/chats/{id}/messages
   [TypeError: fetch failed] { [cause]: ConnectTimeoutError, attempted address: devapi.getsouvenir.com:443, timeout: 10000ms }
   GET /api/backend/chats/{id}/messages 502 in 10.4s
   ```
   Same failure simultaneously hit `/api/backend/brain` (502, 10.6s) and earlier `/api/backend/users/me` (502, 10.2s).
5. Frontend correctly catches this (`[useChatState] Failed to load messages`, structured `ApiError`, `status: 502`) and shows a friendly toast: *"Something went wrong on our end. Please try again in a moment."*

**Root cause is backend/infra, not frontend code**: the dev backend host `devapi.getsouvenir.com` is intermittently refusing/timing out TCP connections (exactly 10s, Node's default connect timeout) — this is outside the front-end repo and outside what this session can fix (per standing rule: front-end only, back-end is read-only/someone else's domain). Flagging it here because it directly caused a real, user-visible data-loss-looking bug during testing.

**What *is* a legitimate frontend gap**, independent of the backend flakiness: when `GET /chats/{id}/messages` fails, the UI has **no retry affordance and no stale-while-revalidate fallback** — it just renders an empty thread and a generic toast. A transient backend hiccup (which the log shows happens routinely in this environment) currently reads to the user as "my conversation vanished," not "reconnecting…". That's a real UX/reliability gap worth fixing regardless of how often the backend itself is flaky.

### 3.3 Chat options menu — works correctly
Rename, Share, Pin chat, Move to project, Archive, Delete all present and render correctly from the "⋯" menu on a chat row, confirmed via live screenshot.

---

## 4. Lighthouse performance report

**⚠️ Caveat, stated plainly:** this ran against `next dev` (per the standing no-unrequested-builds rule, no production build was run). Dev mode ships unminified bundles and keeps an HMR WebSocket open, which inflates LCP/TTI numbers well beyond what a production build would show. Treat FCP, TBT, and CLS as meaningful; treat LCP/TTI as dev-mode-inflated and not representative of production. A real prod-build Lighthouse pass needs `npm run build` first — ask for it explicitly when wanted.

| Metric | `/chats` | `/chat` |
|---|---|---|
| **Performance score** | **19 / 100** | **30 / 100** |
| Accessibility score | 83 / 100 | 84 / 100 |
| Best Practices score | 92 / 100 | 92 / 100 |
| SEO score | 100 / 100 | 100 / 100 |
| First Contentful Paint | 1.1 s | 1.2 s |
| Largest Contentful Paint | 56.8 s ⚠️ dev-mode artifact | 60.0 s ⚠️ dev-mode artifact |
| Total Blocking Time | **1,760 ms** | **2,570 ms** |
| Cumulative Layout Shift | **0.495** (poor — threshold for "good" is <0.1) | 0.191 (needs improvement) |
| Speed Index | 7.8 s | 7.1 s |
| Time to Interactive | 57.2 s ⚠️ dev-mode artifact | 60.8 s ⚠️ dev-mode artifact |
| Server response time (root doc) | 2,040 ms | 70 ms |

**Real signal even accounting for dev mode:**
- **CLS of 0.495 on `/chats`** is a genuine layout-instability problem, not dev-mode noise — CLS measures visual shifting, which dev-mode overhead doesn't fabricate. This lines up with the "Animating a layout property" findings (§5) and the loading-skeleton-to-content transitions visible in the screenshots.
- **TBT of 1.76-2.57 seconds** — main thread blocked that long — is also a real signal (it's a count of long tasks, not a paint timing dev mode distorts as badly). Consistent with the React-Compiler-blocked / high-complexity-function findings below.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 52 files (21,576 LOC):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **859** | **36** |
| Avg length | 158.0 chars | 26.8 chars |
| Total bytes | 135.7 KB | 963 B |
| **Share of styling touchpoints** | **95.98%** | **4.02%** |

This feature is in line with the codebase-wide picture (~99% inline / ~1% Tailwind app-wide) — Chats specifically sits at ~96/4. **Converting this feature's ~859 inline-style call sites to Tailwind utilities is mechanically straightforward** (your token system already backs both), but it will not move the Lighthouse numbers above by much — TBT and CLS here are dominated by React-render/animation issues (§6), not by inline-style parsing cost. Expect a Tailwind pass on this feature to help **CLS marginally** (fewer inline width/height recalculations) and **maintainability significantly**, but not to be the lever that fixes the 19-30/100 performance scores.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**231 findings** across these files (74 Performance, 74 Bugs, 49 Maintainability, 28 Accessibility, 6 Security; 76 errors / 155 warnings).

### Highest-volume issues

| Count | Category/Severity | Rule | What it means | Where |
|---|---|---|---|---|
| 32 | Performance/error | `no-layout-property-animation` | Animating `width`/`height`/`top`/`left` instead of `transform`/`opacity` — forces layout reflow every frame | `ActivityRow.tsx`, `ChatMessage.tsx`, `ConnectorPrompts.tsx`, `ReasoningBlock.tsx` +20 more |
| 31 | Bugs/warning | `no-array-index-as-key` | List items keyed by array index — causes unnecessary remounts on reorder/stream updates | `ResponseBlocks.tsx` (10+), `ActivityRow.tsx`, `ChatMessage.tsx`, `Xml*.tsx` family |
| 21 | Maintainability/warning | `only-export-components` | Non-component exports in component files — breaks Fast Refresh, slows dev iteration | `ActivityRow.tsx`, `ResponseBlocks.tsx`, `Xml*.tsx` family |
| 17 | Maintainability/warning | `no-high-complexity-react-function` | High control-flow complexity | `chat/page.tsx`, `chats/page.tsx`, `ChatInput/index.tsx`, `ChatInterface.tsx`, `ChatMessage.tsx` +5 more |
| 15 | Performance/error | React Compiler can't parse (`todo`) | Blocks auto-memoization entirely at these sites | `chat-shares/[shareId]/page.tsx`, `ChatRow/index.tsx`, `ResponseBlocks.tsx` (5×), `XmlTable.tsx` |
| 11 | Accessibility/warning | `no-static-element-interactions` | Click handlers on non-interactive elements | `ChatInput/index.tsx`, `AttachmentManager.tsx`, `ChatInput.tsx`, `PinChipStrip.tsx` |
| 11 | Bugs/warning | `no-adjust-state-on-prop-change` | State manually re-synced from props instead of derived | `ChatInterface.tsx` (7×), `ChatShareOverlay.tsx` (4×) |
| 10 | Maintainability/warning | `no-giant-component` | Components too large to safely reason about | `chat/page.tsx`, `chats/page.tsx`, `ChatInput/index.tsx`, `ChatInterface.tsx`, `ChatMessage.tsx` |
| 9 | Accessibility/warning | `prefer-tag-over-role` | `role="button"` etc. instead of real `<button>`/`<a>` | all in `chats/page.tsx` (matches the "rows aren't real links" note in §3.1) |
| 9 | Bugs/error | `effect-needs-cleanup` | Subscriptions/timers never cleaned up — real memory leaks in a long-lived chat session | `ResponseBlocks.tsx` (6×), `MermaidDiagram.tsx`, `XmlTable.tsx` |
| 8 | Performance/warning | `set-state-in-effect` | Blocks React Compiler optimization | `chat/page.tsx` (2×), `chat-shares/[shareId]/page.tsx`, `ChatInput.tsx`, `use-chat-state.ts` |
| 8 | Bugs/error | `no-ref-current-in-render` | Ref mutated during render — can cause inconsistent renders | `chat/page.tsx` (3×), `ChatInterface.tsx` (3×), `ResponseBlocks.tsx`, `XmlTable.tsx` |
| 7 | Performance/error | React Compiler blocked (`refs`) | Same compiler-blocking issue, ref-pattern-specific | `chat/page.tsx` (3×), `ResponseBlocks.tsx` (3×), `XmlTable.tsx` |
| 6 | Bugs/warning | `exhaustive-deps` | Missing effect dependencies — stale-closure risk | `ChatInterface.tsx` (5×), `use-chat-state.ts` |
| 5 | Security/warning | `dangerous-html-sink` | Dynamic content into an HTML injection sink | `LaTeXRenderer.tsx` (2×), `ResponseBlocks.tsx` (2×), `line-renderer.tsx` |
| 5 | Accessibility/warning | `click-events-have-key-events` | Click-only handlers, no keyboard equivalent | `ChatInput/index.tsx`, `AttachmentManager.tsx` (2×), `ChatInput.tsx`, `ResponseBlocks.tsx` |

### Lower-volume but notable

- **1× `no-hydration-branch-on-browser-global`** (`chat/page.tsx:267`, error) — server and client render different branches based on a browser global; a real hydration-mismatch risk.
- **2× `motion-animate-presence-must-outlive-child`** (`chats/page.tsx`, `ConnectorPrompts.tsx`) — Framer Motion `AnimatePresence` misuse, can cause exit-animation glitches.
- **2× `no-pass-data-to-parent`** (both `ChatInput` implementations) — data threaded up via effect instead of a callback/lift, a re-render-inducing anti-pattern.
- **1× `createObjectURL` without `revokeObjectURL`** (`AttachmentManager.tsx:122`) — a real memory leak for any session that attaches files.
- **1× `window.open` without `noopener`** (`ConnectorPrompts.tsx:179`) — reverse-tabnabbing risk (security).
- **2× `no-locale-format-in-render`** (`chats/page.tsx`) — timestamp formatting done in render instead of memoized, minor but real re-render cost on every parent update.

Full file/line detail for all 231 findings is in the JSON backing this report (see §8, artifacts list) if you want to triage in a spreadsheet.

---

## 7. Backlog — prioritized

**P0 — user-facing correctness**
1. No retry/stale-while-revalidate when `GET /chats/{id}/messages` fails — a transient backend error currently makes an existing conversation look erased. Add a retry affordance and/or keep last-known-good messages visible with an inline "couldn't refresh" banner instead of blanking the thread.
2. `chat/page.tsx:267` — server/client branch on a browser global (hydration-mismatch risk, error-severity).
3. 9× effect/timer cleanup missing (`effect-needs-cleanup`) — real leaks in a surface (chat) users keep open for a long time.
4. `AttachmentManager.tsx` — `createObjectURL` never revoked; leaks blob memory per attachment over a session.

**P1 — performance, real (not dev-mode artifacts)**
5. 32× layout-property animation — biggest concrete lever for the CLS 0.495 on `/chats`. Switch to `transform`/`opacity`.
6. 31× array-index-as-key in message/activity lists — causes avoidable remounts during streaming.
7. 22× React-Compiler-blocking patterns (`todo`, `refs`, `set-state-in-effect`, `incompatible-library`) — until cleared, this feature gets none of the automatic re-render optimization React Compiler would otherwise provide.
8. 11× manual prop→state sync in `ChatInterface.tsx`/`ChatShareOverlay.tsx` — replace with derived values; each is an extra render pass.

**P2 — maintainability / DX**
9. `chat/page.tsx`, `chats/page.tsx`, both `ChatInput` components, and `ChatInterface.tsx` are flagged as both "giant" and "high complexity" — these are the files anyone touching this feature will keep tripping over. Worth a decomposition pass independent of any UI-library migration.
10. Two parallel `ChatInput` implementations (`components/chat/ChatInput.tsx` and `components/ChatInput/index.tsx`) — worth confirming whether both are still live or one is dead code; duplicated complexity either way.
11. 21× non-component exports breaking Fast Refresh — cheap, mechanical fix, speeds up everyone's dev loop on this feature.

**P3 — accessibility**
12. 9× `role` used instead of a real `<button>`/`<a>` on `chats/page.tsx` — also explains why chat rows aren't real links (§3.1).
13. 11× click-only handlers without keyboard equivalents, concentrated in `ChatInput`/`AttachmentManager`.

**Out of scope for this repo (flagging only)**
14. `devapi.getsouvenir.com` intermittently refuses connections (10s connect-timeout, repeatable) — this is the actual cause of every 502 seen in this and the prior profiling session. Backend/infra issue, not frontend code.
15. `next@16.2.4` has a patched high-severity DoS CVE (CVE-2026-23870) — global, not chat-specific, but worth a `next@16.2.6+` bump; flagged here since it surfaced in the codebase-wide scan.

---

## 8. Artifacts backing this report

Raw data (Lighthouse JSON, screenshots, network captures, full react-doctor diagnostics) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.

---

## 9. Fixes applied (post-report follow-up)

Everything below was implemented in a later session, working through the §7 backlog phase by phase. Every phase was verified the same way before moving to the next: `npx tsc --noEmit`, the full `vitest` suite (271 tests, passing throughout — zero regressions at any checkpoint), a `react-doctor --scope changed` pass, and live testing against the real dev server (including deterministic network-interception tests, not just hoping for a reproducible bug). Findings that turned out, on inspection, to be deliberate/correct code or false positives were **left alone and documented as such** rather than force-"fixed" — several sub-sections below record zero-change outcomes for exactly that reason.

### Phase 1a — mechanical fixes (array-index keys, effect cleanup, misc.)
- **`ConnectorPrompts.tsx`** — added `noopener` to the one `window.open` call where it's actually safe (a documented comment explained why the *other* nearby call must keep it omitted; left that one untouched).
- **`chats/page.tsx`** — fixed a real hydration mismatch in the relative-timestamp display (`formatTaskTimestamp` read `new Date()` at render time, differing between server and client) via a mount-gated render.
- **`ResponseBlocks.tsx`** — **6 real memory leaks**, the same copy-pasted bug in 6 different chart-reveal animations: a nested `setTimeout(onComplete, …)` inside an interval callback was never tracked or cleared, so it could fire against an unmounted component. All 6 now properly cleaned up.
- **`line-renderer.tsx`** — swapped a real stable ID (`span.spec.id`, already available and used for a data attribute on the same element) into a highlight span's `key`, replacing an index-based one.
- **`ActivityRow.tsx`, `ChatMessage.tsx`** — minor key cleanups (removed dead/redundant index fallbacks).
- **Investigated, left unchanged:** `AttachmentManager.tsx`'s flagged "leak" was already correctly revoking its blob URL via a documented delayed `setTimeout`, just in a shape the static scanner couldn't trace — false positive. `MermaidDiagram.tsx` and `XmlTable.tsx`'s flagged effects were likewise already correctly cleaned up. ~25 of the 31 `no-array-index-as-key` findings turned out to be deliberate, already-reasoned exceptions (several carry explicit `eslint-disable` comments with rationale) for genuinely positional/append-only content with no better identifier available — forcing a "fix" onto these would have been wrong.

### Phase 1b — `only-export-components` (21 findings, 0 behavior change)
Every component file that also exported non-component values (parser functions, config constants) now exports only its component:
- **9 new sibling `.parse.ts` files** — `XmlCallout`, `XmlEmail`, `XmlFunnel`, `XmlKanban`, `XmlMap`, `XmlMetrics`, `XmlSchedule`, `XmlSteps`, `XmlWeather` each got their parsing logic split into a colocated file. Verified end-to-end by the project's own `content-parser.test.ts` (23 tests).
- **`ACTIVITY_VERB`** moved into the already-appropriate shared home, `lib/activity.ts`.
- **`USE_STYLE_OPTIONS`** moved into a new `lib/tone-options.ts` (it's used across Chat/Brain/Project, not Chat-specific; 4 external call sites updated).
- **The `preprocessMarkdown` pipeline** (10 interdependent private functions) plus `stripMarkdown` moved into a new `lib/markdown-preprocess.ts` (shared beyond Chats, reaching into Pinboard too; 4 external call sites updated, verified by `markdown-utils.test.ts`).
- **Deleted as confirmed dead code** (zero call sites anywhere, including internally): `renderReasoningContent`, `conditionIcon` + its `CONDITION_ICON` table, `renderInlineMarkdown`.
- **Bonus finding, not fixed:** `components/ChatInput/index.tsx` (the Agents-configure variant) has its own independent, drifting copy of `USE_STYLE_OPTIONS` instead of importing the shared one — out of this report's scope, flagged for a follow-up.

### Phase 2 — `no-layout-property-animation` (32 findings)
- **5 real conversions** to `transform`-based animation, all sites where the target size was a known numeric value (not `"auto"`): `AttachmentManager.tsx`'s upload progress-bar fill, `XmlFunnel.tsx`'s funnel-stage bar, and `ResponseBlocks.tsx`'s stacked-bar-chart segments plus both bars in the positive/negative chart (`scaleX`/`scaleY` + a static numeric `height`/`width` + matching `transformOrigin`, mirroring a pattern already used correctly elsewhere in the same file).
- **Live-verified**: sent real chart-generating prompts through the actual chat and watched them render — vertical bar chart pixel-confirmed correct (proportional heights, no distortion). The stacked/positive-negative variants use the identical proven technique but weren't independently pixel-confirmed (the LLM didn't reliably reproduce a true stacked-shape response in testing); flagged honestly rather than claimed as seen.
- **~27 left as accepted tradeoffs**, not fixed: genuine variable/unknown-height content reveals (activity lists, reasoning steps, results lists, an email body clamp) where a safe conversion would need real DOM measurement or would visually distort text. `ReasoningBlock.tsx` (14 of the 32) has an existing code comment documenting a deliberate, already-tuned tradeoff specifically to avoid fighting a virtualized list's auto-scroll — not overridden.
- **Bonus finding, not fixed:** caught a real, pre-existing "two children with the same key" console error in the bar chart's bottom label row during testing — unrelated to anything touched here.

### Phase 3 — correctness
- **`chat/page.tsx`** — fixed the hydration-branch bug (§7 item 2): `selectedPersona`'s `useState` lazy initializer used to branch on `typeof window`, making its return value differ between server and client whenever a pending persona existed in `sessionStorage`. Replaced with state that always starts `null` on both sides, populated via `useLayoutEffect` (which still runs before the browser paints or allows interaction, preserving the original "must be ready before the first send" guarantee).
- **`use-chat-state.ts` + `ChatInterface.tsx`** — built the retry/stale-while-revalidate fix (§7 item 1): added `messagesLoadError` state (set on fetch failure, cleared on the next successful load), reused the hook's existing-but-unwired `refreshMessages` as the retry action, and added an inline "Couldn't load this conversation. [error] / Retry" banner in place of the misleading generic empty-state. **Live-verified with a deterministic network-interception test** (not hoping for real backend flakiness): banner appears on forced failure, disappears on successful retry, zero page errors.
- **Bonus finding, not fixed:** confirmed (via a clean reload with no interception at all) that one chat's historical assistant table content doesn't round-trip correctly — a pre-existing backend/persistence issue, unrelated to this fix.

### Phase 4 — ref-mutation-during-render (the `no-ref-current-in-render` / `refs` subset of the compiler-blocking findings)
- **5 real fixes**, all the same pattern (a ref's `.current` was mutated directly during render instead of in a `useEffect` — unsafe under Strict Mode/concurrent rendering): `chat/page.tsx`'s `selectModelRef`/`modelsRef`, `ChatInterface.tsx`'s `currentChatIdRef` and `sendInitialPrompt.current`, `XmlTable.tsx`'s `rowsLenRef`, `ResponseBlocks.tsx`'s `onAllCompleteRef`.
- **Left alone, with reasoning:** `ChatInterface.tsx`'s `_handleEditMessageImpl` carries an explicit "safe: only read in event handlers" comment that is, on inspection, actually correct per React's rules — not overridden. A `containerRef.current` *read* (not write) used for tooltip positioning was left as low-risk/low-value to restructure.
- **Verified:** live-tested both the normal send flow and a streaming-table render (the two most timing-sensitive paths touched) — both worked, zero page errors. `react-doctor` confirms zero remaining findings in this specific subset.
- **Remaining `todo` (15) and `set-state-in-effect` findings in this phase — investigated a representative sample, not fixed further.** Every `todo` instance checked was the same shape: a correct, idiomatic async event-handler (`try/catch/finally` + `setState`) that the current React Compiler version doesn't yet know how to parse — a tooling limitation, not a code defect. The `set-state-in-effect` instances checked were either correct/necessary async-data-fetching lifecycle resets or low-value-to-restructure (a keyboard-nav highlight index). Not force-fixed.

### Phase 5 — `no-adjust-state-on-prop-change` (11 findings) — **zero changes, by design**
Read intent on all 11 sites before touching anything (per the risk this report itself flagged for this category). Every one turned out to be deliberate/correct, not the edit-buffer-clobbering bug predicted as a risk: `ChatInterface.tsx`'s 7 are either an intentional, documented "reset specific draft state on chat switch" pattern (explicit `intentional` comments), legitimate auto-scroll-follow logic, or a mis-attributed match. `ChatShareOverlay.tsx`'s 4 — specifically predicted as the likeliest real bug — reset the share dialog's local state **only when the dialog is explicitly opened** (click or a documented deep-link auto-open), never on an unrelated background re-render, so there's no clobbering risk. Confirming 11 non-issues is the intended outcome of reading intent first, not a skipped phase.

### Net result
~20 real bugs/leaks fixed across the P0/P1 backlog (memory leaks, a hydration mismatch, the message-load retry gap, 5 ref-mutation-during-render bugs, 5 CLS-causing layout animations), 21 file-organization findings resolved with zero behavior change, 3 confirmed-dead functions removed, and roughly 60 additional findings individually investigated and left unchanged with documented reasoning rather than force-fixed. Zero regressions at any checkpoint.

### Note — giant-component decomposition (not started)
The one substantial item from the original backlog **not** attempted: splitting up `chat/page.tsx`, `chats/page.tsx`, both `ChatInput` implementations, and `ChatInterface.tsx` (all flagged giant + high-complexity). This is real architecture work, not a bug fix — it needs an explicit decision on the target shape (how to split, what the new boundaries/props look like) before any code moves, which is a call for whoever owns this area, not something to do unilaterally inside a backlog-clearing pass. Flagged here as the honest remaining gap, not silently dropped.
