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
    expect(html).not.toContain('Checking the connected sources.')
    expect(html).not.toContain('Preparing the result.')
    expect(html).not.toContain('The raw fallback must not replace structured sections.')
  })

  it('shows only backend-supplied detail beside a reasoning heading', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        reasoningSections={[{
          heading: 'Planned',
          detail: 'what to search for and in what order',
          body: 'This full summary should stay inside the expandable block.',
        }]}
        isStreaming={false}
      />,
    )

    expect(html).toContain('what to search for and in what order')
    expect(html).not.toContain('This full summary should stay inside the expandable block.')
  })

  it('uses the last reasoning heading as the compact Thinking summary', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="**Clarifying research needs**\nFirst body.\n\n**Researching multi-model execution**\nSecond body."
        reasoningSections={[
          { heading: 'Clarifying research needs', body: 'First body.' },
          { heading: 'Researching multi-model execution', body: 'Second body.' },
        ]}
        isNewMessage={false}
        isThinkingInProgress={false}
      />,
    )

    expect(html.match(/execution/g)).toHaveLength(2)
  })

  it('drops the borrowed step heading from the trigger once the panel is open', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="**Identifying execution issues**\nThe reasoning body."
        reasoningSections={[
          { heading: 'Identifying execution issues', body: 'The reasoning body.' },
        ]}
        isNewMessage
        isThinkingInProgress
      />,
    )

    expect(html).toContain('aria-expanded="true"')
    // The heading is the step row's; copying it up would put identical text on
    // two nested disclosures.
    expect(html.match(/Identifying execution issues/g)).toHaveLength(1)
  })

  it('keeps an explicit research title in the trigger even while open', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="**Identifying execution issues**\nThe reasoning body."
        reasoningSections={[
          { heading: 'Identifying execution issues', body: 'The reasoning body.' },
        ]}
        isNewMessage
        isThinkingInProgress
        researchTitle="Mapped multi-model execution failure modes"
      />,
    )

    expect(html).toContain('aria-expanded="true"')
    // ResearchTitle wraps each word in its own span, so assert word by word.
    expect(html).toContain('Mapped')
    expect(html).toContain('failure')
    expect(html).toContain('modes')
  })

  it('uses the expanded ThinkingSteps trigger by default', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="Checking context"
        isNewMessage
        isThinkingInProgress
        researchTitle="Synthesised 2026 AI startup GTM strategies"
      />,
    )

    expect(html).toContain('Thinking')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-controls=')
    expect(html).toContain('width:100%')
    expect(html).toContain('Synthesised')
    expect(html).toContain('strategies')
  })

  it('collapses to the compact research title when reasoning completes', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="Finished reasoning"
        isNewMessage={false}
        isThinkingInProgress={false}
        researchTitle="Synthesised the final answer"
      />,
    )

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Synthesised')
    expect(html).toContain('final')
    expect(html).toContain('answer')
  })
})
