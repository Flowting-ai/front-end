'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { UserIcon, ArrowRightOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { springs } from '@/lib/springs'

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

// ── Fallback avatar ───────────────────────────────────────────────────────────

const FALLBACK_AVATARS = [
  '/persona-avatars/0656f3b794e38cb70243c01880ae7e8c.jpg',
  '/persona-avatars/0d76e6ce216e9a37aabb374a0b5ff373.jpg',
  '/persona-avatars/1a28810d426619782dd1d5a595389cc1.jpg',
  '/persona-avatars/2d566c8909b00dd3a384be6fff13dde6.jpg',
  '/persona-avatars/3df055256e83c4e96b7d12375b0350c7.jpg',
  '/persona-avatars/545edd8b11f485a6af182827235fe77b.jpg',
  '/persona-avatars/610d02a62c92aabef208323fb3eb963b.jpg',
  '/persona-avatars/61a217559aa4835edef3077e097d8bff.jpg',
  '/persona-avatars/654341558b7022e87d7c11ad97c043f2.jpg',
  '/persona-avatars/67426067d03211790d002ab8dfd355b1.jpg',
  '/persona-avatars/7f4fa28c942a9c408d96c4b5f3adcfbe.jpg',
  '/persona-avatars/81fd248d2aea38920976f7d6420f90ca.jpg',
  '/persona-avatars/88dfe7bf97d198e8e9abb38db9d3f6a9.jpg',
  '/persona-avatars/b651f98459d8d64940c19220dc05e83c.jpg',
  '/persona-avatars/b75eeab04cced8e1a3d2edb69f2e134d.jpg',
  '/persona-avatars/c70a7e37d62d3983cc8561af76e98f40.jpg',
  '/persona-avatars/eed3b5053d44561ee17a1411b3c399dd.jpg',
  '/persona-avatars/eeef0281aa011612dac0bfc085d7798c.jpg',
]

function getFallbackAvatar(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_AVATARS[hash % FALLBACK_AVATARS.length]
}

function PersonaAvatar({ avatarUrl, name }: { avatarUrl?: string; name: string }) {
  const [imgError, setImgError] = useState(false)
  const src = (avatarUrl && !imgError) ? avatarUrl : getFallbackAvatar(name)

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

type LockState = 'open' | 'persona' | 'none'

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
  const [selected,    setSelected]    = useState<string | undefined>(
    recommendedId ?? personas[0]?.id,
  )

  const isSingle        = personas.length === 1

  const handleProceed = () => {
    if (!selected) return
    const name = personas.find(p => p.id === selected)?.name ?? ''
    setLockedName(name)
    setLockState('persona')
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
      {lockState !== 'open' ? (
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
          const avatarSrc     = p.avatarUrl ?? getFallbackAvatar(p.name)
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

              <PersonaAvatar avatarUrl={avatarSrc} name={p.name} />

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
