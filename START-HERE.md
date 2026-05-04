# Souvenir V2 — Start Here

**This is your entry point.** Read this first, every time you start a new day. It tells you what to build, what to read, and how to know you've done it right.

**Owner:** Chai (updates this as days complete and designs ship)  
**Engineers:** Shyam · Kunal  
**Design system:** Utkarsh (updates pending component status as KDS components ship)

---

## Build Status

| Day | Focus | Status | Docs |
|-----|-------|--------|------|
| 1 | Env setup · folder structure · CI | ✅ Done | — |
| 2 | Auth0 + Auth context | ✅ Done | — |
| 3 | API client + infrastructure | ✅ Done | — |
| 4 | App layout + Sidebar | ✅ Done | — |
| 5 | Chat infrastructure — SSE streaming hook | ✅ Done | — |
| 6 | Chat UI components | 🟡 Building | [chat-board.md](docs/features/chat-board.md) · [topbar.md](docs/features/topbar.md) · [response-types.md](docs/response-types.md) · [animation-states.md](docs/animation-states.md) |
| 7 | Pinboard | ⬜ Pending | [pinboard.md](docs/features/pinboard.md) |
| 8 | Personas — list + create | ⬜ Pending | Doc pending (design not locked) |
| 9 | Personas — chat + settings | ⬜ Pending | Doc pending (design not locked) |
| 10 | Brain / Orchestrator | ⬜ Pending | Doc pending |
| 11 | Settings | ⬜ Pending | Doc pending |
| 12 | Polish + error states | ⬜ Pending | [error-states.md](docs/error-states.md) |
| 13 | QA + handoff | ⬜ Pending | — |

---

## 5 Rules You Cannot Break

Read these once. They apply to every line you write.

**1. Copy KDS — never import from the KDS package.**
When a KDS component exists, copy its source into `src/components/`. Add your logic in a wrapper or hook on top. Never modify the copied file.
→ How: [docs/1-component-copy-guide.md](docs/1-component-copy-guide.md)

**2. Never hardcode a hex value.**
Every colour must use a CSS token: `var(--color-text-primary)`, `var(--color-surface-subtle)`, etc.
Dark mode ships after chat — if you hardcode hex, dark mode breaks automatically.

**3. React Compiler is on. Zero `useMemo` / `useCallback`.**
The compiler handles optimisation. Manual memos fight it.

**4. Every HTML render goes through `security.ts`.**
No `dangerouslySetInnerHTML` without sanitisation. No exceptions.

**5. Plan gates use `plan-config.ts` helpers — never inline.**
```ts
// WRONG
if (plan === 'power') { ... }

// RIGHT
if (canAccessFeature(plan, 'modelCompare')) { ... }
```

---

## Reading Guide — What to Read Before Each Day

### Before Day 6 (Chat UI)
1. [docs/features/chat-board.md](docs/features/chat-board.md) — component tree, state machine, API wiring
2. [docs/features/topbar.md](docs/features/topbar.md) — model chip, share, usage ring, disposable mode
3. [docs/response-types.md](docs/response-types.md) — Simple / Research / Thinking / Combined SSE sequences
4. [docs/animation-states.md](docs/animation-states.md) — 6 Framer Motion patterns + spring configs
5. [docs/0-pending-kds-components.md](docs/0-pending-kds-components.md) — Components 1–8, prop contracts + placeholders

### Before Day 7 (Pinboard)
1. [docs/features/pinboard.md](docs/features/pinboard.md) — full feature spec
2. [docs/0-pending-kds-components.md](docs/0-pending-kds-components.md) — Components 9–13, prop contracts + placeholders

### Before Day 12 (Error states + polish)
1. [docs/error-states.md](docs/error-states.md) — E1–E5 render rules, retry logic

### Cross-cutting (read once, reference as needed)
- [docs/1-component-copy-guide.md](docs/1-component-copy-guide.md) — every time you copy a KDS component
- [docs/animation-states.md](docs/animation-states.md) — every time you add a Framer Motion animation
- [CLAUDE.md](CLAUDE.md) — rules, KDS status, icons spec, key file paths

---

