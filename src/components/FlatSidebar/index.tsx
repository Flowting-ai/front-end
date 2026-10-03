'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SearchOneIcon, SidebarLeftIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { cn } from '@/lib/utils'
import { SouvenirLogo } from '@/components/SouvenirLogo'

// ── FlatSidebar — Souvenir V1.5 (Figma 136:53072, "Sidebar / Container",
// layout=projects — the locked v1.5 direction). A single always-visible
// scrolling list: Destinations → Projects → Recents → spacer → Profile row.
// No body-section tab strip / state machine, unlike the old KDS `Sidebar`
// (src/components/Sidebar) — that component is left completely unchanged and
// still renders for Brain/Admin/team-settings pages (see
// docs/features/sidebar-current-state-audit.md for why).
//
// Structural behaviors below (⌘B shortcut, collapse scroll-memory, header-
// height-driven scroll fades) are ported from src/components/Sidebar/index.tsx
// verbatim rather than reinvented — they're behavior, not visual design.

function SouvenirWordmark() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <SouvenirLogo size={24} />
      <span
        style={{
          fontFamily: "var(--font-title)",
          fontSize: 24,
          fontWeight: 400,
          lineHeight: "24px",
          color: "var(--neutral-700)",
          whiteSpace: "nowrap",
        }}
      >
        Souvenir
      </span>
    </div>
  )
}

export interface FlatSidebarProps {
  onSearch?: () => void
  searchActive?: boolean
  onCollapse?: () => void
  defaultCollapsed?: boolean
  /**
   * When true, the sidebar is pinned collapsed and the toggle (both the
   * button and the ⌘B/Ctrl+B shortcut) is disabled — used by pages like
   * Agent Configure where the sidebar rail would otherwise crowd a
   * deliberately full-width editing surface.
   */
  forceCollapsed?: boolean
  /**
   * Fixed, non-scrolling block rendered directly under the header (New /
   * Agents / Schedules / Connectors / Slack) — the scrollable area starts
   * right after this, below "Souvenir in Slack" (Figma 136:53072). Receives
   * `collapsed` so rows can render icon-only, matching the old Sidebar's own
   * nav-strip-stays-fixed pattern (src/components/Sidebar/index.tsx).
   */
  destinationsItems?: (collapsed: boolean) => React.ReactNode
  projectItems?: React.ReactNode
  recentItems?: React.ReactNode
  /** Footer slot — receives `collapsed` so callers can pass it through to
   *  AccountMenu's `renderTrigger` (see FlatSidebarProfileRow). */
  accountMenu?: (collapsed: boolean) => React.ReactNode
}

