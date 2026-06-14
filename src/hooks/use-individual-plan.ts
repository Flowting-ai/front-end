'use client'

import { useAuth } from '@/context/auth-context'

export type IndividualPlanTier = 'starter' | 'pro' | 'power' | 'trial' | null

export interface UseIndividualPlanResult {
  planType: IndividualPlanTier
  isStarter: boolean
  isPro: boolean
  isPower: boolean
  canUsePersonalConnectors: boolean
  canUseAnalytics: boolean
  isTeamMember: boolean
}

export function useIndividualPlan(): UseIndividualPlanResult {
  const { user } = useAuth()
  const planType = (user?.planType ?? null) as IndividualPlanTier

  return {
    planType,
    isStarter:               planType === 'starter',
    isPro:                   planType === 'pro',
    isPower:                 planType === 'power',
    canUsePersonalConnectors: planType !== 'starter' && planType !== null,
    canUseAnalytics:          planType === 'power',
    isTeamMember:            user?.orgId != null,
  }
}
