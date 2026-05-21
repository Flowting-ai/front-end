'use client'

import { createContext, useCallback, use, useState } from 'react'

interface CompareContextValue {
  isOpen: boolean
  open:   () => void
  close:  () => void
  toggle: () => void
}

const CompareContext = createContext<CompareContextValue | null>(null)

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open   = useCallback(() => setIsOpen(true),      [])
  const close  = useCallback(() => setIsOpen(false),     [])
  const toggle = useCallback(() => setIsOpen(v => !v),   [])

  return (
    <CompareContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </CompareContext.Provider>
  )
}

export function useCompare(): CompareContextValue {
  const ctx = use(CompareContext)
  if (!ctx) throw new Error('useCompare must be used within CompareProvider')
  return ctx
}
