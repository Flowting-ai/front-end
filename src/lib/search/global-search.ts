import type { SearchResult } from '@/components/GlobalSearchModal'
import { foldText, matchesAllTerms, queryTerms, rankTitle } from './text-match'

/**
 * Matching for global search (Cmd/Ctrl+K), kept pure so it can be tested in
 * Node. The provider builds an index once per change of its sources (text
 * folded up front: lower-case, no diacritics), and each keystroke only runs
 * `searchIndex`.
 */

export interface NavPage {
  id:       string
  title:    string
  subtitle: string
  route:    string
  keywords: string
}

export interface SearchSources {
  chats:        { id: string; title?: string | null }[]
  projectChats: { id: string; title: string; projectId: string }[]
  agentChats:   { id: string; title?: string | null; personaId: string }[]
  projects:     { id: string; name: string; description: string }[]
  /** Every agent: drafts name their chats but are not results themselves. */
  personas:     { id: string; name: string; handle: string; description: string; tags: string[]; draft?: boolean }[]
  /** Empty when pins are disabled. */
  pins:         { id: string; title?: string | null; content?: string | null; tags?: string[] | null; chatId?: string | null; chatName?: string | null }[]
  pages:        NavPage[]
}

interface Entry {
  /** Folded haystacks, title first; every query term must hit one of them. */
  text:   string[]
  result: SearchResult
}

export interface SearchIndex {
  /** Groups in display order, each with its cap. */
  groups: { entries: Entry[]; limit: number }[]
}

export const CHAT_RESULT_LIMIT  = 20
export const OTHER_RESULT_LIMIT = 10

const lower = foldText
const untitledChat = (title: string | null | undefined) => title || 'Untitled chat'

export function buildSearchIndex(sources: SearchSources): SearchIndex {
  const projectNameById = new Map(sources.projects.map(p => [p.id, p.name]))
  const personaNameById = new Map(sources.personas.map(p => [p.id, p.name]))
  // A pin's parent chat name across every chat source (PinItem.chatName is
  // rarely populated by the backend).
  const chatNameById = new Map<string, string>()
  for (const c of sources.chats) chatNameById.set(c.id, untitledChat(c.title))
  for (const c of sources.projectChats) chatNameById.set(c.id, untitledChat(c.title))
  for (const c of sources.agentChats) chatNameById.set(c.id, untitledChat(c.title))

  const chats: Entry[] = sources.chats.map(c => ({
    text:   [lower(c.title)],
    result: { id: c.id, type: 'chat', title: untitledChat(c.title) },
  }))

  const projectChats: Entry[] = sources.projectChats.map(c => {
    const projectName = projectNameById.get(c.projectId)
    return {
      text:   [lower(c.title)],
      result: { id: c.id, type: 'chat', title: untitledChat(c.title), subtitle: projectName ? `in ${projectName}` : undefined },
    }
  })

  const agentChats: Entry[] = sources.agentChats.map(c => {
    const personaName = personaNameById.get(c.personaId)
    return {
      text:   [lower(c.title)],
      result: { id: c.id, type: 'agent-chat', title: untitledChat(c.title), subtitle: personaName ? `with ${personaName}` : undefined },
    }
  })

  const projects: Entry[] = sources.projects.map(p => ({
    text:   [lower(p.name), lower(p.description)],
    result: { id: p.id, type: 'project', title: p.name, subtitle: p.description || undefined },
  }))

  const personas: Entry[] = sources.personas.filter(p => !p.draft).map(p => ({
    text:   [lower(p.name), lower(p.handle), lower(p.description), ...p.tags.map(lower)],
    result: { id: p.id, type: 'persona', title: p.name, subtitle: p.handle || undefined },
  }))

  const pins: Entry[] = sources.pins.map(p => {
    const chatName = (p.chatId ? chatNameById.get(p.chatId) : undefined) ?? p.chatName ?? undefined
    return {
      text:   [lower(p.title), lower(p.content), ...(p.tags ?? []).map(lower)],
      result: { id: p.id, type: 'pin', title: p.title || 'Untitled pin', subtitle: chatName ? `in ${chatName}` : undefined },
    }
  })

  const pages: Entry[] = sources.pages.map(pg => ({
    text:   [lower(pg.title), lower(pg.subtitle), lower(pg.keywords)],
    result: { id: pg.id, type: 'page', title: pg.title, subtitle: pg.subtitle },
  }))

  return {
    groups: [
      { entries: chats,        limit: CHAT_RESULT_LIMIT },
      { entries: projectChats, limit: CHAT_RESULT_LIMIT },
      { entries: agentChats,   limit: CHAT_RESULT_LIMIT },
      { entries: projects,     limit: OTHER_RESULT_LIMIT },
      { entries: personas,     limit: OTHER_RESULT_LIMIT },
      { entries: pins,         limit: OTHER_RESULT_LIMIT },
      { entries: pages,        limit: Number.POSITIVE_INFINITY },
    ],
  }
}

