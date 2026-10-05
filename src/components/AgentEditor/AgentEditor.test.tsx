import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AIModel } from '@/types/ai-model'
import { FALLBACK_TONES, toneLine, type AgentDraft } from '@/lib/agent-draft'

// The editor's fields are controlled and these are render-only smoke checks:
// the data layer is mocked so no module under test can reach the network.
vi.mock('@/lib/api/personas', () => ({ testVersionStream: vi.fn() }))

import { AgentEditor } from './AgentEditor'
import { ModelField } from './ModelField'

const DRAFT: AgentDraft = {
  name: 'Contract Reviewer',
  description: 'Reviews contracts and flags risks.',
  instructions: `You review contracts.\n\n${toneLine(FALLBACK_TONES[0])}`,
  modelId: 'pro',
  temperature: 0.3,
  avatarUrl: '/persona-avatars/a.jpg',
  tags: ['legal'],
}

const MODELS: AIModel[] = [
  { id: 1, modelId: 'pro', companyName: 'Anthropic', modelName: 'Pro Model', modelType: 'paid', inputLimit: 0, outputLimit: 0 },
]

const noop = () => {}

function render(over: Partial<React.ComponentProps<typeof AgentEditor>> = {}) {
  return renderToStaticMarkup(
    <AgentEditor
      draft={DRAFT}
      onChange={noop}
      models={MODELS}
      modelsLoading={false}
      handle="contract-reviewer"
      onRegenerateName={noop}
      onRegenerateDescription={noop}
      avatarChoice="guide"
      onAvatarChoice={noop}
      onRegenerateInstructions={noop}
      {...over}
    />,
  )
}

describe('AgentEditor', () => {
  it('renders every field pre-filled, beside the live preview', () => {
    const html = render()
    expect(html).toContain('value="Contract Reviewer"')
    expect(html).toContain('Reviews contracts and flags risks.')
    expect(html).toContain('@<strong')
    expect(html).toContain('contract-reviewer')
    expect(html).toContain('Pro Model')
    expect(html).toContain('Live preview')
    // Instructions and creativity are all on the page, so there is no Fine-tune button.
    expect(html).not.toContain('Fine-tune')
    expect(html).toContain('Creativity')
    expect(html).toContain('0.30 · Precise')
  })

  it('offers regenerate for name, description and instructions, and an avatar carousel, when handlers are given', () => {
    const html = render()
    expect(html).toContain('Suggest another name')
    expect(html).toContain('Rewrite from the purpose')
    expect(html).toContain('Generate new instructions')
    // The avatar is picked from the animated ones now — no upload or regenerate.
    expect(html).toContain('Change avatar')
    expect(html).not.toContain('Choose an avatar')
    expect(html).not.toContain('Upload')
  })

  it('hides the name and description regenerate controls when there is no purpose to work from', () => {
    const html = render({ onRegenerateName: undefined, onRegenerateDescription: undefined })
    expect(html).not.toContain('Suggest another name')
    expect(html).not.toContain('Rewrite from the purpose')
  })

  it('warns when the instructions are empty', () => {
    expect(render({ draft: { ...DRAFT, instructions: '' } })).toContain('Add instructions')
    expect(render()).not.toContain('Add instructions')
  })

  it('locks the fields while saving', () => {
    const html = render({ disabled: true })
    expect(html).toMatch(/<input[^>]*id="agent-editor-name"[^>]*disabled/)
  })

  it('renders the extra slots', () => {
    const html = render({ below: <p>BELOW-SLOT</p>, aside: <p>ASIDE-SLOT</p> })
    expect(html).toContain('BELOW-SLOT')
    expect(html).toContain('ASIDE-SLOT')
  })
})

describe('ModelField', () => {
  const field = (modelId: string | null, models = MODELS, loading = false) =>
    renderToStaticMarkup(<ModelField modelId={modelId} models={models} loading={loading} onChange={noop} />)

  it('shows the chosen model without a problem', () => {
    const html = field('pro')
    expect(html).toContain('Pro Model')
    expect(html).not.toContain('role="alert"')
  })

  it('asks for a model when none is chosen', () => {
    const html = field(null)
    expect(html).toContain('Select model')
    expect(html).toContain('Required')
    expect(html).toContain('Choose a model for this agent.')
  })

  it('flags a saved model that is no longer in the catalog', () => {
    const html = field('retired-model')
    expect(html).toContain('Unavailable model')
    expect(html).toContain('no longer available')
  })

  it('flags a model that is turned off or starter-tier', () => {
    expect(field('pro', [{ ...MODELS[0], blocked: true }])).toContain('turned off')
    expect(field('pro', [{ ...MODELS[0], planType: 'free' }])).toContain('not available for agents')
  })

  it('does not flag a missing model while the catalog is still loading', () => {
    const html = field('retired-model', [], true)
    expect(html).not.toContain('role="alert"')
    expect(html).toContain('Loading…')
  })
})
