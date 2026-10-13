'use client'

import React, { useEffect } from 'react'

/**
 * Library pages take no dropped files (uploads happen in a chat), so a file dragged over or dropped on
 * the list, Trash or a file page does nothing, instead of the browser opening it and leaving the app.
 * A drop zone inside the page (the ask composer) still gets its own events first.
 */
function useDropGuard() {
  useEffect(() => {
    const guard = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      // A drop zone inside the page already accepted it: leave its drop effect alone.
      const accepted = event.defaultPrevented
      event.preventDefault()
      if (event.type === 'dragover' && !accepted) event.dataTransfer.dropEffect = 'none'
    }
    window.addEventListener('dragover', guard)
    window.addEventListener('drop', guard)
    return () => {
      window.removeEventListener('dragover', guard)
      window.removeEventListener('drop', guard)
    }
  }, [])
}

/**
 * Fills the card AppLayout already draws (border, radius, surface), so Library adds no second border:
 * only the list region scrolls and the header stays put.
 */
export function LibraryShell({ children }: { children: React.ReactNode }) {
  useDropGuard()
  return (
    <div
      style={{
        flex: '1 0 0', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}
