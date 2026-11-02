// @vitest-environment jsdom
//
// The overview's rendered DOM pinned as snapshots in its main states (empty, working with
// a to-do list, finished with every section populated, stopped/failed, long lists), plus
// the section toggles, "Show more" and the Download-all control. Identity lookups are
// stubbed so the snapshots don't depend on the network.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityItem, ActivityStatus, UIMessage } from '@/types/chat'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/components/ContextPanel/identity', () => ({
  AgentFace: ({ name, handle }: { name: string; handle?: string }) => <span data-testid="face" data-handle={handle}>{name}</span>,
  ConnectorLogo: ({ connector }: { connector: { slug?: string; name: string } }) => <span data-testid="logo">{connector.name}</span>,
  connectorSpecialistSlug: (handle: string | undefined) => (handle?.endsWith('-specialist') ? handle.split('-')[0] : null),
  useConnectorIdentities: () => new Map(),
}))

const { OverviewView } = await import('@/components/ContextPanel/Overview')

const AT = '2026-10-04T12:00:00.000Z'
const T0 = Date.parse(AT)

const step = (id: string, type: ActivityItem['type'], label: string, status: ActivityStatus = 'done', extra: Partial<ActivityItem> = {}): ActivityItem =>
  ({ id, type, label, status, ...extra })
const user = (id: string, extra: Partial<UIMessage> = {}): UIMessage =>
  ({ id, role: 'user', content: 'q', created_at: AT, chat_id: 'c', ...extra })
const reply = (id: string, extra: Partial<UIMessage> = {}): UIMessage =>
  ({ id, reactKey: id, role: 'assistant', content: '', created_at: AT, chat_id: 'c', ...extra })

const populated: UIMessage[] = [
  user('u1', { attachments: [{ id: 'f1', file_name: 'brief.docx', file_type: 'application/msword', url: 'https://f/brief.docx' } as never] }),
  reply('a1', {
    activities: [
      step('g1', 'agent', 'Analyst', 'done', { agentHandle: 'analyst', durationS: 12.4, detail: 'Read the brief' }),
      step('g2', 'agent', 'Gmail', 'error', { agentHandle: 'gmail-specialist' }),
      step('c1', 'tool-call', 'x', 'done', { toolName: 'notion-search-pages' }),
      step('c2', 'tool-call', 'x', 'done', { toolName: 'notion-read-page' }),
      step('c3', 'tool-call', 'x', 'error', { toolName: 'gmail-send-email' }),
      step('s1', 'skills', 'pdf'),
      step('s2', 'skills', 'docx', 'stopped'),
      step('w1', 'web-search', 'Searching', 'done', { results: [{ title: 'Found', url: 'https://found.example.com/a' }] }),
    ],
    webCitations: [{ title: 'Cited', url: 'https://www.cited.example.com/p?x=1' }, { title: '', url: 'https://notitle.example.com' }],
    generatedFiles: [{ url: 'https://f/1', filename: 'Report.pdf' }, { url: 'https://f/2', filename: 'Chart.png', mimeType: 'image/png' }],
    images: [{ url: 'https://f/img' } as never],
    plan: [
      { id: 'p1', title: 'Read', status: 'completed' },
      { id: 'p2', title: 'Write', status: 'failed' },
    ],
  }),
]

const working: UIMessage[] = [
  user('u1'),
  reply('a1', {
    isLoading: true,
    activities: [step('t1', 'tool-call', 'Reading page', 'executing', { progressMessage: 'Half way', toolName: 'notion-read-page' })],
    plan: [
      { id: 'p1', title: 'Search', status: 'completed' },
      { id: 'p2', title: 'Read', status: 'in_progress' },
      { id: 'p3', title: 'Write', status: 'pending' },
    ],
  }),
]

const long: UIMessage[] = [
  user('u1'),
  reply('a1', {
    activities: Array.from({ length: 8 }, (_, i) => step(`g${i}`, 'agent', `Agent ${i}`)),
    webCitations: Array.from({ length: 7 }, (_, i) => ({ title: `S${i}`, url: `https://s${i}.example.com` })),
  }),
]

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(T0 + 42_000)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

const render = (messages: UIMessage[], timing?: { startedAt: number; finishedAt?: number }) => {
  act(() => root.render(<OverviewView messages={messages} timing={timing} />))
  return host.innerHTML
}

