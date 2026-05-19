# Brain — Engineering Handoff

> **Audience:** Engineers (Kunal, Sean) integrating the Brain UI template with a real backend.  
> **Date:** 2026-05-18  
> **Storybook:** `localhost:6007` (or whichever port is free — run `npm run storybook`)  
> **Stories:** `src/stories/templates/Brain.stories.tsx`  
> **Source:** `src/templates/Brain/`

---

## 1. What Brain Is

Brain is a **long-running AI orchestration UI** — not a chat. The user gives Brain a goal ("research X and draft a report"), Brain plans a multi-step execution, runs it step-by-step (potentially using external connectors), streams the output, and shows the full loop history when done.

Brain is a **React template**, not a Next.js page or a standalone app. It's a `BrainShell` component that wraps the layout and phase machine. Every state the UI needs to render must be passed in — Brain has no server communication of its own.

**The key mental model:** one interaction cycle = one **Loop** (plan → execute → stream → complete). Multiple Loops live in a Thread. The UI moves through 14 named Phases driven by your backend.

---

## 2. File Map

```
src/templates/Brain/
├── index.tsx               ← BrainShell (main layout) + all re-exports
├── lib/
│   └── phase.ts            ← Phase type, PHASE_TRANSITIONS, PlanStep, Loop types
│
├── BrainHome.tsx           ← Idle state: headline + suggestion cards
├── ClarificationCard.tsx   ← QuestionCard wrapper for clarifying-goal phase
├── ClarificationSummary.tsx
├── PlanCard.tsx            ← planning phase: step list + Approve/Counter/Cancel
├── ActivityBlock.tsx       ← executing phase: live step-by-step progress
├── StreamingIndicator.tsx  ← thinking / souvenir / streaming phase animations
├── StreamingMessageBubble.tsx
├── PauseCard.tsx           ← paused phase: Continue / Change direction / Cancel
├── NodeFailureCard.tsx     ← node-failed phase: Re-run / Skip (non-critical) / Cancel
├── LoopHistoryCard.tsx     ← complete phase: expandable completed run summary
├── ArtifactCard.tsx        ← structured output card shown at complete
├── BrainNarration.tsx      ← Brain's commentary text
├── BrainTimeline.tsx       ← timeline view of events
├── BrainPhaseGroup.tsx     ← groups multiple PhaseRecords
├── BrainResultHeader.tsx   ← header for completed loop output
├── PhaseRecord.tsx         ← single phase event row in thread
├── PinConfirmationCard.tsx ← confirming-pins phase: user selects which pins
├── PersonaSelectionCard.tsx
├── PersonaActiveBar.tsx    ← bar showing active persona
├── LoopCancelledCard.tsx   ← cancelled phase indicator
├── LoopFailedCard.tsx      ← failed phase indicator
├── ContextRail.tsx         ← right-side rail (persona, pins, connectors)
│
├── ScheduleCard.tsx        ← single schedule card (list item)
├── ScheduleListView.tsx    ← grid of schedule cards
├── ScheduleDetailView.tsx  ← detail page: instructions + run history
├── ScheduleEditModal.tsx   ← create/edit schedule modal
└── ScheduleDeleteModal.tsx ← delete confirmation modal
```

---

## 3. The Phase Machine

**Source:** `src/templates/Brain/lib/phase.ts`

### 3.1 All 14 Phases

```typescript
type Phase =
  | 'idle'             // waiting for user input — BrainHome shown
  | 'user-sent'        // message submitted — immediately transitions to thinking
  | 'thinking'         // Brain deciding what to do (clarify / search / plan)
  | 'clarifying-goal'  // Brain needs more info — ClarificationCard shown at bottom
  | 'souvenir'         // searching Pinboard for relevant context
  | 'confirming-pins'  // surfaced pins — user picks which to include
  | 'planning'         // PlanCard shown — awaiting approve / counter / cancel
  | 'executing'        // ActivityBlock running — stop button live in ChatInput
  | 'paused'           // user hit stop — PauseCard shown
  | 'node-failed'      // a step failed — NodeFailureCard shown
  | 'streaming'        // output streaming into thread
  | 'complete'         // done — LoopHistoryCard + output shown
  | 'cancelled'        // user cancelled at PlanCard or PauseCard
  | 'failed'           // unrecoverable failure (all retries exhausted)
```

### 3.2 What Renders Per Phase

