/**
 * CSRF token issuer.
 *
 * GET /api/csrf  →  { token: "<nonce>.<timestamp>.<hmac>" }
 *
 * To validate in other route handlers:
 *   import { validateCsrfToken } from "@/lib/csrf";
 */

import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/csrf";

const CSRF_SECRET = process.env.CSRF_SECRET ?? process.env.AUTH0_SECRET ?? "";

export async function GET(): Promise<NextResponse> {
  if (!CSRF_SECRET) {
    console.error("[csrf] CSRF_SECRET / AUTH0_SECRET is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const token = generateCsrfToken();

  return NextResponse.json(
    { token },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
