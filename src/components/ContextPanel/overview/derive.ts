import { ACTIVITY_VERB } from '@/lib/activity'
import { toConnector } from '@/lib/connector'
import type { ActivityItem, ActivityStatus, PlanItem, UIMessage } from '@/types/chat'

// The overview's pure side: turn state, the small formatters, and deriveOverview, which
// turns the chat's messages into everything the panel lists.

export const RUNNING: ReadonlySet<ActivityStatus> = new Set(['start', 'executing', 'reading'])
export const isRunning = (activity: { status: ActivityStatus }) => RUNNING.has(activity.status)

export type TurnState = 'idle' | 'working' | 'done' | 'stopped' | 'error'

export function turnState(message: UIMessage | undefined): TurnState {
  if (!message) return 'idle'
  if (message.isLoading) return 'working'
  if (message.stoppedByUser) return 'stopped'
  if (message.isError) return 'error'
  return 'done'
}

// A connector tool is a lower-cased tool slug prefixed with its connector, e.g.
// `gmail-send-email`. Built-in tools (`read_url`, `web_search`, …) are snake_case, so a hyphen
// is what separates the two. Returns the connector's slug, or null for a built-in.
function connectorSlugOf(activity: ActivityItem): string | null {
  const tool = activity.toolName?.trim().toLowerCase()
  if (!tool || !tool.includes('-')) return null
  return tool.split('-')[0]
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

function domainOf(url: string | undefined): string {
  if (!url) return ''
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

const sourceKey = (url: string) => url.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase()

export function extensionOf(name: string): string {
  const match = /\.([a-z0-9]{1,6})$/i.exec(name)
  return match ? match[1].toUpperCase() : ''
}

export function downloadFile(url: string, filename: string) {
  // Proxied so the browser always saves instead of navigating (see /api/download).
  const anchor = document.createElement('a')
  anchor.href = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export interface SourceItem { key: string; url: string; title: string; domain: string }
export interface DocumentItem { key: string; url: string; name: string; kind: 'created' | 'uploaded'; image: boolean }

export function stepText(activity: ActivityItem): { label: string; detail?: string } {
  const label = activity.label || ACTIVITY_VERB[activity.type] || 'Working'
  const detail = RUNNING.has(activity.status) && activity.progressMessage ? activity.progressMessage : activity.detail
  // The stream often sends one string as both label and detail, sometimes re-cased.
  return { label, detail: detail && detail.trim().toLowerCase() !== label.trim().toLowerCase() ? detail : undefined }
}

/** Finished / total to-dos. Null without a list. */
export function stepCount(plan: PlanItem[] | null): { done: number; total: number } | null {
  if (!plan) return null
  return { done: plan.filter(item => item.status === 'completed').length, total: plan.length }
}

export interface OverviewData {
  latest:     UIMessage | undefined
  /** The latest turn's activity, in order. */
  steps:      ActivityItem[]
  /** The latest turn's to-do list, when the model wrote one. */
  plan:       PlanItem[] | null
  agents:     ActivityItem[]
  connectors: { slug: string; name: string; used: number; active: boolean; failed: boolean }[]
  sources:    SourceItem[]
  documents:  DocumentItem[]
  skills:     { name: string; activity: ActivityItem }[]
}

/** Everything the overview lists, from the chat's messages. Pure, so it can be tested. */
export function deriveOverview(messages: UIMessage[]): OverviewData {
    const assistant = messages.filter(message => message.role === 'assistant')
    const latest = assistant[assistant.length - 1]
    const all = assistant.flatMap(message => message.activities ?? [])

    const connectorMap = new Map<string, { slug: string; name: string; used: number; active: boolean; failed: boolean }>()
    for (const activity of all) {
      const slug = connectorSlugOf(activity)
      if (!slug) continue
      const entry = connectorMap.get(slug) ?? { slug, name: toConnector(slug).name, used: 0, active: false, failed: false }
      entry.used += 1
      entry.active ||= isRunning(activity)
      entry.failed ||= activity.status === 'error'
      connectorMap.set(slug, entry)
    }

    // Newest first: while a turn runs, what it just read is what's worth seeing.
    const sources = new Map<string, SourceItem>()
    const addSource = (url: string | undefined, title: string | undefined) => {
      if (!url || !/^https?:\/\//i.test(url)) return
      const key = sourceKey(url)
      if (sources.has(key)) return
      sources.set(key, { key, url, title: title?.trim() || domainOf(url) || url, domain: domainOf(url) })
    }
    for (const message of [...assistant].reverse()) {
      for (const citation of message.webCitations ?? []) addSource(citation.url, citation.title)
      for (const source of message.sources ?? []) addSource(source.url, source.title)
      for (const activity of [...(message.activities ?? [])].reverse()) {
        if (activity.type === 'web-search') for (const result of activity.results ?? []) addSource(result.url, result.title)
      }
    }

    const documents: DocumentItem[] = []
    for (const message of [...messages].reverse()) {
      if (message.role === 'assistant') {
        for (const file of message.generatedFiles ?? []) {
          documents.push({ key: `g:${file.url}`, url: file.url, name: file.filename, kind: 'created', image: !!file.mimeType?.startsWith('image/') })
        }
        ;(message.images ?? []).forEach((image, index) => {
          documents.push({ key: `i:${image.url}`, url: image.url, name: `Image ${index + 1}.png`, kind: 'created', image: true })
        })
      } else if (message.role === 'user') {
        for (const file of message.attachments ?? []) {
          if (!file.url || file.uploading) continue
          documents.push({ key: `u:${file.id}`, url: file.url, name: file.file_name, kind: 'uploaded', image: file.file_type.startsWith('image/') })
        }
      }
    }

    const skills = new Map<string, ActivityItem>()
    for (const activity of all.filter(item => item.type === 'skills')) {
      skills.set(activity.label || activity.detail || activity.id, activity)
    }

    return {
      latest,
      steps:      latest?.activities ?? [],
      plan:       latest?.plan ?? null,
      agents:     all.filter(activity => activity.type === 'agent'),
      connectors: [...connectorMap.values()],
      sources:    [...sources.values()],
      documents,
      skills:     [...skills.entries()].map(([name, activity]) => ({ name, activity })),
    }
}
