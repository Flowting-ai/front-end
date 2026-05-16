'use client'

import React, { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react'
import { motion, AnimatePresence, useAnimation, useIsPresent, useMotionValue, animate, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  MoreVerticalIcon,
  MessagePreviewOneIcon,
  InputShortTextIcon,
  PlusSignIcon,
  CopyOneIcon,
  DownloadThreeIcon,
  DeleteTwoIcon,
} from '@strange-huge/icons'
import { LlmIcon } from '@strange-huge/icons/llm'
import { PinCategory, type PinCategoryType } from '@/components/PinCategory'
import { Checkbox } from '@/components/Checkbox'
import { Badge, type BadgeColor } from '@/components/Badge'
import { Chip, type ChipColor } from '@/components/Chip'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { PinCommentField } from '@/components/PinCommentField'
import { ChipInput } from '@/components/ChipInput'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'

// ── Constants ─────────────────────────────────────────────────────────────────

const SHADOW_CARD    = '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)'
const DRAG_THRESHOLD = 8   // px to commit collapse when already expanded - small upward drag is enough
const LINE_HEIGHT_PX = 16  // --line-height-caption, one description line
const MAX_SNAP_LINES = 12  // auto-expand triggers if user drags beyond this many extra lines

// User-added tag colours - every committed tag picks one of these. Neutral is
// excluded so backend (Neutral) and user-added (coloured) badges are visually
// distinct at a glance. Override per-instance via the `userTagColors` prop.
const USER_TAG_COLOR_POOL: BadgeColor[] = ['Blue', 'Red', 'Green', 'Yellow', 'Purple', 'Brown']

// In-place swap (Add-tag chip ↔ ChipInput) - matches the KDS in-place text
// swap pattern. Same constants Chip uses, same spring values.
const SWAP_SPRING  = { type: 'spring' as const, stiffness: 500, damping: 30 }
const SWAP_INITIAL = { scale: 0.75, opacity: 0, filter: 'blur(4px)' }
const SWAP_ANIMATE = { scale: 1,    opacity: 1, filter: 'blur(0px)' }
const SWAP_EXIT    = { scale: 0.75, opacity: 0, filter: 'blur(4px)' }
const SWAP_INSTANT = { scale: 1,    opacity: 1, filter: 'blur(0px)' }

// ── useMeasure ────────────────────────────────────────────────────────────────
// Wraps ResizeObserver to track an element's border-box dimensions.
// Returns [ref, bounds] - attach ref to the INNER element, animate the OUTER.
// Uses borderBoxSize (includes padding) not contentRect (excludes padding).

function useMeasure() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [bounds,  setBounds]  = useState({ width: 0, height: 0 })

  const ref = useCallback((node: HTMLElement | null) => setElement(node), [])

  useLayoutEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const bb = entry.borderBoxSize?.[0]
      setBounds({
        width:  bb ? bb.inlineSize : entry.contentRect.width,
        height: bb ? bb.blockSize  : entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [ref, bounds] as const
}

// ── AddTagChip ────────────────────────────────────────────────────────────────
// Small Neutral pill with a + icon and "Add tag" label, used as the trigger
// for the in-Pin add-tag affordance. Visually identical to a Chip Small
// (Neutral) so it sits naturally alongside the badge row, but it's a single
// <button> - the whole pill is clickable, not just the leading icon button.
//
// We don't reuse <Chip size="Small"> here because Chip's left ChipButton is
// semantically a remove/dismiss action and routes its click via `onRemove`.
// Hijacking that for a click-to-edit affordance would muddle the API.

function AddTagChip({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      // NOT setting the native `disabled` attribute - at-cap clicks still
      // need to fire so the parent (Pin) can drive the shake-rejection
      // animation. The visual treatment + ARIA state communicates "you can't
      // act on this," and the parent decides what `onClick` does (open the
      // input vs trigger shake based on `atTagCap`).
      onClick={onClick}
      aria-label="Add tag"
      aria-disabled={disabled || undefined}
      style={{
        position:        'relative',
        display:         'inline-flex',
        alignItems:      'center',
        padding:         '2px',
        borderRadius:    '6px',
        backgroundColor: 'var(--color-tag-Neutral-bg)',
        boxShadow:       'var(--color-tag-Neutral-shadow)',
        border:          'none',
        // Mirrors the KDS `Chip` component's disabled visuals: opacity 0.7 +
        // not-allowed cursor. The disabled state was added to `Chip` first
        // (atom-level); AddTagChip applies the same treatment without
        // refactoring to use Chip directly because Chip's left ChipButton is
        // semantically a remove action - repurposing it for an add trigger
        // would muddle the API.
        cursor:          disabled ? 'not-allowed' : 'pointer',
        opacity:         disabled ? 0.7 : 1,
        color:           'var(--color-tag-Neutral-text)',
        flexShrink:      0,
      }}
    >
      {/* Mirrors a Chip Small ChipButton box (16×16, 1px padding around a
          14×14 icon). No interactive treatment - the whole chip is the click
          target so we don't want a button-in-button hover state. */}
      <span
        aria-hidden
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          width:          16,
          height:         16,
          padding:        '1px',
          borderRadius:   '4px',
          flexShrink:     0,
        }}
      >
        <PlusSignIcon size={14} color="var(--color-tag-Neutral-text)" />
      </span>
      <span
        style={{
          padding:    '0 2px',
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-weight-medium)',
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--color-tag-Neutral-text)',
          whiteSpace: 'nowrap',
        }}
      >
        Add tag
      </span>
      {/* Inner depth/highlight shadow - same overlay pattern as Chip Small. */}
      <span
        aria-hidden
        style={{
          position:      'absolute',
          inset:         0,
          pointerEvents: 'none',
          borderRadius:  'inherit',
          boxShadow:     'var(--color-tag-Neutral-inner-shadow)',
        }}
      />
    </button>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinLabel {
  color: BadgeColor
  text:  string
}

export interface PinProps extends Omit<React.HTMLAttributes<HTMLDivElement>,
  'children' | 'onDrag' | 'onDragEnd' | 'onDragStart' | 'onDragEnter' | 'onDragLeave' | 'onDragOver' | 'onDrop'
