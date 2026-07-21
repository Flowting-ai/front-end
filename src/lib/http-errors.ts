/**
 * Canonical, user-facing copy for every standard HTTP status code (4xx/5xx).
 * The single source of truth for "what does this status code mean to a
 * non-technical user" — `friendlyApiError` (REST calls) and
 * `friendlyModelError` (chat streaming) both fall back to this table for any
 * code that doesn't already have more specific, context-aware wording, so a
 * status code never reaches the screen as a bare number or a generic
 * "something went wrong."
 */

export interface FriendlyHttpError {
  title: string
  description: string
}

const CLIENT_ERROR_MESSAGES: Record<number, FriendlyHttpError> = {
  400: { title: "That request didn't go through", description: "Something about it wasn't formatted correctly. Please try again." },
  401: { title: "You've been signed out", description: "Your session has expired. Please sign in again to continue." },
  402: { title: "Payment required", description: "This needs an active plan or payment to continue. Check your billing settings." },
  403: { title: "You don't have access", description: "You don't have permission to do that. Contact an admin if this seems wrong." },
  404: { title: "We couldn't find that", description: "It may have been moved, deleted, or never existed." },
  405: { title: "That action isn't allowed", description: "This isn't supported here. Try refreshing the page." },
  406: { title: "Couldn't complete that request", description: "The server couldn't respond in a format we support. Please try again." },
  407: { title: "Network authentication required", description: "A network proxy is blocking this request. Check your network settings." },
  408: { title: "That took too long", description: "The request timed out. Check your connection and try again." },
  409: { title: "That's out of date", description: "This conflicts with a more recent change. Refresh the page and try again." },
  410: { title: "No longer available", description: "This has been permanently removed." },
  411: { title: "Missing information", description: "The request was missing something it needed. Please try again." },
  412: { title: "Couldn't complete that", description: "A required condition wasn't met. Refresh the page and try again." },
  413: { title: "That's too large", description: "Try a smaller file or a shorter message." },
  414: { title: "That request was too long", description: "Please try again with less information." },
  415: { title: "File type not supported", description: "That file or content type isn't supported here." },
  416: { title: "Couldn't retrieve that", description: "The requested portion of the file isn't available." },
  417: { title: "Couldn't complete that", description: "A requirement for this request wasn't met. Please try again." },
  418: { title: "Unexpected response", description: "The server responded in an unexpected way. Please try again." },
  421: { title: "Misdirected request", description: "The request went to the wrong place. Please try again." },
  422: { title: "Check what you entered", description: "Some of the information provided isn't valid. Please review and try again." },
  423: { title: "This is locked", description: "That item is currently locked and can't be changed right now." },
  424: { title: "A related step failed", description: "This depended on another action that didn't succeed. Please retry." },
  425: { title: "Too soon", description: "That was sent before the server was ready. Please try again in a moment." },
  426: { title: "Update required", description: "Please refresh the page for the latest version and try again." },
  428: { title: "Missing a required step", description: "Please refresh the page and try again." },
  429: { title: "Slow down a little", description: "You're sending requests too quickly. Please wait a moment and try again." },
  431: { title: "That request was too large", description: "Please try again with less information." },
  451: { title: "Not available in your region", description: "This content isn't available for legal reasons where you are." },
}

const SERVER_ERROR_MESSAGES: Record<number, FriendlyHttpError> = {
  500: { title: "Something went wrong on our end", description: "We hit an unexpected error. Please try again in a moment." },
  501: { title: "Not supported yet", description: "This feature isn't available yet. Please check back later." },
  502: { title: "We're having trouble connecting", description: "One of our services didn't respond correctly. Please try again shortly." },
  503: { title: "Temporarily unavailable", description: "This is down for maintenance or under heavy load. Please try again in a few minutes." },
  504: { title: "The server took too long to respond", description: "Please try again — if this keeps happening, the service may be under heavy load." },
  505: { title: "Couldn't complete that", description: "Please refresh the page and try again." },
  506: { title: "Server configuration issue", description: "Something's misconfigured on our end. Please try again shortly." },
  507: { title: "Out of storage", description: "The server ran out of space to complete this. Please try again later." },
  508: { title: "Something looped", description: "The server got stuck processing this request. Please try again." },
  510: { title: "Server configuration issue", description: "Additional configuration is needed on our end. Please try again shortly." },
  511: { title: "Network sign-in required", description: "You may need to sign in to your network before continuing." },
}

const GENERIC_CLIENT: FriendlyHttpError = {
  title: "That request didn't go through",
  description: "We couldn't complete that action. Please check your input and try again.",
}
const GENERIC_SERVER: FriendlyHttpError = {
  title: "Something went wrong on our end",
  description: "We hit an unexpected problem. Please try again in a moment.",
}

/** Looks up the friendly {title, description} pair for an HTTP status code. */
export function getFriendlyHttpError(status?: number): FriendlyHttpError {
  if (status == null) return GENERIC_SERVER
  if (CLIENT_ERROR_MESSAGES[status]) return CLIENT_ERROR_MESSAGES[status]
  if (SERVER_ERROR_MESSAGES[status]) return SERVER_ERROR_MESSAGES[status]
  return status >= 500 ? GENERIC_SERVER : GENERIC_CLIENT
}

/** Single-line convenience wrapper for call sites that just want one string. */
export function getFriendlyHttpErrorText(status?: number): string {
  const { title, description } = getFriendlyHttpError(status)
  return `${title}. ${description}`
}