## Day 6 — Done Checklist

When Day 6 is complete, every box below should be checked. This is also what Chai reviews in QA.

### Chat Board
- [ ] `ChatInput` renders and `onSend` fires correctly with the current input value
- [ ] `MessageBubble` placeholder accepts `role` prop — user messages right-aligned, assistant left-aligned
- [ ] Streaming cursor (pure CSS, no Framer Motion) appears on `text_start`, disappears on `text_end`
- [ ] `StreamingIndicator` placeholder shows three pulsing dots during `routing` / `thinking` phases
- [ ] `ReasoningBlock` expands live during `thinking` phase, auto-collapses when `thinking_end` fires
- [ ] `ReasoningBlock` can be manually toggled open/closed after sealing
- [ ] `ResearchPanel` source cards animate in one-by-one as `research_source` events arrive
- [ ] `ResearchPanel` collapses to a pill on `research_end`
- [ ] `CitationsPanel` appears below message after `done` in Research response type
- [ ] `ClarifyingQuestion` placeholder renders label + option chips, clicking a chip sends a new message
- [ ] `InitialPrompts` shows only when chat is empty (no messages, no active stream)
- [ ] Message action bar (copy · thumbs up · thumbs down · pin) appears on `complete` phase only
- [ ] Error cards (E1, E2, E3) render inline in the message area with correct background tokens
- [ ] E4 rate limit banner appears above input bar, input is locked while visible
- [ ] E5 auth expired banner appears, input is locked, "Sign in" → `/auth/logout`
- [ ] `reportError()` called on every E3 / E4 / E5

### TopBar
- [ ] TopBar shows "Auto" label in idle phase
- [ ] Label animates to model name after `model_chosen` SSE event (Pattern 2 text swap)
- [ ] Label shows "Routing…" / "Thinking…" / "Searching web…" at correct phases
- [ ] Model chip is clickable in idle / model-chosen / complete phases only
- [ ] Model dropdown lists Auto-routing (Base, Pro) + direct models from `GET /llm/models`
- [ ] Power-only models show lock icon for Starter/Pro users
- [ ] Model selection applies to the next message only — does not abort current stream
- [ ] Ghost icon toggles disposable mode — banner animates in/out below TopBar
- [ ] `ShareButton` hidden until first complete message, modal opens on click
- [ ] `UsageCreditsButton` placeholder shows credits remaining, popover opens on click
- [ ] `UserNameDisplay` replaces avatar when disposable mode is ON

### Code quality
- [ ] `lucide-react` removed from `package.json`
- [ ] Zero hardcoded hex values in any new file — grep check: `grep -r "#[0-9a-fA-F]\{3,6\}" src/`
- [ ] Zero `useMemo` / `useCallback` added
- [ ] All icons via `@hugeicons/react` at `size={16}` `strokeWidth={1.5}` `color="currentColor"`
- [ ] All pending component files have the `// TODO(kds):` comment in the exact format from the docs

---

## Day 7 — Done Checklist

### Pinboard
- [ ] `FloatingMenu` appears fixed on the right edge of the chat content area
- [ ] Pin `FloatingMenuItem` toggles compact Pinboard open/closed
- [ ] Highlight `FloatingMenuItem` is disabled with `// TODO(design): HighlightBoard not yet designed`
- [ ] Compact Pinboard slides in from right (x: 40→0 spring) when opened
- [ ] `GET /pins` fetched on mount, pins render in the list
- [ ] Pin skeleton (3 rows) shown during fetch
- [ ] Pin button in message action bar calls `POST /pins/message/{messageId}` — optimistic add
- [ ] New pin appears at top of list with Pattern 3 animation (y: 12→0, opacity: 0→1)
- [ ] Pin button shows filled state after pinning (not toggled back to empty)
- [ ] `Pin` renders with category badge, title, 2-line description, labels, chat name
- [ ] `Pin` expands/collapses on drag handle — KDS spring behaviour intact
- [ ] "Organize" button opens `PinboardExpanded` overlay (924×817px spring morph)
- [ ] `PinboardExpanded` sidebar shows All pins / Unorganized / folders list
- [ ] Category tabs (All · Favorites · Code · Text · Vision · Image · Audio · Search) filter the pin grid
- [ ] Search input filters pins client-side (debounced 150ms)
- [ ] `FilterMenu` placeholder renders checkbox list of category + label colour options
- [ ] `SortMenu` placeholder renders radio list + asc/desc toggle
- [ ] `EmptyState` renders correct message for: no pins / search 0 / filter 0 / empty folder
- [ ] "New folder" creates folder via `POST /pins/folders`, appears in sidebar immediately
- [ ] `ContextMenu` placeholder returns null — right-click on Pin does nothing
- [ ] Organize mode: checkboxes appear on each Pin card
- [ ] Bulk toolbar appears (y: 8→0) when ≥1 pin is selected
- [ ] Delete selected: confirm → `DELETE /pins/{id}` × N, optimistic remove
- [ ] Move to folder: `PATCH /pins/{id}` × N
- [ ] Export: triggers PDF export of selected pins (or all if none selected)
- [ ] "Done" / Escape exits organize mode, unchecks all pins

