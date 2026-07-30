'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { m, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { CancelOneIcon } from '@strange-huge/icons'
import { useMounted } from '@/hooks/use-mounted'
import { stableKey } from '@/hooks/use-model-selection'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { ModelSelectItem } from '@/components/ModelSelectItem'
import { SouvenirModelIcon } from '@/components/SouvenirModelIcon'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { updateVersion } from '@/lib/api/personas'
import type { AIModel } from '@/types/ai-model'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_MODAL = '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)'

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
  /** Fires after the model is saved successfully. */
  onSaved: (model: { modelId: string; modelName: string }) => void
}

// ── ChangeAgentModelModal ─────────────────────────────────────────────────────
// Same "pick a model, then save" job as the Instructions tab's model picker,
// but reachable directly from a disabled persona card on the agents list —
// no navigation away, and Save calls the same updateVersion() persistence
// path that tab uses, so both surfaces write to the same place.

export function ChangeAgentModelModal({
  open,
  onClose,
  personaId,
  versionId,
  agentName,
  onSaved,
}: ChangeAgentModelModalProps) {
  const mounted = useMounted()
  const [models, setModels] = useState<AIModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset + (re)load the selectable model list every time the modal opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSelectedId(null)
    setModelsLoading(true)
    fetchModelsWithCache()
      .then(list => { if (!cancelled) setModels(list) })
      .catch(() => { if (!cancelled) setModels([]) })
      .finally(() => { if (!cancelled) setModelsLoading(false) })
    return () => { cancelled = true }
  }, [open])

  function handleClose() {
    if (saving) return
    onClose()
  }

  async function handleSave() {
    const model = models.find(m => stableKey(m) === selectedId)
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

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            style={{
              position:        'fixed',
              inset:           0,
              backgroundColor: 'rgba(0,0,0,0.28)',
              backdropFilter:  'blur(2px)',
              zIndex:          60,
            }}
          />

          {/* Centering wrapper */}
          <div
            style={{
              position:       'fixed',
              inset:          0,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              zIndex:         61,
              pointerEvents:  'none',
            }}
          >
            <m.div
              key="modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Change model for ${agentName}`}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                pointerEvents:   'auto',
                width:           420,
                maxWidth:        'calc(100vw - 32px)',
                borderRadius:    16,
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       SHADOW_MODAL,
                overflow:        'hidden',
                display:         'flex',
                flexDirection:   'column',
              }}
            >
              {/* ── Header ── */}
              <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--neutral-100)', position: 'relative' }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 400, lineHeight: '2rem', color: 'var(--neutral-900)' }}>
                  Change model
                </p>
                <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', fontWeight: 400, lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-400)' }}>
                  {agentName}&apos;s current model is unavailable — pick a replacement.
                </p>
                <div style={{ position: 'absolute', top: 14, right: 14 }}>
                  <IconButton variant="ghost" size="sm" aria-label="Close" icon={<CancelOneIcon size={16} />} onClick={handleClose} />
                </div>
              </div>

              {/* ── Model list ── */}
              <div
                className="kaya-scrollbar"
                style={{
                  display:             'flex',
                  flexDirection:       'column',
                  gap:                 '4px',
                  margin:              '16px 16px 0',
                  padding:             '2px',
                  maxHeight:           320,
                  overflowY:           'auto',
                  overscrollBehaviorY: 'contain',
                }}
              >
                {modelsLoading ? (
                  <p style={{ margin: '20px 0', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-400)' }}>
                    Loading models…
                  </p>
                ) : models.length === 0 ? (
                  <p style={{ margin: '20px 0', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-400)' }}>
                    No models available
                  </p>
                ) : (
                  models.map(model => {
                    const key = stableKey(model)
                    const isSelected = !!key && key === selectedId
                    return (
                      <ModelSelectItem
                        key={`${model.id}-${model.modelId}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        image={<SouvenirModelIcon size={18} />}
                        label={model.modelName}
                        selected={isSelected}
                        onClick={() => setSelectedId(key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedId(key)
                          }
                        }}
                      />
                    )
                  })
                )}
              </div>

              {/* ── Footer ── */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '16px' }}>
                <Button variant="ghost" onClick={handleClose} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="default" disabled={!selectedId || saving} loading={saving} onClick={() => void handleSave()}>
                  Save
                </Button>
              </div>
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default ChangeAgentModelModal
