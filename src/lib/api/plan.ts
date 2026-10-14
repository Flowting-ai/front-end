"use client";

import { z } from "zod";
import { ORG_PLAN_BUDGET_ENDPOINT, ORG_PLAN_ENDPOINT } from "@/lib/config";
import type { OrgMember } from "@/types/teams";
import { apiFetchJson } from "./client";
import { trackBrowserEvent } from "@/lib/analytics/events";

export type CheckoutPlan = "50" | "100" | "125" | "250" | "500" | "1000" | "2000";
/** Retired individual tiers that existing subscribers still renew on. Never offered. */
export type LegacyPlan = "12" | "25";
export type TeamsPlanId = CheckoutPlan | LegacyPlan;

export const CREDITS_PER_USD = 1000;
const USAGE_RATIO = 1 / 1.15;
const TEAMS_PLAN_IDS = ["50", "100", "125", "250", "500", "1000", "2000"] as const;
const LEGACY_PLAN_IDS = ["12", "25"] as const;

export function dollarsToCredits(usd: number): number {
  return Math.max(0, Math.round(usd * CREDITS_PER_USD));
}

export class TeamsTier<P extends TeamsPlanId = TeamsPlanId> {
  readonly planId: P;
  readonly price: number;
  readonly usageUsd: number;
  readonly credits: number;

  constructor(planId: P, interval: "monthly" | "annual" = "monthly") {
    this.planId = planId;
    this.price = Number(planId);
    this.usageUsd = Math.floor(this.price * (interval === "annual" ? 0.75 : 1) * USAGE_RATIO * 1_000_000) / 1_000_000;
    this.credits = dollarsToCredits(this.usageUsd);
  }

  /** The purchasable ladder, in picker order. */
  static readonly all: TeamsTier<CheckoutPlan>[] = TEAMS_PLAN_IDS.map((planId) => new TeamsTier<CheckoutPlan>(planId));
  static readonly legacy: TeamsTier<LegacyPlan>[] = LEGACY_PLAN_IDS.map((planId) => new TeamsTier<LegacyPlan>(planId));

  static fromCredits(credits: number): TeamsTier | null {
    return [...TeamsTier.all, ...TeamsTier.legacy].find((tier) => tier.credits === credits) ?? null;
  }

  static fromPlanId(planId: string | null | undefined): TeamsTier | null {
    if (!planId) return null;
    return [...TeamsTier.all, ...TeamsTier.legacy].find((tier) => tier.planId === planId) ?? null;
  }
}

/** Mirrors services/organizations/schemas.py MemberResponse: camelCase on the wire. */
export const planMemberSchema = z.object({
  userId: z.string(),
  name: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  role: z.enum(["admin", "member", "service", "owner"]),
  usageTotal: z.number().nullable().transform((v) => v ?? 0),
  inviteStatus: z.enum(["active", "pending"]),
  inviteId: z.string().nullable().default(null),
  isPendingInvite: z.boolean().default(false),
});

/** Mirrors services/organizations/schemas.py PlanResponse: snake_case on the wire. */
export const planSchema = z.object({
  organization_id: z.string(),
  plan_type: z.enum(["teams", "enterprise"]).nullable().default(null),
  billing_model: z.enum(["prepaid", "postpaid"]).default("prepaid"),
  plan_id: z.string().nullable().default(null),
  billing_interval: z.string().nullable().default(null),
  subscription_status: z.string().nullable().default(null),
  cancel_at_period_end: z.boolean().default(false),
  current_period_start: z.string().nullable().default(null),
  current_period_end: z.string().nullable().default(null),
  payment_due_at: z.string().nullable().default(null),
  budget_usd: z.number().nullable().default(null),
  markup_multiplier: z.number().nullable().default(null),
  plan_credits: z.number().default(0),
  topup_credits: z.number().default(0),
  total_credits: z.number().default(0),
  used: z.number().default(0),
  remaining: z.number().default(0),
  percent_used: z.number().default(0),
  pool_status: z.enum(["healthy", "warning_95", "paused"]).default("healthy"),
  members: z.array(planMemberSchema).default([]),
  provider_usage_usd: z.number().default(0),
  overage_usd: z.number().default(0),
  projected_invoice_usd: z.number().default(0),
  input_tokens: z.number().int().default(0),
  output_tokens: z.number().int().default(0),
  cache_read_tokens: z.number().int().default(0),
  cache_write_tokens: z.number().int().default(0),
  total_tokens: z.number().int().default(0),
  usage_event_count: z.number().int().default(0),
});

