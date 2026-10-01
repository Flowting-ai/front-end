import { describe, expect, it } from 'vitest'
import { POPULAR_TEMPLATES, TEMPLATE_AFFINITY, alreadyHasTemplate, recommendTemplates } from './agent-templates'

const TEMPLATES = Object.keys(TEMPLATE_AFFINITY)
const PRESETS: Record<string, string> = { 'Customer Support': 'Support Agent', Legal: 'Legal Advisor', Sales: 'Sales Assistant' }
const base = { templates: TEMPLATES, presetNames: PRESETS, existingAgents: [] as string[] }

describe('alreadyHasTemplate', () => {
  it('matches the template or its preset name, ignoring case and punctuation', () => {
    expect(alreadyHasTemplate('Customer Support', 'Support Agent', ['support-agent'])).toBe(true)
    expect(alreadyHasTemplate('Customer Support', 'Support Agent', ['Customer  Support'])).toBe(true)
    expect(alreadyHasTemplate('Legal', 'Legal Advisor', ['Contract Reviewer'])).toBe(false)
    expect(alreadyHasTemplate('Legal', undefined, [])).toBe(false)
  })
})

describe('recommendTemplates', () => {
  it('ranks by how many connected apps a template works with, with the reasons', () => {
    const { items, personalized } = recommendTemplates({
      ...base,
      linked: [
        { slug: 'hubspot', displayName: 'HubSpot' },
        { slug: 'gmail', displayName: 'Gmail' },
        { slug: 'slack', displayName: 'Slack' },
      ],
    })
    expect(personalized).toBe(true)
    const names = items.map(item => item.name)
    // Gmail + Slack hit Customer Support and Executive Assistant (2 each); HubSpot hits Sales and Marketing.
    expect(names.slice(0, 2).sort()).toEqual(['Customer Support', 'Executive Assistant'])
    expect(items.find(item => item.name === 'Customer Support')?.because.sort()).toEqual(['Gmail', 'Slack'])
    expect(names).toContain('Sales')
    expect(names).toContain('Marketing')
    expect(names).not.toContain('Tutoring')
  })

  it('matches on the display name as well as the slug', () => {
    const { items } = recommendTemplates({ ...base, linked: [{ slug: 'x_123', displayName: 'Google Sheets' }] })
    expect(items.map(item => item.name)).toContain('Data Analyst')
  })

  it('matches short fragments only against the whole app name', () => {
    expect(recommendTemplates({ ...base, linked: [{ slug: 'closeio', displayName: 'Close' }] }).personalized).toBe(true)
    // "box" / "close" inside other names must not drive a match.
    const { items, personalized } = recommendTemplates({
      ...base,
      linked: [{ slug: 'sandbox', displayName: 'Sandbox' }, { slug: 'enclosed', displayName: 'Enclosed' }],
    })
    expect(personalized).toBe(false)
    expect(items.map(item => item.name)).toEqual([...POPULAR_TEMPLATES])
  })

  it('skips templates the user already has an agent for', () => {
    const { items } = recommendTemplates({
      ...base,
      existingAgents: ['Support Agent'],
      linked: [{ slug: 'zendesk', displayName: 'Zendesk' }],
    })
    expect(items.map(item => item.name)).not.toContain('Customer Support')
  })

  it('falls back to popular starting points, without reasons, when nothing matches', () => {
    const result = recommendTemplates({ ...base, linked: [] })
    expect(result.personalized).toBe(false)
    expect(result.items.map(item => item.name)).toEqual([...POPULAR_TEMPLATES])
    expect(result.items.every(item => item.because.length === 0)).toBe(true)
  })

  it('leaves already-owned templates out of the fallback too', () => {
    const result = recommendTemplates({ ...base, linked: [], existingAgents: ['Research'] })
    expect(result.items.map(item => item.name)).not.toContain('Research')
  })

  it('respects the limit and keeps gallery order for ties', () => {
    const linked = [{ slug: 'notion', displayName: 'Notion' }]
    const { items } = recommendTemplates({ ...base, linked, limit: 2 })
    expect(items).toHaveLength(2)
    // Notion fits Research, Content Writer, Onboarding, Productivity, Education … in gallery order.
    expect(items.map(item => item.name)).toEqual(['Research', 'Content Writer'])
  })
})
