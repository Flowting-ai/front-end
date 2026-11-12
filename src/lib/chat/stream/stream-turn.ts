import { stopActiveActivities } from "@/lib/activity"
import { createReasoningAccumulator, type ReasoningAccumulator } from "@/lib/reasoning"
import { resolveTurnOutcome, type TurnEnd } from "@/lib/turn-outcome"
import type { UIMessage } from "@/types/chat"
import { updateMessage } from "./message-patches"

/** What the event handlers need from the hook. Everything that reaches React
 *  state or the outside world goes through here. */
export interface StreamEventContext {
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  /** Batches streamed fields for the reply (see useStreamingChat's queueUpdate). */
  queueUpdate: (fields: Partial<UIMessage>, immediate?: boolean) => void
  /** Commits batched fields into `messages` now. */
  flushPending: () => void
  /** The reply's current id: the temp loading id, then the saved id after message_saved. */
  messageId: () => string | null
  /** Points the reply at its saved id (state is updated separately). */
  setMessageId: (id: string) => void
  /** The optimistic user message, whose attachments get their real links. */
  userMessageId: () => string | null
  chatId: () => string | null
  adoptChatId: (chatId: string) => void
  /** RUN_STARTED arrived. */
  onRunStarted: () => void
  onTitleUpdate?: (chatId: string, title: string) => void
  onChatMoveToTop?: (chatId: string) => void
  /** The send's auto-save answer (undefined when it didn't say). */
  saveToLibrary: boolean | undefined
}

/** One turn's bookkeeping, shared by the event handlers and the hook. */
export interface StreamTurn {
  assistantContent: string
  reasoning: ReasoningAccumulator
  streamFinished: boolean
  /** The turn ended with an error (shown as the reply or as a notice below it). */
  turnFailed: boolean
  terminalErrorSeen: boolean
  /** Keeps `done` from overwriting a title already set by the `title` event. */
  titleWasSet: boolean
  receivedRenderableOutput: boolean
  /** toolName → activityId, so tool_progress events find the activity
   *  created by the preceding tool_executing event. */
  toolCallIdByName: Map<string, string>
  /** Activity id → the image hints last applied, so streamed argument chunks
   *  only re-render the preview when its prompt or shape actually grew. */
  imageHintsSeen: Map<string, string>
  /** Tool names that errored — tool_complete still fires right after tool_error,
   *  so this stops it from clobbering the "error" status back to "done". */
  erroredToolNames: Set<string>
  /** Agent name → its open activity row, between agent_started and agent_finished. */
  agentActivityIds: Map<string, string>
  /** Prompt cards already marked in the reasoning trace (events can repeat). */
  promptMarkerIds: Set<string>
  /** Reasoning time behind the "Thought for Ns" label: from the turn's first
   *  reasoning to its first answer token, or to the end of the turn. */
  reasoningStartedAt: number | null
  reasoningDurationMs: number | undefined
}

/** `priorContent` is what earlier stretches of the same run wrote; this turn's text is added after it. */
export function createStreamTurn(priorContent = ""): StreamTurn {
  return {
    assistantContent: priorContent ? `${priorContent}\n\n` : "",
    reasoning: createReasoningAccumulator(),
    streamFinished: false,
    turnFailed: false,
    terminalErrorSeen: false,
    titleWasSet: false,
    receivedRenderableOutput: false,
    toolCallIdByName: new Map(),
    imageHintsSeen: new Map(),
    erroredToolNames: new Set(),
    agentActivityIds: new Map(),
    promptMarkerIds: new Set(),
    reasoningStartedAt: null,
    reasoningDurationMs: undefined,
  }
}

export function startReasoningClock(turn: StreamTurn) {
  if (turn.reasoningStartedAt === null && turn.reasoningDurationMs === undefined) turn.reasoningStartedAt = Date.now()
}

export function stopReasoningClock(turn: StreamTurn): Pick<UIMessage, "reasoningDurationMs"> {
  if (turn.reasoningStartedAt !== null && turn.reasoningDurationMs === undefined) {
    turn.reasoningDurationMs = Date.now() - turn.reasoningStartedAt
  }
  return turn.reasoningDurationMs === undefined ? {} : { reasoningDurationMs: turn.reasoningDurationMs }
}

/**
 * Every way the turn ends goes through here, so text the user has already
 * seen is never replaced by an error (see resolveTurnOutcome). Reasoning is
 * finalised either way; tools still running on an early end are marked stopped.
 */
export function finishTurn(ctx: StreamEventContext, turn: StreamTurn, end: TurnEnd, error?: string) {
  ctx.flushPending()
  turn.streamFinished = true
  const msgId = ctx.messageId()
  if (!msgId) return
  const outcome = resolveTurnOutcome({
    end,
    rawContent: turn.assistantContent,
    reasoningText: turn.reasoning.text(),
    error,
    hasOtherOutput: turn.receivedRenderableOutput,
  })
  if (outcome.isError || outcome.errorNotice) turn.turnFailed = true
  const sections = turn.reasoning.sections()
  const timeline = turn.reasoning.timeline()
  const duration = stopReasoningClock(turn)
  ctx.setMessages(updateMessage(msgId, (msg) => ({
    ...msg,
    ...outcome,
    ...duration,
    isThinkingInProgress: false,
    isLoading: false,
    ...(end === "done"
      ? { stoppedByUser: false }
      : { activities: stopActiveActivities(msg.activities) }),
    reasoning_sections: sections.length > 0 ? sections : undefined,
    reasoningTimeline: timeline.length > 0 ? timeline : undefined,
  })))
}
