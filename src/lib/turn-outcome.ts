import { extractThinkingContent } from '@/lib/parsers/content-parser'
import { EMPTY_TURN_MESSAGE } from '@/lib/model-error'
import type { UIMessage } from '@/types/chat'

// How a streamed assistant turn ends up once its stream is over. Pure on
// purpose: every terminal path in `useStreamingChat` (done, error, dropped
// connection) goes through `resolveTurnOutcome`, so they all agree on one rule —
// text the user already saw is never replaced by an error.

/** The stream closed without a `done` or `error` event and nothing was shown. */
export const INTERRUPTED_MESSAGE = 'Generation interrupted. Please retry.'
/** The model opened a leading <think> block and the stream ended inside it. */
export const INCOMPLETE_ANSWER_MESSAGE = 'The response ended before the answer was written. Please try again.'

/** `done`: the run finished. `ended`: the stream closed without a terminal
 *  event. `error`: a run error or a failed / dropped connection. */
export type TurnEnd = 'done' | 'ended' | 'error'

export interface TurnOutcomeInput {
  end: TurnEnd
  /** Every content delta of the turn, raw (may start with a <think> block). */
  rawContent: string
  /** Reasoning from the reasoning events, which wins over <think> text. */
  reasoningText?: string
  /** User-facing copy for an `error` end. */
  error?: string
  /** Something besides text is on screen: a structured block, image, file or prompt card. */
  hasOtherOutput: boolean
}

export type TurnOutcome = Pick<UIMessage, 'content' | 'thinking' | 'isError' | 'errorNotice'>

/**
 * Puts a failure where it belongs: with nothing on screen it becomes the
 * message itself (the full error treatment); otherwise the output stays and
 * the failure is an inline notice below it.
 */
export function placeErrorNotice(
  content: string,
  notice: string | undefined,
  hasOtherOutput: boolean,
): Pick<UIMessage, 'content' | 'isError' | 'errorNotice'> {
  if (!notice) return { content, isError: false, errorNotice: undefined }
  if (content.trim() || hasOtherOutput) return { content, isError: false, errorNotice: notice }
  return { content: notice, isError: true, errorNotice: undefined }
}

export function resolveTurnOutcome({
  end,
  rawContent,
  reasoningText,
  error,
  hasOtherOutput,
}: TurnOutcomeInput): TurnOutcome {
  const { visibleText, thinkingText, thinkingOpen } = extractThinkingContent(rawContent)
  const thinking = reasoningText || thinkingText || undefined
  const nothingShown = !visibleText && !hasOtherOutput

  const notice =
    end === 'error' ? error ?? INTERRUPTED_MESSAGE
    : thinkingOpen ? INCOMPLETE_ANSWER_MESSAGE
    : !nothingShown ? undefined
    : end === 'done' ? EMPTY_TURN_MESSAGE
    : INTERRUPTED_MESSAGE

  return { ...placeErrorNotice(visibleText, notice, hasOtherOutput), thinking }
}
