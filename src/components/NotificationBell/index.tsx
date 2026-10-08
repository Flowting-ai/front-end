'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useAnimate, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { Dropdown } from '@/components/Dropdown'
import { IconButton } from '@/components/IconButton'
import { BellRingIcon } from '@/components/BellRingIcon'
import { NotificationPanel } from '@/components/NotificationPanel'
import { useOptionalNotifications } from '@/context/notifications-context'
import { useGuardedRouter } from '@/context/nav-guard-context'
import type { AppNotification } from '@/lib/notifications/types'

// ── NotificationBell ─────────────────────────────────────────────────────────
// The bell in the sidebar's profile row (right of the settings icon), or
// stacked above the avatar on the collapsed rail. Opens NotificationPanel as a
// flyout just past the sidebar's right edge, bottom-aligned with the bell, so
// it never covers the sidebar itself. Controlled so the sidebar can keep it
// and the account menu from being open at the same time.
//
// Badge: the number of unread notifications — the same figure as the panel's
// "Unread · N" — so it stays until they're opened or marked read, and open
// problems (a broken agent, a pending request) keep it lit until handled.
// Separately, the bell rings + the badge pops only when something NEW arrives
// (the unseen count rises), never just for what's already there.
//
// It lives inside the profile row, which is itself the AccountMenu trigger.
// React events from the portaled panel still bubble through the React tree
// into that row, so the wrapper below stops clicks and Enter/Space (the keys
// the row reacts to) — otherwise picking a notification would also toggle the
// account menu. Escape/arrow keys are left alone: Dropdown.Float handles
// those on `document`, which a stopped native event would never reach.

const NOTIFICATIONS_SETTINGS_ROUTE = '/settings/notifications'
const BADGE_SPRING = { type: 'spring' as const, stiffness: 600, damping: 26 }

