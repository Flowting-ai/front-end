// Brain phase machine — pure logic, no JSX, no imports.
// Components render based on this state; this file never renders anything.

export type Phase =
  | 'idle'
  | 'user-sent'
  | 'thinking'           // Brain processes the user message or a clarification answer — always the first step
  | 'clarifying-goal'    // Brain decided it needs more info — shows QuestionCard (max 3 questions)
  | 'souvenir'           // CONDITIONAL — Brain searching Pinboard for relevant context
  | 'confirming-pins'    // Brain surfaced relevant pins — user confirms which to include
  | 'executing'          // An agent Brain rallied with is working; ActivityBlock live
  | 'paused'             // User hit stop. PauseCard shown.
  | 'stuck'              // Brain cannot proceed without human input — StuckCard shown.
  | 'streaming'          // Output streaming into thread
  | 'complete'           // Loop finished. LoopHistoryCard shown. Resets to idle.
  | 'cancelled'          // User cancelled at the PauseCard
  | 'failed'             // Unrecoverable failure (all retries exhausted)

// What renders in the thread for each phase
export const PHASE_RENDERS: Record<Phase, string> = {
  'idle':             'ChatInput only. Suggestion cards on Brain Home.',
  'user-sent':        'User message bubble. Transitions immediately to thinking.',
  'thinking':         'StreamingIndicator "thinking". Brain decides: ask more, search Pinboard, or plan.',
  'clarifying-goal':  'ClarificationCard (QuestionCard wrapper). After answer → back to thinking.',
  'souvenir':         'StreamingIndicator "souvenir" phase. Pinboard search in progress.',
  'confirming-pins':  'PinConfirmationCard inline. User selects which pins to include.',
  'executing':        'ActivityBlock with a live row per rallied agent. Stop button in ChatInput.',
  'paused':           'PauseCard: Continue / Change direction / Cancel.',
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
//   thinking  → clarifying-goal | souvenir | executing | streaming (Brain decides)
//   clarifying-goal → thinking (always — Brain re-evaluates after each answer)
//
export const PHASE_TRANSITIONS: Record<Phase, Phase[]> = {
  'idle':            ['user-sent'],
  'user-sent':       ['thinking'],
  'thinking':        ['clarifying-goal', 'souvenir', 'executing', 'streaming'],
  'clarifying-goal': ['thinking'],                       // always back to thinking after each answer
  'souvenir':        ['confirming-pins', 'executing', 'streaming'],
  'confirming-pins': ['executing', 'streaming'],
  'executing':       ['streaming', 'paused', 'stuck', 'failed'],
  'paused':          ['executing', 'cancelled'],
  'stuck':           ['executing', 'cancelled'],               // User provides context → executing; Cancel → cancelled
  'streaming':       ['complete'],
  'complete':        ['idle'],
  'cancelled':       ['idle'],
  'failed':          ['idle'],
}

export interface StreamCloseState {
  phase:                 Phase
  terminalEventReceived: boolean
  streamErrored:         boolean
  aborted:               boolean
}

/**
 * Safety net for a stream that closed cleanly while the phase machine is still
 * mid-flight: React may not have committed the transition the last event
 * triggered. Only a turn that reached its terminal event may be completed here.
 */
export function shouldCompleteStreamOnClose({
  phase,
  terminalEventReceived,
  streamErrored,
  aborted,
}: StreamCloseState): boolean {
  if (!terminalEventReceived || streamErrored || aborted) return false
  return phase === 'thinking' || phase === 'streaming' || phase === 'executing'
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

// AgentStep — one rallied agent's row, rendered by ActivityBlock (live) and
// LoopHistoryCard (after the turn).
export type StepStatus = 'pending' | 'upcoming' | 'executing' | 'complete' | 'failed' | 'skipped'

export interface ConnectorRequirement {
  name:         string
  logoUrl?:     string
  description?: string
  isConnected:  boolean
  onConnect?:   () => void
}

export interface AgentStep {
  id:                  string              // the agent's name — one row per agent
  label:               string
  handle?:             string
  imageUrl?:           string
  isCritical:          boolean
  status:              StepStatus
  /** Present when the agent stopped before producing a complete answer. */
  error?:               string
  requiresConnector?:  ConnectorRequirement
  /** What Brain asked this agent for. */
  rationale?:          string
  /** Connectors the agent has reached — shown as "via X" chips once touched. */
  connectorDisclosure?: string[]
  /** Live detail shown while the agent is working. */
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
  agents?:          AgentStep[]
  output?:          string
  status:           'clarifying' | 'confirming-pins' | 'executing' | 'paused' | 'streaming' | 'complete' | 'failed' | 'cancelled'
}
