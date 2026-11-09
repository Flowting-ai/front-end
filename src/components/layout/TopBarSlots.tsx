'use client'

import React, { createContext, use, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// The TopBar is a real bar at the top of the app card, shown only on pages that put something in
// it. Pages place their own controls there (a back button on the left; Share and panel toggles on
// the right) through these two slots, instead of pinning them over the bar with absolute positioning.

type Side = 'left' | 'right'

interface TopBarSlotsValue {
  nodes: Record<Side, HTMLElement | null>
  /** How many TopBarPortals are mounted: the bar shows while this is above zero. */
  users: number
  setNode: (side: Side, node: HTMLElement | null) => void
  addUser: (delta: 1 | -1) => void
}

const TopBarSlotsContext = createContext<TopBarSlotsValue | null>(null)

export function TopBarSlotsProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<Record<Side, HTMLElement | null>>({ left: null, right: null })
  const [users, setUsers] = useState(0)
  // Stable setters, created once.
  const [setters] = useState(() => ({
    setNode: (side: Side, node: HTMLElement | null) => setNodes(prev => (prev[side] === node ? prev : { ...prev, [side]: node })),
    addUser: (delta: 1 | -1) => setUsers(n => n + delta),
  }))
  return <TopBarSlotsContext value={{ ...setters, nodes, users }}>{children}</TopBarSlotsContext>
}

/** Where the TopBar mounts a slot: pass as its `ref` (stable, so React never detaches and re-attaches it). */
export function useTopBarSlotRef(side: Side) {
  const setNode = use(TopBarSlotsContext)?.setNode
  return useCallback((node: HTMLElement | null) => setNode?.(side, node), [setNode, side])
}

/** True while any page content is placed in the TopBar's slots. */
export function useTopBarHasSlotContent(): boolean {
  return (use(TopBarSlotsContext)?.users ?? 0) > 0
}

/** Renders `children` inside the TopBar's left or right slot, and makes the bar show while mounted. */
export function TopBarPortal({ side, children }: { side: Side; children: React.ReactNode }) {
  const ctx = use(TopBarSlotsContext)
  const addUser = ctx?.addUser
  useEffect(() => {
    if (!addUser) return
    addUser(1)
    return () => addUser(-1)
  }, [addUser])
  const node = ctx?.nodes[side]
  return node ? createPortal(children, node) : null
}
