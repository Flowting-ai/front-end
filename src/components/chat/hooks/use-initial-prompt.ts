import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { PINS_ENABLED } from "@/lib/feature-flags";
import type { PendingAttachment } from "../AttachmentManager";
import { settleTurn, type TurnKit } from "./use-chat-turns";

/**
 * Auto-sends the initial prompt on mount (for new chats triggered from the
 * landing page). The send goes through a stable wrapper refreshed after every
 * render, so it always closes over the latest props.
 */
export function useInitialPrompt(kit: TurnKit, {
  initialPrompt,
  personaConfigLoading,
  initialFiles,
  addMenuFiles,
  initialMentionedPins,
  setAttachments,
  onClearInitialFiles,
  onClearAddMenuFiles,
  setComposerFocusRequest,
}: {
  initialPrompt: string | null | undefined;
  personaConfigLoading: boolean;
  initialFiles: File[] | undefined;
  addMenuFiles: File[] | undefined;
  initialMentionedPins: Array<{ id: string; label: string }> | undefined;
  setAttachments: Dispatch<SetStateAction<PendingAttachment[]>>;
  onClearInitialFiles: (() => void) | undefined;
  onClearAddMenuFiles: (() => void) | undefined;
  setComposerFocusRequest: Dispatch<SetStateAction<number>>;
}) {
  const initialPromptSentRef = useRef(false);

  const sendInitialPrompt = useLatestCallback(async (prompt: string) => {
    const content = prompt.trim();
    // Use initialFiles if provided, otherwise fall back to addMenuFiles.
    // The landing page passes files via addMenuFiles (not initialFiles), so
    // we must check both to avoid sending the message without attachments.
    const files = (initialFiles && initialFiles.length > 0)
      ? [...initialFiles]
      : (addMenuFiles && addMenuFiles.length > 0)
        ? [...addMenuFiles]
        : [];
    // Files alone are a message too (same as handleSend), so an empty prompt with files still goes.
    if ((content || files.length > 0) && !kit.chatId) {
      const initialMentionedPinObjects = PINS_ENABLED ? (initialMentionedPins ?? []) : [];
      const userMsgId = kit.addOptimisticUserMessage(
        content,
        files.length > 0 ? files : undefined,
        initialMentionedPinObjects.length > 0 ? initialMentionedPinObjects : undefined,
      );
      const loadingId = kit.addLoadingAssistantMessage();
      kit.setRevealingKey(loadingId);
      kit.stickAndFollow();
      setAttachments([]);
      onClearInitialFiles?.();
      onClearAddMenuFiles?.();
      const key = kit.queueKey;
      kit.beginTurn();
      // The landing's composer is gone, so focus would be left on <body>: carry on in this one.
      setComposerFocusRequest((n) => n + 1);
      kit.fetchAiResponse(content, null, loadingId, kit.selectedModelId, kit.turnOptions({
        files,
        userMessageId: userMsgId,
        mentionedPinIds: initialMentionedPinObjects.map(p => p.id),
        onUploadProgress: kit.trackUploadProgress(userMsgId),
      }))
        .then((outcome) => settleTurn(key, outcome), () => settleTurn(key, "error"))
        .finally(kit.endTurn);
    }
  });

  useEffect(() => {
    // Same race as handleSend's personaConfigLoading check — this is the
    // path that actually fires for "Use this Agent" and any agent selected
    // on the blank new-chat screen: the prompt is already staged and this
    // effect auto-sends it the instant ChatInterface mounts, which is before
    // the persona's version fetch has had any real time to resolve. Wait for
    // it instead of sending with systemPrompt missing.
    if (personaConfigLoading) return;
    // An empty prompt still counts when the landing page handed over files with it.
    const pending = !!initialPrompt || (initialPrompt === "" && (initialFiles?.length || addMenuFiles?.length));
    if (pending && !initialPromptSentRef.current) {
      initialPromptSentRef.current = true;
      sendInitialPrompt(initialPrompt ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the files are read once, with the prompt they came with
  }, [initialPrompt, personaConfigLoading]);
}
