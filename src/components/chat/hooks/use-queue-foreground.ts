import { useEffect, useState } from "react";
import { useChatQueue } from "@/hooks/use-message-queue";
import { newChatQueueKey, setQueueForeground, type QueuedMessage } from "@/lib/message-queue";

export const NO_QUEUED_MESSAGES: readonly QueuedMessage[] = [];

/**
 * This view's key for its chat's queued messages (see message-queue.ts): the
 * chat id, or — until a new chat's first reply brings one — a stand-in that
 * then moves to it. Also tells the queue which chat is on screen here: that
 * chat's queued message is sent by this view, any other by
 * MessageQueueRunner in the background.
 */
export function useQueueForeground(chatId: string | undefined) {
  const [newChatKey] = useState(newChatQueueKey);
  const queueKey = chatId ?? newChatKey;
  const chatQueue = useChatQueue(queueKey);
  const queuedMessages = chatQueue?.messages ?? NO_QUEUED_MESSAGES;
  const [queueViewToken] = useState(() => Symbol("chat-view"));
  useEffect(() => {
    setQueueForeground(queueViewToken, queueKey);
  }, [queueViewToken, queueKey]);
  useEffect(() => () => setQueueForeground(queueViewToken, null), [queueViewToken]);
  return { newChatKey, queueKey, chatQueue, queuedMessages };
}
