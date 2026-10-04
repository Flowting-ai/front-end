# Souvenir V2 — Product Scope & New Agents Flow

> **Status:** Proposed scope. These are planned changes, not implemented behaviour.
> **Supersedes:** the V1.5 agents flow in `docs v1.5/flows/agents-flow-diagram.html` (the 5-tab Configure system, the 4-step wizard, and per-agent Knowledge/Connectors).
> **Last updated:** 2026-09-28

---

## Contents

**Start here**

0. [Mega flow — the whole system on one page](#0-mega-flow--the-whole-system-on-one-page)

**Part A — Scope overview**
1. [Scope at a glance](#1-scope-at-a-glance)
2. [Priority 0 — Agents rebuild](#2-priority-0--agents-rebuild)
3. [Priority 1 — Unified New Chat / New Task](#3-priority-1--unified-new-chat--new-task)
4. [Priority 2 — Notifications & app cleanup](#4-priority-2--notifications--app-cleanup)
5. [Priority 3 — Tasks context panel](#5-priority-3--tasks-context-panel-right-sidebar)
6. [Priority 4 — Skills & Browser](#6-priority-4--skills--browser)

**Part B — New agents flow in detail**

7. [Design principles](#7-design-principles)
8. [Creation flow](#8-creation-flow)
9. [Agent views: editor page, sidebar details, Advanced modal](#9-agent-views-editor-page-sidebar-details-advanced-modal)
10. [Knowledge & connectors (workspace-level)](#10-knowledge--connectors-workspace-level)
11. [Sharing model](#11-sharing-model)
12. [Using agents in chats & tasks](#12-using-agents-in-chats--tasks)
13. [Templates page](#13-templates-page)
14. [What gets removed from V1.5](#14-what-gets-removed-from-v15)
15. [Open questions](#15-open-questions)
16. [Existing vs proposed: pros, cons and why V2 is better](#16-existing-vs-proposed-pros-cons-and-why-v2-is-better)
17. [Suggested improvements beyond this proposal](#17-suggested-improvements-beyond-this-proposal)
18. [Edge cases: covered, partly covered and missed](#18-edge-cases-covered-partly-covered-and-missed)

---

# Start here

## 0. Mega flow — the whole system on one page

This joins up every piece of the V2 scope: how people get in, how agents are created, what an agent is, how it's used and shared, and how notifications and learning feed back in. `[P0]`–`[P4]` shows which priority delivers each part, and "Fix N" refers to the risk fixes in §16.3a. The detailed sections follow below.

```
═══ 1 · WAYS IN ═════════════════════════════════════════════════════════════════

 ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
 │ New Chat /       │  │ /agents     [P0] │  │ A shared agent   │  │ 🔔 Notifications │
 │ New Task    [P1] │  │ New agent ·      │  │ [P0] template ·  │  │ [P2] bell next   │
 │ one composer,    │  │ Templates:       │  │ Super Link ·     │  │ to account menu  │
 │ Chat ⇄ Task      │  │ Recommended /    │  │ workspace listing│  │                  │
 │                  │  │ General          │  │                  │  │                  │
 │ → 2A or 5        │  │ → 2B             │  │ → 5 · Share      │  │ → any stage      │
 └────────┬─────────┘  └────────┬─────────┘  └──────────────────┘  └──────────────────┘
          │                     │
═══ 2 · CREATE — PURPOSE IS THE ONLY INPUT ══════════════════════════════════════
          ▼                     ▼
 ┌──────────────────┐  ┌──────────────────┐
 │ 2A · IN CHAT     │  │ 2B · MANUAL      │
 │ "Create an agent │  │ Purpose screen   │
 │  that…"     [P0] │  │ one sentence ·   │
 │ (or a task needs │  │ starter chips    │
 │  one)            │  │             [P0] │
 └────────┬─────────┘  └────────┬─────────┘
          ▼                     ▼
 ┌──────────────────┐  ┌──────────────────┐
 │ Question cards   │  │ Same cards,      │
 │ only if unclear, │  │ inline, only if  │
 │ at most 3 (Fix 3)│  │ unclear          │
 └────────┬─────────┘  └────────┬─────────┘
          └──────────┬──────────┘
═══ 3 · GENERATE ════════════════════════════════════════════════════════════════
                     ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ GENERATION from purpose + answers (Fix 1)                   │
 │ name · animated avatar · model (by rules) · description ·   │
 │ instructions (structured) · tone = default ·                │
 │ temperature = default · skills & memories empty             │
 └──────────┬───────────────────────────────────┬──────────────┘
         2A ▼                                2B ▼
 ┌──────────────────────┐          ┌─────────────────────────────┐
 │ Agent card in chat   │          │ AGENT EDITOR PAGE           │
 │ [Use now] [Edit]     │          │ one page · all fields       │
 │ [Open] · saved       │          │ pre-filled · live preview   │
 │ straight away        │          │ card · Regenerate per field │
 │                      │          │ [Cancel]         [Finish]   │
 └──────────┬───────────┘          └──────────────┬──────────────┘
            └─────────────────┬───────────────────┘
═══ 4 · THE AGENT — ONE RECORD, OWNER-ONLY EDITS ════════════════════════════════
                              ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ AGENT RECORD [P0]                                           │
 │ in /agents · + menu · @mentions · available to tasks        │
 └───────┬──────────────────────┬──────────────────────┬───────┘
         ▼ synced               ▼ synced               ▼ synced
 ┌───────────────┐      ┌───────────────┐      ┌─────────────────────┐
 │ Editor page   │      │ Right-sidebar │      │ Advanced Personalize│
 │ everything ·  │      │ details       │      │ modal: instructions │
 │ saves on      │      │ avatar · name │      │ · skills · memories │
 │ Finish        │      │ · model · desc│      │ · tone · temperature│
 └───────────────┘      └───────────────┘      └─────────────────────┘
          ┆ reads from (never copies)
 ┌──────────────────────────────┐   ┌──────────────────────────────┐
 │ WORKSPACE LIBRARY [P0]       │   │ WORKSPACE CONNECTORS [P0]    │
 │ global media & docs ·        │   │ personal + shared · writes   │
 │ sensitive items only if named│   │ need approval (Fix 2)        │
 └──────────────────────────────┘   └──────────────────────────────┘
                              │
═══ 5 · USE & SHARE ═════════════════════════════════════════════════════════════
         ┌────────────────────┼─────────────────────┐
         ▼                    ▼                     ▼
 ┌───────────────┐    ┌──────────────────┐   ┌──────────────────┐
 │ CHAT     [P1] │    │ TASK        [P1] │   │ SHARE (owner)    │
 │ + menu or     │    │ one fixed strong │   │ [P0] template ·  │
 │ @mention ·    │    │ model · 3 cards  │   │ publish to       │
 │ model picker ·│    │ on New Task      │   │ workspace ·      │
 │ project ·     │    └────────┬─────────┘   │ Super Link       │
 │ connectors    │             ▼             └────────┬─────────┘
 │ inline        │    ┌──────────────────┐            ▼
 └───────┬───────┘    │ Matching agent?  │   ┌──────────────────┐
         ▼            │ [P0] high→reuse  │   │ RECIPIENT        │
 ┌───────────────┐    │ (Swap) · medium  │   │ preview → Add to │
 │ Chat thread   │    │ →ask · low→create│   │ my agents →      │
 │ (in a project │    │ once, temporary  │   │ connect only     │
 │ if attached)  │    └────────┬─────────┘   │ what's needed    │
 └───────┬───────┘             ▼             └────────┬─────────┘
         ▼            ┌──────────────────┐            ▼
 ┌───────────────┐    │ TASK CONTEXT     │   ┌──────────────────┐
 │ Save artifact │    │ PANEL [P3]       │   │ Lands on their   │
 │ · Save as a   │    │ progress · agents│   │ own editable copy│
 │ skill    [P4] │    │ · connectors ·   │   │ ↺ becomes their  │
 └───────┬───────┘    │ skills · usage · │   │ own agent record │
         │            │ live browser [P4]│   │ (stage 4)        │
         │            └────────┬─────────┘   └────────┬─────────┘
         └─────────────────────┼──────────────────────┘
═══ 6 · NOTIFY & LEARN ══════════════════════════════════════════════════════════
                               ▼
 ┌──────────────────────────────┐   ┌──────────────────────────────┐
 │ 🔔 NOTIFICATIONS [P2]        │   │ MEMORIES LEARNED [P0]        │
 │ automation status · chats &  │   │ "Learned · Undo" note ·      │
 │ agents received · Super Link │   │ per person, never shared     │
 │ usage · skill · artifact     │   │ by default                   │
 │ (preliminary) + tasks,       │   │                              │
 │ shares, team, credits,       │   │                              │
 │ connectors (secondary)       │   │                              │
 └──────────────────────────────┘   └──────────────────────────────┘

 ↺ Notifications deep-link back to stages 1 and 5 · memories and saved skills
   improve the agent in stage 4 · reused agents get better instead of multiplying
```

---

# Part A — Scope overview

## 1. Scope at a glance

```
 P0  AGENTS REBUILD ───────────────────────────────────────── highest priority
     Purpose-only creation (prompt or manual) · one editor page
     replaces the 5 tabs · workspace Library + connectors · 3 sharing
     types · owner-only editing · agents reused across tasks
        │
        ▼
 P1  UNIFIED NEW CHAT / NEW TASK
     One composer with a Chat ⇄ Task switch · model picker only in Chat
     · 3 suggestion cards only in Task · attach to a project ·
     add connectors inline
        │
        ▼
 P2  NOTIFICATIONS & CLEANUP
     Bell next to the account menu (automations, received chats/agents,
     Super Link usage, skills, artifacts) · remove Pins & Highlights
        │
        ▼
 P3  TASKS CONTEXT PANEL (right sidebar)
     Progress · agents & sub-progress · connectors · skills · usage
        │
        ▼
 P4  SKILLS & BROWSER
     First-class Skills feature · built-in browser ("computer") view
```

**Why this order.** P0 changes the data model: what an agent is, where its knowledge comes from, who can edit it. P1–P3 build on that model, so it has to come first. P3 needs agents and skills to exist before it can report on them. P4 makes skills a first-class feature (P0 already uses skills as agent instruction files) and adds the browser.

**Adjacent work (not in this scope).** A separate effort is building an **e-commerce dashboard with AI chat** as a future Souvenir differentiator. Keep the agent and chat primitives defined here reusable so that dashboard can embed them, but its UI and data are owned elsewhere.

---

## 2. Priority 0 — Agents rebuild

**Goal:** make creating an agent effortless and make agents a reusable part of every chat and task, not a separate configuration project.

| # | Change | Summary |
|---|---|---|
| P0.1 | **Two ways to create** | (a) Conversationally in chat, guided by question cards. (b) Manually from the `/agents` page. |
| P0.2 | **Purpose is the only input** | The model generates the name, avatar, model choice, description and system instructions from the purpose. Tone and temperature get sensible defaults. |
| P0.3 | **Replace the 5-tab Configure** | One **single-page agent editor** for creating and editing, plus a right-sidebar **agent details** panel and an *Advanced Personalize* **modal**. All three stay in sync. No Instructions/Profile/Knowledge/Connectors/Sharing tabs. |
| P0.4 | **Workspace-level knowledge** | Agents read from the new global media & docs manager, called **Library**. No per-agent file uploads. |
| P0.5 | **Workspace-level connectors** | Agents use whatever connectors the workspace account has (personal or shared). No per-agent enable/disable. Question cards in chat confirm which connector to use. |
| P0.6 | **Right sidebar: agent details** | Animated avatar, name, model, description. Quick edits here update the editor page and the modal immediately. |
| P0.7 | **Advanced Personalize (modal)** | Instructions, Skills (markdown rule files), Memories (learned preferences), Tone, **Temperature slider**. Opened from the right sidebar or the editor page. |
| P0.8 | **Three sharing types** | Share as template · Publish to workspace · Super Link (template-style). |
| P0.9 | **Owner-only editing** | Only the agent's owner can edit it. Everyone else uses it or copies it. |
| P0.10 | **Templates page** | Existing templates go under a *General* filter, plus a personalised *Recommended for you* tab. |
| P0.11 | **Tasks create and reuse agents** | Tasks spin up agents automatically from the prompt and reuse an existing matching agent instead of creating duplicates. |
| P0.12 | **Manual use anywhere** | Pick any agent in chats or tasks by mentioning it in the prompt or from the composer's `+` menu. |
| P0.13 | **New agents UI** | Agent Card → agent details (right sidebar) → Advanced Personalize (modal), plus the single-page editor with a live preview card. |

Full detail: [Part B](#part-b--new-agents-flow-in-detail).

---

## 3. Priority 1 — Unified New Chat / New Task

**Goal:** one entry point that feels like a single product. Chat and Task are two modes of the same composer, in the spirit of Perplexity's Search / Computer split.

| # | Change | Detail |
|---|---|---|
| P1.1 | **Same layout for both** | New Chat and New Task share one page layout. Only the mode differs. |
| P1.2 | **Mode switch inside the composer** | A Chat ⇄ Task toggle sits inside the chat input. Switching keeps the typed text, attachments and selected agent, with no page reload. |
| P1.3 | **Model picker: Chat only** | Chat shows the model selector. Task hides it and always uses one strong, reliable model, because a task has to finish and a weaker model risks stopping part-way. |
| P1.4 | **Suggestion cards: Task only** | Remove the cards from New Chat. New Task shows **3 cards below the composer**, placed where New Chat's cards are today. |
| P1.5 | **Attach to a project** | Like Perplexity/Claude, a new chat can be attached to a project from the composer. This becomes a new way to start a project chat. (Chats don't have their own project concept yet.) |
| P1.6 | **Add connectors inline** | Connect a new connector from the New Chat / New Task composer without going to Settings, as Perplexity does. |

> **Perplexity reference: Search vs Computer**
> - **Two modes, one product.** Search is Perplexity's quick, cited-answer mode. **Computer** (launched 25 Feb 2026) is its autonomous agent mode: you describe a goal, Computer splits it into subtasks, runs them in parallel with specialised **sub-agents**, and returns finished results. This is the model for our Chat ⇄ Task split: Chat = Search, Task = Computer.
> - **Models.** Search lets the user pick a model. Computer picks models itself: it coordinates about 19 models and assigns each subtask to the best fit. Its Sept 2026 "Effort Mode" (Light / Standard / High / Ultra) lets the user set *how hard* it works while Perplexity chooses the model and reasoning level. This supports P1.3: hide the model picker in Task. **Possible extension:** an effort control in Task instead of a model picker.
> - **Connectors in the composer.** Selecting a connector once in the composer attaches it to the current thread. Spaces can also use connectors the organisation has already connected. This is the pattern for P1.6.
> - **Projects ≈ Spaces.** Perplexity's Spaces are folders for threads with shared context. Threads are added via *⋯ → Add to Space*. P1.5 goes further: attach to a project **before sending**, from the composer.

```
┌──────────────────────────────────────────────────────────────┐
│  [ Chat | Task ]                                             │
│  Ask anything…                                               │
│                                                              │
│  [+]  [📁 Project ▾]  [🔌 Connectors]      [Model ▾]  [➤]    │
│                                             ↑ Chat mode only │
└──────────────────────────────────────────────────────────────┘
      Task mode only ↓
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Card 1   │ │ Card 2   │ │ Card 3   │
   └──────────┘ └──────────┘ └──────────┘
```

---

## 4. Priority 2 — Notifications & app cleanup

### 4.1 Notifications button

A small **bell button in the bottom-left**, next to the account menu (on its right), like Perplexity. It opens a notifications feed.

Notifications ship in two tiers:
- **Preliminary:** the core set, shipped with the bell.
- **Secondary:** added afterwards. This set comes from a scan of the current front-end for events that happen today but aren't told to anyone.

#### Preliminary notifications (first release)

| Event type | Example |
|---|---|
| **Automation status** | "Weekly report automation finished" / "…failed — retry" |
| **Chats received** | "Priya shared a chat with you" |
| **Agents received** | "You received the *Support Triage* agent template" |
| **Super Link usage** | "Your Super Link was used 12 times · 40% of credit limit used" |
| **Saved as a skill** | "*Invoice formatting* was saved as a skill" |
| **Artifact saved** | "*Q3 dashboard* artifact saved" |

#### Secondary notifications (from the front-end scan)

★ = highest value within the secondary tier. "Today" is what the app does now.

**Tasks & automations**

| Event | Example | Today |
|---|---|---|
| ★ Task finished (while you're elsewhere) | "*Competitor research* is done — 3 files ready" | Dropped if you've switched thread |
| ★ Task failed or stuck | "*Weekly digest* failed at step 3 — retry" | Inline card on the open thread only |
| ★ Task waiting for you | "*Invoice run* needs your approval to send 12 emails (expires in 10 min)" | Inline card only |
| "Run now" finished | "Manual run of *Daily summary* finished" | "Starting shortly" toast, nothing after |
| Reply finished in another chat | "Your answer in *Q3 plan* is ready" | Nothing |
| File / document ready | "*Board deck.pptx* is ready" | Inline only |
| Agent sent or posted something | "Sent 1 email via Gmail · posted to #sales" | Inline only |

**Agents & sharing**

| Event | Example | Today |
|---|---|---|
| ★ Your share was accepted | "Priya added your *Support Triage* template" | Sharer not told |
| ★ Super Link near limit / expiring / expired | "Super Link at 90% of credit limit" · "expires in 2 days" | Dashboard only |
| Super Link revoked (to recipient) | "Access to *Support Triage* was revoked" | Badge on next visit |
| ★ Agents need a new model | "2 of your agents use a retired model — fix now" | Agents page only |
| Admin disabled a model you use | "*GPT-x* was disabled by an admin — 1 agent affected" | Owner not told |
| Team agent published or updated | "*Policy Helper* was updated by Sam" | Members not told |
| Memory updated | "Learned: prefers bullet summaries · Undo" | Signal sent, nothing listens |

**Chats & projects**

| Event | Example | Today |
|---|---|---|
| Your shared chat was copied | "Sam copied your shared chat *Launch plan*" | Sharer not told |
| Chat published to your project | "New chat in *Website revamp*" | Members not told |
| ★ Added to / removed from a project | "You were added to *Website revamp*" | Affected person not told |
| Project deleted / restored · member left | "*Old campaign* was deleted by Sam" | Actor only |

**Workspace & team**

| Event | Example | Today |
|---|---|---|
| ★ Invite accepted / member joined | "Priya joined your workspace" | Admins not told |
| ★ Your role changed / you were removed | "You're now an Admin in *Acme*" | Member not told |
| Invite expiring / expired | "Invite to jo@acme.com expires tomorrow" | Nothing |
| Connector shared with the workspace | "Sam shared *Gmail (sales@)* with the workspace" | Owner only |
| Spend limit or workspace settings changed | "Workspace spend limit set to 50,000 credits" | Admin only |

**Credits & billing**

| Event | Example | Today |
|---|---|---|
| ★ Credits low / used up | "You've used 90% of your credits" | Banner above the chat box only |
| ★ Workspace credit pool near limit / paused | "Workspace credits at 95% — chats will pause at 100%" | Inline banner |
| ★ Payment succeeded / failed | "Payment failed — update your card" | Return page only |
| Plan upgraded / subscription cancelled or resumed | "You're now on Pro" | Toast |
| Renewal coming up | "Your plan renews in 3 days" | Display only |
| Budget reached 65% / 90% / 100% | "Team budget at 90%" | Settings options exist but aren't connected |
| Free-trial credits claimed | "1,000 trial credits added" | Toast |

**Connectors**

| Event | Example | Today |
|---|---|---|
| ★ Reconnect needed | "Gmail disconnected — reconnect to keep agents working" | Badge on the Connectors page only |
| ★ Shared connector broke (to its owner) | "*Slack (workspace)* expired — only you can reconnect" | Owner not told |
| Slack needs reinstall / missing permissions | "Slack app needs reinstalling" | The backend sends it, the front-end drops it |
| Requested connector now available | "*Notion* is now available" | Promised in the request form, but nothing sends it |

**Files & account**

| Event | Example | Today |
|---|---|---|
| Upload failed (background / long upload) | "*report.pdf* failed to upload" | Toast only while on the page |
| File processed / indexed | "*handbook.pdf* is ready for agents" | No processing status available yet |
| Session expired | "You were signed out — sign in again" | Toast, then logout |
| New device sign-in | "New sign-in from Chrome on Windows" | No data (Security page uses sample data) |

#### Expected behaviour

- An unread badge on the bell.
- Mark one or all as read.
- Clicking a notification goes straight to the chat, agent, task, artifact or settings page it's about.
- Grouping: repeated events collapse into one item (e.g. "Super Link used 12 times today").
- Settings: turn each type on or off for each channel (in-app / email). Replace today's settings-only page, whose switches aren't saved anywhere.

#### What it needs (from the scan)

- **No notification system exists today.** There's no bell, inbox, unread count, `/notifications` endpoint or real-time channel (WebSocket or live event stream). Feedback is toasts to the person who did the action, in that tab.
- **Backend work needed:** a `/notifications` endpoint (list · unread count · mark as read), delivery by polling or a live stream, and saved preferences.
- **Sources that already exist:** the org audit log (`/organizations/{id}/audit`), the Super Link sharing dashboard (`/persona-shares/dashboard`), and automation run results (`/automations`).
- **Front-end issues to fix along the way:**
  1. Workspace credit status mismatch: the backend sends `healthy | warning_95 | paused`, but the UI checks for `warning_95 | grace | locked`. A paused workspace never shows the locked banner.
  2. Slack `needs_reinstall` and `missing_scopes` are read and then dropped.
  3. The `souvenir:memory-updated` signal is sent but nothing listens for it.
  4. "Workflow invite" in settings refers to `/workflow/*` endpoints that are never used.

> **Perplexity reference: notifications**
> - Perplexity puts the **profile/account button at the bottom-left** of the sidebar. Notification settings are reached from that account menu (*Profile → Notifications*, or *All settings → Notifications*).
> - Perplexity notifies when long-running work finishes: **Deep Research completed, Computer tasks, scheduled tasks, file creation**, plus finance summaries. It offers separate in-app, email and mobile push channels, and each can be switched on or off.
> - **What to take from it:**
>   1. Let the user turn each notification type on or off (e.g. "Automation status: in-app ✓, email ✗") from a settings page reachable from the account menu.
>   2. Treat "long task finished" as the main notification. It maps to our **Automation status** event.
> - Our bell is a step beyond Perplexity's settings-only approach: a visible in-app feed next to the account menu.

### 4.2 Remove Pins & Highlights

Remove **Pins** and **Highlights** from the app for now, including entry points, menus and routes. Removing them from the UI is enough; backend data can stay in place so the features can come back later.

---

## 5. Priority 3 — Tasks context panel (right sidebar)

**Goal:** a live, Perplexity-style context panel for a running task, so the user can see what's happening, who is doing it, and what it costs.

| Section | Contents |
|---|---|
| **Progress** | Overall task progress, time running, tokens spent. Same visual language as the plan card. |
| **Agents** | Each agent working on the task: time running, tokens spent, and sub-progress (active / inactive / count). Also styled like the plan card. |
| **Connectors** | Which connectors are active and which have been used in this task. |
| **Skills** | Skills applied during the task. The section ships empty or hidden until P4. |
| **Usage** | Total usage and cost summary for the task. |

> **Perplexity reference: the Computer context panel**
> - **What it is.** Every Computer thread has a **context panel**: a dedicated workspace beside the conversation where **live progress, generated artifacts and credit usage** appear.
> - **Progress detail.** An activity view shows progress lines with short notes, for example which sites are being read.
> - **Control over sub-agents.** Since Apr 2026, the user can **stop a single sub-agent** or type a follow-up instruction while the task is running.
> - **Environment.** Every task runs in an isolated environment with a real filesystem, a real browser and real tool integrations.
>
> **Ideas to adopt:**
> - An **Artifacts** section: files and outputs appear as they're produced.
> - **Per-agent stop and redirect controls** on each agent row.
> - A short "currently doing…" line under the progress bar.

```
┌─ Task context ───────────────────┐
│ PROGRESS            ▓▓▓▓▓▓░░ 72% │
│ ⏱ 4m 12s   ·   🪙 38.2k tokens   │
├──────────────────────────────────┤
│ AGENTS             2 active / 3  │
│  ● Researcher   ⏱ 2m  🪙 14k     │
│  ● Writer       ⏱ 1m  🪙 9k      │
│  ○ Reviewer     waiting          │
├──────────────────────────────────┤
│ CONNECTORS                       │
│  Gmail — used · Slack — active   │
├──────────────────────────────────┤
│ SKILLS          (coming with P4) │
├──────────────────────────────────┤
│ USAGE           38.2k · $0.41    │
└──────────────────────────────────┘
```

---

## 6. Priority 4 — Skills & Browser

| # | Feature | Detail |
|---|---|---|
| P4.1 | **Skills** | A first-class Skills feature in the web app: create, edit, list and attach reusable instruction or rule files (markdown), similar to Claude's skills. Agents (P0.7), tasks and the "Saved as a skill" notification (P2) all feed into it. |
| P4.2 | **Browser UI** | A visible browser/"computer" view where the agent's web actions can be watched live, like Perplexity Computer or Grok Bot's browser. It may support handing control to the user, including keyboard input, for logins or confirmations. |

> **Perplexity reference: Computer Skills**
> - **Two kinds of skills.** There is a dedicated **Skills** page inside Computer with two groups: **custom skills** the user created, and a **library of general skills** provided by Perplexity.
> - **Creating a skill.** *Skills → Create skill → Create with Perplexity*, which is conversational, or **import existing instructions as markdown**. Perplexity supports the `SKILL.md` format.
> - **Using a skill.** Relevant skills **load automatically** based on the task, and Computer can **combine several skills** in one task.
>
> **For Souvenir:**
> - Provide both "create with AI" and "import .md".
> - Split the Skills page into *My skills* and *Souvenir skills*.
> - Load skills automatically by relevance, so users don't have to attach them by hand.
> - The "Saved as a skill" notification (P2) is the natural way in: turn a good chat or task into a skill.

> **Perplexity reference: browser control**
> - **How it drives the browser.** Computer can take full control of Perplexity's **Comet** browser and run a browser agent that works on **any site or logged-in app with the user's permission**, without connectors or MCPs.
> - **How it works.** It takes a screenshot, a multimodal model reads it, and it sends mouse and keyboard events. It repeats until the task is done or stuck. Because it works from screen coordinates rather than page HTML, it can't act on anything it can't see.
> - **Logins.** For sites that need a login, the user **signs in manually first**, then the agent takes over in that session.
>
> **For Souvenir:**
> - Show the live browser view inside the task's context panel (P3).
> - Add a clear **"Take control / Hand back"** switch for logins and confirmations.
> - Ask for per-site permission before the agent acts in a logged-in app.

---

# Part B — New agents flow in detail

## 7. Design principles

1. **Purpose in, agent out.** The user writes one sentence about what the agent should do. Everything else is generated and can be edited later.
2. **Clarify in conversation, not in forms.** Anything unclear (which connector, which data source, scope) is resolved with **question cards** in chat, not extra settings screens.
3. **The workspace owns the resources.** Knowledge lives in **Library** and connectors live on the account. An agent *uses* them and doesn't hold private copies.
4. **One agent, reused.** An agent is created once and then reused by chats and tasks. Tasks never create a duplicate of an agent that already exists.
5. **Owner edits, everyone else uses or copies.** No shared edit rights and no half-locked agents.
6. **Nothing hidden or disabled.** V1.5 had many disabled, hidden or unused controls. V2 shows only what works.

---

## 8. Creation flow

### 8.1 Overview

```
                    ┌────────────────────────────┐
                    │     User wants an agent    │
                    └─────────────┬──────────────┘
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
   ┌─────────────────────┐                 ┌─────────────────────┐
   │ PATH A — IN CHAT    │                 │ PATH B — MANUAL     │
   │ "Create an agent    │                 │ /agents → New agent │
   │  that…"             │                 │ (or pick a template)│
   └──────────┬──────────┘                 └──────────┬──────────┘
              ▼                                       ▼
   ┌─────────────────────┐                 ┌─────────────────────┐
   │ Question cards to   │                 │ Purpose field       │
   │ clarify purpose,    │                 │ (one sentence)      │
   │ connectors, scope   │                 └──────────┬──────────┘
   └──────────┬──────────┘                            │
              └───────────────────┬───────────────────┘
                                  ▼
               ┌──────────────────────────────────────┐
               │ GENERATION (from purpose)            │
               │  • Name          • Animated avatar   │
               │  • Model         • Description       │
               │  • System instructions               │
               │  • Tone = default                    │
               │  • Temperature = default             │
               └──────────────────┬───────────────────┘
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
   ┌─────────────────────┐                 ┌─────────────────────┐
   │ PATH A              │                 │ PATH B              │
   │ Agent card in chat  │                 │ AGENT EDITOR PAGE   │
   │ [Use now] [Open]    │                 │ (one page, all      │
   │ → saved straight    │                 │  fields pre-filled, │
   │   away              │                 │  live preview card) │
   └──────────┬──────────┘                 │ [Cancel]  [Finish]  │
              │                            └──────────┬──────────┘
              └───────────────────┬───────────────────┘
                                  ▼
               ┌──────────────────────────────────────┐
               │ Agent ready to use                   │
               └──────────────────┬───────────────────┘
                                  ▼
               ┌──────────────────────────────────────┐
               │ Edit any time, in any of 3 synced    │
               │ places:                              │
               │  • Agent editor page (everything)    │
               │  • Right sidebar: agent details      │
               │  • Advanced Personalize modal        │
               │    Instructions · Skills · Memories  │
               │    · Tone · Temperature              │
               └──────────────────────────────────────┘
```

### 8.2 Path A — create in chat (prompt-driven)

1. The user types something like *"Make me an agent that triages support emails every morning."*
2. The assistant recognises the intent and shows **question cards** only where something is ambiguous, for example:
   - *Which connector should it use?* → Gmail (personal) · Gmail (workspace) · Outlook
   - *Where should results go?* → Reply in chat · Slack channel · Email summary
   - *Any documents from Library it should rely on?* → pick from Library
3. When the answers are in, the agent is generated (8.4) and a compact **agent card** appears in the conversation with **Use now**, **Edit** and **Open** actions. *Edit* opens the same agent editor page as Path B (§8.3); *Open* shows its details in the right sidebar.
4. The agent is immediately available in the `+` menu, in mentions, and to tasks.

> Question cards are the **only** place connector choice is made. There is no connector toggle on the agent.

### 8.3 Path B — create manually (`/agents`)

1. `/agents` → **New agent** (or pick a template, §13, which pre-fills the purpose).
2. **Purpose screen:** one field, Purpose, with optional starter chips. There is no Name/Tone wizard. If the generator needs clarification (for example, which connector), the same question cards as Path A appear inline here.
3. **Continue.** The agent is generated (8.4) and the user lands on **one agent editor page**, with every field pre-filled from the purpose.
4. **Agent editor page:** a single page, no tabs.
   - **Left: all fields, editable in one place.** Avatar (regenerate / upload) · Name · Model · Description · Instructions · Tone · Temperature slider · Skills · Memories (empty for a new agent).
   - **Right: a live preview card.** The Agent Card as it will look in lists, chat and pickers, updating as the user types.
   - **Top bar:** *Cancel* and **Finish**. Finish reads *Create agent* for a new agent and *Save changes* when editing.
5. **Finish** saves the agent and returns to `/agents`, with the new agent's details open in the right sidebar.

**The same editor page is used for editing.** *Agent Card → ⋯ → Edit*, or *Edit* in the right sidebar, opens it with the current values. There's one page for both creating and editing, not a separate "create" flow and "configure" flow.

#### Three synced views of one agent

| View | Where | What it edits | When to use it |
|---|---|---|---|
| **Agent editor page** | Full page (`/agents/new`, `/agents/{id}/edit`) | Everything | Creating, or larger edits |
| **Agent details (right sidebar)** | Beside `/agents`, chat or a task | Avatar, name, model, description | Quick look and quick fixes without leaving the page |
| **Advanced Personalize (modal)** | Opened from the sidebar or the editor page | Instructions, Skills, Memories, Tone, **Temperature** | Tuning behaviour |

**Sync rule:** all three views read and write the **same agent record**. An edit in one shows up in the other two straight away, with no separate save state per view. If two views are open on the same agent at once, the most recent save wins and the other view refreshes with a short "Updated" note.

### 8.4 What generation produces

| Field | Source | Editable afterwards in |
|---|---|---|
| Name | Generated from purpose | Editor page · Right sidebar |
| Avatar | Generated animated avatar | Editor page · Right sidebar |
| Model | Best-fit model for the purpose | Editor page · Right sidebar |
| Description | Generated from purpose (card blurb) | Editor page · Right sidebar |
| System instructions | Generated from purpose and question-card answers | Editor page · Advanced modal |
| Tone | **Default tone** | Editor page · Advanced modal |
| Temperature | **Default** (balanced), tuned to the purpose | Editor page · Advanced modal |
| Skills | None to start | Editor page · Advanced modal |
| Memories | None to start; build up with use | Editor page · Advanced modal |

**Compared with V1.5:** Templates → Purpose → Name → Tone (4 screens, with state passed between pages in sessionStorage), then 5 Configure tabs, becomes **purpose → one pre-filled editor page → Finish**.

---

## 9. Agent views: editor page, sidebar details, Advanced modal

The 5-tab Configure system is **fully replaced**. There are three levels of detail in everyday use, plus the full editor page (§8.3) for creating and larger edits. All of them are synced to the same agent record.

```
┌─ AGENT CARD ─────────────────────────────┐   Level 1: glanceable
│  (animated avatar)  Support Triage       │   Shown in lists, chat,
│  @support-triage · Claude Sonnet         │   pickers, and as the
│  "Sorts and drafts replies to support…"  │   editor's live preview
│  [Use]  [Share]  [⋯ → Edit]              │
└──────────────────┬───────────────────────┘
                   ▼ open
┌─ AGENT DETAILS (right sidebar) ──────────┐   Level 2: basics
│  Avatar (animated, regenerate/upload)    │
│  Name                                    │
│  Model ▾                                 │
│  Description                             │
│  ────────────────────────────────────    │
│  [Advanced Personalize]   [Edit page ↗]  │
└──────────────────┬───────────────────────┘
                   ▼ opens modal
┌─ ADVANCED PERSONALIZE (modal) ───────────┐   Level 3: power users
│  Instructions   system prompt            │
│  Skills         .md rule files           │
│  Memories       learned preferences      │
│  Tone           default ▾                │
│  Temperature    precise ──●── creative   │
│                          [Cancel] [Save] │
└──────────────────────────────────────────┘

  All levels ⇄ AGENT EDITOR PAGE (every field on one page + live preview card)
```

### 9.1 Advanced Personalize (modal)

| Section | What it is |
|---|---|
| **Instructions** | The system prompt. Starts as the generated version and is fully editable. |
| **Skills** | Markdown rule files the agent follows, similar to Claude's skills: formatting rules, procedures, checklists. Add, remove and reorder them. Uses the global Skills feature once P4 lands. |
| **Memories** | Preferences and habits the agent learns across chats over time ("prefers bullet summaries", "always CC the team lead"). The user can view, edit and delete individual memories. |
| **Tone** | Starts at the default tone. Change it here. |
| **Temperature** | A slider from *Precise* to *Creative*. It starts at a balanced default tuned to the purpose; lower for factual or support work, higher for writing or brainstorming. It replaces V1.5's "Creativity level". |

### 9.2 Editing rules

- **Only the owner** can edit: the editor page, the sidebar fields and the modal. Everyone else sees the Card and agent details read-only, with **Use** and **Copy**, and can't open the editor page or the modal.
- Saving becomes predictable: **one save behaviour everywhere**. The editor page saves on **Finish**, and the modal on **Save**. Sidebar fields save as soon as the user leaves the field (with a brief "Saved" note). This replaces V1.5's mix of "creates a new version / updates in place / saves instantly". *(Exact versioning behaviour: see Open questions.)*
- **Sync:** the editor page, sidebar and modal all read and write the same agent record, so an edit in one appears in the others immediately (§8.3).

---

## 10. Knowledge & connectors (workspace-level)

```
                ┌─────────────── WORKSPACE ACCOUNT ───────────────┐
                │                                                 │
                │  LIBRARY (global media & docs)   CONNECTORS     │
                │  files · URLs · media            personal +     │
                │                                  shared         │
                └───────────┬───────────────────────────┬─────────┘
                            │ read                      │ use
                ┌───────────┴───────────────────────────┴─────────┐
                │        Agent A     Agent B     Agent C          │
                │   (no private knowledge · no connector toggles) │
                └─────────────────────────────────────────────────┘
```

- **Knowledge.** Agents use documents from **Library**, the new workspace-wide media and docs manager. Per-agent uploads are gone.
- **Connectors.** Agents can use any connector on the workspace account, personal or shared. There are no per-agent blocked or disabled lists.
- **Choosing a connector.** When more than one could apply (for example personal vs workspace Gmail), the agent asks with a **question card** in chat instead of relying on a setting.
- **Access** follows the running user's account permissions. An agent can never reach a connector or document the current user can't.

---

## 11. Sharing model

Sharing moves out of the agent's configuration into its own **Share** action on the Agent Card.

| # | Type | How it works | Recipient gets |
|---|---|---|---|
| 1 | **Share as template** | Modelled on Grok Bot's *Share as Template*: the agent is packaged (instructions, skills, relevant memories, required connectors) into an **anonymised, private template** with a link. The sharer chooses to share with specific people/team or via a public link. Sensitive data is **not** included. | Their **own independent copy**, owned and editable by them. They connect their own connectors. |
| 2 | **Publish to workspace** | The agent is listed in the workspace so teammates can find it. | A **copy to use**. The original stays owner-only. |
| 3 | **Super Link** | Same packaging and install style as type 1, delivered as a Super Link with its existing controls (credit limit, expiry, revoke). | Same experience as type 1. |

**Install flow for types 1 and 3** (following Grok Bot's pattern):
1. The recipient opens the link and sees a preview: name, avatar, description, instructions summary, skills, and **the connectors it needs**.
2. **Add to my agents** creates an independent copy in their account.
3. They're prompted to connect only the connectors the agent actually needs.
4. They land **on the new agent**, not on a generic library page. This fixes a V1.5 gap.

**Rules:**
- Only the owner can edit the original. A copy is fully owned by whoever installed it.
- Personal memories and private data never travel with a template unless the owner explicitly includes them.
- The recipient's notifications (P2) show "Agent received". The sharer's notifications show Super Link usage.

---

## 12. Using agents in chats & tasks

### 12.1 Manual use

- **In the prompt:** mention an agent by name or handle (for example `@support-triage`).
- **From the composer:** `+` → **Agents** → pick one. It attaches as a chip above the input.
- Works the same in **Chat** and **Task** mode (P1). Workspace-published agents appear in the list too, so nothing is silently left out as it was in V1.5.

### 12.2 Automatic use by tasks

```
 Task prompt ──► Does it need an agent?
                     │
          ┌──────────┴──────────┐
          no                    yes
          │                     ▼
      run task      Does a matching agent already exist
                    (owned by or available to the user)?
                          │
                ┌─────────┴─────────┐
               yes                  no
                │                   ▼
          REUSE it         CREATE it once (purpose-only
                           generation, §8.4) → saved to
                           the user's agents → use it
```

- **No duplicates.** Before creating an agent, a task looks for an existing one with the same purpose and reuses it.
- Agents created automatically are **normal agents**. They show up in `/agents` and can be edited, shared or deleted like any other.
- The Tasks context panel (P3) shows which agents a task created or reused, along with their time and token usage.

---

## 13. Templates page

```
 [ Recommended for you ]  [ General ]
   ─────────────────────
   Personalised for this       All existing V1.5 templates
   customer (industry,         kept as-is
   usage, connected tools)
```

- **General:** all existing templates are kept.
- **Recommended for you:** templates picked for this specific customer.
- Picking a template **pre-fills the Purpose** and goes through the same generation step (8.4).

---

## 14. What gets removed from V1.5

| Removed | Replaced by |
|---|---|
| 4-step wizard (Templates → Purpose → Name → Tone) | Purpose-only creation |
| 5-tab Configure (Instructions / Profile / Knowledge / Connectors / Sharing) | One agent editor page + right-sidebar details + Advanced Personalize modal, all synced |
| Per-agent Knowledge uploads | Workspace **Library** |
| Per-agent connector enable/disable | Workspace connectors + question cards |
| Sharing tab (Private/Workspace radio, email invite) | Share action with 3 types (§11) |
| Hidden or disabled controls (team visibility, Team filter, team badge) | Removed. Nothing ships hidden. |
| Wizard sessionStorage chain (`persona_wizard_*`) | Nothing to replace (no multi-page wizard) |
| Floating Test Chat / AI Suggestions / Versions shell | *To confirm (see Open questions)* |
| Pins & Highlights (P2) | Removed for now |

---

## 15. Open questions

1. **Versioning.** Does V2 keep agent versions and a publish step, or is every save live? If versions stay, what does "publish" mean now that sharing creates copies?
2. **Test Chat and AI Suggestions.** Are they kept (e.g. a "Try it" box on the editor page), or does the user just test the agent in a normal chat?
3. **Memories.** Per user, per agent, or both? Do memories learned by a copied agent stay with that copy only?
4. **Reuse matching.** How does a task decide an existing agent "matches"? By purpose similarity, by name, or by asking the user with a question card?
5. **Library permissions.** Can an agent be limited to part of Library (a folder or tag), or does it always see everything the user can see?
6. **Default model, tone and temperature.** What are they, and who can change the defaults (workspace admin or user)?
7. **"Recommended for you" signals.** Which data personalises the recommendations (industry, onboarding answers, connected tools, usage)?
8. **Publish to workspace vs Share as template.** Both hand out copies. Is the difference only discovery (a workspace listing vs a link), or is there more?
9. **Migration.** What happens to existing V1.5 agents' per-agent knowledge files and blocked-connector lists: move them into Library, or drop them?
10. **Backend coverage.** Which parts need new backend work, for example generation from purpose, Library, memories, templates and agent matching? This needs a separate FE→BE handover doc.

---

## 16. Existing vs proposed: pros, cons and why V2 is better

### 16.1 Side-by-side

| Area | Existing (V1.5) | Proposed (V2) | Why V2 is better |
|---|---|---|---|
| **Time to first agent** | 4 wizard screens, then 5 Configure tabs before it's really usable | 1 input (purpose) → agent ready | Much faster to get started. Most users never need more than the basics. |
| **Required input** | Purpose, name, tone, then instructions (the only required field) | Purpose only. Everything else is generated. | Nobody has to write a system prompt from a blank box. |
| **Configuration surface** | 5 tabs + 3 floating panels + Help, with a different content width on some tabs | One editor page for everything, plus a sidebar for basics and a modal for Advanced, all synced | Less to learn. Everything is on one page, and advanced options stay out of the way until wanted. |
| **Save behaviour** | Four different behaviours: Instructions creates a new version, Profile updates in place, Knowledge/Connectors save instantly, Sharing uses its own calls | One save behaviour for the whole panel | Predictable. Removes the biggest source of confusion and lost work in V1.5. |
| **Leaving a page** | Silent autosave that hides its own errors; the "Save before leaving?" dialog is disabled | One editor page with an explicit Finish; no multi-page state to lose | Fewer ways to lose edits without noticing. |
| **Knowledge** | Uploaded per agent and per version. Delete is a hard delete with no undo. | Workspace **Library**, managed in one place | Upload once, use in every agent. No duplicate files across agents. |
| **Connectors** | Per-agent on/off toggles that flip silently, with no explanation of what access they grant | Workspace connectors, with the choice made by question cards at the moment it matters | No setup screen. The choice is made in context and explained where it's asked. |
| **Sharing** | Private → Workspace can't be undone; Super Link gives a locked, read-only copy; recipient lands on `/agents` | 3 copy-based types; the recipient owns an editable copy and lands on it | Recipients get something they can actually use and adapt. No confusing locked copies. |
| **Edit rights** | Owner, plus locked read-only copies from Super Links | Owner-only; every copy is fully owned by whoever installed it | One simple rule: you edit what you own. |
| **Reuse** | Manual only. Nothing stops near-duplicate agents. | Tasks automatically reuse a matching agent and create one only if none exists | Agents get better with use instead of multiplying. |
| **Availability in chat** | "Add agent" silently leaves out Workspace agents | Every agent the user can use is listed | Nothing silently missing. |
| **Personalisation over time** | None. The agent is only what's configured. | **Memories** learned across chats | The agent improves with use, without the user editing settings. |
| **Hidden / dead code** | Team visibility, Team filter, team badge, unused constants, hardcoded "Updated just now" | Only what works ships | Cheaper to maintain and more honest to users. |
| **State management** | About 10 sessionStorage/localStorage keys passed between wizard and Configure pages | Mostly server-side; no multi-page wizard | Fewer order-dependent bugs, and it works across devices. |

### 16.2 Existing system (V1.5)

| Pros | Cons |
|---|---|
| Precise, explicit control over every field | Slow start: 4 screens before any value |
| Per-agent knowledge and connector isolation. Access is scoped tightly by default. | Saving works differently on each tab, which is confusing and can change live agents without warning |
| Version history with restore, plus a 5-version limit that protects the published and open versions | Leaving a page never asks; autosave errors are hidden |
| Test Chat and AI Suggestions sit beside the editor | Test panels stay locked until the first Save, and the lock screen offers no Save button |
| Already built, with many race-condition fixes done | Knowledge delete is a hard delete with no undo |
| Nothing is auto-generated, so no surprises from AI | Workspace agents are silently missing in chat; Brain picker states false ownership |
| | Lots of hidden, disabled or dead UI; fragile sessionStorage chains |
| | Super Link recipients get a locked copy and land on the generic library |

### 16.3 Proposed system (V2)

| Pros | Cons / risks |
|---|---|
| Fast: purpose in, agent out | **Generation quality risk:** a weak name, model or prompt becomes the default if nobody reviews it |
| Conversational: question cards clarify only when needed | **Broad access by default:** every agent can reach all of Library and every connector the user has. Weaker least-privilege than V1.5. |
| One editor page, one save behaviour | **Too many question cards** would feel like a form again |
| Knowledge and connectors managed once, at workspace level | **Clutter:** tasks auto-creating agents could fill `/agents` |
| Agents reused across chats and tasks, no duplicates | **Wrong reuse:** matching could pick an agent that's only roughly right |
| Memories make agents improve over time | **Memory privacy and "creepiness":** users may not know what was learned |
| Copy-based sharing is simple, and recipients can edit their copy | **Lost V1.5 strengths** (version history, Test Chat) unless deliberately kept |
| Nothing hidden or disabled ships | **Large rebuild:** new backend work (generation, Library, memories, matching) and migration of existing agents |

### 16.3a Proposed fixes for the V2 risks

> **Shared rule:** keep the fast default, and put a visible note with a one-click *Undo / Swap / Edit* right where it's used. No extra settings screens.

**1. Generation quality: generate well, then let the user check it**
- **Preview before create:** in Path B this is built in: the agent editor page shows every generated field pre-filled next to a live preview card, with Regenerate on each field, and nothing is saved until **Finish**. In Path A, the agent card in chat has **Edit**, which opens the same page.
- **Structured prompt:** generated instructions always follow one outline (role · goals · tools · output format · limits), so quality is consistent.
- **More context in:** purpose + question-card answers + workspace context (industry, connected tools).
- **Model chosen by rules** (type of work → model), not free-form AI choice. Offer 2–3 name/avatar options to pick from.
- **Self-test:** run 2–3 sample prompts before showing the agent. Add an *Improve instructions* button in Advanced, fed by 👍/👎 on replies.

**2. Broad access by default: reading is open, writing needs permission, access can be narrowed**
- **Read vs write:** reading from Library and connectors is open. Sending / posting / editing / deleting asks the first time: *Allow once / Always allow for this agent*.
- **Access line in agent details and the editor page:** "Can access: All Library · Gmail, Slack" with *Edit* to narrow it to folders, tags or connectors. Off by default, and it doesn't bring back per-connector toggles.
- **Access follows the person using the agent:** never more than the current user can access. Shared copies never carry the owner's access.
- **Sensitive Library items** (HR, finance) are used only when the scope names them explicitly.
- **Activity log** per run ("Read 3 docs · sent 1 email") in the task side panel.

**3. Too many question cards: strict limit, smart defaults, never ask twice**
- **Only ask when the answer changes the result.** If there's a single or sensible default, use it and mention it: "Using Gmail (workspace) · change".
- **At most 3 cards** per creation, shown together in one group.
- **Every card has a default selected + Skip**, so pressing Enter moves on.
- **Remember answers** as the agent's defaults and as workspace preferences.
- **Measure it:** if more than about half of users skip a card, stop asking that question.

**4. Clutter: task-created agents start temporary and are kept once useful**
- **Temporary at first:** tied to the task that created it, and not shown in the main `/agents` list.
- **Kept automatically** after 2–3 reuses, or when the user clicks *Keep* in the task side panel.
- **Auto-archived** after 30 days unused; archived agents can be restored.
- **Filters on `/agents`:** Mine · Created by tasks · Shared with me · Archived.
- **Merge suggestions** for look-alike agents.

**5. Wrong reuse: match with a confidence score, show the choice, allow a swap**
- **Match on more than the name:** purpose similarity + tools needed + past success.
- **High** confidence → reuse and show "Using Support Triage (reused) · Swap". **Medium** → one question card: "Use Support Triage or create a new agent?" **Low** → create a new agent.
- **Learn from swaps:** stop suggesting that match for that type of task.
- **Reuse with small adjustments:** add instructions for that run only, without changing the saved agent.

**6. Memory privacy: visible, can be undone, never leaves the user**
- **Say when it learns:** a "Learned: prefers bullet summaries · Undo" note, never silent.
- **Memories page per agent:** view / edit / delete, clear all, turn learning off for that agent.
- **Memories belong to a person and an agent**, never the workspace. They're never included in templates, workspace publishing or Super Links unless the owner picks specific ones.
- **Never saved:** passwords, secrets, payment details, sensitive Library content. Everything else is filtered before it's saved.
- **Incognito chat:** a per-chat switch so nothing from that conversation is learned.

**7. Lost V1.5 strengths: keep the safety nets, drop the ceremony**
- **History:** automatic snapshot on every save; *⋯ → History → Restore*; the user can pin a version so it's never removed.
- **"Try it" box on the editor page** (next to the preview card), with no lock, because the agent exists as soon as it's created.
- **AI Suggestions → "Improve"** button inside Advanced → Instructions.
- **Tight access** comes back through the Access line (fix 2).
- **Keep the tested pieces:** reuse V1.5's fixed save and race-condition logic where it still applies.

**8. Large rebuild: build in phases, reuse what exists, make migration reversible**
- **Start on the existing backend:** `POST /persona/starter` already generates a prompt from name + purpose, and `POST /persona` already creates repo + version together. Purpose-only creation can use them first.
- **Phases:** (1) new creation + panel over existing APIs → (2) Library + workspace connectors → (3) memories, matching, templates.
- **Feature flag per workspace**, with V1.5 and V2 running side by side during rollout.
- **Migration (S10)** with a dry-run report and rollback; existing agents behave exactly as before.
- **FE→BE handover doc early**, listing new endpoints per phase.

### 16.4 Verdict

V2 is the better system because it removes the **cost of getting started** and the **inconsistency** that cause most of V1.5's problems:

- Four ways of saving become one.
- Four setup screens become one sentence.
- Per-agent copies of files and connectors become shared workspace resources.

V1.5's real strengths are **tight access scoping, version history and inline testing**. They aren't reasons to keep V1.5, but V2 should carry them over deliberately. The fixes in §16.3a do exactly that while also reducing V2's own risks, and §17 sets out when to build them.

---

## 17. Suggested improvements beyond this proposal

This section has two parts:
- **17.1** says **when** to build the risk fixes from §16.3a.
- **17.2** adds **new ideas** that go beyond both the proposal and the fixes.

### 17.1 Risk fixes: build order

| When | Fix (§16.3a) | Minimum to ship | Why at this point |
|---|---|---|---|
| **With P0** (must-have) | 1 · Generation quality | Agent editor page with live preview card + Regenerate per field (Path B); Edit on the chat card (Path A) · structured prompt outline · model chosen by rules | Purpose-only creation depends on generating a good agent. Without a review step, bad defaults ship. |
| **With P0** | 2 · Broad access | Approval before write actions · Access line in details/editor · access follows the person using the agent | Workspace-wide access is the biggest trust risk. It has to be safe on day one. |
| **With P0** | 3 · Question cards | At most 3 cards · a default selected on every card + Skip · remember answers | Question cards are how both creation paths work. Too many and the "one input" promise is broken. |
| **With P0** | 8 · Large rebuild | Build on `POST /persona/starter` + `POST /persona` · per-workspace feature flag · migration with dry run and rollback | This is how P0 ships safely at all. |
| **Soon after P0** | 5 · Wrong reuse | Confidence-based matching · "(reused) · Swap" · learn from swaps | Only matters once tasks start reusing agents. |
| **Soon after P0** | 4 · Clutter | Task-created agents start temporary · kept after reuse · auto-archive · filters | Only matters once tasks start creating agents. |
| **Soon after P0** | 7 · Lost V1.5 strengths | Auto-snapshot history + restore · "Try it" box · "Improve" button | Safety nets people will miss within weeks. |
| **Together with Memories** (not after) | 6 · Memory privacy | "Learned · Undo" note · memories page · never shared by default · never-save filter · incognito chat | Memories must never ship without these controls. Privacy trust is hard to win back. |

### 17.2 New ideas beyond the proposal

| # | Idea | What it adds | Links to |
|---|---|---|---|
| N1 | **Template updates** | When the owner improves a shared template, recipients get "Update available" (P2) and can apply or ignore it. Their own edits are kept. | §11 Sharing, P2 |
| N2 | **Per-agent usage and feedback** | In agent details: runs, tasks, success rate, tokens, 👍/👎 ratio. It also provides the data for "Used by N teammates" on shared agents. | §9, §11, Fix 1 |
| N3 | **Effort control in Task** | Light / Standard / High instead of a model picker, as in Perplexity's Effort Mode. | P1.3 |
| N4 | **Saved test prompts** | A few example prompts per agent, re-run after each change to its instructions, with before/after replies shown side by side. | Fix 1, Fix 7 |
| N5 | **Agent triggers and schedules** | Run an agent on a schedule ("every morning 9:00") or on an event (new email, new Slack message). Results and failures appear under P2's Automation status. | P2, Tasks |
| N6 | **Agents working together in tasks** | A task agent can hand a sub-step to another agent (Researcher → Writer → Reviewer). The P3 panel shows the hand-off chain. | P3 Agents section |
| N7 | **Starter agents from connected tools** | After onboarding or connecting a tool, suggest 2–3 ready-made agents ("You connected Gmail + HubSpot → *Lead follow-up* agent"). This powers *Recommended for you*. | §13 Templates |
| N8 | **Export / import agents** | Download an agent as a bundle (instructions + skills as `.md`, compatible with the `SKILL.md` format) and import it elsewhere. Useful for portability and backup, and a base for template sharing. | §11, P4 Skills |
| N9 | **Spend limits per agent** | A monthly token/credit limit per agent, with a P2 alert at 80% and a pause at 100%. Stops task agents running away with costs. It's the same idea as the Super Link credit limit. | P2, P3 Usage |
| N10 | **Quick agent switcher** | Type `@` for a keyboard picker with recent and favourite agents first, the same in Chat and Task. | §12.1 |
| N11 | **Embeddable agents** | A stable agent + chat component or API so the separate e-commerce dashboard can embed Souvenir agents instead of rebuilding them. | Adjacent work (§1) |

**Suggested order for new ideas:**
- **Early:** N2, N3, N10. Small builds that make every day better.
- **Next:** N4, N5, N7, N9.
- **Later:** N1, N6, N8, N11.

---

## 18. Edge cases: covered, partly covered and missed

This review draws on three sources:
- the V2 proposal as written here, including the §16.3a fixes;
- the V1.5 edge cases in `docs v1.5/flows/agents-flow-diagram.html`;
- the front-end scan in §4.1.

**Status key:** ✅ covered · 🟡 partly covered (the idea is there, but the behaviour isn't defined) · ❌ missed.
**Priority:** 🔴 decide before building P0 · 🟠 decide during P0 · ⚪ later.

### 18.1 Covered by the proposal ✅

| Area | Edge case | How V2 handles it | Where |
|---|---|---|---|
| Creation | Vague or ambiguous purpose | Question cards ask only what's unclear | §8.2, Fix 3 |
| Creation | More than one connector could fit | A question card picks one (personal vs workspace) | §10 |
| Creation | No suitable connector connected | Offer to connect one inline | §10, P1.6 |
| Creation | Too many questions | At most 3 cards, defaults pre-selected, Skip, answers remembered | Fix 3 |
| Creation | Weak generated name, prompt or model | Editor page with live preview and Regenerate per field; structured prompt; model chosen by rules | §8.3, Fix 1 |
| Creation | User abandons the editor page | *Cancel* saves nothing | §8.3 |
| Editing | Same agent open in two views | Latest save wins; the other view refreshes with an "Updated" note | §8.3 sync rule |
| Editing | Non-owner tries to edit | Read-only Card and details; Use / Copy only | §9.2 |
| Editing | Edits lost when leaving (V1.5 bug) | One explicit save behaviour: Finish / Save / on leaving a field | §9.2 |
| Editing | Changing a live agent by accident (V1.5 bug) | No instant-save tabs; history with restore | §9.2, Fix 7 |
| Access | Agent reaching more than the user can | Access follows the person using the agent | Fix 2 |
| Access | Agent sends, posts or deletes without consent | Approval on the first write action | Fix 2 |
| Access | Sensitive Library content | Used only if named in the agent's scope | Fix 2 |
| Chat | Workspace agents missing from "Add agent" (V1.5 bug) | Every agent the user can use is listed | §12.1 |
| Chat | Switching Chat ⇄ Task loses input | Prompt, attachments, agent and project are kept | P1.2 |
| Sharing | Recipient lands on the generic library (V1.5 bug) | Lands on their new copy | §11 |
| Sharing | Recipient lacks the needed connectors | Prompted to connect only what the agent needs | §11 |
| Sharing | Sensitive data or memories in a template | Anonymised; memories never shared by default | §11, Fix 6 |
| Sharing | Super Link cost runaway | Credit limit, expiry, revoke | §11 |
| Tasks | Duplicate agents from tasks | Reuse a matching agent; create once | §12.2 |
| Tasks | Wrong agent reused | Confidence levels + "(reused) · Swap" | Fix 5 |
| Tasks | Clutter from task-created agents | Temporary until reused, auto-archive, filters | Fix 4 |
| Tasks | A site needs a login | Take control / Hand back | P4.2 |
| Memory | Unwanted or creepy memory | "Learned · Undo", memories page, never-save list, incognito chat | Fix 6 |
| Migration | Existing V1.5 agents | Behaviour-preserving migration, dry run, rollback, feature flag | Fix 8, S10 |
| Notifications | Task finishes while the user is elsewhere | Secondary notification "Task finished" | §4.1 |
| Notifications | Notification overload | Grouping + per-type, per-channel settings | §4.1 |

### 18.2 Partly covered 🟡

| Area | Edge case | What's there | What's missing | Priority |
|---|---|---|---|---|
| Editing | Editing an agent **while it's running** in a task, chat or automation | Sync rule for open views | Whether a running task uses the old or new version. **Suggest:** each run takes a snapshot of the agent at start; edits apply to the next run. | 🔴 |
| Sharing | Owner improves a template after sharing | N1 "Update available" | What "Publish to workspace" does to existing teammate copies. **Suggest:** the listing updates, existing copies don't; copies get "Update available". | 🟠 |
| Sharing | Super Link **revoked or expired mid-conversation** | Revoke and expiry exist | What the recipient sees. **Suggest:** a clear end-of-access message in the chat, a notification, and keep their history read-only. | 🟠 |
| Tasks | Connector expires **mid-task** | "Reconnect needed" notification | Task behaviour. **Suggest:** pause the task at that step as "Waiting for you", reconnect inline, then resume. | 🔴 |
| Tasks | Credits run out mid-generation or mid-task | Credit banners and notifications | What happens to partial work. **Suggest:** save partial results, pause instead of failing, resume after top-up. | 🔴 |
| Browser | User never comes back after "Take control" | Take control / Hand back | Timeout. **Suggest:** pause after N minutes, send a "Task waiting for you" notification, release the session safely. | 🟠 |
| Memory | A one-off instruction learned as a permanent preference | Learned · Undo | Scope. **Suggest:** ask "Remember this for next time?" for preference-like memories, or offer a *This chat only* option. | 🟠 |
| Notifications | Notification points at something deleted or no longer accessible | Deep links | The target state. **Suggest:** a "No longer available" page with the reason (deleted, access revoked). | ⚪ |
| Access | Very large Library ("All Library" by default) | Access line can narrow scope | Relevance and cost limits. **Suggest:** retrieval caps and ranking; show "used 3 of 1,200 docs" in the activity log. | 🟠 |

### 18.3 Missed by the proposal ❌

**Creation & generation**

| Edge case | Risk | Suggested handling | Priority |
|---|---|---|---|
| Generation fails or times out | User stuck on a spinner, or the purpose is lost | Keep the purpose; offer *Retry* and *Fill in manually* (an editor page with empty fields) | 🔴 |
| Purpose is nonsense, too short or against policy | Junk agents, or unsafe instructions generated | Validate before generating; ask one clarifying card; refuse politely against policy | 🔴 |
| User manually creates an agent that already exists | Duplicates, even though tasks avoid them | "You already have *Support Triage* — use it, or create anyway?" | 🟠 |
| Generated name or handle clashes with an existing one | Confusing duplicates, broken @mentions | Keep handles unique; auto-suffix and show the result in the preview | 🟠 |
| Browser refresh or close on the editor page before Finish | All generated content lost (V1.5 had drafts; V2 doesn't say) | Save a local draft, with "Resume your unsaved agent?" on return | 🟠 |
| Path A: user leaves chat halfway through the question cards | Half-created agent in limbo | No agent until answers are in; a "Continue creating *X*" chip when the chat is reopened | ⚪ |
| Rules pick a model the plan or admin doesn't allow | Agent created but unusable | The rules only choose from models allowed for this user and workspace | 🔴 |
| Purpose written in another language | Instructions generated in English | Generate in the purpose's language; say so in the preview | ⚪ |

**Ownership & lifecycle**

| Edge case | Risk | Suggested handling | Priority |
|---|---|---|---|
| Owner **deletes** an agent that chats, automations, tasks or a workspace listing depend on | Broken chips, failing schedules, dead links | Warn with a list of dependents; soft delete (restore for 30 days); pause automations and notify; chats keep the name and avatar | 🔴 |
| Owner **leaves the workspace** or deletes their account | Orphaned workspace-published agents nobody can edit | Ownership moves to a workspace admin, or the admin picks a new owner | 🔴 |
| No way to **transfer ownership** | "Only the owner can edit" becomes a dead end for teams | *Transfer ownership* action for the owner and admins | 🟠 |
| Admin can't take down a harmful or broken **published** agent | Workspace-wide problem with no fix | Admin *Unpublish* / *Disable* on workspace listings | 🟠 |
| Can a published agent be **unpublished**? (V1.5 was one-way) | Unclear, irreversible feeling | Define it: unpublishing removes the listing; existing copies stay | 🟠 |
| Recipient **re-shares** their copy | Attribution confusion, templates spreading without control | Allow it; keep a "Based on *X* by Sam" line; the owner can set "no re-share" | ⚪ |
| Plan limits: maximum agents, skills or memories reached — including during **automatic** creation by a task | Task fails unexpectedly | Tasks reuse the closest agent or ask; show the limit in the P3 panel | 🟠 |
| Scheduled automation depends on a temporary agent that's about to be auto-archived | Automation breaks after 30 days | Any agent used by an automation is kept automatically | 🔴 |

**Knowledge & connectors**

| Edge case | Risk | Suggested handling | Priority |
|---|---|---|---|
| A Library document the agent relies on is **deleted, moved or re-permissioned** | Agent quietly loses knowledge | "1 source no longer available" in agent details, with a notification to the owner | 🟠 |
| Template or published agent refers to Library folders or connectors the recipient **doesn't have** | Broken copy | Install preview lists missing items; drop them or pick a replacement during install | 🔴 |
| Workspace-published agent was built with the owner's **personal** connector | Teammates' copies try to use the owner's account | Never carry personal connections; each user connects their own | 🔴 |
| Workspace **blocks** a connector the template needs | Install succeeds but the agent can't work | Show "Not available in your workspace" before *Add to my agents* | 🟠 |
| Connector account **switched** (different Gmail) after agents were set up | Agents act on the wrong mailbox | Question-card defaults are tied to the account id; ask again if it changes | ⚪ |

**Sharing & billing**

| Edge case | Risk | Suggested handling | Priority |
|---|---|---|---|
| **Whose credits** pay: template copy vs workspace copy vs Super Link | Surprise bills | Define: Super Link = sharer's credits (with limit); template and workspace copies = recipient's | 🔴 |
| Template shared to **another workspace or public** | Data and billing crossing organisations | Public templates carry no memories and no Library links; installing uses the installer's workspace | 🟠 |
| Recipient not signed in (V1.5 bug: return URL lost) | Recipient never gets back to the share | Keep a return link through sign-in and sign-up | 🔴 |
| Template accepted twice / already installed | Duplicate copies | "You already have this agent — open it" | ⚪ |

**Tasks & multi-agent**

| Edge case | Risk | Suggested handling | Priority |
|---|---|---|---|
| Two tasks create the **same agent at the same moment** | Duplicates despite reuse | The backend deduplicates by purpose within a short time window | 🟠 |
| Task reuses a **teammate's workspace-published** agent | Unclear whose agent runs, and whose connectors | On first use, make a personal copy (same as the Use flow) and mark it in the P3 panel | 🔴 |
| Agents hand off to each other in a **loop** (N6) | Runaway cost | Hand-off depth limit + spend limit per task | ⚪ |
| Task agent tries to write with nobody around (scheduled run) | Blocked forever, or acts without approval | Scheduled runs use "Always allow" approvals given earlier; otherwise pause and notify | 🔴 |

**Privacy, security & accessibility**

| Edge case | Risk | Suggested handling | Priority |
|---|---|---|---|
| Passwords typed during "Take control" end up in logs, memory or artifacts | Credential leak | Never record typed input in take-control mode; exclude it from memory and replays | 🔴 |
| User asks to **export or delete** all their memories (GDPR) | Compliance gap | Export and delete-all on the memories page, including memories held by copies | 🟠 |
| Animated avatars for users who prefer reduced motion | Accessibility | Respect the "reduce motion" setting with a static avatar | ⚪ |
| Hundreds of agents in the `@` / `+` picker | Slow, unusable list | Search, recent and favourites first; hide archived agents | ⚪ |
| Composer: attaching a project the user can't access or that was deleted | Error after sending | Only list accessible projects; check again on send | ⚪ |

### 18.4 Resolve before building P0 (🔴 summary)

1. **Snapshot per run:** editing a running agent never changes a run in progress.
2. **Generation failure and junk purposes:** retry, manual fill, validation.
3. **Allowed models only:** the rules never pick a model the plan or admin blocks.
4. **Delete, leave and orphan rules:** dependency warning, soft delete, admin takes over ownership.
5. **Automations protect their agents:** never auto-archive an agent a schedule uses.
6. **Install-time checks:** missing Library items or connectors, and never carry personal connectors.
7. **Billing rules for each sharing type:** who pays, clearly stated.
8. **Sign-in return link** for share recipients.
9. **Task using a teammate's agent:** copy on first use.
10. **Paused tasks instead of failed ones:** for an expired connector, credits running out, or a write approval when nobody's around.
11. **No credential capture** in take-control mode.

---

### References

- V1.5 agents flow: `docs v1.5/flows/agents-flow-diagram.html`
- Grok Bot templates (sharing reference for §11):
  - [Templates for Grok Bot — x.ai guide](https://x.ai/bot/guides/templates-for-grok-bot)
  - [Grok Bot templates are now shareable — daily.dev](https://daily.dev/posts/grok-bot-templates-are-now-shareable-wtpqmq6jk)
  - [Grok Bot Templates (2026): How to Share, Install, and Vet Them — AI Builder Club](https://www.aibuilderclub.com/blog/grok-bot-templates)
- Perplexity (references for P1–P4):
  - [Introducing Perplexity Computer](https://www.perplexity.ai/hub/blog/introducing-perplexity-computer)
  - [What Is Perplexity Computer? — Build Fast with AI](https://buildfastwithai.com/blogs/what-is-perplexity-computer)
  - [Perplexity release notes, Sept 2026 (Effort Mode, Side Chat) — Releasebot](https://releasebot.io/updates/perplexity-ai)
  - [Perplexity changelog — Computer context visibility](https://www.perplexity.ai/changelog/computer-in-microsoft-365-improved-context-visibility-and-new-analytics)
  - [Perplexity Computer review — DataCamp](https://www.datacamp.com/tutorial/perplexity-computer)
  - [Perplexity models & modes 2026 — Data Studios](https://www.datastudios.org/post/perplexity-ai-all-available-models-modes-and-how-they-differ-in-late-2025)
  - [Add a thread to a Space — Guideflow](https://www.guideflow.com/tutorial/how-to-add-a-thread-to-a-space-in-perplexity)
  - [Troubleshooting connectors — Perplexity Help Center](https://www.perplexity.ai/help-center/en/articles/2026091802-troubleshooting-connectors)
  - [Account & Settings — Perplexity Help Center](https://www.perplexity.ai/help-center/en/articles/10352990-account-settings)
  - [Enable Computer task notifications — Guideflow](https://www.guideflow.com/tutorial/how-to-enable-computer-tasks-email-notification-in-perplexity)
  - [How to Use Computer Skills — Perplexity Academy](https://www.perplexity.ai/hub/academy/how-to-use-computer-skills)
  - [Perplexity rolling out SKILL.md support — TestingCatalog](https://www.testingcatalog.com/perplexity-rolling-out-skills-support-for-perplexity-computer/)
  - [Computer takes control of Comet — Perplexity on X](https://x.com/perplexity_ai/status/2033598416962592813)
  - [Perplexity Computer browser control — Fazm](https://fazm.ai/blog/perplexity-computer-browser-control)
