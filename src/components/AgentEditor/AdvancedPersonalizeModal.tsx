'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { ConfirmModal } from '@/components/ConfirmModal'
import { EnhancePromptField } from '@/components/EnhancePromptField'
import { IconButton } from '@/components/IconButton'
import { ModalHeader, ModalShell } from '@/components/ChangeAgentModelModal/shared'
import type { PersonaSound } from '@/lib/api/persona-schemas'
import { clampTemperature } from '@/lib/agent-draft'
import { CreativityField } from './CreativityField'
import { ToneField } from './ToneField'
import { LABEL_STYLE } from './styles'

export interface AdvancedValues {
  instructions: string
  temperature:  number
}

export interface AdvancedPersonalizeModalProps {
  open:    boolean
  onClose: () => void
  /** The values the modal starts from each time it opens. */
  values:  AdvancedValues
  tones:   readonly PersonaSound[]
  /** Applies the edits. Reject/throw to keep the modal open (the caller shows the error). */
  onSave:  (next: AdvancedValues) => void | Promise<void>
  /** Label for the confirm button — "Save" when it persists, "Apply" when it only updates a draft. */
  saveLabel?: string
}

function Body({
  values, tones, onSave, onClose, onDirtyChange, saveLabel,
}: Pick<AdvancedPersonalizeModalProps, 'values' | 'tones' | 'onSave' | 'onClose' | 'saveLabel'> & {
  onDirtyChange: (dirty: boolean) => void
}) {
  const [instructions, setInstructions] = useState(values.instructions)
  const [temperature, setTemperature] = useState(values.temperature)
  const [saving, setSaving] = useState(false)

  const dirty = instructions !== values.instructions || clampTemperature(temperature) !== clampTemperature(values.temperature)
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])

  const canSave = dirty && instructions.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({ instructions, temperature: clampTemperature(temperature) })
      onDirtyChange(false)
      onClose()
    } catch {
      // The caller has already surfaced the failure; keep the edits on screen.
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="kaya-scrollbar"
        style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 20, overflowY: 'auto', minHeight: 0, flex: '1 1 auto' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={LABEL_STYLE}>Instructions</p>
          <EnhancePromptField label={null} value={instructions} onChange={setInstructions} ariaLabel="Agent instructions" />
          {instructions.trim().length === 0 && (
            <p role="alert" style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-tag-Red-text, var(--red-700))' }}>
              Instructions can’t be empty.
            </p>
          )}
        </div>
        <ToneField instructions={instructions} tones={tones} onChange={setInstructions} disabled={saving} />
        <CreativityField value={temperature} onChange={setTemperature} disabled={saving} />
      </div>
      <div
        style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px 16px',
          borderTop: '1px solid var(--neutral-100)', flexShrink: 0,
        }}
      >
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" variant="default" size="sm" onClick={() => void handleSave()} loading={saving} disabled={!canSave}>
          {saveLabel ?? 'Save'}
        </Button>
      </div>
    </>
  )
}

/**
 * Advanced Personalize — instructions, tone and creativity in one place. Opens from
 * the editor page and the sidebar details; both feed the same agent record.
 */
export function AdvancedPersonalizeModal({ open, onClose, values, tones, onSave, saveLabel }: AdvancedPersonalizeModalProps) {
  const [dirty, setDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Backdrop click / Escape on a modal with edits asks first, so a stray click can't lose them.
  const requestClose = useMemo(() => () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }, [dirty, onClose])

  return (
    <>
      <ModalShell open={open} onClose={requestClose} ariaLabel="Advanced personalize" width={640}>
        <ModalHeader
          title="Advanced personalize"
          subtitle="Fine-tune how this agent behaves."
          right={<IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={requestClose} />}
        />
        <Body
          values={values}
          tones={tones}
          onSave={onSave}
          onClose={onClose}
          onDirtyChange={setDirty}
          saveLabel={saveLabel}
        />
      </ModalShell>
      {confirmDiscard && (
        <ConfirmModal
          title="Discard changes?"
          description="Your edits in Advanced personalize haven’t been saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={async () => { setDirty(false); onClose() }}
          onClose={() => setConfirmDiscard(false)}
        />
      )}
    </>
  )
}
