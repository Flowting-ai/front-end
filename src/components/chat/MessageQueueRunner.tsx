"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useOrg } from "@/context/org-context";
import { useCreditStatus } from "@/hooks/use-credit-status";
import { useStreamingChat } from "@/hooks/use-streaming-chat";
import { trackBrowserEvent } from "@/lib/analytics/events";
import {
  hasQueuedMessages,
  queuedChatsReadyForBackground,
  subscribeQueue,
  takeNextQueuedMessage,
  type QueuedMessage,
} from "@/lib/message-queue";
import { completeStream, registerStream } from "@/lib/stream-registry";
import { buildTurnOptions } from "@/lib/turn-options";
import type { UIMessage } from "@/types/chat";

interface BackgroundSend {
  chatId:  string;
  message: QueuedMessage;
}

/**
 * Sends the next queued message of a chat that isn't on screen once the reply it
 * was waiting on has finished — by then the user may be in another chat, or
 * another tab. Mounted once for the app; see message-queue.ts. (A chat on
 * screen sends its own, with the usual streaming UI.)
 */
export function MessageQueueRunner() {
  const [sends, setSends] = useState<BackgroundSend[]>([]);
  const [hasQueued, setHasQueued] = useState(false);
  const creditStatus = useCreditStatus();
  const { plan } = useOrg();
  // Out of credits or locked: messages stay queued; the chat's own view shows why.
  const blocked = creditStatus.blocked || plan?.poolStatus === "locked";

  useEffect(() => {
    // Taking a message notifies the queue, which calls straight back in here.
    // Passes never nest — a nested one would see the chat as idle before its
    // stream is reserved and send its next message alongside — they rerun.
    let reconciling = false;
    let again = false;
    const reconcile = () => {
      if (reconciling) {
        again = true;
        return;
      }
      reconciling = true;
      try {
        do {
          again = false;
          setHasQueued(hasQueuedMessages());
          if (blocked) break;
          for (const chatId of queuedChatsReadyForBackground()) {
            const message = takeNextQueuedMessage(chatId);
            if (!message) continue;
            // Reserved now, ahead of the request: the chat counts as busy (one
            // message per reply), and opening it meanwhile waits for this reply.
            registerStream(chatId);
            setSends((prev) => [...prev, { chatId, message }]);
          }
        } while (again);
      } finally {
        reconciling = false;
      }
    };
    reconcile();
    return subscribeQueue(reconcile);
  }, [blocked]);

  // A reload would lose what's still queued or being sent from here.
  const busy = hasQueued || sends.length > 0;
  useEffect(() => {
    if (!busy) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [busy]);

  return (
    <>
      {sends.map((send) => (
        <BackgroundSendTurn
          key={send.message.id}
          send={send}
          onDone={() => setSends((prev) => prev.filter((s) => s !== send))}
        />
      ))}
    </>
  );
}

// Nothing on screen to update: the chat reloads from the API when opened.
const IGNORE_MESSAGES: React.Dispatch<React.SetStateAction<UIMessage[]>> = () => {};

/** One queued message going out, on its own streaming hook (one stream each). */
function BackgroundSendTurn({ send, onDone }: { send: BackgroundSend; onDone: () => void }) {
  const { refreshUser } = useAuth();
  const { moveToTop } = useChatHistoryContext();
  const { chatId, message } = send;
  const { settings, modelId, endpoint, onStopBackend } = message.context;

  const { fetchAiResponse } = useStreamingChat({
    setMessages: IGNORE_MESSAGES,
    onChatMoveToTop: moveToTop,
    onStreamDone: refreshUser,
    ...(endpoint ? { endpoint } : {}),
    ...(onStopBackend ? { onStopBackend } : {}),
  });

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Strict Mode runs effects twice; the message goes out once.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const files = message.attachments.map((a) => a.file);
    const options = buildTurnOptions(settings, {
      files,
      mentionedPinIds: message.mentionedPins.map((p) => p.id),
    });

    // Analytics: same event and metadata as a send from the chat itself.
    trackBrowserEvent("chat_message_sent", {
      has_agent: !!settings.personaId,
      model_pick: "manual",
      model_id: modelId != null ? String(modelId) : undefined,
      web_search: settings.webSearch,
      reasoning: settings.reasoningEffort === undefined ? undefined : settings.reasoningEffort !== null,
      attachment_count: files.length,
      pin_count: options.pinIds?.length ?? 0,
      queued: true,
    });

    fetchAiResponse(message.content, chatId, `queued-${message.id}`, modelId, options)
      // fetchAiResponse settles every stream itself; this only frees the
      // reservation if it threw before getting that far.
      .catch(() => completeStream(chatId, "error"))
      .finally(() => onDoneRef.current());
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sends once, on mount
  }, []);

  return null;
}
