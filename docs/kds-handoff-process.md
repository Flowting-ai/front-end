# KDS Handoff Process — Design → Build → Front-End

How a component moves from Chai's Figma to Shyam/Kunal's screen. Written from Utkarsh's process doc (May 5, 2026).

---

## The Pipeline

```
Chai designs in Figma
        ↓
Utkarsh reads Figma via get_design_context (Figma MCP)
        ↓
Utkarsh builds in KDS repo → PR → merges to main
        ↓
Vercel auto-deploys Storybook (~2 min after merge)
        ↓
Shyam/Kunal git pull the KDS clone → dev server reload → component available
```

---

## What Chai Must Include in Every Figma Handoff

Utkarsh reads Figma via `get_design_context` (MCP tool). He does NOT eyeball screenshots — the code panel is the source of truth. These are the things he checks before starting a build. If any are missing, he blocks.

### States — must be exhaustive
Every variant in the Figma component's variant prop maps to code. He enumerates all of them first before writing a single line.

Required states to draw for every interactive component:
- `Default` · `Hover` · `Active` · `Selected` · `Disabled` · `Focus` · `Loading` · `Error`

**Why this matters:** `FloatingMenuItem` shipped without `active` because it was missing from the Figma variant list. Required a rework pass.

For MessageBubble specifically, draw all of:
- `idle` (empty/waiting)
- `streaming` (content arriving, cursor visible)
- `complete` (full message, no cursor)
- `error` (inline error state)
- `with-citations` (citation panel below)
- `with-attachments`
- `with-code-block`

### Spacing — character-for-character
Utkarsh copies padding values literally from the Figma code panel. `4px 38px 2px 34px` stays `4px 38px 2px 34px` — he never approximates to `4px 8px 2px 34px`. Asymmetric padding is almost always intentional (aligning something).

**If you see asymmetric padding in Figma:** add a note in the frame explaining what each side aligns to. Saves a question.

### Shadows
Copied character-for-character from Figma. Never omitted or simplified.

### Typography
Font family, weight, size, line-height, letter-spacing — all per text element. Cross-references:
- Besley → display/title
- Geist → body
- Geist Mono → code

### Tokens
Figma outputs `var(--neutral/700, #524b47)` patterns. Utkarsh reads these and maps them to the 4-layer token system. If a hex appears without a token, he either matches it to an existing primitive or creates a new one — he never inlines hex in components.

**If you're using a colour that doesn't have a token yet:** add a note in Figma saying "new token needed here." Don't just drop a raw hex.

### Icons
The Figma MCP returns icon nodes as image assets, not names. Utkarsh needs the exact layer name in Figma to look up the `@strange-huge/icons` export name. **If an icon doesn't exist in `@strange-huge/icons`, he stops and tells you — he does not inline an SVG from Figma.**

### Responsive / Layout
Mark clearly which dimension is fixed (e.g. `332px wide`) and which the consumer controls (e.g. `height: fill`). He reads `w-full` vs explicit pixel widths to know who owns the dimension.

### Overflow
Never add `overflow: hidden` unless you drew it in Figma. Utkarsh caused a shadow-clipping bug on Pinboard by adding overflow without Figma authority. If a clip is needed, put it in the design explicitly.

---

## Token System (4 Layers)

```
src/styles/tokens/
├── primitives.css   — raw values: --neutral-50: #f7f2ed;
├── aliases.css      — semantic-ish: --focus-ring: var(--blue-600);
├── semantic.css     — component tokens: --icon-button-default-bg-from: var(--neutral-100);
└── typography.css   — fonts, sizes, line-heights
```

**Rule:** Components reference semantic layer only. Never primitives directly. If a semantic token doesn't exist, Utkarsh creates one — one place to change, propagates to all consumers.

**Dark mode:** Token-level only. Components never have `.dark {}` blocks. When dark theme ships, no component code changes — only the primitive layer updates.

---

## How Utkarsh Uses Claude

1. **Scaffolding** — pastes `get_design_context` output + reference component → Claude generates TypeScript prop interface + JSX skeleton
2. **Spec authoring** — after component lands, Claude drafts both spec files from source code + Figma context
3. **Storybook stories** — Claude generates story file with proper `argTypes` and All States grid
4. **NOT used for:** final visual polish pass, token additions, icon substitutions (always reviewed manually)

