import { CHAT_ROUTE } from '@/lib/routes'

/**
 * A new chat with `prompt` waiting in the composer. The chat page reads `?prompt=`, fills the
 * new-chat input (it does not send) and drops the param. Blank prompts open a plain new chat.
 */
export function buildChatPromptUrl(prompt: string): string {
  const text = prompt.trim()
  return text ? `${CHAT_ROUTE}?${new URLSearchParams({ prompt: text }).toString()}` : CHAT_ROUTE
}
