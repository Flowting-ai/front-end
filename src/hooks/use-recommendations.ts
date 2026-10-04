'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { fetchRecommendations, type Recommendations } from '@/lib/api/recommendations'

/**
 * Starter cards for the empty chat screen, generated per user and refreshed by the
 * backend roughly every 12 hours.
 *
 * Stale-while-revalidate, so coming back to a new chat never waits on the network:
 *   • an in-memory copy (survives client-side navigation between pages),
 *   • a sessionStorage copy (survives a reload; scoped to the signed-in user),
 *   • a background refresh once the copy is older than STALE_MS.
 * `prefetchRecommendations` warms all of this from the app shell, so the very first visit to a
 * new chat is usually instant as well. Until the first response lands there is nothing to show,
 * so callers render a skeleton (`loading`) — never a placeholder set, because the backend is the
 * only place card copy lives. A failed request leaves the section hidden.
 */

const STORAGE_KEY = 'souvenir:recommendations:v1'
const STALE_MS = 5 * 60 * 1000

type Entry = { userKey: string; at: number; data: Recommendations }

let memory: Entry | null = null
const inFlight = new Map<string, Promise<Recommendations | null>>()

function readStored(userKey: string): Entry | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as Entry
    return entry.userKey === userKey && entry.data?.cards ? entry : null
  } catch {
    return null
  }
}

function writeStored(entry: Entry) {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry)) } catch { /* private mode / quota */ }
}

function cached(userKey: string): Entry | null {
  if (memory?.userKey === userKey) return memory
  const stored = typeof window === 'undefined' ? null : readStored(userKey)
  if (stored) memory = stored
  return stored
}

/** Fetch (deduplicated) and store. Resolves null on failure so callers keep what they have. */
export function prefetchRecommendations(userKey: string): Promise<Recommendations | null> {
  const pending = inFlight.get(userKey)
  if (pending) return pending
  const request = fetchRecommendations()
    .then(data => {
      const entry: Entry = { userKey, at: Date.now(), data }
      memory = entry
      writeStored(entry)
      return data
    })
    .catch(() => null)
    .finally(() => { inFlight.delete(userKey) })
  inFlight.set(userKey, request)
  return request
}

/** Warm the cache if it is missing or stale (no-op when fresh). Safe to call repeatedly. */
export function warmRecommendations(userKey: string | null | undefined): void {
  if (!userKey) return
  const hit = cached(userKey)
  if (!hit || Date.now() - hit.at > STALE_MS) void prefetchRecommendations(userKey)
}

export function useRecommendationsState(): { recommendations: Recommendations | null; loading: boolean } {
  const { user } = useAuth()
  const userKey = String(user?.auth0Id ?? user?.id ?? '')
  // Memory only on the first render: identical to the server render, so hydration never mismatches.
  const [entry, setEntry] = useState<Entry | null>(() => (memory?.userKey === userKey ? memory : null))
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!userKey) return
    let live = true
    const hit = cached(userKey)
    // From storage after a reload: apply in a microtask (before paint), not synchronously in the effect.
    if (hit) void Promise.resolve().then(() => { if (live) setEntry(hit) })
    if (!hit || Date.now() - hit.at > STALE_MS) {
      void prefetchRecommendations(userKey).then(data => {
        if (!live) return
        if (data && memory) setEntry(memory)
        setSettled(true)
      })
    }
    return () => { live = false }
  }, [userKey])

  return { recommendations: entry?.data ?? null, loading: !entry && !settled }
}

export function useRecommendations(): Recommendations | null {
  return useRecommendationsState().recommendations
}
