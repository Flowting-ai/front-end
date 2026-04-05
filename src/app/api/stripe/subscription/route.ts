import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth0 } from "@/lib/auth0";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

const PRICE_MAP: Record<string, string | undefined> = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  power_monthly: process.env.STRIPE_PRICE_POWER_MONTHLY,
};

const VALID_PLANS = ["starter", "pro", "power"] as const;

const findCustomerByEmail = async (email: string) => {
  const customers = await stripe.customers.list({ email, limit: 1 });
  return customers.data[0] ?? null;
};

const findActiveSubscription = async (customerId: string) => {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  return (
    subscriptions.data.find((sub) =>
      ["active", "trialing", "past_due", "unpaid"].includes(sub.status),
    ) ?? null
  );
};

type CheckoutFlow = "onboarding" | "settings_change_plan";

const createCheckoutForPlan = async (
  email: string,
  auth0Id: string,
  planType: string,
  checkoutFlow: CheckoutFlow = "onboarding",
) => {
  const priceId = PRICE_MAP[`${planType}_monthly`];
  if (!priceId) {
    throw new Error("Price not configured for this plan.");
  }

  const appBase = process.env.APP_BASE_URL || "http://localhost:3000";

  const successUrl =
    checkoutFlow === "settings_change_plan"
      ? `${appBase}/settings/usage-and-billing/change-plan/confirmation?plan=${planType}&billing=monthly`
      : `${appBase}/onboarding/pricing/confirmation?plan=${planType}&billing=monthly`;
  const cancelUrl =
    checkoutFlow === "settings_change_plan"
      ? `${appBase}/settings/usage-and-billing/change-plan?checkout=cancelled`
      : `${appBase}/onboarding/pricing?checkout=cancelled`;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    metadata: {
      auth0_user_id: auth0Id,
      plan_type: planType,
      billing: "monthly",
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return NextResponse.json({
    checkout_url: checkoutSession.url,
    session_id: checkoutSession.id,
  });
};

export async function PATCH(req: Request) {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    return NextResponse.json(
      { error: "You must be logged in to update your subscription." },
      { status: 401 },
    );
  }

  let body: { plan_type?: string; checkout_flow?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { plan_type } = body;
  const checkoutFlow: CheckoutFlow =
    body.checkout_flow === "settings_change_plan"
      ? "settings_change_plan"
      : "onboarding";
  if (!plan_type || !VALID_PLANS.includes(plan_type as (typeof VALID_PLANS)[number])) {
    return NextResponse.json({ error: "Invalid plan type." }, { status: 400 });
  }

  const priceId = PRICE_MAP[`${plan_type}_monthly`];
  if (!priceId) {
    return NextResponse.json(
      { error: "Price not configured for this plan." },
      { status: 500 },
    );
  }

  try {
    const email = session.user.email as string;
    const customer = await findCustomerByEmail(email);

    if (!customer) {
      return await createCheckoutForPlan(
        email,
        session.user.sub as string,
        plan_type,
        checkoutFlow,
      );
    }

    const subscription = await findActiveSubscription(customer.id);
    if (!subscription || subscription.items.data.length === 0) {
      return await createCheckoutForPlan(
        email,
        session.user.sub as string,
        plan_type,
        checkoutFlow,
      );
    }

    const item = subscription.items.data[0];

    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "create_prorations",
    });

    return NextResponse.json({
      status: "subscription updated",
      new_plan: plan_type,
    });
  } catch (err) {
    console.error("Stripe subscription update error:", err);
    return NextResponse.json(
      { error: "Failed to update subscription." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    return NextResponse.json(
      { error: "You must be logged in to cancel your subscription." },
      { status: 401 },
    );
  }

  try {
    const email = session.user.email as string;
    const customer = await findCustomerByEmail(email);
    if (!customer) {
      return NextResponse.json(
        { error: "No active subscription found." },
        { status: 404 },
      );
    }

    const subscription = await findActiveSubscription(customer.id);
    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found." },
        { status: 404 },
      );
    }

    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({
      status: "subscription will cancel at period end",
    });
  } catch (err) {
    console.error("Stripe subscription cancel error:", err);
    return NextResponse.json(
      { error: "Failed to cancel subscription." },
      { status: 500 },
    );
  }
}
