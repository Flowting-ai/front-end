// @vitest-environment jsdom
//
// A row with an href renders as a link; it must keep the selected marker the
// dark theme's selected text keys on (theme.css `[data-sidebar-selected]`),
// and mark the current page with aria-current rather than aria-pressed.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FlatSidebarRow } from './index'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('FlatSidebarRow link rows', () => {
  it('carries data-sidebar-selected and aria-current when selected', () => {
    act(() => root.render(<FlatSidebarRow label="Agents" href="/agents" selected />))
    const link = container.querySelector('a')!
    expect(link.hasAttribute('data-sidebar-selected')).toBe(true)
    expect(link.getAttribute('aria-current')).toBe('page')
    expect(link.hasAttribute('aria-pressed')).toBe(false)
  })

  it('has neither when not selected', () => {
    act(() => root.render(<FlatSidebarRow label="Agents" href="/agents" />))
    const link = container.querySelector('a')!
    expect(link.hasAttribute('data-sidebar-selected')).toBe(false)
    expect(link.hasAttribute('aria-current')).toBe(false)
  })
})
