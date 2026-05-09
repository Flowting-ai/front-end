# Chat Preview — Complete SSE & Animation Specification

> Source of truth for every scenario, SSE event, phase transition, and animation in `app/chat-preview/page.tsx`.
> All timings are based on the default control-panel values unless noted.

---

## Table of Contents

1. [Phase System](#1-phase-system)
2. [Default Timing Constants](#2-default-timing-constants)
3. [SSE Event Schema](#3-sse-event-schema)
4. [Phase Flow & Animation Timeline](#4-phase-flow--animation-timeline)
5. [Shared Component Animations](#5-shared-component-animations)
6. [Scenarios — Full Detail](#6-scenarios--full-detail)
   - [S1 · Simple Answer](#s1--simple-answer)
   - [S2 · Deep Reasoning](#s2--deep-reasoning)
   - [S3 · Web Research with Citations](#s3--web-research-with-citations)
   - [S4 · PDF Analysis](#s4--pdf-analysis)
   - [S5 · Image Analysis](#s5--image-analysis)
   - [S6 · Pins + Reasoning](#s6--pins--reasoning)
   - [S7 · Connector: Notion](#s7--connector-notion)
   - [S8 · Data: CSV + Code](#s8--data-csv--code)
   - [S9 · Mixed: Vision + Pins + Web](#s9--mixed-vision--pins--web)
   - [S10 · Output: Table (9 Variants)](#s10--output-table-9-variants)
   - [S11 · Output: Bar Chart (6 Variants)](#s11--output-bar-chart-6-variants)
   - [S12 · Output: Steps](#s12--output-steps)
   - [S13 · Mixed: Text + Table + Follow-ups](#s13--mixed-text--table--follow-ups)
   - [S14 · Mixed: Text + Callout + Tags](#s14--mixed-text--callout--tags)
   - [S15 · Mixed: Code + Text](#s15--mixed-code--text)
   - [S16 · Mixed: Text + Pie Chart + Follow-ups](#s16--mixed-text--pie-chart--follow-ups)
   - [S17 · Mixed: Line Chart + Text](#s17--mixed-line-chart--text)
   - [E1 · Connector Auth Failure](#e1--connector-auth-failure)
   - [E2 · Web Search Timeout](#e2--web-search-timeout)
7. [Structured Output Component Animations](#7-structured-output-component-animations)
   - [AnimatedTable](#animatedtable)
   - [AnimatedBarChart (6 variants)](#animatedbarchart-6-variants)
   - [AnimatedSteps](#animatedsteps)
   - [AnimatedCodeBlock](#animatedcodeblock)
   - [AnimatedCallout](#animatedcallout)
   - [AnimatedTags](#animatedtags)
   - [AnimatedPieChart](#animatedpiechart)
   - [AnimatedLineChart](#animatedlinechart)
   - [AnimatedCard](#animatedcard)
   - [AnimatedConnectorError](#animatedconnectorerror)
   - [AnimatedSearchTimeout](#animatedsearchtimeout)
8. [UI Micro-interactions](#8-ui-micro-interactions)
   - [UserBubble](#userbubble)
   - [ModelRow](#modelrow)
   - [Logo (SouvenirMark ↔ Model Icon)](#logo-souvenirmark--model-icon)
   - [CyclingLabel](#cyclinglabel)
   - [BreathingDot](#breathingdot)
   - [ReasoningStepRow](#reasoningsteprow)
   - [ActivityRow](#activityrow)
   - [ResearchBlock](#researchblock)
   - [StreamingText](#streamingtext)
   - [CitationChip](#citationchip)
   - [SourceList / SourceCard](#sourcelist--sourcecard)
   - [SelectionCTA](#selectioncta)
   - [ActionBar](#actionbar)
   - [FeedbackModal](#feedbackmodal)
   - [Follow-up Prompt Chips](#follow-up-prompt-chips)
   - [Chevron](#chevron)
9. [Multi-turn Behaviour](#9-multi-turn-behaviour)

---

## 1. Phase System

The UI is driven by a single `phase` state variable of type:

```ts
type Phase =
  | 'idle'          // Nothing rendered — blank canvas
  | 'user-sent'     // User bubble slides in, AI not yet visible
  | 'souvenir'      // Souvenir logo appears, shimmer label "Souvenir"
  | 'thinking'      // Cycling thinking words + shimmer (routing in progress)
  | 'choosing'      // "Choosing the best model…" + pulsing opacity
  | 'model-chosen'  // Model logo swings in + radial glow burst
  | 'researching'   // Research panel open, activities + reasoning playing
  | 'streaming'     // Response text / blocks streaming in
  | 'complete'      // Response done, ActionBar visible
```

### Phase entry conditions

| Phase | Entry condition |
|---|---|
| `idle` | Initial state, or after `reset()` |
| `user-sent` | `run()` called — 80ms after start |
| `souvenir` | 320ms after `user-sent` |
| `thinking` | 480ms after `souvenir` (skipped if `skipRouting: true`) |
| `choosing` | `thinkDuration` ms after `thinking` |
| `model-chosen` | `choosingDuration` ms after `choosing` |
| `researching` | 680ms after `model-chosen` (or after `souvenir` for skipRouting) |
| `streaming` | After research panel fully collapses (`collapseDelay` + 440ms) |
| `complete` | When `StreamingText` / `BlockSequenceRenderer` calls `onComplete` |

---

## 2. Default Timing Constants

These are the default values. All are controllable via the right-hand control panel in the UI.

| Constant | Default | Role |
|---|---|---|
| `wordDelay` | 28 ms | Delay between words in `StreamingText` |
| `firstTokenDelay` | 120 ms | Breathing-dot hold before first word appears |
| `thinkDuration` | 650 ms | How long the `thinking` phase lasts |
| `choosingDuration` | 1100 ms | How long the `choosing` phase lasts |
| `sourceStagger` | 380 ms | Delay between each new Activity row appearing |
| `resultStagger` | 75 ms | Delay between each result link revealing inside an activity |
| `collapseDelay` | 520 ms | Pause after last activity/reasoning step before research panel collapses |

### Key derived timings

- Reasoning step stagger = `sourceStagger * 2` (760ms default)
- Each result item "reading" highlight duration = 650ms (hardcoded)
- Research panel collapse animation after `collapseDelay`: spring height → 0, then 440ms buffer before `streaming`

---

## 3. SSE Event Schema

The following SSE events are required from the server. Each event has a `type` field and a `data` payload.

### 3.1 Phase Events

```
event: phase
data: {
  phase: "user-sent" | "souvenir" | "thinking" | "choosing"
       | "model-chosen" | "researching" | "streaming" | "complete"
}
```

### 3.2 Model Selection

```
event: model_selected
data: {
  id: string       // e.g. "Claude"
  llmId: string    // e.g. "Claude"  — used for LLM logo
  name: string     // e.g. "claude sonnet"
}
```

### 3.3 Research Title

```
event: research_title
data: {
  text: string     // e.g. "Planning…" | "Searching the web…" | "Synthesised 2026 AI startup GTM strategies"
}
```

Emitted multiple times during the `researching` phase:
1. `"Planning…"` — immediate at start of activity run
2. `ACTIVITY_VERB[nextActivity.type] + "…"` — after each activity starts
3. `"Synthesising…"` — after all activities complete
4. `researchTitle` (final) — scenario-specific string shown in collapsed research row

### 3.4 Reasoning Step

Emitted once per reasoning step, sequentially.

```
event: reasoning_step
data: {
  index: number    // 0-based
  verb: string     // e.g. "Considered", "Evaluated", "Mapped", "Identified", "Planned", "Strategized", "Synthesised"
  detail: string   // short description shown inline when collapsed
  summary: string  // full paragraph shown when step is expanded (supports **bold** and `code`)
}
```

### 3.5 Activity Events

```
event: activity_start
data: {
  index: number        // 0-based global index across all activities
  type: ActivityType   // see full list below
  detail?: string      // e.g. "AI startup GTM strategies 2026 traction growth"
  badge?: boolean      // whether to show the "Action" pill badge
}

event: activity_result
data: {
  activityIndex: number
  resultIndex: number     // 0-based within this activity's results
  title: string
  domain: string          // e.g. "techcrunch.com" or "pin" (for pinboard items)
}

event: activity_complete
data: {
  index: number
  resultCount?: number    // total results found — shown as "N results" or "N pins"
}
```

**`ActivityType` values:**
```
'web-search' | 'read-pdf' | 'scan-image' | 'scan-screenshot'
| 'read-pins' | 'run-code' | 'read-file' | 'read-csv'
| 'connector-notion' | 'connector-drive' | 'connector-slack' | 'connector-github'
| 'calculate' | 'generate-image' | 'process-audio' | 'synthesise'
```

**Activity verb display strings:**
```
'web-search'        → "Searching the web"
'read-pdf'          → "Reading PDF"
'scan-image'        → "Scanning image"
'scan-screenshot'   → "Analysing screenshot"
'read-pins'         → "Reading your pins"
'run-code'          → "Running command"
'read-file'         → "Reading file"
'read-csv'          → "Reading data"
'connector-notion'  → "Connecting to Notion"
'connector-drive'   → "Connecting to Drive"
'connector-slack'   → "Reading Slack"
'connector-github'  → "Reading repository"
'calculate'         → "Calculating"
'generate-image'    → "Generating image"
'process-audio'     → "Processing audio"
'synthesise'        → "Synthesising"
```

### 3.6 Action Group Collapse

Emitted when a group of activities finishes and should collapse into a single summary row.

```
event: group_complete
data: {
  groupIndex: number      // 0-based
  activityCount: number   // how many activities this group contains
  summary: string         // e.g. "Document loaded and structured. Reading design trend chapters…"
}
```

### 3.7 Text Token (Streaming Response)

```
event: token
data: {
  text: string    // a single word or short phrase
}
```

Text tokens are rendered through `renderTextBlock()` which handles markdown:
- `# H1`, `## H2`, `### H3`
- `- ` and `* ` unordered lists
- `1. ` ordered lists
- `> ` blockquotes
- `**bold**`
- `` `inline code` ``
- `{N}` citation references → `CitationChip`
- `[text](url)` hyperlinks

### 3.8 Block Events (Structured Output)

Each block in a `responseBlocks` sequence is emitted as a separate event.

```
event: block
data: ResponseBlock   // discriminated union — see full type below
```

**`ResponseBlock` union:**
```ts
type ResponseBlock =
  | { kind: 'text';             content: string; citations?: Citation[] }
  | { kind: 'table';            data: TableData }
  | { kind: 'bar-chart';        data: BarChartData }
  | { kind: 'steps';            data: StepsData }
  | { kind: 'code';             data: CodeData }
  | { kind: 'callout';          data: CalloutData }
  | { kind: 'tags';             data: TagsData }
  | { kind: 'follow-ups';       data: FollowUpsData }
  | { kind: 'pie-chart';        data: PieChartData }
  | { kind: 'line-chart';       data: LineChartData }
  | { kind: 'card';             data: CardData }
  | { kind: 'connector-error';  data: ConnectorErrorData }
  | { kind: 'search-timeout';   data: SearchTimeoutData }
```

Blocks are rendered sequentially — each block must call `onComplete` before the next block begins.

### 3.9 Citations

Emitted once, typically with the final text block or as a separate event.

```
event: citations
data: {
  citations: Array<{ title: string; domain: string }>
}
```

### 3.10 Follow-up Prompts

Sent alongside a `follow-ups` block. When the `follow-ups` block is encountered in the block sequence, the prompts are surfaced in the chat input area.

```
event: block
data: {
  kind: 'follow-ups',
  data: { prompts: string[] }   // 2-3 suggested follow-up questions
}
```

### 3.11 Stream Complete

```
event: complete
data: {}
```

---

## 4. Phase Flow & Animation Timeline

### Standard flow (all scenarios except S1)

```
t=0        run() called
t+80ms     phase → 'user-sent'
           UserBubble animates in: spring(stiffness:380, damping:28), y:10→0, scale:0.97→1, opacity:0→1

t+320ms    phase → 'souvenir'
           ModelRow appears: opacity:0→1, y:4→0
           SouvenirMark visible: spring in (scale:0.5→1, opacity:0→1, blur:6px→0)
           Label "Souvenir" fades in with shimmer gradient animation

t+800ms    phase → 'thinking'
           CyclingLabel starts: ["Thinking…","Analysing…","Processing…","Considering…"]
           each word: scale:0.75→1, opacity:0→1, blur:4px→0 (spring, stiffness:500, damping:30)
           every 2800ms
           Label text has shimmer: linear-gradient sweeping 2.4s ease-in-out infinite

t+800+thinkDuration    phase → 'choosing'
           Label → "Choosing the best model…"
           ModelRow: animate opacity [0.45, 1, 0.45] on 1.0s repeat (pulsing)

t+800+thinkDuration+choosingDuration    phase → 'model-chosen'
           SouvenirMark exits: scale→0.25, rotate→-20deg, y→-5, blur→10px (0.18s ease-in)
           LlmIcon enters: scale:0.15→1, rotate:14→0, blur:14px→0
                           spring(stiffness:220, damping:11, mass:0.9)
           3× radial glow rings fire:
             at 0ms, 100ms, 230ms delays
             each: scale:0.8→4.5, opacity:0.5→0
             duration:0.75s, ease:[0.16,1,0.3,1]
             border:1.5px solid rgba(104,61,27,0.35)

t+800+thinkDuration+choosingDuration+680ms    Research opens if applicable
           ResearchBlock height:0→auto, opacity:0→1
             height: spring(stiffness:260, damping:28)
             opacity: 0.22s easeInOut
           phase → 'researching'
           ResearchTitleVisible = true, title = "Planning…"

           [Reasoning steps play at sourceStagger*2 intervals]
           [Activities play at sourceStagger intervals]
           [Results play at resultStagger intervals]

t+after last activity+collapseDelay    ResearchBlock collapses: height→0, opacity→0
t+collapseDelay+440ms    phase → 'streaming'
           ResponseArea fades in: opacity:0→1
           BreathingDot appears for firstTokenDelay ms
           Then words stream in at wordDelay ms each

t+streaming done    phase → 'complete'
           ActionBar fades in: opacity:0→1, y:4→0
           SourceList slides in (if citations exist)
```

### Skip-routing flow (S1 only)

```
t=0        run() called
t+80ms     phase → 'user-sent'
t+320ms    phase → 'souvenir'  (SouvenirMark, no model icon)
t+800ms    phase → 'streaming' (no thinking, choosing, or research)
           BreathingDot for firstTokenDelay ms, then words stream
```

### activitiesFirst flow (S6 only)

Activities run *before* reasoning steps instead of after.

```
'researching' → runActivities() → runReasoning() → collapse → 'streaming'
```

Default order (all other scenarios with both):
```
'researching' → runReasoning() → runActivities() → collapse → 'streaming'
```

---

## 5. Shared Component Animations

### BreathingDot

A pulsing 7×7px circle shown as a cursor while waiting for first token or between block renders.

```
color:    #826B60
opacity:  0.15 → 1 → 0.15
duration: 1.6s, repeat: Infinity, ease: easeInOut
```

### CyclingLabel

Rotates through a word array every 2800ms. Used during `thinking` phase with words:
`["Thinking…", "Analysing…", "Processing…", "Considering…"]`

Each word transition:
```
enter:  scale:0.75, opacity:0, blur:4px → scale:1, opacity:1, blur:0
exit:   scale:0.75, opacity:0, blur:4px
mode:   AnimatePresence popLayout
spring: stiffness:500, damping:30
transformOrigin: left center
```

### Shimmer gradient (label during thinking/choosing/active reasoning)

Applied to label text and active reasoning verb:
```css
background-image: linear-gradient(90deg, #B6ACA4 0%, #3B3632 45%, #3B3632 55%, #B6ACA4 100%);
background-size: 200% 100%;
-webkit-background-clip: text;
animation: svLabelShimmer 2.4s ease-in-out infinite;
/* keyframes: 0% { background-position: 200% center } → 100% { -200% center } */
```

---

## 6. Scenarios — Full Detail

---

### S1 · Simple Answer

**Description:** Direct factual question — no tools, no routing.

**User query:** `"What is product-market fit?"`

**`skipRouting: true`** — bypasses thinking/choosing/research.

#### SSE Events Required

| # | Event | Data |
|---|---|---|
| 1 | `phase` | `{ phase: "user-sent" }` |
| 2 | `phase` | `{ phase: "souvenir" }` |
| 3 | `phase` | `{ phase: "streaming" }` |
| 4–N | `token` | words of response text, 28ms apart |
| N+1 | `complete` | `{}` |

#### Response

3 paragraphs of plain text. No markdown headers. No citations. No reasoning.

#### Animation Timeline

```
t+80ms    UserBubble spring-in
t+320ms   SouvenirMark spring-in (no model icon — skipRouting)
           Label "Souvenir" — no shimmer (not in thinking/choosing phase)
t+800ms   phase → streaming
           BreathingDot holds for 120ms
           Words stream at 28ms/word
           ~3 paragraphs ≈ ~100 words ≈ ~2.8s to complete
t+complete ActionBar fades in
```

#### Micro-interactions
- **No** research panel, no ResearchBlock
- **No** model icon — SouvenirMark persists through entire response
- ActionBar appears on `complete` when response area is hovered

---

### S2 · Deep Reasoning

**Description:** Complex strategy question — Adaptive Thinking only, no web/tools.

**User query:** `"Should Souvenir prioritise B2C or B2B first?"`

**`hasActivities: false`** — research panel only contains reasoning steps.

#### Reasoning Steps

| # | Verb | Detail |
|---|---|---|
| 1 | Considered | the product stage and what "prioritise" actually means here |
| 2 | Evaluated | B2C and B2B revenue models for memory-layer AI tools |
| 3 | Mapped | Souvenir's current traction signals against both paths |
| 4 | Identified | the sequencing that preserves optionality |

Each step has a full `summary` paragraph (shown on expansion, supports `**bold**`).

#### SSE Events Required

| # | Event | Data |
|---|---|---|
| 1 | `phase` | `{ phase: "user-sent" }` |
| 2 | `phase` | `{ phase: "souvenir" }` |
| 3 | `phase` | `{ phase: "thinking" }` |
| 4 | `phase` | `{ phase: "choosing" }` |
| 5 | `model_selected` | `{ id, llmId, name }` |
| 6 | `phase` | `{ phase: "model-chosen" }` |
| 7 | `phase` | `{ phase: "researching" }` |
| 8 | `research_title` | `{ text: "Reasoned through B2C vs B2B prioritisation for Souvenir" }` |
| 9 | `reasoning_step` | step 0 (Considered…) |
| 10 | `reasoning_step` | step 1 (Evaluated…) |
| 11 | `reasoning_step` | step 2 (Mapped…) |
| 12 | `reasoning_step` | step 3 (Identified…) |
| 13 | `phase` | `{ phase: "streaming" }` |
| 14–N | `token` | words of response text |
| N+1 | `complete` | `{}` |

#### Animation Timeline (Reasoning)

```
t=researching start
t+760ms   reasoning step 0 appears (sourceStagger*2 = 760ms)
           motion.div: height:0→auto, opacity:0→1
             height: spring(stiffness:300, damping:28)
             opacity: 0.24s delay:0.08 easeOut
           ReasoningStepRow icon + shimmer verb (isActive=true)
           Vertical connector line: scaleY:0→1, 0.28s easeOut, delay:0.1

t+1520ms  reasoning step 1 appears (another 760ms)
           Step 0 becomes inactive: shimmer off, detail text appears, chevron appears

t+2280ms  reasoning step 2
t+3040ms  reasoning step 3 (last)
           After all 4 steps complete → "Thinking ›" button fades in (opacity:0→1, delay:0.2)

t+3040+collapseDelay   ResearchBlock collapses
t+3040+collapseDelay+440ms   phase → streaming
```

#### ResearchTitle behaviour (reasoning-only scenarios)

After reasoning completes and there are no activities, `researchTitleVisible = true` and `liveResearchTitle = sc.researchTitle` is set immediately. The research title appears in the ModelRow:

```
initial:  opacity:0, x:10, blur:8px
animate:  opacity:1, x:0, blur:0
duration: 0.48s, ease:[0.16,1,0.3,1]
```

Then word-by-word reveal via `WordReveal` at 80ms/word.

#### "Thinking ›" expandable summary

- Shows after all reasoning steps are revealed
- Button: "Thinking" label + animated chevron (spring rotates 90° when open)
- Expanded: paragraph slides in — height:0→auto, opacity:0→1, 0.24s ease:[0.16,1,0.3,1]
- Content supports `**bold**` and `inline code` via `renderInlineMd`

---

### S3 · Web Research with Citations

**Description:** Research question — web search + pins + inline citations.

**User query:** `"What are the latest AI startup GTM strategies in 2026?"`

#### Reasoning Steps (2)

| # | Verb | Detail |
|---|---|---|
| 1 | Planned | what to search for and in what order |
| 2 | Strategized | how to connect web findings to Souvenir's specific situation |

#### Activities (3)

| # | Type | Detail | Results |
|---|---|---|---|
| 1 | `web-search` | "AI startup GTM strategies 2026 traction growth" | 3 links (excellofficial.com, entrepreneurship.edu.au, dannyrae.com) |
| 2 | `web-search` | "founder-led content distribution AI startup 2026" | 3 links (techcrunch.com, thestartupfounders.co, ainything.ai) |
| 3 | `read-pins` | "startup growth, marketing, distribution" | 3 pins |

Activities 1 and 2 have `badge: true` → show "ACTION" pill.

#### SSE Events Required

| # | Event | Data |
|---|---|---|
| 1 | `phase` | `user-sent` |
| 2 | `phase` | `souvenir` |
| 3 | `phase` | `thinking` |
| 4 | `phase` | `choosing` |
| 5 | `model_selected` | chosen model |
| 6 | `phase` | `model-chosen` |
| 7 | `phase` | `researching` |
| 8 | `research_title` | `"Planning…"` |
| 9 | `reasoning_step` | Planned… |
| 10 | `reasoning_step` | Strategized… |
| 11 | `research_title` | `"Searching the web…"` |
| 12 | `activity_start` | index:0, type:`web-search`, badge:true |
| 13–15 | `activity_result` | activityIndex:0, resultIndex:0–2 |
| 16 | `activity_complete` | index:0, resultCount:10 |
| 17 | `research_title` | `"Searching the web…"` |
| 18 | `activity_start` | index:1, type:`web-search`, badge:true |
| 19–21 | `activity_result` | activityIndex:1, resultIndex:0–2 |
| 22 | `activity_complete` | index:1, resultCount:7 |
| 23 | `research_title` | `"Reading your pins…"` |
| 24 | `activity_start` | index:2, type:`read-pins` |
| 25–27 | `activity_result` | activityIndex:2, resultIndex:0–2 |
| 28 | `activity_complete` | index:2, resultCount:3 |
| 29 | `research_title` | `"Synthesising…"` |
| 30 | `research_title` | `"Synthesised 2026 AI startup GTM strategies"` |
| 31 | `phase` | `streaming` |
| 32–N | `token` | words of response |
| N+1 | `citations` | 4 citations array |
| N+2 | `complete` | `{}` |

#### Citation Rendering

Response text contains `{1}`, `{2}`, `{3}`, `{4}` placeholders → rendered as `CitationChip` components.

After response completes, `SourceList` slides in below response:
- "Sources" label: 11px uppercase, #B6ACA4
- Horizontal scroll row of `SourceCard` components
- Each card animates: `opacity:0, x:-8 → opacity:1, x:0`, delay: `0.18 + index * 0.07`s, spring

#### No Action Groups (flat activity list)

---

### S4 · PDF Analysis

**Description:** PDF attached — multi-group document reading.

**Attachment:** `213-Design-Trend-Report-2026.pdf` (type: `pdf`)

**User query:** `"I want to understand the insight of this PDF and how can I use it for Souvenir"`

#### Attachment rendering (FileChip)

```
background: rgba(59,54,50,0.07)
border: 1px solid rgba(59,54,50,0.1)
borderRadius: 8px
icon: PdfIcon (12px, #6A625D)
label: filename truncated, 11px, #524B47
type badge: "PDF", 10px, #B6ACA4
```

#### Reasoning Steps (1)

| # | Verb | Detail |
|---|---|---|
| 1 | Planned | how to extract and apply a trend report to Souvenir |

#### Activities (9) — Split into 2 Action Groups

**Group 1 (4 activities):**
| # | Type | Detail | Badge |
|---|---|---|---|
| 1 | `read-file` | opening PDF, checking page count | — |
| 2 | `run-code` | Extracting full text — measuring document length | ✓ |
| 3 | `read-pdf` | Table of contents — mapping all section titles | — |
| 4 | `read-pdf` | Introduction — understanding the report's framing | — |

Group 1 summary: `"Document loaded and structured. Reading design trend chapters…"`

**Group 2 (5 activities):**
| # | Type | Detail | Badge |
|---|---|---|---|
| 5 | `read-pdf` | Photography and Visual Language chapter | — |
| 6 | `read-pdf` | Future Medieval — Neo-Ornamental Design chapter | — |
| 7 | `read-pdf` | Cyber Goth and Tactile Aesthetics chapter | — |
| 8 | `read-pdf` | Scrapbook and Scanner aesthetic chapter | — |
| 9 | `read-pdf` | Direct Flash Photography chapter | — |

Group 2 summary: `"All chapters read. Mapping findings to Souvenir…"`

#### SSE Events Required

| # | Event | Data |
|---|---|---|
| 1–6 | Standard phase events | user-sent → model-chosen |
| 7 | `phase` | `researching` |
| 8 | `research_title` | `"Planning…"` |
| 9 | `reasoning_step` | Planned… |
| 10 | `research_title` | `"Reading file…"` |
| 11 | `activity_start` | index:0, `read-file` |
| 12 | `activity_complete` | index:0 |
| 13 | `activity_start` | index:1, `run-code`, badge:true |
| 14 | `activity_complete` | index:1 |
| 15 | `activity_start` | index:2, `read-pdf` |
| 16 | `activity_complete` | index:2 |
| 17 | `activity_start` | index:3, `read-pdf` |
| 18 | `activity_complete` | index:3 |
| 19 | `group_complete` | groupIndex:0, activityCount:4, summary:"Document loaded and structured. Reading design trend chapters…" |
| 20–29 | activity_start/complete for activities 4–8 | |
| 30 | `group_complete` | groupIndex:1, activityCount:5, summary:"All chapters read. Mapping findings to Souvenir…" |
| 31 | `research_title` | `"Synthesising…"` |
| 32 | `research_title` | `"Analysed 213 Design Trend Report and mapped to Souvenir"` |
| 33 | `phase` | `streaming` |
| 34–N | `token` | response words |
| N+1 | `complete` | `{}` |

#### Action Group Animation

**Expanding group (in-progress):**
Activities inside a group appear one by one as individual `ActivityRow` components.

**Group collapsing (on `group_complete`):**
```
In-progress ActivityRows → replaced by single summary row
Summary row: "Ran N actions — {summary}"
             ✓ green checkmark | count bold | summary muted
Chevron: can expand to reveal sub-items
```

**Expanded collapsed group:**
```
motion.div height:0→auto, opacity:0→1, 0.22s ease:[0.16,1,0.3,1]
Each sub-item: ✓ small green checkmark + ActivityIcon + verb + detail
```

---

### S5 · Image Analysis

**Description:** Image attached — deep vision analysis with reasoning.

**Attachment:** `souvenir-moodboard-v2.png` (type: `image`)

**User query:** `"Analyse this moodboard and tell me if it matches Souvenir's brand direction"`

#### Attachment rendering (FileChip — image type)

```
icon: AiImageIcon (12px, #6A625D)
type badge: "Image"
```

#### Reasoning Steps (2)

| # | Verb | Detail |
|---|---|---|
| 1 | Considered | what brand alignment actually means for a moodboard |
| 2 | Planned | a structured framework: palette → composition → typography → synthesis |

#### Activities (5 — no groups)

| # | Type | Detail |
|---|---|---|
| 1 | `scan-image` | loading image, mapping dimensions |
| 2 | `scan-image` | analysing colour palette |
| 3 | `scan-image` | evaluating compositional structure |
| 4 | `scan-image` | assessing typographic choices |
| 5 | `synthesise` | cross-referencing all dimensions against Souvenir brand values |

No action groups — activities shown flat.

#### SSE Events Required

Same pattern as S3 but with 2 reasoning steps and 5 activities (no groups).

---

### S6 · Pins + Reasoning

**Description:** Memory search + Adaptive Thinking — pattern-finding in saves.

**Attachment:** `Distribution strategy — saved articles` (type: `pin`)

#### Pin attachment rendering (FileChip — pin type)

```
background: rgba(104,61,27,0.08)
border: 1px solid rgba(104,61,27,0.18)
icon: Bookmark01Icon (12px, #683D1B)
label: name, 11px, #683D1B, fontWeight:500
type badge: "Pin", 10px, #B6ACA4
```

**`activitiesFirst: true`** — activities run BEFORE reasoning steps.

#### Activities (3) — no groups

| # | Type | Detail | Results |
|---|---|---|---|
| 1 | `read-pins` | scanning your pinboard | 4 results |
| 2 | `read-pins` | filtering pins related to distribution | 3 results |
| 3 | `synthesise` | connecting the dots across all distribution saves | — |

Activity 1 has `resultCount: 12` (total, only 4 shown as previews).
Activity 2 has `resultCount: 8`.

#### Reasoning Steps (2)

| # | Verb | Detail |
|---|---|---|
| 1 | Considered | what the saves reveal about Chai's underlying belief system |
| 2 | Synthesised | the conceptual thread connecting all 12 saves |

#### SSE Events Required

```
phase: user-sent → souvenir → thinking → choosing → model-chosen → researching

research_title: "Planning…"
[No reasoning first because activitiesFirst=true]

research_title: "Reading your pins…"
activity_start: index:0, type:read-pins
activity_result: ×4 (pinboard results)
activity_complete: index:0, resultCount:12

research_title: "Reading your pins…"
activity_start: index:1, type:read-pins
activity_result: ×3
activity_complete: index:1, resultCount:8

research_title: "Synthesising…"
activity_start: index:2, type:synthesise
activity_complete: index:2

research_title: "Synthesising…" (after activities)
[Now reasoning runs]
reasoning_step: Considered…
reasoning_step: Synthesised…

research_title: "Found pattern across 12 distribution saves"
phase: streaming
tokens…
complete
```

---

### S7 · Connector: Notion

**Description:** Pulls live data from a connected Notion workspace.

**User query:** `"Pull my sprint 2 notes from Notion and summarise what's still left to do"`

**No reasoning steps.**

#### Activities (5) — 2 Action Groups

**Group 1 (2 activities):**
| # | Type | Detail | Badge |
|---|---|---|---|
| 1 | `connector-notion` | Connecting to Notion — verifying workspace access | ✓ |
| 2 | `read-file` | Listing pages in your Design workspace (6 results) | ✓ |

Group 1 summary: `"Connected. Found 6 pages in Design workspace."`

Activity 2 results: Sprint 2 PRD, Design checklist, Sprint 2 report, Kaya DS component tracker.

**Group 2 (3 activities):**
| # | Type | Detail |
|---|---|---|
| 3 | `read-file` | Sprint 2 PRD — reading goals, scope, key dates |
| 4 | `read-file` | DS V1 component checklist — extracting status per component |
| 5 | `read-file` | Sprint 2 report — checking what's already been logged |

Group 2 summary: `"Read all sprint 2 documents. Identifying remaining work…"`

#### SSE Events Required

```
phase: user-sent → souvenir → thinking → choosing → model-chosen → researching
research_title: "Planning…"
[No reasoning steps]
research_title: "Connecting to Notion…"
activity_start: index:0, type:connector-notion, badge:true
activity_complete: index:0
research_title: "Reading file…"
activity_start: index:1, type:read-file, badge:true
activity_result: ×4 (Notion page results)
activity_complete: index:1, resultCount:6
group_complete: groupIndex:0, activityCount:2, summary:"Connected. Found 6 pages in Design workspace."
activity_start: index:2, type:read-file
activity_complete: index:2
activity_start: index:3, type:read-file
activity_complete: index:3
activity_start: index:4, type:read-file
activity_complete: index:4
group_complete: groupIndex:1, activityCount:3, summary:"Read all sprint 2 documents. Identifying remaining work…"
research_title: "Synthesising…"
research_title: "Pulled and summarised Sprint 2 Notion workspace"
phase: streaming
tokens... (rich markdown: ## H2, ### H3, - lists, > blockquote, **bold**, `code`)
complete
```

---

### S8 · Data: CSV + Code

**Description:** CSV attached — code execution, data analysis.

**Attachment:** `onboarding-funnel-export.csv` (type: `csv`)

**User query:** `"Here's my onboarding analytics export. Where are users dropping off?"`

#### Reasoning Steps (1)

| # | Verb | Detail |
|---|---|---|
| 1 | Planned | how to analyse a funnel CSV to find meaningful drop-off patterns |

#### Activities (6) — 2 Action Groups

**Group 1 (2 activities):**
| # | Type | Detail | Badge |
|---|---|---|---|
| 1 | `read-file` | opening CSV, checking size | ✓ |
| 2 | `read-csv` | Reading structure — identifying columns and event types | ✓ |

Group 1 summary: `"File loaded and structured. Running analysis…"`

**Group 2 (4 activities):**
| # | Type | Detail | Badge |
|---|---|---|---|
| 3 | `run-code` | Parsing 2,847 rows — extracting onboarding step columns | ✓ |
| 4 | `run-code` | Calculating step-by-step conversion rates | ✓ |
| 5 | `run-code` | Identifying sharpest relative drop-off between steps | ✓ |
| 6 | `calculate` | Computing statistical significance of drop-off deltas | ✓ |

Group 2 summary: `"Analysis complete. Preparing drop-off report…"`

All 6 activities have `badge: true`.

---

### S9 · Mixed: Vision + Pins + Web

**Description:** Image + pins + web search — cross-modal analysis.

**Attachment:** `onboarding-screen-v3.png` (type: `image`)

**`activitiesFirst: false`** (default) — reasoning first, then activities.

#### Reasoning Steps (2)

| # | Verb | Detail |
|---|---|---|
| 1 | Considered | what cross-modal analysis means here — three very different sources |
| 2 | Strategized | how to weight the three sources for a useful answer |

#### Activities (4 — no groups)

| # | Type | Detail | Results |
|---|---|---|---|
| 1 | `scan-screenshot` | analysing current layout and flow | — |
| 2 | `read-pins` | scanning pins for onboarding, UX | 3 results |
| 3 | `web-search` | onboarding patterns 2026 progressive disclosure | 3 results + badge |
| 4 | `synthesise` | mapping current screen gaps against pin taste and web patterns | — |

---

### S10 · Output: Table (9 Variants)

**Description:** Structured table output — model comparison with staggered row reveal.

**User query:** `"Compare Claude Sonnet 4.5, GPT-4o, and Gemini 2.0 Flash across key capabilities"`

#### Reasoning Steps (2)

| # | Verb | Detail |
|---|---|---|
| 1 | Considered | what makes a fair, useful comparison framework |
| 2 | Planned | which six dimensions to include and how to source current data |

#### Activities (2 web searches — no groups)

Both have `badge: true`.

#### Response: Table (not text)

Uses `StructuredResponseWrapper` + `AnimatedTable`. The variant is controlled by the `s10Variant` control panel selection. 9 table variants available:

| Variant Key | Label | Key Characteristics |
|---|---|---|
| `basic` | Basic | Sortable, accent rows, caption |
| `striped` | Striped | Alternating row backgrounds |
| `compact` | Compact | Tight row height (9px skeleton), 52ms row delay |
| `badges` | Badges | Auto-badge from `badgeMap` |
| `financial` | Financial | Right-aligned numbers, bold totals row, `totalsRow:true` |
| `hoverable` | Hoverable | Row highlight on hover, no vertical dividers |
| `minimal` | Minimal | No vertical borders, thin horizontal only |
| `feature-comparison` | Feature matrix | Check cells (✓/—), centered non-first cols, 2fr first col |
| `mixed-content` | Rich cells | `type:'rich'` cells with text + sub + badge |

#### SSE Events

Same as S3 pattern for phases + reasoning + activities.

```
phase: streaming
block: { kind: 'table', data: TableData }   ← single block, no text
complete
```

For `StructuredResponseWrapper`: shows `BreathingDot` for `firstTokenDelay` ms, then mounts `AnimatedTable`.

---

### S11 · Output: Bar Chart (6 Variants)

**Description:** Structured bar chart — analytics with spring-growth bars.

**User query:** `"Pull my analytics and show me average response times per model this week"`

#### Activities (4) — 2 Action Groups

**Group 1 (2 activities):**
| # | Type | Detail | Badge |
|---|---|---|---|
| 1 | `connector-notion` | Connecting to analytics workspace | ✓ |
| 2 | `read-csv` | session-analytics-apr17-apr24.csv — 847 sessions | ✓ |

Group 1 summary: `"Analytics connected and loaded. Running calculations…"`

**Group 2 (2 activities):**
| # | Type | Detail | Badge |
|---|---|---|---|
| 3 | `run-code` | Filtering last 7 days, excluding idle sessions >60s | ✓ |
| 4 | `run-code` | Calculating median response time per model | ✓ |

Group 2 summary: `"Calculations complete. Rendering chart…"`

#### 6 Bar Chart Variants

| Variant Key | Description | Key Animation |
|---|---|---|
| `vertical` | Classic vertical bars | `scaleY: 0→1` spring from bottom, `stiffness:140, damping:18` |
| `horizontal` | Left-to-right bars | `scaleX: 0→1` spring from left, `stiffness:120, damping:20` |
| `grouped` | Multi-dataset side-by-side | bars per group × dataset, staggered by `globalIdx * 0.06` |
| `stacked` | Absolute stacked height | each segment `height:0→segH`, stagger by `gi*0.12 + di*0.05` |
| `stacked-100` | Normalized 100% columns | each segment `flex:0→pct`, stagger by `gi*0.1 + di*0.04` |
| `positive-negative` | Diverging bars | up/down from zero line, spring, stagger `i*0.1` |

---

### S12 · Output: Steps

**Description:** Structured steps — setup guide with progressive reveal.

**User query:** `"Walk me through setting up the Notion connector in Souvenir step by step"`

#### Reasoning Steps (1)

| # | Verb | Detail |
|---|---|---|
| 1 | Considered | the right level of detail for a connector setup guide |

#### Activities (2 — no groups)

| # | Type | Detail | Badge |
|---|---|---|---|
| 1 | `connector-notion` | Checking current workspace state | ✓ |
| 2 | `read-file` | Notion connector docs — OAuth flow and permission requirements | — |

#### Response: 5-Step Guide

Steps reveal at 220ms intervals. Number dot spring-pops in, connector line scaleY from top.

---

### S13 · Mixed: Text + Table + Follow-ups

**Description:** Mixed output — intro text → comparison table → follow-up prompts.

**User query:** `"Which AI model should we use for each feature in Souvenir?"`

#### Reasoning Steps (1), Activities (1 web search)

#### Response Blocks (3)

```
Block 0: kind:'text'
  "## Model selection by feature\n\nThe right model depends…"
  → streams word by word

Block 1: kind:'table'
  headers: ['Feature', 'Recommended', 'Why', 'Fallback']
  rows: 5 feature rows
  sortable: true
  → AnimatedTable (basic variant)

Block 2: kind:'follow-ups'
  prompts: [
    "How much would Gemini Flash indexing cost at 10,000 pins/month?",
    "Can we use one unified model and avoid routing complexity?",
    "What's the latency difference between Sonnet and GPT-4o for chat?"
  ]
  → triggers follow-up chips in chat input area
```

#### Follow-up Chip Animation (when complete)

Chat input transforms from text input to follow-up mode:

```
AnimatePresence mode="wait"
Enter: opacity:0, y:6 → opacity:1, y:0, 0.26s ease:[0.16,1,0.3,1]
Label: "What would you like to explore?" (11px uppercase, var(--neutral-300))
Each chip:
  motion.button initial:{opacity:0, x:-10} animate:{opacity:1, x:0}
  delay: index * 0.08s, duration:0.22s ease:[0.16,1,0.3,1]
Hover: borderColor → var(--neutral-300), background → white (120ms)
Arrow ↗ in right corner
"Or ask something else…" row with ↑ send button below
```

---

### S14 · Mixed: Text + Callout + Tags

**Description:** Risk analysis — text overview, warning callout, risk category tags.

**User query:** `"What are the biggest risks to our June 1 launch timeline?"`

#### Reasoning Steps (1), Activities (1 read-pins)

#### Response Blocks (4)

```
Block 0: kind:'text'
  "## Three risk categories\n\nOne is critical…"

Block 1: kind:'card'
  badge: "🔴 Critical", title: "DS handoff must ship by May 11",
  subtitle: "Blocks everything downstream", body: "…**If this slips…**"

Block 2: kind:'card'
  badge: "🟡 Watch", title: "Revamp scope creep", subtitle: "Manageable with clear cut-line"

Block 3: kind:'callout'
  variant:'warning'
  title: "May 11 is the single point of failure"
  body: "Every component not specced by Apr 30…**Sprint 2 report (Apr 28)**…"

Block 4: kind:'tags'
  title: "Risk categories"
  tags: [
    { label:'DS handoff timing', color:'#C8920A' },
    { label:'Revamp scope creep' },
    { label:'Branding delay (non-blocking)', color:'#0D6EB2' },
    { label:'First user batch', color:'#80B707' },
    { label:'Sprint 2 report due Apr 28' },
  ]
```

---

### S15 · Mixed: Code + Text

**Description:** API walkthrough — code block with line-by-line reveal.

**User query:** `"Show me how to use the Souvenir API to save a pin programmatically"`

**No reasoning steps.**

#### Activities (2)

| # | Type | Detail | Badge |
|---|---|---|---|
| 1 | `read-file` | souvenir-api-docs.md | ✓ |
| 2 | `read-file` | sdk/pins.ts — reading pins.create interface signature | — |

#### Response Blocks (2)

```
Block 0: kind:'code'
  language: 'typescript'
  caption: 'Full Souvenir SDK integration — pins, search, and error handling'
  code: ~40 lines of TypeScript (client setup, savePin, searchPins, safeSave)

Block 1: kind:'text'
  3 paragraphs explaining auth, content field, and source field
```

---

### S16 · Mixed: Text + Pie Chart + Follow-ups

**Description:** Sprint time breakdown.

**User query:** `"Break down how I'm spending time across different areas this sprint"`

#### Reasoning Steps (1), Activities (2 with group)

**Group (2 activities):**
| # | Type | Detail | Badge |
|---|---|---|---|
| 1 | `connector-notion` | Pulling Sprint 2 time entries | ✓ |
| 2 | `run-code` | Parsing 47 task entries | ✓ |

Group summary: `"Time data pulled and categorised. Building breakdown…"`

#### Response Blocks (3)

```
Block 0: kind:'text'
  "You've logged 38 hours…coordination overhead at 18% is worth watching."

Block 1: kind:'pie-chart'
  title: "Sprint 2 time breakdown — Apr 14–24"
  unit: "hrs"
  centerLabel: "38h"
  segments: [
    { label:'Design (DS + Figma)', value:42 },           // default color (brown)
    { label:'Coordination + comms', value:18, color:'#9C938B' },
    { label:'Research + reading', value:16, color:'#0D6EB2' },
    { label:'Claude course', value:14, color:'#80B707' },
    { label:'Other', value:10, color:'#C0B5AD' },
  ]

Block 2: kind:'follow-ups'
  prompts: 3 questions about coordination, Sprint 1 comparison, handoff timeline
```

---

### S17 · Mixed: Line Chart + Text

**Description:** 30-day pin save trend.

**User query:** `"Show me how my daily pin saves have trended over the last 30 days"`

**No reasoning steps.**

#### Activities (2 with group)

| # | Type | Detail | Badge |
|---|---|---|---|
| 1 | `connector-notion` | Connecting to Souvenir analytics | ✓ |
| 2 | `run-code` | Aggregating daily pin counts — Mar 25 to Apr 24 | ✓ |

Group summary: `"Analytics pulled. Rendering 30-day trend…"`

#### Response Blocks (2)

```
Block 0: kind:'line-chart'
  title: "Daily pins saved — Mar 25 to Apr 24"
  30 data points (Mar 25 = 3 → Apr 24 = 22, trending upward)
  Single line, color: #683D1B (brown)

Block 1: kind:'text'
  "Your pin save rate has been **accelerating**..."
  2 paragraphs of insight
```

---

### E1 · Connector Auth Failure

**Description:** Gmail auth expired mid-response — inline error with reconnect CTA.

**User query:** `"What emails did I get from investors this week?"`

**No reasoning steps.**

#### Activities (1 — no results, no badge)

| # | Type | Detail | Results |
|---|---|---|---|
| 1 | `web-search` | "investor emails this week" | 0 results |

#### Response Blocks (3) — Error State Pattern

```
Block 0: kind:'text'
  "I found a few threads that look relevant…"
  Lists 3 senders found in pins

Block 1: kind:'connector-error'
  connector: 'Gmail'
  icon: '✉️'
  message: 'Your Gmail connection has expired.'
  cta: 'Reconnect Gmail'
  → AnimatedConnectorError with red stripe

Block 2: kind:'text'
  "To get the full thread content and any new emails not yet pinned, reconnect Gmail above."
```

**Error card renders WITHOUT ActionBar** (`hasErrorBlock` is true → `showActionBar` suppressed).

---

### E2 · Web Search Timeout

**Description:** Web search timed out mid-response — inline error with retry CTA.

**User query:** `"What's the latest on Anthropic's valuation and funding round?"`

**No reasoning steps.**

#### Activities (1 — badge, 0 results)

| # | Type | Detail | Badge |
|---|---|---|---|
| 1 | `web-search` | "Anthropic valuation funding round 2026" | ✓ (0 results) |

#### Response Blocks (3)

```
Block 0: kind:'text'
  "Based on what I know up to my training cutoff, Anthropic raised at a **$18.4B valuation**…"

Block 1: kind:'search-timeout'
  query: 'Anthropic valuation funding round 2026'
  message: ''   ← no body message
  cta: 'Retry search'
  → AnimatedSearchTimeout with amber stripe + query pill

Block 2: kind:'text'
  "You have a pin from Mar 2026 titled **"Anthropic funding tracker"**…"
```

**Retry CTA** calls `onRetry` → `reset(); run()` — re-runs the full scenario from scratch.

---

## 7. Structured Output Component Animations

---

### AnimatedTable

**Entry pattern:** BreathingDot (via `StructuredResponseWrapper`) → skeleton rows → real rows fill.

**Phase 1 — Skeleton (500ms hold)**

```
For each row:
  motion.div initial:{opacity:0} animate:{opacity:1}
  delay: rowIndex * 0.045s, duration:0.18s
  Each cell: pulsing shimmer bar
    opacity: [0.35, 0.85, 0.35], 1.4s repeat easeInOut
    delay: (ri + ci) * 0.06s
    height: 12px (basic/badges/financial/hoverable/minimal/feature-comparison)
             9px  (compact)
            28px  (mixed-content first col — double-line skeleton)
    width: varies by algorithm (40–78% for most, narrow for feature-comparison)
```

**Phase 2 — Skeleton exit + real rows reveal**

```
After 500ms:
  Skeleton div: exit opacity:0→ (duration:0.2s)
  Real rows reveal at: 72ms intervals (52ms for compact)
  Each row:
    initial: {opacity:0, x:-6}
    animate: {opacity:1, x:0}
    duration: 0.18s, ease:easeOut
```

**After all rows revealed:**
- Caption fades in: `opacity:0→1, duration:0.3s`
- Action row fades in: `opacity:0→1, y:4→0, duration:0.22s`
  - "N rows · N col" count label
  - "Copy markdown" button (icon swaps Copy01Icon → Checkmark when copied, 1500ms reset)
  - "↓ Export CSV" button (triggers download)

**Sortable columns:** Click header → toggle asc/desc. Active column shows ↑/↓ indicator, inactive shows ↕.

**Accent rows:** Brown left bar (3px, `var(--brown-700)`) + warm row background `rgba(104,61,27,0.04)`.

**Hoverable variant:** Row background transitions to `rgba(104,61,27,0.04)` on hover (100ms).

**Totals row:** `border-top: 2px solid var(--neutral-800-15)`, all cells bold.

---

### AnimatedBarChart (6 variants)

**Entry:** `StructuredResponseWrapper` → `BreathingDot` → 140ms → `setRevealed(true)` → bars animate.

#### Vertical

```
Grid lines: opacity:0→1, 0.4s delay:0.1 (4 lines at 25%, 50%, 75%, 100%)
Each bar:
  Value label: opacity:0→1, delay:(i*0.1+0.55)s, duration:0.2s
  Bar fill: scaleY:0→1 from bottom
    spring(stiffness:140, damping:18, mass:1)
    delay: i * 0.1s
onComplete fires: last-bar-delay + 980ms after reveal
```

#### Horizontal

```
Each bar: scaleX:0→1 from left
  spring(stiffness:120, damping:20)
  delay: i * 0.08s
Value label: opacity:0→1 delay:(i*0.08+0.5)s
```

#### Grouped

```
Stagger formula: globalIdx = groupIndex * numDatasets + datasetIndex
Each bar: scaleY:0→1 spring, delay: globalIdx * 0.06s
Legend: dataset color swatches + labels below
```

#### Stacked (absolute)

```
Each column stacks datasets bottom-up (column-reverse)
Each segment: height:0→segH, 0.55s ease:[0.16,1,0.3,1]
delay: groupIndex * 0.12 + datasetIndex * 0.05
```

#### Stacked 100%

```
Each segment: flex:0→pct, 0.7s ease:[0.16,1,0.3,1]
delay: groupIndex * 0.1 + datasetIndex * 0.04
Percentage label inside segment when pct > 8%
```

#### Positive/Negative (Diverging)

```
Zero line: position:absolute at center height (solid, z-index:1)
Guide lines at ±50%: opacity:0→1 on reveal

Positive bars: grow upward from zero (alignItems:flex-end in top half)
Negative bars: grow downward from zero (alignItems:flex-start in bottom half)
Each: height:0→barH spring(stiffness:140, damping:18), delay: i*0.1

Value label: pinned to zero line, white pill background
  opacity:0→1 delay:(i*0.1+0.55)s
  Format: "+34" or "-12"
```

---

### AnimatedSteps

**Entry animation:**
```
Wrapper: opacity:0→1, y:8→0, 0.28s ease:[0.16,1,0.3,1]
Title: shows immediately if present
```

**Step reveal:** 220ms per step interval

Each step:
```
Row: opacity:0, x:-8 → opacity:1, x:0, 0.22s ease:[0.16,1,0.3,1]

Number dot:
  scale:0→1 spring(stiffness:400, damping:25), delay:0.04s
  24×24px circle, background:#683D1B, white number

Connector line (between steps):
  scaleY:0→1, 0.22s delay:0.12s easeOut
  transformOrigin: top
  1px wide, background:#EDE1D7

Label: 14px, fontWeight:500, #26211E
Description: 13px, #827A74
```

`onComplete` fires 320ms after last step reveals.

---

### AnimatedCodeBlock

**Entry:** `opacity:0, y:8 → opacity:1, y:0, 0.28s ease:[0.16,1,0.3,1]`

**Line reveal interval:** `min(55, round(1400 / totalLines))` ms — caps at 55ms, scales down for short files.

**Each line:**
```
motion.div initial:{opacity:0} animate:{opacity:1} transition:{duration:0.08}
Row: line number (muted, 11px, non-selectable) + highlighted code
```

**Syntax highlighting (custom lexer — TypeScript/JS):**
| Token type | Color |
|---|---|
| Keywords (`import`, `const`, `async`, etc.) | `#7BB8F5` (blue) |
| Strings (single, double, template) | `#F0B060` (amber) |
| Comments (`//`, `#`) | `#6A625D` (muted, italic) |
| Numbers | `#C598E8` (purple) |
| Default text | `#E8DDD6` |
| Operators / punctuation | `rgba(232,221,214,0.5)` (dim) |

**Streaming cursor:** While revealing, blinking amber rect at end of code.
```
width:7px, height:14px, background:#683D1B, borderRadius:1
opacity: [0.2, 1, 0.2], 0.7s repeat
```

**Collapse/expand (files > 20 lines):**
- After streaming completes, if >20 lines: gradient fade + "Show N more lines of code" button
- Expanded: shows all lines + "Show less" button
- Gradient: `linear-gradient(to bottom, transparent, #1E1A17)` over last 48px

**Copy button (KDS corrosion dark material):**
```
Fixed 76px wide — no layout shift on Copy→Copied swap
Background: linear-gradient(180deg, #524B47 0%, #26211E 100%)
Hover:       linear-gradient(180deg, #6A625D 0%, #3B3632 100%)
Box shadow: outer ring (rgba(0,0,0,0.85)) + lift + top highlight inset + bottom depth inset
Copy → Copied: AnimatePresence popLayout
  exit:  y:-6, scale:0.85, opacity:0
  enter: y:6→0, scale:0.85→1, opacity:0→1
  0.18s ease:[0.16,1,0.3,1]
1800ms reset
```

---

### AnimatedCallout

**Entry:**
```
initial: {opacity:0, x:-10, y:4}
animate: {opacity:1, x:0, y:0}
spring(stiffness:340, damping:26)
```

**Visual:**
- Left border: 3px, variant color
- Background: semi-transparent variant color
- Icon (16px) + title (14px bold) + body (14px, `renderInlineMd`)
- Border-radius: `0 10px 10px 0`

**Variants and colors:**
| Variant | Background | Border/Icon | Icon |
|---|---|---|---|
| `info` | `rgba(13,110,178,0.07)` | `#0D6EB2` | InformationCircleIcon |
| `warning` | `rgba(200,146,10,0.08)` | `#C8920A` | Alert01Icon |
| `success` | `rgba(128,183,7,0.07)` | `#80B707` | CheckmarkCircle01Icon |
| `error` | `rgba(200,50,50,0.07)` | `#C83232` | Cancel01Icon |
| `tip` | `rgba(104,61,27,0.07)` | `#683D1B` | Idea01Icon |

`onComplete` fires 440ms after mount.

---

### AnimatedTags

**Entry:** `opacity:0→1, 0.18s`

Tags reveal at 90ms intervals.

Each tag:
```
motion.span initial:{scale:0.55, opacity:0} animate:{scale:1, opacity:1}
spring(stiffness:420, damping:22)
```

5-color palette cycles modulo by index:
```
[brown, neutral-dark, blue, green, neutral-mid]
```
Custom color overrides: `bg = color+'15'`, `fg = color`, `border = color+'28'`.

`onComplete` fires 160ms after last tag.

---

### AnimatedPieChart

**SVG donut specs:**
```
Outer radius (R): 90
Center (CX, CY): 110, 110
Stroke width: 26 (SW)
Circumference: 2π×90 ≈ 565.5
ViewBox: 220×220
Track ring: rgba(59,54,50,0.07)
```

**Segment reveal:** 180ms per segment interval.

Each segment:
```
strokeDashoffset: arc.dashLen → 0 when index < revealedCount
CSS transition: 0.52s cubic-bezier(0.16,1,0.3,1)
strokeDasharray: `${dashLen} ${gapLen}`
transform: rotate(startDeg CX CY)
```

**Hover state:**
- Hovered segment: `strokeWidth: 30` (SW+4) — ring thickens, transition 120ms
- Center label switches to: percentage + unit value or truncated label name
- Legend items: non-hovered dim to 0.45 opacity (120ms)

**Legend:** 2-column grid, each item animates `opacity:0→1, y:4→0, 0.22s easeOut` as segment reveals.

`onComplete` fires 800ms after last segment.

---

### AnimatedLineChart

**Container:** white card, border, borderRadius:12, padding

**SVG coordinate system:**
```
viewBox: "0 0 700 160"
Padding: top:14, right:18, bottom:32, left:38
Chart area: 644×114 (W-PAD.left-PAD.right × H-PAD.top-PAD.bottom)
```

**Reveal (120ms delay then `setRevealed(true)`):**

Grid lines (5 horizontal):
```
opacity:0→1, 0.3s delay:0.1 on reveal
```

Area fill polygon:
```
opacity:0→1, 0.4s delay:0.35 on reveal
fill: `${color}10` (10% opacity of line color)
```

Line (pathLength trick):
```
pathLength={1}
strokeDasharray="1"
strokeDashoffset: 1 → 0 on reveal
CSS transition: 1.1s cubic-bezier(0.16,1,0.3,1)
strokeWidth: 1.5
```

Data point dots:
```
Each: scale:0→1 spring(stiffness:480, damping:22)
Hovered dot: r:2.5→4, fill:white, stroke:color, strokeWidth:2
```

**Hover interaction:**
- Mouse position → finds nearest x-index → highlights dot + shows crosshair + tooltip
- Crosshair: dashed vertical line, rgba(59,54,50,0.18), strokeDasharray:"4 3"
- Tooltip (AnimatePresence): opacity:0, y:4, scale:0.96 → visible
  - Dark background (`var(--neutral-900)`), padding 7px 10px
  - X label (date) + colored dot + value per series
  - Clamped within container width

X-axis labels: sparse (every `ceil(total/7)` steps + last point), 11px, #C0B5AD.
Y-axis labels: at 0%, 50%, 100% of value range.

`onComplete` fires 1300ms after reveal.

---

### AnimatedCard

```
initial: {opacity:0, y:8}
animate: {opacity:1, y:0}
0.28s ease:[0.16,1,0.3,1]

Layout:
  badge (optional): 10px uppercase, color from data.badgeColor, bg at 12% opacity
  title: 16px, fontWeight:600, #26211E
  subtitle: 12px, #9A9089
  body: 14px, #524B47, renderInlineMd support
```

`onComplete` fires 380ms after mount.

---

### AnimatedConnectorError

```
initial: {opacity:0, y:8}
animate: {opacity:1, y:0}
0.28s ease:[0.16,1,0.3,1]

Layout:
  Left stripe: 3px wide, background:var(--red-500, #C33838)
  Icon (emoji) + connector name + "Auth expired" badge (red)
  "Reconnect" button: white bg, red border, hover: rgba(195,56,56,0.08)
  Exchange01Icon (16px, red) in button
  message text (if present): 14px, var(--neutral-500)
```

`onComplete` fires 420ms after mount.

---

### AnimatedSearchTimeout

```
initial: {opacity:0, y:8}
animate: {opacity:1, y:0}
0.28s ease:[0.16,1,0.3,1]

Layout:
  Left stripe: 3px, background:var(--yellow-500, #A28847)
  GlobeXIcon (16px, amber) + "Web search timed out"
  Query pill: 13px monospace, neutral bg, shows the original query string
  "Retry search" button: white bg, amber border, hover: rgba(162,136,71,0.1)
  Exchange01Icon (16px, amber) in button
```

`onComplete` fires 420ms after mount.

---

## 8. UI Micro-interactions

---

### UserBubble

```
Enter: spring(stiffness:380, damping:28)
  opacity:0→1, y:10→0, scale:0.97→1

Layout:
  Attachment FileChip above (if present)
  Bubble: background:#683D1B, color:white
  Padding: 12px 16px
  Border-radius: 16px 16px 4px 16px (sharp bottom-right)
  Box shadow: inset 0 -2px 1.1px rgba(0,0,0,0.25)
  Max-width: 566px, fontSize:16, lineHeight:22px
```

**Hover toolbar** (appears under bubble on mouseEnter, hides on leave):
```
transition: opacity 0.14s ease
Height: 24px
Items: timestamp (11px, #B6ACA4) + [Retry, Edit, Copy] icon buttons
Each button: 24×24px, borderRadius:5
Hover: background rgba(59,54,50,0.08)
Icons: Exchange01Icon, QuillWrite01Icon, Copy01Icon (16px, #B6ACA4)
```

---

### ModelRow

Single row showing logo + label + research title + toggle chevron.

**During `choosing` phase:**
```
animate: {opacity: [0.45, 1, 0.45]}
transition: {duration:1.0, repeat:Infinity, ease:'easeInOut'}
```

**Label transitions (AnimatePresence popLayout):**

Standard labels:
```
initial: {opacity:0, filter:'blur(5px)', scale:0.82, y:5}
animate: {opacity:1, filter:'blur(0)', scale:1, y:0}
exit:    {opacity:0, filter:'blur(5px)', scale:0.82, y:-5}
spring(stiffness:520, damping:32)
```

During `thinking` — CyclingLabel replaces static text:
```
initial: {opacity:0, filter:'blur(5px)', scale:0.82}
animate: {opacity:1, filter:'blur(0)', scale:1}
exit:    {opacity:0, filter:'blur(5px)', scale:0.82}
```

**Research title** (slides in alongside label):
```
initial: {opacity:0, x:10, filter:'blur(8px)'}
animate: {opacity:1, x:0, filter:'blur(0)'}
0.48s ease:[0.16,1,0.3,1]
Content: " · " separator + WordReveal (80ms/word)
```

---

### Logo (SouvenirMark ↔ Model Icon)

`AnimatePresence mode="popLayout"` wraps both states.

**SouvenirMark exit (on model-chosen):**
```
opacity:0, scale:0.25, rotate:-20, y:-5, filter:blur(10px)
0.18s ease:[0.4,0,1,1] (ease-in — sharp exit)
```

**Model LlmIcon enter:**
```
initial: {opacity:0, scale:0.15, rotate:14, filter:blur(14px)}
animate: {opacity:1, scale:1, rotate:0, filter:blur(0)}
spring(stiffness:220, damping:11, mass:0.9)
filter: separate 0.3s easeOut transition
```

**Glow burst (exactly on model-chosen phase):**
```
3 rings at delays: 0ms, 100ms, 230ms
Each:
  initial: {scale:0.8, opacity:0.5}
  animate: {scale:4.5, opacity:0}
  0.75s ease:[0.16,1,0.3,1]
  border: 1.5px solid rgba(104,61,27,0.35)
  position: absolute inset:0 borderRadius:50%
```

---

### ReasoningStepRow

**Layout:** Left column (icon + vertical line) + Right column (button + expanded summary)

**Vertical connector line (between steps, not last):**
```
scaleY:0→1, opacity:0→1, 0.28s easeOut, delay:0.1
transformOrigin: top
1px wide, background:#EDE1D7
minHeight: 12px
```

**Active step (currently being processed):**
- Verb shows shimmer gradient (same keyframes as label shimmer)
- Verb followed by "…"
- No chevron, no detail text visible
- Icon color: `#A89488`

**Completed step:**
- Verb bold, color:`#26211E`
- Detail text follows verb (space-separated)
- Right chevron: `width:12 height:12`, rotates 90° when expanded
  - spring(stiffness:380, damping:28)
- Icon color: `#C0B5AD`

**Expanded summary:**
```
height:0→auto, opacity:0→1  (enter)
height:auto→0, opacity:1→0  (exit)
0.22s ease:[0.16,1,0.3,1]
```
Content: `renderInlineMd(step.summary)`
Style: 14px, #524B47, lineHeight:22px, borderLeft:2px solid #EDE1D7, paddingLeft:10

---

### ActivityRow

**Row layout:** Status icon + Activity icon + Verb + Detail + Result count / "working…" + Action badge

**Status icon:**
- Active: Spinner icon rotating 360° continuously (1s linear repeat)
- Done: Checkmark icon, #80B707

**Activity icon:**
- Active: color `#827A74`
- Done: color `#80B707`

**"working…" label (while active):**
```
opacity: [0.3, 1, 0.3], 1.2s repeat
```

**Result items (revealed one-by-one at resultStagger):**
```
motion.div initial:{opacity:0, x:-4} animate:{opacity:1, x:0}
delay: resultIndex * 0.04s, duration:0.18s
paddingLeft: 48px (below verb column)
```

**"reading…" highlight on result:**

While the 650ms `readingResult` timer is active for a result:
```
Show "reading…" in italic, #C0B5AD, pulsing opacity:[0.3,1,0.3] 0.9s repeat
When timer expires: replace with dot + title + domain
```

**Action Badge ("ACTION" pill):**
```
fontSize:9, fontWeight:600, color:#6A625D
background: rgba(59,54,50,0.08)
borderRadius:4, padding:'1px 5px'
textTransform: uppercase, letterSpacing:0.4px
```

---

### ResearchBlock

**Container open/close:**
```
height: spring(stiffness:260, damping:28)
opacity: 0.22s easeInOut
AnimatePresence initial={false} wraps entire block
```

**"Working…" pulse** (shown when activities list is not yet complete):
```
opacity: [0.3, 0.8, 0.3], 1.2s repeat
AiBrain01Icon (16px, #D1C6BD) + "Working…" (14px, #C0B5AD)
```

**Divider** between reasoning and activities sections:
```
height:1, background: rgba(59,54,50,0.08)
Only shown when both reasoning and activities are present
```

**Collapsed group row:**
```
✓ green checkmark + "Ran N actions" bold + "— {summary}" muted + Chevron
Chevron: spring(stiffness:380, damping:28) rotates 180° when open
```

Expanding collapsed group:
```
height:0→auto, opacity:0→1, 0.22s ease:[0.16,1,0.3,1]
Sub-items: small ✓ + activity icon + verb + detail + badge
```

---

### StreamingText

**Pre-start state:** `BreathingDot` shown for `firstTokenDelay` ms in a 26px tall div.

**Word stream:** After delay, words appear at `wordDelay` ms intervals. Cursor (BreathingDot) appended to current word.

**Pause/resume:** Words stop emitting when `isPaused=true`. Cursor disappears while paused.

**Interrupt UI (text-only scenarios):**
```
Appears when isPaused && interrupted
"Response interrupted. Continue →" (13px, #827A74)
Continue button: #683D1B, underline, resets isPaused+interrupted
opacity:0→1, y:4→0 / exit opacity:0
```

**Text is rendered through `renderTextBlock`** which handles full markdown (headings, lists, blockquotes, bold, inline code, citations, links).

---

### CitationChip

Inline `[N]` superscript chip within streaming/static response text.

**Rest state:**
```
16×16px, borderRadius:4, fontSize:9, fontWeight:700
background: rgba(104,61,27,0.12), color:#683D1B
```

**Active (hovered or clicked open):**
```
background: #683D1B, color:white
transition: all 140ms
```

**Popover (on hover OR click):**
```
initial: {opacity:0, y:4, scale:0.96}
animate: {opacity:1, y:0, scale:1}
exit:    {opacity:0, y:4, scale:0.96}
0.14s easeOut

Position: above chip, centered, clamped to window
Content: favicon (16×16) + title + domain
Background: white, border:1px solid #EDE1D7
boxShadow: 0 4px 16px rgba(59,54,50,0.14)
```

Pin citations show `📌` emoji instead of favicon. No domain line for pins.

---

### SourceList / SourceCard

Appears after `isComplete && citations.length > 0`.

**SourceList:**
```
initial: {opacity:0, y:6}
animate: {opacity:1, y:0}
0.28s ease:[0.16,1,0.3,1], delay:0.12
```

**SourceCard (each):**
```
initial: {opacity:0, x:-8}
animate: {opacity:1, x:0}
delay: 0.18 + index * 0.07s, 0.26s ease:[0.16,1,0.3,1]

Rest: white bg, border:1px solid #EDE1D7
Hover: background rgba(104,61,27,0.06), border rgba(104,61,27,0.2)
transition: 150ms
```

Content: favicon (14px) + title (12px, #26211E) + domain (10px, #B6ACA4)

---

### SelectionCTA

Floating "Highlight" button appears when text is selected within the response area.

**Enter:**
```
initial: {opacity:0, y:6, scale:0.92}
animate: {opacity:1, y:0, scale:1}
exit:    {opacity:0, y:4, scale:0.94}
0.15s ease:[0.16,1,0.3,1]
```

**Position:** Above selection, horizontally centered, clamped 8px from viewport edges.

**Visual (KDS corrosion dark material):**
```
Width: 110px, padding:'6px 0'
background: linear-gradient(180deg, #524B47 0%, #26211E 100%)
boxShadow: outer ring(black) + lift + top highlight inset + bottom depth inset
```

**State swap (Highlight → Highlighted):**
```
AnimatePresence mode="popLayout" initial={false}
Both states: y:5→0, scale:0.85→1, opacity:0→1 (enter) / reverse (exit)
0.16s ease:[0.16,1,0.3,1]

Highlight: Bookmark01Icon (12px, rgba(182,172,164,0.85)) + "Highlight" (12px)
Highlighted: Checkmark (11px, var(--green-400)) + "Highlighted" (green)
  Background shifts to brown gradient (linear-gradient(#7E5435, #4A2D16))
  transition: background 200ms
```

---

### ActionBar

Appears (opacity:0→1, y:4→0, 0.18s) when response is hovered or any button has active state.

**Buttons:** Pin, Copy, Thumbs Up, Thumbs Down, Retry

**Pin button:**
- Active: background `rgba(104,61,27,0.1)`, icon `#683D1B`
- Toggles `isPinned`

**Copy button:**
- Active: background `rgba(128,183,7,0.08)`, icon becomes Checkmark `#80B707`
- 1500ms reset to copy state

**Thumbs Up button:**
- Active: background `rgba(128,183,7,0.08)`, icon `#80B707`
- Non-reversible — once clicked stays active
- Triggers toast:

**Toast (Thanks for the feedback 👍):**
```
position: absolute, top:-36px
initial: {opacity:0, y:6} animate: {opacity:1, y:0} exit: {opacity:0, y:6}
0.2s
background:#26211E, color:white, 12px, fontWeight:500
borderRadius:8, boxShadow
2200ms auto-dismiss
```

**Thumbs Down button:**
- Opens `FeedbackModal`

---

### FeedbackModal

```
Backdrop:
  position:fixed inset:0, zIndex:100
  background: rgba(38,33,30,0.4), backdropFilter:blur(2px)
  opacity:0→1 enter / 0 exit

Modal:
  initial: {opacity:0, scale:0.96, y:8}
  animate: {opacity:1, scale:1, y:0}
  exit:    {opacity:0, scale:0.96, y:8}
  spring(stiffness:420, damping:30)
  width:420px, background:white, borderRadius:16, padding:24
  boxShadow: 0 20px 40px rgba(38,33,30,0.2) + 0 0 0 1px #EDE1D7
```

Content:
- Title "Give negative feedback" + subtitle
- `<select>`: issue type (Harmful / Not factually correct / Not helpful / Other)
- `<textarea>` 4 rows: "What was unsatisfying about this response?"
- Disclaimer text
- Cancel / Submit buttons (Submit: dark bg)

---

### Follow-up Prompt Chips

When a `follow-ups` block is encountered, the chat input area transforms.

**Chat input area transition (AnimatePresence mode="wait"):**
- Exit current input: `opacity:0, y:-4`
- Enter follow-up mode: `opacity:0, y:6 → opacity:1, y:0, 0.26s ease:[0.16,1,0.3,1]`

**Each chip:**
```
initial: {opacity:0, x:-10}
animate: {opacity:1, x:0}
delay: index * 0.08s, 0.22s ease:[0.16,1,0.3,1]
```

Style: `var(--neutral-50)` bg, border, `borderRadius:12`, 10px 14px padding.
Hover: `borderColor → var(--neutral-300)`, `background → white`.

Clicking a chip: archives current turn as `FrozenTurn`, switches to next scenario, re-runs.

---

### Chevron

Animated SVG chevron used in ModelRow and collapsed group rows.

```
motion.svg width:14, height:14
animate: {rotate: isOpen ? 180 : 0}
spring(stiffness:380, damping:28)
Path: "M3 5.5 L7 9.5 L11 5.5" stroke:var(--neutral-400) strokeWidth:1.7
```

---

## 9. Multi-turn Behaviour

When a response is `complete` and the user clicks a follow-up prompt or sends a new message:

1. Current exchange is captured as `FrozenTurn`:
   - Query text + attachment
   - Model name + llmId
   - `responseText` OR `responseBlocks` (for block-based responses)
   - `isBlocks` flag

2. `FrozenTurnView` renders statically above the new live turn:
   - No enter animation (already "happened")
   - User bubble rendered at 82% opacity
   - Mini model row: 14px LlmIcon + model name
   - Block responses shown as compact pill: "Structured response · table, bar-chart" etc.
   - Horizontal divider at bottom

3. `reset()` is called → all phase/animation state cleared

4. `run()` starts again with the new scenario

5. Chat scroll area auto-scrolls to bottom:
   - `behavior: 'smooth'` after first turn
   - `behavior: 'instant'` on initial load

---

*End of specification.*
