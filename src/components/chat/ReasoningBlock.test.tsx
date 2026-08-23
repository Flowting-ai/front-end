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

  it('splits a heading into a bold verb and a muted remainder', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        reasoningSections={[{
          heading: 'Planned what to search for and in what order',
          body: 'This full summary should stay inside the expandable block.',
        }]}
        isStreaming={false}
      />,
    )

    expect(html).toContain('>Planned</strong> what to search for and in what order')
    expect(html).not.toContain('This full summary should stay inside the expandable block.')
  })

  it('keeps a single-word heading whole with no trailing remainder', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        reasoningSections={[{ heading: 'Summarizing', body: 'Body.' }]}
        isStreaming={false}
      />,
    )

    expect(html).toContain('>Summarizing</strong>')
  })

  it('collapses a settled batch of activities into one summary row', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        activities={[
          { id: 'a-1', type: 'web-search', label: 'Searching the web', status: 'done' },
          { id: 'a-2', type: 'web-search', label: 'Searching the web', status: 'done' },
          { id: 'a-3', type: 'read-pages', label: 'Reading document', status: 'done' },
        ]}
        reasoningTimeline={[
          { kind: 'reasoning', id: 'r-1', content: '**Planning the search**\nBody.' },
          { kind: 'activity', id: 't-1', activityId: 'a-1' },
          { kind: 'activity', id: 't-2', activityId: 'a-2' },
          { kind: 'activity', id: 't-3', activityId: 'a-3' },
        ]}
        isStreaming={false}
      />,
    )

    expect(html).toContain('Ran 3 actions')
    expect(html).toContain('Searching the web, Reading document')
  })

  it('leaves a batch expanded while one of its activities is still running', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        activities={[
          { id: 'a-1', type: 'web-search', label: 'Searching the web', status: 'done' },
          { id: 'a-2', type: 'web-search', label: 'Searching the web', status: 'executing' },
        ]}
        reasoningTimeline={[
          { kind: 'activity', id: 't-1', activityId: 'a-1' },
          { kind: 'activity', id: 't-2', activityId: 'a-2' },
        ]}
        isStreaming
      />,
    )

    expect(html).not.toContain('Ran 2 actions')
    expect(html).toContain('Working…')
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
    // two nested disclosures. It renders split, so count the remainder.
    expect(html).toContain('>Identifying…</strong> execution issues')
    expect(html.match(/execution issues/g)).toHaveLength(1)
  })

  it('shows the running tool label in the trigger even while open', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="**Identifying execution issues**\nThe reasoning body."
        reasoningSections={[
          { heading: 'Identifying execution issues', body: 'The reasoning body.' },
        ]}
        activities={[
          { id: 'a-1', type: 'web-search', label: 'Searching the web', status: 'executing' },
        ]}
        isNewMessage
        isThinkingInProgress
      />,
    )

    expect(html).toContain('aria-expanded="true"')
    // ResearchTitle wraps each word in its own span, so assert word by word.
    expect(html).toContain('Searching')
    expect(html).toContain('web')
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

  it('collapses to the last heading when reasoning completes', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="**Synthesised the final answer**\nFinished reasoning."
        isNewMessage={false}
        isThinkingInProgress={false}
      />,
    )

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Synthesised')
    expect(html).toContain('final')
    expect(html).toContain('answer')
  })
})
