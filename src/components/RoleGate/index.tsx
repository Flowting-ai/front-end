'use client'

import React from 'react'
import { useOrg } from '@/context/org-context'
import type { OrgRole } from '@/types/teams'

export interface RoleGateProps {
  /**
   * Roles allowed to see children.
   * - 'owner'  → only the billing owner (1 per workspace)
   * - 'admin'  → owner + admin (use for all ops gates)
   * - 'member' → everyone
   */
  allow: OrgRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { orgRole } = useOrg()
  const hasAccess = allow.includes(orgRole)
  return <>{hasAccess ? children : fallback}</>
}

RoleGate.displayName = 'RoleGate'
export default RoleGate
