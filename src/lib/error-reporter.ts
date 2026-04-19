"use client";

/**
 * Error reporter — sends structured incident reports to a Discord webhook
 * so the dev team gets real-time alerts when users hit critical failures.
 *
 * Set NEXT_PUBLIC_DISCORD_ERROR_WEBHOOK_URL in your environment to enable.
 */

const WEBHOOK_URL = process.env.NEXT_PUBLIC_DISCORD_ERROR_WEBHOOK_URL ?? "";

/** How often (ms) we allow reports for the *same* error signature. */
const DEDUP_WINDOW_MS = 60_000;
const recentReports = new Map<string, number>();

export type ErrorSeverity = "critical" | "error" | "warning";

export interface ErrorReport {
  /** Short human-readable title shown in the alert embed. */
  title: string;
  /** The raw or friendly error message. */
  message: string;
  severity: ErrorSeverity;
  /** Optional HTTP status code that triggered the error. */
  statusCode?: number;
  /** Which part of the app hit the error. */
  source: string;
  /** Any extra key/value context (endpoint, chatId, etc). */
  metadata?: Record<string, string | number | boolean | null>;
}

function getUserContext(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const ctx: Record<string, string> = {};
  ctx.url = window.location.href;
  ctx.userAgent = navigator.userAgent;
  ctx.timestamp = new Date().toISOString();
  ctx.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  ctx.screenSize = `${window.screen.width}x${window.screen.height}`;
  ctx.viewport = `${window.innerWidth}x${window.innerHeight}`;
  ctx.language = navigator.language;
  return ctx;
}

function getAuthContext(): Record<string, string> {
  // Pull user info from the DOM-accessible auth state without importing
  // heavy context hooks. We read from the cookie / localStorage safely.
  const ctx: Record<string, string> = {};
  try {
    // The auth-context stores user email in React state, but we can read
    // the Auth0 session cookie name to at least confirm session presence.
    const cookies = document.cookie;
    ctx.hasSession = cookies.includes("appSession") ? "yes" : "no";
  } catch {
    // ignore
  }
  return ctx;
}

const SEVERITY_COLOR: Record<ErrorSeverity, number> = {
  critical: 0xff0000, // red
  error: 0xff8c00,    // orange
  warning: 0xffd700,  // yellow
};

const SEVERITY_EMOJI: Record<ErrorSeverity, string> = {
  critical: "🔴",
  error: "🟠",
  warning: "🟡",
};

function buildSignature(report: ErrorReport): string {
  return `${report.source}:${report.title}:${report.statusCode ?? ""}`;
}

function isDuplicate(signature: string): boolean {
  const now = Date.now();
  const last = recentReports.get(signature);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  recentReports.set(signature, now);
  // Prune old entries
  for (const [key, ts] of recentReports) {
    if (now - ts > DEDUP_WINDOW_MS) recentReports.delete(key);
  }
  return false;
}

/**
 * Send an error report to the Discord webhook.
 * Safe to call anywhere — silently no-ops if the webhook isn't configured
 * or the same error was already reported within the dedup window.
 */
export function reportError(report: ErrorReport): void {
  if (!WEBHOOK_URL || typeof window === "undefined") return;

  const signature = buildSignature(report);
  if (isDuplicate(signature)) return;

  const user = getUserContext();
  const auth = getAuthContext();
  const emoji = SEVERITY_EMOJI[report.severity];

  const fields = [
    { name: "Source", value: `\`${report.source}\``, inline: true },
    { name: "Severity", value: `${emoji} ${report.severity.toUpperCase()}`, inline: true },
    ...(report.statusCode
      ? [{ name: "HTTP Status", value: `\`${report.statusCode}\``, inline: true }]
      : []),
    { name: "Message", value: report.message.slice(0, 1024), inline: false },
    { name: "Page URL", value: user.url || "unknown", inline: false },
    { name: "Timestamp", value: user.timestamp || new Date().toISOString(), inline: true },
    { name: "Session", value: auth.hasSession || "unknown", inline: true },
    { name: "Browser", value: formatUserAgent(user.userAgent), inline: true },
    { name: "Screen", value: `${user.screenSize} (viewport ${user.viewport})`, inline: true },
    { name: "Locale", value: `${user.language} / ${user.timezone}`, inline: true },
  ];

  if (report.metadata) {
    const metaLines = Object.entries(report.metadata)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `**${k}:** ${v}`)
      .join("\n");
    if (metaLines) {
      fields.push({ name: "Extra Context", value: metaLines.slice(0, 1024), inline: false });
    }
  }

  const payload = {
    embeds: [
      {
        title: `${emoji} ${report.title}`,
        color: SEVERITY_COLOR[report.severity],
        fields,
        footer: { text: "Souvenir Error Reporter" },
      },
    ],
  };

  // Fire and forget — never let reporting break the app
  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // silently ignore webhook delivery failures
  });
}

function formatUserAgent(ua?: string): string {
  if (!ua) return "unknown";
  // Extract just the browser name + version for readability
  const chrome = ua.match(/Chrome\/([\d.]+)/);
  const firefox = ua.match(/Firefox\/([\d.]+)/);
  const safari = ua.match(/Version\/([\d.]+).*Safari/);
  const edge = ua.match(/Edg\/([\d.]+)/);

  if (edge) return `Edge ${edge[1]}`;
  if (chrome) return `Chrome ${chrome[1]}`;
  if (firefox) return `Firefox ${firefox[1]}`;
  if (safari) return `Safari ${safari[1]}`;
  return ua.slice(0, 80);
}

// ── Convenience helpers ──────────────────────────────────────────────

export function reportSessionExpired(source: string, statusCode?: number): void {
  reportError({
    title: "User Session Expired",
    message:
      "A user's authentication token expired and they were logged out. " +
      "This may indicate the token lifetime is too short or the refresh mechanism failed.",
    severity: "error",
    statusCode,
    source,
    metadata: { action: "auto-logout" },
  });
}

export function reportApiFailure(
  source: string,
  endpoint: string,
  statusCode: number,
  errorText: string,
): void {
  const severity: ErrorSeverity = statusCode >= 500 ? "critical" : "error";
  reportError({
    title: `API ${statusCode} — ${endpoint}`,
    message: errorText.slice(0, 500),
    severity,
    statusCode,
    source,
    metadata: { endpoint },
  });
}
