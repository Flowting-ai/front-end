import { describe, expect, it } from 'vitest'
import { detectCreateAgentIntent } from './agent-intent'

const purposeOf = (text: string) => detectCreateAgentIntent(text)?.purpose

describe('detectCreateAgentIntent — requests to create an agent', () => {
  it.each([
    ['Create an agent that triages support emails every morning', 'Triages support emails every morning'],
    ['create an agent to summarise my meeting notes', 'Summarise my meeting notes'],
    ['Make me an agent that reviews contracts.', 'Reviews contracts'],
    ['Build an AI agent for answering HR questions', 'Answering HR questions'],
    ['can you create a new agent that drafts weekly reports?', 'Drafts weekly reports'],
    ['Please make an assistant that books my travel', 'Books my travel'],
    ['I want an agent that watches my inbox', 'Watches my inbox'],
    ["I'd like a custom agent to review pull requests", 'Review pull requests'],
    ['set up an agent which tracks invoices', 'Tracks invoices'],
    ['Create an agent called Atlas that researches competitors', 'Researches competitors'],
    ['design a new assistant for onboarding new hires', 'Onboarding new hires'],
  ])('%s', (message, purpose) => {
    expect(purposeOf(message)).toBe(purpose)
  })

  it('treats a bare request as an intent with no purpose yet', () => {
    expect(detectCreateAgentIntent('create an agent')).toEqual({ purpose: '' })
    expect(detectCreateAgentIntent('Make me an agent please')).toEqual({ purpose: '' })
    expect(detectCreateAgentIntent('create an agent called Atlas')).toEqual({ purpose: '' })
    expect(detectCreateAgentIntent('I need an agent')).toEqual({ purpose: '' })
  })

  it('caps the purpose at the purpose limit', () => {
    const message = `create an agent that ${'does many things '.repeat(20)}`.slice(0, 399)
    expect(purposeOf(message)!.length).toBeLessThanOrEqual(300)
  })
})

describe('detectCreateAgentIntent — ordinary messages are left alone', () => {
  it.each([
    'What is an agent in reinforcement learning?',
    'Explain how to build an agent loop in Python',
    'create an assistant class in TypeScript',
    'Build a bot that scrapes Reddit',
    'Make me a chatbot',
    'I want to understand agents better',
    'Can you create a summary of this document?',
    'Create a travel agent itinerary for Rome',
    'my agent is not working',
    'agents are cool, create one',
    '',
    '   ',
  ])('%s', message => {
    expect(detectCreateAgentIntent(message)).toBeNull()
  })

  it('ignores code and very long messages', () => {
    expect(detectCreateAgentIntent('create an agent that\n```js\nconsole.log(1)\n```')).toBeNull()
    expect(detectCreateAgentIntent(`create an agent that ${'x'.repeat(500)}`)).toBeNull()
  })
})
