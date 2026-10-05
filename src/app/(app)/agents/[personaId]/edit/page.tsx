'use client'

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeftOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Spinner } from '@/components/Spinner'
import { AgentEditor } from '@/components/AgentEditor/AgentEditor'
import { SyncNotice } from '@/components/AgentEditor/SyncNotice'
import { HINT_STYLE } from '@/components/AgentEditor/styles'
import { AgentPageHeader, AgentPageShell } from '../../_components/AgentPageShell'
import { useAgentDraftSync } from '@/hooks/use-agent-draft-sync'
import { useSaveAgent } from '@/hooks/use-save-agent'
import { usePersonaRepoById } from '@/hooks/use-persona-repos'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { copyPersonaRepoDeduped, isPersonaOwnedByViewer } from '@/lib/api/personas'
import { resolveViewerUserId } from '@/lib/api/teams'
import type { AIModel } from '@/types/ai-model'
import {
  FALLBACK_TONES,
  applyTone,
  draftProblems,
  nextAgentName,
  previewHandle,
  readTone,
} from '@/lib/agent-draft'
import { recordFromRepo } from '@/lib/agent-record'
import { regenerateInstructions } from '@/lib/agent-generate'
import { defaultAvatarChoice } from '@/components/PersonaCard/AnimatedPersonaAvatar'
import { setStoredAvatarChoice, useStoredAvatarChoice } from '@/lib/avatar-choice'
import {
  AGENT_EDIT_ROUTE,
  AGENTS_ROUTE,
} from '@/lib/routes'

const PROBLEM_MESSAGE = {
  name:         'Give the agent a name.',
  model:        'Choose a model for the agent.',
  instructions: 'Add instructions for the agent.',
} as const

function StatusPanel({ title, children }: { title: string; children?: React.ReactNode }) {
  const { push } = useRouter()
  return (
    <AgentPageShell maxWidth={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center', paddingTop: 48 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)' }}>
          {title}
        </h1>
        {children}
        <Button variant="outline" size="sm" leftIcon={<ArrowLeftOneIcon size={16} />} onClick={() => push(AGENTS_ROUTE)}>
          Back to agents
        </Button>
      </div>
    </AgentPageShell>
  )
}

