import type { Message } from "@/types/chat"
import type { UIMessage } from "@/hooks/use-chat-state"

/** Converts a raw API Message into a UIMessage ready for rendering. */
export function toUIMessage(raw: Message): UIMessage {
  return {
    ...raw,
    isLoading: false,
    isThinkingInProgress: false,
  }
}

export function toUIMessages(raw: Message[]): UIMessage[] {
  return raw.map(toUIMessage)
}
