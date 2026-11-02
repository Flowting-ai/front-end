import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { cancelComposerUpload, clearComposerNotices } from "@/lib/library/upload/composer-uploads";
import type { PendingAttachment } from "../AttachmentManager";
import type { StreamState } from "@/hooks/use-streaming-chat";

/**
 * What ChatInterface resets when the user switches to a different chat: the
 * streaming indicator, and the composed-but-unsent input (the second effect
 * below; a new chat getting its id is not a switch). Also keeps the ref to the
 * displayed chat that useStreamingChat reads.
 */
export function useChatSwitchReset({
  chatId,
  setStreamState,
  setInputValue,
  attachmentsRef,
  setAttachments,
  clearMentions,
}: {
  chatId: string | undefined;
  setStreamState: Dispatch<SetStateAction<StreamState>>;
  setInputValue: Dispatch<SetStateAction<string>>;
  /** The draft's attachments as of the last render. */
  attachmentsRef: RefObject<PendingAttachment[]>;
  setAttachments: Dispatch<SetStateAction<PendingAttachment[]>>;
  clearMentions: () => void;
}) {
  const prevChatIdRef = useRef<string | null | undefined>(chatId)
  useEffect(() => {
    const prev = prevChatIdRef.current
    prevChatIdRef.current = chatId ?? null
    // Switching to a different real chat: reset streamState so the new chat's
    // input doesn't inherit a streaming indicator from the previous chat's
    // background stream. Exclude the null→realId transition for new chats.
    if (prev !== chatId && prev !== null && prev !== undefined) {
      setStreamState("idle")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only run when chatId identity changes
  }, [chatId])

  // The id of the chat this view just created (see handleChatCreated). When it
  // arrives as `chatId`, it's the same conversation getting its id, not a
  // switch — what the user typed (or queued) during its first reply stays.
  const createdChatIdRef = useRef<string | null>(null);

  // The chat the reset below last ran for. Starts at the mounted chat so the first run
  // (and StrictMode's re-run) leaves the initial draft alone — there is nothing to reset.
  const resetChatIdRef = useRef(chatId);
  useEffect(() => {
    if (resetChatIdRef.current === chatId) return;
    resetChatIdRef.current = chatId;
    if (chatId && chatId === createdChatIdRef.current) {
      createdChatIdRef.current = null;
      return;
    }
    setInputValue("");
    // The old draft's files go with it: stop their uploads (staged, never sent), free image
    // previews, and drop refusal notices, which would otherwise show above the next chat.
    for (const attachment of attachmentsRef.current) {
      cancelComposerUpload(attachment.file);
      if (attachment.preview) URL.revokeObjectURL(attachment.preview);
    }
    clearComposerNotices();
    setAttachments([]);
    clearMentions();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only run when chatId identity changes
  }, [chatId]);

  // Ref always pointing to the currently displayed chatId.
  // Passed to useStreamingChat to suppress setStreamState calls for background streams.
  // Assigned in an effect, not during render — see the selectModelRef comment
  // in chat/page.tsx for why mutating a ref's `.current` during render is unsafe.
  const currentChatIdRef = useRef<string | undefined>(chatId ?? undefined)
  useEffect(() => {
    currentChatIdRef.current = chatId ?? undefined
  }, [chatId])

  return { createdChatIdRef, currentChatIdRef };
}
