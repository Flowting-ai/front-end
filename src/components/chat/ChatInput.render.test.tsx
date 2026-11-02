// @vitest-environment jsdom
//
// DOM snapshots of the chat box across its prop states — a guard that keeps
// its markup, classes and aria labels identical across refactors.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/hooks/use-selectable-chat-personas', () => ({
  useSelectableChatPersonas: () => ({ personas: [], loading: false }),
}))
vi.mock('react-speech-recognition', () => ({
  default: { startListening: vi.fn(), stopListening: vi.fn(), abortListening: vi.fn() },
  useSpeechRecognition: () => ({ transcript: '', listening: false, resetTranscript: vi.fn(), browserSupportsSpeechRecognition: true }),
}))
vi.mock('@/lib/analytics/events', () => ({ trackFeature: vi.fn(), trackBrowserEvent: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { ChatInput, type ChatInputProps } from './ChatInput'

let container: HTMLDivElement
let root: Root

beforeAll(() => {
  class Stub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: Stub, IntersectionObserver: Stub })
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const STATES: Record<string, ChatInputProps> = {
  empty: {},
  typed: { value: 'line one\nline two', onChange: () => {} },
  compact: { compact: true, value: 'hi', onChange: () => {} },
  streaming: { isStreaming: true },
  queueable: { isStreaming: true, allowQueue: true, value: 'next', onChange: () => {} },
  queues: { value: 'x', onChange: () => {}, sendQueues: true },
  disabled: { disabled: true, value: 'x', onChange: () => {} },
  uploading: { hasAttachments: true, sendBlocked: true, attachmentsSlot: <div data-testid="att">chips</div> },
  attachments: { hasAttachments: true, attachmentsSlot: <div data-testid="att">chips</div> },
  menus: { addMenu: <div>add</div>, modelMenu: <div>models</div>, modelName: 'GPT', modelIcon: 'openai' },
  lockedModel: { disabledModelSelector: true, modelName: 'Claude' },
  bare: { hideModelSelector: true, hideAddButton: true, placeholder: 'Ask', textareaLabel: 'Ask box' },
  chips: { chips: <span>chip</span>, pinChips: <span>pin</span>, className: 'extra', style: { margin: 4 }, 'data-testid': 'ci' } as ChatInputProps,
}

describe('ChatInput render', () => {
  for (const [name, props] of Object.entries(STATES)) {
    it(name, async () => {
      await act(async () => root.render(<ChatInput {...props} />))
      expect(container.innerHTML).toMatchSnapshot()
    })
  }
})
