import { describe, expect, it } from 'vitest'

import { deriveCitationsFromSources, listedSources } from '@/lib/citations'
import type { WebCitation } from '@/types/chat'

const ANSWER = 'Paris is the capital of France [1]. It has 2.1M residents [2].'

describe('deriveCitationsFromSources', () => {
  it('parses the trailing Sources block and removes it from the content', () => {
    const content = `${ANSWER}\n\nSources:\n[1] [Paris - Wikipedia](https://en.wikipedia.org/wiki/Paris)\n[2] [INSEE census](https://www.insee.fr/en/statistiques)\n`
    const { citations, contentWithoutSourcesBlock } = deriveCitationsFromSources(content)
    expect(contentWithoutSourcesBlock).toBe(ANSWER)
    expect(citations).toEqual([
      { title: 'Paris - Wikipedia', url: 'https://en.wikipedia.org/wiki/Paris', domain: 'en.wikipedia.org' },
      { title: 'INSEE census', url: 'https://www.insee.fr/en/statistiques', domain: 'insee.fr' },
    ])
  })

  it.each([
    ['Sources:'],
    ['**Sources:**'],
    ['**Sources**:'],
    ['## Sources'],
    ['Sources'],
    ['### **Sources**'],
  ])('accepts the %s heading', (heading) => {
    const content = `${ANSWER}\n\n${heading}\n[1] [A](https://a.com)`
    const result = deriveCitationsFromSources(content)
    expect(result.contentWithoutSourcesBlock).toBe(ANSWER)
    expect(result.citations[0]?.url).toBe('https://a.com')
  })

  it('indexes citations by their number, leaving holes for gaps', () => {
    const content = `${ANSWER}\n\nSources:\n[3] [C](https://c.com)\n[1] [A](https://a.com)`
    const { citations } = deriveCitationsFromSources(content)
    expect(citations).toHaveLength(3)
    expect(citations[0]?.title).toBe('A')
    expect(1 in citations).toBe(false)
    expect(citations[2]?.title).toBe('C')
    expect(citations.filter(Boolean)).toHaveLength(2)
  })

  it('accepts bare URLs, list bullets and numbered-list entries', () => {
    const content = `${ANSWER}\n\nSources:\n- [1] https://a.com/page.\n[2] Census office — https://b.org/x\n3. <https://c.net>`
    const { citations, contentWithoutSourcesBlock } = deriveCitationsFromSources(content)
    expect(contentWithoutSourcesBlock).toBe(ANSWER)
    expect(citations[0]).toEqual({ title: 'https://a.com/page', url: 'https://a.com/page', domain: 'a.com' })
    expect(citations[1]).toEqual({ title: 'Census office', url: 'https://b.org/x', domain: 'b.org' })
    expect(citations[2]?.url).toBe('https://c.net')
  })

  it('also drops a horizontal rule that introduces the block', () => {
    const content = `${ANSWER}\n\n---\n\nSources:\n[1] [A](https://a.com)`
    expect(deriveCitationsFromSources(content).contentWithoutSourcesBlock).toBe(ANSWER)
  })

  it('keeps the first line for a number listed twice', () => {
    const content = `${ANSWER}\n\nSources:\n[1] [First](https://a.com)\n[1] [Second](https://b.com)`
    expect(deriveCitationsFromSources(content).citations[0]?.title).toBe('First')
  })

  it('leaves the content alone when the block is not the last thing in the message', () => {
    const content = `${ANSWER}\n\nSources:\n[1] [A](https://a.com)\n\nLet me know if you need more.`
    expect(deriveCitationsFromSources(content)).toEqual({ citations: [], contentWithoutSourcesBlock: content })
  })

  it('leaves the content alone when a line in the block does not parse', () => {
    const content = `${ANSWER}\n\nSources:\n[1] [A](https://a.com)\n[2] A book with no link`
    expect(deriveCitationsFromSources(content)).toEqual({ citations: [], contentWithoutSourcesBlock: content })
  })

  it('needs at least one source once the stream is over', () => {
    const content = `${ANSWER}\n\nSources:\n`
    expect(deriveCitationsFromSources(content).contentWithoutSourcesBlock).toBe(content)
  })

  it('never strips a block inside a code fence', () => {
    const content = 'Format your answer like this:\n\n```\nSources:\n[1] [A](https://a.com)'
    expect(deriveCitationsFromSources(content).contentWithoutSourcesBlock).toBe(content)
  })

  it('does strip a block that follows a closed code fence', () => {
    const content = 'Run:\n\n```sh\nnpm test\n```\n\nSources:\n[1] [Docs](https://docs.dev)'
    expect(deriveCitationsFromSources(content).contentWithoutSourcesBlock).toBe('Run:\n\n```sh\nnpm test\n```')
  })

  it('ignores a "Sources" line that is not a heading', () => {
    const content = 'Sources of revenue include:\n[1] [A](https://a.com)'
    expect(deriveCitationsFromSources(content).contentWithoutSourcesBlock).toBe(content)
  })

  it('keeps a definition block that a reference link in the answer uses', () => {
    const content = 'See [the docs][1] for details.\n\nSources:\n[1]: https://a.com'
    expect(deriveCitationsFromSources(content)).toEqual({ citations: [], contentWithoutSourcesBlock: content })
  })

  it('still takes a definition-style block cited with plain markers', () => {
    const content = 'Paris is large [1][2].\n\nSources:\n[1]: https://a.com\n[2]: https://b.com'
    const result = deriveCitationsFromSources(content)
    expect(result.contentWithoutSourcesBlock).toBe('Paris is large [1][2].')
    expect(result.citations.map((c) => c.url)).toEqual(['https://a.com', 'https://b.com'])
  })

  describe('while streaming', () => {
    it('hides a block whose last entry is still being written', () => {
      const content = `${ANSWER}\n\nSources:\n[1] [A](https://a.com)\n[2] [Cens`
      const result = deriveCitationsFromSources(content, { streaming: true })
      expect(result.contentWithoutSourcesBlock).toBe(ANSWER)
      expect(result.citations.filter(Boolean)).toHaveLength(1)
      // The same text with the stream over is not a clean block.
      expect(deriveCitationsFromSources(content).contentWithoutSourcesBlock).toBe(content)
    })

    it('hides a heading that has no entries yet', () => {
      const content = `${ANSWER}\n\n**Sources:**\n`
      expect(deriveCitationsFromSources(content, { streaming: true }).contentWithoutSourcesBlock).toBe(ANSWER)
    })

    it('does not hide ordinary prose that is still arriving', () => {
      const content = `${ANSWER}\n\nSources:\n[1] [A](https://a.com)\n\nAnd one more th`
      expect(deriveCitationsFromSources(content, { streaming: true }).contentWithoutSourcesBlock).toBe(content)
    })
  })
})

describe('listedSources', () => {
  it('keeps each source at its own number across gaps', () => {
    const citations: WebCitation[] = []
    citations[0] = { title: 'A', url: 'https://a.com' }
    citations[1] = { title: 'B', url: 'https://b.com' }
    citations[3] = { title: 'D', url: 'https://d.com' }
    expect(listedSources(citations).map(({ n, citation }) => [n, citation.title])).toEqual([[1, 'A'], [2, 'B'], [4, 'D']])
  })

  it('lists a URL cited under two numbers once, at the lower number', () => {
    const citations: WebCitation[] = [
      { title: 'A', url: 'https://a.com' },
      { title: 'B', url: 'https://b.com' },
      { title: 'A again', url: 'https://a.com' },
      { title: 'No link' },
    ]
    expect(listedSources(citations).map(({ n }) => n)).toEqual([1, 2, 4])
  })
})
