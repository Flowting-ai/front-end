import { describe, expect, it } from 'vitest'
import { healStreamingTail, preprocessMarkdown } from './markdown-preprocess'

describe('healStreamingTail', () => {
  describe('inline code, bold and strikethrough', () => {
    it('closes an unclosed inline code span', () => {
      expect(healStreamingTail('Add roughly `15g')).toBe('Add roughly `15g`')
      expect(healStreamingTail('Use ``a ` b')).toBe('Use ``a ` b``')
    })

    it('leaves a closed code span alone', () => {
      expect(healStreamingTail('Add `15g` of coffee')).toBe('Add `15g` of coffee')
    })

    it('puts the closer right after the last word, not after trailing whitespace', () => {
      expect(healStreamingTail('# **Starting a Vegetable ')).toBe('# **Starting a Vegetable**')
      expect(healStreamingTail('Add `15g ')).toBe('Add `15g`')
    })

    it('closes an unclosed bold and strikethrough', () => {
      expect(healStreamingTail('This is **very impor')).toBe('This is **very impor**')
      expect(healStreamingTail('Not ~~this')).toBe('Not ~~this~~')
      expect(healStreamingTail('Done **bold** and **more')).toBe('Done **bold** and **more**')
    })

    it('holds back an opener with no text after it yet', () => {
      expect(healStreamingTail('Coffee is more than **')).toBe('Coffee is more than ')
      expect(healStreamingTail('A ritual ~~')).toBe('A ritual ')
      expect(healStreamingTail('Add `')).toBe('Add ')
      expect(healStreamingTail('Then *')).toBe('Then ')
    })

    it('closes an unclosed italic, and leaves balanced italic, spaced stars and snake_case alone', () => {
      expect(healStreamingTail('follow *your own')).toBe('follow *your own*')
      expect(healStreamingTail('use _emph')).toBe('use _emph_')
      expect(healStreamingTail('*done* and *more')).toBe('*done* and *more*')
      expect(healStreamingTail('*done* and more')).toBe('*done* and more')
      expect(healStreamingTail('a * b * c')).toBe('a * b * c')
      expect(healStreamingTail('call snake_case_name now')).toBe('call snake_case_name now')
      expect(healStreamingTail('_done_ fine')).toBe('_done_ fine')
    })

    it('leaves balanced bold, bold-italic and a bullet list alone', () => {
      expect(healStreamingTail('A **bold** word')).toBe('A **bold** word')
      expect(healStreamingTail('A ***both*** word')).toBe('A ***both*** word')
      expect(healStreamingTail('* one\n* two')).toBe('* one\n* two')
    })

    it('does not look inside code when counting markers', () => {
      expect(healStreamingTail('Run `a ** b` now')).toBe('Run `a ** b` now')
    })

    it('only heals the last paragraph', () => {
      expect(healStreamingTail('First **para\n\nSecond one')).toBe('First **para\n\nSecond one')
    })
  })

  describe('links and images', () => {
    it('keeps only the text of a half-written link', () => {
      expect(healStreamingTail('See [the docs](https://exa')).toBe('See the docs')
      expect(healStreamingTail('See [the do')).toBe('See the do')
      expect(healStreamingTail('See [the docs]')).toBe('See [the docs]')
      expect(healStreamingTail('See [the docs](')).toBe('See the docs')
    })

    it('leaves a finished link alone', () => {
      expect(healStreamingTail('See [the docs](https://example.com) now')).toBe('See [the docs](https://example.com) now')
    })

    it('drops a half-written image and footnote reference', () => {
      expect(healStreamingTail('Look ![a cat](https://exa')).toBe('Look ')
      expect(healStreamingTail('Look ![a ca')).toBe('Look ')
      expect(healStreamingTail('As noted[^1')).toBe('As noted')
    })
  })

  describe('math', () => {
    it('holds back unfinished display and inline math until it closes', () => {
      expect(healStreamingTail('The formula:\n\n$$x = \\frac{-b')).toBe('The formula:\n\n')
      expect(healStreamingTail('Result: \\(x = \\frac{1}{')).toBe('Result:')
      expect(healStreamingTail('Block:\n\\[ a + b')).toBe('Block:\n')
    })

    it('leaves finished math alone', () => {
      expect(healStreamingTail('$$x^2$$ and \\(y\\) done')).toBe('$$x^2$$ and \\(y\\) done')
    })

    it('leaves a lone currency dollar alone', () => {
      expect(healStreamingTail('It costs $5 for')).toBe('It costs $5 for')
      expect(healStreamingTail('A deposit of $1,000 at 5%')).toBe('A deposit of $1,000 at 5%')
    })

    it('holds back unfinished single-dollar math that reads as math, until it closes', () => {
      expect(healStreamingTail('Use $A = 1{,}000(1+r')).toBe('Use')
      expect(healStreamingTail('Where $x^2 + y')).toBe('Where')
      expect(healStreamingTail('Use $A = P(1+r)^n$ here')).toBe('Use $A = P(1+r)^n$ here')
      expect(healStreamingTail('Set $HOME to it')).toBe('Set $HOME to it')
    })
  })

  describe('a reply that is a single paragraph', () => {
    it('heals it from its first character (no blank line to split on)', () => {
      expect(healStreamingTail('*a* *b')).toBe('*a* *b*')
      expect(healStreamingTail('**Bold start and more')).toBe('**Bold start and more**')
      expect(healStreamingTail('| Name | Moons |')).toBe('')
      expect(healStreamingTail('- one\n-')).toBe('- one')
    })
  })

  describe('tables', () => {
    it('holds back a table header until its separator row is complete', () => {
      expect(healStreamingTail('Intro\n\n| Name | Moons |')).toBe('Intro\n\n')
      expect(healStreamingTail('Intro\n\n| Name | Moons |\n|---|--')).toBe('Intro\n\n')
    })

    it('shows the table once the separator row is complete', () => {
      const t = 'Intro\n\n| Name | Moons |\n|---|---|\n| Mars | 2'
      expect(healStreamingTail(t)).toBe(t)
    })
  })

  describe('lone markers', () => {
    it('drops a list, quote or heading marker with nothing after it', () => {
      expect(healStreamingTail('Items:\n\n- one\n-')).toBe('Items:\n\n- one')
      expect(healStreamingTail('Steps:\n\n1. one\n2.')).toBe('Steps:\n\n1. one')
      expect(healStreamingTail('Intro\n\n##')).toBe('Intro\n\n')
      expect(healStreamingTail('Intro\n\n>')).toBe('Intro\n\n')
    })

    it('drops a "---" under text (setext flicker) but keeps text', () => {
      expect(healStreamingTail('Title\n---')).toBe('Title')
    })
  })

  describe('code fences', () => {
    it('leaves an open code fence untouched (closeOpenFences handles it)', () => {
      const t = '```js\nconst a = `x\nconst b = **'
      expect(healStreamingTail(t)).toBe(t)
    })

    it('does not treat a closed fence as streaming prose', () => {
      expect(healStreamingTail('```js\nconst a = `x\n```\n\nDone')).toBe('```js\nconst a = `x\n```\n\nDone')
    })
  })

  it('returns text with nothing to heal unchanged', () => {
    expect(healStreamingTail('')).toBe('')
    expect(healStreamingTail('Just a plain sentence.')).toBe('Just a plain sentence.')
  })
})

describe('preprocessMarkdown streaming option', () => {
  it('heals only when streaming', () => {
    expect(preprocessMarkdown('Add `15g', { streaming: true })).toBe('Add `15g`')
    expect(preprocessMarkdown('Add `15g')).toBe('Add `15g')
  })
})
