# Pending KDS Components

**Read this before touching anything in `src/components/`.**

These components don't exist in Kaya Design System yet. Utkarsh is building them — ETAs TBD. Until they ship, you build a placeholder that is shaped exactly like the real component will be. When the real one ships, you swap the import. No other change needed.

---

## Component Index

### Chat UI (Components 1–8)

| # | Component | Blocks | Placeholder |
|---|-----------|--------|-------------|
| 1 | `MessageBubble` | Chat message display | Aligned div, passes children through |
| 2 | `StreamingIndicator` | Typing indicator | Three pulsing dots |
| 3 | `ClarifyingQuestion` | Ambiguous prompt UX | Label + option chips |
| 4 | `HighlightPopover` | Text selection actions | Returns null |
| 5 | `ComparePanel` | Compare Models (pro/power) | Returns null |
| 6 | `ShareButton` | TopBar share icon | HugeIcons ghost button |
| 7 | `UserNameDisplay` | TopBar anonymous name | Name pill |
| 8 | `UsageCreditsButton` | TopBar credits meter | Credits pill via `usageToCredits()` |

### Pinboard (Components 9–12)

| # | Component | Blocks | Placeholder |
|---|-----------|--------|-------------|
| 9 | `FilterMenu` | Filter button interaction | Checkbox list in a floating div |
| 10 | `SortMenu` | Sort button interaction | Radio list + direction toggle |
| 11 | `ContextMenu` | Right-click on Pin | Returns null (children pass through) |
| 12 | `EmptyState` | Zero results / no pins | Centered div with icon + heading + CTA |
| 13 | `HighlightBoard` | Text highlight panel | Returns null — design not started |

---

## Rules for every placeholder

**1. TODO comment format — use this verbatim:**
```tsx
// TODO(kds): Replace with KDS <ComponentName> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders [brief description of what it shows].
```