export type PlanMemberWire = z.infer<typeof planMemberSchema>;
export type PlanWire = z.infer<typeof planSchema>;

export interface CreditsDisplay {
  value: string;
  caption: string | null;
}

export function normalizeMember(m: PlanMemberWire): OrgMember {
  const role = m.role === "admin" || m.role === "owner" ? "admin" : "member";
  const inviteStatus = m.inviteStatus === "pending" ? "invite_sent" : "signed_up";
  return {
    id: m.userId,
    name: m.name ?? "",
    email: m.email ?? "",
    role,
    orgRole: m.role,
    inviteStatus,
    teamMemberships: [],
    creditUsed: inviteStatus === "invite_sent" ? 0 : dollarsToCredits(m.usageTotal),
    inviteId: m.inviteId ?? null,
  };
}

// The backend writes naive UTC timestamps; without a designator the browser would read them as local time.
function utcDate(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Billing cycles are UTC instants (Stripe), so labels are formatted in UTC: a
// cycle ending at 00:00Z on Oct 19 reads "Oct 19" everywhere, not "Oct 18" in
// the Americas.
function dateLabel(date: Date | null): string {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";
}

function shortDateLabel(date: Date | null): string {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—";
}

const formatUsd = (usd: number) =>
  `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The organization's billing state, parsed once from the backend's plan object.
 * Every surface renders these getters; none of them computes dates, limits, or
 * credit figures on its own. Credit figures are display credits (USD × 1000).
 */
export class Plan {
  readonly organizationId: string;
  readonly planType: "teams" | "enterprise" | null;
  readonly billingModel: "prepaid" | "postpaid";
  readonly planId: string | null;
  readonly billingInterval: string | null;
  readonly subscriptionStatus: string | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly cycleStart: Date | null;
  readonly cycleEnd: Date | null;
  readonly paymentDueAt: Date | null;
  readonly budgetUsd: number | null;
  readonly markupMultiplier: number | null;
  readonly planCredits: number;
  readonly topupCredits: number;
  readonly totalCredits: number;
  readonly used: number;
  readonly remaining: number;
  readonly percentUsed: number;
  readonly poolStatus: "healthy" | "warning_95" | "paused";
  readonly members: OrgMember[];
  readonly providerUsageUsd: number;
  readonly overageUsd: number;
  readonly chargesThisCycleUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly totalTokens: number;
  readonly usageEventCount: number;

  constructor(wire: PlanWire) {
    const postpaid = wire.billing_model === "postpaid";
    this.organizationId = wire.organization_id;
    this.planType = wire.plan_type;
    this.billingModel = wire.billing_model;
    this.planId = wire.plan_id;
    this.billingInterval = wire.billing_interval;
    this.subscriptionStatus = wire.subscription_status;
    this.cancelAtPeriodEnd = wire.cancel_at_period_end;
    this.cycleStart = utcDate(wire.current_period_start);
    this.cycleEnd = utcDate(wire.current_period_end);
    this.paymentDueAt = utcDate(wire.payment_due_at);
    this.budgetUsd = wire.budget_usd;
    this.markupMultiplier = wire.markup_multiplier;
    this.planCredits = dollarsToCredits(wire.plan_credits);
    this.topupCredits = dollarsToCredits(wire.topup_credits);
    this.totalCredits = dollarsToCredits(wire.total_credits);
    this.used = dollarsToCredits(postpaid ? wire.provider_usage_usd : wire.used);
    this.remaining = dollarsToCredits(wire.remaining);
    this.percentUsed = wire.percent_used;
    this.poolStatus = wire.pool_status;
    this.members = wire.members.map(normalizeMember);
    this.providerUsageUsd = wire.provider_usage_usd;
    this.overageUsd = wire.overage_usd;
    this.chargesThisCycleUsd = wire.projected_invoice_usd;
    this.inputTokens = wire.input_tokens;
    this.outputTokens = wire.output_tokens;
    this.cacheReadTokens = wire.cache_read_tokens;
    this.cacheWriteTokens = wire.cache_write_tokens;
    this.totalTokens = wire.total_tokens;
    this.usageEventCount = wire.usage_event_count;
  }

  static parse(raw: unknown): Plan {
    return new Plan(planSchema.parse(raw));
  }

  static async fetch(orgId: string): Promise<Plan> {
    return Plan.parse(await apiFetchJson<unknown>(ORG_PLAN_ENDPOINT(orgId)));
  }

  /** Admin only. `null` lifts the Enterprise spending budget. */
  static async setBudget(orgId: string, budgetUsd: number | null): Promise<Plan> {
    const raw = await apiFetchJson<unknown>(ORG_PLAN_BUDGET_ENDPOINT(orgId), {
      method: "PATCH",
      body: JSON.stringify({ budgetUsd }),
    });
    trackBrowserEvent("credit_cap_set", { has_cap: budgetUsd !== null });
    return Plan.parse(raw);
  }

  get isEnterprise(): boolean {
    return this.planType === "enterprise";
  }

  /** A real subscription or contract, as opposed to the founder's starting credits. */
  get hasSelectedPlan(): boolean {
    return this.planType !== null;
  }

  /** Something to spend: Enterprise always, Teams while the pool holds credit.
   *  A member cannot see the pool, so a selected plan that is not paused counts. */
  get isFunded(): boolean {
    return this.isEnterprise || this.totalCredits > 0 || (this.hasSelectedPlan && this.poolStatus !== "paused");
  }

  get teamsTier(): TeamsTier | null {
    return TeamsTier.fromPlanId(this.planId);
  }

  get isAnnual(): boolean {
    return this.billingInterval === "annual";
  }

  /** The Teams tier's effective monthly price; null outside Teams. */
  get monthlyPrice(): number | null {
    const tier = this.teamsTier;
    if (!tier) return null;
    return this.isAnnual ? tier.price * 0.75 : tier.price;
  }

  get chipLabel(): string {
    if (this.isEnterprise) return "Enterprise";
    return this.hasSelectedPlan ? "Core" : "Free Plan";
  }

  /** The plan card's headline: "Enterprise · pay for usage" or "Core Plan · $250/mo". */
  get title(): string {
    if (this.isEnterprise) return "Enterprise · pay for usage";
    if (!this.hasSelectedPlan) return "Currently on Free Plan";
    const price = this.monthlyPrice;
    return price != null ? `Core Plan · $${price}/mo` : "Core Plan";
  }

  /** What the account menu shows under the chip. Enterprise is never a number. */
  get credits(): CreditsDisplay {
    if (this.isEnterprise) return { value: "Unlimited", caption: null };
    return { value: this.totalCredits.toLocaleString("en-US"), caption: "total credits" };
  }

  get cycleStartLabel(): string {
    return shortDateLabel(this.cycleStart);
  }

  get cycleEndLabel(): string {
    return dateLabel(this.cycleEnd);
  }

  /** "Sep 19 – Oct 19, 2026" from the backend's own cycle, never a calendar guess. */
  get cycleLabel(): string {
    if (!this.cycleStart || !this.cycleEnd) return "—";
    return `${shortDateLabel(this.cycleStart)} – ${dateLabel(this.cycleEnd)}`;
  }

  /** Days elapsed in the cycle at `now` (pass one shared value per render), at least one. */
  daysIntoCycleAt(now: number): number {
    if (!this.cycleStart) return 1;
    return Math.max(1, Math.floor((now - this.cycleStart.getTime()) / 86_400_000) + 1);
  }

  get daysIntoCycle(): number {
    return this.daysIntoCycleAt(Date.now());
  }

  get chargesThisCycleLabel(): string {
    return formatUsd(this.chargesThisCycleUsd);
  }

  /** The Enterprise budget line: "Unlimited" or the dollar budget. */
  get budgetLabel(): string {
    return this.budgetUsd == null ? "Unlimited" : formatUsd(this.budgetUsd);
  }

  get budgetUsedPct(): number {
    if (this.budgetUsd == null) return 0;
    if (this.budgetUsd <= 0) return 100;
    return Math.min(100, (this.overageUsd / this.budgetUsd) * 100);
  }

  /** Set once a closed cycle is unpaid; the org is blocked after this date. */
  get paymentDueLabel(): string | null {
    return this.paymentDueAt ? dateLabel(this.paymentDueAt) : null;
  }

  isPastDueAt(now: number): boolean {
    return this.paymentDueAt != null && this.paymentDueAt.getTime() < now;
  }

  get isPastDue(): boolean {
    return this.isPastDueAt(Date.now());
  }
}
