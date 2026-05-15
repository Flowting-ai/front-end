# Persona Feature — Frontend Implementation Handoff

**Date:** May 13, 2026
**Author:** Chai (via Claude Code)
**Recipients:** Shyam, Kunal
**Figma file:** `MuHe0S78yuiIXXAndfeznw` — "Persona feature 2"
**KDS branch:** `feat/persona-card` (pushed, `PersonaCard` component is complete)

---

## Overview

Personas are configurable AI assistants owned by a user or team. Users create them, give them instructions + knowledge, and deploy them into chat. The feature spans five distinct UI surfaces:

1. **My Personas grid** — the home base, a tile gallery of owned personas
2. **Creation wizard** — a 3-step modal flow: Template Picker → Basics → Configure (Editor Shell)
3. **Editor Shell** — a two-panel page with tabs for Instructions, Profile, Knowledge, Connectors, Sharing
4. **Publish flow** — a confirmation popover → success screen
5. **Community** — browse and import personas created by others (surfaces in PersonaCard, not a separate page)

The `PersonaCard` KDS component (314 px tile) is **already implemented** and covers all card states. Everything else in this doc needs to be built.

---

## User Flow

```
My Personas (grid)
  └── "+ New Persona" button
        └── Template Picker  ──────────────────────────────────────────┐
              └── [select template or "Start blank"]                   │
                    └── Basics — Step 1: Description                   │  "Basics" step
                          └── Basics — Step 2: Name + Handle           │  (all same wizard)
                                └── Basics — Step 3: Tone selection    │
                                      └── Editor Shell ───────────────┘
                                            ├── Instructions tab (default)
                                            ├── Profile tab
                                            ├── Knowledge tab
                                            ├── Connectors tab
                                            └── Sharing tab
                                                  └── Publish button →
                                                        Publish confirmation popover →
                                                              Publish Success screen
```

---

## 1. My Personas Grid

**Figma nodes:** `848-49963` (populated), `848-49567` (empty), `861-42808` (large populated)

### Layout

- Page background: `var(--neutral-50)` (`#f7f2ed`)
- Left sidebar: narrow icon-only nav (see Sidebar section below)
- Main content: scrollable grid area, padding inset from sidebar
- Grid: `auto-fill` columns of `314px` PersonaCard tiles, gap `24px`
- Grid padding: `48px` top, `32px` left/right

### Empty State

When the user has no personas:
- Centered illustration (decorative)
- Heading: Besley regular, 24px, `var(--neutral-950)` — copy TBD from PM
- Sub-copy: Geist regular, 14px, `var(--neutral-500)`
- CTA button: primary/dark, "Create your first persona"

### Populated State

PersonaCard tiles rendered in the grid. The `+` / "New Persona" card is the first item — renders as a draft-style card with dashed border and `+` icon (not a standard PersonaCard; custom tile, ~same dimensions).

### PersonaCard Usage

Use the `PersonaCard` KDS component. All 5 variants and state modifiers are implemented:

```tsx
// Default owned persona
<PersonaCard
  name="Legal Advisor"
  handle="legal-advisor"
  avatarUrl="..."
  description="Helps you draft, review, and refine legal contracts."
  visibility="private"
  tags={['Research']}
  onEdit={...}
  onLink={...}
  onUseInChat={...}
  onMenuEdit={...}
  onMenuDuplicate={...}
  onMenuPauseToggle={...}
  onMenuDelete={...}
/>

// Paused persona
<PersonaCard ... paused superlink onResume={...} />

// Draft in-progress
<PersonaCard variant="draft" name="Untitled Persona" handle="untitled" onEdit={...} />

// Community template (for template gallery)
<PersonaCard variant="template" ... onCopy={...} onTry={...} />

// Community persona
<PersonaCard variant="community" ... authorHandle="Sahil07" useCount={1200} onBookmark={...} onOpen={...} />

// Community persona already imported
<PersonaCard variant="community-imported" ... onBookmark={...} onOpen={...} />
```

See `src/components/PersonaCard/index.tsx` and `src/stories/molecules/PersonaCard.stories.tsx` for full prop reference.

---

## 2. Global Sidebar (Shared Across All Screens)

Appears on the left of My Personas, the Wizard, and the Editor Shell.

### Layout

