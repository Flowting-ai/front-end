'use client'

// Workspace (teams / enterprise) plans and billing. Part of plans-and-billing/page.tsx.

import React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { UsageMeter } from '@/components/UsageMeter'
import { CardBrandLogo } from '@/components/CardBrandLogo'
import { Tooltip } from '@/components/Tooltip'
import { setupEnterprisePayment } from '@/lib/api/billing'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { billingErrorMessage } from '@/lib/billing/billing-actions'
import { ORG_CHANGE_PLAN_ROUTE, ORG_ANALYTICS_ROUTE } from '@/lib/routes'
import {
  SHADOW_CARD,
  statCardBigLineStyle,
  statCardCaptionStyle,
  fmtUsd,
  fmtDate,
  Badge,
  SectionCard,
} from './billing-primitives'
import { EnterprisePlansSkeleton, TeamsPlansSkeleton } from './billing-skeletons'
import { CancelSubscriptionDialog, InvoiceTable } from './billing-widgets'
import dynamic from 'next/dynamic'
import { SpendLimitCard } from './billing-spend'

// Opened rarely (Enterprise admins only), so it loads on first open.
const SpendCapModal = dynamic(() => import('./billing-spend').then(m => m.SpendCapModal))

import { useOrgBillingView } from './use-org-billing-view'

