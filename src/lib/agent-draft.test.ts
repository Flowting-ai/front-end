import { describe, expect, it } from 'vitest'
import type { AIModel } from '@/types/ai-model'
import {
  DESCRIPTION_MAX,
  FALLBACK_AGENT_NAME,
  FALLBACK_TONES,
  MAX_QUESTION_CARDS,
  NAME_MAX,
  agentModelRestriction,
  applyTone,
  avatarKey,
  buildGenerationBrief,
  clampTemperature,
  deriveAgentNames,
  deriveDescription,
  draftProblems,
  isDraftDirty,
  nextAgentName,
  pickModelForAgent,
  previewHandle,
  readTone,
  slugifyHandle,
  suggestTemperature,
  temperatureLabel,
  toneLine,
  usableQuestions,
  type AgentDraft,
} from './agent-draft'

function model(over: Partial<AIModel>): AIModel {
  return {
    id: over.modelId ?? 'm',
    modelId: 'm',
    companyName: 'Anthropic',
    modelName: 'Model',
    modelType: 'paid',
    inputLimit: 0,
    outputLimit: 0,
    ...over,
  }
}

const BASE_DRAFT: AgentDraft = {
  name: 'Support Triage',
  description: 'Sorts support emails.',
  instructions: 'You triage support emails.',
  modelId: 'claude',
  temperature: 0.5,
  avatarUrl: '/persona-avatars/a.jpg',
  tags: [],
}

describe('draftProblems', () => {
  it('is empty for a complete draft', () => {
    expect(draftProblems(BASE_DRAFT)).toEqual([])
  })

  it('flags each missing required field', () => {
    expect(draftProblems({ name: '  ', instructions: '', modelId: null })).toEqual(['name', 'instructions', 'model'])
  })
})

describe('isDraftDirty', () => {
  it('is false for an identical draft, ignoring surrounding whitespace in name/description', () => {
    expect(isDraftDirty({ ...BASE_DRAFT, name: ' Support Triage ', description: 'Sorts support emails. ' }, BASE_DRAFT)).toBe(false)
  })

  it.each([
    ['name', { name: 'Other' }],
    ['description', { description: 'Different' }],
    ['instructions', { instructions: 'You do other things.' }],
    ['model', { modelId: 'gpt' }],
    ['temperature', { temperature: 0.7 }],
    ['avatar', { avatarUrl: '/persona-avatars/b.jpg' }],
  ])('is true when the %s changes', (_label, patch) => {
    expect(isDraftDirty({ ...BASE_DRAFT, ...patch }, BASE_DRAFT)).toBe(true)
  })
})

describe('isDraftDirty tolerance', () => {
  it('ignores float noise on the temperature but not a real slider step', () => {
    expect(isDraftDirty({ ...BASE_DRAFT, temperature: 0.30000001 }, { ...BASE_DRAFT, temperature: 0.3 })).toBe(false)
    expect(isDraftDirty({ ...BASE_DRAFT, temperature: 0.31 }, { ...BASE_DRAFT, temperature: 0.3 })).toBe(true)
  })

  it('ignores line endings and trailing whitespace in the instructions, not content', () => {
    expect(isDraftDirty({ ...BASE_DRAFT, instructions: 'a\r\nb\n\n' }, { ...BASE_DRAFT, instructions: 'a\nb' })).toBe(false)
    expect(isDraftDirty({ ...BASE_DRAFT, instructions: 'a\nc' }, { ...BASE_DRAFT, instructions: 'a\nb' })).toBe(true)
  })
})

