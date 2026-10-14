import { CheckoutReturn } from '@/components/billing/CheckoutReturn'

/** Stripe success return for workspace plans. */
export default function OrgBillingConfirmationPage() {
  return <CheckoutReturn backLabel="Go to Plans & Usage" />
}
