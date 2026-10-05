import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActivityRow, PromptMarkerRow } from '@/components/chat/ActivityRow'
import type { ActivityItem } from '@/types/chat'

function row(activity: Partial<ActivityItem>) {
  return renderToStaticMarkup(
    <ActivityRow activity={{ id: 'a-1', type: 'web-search', status: 'executing', ...activity }} />,
  )
}

describe('ActivityRow detail', () => {
  it('does not repeat the tool name the verb already describes', () => {
    const html = row({ label: 'Searching the web', toolName: 'search_web' })
    expect(html).toContain('Searching the web')
    expect(html).not.toContain('—')
  })

  it('drops a detail that is just the humanised tool name or the verb', () => {
    expect(row({ label: 'Searching the web', toolName: 'search_web', detail: 'search_web' })).not.toContain('—')
    expect(row({ label: 'Searching the web', detail: 'Searching the web' })).not.toContain('—')
    expect(row({ type: 'read-pages', detail: 'reading document' })).not.toContain('—')
  })

  it('keeps a real detail such as the search query', () => {
    expect(row({ label: 'Searching the web', toolName: 'search_web', detail: 'pythagorean theorem history' }))
      .toContain('— pythagorean theorem history')
  })

  it('names the tool when the verb is generic', () => {
    expect(row({ type: 'tool-call', toolName: 'search_pins' })).toContain('— search pins')
    expect(row({ type: 'tool-call', label: 'Running tool', detail: 'search_pins' })).toContain('— search_pins')
  })
})

describe('PromptMarkerRow', () => {
  it('words each state and keeps the question title as muted detail', () => {
    expect(renderToStaticMarkup(<PromptMarkerRow title="Which topic?" state="answered" />))
      .toContain('Asked you a question → you answered</span>')
    expect(renderToStaticMarkup(<PromptMarkerRow title="Which topic?" state="waiting" />))
      .toContain('Waiting for your answer</span>')
    expect(renderToStaticMarkup(<PromptMarkerRow title="Which topic?" state="asked" />))
      .toContain('>Asked you a question</span>')
    expect(renderToStaticMarkup(<PromptMarkerRow title="Which topic?" state="answered" />))
      .toContain('— Which topic?')
  })

  it('omits the detail when the question has no title', () => {
    expect(renderToStaticMarkup(<PromptMarkerRow title="  " state="answered" />)).not.toContain('—')
  })
})
