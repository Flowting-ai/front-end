'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { PinIcon, FileTwoIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { springs } from '@/lib/springs'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinConfirmationPin {
  id:      string
  title:   string
  /** Source label — e.g. "Notion", "Linear", "Google Drive" */
  source?: string
  /** Optional icon override — defaults to FileTwoIcon. Pass size 16 icons. */
  icon?:   React.ReactNode
}

export interface PinConfirmationCardProps {
  /** Pins Brain surfaced as relevant context. */
  pins:             PinConfirmationPin[]
  /** Pre-selected pin ids — defaults to all pins selected. */
  defaultSelected?: string[]
  /** Start in the locked state — used in completed thread records. */
  defaultLocked?:   boolean
  /** Count shown in locked row when defaultLocked=true. */
  lockedCount?:     number
  /** Called with the ids of the confirmed pins. */
  onProceed?:       (selectedIds: string[]) => void
  /** Called when the user proceeds without any pins. */
  onSkip?:          () => void
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
        background: 'none',
        border:     'none',
        padding:    0,
        cursor:     'pointer',
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      hovered ? 'var(--neutral-600)' : 'var(--neutral-400)',
        transition: 'color 0.12s ease',
      }}
    >
      {label}
    </button>
  )
}

// ── PinConfirmationCard ───────────────────────────────────────────────────────

export function PinConfirmationCard({
  pins,
  defaultSelected,
  defaultLocked = false,
  lockedCount,
  onProceed,
  onSkip,
}: PinConfirmationCardProps) {
  const defaultIds        = defaultSelected ?? pins.map(p => p.id)
  const [selected,   setSelected]   = useState<Set<string>>(new Set(defaultIds))
  const [locked,     setLocked]     = useState<boolean>(defaultLocked)
  const [confirmedCount, setConfirmedCount] = useState<number>(
    lockedCount ?? defaultIds.length,
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCount = selected.size

  const handleProceed = () => {
    const ids = [...selected]
    setConfirmedCount(ids.length)
    setLocked(true)
    onProceed?.(ids)
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {locked ? (

        // ── Locked row ──
        <m.div
          key="locked"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={springs.fast}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}
        >
          <span style={{ flexShrink: 0, lineHeight: 0 }}>
            <PinIcon size={14} color="var(--neutral-400)" />
          </span>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-500)',
          }}>
            {confirmedCount} pin{confirmedCount !== 1 ? 's' : ''} in context
          </span>
          <span aria-hidden style={{ color: 'var(--neutral-300)', userSelect: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)' }}>·</span>
          <InlineAction label="Change" onClick={() => setLocked(false)} />
        </m.div>

      ) : (

        // ── Open card ──
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
        <PinIcon size={14} color="var(--neutral-400)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-500)',
          lineHeight: 'var(--line-height-caption)',
        }}>
          Found relevant context
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
        Brain found {pins.length} pin{pins.length !== 1 ? 's' : ''} that look relevant. Confirm which ones to use as context before planning begins.
      </p>

      {/* Pin list */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        borderRadius:  12,
        border:        '1px solid var(--neutral-200)',
        overflow:      'hidden',
      }}>
        {pins.map((pin, i) => {
          const isChecked = selected.has(pin.id)
          return (
            <label
              key={pin.id}
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             10,
                padding:         '10px 14px',
                borderTop:       i > 0 ? '1px solid var(--neutral-200)' : 'none',
                cursor:          'pointer',
                backgroundColor: 'var(--neutral-white)',
              }}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggle(pin.id)}
                aria-label={`Include "${pin.title}"`}
              />
              <div style={{ flexShrink: 0, lineHeight: 0 }}>
                {pin.icon ?? <FileTwoIcon size={16} color="var(--neutral-400)" />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 0 0', minWidth: 0 }}>
                <span style={{
                  fontFamily:   'var(--font-body)',
                  fontSize:     'var(--font-size-body)',
                  fontWeight:   'var(--font-weight-medium)',
                  lineHeight:   'var(--line-height-body)',
                  color:        isChecked ? 'var(--neutral-800)' : 'var(--neutral-400)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  transition:   'color 0.12s ease',
                }}>
                  {pin.title}
                </span>
                {pin.source && (
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-caption)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      'var(--neutral-400)',
                  }}>
                    {pin.source}
                  </span>
                )}
              </div>
            </label>
          )
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Proceed without pins
        </Button>
        <div style={{ flex: '1 0 0' }} />
        <Button
          variant="default"
          size="sm"
          rightIcon={<ArrowRightOneIcon />}
          disabled={selectedCount === 0}
          onClick={handleProceed}
        >
          {selectedCount > 0
            ? `Use ${selectedCount} pin${selectedCount !== 1 ? 's' : ''}`
            : 'No pins selected'
          }
        </Button>
      </div>

        </m.div>
      )}
    </AnimatePresence>
  )
}

PinConfirmationCard.displayName = 'PinConfirmationCard'