### Code quality
- [ ] Zero hardcoded hex values
- [ ] `ContextMenu`, `FilterMenu`, `SortMenu`, `EmptyState` all have `// TODO(kds):` comments
- [ ] `collapseSignal` prop wired to all `Pin` children from the "Collapse all" button
- [ ] `GET /pins` re-fetched after every create / delete mutation

---

## Pending KDS Components

Utkarsh is building these. Use placeholders until they ship.  
Full prop contracts + placeholder code → [docs/0-pending-kds-components.md](docs/0-pending-kds-components.md)

### Chat UI
| # | Component | Status | Blocks |
|---|-----------|--------|--------|
| 1 | `MessageBubble` | ⬜ Pending | Chat message display |
| 2 | `StreamingIndicator` | ⬜ Pending | Typing indicator |
| 3 | `ClarifyingQuestion` | ⬜ Pending | Ambiguous prompt flow |
| 4 | `HighlightPopover` | ⬜ Pending | Text selection actions |
| 5 | `ComparePanel` | ⬜ Pending | Compare Models (Power plan) |
| 6 | `ShareButton` | ⬜ Pending | TopBar share icon |
| 7 | `UserNameDisplay` | ⬜ Pending | TopBar anonymous name |
| 8 | `UsageCreditsButton` | ⬜ Pending | TopBar credits ring |

### Pinboard
| # | Component | Status | Blocks |
|---|-----------|--------|--------|
| 9 | `FilterMenu` | ⬜ Pending | Pinboard filter dropdown |
| 10 | `SortMenu` | ⬜ Pending | Pinboard sort dropdown |
| 11 | `ContextMenu` | ⬜ Pending | Right-click on Pin |
| 12 | `EmptyState` | ⬜ Pending | Zero results states |
| 13 | `HighlightBoard` | ⬜ Design not started | Highlight panel |

**When Utkarsh ships a component:** swap the import in your placeholder file, delete the placeholder code, remove the `// TODO(kds):` comment. One line change — nothing else should need to move.

---

## Confirm with Sahil Before Wiring

These API endpoints are assumed to exist based on V1. Verify before you build against them.

| # | Endpoint | Used for | Confirmed? |
|---|----------|----------|-----------|
| 1 | `POST /pins/message/{messageId}` | Pin a message | ⬜ |
| 2 | `PATCH /chats/{chatId}` with `{ is_public: bool }` | Share toggle | ⬜ |
| 3 | `GET /llm/models` returns `plan_required` field | Lock Power-only models in dropdown | ⬜ |
| 4 | `GET /users/me/usage` returns `reset_at` field | Credits reset date in popover | ⬜ |
| 5 | `POST /pins/folders` + `GET /pins/folders` | Folder create + list | ⬜ |

Mark each ✅ once confirmed. If an endpoint doesn't exist yet, add a `// TODO(api):` comment at the call site and skip the wiring.

---

## Key File Paths

