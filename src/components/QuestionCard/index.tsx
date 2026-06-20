'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m, Reorder } from 'framer-motion'
import { ArrowLeftOneIcon, ArrowRightOneIcon, CancelOneIcon, ArrowUpTwoIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { OptionBadge } from '@/components/OptionBadge'
import { Badge, type BadgeColor } from '@/components/Badge'
import { OptionRow } from '@/components/OptionRow'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuestionType = 'single' | 'multi' | 'rank' | 'info'

export interface QuestionCardOption {
  id:           string
  label:        string
  /** Sub-heading description shown below the label in 'info' mode */
  description?: string
  /** Badge shown beside the heading in 'info' mode (e.g. Required / Optional) */
  badge?: { label: string; color: BadgeColor }
  /** Persona-entity options (entity="persona"): @handle shown under the name. */
  handle?:      string
  /** Persona-entity options: avatar image URL for the agent card. */
  avatarUrl?:   string
  /** Persona-entity options: server marks the best-ranked agent. */
  recommended?: boolean
}

export interface QuestionCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  question: string
  type: QuestionType
  options: QuestionCardOption[]
  selected?: string | string[]
  onSelect?: (id: string) => void
  /** "1/3" - shows ‹ › pagination nav */
  paginationLabel?: string
  /** "N Selected" in header - single-question mode */
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
  /** Badge shown beside the title in 'info' mode (e.g. Required / Optional for the whole tab) */
  titleBadge?: { label: string; color: BadgeColor }
  /** Shows a per-tab progress bar above the title in 'info' mode */
  tabProgress?: { tabs: string[]; currentIndex: number }
  /** Slot rendered at the very top of the card, above the tabProgress stepper (info mode only) */
  topSlot?: React.ReactNode
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
// The entire row is the drag surface. No dragControls needed - default
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

// ── InfoCardBody ──────────────────────────────────────────────────────────────
// Shows info-mode options one at a time with animated transitions and dot
// indicators. Navigation calls onSelect with the adjacent option's id so the
// parent's selected state stays the single source of truth.

function InfoCardBody({ options, selected, onSelect }: {
  options:  QuestionCardOption[]
  selected?: string | string[]
  onSelect?: (id: string) => void
}) {
  const rawIdx     = options.findIndex(o =>
    Array.isArray(selected) ? selected.includes(o.id) : selected === o.id,
  )
  const currentIdx = rawIdx < 0 ? 0 : rawIdx
  const opt        = options[currentIdx]
  const isFirst    = currentIdx === 0
  const isLast     = currentIdx === options.length - 1

  function goTo(idx: number) {
    if (idx >= 0 && idx < options.length) onSelect?.(options[idx].id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Animated single-item content */}
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={opt?.id ?? currentIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1, ease: 'easeIn' } }}
          style={{
            padding:         '10px 12px',
            minHeight:       56,
            display:         'flex',
            flexDirection:   'column',
            gap:             6,
            backgroundColor: 'rgba(110,152,203,0.08)',
            borderRadius:    10,
            border:          '1px solid rgba(110,152,203,0.18)',
          }}
        >
          {/* Number badge + label row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width:           22,
              height:          22,
              borderRadius:    6,
              flexShrink:      0,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              backgroundColor: '#6e98cb',
              boxShadow:       '0 0 0 1px rgba(110,152,203,0.5)',
            }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize:   11,
                lineHeight: '11px',
                display:    'block',
                textAlign:  'center',
                color:      'white',
                userSelect: 'none',
              }}>
                {currentIdx + 1}
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize:   13,
              lineHeight: '18px',
              color:      '#3b6fa8',
            }}>
              {opt?.label}
            </span>
          </div>
          {opt?.description && (
            <span style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   12,
              lineHeight: '17px',
              color:      'var(--neutral-700)',
            }}>
              {opt.description}
            </span>
          )}
        </m.div>
      </AnimatePresence>

      {/* Prev / dot indicators / next */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <div style={{ opacity: isFirst ? 0.28 : 1, pointerEvents: isFirst ? 'none' : 'auto', transition: 'opacity 150ms' }}>
          <IconButton size="xs" variant="ghost" aria-label="Previous" icon={<ArrowLeftOneIcon size={18} />} onClick={() => goTo(currentIdx - 1)} />
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              aria-label={`Go to ${o.label}`}
              onClick={() => goTo(i)}
              style={{
                width:           i === currentIdx ? 18 : 6,
                height:          6,
                borderRadius:    3,
                border:          'none',
                padding:         0,
                cursor:          'pointer',
                backgroundColor: i === currentIdx ? '#6e98cb' : 'var(--neutral-300)',
                transition:      'width 220ms ease, background-color 220ms ease',
              }}
            />
          ))}
        </div>

        <div style={{ opacity: isLast ? 0.28 : 1, pointerEvents: isLast ? 'none' : 'auto', transition: 'opacity 150ms' }}>
          <IconButton size="xs" variant="ghost" aria-label="Next" icon={<ArrowRightOneIcon size={18} />} onClick={() => goTo(currentIdx + 1)} />
        </div>
      </div>

    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function QuestionCard(
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
    titleBadge,
    tabProgress,
    topSlot,
    className,
    style,
    ref,
    ...props
  }: QuestionCardProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [rankState, setRankState] = useState<{ question: string; ids: string[] }>({ question, ids: [] })
    const motionProps = props as unknown as Omit<React.ComponentProps<typeof m.div>, 'ref'>
    const rankedOptions = useMemo(() => {
      const rankedIds = rankState.question === question ? rankState.ids : []
      if (type !== 'rank' || rankedIds.length === 0) return options

      const optionById = new Map(options.map(option => [option.id, option]))
      const ranked = rankedIds
        .map(id => optionById.get(id))
        .filter((option): option is QuestionCardOption => option != null)
      const seenIds = new Set(ranked.map(option => option.id))

      return [
        ...ranked,
        ...options.filter(option => !seenIds.has(option.id)),
      ]
    }, [options, question, rankState.ids, rankState.question, type])

    // A question with no options is inherently free-text, so open the input
    // immediately even when the same card instance receives a new question shape.
    const shouldOpenEndedByDefault = options.length === 0 && type !== 'rank' && type !== 'info'
    const [openEndedOpen, setOpenEndedOpen] = useState(false)
    const isOpenEndedOpen = shouldOpenEndedByDefault || openEndedOpen
    const [openEndedText, setOpenEndedText] = useState('')
    const openEndedRef  = useRef<HTMLTextAreaElement>(null)
    const optionRefs    = useRef<(HTMLDivElement | null)[]>([])

    // Auto-grow textarea - fires on open (initial size) and on every keystroke
    useEffect(() => {
      const el = openEndedRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [openEndedText, isOpenEndedOpen])

    // Focus textarea immediately on open
    useEffect(() => {
      if (isOpenEndedOpen) openEndedRef.current?.focus()
    }, [isOpenEndedOpen])


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
    // Key for AnimatePresence - ONLY single/multi animate; rank is never in AnimatePresence
    const optionsKey = `q:${question}:${type}`

    // Badge exits on click (one step) - not deferred to when typing starts
    const showEditBadge = !isOpenEndedOpen



    return (
      <m.div
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
        {...motionProps}
      >

        {/* ── Top slot (info mode only — e.g. Main / Panels tab switcher) ────── */}
        {type === 'info' && topSlot}

        {/* ── Tab progress stepper (above main heading, info mode only) ────────── */}
        {type === 'info' && tabProgress && (
          <div style={{ display: 'flex' }}>
            {tabProgress.tabs.map((tab, i) => {
              const isCurrent          = i === tabProgress.currentIndex
              const isPast             = i  <  tabProgress.currentIndex
              // Half-line logic: left side filled when we're AT or PAST this tab;
              // right side filled only when we've moved past this tab.
              const leftFilled  = i > 0 && i <= tabProgress.currentIndex
              const rightFilled = i < tabProgress.tabs.length - 1 && i < tabProgress.currentIndex
              const BLUE = '#6e98cb'

              return (
                <div key={tab} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>

                  {/* Circle flanked by symmetric half-lines that keep it centred */}
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {/* Left half-line */}
                    <div style={{ flex: 1, height: 2, backgroundColor: leftFilled ? BLUE : i > 0 ? 'var(--neutral-200)' : 'transparent', transition: 'background-color 300ms' }} />

                    {/* Numbered circle */}
                    <div style={{
                      width:           26,
                      height:          26,
                      borderRadius:    '50%',
                      flexShrink:      0,
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      backgroundColor: isCurrent ? BLUE : isPast ? 'rgba(110,152,203,0.14)' : 'var(--neutral-50)',
                      boxShadow:       isCurrent
                        ? `0 0 0 4px rgba(110,152,203,0.18)`
                        : isPast
                          ? `0 0 0 1.5px rgba(110,152,203,0.45)`
                          : `0 0 0 1.5px var(--neutral-200)`,
                      transition: 'all 250ms ease',
                    }}>
                      <span style={{
                        fontFamily:  'var(--font-body)',
                        fontWeight:  isCurrent ? 700 : 500,
                        fontSize:    11,
                        lineHeight:  '11px',
                        display:     'block',
                        color:       isCurrent ? 'white' : isPast ? BLUE : 'var(--neutral-400)',
                        userSelect:  'none',
                        transition:  'color 250ms',
                        textAlign:   'center',
                      }}>
                        {i + 1}
                      </span>
                    </div>

                    {/* Right half-line */}
                    <div style={{ flex: 1, height: 2, backgroundColor: rightFilled ? BLUE : i < tabProgress.tabs.length - 1 ? 'var(--neutral-200)' : 'transparent', transition: 'background-color 300ms' }} />
                  </div>

                  {/* Label */}
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   10,
                    lineHeight: '14px',
                    fontWeight: isCurrent ? 600 : 400,
                    color:      isCurrent ? BLUE : isPast ? 'rgba(110,152,203,0.7)' : 'var(--neutral-400)',
                    textAlign:  'center',
                    whiteSpace: 'nowrap',
                    transition: 'color 250ms',
                  }}>
                    {tab}
                  </span>

                </div>
              )
            })}
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, width: '100%', flexShrink: 0 }}>
          {type === 'info' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 0 0', minWidth: 1, flexWrap: 'wrap' }}>
              <p style={{
                fontFamily:   'var(--font-title)',
                fontWeight:   400,
                fontSize:     20,
                lineHeight:   '28px',
                color:        'var(--neutral-900, #26211e)',
                margin:       0,
              }}>
                {question}
              </p>
              {titleBadge && <Badge label={titleBadge.label} color={titleBadge.color} />}
            </div>
          ) : (
          <p style={{
            flex:       '1 0 0',
            minWidth:   1,
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize:   'var(--font-size-body-lg, 16px)',
            lineHeight: 'var(--line-height-body-lg, 22px)',
            color:      'var(--neutral-900, #26211e)',
            margin:     0,
            overflow:   'hidden',
            textOverflow: 'ellipsis',
          }}>
            {question}
          </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {hasPagination && type !== 'info' && (
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
            {!(type === 'info' && topSlot) && (
              <IconButton size="xs" variant="ghost" aria-label="Dismiss question" icon={<CancelOneIcon size={18} />} onClick={onClose} />
            )}
          </div>
        </div>


        {/* ── Wide section - options + footer, extends to 10px from card edges ─ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: -10, marginRight: -10 }}>

          {/* ─ Options - rank is NEVER inside AnimatePresence (required for Reorder drag) */}
          {type === 'rank' ? (
            <Reorder.Group
              as="div"
              axis="y"
              values={rankedOptions}
              onReorder={(newOrder) => {
                setRankState({ question, ids: newOrder.map((o) => o.id) })
                onRankChange?.(newOrder.map((o) => o.id))
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}
            >
              {rankedOptions.map((opt, i) => (
                <RankableRow key={opt.id} option={opt} index={i} />
              ))}
            </Reorder.Group>
          ) : type === 'info' ? (
            <InfoCardBody options={options} selected={selected} onSelect={onSelect} />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <m.div
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
              </m.div>
            </AnimatePresence>
          )}

          {/* ─ Footer row — hidden in info mode ──────────────────────────────── */}
          {type !== 'info' && <div
            style={{
              display:    'flex',
              alignItems: 'flex-end',
              gap:        10,
              padding:    '10px 10px',
              flexShrink: 0,
            }}
          >
            {/* Badge - exits immediately when user clicks (openEndedOpen), AnimatePresence pops it from layout */}
            <AnimatePresence mode="popLayout" initial={false}>
              {showEditBadge && (
                <m.div
                  key="edit-badge"
                  initial={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: springs.fast }}
                  exit={{ opacity: 0, scale: 0.5, filter: 'blur(4px)', transition: { duration: 0.08, ease: 'easeIn' as const } }}
                  style={{ flexShrink: 0 }}
                >
                  <OptionBadge variant="edit" />
                </m.div>
              )}
            </AnimatePresence>

            {/* Text slot - same position, same font - click to open, becomes textarea */}
            <div style={{ flex: '1 0 0', minWidth: 1 }}>
              {isOpenEndedOpen ? (
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

            {/* Skip + Send - always present, always visible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <SkipButton onClick={onSkip} />
              <SendButton
                onClick={isOpenEndedOpen
                  ? () => { onOpenEndedSubmit?.(openEndedText); onSend?.() }
                  : onSend
                }
              />
            </div>
          </div>}

        </div>
      </m.div>
    )
}

QuestionCard.displayName = 'QuestionCard'
export default QuestionCard
