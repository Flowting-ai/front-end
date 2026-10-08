'use client'

// ── Notifications ────────────────────────────────────────────────────────────
// Feeds the sidebar bell. There's no notifications backend, so this polls the
// sources that already exist (lib/notifications/sources.ts) while the tab is
// visible, and keeps read state per user in localStorage (read-state.ts).
//
//   • Schedule runs — every succeeded/failed run from the last 7 days,
//     bundled to one row per schedule.
//   • Agents whose model was retired or turned off — persistent until fixed.
//   • Team requests (admins only) — no backend yet; fixtures only.
//
// Anything that arrives while the app is open also gets a toast (the way
// Perplexity announces a finished scheduled task), unless the panel is open.
//
// Mounted once in the (app) layout, inside OrgProvider (role gating) and
// NavGuardProvider (toast "View" navigation).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { useGuardedRouter } from '@/context/nav-guard-context'
import { PERSONAS_LIST_UPDATED_EVENT } from '@/lib/api/persona-cache'
import {
  agentModelNotifications,
  bundleNotifications,
  finalizeNotifications,
  notificationIds,
  requestNotifications,
} from '@/lib/notifications/build'
import { readDevFixtures, useDevNotificationsVersion } from '@/lib/notifications/dev'
import {
  isNotificationUnread,
  isNotificationUnseen,
  getReadStateSnapshot,
  notificationUserKey,
  subscribeReadState,
  updateReadState as writeReadState,
  withDismissed,
  withFirstSeen,
  withoutDismissed,
  withRead,
  withSeen,
  withUnread,
  type NotificationReadState,
} from '@/lib/notifications/read-state'
import {
  fetchTeamRequests,
  loadAgentModelSnapshot,
  loadScheduleNotifications,
  type AgentModelSnapshot,
  type ScheduleCacheEntry,
} from '@/lib/notifications/sources'
import type { AppNotification, TeamRequest } from '@/lib/notifications/types'

/** How often the feed refreshes while the tab is visible. */
const POLL_MS = 60_000
/** Returning to the tab refreshes immediately if the last poll is older than this. */
const STALE_ON_FOCUS_MS = 20_000

/** Dispatch on window to open the bell's panel from anywhere (e.g. a toast). */
export const NOTIFICATIONS_OPEN_EVENT = 'notifications:open'

/** Asks the sidebar bell to open its panel. False when no bell is mounted
 *  (a page without the flat sidebar) — the caller should fall back. */
export function openNotificationsPanel(): boolean {
  if (typeof window === 'undefined') return false
  const detail = { handled: false }
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_OPEN_EVENT, { detail }))
  return detail.handled
}

export interface NotificationsContextValue {
  /** Newest first, bundled and capped; includes dev fixtures in dev builds. */
  notifications: AppNotification[]
  unreadCount:   number
  /** Unread rows that arrived since the panel was last opened — the bell's number. */
  unseenCount:   number
  /** Unread open problems (broken agents, pending requests). */
  attentionCount: number
  isUnread:      (n: AppNotification) => boolean
  /** True until the first poll has finished. */
  loading:       boolean
  markRead:      (n: AppNotification) => void
  markUnread:    (n: AppNotification) => void
  /** Marks everything read; returns an undo. */
  markAllRead:   () => () => void
  /** Removes an informational row from the panel; returns an undo. */
  dismiss:       (n: AppNotification) => () => void
  /** The panel opened (clears the bell's number) or closed. */
  setPanelOpen:  (open: boolean) => void
  refresh:       () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

/** No read state during SSR — localStorage only exists in the browser. */
const getServerReadState = (): NotificationReadState | null => null

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return ctx
}