```
src/
├── app/(app)/chat/page.tsx          ← Chat Board entry point
├── components/
│   ├── chat/                        ← All chat UI components
│   ├── layout/                      ← AppLayout · LeftSidebar · TopBar · Pinboard
│   └── [ComponentName]/             ← KDS copies (one folder per component)
├── hooks/
│   ├── use-streaming-chat.ts        ← SSE streaming (done — do not rewrite)
│   └── use-chat-state.ts            ← Chat phase state machine
└── lib/
    ├── config.ts                    ← API endpoints (do not rewrite)
    ├── plan-config.ts               ← Plan gates + credit math (do not rewrite)
    ├── streaming.ts                 ← SSE text merge util (do not rewrite)
    ├── thinking.ts                  ← <think> tag extractor (do not rewrite)
    ├── error-reporter.ts            ← Error logging (do not rewrite)
    └── api/client.ts                ← apiFetch + 401 auto-retry (do not rewrite)

docs/
├── 0-pending-kds-components.md     ← Prop contracts for all 13 pending components
├── 1-component-copy-guide.md       ← How to copy from KDS correctly
├── animation-states.md             ← 6 Framer Motion patterns
├── response-types.md               ← SSE sequences for all 4 response types
├── error-states.md                 ← E1–E5 render rules
└── features/
    ├── chat-board.md               ← Full chat feature spec
    ├── left-sidebar.md             ← Sidebar feature spec
    ├── topbar.md                   ← TopBar feature spec
    └── pinboard.md                 ← Pinboard feature spec
```

---

## Questions?

- **Chai** — design decisions, feature scope, anything unclear in the docs
- **Utkarsh** — KDS component questions, token names, pending component ETAs
- **Sahil** — API endpoint questions, field names, response shapes

If something in the docs contradicts the code, **the docs win** — flag it to Chai and she'll resolve it.

---

## Starting a Session with Claude Code

Open the project in Claude Code. CLAUDE.md auto-loads so Claude already knows the rules and file paths. Then paste in your briefing below — Claude will read the right docs and be fully up to speed before you write a single line.

**Update the day number and task each morning.** Everything else stays the same.

---

### Shyam — paste this into Claude Code

```
I'm Shyam, one of the feature engineers on Souvenir V2.

Today is Day 6. I'm building the Chat UI components.

Read these docs before we start:
- docs/features/chat-board.md
- docs/features/topbar.md
- docs/response-types.md
- docs/animation-states.md
- docs/0-pending-kds-components.md (components 1–8)

Key things to know about me:
- I've built Days 1–5 (env, auth, API client, layout, SSE streaming hook)
- I'm comfortable with React and TypeScript
- I copy KDS components into src/components/ — never import from the KDS package
- I use placeholders for the 13 pending KDS components with the exact prop contracts in the docs

Once you've read the docs, help me work through the Day 6 done checklist in START-HERE.md one item at a time.
```

---

### Kunal — paste this into Claude Code

```
I'm Kunal, one of the feature engineers on Souvenir V2.

Read START-HERE.md first so you know the current build status and what day we're on.
Then read the docs listed in the Reading Guide for today's day.

Key things to know about me:
- I work alongside Shyam — we split features between us
- I copy KDS components into src/components/ — never import from the KDS package
- I use placeholders for the 13 pending KDS components with the exact prop contracts in docs/0-pending-kds-components.md
- If I'm unsure about a design decision, I check the docs first and ask Chai if it's not covered

Tell me the current build status from START-HERE.md and ask me what I'm working on today.
```

---

### Utkarsh — paste this into Claude Code

```
I'm Utkarsh. I build and maintain the Kaya Design System (KDS) for Souvenir V2.
I do not build product features — that's Shyam and Kunal.
My job is to build the KDS components so the engineers can use them.

Show me the full list of pending KDS components from docs/0-pending-kds-components.md.
For each one tell me:
- What it blocks (which feature / which engineer is waiting)
- The exact prop contract I need to match
- The placeholder code that's currently in place

When I ship a component:
1. I tell Shyam/Kunal to swap the import in their placeholder file
2. We update the status in START-HERE.md from ⬜ Pending to ✅ Done
3. The TODO(kds) comment gets removed from their file

What should I build first?
```
