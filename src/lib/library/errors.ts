// How a failed Library call turns into something the person reads, and which failures are worth
// repeating. The UI branches on the error's `code` and status, never on message text; the message
// is only a fallback. Nothing here shows raw server text or a file name.

import { ApiError } from "@/lib/api/client";
import { MESSAGES } from "./messages";

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** The file exists but the viewer has no access: show the locked page with Request access. */
export function isLockedError(error: unknown): boolean {
  return isApiError(error) && (error.code === "file_locked" || (error.status === 403 && error.code === "api_error"));
}

/** Deleted, never existed, or not the viewer's to see in Trash: show "No longer available". */
export function isGoneError(error: unknown): boolean {
  return isApiError(error) && (error.code === "file_gone" || error.status === 404 || error.status === 410);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Short user-facing text for a failed action. `fallback` is the action-specific "Couldn't ... Nothing changed." line. */
export function libraryErrorMessage(error: unknown, fallback: string = MESSAGES.genericFailure): string {
  if (!isApiError(error)) return fallback;
  switch (error.code) {
    case "only_owner":
    case "forbidden":
      return MESSAGES.onlyOwner;
    case "not_a_member":
      return MESSAGES.onlyMembers;
    case "already_has_access":
      // The server names the person ("Maya can already open this file.") from the workspace member list.
      return error.message || fallback;
    case "file_locked":
      return MESSAGES.lockedTitle;
    case "file_gone":
      return MESSAGES.goneTitle;
    default:
      break;
  }
  if (error.status === 429) return "You're doing that too quickly. Wait a moment and try again.";
  return fallback;
}

/** React Query retry policy: repeat only failures that can succeed (network blips, 408, 429, 5xx), twice at most; never a 4xx. */
export function libraryRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (isApiError(error)) return error.retryable;
  return !isAbortError(error);
}
