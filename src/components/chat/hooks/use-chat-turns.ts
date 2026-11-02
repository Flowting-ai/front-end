import { useCallback, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import { holdQueue } from "@/lib/message-queue";
import type { StreamOutcome } from "@/lib/stream-registry";
import type { TurnInput, TurnRequestOptions } from "@/lib/turn-options";
import { getRegenerateTarget, resolveEditReplaceId } from "@/lib/replace-message-id";
import { trackBrowserEvent, trackFeature } from "@/lib/analytics/events";
import { PINS_ENABLED } from "@/lib/feature-flags";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import type { useChatState } from "@/hooks/use-chat-state";
import type { useStreamingChat } from "@/hooks/use-streaming-chat";
import type { UIMessage } from "@/types/chat";
import type { PendingAttachment } from "../AttachmentManager";

type ChatState = ReturnType<typeof useChatState>;

/**
 * Whether a turn is being sent, and whether the "Save N files to Library?"
 * question is open — both hold the next send back (it queues instead).
 */
export function useTurnGuards(decideSave: (files: File[]) => Promise<void>) {
  // Synchronous reentrancy guard for handleSend/handleRegenerate. `isStreaming` is
  // state-derived and lands a render behind the click, so a double-click (or an
  // Enter-then-click race) within the same tick can slip two fetchAiResponse calls
  // through before the button disables — this ref closes that gap.
  const isSendingRef = useRef(false);
  // isSendingRef for rendering. The streaming hook runs one stream at a time,
  // including one still finishing for a chat the user has since left — a
  // message sent meanwhile is queued until it's free.
  const [hookBusy, setHookBusy] = useState(false);
  const beginTurn = () => {
    isSendingRef.current = true;
    setHookBusy(true);
  };
  const endTurn = () => {
    isSendingRef.current = false;
    setHookBusy(false);
  };
  // Bumped to focus the composer with the caret at the end (see ChatInput).
  const [composerFocusRequest, setComposerFocusRequest] = useState(0);
  // While "Save N files to Library?" is open, the chat holds: a new send queues behind the message
  // being asked about, and the queue sends nothing until it's answered (CH-8, CH-9). The ref is for
  // handleSend in the same tick; the state is for queueReady.
  const askingSaveRef = useRef(0);
  const [askingSave, setAskingSave] = useState(false);
  const askSave = async (files: File[]) => {
    if (files.length === 0) return;
    askingSaveRef.current += 1;
    setAskingSave(true);
    try {
      await decideSave(files);
    } finally {
      askingSaveRef.current -= 1;
      if (askingSaveRef.current === 0) {
        setAskingSave(false);
        // Back to the composer once answered (the dialog doesn't return focus; see AskSaveDialog).
        setComposerFocusRequest((n) => n + 1);
      }
    }
  };
  return {
    isSendingRef, hookBusy, beginTurn, endTurn,
    composerFocusRequest, setComposerFocusRequest,
    askingSaveRef, askingSave, askSave,
  };
}

/** Everything a turn needs to go out, read at send time from ChatInterface's current render. */
export interface TurnKit {
  chatId: string | undefined;
  queueKey: string;
  selectedModelId: string | number | null | undefined;
  fetchAiResponse: ReturnType<typeof useStreamingChat>["fetchAiResponse"];
  turnOptions: (turn: TurnInput) => TurnRequestOptions;
  trackUploadProgress: (userMsgId: string) => (pct: number) => void;
  setMessages: ChatState["setMessages"];
  addOptimisticUserMessage: ChatState["addOptimisticUserMessage"];
  addLoadingAssistantMessage: ChatState["addLoadingAssistantMessage"];
  rollbackLast: ChatState["rollbackLast"];
  setRevealingKey: Dispatch<SetStateAction<string | null>>;
  stickAndFollow: () => void;
  beginTurn: () => void;
  endTurn: () => void;
}

// A reply that failed or was stopped holds back the message queued after
// it. Streams with a chat id report this through the stream registry; this
// also covers a new chat's first reply that failed before it got one.
export const settleTurn = (key: string, outcome: StreamOutcome) => {
  if (outcome !== "done") holdQueue(key, outcome);
};

/** Sends one turn — the composer's message or a queued one going out. */
export async function sendTurn(
  kit: TurnKit,
  { content, attachments: turnAttachments, mentionedPins: turnPins, fromQueue }: {
    content: string;
    attachments: PendingAttachment[];
    mentionedPins: Array<{ id: string; label: string }>;
    fromQueue: boolean;
  },
  analytics: { hasAgent: boolean; webSearch: boolean | undefined; reasoning: boolean | undefined },
) {
  const key = kit.queueKey;
  const files = turnAttachments.map((a) => a.file);
  const pinsForTurn = PINS_ENABLED ? turnPins : [];
  kit.beginTurn();
  const userMsgId = kit.addOptimisticUserMessage(
    content,
    files.length > 0 ? files : undefined,
    pinsForTurn.length > 0 ? pinsForTurn : undefined,
  );
  const loadingId = kit.addLoadingAssistantMessage();
  kit.setRevealingKey(loadingId);
  kit.stickAndFollow();

  const options = kit.turnOptions({
    files,
    userMessageId: userMsgId,
    mentionedPinIds: pinsForTurn.map(m => m.id),
    onUploadProgress: kit.trackUploadProgress(userMsgId),
  });

  // Analytics: baseline activity + trust in auto-routing (cost story). Metadata only.
  trackBrowserEvent("chat_message_sent", {
    has_agent: analytics.hasAgent,
    model_pick: "manual",
    model_id: kit.selectedModelId != null ? String(kit.selectedModelId) : undefined,
    web_search: analytics.webSearch,
    reasoning: analytics.reasoning,
    attachment_count: files.length,
    pin_count: options.pinIds?.length ?? 0,
    queued: fromQueue,
  });

  try {
    settleTurn(key, await kit.fetchAiResponse(content, kit.chatId ?? null, loadingId, kit.selectedModelId, options));
  } catch {
    kit.rollbackLast(2);
    toast.error("Failed to send message. Please try again.");
    holdQueue(key, "error");
  } finally {
    kit.endTurn();
  }
}

/**
 * The actions on messages already in the thread: regenerate, edit, and
 * answering a prompt card. Each is a stable wrapper (see useLatestCallback):
 * ChatMessageMemo only compares onRegenerate/onEdit's null-ness, so a plain
 * function would be frozen at whatever settings and messages it closed over
 * when the button appeared.
 */
export function useMessageActions(kit: TurnKit, {
  isStreaming,
  isSendingRef,
  personaConfigLoading,
  messages,
  enableReasoning,
}: {
  isStreaming: boolean;
  isSendingRef: RefObject<boolean>;
  personaConfigLoading: boolean;
  messages: UIMessage[];
  enableReasoning: boolean | undefined;
}) {
  const { setMessages } = kit;

  // Regenerate the last reply (also the error state's Retry). Replaces the
  // turn in the backend's history, like an edit, and re-sends with the
  // composer's current settings — minus files: a turn whose message had
  // uploaded files is appended instead (see getRegenerateTarget).
  const handleRegenerate = useLatestCallback(() => {
    if (isStreaming || isSendingRef.current) return;
    if (personaConfigLoading) return;  // same race as handleSend — see its comment

    const target = getRegenerateTarget(messages);
    if (!target) return;

    kit.beginTurn();

    setMessages((prev) => {
      const userIdx = prev.findLastIndex((m) => m.role === "user");
      const replyIdx = prev.findLastIndex((m) => m.role === "assistant");
      return replyIdx > userIdx ? prev.filter((_, i) => i !== replyIdx) : prev;
    });

    const loadingId = kit.addLoadingAssistantMessage();
    kit.setRevealingKey(loadingId);
    kit.stickAndFollow();
    // Analytics: part of the override rate (earliest answer-quality warning).
    trackFeature("regenerate", {
      model_pick: "manual",
      model_id: kit.selectedModelId != null ? String(kit.selectedModelId) : undefined,
      reasoning: enableReasoning,
    });
    kit.fetchAiResponse(
      target.userMessage.content,
      kit.chatId ?? null,
      loadingId,
      kit.selectedModelId,
      kit.turnOptions({
        mentionedPinIds: target.userMessage.mentionedPins?.map((p) => p.id),
        replaceMessageId: target.replaceMessageId,
      }),
    ).finally(kit.endTurn);
  });

  // Permission-prompt answers live on the message, not in card-local state —
  // otherwise the message_saved id swap remounts the row and resurrects
  // already-answered cards.
  const handlePromptDecided = useCallback((messageId: string, requestId: string, decision: string) => {
    setMessages((prev) => prev.map((msg) =>
      msg.id === messageId
        ? {
            ...msg,
            connectorPermissionPrompts: msg.connectorPermissionPrompts?.map((p) =>
              p.request_id === requestId ? { ...p, decision } : p,
            ),
            chatPrompts: msg.chatPrompts?.map((p) =>
              p.request_id === requestId ? { ...p, decision } : p,
            ),
          }
        : msg,
    ));
  }, [setMessages]);

  // A prompt answered at `/chats/{id}/resume` continues the turn as a new
  // stream: it renders into a fresh assistant message below the card.
  const resumeTurn = async (respondUrl: string, promptId: string, response: unknown) => {
    const key = kit.queueKey;
    kit.beginTurn();
    const loadingId = kit.addLoadingAssistantMessage();
    kit.setRevealingKey(loadingId);
    kit.stickAndFollow();
    try {
      settleTurn(key, await kit.fetchAiResponse("", kit.chatId ?? null, loadingId, kit.selectedModelId, {
        resume: { url: respondUrl, promptId, response },
      }));
    } catch {
      toast.error("Failed to continue the reply. Please try again.");
      holdQueue(key, "error");
    } finally {
      kit.endTurn();
    }
  };
  const handlePromptResume = useLatestCallback((respondUrl: string, promptId: string, response: unknown) => {
    void resumeTurn(respondUrl, promptId, response);
  });

  // Edit user message — replaces the message content, removes all subsequent
  // messages, then re-streams an assistant response using the backend's
  // replace_message_id edit API.
  const handleEditMessage = useLatestCallback((messageId: string, newContent: string) => {
    if (isStreaming) return  // never edit while a stream is in-flight
    if (personaConfigLoading) return  // same race as handleSend — see its comment

    // History ids carry a "-prompt" suffix the backend doesn't know, unsaved ones
    // have no backend id at all, and an already-edited message carries a stale one —
    // see resolveEditReplaceId.
    const replaceMessageId = resolveEditReplaceId(messages, messageId)
    const mentionedPinIds = messages.find((m) => m.id === messageId)?.mentionedPins?.map((p) => p.id)

    // findIndex runs inside the functional updater so it always sees the current
    // messages array — not a stale snapshot from the render closure.
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId)
      if (idx === -1) return prev
      return prev
        .map((m, i) => (i === idx ? { ...m, content: newContent } : m))
        .slice(0, idx + 1)
    })
    const loadingId = kit.addLoadingAssistantMessage()
    kit.setRevealingKey(loadingId)
    kit.stickAndFollow()

    kit.beginTurn()
    kit.fetchAiResponse(newContent, kit.chatId ?? null, loadingId, kit.selectedModelId, kit.turnOptions({
      mentionedPinIds,
      replaceMessageId,
    })).finally(kit.endTurn)
  })

  return { handleRegenerate, handlePromptDecided, handlePromptResume, handleEditMessage };
}
