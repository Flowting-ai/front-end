import { toolNameToType } from '@/lib/activity'

// The muted text after a tool row's verb ("Searching the web — <detail>"). It
// comes from what the call was actually given, never from the tool's own name:
// the verb already says what kind of tool ran, so repeating its name reads as
// "Searching the web — search web".

const QUERY_KEYS = ['query', 'q', 'search_query', 'queries', 'question'] as const
const TARGET_KEYS = ['url', 'urls', 'link', 'href', 'filename', 'file_name', 'path', 'file_path', 'title', 'task'] as const
const MAX_DETAIL_LENGTH = 160

function argsRecord(args: unknown): Record<string, unknown> | null {
  if (typeof args === 'string') {
    if (!args.trim()) return null
    try {
      return argsRecord(JSON.parse(args))
    } catch {
      return null
    }
  }
  return typeof args === 'object' && args !== null && !Array.isArray(args)
    ? (args as Record<string, unknown>)
    : null
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const clean = value.replace(/\s+/g, ' ').trim()
    return clean || undefined
  }
  if (Array.isArray(value)) {
    const parts = value.flatMap((item) => {
      const part = text(item)
      return part ? [part] : []
    })
    return parts.length > 0 ? parts.join(', ') : undefined
  }
  return undefined
}

/**
 * The detail for a tool activity row, from the call's arguments (a JSON string
 * from the stream, or the parsed object stored with history). Search tools
 * prefer their query; everything else prefers what it acted on (a URL, a file,
 * an agent's task). `undefined` when the arguments carry nothing worth showing.
 */
export function deriveActivityDetail(toolName: string, args: unknown): string | undefined {
  const record = argsRecord(args)
  if (!record) return undefined

  const keys = toolNameToType(toolName) === 'web-search'
    ? [...QUERY_KEYS, ...TARGET_KEYS]
    : [...TARGET_KEYS, ...QUERY_KEYS]
  for (const key of keys) {
    const value = text(record[key])
    if (value) return value.length > MAX_DETAIL_LENGTH ? `${value.slice(0, MAX_DETAIL_LENGTH - 1)}…` : value
  }
  return undefined
}
