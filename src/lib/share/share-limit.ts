/** A Super Link credit limit typed by the user: a whole number from 1 to the plan maximum, else null. */
export function parseCreditLimit(raw: string, max: number): number | null {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return n >= 1 && n <= max ? n : null
}

/** The default limit when the user isn't asked: half the plan's share allowance. */
export const defaultCreditLimit = (planMax: number) => Math.max(1, Math.floor(planMax / 2))

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "1,200 / 5,000 credits used" or "Unlimited credits". */
export function linkUsageText(link: { credit_limit: number | null; credit_used: number } | null): string | null {
  if (!link) return null
  return link.credit_limit
    ? `${link.credit_used.toLocaleString()} / ${link.credit_limit.toLocaleString()} credits used`
    : 'Unlimited credits'
}