> {
  category?:        PinCategoryType
  pinTitle?:        string
  description?:     string
  labels?:          PinLabel[]
  chatName?:        string
  defaultExpanded?: boolean
  /** When this number changes, the pin collapses if it's currently expanded.
   *  Used by Pinboard's "collapse all" action. Initial value is ignored. */
  collapseSignal?:  number
  /** Fires when the pin's "open" state changes - true whenever it's showing
   *  more than the default 2 lines (either fully expanded OR dragged to an
   *  intermediate snap point with `extraLines > 0`). Pinboard uses this to
   *  show/hide the "collapse all" button. */
  onExpandedChange?: (open: boolean) => void
  onInsert?:        () => void
  /**
   * More-options menu callbacks. Each fires when the user picks the
   * corresponding row from the ellipsis dropdown. Figma 3139:36280.
   */
  onDuplicate?:     () => void
  onExport?:        () => void
  onDelete?:        () => void
  fluid?:           boolean
  /**
   * Called when the user commits a tag via the "Add tag" affordance.
   * If omitted, the Pin manages added tags in its own internal state for
   * demonstration/uncontrolled use.
   */
  onAddTag?:        (text: string, color: BadgeColor) => void
  /**
   * Externally-controlled list of user-added tags. Pass alongside `onAddTag`
   * when the consumer owns the state. If omitted, Pin uses internal state.
   */
  userTags?:        PinLabel[]
  /**
   * Override the colour pool used when a tag is committed. A random colour is
   * picked from this list per tag. Default: every non-Neutral colour
   * (`['Blue', 'Red', 'Green', 'Yellow', 'Purple', 'Brown']`) - Neutral is
   * excluded so backend (Neutral) and user-added (coloured) badges are
   * visually distinct.
   */
  userTagColors?:   BadgeColor[]
  /**
   * When `true`, render every tag (backend labels + user-added) as a deletable
   * `<Chip size="Small">` with an inline `×` button instead of a read-only
   * `<Badge>`. Set by `PinboardExpanded` only - the compact `Pinboard` and
   * the inline drag-expanded Pin keep tags read-only because edit affordances
   * don't fit the row-density there.
   * @default false
   */
  tagsEditable?:    boolean
  /**
   * Externally-controlled set of original-array indices that have been deleted
   * from `labels`. When provided, Pin filters them at render time and does
   * NOT mutate any internal state - the consumer owns the deletion record.
   * Pair with `onDeleteTag('label', i)` to keep the set in sync. Used by
   * `Pinboard` to persist deletions across the compact ↔ expanded transition
   * (without lifting, each Pin remount would lose its tracked deletions).
   * If omitted, Pin keeps its own internal `Set<number>` for uncontrolled use.
   */
  deletedLabelIndices?: ReadonlySet<number>
  /**
   * Fires when the user clicks the `×` on a tag (only relevant when
   * `tagsEditable` is true). `source: 'label'` means the tag came from the
   * backend `labels` prop; `'user'` means it came from the user-added pool.
   * `index` is local to that source list. The Pin removes the tag from its
   * own internal state regardless - the callback is for consumers to mirror
   * the change in their own data layer (e.g. PATCH the pin record).
   */
  onDeleteTag?:     (index: number, source: 'label' | 'user') => void
  /**
   * When `true`, swap the `PinCategory` icon for a 44×44 frame holding a
   * `Checkbox` (Figma `3457:21629` / `3457:22917`). Used by Pinboard's bulk
   * "select pins" mode. The category fades out and the checkbox fades in via
   * `AnimatePresence` (KDS standard scale + opacity + blur preset).
   */
  selectable?:        boolean
  /** Controlled checked state for the selectable checkbox. */
  selected?:          boolean
  /** Initial uncontrolled selected state. Defaults to `false`. */
  defaultSelected?:   boolean
  /** Fires when the user toggles the selectable checkbox. */
  onSelectedChange?:  (next: boolean) => void
}

// ── Tag cap ────────────────────────────────────────────────────────────────────
// Total tags per pin (backend `labels` + user-added) is hard-capped at 5.
// Backend typically supplies 1–4 auto-generated tags; the user fills the
// rest. The "Add tag" chip enters its `disabled` state when the cap is
// reached; the `commitTag` flow is a no-op past the cap as a belt-and-braces
// guard against direct callback wiring.
export const PIN_TAG_CAP = 5

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_DESCRIPTION =
  'The key distinction is that replicants possess implanted memories, making their emotional responses genuine even if their origins are artificial. This creates a philosophical paradox where authenticity of experience doesn\'t require authenticity of origin.\n\nEmpathy remains the defining boundary - the Voigt-Kampff test measures involuntary empathic response, suggesting that genuine emotional capacity, not memory or intelligence, separates human from artificial.\n\nRoy Batty\'s final monologue crystallises this tension - a being designed for servitude articulating loss, beauty, and mortality with a depth that confounds any clean distinction between programmed behaviour and genuine consciousness.'