describe('avatarKey', () => {
  it('ignores the signed-URL query string on stored avatars', () => {
    expect(avatarKey('https://cdn.example.com/a/b.jpg?X-Amz-Signature=1')).toBe('https://cdn.example.com/a/b.jpg')
    expect(avatarKey('https://cdn.example.com/a/b.jpg?X-Amz-Signature=2')).toBe(avatarKey('https://cdn.example.com/a/b.jpg?X-Amz-Signature=1'))
  })

  it('keeps pool paths and data URLs whole, and nothing as null', () => {
    expect(avatarKey('/persona-avatars/a.jpg?x=1')).toBe('/persona-avatars/a.jpg?x=1')
    expect(avatarKey('data:image/png;base64,AA==')).toBe('data:image/png;base64,AA==')
    expect(avatarKey(null)).toBeNull()
    expect(avatarKey('')).toBeNull()
  })

  it('does not call a re-signed stored avatar a change', () => {
    const base = { name: 'a', description: 'b', instructions: 'c', modelId: 'm', temperature: 0.5, tags: [] as string[] }
    expect(isDraftDirty(
      { ...base, avatarUrl: 'https://cdn/x.jpg?sig=2' },
      { ...base, avatarUrl: 'https://cdn/x.jpg?sig=1' },
    )).toBe(false)
  })
})

describe('handles', () => {
  it('slugifies like the backend', () => {
    expect(slugifyHandle('  Support Triage! ')).toBe('support-triage')
    expect(slugifyHandle('!!!')).toBe('persona')
  })

  it('suffixes a taken handle', () => {
    expect(previewHandle('Support Triage', new Set())).toBe('support-triage')
    expect(previewHandle('Support Triage', new Set(['support-triage']))).toBe('support-triage-2')
    expect(previewHandle('Support Triage', new Set(['support-triage', 'support-triage-2']))).toBe('support-triage-3')
  })
})

