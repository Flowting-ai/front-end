/**
 * Pure decisions for the persona-share accept page (`/share/[id]`): which
 * state a preview failure shows, what an accept failure does, and a guarded
 * expiry date.
 */

type StatusError = { status?: unknown; message?: unknown }

function statusOf(err: unknown): number | null {
  if (!err || typeof err !== "object") return null
  const status = (err as StatusError).status
  return typeof status === "number" ? status : null
}

function messageOf(err: unknown): string | null {
  if (!err || typeof err !== "object") return null
  const message = (err as StatusError).message
  return typeof message === "string" && message.trim() ? message : null
}

export type PreviewFailure =
  | { state: "not_found" }
  | { state: "expired" }
  | { state: "error"; message: string }

export function previewFailure(err: unknown): PreviewFailure {
  const status = statusOf(err)
  if (status === 404) return { state: "not_found" }
  if (status === 410) return { state: "expired" }
  return { state: "error", message: (status !== null && messageOf(err)) || "Something went wrong. Please try again." }
}

export type AcceptFailure =
  | { kind: "expired" }
  | { kind: "toast"; reason: "no_credits" | "api" | "unknown"; message: string }

export function acceptFailure(err: unknown): AcceptFailure {
  const status = statusOf(err)
  if (status === 410) return { kind: "expired" }
  if (status === 402) {
    return { kind: "toast", reason: "no_credits", message: "This share has no credits remaining — the agent can no longer be accepted." }
  }
  if (status !== null) return { kind: "toast", reason: "api", message: messageOf(err) ?? "Failed to accept agent. Please try again." }
  return { kind: "toast", reason: "unknown", message: "Failed to accept agent. Please try again." }
}

/** "October 14, 2026", or "No expiry" for a missing or unparseable date. */
export function formatShareExpiry(iso: string | null | undefined, locale?: string): string {
  if (!iso) return "No expiry"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "No expiry"
  return date.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })
}
