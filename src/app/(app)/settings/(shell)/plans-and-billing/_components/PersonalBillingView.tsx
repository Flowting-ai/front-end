'use client'

// Personal plan, usage, top-ups and the Stripe-return confirmation poll. Part of plans-and-billing/page.tsx.

import React from 'react'
import { TokenCircleIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { UsageMeter } from '@/components/UsageMeter'
import { CardBrandLogo } from '@/components/CardBrandLogo'
import { Tooltip } from '@/components/Tooltip'
import { SETTINGS_BILLING_CHANGE_PLAN_ROUTE, SETTINGS_USAGE_ROUTE } from '@/lib/routes'
import {
  fmtNum,
  fmtUsd,
  fmtDate,
  Badge,
  SectionCard,
} from './billing-primitives'
import { PersonalPlansSkeleton } from './billing-skeletons'
import { CancelSubscriptionDialog, PersonalUsageRow, InvoiceTable } from './billing-widgets'

import { usePersonalBillingView } from './use-personal-billing-view'

// Individual (non-org) accounts: no admin/member distinction, so the org view's
// isAdmin/canSeeCredits/canSeePayment/canSeeInvoices are all true here, and
// isEnterprise is always false. Shares SectionCard/Badge/InvoiceTable/ModalShell
// with the org view so both account types read as one visual language.
export function PersonalBillingView() {
  const { router, billing, usage, billingLoaded, showCancelDialog, setShowCancelDialog, isCanceling, isResuming, isClaimingTrial, openingPortal, confirmState, showSkeleton, creditsTotal, creditsRemaining, creditsUsed, isTrialUser, planName, planPrice, planFeatures, hasActiveSub, hasPlan, chatCredits, slackCredits, automationCredits, nextBilling, periodEnd, cancelAtPeriodEnd, pm, cardBrand, invoices, hasDownloadableInvoice, billingPending, resetDate, handleStripePortal, handleExportAllInvoices, handleCancelSubscription, handleResumeSubscription, handleClaimTrial } = usePersonalBillingView()

  if (showSkeleton) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
        <PersonalPlansSkeleton />
      </div>
    )
  }

  return (
    <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ paddingLeft: 4 }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
            Plan &amp; Billing
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Manage your plan, monitor credit consumption, and download invoices.
          </p>
        </div>

        <p role="status" aria-live="polite" style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0, paddingLeft: 4, display: confirmState === 'idle' ? 'none' : undefined }}>
          {confirmState === 'confirming' && 'Confirming your payment…'}
          {confirmState === 'confirmed' && 'Payment confirmed. Your plan is up to date.'}
          {confirmState === 'slow' && 'Your payment is still processing. It can take a few minutes to appear; refresh this page later.'}
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 0 0', minWidth: 280 }}>
            <SectionCard
              title="Plan"
              titleColor="var(--neutral-700)"
              action={
                hasPlan
                  ? <Badge label={cancelAtPeriodEnd ? 'Canceling' : (isTrialUser ? 'Free Trial' : 'Active')} tone={cancelAtPeriodEnd ? 'red' : (isTrialUser ? 'blue' : 'green')} />
                  : <Badge label="No plan selected" tone="neutral" />
              }
              headerDivider={false}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                    {hasPlan ? `${planName} Plan${planPrice > 0 ? ` · $${planPrice}/mo` : ''}` : 'No plan selected'}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '6px 0 0' }}>
                    {isTrialUser
                      ? `${fmtNum(creditsRemaining)} of ${fmtNum(creditsTotal)} trial credits remaining`
                      : cancelAtPeriodEnd
                        ? `Access ends ${fmtDate(periodEnd)}`
                        : hasPlan
                          ? `Next billing date: ${nextBilling}`
                          : 'Choose a plan to start using paid credits.'}
                  </p>
                  {planFeatures.length > 0 && (
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
                      {planFeatures.join(' · ')}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {hasActiveSub && !cancelAtPeriodEnd && (
                    <Button variant="ghost" onClick={() => setShowCancelDialog(true)}>
                      Cancel plan
                    </Button>
                  )}
                  {hasActiveSub && cancelAtPeriodEnd && (
                    <Button variant="ghost" disabled={isResuming} onClick={() => { void handleResumeSubscription() }}>
                      {isResuming ? 'Resuming…' : 'Resume plan'}
                    </Button>
                  )}
                  {isTrialUser && billingLoaded && !usage?.isTrial && (
                    <Button variant="secondary" leftIcon={<TokenCircleIcon size={16} animated />} loading={isClaimingTrial} onClick={() => { void handleClaimTrial() }}>
                      Claim free 1,000 credits
                    </Button>
                  )}
                  <Button variant="default" onClick={() => router.push(SETTINGS_BILLING_CHANGE_PLAN_ROUTE)}>
                    {hasPlan ? 'Change Plan' : 'Choose a plan'}
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>

          <div style={{ flex: '1 0 0', minWidth: 280 }}>
            <SectionCard title="Credits remaining" titleColor="var(--neutral-700)" headerDivider={false} bodyAlign="space-between" bodyGap={12}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0, whiteSpace: 'nowrap' }}>
                    {fmtNum(Math.max(0, creditsTotal - creditsUsed))}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                    of {fmtNum(creditsTotal)} left
                  </p>
                </div>
                <UsageMeter
                  value={creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0}
                  label="Credits used this month"
                  caption={`${fmtNum(creditsUsed)} used · ${cancelAtPeriodEnd ? 'no further resets' : `resets ${resetDate}`}`}
                  trailing={`${creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 100) : 0}%`}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => router.push(SETTINGS_USAGE_ROUTE)}>View usage</Button>
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="This month's usage" subtitle={cancelAtPeriodEnd ? 'No further resets' : `Resets ${resetDate}`} bodyGap={16}>
          <PersonalUsageRow label="Chat"  used={chatCredits}  total={creditsTotal} />
          <PersonalUsageRow label="Slack" used={slackCredits} total={creditsTotal} />
          <PersonalUsageRow label="Automations" used={automationCredits} total={creditsTotal} />
        </SectionCard>

        {billing && (
          <>
        <SectionCard title="Payment" subtitle="Manage your billing details.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CardBrandLogo brand={cardBrand} />
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                {pm?.label ?? 'No payment method on file'}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                {pm?.expiry ?? 'Add a card to continue.'}
              </p>
            </div>
            <Button variant="secondary" loading={openingPortal} onClick={() => { void handleStripePortal() }}>Manage on Stripe</Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Invoice history"
          subtitle={billing?.upcomingInvoice
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
          <InvoiceTable invoices={invoices} loading={billingPending} />
        </SectionCard>
          </>
        )}
      </div>

      <CancelSubscriptionDialog
        open={showCancelDialog}
        periodEndLabel={fmtDate(periodEnd)}
        isCanceling={isCanceling}
        onKeep={() => setShowCancelDialog(false)}
        onConfirmCancel={() => { void handleCancelSubscription() }}
      />
    </div>
  )
}
