'use client'

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import Archive02Icon from '@hugeicons/core-free-icons/Archive02Icon'
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon'
import MailOpen01Icon from '@hugeicons/core-free-icons/MailOpen01Icon'
import {
  AlertCircleIcon,
  AlertTwoIcon,
  CalendarThreeIcon,
  LinkSixIcon,
  TokenCircleIcon,
  UserAddOneIcon,
  UserAiIcon,
} from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import Tabs from '@/components/Tabs'
import { BellRingIcon } from '@/components/BellRingIcon'
import { AgentHero } from '@/components/PersonaCard/AgentHero'
import { formatRelativeTime, parseServerDate } from '@/lib/utils/format-utils'
import type { AppNotification, NotificationKind } from '@/lib/notifications/types'

// ── NotificationPanel ────────────────────────────────────────────────────────
// The bell's flyout. Presentational only — the sidebar bell feeds it from
// NotificationsProvider, the dev playground from fixtures. Built on the KDS
// Dropdown/Popover shell (surface, radius, scroll-edge fade) and its keyboard
// model: rows are role="menuitem", so Dropdown.Float's ↑/↓/Home/End reach them.
//
// Patterns borrowed from the inboxes people already know:
//   • All / Unread tabs (Linear's Inbox, GitHub, Slack Activity). Rows read
//     while on Unread stay put until the tab changes — no list jumping.
//   • Open problems ("Needs attention") above informational rows, which are
//     grouped Today / Yesterday / Earlier this week.
//   • Runs of one schedule bundled into one row (see bundleNotifications).
//   • Hover / keyboard actions on a row: mark read/unread (U), dismiss (⌫) —
//     Linear's shortcuts. Open problems can't be dismissed, only resolved.
//   • An inline primary action on open problems ("Change model", "Review").
//   • A real empty state for each tab, and skeletons on first load.

export const NOTIFICATION_PANEL_WIDTH = 380

type PanelTab = 'all' | 'unread'

export interface NotificationPanelProps {
  notifications: AppNotification[]
  isUnread:      (n: AppNotification) => boolean
  unreadCount:   number
  loading?:      boolean
  /** Row (or its inline action) chosen — mark read + navigate. */
  onSelect:      (n: AppNotification) => void
  onMarkRead?:   (n: AppNotification) => void
  onMarkUnread?: (n: AppNotification) => void
  /** Informational rows only. */
  onDismiss?:    (n: AppNotification) => void
  onMarkAllRead?: () => void
  /** Footer link to notification preferences. Omitted → no link. */
  onOpenSettings?: () => void
  /** Point out one row (scroll + soft flash) — e.g. the one Undo just restored. Bump `key` to repeat. */
  highlight?: { id: string; key: number } | null
  /** Overrides the panel's height cap (any CSS length). */
  maxHeight?: number | string
}

interface KindStyle {
  icon:    React.ReactElement
  color:   'Green' | 'Red' | 'Yellow' | 'Blue' | 'Purple' | 'Brown'
  label:   string
  /** Inline primary action on actionable rows. */
  action?: string
}

const KIND_STYLE: Record<NotificationKind, KindStyle> = {
  'schedule-succeeded': { icon: <CalendarThreeIcon size={16} />, color: 'Green',  label: 'Schedule' },
  'schedule-failed':    { icon: <AlertCircleIcon size={16} />,   color: 'Red',    label: 'Schedule failed' },
  'agent-model':        { icon: <UserAiIcon size={16} />,        color: 'Yellow', label: 'Agent',             action: 'Change model' },
  'request-connector':  { icon: <LinkSixIcon size={16} />,       color: 'Blue',   label: 'Connector request', action: 'Review request' },
  'request-credits':    { icon: <TokenCircleIcon size={16} />,   color: 'Purple', label: 'Credits request',   action: 'Review request' },
  'request-permission': { icon: <UserAddOneIcon size={16} />,    color: 'Brown',  label: 'Access request',    action: 'Review request' },
}

const clamp = (lines: number): React.CSSProperties => ({
  display:         '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow:        'hidden',
  overflowWrap:    'anywhere',
})

const captionText: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
}

// ── Date grouping ─────────────────────────────────────────────────────────────

function dayGroup(iso: string, now: Date): string {
  const d = parseServerDate(iso)
  if (!d) return 'Earlier'
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = d.getTime()
  if (t >= startOfToday) return 'Today'
  if (t >= startOfToday - 86_400_000) return 'Yesterday'
  return 'Earlier this week'
}

const DAY_ORDER = ['Today', 'Yesterday', 'Earlier this week', 'Earlier']

