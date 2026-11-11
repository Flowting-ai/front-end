import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RoutineClarifyCard, RoutineCreatedCard, type RoutineClarifyCardProps } from './RoutineChatCards'

const noop = () => {}

function clarify(overrides: Partial<RoutineClarifyCardProps> = {}) {
  return renderToStaticMarkup(
    <RoutineClarifyCard
      answers={[{ question: 'What should it make?', answer: 'Product copy for new arrivals' }]}
      attachQuestion="Attach the Return policy and Shipping rates?"
      attachNames="Return policy 2026 and Shipping rates"
      attach={null}
      done={false}
      onAttach={noop}
      onCreate={noop}
      {...overrides}
    />,
  )
}

/** The Create routine button's opening tag. */
function createButton(html: string) {
  const end = html.indexOf('Create routine')
  return html.slice(html.lastIndexOf('<button', end), end)
}

describe('RoutineClarifyCard', () => {
  it('asks to attach the files with Attach both and Not now', () => {
    const html = clarify()
    expect(html).toContain('Routine details')
    expect(html).toContain('Attach the Return policy and Shipping rates?')
    expect(html).toContain('Attach both')
    expect(html).toContain('Not now')
  })

  it('keeps Create routine disabled until Attach both or Not now is chosen', () => {
    expect(createButton(clarify({ attach: null }))).toContain(' disabled=""')
    expect(createButton(clarify({ attach: true }))).not.toContain(' disabled=""')
    expect(createButton(clarify({ attach: false }))).not.toContain(' disabled=""')
  })

  it('after Not now and Create routine, reads "No files attached" with no buttons', () => {
    const html = clarify({ attach: false, done: true })
    expect(html).toContain('No files attached')
    expect(html).not.toContain('Attach both')
    expect(html).not.toContain('Create routine')
  })
})

describe('RoutineCreatedCard', () => {
  const card = (attachedNames: string[]) => renderToStaticMarkup(
    <RoutineCreatedCard title="Draft product copy" schedule="Every Monday at 9:00" deliversTo="Run result" attachedNames={attachedNames} routineHref="/schedules/r1" />,
  )

  it('shows Attached files: None when nothing was attached', () => {
    expect(card([])).toMatch(/<b>Attached files<\/b>None/)
  })

  it('lists the attached files and Test run: Done', () => {
    const html = card(['Return policy 2026', 'Shipping rates'])
    expect(html).toContain('Return policy 2026, Shipping rates')
    expect(html).toContain('Test run')
  })
})
