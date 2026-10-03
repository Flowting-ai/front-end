/**
 * `@agent` mentions in the chat box: finding the mention being typed, filtering
 * the agents it could mean, and removing it once an agent is picked.
 */

export interface MentionToken {
  /** Index of the `@` in the text. */
  start: number
  /** What has been typed after the `@`. */
  query: string
}

/**
 * The mention the caret is currently inside, if any. A mention starts with `@`
 * at the beginning of the text or after whitespace, and runs to the caret with no
 * whitespace — so an email address ("a@b.com") or a finished word never counts.
 */
export function findMention(text: string, caret: number): MentionToken | null {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)))
  const match = /(^|\s)@([^\s@]*)$/.exec(before)
  if (!match) return null
  return { start: match.index + match[1].length, query: match[2] }
}

/**
 * The text with the mention removed (the `@query` plus one space it leaves behind),
 * and where the caret belongs afterwards.
 */
export function removeMention(text: string, token: MentionToken, caret: number): { text: string; caret: number } {
  const end = Math.max(token.start + 1, Math.min(caret, text.length))
  const before = text.slice(0, token.start)
  let after = text.slice(end)
  // "hello @ag| world" → "hello world", not "hello  world".
  if (before.endsWith(' ') && after.startsWith(' ')) after = after.slice(1)
  // A mention at the very start leaves no leading space behind.
  if (before === '' && after.startsWith(' ')) after = after.slice(1)
  return { text: before + after, caret: before.length }
}

export interface MentionableAgent {
  id:     string
  name:   string
  handle: string
}

export const MAX_MENTION_RESULTS = 6

function normalize(text: string): string {
  return text.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Agents matching the typed query, best first: name/handle prefixes before substrings. */
export function filterAgents<T extends MentionableAgent>(agents: readonly T[], query: string, limit = MAX_MENTION_RESULTS): T[] {
  const q = normalize(query)
  if (!q) return agents.slice(0, limit)

  const ranked: Array<{ agent: T; rank: number; order: number }> = []
  agents.forEach((agent, order) => {
    const name = normalize(agent.name)
    const handle = normalize(agent.handle)
    let rank = -1
    if (name.startsWith(q) || handle.startsWith(q)) rank = 0
    else if (name.split(' ').some(word => word.startsWith(q))) rank = 1
    else if (name.includes(q) || handle.includes(q)) rank = 2
    if (rank >= 0) ranked.push({ agent, rank, order })
  })
  return ranked.sort((a, b) => a.rank - b.rank || a.order - b.order).slice(0, limit).map(entry => entry.agent)
}
