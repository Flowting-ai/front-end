'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { ArrowLeftOneIcon, ArrowRightOneIcon, CancelOneIcon, ArrowUpTwoIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { OptionBadge } from '@/components/OptionBadge'
import { OptionRow } from '@/components/OptionRow'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuestionType = 'single' | 'multi' | 'rank'

export interface QuestionCardOption {
  id:    string
  label: string
}

export interface QuestionCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  question: string
  type: QuestionType
  options: QuestionCardOption[]
  selected?: string | string[]
  onSelect?: (id: string) => void
  /** "1/3" — shows ‹ › pagination nav */
  paginationLabel?: string
  /** "N Selected" in header — single-question mode */
  selectionCount?: number
  openEndedLabel?: string
  /** Fires with the typed text when user sends the open-ended answer */
  onOpenEndedSubmit?: (text: string) => void
  onSkip?: () => void
  onSend?: () => void
  onRankChange?: (orderedIds: string[]) => void
  onClose?: () => void
  onPrev?: () => void
  onNext?: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(59,54,50,0.1)'

// ── SkipButton ────────────────────────────────────────────────────────────────

function SkipButton({ onClick }: { onClick?: React.MouseEventHandler<HTMLButtonElement> }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:      'flex',
        alignItems:   'center',
        flexShrink:   0,
        padding:      '6px 10px 8px',
        borderRadius: 10,
        border:       'none',
        boxShadow:    hovered ? '0px 0px 0px 1px rgba(59,54,50,0.5)' : '0px 0px 0px 1px rgba(59,54,50,0.3)',
        background:   hovered ? 'var(--neutral-50, #f7f2ed)' : 'transparent',
        cursor:       'pointer',
        fontFamily:   'var(--font-body)',
        fontWeight:   'var(--font-weight-medium)',
        fontSize:     'var(--font-size-body, 14px)',
        lineHeight:   'var(--line-height-body, 22px)',
        color:        'var(--neutral-700, #524b47)',
        whiteSpace:   'nowrap',
        transition:   'background 120ms ease, box-shadow 120ms ease',
      }}
    >
      Skip
    </button>
  )
}

// ── SendButton ────────────────────────────────────────────────────────────────

function SendButton({ onClick }: { onClick?: React.MouseEventHandler<HTMLButtonElement> }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      aria-label="Send"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:       'relative',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        width:          36,
        height:         36,
        padding:        '7px 8px 9px',
        borderRadius:   10,
        border:         'none',
        cursor:         'pointer',
        overflow:       'hidden',
        boxShadow:      '0px 0px 0px 1px var(--neutral-black, black), 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
      }}
    >
      <div
        aria-hidden
        style={{
          position:      'absolute', inset: 0, borderRadius: 'inherit',
          background:    hovered
            ? 'linear-gradient(180deg, #6a625d 0%, #3b3632 100%)'
            : 'linear-gradient(180deg, var(--neutral-700, #524b47) 0%, var(--neutral-900, #26211e) 100%)',
          pointerEvents: 'none', transition: 'background 120ms ease',
        }}
      />
      <div
        aria-hidden
        style={{
          position:      'absolute', inset: 0, borderRadius: 'inherit',
          boxShadow:     'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowUpTwoIcon size={20} color="var(--neutral-white, white)" />
      </div>
    </button>
  )
}

// ── RankableRow ───────────────────────────────────────────────────────────────
// The entire row is the drag surface. No dragControls needed — default
// dragListener picks up pointer events anywhere on the row.

