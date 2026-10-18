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

  // The skills tool loads named skills: the names are the detail.
  if (toolName === 'skills' && Array.isArray(record.categories)) {
    const names = record.categories.filter((name): name is string => typeof name === 'string' && name.length > 0)
    if (names.length > 0) return names.join(', ')
  }

  const keys = toolNameToType(toolName) === 'web-search'
    ? [...QUERY_KEYS, ...TARGET_KEYS]
    : [...TARGET_KEYS, ...QUERY_KEYS]
  for (const key of keys) {
    const value = text(record[key])
    if (value) return value.length > MAX_DETAIL_LENGTH ? `${value.slice(0, MAX_DETAIL_LENGTH - 1)}…` : value
  }
  return undefined
}

// Sandbox code builds an image as `generation(type="image", …)` (any argument
// order, either quote); the stream sends the code JSON-encoded, so the quote
// may arrive escaped.
const IMAGE_GENERATION_RE = /generation\([^)]*?\\?["']image\\?["']/

/** True when a tool call's arguments generate an image — the only signal the
 *  stream gives, since image generation runs inside the `execute` tool. */
export function argsGenerateImage(args: unknown): boolean {
  if (args == null) return false
  const raw = typeof args === 'string' ? args : JSON.stringify(args)
  return IMAGE_GENERATION_RE.test(raw)
}

const IMAGE_PROMPT_RE = /\.prompt\(\s*\\?(["'])([\s\S]*?)\\?\1/
const ASPECT_RATIO_RE = /aspect_ratio\s*=\s*\\?["'](\d+):(\d+)\\?["']/

export interface ImageHints {
  /** What the picture is of, as far as it has streamed. */
  prompt?: string
  /** Width / height, from `aspect_ratio="16:9"`. */
  aspect?: number
}

/** What an image call's code says about the picture, for the preview to
 *  shape and tint itself before the real image exists. */
export function argsImageHints(args: unknown): ImageHints {
  if (args == null) return {}
  const raw = typeof args === 'string' ? args : JSON.stringify(args)
  const prompt = IMAGE_PROMPT_RE.exec(raw)?.[2]
  const ratio = ASPECT_RATIO_RE.exec(raw)
  const aspect = ratio ? Number(ratio[1]) / Number(ratio[2]) : undefined
  return {
    ...(prompt ? { prompt } : {}),
    ...(aspect && Number.isFinite(aspect) && aspect > 0 ? { aspect } : {}),
  }
}
