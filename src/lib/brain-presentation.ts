import type { AgentStep } from '@/templates/Brain/lib/phase'
import type { BrainTimelineItem } from '@/templates/Brain'

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
