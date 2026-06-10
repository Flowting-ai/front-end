export function maskEmail(email: string | null | undefined): string {
  if (!email) return "your@email.com";
  const atIndex = email.indexOf("@");
  if (atIndex <= 3) return email;
  return email.slice(0, 3) + "*".repeat(atIndex - 3) + email.slice(atIndex);
}

export function normalizePct(value: number | null | undefined, fallback: number): number;
export function normalizePct(value: number | null | undefined, fallback?: null): number | null;
export function normalizePct(
  value: number | null | undefined,
  fallback: number | null = null,
): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  const pct = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(pct, 100));
}

/**
 * Parse a timestamp coming from the backend into a Date.
 *
 * Backend datetimes are UTC, but some are serialised WITHOUT a timezone
 * designator (e.g. "2026-06-10T12:00:00"). `new Date()` interprets such strings
 * as the browser's LOCAL time, which makes timestamps appear "stuck in UTC"
 * (off by the user's offset). We append 'Z' to tz-less date-times so they parse
 * as UTC and then render correctly in the user's local zone.
 */
export function parseServerDate(value: string | number | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== "string") return null;
  let s = value.trim();
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  const isDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s);
  if (isDateTime && !hasTz) s = s.replace(" ", "T") + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a backend timestamp as "Jun 10 · 3:45 PM" in the user's LOCAL timezone
 * (UTC-aware — see parseServerDate). Used for version + knowledge-file dates.
 */
export function formatServerDateTime(
  value: string | number | null | undefined,
  fallback = "",
): string {
  const d = parseServerDate(value);
  if (!d) return fallback;
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export interface FormatDateOptions {
  ordinal?: boolean;
  year?: boolean;
  fallback?: string;
}

function ordinalSuffix(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function formatDate(
  value: string | number | null | undefined,
  options: FormatDateOptions = {},
): string {
  const { ordinal = false, year = false, fallback = "" } = options;
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const parsed = parseServerDate(value);
  if (!parsed) return fallback;
  if (ordinal) {
    const day = parsed.getDate();
    const month = parsed.toLocaleString("en-US", { month: "short" });
    return `${day}${ordinalSuffix(day)} ${month}`;
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
  });
}
