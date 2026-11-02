import { friendlyModelError } from "@/lib/model-error"

// ── Error markers ─────────────────────────────────────────────────────────────

/**
 * Marks an Error's `message` as already user-facing copy — produced by
 * `friendlyModelError` at the point of failure, when the real status code /
 * raw backend text was still available. The outer catch checks this before
 * deciding whether to translate: re-running an already-friendly message
 * through `friendlyModelError` again would match no known pattern and
 * flatten it into the generic fallback, destroying the specific reason.
 */
export class FriendlyStreamError extends Error {
  readonly alreadyFriendly = true as const
}

/** The agent chat endpoint answers 409 for an agent that can't be chatted with right now
 *  (no published version, paused, or disabled) — not for a retired model, which is what
 *  the generic 409 copy says. */
const AGENT_UNAVAILABLE_MESSAGE = "This agent isn't available to chat right now — it may not be published yet, or it was paused or disabled."

/** Library refusals checked before the stream starts. Their `message` is written for people
 *  ("This file isn't ready yet.", "A message can include up to 10 files."), so it is shown as is. */
const LIBRARY_SEND_CODES = new Set(["not_ready", "too_many_files", "file_gone", "file_locked"])

export function librarySendRefusal(rawText: string): string | null {
  try {
    const body: unknown = JSON.parse(rawText)
    if (!body || typeof body !== "object") return null
    const { code, message } = body as { code?: unknown; message?: unknown }
    return typeof code === "string" && LIBRARY_SEND_CODES.has(code) && typeof message === "string" && message ? message : null
  } catch {
    return null
  }
}

export function streamFailureMessage(rawText: string, status: number, endpoint: string): string {
  const refusal = librarySendRefusal(rawText)
  if (refusal) return refusal
  if (status === 409 && endpoint.includes("persona")) return AGENT_UNAVAILABLE_MESSAGE
  return friendlyModelError(rawText, status)
}

/** A 401 (or auth-flavored error text) from the XHR transport — the caller
 *  should sign the user out rather than show any chat error content. */
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Signing you out…"

export class AuthExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE)
  }
}

/** Error text that means the session is gone. Takes lower-cased text. */
export function isAuthErrorText(lower: string): boolean {
  return lower.includes("token expired") ||
    lower.includes("not authenticated") ||
    lower.includes("unauthorized")
}

/** Tells the app to sign the user out. */
export function dispatchSessionExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:session-expired"))
  }
}
