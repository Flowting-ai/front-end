# Animation States

All motion in V2 uses Framer Motion 12. CSS transitions only for surface-level interactions (hover background, border color). Everything structural (mount/unmount, height, stagger) uses Framer Motion.

---

## Duration Scale (from KDS)

| Name | Value | Use |
|------|-------|-----|
| `instant` | 100ms | Hover background, icon color changes |
| `fast` | 150ms | Press states, closing transitions |
| `default` | 200ms | Content fade/slide, opacity changes |
| `moderate` | 280ms | Height/layout changes — expand/collapse |

Closing is always 50–100ms shorter than opening to feel snappy.

---

## Easing Scale

| Name | Value | Use |
|------|-------|-----|
| `ease` | `ease` | Simple opacity/color transitions |
| `layout` | `cubic-bezier(0.4, 0, 0.2, 1)` | Height, width, position changes |

---

## Spring Configs (chat-specific)

Use these spring objects for chat UI animations. Do not invent new spring values.

```ts
export const springs = {
  fast:     { type: 'spring', stiffness: 500, damping: 30 },
  moderate: { type: 'spring', stiffness: 300, damping: 28 },
  slow:     { type: 'spring', stiffness: 260, damping: 28 },
} as const
```

---

## Pattern 1 — Expand / Collapse (three layers)

Used for: ReasoningBlock, SidebarProjectsSection, any collapsible section.

**Critical:** height animation and stagger orchestration must live on separate `motion.div`s — combining on one element causes them to conflict.

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

const heightVariants = {
  open:   { height: 'auto', transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } },
  closed: { height: 0,      transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1], delay: 0.14 } },
}

const staggerVariants = {
  open:   { transition: { staggerChildren: 0.055, delayChildren: 0.06 } },
  closed: { transition: { staggerChildren: 0.045, staggerDirection: -1 } },
}

const itemVariants = {
  open:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: 'easeIn' } },
}

function CollapsibleSection({ isOpen, children }) {
  const [overflow, setOverflow] = useState<'hidden' | 'visible'>('hidden')

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div                                   // Layer 1 — height clip
          key="content"
          initial="closed" animate="open" exit="closed"
          variants={heightVariants}
          style={{ overflow }}
          onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
          onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
        >
          <motion.div variants={staggerVariants}>    {/* Layer 2 — stagger */}
            {React.Children.map(children, (child, i) => (
              <motion.div key={i} variants={itemVariants}> {/* Layer 3 — per item */}
                {child}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

---

## Pattern 2 — Text Swap (in-place label change)

Used for: model chip label in TopBar, status labels that change while visible.

```tsx
import { AnimatePresence, motion } from 'framer-motion'

function AnimatedLabel({ label }: { label: string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={label}
        initial={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
        animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
        exit={{    opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{ display: 'inline-block' }}
      >
        {label}
      </motion.span>
    </AnimatePresence>
  )
}
```

---

## Pattern 3 — Message Appear

New messages (both user and assistant) slide up and fade in when they mount.

```tsx
const messageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

function MessageBubble({ children }) {
  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
  )
}
```

---

## Pattern 4 — Streaming Cursor

A blinking cursor shown at the end of streaming text. Pure CSS — no Framer Motion.

```tsx
function StreamingCursor() {
  return <span className="streaming-cursor" />
}
```

```css
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-text-primary);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: svCursorBlink 700ms ease-in-out infinite;
}

@keyframes svCursorBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

Remove the cursor element (or set `isStreaming={false}`) when the `text_end` SSE event arrives.

---

## Pattern 5 — Research Sources Load (one by one)

Each source card in the ResearchPanel fades in sequentially as `research_source` SSE events arrive. No stagger variant needed — the natural SSE timing provides the stagger.

```tsx
function SourceCard({ source, index }: { source: Source; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay: index * 0.06 }}
    >
      {/* source content */}
    </motion.div>
  )
}
```

When `research_end` fires, animate the panel collapsing to a pill:

```tsx
<motion.div
  animate={isCollapsed ? { height: 36, opacity: 0.8 } : { height: 'auto', opacity: 1 }}
  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
>
```

---

## Pattern 6 — Routing / Thinking Label (TopBar Souvenir logo area)

During `routing` and `thinking` phases, the TopBar shows a status label next to the Souvenir mark. The label changes as phases advance. Use Pattern 2 (Text Swap) for the label transitions.

Labels by phase:
- `routing` → "Routing…"
- `thinking` → "Thinking…"
- `model-chosen` → model name (e.g. "GPT-4o")
- `researching` → "Searching web…"
- `streaming` → model name (static)
- `complete` → model name (static)

---

## AnimatePresence Rules

1. **Always `initial={false}`** on `AnimatePresence` unless you specifically want mount animation on first render. Without it, every component animates in on page load.

2. **Use `mode="popLayout"`** for text swaps (labels, status chips) — it prevents layout jump when old content exits.

3. **Use `mode="wait"`** only when you need the exiting element to fully leave before the entering one appears. Avoid it for most cases — it creates noticeable delay.

4. **`key` must change** for AnimatePresence to detect a swap. If the key doesn't change, no animation fires.

---

## What NOT to animate

- Simple hover backgrounds → use CSS `transition: background-color 150ms ease`
- Icon color changes on hover → CSS
- Input focus ring → CSS
- Loading spinners → CSS `animation` keyframe
- Skeleton shimmer → CSS keyframe (see `svLabelShimmer` in prototype globals.css)
