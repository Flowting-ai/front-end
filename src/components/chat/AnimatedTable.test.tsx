// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LazyMotion, domAnimation } from 'framer-motion'
import { AnimatedTable } from './AnimatedTable'
import type { TableData } from '@/types/chat'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const data = { headers: ['Name', 'Qty'], rows: [['b', 2], ['a', 1]], sortable: true } as unknown as TableData

describe('AnimatedTable semantics', () => {
  it('exposes table roles and sorts from a keyboard-reachable header button', () => {
    act(() => root.render(<LazyMotion features={domAnimation}><AnimatedTable data={data} onComplete={() => {}} animate={false} /></LazyMotion>))
    expect(host.querySelector('[role="table"]')).not.toBeNull()
    const headers = host.querySelectorAll('[role="columnheader"]')
    expect(headers).toHaveLength(2)
    expect(headers[0].getAttribute('aria-sort')).toBe('none')
    const btn = headers[0].querySelector('button')!
    expect(btn.getAttribute('type')).toBe('button')
    act(() => btn.click())
    expect(headers[0].getAttribute('aria-sort')).toBe('ascending')
    const firstCells = Array.from(host.querySelectorAll('[role="row"]')).slice(1).map(r => r.querySelector('[role="cell"]')!.textContent)
    expect(firstCells).toEqual(['a', 'b'])
    act(() => btn.click())
    expect(headers[0].getAttribute('aria-sort')).toBe('descending')
  })
})
