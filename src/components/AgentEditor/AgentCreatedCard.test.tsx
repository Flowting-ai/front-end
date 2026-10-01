// @vitest-environment jsdom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }))

import { AgentCreatedCard } from './AgentCreatedCard'

const AGENT: SelectedPersonaInfo = {
  id: 'repo-1', name: 'Support Triage', handle: '@support-triage', imageUrl: null, modelId: 'pro', activeVersionId: 'ver-1',
  systemPrompt: null, temperature: 0.3, visibility: 'private', ownedByViewer: true, description: 'Sorts support emails.', tags: [], paused: false, shared: false,
}

let container: HTMLDivElement
let root: Root
const onUse = vi.fn()

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

const render = (props: Partial<React.ComponentProps<typeof AgentCreatedCard>> = {}) =>
  act(async () => root.render(<AgentCreatedCard agent={AGENT} published inUse={false} onUse={onUse} {...props} />))
const button = (text: string) => Array.from(container.querySelectorAll('button')).find(b => b.textContent === text) as HTMLButtonElement | undefined

describe('AgentCreatedCard', () => {
  it('shows the new agent', async () => {
    await render()
    expect(container.textContent).toContain('Support Triage')
    expect(container.textContent).toContain('@support-triage')
    expect(container.textContent).toContain('Sorts support emails.')
    expect(container.textContent).toContain('ready and saved')
  })

  it('attaches the agent with Use now', async () => {
    await render()
    await act(async () => { button('Use now')!.click() })
    expect(onUse).toHaveBeenCalledWith(AGENT)
  })

  it('shows "In use" (disabled) once the agent is attached', async () => {
    await render({ inUse: true })
    expect(button('Use now')).toBeUndefined()
    expect(button('In use')!.disabled).toBe(true)
  })

  it('opens the editor and the details panel', async () => {
    await render()
    await act(async () => { button('Edit')!.click() })
    expect(nav.push).toHaveBeenCalledWith('/agents/repo-1/edit')
    await act(async () => { button('Open')!.click() })
    expect(nav.push).toHaveBeenCalledWith('/agents?agent=repo-1')
  })

  it('offers no Use now for an agent that is not live, or where the host cannot attach one', async () => {
    await render({ published: false })
    expect(container.textContent).toContain('isn’t live yet')
    expect(button('Use now')).toBeUndefined()
    await render({ onUse: undefined })
    expect(button('Use now')).toBeUndefined()
    expect(button('Edit')).toBeTruthy()
  })
})
