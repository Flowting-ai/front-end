/**
 * CSRF token issuer.
 *
 * GET /api/csrf  →  { token: "<nonce>.<timestamp>.<hmac>" }
 *
 * Token anatomy:
 *   nonce      32 hex chars  (crypto.randomBytes(16))
 *   timestamp  Unix ms       (Date.now())
 *   signature  64 hex chars  (HMAC-SHA256 of "nonce:timestamp" keyed by CSRF_SECRET)
 *
 * Usage on the client:
 *   const { token } = await fetch("/api/csrf").then(r => r.json());
 *   // Include on every non-GET mutation:
 *   headers["X-CSRF-Token"] = token;
 *
 * Usage in other route handlers:
 *   import { validateCsrfToken } from "@/app/api/csrf/route";
 *   if (!validateCsrfToken(request.headers.get("X-CSRF-Token"))) {
 *     return new Response("Forbidden", { status: 403 });
 *   }
 *
 * Security properties:
 *  - HMAC prevents forgery without knowing the secret.
 *  - Timestamp lets the server reject stale tokens (default TTL: 24 h).
 *  - timingSafeEqual prevents timing side-channel attacks.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Shared signing secret — falls back to AUTH0_SECRET (already required). */
const CSRF_SECRET = process.env.CSRF_SECRET ?? process.env.AUTH0_SECRET ?? "";

/** Maximum token age in milliseconds. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

// ---------------------------------------------------------------------------
// Token helpers (exported so other route handlers can validate)
// ---------------------------------------------------------------------------

function hmac(nonce: string, timestamp: string): string {
  return crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(`${nonce}:${timestamp}`)
    .digest("hex");
}

/**
 * Generate a signed CSRF token.
 * Format: `<nonce>.<timestamp>.<hmac>`
 */
export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(16).toString("hex"); // 32 hex chars, no dots
  const timestamp = String(Date.now());
  const signature = hmac(nonce, timestamp);
  return `${nonce}.${timestamp}.${signature}`;
}

/**
 * Validate a CSRF token received in the X-CSRF-Token header.
 *
 * Returns false if:
 *  - Token is missing or malformed
 *  - HMAC signature does not match
 *  - Token has expired (> 24 h)
 */
export function validateCsrfToken(token: string | null | undefined): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [nonce, timestamp, signature] = parts;

  // Reject expired tokens.
  const issuedAt = Number(timestamp);
  if (isNaN(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) return false;

  // Constant-time HMAC comparison.
  const expected = hmac(nonce, timestamp);

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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
