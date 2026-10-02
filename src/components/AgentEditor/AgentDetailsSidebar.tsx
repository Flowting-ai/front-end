'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SettingsOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { AnimatePresence, m } from 'framer-motion'
import { ModelIcon } from '@/components/ModelIcon'
import { Spinner } from '@/components/Spinner'
import { useProjectPanel } from '@/context/project-panel-context'
import { useAgentDraftSync } from '@/hooks/use-agent-draft-sync'
import { usePersonaRepoById } from '@/hooks/use-persona-repos'
import { useSaveAgent } from '@/hooks/use-save-agent'
import { fetchModelsWithCache, modelIconSource } from '@/lib/ai-models'
import { stableKey } from '@/hooks/use-model-selection'
import type { AIModel } from '@/types/ai-model'
import {
  DESCRIPTION_MAX,
  FALLBACK_TONES,
  NAME_MAX,
  draftProblems,
  type AgentDraft,
} from '@/lib/agent-draft'
import { recordFromRepo } from '@/lib/agent-record'
import { defaultAvatarChoice } from '@/components/PersonaCard/AnimatedPersonaAvatar'
import { setStoredAvatarChoice, useStoredAvatarChoice } from '@/lib/avatar-choice'
import { AdvancedPersonalizeModal } from './AdvancedPersonalizeModal'
import { AvatarField } from './AvatarField'
import { AgentAvatar } from './AgentAvatar'
import { ModelField } from './ModelField'
import { SyncNotice } from './SyncNotice'
import { BOX_STYLE, HINT_STYLE, INPUT_STYLE, LABEL_STYLE } from './styles'


const PROBLEM_MESSAGE = {
  name:         'Give the agent a name.',
  model:        'Choose a model for the agent.',
  instructions: 'The agent needs instructions — add them in Advanced personalize.',
} as const

export interface AgentDetailsSidebarProps {
  /** The agent to show, or null for closed. */
  repoId:  string | null
  /** Whether the viewer owns the agent — only owners get editable fields. */
  canEdit: boolean
  onClose: () => void
}

function ReadOnlyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={LABEL_STYLE}>{label}</p>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-800)', whiteSpace: 'pre-wrap' }}>
        {children}
      </div>
    </div>
  )
}

/**
 * ONE save for everything unsaved in the panel (name and description together): a white
 * rounded button with a black tick that appears only while there is something to save and
 * says how many changes it will save. Always white and black (not themed), so it reads the
 * same on the light and dark panel.
 */
function SaveChanges({ count, onClick, disabled }: { count: number; onClick: () => void; disabled?: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <m.div
          key="save-changes"
          initial={{ opacity: 0, scale: 0.9, height: 0 }}
          animate={{ opacity: 1, scale: 1, height: 'auto' }}
          exit={{ opacity: 0, scale: 0.9, height: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          style={{ display: 'flex', justifyContent: 'flex-end', overflow: 'visible' }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 14px 0 10px', border: 'none', borderRadius: 999,
              backgroundColor: '#FFFFFF', color: '#000000',
              fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 14, lineHeight: '20px',
              boxShadow: '0px 1px 3px rgba(0,0,0,0.25), 0px 0px 0px 1px rgba(0,0,0,0.08)',
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
            }}
          >
            <TickTwoIcon size={16} color="#000000" />
            {`Save ${count} ${count === 1 ? 'change' : 'changes'}`}
          </button>
        </m.div>
      )}
    </AnimatePresence>
  )
}

