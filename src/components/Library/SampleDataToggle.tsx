'use client'

import React, { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Switch } from '@/components/Switch'
import { Tooltip } from '@/components/Tooltip'
import { LIBRARY_MOCK } from '@/lib/feature-flags'
import { getLibraryApi } from '@/lib/library/api'
import type { MockLibraryApi } from '@/lib/library/mock/api.mock'

const STORAGE_KEY = 'library:dev-sample-data'

/** Shown only in development on the mock: a dev control, never part of the product. */
export const SAMPLE_DATA_TOGGLE_ENABLED = process.env.NODE_ENV === 'development' && LIBRARY_MOCK

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

async function apply(on: boolean) {
  const api = (await getLibraryApi()) as Partial<MockLibraryApi>
  api.control?.setSampleData(on)
}

/**
 * Development only: turns the mock's sample files on or off, to see Library full or empty. The choice is
 * remembered in this browser and applied again after a reload.
 */
export function SampleDataToggle() {
  const queryClient = useQueryClient()
  const [on, setOn] = useState(true)

  // Restore the remembered choice once on mount (the mock starts with sample data on).
  useEffect(() => {
    const stored = readStored()
    if (stored) return
    let cancelled = false
    void apply(false).then(() => {
      if (cancelled) return
      setOn(false)
      void queryClient.invalidateQueries({ queryKey: ['library'] })
    })
    return () => { cancelled = true }
  }, [queryClient])

  const change = (next: boolean) => {
    setOn(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
    } catch {
      // Private mode or blocked storage: the switch still works for this page view.
    }
    void apply(next).then(() => queryClient.invalidateQueries({ queryKey: ['library'] }))
  }

  return (
    <Tooltip content="Development only: show or hide the mock's sample files">
      <label
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none', height: 36, padding: '0 10px', borderRadius: 10,
          border: '1px dashed var(--neutral-300)', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)', whiteSpace: 'nowrap',
        }}
      >
        Sample data
        <Switch checked={on} onCheckedChange={change} aria-label="Sample data" />
      </label>
    </Tooltip>
  )
}