| Phase | Thread Content | Bottom Area |
|---|---|---|
| `idle` | BrainHome (suggestion cards) | ChatInput |
| `user-sent` | User message bubble | ChatInput |
| `thinking` | StreamingIndicator | ChatInput |
| `clarifying-goal` | QuestionCard in thread | **ClarificationCard replaces ChatInput** |
| `souvenir` | StreamingIndicator ("Scanning Pinboard") | ChatInput |
| `confirming-pins` | PinConfirmationCard | ChatInput |
| `planning` | PlanCard | ChatInput |
| `executing` | ActivityBlock | ChatInput (stop button mode) |
| `paused` | PauseCard | ChatInput |
| `node-failed` | NodeFailureCard | ChatInput |
| `streaming` | StreamingMessageBubble + StreamingIndicator | ChatInput |
| `complete` | Output + ArtifactCard + LoopHistoryCard | ChatInput |
| `cancelled` | LoopCancelledCard | ChatInput |
| `failed` | LoopFailedCard | ChatInput |

### 3.3 Valid Transitions

```
idle            → user-sent
user-sent       → thinking
thinking        → clarifying-goal | souvenir | planning
clarifying-goal → thinking         (always — re-evaluates after each answer)
souvenir        → confirming-pins | planning
confirming-pins → planning
planning        → executing | cancelled
executing       → streaming | paused | node-failed | failed
paused          → executing | planning | cancelled
node-failed     → executing | cancelled
streaming       → complete
complete        → idle
cancelled       → idle
failed          → idle
```

**Two-skip rule:** Two consecutive skipped clarification questions → Brain proceeds regardless (handled by `shouldProceedDespiteSkip(clarifications)` utility in `phase.ts`).

### 3.4 ContextRail Auto-Show

The right rail slides in automatically for phases:
```typescript
const CONTEXT_RAIL_PHASES = new Set<Phase>([
  'planning', 'executing', 'paused', 'node-failed', 'streaming', 'complete',
])
```
This is purely CSS-driven — no prop needed. The rail never shows during clarification or Pinboard search, only once a plan exists.

---

## 4. BrainShell — The Layout Component

**Source:** `src/templates/Brain/index.tsx`

### 4.1 Props

```typescript
interface BrainShellProps {
  children?:           React.ReactNode        // thread content — rendered when phase !== 'idle'
  disclaimer?:         string                 // text under ChatInput. default: 'Brain can make mistakes...'
  defaultPhase?:       Phase                  // jump to phase (Storybook use). default: 'idle'
  sidebarProps?:       Partial<SidebarProps>  // forwarded to left Sidebar
  chatInputProps?:     Partial<ChatInputProps>// forwarded to ChatInput
  clarificationProps?: ClarificationCardProps // required when phase === 'clarifying-goal'
  onSend?:             (value: string) => void
  onShare?:            React.MouseEventHandler<HTMLButtonElement>
  contextRailData?:    ContextRailData        // persona, pins, connectors for right rail
}
```

### 4.2 Internal State

BrainShell owns two pieces of internal state:
- `phase` — current phase. Syncs from `defaultPhase` via `useEffect`.
- `inputValue` — controlled text in ChatInput.

The phase machine in BrainShell handles only one transition automatically: `idle → user-sent` on `onSend`. All subsequent transitions must be driven by the consumer (your backend integration layer).

### 4.3 Layout Structure

```
[full-screen flex row]
  ├── Sidebar (240px, left)
  ├── Center column (flex 1)
  │   └── Glass card (neutral-50 bg, 10px padding, 22px border-radius)
  │       ├── Top bar (absolute, share icon)
  │       ├── Thread slot [data-slot="brain-thread"] (flex 1, overflow scroll)
  │       │   └── Inner wrapper (maxWidth 810px, margin auto, 28px h-padding)
  │       │       └── {isIdle ? <BrainHome /> : children}
  │       └── Bottom area (ChatInput or ClarificationCard + disclaimer)
  └── ContextRail (300px, right) — only visible when phase in CONTEXT_RAIL_PHASES
```

The ContextRail slides in/out via the `kds-context-rail` CSS class on the wrapper div. The `data-open` attribute drives the animation.

### 4.4 Driving Phases From Your Backend

BrainShell exposes `defaultPhase` which syncs into internal state. For real integration, you have two options:

**Option A — Controlled from outside (recommended)**
Build a wrapper component that holds phase state and passes it as `defaultPhase`. The `useEffect(() => { setPhase(defaultPhase) }, [defaultPhase])` sync inside BrainShell will pick it up.

```tsx
function BrainPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [steps, setSteps]   = useState<PlanStep[]>([])

  // When Brain API returns a plan:
  const handleBrainResponse = (response: BrainApiResponse) => {
    setSteps(response.plan.steps)
    setPhase('planning')
  }

  return (
    <BrainShell
      defaultPhase={phase}
      onSend={async (text) => {
        setPhase('thinking')
        const response = await callBrainApi(text)
        handleBrainResponse(response)
      }}
    >
      {phase === 'planning' && (
        <PlanCard
          steps={steps}
          onApprove={() => {
            setPhase('executing')
            startExecution()
          }}
          onCancel={() => setPhase('cancelled')}
        />
      )}
      {/* ...other phase content */}
    </BrainShell>
  )
}
```

