'use client'

import React from 'react'

export interface PlanGateProps {
  /**
   * When true, renders children; when false, renders fallback.
   * Compute this from useIndividualPlan() in the caller:
   *   const { canUsePersonalConnectors } = useIndividualPlan()
   *   <PlanGate allowed={canUsePersonalConnectors} fallback={<ConnectorPausedBadge />}>
   */
  allowed: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PlanGate({ allowed, children, fallback = null }: PlanGateProps) {
  return <>{allowed ? children : fallback}</>
}

PlanGate.displayName = 'PlanGate'
export default PlanGate
