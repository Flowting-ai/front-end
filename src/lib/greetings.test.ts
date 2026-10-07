import { describe, expect, it } from 'vitest'

import { FALLBACK_GREETING, dayGreetings, fillGreeting, getGreeting, splitGreeting, timeGreetings } from '@/lib/greetings'

const allTemplates = [
  ...timeGreetings.flatMap(s => s.messages),
  ...dayGreetings.flatMap(s => s.messages),
  FALLBACK_GREETING,
]

describe('greetings', () => {
  it('fills the name where a greeting uses it', () => {
    expect(fillGreeting('Where were we, {username}?', 'Kunal')).toBe('Where were we, Kunal?')
  })

  it('drops the name and its comma when there is none, rather than a stand-in word', () => {
    expect(fillGreeting('Where were we, {username}?', '')).toBe('Where were we?')
    expect(fillGreeting('Rise and grind, {username}. I\'ve been waiting.', '  ')).toBe('Rise and grind. I\'ve been waiting.')
  })

  it('reads cleanly with no name for every greeting', () => {
    for (const template of allTemplates) {
      const text = fillGreeting(template, '')
      expect(text).not.toMatch(/\{username\}|\s[,.?!]|,[.?!]|\s{2}|,$/)
    }
  })

  it('splits a wrapping greeting between sentences, keeping the halves balanced', () => {
    expect(splitGreeting("The world's asleep. You're not. Let's make something.")).toEqual([
      ["The world's asleep.", "You're not."],
      ["Let's make something."],
    ])
    expect(splitGreeting('Burning the midnight oil, Kunal? I never sleep.')).toEqual([
      ['Burning the midnight oil, Kunal?'],
      ['I never sleep.'],
    ])
    // A spaced dash ends a clause; a hyphen inside a word does not.
    expect(splitGreeting('Fresh morning, fresh ideas - let\'s go.')).toEqual([
      ['Fresh morning, fresh ideas -'],
      ['let\'s go.'],
    ])
    expect(splitGreeting('Late-night thoughts hit different.')).toEqual([['Late-night thoughts hit different.']])
  })

  it('splits every greeting into at most two halves without losing any text', () => {
    for (const template of allTemplates) {
      const text = fillGreeting(template, 'Kunal')
      const halves = splitGreeting(text)
      expect(halves.length).toBeLessThanOrEqual(2)
      expect(halves.flat().join(' ')).toBe(text)
    }
  })

  it('never shows the placeholder from getGreeting', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(getGreeting('', new Date(2026, 9, 5, hour))).not.toContain('{username}')
    }
  })
})