**Option B — Storybook/demo mode**
Use Storybook's `args.defaultPhase` to jump directly to any phase. The template already has stories for all 14 phases.

---

## 5. Core Data Types

**Source:** `src/templates/Brain/lib/phase.ts`

### 5.1 PlanStep

The shared step type used across PlanCard (preview), ActivityBlock (live), and LoopHistoryCard (history).

```typescript
type StepStatus = 'pending' | 'upcoming' | 'executing' | 'complete' | 'failed' | 'skipped'

interface PlanStep {
  id:                  string
  label:               string
  connector?:          string              // display name e.g. "Notion", "Linear"
  isCritical:          boolean             // REQUIRED — true → failure shows Re-run/Cancel only (no Skip)
  status:              StepStatus
  requiresConnector?:  ConnectorRequirement
  parallelGroup?:      string              // steps sharing the same string execute simultaneously
}
```

**IMPORTANT:** `isCritical` is NOT optional. Every PlanStep must declare it. TypeScript will error otherwise.

**parallelGroup:** Two or more steps with the same `parallelGroup` string are rendered in a `PlanParallelGroup` — they show as "Runs at the same time" with a bracket visual. Non-grouped steps render as sequential `PlanStepRow` items.

### 5.2 ConnectorRequirement

```typescript
interface ConnectorRequirement {
  name:         string      // display name e.g. "Notion"
  logoUrl?:     string      // data URI from connectorLogoSrc() helper — see §9
  description?: string      // "Read and write access to Notion pages"
  isConnected:  boolean     // if false → shows "Connect" button in PlanCard
  onConnect?:   () => void  // called when user clicks Connect
}
```

If `isConnected` is false on any step, the Approve button in PlanCard is **disabled** until all connectors are connected.

### 5.3 ClarificationItem

```typescript
type ClarificationType = 'ambiguity' | 'depth' | 'permission'

interface ClarificationItem {
  type:     ClarificationType
  question: string
  answer?:  string    // undefined if skipped
  skipped:  boolean
}

// Two consecutive skips → proceed regardless
shouldProceedDespiteSkip(clarifications: ClarificationItem[]): boolean
```

### 5.4 Loop

The full state for one task submission within a Thread:

```typescript
interface Loop {
  id:              string
  query:           string
  timestamp:       Date
  phase:           Phase
  clarifications:  ClarificationItem[]
  interpretation?: string   // Brain's stated understanding before proceeding
  plan?: {
    steps:      PlanStep[]
    connectors: string[]
    status:     'pending' | 'approved' | 'countered' | 'cancelled'
  }
  output?:  string
  status:   'clarifying' | 'confirming-pins' | 'planning' | 'executing' |
            'paused' | 'streaming' | 'complete' | 'failed' | 'cancelled'
}
```

---

## 6. All Components — Props Reference

### 6.1 BrainHome

Renders when `phase === 'idle'`. Shown automatically by BrainShell.

```typescript
interface BrainHomeProps {
  onSuggestion?: (text: string) => void  // fills ChatInput with clicked suggestion text
}
```

Contains: rotating display headline (random per mount), subtitle, 3 suggestion cards. Clicking a suggestion card calls `onSuggestion` and then the user can edit/send.

---

### 6.2 StreamingIndicator

Shows during `thinking`, `souvenir`, and `streaming` phases.

```typescript
type StreamingPhase = 'thinking' | 'souvenir' | 'streaming'

interface StreamingIndicatorProps {
  phase: StreamingPhase
}
```

Renders: phase icon + rotating message (cycles every 2.5s) + pulsing dots. Messages reset on phase change.

---

### 6.3 ClarificationCard

Wraps the KDS `QuestionCard` component. Replaces ChatInput at the bottom during `clarifying-goal` phase.

```typescript
interface ClarificationCardProps {
  question:           string
  options:            QuestionCardOption[]   // from @kds/QuestionCard
  questionIndex:      number                 // 1-based, shown as "1/3"
  totalQuestions?:    number                 // default: 3
  selected?:          string
  clarificationType?: ClarificationType      // 'ambiguity' | 'depth' | 'permission'
  onSelect?:          (id: string) => void
  onSkip?:            () => void
  onSend?:            () => void
  onPrev?:            () => void
  onNext?:            () => void
}
```

**Integration note:** Pass `clarificationProps` to `BrainShell`. BrainShell automatically swaps ClarificationCard for ChatInput when `phase === 'clarifying-goal'`.

---

### 6.4 PlanCard

Shown during `planning` phase. The user sees the full step-by-step plan before execution.

```typescript
interface PlanCardProps {
  steps:           PlanStep[]
  interpretation?: string      // Brain's stated goal (italic, shown above steps)
  onApprove?:      () => void   // → executing
  onCounter?:      () => void   // sends user back to ChatInput to redirect
  onCancel?:       () => void   // → cancelled
}
```