export const FlatSidebar = React.forwardRef<HTMLDivElement, FlatSidebarProps>(
  function FlatSidebar(
    { onSearch, searchActive, onCollapse, defaultCollapsed = false, forceCollapsed = false, destinationsItems, projectItems, recentItems, accountMenu },
    ref,
  ) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
    const effectiveCollapsed = forceCollapsed || isCollapsed
    const [collapseHovered, setCollapseHovered] = useState(false)
    const [atScrollTop, setAtScrollTop] = useState(true)
    const [atScrollBottom, setAtScrollBottom] = useState(false)

    // Ported from src/components/Sidebar/index.tsx — measures the header so the
    // scroll body / fades anchor to its real bottom edge rather than a hand-
    // tuned pixel offset.
    const headerRef = useRef<HTMLDivElement>(null)
    const [headerH, setHeaderH] = useState(64)
    useEffect(() => {
      const el = headerRef.current
      if (!el) return
      const update = () => setHeaderH(el.offsetHeight)
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    // Ported: scroll-position memory across collapse ↔ expand.
    const bodyScrollRef = useRef<HTMLDivElement>(null)
    const savedScrollTopRef = useRef(0)
    useEffect(() => {
      const el = bodyScrollRef.current
      if (!el) return
      if (effectiveCollapsed) {
        savedScrollTopRef.current = el.scrollTop
        el.scrollTop = 0
      } else {
        const id = requestAnimationFrame(() => {
          if (bodyScrollRef.current) bodyScrollRef.current.scrollTop = savedScrollTopRef.current
        })
        return () => cancelAnimationFrame(id)
      }
    }, [effectiveCollapsed])

    const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      setAtScrollTop(el.scrollTop < 34)
      setAtScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
    }

    const handleCollapse = useCallback(() => {
      if (forceCollapsed) return
      setIsCollapsed(v => !v)
      onCollapse?.()
    }, [forceCollapsed, onCollapse])

    // Ported: ⌘B / Ctrl+B, suppressed while typing.
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === 'b') {
          e.preventDefault()
          handleCollapse()
        }
      }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [handleCollapse])

    const scrollFadeLayers = [
      { height: 40, blur: 2 },
      { height: 28, blur: 3 },
      { height: 18, blur: 5 },
      { height: 10, blur: 6 },
    ]

    return (
      <div
        ref={ref}
        role="navigation"
        aria-label="Main navigation"
        className={cn()}
        style={{
          position: 'relative', display: 'flex', flexDirection: 'column',
          width: effectiveCollapsed ? '48px' : '294px', height: '100%',
          backgroundColor: 'var(--neutral-50)', overflowX: 'hidden', flexShrink: 0, isolation: 'isolate',
          transition: 'width 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* `inset: 0` exactly reproduces the root's box so every child's
            `position: absolute` offsets (top/bottom/etc., all originally
            written against the root) still land in the same place. */}
        <div style={{ position: 'absolute', inset: 0 }}>
        {/* ── Header ── */}
        <div ref={headerRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'var(--neutral-50)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: effectiveCollapsed ? 'center' : 'space-between', padding: effectiveCollapsed ? '24px 8px 8px' : '24px 8px 8px 20px' }}>
            {!effectiveCollapsed && <SouvenirWordmark />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {!effectiveCollapsed && (
                <Tooltip content="Search" side="right" delayDuration={300}>
                  <div>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label="Search"
                      icon={<SearchOneIcon size={20} />}
                      onClick={onSearch}
                    />
                  </div>
                </Tooltip>
              )}
              <Tooltip content={forceCollapsed ? 'Sidebar locked on this page' : isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="right" delayDuration={300}>
                <div>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    disabled={forceCollapsed}
                    aria-label={forceCollapsed ? 'Sidebar locked on this page' : isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    icon={<SidebarLeftIcon size={20} variant={effectiveCollapsed ? 'open' : 'close'} triggered={collapseHovered} />}
                    onClick={handleCollapse}
                    onMouseEnter={() => setCollapseHovered(true)}
                    onMouseLeave={() => setCollapseHovered(false)}
                  />
                </div>
              </Tooltip>
            </div>
          </div>
          {effectiveCollapsed && (
            <Tooltip content="Search" side="right" delayDuration={300}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '0 8px 4px' }}>
                <IconButton variant="ghost" size="sm" aria-label="Search" icon={<SearchOneIcon size={20} />} onClick={onSearch} />
              </div>
            </Tooltip>
          )}

          {/* ── Destinations — fixed, part of the header, not the scroll area ── */}
          {destinationsItems && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: effectiveCollapsed ? 'center' : 'stretch', gap: 4, padding: effectiveCollapsed ? '0 6px 8px' : '0 8px 8px' }}>
              {destinationsItems(effectiveCollapsed)}
            </div>
          )}
        </div>

        {/* ── Scrollable body: starts right after Destinations → Projects → Recents ── */}
        <div
          ref={bodyScrollRef}
          className={effectiveCollapsed ? undefined : 'kaya-scrollbar'}
          onScroll={handleBodyScroll}
          style={{
            position: 'absolute', top: headerH, bottom: '62px', left: 0, right: 0,
            overflowY: effectiveCollapsed ? 'hidden' : 'auto', overflowX: 'hidden', overscrollBehaviorY: 'contain',
            display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 8px 20px',
          }}
        >
          <motion.div
            animate={{ opacity: effectiveCollapsed ? 0 : 1, filter: effectiveCollapsed ? 'blur(4px)' : 'blur(0px)' }}
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, pointerEvents: effectiveCollapsed ? 'none' : 'auto' }}
          >
            {projectItems && <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{projectItems}</div>}
            {recentItems && <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{recentItems}</div>}
          </motion.div>
        </div>

        {/* ── Top/bottom scroll fades ── */}
        {scrollFadeLayers.map(({ height, blur }) => (
          <div key={`top-${blur}`} aria-hidden style={{ position: 'absolute', top: headerH, left: 0, right: 0, height: `${height}px`, backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)', pointerEvents: 'none', zIndex: 5, opacity: atScrollTop ? 0 : 1, transition: 'opacity 150ms ease' }} />
        ))}
        <div aria-hidden style={{ position: 'absolute', top: headerH, left: 0, right: 0, height: '40px', background: 'linear-gradient(to bottom, var(--neutral-50) 0%, transparent 100%)', pointerEvents: 'none', zIndex: 6, opacity: atScrollTop ? 0 : 1, transition: 'opacity 150ms ease' }} />
        {scrollFadeLayers.map(({ height, blur }) => (
          <div key={`bottom-${blur}`} aria-hidden style={{ position: 'absolute', bottom: '62px', left: 0, right: 0, height: `${height}px`, backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, maskImage: 'linear-gradient(to top, black 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)', pointerEvents: 'none', zIndex: 5, opacity: atScrollBottom ? 0 : 1, transition: 'opacity 150ms ease' }} />
        ))}
        <div aria-hidden style={{ position: 'absolute', bottom: '62px', left: 0, right: 0, height: '40px', background: 'linear-gradient(to top, var(--neutral-50) 0%, transparent 100%)', pointerEvents: 'none', zIndex: 6, opacity: atScrollBottom ? 0 : 1, transition: 'opacity 150ms ease' }} />

        {/* ── Footer: Profile row ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: effectiveCollapsed ? '50%' : 0, right: effectiveCollapsed ? 'auto' : 0,
          transform: effectiveCollapsed ? 'translateX(-50%)' : undefined, width: effectiveCollapsed ? '52px' : undefined,
          zIndex: 10, backgroundColor: 'var(--neutral-50)', padding: effectiveCollapsed ? '10px 4px' : '10px', boxSizing: 'border-box',
        }}>
          {accountMenu?.(effectiveCollapsed)}
        </div>
        </div>
      </div>
    )
  },
)

FlatSidebar.displayName = 'FlatSidebar'
export default FlatSidebar
