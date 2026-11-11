/**
 * Copy for the page Stripe returns to after a successful checkout
 * (`?type=topup|plan&plan=<id>`). Pure, shared by both settings return routes.
 */
export function checkoutReturnCopy(type: string | null, plan: string | null): { heading: string; description: string } {
  if (type === 'topup') {
    return { heading: 'Credits Added!', description: 'Your credits have been topped up and are ready to use.' }
  }
  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : null
  return {
    heading: 'Payment Successful!',
    description: planLabel
      ? `You're now subscribed to the ${planLabel} plan. Your workspace is ready.`
      : 'Your subscription is active. Your workspace is ready.',
  }
}

/** The checkout pages set this so the onboarding gate doesn't bounce a returning payer; clear it on arrival. */
export const CLEAR_CHECKOUT_COOKIE = 'souvenir_checkout_complete=; path=/; max-age=0; SameSite=Lax'