**Connector gate:** Approve button is disabled if any step has `requiresConnector.isConnected === false`. Each such step shows a `ConnectorRow` with a "Connect" button inline.

**Parallel steps:** Steps with the same `parallelGroup` string render as a parallel group (see §5.1).

**First-mount animation:** Steps animate in with a staggered height/fade. After the first mount, this animation is suppressed (module-level flag `planStepsAnimatedOnce`).

---

### 6.5 ActivityBlock

Shown during `executing` phase. Real-time step progress.

```typescript
interface ActivityBlockProps {
  steps:           PlanStep[]   // statuses update as execution progresses
  interpretation?: string       // Brain's stated goal (italic, shown above steps)
}
```

The active step gets a subtle warm background. Connector info shown only when the step is `executing`. Failed + `isCritical` shows the "Critical" badge. Completed connector lines darken from `--neutral-200` to `--neutral-300`.

**How to update in real-time:** Keep a `steps` array in state and mutate step statuses as your backend sends events. The component re-renders on each status change.

---

### 6.6 PauseCard

Shown when user presses Stop during `executing`.

```typescript
interface PauseCardProps {
  pausedAfterStep?: string      // label of the last step Brain finished
  onContinue?:      () => void  // → executing
  onChangeDirection?: () => void // sends user to ChatInput to retype a counter-direction
  onCancel?:        () => void  // → cancelled
}
```

---

### 6.7 NodeFailureCard

Shown during `node-failed` phase. Background is `--color-tag-Red-bg`.

```typescript
interface NodeFailureCardProps {
  step:          Pick<PlanStep, 'label' | 'isCritical'>
  errorMessage?: string
  onRerun?:      () => void   // → executing
  onSkip?:       () => void   // only shown if step.isCritical === false; → executing
  onCancel?:     () => void   // → cancelled
}
```

**Critical rule:** If `step.isCritical === true`, the "Skip step" button is **not rendered**. Only Re-run and Cancel are available. This is intentional — critical steps cannot be bypassed.

---

### 6.8 LoopHistoryCard

Shown at `complete` phase and in Schedule run history. Expandable summary of a completed run.

```typescript
interface LoopHistoryCardProps {
  steps:        PlanStep[]
  completedAt?: Date          // auto-formats to "8:00 AM" if runLabel not given
  runLabel?:    string        // overrides auto-format (e.g. "Today · 8:00 AM" for schedules)
  defaultOpen?: boolean       // default: false (collapsed)
}
```

Header shows: "Completed" + counts (N done · N skipped · N failed) + time label + toggle arrow. Step rows show status icon, label, and line-through for skipped.

Status icons: checkmark (complete) · X circle (failed) · dashed circle with dash (skipped).

---

### 6.9 StreamingMessageBubble

Shown during `streaming` phase.

```typescript
interface StreamingMessageBubbleProps {
  content:    string          // markdown content being streamed in
  isComplete: boolean         // stops the streaming cursor animation
}
```

---

### 6.10 ArtifactCard

Shown at `complete` alongside the full output.

```typescript
interface ArtifactCardProps {
  title:    string
  type:     'document' | 'spreadsheet' | 'code' | 'data'
  preview?: string     // short text preview
  onOpen?:  () => void
  onCopy?:  () => void
}
```

---

### 6.11 PinConfirmationCard

Shown during `confirming-pins` phase after Pinboard search.

```typescript
interface PinConfirmationPin {
  id:      string
  title:   string
  source?: string
}

interface PinConfirmationCardProps {
  pins:       PinConfirmationPin[]
  selected:   Set<string>             // pin IDs currently selected
  onToggle?:  (id: string) => void
  onConfirm?: () => void              // → planning
  onSkip?:    () => void              // → planning (without pins)
}
```

---

### 6.12 ClarificationSummary

Shows a read-only summary of answered clarification questions inline in the thread.

```typescript
interface ClarificationSummaryItem {
  question: string
  answer?:  string
  skipped:  boolean
}

interface ClarificationAnswerDisplay {
  type:  'text' | 'option'
  value: string
}

interface ClarificationSummaryProps {
  items: ClarificationSummaryItem[]
}
```

---

### 6.13 PhaseRecord / BrainPhaseGroup / BrainNarration / BrainTimeline

These are thread-building blocks for narrating what Brain did between the user's message and the plan appearing.

```typescript
// A single event record in the thread
type PhaseRecordStatus = 'pending' | 'complete' | 'failed'
interface PhaseRecordProps {
  label:   string
  status?: PhaseRecordStatus    // default: 'complete'
  meta?:   string               // secondary text
}

// Groups multiple PhaseRecords with an expandable disclosure
interface BrainPhaseGroupProps {
  label:    string
  records:  { label: string; meta?: string; status?: PhaseRecordStatus }[]
  defaultOpen?: boolean
}

// Brain's commentary text in the thread
interface BrainNarrationProps {
  text: string
}

// Timeline of events (research steps, sources checked, etc.)
type BrainTimelineResultVariant = 'success' | 'warning' | 'info'
interface BrainTimelineResult {
  label:    string
  variant?: BrainTimelineResultVariant
}
interface BrainTimelineItem {
  id:       string
  label:    string
  results?: BrainTimelineResult[]
}
interface BrainTimelineProps {
  items: BrainTimelineItem[]
}
```

