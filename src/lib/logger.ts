/**
 * Production-safe structured logger.
 *
 * - debug / info  → no-op in production
 * - warn / error  → always fire (sanitized)
 */

type LogLevel = "log" | "info" | "warn" | "error" | "debug";

const SENSITIVE_KEYS = [
  "password",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "csrf",
  "authorization",
  "cookie",
  "session",
] as const;

// Token-looking strings anywhere in a value: bearer credentials and JWTs.
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g;
const MAX_DEPTH = 4;

const sensitiveKey = (key: string) => {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s.toLowerCase()));
};

/**
 * Redact secrets before anything is logged: values under sensitive keys (at any
 * depth, `accessToken` included), and bearer tokens / JWTs inside strings.
 * Errors keep their name and redacted message.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.replace(BEARER, "Bearer [REDACTED]").replace(JWT, "[REDACTED_JWT]");
  if (value instanceof Error) return { name: value.name, message: redact(value.message) };
  if (typeof value !== "object" || value === null) return value;
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = sensitiveKey(key) ? "[REDACTED]" : redact(v, depth + 1);
  }
  return out;
}

class Logger {
  private readonly isDevelopment = process.env.NODE_ENV === "development";

  private sanitizeArgs(args: unknown[]): unknown[] {
    return args.map((arg) => redact(arg));
  }

  /**
   * One structured, redacted JSON line (always fires): `{ event, ...fields }`.
   * Use for things to count in the log drain — login, refresh and gate failures.
   */
  event(name: string, fields: Record<string, unknown> = {}, level: "warn" | "error" = "warn"): void {
    const line = JSON.stringify({ event: name, ...(redact(fields) as Record<string, unknown>) });
    if (level === "error") console.error(line);
    else console.warn(line);
  }

  log(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.debug(...this.sanitizeArgs(args));
    }
  }

  info(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.info(...this.sanitizeArgs(args));
    }
  }

  /** Always fires - even in production. */
  warn(...args: unknown[]): void {
    console.warn(...this.sanitizeArgs(args));
  }

  /** Always fires - even in production. */
  error(...args: unknown[]): void {
    console.error(...this.sanitizeArgs(args));
  }

  debug(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.debug(...this.sanitizeArgs(args));
    }
  }
}

export const logger = new Logger();
