// @vitest-environment jsdom
//
// Enhance on the agent editor's system prompt: the backend-driven flow (draft,
// questions, refine, diff, apply) and the local fallback, with the network mocked.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const api = vi.hoisted(() => ({ enhancePrompt: vi.fn() }))
vi.mock('@/lib/api/personas', () => api)
vi.mock('@/lib/analytics/events', () => ({ trackBrowserEvent: vi.fn(), trackFeature: vi.fn() }))

import { EnhancePromptField } from './index'

const QUESTION = { question: 'Who is the audience?', multi_select: false, options: [{ label: 'Lawyers', description: 'l' }, { label: 'Clients', description: 'c' }] }

let container: HTMLDivElement
let root: Root
let onChange: ReturnType<typeof vi.fn>

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
  onChange = vi.fn()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

const render = (value: string) => act(async () => { root.render(<EnhancePromptField value={value} onChange={onChange} />) })
const button = (re: RegExp) => [...document.querySelectorAll('button')].find(b => re.test(b.getAttribute('aria-label') || b.textContent || ''))
const click = async (el: Element | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click() }) }
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })
const text = () => document.body.textContent ?? ''

describe('EnhancePromptField (backend flow)', () => {
  it('sends the prompt to the backend and shows its questions, with a typed-answer row for "Other"', async () => {
    api.enhancePrompt.mockResolvedValueOnce({ enhanced_prompt: 'DRAFT', questions: [QUESTION] })
    await render('You are a lawyer.')
    await click(button(/^Enhance$/))
    await flush()
    expect(api.enhancePrompt).toHaveBeenCalledWith('You are a lawyer.', [])
    expect(text()).toContain('Who is the audience?')
    expect(text()).toContain('Lawyers')
    expect(text()).toContain('Type your answer')
  })

  it('goes straight to the diff when the backend asks nothing, and Apply commits its draft', async () => {
    api.enhancePrompt.mockResolvedValueOnce({ enhanced_prompt: '## Role\nYou are a contracts lawyer.', questions: [] })
    await render('You are a lawyer.')
    await click(button(/^Enhance$/))
    await flush()
    expect(document.querySelector('[aria-label="Diff between original and enhanced prompt"]')).toBeTruthy()
    // Headings stay on their own row, not glued to the next sentence.
    const rows = [...document.querySelectorAll('[role=listitem]')].map(r => r.textContent)
    expect(rows).toContain('## Role')
    expect(rows).toContain('You are a contracts lawyer.')
    await click(button(/Apply changes/))
    expect(onChange).toHaveBeenCalledWith('## Role\nYou are a contracts lawyer.')
  })

  it('sends the answers back and shows the refined draft', async () => {
    api.enhancePrompt
      .mockResolvedValueOnce({ enhanced_prompt: 'DRAFT', questions: [QUESTION] })
      .mockResolvedValueOnce({ enhanced_prompt: 'REFINED for lawyers', questions: [] })
    await render('You are a lawyer.')
    await click(button(/^Enhance$/))
    await flush()
    await click([...document.querySelectorAll('[role=radio], [tabindex="0"]')].find(e => /Lawyers/.test(e.textContent ?? '')))
    await click(button(/Review/))
    await flush()
    expect(api.enhancePrompt).toHaveBeenLastCalledWith('You are a lawyer.', [{ question: 'Who is the audience?', answer: 'Lawyers' }])
    expect(text()).toContain('REFINED for lawyers')
  })

  it('falls back to the first draft when the refine call fails', async () => {
    api.enhancePrompt
      .mockResolvedValueOnce({ enhanced_prompt: 'FIRST DRAFT', questions: [QUESTION] })
      .mockRejectedValueOnce(new Error('500'))
    await render('You are a lawyer.')
    await click(button(/^Enhance$/))
    await flush()
    await click([...document.querySelectorAll('[tabindex="0"]')].find(e => /Clients/.test(e.textContent ?? '')))
    await click(button(/Review/))
    await flush()
    expect(text()).toContain('FIRST DRAFT')
  })

  it('ignores a backend reply that arrives after the panel was closed', async () => {
    let release!: (v: unknown) => void
    api.enhancePrompt.mockReturnValueOnce(new Promise(r => { release = r }))
    await render('You are a lawyer.')
    await click(button(/^Enhance$/))
    await click(button(/Close Enhance/))
    await act(async () => { release({ enhanced_prompt: 'LATE', questions: [] }); await Promise.resolve() })
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(text()).not.toContain('LATE')
  })

  it('uses the local flow when the backend call fails, and for an empty prompt', async () => {
    api.enhancePrompt.mockRejectedValueOnce(new Error('500'))
    await render('You are a lawyer.')
    await click(button(/^Enhance$/))
    await flush()
    // Local scan runs on a timer, then shows its own questions.
    await act(async () => { await new Promise(r => setTimeout(r, 1900)) })
    expect(document.querySelector('[role=dialog]')).toBeTruthy()
    expect(text()).toMatch(/Step 1 of|comprehensive/)

    await act(async () => root.unmount())
    root = createRoot(container)
    vi.mocked(api.enhancePrompt).mockClear()
    await render('   ')
    await click(button(/^Enhance$/))
    expect(api.enhancePrompt).not.toHaveBeenCalled()
  })
})