---

### 6.14 BrainResultHeader

Header shown above the completed loop output.

```typescript
interface BrainResultHeaderProps {
  title?:     string
  timestamp?: Date | string
}
```

---

### 6.15 PersonaActiveBar / PersonaSelectionCard

```typescript
interface PersonaActiveBarProps {
  name:      string
  avatarUrl?: string
  onSwitch?: () => void
  onClear?:  () => void
}

interface PersonaSelectionItem {
  id:        string
  name:      string
  handle:    string
  avatarUrl?: string
}

interface PersonaSelectionCardProps {
  personas:   PersonaSelectionItem[]
  selected?:  string             // persona id
  onSelect?:  (id: string) => void
  onClose?:   () => void
}
```

---

### 6.16 LoopCancelledCard / LoopFailedCard

```typescript
interface LoopCancelledCardProps {
  onRestart?: () => void  // start a new loop
}

interface LoopFailedCardProps {
  message?:   string      // error description
  onRetry?:   () => void
  onDismiss?: () => void
}
```

---

## 7. ContextRail

**Source:** `src/templates/Brain/ContextRail.tsx`

The right panel that auto-slides in during `planning` → `complete` phases.

### 7.1 Props

```typescript
interface ContextRailData {
  persona?:    ContextRailPersona
  pins?:       ContextRailPin[]
  connectors?: ContextRailConnector[]
}

interface ContextRailPersona {
  name:       string
  handle:     string
  avatarUrl?: string
}

interface ContextRailPin {
  id:      string
  title:   string
  source?: string
}

interface ContextRailConnector {
  name:   string
  status: 'connected' | 'failed' | 'pending'
}

interface ContextRailProps {
  data: ContextRailData
}
```

Pass `contextRailData` to `BrainShell` and it forwards it to ContextRail automatically.

### 7.2 Connector Logos

ContextRail uses `ConnectorIcon` from `@strange-huge/icons/connectors` to render brand logos with a status dot overlay. No extra setup needed — just pass the connector name and status.

```typescript
// ContextRail renders this automatically for each connector:
<ConnectorIcon id={c.name} size={16} style={{ borderRadius: 3 }} />
// + an absolute status dot (green/red/grey depending on status)
```

The `id` field is case-insensitive. Supported names: `notion`, `linear`, `mixpanel`, `gmail`, `googledrive`, `figma`, `github`, `airtable`, `asana`, `jira`, `hubspot`, `stripe`, `zapier`, `zendesk`, `intercom`, `webflow`, `vercel`, `slack` (18 total).

When an empty `data={}` is passed, ContextRail renders an empty state ("Context will appear here during an active loop.").

---

## 8. ConnectorIcon System

**Package:** `@strange-huge/icons/connectors`  
**Source:** `/tmp/strange-huge-icons/src/connectors/`

Used both in ContextRail AND in PlanCard's ConnectorRow (via `requiresConnector.logoUrl`).

### 8.1 API

```typescript
import { ConnectorIcon } from '@strange-huge/icons/connectors'

<ConnectorIcon
  id="notion"        // case-insensitive
  size={16}          // default: 24
  mono={false}       // true = currentColor monochrome
  style={{ borderRadius: 3 }}
/>
```

Returns `null` if the connector ID is unknown — safe to render unconditionally.

### 8.2 Getting a Data URI for ConnectorRequirement

When building a `PlanStep` with a `requiresConnector`, use this helper:

```typescript
import { CONNECTOR_COLOR } from '@strange-huge/icons/connectors'

function connectorLogoSrc(name: string): string | undefined {
  const svg = CONNECTOR_COLOR[name.toLowerCase()]
  if (!svg) return undefined
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Usage:
const step: PlanStep = {
  id: 'step-1',
  label: 'Fetch project pages',
  isCritical: false,
  status: 'pending',
  requiresConnector: {
    name: 'Notion',
    logoUrl: connectorLogoSrc('notion'),
    description: 'Read access to your Notion workspace',
    isConnected: false,
    onConnect: () => openConnectorOAuth('notion'),
  }
}
```

### 8.3 Available Connectors

`notion` · `linear` · `mixpanel` · `gmail` · `googledrive` · `figma` · `github` · `airtable` · `asana` · `jira` · `hubspot` · `stripe` · `zapier` · `zendesk` · `intercom` · `webflow` · `vercel` · `slack`

---

