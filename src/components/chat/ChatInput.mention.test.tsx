// @vitest-environment jsdom
//
// `@agent` mentions in the chat box: the list opens while typing `@word`, narrows
// as you type, is driven by the keyboard, and picking an agent removes the
// `@word` and hands the agent to the host.

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function agent(id: string, name: string): SelectedPersonaInfo {
  return {
    id, name, handle: `@${name.toLowerCase().replace(/\s+/g, '-')}`, imageUrl: null, modelId: 'm', activeVersionId: `v-${id}`,
    systemPrompt: null, temperature: null, visibility: 'private', ownedByViewer: true, description: '', tags: [], paused: false, shared: false,
  }
}
const AGENTS = [agent('1', 'Support Triage'), agent('2', 'Contract Reviewer'), agent('3', 'Email Support Writer')]

const source = vi.hoisted(() => ({ loading: false, calls: [] as boolean[] }))
vi.mock('@/hooks/use-selectable-chat-personas', () => ({
  useSelectableChatPersonas: (open: boolean) => {
    source.calls.push(open)
    return { personas: open && !source.loading ? AGENTS_FOR_MOCK() : [], loading: source.loading }
  },
}))
function AGENTS_FOR_MOCK() { return AGENTS }
vi.mock('react-speech-recognition', () => ({
  default: { startListening: vi.fn(), stopListening: vi.fn(), abortListening: vi.fn() },
  useSpeechRecognition: () => ({ transcript: '', listening: false, resetTranscript: vi.fn(), browserSupportsSpeechRecognition: false }),
}))
vi.mock('@/lib/analytics/events', () => ({ trackFeature: vi.fn(), trackBrowserEvent: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { ChatInput } from './ChatInput'

let container: HTMLDivElement
let root: Root
const onSelect = vi.fn()
const onSend = vi.fn()
const latest = { current: '' }

function Harness({ withMention = true, selectedAgentId = null as string | null }) {
  const [value, setValue] = useState('')
  React.useEffect(() => { latest.current = value }, [value])
  return (
    <ChatInput
      value={value}
      onChange={setValue}
      onSend={onSend}
      agentMention={withMention ? { onSelect, selectedAgentId } : undefined}
    />
  )
}

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
  source.loading = false
  source.calls = []
  latest.current = ''
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
const menu = () => document.querySelector('[role="listbox"]')
const options = () => Array.from(document.querySelectorAll('[role="option"]')).map(el => el.textContent)

async function mount(props: Parameters<typeof Harness>[0] = {}) {
  await act(async () => root.render(<Harness {...props} />))
}

/** Types by setting the whole value with the caret at the end, as the browser would. */
async function type(text: string, caret = text.length) {
  const el = box()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text)
    el.setSelectionRange(caret, caret)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function press(key: string) {
  await act(async () => { box().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })) })
}

describe('@agent mentions in the chat box', () => {
  it('opens the agent list on @ and narrows it as you type', async () => {
    await mount()
    expect(menu()).toBeNull()

    await type('@')
    expect(options()).toEqual(['Support Triage', 'Contract Reviewer', 'Email Support Writer'])

    await type('@sup')
    expect(options()).toEqual(['Support Triage', 'Email Support Writer'])

    await type('@zzz')
    expect(document.body.textContent).toContain('No agents match')
  })

  it('does not open for an email address or without the feature switched on', async () => {
    await mount()
    await type('write to me@example.com')
    expect(menu()).toBeNull()

    await act(async () => root.unmount())
    root = createRoot(container)
    await mount({ withMention: false })
    await type('@')
    expect(menu()).toBeNull()
  })

  it('only loads agents while a mention is being typed', async () => {
    await mount()
    expect(source.calls.every(open => open === false)).toBe(true)
    await type('@')
    expect(source.calls).toContain(true)
  })

  it('moves with the arrow keys and picks with Enter, removing the @word', async () => {
    await mount()
    await type('@sup')
    await press('ArrowDown')
    await press('Enter')

    expect(onSelect).toHaveBeenCalledWith(AGENTS[2])
    expect(latest.current).toBe('')
    expect(onSend).not.toHaveBeenCalled()
    expect(menu()).toBeNull()
  })

  it('wraps around at the ends of the list', async () => {
    await mount()
    await type('@')
    await press('ArrowUp')
    await press('Enter')
    expect(onSelect).toHaveBeenCalledWith(AGENTS[2])
  })

  it('picks with Tab, and keeps the rest of the message', async () => {
    await mount()
    await type('summarise this with @contr', 'summarise this with @contr'.length)
    await press('Tab')
    expect(onSelect).toHaveBeenCalledWith(AGENTS[1])
    expect(latest.current).toBe('summarise this with ')
  })

  it('picks by clicking, without losing the text around the mention', async () => {
    await mount()
    await type('hey @rev there', 8)
    const row = document.querySelector<HTMLElement>('[role="option"] button, [role="option"] [role="button"], [role="option"] > *')!
    await act(async () => { row.click() })
    expect(onSelect).toHaveBeenCalledWith(AGENTS[1])
    expect(latest.current).toBe('hey there')
  })

  it('closes on Escape and lets Enter send the message as usual', async () => {
    await mount()
    await type('@sup')
    await press('Escape')
    expect(menu()).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()

    await press('Enter')
    expect(onSend).toHaveBeenCalledWith('@sup')
  })

  it('sends normally when no agent matches', async () => {
    await mount()
    await type('@zzz')
    await press('Enter')
    expect(onSelect).not.toHaveBeenCalled()
    expect(onSend).toHaveBeenCalledWith('@zzz')
  })

  it('reopens for a new mention after one was dismissed', async () => {
    await mount()
    await type('@sup')
    await press('Escape')
    await type('@sup and @con')
    expect(options()).toEqual(['Contract Reviewer'])
  })

  it('shows a loading row while the agents are on their way', async () => {
    source.loading = true
    await mount()
    await type('@')
    expect(document.body.textContent).toContain('Loading…')
  })
})
