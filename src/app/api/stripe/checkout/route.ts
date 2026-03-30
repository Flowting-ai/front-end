import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth0 } from "@/lib/auth0";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

/** Map (plan + billing) → Stripe Price ID from env. */
const PRICE_MAP: Record<string, string | undefined> = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  power_monthly: process.env.STRIPE_PRICE_POWER_MONTHLY,
  power_annual: process.env.STRIPE_PRICE_POWER_ANNUAL,
};

const VALID_PLANS = ["starter", "pro", "power"] as const;
const VALID_BILLING = ["monthly", "annual"] as const;

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
  let body: { plan?: string; billing?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { plan, billing } = body;

  if (
    !plan ||
    !billing ||
    !VALID_PLANS.includes(plan as (typeof VALID_PLANS)[number]) ||
    !VALID_BILLING.includes(billing as (typeof VALID_BILLING)[number])
  ) {
    return NextResponse.json(
      { error: "Invalid plan or billing period." },
      { status: 400 },
    );
  }

  const priceId = PRICE_MAP[`${plan}_${billing}`];
  if (!priceId) {
    return NextResponse.json(
      { error: "Price not configured for this plan." },
      { status: 500 },
    );
  }

  // 3. Create Stripe Checkout Session
  const appBase = process.env.APP_BASE_URL || "http://localhost:3000";

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: billing === "annual" ? "subscription" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: session.user.email as string,
      metadata: {
        auth0_user_id: session.user.sub as string,
        plan,
        billing,
      },
      success_url: `${appBase}/onboarding/pricing/confirmation?plan=${plan}&billing=${billing}`,
      cancel_url: `${appBase}/onboarding/pricing?checkout=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
