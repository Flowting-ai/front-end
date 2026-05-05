# Persona Chat — Full Briefing
Paste this entire file into the new Claude chat at the start of every session.

---

## Who I Am

I'm **Chai** — co-founder and founding product designer at Souvenir AI (getsouvenir.com).
I wear four hats: Product Design · Management/Ops · Marketing Creative · Outreach/Strategy.

In this chat I am doing **design work on the Persona feature** — speccing it end-to-end so Utkarsh (KDS) and Shyam/Kunal (engineering) can build it.

---

## The Project

**Souvenir AI** — unified AI workspace: multi-model (GPT, Claude, Gemini, Llama, Grok, DeepSeek), auto-routing, pinboard, custom personas, no-code workflows. Previously called Flowting AI.

**Stack:** Next.js 16 · React 19 · TypeScript 5 · Framer Motion 12 · Kaya Design System (KDS) · Auth0 · Tailwind v4

**API:** `devapi.getsouvenir.com` (Sahil) — 56 endpoints, all HTTPBearer auth

**Hard deadline: May 19, 2026** — investor + enterprise demo event. Everything scoped to what ships before then.

**Current sprint:** Sprint 3 (Apr 29 – May 13, 2026)

---

## Team

| Person | Role |
|--------|------|
| Chai | Co-founder · Product Design · this chat |
| Utkarsh | Kaya Design System ONLY — builds components + Storybook. Does NOT build product features. |
| Shyam + Kunal | Full-time frontend engineers — build product features using KDS components |
| Sahil | Backend/ML co-founder — V2 API live at devapi.getsouvenir.com |
| Harsh | Research + Compare Models feature owner |

**Critical distinction:** Utkarsh = DS builder, not feature builder. When I design a new component, Utkarsh builds it in KDS. When KDS has it, Shyam/Kunal copy it into the product and build the feature.

---

## Roadmap Position

| Window | Work |
|--------|------|
| Apr 21–24 | Chat Board + Pinboard ✅ Done |
| Apr 25–30 | Persona ← this is what we are designing now |
| May 3–5 | Onboarding revamp |
| May 6–10 | Connectors design |
| May 10–13 | Brain (co-work interface + scheduling UI) |
| May 13–17 | Team Experience |
| May 17–19 | Buffer / polish |

---

## What Is Already Built (V1 — for reference)

Personas in V1:
- Full CRUD (create, edit, delete)
- Persona chat (separate chat thread per persona)
- Admin dashboard (internal)
- Two axes: Visibility (Personal/Team/Community) + Sharing Modes
- V2 API has 18 persona endpoints — confirm field names with Sahil before speccing API wiring

What does NOT exist yet:
- Highlights (text selection → HighlightBoard) — not designed, deferred
- Brain/Orchestrator — separate feature, May 10-13 window
- HighlightBoard — design not started

---

## Session Protocols — Mandatory

Every session must have two files. Create them at the root of whatever working directory this chat uses (e.g. `/tmp/personas/`).

### WORKLOG.md — append-only
```markdown
# WORKLOG — Persona Feature

## YYYY-MM-DD
- Task 1 done
- Decision made: X because Y
- Blocked on: Z
- Est: ~2h
```
- Never overwrite — only append
- One entry per session
- Max 10 lines per entry
- Only read when asked (sprint reports, hour logging) — zero passive token cost

### SESSION.md — overwrite each session
```markdown
# SESSION — Persona Feature
Overwrite at session start.

**Last session:** YYYY-MM-DD
**Last worked on:** [exact file or decision]
**In progress:** [what's mid-flight]
**Blocked:** [what's waiting on someone else]
**Next:** [first thing to do today]
```
- Read once at start, ignored after
- Replaces the "what were we doing?" ramp-up

**Rule:** Update both files at the **END of the session only** — not mid-conversation. Updating mid-session wastes tokens.

---

## Files We Create — Types + Naming

### Feature Spec Doc
`docs/features/personas.md`

