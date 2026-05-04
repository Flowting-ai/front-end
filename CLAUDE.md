# Souvenir V2 — Frontend

**Stack:** Next.js 16 · React 19 · TypeScript 5 · Tailwind v4 · Kaya DS · Auth0 v4 · Framer Motion 12  
**API:** `devapi.getsouvenir.com` (Sahil) · OpenAPI at `/openapi.json`  
**Design system repo:** `github.com/strange-rock/kaya-design-system` (local clone at `/tmp/kaya-ds/`)

---

## Build Status (as of May 2, 2026)

| Day | Focus | Status |
|-----|-------|--------|
| 1 | Env setup, folder structure, CI | ✅ Done |
| 2 | Auth0 + Auth context | ✅ Done |
| 3 | API client + infrastructure | ✅ Done |
| 4 | App layout + Sidebar | ✅ Done |
| 5 | Chat infrastructure — SSE streaming hook | ✅ Done |
| 6 | Chat UI components | 🟡 Docs ready — build starting |
| 7 | Pinboard + Chat UX features (highlight, pin mention, reply) | 🟡 Docs ready — build starting |
| 8–13 | Chat polish, Personas, Settings | ⬜ Pending |

---

## Non-Negotiable Rules

**1. Copy KDS components — do not import from the KDS package.**  
When a KDS component exists, copy its source verbatim into `src/components/`. Add business logic in a wrapper or hook on top. Never modify the copied visual code. See `docs/1-component-copy-guide.md`.  
*EXECUTION_MAP.md Principle 2 says "use KDS" — this is correct. The mechanism is copy, not npm import.*

**2. Never hardcode hex values.**  
All colors must use CSS custom property tokens: `var(--color-text-primary)`, `var(--color-surface-subtle)`, etc.  
Dark mode launches after Individual Chat ships. The `.dark {}` hook is already scaffolded — it works automatically if tokens are used correctly. A hardcoded hex is a dark mode regression.

**3. React Compiler is on.**  
Zero manual `useMemo` / `useCallback`. Trust the compiler.

**4. Every user-facing HTML render goes through `security.ts`.**  
No `dangerouslySetInnerHTML` without sanitization. No exceptions.

**5. Keep V1 lib files verbatim.**  
These 8 files are already correct — do not rewrite them. Copy into `src/lib/` exactly as they are in the V1 repo:  
`streaming.ts` · `thinking.ts` · `config.ts` · `error-reporter.ts` · `chat-tones.ts` · `plan-config.ts` · `api/client.ts` · `api-client.ts`

**6. Plan-gating uses `plan-config.ts`.**  
Never write `plan === "power"` inline. Use `canAccessFeature(plan, 'featureName')` and `hasReachedLimit(plan, resource, count)`. Source: `src/lib/plan-config.ts`.

---

## FigJam Concept Maps

**Board:** https://www.figma.com/board/GkDTPdFOMZw9dqt8WftecF

| Map | What it covers |
|-----|---------------|
| 1. System Architecture | Team, KDS, API, Auth, tokens, plan gating — the whole system |
| 2. Chat Experience | Full user journey from input to pin |
| 3. Chat Phase State Machine | 10 phases, every SSE event trigger on every transition |
| 4. Component Architecture | KDS copy-not-import, 8 pending components, wrapper/hook pattern |
| 5. API and Data Flow | apiFetch, JWT, rate limiter, all endpoints, SSE event types |
| 6. Response Types and Errors | 5 response types with SSE sequences, 5 error types with render rules |
| 7. Plan and Credits System | 3 plan tiers, limits, credits, feature flags, plan-config.ts helpers |

