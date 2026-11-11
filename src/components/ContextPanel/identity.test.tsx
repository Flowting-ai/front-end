// @vitest-environment jsdom
//
// An agent row's handle is only looked up as a connector when it is one: a plain
// agent ("analyst") must not trigger GET /connectors/analyst (a 404), while a
// connector used in the chat, or a linked one behind a specialist, still resolves.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const api = vi.hoisted(() => ({
  getConnector: vi.fn((slug: string) => Promise.resolve({ slug })),
  linked: vi.fn(() => Promise.resolve([{ slug: 'gmail' }])),
}))

vi.mock('@/lib/api/connectors', () => ({
  getConnector: api.getConnector,
  resolveConnector: (slug: string) => ({ slug, name: slug, logo: undefined }),
}))
vi.mock('@/lib/connectors/connector-queries', () => ({
  linkedConnectorsQuery: () => ({ queryKey: ['connectors', 'linked'], queryFn: api.linked }),
}))
vi.mock('@/components/chat/AgentMentionMenu', () => ({ MentionAvatar: () => null }))
vi.mock('@/lib/queries/personas', () => ({ usePersonas: () => ({ data: [] }) }))

const { useConnectorIdentities } = await import('./identity')

let container: HTMLDivElement
let root: Root

function Probe({ slugs, maybe }: { slugs: string[]; maybe: string[] }) {
  useConnectorIdentities(slugs, maybe)
  return null
}

beforeEach(() => {
  container = document.createElement('div')
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  vi.clearAllMocks()
})

describe('useConnectorIdentities', () => {
  it('looks up used connectors and linked specialists, never a plain agent handle', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe slugs={['notion']} maybe={['analyst', 'gmail']} />
        </QueryClientProvider>,
      )
    })
    await act(async () => { await Promise.resolve() })

    const looked = api.getConnector.mock.calls.map(([slug]) => slug)
    expect(looked).toContain('notion')
    expect(looked).toContain('gmail')
    expect(looked).not.toContain('analyst')
  })
})