**2. Never hardcode hex values.** Use CSS custom properties from the token system:
```tsx
// WRONG
color: '#26211E'
background: '#EDE1D7'

// RIGHT
color: 'var(--color-text-primary)'
background: 'var(--color-surface-subtle)'
```
See the [dark mode section](#dark-mode-rules) at the bottom of this file.

**3. Copy KDS components as-is.** When you copy an existing KDS component into this repo (Button, Sidebar, etc.), do not visually modify it. Add a business-logic wrapper or hook on top instead. This keeps KDS visual updates mergeable.

**4. Prop shapes below are the final contract.** Build your placeholder to accept exactly these props, even if you don't use all of them yet. When Utkarsh ships the real component, you're swapping one import line — not refactoring call sites.

---

## Component 1 — MessageBubble

**What it is:** The rendered container for a single chat message. Handles both user messages (right-aligned, filled background) and assistant messages (left-aligned, no background). Controls padding, max-width, avatar placement, and selection state.

**What to render now:** A plain `<div>` with correct alignment, a small avatar dot placeholder on the left for assistant messages, and the `children` content inside.

```tsx
// TODO(kds): Replace with KDS <MessageBubble> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders a left/right-aligned div with children passed through.

export interface MessageBubbleProps {
  role: 'user' | 'assistant';
  isSelected?: boolean;
  onSelect?: () => void;
  children: React.ReactNode;
}

export function MessageBubble({ role, isSelected, onSelect, children }: MessageBubbleProps) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
        padding: '4px 0',
        outline: isSelected ? '2px solid var(--color-border-focus)' : 'none',
        borderRadius: 12,
      }}
    >
      <div style={{ maxWidth: '72%' }}>
        {children}
      </div>
    </div>
  );
}
```

---

## Component 2 — StreamingIndicator

**What it is:** The animated "thinking" or "typing" indicator shown while the model is streaming a response. Three dots that pulse in sequence, or a single animated bar — TBD by Utkarsh. It appears inside the assistant MessageBubble before any text arrives.

**What to render now:** Three small dots with a simple CSS opacity animation.

```tsx
// TODO(kds): Replace with KDS <StreamingIndicator> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders three animated dots.

export interface StreamingIndicatorProps {
  size?: 'sm' | 'md';
}

export function StreamingIndicator({ size = 'md' }: StreamingIndicatorProps) {
  const dotSize = size === 'sm' ? 5 : 7;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 0' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: 'var(--color-text-subtle)',
            animation: `svDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// Add to your global CSS:
// @keyframes svDotPulse { 0%, 80%, 100% { opacity: 0.25 } 40% { opacity: 1 } }
```

---

## Component 3 — ClarifyingQuestion

**What it is:** An inline prompt card the assistant surfaces when the user's request is ambiguous. Shows 2–4 option chips the user can tap instead of typing a reply. Appears inside the message stream, not as a blocking modal.

**What to render now:** A `<div>` with a label and a row of plain `<button>` chips. Each chip calls `onSelect` with its value.

```tsx
// TODO(kds): Replace with KDS <ClarifyingQuestion> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders a label + row of tappable option chips.

export interface ClarifyingOption {
  id: string;
  label: string;
}

export interface ClarifyingQuestionProps {
  question: string;
  options: ClarifyingOption[];
  onSelect: (optionId: string) => void;
  disabled?: boolean;
}

export function ClarifyingQuestion({ question, options, onSelect, disabled }: ClarifyingQuestionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0' }}>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>{question}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => !disabled && onSelect(opt.id)}
            disabled={disabled}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-surface-default)',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              cursor: disabled ? 'default' : 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## Component 4 — HighlightPopover

**What it is:** A floating tooltip/popover that appears when the user selects text in an assistant message. Shows actions: copy, cite, add to pin, compare. Anchored to the selection bounding box.

**What to render now:** Return `null` for now. This is purely an enhancement — nothing breaks without it. Add the prop contract so the call site is ready.

```tsx
// TODO(kds): Replace with KDS <HighlightPopover> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders nothing — selection UX is purely additive.

export interface HighlightPopoverProps {
  anchorRect: DOMRect | null;
  selectedText: string;
  onCopy: () => void;
  onAddToPin: () => void;
  onCompare?: () => void;
  onClose: () => void;
}

export function HighlightPopover(_props: HighlightPopoverProps) {
  // Replace with KDS component when shipped
  return null;
}
```

---

## Component 5 — ComparePanel

**What it is:** A side-by-side panel that lets the user run the same prompt against two models simultaneously. It slides in from the right or expands below the current message. This is a `pro`/`power` plan feature — gate it with `canAccessFeature(plan, 'modelCompare')`.

**What to render now:** Return `null`. This is a post-launch feature. Include the prop contract so the trigger wiring is already correct when it ships.

```tsx
// TODO(kds): Replace with KDS <ComparePanel> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders nothing — gate with canAccessFeature(plan, 'modelCompare').

export interface ComparePanelProps {
  isOpen: boolean;
  onClose: () => void;
  originalPrompt: string;
  primaryModelId: string;
  compareModelId: string | null;
  onCompareModelChange: (modelId: string) => void;
}

export function ComparePanel(_props: ComparePanelProps) {
  // Replace with KDS component when shipped
  return null;
}
```

---

## Component 6 — ShareButton (TopBar icon)

**What it is:** An icon button in the top-right corner of the chat board. Clicking it opens a share sheet (copy link, etc.). One of two new icons being added to the top bar. Lives next to the anonymous name display.

**What to render now:** A plain icon button using HugeIcons `Share01Icon` (or `ShareLocation01Icon`). Calls `onClick`. Full KDS `IconButton` wrapping comes when the component is spec'd by Utkarsh.

```tsx
// TODO(kds): Replace with KDS <ShareButton> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders a HugeIcons share icon button.

import { Share01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

export interface ShareButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ShareButton({ onClick, disabled }: ShareButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 8,
        border: 'none',
        background: 'transparent',
        color: 'var(--color-text-subtle)',
        cursor: disabled ? 'default' : 'pointer',
      }}
      aria-label="Share chat"
    >
      <HugeiconsIcon icon={Share01Icon} size={16} strokeWidth={1.5} />
    </button>
  );
}
```

---

## Component 7 — UserNameDisplay (TopBar anonymous name)

**What it is:** Displays the user's name or an anonymous placeholder in the top bar of the chat board. When the user hasn't set a display name, shows a friendly anonymous label ("Anonymous Hawk", "Guest", etc.). Second icon/label in the top-right corner cluster alongside ShareButton.

**What to render now:** Read `first_name` from `UserProfile`. If null, show "Anonymous". Wrap in a small pill with a person icon.

```tsx
// TODO(kds): Replace with KDS <UserNameDisplay> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders first_name or "Anonymous" in a small text pill.

import { UserIcon } from '@hugeicons/core-free-icons'; // or User01Icon
import { HugeiconsIcon } from '@hugeicons/react';

export interface UserNameDisplayProps {
  firstName: string | null;
  lastName?: string | null;
  onClick?: () => void;
}

export function UserNameDisplay({ firstName, lastName, onClick }: UserNameDisplayProps) {
  const displayName = firstName
    ? [firstName, lastName].filter(Boolean).join(' ')
    : 'Anonymous';

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 20,
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-subtle)',
        color: 'var(--color-text-secondary)',
        fontSize: 13,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <HugeiconsIcon icon={UserIcon} size={14} strokeWidth={1.5} />
      {displayName}
    </button>
  );
}
```

---

## Component 8 — UsageCreditsButton (TopBar)

**What it is:** A button in the top navigation bar that shows the user's remaining credits for the month. Clicking it opens a popover or navigates to `/settings/billing`. The credit system maps `$1 → 1000 credits`. Use `usageToCredits()` from `plan-config.ts` — do not reimplement the conversion math.

**Credit totals by plan:**
- `starter`: 5,000 credits/month
- `pro`: 12,000 credits/month  
- `power`: 60,000 credits/month

**What to render now:** A pill button showing `{remaining} credits`. If `usage` is null (not yet loaded), show a loading skeleton. Gate the display on the user having a plan (`plan_type !== null`).

```tsx
// TODO(kds): Replace with KDS <UsageCreditsButton> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders a credits pill using usageToCredits() from plan-config.ts.

import { usageToCredits, formatCredits } from '@/lib/plan-config';
import type { UserPlanType, UserUsage } from '@/lib/api/user';

export interface UsageCreditsButtonProps {
  plan: UserPlanType | null;
  usage: UserUsage | null;
  onClick: () => void;
}

export function UsageCreditsButton({ plan, usage, onClick }: UsageCreditsButtonProps) {
  if (!plan) return null;

  const loading = usage === null;
  const credits = loading
    ? null
    : usageToCredits(plan, usage.monthly_used);

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 20,
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-subtle)',
        color: loading ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
        fontSize: 13,
        cursor: 'pointer',
        minWidth: 100,
      }}
      aria-label="View usage and credits"
    >
      {loading
        ? 'Loading…'
        : `${formatCredits(credits!.remaining)} credits`}
    </button>
  );
}
```

---

## Component 9 — FilterMenu (Pinboard filter dropdown)

**What it is:** A multi-select dropdown triggered by the Filter button in Pinboard and PinboardExpanded. Lets the user select one or more filter values (category type, label color, etc.). The existing `Dropdown` is single-select only — this extends it with checkbox semantics and a selected-count badge on the trigger.

**What to render now:** A plain `<div>` floating panel with a list of checkboxes. No animation. Close on outside click.

```tsx
// TODO(kds): Replace with KDS <FilterMenu> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders a basic checkbox list in a floating div.

export interface FilterMenuOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface FilterMenuProps {
  options: FilterMenuOption[];
  selected: string[];                          // array of option ids
  onSelectionChange: (selected: string[]) => void;
  onClear: () => void;
  trigger: React.ReactNode;                    // the button that opens the menu
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilterMenu({
  options,
  selected,
  onSelectionChange,
  onClear,
  trigger,
  open,
  onOpenChange,
}: FilterMenuProps) {
  function toggle(id: string) {
    onSelectionChange(
      selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 50,
            background: 'var(--color-surface-default)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 10,
            padding: '8px 0',
            minWidth: 200,
          }}
        >
          {options.map(opt => (
            <label
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                color: 'var(--color-text-primary)',
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => toggle(opt.id)}
              />
              {opt.icon}
              {opt.label}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              onClick={onClear}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-subtle)',
                fontSize: 13,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**When KDS ships:** The real component will use `DropdownMenuItem` with checkbox variant, stagger animation, and a selected-count badge on the trigger button.

---

## Component 10 — SortMenu (Pinboard sort dropdown)

**What it is:** A single-select sort dropdown triggered by the Sort button in Pinboard and PinboardExpanded. Lets the user pick a sort field (Date, Title, Category) and toggle ascending/descending. Semantically different from FilterMenu — only one sort can be active at a time.

**What to render now:** A plain floating `<div>` with radio buttons and a direction toggle.

```tsx
// TODO(kds): Replace with KDS <SortMenu> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders a basic radio list with an asc/desc toggle.

export type SortField = 'date_created' | 'date_updated' | 'title' | 'category';
export type SortDirection = 'asc' | 'desc';

export interface SortMenuProps {
  field: SortField;
  direction: SortDirection;
  onChange: (field: SortField, direction: SortDirection) => void;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'date_updated', label: 'Last updated' },
  { value: 'date_created', label: 'Date created' },
  { value: 'title',        label: 'Title' },
  { value: 'category',     label: 'Category' },
];

