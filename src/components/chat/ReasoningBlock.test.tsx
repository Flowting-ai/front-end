import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReasoningContent } from '@/components/chat/ReasoningBlock'

describe('ReasoningContent', () => {
  it('renders structured reasoning as collapsed heading controls', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent="**Researching**\nThe raw fallback must not replace structured sections."
        reasoningSections={[
          { heading: '**Researching**', body: 'Checking the connected sources.' },
          { heading: 'Summarizing', body: 'Preparing the result.' },
        ]}
        isStreaming={false}
      />,
    )

    expect(html).toContain('Researching')
    expect(html).toContain('Summarizing')
    expect(html).toContain('<button')
    expect(html).not.toContain('Checking the connected sources.')
    expect(html).not.toContain('The raw fallback must not replace structured sections.')
  })
})