## 9. Schedule System

The schedule system is a fully self-contained sub-UI accessible from the Sidebar. It has no backend wiring yet — everything is passed as props.

### 9.1 Data Flow

```
Sidebar (schedules list)
  → click → ScheduleListView
    → click card → ScheduleDetailView
      → Edit button → ScheduleEditModal (create or edit)
      → Delete button → ScheduleDeleteModal
      → Run Now → triggers a new Brain loop
```

### 9.2 ScheduleListView

```typescript
type ScheduleListItem = Omit<ScheduleCardProps, 'onClick'>  // id, name, description, frequency, isActive

interface ScheduleListViewProps {
  schedules:         ScheduleListItem[]
  onScheduleClick?:  (id: string) => void   // navigate to detail
  onCreateNew?:      () => void             // open create modal
}
```

Empty state renders automatically when `schedules.length === 0`. Suggestion chips appear below the grid when there are existing schedules.

### 9.3 ScheduleCard

```typescript
interface ScheduleCardProps {
  id:           string
  name:         string
  description?: string
  frequency:    string     // e.g. "Daily · 08:00" or "Weekly · Monday · 09:00"
  isActive:     boolean
  onClick?:     (id: string) => void
}
```

Green active dot when `isActive`. Frequency chip is green when active, grey when paused.

### 9.4 ScheduleDetailView

```typescript
interface ScheduleRunRecord {
  id:           string
  label:        string       // e.g. "Today · 8:00 AM" — shown in LoopHistoryCard header
  steps:        PlanStep[]   // full step history with statuses
  completedAt?: Date
}

interface ScheduleDetailItem {
  id:           string
  name:         string
  instructions: string       // natural-language schedule instructions
  frequency:    string
  nextRun?:     string       // e.g. "Tomorrow 8:00 AM" — shown when active
  isActive:     boolean
  createdAt?:   string
  runHistory?:  ScheduleRunRecord[]
}

interface ScheduleDetailViewProps {
  schedule:        ScheduleDetailItem
  onBack?:         () => void
  onEdit?:         () => void
  onDelete?:       () => void
  onRunNow?:       () => void
  onToggleActive?: (active: boolean) => void
}
```

**Run history** renders as a stack of `LoopHistoryCard` components — each card uses `runLabel` from the record (e.g. "Today · 8:00 AM") and is collapsed by default.

### 9.5 ScheduleEditModal

```typescript
interface ScheduleEditData {
  name:         string
  instructions: string
  frequency:    string     // formatted by internal formatFrequency()
}

interface ScheduleEditModalProps {
  isOpen:     boolean
  schedule?:  ScheduleEditData   // undefined = create mode, defined = edit mode
  onSave:     (data: ScheduleEditData) => void
  onClose:    () => void
}
```

Internal frequency builder: type (daily/weekly) + day-of-week + hour + 15-minute-interval minute. Formats to `"Daily · 08:00"` or `"Weekly · Monday · 09:00"`.

### 9.6 ScheduleDeleteModal

```typescript
interface ScheduleDeleteModalProps {
  isOpen:      boolean
  scheduleName: string
  onConfirm:   () => void
  onClose:     () => void
}
```

---

## 10. What's Wired vs. Placeholder

This table is critical for knowing what needs real backend integration.

| Feature | Status | Notes |
|---|---|---|
| Phase machine (all 14 phases) | ✅ UI complete | All phase components built and Storied |
| BrainShell layout | ✅ Complete | CSS-driven ContextRail slide, glass card, scrolling |
| Phase transitions (automated) | 🔧 Manual only | `idle → user-sent` is automatic. All others require consumer to call `setPhase()` |
| ChatInput send → thinking | ✅ Wired | Fires automatically on send |
| Clarification Q&A | ✅ UI complete | Consumer drives question sequence and phase |
| Pinboard search (souvenir) | ✅ UI complete | Consumer drives which pins surface |
| PlanCard approve/counter/cancel | ✅ UI complete | Callbacks provided |
| ActivityBlock step updates | ✅ UI complete | Consumer updates `steps` array — re-renders on each status change |
| ConnectorRequirement OAuth flow | ✅ UI complete | `onConnect` callback — consumer wires the OAuth window |
| Stop button (→ paused) | ✅ UI complete | Consumer must wire `chatInputProps.onStop` |
| NodeFailureCard rerun/skip | ✅ UI complete | Callbacks provided |
| StreamingMessageBubble | ✅ UI complete | Consumer feeds streaming text chunks |
| ArtifactCard | ✅ UI complete | Consumer provides metadata |
| ContextRail real data | 🔧 Placeholder | Right now: populated via `contextRailData` prop. Consumer builds this from backend context |
| Sidebar data (projects, recents, schedules) | 🔧 Placeholder | Hardcoded in BrainShell. Wire via `sidebarProps` |
| Schedule CRUD backend | 🔧 Placeholder | All UI done — needs API calls behind `onSave`, `onDelete`, `onToggleActive` |
| Schedule run trigger | 🔧 Placeholder | `onRunNow` callback — consumer starts a new Brain loop |
| Schedule run history | 🔧 Placeholder | Consumer fetches history and populates `runHistory: ScheduleRunRecord[]` |
| Persona data | 🔧 Placeholder | Pass real data to `contextRailData.persona` |
| Pinboard pins in ContextRail | 🔧 Placeholder | Pass real data to `contextRailData.pins` |
| Real connectors in ContextRail | 🔧 Placeholder | Pass connector statuses from user's account to `contextRailData.connectors` |
| Thread multi-loop (multiple turns) | 🚧 Design open | Thread visual hierarchy not yet decided — see §12 |