/** The details content itself (model saves as you pick; name and description have their own save tick; Advanced personalize) — no header or frame. */
export function AgentDetailsBody({ repoId, canEdit, onClose }: { repoId: string; canEdit: boolean; onClose: () => void }) {
  const { repo, isLoading } = usePersonaRepoById(repoId)
  const record = useMemo(() => (repo ? recordFromRepo(repo) : null), [repo])
  const { draft, baseline, notice, edit, markSaved, accept, dismissNotice } = useAgentDraftSync(record)
  const { save, saving } = useSaveAgent({ record, baseline, markSaved })

  const [models, setModels] = useState<AIModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchModelsWithCache()
      .then(list => { if (!cancelled) setModels(list) })
      .catch(() => { if (!cancelled) setModels([]) })
      .finally(() => { if (!cancelled) setModelsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Escape closes the panel — but not while a dialog is open on top of it, and not
  // from inside a field, where Escape must never throw away what was just typed.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (document.querySelector('[aria-modal="true"]')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  /**
   * Saves just the given fields. The rest of the agent is sent as last saved, and any OTHER
   * field still being typed is put back into the draft afterwards, so saving the name never
   * swallows (or saves) half of a description.
   */
  async function saveFields(patch: Partial<AgentDraft>, saved: string) {
    if (!draft || !baseline || saving) return
    const next = { ...baseline, ...patch }
    const [first] = draftProblems(next)
    if (first) { setProblem(PROBLEM_MESSAGE[first]); return }
    setProblem(null)
    setJustSaved(false)
    const pending: Partial<AgentDraft> = {}
    if (!('name' in patch) && draft.name !== baseline.name) pending.name = draft.name
    if (!('description' in patch) && draft.description !== baseline.description) pending.description = draft.description
    if (!('modelId' in patch) && draft.modelId !== baseline.modelId) pending.modelId = draft.modelId
    if (await save(next, { quiet: true })) {
      if (Object.keys(pending).length > 0) edit(pending)
      setJustSaved(true)
      toast.success(saved)
    }
  }

  function change(patch: Partial<AgentDraft>) {
    setJustSaved(false)
    setProblem(null)
    edit(patch)
  }

  const nameDirty = !!draft && !!baseline && draft.name !== baseline.name
  const descriptionDirty = !!draft && !!baseline && draft.description !== baseline.description
  const unsavedCount = (nameDirty ? 1 : 0) + (descriptionDirty ? 1 : 0)

  /** Saves every unsaved field in one go. */
  function saveChanges() {
    if (!draft || unsavedCount === 0) return
    const patch: Partial<AgentDraft> = {}
    if (nameDirty) patch.name = draft.name
    if (descriptionDirty) patch.description = draft.description
    void saveFields(patch, unsavedCount > 1 ? `${unsavedCount} changes saved` : nameDirty ? 'Name updated' : 'Description updated')
  }

  const storedAvatar = useStoredAvatarChoice(repoId)
  const selectedModel = draft?.modelId ? models.find(model => stableKey(model) === draft.modelId) ?? null : null
  const modelName = selectedModel?.modelName ?? null

  // Rendered inside the shared right-hand slide-in panel (see project-panel-context),
  // which supplies the header, close button, background and scrolling.
  return (
    <>
      {/* 6px of padding all round: the pink focus ring extends ~5px and the panel's scroll area clips overflow. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 6 }}>
        {isLoading || (repo && record && !draft) ? (
          <div role="status" aria-live="polite" style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><Spinner size={22} /></div>
        ) : !repo || !record || !draft || !baseline ? (
          <p style={{ ...HINT_STYLE, fontSize: 14, lineHeight: '22px' }}>
            This agent couldn’t be found. It may have been deleted, or you may not have access to it.
          </p>
        ) : (
          <>
            {notice && <SyncNotice notice={notice} onLoadLatest={accept} onDismiss={dismissNotice} />}

            {canEdit ? (
              <>
                <AvatarField
                  name={draft.name}
                  value={storedAvatar ?? defaultAvatarChoice(draft.name || 'agent', repoId)}
                  onChange={choice => { setStoredAvatarChoice(repoId, choice); toast.success('Avatar updated') }}
                  disabled={saving}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="agent-details-name" style={LABEL_STYLE}>Name</label>
                  <div className="kaya-field" style={{ ...BOX_STYLE, padding: '8px 10px' }}>
                    <input
                      id="agent-details-name"
                      type="text"
                      value={draft.name}
                      maxLength={NAME_MAX}
                      disabled={saving}
                      onChange={event => change({ name: event.target.value })}
                      onKeyDown={event => { if (event.key === 'Enter') saveChanges() }}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <p style={HINT_STYLE}>{record.handle}</p>
                </div>

                <ModelField
                  modelId={draft.modelId}
                  models={models}
                  loading={modelsLoading}
                  onChange={modelId => void saveFields({ modelId }, 'Model updated')}
                  disabled={saving}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label htmlFor="agent-details-description" style={LABEL_STYLE}>Description</label>
                    <span style={HINT_STYLE}>{draft.description.length}/{DESCRIPTION_MAX}</span>
                  </div>
                  <div className="kaya-field" style={{ ...BOX_STYLE, padding: '8px 10px' }}>
                    <textarea
                      id="agent-details-description"
                      value={draft.description}
                      rows={4}
                      disabled={saving}
                      onChange={event => change({ description: event.target.value.slice(0, DESCRIPTION_MAX) })}
                      style={{ ...INPUT_STYLE, resize: 'none' }}
                    />
                  </div>
                </div>

                <SaveChanges count={unsavedCount} disabled={saving} onClick={saveChanges} />

                <Button variant="outline" size="sm" fluid leftIcon={<SettingsOneIcon size={16} />} disabled={saving} onClick={() => setAdvancedOpen(true)}>
                  Advanced personalize
                </Button>

                {/* Save status */}
                <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {problem ? (
                    <>
                      <Badge color="Red" label="Not saved" />
                      <p role="alert" style={{ ...HINT_STYLE, textAlign: 'center', color: 'var(--color-tag-Red-text, #9a3b34)' }}>{problem}</p>
                    </>
                  ) : saving ? (
                    <Badge color="Blue" label="Saving…" />
                  ) : nameDirty || descriptionDirty ? (
                    <Badge color="Yellow" label="Unsaved changes" />
                  ) : justSaved ? (
                    <Badge color="Green" label="Saved" />
                  ) : (
                    <Badge color="Neutral" label="All changes saved" />
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AgentAvatar name={draft.name} repoId={record.repoId} size={56} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)' }}>{draft.name}</p>
                    <p style={HINT_STYLE}>{record.handle}</p>
                  </div>
                </div>
                <ReadOnlyRow label="Model">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {selectedModel && <ModelIcon model={modelIconSource(selectedModel)} size={16} />}
                    {modelName ?? 'Unavailable model'}
                  </span>
                </ReadOnlyRow>
                <ReadOnlyRow label="Description">{draft.description || '—'}</ReadOnlyRow>
                <p style={HINT_STYLE}>Only the owner can edit this agent.</p>
              </>
            )}
          </>
        )}
      </div>

      {canEdit && draft && (
        <AdvancedPersonalizeModal
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          values={{ instructions: draft.instructions, temperature: draft.temperature }}
          tones={FALLBACK_TONES}
          saveLabel="Save"
          onSave={async values => {
            const ok = await save({ ...draft, ...values })
            if (!ok) throw new Error('Saving failed')
          }}
        />
      )}
    </>
  )
}

/**
 * Quick look and quick fixes for one agent, beside the list — avatar, name, model
 * and description save as you leave each field; Advanced personalize opens the
 * rest. Reads and writes the same record as the editor page, so an edit here shows
 * up there (and the other way round) straight away.
 */
export function AgentDetailsSidebar({ repoId, canEdit, onClose }: AgentDetailsSidebarProps) {
  const { setPanel } = useProjectPanel()
  // Keep the latest onClose without re-registering the panel on every parent render.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Hand the panel to AppLayout's slide-in slot: it animates open beside the page (pushing the
  // content over) instead of floating on top of it.
  useEffect(() => {
    if (!repoId) { setPanel(null); return }
    setPanel({
      title: 'Agent details',
      sidePadding: 20,
      onClose: () => onCloseRef.current(),
      content: <AgentDetailsBody key={repoId} repoId={repoId} canEdit={canEdit} onClose={() => onCloseRef.current()} />,
    })
  }, [repoId, canEdit, setPanel])

  // Closing the page (or switching away) releases the slot.
  useEffect(() => () => setPanel(null), [setPanel])

  return null
}
