'use client'

// Workspace (teams / enterprise) plans and billing. Part of plans-and-billing/page.tsx.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { type CardBrand } from '@/components/CardBrandLogo'
import { useOrg } from '@/context/org-context'
import { openBillingPortal, cancelSubscription, resumeSubscription } from '@/lib/api/stripe'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { billingErrorMessage } from '@/lib/billing/billing-actions'
import { billingInfoQuery, invoicesQuery, needsInvoiceList, pickInvoices } from '@/lib/billing/billing-queries'
import { orgScope, queryKeys } from '@/lib/query-keys'
import { Plan } from '@/lib/api/plan'


/** State and actions for OrgBillingView (moved out of the view unchanged). */
export function useOrgBillingView() {
  const router = useRouter()
  const { org, orgId, orgRole, plan, refreshMembers } = useOrg()

  const isEnterprise = plan?.isEnterprise ?? org?.plan === 'enterprise'

  const queryClient = useQueryClient()
  const billingScope = orgScope(orgId)
  const [capModalOpen,      setCapModalOpen]      = useState(false)
  const [savingCap,         setSavingCap]         = useState(false)
  const [showCancelDialog,  setShowCancelDialog]  = useState(false)
  const [isCanceling,       setIsCanceling]       = useState(false)
  const [isResuming,        setIsResuming]        = useState(false)
  const [openingPortal,     setOpeningPortal]     = useState(false)

  const isAdmin = orgRole === 'admin'

  // Every figure on this page comes off the Plan; nothing is recomputed here.
  const overageCapUsd = plan?.budgetUsd ?? null
  const overageUsd = plan?.overageUsd ?? 0
  const overageUsedPct = plan?.budgetUsedPct ?? 0
  const totalCredits = plan?.totalCredits ?? 0
  const usedCredits = plan?.used ?? 0
  const hasPlan = isEnterprise || Boolean(plan?.hasSelectedPlan)

  // Payment and invoices are admin-only (the backend's visiblePlan() zeroes
  // billing/usage fields for any non-admin — see ST2/ST3 in the spec tracker).
  const billingQ = useQuery(billingInfoQuery(billingScope, !!orgId && isAdmin))
  const billing = billingQ.data ?? null
  const invoicesQ = useQuery(invoicesQuery(billingScope, !!orgId && isAdmin && needsInvoiceList(billingQ.isSuccess, billing)))
  const invoices = pickInvoices(billing, invoicesQ.data)
  const billingLoading = billingQ.isLoading || invoicesQ.isLoading

  const pm = billing?.paymentMethod
  const cardBrand = (pm?.brand ?? 'unknown') as CardBrand

  // Invoice history shows only real, issued invoices now — the upcoming
  // invoice (never downloadable; Invoice.projected() gives it no viewUrl) is
  // surfaced separately as the card's subtitle instead of a row in the same
  // table, so it can't be mistaken for something "Export all" should cover.
  const hasDownloadableInvoice = invoices.some(inv => !!inv.viewUrl)

  const handleStripePortal = async () => {
    if (!isAdmin) {
      toast.error('Only an organization admin can manage billing.')
      return
    }
    if (openingPortal) return
    setOpeningPortal(true)
    try {
      const url = await openBillingPortal()
      trackBrowserEvent('billing_portal_opened', {})
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(billingErrorMessage(err, 'Could not open billing portal.'))
    } finally {
      setOpeningPortal(false)
    }
  }

  const handleExportAllInvoices = () => {
    const urls = invoices
      .map(inv => inv.viewUrl)
      .filter((url): url is string => !!url)
    if (urls.length === 0) {
      toast.error('No invoices to export.')
      return
    }
    urls.forEach(url => window.open(url, '_blank', 'noopener,noreferrer'))
    toast.success(urls.length === 1 ? 'Opened 1 invoice' : `Opened ${urls.length} invoices`)
  }

  const reloadBilling = () => queryClient.invalidateQueries({ queryKey: queryKeys.billing.all(billingScope) })

  // Cancel / resume the organization subscription — same flow as Settings → Billing.
  const handleCancelSubscription = async () => {
    if (!isAdmin) {
      toast.error('Only an organization admin can manage billing.')
      return
    }
    if (isCanceling) return
    setIsCanceling(true)
    try {
      await cancelSubscription()
      trackBrowserEvent('subscription_canceled', {})
      setShowCancelDialog(false)
      toast.success(`Plan canceled — access continues until ${nextBilling}`)
      await reloadBilling()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setIsCanceling(false)
    }
  }

  const handleResumeSubscription = async () => {
    if (!isAdmin) {
      toast.error('Only an organization admin can manage billing.')
      return
    }
    if (isResuming) return
    setIsResuming(true)
    try {
      await resumeSubscription()
      trackBrowserEvent('subscription_resumed', {})
      toast.success('Subscription resumed successfully')
      await reloadBilling()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resume subscription')
    } finally {
      setIsResuming(false)
    }
  }

  const handleRequestPlanChange = () => {
    toast.info('Contact an organization admin to change the plan.')
  }

  const handleRequestCapChange = () => {
    toast.info('Contact an organization admin to change the spend limit.')
  }

  const handleSaveCap = async (valueUsd: number | null) => {
    if (!orgId) return
    setSavingCap(true)
    try {
      await Plan.setBudget(orgId, valueUsd)
      refreshMembers() // re-fetch the shared plan so usage stays live instead of freezing this snapshot
      setCapModalOpen(false)
      toast.success('Spend limit updated.')
    } catch {
      toast.error('Failed to update spend limit.')
    } finally {
      setSavingCap(false)
    }
  }

  const nextBilling = plan?.cycleEndLabel ?? '—'


  return { router, plan, isEnterprise, capModalOpen, setCapModalOpen, savingCap, showCancelDialog, setShowCancelDialog, isCanceling, isResuming, openingPortal, setOpeningPortal, isAdmin, overageCapUsd, overageUsd, overageUsedPct, totalCredits, usedCredits, hasPlan, billing, invoices, billingLoading, pm, cardBrand, hasDownloadableInvoice, handleStripePortal, handleExportAllInvoices, handleCancelSubscription, handleResumeSubscription, handleRequestPlanChange, handleRequestCapChange, handleSaveCap, nextBilling }
}
