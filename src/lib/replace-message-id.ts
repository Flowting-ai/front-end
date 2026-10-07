/**
 * Which backend turn an edit or a regenerate replaces (`replace_message_id`),
 * so the old turn doesn't stay in the chat's history next to the new one.
 */

import type { UIMessage } from '@/types/chat'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The bare backend id for a message, or undefined when it has none yet.
 *
 * User messages loaded from history have ids like "{uuid}-prompt" (added by
 * normalizeMessages) while the backend wants the bare UUID, so the suffix is
 * stripped. Ids the backend never issued — "temp-…", "optimistic-…",
 * "loading-…", local rows — give undefined.
 */
export function resolveReplaceMessageId(messageId: string | null | undefined): string | undefined {
  if (!messageId) return undefined
  const bareMessageId = messageId.endsWith('-prompt')
    ? messageId.slice(0, messageId.length - '-prompt'.length)
    : messageId
  if (
    bareMessageId.startsWith('temp-') ||
    bareMessageId.startsWith('optimistic-') ||
    bareMessageId.startsWith('loading-')
  ) return undefined
  return UUID_RE.test(bareMessageId) ? bareMessageId : undefined
}

/** True when the user message carried uploaded files. */
export function hasUploadedFiles(message: UIMessage): boolean {
  return (message.attachments?.length ?? 0) > 0 ||
    (message.file_attachments ?? []).some((a) => a.origin === 'uploaded' || a.origin === 'user')
}

/**
 * The turn an edit of `messageId` replaces. A turn is one backend row shared by the
 * user message and its reply, and only the reply's id is swapped for the real one
 * when a stream ends (`message_saved`) — so after an edit, the user message still
 * carries the id of the turn that was just replaced. The reply that follows it is
 * the reliable source; the message's own id is the fallback (no reply yet).
 */
export function resolveEditReplaceId(
  messages: readonly UIMessage[],
  messageId: string,
): string | undefined {
  const idx = messages.findIndex((m) => m.id === messageId)
  if (idx === -1) return resolveReplaceMessageId(messageId)
  const next = messages[idx + 1]
  const reply = next?.role === 'assistant' ? next : undefined
  return resolveReplaceMessageId(reply?.id) ?? resolveReplaceMessageId(messageId)
}

/**
 * What a regenerate re-sends: the last user message, and the turn to replace —
 * the trailing reply's id, falling back to the user message's own.
 *
 * A turn whose message had uploaded files is not replaced (the regenerate is
 * appended as before): the backend soft-deletes the replaced turn's files, and
 * a regenerate doesn't upload them again.
 */
export function getRegenerateTarget(
  messages: readonly UIMessage[],
): { userMessage: UIMessage; replaceMessageId: string | undefined } | null {
  const userIdx = messages.findLastIndex((m) => m.role === 'user')
  if (userIdx === -1) return null
  const userMessage = messages[userIdx]
  if (userMessage.localOnly) return null
  if (hasUploadedFiles(userMessage)) return { userMessage, replaceMessageId: undefined }
  const reply = messages.slice(userIdx + 1).findLast((m) => m.role === 'assistant')
  return {
    userMessage,
    replaceMessageId: resolveReplaceMessageId(reply?.id) ?? resolveReplaceMessageId(userMessage.id),
  }
}