/** Same as useNotifications, but null outside the provider. */
export function useOptionalNotifications(): NotificationsContextValue | null {
  return useContext(NotificationsContext)
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { orgId, orgRole, currentUserRole } = useOrg()
  const { push } = useGuardedRouter()
  const identity = user?.email ?? null
  const userKey = identity ? notificationUserKey(identity) : null
  const isAdmin = currentUserRole === 'admin'
  const canSeeRequests = !!orgId && orgRole === 'admin'
  const devVersion = useDevNotificationsVersion()

  const [scheduleRows, setScheduleRows] = useState<AppNotification[] | null>(null)
  const [agentSnapshot, setAgentSnapshot] = useState<AgentModelSnapshot | null>(null)
  const [requests, setRequests] = useState<TeamRequest[]>([])
  const [agentsAttempted, setAgentsAttempted] = useState(false)

  // Drop the previous user's feed the moment the signed-in user changes
  // (state adjusted during render, not in an effect — no stale frame).
  const [feedUserKey, setFeedUserKey] = useState(userKey)
  if (feedUserKey !== userKey) {
    setFeedUserKey(userKey)
    setScheduleRows(null)
    setAgentSnapshot(null)
    setAgentsAttempted(false)
    setRequests([])
  }

  const scheduleCacheRef = useRef(new Map<string, ScheduleCacheEntry>())
  const lastPollRef = useRef(0)
  const pollIdRef = useRef(0)
  const panelOpenRef = useRef(false)
  /** Every id already shown or announced; null until the first full load. */
  const knownIdsRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    scheduleCacheRef.current = new Map()
    knownIdsRef.current = null
  }, [userKey])

  // ── Read state: localStorage-backed external store, synced across tabs ────
  const subscribe = useCallback(
    (onChange: () => void) => (userKey ? subscribeReadState(userKey, onChange) : () => {}),
    [userKey],
  )
  const getSnapshot = useCallback(() => (userKey ? getReadStateSnapshot(userKey) : null), [userKey])
  const readState = useSyncExternalStore(subscribe, getSnapshot, getServerReadState)

  const updateReadState = useCallback((update: (prev: NotificationReadState) => NotificationReadState) => {
    if (userKey) writeReadState(userKey, update)
  }, [userKey])

  // ── Loaders ────────────────────────────────────────────────────────────────
  // Role flags arrive after the first render. Read them through refs so poll/loadAgents keep a
  // stable identity — otherwise the poll effect restarts and refetches schedules a second time.
  const isAdminRef = useRef(isAdmin)
  const canSeeRequestsRef = useRef(canSeeRequests)
  useEffect(() => {
    isAdminRef.current = isAdmin
    canSeeRequestsRef.current = canSeeRequests
  }, [isAdmin, canSeeRequests])

  const loadAgents = useCallback(async (pollId: number) => {
    const snapshot = await loadAgentModelSnapshot(isAdminRef.current)
    if (pollId !== pollIdRef.current) return
    // null = couldn't read this cycle: keep the last good snapshot.
    if (snapshot) setAgentSnapshot(snapshot)
    setAgentsAttempted(true)
  }, [])

  const poll = useCallback(async () => {
    if (!userKey) return
    const pollId = ++pollIdRef.current
    lastPollRef.current = Date.now()
    await Promise.all([
      loadScheduleNotifications(scheduleCacheRef.current).then(rows => {
        if (pollId !== pollIdRef.current) return
        setScheduleRows(prev => rows ?? prev ?? [])
      }),
      loadAgents(pollId),
      (canSeeRequestsRef.current ? fetchTeamRequests() : Promise.resolve<TeamRequest[]>([]))
        .then(list => { if (pollId === pollIdRef.current) setRequests(list) })
        .catch(() => {}),
    ])
  }, [userKey, loadAgents])

  // Only the role-dependent sources need a refresh once the roles resolve.
  const rolesRef = useRef({ isAdmin, canSeeRequests })
  useEffect(() => {
    const prev = rolesRef.current
    rolesRef.current = { isAdmin, canSeeRequests }
    if (!userKey || (prev.isAdmin === isAdmin && prev.canSeeRequests === canSeeRequests)) return
    const pollId = pollIdRef.current
    void loadAgents(pollId)
    if (canSeeRequests) {
      fetchTeamRequests().then(list => { if (pollId === pollIdRef.current) setRequests(list) }).catch(() => {})
    }
  }, [userKey, isAdmin, canSeeRequests, loadAgents])

  // ── Polling while visible ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userKey) return
    void poll()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void poll()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastPollRef.current > STALE_ON_FOCUS_MS) void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userKey, poll])

  // An agent was edited somewhere (model fixed, deleted, published…) or the
  // dev playground simulated an outage — re-check agents right away.
  useEffect(() => {
    if (!userKey) return
    const onPersonasChanged = () => { void loadAgents(pollIdRef.current) }
    window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, onPersonasChanged)
    return () => window.removeEventListener(PERSONAS_LIST_UPDATED_EVENT, onPersonasChanged)
  }, [userKey, loadAgents])
  useEffect(() => {
    if (userKey && devVersion > 0) void loadAgents(pollIdRef.current)
  }, [userKey, devVersion, loadAgents])

  // ── Derived feed ───────────────────────────────────────────────────────────
  const firstSeen = readState?.firstSeen
  const dismissed = readState?.dismissed
  const notifications = useMemo(() => {
    if (!userKey) return []
    const agentRows = agentSnapshot
      ? agentModelNotifications(agentSnapshot.rows, agentSnapshot.modelNames, firstSeen ?? {})
      : []
    const raw = [
      ...(scheduleRows ?? []),
      ...agentRows,
      ...requestNotifications(canSeeRequests ? requests : []),
      // Fixtures live in storage; devVersion (a dep below) bumps when they change.
      ...(devVersion >= 0 ? readDevFixtures() : []),
    ]
    // Only informational rows can be dismissed — an open problem stays until it's resolved.
    const visible = dismissed?.length ? raw.filter(n => n.actionable || !dismissed.includes(n.id)) : raw
    return finalizeNotifications(bundleNotifications(visible))
  }, [userKey, scheduleRows, agentSnapshot, firstSeen, dismissed, requests, canSeeRequests, devVersion])

  const loading = !!userKey && (scheduleRows === null || !agentsAttempted)

  // Stamp first-seen times for newly appeared problems and forget resolved
  // ones — only once agents have been read successfully, so a failed fetch
  // never wipes the read marks of agents that are still broken.
  const actionableKey = notifications.filter(n => n.actionable).map(n => n.id).join('\n')
  const hasReadState = !!readState
  const hasAgentSnapshot = !!agentSnapshot
  useEffect(() => {
    if (!hasReadState || !hasAgentSnapshot) return
    const ids = actionableKey ? actionableKey.split('\n') : []
    updateReadState(prev => withFirstSeen(prev, ids))
  }, [actionableKey, hasReadState, hasAgentSnapshot, updateReadState])

  const isUnread = useCallback(
    (n: AppNotification) => !!readState && isNotificationUnread(n, readState),
    [readState],
  )
  const unreadCount = useMemo(() => notifications.filter(isUnread).length, [notifications, isUnread])
  const unseenCount = useMemo(
    () => (readState ? notifications.filter(n => isNotificationUnseen(n, readState)).length : 0),
    [notifications, readState],
  )
  const attentionCount = useMemo(() => notifications.filter(n => n.actionable && isUnread(n)).length, [notifications, isUnread])

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = useCallback((n: AppNotification) => {
    updateReadState(prev => withRead(prev, notificationIds(n)))
  }, [updateReadState])

  const markUnread = useCallback((n: AppNotification) => {
    updateReadState(prev => withUnread(prev, notificationIds(n)))
  }, [updateReadState])

  const markAllRead = useCallback(() => {
    let snapshot: NotificationReadState | null = null
    updateReadState(prev => {
      snapshot = prev
      return withRead(prev, notifications.flatMap(notificationIds))
    })
    return () => {
      const before = snapshot
      if (before) updateReadState(prev => ({ ...prev, read: before.read, unread: before.unread }))
    }
  }, [updateReadState, notifications])

  const dismiss = useCallback((n: AppNotification) => {
    const ids = notificationIds(n)
    let wasUnread = false
    updateReadState(prev => {
      wasUnread = isNotificationUnread(n, prev)
      return withDismissed(prev, ids)
    })
    return () => updateReadState(prev => {
      const restored = withoutDismissed(prev, ids)
      return wasUnread ? withUnread(restored, ids) : restored
    })
  }, [updateReadState])

  const setPanelOpen = useCallback((open: boolean) => {
    panelOpenRef.current = open
    if (open) updateReadState(prev => withSeen(prev))
  }, [updateReadState])

  const refresh = useCallback(() => { void poll() }, [poll])

  // ── Arrival toasts ─────────────────────────────────────────────────────────
  // After the first full load, anything new and unread is announced once —
  // one toast for a single item (with a direct "View"), one summary toast for
  // several (opening the panel). Silent while the panel is already open.
  useEffect(() => {
    if (loading || !readState) return
    const allIds = notifications.flatMap(notificationIds)
    const known = knownIdsRef.current
    if (!known) { knownIdsRef.current = new Set(allIds); return }
    const fresh = notifications.filter(n => notificationIds(n).some(id => !known.has(id)) && isNotificationUnread(n, readState))
    for (const id of allIds) known.add(id)
    if (!fresh.length || panelOpenRef.current) return
    if (fresh.length === 1) {
      const n = fresh[0]!
      const show = n.kind === 'schedule-failed' ? toast.error : n.actionable ? toast.warning : toast
      show(n.title, {
        id:          `notification-${n.id}`,
        description: n.body,
        action:      { label: 'View', onClick: () => { markRead(n); push(n.href) } },
      })
    } else {
      const newest = fresh[0]!
      toast(`${fresh.length} new notifications`, {
        id:          'notifications-batch',
        description: newest.title,
        action:      { label: 'Open', onClick: () => { if (!openNotificationsPanel()) push(newest.href) } },
      })
    }
  // readState deliberately omitted: a mark-read must never re-announce.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, loading])

  const value = useMemo<NotificationsContextValue>(() => ({
    notifications, unreadCount, unseenCount, attentionCount, isUnread, loading,
    markRead, markUnread, markAllRead, dismiss, setPanelOpen, refresh,
  }), [notifications, unreadCount, unseenCount, attentionCount, isUnread, loading, markRead, markUnread, markAllRead, dismiss, setPanelOpen, refresh])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
