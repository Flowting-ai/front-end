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
