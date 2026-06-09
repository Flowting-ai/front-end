import crypto from "crypto";

const CSRF_SECRET = process.env.CSRF_SECRET ?? process.env.AUTH0_SECRET ?? "";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;

function hmac(nonce: string, timestamp: string): string {
  return crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(`${nonce}:${timestamp}`)
    .digest("hex");
}

export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = String(Date.now());
  const signature = hmac(nonce, timestamp);
  return `${nonce}.${timestamp}.${signature}`;
}

export function validateCsrfToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, timestamp, signature] = parts;
  const issuedAt = Number(timestamp);
  if (isNaN(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) return false;
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
