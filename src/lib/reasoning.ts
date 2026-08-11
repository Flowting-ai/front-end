import { mergeStreamingText } from '@/lib/streaming'

export type ReasoningSection = {
  heading: string
  body: string
  detail?: string
}

export type ReasoningTimelineItem =
  | {
      kind: 'reasoning'
      id: string
      content: string
      roundIndex?: number
    }
  | {
      kind: 'activity'
      id: string
      activityId: string
      roundIndex?: number
    }

export type ReasoningEventType =
  | 'reasoning'
  | 'reasoning_heading'
  | 'reasoning_body'

/** Append a reasoning delta to the current ordered stream segment. A tool
 * activity or a changed backend round starts a new segment, preventing words
 * and Markdown delimiters from separate model messages from being glued
 * together. */
export function appendReasoningTimeline(
  timeline: ReasoningTimelineItem[],
  incoming: string,
  newId: string,
  roundIndex?: number,
): ReasoningTimelineItem[] {
  if (!incoming) return timeline
  const last = timeline[timeline.length - 1]
  const sameRound = roundIndex === undefined || last?.roundIndex === undefined || last.roundIndex === roundIndex
  if (last?.kind === 'reasoning' && sameRound) {
    const content = mergeStreamingText(last.content, incoming)
    if (content === last.content) return timeline
    return [...timeline.slice(0, -1), { ...last, content }]
  }
  return [...timeline, { kind: 'reasoning', id: newId, content: incoming, roundIndex }]
}

export function appendActivityTimeline(
  timeline: ReasoningTimelineItem[],
  activityId: string,
  newId: string,
  roundIndex?: number,
): ReasoningTimelineItem[] {
  if (timeline.some((item) => item.kind === 'activity' && item.activityId === activityId)) return timeline
  return [...timeline, { kind: 'activity', id: newId, activityId, roundIndex }]
}

export function replaceTimelineActivityId(
  timeline: ReasoningTimelineItem[],
  previousId: string,
  nextId: string,
): ReasoningTimelineItem[] {
  if (previousId === nextId) return timeline
  return timeline.map((item) =>
    item.kind === 'activity' && item.activityId === previousId
      ? { ...item, activityId: nextId }
      : item,
  )
}

export function reasoningEventText(data: Record<string, unknown>): string {
  return typeof data.content === 'string' ? data.content
    : typeof data.delta === 'string' ? data.delta
    : ''
}

export function cleanReasoningHeading(heading: string): string {
  return heading
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/…$/, '')
    .trim()
    .replace(/^\*\*([\s\S]*?)\*\*$/, '$1')
    .trim()
}

// Prod backend hotfix: older builds don't emit reasoning_heading/reasoning_body
// events (or persist reasoning_sections), so titled summary blocks arrive inline
// in the raw reasoning text as bold-only or ATX-heading lines. Mirror the
// backend's split_reasoning so the client can reconstruct the collapsible
// sections instead of rendering raw `**Title**` markers.
export function reasoningSectionTitle(line: string): string | null {
  const s = line.trim()
  if (s.startsWith('#')) {
    const hashes = s.length - s.replace(/^#+/, '').length
    const rest = s.slice(hashes)
    if (hashes <= 4 && rest.startsWith(' ')) return rest.trim() || null
    return null
  }
  if (s.startsWith('**') && s.endsWith('**') && s.length > 4 && !s.slice(2, -2).includes('**')) {
    return s.slice(2, -2).trim() || null
  }
  return null
}

// Reasoning models (e.g. gpt-5.5) frequently glue a section title to the end of
// the previous paragraph — `…from there.**Creating a CSV file**\n\n…` — with no
// newline before the `**`. The backend's line-based split_reasoning only detects
// titles that occupy a whole line, so every glued title stays buried in the body
// (a single giant section). Break a bold span onto its own line when it is glued
// to preceding non-space text and immediately followed by a newline or end of
// text, so the line-based classifier below can pick it up. Inline emphasis like
// `I need **one** thing` is untouched — it is not followed by a newline.
// Capture the preceding non-space char (group 1) rather than using a lookbehind,
// which older Safari (<16.4) rejects at parse time.
const INLINE_TITLE_RE = /(\S)(\*\*[^*\n]+\*\*)(?=[ \t]*(?:\n|$))/g

function separateInlineTitles(text: string): string {
  return text.replace(INLINE_TITLE_RE, '$1\n$2')
}

export function splitReasoningText(text: string): ReasoningSection[] {
  if (!text || !text.trim()) return []

  const sections: ReasoningSection[] = []
  let heading = ''
  let body: string[] = []

  const flush = () => {
    const joined = body.join('\n').trim()
    if (heading || joined) sections.push({ heading, body: joined })
    heading = ''
    body = []
  }

  for (const line of separateInlineTitles(text).split('\n')) {
    const title = reasoningSectionTitle(line)
    if (title === null) body.push(line)
    else {
      flush()
      heading = title
    }
  }
  flush()
  return sections
}

// Reconstruct the source reasoning text from persisted/streamed sections so it can
// be re-split. Strips any `**` already on the heading before re-wrapping.
function sectionsToText(sections: ReasoningSection[]): string {
  return sections
    .map((s) => {
      const h = cleanReasoningHeading(s.heading)
      return h ? `**${h}**\n\n${s.body}` : s.body
    })
    .join('\n\n')
}

// Turn whatever reasoning we have into clean collapsible sections. Always re-split
// so the backend's under-split output (one section with glued titles in its body)
// gets corrected — prefer the raw text when present (most complete), else rebuild
// it from the sections. Falls back to the original sections / [] when no genuine
// heading is found, so plain unstructured reasoning still renders as raw text.
export function deriveReasoningSections(
  sections: ReasoningSection[],
  text: string,
): ReasoningSection[] {
  const source = text.trim() ? text : sectionsToText(sections)
  const split = splitReasoningText(source)
  const hasHeading = split.some((s) => cleanReasoningHeading(s.heading).length > 2)
  if (hasHeading) return split
  return sections.length > 0 ? sections : []
}

export function normalizeReasoningSections(value: unknown): ReasoningSection[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const section = entry as Record<string, unknown>
    const heading = typeof section.heading === 'string' ? section.heading : ''
    const body = typeof section.body === 'string' ? section.body : ''
    const detail = typeof section.detail === 'string' ? section.detail : undefined
    return cleanReasoningHeading(heading) ? [{ heading, body, ...(detail ? { detail } : {}) }] : []
  })
}