- Width: `~48px` (icon-only, no labels)
- Background: `var(--neutral-50)` (`#f7f2ed`)
- `overflow-y: auto`, padded `pt-[148px]` when below top-pinned items

### Top section (pinned, absolute positioned)

- Logo/home icon button — `20 × 20`, `p-6`, `rounded-8`
- Navigation icon buttons stacked below (chat, personas, etc.) — `20 × 20` icons, `p-6`, `rounded-10`
  - Active state: `background: rgba(237, 225, 215, 0.6)`, `box-shadow: 0 1px 1.5px rgba(82,75,71,0.12), 0 0 0 1px rgba(182,172,164,0.4)`, inner highlight

### Bottom section (pinned, absolute + shadow fade)

- User avatar — `32 × 32`, `rounded-full`, white bg, `box-shadow: 0 1px 1.5px rgba(82,75,71,0.15), 0 0 0 1px rgba(182,172,164,0.4)`
- Fade: `box-shadow: 0 -34px 33.5px 0px #f7f2ed` on the container creates an upward fade

---

## 3. Creation Wizard — Overlay Shell

The wizard occupies the right panel (everything except the sidebar). It renders as a rounded card within the neutral-50 background:

- Outer wrapper: `background: #f7f2ed`, `pr-10`, `py-10`
- Inner card: `background: rgba(255,255,255,0.2)`, `border: 1px solid var(--neutral-200)`, `border-radius: 22px`, `pt-32`, `px-48`, `overflow: hidden`

### Step Indicator (top center)

Three Blue `Badge` chips in a horizontal row, centered: **Template → Basics → Configure**

- Active step: filled blue — `background: var(--blue-200)`, text `var(--blue-700)`, same ring as standard Blue badge
- Inactive/future steps: same blue badge but `opacity: 0.5`

```tsx
// Active step chip
<Badge color="blue" label="Template" />  // active — bg: var(--blue-200)

// Future step chips
<Badge color="blue" label="Basics" style={{ opacity: 0.5 }} />
<Badge color="blue" label="Configure" style={{ opacity: 0.5 }} />
```

### Close Button (top right)

`IconButton` ghost, `p-8`, `rounded-10`, `box-shadow: 0 0 0 1px rgba(59,54,50,0.3)` — `cancel-01` icon

### Footer Buttons (bottom of each step)

- **Back / ← Library**: `Button` outline, white bg, left arrow icon — `box-shadow: 0 1.09px 1.09px rgba(59,54,50,0.05), 0 1.46px 3.13px rgba(38,33,30,0.15), 0 0 0 1px var(--neutral-100)`
- **Continue →**: `Button` primary/dark, gradient `from var(--neutral-700) to var(--neutral-900)`, white text, right arrow icon

---

## 4. Wizard — Step 1: Template Picker

**Figma node:** `848-49705`

### Heading

- Title: "Choose a starting point" — Besley regular, `var(--font-size-heading-24)` (24px), `#1a1916`
- Subtitle: "Start with a template or build from scratch" — Geist regular, 14px, `#827a74`

### "Start blank" row (above template grid)

A dashed-border card spanning full content width (`764px` wide), height `66px`:

```
background: var(--neutral-white)
border: 1px dashed var(--neutral-300)
border-radius: 16px
box-shadow: 0 2px 2.8px rgba(82,75,71,0.12), 0 0 0 1px var(--neutral-100)
padding: 16px 17px
```

- Left: name `"Custom"` (Geist 16px, `var(--neutral-900)`) + handle `"Start from scratch."` (Geist Mono 13px, `var(--neutral-500)`)
- Right: `Button` outline sm — "Start blank"

### Template Grid

4-column grid, `gap: 16px`, rows of 4 tiles. Template categories shown in order: **Customer Support, Sales, Legal, Research, Content Writer, Code Review, Onboarding, Marketing, Data Analyst, HR & Recruiting, Executive Assistant, Education, Productivity, Tutoring, Custom**

Each template tile:

```
background: var(--neutral-white)
border: 1.274px solid var(--neutral-100)
border-radius: 15.3px
padding: 20.4px
box-shadow: 0 2.55px 3.82px rgba(202,220,241,0.4)  // blue-tinted
width: ~179px (4 cols in ~764px content width)
```

Content: category icon (30.6 × 30.6px, centered) + label (Geist medium, 16px, `var(--neutral-950)`, center-aligned, max-width `138px`)

