import { parseContentSegments } from '@/lib/content-parser'

// The pacing behind the assistant answer's word-by-word reveal. The component
// steps it on animation frames, at most every REVEAL_STEP_MS; everything here is
// pure so the pacing can be tested without a DOM or a clock.

/** While streaming, the backlog drains with this time constant: the reveal
 *  trails steady output by roughly this long and catches up on a burst of
 *  about 2,000 characters within a second. */
export const REVEAL_CATCH_UP_MS = 200
/** Floor on the reveal speed so a small backlog doesn't crawl (chars per ms). */
export const REVEAL_MIN_CHARS_PER_MS = 0.25
/** Once the stream is done, whatever is still hidden appears within this long. */
export const REVEAL_DRAIN_MS = 300
/** Minimum time between visible steps (~30 per second): each one re-renders the
 *  whole message, so stepping on every frame would double the work for no gain. */
export const REVEAL_STEP_MS = 33

export interface RevealStep {
  /** What is on screen now. */
  displayed: string
  /** Everything received so far. */
  target: string
  /** Time since the previous step. */
  elapsedMs: number
  /** Time left before the post-stream deadline; `undefined` while still streaming. */
  drainMsLeft?: number
}

const WORD = /\s*\S+\s*/y
// A trailing `<…` with no `>` may be the first characters of a widget tag.
const PARTIAL_TAG = /<[^\s<>]*$/

/**
 * The text to show on the next frame.
 *
 * - Reveals whole words, as many as the frame's budget allows. The budget is
 *   proportional to the backlog, with a floor, so the reveal speeds up when it
 *   falls behind instead of trailing the stream by seconds.
 * - After the stream ends (`drainMsLeft` set) the rest is spread evenly over
 *   the time left and is all shown by the deadline.
 * - A structured widget (`<table>…</table>` etc.) is never cut part-way: once
 *   its closing tag has arrived it appears whole; until then the reveal stops
 *   just after the opening tag, so its skeleton shows, and waits.
 * - If the target no longer extends what is shown, it jumps straight to it.
 */
export function nextReveal({ displayed, target, elapsedMs, drainMsLeft }: RevealStep): string {
  if (displayed === target) return displayed
  if (!target.startsWith(displayed)) return target

  const draining = drainMsLeft !== undefined
  if (draining && drainMsLeft <= elapsedMs) return target

  const backlog = target.length - displayed.length
  const budget = draining
    ? Math.ceil((backlog * elapsedMs) / drainMsLeft)
    : Math.max(Math.ceil((backlog * elapsedMs) / REVEAL_CATCH_UP_MS), Math.ceil(REVEAL_MIN_CHARS_PER_MS * elapsedMs))

  // Mid-stream, hold back a trailing partial tag rather than flash `<tab` as text.
  const partialTag = draining ? null : PARTIAL_TAG.exec(target)
  const limit = partialTag ? partialTag.index : target.length

  let end = displayed.length
  while (end < limit && end - displayed.length < budget) {
    WORD.lastIndex = end
    const word = WORD.exec(target)
    end = word ? Math.min(word.index + word[0].length, limit) : limit
  }
  if (end <= displayed.length) return displayed

  const candidate = target.slice(0, end)
  if (!candidate.includes('<')) return candidate

  // The candidate is a prefix, so an unclosed widget in it may still complete.
  const segments = parseContentSegments(candidate, { streaming: true })
  const last = segments[segments.length - 1]
  if (last?.type !== 'pending') return candidate

  // The step ends inside a widget: show all of it once complete, else stop
  // after its opening tag (or before the tag while the tag itself is partial).
  // Judged against the whole target: text that only looked like an open widget
  // in the shorter candidate (e.g. XML in a code fence that closes later, or a
  // block the finished stream never closed) is revealed like any other text.
  const widget = parseContentSegments(target, { streaming: !draining }).find((segment) => segment.start === last.start)
  if (!widget || widget.type === 'markdown' || widget.type === 'incomplete') return candidate
  if (widget.type !== 'pending') return target.slice(0, widget.end)
  const openTagEnd = target.indexOf('>', last.start)
  const stop = openTagEnd === -1 ? last.start : openTagEnd + 1
  return stop > displayed.length ? target.slice(0, stop) : displayed
}
