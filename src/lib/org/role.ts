import type { OrgRole } from '@/types/teams'

/**
 * The current user's org role as the UI should treat it. The backend's
 * `my_role` is the only source of "admin": the plan the user picked at
 * onboarding is not evidence of a role, so an unknown role is `member` with
 * `resolved: false` (UI stays neutral; the backend enforces every action).
 */
export interface ResolvedOrgRole {
  role:     OrgRole
  /** True only when the backend returned a definite role. */
  resolved: boolean
}

export function resolveOrgRole(apiRole: OrgRole | null | undefined): ResolvedOrgRole {
  return apiRole ? { role: apiRole, resolved: true } : { role: 'member', resolved: false }
}

export type AdminGate = 'loading' | 'allowed' | 'denied'

/** What an admin-only route shows: wait for the role, then admin or "no access". */
export function adminGate(orgReady: boolean, role: OrgRole | 'admin' | 'member'): AdminGate {
  if (!orgReady) return 'loading'
  return role === 'admin' ? 'allowed' : 'denied'
}