Interaction: clicking a tile → advances to Basics Step 1 with that template pre-selected.

---

## 5. Wizard — Step 2: Basics (3 sub-steps)

All 3 sub-steps share the same wizard shell. The step indicator shows "Basics" as active.

### Sub-step 2a — Description

**Figma node:** `848-49775`

- Heading: "What should this persona do?" — Besley 24px, `#1a1916`
- Subtitle: "One sentence is perfect — this becomes its purpose and card description." — Geist 14px, `#827a74`
- Input: `684px` wide, white bg, `border-radius: 10px`, `box-shadow: 0 1px 1.5px rgba(82,75,71,0.12), 0 0 0 1px var(--neutral-100)`, `px-10 py-12`
  - Placeholder: "e.g. Reviews contracts and flags risks in plain English" — Geist 14px, `var(--neutral-600)`
- Below input (space-between row):
  - Left: hint "Keep it tight — this shows on the card" — Geist medium 14px, `#827a74`
  - Right: char counter "0/120" — Geist medium 14px, `#827a74`

### Sub-step 2b — Name + Handle

**Figma node:** `848-49804`

- Heading: "What should we call it?" — Besley 24px, `#1a1916`
- Subtitle: "This is how it appears in your library and in chat." — Geist 14px, `#827a74`
- Input: `438px` wide, same styling as above
  - Placeholder / value: persona name (e.g., "gimmy")
- Below input: auto-generated handle display — `@{slug}{disambiguator}` (e.g., `@gimmy01`), Geist medium 14px, `#827a74`
  - The `@` prefix and disambiguator are rendered in regular weight; the slug portion is bold/medium

### Sub-step 2c — Tone Selection

**Figma node:** `848-49833`

- Heading: `How should {name} sound?` — Besley 24px, `#1a1916` (name interpolated)
- Subtitle: "This shapes how it writes, responds, and feels in conversation." — Geist 14px, `#827a74`
- 2×2 grid of tone cards, `gap: 19px`, total width `684px`

Each tone card (`332px` wide):

```
background: var(--neutral-white)
border-radius: 16px
padding: 12px
box-shadow: 0 2px 2.8px rgba(82,75,71,0.12), 0 0 0 1px var(--neutral-100)
gap: 9px (between header, divider, example)
```

| Tone | Subtitle | Example |
|------|----------|---------|
| Direct & confident | Gets to the point. No filler. | "Issue logged. Here's what happens next." |
| Warm & approachable | Human first, solution second. | "I totally get that — let me sort this out for you." |
| Precise & professional | Formal, structured, no ambiguity. | "Your request has been received and is being reviewed." |
| Evidence-based & clear | Reasoned, grounded, neutral. | "Based on your account history, the most likely cause is..." |

Card header:
- Title: Geist medium, 16px, `var(--neutral-900)`, truncated with ellipsis
- Subtitle: Geist Mono regular, 13px, `var(--neutral-500)`

Divider: `1px solid rgba(59,54,50,0.15)`, full width

Example text block (44px tall, 2-line clamp):
- Prefix "Ex -" in `#c4af9f`, rest in `#857a72`, Geist regular 14px

Selection state: selected card gets a ring/highlight (design detail to be confirmed — add `box-shadow: 0 0 0 2px var(--blue-500)` or similar).

---

## 6. Editor Shell

**Figma nodes:** `848-54746` (Instructions basic), `848-54555` (Instructions full sidebar), `848-53623` (Profile), `848-53827` (Profile + live chat), `848-54180` / `848-54276` (Knowledge empty), `848-54359` (Knowledge populated), `923-79710` (Guide panel open)

