'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m, Reorder } from 'framer-motion'
import { ArrowLeftOneIcon, ArrowRightOneIcon, CancelOneIcon, ArrowUpTwoIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Spinner } from '@/components/Spinner'
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
  /** Fires on every edit of the open-ended text (cleared to '' on Escape). */
  onOpenEndedChange?: (text: string) => void
  /** Omit to hide the Skip button (e.g. required questions). */
  onSkip?: () => void
  onSend?: () => void
  onRankChange?: (orderedIds: string[]) => void
  /** Omit to hide the dismiss (X) button. */
  onClose?: () => void
  /** Omit to disable the ‹ / › pagination arrows. */
  onPrev?: () => void
  onNext?: () => void
  /** Badge shown beside the title in 'info' mode (e.g. Required / Optional for the whole tab) */
  titleBadge?: { label: string; color: BadgeColor }
  /** Shows a per-tab progress bar above the title in 'info' mode */
  tabProgress?: { tabs: string[]; currentIndex: number }
  /** Slot rendered at the very top of the card, above the tabProgress stepper (info mode only) */
  topSlot?: React.ReactNode
  /** True while `onSend`/`onSkip`'s response is in flight — disables both
   *  buttons and shows a spinner in place of Send's arrow. */
  pending?: boolean
  /** When true, Send stays disabled until an option is selected or the
   *  open-ended box has non-blank text. */
  requireAnswer?: boolean
  /** Initial open-ended text, e.g. when returning to an answered question. */
  defaultOpenEndedText?: string
  /** Focus the card when it mounts, but only if nothing else has focus —
   *  never pulls focus away from where the user is typing. */
  autoFocusWhenIdle?: boolean
}

/** True when focus is on nothing in particular (the page body). */
const isFocusIdle = () =>
  typeof document !== 'undefined' &&
  (document.activeElement == null || document.activeElement === document.body)

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(59,54,50,0.1)'

// ── SkipButton ────────────────────────────────────────────────────────────────

