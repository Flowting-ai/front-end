import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { deriveOverview, formatElapsed, OverviewView, stepCount, turnState } from '@/components/ContextPanel/Overview'
import { connectorSpecialistSlug, matchPersona } from '@/components/ContextPanel/identity'
import type { ActivityItem, ActivityStatus, UIMessage } from '@/types/chat'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AT = '2026-10-04T12:00:00.000Z'
const T0 = Date.parse(AT)

const step = (id: string, type: ActivityItem['type'], label: string, status: ActivityStatus = 'done', extra: Partial<ActivityItem> = {}): ActivityItem =>
  ({ id, type, label, status, ...extra })

const user = (id: string, extra: Partial<UIMessage> = {}): UIMessage =>
  ({ id, role: 'user', content: 'q', created_at: AT, chat_id: 'c', ...extra })

const reply = (id: string, extra: Partial<UIMessage> = {}): UIMessage =>
  ({ id, reactKey: id, role: 'assistant', content: '', created_at: AT, chat_id: 'c', ...extra })

const search = (id: string, urls: string[]) =>
  step(id, 'web-search', 'Searching', 'done', { results: urls.map(url => ({ title: `Title ${url}`, url })) })

// AgentFace reads the viewer's agents through react-query, as the app's root layout provides.
const render = (messages: UIMessage[], timing?: { startedAt: number; finishedAt?: number }) =>
  renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><OverviewView messages={messages} timing={timing} /></QueryClientProvider>)

/** aria-expanded of the toggle whose visually hidden label is `title`. */
function expanded(html: string, title: string): string | undefined {
  const match = new RegExp(`aria-expanded="(true|false)"[^>]*>(?:(?!</button>).)*?>${title}</span>`).exec(html)
  return match?.[1]
}

// ── deriveOverview ────────────────────────────────────────────────────────────

describe('deriveOverview', () => {
  it('takes progress steps from the latest turn only', () => {
    const data = deriveOverview([
      reply('a1', { activities: [step('old', 'tool-call', 'Old')] }),
      user('u2'),
      reply('a2', { activities: [step('n1', 'tool-call', 'New 1'), step('n2', 'tool-call', 'New 2')] }),
    ])
    expect(data.steps.map(s => s.id)).toEqual(['n1', 'n2'])
    expect(data.latest?.id).toBe('a2')
  })

  it('groups connector calls by app across turns, flagging running and failed', () => {
    const data = deriveOverview([
      reply('a1', { activities: [step('1', 'tool-call', 'x', 'done', { toolName: 'notion-search-pages' })] }),
      reply('a2', { activities: [
        step('2', 'tool-call', 'x', 'executing', { toolName: 'notion-read-page' }),
        step('3', 'tool-call', 'x', 'error', { toolName: 'gmail-send-email' }),
        step('4', 'tool-call', 'x', 'done', { toolName: 'read_url' }),
      ] }),
    ])
    expect(data.connectors).toEqual([
      expect.objectContaining({ slug: 'notion', used: 2, active: true, failed: false }),
      expect.objectContaining({ slug: 'gmail', used: 1, active: false, failed: true }),
    ])
  })

  it('collects sources from citations, saved sources and searches — de-duplicated, newest turn first', () => {
    const data = deriveOverview([
      reply('a1', {
        sources: [{ id: 's', url: 'https://old.example.com/a', title: 'Old' }],
        activities: [search('s1', ['https://irgc.iowa.gov/sports-wagering'])],
      }),
      reply('a2', {
        webCitations: [{ title: 'Cited', url: 'https://new.example.com' }],
        activities: [search('s2', ['https://irgc.iowa.gov/sports-wagering/', 'https://irgc.iowa.gov/sports-wagering?ref=x', 'ftp://nope.example.com'])],
      }),
    ])
    expect(data.sources.map(s => s.url)).toEqual([
      'https://new.example.com',
      'https://irgc.iowa.gov/sports-wagering/',
      'https://old.example.com/a',
    ])
    expect(data.sources[1].domain).toBe('irgc.iowa.gov')
  })

  it('falls back to the domain when a source has no title', () => {
    const data = deriveOverview([reply('a', { webCitations: [{ title: '  ', url: 'https://www.example.com/x' }] })])
    expect(data.sources[0].title).toBe('example.com')
  })

  it('lists created files, generated images and finished uploads — newest first', () => {
    const data = deriveOverview([
      user('u1', { attachments: [
        { id: 'up', file_name: 'Notes.pdf', file_type: 'application/pdf', file_size: 1, url: 'https://f/notes' },
        { id: 'busy', file_name: 'Busy.pdf', file_type: 'application/pdf', file_size: 1, url: 'https://f/busy', uploading: true },
        { id: 'nourl', file_name: 'Local.pdf', file_type: 'application/pdf', file_size: 1 },
      ] }),
      reply('a1', { generatedFiles: [{ url: 'https://f/model', filename: 'Model.xlsx' }], images: [{ url: 'https://f/img' }] }),
    ])
    expect(data.documents.map(d => [d.name, d.kind, d.image])).toEqual([
      ['Model.xlsx', 'created', false],
      ['Image 1.png', 'created', true],
      ['Notes.pdf', 'uploaded', false],
    ])
  })

  it('lists each skill once and keeps agents', () => {
    const data = deriveOverview([
      reply('a1', { activities: [step('k1', 'skills', 'research-assistant'), step('g1', 'agent', 'Analyst')] }),
      reply('a2', { activities: [step('k2', 'skills', 'research-assistant'), step('k3', 'skills', 'office/xlsx')] }),
    ])
    expect(data.skills.map(s => s.name)).toEqual(['research-assistant', 'office/xlsx'])
    expect(data.agents.map(a => a.label)).toEqual(['Analyst'])
  })
})