---

## 11. Integration Playbook

### Step 1: Phase driver

Create a `useBrainPhase` hook that holds phase state and exposes transition functions:

```typescript
function useBrainPhase(initial: Phase = 'idle') {
  const [phase, setPhase] = useState<Phase>(initial)

  const transition = (to: Phase) => {
    const valid = PHASE_TRANSITIONS[phase]
    if (!valid.includes(to)) {
      console.warn(`Invalid transition: ${phase} → ${to}`)
      return
    }
    setPhase(to)
  }

  return { phase, transition }
}
```

Use `PHASE_TRANSITIONS` from `lib/phase.ts` to validate transitions in development.

### Step 2: Step state management

```typescript
const [steps, setSteps] = useState<PlanStep[]>([])

// When backend streams a step status update:
const updateStep = (id: string, status: StepStatus) => {
  setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s))
}
```

### Step 3: ContextRail data

```typescript
const contextRailData: ContextRailData = {
  persona: activePersona ? {
    name:      activePersona.name,
    handle:    activePersona.handle,
    avatarUrl: activePersona.avatarUrl,
  } : undefined,
  pins: usedPins.map(pin => ({
    id:     pin.id,
    title:  pin.title,
    source: pin.source,
  })),
  connectors: userConnectors.map(c => ({
    name:   c.name,     // must match a ConnectorIcon id (lowercase)
    status: c.isConnected ? 'connected' : c.lastError ? 'failed' : 'pending',
  })),
}
```

### Step 4: Streaming

For the `streaming` phase, chunk the response into `StreamingMessageBubble`:

```typescript
// In your streaming loop:
for await (const chunk of brainStream) {
  setStreamedContent(prev => prev + chunk)
}
setPhase('complete')
```

### Step 5: Schedule integration

```typescript
// Fetch schedules for sidebar
const schedules = await api.getSchedules()

// When user clicks a schedule:
const schedule = await api.getScheduleDetail(id)
// includes runHistory: ScheduleRunRecord[]

// When user saves:
const handleSave = async (data: ScheduleEditData) => {
  if (editingSchedule) {
    await api.updateSchedule(editingSchedule.id, data)
  } else {
    await api.createSchedule(data)
  }
  refetch()
  closeModal()
}
```

---

## 12. Open Design Decisions (Do NOT Build Until Chai Signs Off)

These are unresolved and will need explicit direction before any implementation:

### Thread visual hierarchy (multi-loop)
When a user sends a second message (starts loop 2 after loop 1 completes), how do the two loops relate visually in the thread?

Four options on the table:
1. Left border / indent on locked (previous) loop rows
2. `BrainNarration` gets a visually distinct weight vs. step rows
3. Phase timestamps in left margin
4. Explicit turn separators (horizontal rule + turn number)

**Decision needed from:** Chai  
**Impact:** Thread layout, potentially new CSS classes or wrapper components

### SmartPinOffer
At `complete`, if the output qualifies for pinning, there should be an offer to save to Pinboard. The trigger conditions (eligibility rules) are not defined yet.

### Counter flow
When user clicks "Counter" on PlanCard, they're sent back to ChatInput. The UI currently does not show which counter-direction was typed vs. the original query. Thread representation of counter conversation is TBD.

### Clarification type visual differentiation
`ClarificationType` ('ambiguity' | 'depth' | 'permission') is stored but not currently rendered differently. Whether the UI should visually distinguish these is TBD.

---

## 13. Animation Rules (Do Not Break These)

All Brain components follow these rules — they are mandatory:

1. **`AnimatePresence` must always have `initial={false}`** — without it, exit animations fire as enter animations on first mount.

2. **Spring presets** — use `springs.fast`, `springs.moderate`, `springs.slow` from `@/lib/springs`. Never hardcode durations.

3. **Module-level flags for one-time animations** — `planStepsAnimatedOnce` in PlanCard ensures the stagger-in only plays on first appearance. Use `let` at module scope, not `useRef`.

4. **`MotionConfig reducedMotion="user"`** is set at the root layout — all `motion.*` components automatically respect OS reduced-motion preference.