/** One section per day bucket, in day order, each newest first — whatever
 *  order the caller passed (the playground hands in unsorted fixtures). */
function groupByDay(list: AppNotification[]): Array<{ label: string; items: AppNotification[] }> {
  const now = new Date()
  const byLabel = new Map<string, AppNotification[]>()
  for (const n of list) {
    const label = dayGroup(n.at, now)
    byLabel.set(label, [...(byLabel.get(label) ?? []), n])
  }
  const time = (n: AppNotification) => parseServerDate(n.at)?.getTime() ?? 0
  return DAY_ORDER.filter(label => byLabel.has(label)).map(label => ({
    label,
    items: byLabel.get(label)!.sort((a, b) => time(b) - time(a)),
  }))
}

// ── Leading tile ──────────────────────────────────────────────────────────────

const TILE = 32
const TILE_RADIUS = 8

/**
 * An agent row leads with the agent's own avatar tile — the same AgentHero the
 * agents panel's CompactAgentCard uses — so it reads as *that* agent at a
 * glance. Still and grey, matching the faded card of an agent whose model
 * can't run, with a small amber warning badge so it still reads as
 * "needs attention".
 */
function AgentTile({ agent }: { agent: { id: string; name: string } }) {
  return (
    <span aria-hidden style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <span style={{ display: 'inline-flex', filter: 'grayscale(1)' }}>
        <AgentHero
          name={agent.name}
          agentId={agent.id}
          height={TILE}
          width={TILE}
          avatarSize={24}
          radius={TILE_RADIUS}
          rounded
          inert
          opacity={0.7}
        />
      </span>
      <span
        style={{
          position: 'absolute', right: -4, bottom: -4, width: 16, height: 16, borderRadius: 9999,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'var(--color-tag-Yellow-bg)', color: 'var(--color-tag-Yellow-text)',
          boxShadow: '0 0 0 2px var(--popover-bg)',
        }}
      >
        <AlertTwoIcon size={10} />
      </span>
    </span>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps {
  notification: AppNotification
  unread:       boolean
  onSelect:     (n: AppNotification) => void
  onMarkRead?:  (n: AppNotification) => void
  onMarkUnread?: (n: AppNotification) => void
  onDismiss?:   (n: AppNotification) => void
  /** Changes each time this row should be pointed out (e.g. restored by Undo). */
  highlightKey?: number
}

function NotificationRow({ notification: n, unread, onSelect, onMarkRead, onMarkUnread, onDismiss, highlightKey }: RowProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  // Bring a restored row into view once the panel has laid out.
  useEffect(() => {
    if (highlightKey === undefined) return
    const id = requestAnimationFrame(() => rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    return () => cancelAnimationFrame(id)
  }, [highlightKey])
  const kind = KIND_STYLE[n.kind]
  const when = formatRelativeTime(n.at)
  const canDismiss = !n.actionable && !!onDismiss
  const toggleRead = unread ? onMarkRead : onMarkUnread
  const showActions = (hovered || focused) && (!!toggleRead || canDismiss)

  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }

  return (
    <div
      ref={rowRef}
      role="menuitem"
      tabIndex={0}
      className="kaya-dropdown-item"
      aria-label={`${unread ? 'Unread. ' : ''}${n.title}${n.body ? `. ${n.body}` : ''}`}
      onClick={() => onSelect(n)}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n); return }
        if (e.metaKey || e.ctrlKey || e.altKey) return
        if ((e.key === 'u' || e.key === 'U') && toggleRead) { e.preventDefault(); toggleRead(n); return }
        if ((e.key === 'Backspace' || e.key === 'Delete') && canDismiss) { e.preventDefault(); onDismiss!(n) }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Keyboard focus only: the panel auto-focuses its first row on open,
      // and that row shouldn't greet a mouse user with its action pill.
      onFocus={e => { if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) setFocused(true) }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false) }}
      style={{
        position:        'relative',
        display:         'flex',
        alignItems:      'flex-start',
        gap:             10,
        width:           '100%',
        boxSizing:       'border-box',
        padding:         '8px 26px 8px 8px',
        borderRadius:    8,
        cursor:          'pointer',
        userSelect:      'none',
        backgroundColor: hovered ? 'var(--dropdown-menu-item-hover-bg)' : 'transparent',
        boxShadow:       hovered ? 'var(--shadow-dropdown-item-hover)' : undefined,
        transition:      'background-color 150ms, box-shadow 150ms',
        // Own stacking context so the highlight wash can sit behind the content.
        isolation:       'isolate',
      }}
    >
      {highlightKey !== undefined && (
        // A soft blue wash that fades out — "here's the one you brought back".
        <m.span
          key={highlightKey}
          aria-hidden
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.4, delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
          style={{ position: 'absolute', inset: 0, borderRadius: 8, zIndex: -1, pointerEvents: 'none', backgroundColor: 'var(--color-tag-Blue-bg)' }}
        />
      )}
      {n.agent ? (
        <AgentTile agent={n.agent} />
      ) : (
        <span
          aria-hidden
          style={{
            width: TILE, height: TILE, flexShrink: 0, borderRadius: TILE_RADIUS,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: `var(--color-tag-${kind.color}-bg)`,
            color:           `var(--color-tag-${kind.color}-text)`,
          }}
        >
          {kind.icon}
        </span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 0', minWidth: 0 }}>
        <p
          style={{
            margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)',
            fontWeight: unread ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)',
            color: unread ? 'var(--dropdown-menu-item-text)' : 'var(--dropdown-menu-item-sublabel)',
            transition: 'color 200ms ease, font-weight 200ms ease', ...clamp(2),
          }}
        >
          {n.title}
        </p>
        {n.body && (
          <p style={{ margin: 0, ...captionText, color: 'var(--dropdown-menu-item-sublabel)', ...clamp(2) }}>
            {n.body}
          </p>
        )}
        <p
          style={{
            margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
            ...captionText, color: 'var(--dropdown-menu-item-muted)', whiteSpace: 'nowrap',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.summary ?? kind.label}</span>
          {when && <><span aria-hidden>·</span><time dateTime={n.at}>{when}</time></>}
          {n.dev && <><span aria-hidden>·</span><span style={{ color: 'var(--color-tag-Purple-text)' }}>Fixture</span></>}
        </p>
        {n.actionable && kind.action && (
          <div style={{ marginTop: 6 }}>
            <Button variant="outline" size="sm" tabIndex={-1} onClick={stop(() => onSelect(n))}>
              {kind.action}
            </Button>
          </div>
        )}
      </div>

      {/* Unread dot ↔ action pill share the top-right corner: the dot shrinks
          away as the pill springs in, so the corner never holds both. */}
      <AnimatePresence initial={false}>
        {unread && !showActions && (
          <m.span
            key="dot"
            aria-hidden
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={DOT_SPRING}
            style={{ position: 'absolute', top: 14, right: 10, width: 8, height: 8, borderRadius: 9999, backgroundColor: 'var(--blue-500)' }}
          />
        )}
        {showActions && (
          // Hover/focus action pill (Gmail / Linear inbox style): open-envelope
          // = mark read, closed envelope = mark unread, archive = dismiss.
          // Out of the tab order — the row's own U / ⌫ keys do the same.
          <m.div
            key="actions"
            role="group"
            aria-label="Notification actions"
            initial={{ opacity: 0, scale: 0.92, x: 6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96, x: 4, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
            transition={PILL_SPRING}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 6, right: 6, zIndex: 1, transformOrigin: 'right center',
              display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8,
              backgroundColor: 'var(--popover-bg)',
              boxShadow: '0px 2px 6px -2px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
            }}
          >
            {toggleRead && (
              <RowAction
                label={unread ? 'Mark as read' : 'Mark as unread'}
                shortcut="U"
                icon={unread ? MailOpen01Icon : Mail01Icon}
                onClick={() => toggleRead(n)}
              />
            )}
            {canDismiss && (
              <RowAction label="Dismiss" shortcut="⌫" icon={Archive02Icon} onClick={() => onDismiss!(n)} />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const DOT_SPRING  = { type: 'spring' as const, stiffness: 600, damping: 30 }
const PILL_SPRING = { type: 'spring' as const, stiffness: 520, damping: 32, mass: 0.7 }

function RowAction({ label, shortcut, icon, onClick }: {
  label:    string
  shortcut: string
  icon:     IconSvgElement
  onClick:  () => void
}) {
  return (
    <Tooltip
      side="top"
      delayDuration={350}
      content={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{label}<span style={{ opacity: 0.6 }}>{shortcut}</span></span>}
    >
      <div style={{ display: 'inline-flex' }}>
        <IconButton
          variant="ghost"
          size="xs"
          tabIndex={-1}
          aria-label={label}
          icon={<HugeiconsIcon icon={icon} size={16} color="currentColor" strokeWidth={1.5} />}
          onClick={e => { e.stopPropagation(); onClick() }}
        />
      </div>
    </Tooltip>
  )
}

// ── States ────────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 8 }}>
      <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
        <div className="kaya-skeleton" style={{ height: 12, width: '70%', borderRadius: 4 }} />
        <div className="kaya-skeleton" style={{ height: 10, width: '92%', borderRadius: 4 }} />
        <div className="kaya-skeleton" style={{ height: 10, width: '30%', borderRadius: 4 }} />
      </div>
    </div>
  )
}

function EmptyState({ tab }: { tab: PanelTab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 28px 36px', textAlign: 'center' }}>
      <span
        aria-hidden
        style={{
          width: 40, height: 40, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-400)',
        }}
      >
        <BellRingIcon size={20} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: 16, lineHeight: '22px', color: 'var(--neutral-700)' }}>
          {tab === 'unread' ? 'Nothing unread' : 'You’re all caught up'}
        </p>
        <p style={{ margin: 0, ...captionText, color: 'var(--neutral-500)' }}>
          {tab === 'unread'
            ? 'New notifications will show up here until you open them.'
            : 'Finished schedules, team requests and agents that need attention will show up here.'}
        </p>
      </div>
    </div>
  )
}

