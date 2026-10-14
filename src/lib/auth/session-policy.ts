/**
 * Idle and absolute session limits (Auth audit Phase 3.4). Pure timing rules;
 * components/auth/SessionTimeoutGuard.tsx wires them to activity and logout.
 * Off unless configured (decision D2 in fe system design/audits/decisions-for-review.md).
 */

export interface SessionLimits {
  /** Sign out after this long without activity in any tab; null = no idle limit. */
  idleMs: number | null
  /** Sign out this long after sign-in regardless of activity; null = no absolute limit. */
  maxMs: number | null
  /** Show the "session ending" prompt this long before the deadline. */
  warnMs: number
}

const minutes = (raw: string | undefined) => {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n * 60_000 : null
}

/** Limits from env; both unset means the feature is off. */
export function sessionLimitsFromEnv(env: Record<string, string | undefined> = {
  NEXT_PUBLIC_SESSION_IDLE_MINUTES: process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES,
  NEXT_PUBLIC_SESSION_MAX_HOURS: process.env.NEXT_PUBLIC_SESSION_MAX_HOURS,
  NEXT_PUBLIC_SESSION_WARN_MINUTES: process.env.NEXT_PUBLIC_SESSION_WARN_MINUTES,
}): SessionLimits | null {
  const idleMs = minutes(env.NEXT_PUBLIC_SESSION_IDLE_MINUTES)
  const maxHours = Number(env.NEXT_PUBLIC_SESSION_MAX_HOURS)
  const maxMs = Number.isFinite(maxHours) && maxHours > 0 ? maxHours * 3_600_000 : null
  if (idleMs === null && maxMs === null) return null
  return { idleMs, maxMs, warnMs: minutes(env.NEXT_PUBLIC_SESSION_WARN_MINUTES) ?? 2 * 60_000 }
}

export type SessionEndReason = 'idle' | 'max'

/** When the session ends and why, given the last activity and the sign-in time. */
export function sessionDeadline(
  limits: SessionLimits,
  lastActivityAt: number,
  signedInAt: number,
): { at: number; reason: SessionEndReason } | null {
  const idleAt = limits.idleMs !== null ? lastActivityAt + limits.idleMs : Infinity
  const maxAt = limits.maxMs !== null ? signedInAt + limits.maxMs : Infinity
  if (idleAt === Infinity && maxAt === Infinity) return null
  return idleAt <= maxAt ? { at: idleAt, reason: 'idle' } : { at: maxAt, reason: 'max' }
}

export type SessionPhase = 'active' | 'warning' | 'expired'

export function sessionPhase(now: number, deadlineAt: number, warnMs: number): SessionPhase {
  if (now >= deadlineAt) return 'expired'
  if (now >= deadlineAt - warnMs) return 'warning'
  return 'active'
}

/** Milliseconds until the phase can next change (for one timer instead of polling). */
export function msUntilNextPhase(now: number, deadlineAt: number, warnMs: number): number {
  const warnAt = deadlineAt - warnMs
  return Math.max(0, (now < warnAt ? warnAt : deadlineAt) - now)
}
