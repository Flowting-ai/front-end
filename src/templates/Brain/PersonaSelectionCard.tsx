'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { UserIcon, ArrowRightOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { StreamingIndicator } from '@/components/StreamingIndicator'
import { springs } from '@/lib/springs'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PersonaSelectionItem {
  id:           string
  name:         string
  handle:       string
  /** One-line summary shown below @handle — helps users pick the right lens. */
  description?: string
  avatarUrl?:   string
}

export interface PersonaSelectionCardProps {
  personas:           PersonaSelectionItem[]
  /** Brain's recommended persona — pre-selected and badged on mount. */
  recommendedId?:     string
  /** Start in the locked "Using [name]" state — for completed thread records. */
  defaultLocked?:     boolean
  /** Name shown in the locked row when defaultLocked=true. */
  lockedPersonaName?: string
  onProceed?:         (id: string) => void
  onSkip?:            () => void
}

function PersonaAvatar({ avatarUrl, name, personaId }: { avatarUrl?: string; name: string; personaId: string }) {
  const [imgError, setImgError] = useState(false)
  const src = (avatarUrl && !imgError)
    ? avatarUrl
    : getPersonaFallbackAvatar(personaId || name)

  return (
    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic persona URL with onError fallback */}
      <img
        src={src}
        alt=""
        onError={() => setImgError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}

// ── Inline action button ──────────────────────────────────────────────────────

function InlineAction({ label, onClick }: { label: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:  'none',
        border:      'none',
        padding:     0,
        cursor:      'pointer',
        fontFamily:  'var(--font-body)',
        fontSize:    'var(--font-size-caption)',
        lineHeight:  'var(--line-height-caption)',
        color:       hovered ? 'var(--neutral-600)' : 'var(--neutral-400)',
        transition:  'color 0.12s ease',
      }}
    >
      {label}
    </button>
  )
}

// ── Compact locked row ────────────────────────────────────────────────────────

type LockState = 'open' | 'selecting' | 'persona' | 'none'

function PersonaSelectingRow({
  personaName,
  personaId,
  avatarUrl,
}: {
  personaName: string
  personaId: string
  avatarUrl?: string
}) {
  const [phase, setPhase] = useState<'choosing' | 'streaming'>('choosing')
  const avatarSrc = avatarUrl ?? getPersonaFallbackAvatar(personaId || personaName)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setPhase('streaming'), 420)
    return () => window.clearTimeout(timer)
  }, [personaName])

  return (
    <m.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.fast}
      style={{ padding: '8px 0' }}
    >
      <StreamingIndicator
        phase={phase}
        label={phase === 'choosing' ? 'Selecting persona…' : `Using ${personaName}`}
        logoKey={personaName}
        logo={(
          // eslint-disable-next-line @next/next/no-img-element -- dynamic persona URL with deterministic fallback
          <img
            src={avatarSrc}
            alt=""
            style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover', display: 'block' }}
          />
        )}
      />
    </m.div>
  )
}

function LockedRow({
  lockState,
  personaName,
  onChangeLock,
  onRemove,
}: {
  lockState:    LockState
  personaName?: string
  onChangeLock: () => void
  onRemove?:    () => void
}) {
  const isPersona = lockState === 'persona'
  return (
    <m.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.fast}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', flexWrap: 'wrap' }}
    >
      <span style={{ flexShrink: 0, lineHeight: 0 }}>
        <UserIcon size={14} color={isPersona ? 'var(--neutral-400)' : 'var(--neutral-300)'} />
      </span>

      {isPersona ? (
        <>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-500)',
          }}>
            Using
          </span>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-700)',
          }}>
            {personaName}
          </span>
          <span aria-hidden style={{ color: 'var(--neutral-300)', userSelect: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)' }}>·</span>
          <InlineAction label="Change" onClick={onChangeLock} />
          <span aria-hidden style={{ color: 'var(--neutral-300)', userSelect: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)' }}>·</span>
          <InlineAction label="Don't use" onClick={onRemove} />
        </>
      ) : (
        <>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-400)',
          }}>
            No persona lens
          </span>
          <span aria-hidden style={{ color: 'var(--neutral-300)', userSelect: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)' }}>·</span>
          <InlineAction label="Add one" onClick={onChangeLock} />
        </>
      )}
    </m.div>
  )
}

// ── PersonaSelectionCard ──────────────────────────────────────────────────────

