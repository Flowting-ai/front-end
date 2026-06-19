'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils'
import { FolderOneIcon, ArrowDownOneIcon } from '@strange-huge/icons'

// ── Shadow token ───────────────────────────────────────────────────────────────

const SHADOW_ITEM_HOVER = 'var(--shadow-sidebar-item-hover)'
const SHADOW_ITEM_INNER = 'var(--shadow-item-inner)'

// ── Text styles ────────────────────────────────────────────────────────────────

const bodyTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   'var(--font-size-body)',
  lineHeight: 'var(--line-height-body)',
  color:      'var(--sidebar-menu-item-text)',
  whiteSpace: 'nowrap',
}

// ── Animation variants ─────────────────────────────────────────────────────────
// Three layers so height animation and stagger orchestration never conflict:
//   Layer 1 (heightVariants)  - animates height only
//   Layer 2 (staggerVariants) - orchestrates staggerChildren, no visual props
//   Layer 3 (itemVariants)    - per-item fade + downward drift

// Layer 1 - height clip
const heightVariants = {
  open: {
    height: 'auto' as const,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const },
  },
  closed: {
    height: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const, delay: 0.14 },
  },
}

// Layer 2 - stagger orchestrator (no visual change on itself)
// Open:  delay items until AFTER height animation completes (0.22s) so items never appear while clipped
// Close: no stagger - all items fade at once (0.12s), height shrinks after delay (0.14s)
const staggerVariants = {
  open: {
    transition: { staggerChildren: 0.04, delayChildren: 0.24 },
  },
  closed: {
    transition: {},
  },
}

// Layer 3 - per-item: fade + drift
const itemVariants = {
  open:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: 'easeIn'  as const } },
}

// ── Types ──────────────────────────────────────────────────────────────────────

type TriggerableIconProps = {
  animated?: boolean
  triggered?: boolean
}

export interface SidebarProjectsSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Folder label */
  label?: string
  /** Whether the list starts expanded */
  defaultOpen?: boolean
  /** Whether this project is currently active/open - shows the open icon variant without expanding the list */
  active?: boolean
  /** Indented child items - SidebarMenuItem rows or any node */
  children?: React.ReactNode
  /** Stretch to full width instead of fixed 237px - use inside Sidebar */
  fluid?: boolean
  /** Controlled expanded state - when provided, overrides internal toggle state */
  expanded?: boolean
  /** Called when the icon is clicked with the next expanded value */
  onExpandedChange?: (expanded: boolean) => void
  /**
   * Custom icon for the header row.
   * Defaults to `<FolderOneIcon size={20} />` with open/closed variant driven by state.
   * Pass `null` to render no icon at all.
   */
  icon?: React.ReactElement<TriggerableIconProps> | null
  /**
   * Optional badge rendered between the label and the expand arrow.
   * Use for status indicators (e.g. a "Shared" pill).
   */
  badge?: React.ReactNode
  /**
   * Called when the user commits a rename (Enter or blur).
   * Receives the new label. Parent should update the label prop.
   */
  onCommit?: (value: string) => void
  /**
   * Called when the user cancels a rename (Escape).
   */
  onCancel?: () => void
}