function Header({ titleId, tab, onTabChange, unreadCount, onMarkAllRead }: {
  titleId:        string
  tab:            PanelTab
  onTabChange:    (tab: PanelTab) => void
  unreadCount:    number
  onMarkAllRead?: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 12px 10px 16px', borderBottom: '1px solid var(--neutral-100)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 }}>
        <p
          id={titleId}
          style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: 16, lineHeight: '22px', color: 'var(--dropdown-menu-item-text)' }}
        >
          Notifications
        </p>
        {onMarkAllRead && unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="kaya-dropdown-item"
            style={{
              border: 'none', background: 'none', padding: '2px 6px', margin: 0, borderRadius: 6, cursor: 'pointer',
              ...captionText, color: 'var(--dropdown-menu-item-muted)', whiteSpace: 'nowrap',
            }}
          >
            Mark all as read
          </button>
        )}
      </div>
      <Tabs value={tab} onValueChange={v => onTabChange(v as PanelTab)}>
        <Tabs.List size="small">
          <Tabs.Trigger value="all">All</Tabs.Trigger>
          <Tabs.Trigger value="unread">{unreadCount > 0 ? `Unread · ${unreadCount > 99 ? '99+' : unreadCount}` : 'Unread'}</Tabs.Trigger>
        </Tabs.List>
      </Tabs>
    </div>
  )
}

