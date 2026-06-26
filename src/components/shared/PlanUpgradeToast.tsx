'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

const STORAGE_KEY = 'souvenir_plan_upgraded'

interface UpgradePayload {
  plan?:    string | null
  billed?:  boolean
  billing?: string
}

/**
 * Fires a one-time "Plan upgraded" toast after an existing user completes a
 * plan upgrade. The pricing confirmation page stashes the new plan in
 * sessionStorage and redirects into the app; this reads and clears it on mount.
 */
export function PlanUpgradeToast() {
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) sessionStorage.removeItem(STORAGE_KEY)
    } catch { /* sessionStorage unavailable */ }
    if (!raw) return

    let payload: UpgradePayload = {}
    try { payload = JSON.parse(raw) as UpgradePayload } catch { /* malformed */ }

    const { plan, billed, billing } = payload
    const description = plan
      ? `You're now on the ${plan} plan${billed && billing ? ` (${billing})` : ''}.`
      : 'Your plan has been upgraded.'

    toast.success('Plan upgraded', { description })
  }, [])

  return null
}

export default PlanUpgradeToast
