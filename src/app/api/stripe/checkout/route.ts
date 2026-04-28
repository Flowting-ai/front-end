import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth0 } from "@/lib/auth0";

const getStripe = () =>
  new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
  });

/** Map (plan + billing) → Stripe Price ID from env. */
const getPriceMap = (): Record<string, string | undefined> => ({
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  power_monthly: process.env.STRIPE_PRICE_POWER_MONTHLY,
  power_annual: process.env.STRIPE_PRICE_POWER_ANNUAL,
});

const VALID_PLANS = ["starter", "pro", "power"] as const;
const VALID_BILLING = ["monthly"] as const;

export async function POST(req: Request) {
  // 1. Verify Auth0 session (server-side)
  const session = await auth0.getSession();

  if (!session || !session.user) {
    return NextResponse.json(
      { error: "You must be logged in to subscribe." },
      { status: 401 },
    );
  }

  // 2. Parse & validate body
  let body: { plan_type?: string; billing?: string; checkout_flow?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { plan_type, billing } = body;
  const checkoutFlow =
    body.checkout_flow === "settings_change_plan"
      ? "settings_change_plan"
      : "onboarding";

  if (
    !plan_type ||
    !billing ||
    !VALID_PLANS.includes(plan_type as (typeof VALID_PLANS)[number]) ||
    !VALID_BILLING.includes(billing as (typeof VALID_BILLING)[number])
  ) {
    return NextResponse.json(
      { error: "Invalid plan or billing period." },
      { status: 400 },
    );
  }

  const priceId = getPriceMap()[`${plan_type}_${billing}`];
  if (!priceId) {
    return NextResponse.json(
      { error: "Price not configured for this plan." },
      { status: 500 },
    );
  }

  // 3. Create Stripe Checkout Session
  const appBase = process.env.APP_BASE_URL || "http://localhost:3000";

  const successUrl =
    checkoutFlow === "settings_change_plan"
      ? `${appBase}/settings/usage-and-billing/change-plan/confirmation?plan=${plan_type}&billing=${billing}`
      : `${appBase}/onboarding/pricing/confirmation?plan=${plan_type}&billing=${billing}`;
  const cancelUrl =
    checkoutFlow === "settings_change_plan"
      ? `${appBase}/settings/usage-and-billing/change-plan?checkout=cancelled`
      : `${appBase}/onboarding/pricing?checkout=cancelled`;

  const stripe = getStripe();
  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: session.user.email as string,
      metadata: {
        auth0_user_id: session.user.sub as string,
        plan_type,
        billing,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({
      checkout_url: checkoutSession.url,
      session_id: checkoutSession.id,
    });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