### Overall Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Sidebar (icon-only nav, ~48px)  │  Top Bar  │                        │
│                                 │──────────│                        │
│                                 │  Tab Row │  [Guide]  [⋮]         │
│                                 │──────────────────────────────────│
│                                 │                                   │
│                                 │         Main Content Area         │
│                                 │         (scrollable)              │
│                                 │                                   │
│                                 │──────────────────────────────────│
│                                 │         Footer Bar                │
└──────────────────────────────────────────────────────────────────────┘
```

- Sidebar: same as wizard/my-personas (icon nav, `~48px`)
- Right panel background: `var(--neutral-50)` with inner white card (`border: 1px solid var(--neutral-200)`, `border-radius: 22px`), `pr-10 py-10`

### Top Bar

Persona identity header, full width:
- Left: persona avatar (65×65 or smaller thumbnail) + name + handle
- Right: floating icon buttons (see Floating Menu section)

### Tab Navigation

Horizontal tab row with 5 tabs: **Instructions · Profile · Knowledge · Connectors · Sharing**

Tab styling:
- Container: `border-radius: 10px` group container with `tab-background` (inset box shadow)
- Active tab: `background: white`, `box-shadow: 0 1px 1.5px rgba(82,75,71,0.12), 0 0 0 1px var(--neutral-100)`, `border-radius: 10px`, `px-8 py-7`, with left icon (16px) + label text
- Inactive tab: no background, same padding, icon + label, muted text color
- Font: Geist medium 14px, `var(--neutral-700)` active, `var(--neutral-500)` inactive

### Floating Menu (right edge)

3 `IconButton ghost xs` stacked vertically, fixed to the far right of the editor:
1. **Persona icon** — navigate/identify (always visible)
2. **Guide icon** — opens Guide panel
3. **Third icon** — versions/history

---

## 6a. Instructions Tab

**Figma nodes:** `848-54746`, `848-54555`, `904-50906`

### Layout

- Left/main column: system instructions text area (`714px` wide, `h-[564px]` visible area)
- The Instructions area is a structured text editor (markdown-capable), not a plain `<textarea>`

### System Instructions Area

```
background: var(--neutral-white) or var(--neutral-50) with dashed border for empty state
border-radius: 16px
padding: 12px
overflow-y: auto
height: 564px
```

Knowledge items that are attached appear as dashed-border rows within the instructions area:
```
background: var(--neutral-50)
border: 1px dashed var(--neutral-300)
border-radius: 16px
height: 56px
padding: 12px
box-shadow: 0 2px 2.8px rgba(82,75,71,0.12), 0 0 0 1px var(--neutral-100)
```
These show the filename (Geist 14px, `var(--neutral-700)`) + file type badge + remove button.

### Footer Bar

Fixed at bottom of the editor panel. Two sections:

**Left side:**
- Text formatting toolbar: an `IconButton ghost sm` for formatting options (appears as a single button in the design — may expand)
- `↪ Chips` row: attached knowledge chips (each chip: `rounded-10`, inner icon button + label text)

**Right side:**
- "Save version" button (outline): Geist medium 14px — see Save Version Dropdown below
- "Publish" button (primary/dark): Geist medium 14px, arrow icon

### Save Version Dropdown

**Figma node:** `904-50906`

The "Save version" button has a dropdown arrow (`↓`) variant:

```
Button layout: [Save version text] [↓ dropdown arrow | divider]
```

Clicking the dropdown arrow opens a panel showing:
- Label: "Versions" (header)
- List of saved versions (date/time + version label)

This is used for version history — separate from Publish.

### Publish Confirmation Popover

**Figma node:** `937-88491`

Clicking "Publish" opens a popover (not a full modal):

```
Popover width: ~360-400px
background: var(--neutral-white)
border-radius: 16px
box-shadow: standard card shadow
```

Content:
- Persona name (Besley 24px, `var(--neutral-900)`) — shows current persona name
- Sharing details / confirmation copy (to be confirmed in Figma)
- "Publish" button (primary/dark)
- Cancel/dismiss action

---

## 6b. Profile Tab

**Figma nodes:** `848-53623`, `848-53827`

### Layout

Two sub-columns or a single form column in the left panel:

**Left panel — form fields:**
- Avatar upload area: `65×65` or larger circle with upload icon overlay on hover
- Name field: text input, same styling as wizard inputs
- Handle field: text input with `@` prefix, Geist Mono
- Description field: textarea, 2-line min

**Right panel — live chat preview (optional/toggle):**
- Shown in the `848-53827` variant
- A chat preview panel slides in on the right showing the persona in conversation
- Background: similar to main chat UI

---

## 6c. Knowledge Tab

**Figma nodes:** `848-54180` (empty v1), `848-54276` (empty v2), `848-54359` (populated)

### Empty State

Two variants:
- **v1**: Standard empty state — illustration + "No knowledge added" heading + "Add files" CTA
- **v2**: Slightly different empty state — may show a hint or alternate copy

### Populated State

Knowledge items render as rows:

```
background: var(--neutral-white)  (or var(--neutral-50) when in instructions)
border: 1px solid var(--neutral-100)  (solid when standalone, dashed when in instructions area)
border-radius: 16px
height: 56px
padding: 12px
display: flex, align-items: center, justify-content: space-between
```

Each row: file icon + filename (Geist 14px, `var(--neutral-900)`) + file size/type badge + `···` menu or remove button

File upload action: "Add files" button or drag-and-drop zone.

---

## 6d. Sharing Tab

**Figma nodes:** `862-43057`, `887-43281`, `898-43413`, `898-43651`

### Layout

Single-column form within the editor main area. Section header: "Sharing Configuration" — Geist medium, 14px.

### Visibility Selector

Horizontal tab group: **Private · Team** (and possibly more, e.g. Public)

Tab group styling:
- Container: same tab group pattern as top nav tabs
- Active tab: white bg, `box-shadow: 0 1px 1.5px rgba(82,75,71,0.12), 0 0 0 1px var(--neutral-100)`, with left icon
- Each tab has a privacy icon (lock icon for Private, team icon for Team)

**Private** — only the owner can use the persona
**Team** — all team members can access; a "Team plan" chip appears (Blue badge) to indicate this requires a team plan upgrade

### Super Link Section

Appears below the visibility selector. Shows an inline section with:

**Title:** "Super Link" — Geist medium, 16px, `var(--neutral-950)`
**Description:** "Generate a shareable URL anyone can chat without a Souvenir account. You cover the token cost." — Geist regular, 13–14px, `var(--neutral-500)`

**Generate state** (`898-43413`):
- `property1: "generate"` — shows a "Generate" button (primary/dark) to create the link
- No URL shown yet

**Active state** (`898-43651`):
- URL input/display: `souvenir.app/p/legal-advisor-a8b2c3`
  - Styled as a read-only input: `white bg`, `border: 1px solid #d1c6bd`, `border-radius: 10px`, `px-7 py-8`, `h-46`