describe('deriveDescription', () => {
  it('keeps a short purpose as is, collapsing whitespace', () => {
    expect(deriveDescription('  Reviews   contracts \n quickly ')).toBe('Reviews contracts quickly')
  })

  it('never exceeds the limit', () => {
    const long = 'word '.repeat(80)
    expect(deriveDescription(long).length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it('prefers a sentence boundary', () => {
    const first = 'Reviews every contract that comes in and flags anything risky for a lawyer to look at.'
    const text = `${first} Then it drafts a short summary of the findings for the whole team to read quickly.`
    expect(deriveDescription(text)).toBe(first)
  })

  it('falls back to a word boundary with an ellipsis', () => {
    const text = 'a'.repeat(10) + ' ' + 'b'.repeat(60) + ' ' + 'c'.repeat(80)
    const out = deriveDescription(text)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(out).not.toMatch(/\s…$/)
  })
})

describe('deriveAgentNames', () => {
  it('names the work and the role', () => {
    expect(deriveAgentNames('Reviews contracts and flags risks in plain English')[0]).toBe('Contract Reviewer')
    expect(deriveAgentNames('Summarises support tickets and flags urgent ones')[0]).toBe('Support Ticket Summarizer')
    // Cadence words ("weekly", "daily") describe when, not what, so they are not part of the name.
    expect(deriveAgentNames('Drafts weekly reports')[0]).toBe('Report Writer')
  })

  it('handles an "an agent that…" opener', () => {
    expect(deriveAgentNames('An agent that triages support emails every morning')[0]).toBe('Support Email Triage')
    expect(deriveAgentNames('Make me an assistant that translates product pages')[0]).toBe('Product Page Translator')
  })

  it('uses a generic role for unmapped and unknown verbs', () => {
    expect(deriveAgentNames('Qualifies leads, handles objections')[0]).toBe('Lead Assistant')
    expect(deriveAgentNames('Handles customer inquiries, resolves issues')[0]).toBe('Customer Inquiry Assistant')
  })

  it('does not treat a leading plural noun as a verb', () => {
    expect(deriveAgentNames('Sales assistant for our SaaS')[0]).toBe('Sales Assistant')
  })

  it('does not repeat a role word already in the phrase', () => {
    const [first] = deriveAgentNames('Customer support assistant')
    expect(first).not.toMatch(/Assistant Assistant/)
  })

  it('returns distinct options, best first, within the requested count', () => {
    const names = deriveAgentNames('Reviews contracts and flags risks', 3)
    expect(names).toEqual(['Contract Reviewer', 'Contract Assistant', 'Contract Helper'])
    expect(new Set(names.map(n => n.toLowerCase())).size).toBe(names.length)
    expect(deriveAgentNames('Reviews contracts', 1)).toEqual(['Contract Reviewer'])
  })

  it('falls back when nothing usable can be extracted', () => {
    expect(deriveAgentNames('')).toEqual([FALLBACK_AGENT_NAME])
    expect(deriveAgentNames('!!! ???')).toEqual([FALLBACK_AGENT_NAME])
    expect(deriveAgentNames('Reviews')).toEqual([FALLBACK_AGENT_NAME])
  })

  it('never exceeds the name limit', () => {
    const names = deriveAgentNames(`Reviews ${'extraordinarilylongwordwithoutbreaks'.repeat(4)}`)
    for (const name of names) expect(name.length).toBeLessThanOrEqual(NAME_MAX)
  })
})

describe('nextAgentName', () => {
  it('cycles through the derived options and wraps', () => {
    const purpose = 'Reviews contracts and flags risks'
    expect(nextAgentName(purpose, 'Contract Reviewer')).toBe('Contract Assistant')
    expect(nextAgentName(purpose, 'Contract Assistant')).toBe('Contract Helper')
    expect(nextAgentName(purpose, 'Contract Helper')).toBe('Contract Reviewer')
  })

  it('starts from the top when the current name is not one of the options', () => {
    expect(nextAgentName('Reviews contracts and flags risks', 'My own name')).toBe('Contract Reviewer')
  })
})

describe('model rules', () => {
  it('restricts blocked and starter-tier models', () => {
    expect(agentModelRestriction(model({ blocked: true }))).toBe('blocked')
    expect(agentModelRestriction(model({ planType: 'Free' }))).toBe('tier')
    expect(agentModelRestriction(model({ planType: 'starter' }))).toBe('tier')
    expect(agentModelRestriction(model({ modelType: 'free' }))).toBe('tier')
    expect(agentModelRestriction(model({ planType: 'pro' }))).toBeNull()
  })

  it('picks the recommended allowed model', () => {
    const picked = pickModelForAgent([
      model({ modelId: 'a', modelName: 'A' }),
      model({ modelId: 'b', modelName: 'B', tags: ['Recommended'] }),
      model({ modelId: 'c', modelName: 'C', tags: ['Recommended'], blocked: true }),
      model({ modelId: 'd', modelName: 'D', tags: ['Recommended'], planType: 'free' }),
    ])
    expect(picked?.modelId).toBe('b')
  })

  it('falls back to the first allowed model, and to null when none qualify', () => {
    expect(pickModelForAgent([model({ modelId: 'z', modelName: 'Z' }), model({ modelId: 'a', modelName: 'A' })])?.modelId).toBe('a')
    expect(pickModelForAgent([model({ blocked: true }), model({ planType: 'free' })])).toBeNull()
    expect(pickModelForAgent([])).toBeNull()
  })
})

describe('creativity', () => {
  it('suggests lower for factual work and higher for creative work', () => {
    expect(suggestTemperature('Triage support tickets')).toBe(0.3)
    expect(suggestTemperature('Brainstorm campaign ideas')).toBe(0.7)
    expect(suggestTemperature('Helps me with my day')).toBe(0.5)
  })

  it('prefers creative when both signals appear', () => {
    expect(suggestTemperature('Write marketing copy from support tickets')).toBe(0.7)
  })

  it('labels the range', () => {
    expect(temperatureLabel(0)).toBe('Very precise')
    expect(temperatureLabel(0.3)).toBe('Precise')
    expect(temperatureLabel(0.5)).toBe('Balanced')
    expect(temperatureLabel(0.7)).toBe('Creative')
    expect(temperatureLabel(1)).toBe('Very creative')
  })

  it('clamps to 0..1 and survives NaN', () => {
    expect(clampTemperature(-1)).toBe(0)
    expect(clampTemperature(2)).toBe(1)
    expect(clampTemperature(0.4)).toBe(0.4)
    expect(clampTemperature(Number.NaN)).toBe(0.5)
  })
})

describe('tone', () => {
  const [direct, warm] = FALLBACK_TONES
  const BODY = 'You triage support emails.\n\nBe brief.'

  it('reads the default when there is no tone line', () => {
    expect(readTone(BODY, FALLBACK_TONES)).toEqual({ kind: 'default' })
  })

  it('appends a tone line after a blank line', () => {
    const out = applyTone(BODY, direct)
    expect(out).toBe(`${BODY}\n\n${toneLine(direct)}`)
    expect(readTone(out, FALLBACK_TONES)).toEqual({ kind: 'known', tone: direct })
  })

  it('writes the line alone into empty instructions', () => {
    expect(applyTone('', warm)).toBe(toneLine(warm))
  })

  it('replaces the existing tone line in place instead of stacking', () => {
    const withDirect = `You triage.\n${toneLine(direct)}\nBe brief.`
    const out = applyTone(withDirect, warm)
    expect(out).toBe(`You triage.\n${toneLine(warm)}\nBe brief.`)
    expect(out.match(/^Tone:/gm)).toHaveLength(1)
  })

  it('collapses duplicate tone lines into one', () => {
    const out = applyTone(`Tone: a\nmiddle\nTone: b`, warm)
    expect(out).toBe(`${toneLine(warm)}\nmiddle`)
  })

  it('removes the line when set back to default, without leaving a gap', () => {
    const out = applyTone(`${BODY}\n\n${toneLine(direct)}`, null)
    expect(out).toBe(BODY)
    expect(readTone(out, FALLBACK_TONES)).toEqual({ kind: 'default' })
  })

  it('leaves instructions without a tone line untouched when clearing', () => {
    expect(applyTone(BODY, null)).toBe(BODY)
  })

  it('reports an unrecognised tone line as custom', () => {
    expect(readTone('Be nice.\nTone: sarcastic', FALLBACK_TONES)).toEqual({ kind: 'custom', line: 'Tone: sarcastic' })
  })

  it('does not treat the word "Tone" mid-line as a tone line', () => {
    expect(readTone('Match the user. Tone: keep it light', FALLBACK_TONES)).toEqual({ kind: 'default' })
    expect(applyTone('Match the user. Tone: keep it light', direct)).toContain('Match the user. Tone: keep it light')
  })
})

describe('question cards', () => {
  const opt = (label: string) => ({ label, description: `${label} implies…` })

  it('keeps usable questions only, capped at the card limit', () => {
    const out = usableQuestions([
      { question: 'Which inbox?', multi_select: false, options: [opt('Gmail'), opt('Outlook')] },
      { question: '   ', options: [opt('a'), opt('b')] },
      { question: 'One option only?', options: [opt('only')] },
      { question: 'Where to send?', multi_select: true, options: [opt('Slack'), opt('Email'), opt(' ')] },
      { question: 'Tone?', options: [opt('Formal'), opt('Casual')] },
      { question: 'Fifth?', options: [opt('x'), opt('y')] },
    ])
    expect(out.map(q => q.question)).toEqual(['Which inbox?', 'Where to send?', 'Tone?'])
    expect(out).toHaveLength(MAX_QUESTION_CARDS)
    expect(out[1].multiSelect).toBe(true)
    expect(out[1].options.map(o => o.label)).toEqual(['Slack', 'Email'])
  })

  it('returns nothing for no questions', () => {
    expect(usableQuestions([])).toEqual([])
  })

  it('builds a brief from the purpose alone when nothing was answered', () => {
    expect(buildGenerationBrief('  Triage   emails ', [])).toBe('Triage emails')
    expect(buildGenerationBrief('Triage emails', [{ question: 'Q?', answer: '  ' }])).toBe('Triage emails')
  })

  it('appends answered clarifications', () => {
    expect(buildGenerationBrief('Triage emails', [{ question: 'Inbox?', answer: 'Gmail' }, { question: 'Output?', answer: 'Slack, Email' }]))
      .toBe('Triage emails\n\nClarifications:\n- Inbox? → Gmail\n- Output? → Slack, Email')
  })
})
