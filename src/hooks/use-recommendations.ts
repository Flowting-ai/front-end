'use client'

import { useEffect, useState } from 'react'
import { fetchRecommendations, type Recommendations } from '@/lib/api/recommendations'

/**
 * Starter cards for the empty chat screen, generated per user and refreshed by the
 * backend roughly every 12 hours.
 *
 * Null until the first response lands — the caller renders nothing rather than
 * flashing a placeholder set, so the backend stays the only place card copy
 * lives. A failed request leaves it null and the section stays hidden.
 */
export function useRecommendations(): Recommendations | null {
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null)

  useEffect(() => {
    let live = true
    fetchRecommendations()
      .then(result => { if (live) setRecommendations(result) })
      .catch(() => { if (live) setRecommendations(null) })
    return () => { live = false }
  }, [])

  return recommendations
}
