// @vitest-environment jsdom
//
// Timers scheduled from handlers ("Copied" reset, staggered Download all) are
// cleared when the component unmounts, and run normally while it is mounted.

import React, { act, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useUnmountTimeouts } from "./use-unmount-timeouts"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let schedule: ReturnType<typeof useUnmountTimeouts>

function Probe() {
  const later = useUnmountTimeouts()
  useEffect(() => { schedule = later })
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement("div")
  root = createRoot(container)
  act(() => root.render(<Probe />))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useUnmountTimeouts", () => {
  it("runs pending timers while mounted", () => {
    const fn = vi.fn()
    schedule(fn, 250)
    schedule(fn, 500)
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(2)
    act(() => root.unmount())
  })

  it("clears every pending timer on unmount", () => {
    const fn = vi.fn()
    schedule(fn, 0)
    schedule(fn, 250)
    schedule(fn, 2000)
    vi.advanceTimersByTime(0)
    act(() => root.unmount())
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