function Footer({ onOpenSettings }: { onOpenSettings?: () => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '8px 12px 10px 16px', borderTop: '1px solid var(--neutral-100)',
      }}
    >
      <span style={{ ...captionText, color: 'var(--dropdown-menu-item-muted)', whiteSpace: 'nowrap' }}>
        <Kbd>↑</Kbd><Kbd>↓</Kbd> move · <Kbd>U</Kbd> read · <Kbd>⌫</Kbd> dismiss
      </span>
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="kaya-dropdown-item"
          style={{
            border: 'none', background: 'none', padding: '2px 6px', margin: 0, borderRadius: 6, cursor: 'pointer',
            ...captionText, color: 'var(--dropdown-menu-item-muted)', whiteSpace: 'nowrap',
          }}
        >
          Settings
        </button>
      )}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 3px',
        marginRight: 2, borderRadius: 4, boxSizing: 'border-box',
        backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-600)',
        fontFamily: 'var(--font-body)', fontSize: 10, lineHeight: '16px',
      }}
    >
      {children}
    </kbd>
  )
}

// ── Tab transition ────────────────────────────────────────────────────────────

const EASE_OUT = [0.16, 1, 0.3, 1] as const
const EASE_IN  = [0.4, 0, 1, 1] as const

/** `custom` = direction of travel (+1 toward Unread, -1 toward All). */
const TAB_SWAP = {
  enter:  (dir: number) => ({ opacity: 0, x: dir * 18, filter: 'blur(3px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.32, ease: EASE_OUT } },
  exit:   (dir: number) => ({ opacity: 0, x: dir * -18, filter: 'blur(3px)', transition: { duration: 0.16, ease: EASE_IN } }),
}

/** Animates its own height to whatever its content measures, so the panel
 *  glides between list lengths (tab switch, dismiss, undo) instead of snapping. */
function AutoHeight({ children }: { children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  const reduceMotion = useReducedMotion()

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <m.div
      initial={false}
      animate={{ height }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: EASE_OUT }}
      style={{ overflow: 'hidden' }}
    >
      <div ref={innerRef} style={{ position: 'relative' }}>{children}</div>
    </m.div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function NotificationPanel({
  notifications,
  isUnread,
  unreadCount,
  loading = false,
  onSelect,
  onMarkRead,
  onMarkUnread,
  onDismiss,
  onMarkAllRead,
  onOpenSettings,
  highlight,
  maxHeight = 'min(480px, calc(100dvh - 200px))',
}: NotificationPanelProps) {
  const titleId = useId()
  const [tab, setTab] = useState<PanelTab>('all')
  // +1 = moving right (All → Unread), -1 = moving left; drives the slide direction.
  const tabDirection = tab === 'unread' ? 1 : -1
  const reduceMotion = useReducedMotion()
  // Ids that were unread when the Unread tab was opened — reading one there
  // dims it in place instead of yanking it out from under the pointer.
  const [unreadSnapshot, setUnreadSnapshot] = useState<Set<string>>(() => new Set())

  // Anchor inside the scroll area — a tab switch glides the list back to the
  // top so the new tab always starts at its first row.
  const listTopRef = useRef<HTMLDivElement>(null)
  const changeTab = (next: PanelTab) => {
    if (next === tab) return
    if (next === 'unread') setUnreadSnapshot(new Set(notifications.filter(isUnread).map(n => n.id)))
    setTab(next)
    listTopRef.current?.closest('.kaya-scrollbar')?.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  const visible = useMemo(
    () => (tab === 'unread' ? notifications.filter(n => isUnread(n) || unreadSnapshot.has(n.id)) : notifications),
    [tab, notifications, isUnread, unreadSnapshot],
  )
  const attention = visible.filter(n => n.actionable)
  const recentGroups = groupByDay(visible.filter(n => !n.actionable))
  const showSkeleton = loading && notifications.length === 0

  // Rows that arrive while the panel is open slide in; dismissed rows fold
  // away (height + fade) instead of vanishing, so the list never jumps.
  const rows = (list: AppNotification[]) => (
    <AnimatePresence initial={false}>
      {list.map(n => (
        <m.div
          key={n.id}
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, transition: { height: { duration: 0.22, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.12 } } }}
          transition={{ height: { duration: 0.24, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.2 }, y: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } }}
        >
          <NotificationRow
            notification={n}
            unread={isUnread(n)}
            onSelect={onSelect}
            onMarkRead={onMarkRead}
            onMarkUnread={onMarkUnread}
            onDismiss={onDismiss}
            highlightKey={highlight?.id === n.id ? highlight.key : undefined}
          />
        </m.div>
      ))}
    </AnimatePresence>
  )

  return (
    <Dropdown
      maxHeight={false}
      style={{ width: NOTIFICATION_PANEL_WIDTH, maxWidth: 'calc(100vw - 24px)' }}
      aria-labelledby={titleId}
    >
      <Header titleId={titleId} tab={tab} onTabChange={changeTab} unreadCount={unreadCount} onMarkAllRead={onMarkAllRead} />
      {/* Inner shell = the KDS scroll area (height cap + scroll-edge fades) between
          the fixed header and footer; its own surface styling is neutralised. */}
      <Dropdown maxHeight={maxHeight} style={{ boxShadow: 'none', borderRadius: 0, backgroundColor: 'transparent' }}>
        <div ref={listTopRef} aria-hidden style={{ height: 0 }} />
        <AutoHeight>
          {/* Tab switch: the outgoing list drifts toward the tab you left and
              fades under a soft blur while the incoming one settles in from
              the other side — popLayout lets them cross over, and AutoHeight
              glides the panel to the new length instead of snapping. */}
          <AnimatePresence initial={false} mode="popLayout" custom={tabDirection}>
            <m.div
              key={tab}
              custom={tabDirection}
              variants={reduceMotion ? undefined : TAB_SWAP}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ width: '100%' }}
            >
              {showSkeleton ? (
                <div style={{ padding: 8 }}>{[0, 1, 2].map(i => <RowSkeleton key={i} />)}</div>
              ) : visible.length === 0 ? (
                <EmptyState tab={tab} />
              ) : (
                <>
                  {attention.length > 0 && (
                    <Dropdown.Section label="Needs attention" fluid>
                      {rows(attention)}
                    </Dropdown.Section>
                  )}
                  {recentGroups.map((group, i) => (
                    <Dropdown.Section key={group.label} label={group.label} divider={i > 0 || attention.length > 0} fluid>
                      {rows(group.items)}
                    </Dropdown.Section>
                  ))}
                </>
              )}
            </m.div>
          </AnimatePresence>
        </AutoHeight>
      </Dropdown>
      <Footer onOpenSettings={onOpenSettings} />
    </Dropdown>
  )
}

export default NotificationPanel