What Claude gets wrong that Utkarsh always fixes manually:
- Rounds padding values (approximates instead of copying literally)
- Invents token names that don't exist (grep before trusting)
- Picks wrong icon by visual similarity (never let Claude pick icon names from screenshots)
- Skips `forwardRef` / `asChild` on component export
- Uses wrong spring configs (KDS has standardised spring values — see below)

---

## Component Architecture Rules

### Prop Interface — the standards
- **Visual variants** → string union: `variant?: 'default' | 'ghost' | 'outline'`
- **Sizes** → `size?: 'md' | 'sm' | 'xs'`
- **Binary state** → boolean: `selected`, `disabled`, `loading`, `bookmarked`
- **Controlled/uncontrolled** → pair: `selected` + `defaultSelected` + `onSelectedChange`
- **Slots** → named ReactNode props: `leftIcon`, `rightIcon`, `action` (not just `children` when role is clear)
- **HTML passthrough** → `...props` spread + `extends React.HTMLAttributes<HTMLDivElement>`

What is never exposed as a prop:
- Internal style overrides (`inputClassName`, `containerStyle`)
- Animation timing / easing (lives in component constants)
- Internal refs (only root forwardRef)

### Composition vs Data
- **Children / slot prop** → when content is open-ended (text, ReactNode, mixed)
- **Data prop** (`items: Item[]`) → when every row has the same shape and the component owns rendering
- **Hybrid** → `ModelSelectItem`: `label` is string, `image` is slot, `bookmark` is boolean

### Animation Springs (standardised — do not deviate)
| Use case | Spring |
|----------|--------|
| In-place glyph swap (text, icon) | stiffness 500, damping 30 |
| Cluster reflow / layout shift | stiffness 500, damping 32 |
| Panel slide in | stiffness 300, damping 28 |
| Compact ↔ Expanded morph | stiffness 260, damping 32 |

`whileTap` scale values: Button 0.98 · IconButton 0.96 · Switch 0.94 · ChipButton/Checkbox 0.9

### In-Place Text Swap (exact pattern — do not approximate)
```tsx
<AnimatePresence mode="popLayout" initial={false}>
  <motion.span
    key={currentTextKey}
    initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
    animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
    exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    style={{ display: 'block', transformOrigin: 'left center' }}
  >
    {currentText}
  </motion.span>
</AnimatePresence>
```

---

## Utkarsh's "Done" Checklist (15 items)

Before he tells Shyam a component is ready:

- [ ] Every Figma state variant maps to a prop / event / pseudo-class
- [ ] Padding / shadows / typography / colors match Figma character-for-character
- [ ] Every value is a token reference (no inline hex)
- [ ] `forwardRef` + `asChild` + `...props` spread on root
- [ ] Focus-visible 2px ring in `var(--focus-ring)` — keyboard only, never mouse
- [ ] `prefers-reduced-motion` honoured for non-trivial motion
- [ ] Scrollable areas use `kaya-scrollbar` + `overscroll-behavior: contain`
- [ ] All sub-elements use KDS components (no raw div/button where KDS equivalent exists)
- [ ] `isolation: 'isolate'` on outer if descendants use explicit `z-index`
- [ ] Storybook stories: Default + every Figma state + edge cases
- [ ] `specs/components/[name].md` written
- [ ] `specs/[tier]/[name].md` written (tier: atoms / molecules / organisms)
- [ ] `npx tsc --noEmit` clean
- [ ] Local Storybook visual pass against Figma side-by-side
- [ ] PR opened with summary + test plan

---

## Storybook

**Structure:** `src/stories/[category]/[Component].stories.tsx`
- Atoms / Molecules / Organisms
- 6–10 stories per component
- Always includes: Default, one story per Figma state, edge cases (long label, empty), All States grid

**Deployment:** Auto-deployed to Vercel on every push to `main`. PR previews also work — each PR gets its own Vercel URL for design review before merge.

**Vercel URL:** Hit the same URL each time — no manual trigger needed. Builds in ~2–3 min after merge.

---

## Utkarsh's GitHub Workflow

