'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowUpRightOneIcon, CancelOneIcon, SettingsOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Spinner } from '@/components/Spinner'
import { useMounted } from '@/hooks/use-mounted'
import { useAgentDraftSync } from '@/hooks/use-agent-draft-sync'
import { usePersonaRepoById } from '@/hooks/use-persona-repos'
import { useSaveAgent } from '@/hooks/use-save-agent'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { stableKey } from '@/hooks/use-model-selection'
import type { AIModel } from '@/types/ai-model'
import {
  DESCRIPTION_MAX,
  FALLBACK_TONES,
  NAME_MAX,
  draftProblems,
  isDraftDirty,
  type AgentDraft,
} from '@/lib/agent-draft'
import { recordFromRepo } from '@/lib/agent-record'
import { AGENT_EDIT_ROUTE } from '@/lib/routes'
import { getPersonaFallbackAvatar, pickDifferentTemplateAvatar } from '@/lib/persona-template-avatars'
import { AdvancedPersonalizeModal } from './AdvancedPersonalizeModal'
import { AvatarField } from './AvatarField'
import { ModelField } from './ModelField'
import { SyncNotice } from './SyncNotice'
import { BOX_STYLE, HINT_STYLE, INPUT_STYLE, LABEL_STYLE } from './styles'

const PANEL_WIDTH = 400

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

function Panel({ repoId, canEdit, onClose }: { repoId: string; canEdit: boolean; onClose: () => void }) {
  const { push } = useRouter()
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

  /** Saves `next` if it differs from what is saved and is complete. */
  async function commit(next: AgentDraft) {
    if (!baseline || saving || !isDraftDirty(next, baseline)) return
    const [first] = draftProblems(next)
    if (first) { setProblem(PROBLEM_MESSAGE[first]); return }
    setProblem(null)
    setJustSaved(false)
    if (await save(next, { quiet: true })) setJustSaved(true)
  }

  function change(patch: Partial<AgentDraft>, saveNow: boolean) {
    if (!draft) return
    setJustSaved(false)
    edit(patch)
    if (saveNow) void commit({ ...draft, ...patch })
  }

  const modelName = draft?.modelId
    ? models.find(model => stableKey(model) === draft.modelId)?.modelName ?? null
    : null

  return (
    <m.aside
      role="complementary"
      aria-label="Agent details"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed', top: 10, right: 10, bottom: 10, width: PANEL_WIDTH, maxWidth: 'calc(100vw - 20px)', zIndex: 40,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        backgroundColor: 'var(--neutral-white)', borderRadius: 18,
        boxShadow: '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px 20px', borderBottom: '1px solid var(--neutral-100)', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)' }}>
          Agent details
        </h2>
        <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close details" onClick={onClose} />
      </div>

      <div className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                  avatarUrl={draft.avatarUrl}
                  name={draft.name}
                  onChange={avatarUrl => change({ avatarUrl }, true)}
                  onRegenerate={() => change({ avatarUrl: pickDifferentTemplateAvatar(draft.avatarUrl) }, true)}
                  disabled={saving}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="agent-details-name" style={LABEL_STYLE}>Name</label>
                  <div style={{ ...BOX_STYLE, padding: '8px 10px' }}>
                    <input
                      id="agent-details-name"
                      type="text"
                      value={draft.name}
                      maxLength={NAME_MAX}
                      disabled={saving}
                      onChange={event => change({ name: event.target.value }, false)}
                      onBlur={() => void commit(draft)}
                      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <p style={HINT_STYLE}>{record.handle}</p>
                </div>

                <ModelField
                  modelId={draft.modelId}
                  models={models}
                  loading={modelsLoading}
                  onChange={modelId => change({ modelId }, true)}
                  disabled={saving}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label htmlFor="agent-details-description" style={LABEL_STYLE}>Description</label>
                    <span style={HINT_STYLE}>{draft.description.length}/{DESCRIPTION_MAX}</span>
                  </div>
                  <div style={{ ...BOX_STYLE, padding: '8px 10px' }}>
                    <textarea
                      id="agent-details-description"
                      value={draft.description}
                      rows={4}
                      disabled={saving}
                      onChange={event => change({ description: event.target.value.slice(0, DESCRIPTION_MAX) }, false)}
                      onBlur={() => void commit(draft)}
                      style={{ ...INPUT_STYLE, resize: 'none' }}
                    />
                  </div>
                </div>

                <div aria-live="polite" style={{ minHeight: 18 }}>
                  {problem ? (
                    <p role="alert" style={{ ...HINT_STYLE, color: 'var(--color-tag-Red-text, #9a3b34)' }}>{problem}</p>
                  ) : saving ? (
                    <p style={HINT_STYLE}>Saving…</p>
                  ) : justSaved ? (
                    <p style={HINT_STYLE}>Saved</p>
                  ) : null}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Button variant="outline" size="sm" leftIcon={<SettingsOneIcon size={16} />} disabled={saving} onClick={() => setAdvancedOpen(true)}>
                    Advanced personalize
                  </Button>
                  <Button variant="outline" size="sm" rightIcon={<ArrowUpRightOneIcon size={16} />} onClick={() => push(AGENT_EDIT_ROUTE(record.repoId))}>
                    Edit page
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- dynamic avatar URL */}
                  <img
                    src={draft.avatarUrl ?? getPersonaFallbackAvatar(draft.name || 'agent')}
                    alt=""
                    style={{ width: 65, height: 65, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)' }}>{draft.name}</p>
                    <p style={HINT_STYLE}>{record.handle}</p>
                  </div>
                </div>
                <ReadOnlyRow label="Model">{modelName ?? 'Unavailable model'}</ReadOnlyRow>
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
    </m.aside>
  )
}

/**
 * Quick look and quick fixes for one agent, beside the list — avatar, name, model
 * and description save as you leave each field; Advanced personalize opens the
 * rest. Reads and writes the same record as the editor page, so an edit here shows
 * up there (and the other way round) straight away.
 */
export function AgentDetailsSidebar({ repoId, canEdit, onClose }: AgentDetailsSidebarProps) {
  const mounted = useMounted()
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {repoId && <Panel key={repoId} repoId={repoId} canEdit={canEdit} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  )
}