function RankableRow({ option, index }: { option: QuestionCardOption; index: number }) {
  return (
    <Reorder.Item
      as="div"
      value={option}
      whileDrag={{
        cursor:    'grabbing',
        zIndex:    10,
        boxShadow: '0px 8px 24px rgba(82,75,71,0.18), 0px 0px 0px 1px rgba(182,172,164,0.3)',
      }}
      style={{
        listStyle:   'none',
        position:    'relative',
        userSelect:  'none',
        cursor:      'grab',
        touchAction: 'none',
      }}
    >
      <OptionRow
        variant="rank"
        num={index + 1}
        label={option.label}
      />
    </Reorder.Item>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export const QuestionCard = React.forwardRef<HTMLDivElement, QuestionCardProps>(
  function QuestionCard(
    {
      question,
      type,
      options,
      selected,
      onSelect,
      paginationLabel,
      selectionCount,
      openEndedLabel = 'Something else on your mind',
      onOpenEndedSubmit,
      onSkip,
      onSend,
      onRankChange,
      onClose,
      onPrev,
      onNext,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const [rankedOptions, setRankedOptions] = useState<QuestionCardOption[]>(options)
    useEffect(() => { setRankedOptions(options) }, [options])

    const [openEndedOpen, setOpenEndedOpen] = useState(false)
    const [openEndedText, setOpenEndedText] = useState('')
    const openEndedRef  = useRef<HTMLTextAreaElement>(null)
    const optionRefs    = useRef<(HTMLDivElement | null)[]>([])

    // Auto-grow textarea — fires on open (initial size) and on every keystroke
    useEffect(() => {
      const el = openEndedRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [openEndedText, openEndedOpen])

    // Focus textarea immediately on open
    useEffect(() => {
      if (openEndedOpen) openEndedRef.current?.focus()
    }, [openEndedOpen])

    // Reset when navigating to a new question
    useEffect(() => {
      setOpenEndedOpen(false)
      setOpenEndedText('')
    }, [question])

    const selectedIds: string[] = Array.isArray(selected)
      ? selected : selected != null ? [selected] : []

    const getRowVariant = (id: string) => {
      const isSelected = selectedIds.includes(id)
      if (type === 'single') return isSelected ? 'selected' as const : 'default' as const
      if (type === 'multi')  return isSelected ? 'multi-selected' as const : 'multi' as const
      return 'rank' as const
    }

    const handleOptionKeyDown = (e: React.KeyboardEvent, index: number, id: string) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); optionRefs.current[Math.min(options.length - 1, index + 1)]?.focus() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); optionRefs.current[Math.max(0, index - 1)]?.focus() }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(id) }
    }

    const hasPagination    = paginationLabel != null
    const hasSelectionMode = selectionCount  != null
    // Key for AnimatePresence — ONLY single/multi animate; rank is never in AnimatePresence
    const optionsKey = `q:${question}:${type}`

    // Badge exits on click (one step) — not deferred to when typing starts
    const showEditBadge = !openEndedOpen

    return (
      <motion.div
        ref={ref}
        className={cn(className)}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0, transition: springs.moderate }}
        exit={{ opacity: 0, y: 12, transition: { duration: 0.1, ease: 'easeIn' } }}
        style={{
          backgroundColor: 'var(--neutral-white, white)',
          borderRadius:    24,
          padding:         20,
          width:           '100%',
          maxWidth:        754,
          display:         'flex',
          flexDirection:   'column',
          gap:             12,
          boxShadow:       CARD_SHADOW,
          ...style,
        }}
        {...(props as any)}
      >

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, width: '100%', flexShrink: 0 }}>
          <p style={{ flex: '1 0 0', minWidth: 1, fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body-lg, 16px)', lineHeight: 'var(--line-height-body-lg, 22px)', color: 'var(--neutral-900, #26211e)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {question}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {hasPagination && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                <IconButton size="xs" variant="ghost" aria-label="Previous question" icon={<ArrowLeftOneIcon size={18} />} onClick={onPrev} />
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body, 14px)', lineHeight: 'var(--line-height-body, 22px)', color: 'var(--neutral-600, #6a625d)', whiteSpace: 'nowrap', flexShrink: 0, padding: '0 2px' }}>
                  {paginationLabel}
                </span>
                <IconButton size="xs" variant="ghost" aria-label="Next question" icon={<ArrowRightOneIcon size={18} />} onClick={onNext} />
              </div>
            )}
            {hasSelectionMode && !hasPagination && (
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body, 14px)', lineHeight: 'var(--line-height-body, 22px)', color: 'var(--neutral-600, #6a625d)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {selectionCount} Selected
              </span>
            )}
            <IconButton size="xs" variant="ghost" aria-label="Dismiss question" icon={<CancelOneIcon size={18} />} onClick={onClose} />
          </div>
        </div>

        {/* ── Wide section — options + footer, extends to 10px from card edges ─ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: -10, marginRight: -10 }}>

          {/* ─ Options — rank is NEVER inside AnimatePresence (required for Reorder drag) */}
          {type === 'rank' ? (
            <Reorder.Group
              as="div"
              axis="y"
              values={rankedOptions}
              onReorder={(newOrder) => {
                setRankedOptions(newOrder)
                onRankChange?.(newOrder.map((o) => o.id))
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}
            >
              {rankedOptions.map((opt, i) => (
                <RankableRow key={opt.id} option={opt} index={i} />
              ))}
            </Reorder.Group>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={optionsKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } }}
                exit={{ opacity: 0, transition: { duration: 0.08, ease: 'easeIn' } }}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                {options.map((opt, i) => (
                  <OptionRow
                    key={opt.id}
                    ref={(el) => { optionRefs.current[i] = el }}
                    tabIndex={0}
                    variant={getRowVariant(opt.id)}
                    num={i + 1}
                    label={opt.label}
                    onClick={() => onSelect?.(opt.id)}
                    onKeyDown={(e) => handleOptionKeyDown(e, i, opt.id)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ─ Footer row — pencil badge + label/textarea + Skip + Send ───────── */}
          {/* The ROW ITSELF transforms: label → inline textarea in the same flex slot */}
          <div
            style={{
              display:    'flex',
              alignItems: 'flex-end',
              gap:        10,
              padding:    '10px 10px',
              flexShrink: 0,
            }}
          >
            {/* Badge — exits immediately when user clicks (openEndedOpen), AnimatePresence pops it from layout */}
            <AnimatePresence mode="popLayout" initial={false}>
              {showEditBadge && (
                <motion.div
                  key="edit-badge"
                  initial={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: springs.fast }}
                  exit={{ opacity: 0, scale: 0.5, filter: 'blur(4px)', transition: { duration: 0.08, ease: 'easeIn' as const } }}
                  style={{ flexShrink: 0 }}
                >
                  <OptionBadge variant="edit" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Text slot — same position, same font — click to open, becomes textarea */}
            <div style={{ flex: '1 0 0', minWidth: 1 }}>
              {openEndedOpen ? (
                <textarea
                  ref={openEndedRef}
                  value={openEndedText}
                  onChange={(e) => setOpenEndedText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setOpenEndedOpen(false); setOpenEndedText('') } }}
                  placeholder={openEndedLabel}
                  rows={1}
                  style={{
                    display:    'block',
                    width:      '100%',
                    resize:     'none',
                    overflow:   'hidden',
                    border:     'none',
                    outline:    'none',
                    background: 'transparent',
                    padding:    0,
                    margin:     0,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'var(--font-weight-medium)',
                    fontSize:   'var(--font-size-body-lg, 16px)',
                    lineHeight: 'var(--line-height-body-lg, 22px)',
                    color:      'var(--neutral-600, #6a625d)',
                    boxSizing:  'border-box',
                    minHeight:  22,
                  }}
                />
              ) : (
                <p
                  onClick={() => setOpenEndedOpen(true)}
                  style={{
                    fontFamily:   'var(--font-body)',
                    fontWeight:   'var(--font-weight-medium)',
                    fontSize:     'var(--font-size-body-lg, 16px)',
                    lineHeight:   'var(--line-height-body-lg, 22px)',
                    color:        'var(--neutral-600, #6a625d)',
                    margin:       0,
                    cursor:       'pointer',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}
                >
                  {openEndedLabel}
                </p>
              )}
            </div>

            {/* Skip + Send — always present, always visible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <SkipButton onClick={onSkip} />
              <SendButton
                onClick={openEndedOpen
                  ? () => { onOpenEndedSubmit?.(openEndedText); onSend?.() }
                  : onSend
                }
              />
            </div>
          </div>

        </div>
      </motion.div>
    )
  },
)

QuestionCard.displayName = 'QuestionCard'
export default QuestionCard
