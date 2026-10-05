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
          body: 'The full summary.',
        }]}
        isStreaming={false}
      />,
    )

    expect(html).toContain('>Planned</strong> what to search for and in what order')
  })

  it('opens a lone reasoning step so one click on the panel shows its text', () => {
    const timeline = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        reasoningTimeline={[{ kind: 'reasoning', id: 'r-1', content: '**Clarifying the topic**\nThe only body.' }]}
        isStreaming={false}
      />,
    )
    const sections = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        reasoningSections={[{ heading: 'Clarifying the topic', body: 'The only body.' }]}
        isStreaming={false}
      />,
    )

    for (const html of [timeline, sections]) {
      expect(html).toContain('aria-expanded="true"')
      expect(html).toContain('The only body.')
    }
  })

  it('keeps steps collapsed when the lone step shares the panel', () => {
    const withTool = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        activities={[{ id: 'a-1', type: 'tool-call', label: 'Query data', status: 'done' }]}
        reasoningTimeline={[
          { kind: 'reasoning', id: 'r-1', content: '**Clarifying the topic**\nHidden body.' },
          { kind: 'activity', id: 't-1', activityId: 'a-1' },
        ]}
        isStreaming={false}
      />,
    )
    const twoSteps = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        reasoningTimeline={[{ kind: 'reasoning', id: 'r-1', content: '**First step**\nHidden one.\n**Second step**\nHidden two.' }]}
        isStreaming={false}
      />,
    )
    const sectionsWithTool = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        reasoningSections={[{ heading: 'Clarifying the topic', body: 'Hidden body.' }]}
        activities={[{ id: 'a-1', type: 'tool-call', label: 'Query data', status: 'done' }]}
        isStreaming={false}
      />,
    )

    expect(withTool).not.toContain('Hidden body.')
    expect(twoSteps).not.toContain('Hidden one.')
    expect(twoSteps).not.toContain('Hidden two.')
    expect(sectionsWithTool).not.toContain('Hidden body.')
  })

  it('does not put an ellipsis inside the active step label', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        reasoningTimeline={[{ kind: 'reasoning', id: 'r-1', content: '**Clarifying the topic**\n' }]}
        isStreaming
      />,
    )

    expect(html).toContain('>Clarifying</strong> the topic')
    expect(html).not.toContain('…')
  })

  it('draws a divider between every pair of adjacent groups', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        activities={[
          { id: 'a-1', type: 'tool-call', label: 'Query data', status: 'done' },
          { id: 'a-2', type: 'tool-call', label: 'Query more', status: 'done' },
        ]}
        reasoningTimeline={[
          { kind: 'reasoning', id: 'r-1', content: 'First.' },
          { kind: 'activity', id: 't-1', activityId: 'a-1' },
          { kind: 'reasoning', id: 'r-2', content: 'Second.' },
          { kind: 'activity', id: 't-2', activityId: 'a-2' },
          // Not resolved to a row yet: renders nothing, so no divider either.
          { kind: 'activity', id: 't-3', activityId: 'missing' },
        ]}
        isStreaming={false}
      />,
    )

    expect(html.match(/height:1px/g)).toHaveLength(3)
  })

  it('marks an answered question between the reasoning before and after it', () => {
    const html = renderToStaticMarkup(
      <ReasoningContent
        thinkingContent=""
        reasoningTimeline={[
          { kind: 'reasoning', id: 'r-1', content: 'Before asking.' },
          { kind: 'prompt', id: 'p-1', promptId: 'q-1', title: 'Which topic?' },
          { kind: 'reasoning', id: 'r-2', content: 'After the answer.' },
        ]}
        isStreaming
      />,
    )

    expect(html.indexOf('Before asking.')).toBeLessThan(html.indexOf('Asked you a question → you answered'))
    expect(html.indexOf('Which topic?')).toBeLessThan(html.indexOf('After the answer.'))
    expect(html.match(/height:1px/g)).toHaveLength(2)
  })

  it('shows a trailing question as waiting while live, and makes no claim once settled', () => {
    const timeline = [
      { kind: 'reasoning' as const, id: 'r-1', content: '**Clarifying the topic**\nBody.' },
      { kind: 'prompt' as const, id: 'p-1', promptId: 'q-1', title: 'Which topic?' },
    ]
    const live = renderToStaticMarkup(<ReasoningContent thinkingContent="" reasoningTimeline={timeline} isStreaming />)
    const settled = renderToStaticMarkup(<ReasoningContent thinkingContent="" reasoningTimeline={timeline} isStreaming={false} />)

    expect(live).toContain('Waiting for your answer')
    // The reasoning before the question is no longer the live step.
    expect(live).toContain('>Clarifying</strong>')
    expect(live).not.toMatch(/kaya-thinking-step-shimmer"[^>]*>Clarifying/)
    expect(settled).toContain('Asked you a question')
    expect(settled).not.toContain('you answered')
    expect(settled).not.toContain('Waiting for your answer')
  })

  it('marks a question by its card decision: waiting while the turn is open, dismissed or answered after', () => {
    const timeline = [
      { kind: 'reasoning' as const, id: 'r-1', content: '**Clarifying the topic**\nBody.' },
      { kind: 'prompt' as const, id: 'p-1', promptId: 'q-1', title: 'Which topic?' },
    ]
    const render = (props: { isTurnActive?: boolean; promptDecisions?: Record<string, string> }) =>
      renderToStaticMarkup(<ReasoningContent thinkingContent="" reasoningTimeline={timeline} isStreaming={false} {...props} />)

    expect(render({ isTurnActive: true })).toContain('Waiting for your answer')
    expect(render({ isTurnActive: true, promptDecisions: { 'q-1': 'dismissed' } })).toContain('you dismissed it')
    expect(render({ isTurnActive: true, promptDecisions: { 'q-1': 'resolved' } })).toContain('you answered')
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

  it('uses the last reasoning heading as the live Thinking summary', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="**Clarifying research needs**\nFirst body.\n\n**Researching multi-model execution**\nSecond body."
        reasoningSections={[
          { heading: 'Clarifying research needs', body: 'First body.' },
          { heading: 'Researching multi-model execution', body: 'Second body.' },
        ]}
        isNewMessage
        isThinkingInProgress
      />,
    )

    // Once in the trigger summary, once in the (collapsed) step row.
    expect(html.match(/execution/g)).toHaveLength(2)
  })

  it('stays collapsed while thinking, with a single-line live status', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="Checking context"
        isNewMessage
        isThinkingInProgress
      />,
    )

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('class="kaya-shimmer"')
    expect(html).toContain('>Thinking</span>')
    expect(html).toContain('aria-controls=')
  })

  it('shows a running tool as the live status without opening the panel', () => {
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

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('width:100%')
    // ResearchTitle wraps each word in its own span, so assert word by word.
    expect(html).toContain('>Searching</span>')
    expect(html).toContain('> web</span>')
  })

  it('shows a pending question as the live status', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="**Clarifying the topic**\nBody."
        reasoningTimeline={[
          { kind: 'reasoning', id: 'r-1', content: '**Clarifying the topic**\nBody.' },
          { kind: 'prompt', id: 'p-1', promptId: 'q-1', title: 'Which topic?' },
        ]}
        isNewMessage
        isThinkingInProgress
      />,
    )

    expect(html).toContain('>Waiting</span>')
    expect(html).toContain('> answer</span>')
  })

  it('shows a pending question as live while the turn is open, even after thinking ended', () => {
    // The ask_user round ends thinking (isThinkingInProgress false) before the
    // card arrives; the turn itself is still open.
    const timeline = [
      { kind: 'reasoning' as const, id: 'r-1', content: '**Clarifying the topic**\nBody.' },
      { kind: 'prompt' as const, id: 'p-1', promptId: 'q-1', title: 'Which topic?' },
    ]
    const waiting = renderToStaticMarkup(
      <ReasoningBlock thinkingContent="x" reasoningTimeline={timeline} isNewMessage isTurnActive />,
    )
    expect(waiting).toContain('>Waiting</span>')

    const answered = renderToStaticMarkup(
      <ReasoningBlock thinkingContent="x" reasoningTimeline={timeline} isNewMessage isTurnActive promptDecisions={{ 'q-1': 'resolved' }} />,
    )
    expect(answered).not.toContain('>Waiting</span>')
  })

  it('reads "Thought for Ns" with no heading summary once reasoning completes', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="**Synthesised the final answer**\nFinished reasoning."
        isNewMessage={false}
        isThinkingInProgress={false}
        durationMs={12_300}
      />,
    )

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('>Thought for 12s</span>')
    expect(html).not.toContain('class="kaya-shimmer"')
    // Only the step row inside the panel carries the heading.
    expect(html.match(/final answer/g)).toHaveLength(1)
  })

  it('reads plain "Thought" when the duration is unknown', () => {
    const html = renderToStaticMarkup(
      <ReasoningBlock
        thinkingContent="**Synthesised the final answer**\nFinished reasoning."
        isNewMessage={false}
        isThinkingInProgress={false}
      />,
    )

    expect(html).toContain('>Thought</span>')
  })
})