export function PersonaSelectionCard({
  personas,
  recommendedId,
  defaultLocked     = false,
  lockedPersonaName,
  onProceed,
  onSkip,
}: PersonaSelectionCardProps) {
  const [lockState,   setLockState]   = useState<LockState>(defaultLocked ? 'persona' : 'open')
  const [lockedName,  setLockedName]  = useState<string>(lockedPersonaName ?? '')
  const [lockedId,    setLockedId]    = useState<string>('')
  const [lockedAvatar, setLockedAvatar] = useState<string | undefined>()
  const [selected,    setSelected]    = useState<string | undefined>(
    recommendedId ?? personas[0]?.id,
  )

  const isSingle        = personas.length === 1

  React.useEffect(() => {
    if (lockState !== 'selecting') return
    const timer = window.setTimeout(() => setLockState('persona'), 900)
    return () => window.clearTimeout(timer)
  }, [lockState])

  const handleProceed = () => {
    if (!selected) return
    const persona = personas.find(p => p.id === selected)
    setLockedName(persona?.name ?? '')
    setLockedId(persona?.id ?? selected)
    setLockedAvatar(persona?.avatarUrl)
    setLockState('selecting')
    onProceed?.(selected)
  }

  const handleSkip = () => {
    setLockState('none')
    onSkip?.()
  }

  const bodyText = isSingle
    ? 'Brain recommends a persona for this task. Confirm to use it as a lens before planning begins.'
    : `Brain found ${personas.length} personas that fit this task. Select one to use as a lens before planning begins.`

  const buttonLabel = selected ? 'Use this persona' : 'Select a persona'

  return (
    <AnimatePresence mode="wait" initial={false}>
      {lockState === 'selecting' ? (
        <PersonaSelectingRow
          key="selecting"
          personaName={lockedName}
          personaId={lockedId}
          avatarUrl={lockedAvatar}
        />
      ) : lockState !== 'open' ? (
        <LockedRow
          key="locked"
          lockState={lockState}
          personaName={lockedName}
          onChangeLock={() => setLockState('open')}
          onRemove={lockState === 'persona' ? () => setLockState('none') : undefined}
        />
      ) : (
        <m.div
          key="open"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.fast}
          style={{
            borderRadius:  12,
            padding:       20,
            border:        '1px solid var(--neutral-200)',
            display:       'flex',
            flexDirection: 'column',
            gap:           14,
          }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <UserIcon size={14} color="var(--neutral-400)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-500)',
          lineHeight: 'var(--line-height-caption)',
        }}>
          {isSingle ? 'Recommended persona' : 'Select a persona'}
        </span>
      </div>

      {/* Body copy */}
      <p style={{
        margin:     0,
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        color:      'var(--neutral-700)',
        lineHeight: 'var(--line-height-body)',
      }}>
        {bodyText}
      </p>

      {/* Persona list */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        borderRadius:  12,
        border:        '1px solid var(--neutral-200)',
      }}>
        {personas.map((p, i) => {
          const isSelected    = p.id === selected
          const isRecommended = p.id === recommendedId
          const avatarSrc     = p.avatarUrl ?? getPersonaFallbackAvatar(p.id)
          const isFirst       = i === 0
          const isLast        = i === personas.length - 1

          return (
            <label
              key={p.id}
              style={{
                display:               'flex',
                alignItems:            'center',
                gap:                   10,
                padding:               '12px 14px',
                borderTop:             i > 0 ? '1px solid var(--neutral-200)' : 'none',
                cursor:                'pointer',
                backgroundColor:       isSelected ? 'var(--neutral-50)' : 'var(--neutral-white)',
                transition:            'background-color 150ms ease',
                borderTopLeftRadius:   isFirst ? 12 : 0,
                borderTopRightRadius:  isFirst ? 12 : 0,
                borderBottomLeftRadius:  isLast ? 12 : 0,
                borderBottomRightRadius: isLast ? 12 : 0,
              }}
            >
              <input
                type="radio"
                name="persona-selection"
                value={p.id}
                checked={isSelected}
                onChange={() => setSelected(p.id)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              />

              {/* Number / checkmark indicator */}
              <div style={{
                width:           22,
                height:          22,
                borderRadius:    6,
                border:          isSelected ? 'none' : '1.5px solid var(--neutral-200)',
                flexShrink:      0,
                backgroundColor: isSelected ? 'var(--neutral-800)' : 'transparent',
                boxSizing:       'border-box',
                transition:      'background-color 150ms ease, border 150ms ease',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
              }}>
                {isSelected ? (
                  <TickTwoIcon size={12} color="var(--neutral-white)" />
                ) : (
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   '11px',
                    fontWeight: 'var(--font-weight-medium)',
                    lineHeight: 1,
                    color:      'var(--neutral-400)',
                  }}>
                    {i + 1}
                  </span>
                )}
              </div>

              <PersonaAvatar avatarUrl={avatarSrc} name={p.name} personaId={p.id} />

              {/* Name · handle · description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 0 0', minWidth: 0 }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-body)',
                    fontWeight: 'var(--font-weight-medium)',
                    lineHeight: 'var(--line-height-body)',
                    color:      isSelected ? 'var(--neutral-800)' : 'var(--neutral-600)',
                    transition: 'color 150ms ease',
                  }}>
                    {p.name}
                  </span>
                  {isRecommended && (
                    <Badge color="Neutral" label="Recommended" />
                  )}
                </div>

                <span style={{
                  fontFamily: 'var(--font-code)',
                  fontSize:   'var(--font-size-code)',
                  lineHeight: 'var(--line-height-code)',
                  color:      'var(--neutral-400)',
                }}>
                  @{p.handle}
                </span>

                {p.description && (
                  <span style={{
                    marginTop:  2,
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-caption)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      'var(--neutral-500)',
                  }}>
                    {p.description}
                  </span>
                )}

              </div>
            </label>
          )
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          Proceed without persona
        </Button>
        <div style={{ flex: '1 0 0' }} />
        <Button
          variant="default"
          size="sm"
          rightIcon={<ArrowRightOneIcon />}
          disabled={!selected}
          onClick={handleProceed}
        >
          {buttonLabel}
        </Button>
      </div>

    </m.div>
      )}
    </AnimatePresence>
  )
}

PersonaSelectionCard.displayName = 'PersonaSelectionCard'
