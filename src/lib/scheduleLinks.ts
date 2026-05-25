'use client'

// Persistent map from a locally-created schedule's id to the Brain chat that
// was started from its prompt. Once written, a schedule is bound to that chat
// for the lifetime of the entry — there is no rebind path.

const MAP_KEY    = 'schedule_chat_links_v1'
const PROMPT_KEY = (scheduleId: string) => `schedule_pending_prompt:${scheduleId}`

type LinkMap = Record<string, string>

function readMap(): LinkMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(MAP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as LinkMap : {}
  } catch {
    return {}
  }
}

function writeMap(map: LinkMap): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(MAP_KEY, JSON.stringify(map)) } catch {}
}

export function linkScheduleToChat(scheduleId: string, chatId: string): void {
  if (!scheduleId || !chatId) return
  const map = readMap()
  // Bind once; if a link already exists, keep the original (the user said
  // "linked to this chat forever").
  if (map[scheduleId]) return
  map[scheduleId] = chatId
  writeMap(map)
}

export function getChatForSchedule(scheduleId: string): string | undefined {
  return readMap()[scheduleId]
}

export function getAllScheduleLinks(): LinkMap {
  return readMap()
}

export function stashPendingPrompt(scheduleId: string, prompt: string): void {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(PROMPT_KEY(scheduleId), prompt) } catch {}
}

export function consumePendingPrompt(scheduleId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.sessionStorage.getItem(PROMPT_KEY(scheduleId))
    window.sessionStorage.removeItem(PROMPT_KEY(scheduleId))
    return v
  } catch {
    return null
  }
}
