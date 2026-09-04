import { z } from "zod";

/** Mirrors services/users/schemas.py CategoryUsage / UsageBreakdown. */
export const categorySpendSchema = z.object({
  chat: z.number().default(0),
  slack: z.number().default(0),
  brain: z.number().default(0),
});

/** Mirrors services/users/schemas.py TrialSummary. */
export const trialSummarySchema = z.object({
  remaining: z.number(),
  expires_at: z.string(),
});

/** Mirrors services/users/schemas.py TrialCreditInfo. */
export const trialCreditInfoSchema = z.object({
  amount: z.number(),
  remaining: z.number(),
  used: z.number(),
  starts_at: z.string().nullable().default(null),
  expires_at: z.string(),
});

/** Mirrors services/users/schemas.py CreditSummary. */
export const creditSummarySchema = z.object({
  total_credits: z.number().default(0),
  plan_credits: z.number().default(0),
  topup_credits: z.number().default(0),
  used: z.number().default(0),
  remaining: z.number().default(0),
  trial: trialCreditInfoSchema.nullable().default(null),
  by_category: categorySpendSchema.default({ chat: 0, slack: 0, brain: 0 }),
});

/** Mirrors services/users/schemas.py UsageResponse. */
export const usageResponseSchema = z.object({
  credits: z.number(),
  plan_credits: z.number().default(0),
  topup_credits: z.number().default(0),
  used: z.number().default(0),
  trial: trialSummarySchema.nullable().default(null),
  spent_this_period: z.number().default(0),
  by_category: categorySpendSchema.default({ chat: 0, slack: 0, brain: 0 }),
});

const paymentMethodSchema = z.object({
  brand: z.string().nullable().default(null),
  last4: z.string().nullable().default(null),
  exp_month: z.number().nullable().default(null),
  exp_year: z.number().nullable().default(null),
  funding: z.string().nullable().default(null),
});

const invoiceDateSchema = z
  .union([z.string(), z.number()])
  .nullable()
  .default(null)
  .transform((value) => {
    if (typeof value === "number") return new Date(value * 1000).toISOString();
    return value && value.length > 0 ? value : null;
  });

const invoiceSchema = z.object({
  amount_paid: z.number().default(0),
  currency: z.string().default("usd"),
  status: z.string().nullable().default(null),
  created: invoiceDateSchema,
  invoice_url: z.string().nullable().default(null),
  invoice_pdf: z.string().nullable().default(null),
});

const upcomingInvoiceSchema = z.object({
  amount_due: z.number().default(0),
  currency: z.string().default("usd"),
  next_payment_date: z.string().nullable().default(null),
});

/** Mirrors services/stripe/schemas.py BillingInfo. */
export const billingInfoSchema = z.object({
  plan_id: z.string().nullable().default(null),
  plan_type: z.string().nullable().default(null),
  subscription_status: z.string().nullable().default(null),
  current_period_end: z.string().nullable().default(null),
  cancel_at_period_end: z.boolean().default(false),
  payment_method: paymentMethodSchema.nullable().default(null),
  invoices: z.array(invoiceSchema).default([]),
  upcoming_invoice: upcomingInvoiceSchema.nullable().default(null),
  credits: creditSummarySchema.prefault({}),
  billing_model: z.string().nullable().default(null),
  base_fee_usd: z.number().default(0),
  included_usage_usd: z.number().default(0),
  provider_usage_usd: z.number().default(0),
  included_usage_remaining_usd: z.number().default(0),
  overage_usd: z.number().default(0),
  projected_invoice_usd: z.number().default(0),
  input_tokens: z.number().default(0),
  output_tokens: z.number().default(0),
  cache_read_tokens: z.number().default(0),
  cache_write_tokens: z.number().default(0),
  total_tokens: z.number().default(0),
  usage_event_count: z.number().default(0),
});

export type CategorySpendWire = z.infer<typeof categorySpendSchema>;
export type UsageResponseWire = z.infer<typeof usageResponseSchema>;
export type CreditSummaryWire = z.infer<typeof creditSummarySchema>;
export type BillingInfoWire = z.infer<typeof billingInfoSchema>;
export type PaymentMethodWire = z.infer<typeof paymentMethodSchema>;
export type InvoiceWire = z.infer<typeof invoiceSchema>;
export type UpcomingInvoiceWire = z.infer<typeof upcomingInvoiceSchema>;
export type TrialCreditInfoWire = z.infer<typeof trialCreditInfoSchema>;