/**
 * Every query term must match (case- and diacritic-insensitive). Within each
 * group, results rank by how the title matches (exact, prefix, word start,
 * substring, other field), then keep source order, which is most recent first
 * for chats. Each group is capped after ranking.
 */
export function searchIndex(index: SearchIndex, query: string): SearchResult[] {
  const terms = queryTerms(query)
  if (terms.length === 0) return []
  const out: SearchResult[] = []
  for (const { entries, limit } of index.groups) {
    const hits: { result: SearchResult; rank: number; order: number }[] = []
    entries.forEach((entry, order) => {
      if (matchesAllTerms(entry.text, terms)) hits.push({ result: entry.result, rank: rankTitle(entry.text[0] ?? '', query), order })
    })
    hits.sort((a, b) => b.rank - a.rank || a.order - b.order)
    for (const hit of hits.slice(0, limit)) out.push(hit.result)
  }
  return out
}

/** The last five chats that aren't in a project, shown before typing. */
export function recentChats(
  chats: SearchSources['chats'],
  projectChatIds: ReadonlySet<string>,
  limit = 5,
): SearchResult[] {
  const out: SearchResult[] = []
  for (const c of chats) {
    if (out.length >= limit) break
    if (!projectChatIds.has(c.id)) out.push({ id: c.id, type: 'chat', title: untitledChat(c.title) })
  }
  return out
}

// ── Recently opened (persisted) ─────────────────────────────────────────────

export const RECENT_OPENED_LIMIT = 5

/** Put a just-opened result first, without duplicates, capped. */
export function rememberOpened(list: SearchResult[], result: SearchResult, limit = RECENT_OPENED_LIMIT): SearchResult[] {
  const { id, type, title, subtitle } = result
  return [{ id, type, title, subtitle }, ...list.filter(r => !(r.id === result.id && r.type === result.type))].slice(0, limit)
}

/** Parse stored recents defensively (any shape can be in localStorage). */
export function parseStoredRecents(raw: string | null): SearchResult[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter((r): r is SearchResult =>
      !!r && typeof r === 'object' && typeof (r as SearchResult).id === 'string' && typeof (r as SearchResult).type === 'string' && typeof (r as SearchResult).title === 'string',
    ).slice(0, RECENT_OPENED_LIMIT)
  } catch {
    return []
  }
}

/**
 * Recently opened results that still exist (a deleted chat or agent drops out),
 * with today's title, followed by recent chats not already listed.
 */
export function recentsWithOpened(index: SearchIndex, opened: SearchResult[], recent: SearchResult[], limit = RECENT_OPENED_LIMIT): SearchResult[] {
  const live = new Map<string, SearchResult>()
  for (const group of index.groups) for (const entry of group.entries) live.set(`${entry.result.type}:${entry.result.id}`, entry.result)
  const out: SearchResult[] = []
  const seen = new Set<string>()
  for (const r of [...opened, ...recent]) {
    const key = `${r.type}:${r.id}`
    const current = live.get(key)
    if (!current || seen.has(key)) continue
    seen.add(key)
    out.push(current)
    if (out.length >= limit) break
  }
  return out
}

/** Screen-reader summary of the current result list. */
export function resultCountMessage(count: number, hasQuery: boolean, loading: boolean): string {
  if (!hasQuery) return ''
  if (loading && count === 0) return 'Searching…'
  if (count === 0) return 'No results'
  return count === 1 ? '1 result' : `${count} results`
}