Full spec for Shyam/Kunal to build from. Structure:
```
# Feature: [Name]
## Layout (ASCII diagram)
## Component Tree (indented ASCII with KDS component names)
## State (table: state name | source | notes)
## API Wiring (exact endpoints + request shapes)
## Animations (table: element | Framer Motion pattern | spring spec)
## Empty States (table: condition | props)
## Pending: [anything deferred or not yet designed]
```

### Pending KDS Components
`docs/0-pending-kds-components.md` — already exists, append new components here.

Format for each new component:
```typescript
// TODO(kds): Replace with KDS <ComponentName> when shipped.

// Prop interface (exact TypeScript)
interface ComponentNameProps {
  // ...
}

// Placeholder implementation
export function ComponentName(props: ComponentNameProps) {
  // minimal placeholder
}
```

### Engineer Entry Point
`START-HERE.md` — already exists. Update the build status table and done checklists when a new day's docs are complete.

### CLAUDE.md
Already exists at repo root. Update:
- KDS component status table when new pending components are added
- "Read Before Building" table when a new feature doc is written
- Build status table

---

## 6 Non-Negotiable Engineering Rules
Write these into every feature spec. Engineers must follow them.

**1. Copy KDS — never import from KDS package.**
Copy component source into `src/components/[ComponentName]/`. Business logic in a wrapper/hook on top. Never modify the copied file.
→ Ref: `docs/1-component-copy-guide.md`

**2. Never hardcode hex values.**
All colours via CSS tokens: `var(--color-text-primary)`, `var(--color-surface-subtle)`, etc.
Dark mode deploys automatically if tokens are used — hardcoded hex breaks it.

**3. React Compiler is on. Zero `useMemo` / `useCallback`.**
The compiler handles optimisation. Manual memos fight it.

**4. Every HTML render goes through `security.ts`.**
No `dangerouslySetInnerHTML` without sanitisation. No exceptions.

**5. Plan gates use `plan-config.ts` helpers — never inline.**
```ts
// WRONG
if (plan === 'power') { ... }
// RIGHT
if (canAccessFeature(plan, 'personaPublish')) { ... }
```

**6. Keep these 8 lib files verbatim — do not rewrite.**
`streaming.ts` · `thinking.ts` · `config.ts` · `error-reporter.ts` · `chat-tones.ts` · `plan-config.ts` · `api/client.ts` · `api-client.ts`

---

## KDS Workflow

**KDS repo:** `github.com/strange-rock/kaya-design-system` · local clone: `/tmp/kaya-ds/`

**When checking for KDS updates (do NOT re-read all KDS files):**
```bash
gh pr list --repo strange-rock/kaya-design-system --state merged --limit 10
gh pr diff <number> --repo strange-rock/kaya-design-system --name-only
```
Only read files that appear in the diff. Then update only the impacted sections in V2 docs.

**Copy-not-import rule:** V2 copies KDS source verbatim into `src/components/`. No npm import from KDS package. Business logic in wrappers or hooks on top.

**Pending component pattern:** When a component doesn't exist in KDS yet, write a placeholder with `// TODO(kds):` comment, exact prop interface, and minimal render. One import swap when Utkarsh ships the real one.

---

## Icon Rule

```tsx
import { SomeIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

<HugeiconsIcon icon={SomeIcon} size={16} strokeWidth={1.5} color="currentColor" />
```
Always `size={16}` `strokeWidth={1.5}` `color="currentColor"` unless spec says otherwise. `lucide-react` is banned.

---

## Animation Rules

All animations use Framer Motion 12. Six named patterns (full specs in `docs/animation-states.md`):
- Pattern 1: Panel slide in/out — `x: 40→0`, spring `{ stiffness: 300, damping: 28 }`
- Pattern 2: Text swap — opacity fade with layout shift
- Pattern 3: Message/card appear — `opacity: 0→1`, `y: 12→0`, 220ms easeOut
- Pattern 4: Expand/collapse — height animate with `AnimatePresence`
- Pattern 5: Stagger list — children stagger 40ms
- Pattern 6: Bulk toolbar — `y: 8→0`, `opacity: 0→1`, 200ms easeOut

