import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth0 } from "@/lib/auth0";

const getStripe = () =>
  new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
  });

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10;

export async function POST(req: Request) {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    return NextResponse.json(
      { error: "You must be logged in to purchase extra credits." },
      { status: 401 },
    );
  }

  let body: { amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const amount = body.amount as number;

  if (!Number.isFinite(amount)) {
    return NextResponse.json(
      { error: "Amount is required and must be a number." },
      { status: 400 },
    );
  }

  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `Amount must be between $${MIN_AMOUNT} and $${MAX_AMOUNT}.` },
      { status: 400 },
    );
  }

  const sourceId = process.env.STRIPE_TOPUP_SOURCE_ID;
  if (!sourceId) {
    return NextResponse.json(
      { error: "Stripe top-up source is not configured." },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  try {
    const topup = await stripe.topups.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      source: sourceId,
      description: `Credit top-up for ${session.user.email}`,
    });

    return NextResponse.json({ topup_id: topup.id });
  } catch (err) {
    console.error("Stripe top-up error:", err);
    return NextResponse.json(
      { error: "Failed to create Stripe top-up." },
      { status: 500 },
    );
  }
}
