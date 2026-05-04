# Feature: TopBar

The persistent top navigation bar on the Chat Board. Shows the current chat context, routing phase status, and global chat actions.

**Component:** `src/components/layout/TopBar.tsx`  
**KDS pending components used:** `ShareButton` · `UserNameDisplay` · `UsageCreditsButton`  
**KDS ready components used:** `Dropdown` · `DropdownSection` · `DropdownMenuItem` · `ModelSelectItem` · `Popover`

---

## Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⬡  [Status label / Model chip ▾]              [👻]  [↗]  [◎]  [avatar]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Left cluster:** SouvenirMark + phase status label / model chip (clickable dropdown when not streaming)  
**Right cluster (left → right):** Ghost toggle · Share button · Usage ring button · User avatar

---

## Component Tree

```
TopBar
├── [left]
│   ├── SouvenirMark                              ← link to /chat (new chat)
│   └── ModelChip                                 ← animated label via Pattern 2
│       └── ModelDropdown (on click, not during streaming)
│           ├── DropdownSection "Auto-routing"
│           │   ├── DropdownMenuItem "Base"
│           │   └── DropdownMenuItem "Pro"
│           └── DropdownSection "Direct models"
│               └── [per model] ModelSelectItem   ← KDS ready
│
└── [right]
    ├── GhostIconButton                            ← disposable mode toggle
    ├── ShareButton (pending KDS)                  ← hidden until first complete message
    ├── UsageCreditsButton (pending KDS)           ← credits ring icon
    └── UserAvatar or UserNameDisplay (pending KDS)
```

---

## Phase Status Label / Model Chip

The left label swaps as the chat progresses. Use **Pattern 2** (AnimatePresence `mode="popLayout"`, key=label) from `docs/animation-states.md`.

| Phase | Label | Clickable? |
|-------|-------|-----------|
| `idle` | "Auto" | Yes |
| `user-sent` | "Auto" | No |
| `routing` | "Routing…" | No |
| `thinking` | "Thinking…" | No |
| `model-chosen` | model name e.g. "Claude Sonnet" | Yes |
| `researching` | "Searching web…" | No |
| `streaming` | model name (static) | No |
| `complete` | model name | Yes |
| `error` | model name if known, else "Auto" | Yes |

**When clickable:** add `ArrowDown01Icon` (16px) to the right of the label, `cursor: pointer`.  
**When non-interactive:** no chevron, `pointer-events: none`, `cursor: default`.  
**Idle default:** "Auto" maps to `{ type: 'algorithm', value: 'base' }` until the user changes it.

---

## Model Change Dropdown

**Opens:** click on ModelChip when in a clickable phase (never during `routing` / `thinking` / `researching` / `streaming`).

**KDS components:** `Dropdown` + `DropdownSection` + `DropdownMenuItem` (all ready — copy from KDS). Individual model rows use `ModelSelectItem` (ready).

**Groups:**

```
Auto-routing
  ●  Base   — fast everyday tasks          algorithm: 'base'
     Pro    — complex multi-step reasoning  algorithm: 'pro'

Direct models  (from GET /llm/models)
     Claude Sonnet 4.5    [Anthropic]    [context]
  🔒  Claude Opus 4.7     [Power plan]             ← locked for Starter/Pro
     GPT-4o               [OpenAI]
     ...
```

- Current selection has a filled bullet `●`
- Power-only models: `LockIcon` (16px) left of name + "Power plan" badge; `disabled={true}` on the `DropdownMenuItem`; tooltip on hover: "Available on Power plan"
- `ModelSelectItem` props: `modelName`, `provider`, `contextLength`, `isSelected`, `isLocked`

**Switching behavior:**
- Store selection as `modelSelection: AlgorithmSelection | DirectSelection`
  ```ts
  type AlgorithmSelection = { type: 'algorithm'; value: 'base' | 'pro' }
  type DirectSelection    = { type: 'model'; modelId: string; modelName: string }
  ```
- Selection takes effect on the **next** `sendMessage` call — does not abort the current stream
- If switched mid-conversation: show a one-time `Badge` chip below the model chip: "Next message uses [model name]"  
  Dismiss it when the next stream starts
- During streaming: dropdown trigger is `disabled` + `pointer-events: none`

**API:**
```ts
GET /llm/models
// Fetch on mount. Cache for the session.
// Response: { models: { id, name, provider, context_length, plan_required }[] }
```

Pass selection to the stream request:
```ts
// Algorithm mode
{ algorithm: modelSelection.value, input, ... }

// Direct model mode
{ model_id: modelSelection.modelId, input, ... }
```

---

## Disposable Chat Mode

A per-chat incognito mode. The chat is not saved to history and memory is not referenced.

**Toggle:** `GhostIconButton` in the right cluster.
- Icon: `Ghost01Icon` (HugeIcons, 16px)
- Off state: outline style, `color: var(--color-text-subtle)`
- On state: filled/tinted, `color: var(--color-text-primary)`, active ring

**When disposable ON:**

1. **Disposable banner** appears directly below the TopBar:
   ```
   ┌─────────────────────────────────────────────────────────┐
   │  👻  This chat won't be saved  ·  [Save this chat]      │
   └─────────────────────────────────────────────────────────┘
   ```
   - Background: `var(--color-surface-subtle)`
   - Border-bottom: `1px solid var(--color-border-subtle)`
   - Animate in: `y: -8 → 0`, `opacity: 0 → 1`, 200ms `easeOut` (Framer Motion)
   - Animate out: `y: 0 → -8`, `opacity: 1 → 0`, 150ms `easeIn`

