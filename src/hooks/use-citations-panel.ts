"use client"

import { useState, useCallback } from "react"
import type { Source } from "@/types/chat"

export function useCitationsPanel() {
  const [citationsOpen, setCitationsOpen] = useState(false)
  const [citationsSources, setCitationsSources] = useState<Source[]>([])
  const [highlightedCitation] = useState<number | null>(null)

  const openCitations = useCallback((sources: Source[]) => {
    setCitationsSources(sources)
    setCitationsOpen(true)
  }, [])

  const closeCitations = useCallback(() => setCitationsOpen(false), [])

  return { citationsOpen, citationsSources, highlightedCitation, openCitations, closeCitations }
}
