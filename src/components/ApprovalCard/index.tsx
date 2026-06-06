'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'
import type { BadgeColor } from '@/components/Badge'

// ── Shadows ───────────────────────────────────────────────────────────────────
// Two-layer shadow system: outer elevation + inner depth overlay (KDS standard).
// Slightly warmer than CARD_SHADOW (QuestionCard) to distinguish this as
// elevated above the surrounding Brain thread.

const SHADOW_CARD  = '0px 4px 8px 0px rgba(82,75,71,0.10), 0px 0px 0px 1px rgba(59,54,50,0.12)'
const SHADOW_INNER = 'inset 0px 1px 0px 0px rgba(247,242,237,0.5), inset 0px -1px 0px 0px rgba(82,75,71,0.06)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovalActionType = 'delete' | 'send' | 'publish'
export type ApprovalStatus     = 'pending' | 'accepted' | 'denied'

const DENY_REASONS = ['Wrong target', 'Not right time', 'Needs editing', 'Other'] as const
export type DenyReason = typeof DENY_REASONS[number]

// Maps action type → Badge color and display label
const ACTION_CONFIG: Record<ApprovalActionType, { color: BadgeColor; label: string }> = {
  delete:  { color: 'Red',    label: 'Delete'  },
  send:    { color: 'Yellow', label: 'Send'    },
  publish: { color: 'Blue',   label: 'Publish' },
}

// Resolved state backgrounds — subtle tint to signal outcome without screaming
// Accepted: white bg with thin green left accent — neutral, not a green wash
// Denied: neutral-50, same as before
const STATUS_BG: Record<Exclude<ApprovalStatus, 'pending'>, string> = {
  accepted: 'var(--neutral-white)',
  denied:   'var(--neutral-50, #f7f2ed)',
}

export interface ApprovalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The write action type — drives badge color and the first visual anchor */
  actionType: ApprovalActionType
  /** Connector or source name (e.g. "Gmail", "Linear", "Slack") */
  connectorName: string
  /** The specific thing being acted on — shown in bold (file, email, channel) */
  targetName: string
  /** Plain-language description of what is about to happen */
  description: string
  /** When true: "Can be undone: [reversalDescription]". When false: "Cannot be undone." */
  reversible: boolean
  /** How the action can be reversed — only shown when reversible is true */
  reversalDescription?: string
  /** Current card state — drives which CTA set is visible */
  status?: ApprovalStatus
  /** The reason selected when denying — shown in the denied resolved state */
  denyReason?: DenyReason
  /** Fires when Accept is clicked */
  onAccept?: () => void
  /** Fires with the selected reason when Deny → reason is confirmed */
  onDeny?: (reason: DenyReason) => void
  asChild?: boolean
}

// ── Deny reason chip ──────────────────────────────────────────────────────────

interface DenyReasonChipProps {
  label: string
  onClick: () => void
}

function DenyReasonChip({ label, onClick }: DenyReasonChipProps) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '5px 12px',
        borderRadius:    8,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: hovered ? 'var(--neutral-100, #ede1d7)' : 'var(--neutral-white, white)',
        boxShadow:       hovered
          ? '0px 0px 0px 1px rgba(59,54,50,0.4)'
          : '0px 0px 0px 1px rgba(59,54,50,0.2)',
        fontFamily:      'var(--font-body)',
        fontWeight:      'var(--font-weight-medium)',
        fontSize:        'var(--font-size-body)',
        lineHeight:      'var(--line-height-body)',
        color:           'var(--neutral-700, #524b47)',
        whiteSpace:      'nowrap',
        flexShrink:      0,
        transition:      'background-color 120ms ease, box-shadow 120ms ease',
        outline:         'none',
      }}
      className="kds-approval-deny-chip"
    >
      {label}
    </motion.button>
  )
}

// ── Reversibility signal ──────────────────────────────────────────────────────

