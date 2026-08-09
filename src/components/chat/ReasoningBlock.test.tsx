import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReasoningBlock, ReasoningContent } from '@/components/chat/ReasoningBlock'

describe('ReasoningContent', () => {
  it('renders reasoning and tools in their arrival order without bridging markdown', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        activities={[{
          id: 'tool-1',
          type: 'tool-call',
          label: 'Query data',
          status: 'done',
        }]}
        reasoningTimeline={[
          { kind: 'reasoning', id: 'r-1', content: 'Before `unfinished', roundIndex: 0 },
          { kind: 'activity', id: 'a-1', activityId: 'tool-1', roundIndex: 0 },
          { kind: 'reasoning', id: 'r-2', content: '`closed` AFTER_TOOL', roundIndex: 1 },
        ]}
        isStreaming={false}
      />,
    )

    expect(html.indexOf('Before')).toBeLessThan(html.indexOf('Query data'))
    expect(html.indexOf('Query data')).toBeLessThan(html.indexOf('AFTER_TOOL'))
    expect(html).toContain('<code')
    expect(html).not.toContain('<code>unfinished')
  })

  it('renders structured reasoning as visible thinking steps', () => {
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
    expect(html).toContain('Checking the connected sources.')
    expect(html).toContain('Preparing the result.')
    expect(html).not.toContain('The raw fallback must not replace structured sections.')
  })

  it('uses the expanded ThinkingSteps trigger by default', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="Checking context"
        isNewMessage
        isThinkingInProgress
      />,
    )

    expect(html).toContain('Thinking')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-controls=')
    expect(html).toContain('width:100%')
  })
})
