import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'

describe('ConnectorGlyph', () => {
  it('uses the bundled Slack logo when the backend sends none', () => {
    const html = renderToStaticMarkup(<ConnectorGlyph slug="slack" name="Slack" logoUrl={null} />)
    expect(html).toContain('src="/icons/slack.svg"')
  })

  it('matches Slack slug variants', () => {
    const html = renderToStaticMarkup(<ConnectorGlyph slug="slack_v2" name="Slack" logoUrl={null} />)
    expect(html).toContain('src="/icons/slack.svg"')
  })

  it('prefers the backend logo when present', () => {
    const html = renderToStaticMarkup(<ConnectorGlyph slug="slack" name="Slack" logoUrl="https://cdn.example/slack.png" />)
    expect(html).toContain('src="https://cdn.example/slack.png"')
  })

  it('falls back to a letter tile for other apps', () => {
    const html = renderToStaticMarkup(<ConnectorGlyph slug="notion" name="Notion" logoUrl={null} />)
    expect(html).not.toContain('<img')
    expect(html).toContain('>N<')
  })
})
