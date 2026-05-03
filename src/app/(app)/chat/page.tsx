"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatInput } from "@/components/chat/ChatInput";
import { InitialPrompts } from "@/components/chat/InitialPrompts";
import { ModelSwitchDialog } from "@/components/chat/ModelSwitchDialog";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import type { AIModel } from "@/types/ai-model";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatIdFromUrl = searchParams.get("id") ?? undefined;

  const [activeChatId, setActiveChatId] = useState<string | undefined>(
    chatIdFromUrl,
  );
  const [pendingModelSwitch, setPendingModelSwitch] = useState<AIModel | null>(
    null,
  );
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [hasMessages, setHasMessages] = useState(!!chatIdFromUrl);
  const [newChatInput, setNewChatInput] = useState("");

  const { selectedModel, selectModel, open: openModelSelector } =
    useModelSelectorContext();
  const { rename: renameChat, addOptimistic } = useChatHistoryContext();

  // Sync URL param changes into local state (e.g. sidebar navigation)
  useEffect(() => {
    if (chatIdFromUrl !== activeChatId) {
      setActiveChatId(chatIdFromUrl);
      setHasMessages(!!chatIdFromUrl);
      setInitialPrompt(null);
    }
  }, [chatIdFromUrl]);

  const isNewChat = !activeChatId && !hasMessages && !initialPrompt;

  // When in an active conversation and user picks a different model,
  // confirm before switching to avoid disrupting the current chat context.
  const handleModelClick = () => {
    openModelSelector();
  };

  // ModelSwitchDialog is only triggered programmatically (e.g. from ChatInput
  // when a switch happens mid-conversation). For TopBar selection the switch
  // applies immediately via context.selectModel.
  const handleModelSwitchConfirm = () => {
    if (pendingModelSwitch) {
      selectModel(pendingModelSwitch);
      setPendingModelSwitch(null);
    }
  };

  const handleModelSwitchCancel = () => {
    setPendingModelSwitch(null);
  };

  const handleChatCreated = (chatId: string) => {
    setActiveChatId(chatId);
    setHasMessages(true);
    router.replace(`/chat?id=${chatId}`, { scroll: false });
    addOptimistic({
      id: chatId,
      title: "New chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      starred: false,
    });
  };

  const handleTitleUpdate = (chatId: string, title: string) => {
    renameChat(chatId, title);
  };

  const handleChatMoveToTop = (chatId: string) => {
    addOptimistic({
      id: chatId,
      title: "New chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      starred: false,
    });
  };

  const handlePromptSelect = (prompt: string) => {
    setInitialPrompt(prompt);
    setNewChatInput(prompt);
    setHasMessages(true);
  };

  const handleNewChatSend = (value: string) => {
    if (!value.trim()) return;
    setInitialPrompt(value.trim());
    setNewChatInput("");
    setHasMessages(true);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "400px",
      }}
    >
      {isNewChat ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <InitialPrompts onPromptSelect={handlePromptSelect} />
          </div>
          {/* Chat input pinned to bottom of empty state */}
          <div
            style={{
              padding: "0 16px 24px",
              maxWidth: "768px",
              width: "100%",
              margin: "0 auto",
            }}
          >
            <ChatInput
              value={newChatInput}
              onChange={setNewChatInput}
              onSend={handleNewChatSend}
              modelName={selectedModel?.modelName}
              onModelClick={handleModelClick}
              placeholder="How can I help you today?"
            />
          </div>
        </div>
      ) : (
        <ChatInterface
          chatId={activeChatId}
          onChatCreated={handleChatCreated}
          onTitleUpdate={handleTitleUpdate}
          onChatMoveToTop={handleChatMoveToTop}
          selectedModel={selectedModel?.modelName}
          selectedModelId={selectedModel?.id}
          onModelClick={handleModelClick}
          initialPrompt={initialPrompt}
        />
      )}

      {/* Switch confirmation — shown when pendingModelSwitch is set */}
      <ModelSwitchDialog
        isOpen={!!pendingModelSwitch}
        fromModel={selectedModel}
        toModel={pendingModelSwitch}
        onConfirm={handleModelSwitchConfirm}
        onCancel={handleModelSwitchCancel}
      />
    </div>
  );
}
