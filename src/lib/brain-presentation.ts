import type { AgentStep } from '@/templates/Brain/lib/phase'
import type { BrainTimelineItem } from '@/templates/Brain'
import type { ActivityItem } from '@/hooks/use-chat-state'
import type { ToolCallPreview, ToolProgressEvent, WebSearchEvent } from '@/lib/api/brain'
import { normalizeActivityStatus, toolNameToType, webSearchResults } from '@/lib/activity'

export interface PromptIdentity {
  request_id: string
}

/** Keep blocking prompts in arrival order and dedupe stream replays by id. */
export function enqueuePrompt<T extends PromptIdentity>(queue: T[], prompt: T): T[] {
  return queue.some((item) => item.request_id === prompt.request_id)
    ? queue
    : [...queue, prompt]
}

/** Retire only the prompt the server resolved/expired; the next item is promoted. */
export function retirePrompt<T extends PromptIdentity>(queue: T[], promptId: string): T[] {
  return queue.filter((item) => item.request_id !== promptId)
}

/** Build the expandable execution timeline from the turn's rallied agents. */
export function agentTimelineItems(
  steps: AgentStep[],
  agentOutputs: Record<string, string> = {},
): BrainTimelineItem[] {
  return steps.map((step) => {
    const output = agentOutputs[step.id]?.trim()
    const details = step.error
      ? [output, step.error].filter(Boolean).join('\n\n')
      : output || undefined
    if (step.status === 'failed') {
      return {
        id: step.id,
        label: step.label,
        variant: 'error' as const,
        result: { label: 'Failed', details, variant: 'error' as const },
      }
    }
    if (step.status === 'skipped') {
      return {
        id: step.id,
        label: step.label,
        result: { label: 'Skipped', details, variant: 'default' as const },
      }
    }
    if (step.status === 'complete') {
      return {
        id: step.id,
        label: step.label,
        result: { label: 'Completed', details, variant: 'success' as const },
      }
    }
    return { id: step.id, label: step.label }
  })
}

/**
 * Converts a raw tool slug to a human-readable display name.
 * Handles both SCREAMING_SNAKE_CASE connector slugs (GMAIL_SEND_EMAIL)
 * and lowercase snake_case tool names (gmail_send_email).
 *   GMAIL_SEND_EMAIL → Gmail: Send Email
 *   run_connector_tool → run connector tool
 */
export function formatToolSlug(slug: string): string {
  if (!slug) return 'Tool'
  // SCREAMING_SNAKE → treat first segment as service, rest as action
  if (/^[A-Z][A-Z0-9_]+$/.test(slug)) {
    const parts = slug.split('_')
    const service = parts[0].charAt(0) + parts[0].slice(1).toLowerCase()
    const action  = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
    return action ? `${service}: ${action}` : service
  }
  // lowercase_snake → space-separated
  return slug.replace(/_/g, ' ')
}

/**
 * One mid-stream side effect of a Brain turn: a web search, a tool call and its
 * status, or a progress ping from a long-running tool. `label` carries a
 * pre-formatted display name for rows rebuilt from persisted history, where the
 * raw slug alone doesn't say what happened (`web_read` → "Read: example.com").
 */
export type BrainActivityFeedItem =
  | { kind: 'web_search'; data: WebSearchEvent;    id: string }
  | { kind: 'progress';   data: ToolProgressEvent; id: string }
  | {
      kind:   'tool'
      data:   ToolCallPreview
      id:     string
      status: 'streaming' | 'executing' | 'complete' | 'failed'
      label?: string
    }

/**
 * Brain stream event → the `ActivityItem` Chat's `ActivityRow` renders, so both
 * surfaces show the same per-tool icon, verb, spinner→checkmark transition and
 * auto-expanded web-search results instead of Brain's own flat label rows.
 */
export function brainActivityItem(item: BrainActivityFeedItem): ActivityItem {
  if (item.kind === 'web_search') {
    return {
      id:      item.id,
      type:    'web-search',
      detail:  item.data.query,
      // The event is emitted with its links, i.e. after the search resolved.
      status:  'done',
      results: webSearchResults(item.data.links, item.data.results),
    }
  }

  if (item.kind === 'progress') {
    const tool = item.data.tool ?? ''
    return {
      id:              item.id,
      type:            toolNameToType(tool),
      toolName:        tool,
      label:           item.data.label ?? undefined,
      detail:          item.data.label ?? item.data.message ?? formatToolSlug(tool),
      status:          normalizeActivityStatus(item.data.status),
      progressMessage: item.data.message ?? undefined,
      codePreview:     item.data.code_preview ?? undefined,
      filename:        item.data.filename || undefined,
      durationS:       item.data.elapsed_seconds ?? undefined,
      percent:         item.data.percent ?? undefined,
    }
  }

  const name = item.data.name ?? ''
  return {
    id:       item.id,
    type:     toolNameToType(name),
    toolName: name,
    detail:   item.label ?? formatToolSlug(name),
    // 'streaming' is the model still writing the call's arguments — in-flight,
    // so it spins like 'executing' rather than reading as finished.
    status:   normalizeActivityStatus(item.status),
  }
}

export function executionPhaseTitle(steps: AgentStep[]): string {
  const complete = steps.filter((step) => step.status === 'complete').length
  const skipped = steps.filter((step) => step.status === 'skipped').length
  const failed = steps.filter((step) => step.status === 'failed').length
  const parts = [
    complete > 0 ? `${complete} completed` : '',
    skipped > 0 ? `${skipped} skipped` : '',
    failed > 0 ? `${failed} failed` : '',
  ].filter(Boolean)
  return parts.length > 0 ? `Agents — ${parts.join(' · ')}` : 'Agent details'
}
