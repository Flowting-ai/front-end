/**
 * The form fields each backend chat endpoint accepts. Since 19 Oct the backend
 * answers `400 bad_request` to any other field (services/chat/router.py
 * CREATE_FIELDS / STREAM_FIELDS), where before it dropped them silently. Every send is filtered through these
 * lists, so a field the backend does not read yet stays in the browser instead
 * of breaking the send.
 */

const CHAT_CREATE = [
  "input", "model_id", "algorithm", "pin_ids", "system_instruction", "thinking", "effort",
  // persona_id is an agent VERSION id; back-end 4495366a restored it on both routes.
  "project_id", "persona_id", "files", "libraryFileIds", "saveToLibrary", "libraryDontSave", "librarySourcesOff",
]

export const CHAT_CREATE_FIELDS: ReadonlySet<string> = new Set(CHAT_CREATE)
export const CHAT_STREAM_FIELDS: ReadonlySet<string> = new Set([...CHAT_CREATE, "reference_message_id", "replace_message_id"])

/** Removes every field the endpoint does not accept, in place, and returns the same body. */
export function keepAcceptedFields<T extends FormData | URLSearchParams>(body: T, accepted: ReadonlySet<string>): T {
  for (const key of new Set(body.keys())) {
    if (!accepted.has(key)) body.delete(key)
  }
  return body
}
