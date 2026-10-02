'use client'

import React from 'react'
import { RedoIcon } from '@strange-huge/icons'
import { EnhancePromptField } from '@/components/EnhancePromptField'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import type { AIModel } from '@/types/ai-model'
import type { PersonaSound } from '@/lib/api/persona-schemas'
import { DESCRIPTION_MAX, NAME_MAX, type AgentDraft } from '@/lib/agent-draft'
import { AgentPreviewCard } from './AgentPreviewCard'
import { AvatarField } from './AvatarField'
import type { AvatarChoice } from '@/components/PersonaCard/AnimatedPersonaAvatar'
import { CreativityField } from './CreativityField'
import { ModelField } from './ModelField'
import { ToneField } from './ToneField'
import { BOX_STYLE, HINT_STYLE, INPUT_STYLE, LABEL_STYLE, SECTION_TITLE_STYLE } from './styles'

export interface AgentEditorProps {
  draft:     AgentDraft
  onChange:  (patch: Partial<AgentDraft>) => void
  tones:     readonly PersonaSound[]
  models:    AIModel[]
  modelsLoading: boolean
  /** Handle without the leading @ (the backend's real one when editing, a preview when creating). */
  handle:    string
  /** True while saving — locks every field. */
  disabled?: boolean
  /** Omit to hide the control (e.g. editing, where there is no original purpose to work from). */
  onRegenerateName?:        () => void
  onRegenerateDescription?: () => void
  /** The picked avatar, and the handler for picking another. */
  avatarChoice:             AvatarChoice
  onAvatarChoice:           (choice: AvatarChoice) => void
  onRegenerateInstructions: () => void
  /** True while fresh instructions are being generated. */
  regeneratingInstructions?: boolean
  /** Content shown under the form on the edit screen (Try it, resources). */
  below?: React.ReactNode
  /** Sits under the live preview (e.g. the Try it box). */
  aside?: React.ReactNode
}

/** Hairline between sections / blocks. */
const DIVIDER_STYLE: React.CSSProperties = { width: '100%', height: 1, margin: 0, border: 'none', backgroundColor: 'var(--neutral-200)', flexShrink: 0 }

/** The page buttons above are sticky; the preview sticks just beneath them. */
const STICKY_TOP = 72

function RegenerateButton({ label, onClick, disabled, loading }: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Tooltip content={label} side="top">
      <IconButton
        type="button"
        variant="ghost"
        size="xs"
        icon={<RedoIcon />}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
      />
    </Tooltip>
  )
}

function FieldHeader({ label, htmlFor, action, counter }: { label: string; htmlFor?: string; action?: React.ReactNode; counter?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 }}>
      <label htmlFor={htmlFor} style={LABEL_STYLE}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {counter && <span style={HINT_STYLE}>{counter}</span>}
        {action}
      </div>
    </div>
  )
}

/**
 * The single-page agent editor: every field, pre-filled and editable in one
 * place, beside a live preview of the card. Used to create (after generation)
 * and to edit — the host decides what Finish / Save does.
 */
export function AgentEditor({
  draft, onChange, tones, models, modelsLoading, handle, disabled = false,
  onRegenerateName, onRegenerateDescription, avatarChoice, onAvatarChoice, onRegenerateInstructions,
  regeneratingInstructions = false, below, aside,
}: AgentEditorProps) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]" style={{ width: '100%', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>

        {/* ── Profile ─────────────────────────────────────────────── */}
        <section aria-labelledby="agent-editor-profile" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 id="agent-editor-profile" style={SECTION_TITLE_STYLE}>Profile</h2>

          <AvatarField name={draft.name} value={avatarChoice} onChange={onAvatarChoice} disabled={disabled} />

          {/* Name and model side by side (stacked when the column is narrow). */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <FieldHeader
                label="Name"
                htmlFor="agent-editor-name"
                action={onRegenerateName && <RegenerateButton label="Suggest another name" onClick={onRegenerateName} disabled={disabled} />}
              />
              <div className="kaya-field" style={{ ...BOX_STYLE, padding: '8px 10px' }}>
                <input
                  id="agent-editor-name"
                  type="text"
                  value={draft.name}
                  maxLength={NAME_MAX}
                  disabled={disabled}
                  placeholder="e.g. Legal Assistant"
                  onChange={event => onChange({ name: event.target.value })}
                  style={INPUT_STYLE}
                />
              </div>
              <p style={HINT_STYLE}>
                {draft.name.trim() ? <>@<strong style={{ fontWeight: 'var(--font-weight-medium)' }}>{handle}</strong> · </> : null}
                Handle is created from the name.
              </p>
            </div>

            <ModelField
              modelId={draft.modelId}
              models={models}
              loading={modelsLoading}
              onChange={modelId => onChange({ modelId })}
              disabled={disabled}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FieldHeader
              label="Description"
              htmlFor="agent-editor-description"
              counter={`${draft.description.length}/${DESCRIPTION_MAX}`}
              action={onRegenerateDescription && <RegenerateButton label="Rewrite from the purpose" onClick={onRegenerateDescription} disabled={disabled} />}
            />
            <div className="kaya-field" style={{ ...BOX_STYLE, padding: '8px 10px' }}>
              <textarea
                id="agent-editor-description"
                value={draft.description}
                rows={3}
                disabled={disabled}
                placeholder="What this agent does, in a line or two."
                onChange={event => onChange({ description: event.target.value.slice(0, DESCRIPTION_MAX) })}
                style={{ ...INPUT_STYLE, resize: 'none' }}
              />
            </div>
          </div>
        </section>

        <hr aria-hidden style={DIVIDER_STYLE} />

        {/* ── Behaviour ───────────────────────────────────────────── */}
        <section aria-labelledby="agent-editor-behaviour" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 id="agent-editor-behaviour" style={SECTION_TITLE_STYLE}>Behaviour</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FieldHeader
              label="Instructions"
              action={
                <RegenerateButton
                  label="Generate new instructions"
                  onClick={onRegenerateInstructions}
                  disabled={disabled || regeneratingInstructions}
                  loading={regeneratingInstructions}
                />
              }
            />
            <EnhancePromptField
              label={null}
              value={draft.instructions}
              onChange={instructions => onChange({ instructions })}
              ariaLabel="Agent instructions"
            />
            {draft.instructions.trim().length === 0 && (
              <p role="alert" style={{ ...HINT_STYLE, color: 'var(--color-tag-Red-text, #9a3b34)' }}>
                Add instructions — they tell the agent who it is and how to behave.
              </p>
            )}
          </div>

          <ToneField
            instructions={draft.instructions}
            tones={tones}
            onChange={instructions => onChange({ instructions })}
            disabled={disabled}
          />

          <CreativityField value={draft.temperature} onChange={temperature => onChange({ temperature })} disabled={disabled} />
        </section>

        {below}
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: STICKY_TOP, minWidth: 0 }}>
        <AgentPreviewCard
          name={draft.name}
          handle={handle}
          description={draft.description}
          avatarUrl={draft.avatarUrl}
          avatarChoice={avatarChoice}
          tags={draft.tags}
        />
        {aside && (
          <>
            <hr aria-hidden style={DIVIDER_STYLE} />
            {aside}
          </>
        )}
      </aside>
    </div>
  )
}