export function SortMenu({ field, direction, onChange, trigger, open, onOpenChange }: SortMenuProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 50,
            background: 'var(--color-surface-default)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 10,
            padding: '8px 0',
            minWidth: 200,
          }}
        >
          {SORT_OPTIONS.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                color: 'var(--color-text-primary)',
                fontSize: 14,
              }}
            >
              <input
                type="radio"
                name="sort-field"
                checked={field === opt.value}
                onChange={() => onChange(opt.value, direction)}
              />
              {opt.label}
            </label>
          ))}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '6px 12px',
              borderTop: '1px solid var(--color-border-subtle)',
              marginTop: 4,
            }}
          >
            {(['asc', 'desc'] as const).map(d => (
              <button
                key={d}
                onClick={() => onChange(field, d)}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border-default)',
                  background: direction === d ? 'var(--color-surface-subtle)' : 'transparent',
                  color: 'var(--color-text-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {d === 'asc' ? '↑ Oldest first' : '↓ Newest first'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Component 11 — ContextMenu (right-click on Pin)

**What it is:** A floating context menu that appears on right-click (or long-press mobile) on a Pin card. Shows actions: Rename, Move to folder, Copy link, Delete. The `FloatingMenu` KDS component is for hover toolbars — this is a cursor-positioned right-click menu, which is a different pattern.

**What to render now:** Returns `null` (right-click interaction can be deferred until KDS ships it). Add a `// TODO(kds)` comment at the call site in the Pin wrapper.

```tsx
// TODO(kds): Replace with KDS <ContextMenu> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder returns null — right-click on Pin does nothing for now.

export interface ContextMenuAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export interface ContextMenuProps {
  actions: ContextMenuAction[];
  children: React.ReactNode;   // the element that responds to right-click
}

export function ContextMenu({ children }: ContextMenuProps) {
  // Placeholder: passes children through, right-click does nothing
  return <>{children}</>;
}
```

**Expected actions on a Pin (for Shyam's reference):**
```ts
const PIN_CONTEXT_ACTIONS = (pin, handlers) => [
  { id: 'rename',         label: 'Rename',          onClick: handlers.onRename },
  { id: 'move-to-folder', label: 'Move to folder',  onClick: handlers.onMoveToFolder },
  { id: 'copy-link',      label: 'Copy link',        onClick: handlers.onCopyLink },
  { id: 'delete',         label: 'Delete',           onClick: handlers.onDelete, variant: 'destructive' },
];
```

---

## Component 12 — EmptyState (zero results / no pins)

**What it is:** Shown inside the Pinboard when a filter or search returns zero results, or when the user has no pins at all. Displays an icon, a heading, an optional description, and an optional CTA button.

**What to render now:** A centered `<div>` with the icon, heading text, description, and a `Button` (KDS, ready) for the CTA.

```tsx
// TODO(kds): Replace with KDS <EmptyState> when shipped.
// Props interface below is the contract — do not change prop names.
// Placeholder renders a centered div with icon, heading, description, and optional CTA.

import { Button } from '@/components/Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <div style={{ color: 'var(--color-text-subtle)', marginBottom: 4 }}>
          {icon}
        </div>
      )}
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
        {title}
      </p>
      {description && (
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, maxWidth: 280 }}>
          {description}
        </p>
      )}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

**Call sites in Pinboard:**

| Condition | title | description | action |
|-----------|-------|-------------|--------|
| No pins at all | "No pins yet" | "Pin a message from any chat to save it here." | — |
| Search returns 0 | "No results for "{query}"" | "Try a different search term." | — |
| Filter returns 0 | "No pins match these filters" | — | `{ label: "Clear filters", onClick: onClearFilters }` |
| Folder is empty | "This folder is empty" | "Move pins here from the main view." | — |

---

## Component 13 — HighlightBoard (text highlight panel)

**What it is:** A compact side panel — similar in shape to the compact Pinboard — that holds saved text highlights from chat messages. A highlight is a user-selected text snippet (not a full message). The `HighlightPopover` (Component 4) is the popover that appears on text selection; HighlightBoard is where saved highlights live.

**Status:** Design not yet started. The `FloatingMenuItem` for Highlights exists in the FloatingMenu but is `disabled` with a `// TODO(design)` comment until this ships.

**What to render now:** Returns `null`. The FloatingMenuItem stays disabled.

```tsx
// TODO(kds): Replace with KDS <HighlightBoard> when designed and shipped.
// Props interface is TBD — design not yet started.
// Placeholder returns null. FloatingMenuItem for highlights is disabled.

export interface HighlightBoardProps {
  open: boolean;
  onClose: () => void;
  // Full props TBD when Chai locks the design
}

export function HighlightBoard(_props: HighlightBoardProps) {
  return null;
}
```

**Expected shape (for planning only — not final):**
- Similar to compact Pinboard (332px wide, fixed right panel)
- Each highlight card shows: selected text snippet + source message + chat name + timestamp
- Actions: copy text, delete, pin to Pinboard
- Separate from Pinboard — a message can have both a pin (full message) and highlights (excerpts)

**Do not implement this until Chai ships the design.**

---

## Dark Mode Rules

**Dark mode is coming after the Individual Chat Experience ships. Build correctly now so nothing needs rewriting later.**

### How the token system works

Three-layer system — never skip layers:

```
Primitives (raw hex values)     → primitives.css
    ↓
Aliases (intent-based tokens)   → aliases.css    ← light and dark modes live here
    ↓
Semantics (component tokens)    → semantic.css
    ↓
Your component code
```

The `class="dark"` on `<html>` is already scaffolded. The `.dark {}` block in `aliases.css` exists but is empty — it gets filled when the dark theme is designed. If you use only token references in your components, dark mode becomes a zero-code-change deploy. If you hardcode hex, every hardcoded value is a regression in dark mode.

### The rule

```tsx
// NEVER — will break in dark mode
style={{ color: '#26211E', background: '#EDE1D7' }}
className="text-[#26211E] bg-[#EDE1D7]"

// ALWAYS — survives dark mode automatically
style={{ color: 'var(--color-text-primary)', background: 'var(--color-surface-subtle)' }}
```

### Common token mappings

| Intent | Token | Light value |
|--------|-------|-------------|
| Primary text | `--color-text-primary` | `#26211E` (neutral-900) |
| Secondary text | `--color-text-secondary` | `#6A625D` (neutral-600) |
| Subtle text | `--color-text-subtle` | `#9C938B` (neutral-400) |
| Disabled text | `--color-text-disabled` | `#B6ACA4` (neutral-300) |
| Default surface | `--color-surface-default` | `#FFFFFF` |
| Subtle surface | `--color-surface-subtle` | `#F7F2ED` (neutral-50) |
| Default border | `--color-border-default` | `rgba(59,54,50,0.30)` |
| Subtle border | `--color-border-subtle` | `rgba(59,54,50,0.10)` |
| Focus border | `--color-border-focus` | blue accent |

If you need a token that doesn't exist yet, add it to `semantic.css` as a reference to an alias — do not hardcode the primitive.

### Icons in dark mode

Use `currentColor` for icon stroke/fill so they inherit the parent's text color token automatically:

```tsx
<HugeiconsIcon icon={SomeIcon} size={16} color="currentColor" strokeWidth={1.5} />
```

---

## Checklist before shipping any placeholder

- [ ] TODO comment in the exact format above
- [ ] Props interface matches this doc exactly (no renamed props)
- [ ] Zero hardcoded hex values — all colors via CSS tokens
- [ ] Icons use `currentColor` or a CSS token reference
- [ ] Component is exported from `src/components/ui/index.ts`
- [ ] If the component is plan-gated, it uses `canAccessFeature()` from `plan-config.ts`
