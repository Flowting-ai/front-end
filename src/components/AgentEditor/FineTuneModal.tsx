'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { ConfirmModal } from '@/components/ConfirmModal'
import { EnhancePromptField } from '@/components/EnhancePromptField'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/Tabs'
import { ModalHeader, ModalShell } from '@/components/ChangeAgentModelModal/shared'
import { clampTemperature } from '@/lib/agent-draft'
import { CreativityField } from './CreativityField'
import { HINT_STYLE, LABEL_STYLE } from './styles'

export interface AdvancedValues {
  instructions: string
  temperature:  number
}

export interface FineTuneModalProps {
  open:    boolean
  onClose: () => void
  /** The values the modal starts from each time it opens. */
  values:  AdvancedValues
  /** Applies the edits. Reject/throw to keep the modal open (the caller shows the error). */
  onSave:  (next: AdvancedValues) => void | Promise<void>
  /** Label for the confirm button — "Save" when it persists, "Apply" when it only updates a draft. */
  saveLabel?: string
}

/** Skills and memories have no per-agent backend yet, so they are shown as upcoming rather than as dead controls. */
function ComingSoonSection({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p style={LABEL_STYLE}>{title}</p>
        <Badge color="Neutral" label="Coming soon" />
      </div>
      <p style={HINT_STYLE}>{hint}</p>
    </div>
  )
}

function Body({
  values, onSave, onClose, onDirtyChange, saveLabel,
}: Pick<FineTuneModalProps, 'values' | 'onSave' | 'onClose' | 'saveLabel'> & {
  onDirtyChange: (dirty: boolean) => void
}) {
  const [instructions, setInstructions] = useState(values.instructions)
  const [temperature, setTemperature] = useState(values.temperature)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('instructions')

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
      <Tabs value={tab} onValueChange={setTab} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto' }}>
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <TabsList>
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>
        </div>
        <div
          className="kaya-scrollbar"
          style={{ display: 'flex', flexDirection: 'column', padding: 20, overflowY: 'auto', minHeight: 0, flex: '1 1 auto' }}
        >
          <TabsContent value="instructions" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <EnhancePromptField label={null} value={instructions} onChange={setInstructions} ariaLabel="Agent instructions" />
            {instructions.trim().length === 0 && (
              <p role="alert" style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-tag-Red-text, var(--red-700))' }}>
                Instructions can’t be empty.
              </p>
            )}
          </TabsContent>
          <TabsContent value="preferences" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <ComingSoonSection title="Skills" hint="Teach this agent reusable abilities it can call on." />
            <ComingSoonSection title="Memories" hint="Preferences this agent should always remember about you." />
            <CreativityField value={temperature} onChange={setTemperature} disabled={saving} />
          </TabsContent>
        </div>
      </Tabs>
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
 * Fine-tune — instructions and preferences (skills, memories, creativity) in two tabs. Opens from
 * the editor page and the sidebar details; both feed the same agent record.
 */
export function FineTuneModal({ open, onClose, values, onSave, saveLabel }: FineTuneModalProps) {
  const [dirty, setDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Backdrop click / Escape on a modal with edits asks first, so a stray click can't lose them.
  const requestClose = useMemo(() => () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }, [dirty, onClose])

  return (
    <>
      <ModalShell open={open} onClose={requestClose} ariaLabel="Fine-tune" width={640}>
        <ModalHeader
          title="Fine-tune"
          subtitle="Instructions and preferences for how this agent behaves."
          right={<IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={requestClose} />}
        />
        <Body
          values={values}
          onSave={onSave}
          onClose={onClose}
          onDirtyChange={setDirty}
          saveLabel={saveLabel}
        />
      </ModalShell>
      {confirmDiscard && (
        <ConfirmModal
          title="Discard changes?"
          description="Your edits in Fine-tune haven’t been saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={async () => { setDirty(false); onClose() }}
          onClose={() => setConfirmDiscard(false)}
        />
      )}
    </>
  )
}
