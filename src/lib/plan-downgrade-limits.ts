/**
 * Backward-compatible re-exports from the unified plan config.
 * New code should import from "@/lib/plan-config" directly.
 */

export {
  isPlanUpgrade,
  isPlanDowngrade,
  isDowngradeBlockedByUsage,
  PLAN_LIMITS,
  type WorkspaceUsageCounts,
} from "@/lib/plan-config";

import { PLAN_LIMITS } from "@/lib/plan-config";

/** @deprecated Use `PLAN_LIMITS.starter` from "@/lib/plan-config" instead. */
export const STARTER_LIMITS = {
  totalPersonaCount: PLAN_LIMITS.starter.personas,
  totalPinCount: PLAN_LIMITS.starter.pins,
  totalWorkflowsCount: PLAN_LIMITS.starter.workflows,
} as const;

/** @deprecated Use `PLAN_LIMITS.pro` from "@/lib/plan-config" instead. */
export const PRO_LIMITS = {
  totalPinCount: PLAN_LIMITS.pro.pins,
  totalWorkflowsCount: PLAN_LIMITS.pro.workflows,
} as const;
