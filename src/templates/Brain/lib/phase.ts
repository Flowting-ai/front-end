// Brain phase machine — pure logic, no JSX, no imports.
// Components render based on this state; this file never renders anything.

export type Phase =
  | 'idle'
  | 'user-sent'
  | 'thinking'           // Brain processes the user message or a clarification answer — always the first step
  | 'clarifying-goal'    // Brain decided it needs more info — shows QuestionCard (max 3 questions)
  | 'souvenir'           // CONDITIONAL — Brain searching Pinboard for relevant context
  | 'confirming-pins'    // Brain surfaced relevant pins — user confirms which to include
  | 'planning'           // PlanCard rendered, awaiting approve / counter / cancel
  | 'executing'          // ActivityBlock running, stop button live
  | 'paused'             // User hit stop. Brain finished current node. PauseCard shown.
  | 'node-failed'        // A plan step failed. NodeFailureCard shown inline.
  | 'fix-proposed'       // Brain self-diagnosed the failure — FixProposalCard shown. Apply → executing; Cancel → cancelled.
  | 'stuck'              // Brain cannot proceed without human input — StuckCard shown.
  | 'streaming'          // Output streaming into thread
  | 'complete'           // Loop finished. LoopHistoryCard shown. Resets to idle.
  | 'cancelled'          // User cancelled at PlanCard or PauseCard
  | 'failed'             // Unrecoverable failure (all retries exhausted)

// What renders in the thread for each phase
export const PHASE_RENDERS: Record<Phase, string> = {
  'idle':             'ChatInput only. Suggestion cards on Brain Home.',
  'user-sent':        'User message bubble. Transitions immediately to thinking.',
  'thinking':         'StreamingIndicator "thinking". Brain decides: ask more, search Pinboard, or plan.',
  'clarifying-goal':  'ClarificationCard (QuestionCard wrapper). After answer → back to thinking.',
  'souvenir':         'StreamingIndicator "souvenir" phase. Pinboard search in progress.',
  'confirming-pins':  'PinConfirmationCard inline. User selects which pins to include.',
  'planning':         'PlanCard with approve / counter / cancel.',
  'executing':        'ActivityBlock with live step states. Stop button in ChatInput.',
  'paused':           'PauseCard: Continue / Change direction / Cancel.',
  'node-failed':      'NodeFailureCard inline: Re-run / [Skip if non-critical] / Cancel.',
  'fix-proposed':     'FixProposalCard: Brain self-diagnosed failure. Apply fix → executing; Try different / Cancel → cancelled.',
  'stuck':            'StuckCard: Brain cannot proceed. User provides context → back to executing; Cancel → cancelled.',
  'streaming':        'StreamingMessageBubble. StreamingIndicator "streaming" phase.',
  'complete':         'Full output + ArtifactCard + ExternalOutputCard + LoopHistoryCard.',
  'cancelled':        'No thread component. Loop ends cleanly, session resets to idle.',
  'failed':           'Toast notification only. No thread component — resets to idle.',
}

// Valid transitions — what can follow each phase
//
// Key flow:
//   user-sent → thinking (always)
//   thinking  → clarifying-goal | souvenir | planning (Brain decides)
//   clarifying-goal → thinking (always — Brain re-evaluates after each answer)
//   souvenir  → confirming-pins | planning
//
export const PHASE_TRANSITIONS: Record<Phase, Phase[]> = {
  'idle':            ['user-sent'],
  'user-sent':       ['thinking'],
  'thinking':        ['clarifying-goal', 'souvenir', 'planning'],
  'clarifying-goal': ['thinking'],                       // always back to thinking after each answer
  'souvenir':        ['confirming-pins', 'planning'],
  'confirming-pins': ['planning'],
  'planning':        ['executing', 'cancelled'],
  'executing':       ['streaming', 'paused', 'node-failed', 'stuck', 'failed'],
  'paused':          ['executing', 'planning', 'cancelled'],
  'node-failed':     ['executing', 'fix-proposed', 'stuck', 'cancelled'], // Re-run → executing, Brain diagnoses → fix-proposed, stuck for ambiguous failures
  'fix-proposed':    ['executing', 'cancelled'],               // Apply fix → executing, Cancel/Try different → cancelled
  'stuck':           ['executing', 'cancelled'],               // User provides context → executing; Cancel → cancelled
  'streaming':       ['complete'],
  'complete':        ['idle'],
  'cancelled':       ['idle'],
  'failed':          ['idle'],
}

export interface PlannerStreamCloseState {
  phase:                  Phase
  terminalEventReceived: boolean
  streamErrored:         boolean
  aborted:               boolean
  planProposed:          boolean
  waitingForApproval:    boolean
}

/**
 * The AG-UI wrapper closes a successful planner stream with RUN_FINISHED even
 * when that turn ended by proposing a plan. React may not have committed the
 * preceding `setPhase('planning')` yet, so `phase` alone is not authoritative
 * here. The synchronous proposal/approval flags prevent the close safety net
 * from converting a valid pending plan into a completed turn.
 */
export function shouldCompletePlannerStreamOnClose({
  phase,
  terminalEventReceived,
  streamErrored,
  aborted,
  planProposed,
  waitingForApproval,
}: PlannerStreamCloseState): boolean {
  if (!terminalEventReceived || streamErrored || aborted) return false
  if (planProposed || waitingForApproval) return false
  return phase === 'thinking' || phase === 'streaming'
}

// Clarification question types
export type ClarificationType = 'ambiguity' | 'depth' | 'permission'

export interface ClarificationItem {
  type:      ClarificationType
  question:  string
  answer?:   string   // undefined if skipped
  skipped:   boolean
}

// Two consecutive skips = Brain proceeds regardless
export function shouldProceedDespiteSkip(clarifications: ClarificationItem[]): boolean {
  if (clarifications.length < 2) return false
  const last2 = clarifications.slice(-2)
  return last2.every(c => c.skipped)
}

// PlanStep — shared by PlanCard (preview) and ActivityBlock (live execution)
export type StepStatus = 'pending' | 'upcoming' | 'executing' | 'complete' | 'failed' | 'skipped'

export interface ConnectorRequirement {
  name:         string
  logoUrl?:     string
  description?: string
  isConnected:  boolean
  onConnect?:   () => void
}

export interface PlanStep {
  id:                  string
  label:               string
  modelId?:            string
  modelName?:          string
  modelCompany?:       string
  connector?:          string              // display name, e.g. "Notion"
  isCritical:          boolean             // true → failure shows Re-run/Cancel only (no Skip)
  status:              StepStatus
  requiresConnector?:  ConnectorRequirement
  parallelGroup?:      string              // steps sharing the same string execute simultaneously
  rationale?:          string              // optional 1-sentence explanation of why Brain included this step
  /** Connectors Brain has called for this step — shown as "via X" chips once touched. */
  connectorDisclosure?: string[]
  /** Live streaming detail shown while the step is executing. */
  streamDetail?:        string
}

// Loop — one task submission within a Thread
export interface Loop {
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
  output?:          string
  status:           'clarifying' | 'confirming-pins' | 'planning' | 'executing' | 'paused' | 'streaming' | 'complete' | 'failed' | 'cancelled'
}
