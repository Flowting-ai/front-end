import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BrowserScreen } from '@/components/BrowserPanel/BrowserScreen'
import { browserStepsOf, toBrowserLiveView, type BrowserSession, type BrowserSessionStatus } from '@/components/BrowserPanel/use-browser-session'
import type { UIMessage } from '@/types/chat'

const LIVE_URL = 'https://api.example.com/browser/access/token/view/screen.html?host=api.example.com'

function session(status: BrowserSessionStatus, extra: Partial<BrowserSession> = {}): BrowserSession {
  return {
    status,
    liveView: status === 'live' ? { url: LIVE_URL, viewOnly: true, expiresAt: null } : null,
    steps: [],
    reconnect: () => {},
    ...extra,
  }
}

const render = (value: BrowserSession, expanded = false) =>
  renderToStaticMarkup(<BrowserScreen session={value} expanded={expanded} onExpandedChange={() => {}} />)

describe('toBrowserLiveView', () => {
  it('maps the backend response and defaults to view-only', () => {
    expect(toBrowserLiveView({ url: 'u' })).toEqual({ url: 'u', viewOnly: true, expiresAt: null })
    expect(toBrowserLiveView({ url: 'u', view_only: false, expires_at: '2026-10-04T12:36:00Z' }))
      .toEqual({ url: 'u', viewOnly: false, expiresAt: '2026-10-04T12:36:00Z' })
  })
})

describe('browserStepsOf', () => {
  it('lists browser activity across replies, oldest first, with the most specific label', () => {
    const messages: UIMessage[] = [
      { id: 'a1', role: 'assistant', content: '', created_at: '', chat_id: 'c', activities: [
        { id: 'b1', type: 'browser', status: 'done', label: 'Opened site' },
        { id: 'w1', type: 'web-search', status: 'done', label: 'Not a browser step' },
      ] },
      { id: 'u', role: 'user', content: '', created_at: '', chat_id: 'c' },
      { id: 'a2', role: 'assistant', content: '', created_at: '', chat_id: 'c', activities: [
        { id: 'b2', type: 'browser', status: 'executing', label: 'Clicking', progressMessage: 'Clicking “Search”' },
        { id: 'b3', type: 'browser', status: 'start' },
      ] },
    ]
    expect(browserStepsOf(messages)).toEqual([
      { id: 'b1', label: 'Opened site', status: 'done' },
      { id: 'b2', label: 'Clicking “Search”', status: 'executing' },
      { id: 'b3', label: 'Browsing', status: 'start' },
    ])
  })
})

describe('BrowserScreen — thumbnail', () => {
  it('idle: explains itself, offers no expand', () => {
    const html = render(session('idle'))
    expect(html).toContain('No browser running')
    expect(html).not.toContain('Expand browser to full screen')
  })

  it('connecting: says so, and can already be expanded', () => {
    const html = render(session('connecting'))
    expect(html).toContain('Starting the browser…')
    expect(html).toContain('Connecting')
    expect(html).toContain('Expand browser to full screen')
  })

  it('live: frames the live view, inert, out of the tab order', () => {
    const html = render(session('live'))
    expect(html).toContain(`src="${LIVE_URL.replace(/&/g, '&amp;')}"`)
    expect(html).toMatch(/<iframe[^>]*tabindex="-1"/)
    expect(html).toMatch(/<iframe[^>]*pointer-events:none/)
    expect(html).toMatch(/<iframe[^>]*referrerPolicy="no-referrer"|<iframe[^>]*referrerpolicy="no-referrer"/)
    expect(html).toContain('Live')
    expect(html).toContain('Expand browser to full screen')
  })

  it('ended: offers Resume, not expand', () => {
    const html = render(session('ended'))
    expect(html).toContain('Browser session ended')
    expect(html).toContain('Resume')
    expect(html).not.toContain('Expand browser to full screen')
  })

  it('error: offers Try again', () => {
    const html = render(session('error'))
    expect(html).toContain('Couldn’t connect to the browser')
    expect(html).toContain('Try again')
  })
})

describe('BrowserScreen — full screen', () => {
  it('is a modal dialog with a minimize control and the page address', () => {
    const html = render(session('live', { pageUrl: 'https://skyfare.example/flights?from=SFO' }), true)
    expect(html).toMatch(/role="dialog"[^>]*aria-modal="true"|aria-modal="true"[^>]*role="dialog"/)
    expect(html).toContain('Minimize browser')
    expect(html).toContain('skyfare.example/flights?from=SFO')
    expect(html).toContain('Showing in full screen')
    expect(html).not.toContain('Expand browser to full screen')
  })

  it('view-only: says so and offers no control', () => {
    const html = render(session('live'), true)
    expect(html).toContain('View only')
    expect(html).not.toContain('Take control')
  })

  it('controllable: offers Take control, starting not pressed', () => {
    const html = render(session('live', { liveView: { url: LIVE_URL, viewOnly: false, expiresAt: null } }), true)
    expect(html).toContain('Take control')
    expect(html).toMatch(/aria-pressed="false"/)
    expect(html).not.toContain('You’re controlling the browser')
  })

  it('narrates the agent’s current step over the page', () => {
    expect(render(session('live', { currentAction: 'Clicking “Search flights”' }), true)).toContain('Clicking “Search flights”')
  })

  it('shows “No page open” before the backend reports a URL', () => {
    expect(render(session('connecting'), true)).toContain('No page open')
  })
})
