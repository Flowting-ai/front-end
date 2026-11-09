"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChatInput } from "./ChatInput";
import { type PendingAttachment } from "./AttachmentManager";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useComposerUploads } from "@/lib/library/upload/composer-uploads";
import { ChatFilePanelSlot } from "@/components/Library/chat/ChatFilePanelSlot";
import { useSaveChoice } from "@/components/Library/chat/useSaveChoice";
import { useChatStreamActive } from "@/hooks/use-message-queue";
import {
  getChatQueue,
  refreshQueuedContext,
  rekeyQueue,
  type QueuedTurnContext,
} from "@/lib/message-queue";
import { stopStream } from "@/lib/stream-registry";
import { buildTurnOptions, getFolderPinIds, type TurnInput, type TurnSettings } from "@/lib/turn-options";
import { useChatState, type UseChatStateOptions } from "@/hooks/use-chat-state";
import { usePinMentions } from "@/hooks/use-pin-mentions";
import { PINS_ENABLED } from "@/lib/feature-flags";
import { seedModelMeta } from "@/lib/seed-model-meta";
import {
  useStreamingChat,
  type StreamState,
} from "@/hooks/use-streaming-chat";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { usePinboard } from "@/context/pinboard-context";
import { useAuth } from "@/context/auth-context";
import { useOrgPlan } from "@/context/org-context";
import { useCreditStatus } from "@/hooks/use-credit-status";
import { useWorkspaceCreditNotice } from "@/hooks/use-workspace-credit-notice";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { usePageHidden } from "@/hooks/use-page-hidden";
import { FileDropOverlay } from "./FileDropOverlay";
import { ChatMessageList, type ChatMessageListHandle } from "./ChatMessageList";
import { ChatMessagesPane } from "./ChatMessagesPane";
import { ChatComposerArea } from "./ChatComposerArea";
import { ComposerAttachmentsSlot } from "./ChatInterfaceParts";
import type { ChatInterfaceProps } from "./chat-interface-props";
import { getComposerPlaceholder, getQueuePausedReason, getQueueStatus } from "./chat-interface-helpers";
import { useChatSwitchReset } from "./hooks/use-chat-switch-reset";
import { useChatContextPublish, useInjectedMessages, useStreamTabResilience } from "./hooks/use-chat-lifecycle";
import { useChatScroll, useChatScrollerRegistration, useFollowLive, useStickToBottom } from "./hooks/use-chat-scroll";
import { NO_QUEUED_MESSAGES, useQueueForeground } from "./hooks/use-queue-foreground";
import { useInitialPrompt } from "./hooks/use-initial-prompt";
import { useAttachmentIntake } from "./hooks/use-attachment-intake";
import { useComposerQueue, useQueuedSend } from "./hooks/use-composer-queue";
import { useRevealSettle } from "./hooks/use-reveal-settle";
import { sendTurn as sendTurnWith, useMessageActions, useTurnGuards, type TurnKit } from "./hooks/use-chat-turns";

