'use client'

import React, { createContext, use, useState, useCallback } from 'react'

export interface ProjectPanelSlot {
  title:   string
  content: React.ReactNode
  onClose: () => void
  /** Overrides the shell's default left/right inset (24px) for BOTH the
   *  header title and the content below it, so the two always share a left
   *  edge. Use for content designed to sit flush against the panel edges
   *  (e.g. AgentsPanelContent, modeled on Pinboard's own tight 8px side
   *  padding) instead of the default's wider card-style margin. */
  sidePadding?: number
}

interface ProjectPanelContextValue {
  panel:  ProjectPanelSlot | null
  isOpen: boolean
  setPanel: (panel: ProjectPanelSlot | null) => void
}

const ProjectPanelContext = createContext<ProjectPanelContextValue | null>(null)

// A slot AppLayout renders as its own flex sibling — outside the rounded
// content border, full viewport height, with the same header/background
// treatment as Pinboard — exactly how RightSidebar renders Pinboard. A page
// (currently just the project detail page) that wants a panel treated that
// way hands its title/JSX/close-handler here instead of rendering it inline
// in its own layout.
export function ProjectPanelProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanelState] = useState<ProjectPanelSlot | null>(null)
  const setPanel = useCallback((next: ProjectPanelSlot | null) => setPanelState(next), [])

  return (
    <ProjectPanelContext.Provider value={{ panel, isOpen: panel !== null, setPanel }}>
      {children}
    </ProjectPanelContext.Provider>
  )
}

export function useProjectPanel(): ProjectPanelContextValue {
  const ctx = use(ProjectPanelContext)
  if (!ctx) throw new Error('useProjectPanel must be used within ProjectPanelProvider')
  return ctx
}
