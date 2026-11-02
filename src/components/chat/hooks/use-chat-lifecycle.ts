import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { mergeInjectedMessages } from "@/lib/agent-card-messages";
import { publishChatContext, clearChatContext } from "@/lib/chat-context-store";
import type { StreamState } from "@/hooks/use-streaming-chat";
import type { UIMessage } from "@/types/chat";

/**
 * Appends host-supplied local messages (the agent card) as soon as they arrive — merged
 * during render, not in an effect. Call it after useChatState so, on a fresh mount, its
 * "no chat yet" reset cannot clear them (that reset never clears a first-mounted view).
 */
export function useInjectedMessages(
  injectedMessages: UIMessage[] | null | undefined,
  setMessages: Dispatch<SetStateAction<UIMessage[]>>,
  onInjectedMessagesConsumed: (() => void) | undefined,
) {
  const [mergedInjected, setMergedInjected] = useState<UIMessage[] | null>(null);
  if (injectedMessages && injectedMessages.length > 0 && injectedMessages !== mergedInjected) {
    setMergedInjected(injectedMessages);
    setMessages((prev) => mergeInjectedMessages(prev, injectedMessages));
  }
  // Tell the host they are in; its state update cannot happen during this render.
  useEffect(() => {
    if (mergedInjected) onInjectedMessagesConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- notify once per merged batch
  }, [mergedInjected]);
}

/**
 * Hands the live messages to the Context panel, which renders in the app shell outside
 * this tree. Cleared on unmount (only if still ours) so a closed chat leaves no stale data.
 */
export function useChatContextPublish(chatId: string | undefined, messages: UIMessage[]) {
  useEffect(() => {
    publishChatContext({ chatId, messages });
  }, [chatId, messages]);
  // Separate from the publish above so a normal message update doesn't clear and
  // republish (which would flash the panel's empty state); this only runs on
  // unmount or when the chat changes.
  useEffect(() => () => clearChatContext(chatId), [chatId]);
}

// ── Tab / page-reload resilience ──────────────────────────────────────────

export function useStreamTabResilience(
  streamState: StreamState,
  messages: UIMessage[],
  refreshMessages: () => Promise<unknown>,
) {
  // Warn before page reload when a stream is active so the user doesn't
  // accidentally lose a response that's still being generated.
  useEffect(() => {
    const isActive = streamState === "streaming" || streamState === "waiting"
    if (!isActive) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [streamState])

  // When the browser tab regains focus, check if the SSE connection died
  // silently while the tab was hidden (e.g. server timeout, proxy close).
  // If there's a stuck loading message but no active stream, reload from the
  // API so the user sees whatever the backend managed to save.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      const hasStuckMsg = messages.some((m) => m.isLoading)
      const streamNotActive = streamState !== "streaming" && streamState !== "waiting"
      if (hasStuckMsg && streamNotActive) {
        void refreshMessages()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [messages, streamState, refreshMessages])
}