**Branch:** Single long-lived branch `uttkarsh` (not per-feature branches). Commits to `uttkarsh`, opens PR to `main` via `gh pr create`.

**Commit format:**
```
feat(ComponentName): one-line summary

Body explaining the why. Reference Figma node ids if relevant.
List user-facing behaviours.
```

**PR description includes:** Summary bullets, files touched, test plan checklist.

**Self-merge bar:** TypeScript clean + Storybook renders + visual fidelity + spec files updated + all Figma states have stories.

**Breaking changes:** Utkarsh tells Shyam before merging if a prop is being renamed. Additive changes (new optional prop) don't need coordination.

---

## How Front-End Gets Updated Components

> **⚠️ CONFLICT TO RESOLVE — see below**

Utkarsh describes the current model:
> "The front-end repo has KDS as a path-resolved import. git pull the KDS clone → reload dev server → component available. No file copying."

The V2 CLAUDE.md says:
> "Copy KDS components verbatim into src/components/. Never import from the KDS package."

**These are two different models.** The path-resolved import is how V1 worked. The copy-not-import rule is what was decided for V2 (reason: business logic layers go in wrappers, KDS visual updates stay mergeable without touching feature logic).

**Action needed: Chai to sync Utkarsh and Shyam on which model V2 uses.** Until this is resolved, Shyam and Utkarsh are building against different assumptions.

---

## The 7 Things That Cause Rework (avoid these)

1. **Missing state variants** — `FloatingMenuItem` shipped without `active`. Enumerate all Figma variant prop values before writing code.
2. **Wrong composition tier** — `ModelFeaturedCard` built as atom, then became molecule when `proSwitch` (composes `Switch`) was added.
3. **Approximated padding** — `4px 38px 2px 34px` rounded to `4px 8px 2px 34px`. Copy class strings literally.
4. **`overflow: hidden` without Figma authority** — clipped pin shadows on Pinboard. Never add clipping Figma didn't specify.
5. **`getBoundingClientRect()` under animation** — measurements wrong when wrapper is scaling. Use `offsetWidth`/`offsetHeight` for layout-feeding measurements.
6. **Tooltip wrapping that breaks AnimatePresence** — conditional wrapper on only one branch breaks projection. Keep wrapper structure stable across key swaps.
7. **`useEffect` not rerunning on layout settle** — Pinboard bottom fade missing on first paint. Use ResizeObserver on viewport + content.

---

## MessageBubble — Utkarsh's Proposed API

Already sketched by Utkarsh — use this as the prop contract when building the Figma spec:

```tsx
interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string | MessagePart[];
  status?: 'streaming' | 'complete' | 'error';
  citations?: Citation[];
  attachments?: Attachment[];
  renderCodeBlock?: (props: CodeBlockProps) => ReactNode;
}
```

Key decisions:
- `content` is one prop — not `streamingContent` + `finalContent`. Engineer passes whatever they have, component re-renders on changes.
- `status` is a visual hint only — component shows streaming indicator when `status === 'streaming'`, but does NOT own the SSE connection.
- Markdown / code blocks render via internal MDX parsing; streaming-safe means the parser handles partial markdown (incomplete code fences don't break layout).
- `renderCodeBlock` is an escape hatch for the engineer to inject a custom CodeBlock.

Consumer call site (what Shyam writes):
```tsx
<MessageBubble role="assistant" content={msg.text} status={msg.status} />
```

---

## Utkarsh's Sequence for MessageBubble

1. `get_design_context` on every state variant (idle / streaming / complete / error / with-citations / with-attachments / with-code-block)
2. Token audit — identify new color / shadow / typography needs, add to token files upfront
3. Sketch prop interface on paper, validate against expected consumer call sites
4. Scaffold with Claude (Figma context + reference component)
5. Hand-craft the markdown rendering layer (streaming-safe parser, code blocks, citations)
6. Storybook stories — including a "live streaming simulation" story using `useEffect` + `setInterval`
7. Two spec files (`specs/components/message-bubble.md` + `specs/molecules/message-bubble.md`)
8. PR — test plan includes "verify streaming cursor follows last character without layout shift"
9. Coordinate with Shyam before merge if prop names differ from current placeholder
