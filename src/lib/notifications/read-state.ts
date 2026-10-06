// ── Notification read state ──────────────────────────────────────────────────
// Per user, per browser (localStorage) until notifications have a backend.
//
// • baseline  — when this browser first loaded the feed. Informational rows
//   older than it (e.g. last week's schedule runs on first sign-in) start out
//   read, so the badge doesn't open with a backlog nobody asked about.
// • seenAt    — when the panel was last opened. The bell's number counts only
//   unread rows that arrived after it ("seen" ≠ "read", the GitHub / Slack
//   model): opening the panel clears the number, but each row keeps its own
//   unread dot until it's opened or marked read.
// • read / unread — explicit marks. `unread` overrides `read`, so "Mark as
//   unread" works even on rows older than the baseline.
// • dismissed — informational rows the user removed from the panel.
// • firstSeen — when each actionable problem was first noticed, so its row
//   keeps a stable timestamp ("2d ago") across polls and reloads.

import { parseServerDate } from '@/lib/utils/format-utils'
import type { AppNotification } from './types'
import { notificationIds } from './build'

export interface NotificationReadState {
  baseline:  string
  seenAt:    string
  read:      string[]
  unread:    string[]
  dismissed: string[]
  firstSeen: Record<string, string>
}

/** Ids kept per list beyond the live set — enough to cover the lookback window. */
const MAX_IDS = 500

/** localStorage key holding one user's read state. */
export const notificationReadStateKey = (userKey: string) => `notifications_state_${userKey}`

/** A short, stable, non-reversible key for the signed-in user — keeps the
 *  email itself out of storage key names. */
export function notificationUserKey(identity: string): string {
  let hash = 5381
  for (let i = 0; i < identity.length; i++) hash = ((hash << 5) + hash + identity.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

export function emptyReadState(now: Date = new Date()): NotificationReadState {
  const iso = now.toISOString()
  return { baseline: iso, seenAt: iso, read: [], unread: [], dismissed: [], firstSeen: {} }
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []

function parseReadState(raw: string | null): NotificationReadState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationReadState>
    if (typeof parsed.baseline !== 'string') return null
    return {
      baseline:  parsed.baseline,
      seenAt:    typeof parsed.seenAt === 'string' ? parsed.seenAt : parsed.baseline,
      read:      stringList(parsed.read),
      unread:    stringList(parsed.unread),
      dismissed: stringList(parsed.dismissed),
      firstSeen: parsed.firstSeen && typeof parsed.firstSeen === 'object' ? parsed.firstSeen : {},
    }
  } catch {
    return null // corrupt entry — start over
  }
}

function readRaw(userKey: string): string | null {
  try { return window.localStorage.getItem(notificationReadStateKey(userKey)) } catch { return null }
}

const READ_STATE_EVENT = 'notifications:read-state'

/** Persists and notifies every subscriber in this tab (other tabs hear the
 *  native `storage` event). */
export function saveReadState(userKey: string, state: NotificationReadState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(notificationReadStateKey(userKey), JSON.stringify(state))
  } catch { /* quota / private mode — read state just won't persist */ }
  // Cache under whatever storage now holds (null when it's unavailable), so
  // the next read matches it and keeps this state in memory.
  snapshotCache.set(userKey, { raw: readRaw(userKey), state })
  window.dispatchEvent(new CustomEvent(READ_STATE_EVENT, { detail: userKey }))
}

// ── External store (for useSyncExternalStore) ─────────────────────────────────
// localStorage is the source of truth; the cache keeps snapshots referentially
// stable between reads of the same raw string, as useSyncExternalStore needs.

const snapshotCache = new Map<string, { raw: string | null; state: NotificationReadState }>()

export function getReadStateSnapshot(userKey: string): NotificationReadState {
  const raw = readRaw(userKey)
  const hit = snapshotCache.get(userKey)
  // Same raw string → same object (useSyncExternalStore needs stable
  // snapshots). A stored entry that disappeared (cleared in devtools or by
  // another tab) falls through and starts fresh.
  if (hit && hit.raw === raw) return hit.state
  const state = parseReadState(raw) ?? emptyReadState()
  snapshotCache.set(userKey, { raw, state })
  return state
}

