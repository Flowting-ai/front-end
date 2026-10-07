// @vitest-environment jsdom
//
// The chat box with queuing on (allowQueue): while a reply streams, Enter and a
// Queue button beside Stop hand the message over to be queued, files can still
// be added, and ArrowUp in an empty box brings a queued message back to edit.

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
const onAdd = vi.fn()
const onFilePaste = vi.fn()
let recall: (() => boolean) | undefined

interface HarnessProps {
  isStreaming?: boolean
  allowQueue?: boolean
  sendQueues?: boolean
  focusRequest?: number
  initialValue?: string
}

function Harness({ isStreaming = false, allowQueue = true, sendQueues = false, focusRequest, initialValue = '' }: HarnessProps) {
  const [value, setValue] = useState(initialValue)
  return (
    <ChatInput
      value={value}
      onChange={setValue}
      onSend={onSend}
      onStop={onStop}
      onAdd={onAdd}
      onFilePaste={onFilePaste}
      isStreaming={isStreaming}
      allowQueue={allowQueue}
      sendQueues={sendQueues}
      onRecallQueued={recall}
      focusRequest={focusRequest}
    />
  )
}

beforeAll(() => {
  class Stub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: Stub, IntersectionObserver: Stub })
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  vi.resetAllMocks()
  recall = undefined
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
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)

async function render(props: HarnessProps = {}) {
  await act(async () => root.render(<Harness {...props} />))
}

async function type(text: string) {
  const el = box()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function press(key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  await act(async () => { box().dispatchEvent(event) })
  return event
}

describe('ChatInput with queuing, while a reply streams', () => {
  it('queues on Enter and empties the box', async () => {
    await render({ isStreaming: true })
    await type('and then this')
    const event = await press('Enter')
    expect(event.defaultPrevented).toBe(true)
    expect(onSend).toHaveBeenCalledWith('and then this')
    expect(box().value).toBe('')
  })

  it('shows Queue beside Stop once there is something to send', async () => {
    await render({ isStreaming: true })
    expect(button('Stop generation')).not.toBeNull()
    expect(button('Queue message')).toBeNull()

    await type('next')
    expect(button('Stop generation')).not.toBeNull()
    expect(button('Queue message')).not.toBeNull()

    await act(async () => button('Queue message')!.click())
    expect(onSend).toHaveBeenCalledWith('next')
    expect(onStop).not.toHaveBeenCalled()
  })

  it('still stops the reply from Stop while a message is typed', async () => {
    await render({ isStreaming: true })
    await type('next')
    await act(async () => button('Stop generation')!.click())
    expect(onStop).toHaveBeenCalled()
    expect(onSend).not.toHaveBeenCalled()
    expect(box().value).toBe('next')
  })

  it('keeps adding files open', async () => {
    await render({ isStreaming: true })
    expect(button('Add attachment')!.disabled).toBe(false)
  })

  it('lets pasted images through', async () => {
    await render({ isStreaming: true })
    const image = new File(['x'], 'shot.png', { type: 'image/png' })
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    Object.assign(paste, { clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }] } })
    await act(async () => { box().dispatchEvent(paste) })
    expect(onFilePaste).toHaveBeenCalledWith([image])
  })
})

describe('ChatInput without queuing', () => {
  it('keeps holding the send back while a reply streams', async () => {
    await render({ isStreaming: true, allowQueue: false })
    await type('next')
    await press('Enter')
    expect(onSend).not.toHaveBeenCalled()
    expect(button('Queue message')).toBeNull()
    expect(button('Add attachment')!.disabled).toBe(true)
  })
})

describe('ChatInput and the queued message', () => {
  it('labels the send button Queue while a send would be queued', async () => {
    await render({ sendQueues: true })
    await type('more')
    expect(button('Queue message')).not.toBeNull()
    expect(button('Send message')).toBeNull()
  })

  it('brings the queued message back on ArrowUp in an empty box', async () => {
    recall = vi.fn(() => true)
    await render({ isStreaming: true })
    const event = await press('ArrowUp')
    expect(recall).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves ArrowUp alone once the box has text', async () => {
    recall = vi.fn(() => true)
    await render({ isStreaming: true })
    await type('line one')
    const event = await press('ArrowUp')
    expect(recall).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('focuses the box, caret at the end, on request', async () => {
    await render({ initialValue: 'back in the box' })
    expect(document.activeElement).not.toBe(box())
    await render({ initialValue: 'back in the box', focusRequest: 1 })
    expect(document.activeElement).toBe(box())
    expect(box().selectionStart).toBe('back in the box'.length)
  })
})
