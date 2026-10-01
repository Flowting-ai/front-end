'use client'

import { useEffect, useState } from 'react'
import {
  fetchRecommendations,
  type Recommendations,
  type Surface,
} from '@/lib/api/recommendations'

// Module-level cache shared by every consumer. The empty screens (new chat, new
// task) unmount and remount as the user switches between them; without this each
// switch refetched and the cards popped in once the request landed. With it the
// cards are there on the first paint after the initial load, and a background
// refetch keeps them fresh.
const cache = new Map<Surface, { data: Recommendations; at: number }>()
const inflight = new Map<Surface, Promise<Recommendations>>()
const REVALIDATE_AFTER_MS = 60_000

function load(surface: Surface): Promise<Recommendations> {
  const pending = inflight.get(surface)
  if (pending) return pending
  const request = fetchRecommendations(surface)
    .then((data) => {
      cache.set(surface, { data, at: Date.now() })
      return data
    })
    .finally(() => { inflight.delete(surface) })
  inflight.set(surface, request)
  return request
}

export interface RecommendationsState {
  recommendations: Recommendations | null
  /** True only while the first response for this surface is still pending. */
  isLoading: boolean
}

/**
 * Same data as `useRecommendations`, plus whether the first load is in flight so
 * the caller can render skeleton cards instead of nothing.
 */
export function useRecommendationsState(surface: Surface): RecommendationsState {
  const [recommendations, setRecommendations] = useState<Recommendations | null>(
    () => cache.get(surface)?.data ?? null,
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    const cached = cache.get(surface)
    // Fresh enough — keep what's on screen, no request.
    if (cached && Date.now() - cached.at < REVALIDATE_AFTER_MS) return
    load(surface)
      .then((result) => { if (live) { setRecommendations(result); setFailed(false) } })
      .catch(() => { if (live && !cached) { setRecommendations(null); setFailed(true) } })
    return () => { live = false }
  }, [surface])

  return { recommendations, isLoading: recommendations === null && !failed }
}

/**
 * Starter cards for an empty screen, generated per user and refreshed by the
 * backend roughly every 12 hours.
 *
 * Null until the first response lands. A failed request leaves it null and the
 * section stays hidden. Use `useRecommendationsState` when a loading placeholder
 * is wanted.
 */
export function useRecommendations(surface: Surface): Recommendations | null {
  return useRecommendationsState(surface).recommendations
}