// The container for a chat: message state, sending/queueing turns and the
// composer. Each hook below is called in the order its effects must run.
export function ChatInterface({
  chatId,
  onChatCreated,
  onTitleUpdate,
  onChatMoveToTop,
  selectedModel,
  selectedModelIcon,
  selectedModelId,
  algorithm,
  onModelClick,
  addMenu,
  modelMenu,
  initialPrompt,
  draft,
  webSearchEnabled,
  reasoningEffort,
  addMenuFiles,
  onClearAddMenuFiles,
  initialFiles,
  onClearInitialFiles,
  chips,
  selectedFolders,
  initialMentionedPins,
  selectedPersonaId,
  selectedPersonaSystemPrompt,
  selectedPersonaTemperature,
  personaConfigLoading = false,
  selectedStyleId,
  scrollToMessageId,
  disabledModelSelector,
  endpoint,
  onStopBackend,
  connectorSlugs,
  emptyState,
  loadMessages,
  hidePinActions: hidePinActionsProp = false,
  readOnly = false,
  archived = false,
  chatOwnershipConfirmed,
  onBeforeSend,
  agentMention,
  injectedMessages,
  onInjectedMessagesConsumed,
  onUseAgent,
  projectId,
}: ChatInterfaceProps) {
  const hidePinActions = hidePinActionsProp || !PINS_ENABLED;
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [inputValue, setInputValue] = useState(draft ?? "");
  // A draft handed in from outside (e.g. a scheduled prompt) fills the box when it
  // changes — adjusted during render rather than in an effect, so there is no extra
  // render and an unchanged draft never overwrites what the user has typed since.
  const [prevDraft, setPrevDraft] = useState(draft);
  if (draft !== prevDraft) {
    setPrevDraft(draft);
    if (draft) setInputValue(draft);
  }

  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  // Files upload into Library as soon as they are attached; Send waits until they are ready.
  const { attachments: attachmentChips, uploadsBusy, notices: uploadNotices } = useComposerUploads(attachments, setAttachments, chatId && !chatId.startsWith("temp-") ? chatId : undefined);
  // The draft's attachments as of the last render, for the chat-switch reset below.
  const attachmentsRef = useRef(attachments);
  useEffect(() => { attachmentsRef.current = attachments; });
  // Auto-save setting (Always / Ask each time / Never) applied to the files on send.
  const { decideSave, saveDialog } = useSaveChoice(chatId && !chatId.startsWith("temp-") ? chatId : undefined);
  const {
    mentionedPins,
    filteredPins,
    showPinDropdown,
    pinQuery,
    highlightedPinIndex,
    setHighlightedPinIndex,
    inputWrapperRef,
    handleMentionChange,
    handlePinSelect,
    handleRemoveMention,
    handlePinNavigate,
    clearMentions,
    restoreMentions,
  } = usePinMentions(setInputValue);

  const { stickToBottom, atBottom, setAtBottom, isSettling, setIsSettling, scheduleFollowRef, stickAndFollow } = useStickToBottom();

  // Reset composed-but-unsent input whenever the user switches to a different chat.
  const { createdChatIdRef, currentChatIdRef } = useChatSwitchReset({
    chatId, setStreamState, setInputValue, attachmentsRef, setAttachments, clearMentions,
  });

  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesListRef      = useRef<HTMLDivElement>(null);
  // The virtualized list's handle (see ChatMessageList).
  const listRef              = useRef<ChatMessageListHandle>(null);

  const { processFiles, removeAttachment: removeOne, FILE_ACCEPT, FILE_CONSTRAINTS } = useFileUpload({ libraryValidates: true });

  const { selectedModel: contextModel } = useModelSelectorContext();
  const enableReasoning = reasoningEffort === undefined ? undefined : reasoningEffort !== null;

  // Auth context — refreshUser for updating usage after stream completes
  const { user, refreshUser } = useAuth();

  // Org context — pool status (via useWorkspaceCreditNotice below) drives
  // InlineCreditNotice above input; plan is also read directly for the
  // locked-state input disable/placeholder further down.
  const { plan } = useOrgPlan();
  // Individual credit/topup status — drives the warning banner + hard send-gate.
  const creditStatus = useCreditStatus();

  const { status: creditNoticeStatus, isAdmin: isOrgAdmin, dismiss: dismissCreditNotice, goToPlans } = useWorkspaceCreditNotice();

  // Pin data for the @-mention dropdown and the per-message "pinned" badge —
  // read from context. pinboard-context no longer fetches eagerly on every
  // authenticated page load (that was firing GET /pins + GET /pins/folders/all
  // on pages with nothing to do with pins — see pinboard-context.tsx's mount
  // effect), so a real chat surface like this one — the one place besides the
  // Pinboard panel itself that actually needs live pin data — prefetches on
  // its own mount instead. No-op if data is already fresh/in-flight.
  const { pins, isPinned, prefetch: prefetchPins } = usePinboard();
  useEffect(() => { prefetchPins() }, [prefetchPins]);

  const chatStateOptions = useMemo<UseChatStateOptions | undefined>(
    () => loadMessages ? { loadMessages } : undefined,
    [loadMessages],
  )

  const {
    messages: rawMessages,
    setMessages,
    isLoadingMessages,
    hasMoreMessages,
    loadMoreMessages,
    addOptimisticUserMessage,
    addLoadingAssistantMessage,
    rollbackLast,
    markChatAsOptimistic,
    refreshMessages,
    messagesLoadError,
  } = useChatState(chatId, chatStateOptions);

  // Append host-supplied local messages (the agent card) — merged during render; see the hook.
  useInjectedMessages(injectedMessages, setMessages, onInjectedMessagesConsumed);

  // Model logo + name for assistant messages with thinking but no model identity (the
  // history API may omit model_name) — derived at render, never written back to state.
  const messages = seedModelMeta(rawMessages ?? [], contextModel);

  useChatContextPublish(chatId, messages);
  useStreamTabResilience(streamState, messages, refreshMessages);

  const { moveToTop } = { moveToTop: onChatMoveToTop ?? (() => {}) };

  useChatScrollerRegistration(messages, listRef, stickToBottom, setAtBottom);

  // ── Message queue (see message-queue.ts) ─────────────────────────────────
  const { newChatKey, queueKey, chatQueue, queuedMessages } = useQueueForeground(chatId);

  // Wrap onChatCreated to mark the new ID as optimistic BEFORE the parent
  // updates the URL/chatId prop - prevents useChatState from wiping messages.
  const handleChatCreated = (newChatId: string) => {
    markChatAsOptimistic(newChatId);
    createdChatIdRef.current = newChatId;
    rekeyQueue(newChatKey, newChatId);
    onChatCreated?.(newChatId);
  };

  const { fetchAiResponse, handleStopGeneration } = useStreamingChat({
    setMessages,
    onChatCreated: handleChatCreated,
    onTitleUpdate,
    onChatMoveToTop: (id) => moveToTop(id),
    setStreamState,
    onStreamDone: refreshUser,
    currentChatIdRef,
    // Streamed tokens go to lib/chat/stream-store and re-render only the
    // streaming row (LiveChatMessage), not this whole tree.
    liveOverlay: true,
    ...(endpoint ? { endpoint } : {}),
    ...(onStopBackend ? { onStopBackend } : {}),
  });

  const isStreaming = streamState === "streaming" || streamState === "waiting";
  // This chat's reply is running — here, or still from before the user
  // switched away and back (or as a queued message sent in the background).
  const chatStreamActive = useChatStreamActive(chatId);
  const replyInFlight = isStreaming || chatStreamActive;

  const {
    isSendingRef, hookBusy, beginTurn, endTurn,
    composerFocusRequest, setComposerFocusRequest,
    askingSaveRef, askingSave, askSave,
  } = useTurnGuards(decideSave);
  // Set by the host's "send anyway" so the next handleSend skips onBeforeSend.
  const skipBeforeSendRef = useRef(false);

  // reactKey of the reply streamed in this session until its text reveal has
  // settled (ChatMessage's onRevealSettled). The reveal runs on after the
  // stream ends, so the completion UI — the Regenerate button and the
  // "response complete" announcement — waits for it.
  const [revealingKey, setRevealingKey] = useState<string | null>(null);

  const followLiveRef = useFollowLive(isStreaming, revealingKey);

  // Every turn (send, initial send, edit, regenerate) is sent with the
  // composer's current settings, read at send time — see buildTurnOptions.
  const turnSettings: TurnSettings = {
    webSearch:              webSearchEnabled,
    reasoningEffort,
    algorithm,
    personaId:              selectedPersonaId,
    projectId,
    systemPrompt:           selectedPersonaSystemPrompt,
    temperature:            selectedPersonaTemperature,
    toneId:                 selectedStyleId,
    connectorSlugs,
    chatOwnershipConfirmed,
    pinsEnabled:            PINS_ENABLED,
    folderPinIds:           getFolderPinIds(pins, selectedFolders),
  };
  const turnOptions = (turn: TurnInput) => buildTurnOptions(turnSettings, turn);

  // What a queued message needs to go out without this view (in the
  // background): the same settings, kept current while the chat is shown.
  const queueContext = (): QueuedTurnContext => ({
    settings: turnSettings,
    modelId:  selectedModelId,
    endpoint,
    onStopBackend,
  });
  useEffect(() => {
    refreshQueuedContext(queueKey, queueContext());
  });

  // Mirrors the real XHR upload progress onto the optimistic user message's attachment chips.
  const trackUploadProgress = (userMsgId: string) => (pct: number) => {
    setMessages((prev) => prev.map((msg) =>
      msg.id !== userMsgId ? msg : {
        ...msg,
        attachments: msg.attachments?.map((att) => ({
          ...att,
          uploadProgress: pct,
          uploading: pct < 100,
        })),
      }
    ));
  };

  const turnKit: TurnKit = {
    chatId, queueKey, selectedModelId, fetchAiResponse, turnOptions, trackUploadProgress,
    setMessages, addOptimisticUserMessage, addLoadingAssistantMessage, rollbackLast,
    setRevealingKey, stickAndFollow, beginTurn, endTurn,
  };

  // Auto-send initial prompt on mount (for new chats triggered from landing page)
  useInitialPrompt(turnKit, {
    initialPrompt, personaConfigLoading, initialFiles, addMenuFiles, initialMentionedPins,
    setAttachments, onClearInitialFiles, onClearAddMenuFiles, setComposerFocusRequest,
  });

  const { handleScroll, scrollToBottom } = useChatScroll({
    messages,
    isLoadingMessages,
    hasMoreMessages,
    loadMoreMessages,
    scrollToMessageId,
    listRef,
    scrollerRef: messagesContainerRef,
    listElementRef: messagesListRef,
    stickToBottom,
    setAtBottom,
    isSettling,
    setIsSettling,
    scheduleFollowRef,
    followLiveRef,
  });

  const { isDragging, fileInputRef, handleAdd, handleFileSelect } = useAttachmentIntake({
    setAttachments, processFiles, addMenuFiles, initialPrompt,
  });

  // The reply the queue was waiting on failed or was stopped (see the hook).
  const queueHeldBy = chatQueue?.heldBy;
  const {
    queueAnnouncement,
    queuedRowExit,
    setQueuedRowExit,
    editedQueueSlotRef,
    queueFromComposer,
    handleEditQueued,
    handleRecallQueued,
    handleRemoveQueued,
  } = useComposerQueue({
    queueKey,
    queuedMessages,
    queueHeldBy,
    replyInFlight,
    attachments,
    mentionedPins,
    setInputValue,
    setAttachments,
    clearMentions,
    restoreMentions,
    onClearAddMenuFiles,
    askSave,
    queueContext,
    maxFiles: FILE_CONSTRAINTS.maxFiles,
    setComposerFocusRequest,
  });

  // Send message - uses local attachments (which include add-menu files after absorption)
  const handleSend = async (text: string) => {
    const allFiles = attachments.map((a) => a.file);
    if (!text.trim() && allFiles.length === 0) return;

    // Hard-stop backstop: an exhausted credit/topup user cannot send. The input is
    // already disabled and the CreditStatusBanner explains why, so block silently.
    if (creditStatus.blocked) return;

    // Same idea: a just-selected persona's system prompt/model is still being
    // fetched (see personaConfigLoading doc) — the input is disabled for this
    // too, so block silently rather than send with systemPrompt missing.
    if (personaConfigLoading) return;

    // Host takeover (see onBeforeSend). Skipped for messages with attachments and
    // when the host asked to send this very text anyway.
    if (skipBeforeSendRef.current) {
      skipBeforeSendRef.current = false;
    } else if (allFiles.length === 0 && onBeforeSend?.(text.trim(), () => {
      skipBeforeSendRef.current = true;
      void handleSend(text);
    })) {
      setInputValue("");
      return;
    }

    // A reply is still running (or messages are already waiting): this one is
    // queued to follow, in order. The isSendingRef check also catches a
    // second send in the same tick, before `isStreaming` lands.
    if (replyInFlight || isSendingRef.current || askingSaveRef.current > 0 || getChatQueue(queueKey)) {
      queueFromComposer(text);
      return;
    }

    // Capture mentionedPins before clearing so they're stored on the optimistic message.
    const capturedMentionedPins = PINS_ENABLED ? mentionedPins : [];
    const capturedAttachments = attachments;
    editedQueueSlotRef.current = null;
    setInputValue("");
    setAttachments([]);
    clearMentions();
    onClearAddMenuFiles?.();
    await askSave(capturedAttachments.map((a) => a.file));

    await sendTurn({
      content: text.trim(),
      attachments: capturedAttachments,
      mentionedPins: capturedMentionedPins,
      fromQueue: false,
    });
  };

  // Sends one turn — the composer's message or a queued one going out.
  const sendTurn = (turn: Parameters<typeof sendTurnWith>[1]) => sendTurnWith(turnKit, turn, {
    hasAgent: !!selectedPersonaId, webSearch: webSearchEnabled, reasoning: enableReasoning,
  });

  // Stop: this view's own reply, or this chat's reply still running from
  // before the user switched away and back (or a queued message sent in the
  // background meanwhile).
  const handleStop = () => {
    if (isStreaming) handleStopGeneration();
    else if (chatId) stopStream(chatId);
  };

  // Hidden tab: the reply's text reveal doesn't run there, so a queued
  // message doesn't wait for it.
  const pageHidden = usePageHidden();

  // Why a queued message can't go out yet beyond waiting its turn.
  const queuePausedReason = getQueuePausedReason({
    creditsBlocked: !!creditStatus.blocked,
    poolPaused: plan?.poolStatus === "paused",
    personaConfigLoading,
  });

  // The send itself, through a stable wrapper so the queue's timer always uses
  // the composer's latest settings.
  const sendTurnLatest = useLatestCallback(sendTurn);

  // Regenerate, edit, and prompt-card answers (see useMessageActions).
  const { handleRegenerate, handlePromptDecided, handlePromptResume, handleEditMessage } = useMessageActions(turnKit, {
    isStreaming, isSendingRef, personaConfigLoading, messages, enableReasoning,
  });

  const { revealingMessage, isRevealing, handleRevealSettled } = useRevealSettle({
    revealingKey, setRevealingKey, isStreaming, messages, listRef,
  });

  // The next queued message goes out once the reply before it has finished —
  // streamed and revealed (unless the tab is hidden) — and the thread is
  // settled (see useQueuedSend).
  const queueReady =
    queuedMessages.length > 0 && !queueHeldBy &&
    !replyInFlight && !hookBusy && !askingSave &&
    (!isRevealing || pageHidden) &&
    !isLoadingMessages && !isSettling &&
    !queuePausedReason && !readOnly && !archived;
  useQueuedSend({
    queueReady, queueKey, pageHidden, isSendingRef, askingSaveRef, setQueuedRowExit, sendTurn: sendTurnLatest,
  });

  // What the queue is waiting for, after "Queued ·" in the tray.
  const queueWaitingOnReply = replyInFlight || isRevealing;
  const queueStatus = getQueueStatus({
    pausedReason: queuePausedReason,
    waitingOnReply: queueWaitingOnReply,
    queuedCount: queuedMessages.length,
    askingSave,
    hookBusy,
  });
  // While a send would be queued rather than go straight out.
  const sendQueues = replyInFlight || hookBusy || queuedMessages.length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        position: "relative",
      }}
    >
      {saveDialog}
      <ChatFilePanelSlot chatId={chatId} />
      <FileDropOverlay visible={isDragging} />

      <ChatMessagesPane
        responding={isStreaming || isRevealing}
        queueAnnouncement={queueAnnouncement}
        scrollerRef={messagesContainerRef}
        messagesEndRef={messagesEndRef}
        onScroll={handleScroll}
        isLoadingMessages={isLoadingMessages}
        isStreaming={isStreaming}
        isSettling={isSettling}
        isEmpty={messages.length === 0}
        messagesLoadError={messagesLoadError}
        onRetry={() => void refreshMessages()}
        emptyState={emptyState}
        atBottom={atBottom}
        onScrollToBottom={scrollToBottom}
      >
        <ChatMessageList
          ref={listRef}
          scrollerRef={messagesContainerRef}
          listRef={messagesListRef}
          messages={messages}
          isSettling={isSettling}
          chatId={chatId}
          archived={archived}
          isStreaming={isStreaming}
          isRevealing={isRevealing}
          revealingMessage={revealingMessage}
          revealingKey={revealingKey}
          isPinned={isPinned}
          selectedPersonaId={selectedPersonaId}
          onUseAgent={onUseAgent}
          onRegenerate={handleRegenerate}
          onRevealSettled={handleRevealSettled}
          onEdit={handleEditMessage}
          onPromptDecided={handlePromptDecided}
          onPromptResume={handlePromptResume}
        />
      </ChatMessagesPane>

      <ChatComposerArea
        creditNotice={{ status: creditNoticeStatus, isAdmin: isOrgAdmin, onAdminAction: goToPlans, onDismiss: dismissCreditNotice }}
        archived={archived}
        readOnly={readOnly}
        messages={messages}
        isStreaming={isStreaming}
        queueKey={queueKey}
        tray={{
          messages: queueHeldBy ? NO_QUEUED_MESSAGES : queuedMessages,
          status: queueStatus,
          waiting: !queuePausedReason && (queueWaitingOnReply || hookBusy),
          rowExit: queuedRowExit,
          onEdit: handleEditQueued,
          onRemove: handleRemoveQueued,
        }}
        inputWrapperRef={inputWrapperRef}
        pinDropdown={hidePinActions ? null : {
          isOpen: showPinDropdown,
          pins: filteredPins,
          query: pinQuery,
          highlightedIndex: highlightedPinIndex,
          onHighlight: setHighlightedPinIndex,
          onSelect: handlePinSelect,
        }}
        fileInputRef={fileInputRef}
        fileAccept={FILE_ACCEPT}
        onFileSelect={handleFileSelect}
      >
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          sendBlocked={uploadsBusy}
          onStop={handleStop}
          onAdd={handleAdd}
          onFilePaste={(files) => setAttachments((prev) => processFiles(files, prev))}
          hasAttachments={attachments.length > 0}
          agentMention={agentMention}
          onModelClick={onModelClick}
          modelName={selectedModel ?? "Souvenir"}
          modelIcon={selectedModelIcon}
          addMenu={addMenu}
          modelMenu={modelMenu}
          disabledModelSelector={disabledModelSelector}
          chips={chips}
          attachmentsSlot={
            <ComposerAttachmentsSlot
              showPins={!hidePinActions}
              mentionedPins={mentionedPins}
              onRemoveMention={handleRemoveMention}
              uploadNotices={uploadNotices}
              attachments={attachmentChips}
              onAttachmentsChange={setAttachments}
            />
          }
          isStreaming={replyInFlight}
          // Not disabled while streaming: the box keeps focus and can be
          // typed in, and a send is queued to follow the reply.
          allowQueue
          sendQueues={sendQueues}
          onRecallQueued={queuedMessages.length > 0 && !queueHeldBy ? handleRecallQueued : undefined}
          focusRequest={composerFocusRequest}
          disabled={readOnly || archived || plan?.poolStatus === 'paused' || creditStatus.blocked || personaConfigLoading}
          placeholder={getComposerPlaceholder({
            readOnly,
            poolPaused: plan?.poolStatus === 'paused',
            creditsBlocked: !!creditStatus.blocked,
            personaConfigLoading,
            queuedCount: queuedMessages.length,
            sendQueues,
            hasMessages: messages.length > 0,
          })}
          onMentionChange={hidePinActions ? undefined : handleMentionChange}
          isPinDropdownOpen={hidePinActions ? false : showPinDropdown}
          onPinNavigate={hidePinActions ? undefined : handlePinNavigate}
        />
      </ChatComposerArea>
    </div>
  );
}
