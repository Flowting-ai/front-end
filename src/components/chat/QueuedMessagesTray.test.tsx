// @vitest-environment jsdom
//
// The tray above the chat box: each queued message on its own row, in send
// order, with Edit / Remove for that message, and what the queue waits for.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueuedMessagesTray } from './QueuedMessagesTray'
import type { QueuedMessage } from '@/lib/message-queue'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
const onEdit = vi.fn()
const onRemove = vi.fn()

const message = (id: string, content: string, files: string[] = []): QueuedMessage => ({
  id,
  content,
  attachments: files.map((name) => ({ id: `att-${name}`, file: new File(['x'], name), uploading: false })),
  mentionedPins: [],
  context: { settings: { pinsEnabled: true } },
})

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
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render(messages: QueuedMessage[], waiting = true) {
  await act(async () => root.render(
    <QueuedMessagesTray
      messages={messages}
      status={messages.length > 1 ? 'sent in order as each reply finishes' : 'sends when this reply finishes'}
      waiting={waiting}
      rowExit="dismissed"
      onEdit={onEdit}
      onRemove={onRemove}
    />,
  ))
}

const rows = () => [...container.querySelectorAll('li')]

describe('QueuedMessagesTray', () => {
  it('shows each queued message on its own row, in send order', async () => {
    await render([message('a', 'how can it help get better'), message('b', 'how exactly')])
    expect(rows().map((row) => row.getAttribute('aria-label'))).toEqual(['Queued message 1', 'Queued message 2'])
    expect(rows()[0].textContent).toContain('how can it help get better')
    expect(rows()[1].textContent).toContain('how exactly')
    expect(container.textContent).toContain('2 queued · sent in order as each reply finishes')
  })

  it('edits and removes the message on that row', async () => {
    await render([message('a', 'first'), message('b', 'second')])
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit queued message 2"]')!.click())
    expect(onEdit).toHaveBeenCalledWith('b')
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Remove queued message 1"]')!.click())
    expect(onRemove).toHaveBeenCalledWith('a')
  })

  it('names a files-only message by its files', async () => {
    await render([message('a', '', ['report.pdf'])])
    expect(rows()[0].textContent).toContain('report.pdf')
    expect(rows()[0].textContent).toContain('1 file')
  })

  it('shimmers the status only while waiting on a reply', async () => {
    await render([message('a', 'first')], true)
    expect(container.querySelector('.kaya-shimmer')?.textContent).toBe('Queued · sends when this reply finishes')
    await render([message('a', 'first')], false)
    expect(container.querySelector('.kaya-shimmer')).toBeNull()
  })

  it('renders nothing with an empty queue', async () => {
    await render([])
    expect(container.querySelector('[aria-label="Queued messages"]')).toBeNull()
  })
})
