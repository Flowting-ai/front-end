/**
 * Unified plan configuration — single source of truth for all plan tiers,
 * resource limits, feature flags, and access-gating helpers.
 *
 * Import from here for any plan-related logic. Avoid hardcoding plan checks
 * (e.g. `planType === "power"`) in components.
 */

import type { UserPlanType } from "@/lib/api/user";

// ── Plan Ranking ─────────────────────────────────────────────────────────────

const PLAN_RANK: Record<UserPlanType, number> = {
  starter: 0,
  pro: 1,
  power: 2,
};

export function planRank(plan: UserPlanType): number {
  return PLAN_RANK[plan] ?? 0;
}

export function isPlanUpgrade(from: UserPlanType, to: UserPlanType): boolean {
  return planRank(to) > planRank(from);
}

export function isPlanDowngrade(from: UserPlanType, to: UserPlanType): boolean {
  return planRank(to) < planRank(from);
}

// ── Resource Limits ──────────────────────────────────────────────────────────

export type PlanResourceLimits = {
  personas: number; // Infinity = unlimited
  pins: number;
  workflows: number;
  webSearchesPerDay: number;
};

export const PLAN_LIMITS: Record<UserPlanType, PlanResourceLimits> = {
  starter: {
    personas: 3,
    pins: 100,
    workflows: 0,
    webSearchesPerDay: 10,
  },
  pro: {
    personas: Infinity,
    pins: 2000,
    workflows: 2,
    webSearchesPerDay: Infinity,
  },
  power: {
    personas: Infinity,
    pins: Infinity,
    workflows: Infinity,
    webSearchesPerDay: Infinity,
  },
};

/** Check if a specific resource has reached its plan limit. */
export function hasReachedLimit(
  plan: UserPlanType,
  resource: keyof PlanResourceLimits,
  currentCount: number,
): boolean {
  return currentCount >= PLAN_LIMITS[plan][resource];
}

/** Get the limit value for a resource on a plan. */
export function getLimit(
  plan: UserPlanType,
  resource: keyof PlanResourceLimits,
): number {
  return PLAN_LIMITS[plan][resource];
}

// ── Monthly Credit Allowances ─────────────────────────────────────────────────

export const PLAN_CREDITS: Record<UserPlanType, number> = {
  starter: 5_000,
  pro: 12_000,
  power: 60_000,
};

/** Get the total monthly credit allowance for a plan. */
export function getPlanCredits(plan: UserPlanType): number {
  return PLAN_CREDITS[plan] ?? 0;
}

/**
 * Convert raw API usage values into credits remaining.
 * The API returns monetary usage ($); we map $1 → 1000 credits.
 */
export function usageToCredits(
  plan: UserPlanType,
  monthlyUsed: number,
): { total: number; used: number; remaining: number } {
  const total = PLAN_CREDITS[plan] ?? 0;
  const used = Math.round(monthlyUsed * 1000);
  return { total, used: Math.min(used, total), remaining: Math.max(total - used, 0) };
}

/** Format a credit number for display (e.g. 12000 → "12,000"). */
export function formatCredits(credits: number): string {
  return credits.toLocaleString("en-US");
}

// ── Framework Access ─────────────────────────────────────────────────────────

export type FrameworkTier = "basic" | "advanced";

export const PLAN_FRAMEWORKS: Record<UserPlanType, readonly FrameworkTier[]> = {
  starter: ["basic"],
  pro: ["basic", "advanced"],
  power: ["basic", "advanced"],
};

/** Check if a plan has access to a specific auto-routing framework tier. */
export function canAccessFramework(
  plan: UserPlanType | null | undefined,
  framework: FrameworkTier,
): boolean {
  if (!plan) return false;
  return (PLAN_FRAMEWORKS[plan] ?? []).includes(framework);
}

// ── Feature Flags ────────────────────────────────────────────────────────────

export type PlanFeature =
  | "mistralOcr"
  | "modelCompare"
  | "advancedModels"
  | "advancedRouting"
  | "sharedPersonas"
  | "workflowSharing"
  | "advancedAnalytics"
  | "priorityCompute"
  | "unlimitedWebSearch";

const PLAN_FEATURES: Record<UserPlanType, ReadonlySet<PlanFeature>> = {
  starter: new Set([]),
  pro: new Set([
    "modelCompare",
    "advancedModels",
    "advancedRouting",
    "sharedPersonas",
    "unlimitedWebSearch",
  ]),
  power: new Set([
    "mistralOcr",
    "modelCompare",
    "advancedModels",
    "advancedRouting",
    "sharedPersonas",
    "workflowSharing",
    "advancedAnalytics",
    "priorityCompute",
    "unlimitedWebSearch",
  ]),
};

/** Check if a plan has access to a specific feature. */
export function canAccessFeature(
  plan: UserPlanType | null | undefined,
  feature: PlanFeature,
): boolean {
  if (!plan) return false;
  return PLAN_FEATURES[plan]?.has(feature) ?? false;
}

// ── Model Access Gating ──────────────────────────────────────────────────────

/**
 * Maps model_plan_type (from backend API) to the minimum plan rank required.
 * "standard" models are accessible by all plans.
 */
const MODEL_PLAN_RANK: Record<string, number> = {
  standard: 0,
  pro: 1,
  power: 2,
};

/** Check if a user's plan is insufficient for a model's required plan type. */
export function requiresModelUpgrade(
  modelPlanType: string,
  userPlanType: string | null | undefined,
): boolean {
  if (!userPlanType) return true;
  const modelRank = MODEL_PLAN_RANK[modelPlanType] ?? 0;
  const userRank = PLAN_RANK[userPlanType as UserPlanType] ?? -1;
  return modelRank > userRank;
}

// ── Downgrade Validation ─────────────────────────────────────────────────────

export type WorkspaceUsageCounts = {
  totalPersonaCount: number;
  totalPinCount: number;
  totalWorkflowsCount: number;
};

/** True if workspace usage exceeds limits for the target downgrade tier. */
export function isDowngradeBlockedByUsage(
  targetPlan: Extract<UserPlanType, "starter" | "pro">,
  counts: WorkspaceUsageCounts,
): boolean {
  const limits = PLAN_LIMITS[targetPlan];
  return (
    counts.totalPersonaCount > limits.personas ||
    counts.totalPinCount > limits.pins ||
    counts.totalWorkflowsCount > limits.workflows
  );
}