function SkipButton({ onClick, disabled }: { onClick?: React.MouseEventHandler<HTMLButtonElement>; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
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
        background:   hovered ? 'var(--neutral-50)' : 'transparent',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.6 : 1,
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

function SendButton({ onClick, disabled, pending }: { onClick?: React.MouseEventHandler<HTMLButtonElement>; disabled?: boolean; pending?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      aria-label="Send"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
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
        cursor:         disabled || pending ? 'not-allowed' : 'pointer',
        opacity:        disabled || pending ? 0.6 : 1,
        overflow:       'hidden',
        boxShadow:      '0px 0px 0px 1px var(--neutral-black, black), 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
      }}
    >
      <div
        aria-hidden
        style={{
          position:      'absolute', inset: 0, borderRadius: 'inherit',
          background:    hovered
            ? 'linear-gradient(180deg, var(--neutral-600) 0%, var(--neutral-800) 100%)'
            : 'linear-gradient(180deg, var(--neutral-700, #524b47) 0%, var(--neutral-900, #26211e) 100%)',
          pointerEvents: 'none', transition: 'background 120ms ease',
        }}
      />
      <div
        aria-hidden
        style={{
          position:      'absolute', inset: 0, borderRadius: 'inherit',
          boxShadow:     'inset 0px 1px 0.364px 0px color-mix(in srgb, var(--static-white) 30%, transparent), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px color-mix(in srgb, var(--static-white) 50%, transparent)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {pending ? <Spinner size={18} color="var(--neutral-white, white)" /> : <ArrowUpTwoIcon size={20} color="var(--neutral-white, white)" />}
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
        boxShadow: '0px 8px 24px rgba(82,75,71,0.18), 0px 0px 0px 1px rgba(212, 212, 212,0.3)',
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
            backgroundColor: 'color-mix(in srgb, var(--blue-600) 8%, transparent)',
            borderRadius:    10,
            border:          '1px solid color-mix(in srgb, var(--blue-600) 18%, transparent)',
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
              backgroundColor: 'var(--blue-600)',
              boxShadow:       '0 0 0 1px rgba(13,110,178,0.5)',
            }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-semibold)',
                fontSize:   11,
                lineHeight: '11px',
                display:    'block',
                textAlign:  'center',
                color:      'var(--neutral-white)',
                userSelect: 'none',
              }}>
                {currentIdx + 1}
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-semibold)',
              fontSize:   13,
              lineHeight: '18px',
              color:      'var(--blue-700)',
            }}>
              {opt?.label}
            </span>
          </div>
          {opt?.description && (
            <span style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
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
                backgroundColor: i === currentIdx ? 'var(--blue-600)' : 'var(--neutral-300)',
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
    onOpenEndedChange,
    onSkip,
    onSend,
    onRankChange,
    onClose,
    onPrev,
    onNext,
    titleBadge,
    tabProgress,
    topSlot,
    pending = false,
    requireAnswer = false,
    defaultOpenEndedText,
    autoFocusWhenIdle = false,
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
    const [openEndedOpen, setOpenEndedOpen] = useState(() => Boolean(defaultOpenEndedText))
    const isOpenEndedOpen = shouldOpenEndedByDefault || openEndedOpen
    const [openEndedText, setOpenEndedText] = useState(defaultOpenEndedText ?? '')
    const openEndedRef  = useRef<HTMLTextAreaElement>(null)
    const openEndedTriggerRef = useRef<HTMLButtonElement>(null)
    const optionRefs    = useRef<(HTMLDivElement | null)[]>([])
    // Only a click on "Something else" moves focus into the textarea. A box
    // that starts open (free-text question, restored answer) waits for
    // autoFocusWhenIdle so it never steals focus on mount.
    const userOpenedRef = useRef(false)
    const questionId    = useId()
    const [announcement, setAnnouncement] = useState('')

    // Auto-grow textarea - fires on open (initial size) and on every keystroke
    useEffect(() => {
      const el = openEndedRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [openEndedText, isOpenEndedOpen])

    const returnFocusToTriggerRef = useRef(false)

    // Focus textarea when the user opens it; after Escape closes it, return
    // focus to the "Something else" trigger rather than dropping it to <body>.
    useEffect(() => {
      if (openEndedOpen && userOpenedRef.current) openEndedRef.current?.focus()
      if (!openEndedOpen && returnFocusToTriggerRef.current) {
        returnFocusToTriggerRef.current = false
        openEndedTriggerRef.current?.focus()
      }
    }, [openEndedOpen])

    const selectedIds: string[] = Array.isArray(selected)
      ? selected : selected ? [selected] : []
    const selectedIndex = options.findIndex(o => selectedIds.includes(o.id))

    // Mount only: a card that appears mid-reply takes focus when the user
    // isn't focused anywhere else (e.g. focus fell to <body>).
    useEffect(() => {
      if (!autoFocusWhenIdle || !isFocusIdle()) return
      // preventScroll: never move the chat a reader has scrolled away from
      if (isOpenEndedOpen && options.length === 0) openEndedRef.current?.focus({ preventScroll: true })
      else optionRefs.current[Math.max(0, selectedIndex)]?.focus({ preventScroll: true })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Announce the question to screen readers. Set after mount so the live
    // region already exists when its text changes.
    useEffect(() => {
      if (type === 'info' || type === 'rank') return
      const position = paginationLabel ? ` ${paginationLabel.replace('/', ' of ')}` : ''
      const id = window.setTimeout(() => setAnnouncement(`Question${position}: ${question}`), 100)
      return () => window.clearTimeout(id)
    }, [question, paginationLabel, type])

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

    const hasAnswer = selectedIds.length > 0 || (isOpenEndedOpen && openEndedText.trim() !== '')
    const sendDisabled = requireAnswer && !hasAnswer

    // Contract: the typed text is reported first, then onSend fires in the
    // same event (QuestionStep and ChatPromptCard both rely on this order).
    const handleSend = () => {
      if (pending || sendDisabled) return
      if (isOpenEndedOpen) onOpenEndedSubmit?.(openEndedText)
      onSend?.()
    }

    // Single choice uses one tab stop for the group (roving tabindex);
    // arrow keys move between rows.
    const rovingIndex = Math.max(0, selectedIndex)

    return (
      <m.div
        ref={ref}
        className={cn(className)}
        role="group"
        aria-labelledby={questionId}
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
              const BLUE = 'var(--blue-600)'

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
                      backgroundColor: isCurrent ? BLUE : isPast ? 'color-mix(in srgb, var(--blue-600) 14%, transparent)' : 'var(--neutral-50)',
                      boxShadow:       isCurrent
                        ? `0 0 0 4px color-mix(in srgb, var(--blue-600) 18%, transparent)`
                        : isPast
                          ? `0 0 0 1.5px color-mix(in srgb, var(--blue-600) 45%, transparent)`
                          : `0 0 0 1.5px var(--neutral-200)`,
                      transition: 'all 250ms ease',
                    }}>
                      <span style={{
                        fontFamily:  'var(--font-body)',
                        fontWeight:  isCurrent ? 700 : 'var(--font-weight-medium)',
                        fontSize:    11,
                        lineHeight:  '11px',
                        display:     'block',
                        color:       isCurrent ? 'var(--neutral-white)' : isPast ? BLUE : 'var(--neutral-400)',
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
                    fontWeight: isCurrent ? 'var(--font-weight-semibold)' : 'var(--font-weight-regular)',
                    color:      isCurrent ? BLUE : isPast ? 'color-mix(in srgb, var(--blue-600) 70%, transparent)' : 'var(--neutral-400)',
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
              <p id={questionId} style={{
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
          <p id={questionId} style={{
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
                <IconButton size="xs" variant="ghost" aria-label="Previous question" icon={<ArrowLeftOneIcon size={18} />} onClick={onPrev} disabled={!onPrev} />
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body, 14px)', lineHeight: 'var(--line-height-body, 22px)', color: 'var(--neutral-600, #6a625d)', whiteSpace: 'nowrap', flexShrink: 0, padding: '0 2px' }}>
                  {paginationLabel}
                </span>
                <IconButton size="xs" variant="ghost" aria-label="Next question" icon={<ArrowRightOneIcon size={18} />} onClick={onNext} disabled={!onNext} />
              </div>
            )}
            {hasSelectionMode && !hasPagination && (
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body, 14px)', lineHeight: 'var(--line-height-body, 22px)', color: 'var(--neutral-600, #6a625d)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {selectionCount} Selected
              </span>
            )}
            {onClose && !(type === 'info' && topSlot) && (
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
                role={type === 'single' ? 'radiogroup' : 'group'}
                aria-labelledby={questionId}
              >
                {options.map((opt, i) => (
                  <OptionRow
                    key={opt.id}
                    ref={(el) => { optionRefs.current[i] = el }}
                    role={type === 'single' ? 'radio' : 'checkbox'}
                    aria-checked={selectedIds.includes(opt.id)}
                    tabIndex={type === 'single' && i !== rovingIndex ? -1 : 0}
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
                  onChange={(e) => { setOpenEndedText(e.target.value); onOpenEndedChange?.(e.target.value) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setOpenEndedOpen(false)
                      setOpenEndedText('')
                      onOpenEndedChange?.('')
                      returnFocusToTriggerRef.current = !shouldOpenEndedByDefault
                    } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      // Enter sends; Shift+Enter keeps a newline
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={openEndedLabel}
                  aria-label={openEndedLabel}
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
                <button
                  type="button"
                  ref={openEndedTriggerRef}
                  onClick={() => { userOpenedRef.current = true; setOpenEndedOpen(true) }}
                  style={{
                    display:      'block',
                    width:        '100%',
                    padding:      0,
                    border:       'none',
                    background:   'transparent',
                    textAlign:    'left',
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
                </button>
              )}
            </div>

            {/* Skip (only when the caller allows skipping) + Send */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {onSkip && <SkipButton onClick={onSkip} disabled={pending} />}
              <SendButton
                pending={pending}
                disabled={sendDisabled}
                onClick={handleSend}
              />
            </div>
          </div>}

        </div>

        <span aria-live="polite" style={VISUALLY_HIDDEN}>{announcement}</span>
      </m.div>
    )
}

QuestionCard.displayName = 'QuestionCard'
export default QuestionCard
