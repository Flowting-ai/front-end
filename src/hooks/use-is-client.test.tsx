// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useIsClient } from './use-is-client'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Probe() {
  return <span>{useIsClient() ? 'client' : 'server'}</span>
}

describe('useIsClient', () => {
  it('is false in the server render, so the first paint matches the server HTML', () => {
    expect(renderToString(<Probe />)).toContain('server')
  })

  it('is true once the component has mounted in the browser', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(async () => root.render(<Probe />))
    expect(container.textContent).toBe('client')
    await act(async () => root.unmount())
  })
})