5. **Mount animations:** standard pattern is `initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}` → `animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}` with `springs.moderate`.

---

## 14. KDS Rules That Apply Here

1. **Colors via CSS custom properties only** — never hardcode hex. Exceptions (with `var()` fallback) are acceptable only for brand colors not in the token system:
   ```tsx
   color: 'var(--color-tag-Green-text, #1e8a3c)'  // ✅ — fallback only
   color: '#1e8a3c'                                 // ❌
   ```

2. **Icons from `@strange-huge/icons` only** — never inline SVG. If an icon is missing from the library, stop and ask.

3. **`kaya-scrollbar` on every scrollable element** — adds thin 3px translucent scrollbar.

4. **`overscrollBehaviorY: 'contain'`** on every `overflowY: 'auto'` container — prevents scroll chaining.

5. **`isolation: 'isolate'`** on any component with descendant `z-index` values.

6. **No `overflow: hidden` without Figma verification** — don't clip things that aren't clipped in the spec.

---

## 15. Storybook Guide

Run: `npm run storybook` (default port 6007, may be 6006 if 6007 is in use).

Stories are at: **Templates → Brain**

| Story | What it shows |
|---|---|
| `Default` | Idle state with BrainHome |
| `Thinking` | StreamingIndicator in thinking phase |
| `Clarifying` | ClarificationCard replacing ChatInput |
| `Planning` | Full PlanCard with approve/counter/cancel |
| `PlanningWithConnector` | PlanCard with an unconnected Notion step |
| `Executing` | ActivityBlock mid-run |
| `Paused` | PauseCard |
| `NodeFailed` | NodeFailureCard (non-critical — has Skip button) |
| `NodeFailedCritical` | NodeFailureCard (critical — no Skip button) |
| `Streaming` | StreamingMessageBubble |
| `Complete` | Full output + LoopHistoryCard + ArtifactCard |
| `Cancelled` | LoopCancelledCard |
| `Failed` | LoopFailedCard |
| `ContextRailActive` | All three sections populated (persona + pins + connectors) |
| `FullInteractiveDemo` | 7-turn interactive demo — click through all phases |
| `Schedules` | ScheduleListView + ScheduleDetailView + modals |

The `FullInteractiveDemo` story is the best reference for understanding data shapes — it has realistic step arrays, connector data, clarification questions, and run history records.

---

## 16. TypeScript

The project has **3 pre-existing TypeScript errors** that are NOT in Brain components:
- `ChatInput/index.tsx` — `onChange` type mismatch
- `InputField/index.tsx` — `size` type mismatch
- `TabItem` — `data-state` property

These predate Brain work. Do not try to fix them — they'll be resolved separately. `tsc --noEmit` will report these; they won't block compilation.

---

## 17. Quick Reference: Wiring a New Phase

Template for adding a phase to your consumer:

```tsx
// 1. Define steps coming from backend
const [steps, setSteps] = useState<PlanStep[]>([])

// 2. In your BrainShell children, render based on phase
<BrainShell defaultPhase={phase} onSend={handleSend} contextRailData={railData}>
  {phase === 'thinking' && (
    <StreamingIndicator phase="thinking" />
  )}

  {phase === 'planning' && (
    <PlanCard
      steps={steps}
      interpretation="I'll research your competitors and draft a report."
      onApprove={() => transition('executing')}
      onCounter={() => { /* focus ChatInput */ }}
      onCancel={() => transition('cancelled')}
    />
  )}

  {phase === 'executing' && (
    <ActivityBlock
      steps={steps}
      interpretation="I'll research your competitors and draft a report."
    />
  )}

  {phase === 'paused' && (
    <PauseCard
      pausedAfterStep={lastCompletedStep?.label}
      onContinue={() => transition('executing')}
      onChangeDirection={() => { /* focus ChatInput */ }}
      onCancel={() => transition('cancelled')}
    />
  )}

  {phase === 'node-failed' && failedStep && (
    <NodeFailureCard
      step={failedStep}
      errorMessage="Connection timed out"
      onRerun={() => transition('executing')}
      onSkip={!failedStep.isCritical ? () => {
        updateStep(failedStep.id, 'skipped')
        transition('executing')
      } : undefined}
      onCancel={() => transition('cancelled')}
    />
  )}

  {phase === 'complete' && (
    <>
      <BrainResultHeader title="Competitor Analysis" timestamp={new Date()} />
      <StreamingMessageBubble content={output} isComplete={true} />
      <ArtifactCard title="Competitor Report" type="document" />
      <LoopHistoryCard steps={steps} completedAt={new Date()} />
    </>
  )}
</BrainShell>
```

---

*Last updated: 2026-05-18 by Chai (design) + Claude (implementation)*  
*Storybook stories are the living reference — when in doubt, open the Full Interactive Demo story.*
