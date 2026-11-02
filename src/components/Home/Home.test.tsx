import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/SouvenirLogo', () => ({ SouvenirLogo: () => null }))

import { buildChatPromptUrl } from '@/lib/home/chat-link'
import { AskSouvenir } from './AskSouvenir'
import { MetricStrip } from './MetricCard'
import { OpportunitiesList } from './OpportunitiesList'

describe('buildChatPromptUrl', () => {
  it('opens a new chat with the prompt as ?prompt=', () => {
    const url = buildChatPromptUrl('Why did revenue rise?')
    expect(url.startsWith('/chat?')).toBe(true)
    expect(new URLSearchParams(url.split('?')[1]).get('prompt')).toBe('Why did revenue rise?')
  })
  it('encodes special characters', () => {
    const url = buildChatPromptUrl('A & B = 100%?')
    expect(new URLSearchParams(url.split('?')[1]).get('prompt')).toBe('A & B = 100%?')
  })
  it('opens a plain new chat for a blank prompt', () => {
    expect(buildChatPromptUrl('   ')).toBe('/chat')
  })
})

describe('AskSouvenir', () => {
  it('links each suggestion to a new chat with that query', () => {
    const html = renderToStaticMarkup(<AskSouvenir suggestions={['Why did revenue rise?', 'Watch the next delivery']} />)
    expect(html).toContain(`href="${buildChatPromptUrl('Why did revenue rise?')}"`)
    expect(html).toContain(`href="${buildChatPromptUrl('Watch the next delivery')}"`)
  })
  it('renders nothing for no suggestions', () => {
    expect(renderToStaticMarkup(<AskSouvenir suggestions={[]} />)).toBe('')
  })
})

describe('empty arrays', () => {
  it('MetricStrip renders nothing', () => {
    expect(renderToStaticMarkup(<MetricStrip metrics={[]} />)).toBe('')
  })
  it('OpportunitiesList shows an empty message', () => {
    const html = renderToStaticMarkup(<OpportunitiesList opportunities={[]} hrefFor={() => '/chat'} />)
    expect(html).toContain('0 findings')
    expect(html).toContain('Nothing needs your attention')
  })
})

describe('MetricStrip', () => {
  it('speaks the delta direction', () => {
    const html = renderToStaticMarkup(<MetricStrip metrics={[
      { id: 'r', label: 'Revenue', value: 1_885_200, format: 'currency', delta: 3.3, channels: ['shopify'] },
      { id: 'c', label: 'Visitors who buy', value: 0.53, format: 'percent', delta: -0.6, channels: [] },
    ]} />)
    expect(html).toContain('$1.9M')
    expect(html).toContain('up 3.3%')
    expect(html).toContain('down 0.6%')
    expect(html).toContain('From Shopify')
  })
})
