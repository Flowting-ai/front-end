"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatInput } from "@/components/chat/ChatInput";
import { InitialPrompts } from "@/components/chat/InitialPrompts";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { ModelSwitchDialog } from "@/components/chat/ModelSwitchDialog";
import { useModelSelection } from "@/hooks/use-model-selection";
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
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [pendingModelSwitch, setPendingModelSwitch] = useState<AIModel | null>(
    null,
  );
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [hasMessages, setHasMessages] = useState(!!chatIdFromUrl);
  const [newChatInput, setNewChatInput] = useState("");

  const { models, selectedModel, selectModel } = useModelSelection();
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

  const handleModelSelect = (model: AIModel) => {
    if (activeChatId && hasMessages && selectedModel) {
      setPendingModelSwitch(model);
    } else {
      selectModel(model);
    }
  };

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
    // Update URL without full navigation
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
              onModelClick={() => setModelSelectorOpen(true)}
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
          onModelClick={() => setModelSelectorOpen(true)}
          initialPrompt={initialPrompt}
        />
      )}

      {/* Model selector dialog */}
      <ModelSelector
        models={models}
        selectedModel={selectedModel}
        isOpen={modelSelectorOpen}
        onOpenChange={setModelSelectorOpen}
        onSelect={handleModelSelect}
      />

      {/* Model switch confirmation */}
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
