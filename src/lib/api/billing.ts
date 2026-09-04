"use client";

import {
  STRIPE_BILLING_ENDPOINT,
  STRIPE_TRIAL_ENDPOINT,
  STRIPE_USAGE_ENDPOINT,
} from "@/lib/config";
import { apiFetch } from "./client";
import {
  billingInfoSchema,
  usageResponseSchema,
  type BillingInfoWire,
  type CategorySpendWire,
  type CreditSummaryWire,
  type InvoiceWire,
  type PaymentMethodWire,
  type TrialCreditInfoWire,
  type UpcomingInvoiceWire,
  type UsageResponseWire,
} from "./billing-schemas";
export type CheckoutPlan = "50" | "100" | "250" | "500" | "1000" | "2000";

export const CREDITS_PER_USD = 1000;
const USAGE_RATIO = 0.8;
const TEAMS_PLAN_IDS = ["50", "100", "250", "500", "1000", "2000"] as const;

export function dollarsToCredits(usd: number): number {
  return Math.max(0, Math.round(usd * CREDITS_PER_USD));
}

export class CategorySpend {
  readonly chat: number;
  readonly slack: number;
  readonly brain: number;

  constructor(wire: CategorySpendWire) {
    this.chat = wire.chat;
    this.slack = wire.slack;
    this.brain = wire.brain;
  }

  get chatCredits(): number {
    return dollarsToCredits(this.chat);
  }

  get slackCredits(): number {
    return dollarsToCredits(this.slack);
  }

  get brainCredits(): number {
    return dollarsToCredits(this.brain);
  }

  get total(): number {
    return this.chat + this.slack + this.brain;
  }
}

export class TeamsTier {
  readonly planId: CheckoutPlan;
  readonly price: number;
  readonly usageUsd: number;
  readonly credits: number;

  constructor(planId: CheckoutPlan) {
    this.planId = planId;
    this.price = Number(planId);
    this.usageUsd = this.price * USAGE_RATIO;
    this.credits = dollarsToCredits(this.usageUsd);
  }

  static readonly all = TEAMS_PLAN_IDS.map((planId) => new TeamsTier(planId));

  static fromCredits(credits: number): TeamsTier | null {
    return TeamsTier.all.find((tier) => tier.credits === credits) ?? null;
  }

  static fromPlanId(planId: string | null | undefined): TeamsTier | null {
    if (!planId) return null;
    return TeamsTier.all.find((tier) => tier.planId === planId) ?? null;
  }
}

export class Usage {
  readonly credits: number;
  readonly planCredits: number;
  readonly topupCredits: number;
  readonly used: number;
  readonly spentThisPeriod: number;
  readonly trialRemaining: number | null;
  readonly trialExpiresAt: string | null;
  readonly byCategory: CategorySpend;

  constructor(wire: UsageResponseWire) {
    this.credits = wire.credits;
    this.planCredits = wire.plan_credits;
    this.topupCredits = wire.topup_credits;
    this.used = wire.used;
    this.spentThisPeriod = wire.spent_this_period;
    this.trialRemaining = wire.trial?.remaining ?? null;
    this.trialExpiresAt = wire.trial?.expires_at ?? null;
    this.byCategory = new CategorySpend(wire.by_category);
  }

  static parse(raw: unknown): Usage {
    const root = raw && typeof raw === "object" && "data" in raw
      ? (raw as { data: unknown }).data
      : raw;
    return new Usage(usageResponseSchema.parse(root));
  }

  static async fetch(): Promise<Usage> {
    const response = await apiFetch(STRIPE_USAGE_ENDPOINT, { method: "GET" });
    if (!response.ok) {
      throw new Error("Could not load usage");
    }
    return Usage.parse(await response.json());
  }

  static async startTrial(): Promise<Usage> {
    const response = await apiFetch(STRIPE_TRIAL_ENDPOINT, { method: "POST" });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof raw === "object" && raw && "detail" in raw
        ? String((raw as { detail: unknown }).detail)
        : "Failed to start trial.";
      throw new Error(detail);
    }
    return Usage.parse(raw);
  }

  get isTrial(): boolean {
    return this.trialExpiresAt !== null;
  }

  get remainingCredits(): number {
    return dollarsToCredits(this.credits);
  }

  get ownSpendCredits(): number {
    return dollarsToCredits(this.spentThisPeriod);
  }

  get usedCredits(): number {
    return dollarsToCredits(this.used);
  }

  get totalCredits(): number {
    return this.remainingCredits + this.usedCredits;
  }
}

export class PaymentMethod {
  readonly brand: string | null;
  readonly last4: string | null;
  readonly expMonth: number | null;
  readonly expYear: number | null;
  readonly funding: string | null;

  constructor(wire: PaymentMethodWire) {
    this.brand = wire.brand;
    this.last4 = wire.last4;
    this.expMonth = wire.exp_month;
    this.expYear = wire.exp_year;
    this.funding = wire.funding;
  }

