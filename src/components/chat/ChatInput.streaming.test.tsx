// @vitest-environment jsdom
//
// The chat box while a reply streams: it keeps focus and can be typed in, Enter
// doesn't send until the reply is done, and focus comes back after the reply if
// it was lost — without stealing it from anything else.

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/hooks/use-selectable-chat-personas', () => ({
  useSelectableChatPersonas: () => ({ personas: [], loading: false }),
}))
vi.mock('react-speech-recognition', () => ({
  default: { startListening: vi.fn(), stopListening: vi.fn(), abortListening: vi.fn() },
  useSpeechRecognition: () => ({ transcript: '', listening: false, resetTranscript: vi.fn(), browserSupportsSpeechRecognition: false }),
}))
vi.mock('@/lib/analytics/events', () => ({ trackFeature: vi.fn(), trackBrowserEvent: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { ChatInput } from './ChatInput'

let container: HTMLDivElement
let root: Root
const onSend = vi.fn()
const onStop = vi.fn()
let coarsePointer = false

function Harness({ isStreaming = false, disabled = false }) {
  const [value, setValue] = useState('')
  return (
    <>
      <ChatInput value={value} onChange={setValue} onSend={onSend} onStop={onStop} isStreaming={isStreaming} disabled={disabled} />
      <button type="button" data-testid="elsewhere">Elsewhere</button>
    </>
  )
}

beforeAll(() => {
  class Stub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: Stub, IntersectionObserver: Stub })
  window.matchMedia = ((query: string) => ({
    matches: query === '(pointer: coarse)' ? coarsePointer : false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  vi.resetAllMocks()
  coarsePointer = false
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

const box = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message"]')!
const elsewhere = () => document.querySelector<HTMLButtonElement>('[data-testid="elsewhere"]')!
const actionButton = () => document.querySelector<HTMLButtonElement>('button[aria-label="Stop generation"], button[aria-label="Send message"]')

async function render(props: Parameters<typeof Harness>[0] = {}) {
  await act(async () => root.render(<Harness {...props} />))
}

async function type(text: string) {
  const el = box()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function pressEnter() {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  await act(async () => { box().dispatchEvent(event) })
  return event
}

/** Types a message with the box focused and sends it with Enter. */
async function sendFromBox(text = 'hello') {
  await render()
  await act(async () => box().focus())
  await type(text)
  await pressEnter()
  expect(onSend).toHaveBeenCalledWith(text)
}

describe('ChatInput while a reply streams', () => {
  it('keeps the box focused and editable when streaming starts', async () => {
    await sendFromBox()
    await render({ isStreaming: true })

    expect(box().disabled).toBe(false)
    expect(document.activeElement).toBe(box())

    await type('next question')
    expect(box().value).toBe('next question')
  })

  it('does not send on Enter while streaming, and keeps the draft', async () => {
    await render({ isStreaming: true })
    await act(async () => box().focus())
    await type('next question')

    const event = await pressEnter()
    expect(event.defaultPrevented).toBe(true)
    expect(onSend).not.toHaveBeenCalled()
    expect(box().value).toBe('next question')

    await render({ isStreaming: false })
    await pressEnter()
    expect(onSend).toHaveBeenCalledWith('next question')
  })

  it('shows Stop, not Send, while streaming', async () => {
    await render({ isStreaming: true })
    await type('next question')
    expect(actionButton()?.getAttribute('aria-label')).toBe('Stop generation')
    await act(async () => actionButton()!.click())
    expect(onStop).toHaveBeenCalled()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('still locks the box when the host disables it', async () => {
    await render({ disabled: true })
    expect(box().disabled).toBe(true)
  })

  it('gives focus back after the reply when it dropped to the page', async () => {
    await sendFromBox()
    await render({ isStreaming: true })
    await act(async () => box().blur())
    expect(document.activeElement).toBe(document.body)

    await render({ isStreaming: false })
    expect(document.activeElement).toBe(box())
  })

  it('does not steal focus from another control', async () => {
    await sendFromBox()
    await render({ isStreaming: true })
    await act(async () => elsewhere().focus())

    await render({ isStreaming: false })
    expect(document.activeElement).toBe(elsewhere())
  })

  it('does not refocus when the box was not focused at send', async () => {
    await render()
    await type('hello')
    await act(async () => box().blur())
    await act(async () => actionButton()!.click())
    expect(onSend).toHaveBeenCalledWith('hello')
    await act(async () => (document.activeElement as HTMLElement | null)?.blur())

    await render({ isStreaming: true })
    await render({ isStreaming: false })
    expect(document.activeElement).not.toBe(box())
  })

  it('does not refocus on touch screens', async () => {
    coarsePointer = true
    await sendFromBox()
    await render({ isStreaming: true })
    await act(async () => box().blur())

    await render({ isStreaming: false })
    expect(document.activeElement).toBe(document.body)
  })
})