// ── Shared stream accumulator ─────────────────────────────────────────────────
// The single place reasoning SSE events turn into renderable state. Transport
// agnostic on purpose: chat drives it from `useStreamingChat`'s XHR loop, Brain
// from its own `readBrainStream` consumer, and both hand the same snapshot to
// `ReasoningContent`. Anything added here shows up on both surfaces at once.

export type ReasoningSnapshot = {
  text: string
  sections: ReasoningSection[]
  timeline: ReasoningTimelineItem[]
}

export type ReasoningAccumulator = {
  text(): string
  sections(): ReasoningSection[]
  timeline(): ReasoningTimelineItem[]
  snapshot(): ReasoningSnapshot
  isEmpty(): boolean
  event(type: ReasoningEventType, content: string, roundIndex?: number): void
  step(section: ReasoningSection, index?: number): void
  activity(activityId: string, roundIndex?: number): void
  renameActivity(previousId: string, nextId: string): void
}

export function eventRoundIndex(data: Record<string, unknown>): number | undefined {
  return typeof data.round_index === 'number' ? data.round_index : undefined
}

export function createReasoningAccumulator(): ReasoningAccumulator {
  let text = ''
  let timeline: ReasoningTimelineItem[] = []
  let sequence = 0
  const committed: ReasoningSection[] = []
  const previewSteps = new Map<number, ReasoningSection>()
  let heading = ''
  let body = ''

  // Both caches exist for referential stability, not speed: consumers feed these
  // arrays straight into React state and `useMemo` deps, so rebuilding them on
  // every token would re-run the (O(n) over the whole transcript) section
  // derivation on each frame. A plain `reasoning` delta leaves the sections
  // untouched, so only the snapshot is invalidated there.
  let cachedSections: ReasoningSection[] | null = null
  let cachedSnapshot: ReasoningSnapshot | null = null

  const nextId = (kind: ReasoningTimelineItem['kind']) => {
    const id = `${kind}-${sequence}`
    sequence += 1
    return id
  }

  const appendDelta = (incoming: string, roundIndex?: number) => {
    timeline = appendReasoningTimeline(timeline, incoming, nextId('reasoning'), roundIndex)
    text = timeline
      .flatMap((item) => item.kind === 'reasoning' ? [item.content] : [])
      .join('\n\n')
    cachedSnapshot = null
  }

  const invalidateSections = () => {
    cachedSections = null
    cachedSnapshot = null
  }

  const sections = (): ReasoningSection[] => {
    if (cachedSections) return cachedSections
    if (previewSteps.size > 0) {
      cachedSections = [...previewSteps.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, section]) => section)
      return cachedSections
    }
    const out = [...committed]
    if (heading) out.push({ heading, body })
    cachedSections = out
    return out
  }

  return {
    text: () => text,
    sections,
    timeline: () => timeline,
    snapshot: () => {
      if (!cachedSnapshot) cachedSnapshot = { text, sections: sections(), timeline }
      return cachedSnapshot
    },
    isEmpty: () => !text,

    event(type, content, roundIndex) {
      if (!content) return

      if (type === 'reasoning') {
        appendDelta(content, roundIndex)
        return
      }

      if (type === 'reasoning_heading') {
        // Re-sent headings are common on reconnect; committing the same one
        // twice would duplicate the section and its timeline segment.
        if (heading === content) return
        if (heading) committed.push({ heading, body })
        heading = content
        body = ''
        invalidateSections()
        // Mirrored into the timeline as a markdown title so the segment-level
        // re-split in TimelineReasoningStep recognises it as a step heading
        // rather than burying it in the body as plain text.
        appendDelta(`**${cleanReasoningHeading(content)}**\n\n`, roundIndex)
        return
      }

      body = mergeStreamingText(body, content)
      invalidateSections()
      appendDelta(content, roundIndex)
    },

    step(section, index) {
      previewSteps.set(index ?? previewSteps.size, section)
      invalidateSections()
    },

    activity(activityId, roundIndex) {
      timeline = appendActivityTimeline(timeline, activityId, nextId('activity'), roundIndex)
      cachedSnapshot = null
    },

    renameActivity(previousId, replacementId) {
      timeline = replaceTimelineActivityId(timeline, previousId, replacementId)
      cachedSnapshot = null
    },
  }
}
