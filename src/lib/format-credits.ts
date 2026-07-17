const CREDIT_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Formats a display-credit count (e.g. a member's cap or pool balance) for the org UI. */
export function formatCredits(value: number | null | undefined): string {
  return CREDIT_FORMATTER.format(Number.isFinite(value) ? value ?? 0 : 0)
}
