import { mergeStreamingText } from '@/lib/streaming'

export type ReasoningSection = {
  heading: string
  body: string
}

export type ReasoningEventType =
  | 'reasoning'
  | 'reasoning_heading'
  | 'reasoning_body'

export type ReasoningStreamState = {
  text: string
  sections: ReasoningSection[]
}

export function createReasoningState(
  text = '',
  sections: ReasoningSection[] = [],
): ReasoningStreamState {
  return { text, sections }
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
    return cleanReasoningHeading(heading) ? [{ heading, body }] : []
  })
}

export function appendReasoningEvent(
  state: ReasoningStreamState,
  type: ReasoningEventType,
  incoming: string,
): ReasoningStreamState {
  if (!incoming) return state

  if (type === 'reasoning') {
    return {
      ...state,
      text: mergeStreamingText(state.text, incoming),
    }
  }

  if (type === 'reasoning_heading') {
    const last = state.sections[state.sections.length - 1]
    if (last && last.heading === incoming) return state

    return {
      ...state,
      sections: [...state.sections, { heading: incoming, body: '' }],
    }
  }

  const lastIndex = state.sections.length - 1
  if (lastIndex < 0) {
    return {
      ...state,
      text: mergeStreamingText(state.text, incoming),
    }
  }

  const current = state.sections[lastIndex]
  const mergedBody = mergeStreamingText(current.body, incoming)
  if (mergedBody === current.body) return state

  const sections = state.sections.slice()
  sections[lastIndex] = { ...current, body: mergedBody }
  return { ...state, sections }
}