const toggle = (title: string) =>
  [...host.querySelectorAll('button[aria-expanded]')].find(button => button.textContent === title) as HTMLButtonElement

describe('OverviewView DOM', () => {
  it('empty chat', () => {
    expect(render([])).toMatchSnapshot()
  })

  it('a reply with nothing in it', () => {
    expect(render([user('u'), reply('a')])).toMatchSnapshot()
  })

  it('working with a to-do list, ticking', () => {
    expect(render(working, { startedAt: T0 })).toMatchSnapshot()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(host.innerHTML).toMatchSnapshot()
  })

  it('finished with every section populated', () => {
    expect(render(populated, { startedAt: T0, finishedAt: T0 + 79_000 })).toMatchSnapshot()
  })

  it('stopped and failed turns', () => {
    expect(render([user('u'), reply('a', { stoppedByUser: true })])).toMatchSnapshot()
    expect(render([user('u'), reply('b', { isError: true })])).toMatchSnapshot()
  })

  it('folds long lists and expands them', () => {
    expect(render(long)).toMatchSnapshot()
    const more = [...host.querySelectorAll('button')].find(button => button.textContent === 'Show 2 more agents')!
    act(() => more.click())
    expect(host.innerHTML).toMatchSnapshot()
    const less = [...host.querySelectorAll('button')].find(button => button.textContent === 'Show less')!
    act(() => less.click())
    expect(host.innerHTML).toContain('Show 2 more agents')
  })

  it('toggles sections open and closed', () => {
    render(populated)
    act(() => toggle('Agents').click())
    act(() => toggle('Skills').click())
    act(() => toggle('To-dos').click())
    expect(host.innerHTML).toMatchSnapshot()
    act(() => toggle('Agents').click())
    expect(toggle('Agents').getAttribute('aria-expanded')).toBe('true')
  })

  it('lists the chat\'s Library files above the web pages, under one count', () => {
    const onToggle = vi.fn()
    const library = {
      count: 2,
      toggle: onToggle,
      rows: [
        { id: 'lib1', ref: { id: 'lib1', state: 'open', title: 'Return policy', format: 'pdf' }, status: 'cited', off: false, name: 'Return policy', detail: 'Cited in answer', canToggle: true },
        { id: 'lib2', ref: undefined, status: 'loading', off: false, name: 'Loading…', detail: 'Attached', canToggle: false },
      ] as const,
    }
    act(() => root.render(<OverviewView messages={populated} timing={undefined} library={{ ...library, rows: [...library.rows] }} />))
    const section = toggle('Sources').closest('section')!
    // 2 Library files + 1 other upload (brief.docx) + 3 web pages (cited, untitled, found by search).
    expect(section.querySelector('h3 + span')?.textContent).toBe('6')
    // The upload is an input: in Sources, not in Outputs (which keeps only what the chat made).
    expect(section.textContent).toContain('brief.docx')
    expect(toggle('Outputs').closest('section')!.textContent).not.toContain('brief.docx')
    const labels = [...section.querySelectorAll('[data-source-file], a')].map(el => el.textContent)
    expect(labels[0]).toContain('Return policy')
    expect(labels[1]).toContain('Loading…')
    expect(labels.slice(2).length).toBeGreaterThan(0)
    expect(section.textContent).not.toContain('File deleted')
    // Only the loaded file has a switch, and it toggles that file.
    const switches = section.querySelectorAll('[role="switch"]')
    expect(switches).toHaveLength(1)
    expect(switches[0].getAttribute('aria-label')).toBe('Use Return policy in answers')
    act(() => (switches[0] as HTMLButtonElement).click())
    expect(onToggle).toHaveBeenCalledWith('lib1')
  })

  it('downloads a document and all created documents', () => {
    render(populated)
    const clicks: string[] = []
    const original = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { clicks.push(this.getAttribute('href')!) }
    try {
      act(() => (host.querySelector('button[aria-label^="Download all"]') as HTMLButtonElement).click())
      act(() => { vi.advanceTimersByTime(1000) })
      const row = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('brief.docx'))!
      act(() => row.click())
    } finally {
      HTMLAnchorElement.prototype.click = original
    }
    expect(clicks).toMatchSnapshot()
  })
})