- Action buttons: **"Revoke link"** (destructive/outline) + **"Copy"** (secondary)
- Token meter: linear progress bar showing usage
  - Label: "14% used · 1,400 / 10,000 tokens"
  - Max display: "10,000" at far right
  - Bar fill color: `var(--blue-500)` or similar

---

## 7. Publish Success Screen

**Figma nodes:** `904-44092` (team publish), `904-50591` (team + Super Link)

### Layout

Full-panel screen replacing the Editor Shell after successful publish.

Content (centered):
- Success illustration / persona card preview
- Heading: persona name displayed prominently — Besley
- Body copy: `"Legal Advisor" is now live for your team. Members can add it from the Add button in any conversation.` — Geist regular, 16px, `var(--neutral-700)`, max-width `392px`, center-aligned
- CTA: **"Share to community"** button (link-style with arrow icon, or secondary)
- Secondary action: "Back to My Personas" or similar

**With Super Link variant** (`904-50591`):
- Same success message + an additional Super Link section showing the generated URL + Copy/Revoke actions (same as Sharing tab active state)

---

## 8. Guide Panel

**Figma node:** `923-79710`

### Trigger

The "Guide" `IconButton` in the floating right menu. Toggles the panel open/closed.

### Layout

The Guide panel slides in from the right edge of the editor, overlapping or pushing the main content:
- Width: ~300–360px
- Background: `var(--neutral-white)` or `var(--neutral-50)`
- Header: "Guide" label, close button

### Content

Documentation / tips for building this type of persona. Content is contextual to the current tab. Likely renders markdown content.

---

## 9. Component Usage Map

