import { CheckoutReturn } from '@/components/billing/CheckoutReturn'

/** Stripe success return for personal plans and top-ups. */
export default function BillingConfirmationPage() {
  return <CheckoutReturn backLabel="Go to plans & billing" />
}