export function OrgBillingView() {
  const { router, plan, isEnterprise, capModalOpen, setCapModalOpen, savingCap, showCancelDialog, setShowCancelDialog, isCanceling, isResuming, openingPortal, setOpeningPortal, isAdmin, overageCapUsd, overageUsd, overageUsedPct, totalCredits, usedCredits, hasPlan, billing, invoices, billingLoading, pm, cardBrand, hasDownloadableInvoice, handleStripePortal, handleExportAllInvoices, handleCancelSubscription, handleResumeSubscription, handleRequestPlanChange, handleRequestCapChange, handleSaveCap, nextBilling } = useOrgBillingView()

  if (billingLoading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
        {isEnterprise ? <EnterprisePlansSkeleton isAdmin={isAdmin} /> : <TeamsPlansSkeleton isAdmin={isAdmin} />}
      </div>
    )
  }

  const cancelAtPeriodEnd = plan?.cancelAtPeriodEnd ?? false

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:           '1 0 0',
        minHeight:      0,
        overflowY:      'auto',
        overflowX:      'hidden',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        padding:        '64px 24px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div style={{ paddingLeft: 4 }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
            Plan &amp; Billing
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Manage your plan, billing details, and usage.
          </p>
        </div>

        {isEnterprise ? (
          /* Matches the Teams/core layout below: a "Plan" / "Credits Remaining"
             two-card row, rather than a bespoke gradient hero. */
          <>
            {/* Outer enclosing border/bg — same treatment as the Monthly
                Limits / Active members pairing on /settings/analytics: one
                bordered shell around both stat cards, not each card floating
                on its own. */}
            <div style={{
              width:           '100%',
              border:          '1px solid var(--border-default)',
              borderRadius:    16,
              boxShadow:       SHADOW_CARD,
              overflow:        'hidden',
              backgroundColor: 'var(--neutral-50)',
              padding:         12,
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
                  <SectionCard
                    title="Plan"
                    titleColor="var(--neutral-700)"
                    action={<Badge label="Active" tone="green" />}
                    headerDivider={false}
                    background="linear-gradient(135deg, var(--neutral-white) 0%, var(--neutral-200) 100%)"
                    bodyAlign="flex-start"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: '1 0 0', minWidth: 0 }}>
                        <p style={statCardBigLineStyle}>
                          {plan?.title ?? 'Enterprise · pay for usage'}
                        </p>
                        <p style={{ ...statCardCaptionStyle, margin: '6px 0 0' }}>
                          {plan?.paymentDueLabel
                            ? `Payment for the last cycle is due ${plan.paymentDueLabel}`
                            : `Next billing date: ${nextBilling}`}
                        </p>
                      </div>
                    </div>
                  </SectionCard>
                </div>

                <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
                  <SectionCard title="Charges this cycle" titleColor="var(--neutral-700)" headerDivider={false} background="var(--neutral-white)" bodyAlign="space-between" bodyGap={8}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <p style={{ ...statCardBigLineStyle, whiteSpace: 'nowrap' }}>
                          {plan?.chargesThisCycleLabel ?? fmtUsd(0)}
                        </p>
                        <p style={statCardCaptionStyle}>
                          before applicable tax
                        </p>
                      </div>
                      <p style={{ ...statCardCaptionStyle, margin: '6px 0 0' }}>
                        {`Cycle ${plan?.cycleLabel ?? '—'}`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" onClick={() => router.push(ORG_ANALYTICS_ROUTE)}>View usage</Button>
                    </div>
                  </SectionCard>
                </div>
              </div>
            </div>

            <SpendLimitCard
              overageCapUsd={overageCapUsd}
              overage={overageUsd}
              overageUsedPct={overageUsedPct}
              isAdmin={isAdmin}
              onEdit={() => setCapModalOpen(true)}
              onRequest={handleRequestCapChange}
            />
          </>
        ) : (
          /* Figma 18:25119: two compact cards side by side — Plan, and Credits
             Remaining. The old inline tier slider/annual toggle moved entirely
             to ORG_CHANGE_PLAN_ROUTE (what "Upgrade Plan" already opens) rather
             than living here too. Same outer enclosing border/bg + card
             styling as the Enterprise branch above and the Monthly Limits /
             Active members pairing on /settings/analytics. */
          <div style={{
            width:           '100%',
            border:          '1px solid var(--border-default)',
            borderRadius:    16,
            boxShadow:       SHADOW_CARD,
            overflow:        'hidden',
            backgroundColor: 'var(--neutral-50)',
            padding:         12,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
              <SectionCard
                title="Plan"
                titleColor="var(--neutral-700)"
                action={
                  hasPlan
                    ? <Badge label={cancelAtPeriodEnd ? 'Canceling' : 'Active'} tone={cancelAtPeriodEnd ? 'red' : 'green'} />
                    : <Badge label="Free Plan" tone="blue" />
                }
                headerDivider={false}
                background="linear-gradient(135deg, var(--neutral-white) 0%, var(--neutral-200) 100%)"
                bodyAlign="space-between"
                bodyGap={8}
              >
                {hasPlan ? (
                  // Actions on their own row at the bottom, not squeezed
                  // beside the plan info — Cancel/Resume + Upgrade together
                  // could crowd the text column and force awkward wrapping.
                  // Two direct children (not one wrapping div) so SectionCard's
                  // own bodyAlign="space-between" sinks the action row to the
                  // card's bottom edge when the stretched-height Credits
                  // Remaining card next to it makes this card taller than its
                  // own content — bodyGap is the floor when it isn't.
                  <>
                    <div>
                      <p style={statCardBigLineStyle}>
                        {plan?.title ?? 'Core Plan'}
                      </p>
                      <p style={{ ...statCardCaptionStyle, margin: '6px 0 0' }}>
                        {cancelAtPeriodEnd ? `Access ends ${nextBilling}` : `Next billing date: ${nextBilling}`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                      {isAdmin ? (
                        <>
                          {/* Not in Figma's static frame, but cancel/resume needs to stay
                              reachable now that it no longer lives in a hero footer. */}
                          {cancelAtPeriodEnd ? (
                            <Button variant="ghost" disabled={isResuming} onClick={() => { void handleResumeSubscription() }}>
                              {isResuming ? 'Resuming…' : 'Resume plan'}
                            </Button>
                          ) : (
                            <Button variant="ghost" onClick={() => setShowCancelDialog(true)}>
                              Cancel plan
                            </Button>
                          )}
                          <Button variant="default" onClick={() => router.push(ORG_CHANGE_PLAN_ROUTE)}>Upgrade Plan</Button>
                        </>
                      ) : (
                        <Button variant="secondary" onClick={handleRequestPlanChange}>Request plan change</Button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p style={statCardBigLineStyle}>
                        Currently on Free Plan
                      </p>
                      <p style={{ ...statCardCaptionStyle, margin: '6px 0 0' }}>
                        Choose a plan to start using paid credits.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {isAdmin ? (
                        <Button variant="default" onClick={() => router.push(ORG_CHANGE_PLAN_ROUTE)}>Choose a plan</Button>
                      ) : (
                        <Button variant="secondary" onClick={handleRequestPlanChange}>Request plan change</Button>
                      )}
                    </div>
                  </>
                )}
              </SectionCard>
              </div>

              <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
              <SectionCard title="Credits remaining" titleColor="var(--neutral-700)" headerDivider={false} background="var(--neutral-white)" bodyAlign="space-between" bodyGap={12}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <p style={{ ...statCardBigLineStyle, whiteSpace: 'nowrap' }}>
                      {Math.max(0, totalCredits - usedCredits).toLocaleString()}
                    </p>
                    <p style={statCardCaptionStyle}>
                      of {totalCredits.toLocaleString()} left
                    </p>
                  </div>
                  <UsageMeter
                    value={totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0}
                    label="Credits used this cycle"
                    caption={`${usedCredits.toLocaleString()} used · resets ${nextBilling}`}
                    trailing={`${totalCredits > 0 ? Math.round((usedCredits / totalCredits) * 100) : 0}%`}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => router.push(ORG_ANALYTICS_ROUTE)}>View usage</Button>
                </div>
              </SectionCard>
              </div>
            </div>
          </div>
        )}

        {/* Payment — admin-only; the backend returns empty billing info to anyone else */}
        {isAdmin && (
          <SectionCard
            title="Payment"
            subtitle={isEnterprise ? 'Usage is billed after each monthly cycle.' : 'Manage your billing details.'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CardBrandLogo brand={cardBrand} />
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  {billingLoading ? 'Loading…' : pm?.label ?? 'No payment method on file'}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                  {pm?.expiry ?? (pm ? 'Charged automatically after each cycle.' : 'Add a card to continue.')}
                </p>
              </div>
              {isEnterprise && !billing?.paymentSetupComplete ? (
                <Button variant="secondary" loading={openingPortal} onClick={async () => {
                  if (openingPortal) return
                  setOpeningPortal(true)
                  try { window.location.assign(await setupEnterprisePayment()) }
                  catch (err) {
                    trackBrowserEvent('checkout_failed', { to_plan: 'enterprise', source: 'settings' })
                    toast.error(billingErrorMessage(err, 'Could not start payment setup.'))
                    setOpeningPortal(false)
                  }
                }}>Set up automatic payments</Button>
              ) : (
                <Button variant="secondary" loading={openingPortal} onClick={() => void handleStripePortal()}>Manage on Stripe</Button>
              )}
            </div>
          </SectionCard>
        )}

        {isAdmin && (
          <SectionCard
            title="Invoice history"
            subtitle={isEnterprise && plan
              ? `Next invoice: ${plan.chargesThisCycleLabel} so far, charged when the cycle ends ${plan.cycleEndLabel}`
              : billing?.upcomingInvoice
                ? `Next invoice: ${fmtUsd(billing.upcomingInvoice.amountDue)} due ${fmtDate(billing.upcomingInvoice.nextPaymentDate)}`
                : undefined}
            action={
              <Tooltip content="No downloadable invoices yet" side="top" disabled={hasDownloadableInvoice}>
                <span style={{ display: 'inline-flex' }}>
                  <Button variant="secondary" onClick={handleExportAllInvoices} disabled={!hasDownloadableInvoice}>Export all</Button>
                </span>
              </Tooltip>
            }
            bodyPadding="0 24px 12px"
          >
            <InvoiceTable invoices={invoices} loading={billingLoading} />
          </SectionCard>
        )}
      </div>

      {/* Modals */}
      <CancelSubscriptionDialog
        open={showCancelDialog}
        periodEndLabel={nextBilling}
        isCanceling={isCanceling}
        onKeep={() => setShowCancelDialog(false)}
        onConfirmCancel={() => { void handleCancelSubscription() }}
      />
      {isAdmin && isEnterprise && capModalOpen && (
        <SpendCapModal
          currentCapUsd={overageCapUsd}
          saving={savingCap}
          onSave={handleSaveCap}
          onClose={() => setCapModalOpen(false)}
        />
      )}
    </div>
  )
}
