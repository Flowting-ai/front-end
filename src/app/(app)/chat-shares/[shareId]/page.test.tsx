// @vitest-environment jsdom
//
// A shared chat in jsdom with the network mocked: each reply keeps its widgets, its
// reasoning (collapsed, as in the chat) and its sources (chips in the text + a list).

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const nav = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }))
const api = vi.hoisted(() => ({ getSharedChatView: vi.fn(), forkChatShare: vi.fn() }))

vi.mock('next/navigation', () => ({
  useParams: () => ({ shareId: 'share-1' }),
  useRouter: () => ({ back: nav.back, push: nav.push }),
}))
vi.mock('@/lib/api/chat-shares', () => api)
vi.mock('@/context/chat-history-context', () => ({ useChatHistoryContext: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import SharedChatPage from './page'

const TABLE = '<table><columns><column key="a" label="Fruit"/></columns><rows><row><a>Banana</a></row></rows></table>'

function view(messages: Array<Record<string, unknown>>) {
  return { shareId: 's', chatId: 'c', chatTitle: 'A shared chat', messages }
}

let container: HTMLDivElement
let root: Root

beforeAll(() => {
  class Stub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: Stub, IntersectionObserver: Stub })
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  vi.resetAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const render = async () => {
  await act(async () => { root.render(<SharedChatPage />) })
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

describe('shared chat page', () => {
  it('shows a reply\'s reasoning above its answer, collapsed', async () => {
    api.getSharedChatView.mockResolvedValue(view([
      { id: '1', input: 'Why?', output: 'Because.', reasoning: 'The user wants a reason, so I should give one.', modelName: 'Advanced', createdAt: 'x' },
    ]))
    await render()
    expect(container.textContent).toContain('Because.')
    const trigger = [...container.querySelectorAll('button')].find(b => /Thought/.test(b.textContent ?? ''))
    expect(trigger).toBeTruthy()
    expect(trigger?.getAttribute('aria-expanded')).toBe('false')
  })

  it('shows no reasoning block for a reply without reasoning', async () => {
    api.getSharedChatView.mockResolvedValue(view([
      { id: '1', input: 'Hi', output: 'Hello.', reasoning: null, modelName: null, createdAt: 'x' },
    ]))
    await render()
    expect([...container.querySelectorAll('button')].some(b => /Thought/.test(b.textContent ?? ''))).toBe(false)
  })

  it('turns the model\'s "Sources:" block into a source list and hides the raw block', async () => {
    api.getSharedChatView.mockResolvedValue(view([
      {
        id: '1', input: 'Tea?', reasoning: null, modelName: null, createdAt: 'x',
        output: 'Tea is a drink [1].\n\nSources:\n[1] [Tea facts](https://example.com/tea)',
      },
    ]))
    await render()
    expect(container.textContent).not.toContain('Sources:')
    expect(container.textContent).toContain('Tea facts')
    expect(container.textContent).toContain('example.com')
  })

  it('renders widgets instead of raw XML', async () => {
    api.getSharedChatView.mockResolvedValue(view([
      { id: '1', input: 'Table?', output: `Here you go:\n\n${TABLE}`, reasoning: null, modelName: null, createdAt: 'x' },
    ]))
    await render()
    // The table widget's own controls are there, and the XML is not.
    expect(container.textContent).not.toContain('<table>')
    expect(container.textContent).toContain('Copy markdown')
  })

  it('shows a reasoning-only message (no answer text) without crashing', async () => {
    api.getSharedChatView.mockResolvedValue(view([
      { id: '1', input: 'Hm', output: null, reasoning: 'Thinking it over.', modelName: null, createdAt: 'x' },
    ]))
    await render()
    expect([...container.querySelectorAll('button')].some(b => /Thought/.test(b.textContent ?? ''))).toBe(true)
  })
})