function ReversibilitySignal({
  reversible,
  reversalDescription,
}: {
  reversible: boolean
  reversalDescription?: string
}) {
  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'flex-start',
        gap:        6,
      }}
    >
      {/* Colored status dot — more reliable cross-platform than emoji */}
      <span
        aria-hidden
        style={{
          display:         'inline-flex',
          width:           8,
          height:          8,
          borderRadius:    '50%',
          backgroundColor: reversible
            ? 'var(--color-tag-Yellow-text)'
            : 'var(--color-tag-Red-text)',
          flexShrink:      0,
          marginTop:       7, // optical alignment with 14px cap-height
        }}
      />
      <span
        style={{
          fontFamily:  'var(--font-body)',
          fontWeight:  'var(--font-weight-regular)',
          fontSize:    'var(--font-size-body)',
          lineHeight:  'var(--line-height-body)',
          color:       reversible
            ? 'var(--color-tag-Yellow-text)'
            : 'var(--color-tag-Red-text)',
        }}
      >
        {reversible
          ? `Can be undone${reversalDescription ? `: ${reversalDescription}` : ''}`
          : 'This cannot be undone'
        }
      </span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ApprovalCard = React.forwardRef<HTMLDivElement, ApprovalCardProps>(
  function ApprovalCard(
    {
      actionType,
      connectorName,
      targetName,
      description,
      reversible,
      reversalDescription,
      status = 'pending',
      denyReason,
      onAccept,
      onDeny,
      asChild = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType

    const [localStatus,     setLocalStatus]     = useState<ApprovalStatus>(status)
    const [showDenyReasons, setShowDenyReasons] = useState(false)
    const [localDenyReason, setLocalDenyReason] = useState<DenyReason | undefined>(denyReason)

    const action    = ACTION_CONFIG[actionType]
    const isResolved = localStatus !== 'pending'
    const resolvedBg = isResolved ? STATUS_BG[localStatus as Exclude<ApprovalStatus, 'pending'>] : undefined

    const handleAccept = () => {
      setLocalStatus('accepted')
      onAccept?.()
    }

    const handleDenyStart = () => {
      setShowDenyReasons(true)
    }

    const handleDenyReason = (reason: DenyReason) => {
      setLocalDenyReason(reason)
      setLocalStatus('denied')
      setShowDenyReasons(false)
      onDeny?.(reason)
    }

    return (
      <motion.div
        // Entry animation: springs.moderate, slides up from y:12
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: springs.moderate }}
      >
        <Comp
          ref={ref}
          className={cn(className)}
          style={{
            position:        'relative',
            width:           '100%',
            borderRadius:    12,
            backgroundColor: resolvedBg ?? 'var(--neutral-white, white)',
            boxShadow:       SHADOW_CARD,
            overflow:        'hidden',
            transition:      'background-color 200ms ease',
            ...style,
          }}
          {...props}
        >
          {/* ── Accepted: thin green left accent stripe ── */}
          {localStatus === 'accepted' && (
            <span
              aria-hidden
              style={{
                position:        'absolute',
                left:            0,
                top:             0,
                bottom:          0,
                width:           3,
                backgroundColor: 'var(--color-tag-Green-text)',
                borderRadius:    '0 2px 2px 0',
              }}
            />
          )}

          {/* ── Inner shadow overlay (KDS standard — two-layer shadow) ───────── */}
          <span
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              borderRadius:  'inherit',
              pointerEvents: 'none',
              boxShadow:     SHADOW_INNER,
              zIndex:        1,
            }}
          />

          {/* ── Card body ────────────────────────────────────────────────────── */}
          <div
            style={{
              position:      'relative',
              zIndex:        0,
              display:       'flex',
              flexDirection: 'column',
              gap:           12,
              padding:       16,
            }}
          >
            {/* ── Row 1: Action badge + connector name ── */}
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
              }}
            >
              <Badge color={action.color} label={action.label} />
              <span
                style={{
                  fontFamily:   'var(--font-body)',
                  fontWeight:   'var(--font-weight-medium)',
                  fontSize:     'var(--font-size-caption)',
                  lineHeight:   'var(--line-height-caption)',
                  color:        'var(--neutral-500, #827a74)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                {connectorName}
              </span>
            </div>

            {/* ── Row 2: Target (bold) ── */}
            <p
              style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-semibold, 600)',
                fontSize:     'var(--font-size-body-lg, 16px)',
                lineHeight:   'var(--line-height-body-lg, 24px)',
                color:        'var(--neutral-900, #26211e)',
                margin:       0,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {targetName}
            </p>

            {/* ── Row 3: Plain-language description ── */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize:   'var(--font-size-body)',
                lineHeight: 'var(--line-height-body)',
                color:      'var(--neutral-700, #524b47)',
                margin:     0,
              }}
            >
              {description}
            </p>

            {/* ── Row 4: Reversibility signal ── */}
            <ReversibilitySignal
              reversible={reversible}
              reversalDescription={reversalDescription}
            />

            {/* ── Row 5: CTAs or resolved state ── */}
            <AnimatePresence mode="wait" initial={false}>
              {localStatus === 'pending' && !showDenyReasons && (
                <motion.div
                  key="ctas"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.12, ease: 'easeOut' } }}
                  exit={{    opacity: 0, transition: { duration: 0.08, ease: 'easeIn'  } }}
                  style={{
                    display: 'flex',
                    gap:     8,
                    // Full width side-by-side — binary trust decision, both options equal weight
                  }}
                >
                  <div style={{ flex: '1 0 0' }}>
                    <Button
                      variant="default"
                      size="md"
                      fluid
                      onClick={handleAccept}
                    >
                      Accept
                    </Button>
                  </div>
                  <div style={{ flex: '1 0 0' }}>
                    <Button
                      variant="outline"
                      size="md"
                      fluid
                      onClick={handleDenyStart}
                    >
                      Deny
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Deny reason chips — slide in when Deny is clicked */}
              {localStatus === 'pending' && showDenyReasons && (
                <motion.div
                  key="deny-reasons"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{
                    opacity:    1,
                    height:    'auto',
                    transition: { ...springs.fast, opacity: { duration: 0.12 } },
                  }}
                  exit={{
                    opacity:    0,
                    height:     0,
                    transition: { duration: 0.1, ease: 'easeIn' },
                  }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    style={{
                      display:    'flex',
                      flexWrap:   'wrap',
                      gap:        8,
                      paddingTop: 4,
                    }}
                  >
                    {DENY_REASONS.map((reason) => (
                      <DenyReasonChip
                        key={reason}
                        label={reason}
                        onClick={() => handleDenyReason(reason)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Resolved state — accepted */}
              {localStatus === 'accepted' && (
                <motion.div
                  key="accepted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } }}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        6,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display:         'inline-flex',
                      width:           16,
                      height:          16,
                      borderRadius:    '50%',
                      backgroundColor: 'var(--color-tag-Green-text)',
                      alignItems:      'center',
                      justifyContent:  'center',
                      flexShrink:      0,
                    }}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
                      <path d="M1.5 4l2 2L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 'var(--font-weight-medium)',
                      fontSize:   'var(--font-size-body)',
                      lineHeight: 'var(--line-height-body)',
                      color:      'var(--color-tag-Green-text)',
                    }}
                  >
                    Approved ✓
                  </span>
                </motion.div>
              )}

              {/* Resolved state — denied */}
              {localStatus === 'denied' && (
                <motion.div
                  key="denied"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } }}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 'var(--font-weight-medium)',
                      fontSize:   'var(--font-size-body)',
                      lineHeight: 'var(--line-height-body)',
                      color:      'var(--neutral-500, #827a74)',
                    }}
                  >
                    Denied
                  </span>
                  {localDenyReason && (
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 'var(--font-weight-regular)',
                        fontSize:   'var(--font-size-body)',
                        lineHeight: 'var(--line-height-body)',
                        color:      'var(--neutral-400, #a09890)',
                      }}
                    >
                      · {localDenyReason}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </Comp>
      </motion.div>
    )
  },
)

ApprovalCard.displayName = 'ApprovalCard'
export default ApprovalCard