Zero CSS `transition:` on animated elements — Framer Motion only.
Zero `useMemo`/`useCallback` around animation values — React Compiler handles it.

---

## Framer Motion Pattern (Dubberly Method — for concept maps)

When drawing concept maps or diagrams:
- Nodes = nouns (things)
- Arrows = verbs (what one thing does to another)
- Every path should read as a sentence: "Team executes Process delivers Product"
- Use FigJam section headers above each map for navigation
- Color legend: Sand=People, Blue=Core/User-facing, Purple=KDS, Green=API/Data, Yellow=Pending/Warning, Red=Errors/Rules

---

## Plan Tiers (for feature-gating decisions)

| Plan | Price | Key limits |
|------|-------|-----------|
| Starter | $12/mo | 3 personas, 100 pins, community USE only |
| Pro | $25/mo | unlimited personas, 2 workspaces, community USE + PUBLISH |
| Power | $100/mo | unlimited everything, featured placement |

Use `canAccessFeature(plan, 'featureName')` and `hasReachedLimit(plan, resource, count)` from `plan-config.ts`. Never write `plan === 'power'` inline.

---

## FigJam Board

`https://www.figma.com/board/GkDTPdFOMZw9dqt8WftecF` — 7 concept maps already built (system architecture, chat experience, state machine, component architecture, API flow, response types, plan system). Add Persona map here as Map 8 when needed.

---

## GitHub

- Front-end repo: `https://github.com/Flowting-ai/front-end`
- Docs branch: `chai-svnr` (all V2 docs live here — commit db5761c)
- KDS repo: `https://github.com/strange-rock/kaya-design-system`
- Local V2 docs: `/tmp/v1-frontend/` · Local repo: `/tmp/front-end-v2/`

When docs are complete, copy to `/tmp/front-end-v2/` and push to `chai-svnr`.

---

## Persona Feature — What We Know from V1

From V1 archaeology + Sahil's V2 API (18 persona endpoints):

**Two axes (locked product decision):**
- Visibility: Personal · Team · Community (not conflated — separate axis)
- Sharing Modes: Private · Super Link (creator-pays) · Team toggle

**V2 API endpoints (confirm field names with Sahil before wiring):**
- `GET /personas` — list
- `POST /personas` — create
- `GET /personas/{id}` — single
- `PATCH /personas/{id}` — update
- `DELETE /personas/{id}` — delete
- `GET /personas/{id}/chats` — persona chat history
- `POST /personas/{id}/stream` — persona chat stream (SSE — same format as regular chat)
- `POST /personas/{id}/enhance-prompt` — AI-enhanced system prompt
- `POST /personas/{id}/test` — test persona response

**What needs designing for V2:**
- Persona list page (browse, filter, create CTA)
- Persona builder (name, avatar, system prompt, tone, visibility, sharing)
- Persona chat (same chat board experience but scoped to persona)
- Persona settings (edit, delete, share link)
- Plan gating (Starter: 3 personas max)

---

## What to Do First in Each Session

1. Read `SESSION.md` (30 seconds — what was in flight)
2. If KDS may have updated: run `gh pr list --repo strange-rock/kaya-design-system --state merged --limit 5`
3. Continue from where `SESSION.md` says
4. At end of session: update `SESSION.md` (overwrite) + append to `WORKLOG.md`
5. Copy updated docs to `/tmp/front-end-v2/` and push to `chai-svnr`

---

## Token Efficiency Rules

- **Never re-read all KDS docs** — check PRs first, read only changed files
- **Update SESSION + WORKLOG at end only** — not mid-conversation
- **WORKLOG is read on demand only** — never auto-load it
- **SESSION.md is read once** — ignored for the rest of the session
- **Don't re-read files you already read this session** — note what you've read

---

## Contacts

- **Sahil** — API endpoint questions, field names, response shapes
- **Utkarsh** — KDS component questions, token names, pending component ETAs
- **Shyam/Kunal** — engineering questions, implementation blockers

If something in the docs contradicts the code, the **docs win** — flag it to Chai and she'll resolve it.
