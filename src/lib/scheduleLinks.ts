'use client'

// Persistent map from a locally-created schedule's id to the Brain chat that
// was started from its prompt. Once written, a schedule is bound to that chat
// for the lifetime of the entry — there is no rebind path.

const MAP_KEY    = 'schedule_chat_links_v1'
const PROMPT_KEY = (scheduleId: string) => `schedule_pending_prompt:${scheduleId}`

// In-memory store for pending prompts. Client-side navigation never reloads
// the JS module, so this Map survives the /brain/schedules → /brain hop
// even if sessionStorage is unavailable or slow to flush.
const pendingPromptsMemory = new Map<string, string>()

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
  // Write to in-memory store first — guaranteed available for same-tab navigation.
  pendingPromptsMemory.set(scheduleId, prompt)
  // Also write to sessionStorage as a cross-reload fallback.
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(PROMPT_KEY(scheduleId), prompt) } catch {}
}

export function consumePendingPrompt(scheduleId: string): string | null {
  // Check in-memory store first — most reliable for client-side navigation.
  const memVal = pendingPromptsMemory.get(scheduleId)
  if (memVal !== undefined) {
    pendingPromptsMemory.delete(scheduleId)
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.removeItem(PROMPT_KEY(scheduleId)) } catch {}
    }
    return memVal
  }
  // Fall back to sessionStorage (covers hard refreshes landing on /brain?fromSchedule=).
  if (typeof window === 'undefined') return null
  try {
    const v = window.sessionStorage.getItem(PROMPT_KEY(scheduleId))
    window.sessionStorage.removeItem(PROMPT_KEY(scheduleId))
    return v
  } catch {
    return null
  }
}
