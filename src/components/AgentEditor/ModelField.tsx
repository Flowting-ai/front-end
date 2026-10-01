'use client'

import React, { useMemo, useState } from 'react'
import { ArrowDownOneIcon, AtomOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { ModelIcon } from '@/components/ModelIcon'
import { ModalHeader, ModalShell, ModelPickerList } from '@/components/ChangeAgentModelModal/shared'
import { stableKey } from '@/hooks/use-model-selection'
import { sortModels } from '@/lib/ai-models'
import { agentModelRestriction, pickModelForAgent } from '@/lib/agent-draft'
import type { AIModel } from '@/types/ai-model'
import { HINT_STYLE, LABEL_STYLE } from './styles'

export interface ModelFieldProps {
  /** Backend id of the selected model, or null when none is chosen yet. */
  modelId:  string | null
  /** The full catalog (including blocked models, so a pinned model still resolves). */
  models:   AIModel[]
  loading:  boolean
  onChange: (modelId: string) => void
  disabled?: boolean
}

function findModel(models: AIModel[], modelId: string | null): AIModel | null {
  if (!modelId) return null
  return models.find(model => stableKey(model) === modelId) ?? null
}

export function ModelField({ modelId, models, loading, onChange, disabled = false }: ModelFieldProps) {
  const [open, setOpen] = useState(false)

  const selected = findModel(models, modelId)
  // Only models an agent may run on are offered; the recommended one is tagged.
  const offered = useMemo(
    () => sortModels(models.filter(model => agentModelRestriction(model) === null && !!stableKey(model))),
    [models],
  )
  const recommended = useMemo(() => {
    const model = pickModelForAgent(models)
    return model ? stableKey(model) : null
  }, [models])

  // What is wrong with the current choice, if anything.
  const problem = (() => {
    if (!modelId) return 'Choose a model for this agent.'
    if (loading) return null
    if (!selected) return 'This model is no longer available. Choose another.'
    const restriction = agentModelRestriction(selected)
    if (restriction === 'blocked') return 'This model is turned off for your account. Choose another.'
    if (restriction === 'tier') return 'This model is not available for agents. Choose another.'
    return null
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <p style={LABEL_STYLE}>Model</p>
        {!modelId && <Badge label="Required" color="Red" />}
      </div>
      <Button
        type="button"
        variant="secondary"
        fluid
        disabled={disabled}
        aria-haspopup="dialog"
        aria-invalid={problem !== null || undefined}
        leftIcon={
          selected
            ? <ModelIcon model={selected.companyName ?? selected.modelName} size={16} />
            : <AtomOneIcon size={16} />
        }
        rightIcon={<ArrowDownOneIcon size={16} />}
        onClick={() => setOpen(true)}
      >
        {selected?.modelName ?? (modelId && !loading ? 'Unavailable model' : modelId ? 'Loading…' : 'Select model')}
      </Button>
      {problem ? (
        <p role="alert" style={{ ...HINT_STYLE, color: 'var(--color-tag-Red-text, #9a3b34)' }}>{problem}</p>
      ) : (
        <p style={HINT_STYLE}>Picked for the work this agent does — change it any time.</p>
      )}

      <ModalShell open={open} onClose={() => setOpen(false)} ariaLabel="Choose a model" width={440}>
        <ModalHeader
          title="Choose a model"
          subtitle="Starter-tier and turned-off models can't run agents."
          right={<IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={() => setOpen(false)} />}
        />
        <ModelPickerList
          models={offered}
          loading={loading}
          selectedId={modelId}
          recommendedId={recommended}
          onSelect={id => { onChange(id); setOpen(false) }}
          maxHeight={360}
        />
        <div style={{ height: 16 }} />
      </ModalShell>
    </div>
  )
}