| UI Element | KDS Component | Variant / Props |
|---|---|---|
| Persona tile (grid) | `PersonaCard` | `variant`, `paused`, `superlink`, `modelVisible` |
| Step indicator chips | `Badge` | `color="blue"`, active = full, inactive = `opacity:0.5` |
| Close button (wizard) | `IconButton` | `ghost`, `size="md"`, cancel-01 icon |
| Template tile | custom div | See template tile spec above |
| Wizard input | custom input | white bg, border-radius 10px, token shadow |
| Tone card | custom card | Pin-like card, 332px, gap-9 layout |
| Tab navigation | custom tab group | 5 tabs, active = white + shadow |
| Save version button | `Button` | `outline` + dropdown split arrow |
| Publish button | `Button` | primary/dark |
| Publish popover | custom popover | Use `@radix-ui/react-popover` |
| Knowledge file row | custom row | h-56, dashed or solid border |
| Visibility tab group | custom tab group | Same pattern as editor tabs |
| URL display | custom read-only input | h-46, border #d1c6bd |
| Token meter | custom progress bar | Blue fill, text below |
| Revoke link | `Button` | `outline` or `ghost`, danger color |
| Copy button | `Button` | `secondary` sm |
| Footer format bar | `IconButton` | `ghost` sm |
| Floating menu | `IconButton` × 3 | `ghost` xs, stacked vertical |
| Guide panel | custom panel | slide-in from right |

---

## 10. PersonaCard — Full Reference

Already implemented in KDS at `src/components/PersonaCard/index.tsx`.

### Variants

| `variant` | Use when |
|---|---|
| `'default'` | Owned persona at rest. Hover reveals action bar (overlays description, no height change). |
| `'draft'` | In-progress. Dashed border, neutral-50 bg, action bar always visible. |
| `'template'` | Community template. Blue shadow, copy icon top-right, "Try" bar always visible. |
| `'community'` | Community persona. Author row + Bookmark/Open bar. |
| `'community-imported'` | Community persona added to user's collection. Green "Imported" badge. |

### State Modifiers (default variant only)

| Prop | Effect |
|---|---|
| `paused={true}` | Identity → 60% opacity. Yellow "Paused" badge. "Resume" bar permanently visible. |
| `superlink={true}` | Blue "Superlink" badge in badge row. |
| `modelVisible={true}` | Red model name badge prepended to badge row. |
| `hovered={true}` | Forces action bar visible (Storybook/testing only). |

### Badge Colours

| Badge | Colour | Reason |
|---|---|---|
| Model name | Red | AI model indicator convention |
| Superlink | Blue | Connection/sharing |
| Paused | Yellow | Caution — temporarily inactive |
| Draft | Yellow | Incomplete |
| Imported | Green | Completed positive action |
| Private / Team / tags | Neutral | Static informational |

### Hover Action Bar (default variant)

Absolutely positioned at bottom of card (does **not** change card height). Animates in from `y:8, opacity:0, blur(4px)` → `y:0, opacity:1, blur(0px)`. `duration: 0.2s, ease: [0.25, 0.46, 0.45, 0.94]`.

---

## 11. Design Tokens Reference

| Token | Value | Used for |
|---|---|---|
| `--neutral-white` | `#ffffff` | Card surfaces, inputs |
| `--neutral-50` | `#f7f2ed` | Page/sidebar bg |
| `--neutral-100` | `#ede1d7` | Borders, separators |
| `--neutral-200` | `#d1c6bd` | Lighter borders |
| `--neutral-300` | `#b6aca4` | Dashed borders |
| `--neutral-400` | `#9e9590` | Muted text |
| `--neutral-500` | `#827a74` | Secondary text |
| `--neutral-600` | `#6a625d` | Input placeholder |
| `--neutral-700` | `#524b47` | Body text, button text |
| `--neutral-900` | `#26211e` | Strong text |
| `--neutral-950` | `#120c08` | Darkest text (names) |
| `--blue-100` | `#cadcf1` | Blue badge background |
| `--blue-200` | `#acc5e4` | Active wizard step badge |
| `--blue-500` | `#0d6eb2` | Blue accents |
| `--blue-700` | `#135487` | Blue badge text |
| `--font-body` | Geist | Body text |
| `--font-code` | Geist Mono | Handles, code, subtitles |
| `--font-title` | Besley | Display headings |
| `--font-size-body-2-16` | 16px | Body large |
| `--font-size-body-1-14` | 14px | Body default |
| `--font-size-caption` | 11px | Small labels, descriptions |
| `--font-size-code` | 13px | Mono text |
| `--font-size-heading-24` | 24px | Wizard headings |

---

## 12. Implementation Notes

### Inline Styles Only

This project uses **inline styles only** — no Tailwind, no CSS modules. Use `style={{ ... }}` with CSS variable tokens.

### Animation Library

Framer Motion v12. Import: `import { motion, AnimatePresence, useIsPresent } from 'framer-motion'`

