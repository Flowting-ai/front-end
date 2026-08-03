'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CancelOneIcon } from '@strange-huge/icons'
import { stableKey } from '@/hooks/use-model-selection'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { pickReplacementModel } from '@/lib/ai-models'
import { updateVersion } from '@/lib/api/personas'
import {
  ModalHeader,
  ModalShell,
  ModelPickerList,
  useModelCatalog,
  type ModelUnavailableReason,
} from './shared'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChangeAgentModelModalProps {
  open: boolean
  onClose: () => void
  /** Persona repo id — the version being patched belongs to this agent. */
  personaId: string
  /** The version to update (the persona's active/published version). */
  versionId: string
  /** Shown in the modal header. */
  agentName: string
  /** Stable id of the model that stopped working — used to pick a close match. */
  currentModelId?: string | null
  /** Display name of that model, so the copy can name it. */
  currentModelName?: string | null
  /** Drives the copy: a model the user turned off reads differently to a retired one. */
  reason?: ModelUnavailableReason
  /** Fires after the model is saved successfully. */
  onSaved: (model: { modelId: string; modelName: string }) => void
}

// ── ChangeAgentModelModal ─────────────────────────────────────────────────────
// Same "pick a model, then save" job as the Instructions tab's model picker,
// but reachable directly from a disabled persona card on the agents list —
// no navigation away, and Save calls the same updateVersion() persistence
// path that tab uses, so both surfaces write to the same place.
//
// For fixing several agents at once, see FixAgentModelsModal — it shares this
// modal's catalog hook and picker list.

export function ChangeAgentModelModal({
  open,
  onClose,
  personaId,
  versionId,
  agentName,
  currentModelId,
  currentModelName,
  reason,
  onSaved,
}: ChangeAgentModelModalProps) {
  const { all, available, loading } = useModelCatalog(open)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Closest match to the model being replaced — same provider, then tier.
  // For a retired model there's no catalog entry left, so fall back to the
  // display name the caller passed down from the card.
  const recommendedId = useMemo(() => {
    if (!available.length) return null
    const entry = currentModelId ? all.find(m => stableKey(m) === currentModelId) : undefined
    const hint = entry ?? (currentModelName ? { modelName: currentModelName } : null)
    const pick = pickReplacementModel(available, hint)
    return pick ? stableKey(pick) : null
  }, [all, available, currentModelId, currentModelName])

  // Derived, not seeded by an effect: the recommendation stands in until the
  // user picks something, so Save is one click as soon as the catalog lands.
  // Callers mount this per agent (see the `key` at the call site), so there's
  // no stale pick to reset between agents.
  const selectedId = pickedId ?? recommendedId

  const handleClose = useCallback(() => {
    if (saving) return
    onClose()
  }, [saving, onClose])

  async function handleSave() {
    const model = available.find(m => stableKey(m) === selectedId)
    const modelId = model ? stableKey(model) : null
    if (!model || !modelId) return
    setSaving(true)
    try {
      await updateVersion({ repoId: personaId, versionId, modelId })
      toast.success(`${agentName} is now using ${model.modelName}`)
      onSaved({ modelId, modelName: model.modelName })
      onClose()
    } catch {
      toast.error('Failed to update the model. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const subtitle = currentModelName
    ? reason === 'blocked'
      ? `${currentModelName} is turned off for this account — pick a replacement for ${agentName}.`
      : `${currentModelName} is no longer available — pick a replacement for ${agentName}.`
    : `${agentName}'s current model is unavailable — pick a replacement.`

  return (
    <ModalShell open={open} onClose={handleClose} ariaLabel={`Change model for ${agentName}`}>
      <ModalHeader
        title="Change model"
        subtitle={subtitle}
        right={<IconButton variant="ghost" size="sm" aria-label="Close" icon={<CancelOneIcon size={16} />} onClick={handleClose} />}
      />

      <ModelPickerList
        models={available}
        loading={loading}
        selectedId={selectedId}
        recommendedId={recommendedId}
        onSelect={setPickedId}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '16px' }}>
        <Button variant="ghost" onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="default" disabled={!selectedId || saving} loading={saving} onClick={() => void handleSave()}>
          Save
        </Button>
      </div>
    </ModalShell>
  )
}

export default ChangeAgentModelModal
