'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTwoIcon, ArrowDownOneIcon, ArrowLeftOneIcon, CancelOneIcon, StarIcon } from '@strange-huge/icons'
import { stableKey } from '@/hooks/use-model-selection'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import {
  ModalHeader,
  ModalShell,
  ModelPickerList,
  useModelCatalog,
  type ModelUnavailableReason,
} from '@/components/ChangeAgentModelModal/shared'
import { pickReplacementModel } from '@/lib/ai-models'
import { updateVersion } from '@/lib/api/personas'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'
import type { AIModel } from '@/types/ai-model'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UnavailableModelAgent {
  /** Persona repo id. */
  id:         string
  name:       string
  avatarUrl?: string | null
  /** Version to patch — agents without one can't be fixed and must not be passed in. */
  versionId:  string
  /** The model that stopped working. */
  modelId:    string | null
  modelName:  string | null
  reason:     ModelUnavailableReason
}

export interface FixAgentModelsModalProps {
  open: boolean
  onClose: () => void
  /** Every agent whose configured model is unavailable. */
  agents: UnavailableModelAgent[]
  /** Fires with the agents that were saved successfully (may be a subset). */
  onSaved: (updates: Array<{ id: string; modelId: string }>) => void
}

/** Sentinel target for "apply this pick to every listed agent". */
const ALL_TARGET = '__all__'

type View =
  | { kind: 'list' }
  | { kind: 'pick'; target: string }

// ── FixAgentModelsModal ───────────────────────────────────────────────────────
// The bulk counterpart to ChangeAgentModelModal: one place to see every agent
// that can't run and reassign them, either individually, all to one model, or
// all at once to the closest match for each. Saves through the same
// updateVersion() path as the single-agent modal and the Instructions tab.

