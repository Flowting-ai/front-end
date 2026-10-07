// @vitest-environment jsdom
//
// Question cards in chat: Skip/X/Next only where they do something, required
// questions can't be sent empty, one click sends one response, and the card
// is usable from the keyboard.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatPrompt, ChatPromptQuestion } from '@/types/chat'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const respond = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api/chat', () => ({ respondToChatPrompt: respond }))

import { ChatPromptCard } from './ChatPromptCard'
import { DISMISSED_ANSWER } from '@/lib/chat-prompt-answers'

const color: ChatPromptQuestion = {
  id: 'color', question: 'Which colour?', type: 'single_choice',
  options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }],
  required: true, allow_custom: true,
}
const size: ChatPromptQuestion = {
  id: 'size', question: 'Which sizes?', type: 'multi_choice',
  options: [{ value: 's', label: 'Small' }, { value: 'm', label: 'Medium' }],
  required: true, allow_custom: true,
}
const questionsPrompt = (questions: ChatPromptQuestion[]): ChatPrompt => ({
  request_id: 'p1', kind: 'questions', title: 'A few quick questions', options: [], questions, respond_url: '/chats/prompts/p1',
})

let container: HTMLDivElement
let root: Root
const onDecided = vi.fn()

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
  respond.mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

async function mount(prompt: ChatPrompt) {
  await act(async () => root.render(<ChatPromptCard prompt={prompt} onDecided={onDecided} />))
}
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
const skip = () => Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Skip') ?? null
const row = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('[role="radio"], [role="checkbox"]'))
  .find(el => el.textContent?.includes(label))!
const somethingElse = () => Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Something else on your mind')!
const textbox = () => document.querySelector('textarea')!
async function click(el: HTMLElement) { await act(async () => { el.click() }) }
async function type(text: string) {
  const el = textbox()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function key(el: HTMLElement, init: KeyboardEventInit) {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })) })
}

describe('required questions', () => {
  it('has no Skip, and Send stays disabled until there is an answer', async () => {
    await mount(questionsPrompt([color]))
    expect(skip()).toBeNull()
    expect(button('Send')!.disabled).toBe(true)

    await click(row('Red'))
    expect(button('Send')!.disabled).toBe(false)

    await click(button('Send')!)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith('p1', { answers: { color: 'red' } }, '/chats/prompts/p1')
    expect(onDecided).toHaveBeenCalledWith('resolved')
  })

  it('does not count blank text in the custom box as an answer', async () => {
    await mount(questionsPrompt([color]))
    await click(somethingElse())
    await type('   ')
    expect(button('Send')!.disabled).toBe(true)
  })
})

describe('option plus typed text', () => {
  it('sends the typed text only, in a single request', async () => {
    await mount(questionsPrompt([color]))
    await click(row('Red'))
    await click(somethingElse())
    await type('Green')
    await click(button('Send')!)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond.mock.calls[0][1]).toEqual({ answers: { color: 'Green' } })
  })

  it('keeps ticked options and adds the typed text on multi choice', async () => {
    await mount(questionsPrompt([size]))
    await click(row('Small'))
    await click(somethingElse())
    await type('XL')
    await click(button('Send')!)
    expect(respond.mock.calls[0][1]).toEqual({ answers: { size: ['s', 'XL'] } })
  })

  it('advances a multi-question card exactly one step and keeps going', async () => {
    await mount(questionsPrompt([color, size]))
    await click(row('Red'))
    await click(somethingElse())
    await type('Green')
    await click(button('Send')!)
    expect(respond).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Which sizes?')

    await click(row('Medium'))
    await click(button('Send')!)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond.mock.calls[0][1]).toEqual({ answers: { color: 'Green', size: ['m'] } })
  })
})

describe('optional questions', () => {
  it('Skip records null and moves on; an empty Send skips too', async () => {
    await mount(questionsPrompt([{ ...color, required: false }, { ...size, required: false }]))
    await click(skip()!)
    expect(document.body.textContent).toContain('Which sizes?')
    expect(button('Send')!.disabled).toBe(false)
    await click(button('Send')!)
    expect(respond.mock.calls[0][1]).toEqual({ answers: { color: null, size: null } })
  })
})

