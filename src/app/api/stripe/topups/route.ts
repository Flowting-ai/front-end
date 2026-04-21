import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth0 } from "@/lib/auth0";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

const MIN_TOPUP_DOLLARS = 1;
const MAX_TOPUP_DOLLARS = 10;

export async function POST(req: Request) {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    return NextResponse.json(
      { error: "You must be logged in to purchase extra credits." },
      { status: 401 },
    );
  }

  let body: { amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawAmount = Number(body.amount);
  if (!Number.isFinite(rawAmount)) {
    return NextResponse.json(
      { error: "Amount is required and must be a number." },
      { status: 400 },
    );
  }

  if (rawAmount < MIN_TOPUP_DOLLARS || rawAmount > MAX_TOPUP_DOLLARS) {
    return NextResponse.json(
      { error: "Amount must be between $1 and $10." },
      { status: 400 },
    );
  }

  const amountInCents = Math.round(rawAmount * 100);
  const source = process.env.STRIPE_TOPUP_SOURCE_ID;

  if (!source) {
    return NextResponse.json(
      { error: "Stripe top-up source is not configured." },
      { status: 500 },
    );
  }

  try {
    const topup = await stripe.topups.create({
      amount: amountInCents,
      currency: "usd",
      source,
      description: `Souvenir extra credits top-up for ${session.user.email ?? "user"}`,
      metadata: {
        auth0_user_id: String(session.user.sub ?? ""),
      },
    });

    return NextResponse.json({
      topup_id: topup.id,
      amount: topup.amount,
      currency: topup.currency,
      status: topup.status,
    });
  } catch (err) {
    console.error("Stripe top-up error:", err);
    return NextResponse.json(
      { error: "Failed to create Stripe top-up." },
      { status: 500 },
    );
  }
}