Spring presets are in `src/lib/springs.ts`:
- `springs.fast` — stiffness 500, damping 30 (snappy)
- `springs.moderate` — stiffness 300, damping 28
- `springs.slow` — stiffness 200, damping 25

The PersonaCard hover bar uses a **custom ease** (not springs): `{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }`.

### Icon Substitutions (Temporary)

The `@strange-huge/icons` package is missing some icons. Current substitutes:

| Needed | Using | Replace when |
|---|---|---|
| LinkIcon | `ShareOneIcon` | Icons package ships a link/chain icon |
| PauseIcon | `StopCircleIcon` | Icons package ships a pause icon |
| PlayIcon / ResumeIcon | `ArrowRightTwoIcon` | Icons package ships a play icon |

### Radix UI

- `@radix-ui/react-slot` — used in PersonaCard for `asChild` prop
- `@radix-ui/react-popover` — recommended for Publish confirmation popover
- `@radix-ui/react-dropdown-menu` — for the Dropdown component (already in KDS)

### Accessibility Notes

- PersonaCard root: no implicit role. Wrap grids in `<ul role="list">` with `<li>` items.
- Avatar images: `aria-hidden={true}` (decorative — name is in text content).
- Action bars: `aria-hidden={!isVisible}` + `pointer-events: none` when collapsed.
- All icon buttons must have `aria-label`.

### Open Questions / Ambiguities

1. **Sharing tab — Team plan chip**: Exact positioning relative to the Team tab. Confirm whether it's a tooltip, a badge adjacent to the tab, or an upgrade prompt modal.
2. **Publish popover copy**: The confirmation popover body copy is not confirmed — needs copy from PM before implementation.
3. **Guide panel content**: Whether guide content is static markdown or fetched from CMS. Who owns the copy?
4. **Tone selection — selected state**: The ring/highlight style for a selected tone card is not explicit in the designs. Use `box-shadow: 0 0 0 2px var(--blue-500), 0 2px 2.8px rgba(82,75,71,0.12)` as a starting point and confirm.
5. **Knowledge tab — "Add files"**: Confirm accepted file types, max size, upload endpoint.
6. **My Personas grid — "+ New Persona" tile**: The new-persona tile design is not in the shared nodes. Request the Figma node from Chai.
7. **Connectors tab**: No Figma screen provided for the Connectors tab. Do not implement until screens are available.
8. **Editor Shell — right panel live chat**: The split-panel layout (instructions left, live chat right) seen in `848-53827` — confirm whether this is always-on or a toggle.

---

## 13. Figma Node Index

| Screen | Node ID | Description |
|---|---|---|
| My Personas — populated | `848-49963` | Full grid with PersonaCards |
| My Personas — empty | `848-49567` | Empty state |
| My Personas — large | `861-42808` | Large populated grid |
| Template Picker | `848-49705` | Step 1 of wizard |
| Basics — Description | `848-49775` | Step 2a |
| Basics — Name/Handle | `848-49804` | Step 2b |
| Basics — Tone | `848-49833` | Step 2c |
| Editor — Instructions (basic) | `848-54746` | Instructions tab, minimal |
| Editor — Instructions (full) | `848-54555` | Instructions tab, full sidebar |
| Editor — Profile | `848-53623` | Profile tab |
| Editor — Profile + Chat | `848-53827` | Profile tab with live chat |
| Editor — Knowledge (empty v1) | `848-54180` | Knowledge tab empty state 1 |
| Editor — Knowledge (empty v2) | `848-54276` | Knowledge tab empty state 2 |
| Editor — Knowledge (populated) | `848-54359` | Knowledge tab with files |
| Editor — Sharing (Private) | `887-43281` | Sharing tab, Private selected |
| Editor — Sharing (Private + Team plan) | `862-43057` | Sharing tab, Private + team plan chip |
| Editor — Sharing (Super Link generate) | `898-43413` | Super Link in generate state |
| Editor — Sharing (Super Link active) | `898-43651` | Super Link active with token meter |
| Publish Success (team) | `904-44092` | Success screen after publishing |
| Publish Success + Super Link | `904-50591` | Success + Super Link section |
| Save Version dropdown | `904-50906` | Versions dropdown variant |
| Publish confirmation popover | `937-88491` | Popover before publishing |
| Guide panel | `923-79710` | Instructions + Guide panel open |
