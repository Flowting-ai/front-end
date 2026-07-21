/**
 * User-facing translations for raw LLM/provider errors surfaced during chat
 * streaming — SSE `error` events, XHR/network failures, and the
 * "[Response interrupted: ...]" marker the backend embeds directly in
 * message content when a stream dies mid-response (e.g.
 * "[Response interrupted: 404: Error code: 404 - {'error': {'message':
 * 'No endpoints found for anthropic/claude-sonnet-4.', ...}}]").
 *
 * Frontend-only: the backend keeps sending its raw text; this module is the
 * single place that turns it into copy a non-developer can act on before it
 * reaches the screen. Unrecognized status codes/text always fall back to a
 * generic, professional message instead of leaking status codes or SDK/
 * provider wording — so a *future* status code with no dedicated entry
 * below still reads fine to the user.
 */

import { getFriendlyHttpErrorText } from "@/lib/http-errors";

export const MODEL_UNRESPONSIVE_MESSAGE =
  "This model is unresponsive right now. Please try again or switch to another model.";
const MODEL_TOO_LARGE_MESSAGE =
  "Your message is too large for this model. Try shortening it or removing attachments.";
const MODEL_GENERIC_ERROR_MESSAGE =
  "Something went wrong generating a response. Please try again.";
const CHAT_NOT_FOUND_MESSAGE =
  "This chat no longer exists — it may have been deleted. Start a new chat to continue.";

// Keyed by HTTP status code. Add an entry here for any new status-specific
// copy; anything not listed falls back to a generic message below instead
// of leaking the raw code/text.
const STATUS_MESSAGES: Record<number, string> = {
  400: "That request couldn't be processed. Try rephrasing your message.",
  401: "There's an authentication issue reaching this model right now. Please try again shortly.",
  403: "Access to this model was denied. Try a different model or contact support.",
  404: MODEL_UNRESPONSIVE_MESSAGE, // e.g. "No endpoints found for <model>" — model discontinued/unavailable
  408: MODEL_UNRESPONSIVE_MESSAGE,
  409: "This model is no longer available. Try a different model.",
  413: MODEL_TOO_LARGE_MESSAGE,
  422: "The request couldn't be understood. Try rephrasing your message.",
  429: "This model is receiving too many requests right now. Please wait a moment and try again.",
  500: "The model provider ran into an unexpected error. Please try again.",
  502: MODEL_UNRESPONSIVE_MESSAGE,
  503: MODEL_UNRESPONSIVE_MESSAGE,
  504: MODEL_UNRESPONSIVE_MESSAGE,
};

// Non-HTTP failure phrasing (timeouts, dropped connections, retries
// exhausted) that the backend describes in its own wording rather than a
// status code.
const UNRESPONSIVE_MARKERS = [
  "no endpoints found",
  "no endpoint found",
  "timeout",
  "timed out",
  "connection",
  "stream error",
  "upstream unavailable",
  "llm request failed",
  "didn't respond",
  "did not respond",
  "econnreset",
  "network error",
];

// Matches the "<status>: <message>" prefix the backend uses for HTTP errors,
// e.g. "404: Error code: 404 - {...}".
const STATUS_PREFIX_RE = /(?:^|\s)(\d{3})\s*:/;

/**
 * Translate a raw provider/stream error string into user-facing copy.
 * `statusCode`, if known, takes priority; otherwise a leading "<code>: "
 * prefix in `raw` is used. Falls back to a generic message for anything
 * unrecognized.
 */
export function friendlyModelError(raw?: string | null, statusCode?: number): string {
  const text = raw ?? "";
  const lower = text.toLowerCase();

  // Checked before the status-code table below: a 404 from the chat-stream
  // endpoint is never "the model 404'd" — it means the chat itself is gone
  // (deleted, or never belonged to this viewer) — a specific, actionable
  // reason worth distinguishing from the generic "model unresponsive" copy
  // a bare 404 would otherwise get.
  if (lower.includes("chat not found")) {
    return CHAT_NOT_FOUND_MESSAGE;
  }

  const code = statusCode ?? (() => {
    const match = STATUS_PREFIX_RE.exec(text);
    return match ? Number(match[1]) : undefined;
  })();

  if (code !== undefined) {
    if (STATUS_MESSAGES[code]) return STATUS_MESSAGES[code];
    // Any status code without model-specific copy still gets proper per-code
    // wording from the shared table — never a bare code or generic text.
    return getFriendlyHttpErrorText(code);
  }

  if (UNRESPONSIVE_MARKERS.some((marker) => lower.includes(marker))) {
    return MODEL_UNRESPONSIVE_MESSAGE;
  }

  return MODEL_GENERIC_ERROR_MESSAGE;
}

// Anchored to the end of the string: the backend appends this marker after
// all other content for the round, so everything from "[Response
// interrupted:" to the final "]" is the error blob, however many nested
// braces/quotes it contains.
const RESPONSE_INTERRUPTED_RE = /\n*\[Response interrupted:\s*([\s\S]*)\]\s*$/;

/**
 * Detects a trailing "[Response interrupted: ...]" marker in persisted
 * message content and replaces it with one friendly sentence. Safe to run
 * on any content — it's a no-op when the marker isn't present, so it can
 * sit in the general markdown pipeline.
 */
export function stripResponseInterruptedMarker(content: string): string {
  const match = RESPONSE_INTERRUPTED_RE.exec(content);
  if (!match) return content;
  const before = content.slice(0, match.index).replace(/\s+$/, "");
  const friendly = friendlyModelError(match[1]);
  return before ? `${before}\n\n${friendly}` : friendly;
}
