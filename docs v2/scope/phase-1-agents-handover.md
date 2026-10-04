# Agents V2 — Phase 1: what shipped, and what needs the backend

Status: implemented in `front-end-test` (frontend only). Scope reference:
`docs v2/scope/souvenir-v2-scope-flow.html` (Part B, §8–§9, Fix 1/3/7).

## What Phase 1 changes

| Area | Before (V1.5) | Now |
|---|---|---|
| Create | 4-step wizard (`/agents/basics/*`), agent saved at the Tone step | `/agents/new`: one purpose field → optional question cards (≤3) → generation → one editor page → **Finish** creates *and publishes*. **Cancel saves nothing.** |
| Edit | 5-tab configure shell | `/agents/[id]/edit` — one page, live preview, per-field regenerate, "Try it", explicit **Save changes** (edits the live version in place; no "Save version" / separate Publish) |
| Quick edits | none | Right-sidebar **Agent details** on `/agents` (`?agent=<id>`, "Details" in a card's ⋯ menu, opened automatically after creating): avatar, name, model, description save as you leave a field |
| Advanced | Instructions tab | **Advanced personalize** modal: Instructions, Tone, Creativity |
| Sync | four save behaviours | all three views read/write one record; an edit elsewhere shows an "Updated" note, or "Load latest / Keep mine" if you have unsaved edits |

Creativity and temperature are **one control** (the slider, 0–1).

## Still on the old screens (intentionally)

`/agent/configure/{knowledge,connectors,sharing}` — the editor links to them under *Resources*. Their
replacements are Phase 2 (sharing types) and Phase 3 (Library + workspace connectors). The old
Instructions/Profile tabs are still mounted there but no longer linked from anywhere.

## Gaps that need the backend (not implemented — frontend-only rule)

1. **A real "generate agent" endpoint.** Today only `POST /persona/starter` exists, and it returns
   instructions + tone options + tags from a *name and description*. So the **name, description,
   model and avatar are derived on the client** (`lib/agent-draft.ts`):
   name from the purpose with simple rules (3 options, cycled by ↻), description = purpose trimmed
   to 120 chars, model = the catalog's "Recommended" model among those agents may use, avatar from
   the template pool. Wanted: one endpoint taking `{ purpose, answers }` and returning
   `{ name[], description, model_id, instructions, tone options, tags, avatar }`.
2. **Tone** is not stored. `/persona/starter` ignores a `tone` hint, and no version field holds it, so a
   tone is written as one `Tone: …` line in the instructions. Wanted: a `tone` field (or honouring the hint).
3. **Skills (.md rules) and Memories** (Advanced personalize in the scope) have no backend yet, so they
   are not shown — nothing ships as a dead control. They arrive with P4 Skills / Phase 3 memories.
4. **Animated avatars** — the pool is static images; a generated/animated avatar needs a service.
5. **Versions.** V2 edits the version chat runs, in place; older versions stay in the backend but are no
   longer reachable from the UI (the scope's open question #1). A history/restore view (Fix 7) needs a decision.
6. **Ownership of shared agents.** `PersonaRepoResponse` has no owner field, so non-admins cannot edit an
   org-shared agent they created themselves (existing limitation, unchanged).

## Known limitations

- Leaving the editor via the app's own sidebar with unsaved edits is not intercepted (Back, the Resources
  links, reload and tab-close are). Next's App Router has no route-change blocker.
- An unsaved *new* agent is lost on refresh (a reload warning is shown); there is no local draft yet.
- "Try it" runs the *saved* version and pauses while there are unsaved changes.
- Right-sidebar details exist on `/agents` only (not yet in chat or task views).

---

# Phase 2 (without sharing)

Sharing — *Share as template*, *Publish to workspace*, Super Link changes and the recipient install flow — was
**explicitly left out**, so those parts of Phase 2 are not built. Workspace-published agents therefore still do
not appear in the composer picker (the existing rule hides team-visibility agents there).

## What shipped

| Area | Behaviour |
|---|---|
| Create in chat | Typing "Create an agent that…" in the chat box (new chat, or inside a chat) opens a dialog instead of sending: question cards (≤3) → the agent is created and saved, the dialog closes, and **the thread shows your request followed by the agent's card** with **Use now** (attaches it to the chat; then reads *In use*) / **Edit** / **Open**. *Not an agent? Send it as a normal message* is always available before the agent is made. Detection is conservative (`lib/agent-intent.ts`): coding/writing requests about "an assistant class" or "a bot" are left alone. Skipped when an agent is already attached, a mode is selected, or files are attached. Failure → **Try again** or **Set it up manually** (opens `/agents/new?purpose=…`). |
| `@agent` in the prompt | `@` opens the user's agents above the chat box; narrows as you type; ↑/↓, Enter/Tab to pick, Esc to close; picking removes the `@word` and attaches the agent. An email address or mid-word `@` never triggers it. Wired in `/chat` (new chat + active chat) and project chats. Not yet in Tasks/Brain. |
| `+` → Add agent | Gains a **New agent** row. |
| Templates page | **Recommended for you** (default) and **General**. Recommended is ranked on the client from connected apps (`lib/agent-templates.ts`, affinity table) and skips templates the user already has an agent for; each card says which apps it works with. With nothing connected it shows popular starting points and says so. |

## Backend gaps added by Phase 2

1. **Recommendations for agent templates.** There is no endpoint; the ranking above is a client-side heuristic over
   connector slugs/names (an affinity table that will need tuning against real slugs). The scope's other signals
   (industry, onboarding answers, usage) are not available to the client.
2. **Creating an agent from chat as a model tool.** The chat model can't create agents; the client recognises the
   request instead. A real tool (so the model can ask richer questions and a task can create an agent) needs the backend.
3. `POST /persona` can answer before the new version is pinned active; the client now reads the agent back when that
   happens. Worth fixing server-side.

## Limitations

- The questions are asked in a dialog over the chat; only the result (the agent card) is in the thread.
- The request and the card are browser-only rows: they are not stored by the backend, so they disappear when the chat is reloaded or reopened later. The agent itself is saved.
- Intent detection is English-only.