  get label(): string {
    return this.last4 ? `Card ending in ${this.last4}` : "No payment method on file";
  }

  get expiry(): string | null {
    if (this.expMonth == null || this.expYear == null) return null;
    return `Expiry ${String(this.expMonth).padStart(2, "0")}/${this.expYear}`;
  }
}

export class Invoice {
  readonly amountPaid: number;
  readonly currency: string;
  readonly status: string | null;
  readonly created: string | null;
  readonly invoiceUrl: string | null;
  readonly invoicePdf: string | null;

  constructor(wire: InvoiceWire) {
    this.amountPaid = wire.amount_paid;
    this.currency = wire.currency;
    this.status = wire.status;
    this.created = wire.created;
    this.invoiceUrl = wire.invoice_url;
    this.invoicePdf = wire.invoice_pdf;
  }

  get viewUrl(): string | null {
    return this.invoicePdf ?? this.invoiceUrl;
  }

  get isPaid(): boolean {
    return this.status === "paid";
  }
}

export class UpcomingInvoice {
  readonly amountDue: number;
  readonly currency: string;
  readonly nextPaymentDate: string | null;

  constructor(wire: UpcomingInvoiceWire) {
    this.amountDue = wire.amount_due;
    this.currency = wire.currency;
    this.nextPaymentDate = wire.next_payment_date;
  }
}

export class CreditSummary {
  readonly totalCredits: number;
  readonly planCredits: number;
  readonly topupCredits: number;
  readonly used: number;
  readonly remaining: number;
  readonly trial: TrialCreditInfoWire | null;
  readonly byCategory: CategorySpend;

  constructor(wire: CreditSummaryWire) {
    this.totalCredits = wire.total_credits;
    this.planCredits = wire.plan_credits;
    this.topupCredits = wire.topup_credits;
    this.used = wire.used;
    this.remaining = wire.remaining;
    this.trial = wire.trial;
    this.byCategory = new CategorySpend(wire.by_category);
  }

  get remainingDisplay(): number {
    return dollarsToCredits(this.remaining);
  }

  get usedDisplay(): number {
    return dollarsToCredits(this.used);
  }

  get totalDisplay(): number {
    return dollarsToCredits(this.totalCredits);
  }
}

export class Billing {
  readonly planId: string | null;
  readonly planType: string | null;
  readonly subscriptionStatus: string | null;
  readonly currentPeriodEnd: string | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly paymentMethod: PaymentMethod | null;
  readonly invoices: Invoice[];
  readonly upcomingInvoice: UpcomingInvoice | null;
  readonly credits: CreditSummary;
  readonly billingModel: string | null;
  readonly baseFeeUsd: number;
  readonly includedUsageUsd: number;
  readonly providerUsageUsd: number;
  readonly includedUsageRemainingUsd: number;
  readonly overageUsd: number;
  readonly projectedInvoiceUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly totalTokens: number;
  readonly usageEventCount: number;

  constructor(wire: BillingInfoWire) {
    this.planId = wire.plan_id;
    this.planType = wire.plan_type;
    this.subscriptionStatus = wire.subscription_status;
    this.currentPeriodEnd = wire.current_period_end;
    this.cancelAtPeriodEnd = wire.cancel_at_period_end;
    this.paymentMethod = wire.payment_method ? new PaymentMethod(wire.payment_method) : null;
    this.invoices = wire.invoices.map((invoice) => new Invoice(invoice));
    this.upcomingInvoice = wire.upcoming_invoice
      ? new UpcomingInvoice(wire.upcoming_invoice)
      : null;
    this.credits = new CreditSummary(wire.credits);
    this.billingModel = wire.billing_model;
    this.baseFeeUsd = wire.base_fee_usd;
    this.includedUsageUsd = wire.included_usage_usd;
    this.providerUsageUsd = wire.provider_usage_usd;
    this.includedUsageRemainingUsd = wire.included_usage_remaining_usd;
    this.overageUsd = wire.overage_usd;
    this.projectedInvoiceUsd = wire.projected_invoice_usd;
    this.inputTokens = wire.input_tokens;
    this.outputTokens = wire.output_tokens;
    this.cacheReadTokens = wire.cache_read_tokens;
    this.cacheWriteTokens = wire.cache_write_tokens;
    this.totalTokens = wire.total_tokens;
    this.usageEventCount = wire.usage_event_count;
  }

  static parse(raw: unknown): Billing {
    const root = raw && typeof raw === "object" && "data" in raw
      ? (raw as { data: unknown }).data
      : raw;
    return new Billing(billingInfoSchema.parse(root));
  }

  /** Admin-only. Members and solo users get 403 — that is a null, not an error. */
  static async fetch(): Promise<Billing | null> {
    const response = await apiFetch(STRIPE_BILLING_ENDPOINT, { method: "GET" });
    if (response.status === 403) return null;
    if (!response.ok) return null;
    return Billing.parse(await response.json());
  }

  get teamsTier(): TeamsTier | null {
    return TeamsTier.fromPlanId(this.planId);
  }
}