function EditAgentContent() {
  const { personaId } = useParams<{ personaId: string }>()
  const { push } = useRouter()
  const { currentUserRole, members } = useOrg()
  const { user } = useAuth()

  const { repo, isLoading: repoLoading } = usePersonaRepoById(personaId)
  const record = useMemo(() => (repo ? recordFromRepo(repo) : null), [repo])
  const storedAvatar = useStoredAvatarChoice(personaId)
  const { draft, baseline, dirty, notice, edit, markSaved, accept, dismissNotice } = useAgentDraftSync(record)
  const { save, saving } = useSaveAgent({ record, baseline, markSaved })

  const [models, setModels] = useState<AIModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copying, setCopying] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: 'leave' | 'instructions'; route?: string } | null>(null)
  const leavingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchModelsWithCache()
      .then(list => { if (!cancelled) setModels(list) })
      .catch(() => { if (!cancelled) setModels([]) })
      .finally(() => { if (!cancelled) setModelsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Unsaved edits are lost on a reload or tab close — ask first.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      if (!leavingRef.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // ── Who may edit ────────────────────────────────────────────────────────────
  const viewerUserId = resolveViewerUserId(members, user?.email)
  const persona = repo ? repo.toPersona() : null
  const isOwner = persona
    ? persona.sourceShareId === null && isPersonaOwnedByViewer(persona, {}, viewerUserId, currentUserRole === 'admin')
    : false
  const isTeamShared = persona?.visibility === 'team'

  async function handleCopy() {
    if (!persona || copying) return
    setCopying(true)
    const toastId = toast.loading(`Copying “${persona.name}”…`)
    try {
      const copy = await copyPersonaRepoDeduped(persona.id, persona.activeVersionId)
      toast.success(`Copied “${persona.name}” — editing your copy`, { id: toastId })
      push(AGENT_EDIT_ROUTE(copy.id))
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to copy agent. Please try again.')
      setCopying(false)
    }
  }

  // ── Leaving ─────────────────────────────────────────────────────────────────
  function go(route: string) {
    if (dirty) { setConfirm({ kind: 'leave', route }); return }
    leavingRef.current = true
    push(route)
  }

  // ── Regenerate ──────────────────────────────────────────────────────────────
  async function runRegenerateInstructions() {
    if (!draft) return
    setRegenerating(true)
    try {
      const fresh = await regenerateInstructions({ name: draft.name.trim() || draft.name, purpose: draft.description, answers: [] })
      const previous = readTone(draft.instructions, FALLBACK_TONES)
      edit({ instructions: previous.kind === 'known' ? applyTone(fresh.instructions, previous.tone) : fresh.instructions })
      toast.success('New instructions generated — review them, then save')
    } catch {
      toast.error('Couldn’t generate new instructions. Please try again.')
    } finally {
      setRegenerating(false)
    }
  }

  // ── States before the editor ────────────────────────────────────────────────
  if (repoLoading || !draft || !baseline) {
    if (!repoLoading && !repo) {
      return <StatusPanel title="Agent not found">
        <p style={{ ...HINT_STYLE, fontSize: 14, lineHeight: '22px' }}>It may have been deleted, or you may not have access to it.</p>
      </StatusPanel>
    }
    if (!repoLoading && repo && !record) {
      return <StatusPanel title="Nothing to edit yet">
        <p style={{ ...HINT_STYLE, fontSize: 14, lineHeight: '22px' }}>This agent has no saved version.</p>
      </StatusPanel>
    }
    return (
      <AgentPageShell>
        <div role="status" aria-live="polite" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <Spinner size={24} />
        </div>
      </AgentPageShell>
    )
  }

  if (!isOwner) {
    return (
      <StatusPanel title={isTeamShared ? 'This agent is shared with your workspace' : 'You can’t edit this agent'}>
        <p style={{ ...HINT_STYLE, fontSize: 14, lineHeight: '22px', maxWidth: 440 }}>
          {isTeamShared
            ? 'Only its owner can change it. Make your own copy to edit.'
            : 'Only its owner can change it.'}
        </p>
        {isTeamShared && (
          <Button variant="default" size="sm" loading={copying} onClick={() => void handleCopy()}>
            Make my own copy
          </Button>
        )}
      </StatusPanel>
    )
  }

  const handle = record && draft.name.trim() === baseline.name.trim()
    ? record.handle.replace(/^@/, '')
    : previewHandle(draft.name, new Set())
  const problems = draftProblems(draft)

  async function handleSave() {
    if (!draft || saving) return
    const [problem] = draftProblems(draft)
    if (problem) { toast.error(PROBLEM_MESSAGE[problem]); return }
    // Saved: back to the agents list. (leavingRef lets the unsaved-changes guard stand aside.)
    if (await save(draft)) {
      leavingRef.current = true
      push(AGENTS_ROUTE)
    }
  }

  return (
    <AgentPageShell>
      <AgentPageHeader
        title="Edit agent"
        subtitle={record?.isLive ? `@${handle}` : `@${handle} · Not live yet — saving will publish it.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => go(AGENTS_ROUTE)} disabled={saving}>Back</Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleSave()}
              loading={saving}
              disabled={saving || (!dirty && !!record?.isLive) || problems.length > 0}
            >
              Save changes
            </Button>
          </>
        }
      />

      {notice && (
        <div style={{ width: '100%', marginBottom: 20 }}>
          <SyncNotice notice={notice} onLoadLatest={accept} onDismiss={dismissNotice} />
        </div>
      )}

      <AgentEditor
        draft={draft}
        onChange={edit}
        models={models}
        modelsLoading={modelsLoading}
        handle={handle}
        disabled={saving}
        onRegenerateName={() => edit({ name: nextAgentName(draft.description, draft.name) })}
        avatarChoice={storedAvatar ?? defaultAvatarChoice(draft.name || 'agent', personaId)}
        onAvatarChoice={choice => { setStoredAvatarChoice(personaId, choice); toast.success('Avatar updated') }}
        onRegenerateInstructions={() => {
          // Existing instructions are real work — always confirm before replacing them.
          if (draft.instructions.trim()) setConfirm({ kind: 'instructions' })
          else void runRegenerateInstructions()
        }}
        regeneratingInstructions={regenerating}
      />

      {confirm?.kind === 'leave' && (
        <ConfirmModal
          title="Leave without saving?"
          description="You have unsaved changes to this agent. They’ll be lost if you leave."
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={async () => {
            leavingRef.current = true
            if (confirm.route) push(confirm.route)
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'instructions' && (
        <ConfirmModal
          title="Replace your instructions?"
          description="Generating new instructions replaces what’s there now. You can still cancel without saving."
          confirmLabel="Generate new"
          cancelLabel="Keep mine"
          danger={false}
          onConfirm={async () => { await runRegenerateInstructions() }}
          onClose={() => setConfirm(null)}
        />
      )}
    </AgentPageShell>
  )
}

export default function EditAgentPage() {
  return (
    <Suspense>
      <EditAgentContent />
    </Suspense>
  )
}