export function FixAgentModelsModal({ open, onClose, agents, onSaved }: FixAgentModelsModalProps) {
  const { all, available, loading } = useModelCatalog(open)
  const [choices,   setChoices]   = useState<Record<string, string>>({})
  const [view,      setView]      = useState<View>({ kind: 'list' })
  const [saving,    setSaving]    = useState(false)
  const [failedIds, setFailedIds] = useState<string[]>([])

  // Reset on each open. Done during render (React's documented "adjust state
  // when a prop changes" pattern) rather than in an effect, so the modal never
  // paints one frame of the previous session's picks.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setChoices({})
      setView({ kind: 'list' })
      setFailedIds([])
    }
  }

  const modelById = useMemo(() => {
    const map = new Map<string, AIModel>()
    for (const model of all) {
      const key = stableKey(model)
      if (key) map.set(key, model)
    }
    return map
  }, [all])

  /** Closest available match for one agent's broken model. */
  const recommendFor = useCallback((agent: UnavailableModelAgent): string | null => {
    if (!available.length) return null
    const entry = agent.modelId ? modelById.get(agent.modelId) : undefined
    const hint  = entry ?? (agent.modelName ? { modelName: agent.modelName } : null)
    const pick  = pickReplacementModel(available, hint)
    return pick ? stableKey(pick) : null
  }, [available, modelById])

  const handleClose = useCallback(() => {
    if (saving) return
    onClose()
  }, [saving, onClose])

  function autoAssign() {
    const next: Record<string, string> = { ...choices }
    for (const agent of agents) {
      const pick = recommendFor(agent)
      if (pick) next[agent.id] = pick
    }
    setChoices(next)
    setFailedIds([])
    const assigned = agents.filter(a => next[a.id]).length
    if (assigned === 0) toast.error('No replacement models are available right now.')
  }

  function applyPick(target: string, modelId: string) {
    setChoices(prev => (
      target === ALL_TARGET
        ? Object.fromEntries(agents.map(a => [a.id, modelId]))
        : { ...prev, [target]: modelId }
    ))
    setFailedIds([])
    setView({ kind: 'list' })
  }

  const pending = useMemo(
    () => agents.filter(a => choices[a.id]),
    [agents, choices],
  )

  async function handleSave() {
    if (!pending.length) return
    setSaving(true)
    const results = await Promise.allSettled(
      pending.map(agent => updateVersion({
        repoId:    agent.id,
        versionId: agent.versionId,
        modelId:   choices[agent.id]!,
      })),
    )

    const saved:  Array<{ id: string; modelId: string }> = []
    const failed: string[] = []
    results.forEach((result, i) => {
      const agent = pending[i]!
      if (result.status === 'fulfilled') saved.push({ id: agent.id, modelId: choices[agent.id]! })
      else failed.push(agent.id)
    })

    setSaving(false)
    if (saved.length) onSaved(saved)

    if (failed.length) {
      // Keep the modal open so the failures stay actionable — the parent has
      // already removed the saved ones from `agents`.
      setFailedIds(failed)
      toast.error(
        failed.length === pending.length
          ? 'Couldn’t update the models. Please try again.'
          : `${failed.length} of ${pending.length} agents couldn’t be updated.`,
      )
      return
    }

    toast.success(saved.length === 1 ? 'Model updated' : `${saved.length} agents updated`)
    onClose()
  }

  // ── Picker step ─────────────────────────────────────────────────────────────

  if (view.kind === 'pick') {
    const target      = view.target
    const targetAgent = target === ALL_TARGET ? null : agents.find(a => a.id === target)
    const recommended = targetAgent ? recommendFor(targetAgent) : null

    return (
      <ModalShell open={open} onClose={handleClose} ariaLabel="Choose a replacement model" width={520}>
        <ModalHeader
          title={targetAgent ? `Model for ${targetAgent.name}` : 'Model for all agents'}
          subtitle={
            targetAgent
              ? targetAgent.modelName
                ? `Replacing ${targetAgent.modelName}.`
                : 'Pick a replacement model.'
              : `This replaces the model on all ${agents.length} agents below.`
          }
          left={
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Back"
              icon={<ArrowLeftOneIcon size={16} />}
              onClick={() => setView({ kind: 'list' })}
            />
          }
          right={<IconButton variant="ghost" size="sm" aria-label="Close" icon={<CancelOneIcon size={16} />} onClick={handleClose} />}
        />

        <ModelPickerList
          models={available}
          loading={loading}
          selectedId={targetAgent ? choices[targetAgent.id] ?? null : null}
          recommendedId={recommended}
          onSelect={(modelId) => applyPick(target, modelId)}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16 }}>
          <Button variant="ghost" onClick={() => setView({ kind: 'list' })}>
            Back
          </Button>
        </div>
      </ModalShell>
    )
  }

  // ── List step ───────────────────────────────────────────────────────────────

  return (
    <ModalShell open={open} onClose={handleClose} ariaLabel="Fix unavailable models" width={520}>
      <ModalHeader
        title="Fix unavailable models"
        subtitle={
          agents.length === 1
            ? '1 agent is set to a model that isn’t available. Pick a replacement.'
            : `${agents.length} agents are set to a model that isn’t available. Pick replacements.`
        }
        right={<IconButton variant="ghost" size="sm" aria-label="Close" icon={<CancelOneIcon size={16} />} onClick={handleClose} />}
      />

      {/* Bulk actions */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 16px 0', flexWrap: 'wrap' }}>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<StarIcon size={16} />}
          disabled={loading || !available.length || saving}
          onClick={autoAssign}
        >
          Auto-recommend for each
        </Button>
        <Button
          variant="secondary"
          size="sm"
          rightIcon={<ArrowDownOneIcon size={16} />}
          disabled={loading || !available.length || saving || !agents.length}
          onClick={() => setView({ kind: 'pick', target: ALL_TARGET })}
        >
          Apply one model to all
        </Button>
      </div>

      {/* Agent rows */}
      <div
        className="kaya-scrollbar"
        style={{
          display:             'flex',
          flexDirection:       'column',
          gap:                 4,
          margin:              '12px 16px 0',
          padding:             2,
          maxHeight:           360,
          overflowY:           'auto',
          overscrollBehaviorY: 'contain',
        }}
      >
        {agents.length === 0 ? (
          <p style={{ margin: '20px 0', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-400)' }}>
            Every agent has a working model.
          </p>
        ) : (
          agents.map(agent => (
            <AgentRow
              key={agent.id}
              agent={agent}
              chosenModelName={choices[agent.id] ? modelById.get(choices[agent.id]!)?.modelName ?? null : null}
              failed={failedIds.includes(agent.id)}
              disabled={loading || !available.length || saving}
              onPick={() => setView({ kind: 'pick', target: agent.id })}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 16 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-400)' }}>
          {pending.length
            ? `${pending.length} of ${agents.length} ready`
            : 'No replacements picked yet'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={!pending.length || saving}
            loading={saving}
            onClick={() => void handleSave()}
          >
            {pending.length > 1 ? `Update ${pending.length} agents` : 'Update agent'}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}

// ── AgentRow ──────────────────────────────────────────────────────────────────

function AgentRow({ agent, chosenModelName, failed, disabled, onPick }: {
  agent:            UnavailableModelAgent
  chosenModelName:  string | null
  failed:           boolean
  disabled:         boolean
  onPick:           () => void
}) {
  const [imgError, setImgError] = useState(false)
  const src = (agent.avatarUrl && !imgError) ? agent.avatarUrl : getPersonaFallbackAvatar(agent.name)

  return (
    <div
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        padding:         '8px 10px',
        borderRadius:    10,
        border:          `1px solid ${failed ? 'var(--color-tag-Red-text)' : 'var(--neutral-100)'}`,
        backgroundColor: 'var(--neutral-white)',
      }}
    >
      <div aria-hidden style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic avatar URL, onError fallback requires HTMLImageElement access */}
        <img
          src={src}
          alt={agent.name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            title={agent.name}
            style={{
              fontFamily:   'var(--font-body)',
              fontSize:     'var(--font-size-body)',
              lineHeight:   '20px',
              color:        'var(--neutral-950)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {agent.name}
          </span>
          <Badge
            label={agent.reason === 'blocked' ? 'Turned off' : 'Retired'}
            color={agent.reason === 'blocked' ? 'Neutral' : 'Yellow'}
          />
        </div>
        <p
          style={{
            margin:       '2px 0 0',
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-caption)',
            lineHeight:   'var(--line-height-caption)',
            color:        failed ? 'var(--color-tag-Red-text)' : 'var(--neutral-400)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {failed
            ? 'Update failed — try again'
            : chosenModelName
              ? `${agent.modelName ?? 'Unknown model'} → ${chosenModelName}`
              : agent.modelName ?? 'Unknown model'}
        </p>
      </div>

      <Button
        variant={chosenModelName ? 'ghost' : 'secondary'}
        size="sm"
        disabled={disabled}
        leftIcon={chosenModelName ? undefined : <AlertTwoIcon size={16} color="var(--color-tag-Yellow-text)" />}
        rightIcon={<ArrowDownOneIcon size={16} />}
        onClick={onPick}
      >
        {chosenModelName ? 'Change' : 'Choose'}
      </Button>
    </div>
  )
}

export default FixAgentModelsModal
