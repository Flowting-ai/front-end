import type { UserPlanType } from "@/lib/api/user";

/** Starter plan caps (for downgrade validation). */
export const STARTER_LIMITS = {
  totalPersonaCount: 3,
  totalPinCount: 100,
  totalWorkflowsCount: 0,
} as const;

/** Pro plan caps (for downgrade validation). Personas are unlimited. */
export const PRO_LIMITS = {
  totalPinCount: 2000,
  totalWorkflowsCount: 2,
} as const;

export type WorkspaceUsageCounts = {
  totalPersonaCount: number;
  totalPinCount: number;
  totalWorkflowsCount: number;
};

function planRank(p: UserPlanType): number {
  if (p === "starter") return 0;
  if (p === "pro") return 1;
  return 2;
}

export function isPlanUpgrade(from: UserPlanType, to: UserPlanType): boolean {
  return planRank(to) > planRank(from);
}

export function isPlanDowngrade(from: UserPlanType, to: UserPlanType): boolean {
  return planRank(to) < planRank(from);
}

/** True if workspace exceeds limits for the target downgrade tier. */
export function isDowngradeBlockedByUsage(
  targetPlan: Extract<UserPlanType, "starter" | "pro">,
  counts: WorkspaceUsageCounts,
): boolean {
  if (targetPlan === "starter") {
    return (
      counts.totalPersonaCount > STARTER_LIMITS.totalPersonaCount ||
      counts.totalPinCount > STARTER_LIMITS.totalPinCount ||
      counts.totalWorkflowsCount > STARTER_LIMITS.totalWorkflowsCount
    );
  }
  return (
    counts.totalPinCount > PRO_LIMITS.totalPinCount ||
    counts.totalWorkflowsCount > PRO_LIMITS.totalWorkflowsCount
  );
}