// Backend-supplied labels render as Neutral by default - Neutral is the
// "system / read-only" colour. The user-added affordance commits new tags
// with non-Neutral colours, making the two visually distinct.
const DEFAULT_LABELS: PinLabel[] = [
  { color: 'Neutral', text: 'Label' },
  { color: 'Neutral', text: 'Label' },
  { color: 'Neutral', text: 'Label' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export const Pin = React.forwardRef<HTMLDivElement, PinProps>(
  function Pin(
    {
      category        = 'Code',
      pinTitle        = 'Pin title is too long that it can go to the next line',
      description     = DEFAULT_DESCRIPTION,
      labels          = DEFAULT_LABELS,
      chatName        = 'This will the chat name to which this pin belongs to.',
      defaultExpanded = false,
      collapseSignal,
      onExpandedChange,
      onInsert,
      onDuplicate,
      onExport,
      onDelete,
      onAddTag,
      userTags,
      userTagColors   = USER_TAG_COLOR_POOL,
      tagsEditable    = false,
      deletedLabelIndices: controlledDeletedLabels,
      onDeleteTag,
      fluid           = false,
      selectable      = false,
      selected,
      defaultSelected = false,
      onSelectedChange,
      className,
      style,
      onMouseEnter: externalEnter,
      onMouseLeave: externalLeave,
      ...props
    },
    forwardedRef,
  ) {
    const [isHovered,  setIsHovered]  = useState(false)
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)
    const [isDragging, setIsDragging] = useState(false)

    // Selectable checkbox - controlled / uncontrolled. Internal state only
    // applies in selectable mode; outside it the checkbox is unmounted.
    const isSelectedControlled = selected !== undefined
    const [internalSelected, setInternalSelected] = useState(defaultSelected)
    const isSelected = isSelectedControlled ? !!selected : internalSelected
    const handleSelectedChange = (next: boolean) => {
      if (!isSelectedControlled) setInternalSelected(next)
      onSelectedChange?.(next)
    }
    // Extra description lines beyond the base 2 (0–12). Card settles at any snap point.
    const [extraLines, setExtraLines] = useState(0)

    // ── Add-tag affordance ─────────────────────────────────────────────────────
    // The labels row leads with an "Add tag" chip. Click → swap to a ChipInput.
    // Enter on the input commits a Badge with a random non-Neutral colour and
    // returns to the chip. Escape / blur-empty cancels back to the chip.
    const [addTagMode,    setAddTagMode]    = useState<'chip' | 'input'>('chip')
    const [tagInputValue, setTagInputValue] = useState('')

    // Shake controls for the leading add-tag slot (whichever of AddTagChip /
    // ChipInput is currently rendered there). Triggered when the user tries
    // to add another tag past `PIN_TAG_CAP` - same x-keyframes / duration /
    // easing as the PinCommentField 2-line cap and the ChipInput 30-char
    // cap, so "you've hit a limit" reads identically across the system.
    const addTagShakeControls = useAnimation()
    const triggerAddTagShake = useCallback(() => {
      addTagShakeControls.start({
        x: [0, -3, 3, -2, 2, -1, 1, 0],
        transition: { duration: 0.25, ease: 'easeInOut' },
      })
    }, [addTagShakeControls])

    // ── More-options menu (ellipsis IconButton) ──────────────────────────────
    // Mounted via <Dropdown.Float> with placement="bottom-end" - that helper
    // handles the portal-to-body, click-outside, Escape, scroll/resize
    // re-anchoring, and the 8 px gap automatically. Figma 3139:36280.
    const [menuOpen, setMenuOpen] = useState(false)
    const runMenuAction = (cb?: () => void) => () => {
      setMenuOpen(false)
      cb?.()
    }
    // Stable IDs per tag - needed for the layout animation when a new tag
    // pushes the existing ones to the right. With index-based keys, framer
    // would treat each position as "the same element" and animate the wrong
    // values. UUIDs let it match each tag to its own DOM node across reorders.
    const [internalUserTags, setInternalUserTags] = useState<(PinLabel & { id: string })[]>([])
    const userTagsToRender: (PinLabel & { id?: string })[] = userTags ?? internalUserTags

    // Backend labels deleted by the user. The `labels` prop is consumer-owned
    // and read-only at this surface, so when the user clicks `×` on a backend
    // label we don't mutate the prop - we just filter the index out at render
    // time. Two modes:
    //  - **Controlled**: `deletedLabelIndices` prop is passed (e.g. by
    //    Pinboard, which lifts the set so it survives the compact ↔ expanded
    //    transition). Pin reads the prop and skips internal state updates.
    //  - **Uncontrolled**: prop omitted; Pin keeps a local Set<number>.
    // Indices in the set always reference the ORIGINAL `labels` array.
    const [internalDeletedLabels, setInternalDeletedLabels] = useState<Set<number>>(() => new Set())
    const isLabelsControlled = controlledDeletedLabels !== undefined
    const deletedLabelIndices: ReadonlySet<number> = isLabelsControlled
      ? controlledDeletedLabels
      : internalDeletedLabels
    const visibleLabels: { label: PinLabel; originalIndex: number }[] = labels
      .map((label, originalIndex) => ({ label, originalIndex }))
      .filter(({ originalIndex }) => !deletedLabelIndices.has(originalIndex))

    // Tag-cap math (PIN_TAG_CAP = 5). Backend visible + user-added.
    const totalTagCount = visibleLabels.length + userTagsToRender.length
    const atTagCap      = totalTagCount >= PIN_TAG_CAP

    const handleDeleteLabel = (originalIndex: number) => {
      // Only mutate internal state when uncontrolled - otherwise the consumer
      // (typically Pinboard) owns the deleted-set and the callback is their
      // cue to update it.
      if (!isLabelsControlled) {
        setInternalDeletedLabels(prev => {
          if (prev.has(originalIndex)) return prev
          const next = new Set(prev); next.add(originalIndex); return next
        })
      }
      onDeleteTag?.(originalIndex, 'label')
    }
    const handleDeleteUserTag = (index: number) => {
      // Only mutate internal state when the consumer hasn't taken control via
      // the `userTags` prop; otherwise they own the list and the callback is
      // their cue to update.
      if (userTags === undefined) {
        setInternalUserTags(prev => prev.filter((_, i) => i !== index))
      }
      onDeleteTag?.(index, 'user')
    }

    const tagInputRef = useRef<HTMLInputElement>(null)

    // ── Labels row scroll state ────────────────────────────────────────────────
    // Drives the edge fade overlays (left/right) and the drag-to-scroll grab
    // cursor. Same model as the Tabs scroll strip - atStart/atEnd flip on
    // scroll, overflowing flips on content/size change, dragging flips on
    // pointer drag past a 4 px threshold.
    const labelsRowRef = useRef<HTMLDivElement>(null)
    const [labelsAtStart,      setLabelsAtStart]      = useState(true)
    const [labelsAtEnd,        setLabelsAtEnd]        = useState(true)
    const [labelsOverflowing,  setLabelsOverflowing]  = useState(false)
    const [labelsDragging,     setLabelsDragging]     = useState(false)
    const labelsDragState = useRef<{ startX: number; startScroll: number; moved: boolean; pointerId: number } | null>(null)

    const recomputeLabelsScroll = useCallback(() => {
      const row = labelsRowRef.current
      if (!row) return
      const overflows = row.scrollWidth > row.clientWidth + 1
      setLabelsOverflowing(overflows)
      setLabelsAtStart(row.scrollLeft <= 0)
      setLabelsAtEnd(row.scrollLeft + row.clientWidth >= row.scrollWidth - 1)
    }, [])

    useEffect(() => {
      const row = labelsRowRef.current
      if (!row) return
      recomputeLabelsScroll()
      const ro = new ResizeObserver(recomputeLabelsScroll)
      ro.observe(row)
      for (const child of Array.from(row.children)) ro.observe(child as Element)
      return () => ro.disconnect()
    }, [recomputeLabelsScroll, addTagMode, labels.length, userTagsToRender.length, tagInputValue])

    const onLabelsPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (!labelsOverflowing) return
      if (e.pointerType === 'touch') return
      if (e.button !== 0) return
      // Inputs / textareas / selects keep their native text-selection drag -
      // we don't want to hijack that into a row-scroll. Buttons (chip `×`
      // ChipButton, AddTag chip) DO arm the drag: pointer-up within 4 px
      // fires the button's click as normal (delete fires); dragging past
      // 4 px promotes to a scroll and the synthetic click is swallowed by
      // the capture-phase listener installed in `endLabelsDrag`. This is
      // the click-vs-drag distinction the Tabs strip uses too.
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select')) return
      const row = labelsRowRef.current
      if (!row) return
      labelsDragState.current = {
        startX:      e.clientX,
        startScroll: row.scrollLeft,
        moved:       false,
        pointerId:   e.pointerId,
      }
    }, [labelsOverflowing])

    const onLabelsPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const s = labelsDragState.current
      if (!s) return
      const dx = e.clientX - s.startX
      if (!s.moved) {
        if (Math.abs(dx) <= 4) return
        s.moved = true
        setLabelsDragging(true)
        try { labelsRowRef.current?.setPointerCapture(s.pointerId) } catch {}
      }
      if (labelsRowRef.current) labelsRowRef.current.scrollLeft = s.startScroll - dx
      e.preventDefault()
    }, [])

    const endLabelsDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const s = labelsDragState.current
      if (!s) return
      const wasDrag = s.moved
      labelsDragState.current = null
      setLabelsDragging(false)
      try { labelsRowRef.current?.releasePointerCapture(s.pointerId) } catch {}
      if (wasDrag) {
        // Swallow the synthetic click after a drag so an underlying badge or
        // chip click doesn't fire.
        const row = labelsRowRef.current
        if (row) {
          const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
          row.addEventListener('click', swallow, { capture: true, once: true })
          setTimeout(() => row.removeEventListener('click', swallow, true), 0)
        }
      }
      void e
    }, [])

    const commitTag = (raw: string) => {
      const text = raw.trim()
      if (!text) return
      // At-cap rejection. The leading add-tag slot is wrapped in a
      // shake-controlled motion.div, so the same gesture that fires for the
      // 2-line cap (PinCommentField) and the 30-char cap (ChipInput) plays
      // here when the user tries to add a 6th tag. The input keeps focus and
      // its current value so the user can edit-and-resubmit.
      if (atTagCap) {
        triggerAddTagShake()
        return
      }
      const pool  = userTagColors.length > 0 ? userTagColors : USER_TAG_COLOR_POOL
      const color = pool[Math.floor(Math.random() * pool.length)]!
      if (onAddTag) {
        onAddTag(text, color)
      } else {
        // Prepend so the newest tag sits immediately after the AddTagChip and
        // existing tags shift to the right (their layout animation handles
        // the slide).
        const id = `tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        setInternalUserTags(prev => [{ id, color, text }, ...prev])
      }
      setTagInputValue('')
      // Reveal the just-added tag - if the user scrolled away from the start
      // before adding, scroll back so the new tag is visible. rAF ensures the
      // new DOM node is in place before scrolling.
      requestAnimationFrame(() => {
        labelsRowRef.current?.scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
      })
      // Stay in input mode so the user can rapidly add several tags. To
      // dismiss, they hit Escape or blur with an empty value.
    }

    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitTag(tagInputValue)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setTagInputValue('')
        setAddTagMode('chip')
      }
    }

    const handleTagInputBlur = () => {
      // Blur with empty value → swap back to the chip. With a value present,
      // we leave the input visible so a click elsewhere doesn't silently
      // discard typed text - the user must explicitly Enter or Escape.
      if (!tagInputValue.trim()) {
        setAddTagMode('chip')
      }
    }

    const [contentRef, contentBounds] = useMeasure()

    const commentFieldRef    = useRef<HTMLTextAreaElement>(null)
    const focusCommentRef    = useRef(false)
    const cardRef            = useRef<HTMLDivElement>(null)
    const dragInfo           = useRef({ startY: 0, startHeight: 0 })
    const rafRef             = useRef<number>(0)
    const isDraggingRef      = useRef(false)
    const isExpandedRef      = useRef(isExpanded)
    isExpandedRef.current    = isExpanded
    const skipActionBarEntry = useRef(false)
    // Set true just before calling setIsExpanded(false) so contentBounds effect
    // knows to use the collapse easing instead of the default spring.
    const collapsingRef = useRef(false)
    // Tracks the last pointer move sample for velocity calculation on release.
    const lastMoveRef = useRef({ y: 0, time: 0 })

    // cardHeightMV - single source of truth for card height.
    // set() during drag (instant, cursor-locked), animate() at rest (spring).
    const cardHeightMV = useMotionValue(0)

    // OS-level reduce-motion preference. When true, programmatic height
    // changes snap instantly. The drag gesture itself stays responsive -
    // it's direct manipulation, not an animation.
    const reduceMotion = useReducedMotion() ?? false

    const springCfg   = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 }
    const collapseCfg = { type: 'tween'  as const, ease: [0, 0.64, 0.12, 0.99] as const, duration: 0.35 }

    const mergedRef = useCallback((el: HTMLDivElement | null) => {
      cardRef.current = el
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) forwardedRef.current = el
    }, [forwardedRef])

    // contentBounds → cardHeightMV
    // First measurement after mount: snap instantly (no enter spring) so a
    // freshly-mounted Pinboard / Pin doesn't visually "grow up" from height 0.
    // Subsequent changes (drag-release, expand toggle, collapse-all) use the
    // spring (or collapse easing if collapsingRef.current is true).
    const hasMeasuredRef = useRef(false)
    useEffect(() => {
      if (isDraggingRef.current) return
      if (contentBounds.height > 0) {
        const cfg = collapsingRef.current ? collapseCfg : springCfg
        collapsingRef.current = false
        if (reduceMotion || !hasMeasuredRef.current) {
          cardHeightMV.set(contentBounds.height)
          hasMeasuredRef.current = true
        } else {
          animate(cardHeightMV, contentBounds.height, cfg)
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentBounds.height])

    // "Open" = pin is showing more than the default 2 lines, either because
    // it's fully expanded OR because the user dragged the handle to reveal
    // extra lines (intermediate snap state). Both cases should show the
    // Pinboard "collapse all" button and respond to its click.
    const isOpen = isExpanded || extraLines > 0

    // External collapse trigger - Pinboard increments `collapseSignal` to fold
    // every open pin. Initial value is captured and skipped so a freshly
    // mounted Pin doesn't collapse on first render.
    const isOpenRef = useRef(isOpen)
    isOpenRef.current = isOpen
    const initialCollapseSignalRef = useRef(collapseSignal)
    useEffect(() => {
      if (collapseSignal === initialCollapseSignalRef.current) return
      if (!isOpenRef.current) return
      collapsingRef.current = true
      setIsExpanded(false)
      setExtraLines(0)
    }, [collapseSignal])

    // Notify parent on open-state change (skipping the initial mount so
    // Pinboard doesn't get a flood of false signals from collapsed pins).
    // Callback held in a ref so re-renders that produce a new function identity
    // don't trip the effect on every render.
    const onExpandedChangeRef = useRef(onExpandedChange)
    useEffect(() => { onExpandedChangeRef.current = onExpandedChange })
    const didMountRef = useRef(false)
    useEffect(() => {
      if (!didMountRef.current) {
        didMountRef.current = true
        return
      }
      onExpandedChangeRef.current?.(isOpen)
    }, [isOpen])

    // Max px the card can grow past its natural height on downward drag.
    const MAX_OVERSHOOT = 32
    // Elastic factor for downward drag - card grows at this fraction of cursor speed.
    // Gives progressively-feeling resistance; spring on release snaps it back.
    const ELASTIC_FACTOR = 0.2

    // ── Handle drag - unified pointer events for all states ───────────────────
    // The handle sits at position:absolute bottom:4px and follows the card
    // naturally as cardHeightMV changes. No separate y transform needed.

    const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      // Cancel any in-flight height animation (e.g. the spring still settling
      // after a comment-click expand) so the drag has full control of the
      // motion value from frame 0.
      cardHeightMV.stop()
      const h = cardHeightMV.get()
      dragInfo.current           = { startY: e.clientY, startHeight: h }
      skipActionBarEntry.current = isExpanded || isHovered
      isDraggingRef.current      = true
      e.currentTarget.setPointerCapture(e.pointerId)
      e.stopPropagation()
      setIsDragging(true)
    }

    const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return
      const clientY = e.clientY
      lastMoveRef.current = { y: clientY, time: performance.now() }
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const rawDelta = clientY - dragInfo.current.startY

        if (!isExpanded) {
          // ── Collapsed / intermediate: drag up to reveal lines ────────────
          const minDelta     = -extraLines * LINE_HEIGHT_PX
          const clampedDelta = Math.max(minDelta, rawDelta)
          if (extraLines * LINE_HEIGHT_PX + clampedDelta > MAX_SNAP_LINES * LINE_HEIGHT_PX) {
            isDraggingRef.current      = false
            skipActionBarEntry.current = false
            setIsDragging(false)
            setIsExpanded(true)
            setExtraLines(0)
            return
          }
          cardHeightMV.set(dragInfo.current.startHeight + clampedDelta)
        } else {
          if (rawDelta > 0) {
            // ── Expanded, dragging down - elastic resistance ──────────────
            // Card grows at ELASTIC_FACTOR of cursor speed, capped at MAX_OVERSHOOT.
            // Handle moves 1:1 with card (bottom:4px) - no transform mismatch.
            const stretch = Math.min(rawDelta * ELASTIC_FACTOR, MAX_OVERSHOOT)
            cardHeightMV.set(dragInfo.current.startHeight + stretch)
          } else {
            // ── Expanded, dragging up - linear toward collapse ────────────
            cardHeightMV.set(Math.max(dragInfo.current.startHeight + rawDelta, 60))
          }
        }
      })
    }

    const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return
      cancelAnimationFrame(rafRef.current)
      const rawDelta             = e.clientY - dragInfo.current.startY
      isDraggingRef.current      = false
      skipActionBarEntry.current = false
      setIsDragging(false)

      if (!isExpanded) {
        // ── Snap to nearest line ─────────────────────────────────────────
        const minDelta     = -extraLines * LINE_HEIGHT_PX
        const clampedDelta = Math.max(minDelta, rawDelta)
        const snappedDelta = Math.round(clampedDelta / LINE_HEIGHT_PX) * LINE_HEIGHT_PX
        const newExtra     = Math.max(0, extraLines + snappedDelta / LINE_HEIGHT_PX)

        if (newExtra >= MAX_SNAP_LINES) {
          setIsExpanded(true)
          setExtraLines(0)
        } else {
          setExtraLines(newExtra)
          // contentBounds update → animate(cardHeightMV, newH, spring)
        }
      } else {
        // Velocity in px/ms - negative means moving up.
        // A quick flick (< -0.3 px/ms) collapses even with a short drag distance.
        const dt = performance.now() - lastMoveRef.current.time
        const velocity = dt > 0 ? (e.clientY - lastMoveRef.current.y) / dt : 0
        const shouldCollapse = -rawDelta > DRAG_THRESHOLD || velocity < -0.3

        if (shouldCollapse) {
          // Dragged or flicked up → collapse with easing
          collapsingRef.current = true
          setIsExpanded(false)
          setExtraLines(0)
          // contentBounds update → animate with collapseCfg
        } else if (rawDelta > 0) {
          // Released after elastic downward stretch → spring back to natural height
          if (reduceMotion) {
            cardHeightMV.set(dragInfo.current.startHeight)
          } else {
            animate(cardHeightMV, dragInfo.current.startHeight, {
              type:     'tween',
              ease:     [0, 0.64, 0.12, 0.99],
              duration: 0.35,
            })
          }
        }
        // rawDelta < 0 but not past threshold → contentBounds handles spring back
      }
    }

    const showFull = isExpanded || isDragging

    const focusAndScrollCommentField = () => {
      const ta = commentFieldRef.current
      if (!ta) return
      ta.focus()
      // Bring the comment field into view in whatever ancestor is scrolling
      // (Pinboard's scroll container, or the page). `block: 'nearest'` only
      // scrolls if the element is actually clipped.
      ta.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }

    const handleCommentClick = () => {
      if (!isExpanded) {
        focusCommentRef.current = true
        setIsExpanded(true)
      } else {
        focusAndScrollCommentField()
      }
    }

    // Focus + scroll the comment textarea after the expand animation completes.
    useEffect(() => {
      if (isExpanded && focusCommentRef.current) {
        focusCommentRef.current = false
        const id = requestAnimationFrame(focusAndScrollCommentField)
        return () => cancelAnimationFrame(id)
      }
    }, [isExpanded])

    return (
      <motion.div
        ref={mergedRef as React.Ref<HTMLDivElement>}
        className={cn(className)}
        style={{
          height:          cardHeightMV,
          position:        'relative',
          width:           fluid ? '100%' : '314px',
          borderRadius:    '16px',
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       selectable && isSelected
            ? '0px 0px 0px 1px var(--focus-ring)'
            : SHADOW_CARD,
          transition:      'box-shadow 150ms ease',
          cursor:          selectable ? 'pointer' : undefined,
          overflow:        'clip',
          isolation:       'isolate',
          ...style,
        }}
        onMouseEnter={(e) => { setIsHovered(true); externalEnter?.(e as unknown as React.MouseEvent<HTMLDivElement>) }}
        onMouseLeave={(e) => {
          if (!isDraggingRef.current) setIsHovered(false)
          externalLeave?.(e as unknown as React.MouseEvent<HTMLDivElement>)
        }}
        onClickCapture={(e) => {
          // In selectable mode, the entire pin is the click target - toggle
          // the checkbox. Clicks on the checkbox itself stopPropagation below
          // so they don't double-fire here.
          if (selectable) {
            handleSelectedChange(!isSelected)
            e.stopPropagation()
          }
        }}
        {...(props as object)}
      >

        {/* ── Inner content div - measured by useMeasure ──────────────────────
            Contains only in-flow content. Drag handle and action bars are
            SIBLINGS of this div (children of the outer motion.div) so their
            bottom:0 is relative to the outer clip boundary, not this div.
            As drag grows the outer div, the action bar stays pinned to the
            outer bottom while this div's content scrolls up behind it.       ── */}
        <div
          ref={contentRef as React.Ref<HTMLDivElement>}
          style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           '16px',
            alignItems:    'flex-start',
            paddingTop:    '12px',
            paddingBottom: isDragging ? '64px' : '16px',
            paddingLeft:   '12px',
            paddingRight:  '12px',
          }}
        >

          {/* ── Header row ── */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', width: '100%', flexShrink: 0 }}>
            <div style={{ display: 'flex', flex: '1 0 0', gap: '12px', alignItems: 'flex-start', minWidth: 0 }}>
              {/* ── Category ↔ Checkbox slot - crossfade via AnimatePresence ──
                   44×44 fixed slot. PinCategory exits as the checkbox + frame
                   enters (Figma 3457:21629 / 3457:22917). KDS standard preset:
                   scale 0.85 → 1, opacity 0 → 1, blur 4px → 0, spring 500/30. */}
              <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {selectable ? (
                    <motion.div
                      key="checkbox-slot"
                      initial={{ scale: 0.85, opacity: 0, filter: 'blur(4px)' }}
                      animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                      exit={{    scale: 0.85, opacity: 0, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      // Outer pin owns the click target in selectable mode -
                      // suppress propagation so the checkbox's own onClick
                      // doesn't fire AND bubble up to the pin (double-toggle).
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position:        'absolute',
                        inset:           0,
                        display:         'flex',
                        alignItems:      'center',
                        justifyContent:  'center',
                        backgroundColor: 'var(--neutral-white)',
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(v) => handleSelectedChange(v === true)}
                        aria-label="Select pin"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="category-slot"
                      initial={{ scale: 0.85, opacity: 0, filter: 'blur(4px)' }}
                      animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                      exit={{    scale: 0.85, opacity: 0, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      style={{ position: 'absolute', inset: 0 }}
                    >
                      <PinCategory type={category} style={{ flexShrink: 0 }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <p
                style={{
                  flex:               '1 0 0',
                  fontFamily:         'var(--font-body)',
                  fontWeight:         'var(--font-weight-medium)',
                  fontSize:           'var(--font-size-body)',
                  lineHeight:         'var(--line-height-body)',
                  color:              'var(--neutral-900)',
                  // Clamp to a maximum of 2 lines; anything beyond truncates
                  // with an ellipsis. Uses `-webkit-line-clamp` with the
                  // `-webkit-box` display model - supported in every modern
                  // engine (Chromium, WebKit, Firefox 68+).
                  display:            '-webkit-box',
                  WebkitLineClamp:    2,
                  WebkitBoxOrient:    'vertical',
                  overflow:           'hidden',
                  textOverflow:       'ellipsis',
                  overflowWrap:       'anywhere',
                  margin:             0,
                  minWidth:           0,
                }}
              >
                {pinTitle}
              </p>
            </div>
            {/* More-options menu (Figma 3139:36280). Dropdown.Float portals
                to document.body so it escapes Pin's overflow:clip +
                isolation:isolate, and applies the 8 px gap + bottom-end
                placement automatically per the KDS dropdown placement rules. */}
            <div style={{ flexShrink: 0 }}>
              <Dropdown.Float
                open={menuOpen}
                onOpenChange={setMenuOpen}
                placement="bottom-end"
                trigger={
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={<MoreVerticalIcon size={20} />}
                    aria-label="More options"
                  />
                }
              >
                <Dropdown size="sm">
                  <Dropdown.Section fluid>
                    <Dropdown.Item
                      label="Duplicate"
                      icon={<CopyOneIcon />}
                      onClick={runMenuAction(onDuplicate)}
                      fluid
                    />
                    <Dropdown.Item
                      label="Export"
                      icon={<DownloadThreeIcon />}
                      onClick={runMenuAction(onExport)}
                      fluid
                    />
                    <Dropdown.Item
                      variant="danger"
                      label="Delete"
                      icon={<DeleteTwoIcon />}
                      onClick={runMenuAction(onDelete)}
                      fluid
                    />
                  </Dropdown.Section>
                </Dropdown>
              </Dropdown.Float>
            </div>
          </div>

          {/* ── Labels row ──
              Order: Add-tag affordance (chip↔input) · backend labels · user-added tags.
              Backend labels render whatever colour they carry (defaults to Neutral
              for the system "read-only" rendering); user-added tags carry a random
              non-Neutral colour assigned at commit time. The colour split is what
              visually distinguishes "added by the system" from "added by me".

              Layout: single horizontal line - never wraps. Overflow scrolls
              horizontally. Scrollbar is hidden (the row is small pills; a
              chunky native scrollbar would dominate). Same gesture-as-
              affordance reasoning as the Tabs strip. */}
          {/* position: relative wrapper anchors the edge fade overlays so
              they stay pinned to the row's left/right edges instead of
              scrolling with the content. */}
          <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
          <div
            ref={labelsRowRef}
            className="kds-pin-labels-scroll-row"
            data-draggable={labelsOverflowing ? 'true' : undefined}
            data-dragging={labelsDragging ? 'true' : undefined}
            onScroll={recomputeLabelsScroll}
            onPointerDown={onLabelsPointerDown}
            onPointerMove={onLabelsPointerMove}
            onPointerUp={endLabelsDrag}
            onPointerCancel={endLabelsDrag}
            style={{
              display:             'flex',
              gap:                 '6px',
              alignItems:          'center',
              width:               '100%',
              flexShrink:          0,
              flexWrap:            'nowrap',
              overflowX:           'auto',
              // `overflow-x: auto` coerces overflow-y from visible to auto
              // (CSS spec). That clips the 1 px outer ring shadow on badges
              // and the AddTag chip top/bottom. A 1 px padding on the
              // scrollport gives those shadows room INSIDE the clip
              // boundary so they render fully. Negative margin cancels the
              // visual shift so the row's outer footprint is unchanged.
              padding:             '1px',
              margin:              '-1px',
              overscrollBehaviorX: 'contain',
              scrollbarWidth:      'none' as const,
              touchAction:         'pan-x',
              userSelect:          labelsDragging ? 'none' : undefined,
            }}
          >
            {/* Shake-controlled wrapper around the add-tag slot - drives the
                rejection animation when the user tries to add past
                PIN_TAG_CAP. Wraps both modes so it shakes the AddTag chip OR
                the ChipInput, whichever is rendered. */}
            <motion.div animate={addTagShakeControls} style={{ display: 'inline-flex' }}>
              <AnimatePresence mode="popLayout" initial={false}>
                {addTagMode === 'chip' ? (
                  <motion.span
                    key="add-tag-chip"
                    initial={reduceMotion ? SWAP_INSTANT : SWAP_INITIAL}
                    animate={SWAP_ANIMATE}
                    exit={reduceMotion ? SWAP_INSTANT : SWAP_EXIT}
                    transition={SWAP_SPRING}
                    style={{ display: 'inline-flex', transformOrigin: 'left center' }}
                  >
                    <AddTagChip
                      disabled={atTagCap}
                      onClick={() => {
                        if (atTagCap) {
                          // At cap - shake instead of opening the input.
                          triggerAddTagShake()
                          return
                        }
                        setAddTagMode('input')
                        // Focus is wired via `autoFocus` on the ChipInput once it mounts.
                      }}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="add-tag-input"
                    initial={reduceMotion ? SWAP_INSTANT : SWAP_INITIAL}
                    animate={SWAP_ANIMATE}
                    exit={reduceMotion ? SWAP_INSTANT : SWAP_EXIT}
                    transition={SWAP_SPRING}
                    style={{ display: 'inline-flex', transformOrigin: 'left center' }}
                  >
                    <ChipInput
                      ref={tagInputRef}
                      autoFocus
                      aria-label="Add tag"
                      placeholder="Add tag…"
                      value={tagInputValue}
                      onChange={(e) => setTagInputValue(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      onBlur={handleTagInputBlur}
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>

            {/* User-added tags come BEFORE backend labels - newest sits right
                after the AddTagChip and pushes existing ones to the right.
                `layout` on each motion.span animates the slide; AnimatePresence
                with the in-place-swap pattern animates each new tag's enter.
                When `tagsEditable` is set (PinboardExpanded only), each tag
                renders as a deletable `Chip size="Small"` with an inline `×`
                button instead of a read-only `Badge`. */}
            <AnimatePresence initial={false} mode="popLayout">
              {userTagsToRender.map((l, i) => (
                <motion.span
                  key={l.id ?? `user-${i}`}
                  layout
                  initial={reduceMotion ? SWAP_INSTANT : SWAP_INITIAL}
                  animate={SWAP_ANIMATE}
                  exit={reduceMotion ? SWAP_INSTANT : SWAP_EXIT}
                  transition={SWAP_SPRING}
                  style={{ display: 'inline-flex', transformOrigin: 'left center' }}
                >
                  {tagsEditable ? (
                    <Chip
                      size="Small"
                      label={l.text}
                      color={l.color as ChipColor}
                      onRemove={() => handleDeleteUserTag(i)}
                    />
                  ) : (
                    <Badge label={l.text} color={l.color} />
                  )}
                </motion.span>
              ))}
            </AnimatePresence>
            {visibleLabels.map(({ label: l, originalIndex }) => (
              tagsEditable ? (
                <Chip
                  key={`label-${originalIndex}`}
                  size="Small"
                  label={l.text}
                  color={l.color as ChipColor}
                  onRemove={() => handleDeleteLabel(originalIndex)}
                />
              ) : (
                <Badge key={`label-${originalIndex}`} label={l.text} color={l.color} />
              )
            ))}
          </div>

          {/* ── Labels-row edge fades ──
              Same progressive-blur + colour-fade pattern as Pinboard's
              top/bottom fades, rotated 90° for horizontal scroll. Layers
              live OUTSIDE the scroll container so they stay pinned at the
              edges while content scrolls underneath. Opacity is gated by
              the `atStart` / `atEnd` / `overflowing` state so each side
              only shows when there's content to reveal in that direction. */}
          {/* The scroll row carries `margin: -1px` to compensate for its 1 px
              padding (shadow-clip workaround). That shifts the row's visible
              left edge 1 px outside the wrapper, so the left fade overlays
              are offset by `left: -1` to align with the row's true edge.
              The right side stays at `right: 0` because the wrapper is
              width:100% and the row's right edge ends at that boundary. */}
          {[
            { width: 24, blur: 2 },
            { width: 18, blur: 3 },
            { width: 12, blur: 5 },
            { width: 8,  blur: 6 },
          ].map(({ width, blur }) => (
            <div
              key={`labels-left-blur-${blur}`}
              aria-hidden
              style={{
                position:             'absolute',
                top:                  0,
                bottom:               0,
                left:                 -1,
                width,
                backdropFilter:       `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage:            'linear-gradient(to right, black 0%, transparent 100%)',
                WebkitMaskImage:      'linear-gradient(to right, black 0%, transparent 100%)',
                pointerEvents:        'none',
                zIndex:               1,
                opacity:              labelsAtStart || !labelsOverflowing ? 0 : 1,
                transition:           'opacity 150ms ease',
              }}
            />
          ))}
          <div
            aria-hidden
            style={{
              position:      'absolute',
              top:           0,
              bottom:        0,
              left:          -1,
              width:         24,
              background:    'linear-gradient(to right, var(--neutral-white) 0%, transparent 100%)',
              pointerEvents: 'none',
              zIndex:        1,
              opacity:       labelsAtStart || !labelsOverflowing ? 0 : 1,
              transition:    'opacity 150ms ease',
            }}
          />

          {[
            { width: 24, blur: 2 },
            { width: 18, blur: 3 },
            { width: 12, blur: 5 },
            { width: 8,  blur: 6 },
          ].map(({ width, blur }) => (
            <div
              key={`labels-right-blur-${blur}`}
              aria-hidden
              style={{
                position:             'absolute',
                top:                  0,
                bottom:               0,
                right:                0,
                width,
                backdropFilter:       `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage:            'linear-gradient(to left, black 0%, transparent 100%)',
                WebkitMaskImage:      'linear-gradient(to left, black 0%, transparent 100%)',
                pointerEvents:        'none',
                zIndex:               1,
                opacity:              labelsAtEnd || !labelsOverflowing ? 0 : 1,
                transition:           'opacity 150ms ease',
              }}
            />
          ))}
          <div
            aria-hidden
            style={{
              position:      'absolute',
              top:           0,
              bottom:        0,
              right:         0,
              width:         24,
              background:    'linear-gradient(to left, var(--neutral-white) 0%, transparent 100%)',
              pointerEvents: 'none',
              zIndex:        1,
              opacity:       labelsAtEnd || !labelsOverflowing ? 0 : 1,
              transition:    'opacity 150ms ease',
            }}
          />
          </div>

          {/* ── Description ──
              showFull (isDragging | isExpanded): unclamped - card clips at dragHeight
              at rest with extraLines > 0: cage grows by extraLines × 16px
              at rest collapsed: 2-line cage (32px)                              ── */}
          {(() => {
            const visibleLines  = 2 + extraLines           // base 2 + settled extra
            // +12px when showing extra lines so the last snapped line is never
            // half-clipped - the line-height token alone lands 12px short visually
            const cageH         = visibleLines * LINE_HEIGHT_PX + (extraLines > 0 ? 12 : 0)
            return (
              <div
                style={{
                  height:    showFull ? 'auto' : `${cageH}px`,
                  minHeight: showFull ? undefined : `${cageH}px`,
                  maxHeight: showFull ? undefined : `${cageH}px`,
                  overflow:  showFull ? 'visible' : 'hidden',
                  width:     '100%',
                  flexShrink: 0,
                  flexGrow:   0,
                }}
              >
                <p
                  style={{
                    margin:     0,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'var(--font-weight-regular)',
                    fontSize:   'var(--font-size-caption)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      'var(--neutral-500)',
                    // showFull (drag/expanded): unclamped pre-wrap
                    // intermediate (extraLines > 0): pre-wrap + overflow:hidden - preserves \n paragraph breaks
                    // collapsed (extraLines = 0): -webkit-line-clamp for ellipsis on 2 lines
                    ...(showFull || extraLines > 0
                      ? { whiteSpace: 'pre-wrap' }
                      : {
                          display:         '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflow:        'hidden',
                          textOverflow:    'ellipsis',
                        }
                    ),
                  }}
                >
                  {description}
                </p>
              </div>
            )
          })()}

          {/* ── Expanded content: metadata + comment field ── */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="expanded-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{   opacity: 0, transition: { duration: 0 } }}
                style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <ExpandedMeta chatName={chatName} />
                <PinCommentField ref={commentFieldRef} fluid aria-label="Add a comment" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Inline action bar - expanded state (stays during drag) ── */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="action-bar-expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.12 } }}
                exit={{   opacity: 0, transition: { duration: 0 } }}
                style={{ width: '100%', flexShrink: 0 }}
              >
                <ActionBar onInsert={onInsert} onComment={handleCommentClick} hideComment />
              </motion.div>
            )}
          </AnimatePresence>

        </div>
        {/* ── end inner content div ── */}

        {/* ── Drag handle - child of OUTER motion.div ──────────────────────────
            Uses Framer's drag="y" for dragElastic + dragMomentum feel.
            handleY motion value drives dragHeight via onChange subscription.   ── */}
        <motion.div
          role="button"
          tabIndex={0}
          aria-label={isExpanded ? 'Collapse pin' : 'Expand pin'}
          aria-expanded={isExpanded}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isExpanded) { e.preventDefault(); setIsExpanded(true) } }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (isExpanded) {
              // Collapse - same path as collapseSignal / drag-collapse.
              collapsingRef.current = true
              setIsExpanded(false)
              setExtraLines(0)
            } else {
              setIsExpanded(true)
            }
          }}
          style={{
            position:       'absolute',
            bottom:         '4px',
            left:           'calc(50% - 16px)',
            width:          '32px',
            height:         '12px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            cursor:         isDragging ? 'grabbing' : 'grab',
            userSelect:     'none',
            touchAction:    'none',
            zIndex:         2,
          }}
        >
          <div
            style={{
              width:           '32px',
              height:          '2px',
              borderRadius:    '1px',
              backgroundColor: 'var(--neutral-200)',
              pointerEvents:   'none',
            }}
          />
        </motion.div>

        {/* ── Absolute action bar - child of OUTER motion.div ──────────────────
            AbsoluteActionBar is a dedicated component so useIsPresent can be
            called inside AnimatePresence (the hook must live in a child, not
            the parent where the conditional render happens).                 ── */}
        <AnimatePresence initial={false}>
          {!isExpanded && (isHovered || isDragging || extraLines > 0) ? (
            <AbsoluteActionBar
              key="action-bar-absolute"
              onInsert={onInsert}
              onComment={handleCommentClick}
              instant={skipActionBarEntry.current}
            />
          ) : null}
        </AnimatePresence>

      </motion.div>
    )
  },
)

// ── Shared sub-components ─────────────────────────────────────────────────────

function ExpandedMeta({ chatName }: { chatName: string }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
      <Badge label="1h" color="Green" />
      <p
        style={{
          flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-semibold)',
          fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--color-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, minWidth: 0,
        }}
      >
        {chatName}
      </p>
      <div style={{ width: 24, height: 24, borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
        <LlmIcon id="Claude" variant="avatar" size={24} />
      </div>
    </div>
  )
}

// ── AbsoluteActionBar ─────────────────────────────────────────────────────────
// Dedicated component so useIsPresent can be called inside AnimatePresence.
// Article rule: useIsPresent must live in a child of AnimatePresence, not the
// parent where the conditional render happens.
//
// Animation design:
//   Enter - slides up (y: 8→0) + fades in + unblurs: panel materialises from below
//   Exit  - shorter slide (y: 0→4), same blur: eye needs less signal for departures
//   useIsPresent → pointerEvents:none during exit so fast mouse-outs can't
//                  accidentally trigger Insert during the 180ms fade

function AbsoluteActionBar({ onInsert, onComment, instant }: { onInsert?: () => void; onComment?: () => void; instant?: boolean }) {
  const isPresent = useIsPresent()

  return (
    <motion.div
      initial={instant
        ? { opacity: 1, y: 0, filter: 'blur(0px)' }
        : { opacity: 0, y: 8, filter: 'blur(4px)' }
      }
      animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
      exit={{   opacity: 0, y: 4,  filter: 'blur(4px)' }}
      transition={{
        duration: 0.2,
        ease:     [0.25, 0.46, 0.45, 0.94],
      }}
      style={{
        position:        'absolute',
        bottom:          0,
        left:            0,
        right:           0,
        backgroundColor: 'var(--neutral-white)',
        paddingBottom:   '16px',
        paddingLeft:     '12px',
        paddingRight:    '12px',
        paddingTop:      '8px',
        zIndex:          1,
        // Disable clicks while the bar is animating out - prevents accidental
        // "Insert" triggers during the exit fade (useIsPresent returns false
        // as soon as the exit animation begins).
        pointerEvents:   isPresent ? 'auto' : 'none',
      }}
    >
      <ActionBar onInsert={onInsert} onComment={onComment} />
    </motion.div>
  )
}

function ActionBar({ onInsert, onComment, hideComment = false }: { onInsert?: () => void; onComment?: () => void; hideComment?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Tooltip content="Show in chat">
          <IconButton variant="ghost" size="sm" icon={<MessagePreviewOneIcon size={20} />} aria-label="Show in chat" />
        </Tooltip>
        {!hideComment && (
          <Tooltip content="Comment">
            <IconButton variant="ghost" size="sm" icon={<InputShortTextIcon size={20} />} aria-label="Comment" onClick={onComment} />
          </Tooltip>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={onInsert}>Insert</Button>
    </div>
  )
}

Pin.displayName = 'Pin'
export default Pin
