// ── Dev-only notification controls ───────────────────────────────────────────
// Backing store for the /dev/notifications playground. Two knobs, both kept in
// localStorage so they survive reloads and apply across every open tab:
//   • fixtures  — extra notifications merged into the real bell's feed.
//   • model overrides — pretend a model is retired/blocked, so the real agent
//     cards fade, the fix modal opens, and the bell raises "needs attention"
//     against your actual agents, without touching the backend.
// Every export is inert in production builds (NODE_ENV is inlined at build time).

import { useSyncExternalStore } from 'react'
import type { AppNotification } from './types'
import type { ModelUnavailableReason } from '@/lib/agent-model-health'

export const NOTIFICATIONS_DEV_ENABLED = process.env.NODE_ENV !== 'production'

export const NOTIFICATIONS_DEV_EVENT = 'notifications:dev-changed'

const FIXTURES_KEY        = 'dev_notification_fixtures'
const MODEL_OVERRIDES_KEY = 'dev_model_overrides'

function read<T>(key: string, fallback: T): T {
  if (!NOTIFICATIONS_DEV_ENABLED || typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  if (!NOTIFICATIONS_DEV_ENABLED || typeof window === 'undefined') return
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch { /* quota / private mode */ }
  window.dispatchEvent(new Event(NOTIFICATIONS_DEV_EVENT))
}

export function readDevFixtures(): AppNotification[] {
  const list = read<AppNotification[]>(FIXTURES_KEY, [])
  return Array.isArray(list) ? list.map(n => ({ ...n, dev: true })) : []
}

export function writeDevFixtures(list: AppNotification[] | null): void {
  write(FIXTURES_KEY, list && list.length ? list : null)
}

export function readDevModelOverrides(): Record<string, ModelUnavailableReason> {
  const map = read<Record<string, ModelUnavailableReason>>(MODEL_OVERRIDES_KEY, {})
  return map && typeof map === 'object' ? map : {}
}

export function readDevModelOverride(modelId: string): ModelUnavailableReason | null {
  if (!NOTIFICATIONS_DEV_ENABLED) return null
  const reason = readDevModelOverrides()[modelId]
  return reason === 'retired' || reason === 'blocked' ? reason : null
}

export function writeDevModelOverride(modelId: string, reason: ModelUnavailableReason | null): void {
  const next = { ...readDevModelOverrides() }
  if (reason) next[modelId] = reason
  else delete next[modelId]
  write(MODEL_OVERRIDES_KEY, Object.keys(next).length ? next : null)
}

export function clearDevNotificationState(): void {
  write(FIXTURES_KEY, null)
  write(MODEL_OVERRIDES_KEY, null)
}

/** Bumps whenever the playground changes fixtures or model overrides (in this
 *  tab or another), so render-time readers like `modelUnavailableReason`
 *  re-run. Always 0 in production. */
export function useDevNotificationsVersion(): number {
  return useSyncExternalStore(subscribeDev, getDevVersion, getServerDevVersion)
}

let devVersion = 0

function subscribeDev(onChange: () => void): () => void {
  if (!NOTIFICATIONS_DEV_ENABLED) return () => {}
  const bump = () => { devVersion += 1; onChange() }
  const onStorage = (e: StorageEvent) => {
    if (e.key === FIXTURES_KEY || e.key === MODEL_OVERRIDES_KEY) bump()
  }
  window.addEventListener(NOTIFICATIONS_DEV_EVENT, bump)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(NOTIFICATIONS_DEV_EVENT, bump)
    window.removeEventListener('storage', onStorage)
  }
}

function getDevVersion(): number {
  return devVersion
}

function getServerDevVersion(): number {
  return 0
}
