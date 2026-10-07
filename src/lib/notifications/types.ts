// ── Notification model ───────────────────────────────────────────────────────
// There is no notifications backend yet: the sidebar bell aggregates these on
// the client from endpoints that already exist (schedule runs, the model
// catalog + the viewer's agents). Read/unread state is per browser, per user
// (see read-state.ts). Team requests have a typed slot here but no backend
// source to fill it until one exists (see sources.ts → fetchTeamRequests).

export type NotificationKind =
  | 'schedule-succeeded'
  | 'schedule-failed'
  | 'agent-model'
  | 'request-connector'
  | 'request-credits'
  | 'request-permission'

export interface AppNotification {
  /** Stable across polls — read state is keyed by it. */
  id:         string
  kind:       NotificationKind
  title:      string
  /** One or two plain-text lines under the title. */
  body?:      string
  /** ISO timestamp of the event (run finished, request made, problem first seen). */
  at:         string
  /** Where clicking it goes. */
  href:       string
  /**
   * True while the underlying problem is still open (a broken agent, a
   * pending request). Actionable items sit under "Needs attention", count as
   * unread until opened, and disappear on their own once resolved.
   */
  actionable: boolean
  /** Set on playground fixtures so the panel can label them in dev. */
  dev?:       boolean
  /**
   * Set on a bundled row (several runs of one schedule collapsed into its
   * latest — see bundleNotifications): every underlying id, newest first.
   * Read / unread / dismiss act on all of them together.
   */
  memberIds?: string[]
  /** Bundle meta line, e.g. "4 runs this week · 1 failed". */
  summary?:   string
  /** The agent a row is about — its own avatar tile replaces the type icon. */
  agent?:     { id: string; name: string }
}

/** A team member asking an admin for something. Shape the eventual backend
 *  list endpoint should return; only the dev fixtures produce these today. */
export type TeamRequestType = 'connector' | 'credits' | 'permission'

export interface TeamRequest {
  id:            string
  type:          TeamRequestType
  requesterName: string
  /** What was asked for: a connector name, a credit amount, a role/permission. */
  subject:       string
  reason?:       string | null
  createdAt:     string
}
