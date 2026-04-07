import type { UserPlanType } from "@/lib/api/user";
import { planRank } from "@/lib/plan-config";

export type PricingCardId = UserPlanType;

export type CardConfig = {
  id: PricingCardId;
  title: string;
  subtitle?: string;
  monthlyPrice: number;
  annualPrice: number;
  introText?: string;
  features: string[];
};

export const CARD_CONFIG: CardConfig[] = [
  {
    id: "starter",
    title: "Starter",
    subtitle: "For daily AI power users",
    monthlyPrice: 12,
    annualPrice: 10,
    introText: "Plan Inclusions",
    features: [
      "Basic Usage",
      "Basic AI models",
      "Smart routing (basic algorithm)",
      "Manual model switching",
      "3 custom personas",
      "100 Pins to save outputs",
      "10 web searches / day",
      "Cross-model memory(light)",
      "Community Support",
    ],
  },
  {
    id: "pro",
    title: "Pro",
    subtitle: "For daily AI power users",
    monthlyPrice: 25,
    annualPrice: 21,
    introText: "Everything in Starter, plus",
    features: [
      "More Usage*",
      "Basic + Advanced AI Models",
      "Basic + Advanced routing algorithm",
      "Model Compare(side-by-side)",
      "2000 Pins",
      "Unlimited Personas + 2 shared",
      "Unlimited Web Search",
      "Model compare",
      "Persona & Workflow Analytics",
      "Early access to new features",
      "Email & chat support",
    ],
  },
  {
    id: "power",
    title: "Power",
    subtitle: "Zero limits",
    monthlyPrice: 100,
    annualPrice: 83,
    introText: "Everything in Pro, plus",
    features: [
      "5x usage*",
      "All models : Basic + Advanced",
      "All algorithms + manual switch",
      "Unlimited Pins & Personas",
      "Unlimited workflows + sharing",
      "Advanced Analytics",
      "Priority compute",
      "First access to new features",
      "Priority support + live response",
    ],
  },
];

export function planDisplayTitle(plan: PricingCardId): string {
  return plan === "starter" ? "Starter" : plan.charAt(0).toUpperCase() + plan.slice(1);
}

export type PlanChangeButtonAction = "purchase" | "cancel_subscription";

export type PlanChangeOptions = {
  /** True when Stripe subscription is already set to cancel at period end. */
  subscriptionCancelAtPeriodEnd?: boolean;
};

/** Labels for plan change UI (settings). When `current` is null, user has no paid plan yet. */
export function getPlanChangeButtonState(
  current: PricingCardId | null,
  target: PricingCardId,
  options?: PlanChangeOptions,
): { label: string; disabled: boolean; action: PlanChangeButtonAction } {
  if (!current) {
    return { label: "Pay with Stripe", disabled: false, action: "purchase" };
  }
  if (current === target) {
    if (options?.subscriptionCancelAtPeriodEnd) {
      return {
        label: "Cancels at period end",
        disabled: true,
        action: "purchase",
      };
    }
    return {
      label: "Cancel plan",
      disabled: false,
      action: "cancel_subscription",
    };
  }
  if (planRank(target) > planRank(current)) {
    return {
      label: `Upgrade to ${planDisplayTitle(target)}`,
      disabled: false,
      action: "purchase",
    };
  }
  return {
    label: `Downgrade to ${planDisplayTitle(target)}`,
    disabled: false,
    action: "purchase",
  };
}