function renderMaybeTriggeredIcon(icon: React.ReactElement<TriggerableIconProps>, triggered: boolean) {
  if (icon.props.animated === true || icon.props.triggered !== undefined) {
    return React.cloneElement(icon, { triggered })
  }

  return icon
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SidebarProjectsSection({
    ref,
    label = 'Folder name', defaultOpen = false, active = false, expanded: expandedProp, onExpandedChange, fluid = false, icon, badge, children, className, onClick, onCommit, onCancel, ...props
  }: SidebarProjectsSectionProps & { ref?: React.Ref<HTMLDivElement> }) {
    // isExpanded - icon-driven; can be controlled via `expanded` prop
    // active     - row-driven; controlled by parent
    const isControlled = expandedProp !== undefined
    const [internalExpanded, setInternalExpanded] = useState(defaultOpen)
    const isExpanded = isControlled ? expandedProp! : internalExpanded
    const [isHovered, setIsHovered] = useState(false)
    const isActive = isHovered || active  // drives all visual state (hover + persistent selected)
    const [expandOverflow, setExpandOverflow] = useState<'visible' | 'hidden'>('hidden')

    // ── Inline rename state ────────────────────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(label)
    const inputRef     = useRef<HTMLInputElement>(null)
    const cancelledRef = useRef(false)
    const lastClickRef = useRef<number>(0)
    const lastEnterRef = useRef<number>(0)

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, [isEditing])

    // ── Label marquee (mirrors chat-item pattern) ──────────────────────────────
    const labelContainerRef = useRef<HTMLDivElement>(null)
    const labelRef          = useRef<HTMLParagraphElement>(null)
    const [marqueeOffset,  setMarqueeOffset]  = useState(0)
    const [isMarqueeing,   setIsMarqueeing]   = useState(false)
    const [marqueeDone,    setMarqueeDone]    = useState(false)

    useEffect(() => {
      if (isEditing) return
      const id = requestAnimationFrame(() => {
        const container = labelContainerRef.current
        const p         = labelRef.current
        if (container && p) {
          setMarqueeOffset(Math.max(0, p.scrollWidth - container.clientWidth))
        }
      })
      return () => cancelAnimationFrame(id)
    }, [isHovered, label, isEditing])

    useEffect(() => {
      if (!isHovered) {
        setIsMarqueeing(false)
        const id = setTimeout(() => setMarqueeDone(false), 300)
        return () => clearTimeout(id)
      }
      if (marqueeOffset === 0) return
      const id = setTimeout(() => setIsMarqueeing(true), 1000)
      return () => clearTimeout(id)
    }, [isHovered, marqueeOffset])

    const toggle = () => {
      const next = !isExpanded
      if (!isControlled) setInternalExpanded(next)
      onExpandedChange?.(next)
    }

    const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isEditing) return
      const now = Date.now()
      if (active && now - lastClickRef.current < 400) {
        lastClickRef.current = 0
        setEditValue(label)
        cancelledRef.current = false
        setIsEditing(true)
        return
      }
      lastClickRef.current = now
      onClick?.(e)
    }

    const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (e.key === 'Enter') {
          const now = Date.now()
          if (active && now - lastEnterRef.current < 400) {
            lastEnterRef.current = 0
            setEditValue(label)
            cancelledRef.current = false
            setIsEditing(true)
            return
          }
          lastEnterRef.current = now
        }
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
      }
    }

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: fluid ? '100%' : '237px' }}
        {...props}
      >
        {/* ── Header row - clicking opens the project; icon click toggles the list ── */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleHeaderClick}
          onKeyDown={handleHeaderKeyDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            position:        'relative',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            overflow:        'hidden',
            borderRadius:    '10px',
            width:           '100%',
            paddingLeft:     '6px',
            paddingRight:    '6px',
            paddingTop:      '5px',
            paddingBottom:   '5px',
            backgroundColor: (isEditing || isActive) ? 'var(--sidebar-menu-item-hover-bg)' : 'transparent',
            boxShadow:       isEditing
                               ? '0px 0px 0px 1px var(--focus-ring)'
                               : isActive ? SHADOW_ITEM_HOVER : undefined,
            cursor:          isEditing ? 'text' : 'pointer',
            transition:      isEditing ? undefined : 'background-color 150ms, box-shadow 150ms',
            userSelect:      'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, minWidth: 0, flex: 1 }}>
            {/* ── Folder icon - visual only ── */}
            {icon !== null && (
              <div style={{ color: 'var(--sidebar-menu-item-text)', flexShrink: 0, lineHeight: 0 }}>
                {icon
                  ? renderMaybeTriggeredIcon(icon, isHovered)
                  : <FolderOneIcon size={20} variant={(isExpanded || active) ? 'open' : 'closed'} triggered={isHovered} />}
              </div>
            )}
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    cancelledRef.current = false
                    setIsEditing(false)
                    onCommit?.(editValue || label)
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelledRef.current = true
                    setIsEditing(false)
                    onCancel?.()
                  }
                }}
                onBlur={() => {
                  if (!cancelledRef.current) {
                    setIsEditing(false)
                    onCommit?.(editValue || label)
                  }
                  cancelledRef.current = false
                }}
                style={{
                  flex:        1,
                  minWidth:    0,
                  background:  'transparent',
                  border:      'none',
                  outline:     'none',
                  fontFamily:  'var(--font-body)',
                  fontWeight:  'var(--font-weight-medium)',
                  fontSize:    'var(--font-size-body)',
                  lineHeight:  'var(--line-height-body)',
                  color:       'var(--sidebar-menu-item-text)',
                  whiteSpace:  'nowrap',
                  padding:     0,
                  cursor:      'text',
                  userSelect:  'text',
                }}
              />
            ) : (
              <div
                ref={labelContainerRef}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  flexShrink:      1,
                  minWidth:        0,
                  overflow:        'hidden',
                  maskImage:       (isActive && marqueeOffset > 0 && !isMarqueeing && !marqueeDone)
                                     ? 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)'
                                     : undefined,
                  WebkitMaskImage: (isActive && marqueeOffset > 0 && !isMarqueeing && !marqueeDone)
                                     ? 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)'
                                     : undefined,
                  paddingRight:    isMarqueeing ? '48px' : undefined,
                }}
              >
                <m.p
                  ref={labelRef}
                  style={{
                    ...bodyTextStyle,
                    overflow:     isActive ? 'visible' : 'hidden',
                    textOverflow: isActive ? 'clip'    : 'ellipsis',
                  }}
                  animate={isHovered && marqueeOffset > 0 ? { x: [0, -marqueeOffset] } : { x: 0 }}
                  transition={isHovered && marqueeOffset > 0
                    ? { duration: marqueeOffset / 40, ease: 'linear', delay: 1 }
                    : { duration: 0.3, ease: 'easeOut' }
                  }
                  onAnimationComplete={() => { setIsMarqueeing(false); setMarqueeDone(true) }}
                >
                  {label}
                </m.p>
              </div>
            )}
          </div>

          {/* ── Badge + expand / collapse arrow ── */}
          {!isEditing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {badge}
              <m.div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                onClick={(e) => { e.stopPropagation(); toggle() }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle() } }}
                animate={{ rotate: isExpanded ? 0 : -90 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  flexShrink:     0,
                  lineHeight:     0,
                  cursor:         'pointer',
                  color:          'var(--sidebar-menu-item-text)',
                  opacity:        isActive ? 0.7 : 0,
                  transition:     'opacity 150ms',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowDownOneIcon size={16} animated />
              </m.div>
            </div>
          )}

          {/* Inner depth shadow - active + hover (not shown when editing) */}
          {isActive && !isEditing && (
            <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: SHADOW_ITEM_INNER }} />
          )}
        </div>

        {/* ── Expanded children - staggered per-item fade + drift ── */}
        <AnimatePresence initial={false}>
          {isExpanded && children && (
            <m.div
              key="content"
              initial="closed"
              animate="open"
              exit="closed"
              variants={heightVariants}
              style={{ overflow: expandOverflow }}
              onAnimationStart={(def) => { if (def === 'closed') setExpandOverflow('hidden') }}
              onAnimationComplete={(def) => { if (def === 'open') setExpandOverflow('visible') }}
            >
              <m.div
                variants={staggerVariants}
                style={{ paddingLeft: icon === null ? '6px' : '28px', display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                {React.Children.map(children, (child, i) => (
                  // eslint-disable-next-line react/no-array-index-as-key -- React.Children.map order is stable; no IDs on children
                  <m.div key={i} variants={itemVariants}>
                    {child}
                  </m.div>
                ))}
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    )
}

SidebarProjectsSection.displayName = 'SidebarProjectsSection'

export default SidebarProjectsSection
