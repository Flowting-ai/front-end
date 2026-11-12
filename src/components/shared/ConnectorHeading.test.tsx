// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { ConnectorHeading } from './ConnectorHeading'
import { toConnector } from '@/lib/connector'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function render(node: React.ReactNode): HTMLElement {
  const container = document.createElement('div')
  act(() => createRoot(container).render(node))
  return container
}

describe('ConnectorHeading', () => {
  it("shows the app's logo beside the title and the line under it", () => {
    const connector = toConnector({ connector_slug: 'metaads', display_name: 'Meta Ads', icon_url: 'https://logo/meta.png' })
    const card = render(<ConnectorHeading connector={connector} title="Connect Meta Ads">Link your account.</ConnectorHeading>)

    expect(card.querySelector('img')?.getAttribute('src')).toBe('https://logo/meta.png')
    expect(card.textContent).toContain('Connect Meta Ads')
    expect(card.textContent).toContain('Link your account.')
  })

  it('stands the app’s initial in for a logo the backend did not send', () => {
    const connector = toConnector({ connector_slug: 'zz_unknown_app', display_name: 'Zed' })
    const card = render(<ConnectorHeading connector={connector} title="Connect Zed" />)

    expect(card.querySelector('img')).toBeNull()
    expect(card.querySelector('[role="img"]')?.textContent).toBe('Z')
  })
})