2. **"Save this chat" CTA:**
   - Logged-in user: sets `isDisposable = false`; chat is saved normally; banner dismisses
   - Logged-out user: navigate to `/auth/login?returnTo=/chat&saveChat=true`

3. **UserAvatar** is replaced by `UserNameDisplay` showing a random anonymous name  
   (e.g. "Quiet Hawk", "Brave Finch" — generate once on activation, persist for the session)

**When disposable OFF:** Ghost icon reverts to outline, banner dismisses, avatar restored.

**State:** `isDisposable` is local React state — not persisted to the API. A disposable chat still sends stream requests normally; it just isn't saved to `GET /chats` history.

---

## Share Button

**Component:** `ShareButton` (pending KDS — placeholder in `docs/0-pending-kds-components.md`)

**Visibility:** Hidden until `hasCompletedMessage === true` (at least one message has reached the `complete` phase). Use `visibility: hidden` not `display: none` to avoid layout shift. Fade in with `opacity: 0 → 1, 150ms ease` when it first becomes visible.

**On click — Share Modal:**
```
┌──────────────────────────────────────────────┐
│  Share this chat                          ✕  │
│  ────────────────────────────────────────    │
│  [https://getsouvenir.com/chat/abc123]  Copy │
│                                              │
│  ○ Public   ● Private                        │
│                                              │
│  Anyone with the link can view this          │
│  conversation (read-only).                   │
└──────────────────────────────────────────────┘
```

- Default: **Private** (link is not live; Copy is disabled until toggled to Public)
- Toggle to Public: `PATCH /chats/{chatId}` → `{ is_public: true }` → Copy becomes active
- Toggle to Private: `PATCH /chats/{chatId}` → `{ is_public: false }` → link deactivated
- **Copy button:** `navigator.clipboard.writeText(`https://getsouvenir.com/chat/${chatId}`)`  
  After copy: button label flips to "Copied!" for 1.5s (Pattern 2 text swap)
- No plan gating — available on all plans

> **Note for Shyam:** Confirm that `is_public` field and the `PATCH /chats/{chatId}` endpoint exist in Sahil's API before implementing the Public/Private toggle. If not yet available, implement Copy only (copies the current URL) and add a `// TODO(api): add is_public toggle when Sahil ships it` comment.

---

## UsageCreditsButton

**Component:** `UsageCreditsButton` (pending KDS — placeholder in `docs/0-pending-kds-components.md`)

**Visual:** Icon button with a circular SVG progress ring. The arc fills clockwise as credits are consumed.

**Ring color thresholds:**
| Usage | Ring color |
|-------|-----------|
| 0–75% used | `var(--color-text-subtle)` (neutral) |
| 75–90% used | `var(--color-status-warning)` (amber) |
| 90–100% used | `var(--color-status-error)` (red) |

**Click → Popover** (use `Popover` KDS component, ready):
```
┌──────────────────────────────────────┐
│  Starter plan                        │
│  ────────────────────────────────    │
│  3,240 / 5,000 credits used          │
│  Resets June 1, 2026                 │
│  ────────────────────────────────    │
│  [Upgrade plan →]                    │
└──────────────────────────────────────┘
```

- Use `formatCredits(remaining)` and `formatCredits(total)` from `plan-config.ts`
- "Resets" date: from `usage.reset_at` (ISO string from API)
- "Upgrade plan" link → `/settings/usage-and-billing/change-plan`  
  Only show this link for Starter and Pro — hide on Power
- **In disposable mode:** replace "Resets June 1" with "Session only"

**Existing prop contract** (from `docs/0-pending-kds-components.md`):
```ts
UsageCreditsButtonProps {
  plan: UserPlanType | null;    // from useAuth()
  usage: UserUsage | null;      // monthly_used from GET /users/me/usage
  onClick: () => void;
}
```

---

## State

| State | Source | Notes |
|-------|--------|-------|
| `chatPhase` | `use-chat-state.ts` | Drives label + chip interactivity |
| `modelSelection` | Local state | Current algorithm or direct model selection |
| `availableModels` | `GET /llm/models` | Fetched once on mount |
| `isDisposable` | Local state | Per-chat disposable flag |
| `hasCompletedMessage` | Derived | `messages.some(m => m.phase === 'complete')` |
| `plan` | `useAuth()` | User's plan tier |
| `usage` | `GET /users/me/usage` | Refresh after each stream completes |

---

## API Wiring

```ts
// On mount
GET /llm/models          → availableModels (model dropdown)
GET /users/me/usage      → usage (credits button)

// After every stream complete
GET /users/me/usage      → refresh credits (cost was just incurred)

// Share modal — public/private toggle
PATCH /chats/{chatId}    → { is_public: boolean }
```

---

## Animations

| Element | Pattern | Spec |
|---------|---------|------|
| Model chip label swap | Pattern 2 (text swap) | `AnimatePresence mode="popLayout"`, key = label string |
| Disposable banner in | Framer Motion | `y: -8 → 0`, `opacity: 0 → 1`, 200ms `easeOut` |
| Disposable banner out | Framer Motion | `y: 0 → -8`, `opacity: 1 → 0`, 150ms `easeIn` |
| Share button appear | CSS | `opacity: 0 → 1`, 150ms `ease` |
| "Copied!" label swap | Pattern 2 (text swap) | Same as model chip |
| Hover backgrounds | CSS only | `transition: background-color 100ms ease` |
| Popover open/close | KDS internal | Do not re-implement |