export function subscribeReadState(userKey: string, onChange: () => void): () => void {
  // First visit: persist the fresh state now so its baseline sticks across
  // reloads (otherwise every load would start a new baseline).
  if (readRaw(userKey) === null) saveReadState(userKey, getReadStateSnapshot(userKey))
  const onLocal = (e: Event) => { if ((e as CustomEvent<string>).detail === userKey) onChange() }
  const onStorage = (e: StorageEvent) => { if (e.key === notificationReadStateKey(userKey)) onChange() }
  window.addEventListener(READ_STATE_EVENT, onLocal)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(READ_STATE_EVENT, onLocal)
    window.removeEventListener('storage', onStorage)
  }
}

/** Read-modify-write; a no-op when `update` returns the same object. */
export function updateReadState(userKey: string, update: (prev: NotificationReadState) => NotificationReadState): void {
  const prev = getReadStateSnapshot(userKey)
  const next = update(prev)
  if (next !== prev) saveReadState(userKey, next)
}

// ── Queries ───────────────────────────────────────────────────────────────────

const ms = (iso: string) => parseServerDate(iso)?.getTime() ?? 0

function isIdUnread(id: string, at: string, actionable: boolean, state: NotificationReadState): boolean {
  if (state.unread.includes(id)) return true
  if (state.read.includes(id)) return false
  return actionable || ms(at) > ms(state.baseline)
}

/** A bundle is unread while any run in it is. */
export function isNotificationUnread(n: AppNotification, state: NotificationReadState): boolean {
  return notificationIds(n).some(id => isIdUnread(id, n.at, n.actionable, state))
}

/** Unread and newer than the last time the panel was opened. */
export function isNotificationUnseen(n: AppNotification, state: NotificationReadState): boolean {
  return isNotificationUnread(n, state) && ms(n.at) > ms(state.seenAt)
}

// ── Updates ───────────────────────────────────────────────────────────────────

const prepend = (list: readonly string[], add: readonly string[]) =>
  [...add.filter(id => !list.includes(id)), ...list].slice(0, MAX_IDS)

export function withRead(state: NotificationReadState, ids: readonly string[]): NotificationReadState {
  if (ids.every(id => state.read.includes(id) && !state.unread.includes(id))) return state
  return {
    ...state,
    read:   prepend(state.read, ids),
    unread: state.unread.filter(id => !ids.includes(id)),
  }
}

export function withUnread(state: NotificationReadState, ids: readonly string[]): NotificationReadState {
  return {
    ...state,
    read:   state.read.filter(id => !ids.includes(id)),
    unread: prepend(state.unread, ids),
  }
}

export function withDismissed(state: NotificationReadState, ids: readonly string[]): NotificationReadState {
  return { ...withRead(state, ids), dismissed: prepend(state.dismissed, ids) }
}

export function withoutDismissed(state: NotificationReadState, ids: readonly string[]): NotificationReadState {
  return { ...state, dismissed: state.dismissed.filter(id => !ids.includes(id)) }
}

export function withSeen(state: NotificationReadState, now: Date = new Date()): NotificationReadState {
  return { ...state, seenAt: now.toISOString() }
}

/**
 * Records first-seen times for newly appeared actionable ids, and forgets ids
 * that resolved (a fixed agent, a handled request) — so if the same problem
 * comes back later it is unread and timestamped again.
 */
export function withFirstSeen(
  state: NotificationReadState,
  actionableIds: readonly string[],
  now: Date = new Date(),
): NotificationReadState {
  const live = new Set(actionableIds)
  const firstSeen: Record<string, string> = {}
  let changed = false
  for (const id of actionableIds) {
    firstSeen[id] = state.firstSeen[id] ?? now.toISOString()
    if (!state.firstSeen[id]) changed = true
  }
  for (const id of Object.keys(state.firstSeen)) if (!live.has(id)) changed = true
  const keep = (id: string) => !isActionableId(id) || live.has(id)
  const read = state.read.filter(keep)
  const unread = state.unread.filter(keep)
  if (read.length !== state.read.length || unread.length !== state.unread.length) changed = true
  return changed ? { ...state, firstSeen, read, unread } : state
}

function isActionableId(id: string): boolean {
  return id.startsWith('agent-model:') || id.startsWith('request:')
}
