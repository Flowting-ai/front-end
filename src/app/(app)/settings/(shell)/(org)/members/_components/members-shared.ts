'use client'

import type { OrgMember, WorkspaceRole } from '@/types/teams'

// Shared by the Members page parts: card shadows and how a member's role is shown.

// ── Shadows ───────────────────────────────────────────────────────────────────
export const SHADOW_CARD      = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'
export const SHADOW_STAT_CARD = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'

// Team has no backend route left at all, so a member's role is always just
// the org-level admin/member value — never a team-derived 'editor'. A
// 'service' row (machine principal) also displays as plain Member. 'owner'
// folds into 'admin' — same fold the backend applies to the viewer's own
// role; there's no separate Owner tier in the UI.
export function displayRoleFor(member: OrgMember): WorkspaceRole {
  return (member.orgRole === 'admin' || member.orgRole === 'owner') ? 'admin' : 'member'
}
