// @vitest-environment jsdom
//
// The templates page: "Recommended for you" (ranked from connected apps and the
// agents the user already has) and "General" (every template).

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const nav = vi.hoisted(() => ({ push: vi.fn() }))
const api = vi.hoisted(() => ({ listLinkedConnectors: vi.fn(), fetchPersonas: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }))
vi.mock('@/lib/api/connectors', () => ({ listLinkedConnectors: api.listLinkedConnectors }))
vi.mock('@/lib/api/personas', () => ({ fetchPersonas: api.fetchPersonas }))
vi.mock('@/lib/analytics/events', () => ({ trackFeature: vi.fn(), trackBrowserEvent: vi.fn() }))

import PersonaTemplatesPage from './page'

let container: HTMLDivElement
let root: Root

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  class Stub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: Stub, IntersectionObserver: Stub })
})

beforeEach(() => {
  vi.resetAllMocks()
  api.listLinkedConnectors.mockResolvedValue([])
  api.fetchPersonas.mockResolvedValue([])
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function settle() {
  for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve() })
}
async function render() {
  await act(async () => root.render(<PersonaTemplatesPage />))
  await settle()
}
// Each template is an agent card; its "Use template" button starts the flow.
const cards = () => Array.from(document.querySelectorAll<HTMLElement>('[data-template]'))
const cardNames = () => cards().map(c => c.dataset.template)
function tab(name: string) {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).find(t => t.textContent?.trim() === name)!
}

describe('templates page', () => {
  it('opens on "Recommended for you" with popular starting points when nothing is connected', async () => {
    await render()
    expect(tab('Recommended for you').getAttribute('aria-selected')).toBe('true')
    expect(document.body.textContent).toContain('Connect apps to get suggestions')
    expect(cardNames()).toEqual(['Customer Support', 'Research', 'Content Writer', 'Executive Assistant'])
  })

  it('recommends templates that fit the connected apps and says why', async () => {
    api.listLinkedConnectors.mockResolvedValue([
      { slug: 'hubspot', displayName: 'HubSpot' },
      { slug: 'github', displayName: 'GitHub' },
    ])
    await render()
    expect(document.body.textContent).toContain('Picked from the apps you’ve connected.')
    expect(cardNames()).toEqual(expect.arrayContaining(['Sales', 'Marketing', 'Code Review']))
    expect(document.body.textContent).toContain('Works with HubSpot')
    expect(document.body.textContent).toContain('Works with GitHub')
  })

  it('leaves out a template the user already has an agent for', async () => {
    api.listLinkedConnectors.mockResolvedValue([{ slug: 'hubspot', displayName: 'HubSpot' }])
    api.fetchPersonas.mockResolvedValue([{ name: 'Sales Assistant' }])
    await render()
    expect(cardNames()).not.toContain('Sales')
    expect(cardNames()).toContain('Marketing')
  })

  it('still shows suggestions when the lookups fail', async () => {
    api.listLinkedConnectors.mockRejectedValue(new Error('500'))
    api.fetchPersonas.mockRejectedValue(new Error('500'))
    await render()
    expect(cardNames()).toHaveLength(4)
  })

  it('"General" lists every template', async () => {
    await render()
    await act(async () => { tab('General').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); tab('General').click() })
    await settle()
    expect(cardNames()).toHaveLength(15)
  })

  it('a template card starts the new-agent flow pre-filled; "Start blank" starts it empty', async () => {
    await render()
    await act(async () => { Array.from(cards()[0].querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.includes('Use template'))!.click() })
    expect(nav.push).toHaveBeenCalledWith('/agents/new?template=Customer%20Support')

    const blank = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.includes('Start blank'))!
    await act(async () => { blank.click() })
    expect(nav.push).toHaveBeenLastCalledWith('/agents/new')
  })
})
