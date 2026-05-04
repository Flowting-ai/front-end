# Component Copy Guide

How to bring a Kaya DS component into the V2 codebase. Read this before touching anything in `/tmp/kaya-ds/`.

---

## Why copy instead of import?

Importing from the KDS package couples your feature logic to the DS release cycle. If Utkarsh changes a prop name or refactors internals, your feature breaks. Copying creates a local snapshot:

- Your feature logic never breaks from upstream DS changes
- When Utkarsh ships a visual update, you copy again and merge — one file diff
- Storybook tests stay in the DS repo where they belong
- The copy is the contract: the file you copy is exactly what Utkarsh intended

---

## The 3-Step Process

### Step 1 — Locate the source

KDS source is at `/tmp/kaya-ds/src/components/[ComponentName]/`. Every component has:
```
[ComponentName]/
├── index.tsx       ← the component itself
├── types.ts        ← prop interfaces (sometimes inlined in index.tsx)
└── [ComponentName].stories.tsx  ← do NOT copy this
```

### Step 2 — Copy verbatim, zero modifications

```bash
# Example: copying Button
cp -r /tmp/kaya-ds/src/components/Button/index.tsx src/components/Button/index.tsx
```

Rules during the copy:
- Do not rename props
- Do not change the visual JSX or CSS
- Do not add business logic (no API calls, no store access, no routing)
- Do not change import paths yet — fix those in Step 3
- Do not copy `.stories.tsx` files

### Step 3 — Fix internal imports only

KDS components import from:
- `../../tokens/...` → point to your local token CSS (already imported globally)
- Other KDS components → point to your local copies of those
- `@strange-huge/icons` → leave as-is (already in your dependencies — wait, actually use `@hugeicons/react` per CLAUDE.md)
- `framer-motion` → leave as-is

After copying, run `tsc --noEmit` to catch any broken import paths. Fix those — nothing else.

---

## The Wrapper Pattern (adding business logic)

Never add logic directly into the copied component. Instead, create a wrapper:

```
src/components/Button/
├── index.tsx          ← copied from KDS verbatim, never touched
└── AppButton.tsx      ← your wrapper with business logic
```

```tsx
// AppButton.tsx — business logic lives here, not in index.tsx
import { Button } from './index'

export function DeleteChatButton({ chatId }: { chatId: string }) {
  const { deleteChat, isDeleting } = useChatOperations()

  return (
    <Button
      variant="destructive"
      size="sm"
      loading={isDeleting}
      onClick={() => deleteChat(chatId)}
    >
      Delete
    </Button>
  )
}
```

When Utkarsh ships a Button update, you copy the new `index.tsx`. `AppButton.tsx` is untouched.

---

## The Hook Pattern (stateful behavior)

For components with complex state (ChatInput, ModelSelector, etc.), extract state into a hook and keep the component presentational:

```
src/components/ChatInput/
├── index.tsx           ← KDS copy
└── useChatInputState.ts ← your hook

src/hooks/
└── use-chat-input.ts   ← orchestration hook (connects to store, API, etc.)
```

```tsx
// Page-level: hook orchestrates, component renders
function ChatBoard() {
  const chatInput = useChatInput({ chatId })

  return (
    <ChatInput
      value={chatInput.value}
      onChange={chatInput.onChange}
      onSubmit={chatInput.onSubmit}
      disabled={chatInput.isStreaming}
      attachments={chatInput.attachments}
    />
  )
}
```

---

## When KDS ships an update

1. Read the KDS changelog or ask Utkarsh what changed
2. Copy the new `index.tsx` over the old one
3. Run `tsc --noEmit` — fix any new import paths
4. If props changed, update your wrapper (AppButton, etc.) — not the copied source
5. Done. Feature logic is untouched.

---

## Checklist before shipping a copied component

- [ ] Source file is byte-for-byte identical to KDS (no visual changes)
- [ ] `.stories.tsx` was not copied
- [ ] Import paths fixed (internal KDS cross-references point to local copies)
- [ ] Business logic is in a wrapper or hook, not in the copied file
- [ ] No hex values added during integration
- [ ] `tsc --noEmit` passes

---

## Components that need special handling

### ChatInput

Has internal state for attachment management. The KDS version is headless for attachments — you control the attachment array. Use `use-chat-input.ts` hook to manage files, pin mentions, and the tone selector state.

### Sidebar + SidebarMenuItem

The KDS Sidebar provides the container and collapse/expand logic. `SidebarMenuItem` handles the hover animations. Your `LeftSidebar.tsx` wraps the KDS Sidebar and maps chat history into `SidebarMenuItem` instances. See `docs/features/left-sidebar.md`.

### PresetModelSelector

Wraps three separate KDS components: `ModelSelectItem` (individual option), `ModelFeaturedCard` (highlighted model), and the selector shell. Copy all three. Your wrapper handles the `model_id` → API stream routing.

---

## What not to copy

| File | Reason |
|------|--------|
| `*.stories.tsx` | Storybook stays in KDS |
| `*.test.tsx` | Tests stay in KDS |
| `tokens/` directory | Already imported globally via `globals.css` |
| `CLAUDE.md` inside KDS | That's Utkarsh's instructions, not yours |