describe('pagination', () => {
  it('Next only returns to questions already reached, and Back restores the answer', async () => {
    await mount(questionsPrompt([color, size]))
    expect(button('Next question')!.disabled).toBe(true)
    expect(button('Previous question')!.disabled).toBe(true)

    await click(row('Blue'))
    await click(button('Send')!)
    expect(button('Next question')!.disabled).toBe(true)

    await click(button('Previous question')!)
    expect(document.body.textContent).toContain('Which colour?')
    expect(row('Blue').getAttribute('aria-checked')).toBe('true')

    await click(button('Next question')!)
    expect(document.body.textContent).toContain('Which sizes?')
  })

  it('keeps an answer changed after going Back, and the ticks of a half-answered question', async () => {
    await mount(questionsPrompt([color, size]))
    await click(row('Blue'))
    await click(button('Send')!)
    await click(row('Small'))

    await click(button('Previous question')!)
    await click(row('Red'))
    await click(button('Next question')!)
    expect(row('Small').getAttribute('aria-checked')).toBe('true')

    await click(button('Send')!)
    expect(respond.mock.calls[0][1]).toEqual({ answers: { color: 'red', size: ['s'] } })
  })

  it('keeps typed text when going Back and forth', async () => {
    await mount(questionsPrompt([color, size]))
    await click(somethingElse())
    await type('Green')
    await click(button('Send')!)
    await click(button('Previous question')!)
    expect(textbox().value).toBe('Green')
    await click(button('Next question')!)
    await click(row('Medium'))
    await click(button('Send')!)
    expect(respond.mock.calls[0][1]).toEqual({ answers: { color: 'Green', size: ['m'] } })
  })
})

describe('dismissing', () => {
  it('sends given answers and marks the rest as dismissed', async () => {
    await mount(questionsPrompt([color, size]))
    await click(row('Red'))
    await click(button('Send')!)
    await click(button('Dismiss question')!)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond.mock.calls[0][1]).toEqual({ answers: { color: 'red', size: DISMISSED_ANSWER } })
    expect(onDecided).toHaveBeenCalledWith('dismissed')
    expect(container.textContent).toBe('')
  })

  it('rejects an approval', async () => {
    await mount({
      request_id: 'p2', kind: 'approval', title: 'Approve Send invite?', options: [
        { value: 'approve', label: 'Approve' }, { value: 'reject', label: 'Reject' },
      ],
    })
    await click(button('Dismiss question')!)
    expect(respond.mock.calls[0][1]).toBe('reject')
  })

  it('is not offered on confirm-style prompts', async () => {
    await mount({ request_id: 'p3', kind: 'confirm', title: 'Sign in here', options: [] })
    expect(button('Dismiss question')).toBeNull()
    expect(skip()).toBeNull()
  })
})

describe('keyboard and screen readers', () => {
  it('exposes the options as a labelled radio group with one tab stop', async () => {
    await mount(questionsPrompt([color]))
    const group = document.querySelector('[role="radiogroup"]')!
    const label = document.getElementById(group.getAttribute('aria-labelledby')!)
    expect(label?.textContent).toBe('Which colour?')
    expect(row('Red').tabIndex).toBe(0)
    expect(row('Blue').tabIndex).toBe(-1)
  })

  it('sends from the custom box with Enter but not Shift+Enter', async () => {
    await mount(questionsPrompt([color]))
    await click(somethingElse())
    await type('Green')
    await key(textbox(), { key: 'Enter', shiftKey: true })
    expect(respond).not.toHaveBeenCalled()
    await key(textbox(), { key: 'Enter' })
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond.mock.calls[0][1]).toEqual({ answers: { color: 'Green' } })
  })

  it('takes focus when nothing is focused', async () => {
    await mount(questionsPrompt([color]))
    expect(document.activeElement).toBe(row('Red'))
  })

  it('never steals focus from where the user is typing', async () => {
    const composer = document.createElement('textarea')
    document.body.appendChild(composer)
    composer.focus()
    await mount(questionsPrompt([color]))
    expect(document.activeElement).toBe(composer)
  })

  it('announces the question', async () => {
    vi.useFakeTimers()
    try {
      await mount(questionsPrompt([color, size]))
      await act(async () => { vi.advanceTimersByTime(150) })
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Question 1 of 2: Which colour?')
    } finally {
      vi.useRealTimers()
    }
  })
})
