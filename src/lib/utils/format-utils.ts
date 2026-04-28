/**
 * format-utils.ts
 *
 * Shared formatting utilities extracted from multiple pages/components.
 * All functions are pure, side-effect-free, and fully typed.
 *
 * Consumers:
 *   - maskEmail       → workflows/admin, personas/admin, personas/new/configure
 *   - normalizePct    → auth-context, workflows/admin, personas/admin, settings/usage-and-billing
 *   - formatDate      → workflows/admin, personas/admin, settings/usage-and-billing,
 *                        SelectPinsDialog, SelectChatsDialog
 */

// ---------------------------------------------------------------------------
// maskEmail
// ---------------------------------------------------------------------------

/**
 * Masks the local part of an email address, showing only the first 3
 * characters before the `@` symbol.
 *
 * @example
 *   maskEmail("john.doe@example.com") // → "joh*****@example.com"
 *   maskEmail("ab@example.com")       // → "ab@example.com"  (≤3 chars, returned as-is)
 *   maskEmail(null)                   // → "your@email.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "your@email.com";
  const atIndex = email.indexOf("@");
  if (atIndex <= 3) return email;
  return email.slice(0, 3) + "*".repeat(atIndex - 3) + email.slice(atIndex);
}

// ---------------------------------------------------------------------------
// normalizePct
// ---------------------------------------------------------------------------

/**
 * Normalises a percentage value that the API may return as either a 0–1
 * fraction or a 0–100 integer, clamping the result to [0, 100].
 *
 * Overload 1 – explicit numeric fallback (always returns `number`):
 *   normalizePct(value, 0) → number
 *
 * Overload 2 – no fallback (returns `number | null` for invalid input):
 *   normalizePct(value) → number | null
 *
 * @example
 *   normalizePct(0.75)        // → 75
 *   normalizePct(85)          // → 85
 *   normalizePct(120)         // → 100  (clamped)
 *   normalizePct(undefined)   // → null
 *   normalizePct(undefined, 0)// → 0
 */
export function normalizePct(
  value: number | null | undefined,
  fallback: number,
): number;
export function normalizePct(
  value: number | null | undefined,
  fallback?: null,
): number | null;
export function normalizePct(
  value: number | null | undefined,
  fallback: number | null = null,
): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  const pct = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(pct, 100));
}

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

/** Options for {@link formatDate}. */
export interface FormatDateOptions {
  /**
   * Render the date with an ordinal day suffix: "1st Jan", "22nd Apr".
   * When `false` (default) the locale-aware format is used: "Jan 1".
   */
  ordinal?: boolean;
  /**
   * Include the year in the locale format: "Jan 1, 2025".
   * Only applies when `ordinal` is `false`. Default: `false`.
   */
  year?: boolean;
  /**
   * String to return when the value is absent or not a valid date.
   * Default: `""`.
   */
  fallback?: string;
}

/**
 * Returns an ordinal suffix for a day-of-month integer.
 * @internal
 */
function ordinalSuffix(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

/**
 * Formats a date value as a human-readable string.
 *
 * @param value   - ISO date string, epoch timestamp, or null/undefined.
 * @param options - Formatting options (see {@link FormatDateOptions}).
 *
 * @example
 *   formatDate("2025-01-15")                     // → "Jan 15"
 *   formatDate("2025-01-15", { year: true })      // → "Jan 15, 2025"
 *   formatDate("2025-01-15", { ordinal: true })   // → "15th Jan"
 *   formatDate(undefined, { fallback: "-" })      // → "-"
 *   formatDate("not-a-date")                      // → ""
 */
export function formatDate(
  value: string | number | null | undefined,
  options: FormatDateOptions = {},
): string {
  const { ordinal = false, year = false, fallback = "" } = options;

  if (value == null || value === "") return fallback;
  if (typeof value !== "string" && typeof value !== "number") return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;

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