export interface NotificationBellProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationBell({ open, onOpenChange }: NotificationBellProps) {
  const feed = useOptionalNotifications()
  const { push } = useGuardedRouter()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)
  // Gap from the bell's right edge to the panel: reaches past the sidebar's
  // edge (re-measured each open, so it follows collapse/expand) plus KDS 8 px.
  const [offset, setOffset] = useState(8)
  // The row Undo just restored, pointed out when the panel reopens.
  const [highlight, setHighlight] = useState<{ id: string; key: number } | null>(null)
  const setPanelOpen = feed?.setPanelOpen

  // Ring the bell whenever the unseen count goes UP after the feed has loaded
  // (a run just finished, an agent just broke) — not on the first load, not
  // when it drops, and not while the panel is open (the row slides in there).
  // Derived during render from the previous value, no effect needed.
  const unseen = feed?.unseenCount ?? 0
  const ready = !!feed && !feed.loading
  const [prevUnseen, setPrevUnseen] = useState({ count: unseen, ready })
  const [ringKey, setRingKey] = useState(0)
  if (prevUnseen.count !== unseen || prevUnseen.ready !== ready) {
    if (ready && prevUnseen.ready && unseen > prevUnseen.count && !open) setRingKey(k => k + 1)
    setPrevUnseen({ count: unseen, ready })
  }

  // The badge pops in time with the bell's first strike.
  const reduceMotion = useReducedMotion()
  const [badgeScope, animateBadge] = useAnimate<HTMLSpanElement>()
  useEffect(() => {
    if (!ringKey || reduceMotion || !badgeScope.current) return
    void animateBadge(badgeScope.current, { scale: [1, 1.35, 0.92, 1] }, { duration: 0.5, ease: 'easeOut' })
  }, [ringKey, reduceMotion, animateBadge, badgeScope])

  // Layout effect, not the click handler: the panel can also be opened from
  // outside (the "N new notifications" toast). Runs before paint, and
  // Dropdown.Float re-anchors when `offset` changes, so there's no jump.
  useLayoutEffect(() => {
    setPanelOpen?.(open)
    if (!open) return
    const bell = wrapRef.current?.getBoundingClientRect()
    const sidebar = wrapRef.current?.closest('[role="navigation"]')?.getBoundingClientRect()
    setOffset(bell && sidebar ? Math.max(8, Math.round(sidebar.right - bell.right) + 8) : 8)
  }, [open, setPanelOpen])

  if (!feed) return null
  const {
    notifications, unreadCount, isUnread, loading,
    markRead, markUnread, markAllRead, dismiss, refresh,
  } = feed

  const handleOpenChange = (next: boolean) => {
    if (next) refresh()
    onOpenChange(next)
  }

  const handleSelect = (n: AppNotification) => {
    markRead(n)
    onOpenChange(false)
    push(n.href)
  }

  // Undo brings the panel back up (clicking the toast closed it), so the
  // user sees what they restored — a dismissed row is scrolled to and
  // flashed, since that's the one they're likely looking for.
  const handleMarkAllRead = () => {
    const undo = markAllRead()
    toast('Marked all as read', {
      id:     'notifications-mark-all',
      action: { label: 'Undo', onClick: () => { undo(); onOpenChange(true) } },
    })
  }

  const handleDismiss = (n: AppNotification) => {
    const undo = dismiss(n)
    toast('Notification dismissed', {
      id:     `notification-dismiss-${n.id}`,
      action: {
        label:   'Undo',
        onClick: () => {
          undo()
          const key = Date.now()
          setHighlight({ id: n.id, key })
          onOpenChange(true)
          // Clear once the flash has played, so a later reopen doesn't replay it.
          window.setTimeout(() => setHighlight(prev => (prev?.key === key ? null : prev)), 2200)
        },
      },
    })
  }

  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount)
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'

  return (
    <span
      ref={wrapRef}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
    >
      <Dropdown.Float
        open={open}
        onOpenChange={handleOpenChange}
        placement="right-end"
        offset={offset}
        trigger={
          <IconButton
            variant="ghost"
            size="xs"
            aria-label={label}
            title="Notifications"
            icon={
              <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Same ink as the settings glyph beside it, not the generic ghost-button icon colour. */}
                <BellRingIcon size={16} color="var(--sidebar-icon, var(--sidebar-menu-item-text))" triggered={hovered || open} ringKey={ringKey} />
              </span>
            }
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          />
        }
      >
        <NotificationPanel
          notifications={notifications}
          isUnread={isUnread}
          unreadCount={unreadCount}
          loading={loading}
          onSelect={handleSelect}
          onMarkRead={markRead}
          onMarkUnread={markUnread}
          onDismiss={handleDismiss}
          onMarkAllRead={handleMarkAllRead}
          onOpenSettings={() => { onOpenChange(false); push(NOTIFICATIONS_SETTINGS_ROUTE) }}
          highlight={highlight}
        />
      </Dropdown.Float>

      {/* Outside the IconButton — its squircle clip would cut it off.
          One number: everything unread (the panel's "Unread · N"). It springs
          in, its digit rolls on change, and it pops with each ring. */}
      <AnimatePresence initial={false}>
        {unreadCount > 0 && (
          // Outer: enter/exit. Inner: the visual, popped imperatively on each
          // ring so the two never fight over the same transform.
          <m.span
            key="count"
            aria-hidden
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.14 } }}
            transition={BADGE_SPRING}
            style={{ position: 'absolute', top: -3, right: -4, display: 'inline-flex', pointerEvents: 'none' }}
          >
            <span
              ref={badgeScope}
              style={{
                minWidth: 14, height: 14, padding: '0 3px', boxSizing: 'border-box',
                borderRadius: 9999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                backgroundColor: 'var(--red-500)', color: 'var(--static-white)',
                boxShadow: '0 0 0 2px var(--neutral-50)',
                fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 9, lineHeight: '14px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <AnimatePresence initial={false} mode="popLayout">
                <m.span
                  key={badgeText}
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  transition={BADGE_SPRING}
                  style={{ display: 'inline-block' }}
                >
                  {badgeText}
                </m.span>
              </AnimatePresence>
            </span>
          </m.span>
        )}
      </AnimatePresence>
    </span>
  )
}

export default NotificationBell
