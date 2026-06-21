'use client'

import React, { createContext, useContext, useMemo, useRef, useState } from 'react'

type Ctx = {
  isDirty:    boolean
  setIsDirty: (v: boolean) => void
  /** Assign your page's save handler here. Return true on success, false on failure. */
  saveRef:    React.MutableRefObject<(() => Promise<boolean>) | null>
}

const SettingsGuardContext = createContext<Ctx>({
  isDirty:    false,
  setIsDirty: () => {},
  saveRef:    { current: null },
})

export function SettingsGuardProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false)
  const saveRef = useRef<(() => Promise<boolean>) | null>(null)
  const value   = useMemo(() => ({ isDirty, setIsDirty, saveRef }), [isDirty])
  return <SettingsGuardContext.Provider value={value}>{children}</SettingsGuardContext.Provider>
}

export function useSettingsGuard() {
  return useContext(SettingsGuardContext)
}
