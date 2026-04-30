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

class Logger {
  private readonly isDevelopment = process.env.NODE_ENV === "development";

  private sanitizeArgs(args: unknown[]): unknown[] {
    return args.map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        const sanitized = { ...(arg as Record<string, unknown>) };
        for (const key of SENSITIVE_KEYS) {
          if (key in sanitized) {
            sanitized[key] = "[REDACTED]";
          }
        }
        return sanitized;
      }
      return arg;
    });
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

  /** Always fires — even in production. */
  warn(...args: unknown[]): void {
    console.warn(...this.sanitizeArgs(args));
  }

  /** Always fires — even in production. */
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
