"use client";

import {
  STRIPE_BILLING_ENDPOINT,
  STRIPE_INVOICES_ENDPOINT,
  STRIPE_TRIAL_ENDPOINT,
  STRIPE_USAGE_ENDPOINT,
} from "@/lib/config";
import { apiFetch, buildApiError } from "./client";
import { BillingActionError, errorReason } from "@/lib/billing/billing-actions";
import {
  billingInfoSchema,
  parseInvoices,
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
import { Plan, TeamsTier, dollarsToCredits } from "./plan";
export { CREDITS_PER_USD, TeamsTier, dollarsToCredits, type CheckoutPlan } from "./plan";

// Enterprise orgs are funded with this explicit "never runs out" sentinel
// (back-end/services/users/enterprise_pricing.py's ENTERPRISE_INTERMAX) as
// their pool's dollar balance. `/stripe/usage` still reports it as `credits`,
// so that one consumer must render "Unlimited" instead of the number.
export const ENTERPRISE_INTERMAX = 2_147_483_647;

export class CategorySpend {
  readonly chat: number;
  readonly slack: number;
  readonly automation: number;
  readonly subtask: number;

  constructor(wire: CategorySpendWire) {
    this.chat = wire.chat;
    this.slack = wire.slack;
    this.automation = wire.automation;
    this.subtask = wire.subtask;
  }

  // Subtask spend comes from agents a chat turn hands work to, so it counts as chat.
  get chatCredits(): number {
    return dollarsToCredits(this.chat + this.subtask);
  }

  get slackCredits(): number {
    return dollarsToCredits(this.slack);
  }

  get automationCredits(): number {
    return dollarsToCredits(this.automation);
  }

  get total(): number {
    return this.chat + this.slack + this.automation + this.subtask;
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
    if (!response.ok) throw await buildApiError(response);
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

  // True for an Enterprise org's pool — `credits` (remaining) is the raw
  // INTERMAX sentinel dollar balance, not a real number to display.
  get isUnlimited(): boolean {
    return this.credits >= ENTERPRISE_INTERMAX;
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
  readonly type: string | null;
  readonly brand: string | null;
  readonly last4: string | null;
  readonly expMonth: number | null;
  readonly expYear: number | null;
  readonly funding: string | null;

  constructor(wire: PaymentMethodWire) {
    this.type = wire.type;
    this.brand = wire.brand;
    this.last4 = wire.last4;
    this.expMonth = wire.exp_month;
    this.expYear = wire.exp_year;
    this.funding = wire.funding;
  }

  /** "Card ending in 4242", "Link", or the saved method's type when it is neither. */
  get label(): string {
    if (this.last4) return `Card ending in ${this.last4}`;
    if (this.type === "link") return "Link";
    return this.type ? this.type.charAt(0).toUpperCase() + this.type.slice(1) : "Saved payment method";
  }

  get expiry(): string | null {
    if (this.expMonth == null || this.expYear == null) return null;
    return `Expiry ${String(this.expMonth).padStart(2, "0")}/${this.expYear}`;
  }
}

export class Invoice {
  readonly amountPaid: number;
  readonly amountDue: number;
  readonly currency: string;
  readonly status: string | null;
  readonly created: string | null;
  readonly invoiceUrl: string | null;
  readonly invoicePdf: string | null;

  constructor(wire: InvoiceWire) {
    this.amountPaid = wire.amount_paid;
    this.amountDue = wire.amount_due;
    this.currency = wire.currency;
    this.status = wire.status;
    this.created = wire.created;
    this.invoiceUrl = wire.invoice_url;
    this.invoicePdf = wire.invoice_pdf;
  }

  static parseAll(raw: unknown): Invoice[] {
    return parseInvoices(raw).map((wire) => new Invoice(wire));
  }

  static async list(): Promise<Invoice[]> {
    const response = await apiFetch(STRIPE_INVOICES_ENDPOINT, { method: "GET" });
    if (!response.ok) throw await buildApiError(response);
    return Invoice.parseAll(await response.json());
  }

  static projected(amountUsd: number, date: string | null): Invoice {
    return new Invoice({
      amount_paid: 0,
      amount_due: amountUsd,
      currency: "usd",
      status: "upcoming",
      created: date,
      invoice_url: null,
      invoice_pdf: null,
    });
  }

  get viewUrl(): string | null {
    return this.invoicePdf ?? this.invoiceUrl;
  }

  get isPaid(): boolean {
    return this.status === "paid";
  }

  get isUpcoming(): boolean {
    return this.status === "upcoming";
  }

  get displayAmount(): number {
    return this.isPaid ? this.amountPaid : this.amountDue;
  }

  get statusLabel(): string {
    if (this.isUpcoming) return "Upcoming";
    if (this.isPaid) return "Paid";
    return this.status ? this.status.charAt(0).toUpperCase() + this.status.slice(1) : "Open";
  }

  static history(issued: Invoice[], upcoming: UpcomingInvoice | null): Invoice[] {
    if (!upcoming || upcoming.amountDue <= 0) return issued;
    return [Invoice.projected(upcoming.amountDue, upcoming.nextPaymentDate), ...issued];
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

/** The org's plan plus what only Stripe knows: saved method, invoices, the next Teams charge. */
export class Billing {
  readonly plan: Plan | null;
  readonly paymentMethod: PaymentMethod | null;
  readonly invoices: Invoice[];
  readonly upcomingInvoice: UpcomingInvoice | null;
  readonly credits: CreditSummary;
  readonly paymentSetupComplete: boolean;
  readonly collectionEnabled: boolean;

  constructor(wire: BillingInfoWire) {
    this.plan = wire.plan ? new Plan(wire.plan) : null;
    this.paymentMethod = wire.payment_method ? new PaymentMethod(wire.payment_method) : null;
    this.invoices = wire.invoices.map((invoice) => new Invoice(invoice));
    this.upcomingInvoice = wire.upcoming_invoice
      ? new UpcomingInvoice(wire.upcoming_invoice)
      : null;
    this.credits = new CreditSummary(wire.credits);
    this.paymentSetupComplete = wire.payment_setup_complete;
    this.collectionEnabled = wire.collection_enabled;
  }

  static parse(raw: unknown): Billing {
    const root = raw && typeof raw === "object" && "data" in raw
      ? (raw as { data: unknown }).data
      : raw;
    return new Billing(billingInfoSchema.parse(root));
  }

  /** Admin-only. Members and solo users get 403 — that is a null, not an error. Other failures throw ApiError. */
  static async fetch(): Promise<Billing | null> {
    const response = await apiFetch(STRIPE_BILLING_ENDPOINT, { method: "GET" });
    if (response.status === 403) return null;
    if (!response.ok) throw await buildApiError(response);
    return Billing.parse(await response.json());
  }

  get teamsTier(): TeamsTier | null {
    return this.plan?.teamsTier ?? null;
  }
}

export async function setupEnterprisePayment(): Promise<string> {
  const response = await apiFetch(`${STRIPE_BILLING_ENDPOINT.replace(/\/billing$/, "")}/enterprise/setup`, { method: "POST" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new BillingActionError(errorReason(body, "Could not start payment setup."), response.status);
  const url = (body as { checkout_url?: unknown } | null)?.checkout_url;
  if (typeof url !== "string" || !url) throw new BillingActionError("Payment setup returned no checkout link.", response.status);
  return url;
}