**Color legend across all maps:**
- Sand (#F7F2ED) — People / Team
- Blue (#E7F4FD) — Core system / User-facing
- Purple (#F8ECF9) — KDS / Design system
- Green (#F7FEE6) — API / Data / Ready components
- Yellow (#FAF6EB) — Pending / Warning / Power plan
- White — Config / Logic / Helpers
- Neutral (#EDE1D7) — Legacy / V1 files
- Red (#FDE7E7) — Errors / Rules that must not be broken

---

## Read Before Building

| Task | Read first |
|------|-----------|
| Copying any KDS component | `docs/1-component-copy-guide.md` |
| Chat Board feature | `docs/features/chat-board.md` |
| Left Sidebar feature | `docs/features/left-sidebar.md` |
| TopBar (model chip, share, usage, disposable mode) | `docs/features/topbar.md` |
| Pinboard feature | `docs/features/pinboard.md` |
| Any Framer Motion animation | `docs/animation-states.md` |
| Placeholder for a pending component | `docs/0-pending-kds-components.md` |
| Response type variants (simple / research / error) | `docs/response-types.md` |
| Error state rendering | `docs/error-states.md` |
| Full system concept map | `docs/2-master-concept-map.md` |

---

## KDS Component Status

### Ready — copy from `/tmp/kaya-ds/src/components/`

| Component(s) | Copy to |
|--------------|---------|
| `Button` | `src/components/Button/` |
| `IconButton` | `src/components/IconButton/` |
| `Badge`, `Chip`, `Divider` | `src/components/Badge/` etc. |
| `Sidebar`, `SidebarMenuItem`, `SidebarMenuSkeleton` | `src/components/Sidebar/` |
| `SidebarProjectsSection`, `SidebarInset` | `src/components/Sidebar/` |
| `ChatInput` | `src/components/ChatInput/` |
| `Pin`, `Pinboard`, `PinboardHeader`, `PinCategory`, `PinCommentField` | `src/components/Pin/` |
| `Dropdown`, `DropdownMenuItem`, `DropdownSection` | `src/components/Dropdown/` |
| `FloatingMenu`, `FloatingMenuItem` | `src/components/FloatingMenu/` |
| `Tooltip`, `Popover` | `src/components/Tooltip/` |
| `InputField`, `InputGroup`, `PasswordInputField` | `src/components/InputField/` |
| `ModelSelectItem`, `ModelFeaturedCard`, `PresetModelSelector` | `src/components/ModelSelector/` |
| `TabItem`, `Tabs` | `src/components/Tabs/` |

### Pending — Utkarsh building (use placeholders, see `docs/0-pending-kds-components.md`)

| Component | Blocks | Placeholder behavior |
|-----------|--------|---------------------|
| `MessageBubble` | Chat message display | Aligned div, passes children through |
| `StreamingIndicator` | Typing indicator | Three pulsing dots |
| `ClarifyingQuestion` | Ambiguous prompt UX | Label + option chips |
| `HighlightPopover` | Text selection actions | Returns null |
| `ComparePanel` | Compare Models (pro/power) | Returns null |
| `ShareButton` | TopBar share icon | HugeIcons ghost button |
| `UserNameDisplay` | TopBar anonymous name | Name pill |
| `UsageCreditsButton` | TopBar credits meter | Credits pill via `usageToCredits()` |
| `FilterMenu` | Pinboard filter dropdown | Basic checkbox list, close on outside click |
| `SortMenu` | Pinboard sort dropdown | Radio list + asc/desc toggle |
| `ContextMenu` | Right-click on Pin | Returns null (passes children through) |
| `EmptyState` | Zero results / no pins | Centered icon + heading + optional CTA |

---

## Icons

Use `@hugeicons/react` + `@hugeicons/core-free-icons` exclusively. All icons at `size={16}` `strokeWidth={1.5}` unless a spec says otherwise. Use `color="currentColor"` so icons inherit the parent text color token.

```tsx
import { Share01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

<HugeiconsIcon icon={Share01Icon} size={16} strokeWidth={1.5} color="currentColor" />
```

Remove `lucide-react` from `package.json` — it is not used.

---

## API — Chat Stream

Two routing modes. Use one per request, never both:

```ts
// Souvenir auto-routing
{ algorithm: 'base' | 'pro', input: string, ...rest }

// Direct model selection
{ model_id: '<uuid>', input: string, ...rest }
```

Full request shape and SSE event format in `docs/features/chat-board.md`.

---

## Chat State Machine (summary)

10 phases. Full state diagram and per-phase render spec in `docs/features/chat-board.md`.

```
idle → user-sent → routing → thinking → model-chosen
                                      → researching (Research mode only)
                                      → streaming → complete
                 → error (inline, non-blocking — appears anywhere after user-sent)
```

---

## Key File Paths

```
src/
├── app/(app)/chat/page.tsx        ← Chat Board entry point
├── components/
│   ├── chat/                      ← All chat UI components
│   ├── layout/                    ← AppLayout, LeftSidebar, TopBar
│   └── [ComponentName]/           ← KDS component copies (one folder per component)
├── hooks/                         ← Feature hooks
│   ├── use-streaming-chat.ts      ← SSE streaming (done)
│   └── use-chat-state.ts          ← Chat phase state machine
├── lib/
│   ├── config.ts                  ← API endpoints
│   ├── plan-config.ts             ← Plan gates + credit math
│   ├── streaming.ts               ← SSE text merge util
│   ├── thinking.ts                ← <think> tag extractor
│   ├── api/client.ts              ← apiFetch + 401 auto-retry
│   └── normalizers/               ← message-transformer, normalize-utils
docs/
├── 0-pending-kds-components.md   ← Prop contracts + placeholder code for 8 pending components
├── 1-component-copy-guide.md     ← How to copy from KDS correctly
├── 2-master-concept-map.md       ← Full system Mermaid diagram (paste into FigJam)
├── animation-states.md           ← Framer Motion patterns + spring configs
├── response-types.md             ← Simple / Research / Error response variants
├── error-states.md               ← E1, E2 error rendering rules
└── features/
    ├── chat-board.md             ← Chat Board: state machine, components, API wiring
    └── left-sidebar.md           ← Left Sidebar: components, state, API
```