describe('turnState / formatElapsed', () => {
  it('reads the turn state off the latest reply', () => {
    expect(turnState(undefined)).toBe('idle')
    expect(turnState(reply('a', { isLoading: true }))).toBe('working')
    expect(turnState(reply('a', { stoppedByUser: true }))).toBe('stopped')
    expect(turnState(reply('a', { isError: true }))).toBe('error')
    expect(turnState(reply('a'))).toBe('done')
  })

  it('formats seconds, minutes and hours', () => {
    expect(formatElapsed(9)).toBe('9s')
    expect(formatElapsed(79)).toBe('1m 19s')
    expect(formatElapsed(3725)).toBe('1h 02m')
  })
})

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('OverviewView', () => {
  it('shows one empty card and no sections for an empty chat', () => {
    const html = render([])
    expect(html).toContain('Nothing here yet')
    expect(html).not.toContain('aria-expanded')
  })

  it('renders all six sections, in order', () => {
    const html = render([user('u'), reply('a')])
    const order = ['Progress', 'Agents', 'Connectors', 'Sources', 'Documents', 'Skills'].map(title => html.indexOf(`>${title}</h3>`))
    expect(order.every(index => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('opens progress and populated sections; keeps empty ones closed', () => {
    const html = render([user('u'), reply('a', { activities: [step('g', 'agent', 'Analyst')], webCitations: [{ title: 'T', url: 'https://x.example.com' }] })])
    expect(expanded(html, 'Progress')).toBe('true')
    expect(expanded(html, 'Agents')).toBe('true')
    expect(expanded(html, 'Sources')).toBe('true')
    expect(expanded(html, 'Connectors')).toBe('false')
    expect(expanded(html, 'Documents')).toBe('false')
    expect(expanded(html, 'Skills')).toBe('false')
  })

  it('never strikes finished steps through', () => {
    const html = render([user('u'), reply('a', { activities: [step('1', 'tool-call', 'Finished'), step('2', 'tool-call', 'Running', 'executing'), step('3', 'tool-call', 'Failed', 'error')] })])
    expect(html).toContain('Finished')
    expect(html).not.toMatch(/line-through/)
  })

  it('while working, lists every step with no “x of y steps” summary line, and animates the running one', () => {
    const html = render([user('u'), reply('a', { isLoading: true, activities: [step('1', 'tool-call', 'One'), step('2', 'tool-call', 'Two', 'executing')] })], { startedAt: T0 })
    expect(html).toContain('Working')
    expect(html).toContain('One')
    // The old visible summary is gone; the pill's compact 1/2 reads this out via its aria-label.
    expect(html).not.toMatch(/>\d+ of \d+ steps</)
    // The running label is drawn as clipped gradient text (the shimmer); a done one is plain.
    expect(html).toMatch(/background-clip:text[^>]*>Two</)
    expect(html).not.toMatch(/background-clip:text[^>]*>One</)
  })

  it('says “Thinking…” before the first step', () => {
    expect(render([user('u'), reply('a', { isLoading: true })], { startedAt: T0 })).toContain('Thinking…')
  })

  it('shows the finished turn’s execution time once, in the header', () => {
    const html = render([user('u'), reply('a', { activities: [step('1', 'tool-call', 'One')] })], { startedAt: T0, finishedAt: T0 + 79_000 })
    expect(html).toContain('Done')
    expect(html.match(/1m 19s/g)).toHaveLength(1)
    expect(html).not.toContain('Took')
  })

  it('shows no time for a turn without timing (reopened from history)', () => {
    const html = render([user('u'), reply('a', { activities: [step('1', 'tool-call', 'One')] })], undefined)
    expect(html).not.toMatch(/\d+s</)
  })

  it('puts the turn’s status in a header pill — no heading, no thick bar', () => {
    const done = render([user('u'), reply('a', { activities: [step('1', 'tool-call', 'One')] })], { startedAt: T0, finishedAt: T0 + 79_000 })
    expect(done).toMatch(/role="status"[^>]*>(?:(?!<\/span>).)*Done/)
    expect(done).not.toContain('height:6px')
    expect(render([user('u'), reply('a', { stoppedByUser: true })])).toMatch(/role="status"[^>]*>(?:.(?!role=))*?Stopped/)
    expect(render([user('u'), reply('a', { isError: true })])).toMatch(/role="status"[^>]*>(?:.(?!role=))*?Failed/)
    expect(render([user('u'), reply('a', { isLoading: true })], { startedAt: T0 })).toMatch(/role="status"[^>]*>(?:.(?!role=))*?Working/)
  })

  it('sweeps a hairline under the header only while working', () => {
    const hairline = /height:2px;overflow:hidden/
    expect(render([user('u'), reply('a', { isLoading: true })], { startedAt: T0 })).toMatch(hairline)
    expect(render([user('u'), reply('a')], { startedAt: T0, finishedAt: T0 + 1000 })).not.toMatch(hairline)
  })

  it('marks agents and skills that were cut short or failed', () => {
    const html = render([user('u'), reply('a', { stoppedByUser: true, activities: [
      step('g1', 'agent', 'Editor', 'stopped'),
      step('k1', 'skills', 'office/xlsx', 'error'),
    ] })])
    expect(html).toContain('Stopped</span>')
    expect(html).toContain('Failed</span>')
  })

  it('gives a turn with no steps one row that says why', () => {
    expect(render([user('u'), reply('a')])).toContain('Answered directly — no tools needed')
    expect(render([user('u'), reply('a', { stoppedByUser: true })])).toContain('Stopped before any steps ran')
    expect(render([user('u'), reply('a', { isError: true })])).toContain('Something went wrong before any steps ran')
  })

  it('shows every progress step, but folds the other long lists behind “Show more”', () => {
    const steps = Array.from({ length: 11 }, (_, i) => step(`s${i}`, 'tool-call', `Step ${i}`))
    const html = render([user('u'), reply('a', {
      activities: steps,
      webCitations: Array.from({ length: 9 }, (_, i) => ({ title: `Source ${i}`, url: `https://s${i}.example.com` })),
    })])
    expect(html).not.toContain('earlier step')
    expect(html).toContain('>Step 0<')
    expect(html).toContain('>Step 10<')
    expect(html).toContain('Show 3 more sources')
  })

  it('says “1 more source”, not “1 more sources”', () => {
    const html = render([user('u'), reply('a', { webCitations: Array.from({ length: 7 }, (_, i) => ({ title: `S${i}`, url: `https://s${i}.example.com` })) })])
    expect(html).toContain('Show 1 more source<')
  })

  it('offers Download all only for more than one created file', () => {
    const one = render([user('u'), reply('a', { generatedFiles: [{ url: 'https://f/1', filename: 'One.pdf' }] })])
    const two = render([user('u'), reply('a', { generatedFiles: [{ url: 'https://f/1', filename: 'One.pdf' }, { url: 'https://f/2', filename: 'Two.pdf' }] })])
    expect(one).not.toContain('Download all')
    expect(two).toContain('Download all 2 documents')
  })

  it('links sources out in a new tab', () => {
    const html = render([user('u'), reply('a', { webCitations: [{ title: 'Cited', url: 'https://x.example.com/p' }] })])
    expect(html).toMatch(/<a href="https:\/\/x\.example\.com\/p" target="_blank" rel="noopener noreferrer"/)
  })
})

describe('agent and connector faces', () => {
  const personas = [
    { id: 'p1', name: 'Support Triage', handle: '@support-triage' },
    { id: 'p2', name: 'Competitive Analyst', handle: '@comp-analyst' },
  ]

  it('matches the viewer’s agent by handle (with or without @), then by name', () => {
    expect(matchPersona(personas, 'Anything', 'support-triage')?.id).toBe('p1')
    expect(matchPersona(personas, 'Anything', '@Comp-Analyst')?.id).toBe('p2')
    expect(matchPersona(personas, 'competitive analyst', undefined)?.id).toBe('p2')
    expect(matchPersona(personas, 'Researcher', 'researcher')).toBeUndefined()
    expect(matchPersona(undefined, 'Support Triage', 'support-triage')).toBeUndefined()
  })

  it('treats a handle as a connector slug only when it can be one', () => {
    expect(connectorSpecialistSlug('gmail')).toBe('gmail')
    expect(connectorSpecialistSlug('google_drive')).toBe('google_drive')
    expect(connectorSpecialistSlug('researcher')).toBeNull()
    expect(connectorSpecialistSlug('browser')).toBeNull()
    expect(connectorSpecialistSlug('support-triage')).toBeNull()
    expect(connectorSpecialistSlug(undefined)).toBeNull()
  })

  it('draws an agent with its live avatar, not a generic icon', () => {
    const html = render([user('u'), reply('a', { activities: [step('g', 'agent', 'Competitive analyst', 'done', { agentHandle: 'comp-analyst' })] })])
    // AnimatedPersonaAvatar — the /agents gooey avatar — inside MentionAvatar's tile.
    expect(html).toContain('pa-goo-')
  })
})

describe('plan card and step count', () => {
  const plan = [
    { id: 'p1', title: 'Load skills', status: 'completed' as const },
    { id: 'p2', title: 'Research the market', status: 'in_progress' as const },
    { id: 'p3', title: 'Draft the report', status: 'pending' as const },
    { id: 'p4', title: 'Build the model', status: 'pending' as const },
    { id: 'p5', title: 'Send it', status: 'pending' as const },
  ]

  it('shows the whole plan up front, waiting steps included', () => {
    const html = render([user('u'), reply('a', { isLoading: true, plan })], { startedAt: T0 })
    for (const item of plan) expect(html).toContain(item.title)
    expect(html).toContain('aria-label="Plan"')
    expect(html).toMatch(/aria-current="step"[^]*Research the market/)
  })

  it('fades waiting steps; the running and finished ones are full strength', () => {
    const html = render([user('u'), reply('a', { isLoading: true, plan })], { startedAt: T0 })
    const opacityOf = (title: string) => new RegExp(`<li[^>]*opacity:([\\d.]+)[^>]*>(?:(?!</li>).)*${title}`).exec(html)?.[1]
    expect(opacityOf('Draft the report')).toBe('0.45')
    expect(opacityOf('Send it')).toBe('0.45')
    expect(opacityOf('Research the market')).toBe('1')
    expect(opacityOf('Load skills')).toBe('1')
  })

  it('gives the running plan step the live tool action as its detail', () => {
    const html = render([user('u'), reply('a', { isLoading: true, plan, activities: [step('t', 'web-search', 'Searching Iowa regulations', 'executing')] })], { startedAt: T0 })
    expect(html).toContain('Searching Iowa regulations')
  })

  it('counts finished plan steps in the status pill, beside the time', () => {
    const html = render([user('u'), reply('a', { isLoading: true, plan })], { startedAt: T0 })
    expect(html).toMatch(/Working<span aria-label="1 of 5 steps done"[^>]*>1\/5<\/span>/)
    const done = render([user('u'), reply('a', { plan: plan.map(item => ({ ...item, status: 'completed' as const })) })], { startedAt: T0, finishedAt: T0 + 112_000 })
    // Count sits to the left of the time: “Done 5/5 · 1m 52s”.
    expect(done).toMatch(/Done<span aria-label="5 of 5 steps done"[^>]*>5\/5<\/span><span[^>]*>· 1m 52s/)
  })

  it('without a plan, counts finished tool steps; with none, shows no count', () => {
    expect(stepCount([step('1', 'tool-call', 'a'), step('2', 'tool-call', 'b', 'executing'), step('3', 'tool-call', 'c', 'error')], null)).toEqual({ done: 1, total: 3 })
    expect(stepCount([], null)).toBeNull()
    expect(stepCount([], plan)).toEqual({ done: 1, total: 5 })
    expect(render([user('u'), reply('a')])).not.toMatch(/\d\/\d/)
  })

  it('hides a detail that only repeats the label in another case', () => {
    const html = render([user('u'), reply('a', { activities: [step('s', 'web-search', 'Searching Iowa betting', 'done', { detail: 'searching iowa betting' })] })])
    expect(html).not.toContain('searching iowa betting')
  })
})
