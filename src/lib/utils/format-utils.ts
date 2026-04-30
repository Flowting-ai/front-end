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
