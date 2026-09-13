'use client'

import { useEffect, useState } from 'react'
import {
  fetchRecommendations,
  type Recommendations,
  type Surface,
} from '@/lib/api/recommendations'

/**
 * Starter cards for an empty screen, generated per user and refreshed by the
 * backend roughly every 12 hours.
 *
 * Null until the first response lands — the caller renders nothing rather than
 * flashing a placeholder set, so the backend stays the only place card copy
 * lives. A failed request leaves it null and the section stays hidden.
 */
export function useRecommendations(surface: Surface): Recommendations | null {
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null)

  useEffect(() => {
    let live = true
    fetchRecommendations(surface)
      .then(result => { if (live) setRecommendations(result) })
      .catch(() => { if (live) setRecommendations(null) })
    return () => { live = false }
  }, [surface])

  return recommendations
}
