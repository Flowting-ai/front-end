/** Fields of a compare-modal model card that the grid filters on. */
export interface FilterableModel {
  company: string
  modelName: string
  tierLabel?: string | null
}

export interface ModelFilters {
  /** Company tab; "all" shows every company. */
  company: string
  /** Selected tier ids ("starter", "pro", "power"); empty means any tier. */
  tiers: ReadonlySet<string>
  query: string
}

// Backend tier labels each filter id accepts.
const TIER_LABELS: Record<string, readonly string[]> = {
  starter: ["free", "starter"],
  pro: ["paid", "pro"],
  power: ["power"],
}

/** The compare modal's model grid filter: company tab, then tiers, then search. */
export function filterCompareModels<T extends FilterableModel>(models: readonly T[], filters: ModelFilters): T[] {
  let result = filters.company === "all" ? [...models] : models.filter((m) => m.company === filters.company)
  if (filters.tiers.size > 0) {
    result = result.filter((m) => {
      const label = (m.tierLabel ?? "").toLowerCase()
      return [...filters.tiers].some((tier) => TIER_LABELS[tier]?.includes(label))
    })
  }
  const q = filters.query.trim().toLowerCase()
  if (q) {
    result = result.filter((m) => m.modelName.toLowerCase().includes(q) || m.company.toLowerCase().includes(q))
  }
  return result
}
