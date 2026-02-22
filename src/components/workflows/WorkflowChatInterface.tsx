"use client";

import { useState, useRef, useEffect } from "react";
import chatStyles from "./workflow-chat-interface.module.css";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Mic, Square } from "lucide-react";
import { ChatMessage, type Message } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";
import { getModelIcon } from "@/lib/model-icons";
import { toast } from "@/lib/toast-helper";
import Image from "next/image";
import { workflowAPI } from "./workflow-api";

interface WorkflowChatInterfaceProps {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
  selectedModel?: AIModel | null;
}

export function WorkflowChatInterface({
  workflowId,
  workflowName: _workflowName,
  onClose,
  selectedModel,
}: WorkflowChatInterfaceProps) {
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const flowtingLogoUrl = "/new-logos/FlowtingLogo.svg";

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [displayMessages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  const handleSend = async () => {
    const trimmedContent = input.trim();
    if (!trimmedContent || isResponding) return;

    const userMessageId = `user-${Date.now()}`;
    const aiMessageId = `ai-${Date.now() + 1}`;

    // Add user message
    const userMessage: Message = {
      id: userMessageId,
      sender: "user",
      content: trimmedContent,
      avatarUrl: "/personas/userAvatar.png",
      avatarHint: "User",
    };

    setDisplayMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsResponding(true);

    // Add loading message
    const loadingMessage: Message = {
      id: aiMessageId,
      sender: "ai",
      content: "",
      isLoading: true,
      avatarUrl: selectedModel
        ? getModelIcon(selectedModel.companyName, selectedModel.modelName)
        : flowtingLogoUrl,
      avatarHint: selectedModel?.modelName || "Flowting AI",
    };

    setDisplayMessages((prev) => [...prev, loadingMessage]);

    try {
      if (!workflowId || workflowId === "temp") {
        throw new Error("Save the workflow first, then run workflow chat.");
      }

      const result = await workflowAPI.execute(workflowId, {
        inputText: trimmedContent,
      });
      const failed =
        result.status === "failed" ||
        result.status === "error" ||
        Boolean(result.error);

      const aiResponse: Message = {
        id: aiMessageId,
        sender: "ai",
        content: failed
          ? result.error || "Workflow execution failed."
          : result.finalOutput || "Workflow executed successfully with no output.",
        avatarUrl: selectedModel
          ? getModelIcon(selectedModel.companyName, selectedModel.modelName)
          : flowtingLogoUrl,
        avatarHint: selectedModel?.modelName || "Flowting AI",
        metadata: {
          providerName: selectedModel?.companyName,
          modelName: selectedModel?.modelName,
        },
      };

      setDisplayMessages((prev) =>
        prev.map((msg) => (msg.id === aiMessageId ? aiResponse : msg))
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Sorry, I encountered an error processing your request.";
      const errorMessage: Message = {
        id: aiMessageId,
        sender: "ai",
        content: message,
        avatarUrl: selectedModel
          ? getModelIcon(selectedModel.companyName, selectedModel.modelName)
          : flowtingLogoUrl,
        avatarHint: selectedModel?.modelName || "Flowting AI",
      };

      setDisplayMessages((prev) =>
        prev.map((msg) => (msg.id === aiMessageId ? errorMessage : msg))
      );
    } finally {
      setIsResponding(false);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast("Copied to clipboard!");
  };

  const handlePin = (message: Message) => {
    // Silent no-op - pin feature not available in workflow chat
  };

  const handleDelete = (message: Message) => {
    // Not implemented for workflow chat
    toast("Delete not available in workflow chat");
  };

  const handleResubmit = (newContent: string, messageId: string) => {
    // Not implemented for workflow chat
    toast("Edit and resubmit not available in workflow chat");
  };

  const handleInputChange = (value: string) => {
    setInput(value);
  };

  return (
    <div className="top-[60px] max-h-[calc(100vh-65px)] right-2 relative flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-white border border-main-border rounded-3xl shadow-lg">
      {/* Header */}
      <button
          onClick={onClose}
          className="absolute top-2 right-3.5 z-1 cursor-pointer flex w-auto py-2 px-2 bg-zinc-100 text-xs items-center justify-center gap-2 rounded-full hover:bg-[#F5F5F5] transition-colors shadow-sm"
          aria-label="Close chat"
        >
          <X className="h-3 w-3 text-[#666666]" />
        </button>

      {/* Messages */}
      {displayMessages.length === 0 ? (
        <section className="flex flex-1 items-center justify-center bg-white px-4 py-8 mt-2">
          <div className="text-center max-w-md">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full">
                <Image src="/icons/FlowtingAI_LightGrey.png" alt="Workflow Logo" width={81} height={81} className="object-contain" />
              </div>
            </div>
            <h2 className="mb-3 text-2xl font-normal text-[#1E1E1E] font-clash">
              Test Out Your Workflow
            </h2>
            <p className="text-sm text-[#8B8B8B] leading-relaxed font-geist">
              Your intelligent assistant for reports, automation,
              <br /> and creative workflows.
            </p>
          </div>
        </section>
      ) : (
        <div
          className={`relative flex-1 min-h-0 overflow-y-auto mt-2 ${chatStyles.customScrollbar} ${chatStyles.hidePinButton}`}
          ref={scrollViewportRef}
        >
          <div className="mx-auto w-full max-w-[850px] flex-col gap-3 pr-4 py-4">
            <div className="rounded-[32px] border border-transparent bg-white p-6 shadow-none">
              <div className="flex-col gap-3">
                {displayMessages.map((msg, idx) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onPin={() => {}}
                    onCopy={handleCopy}
                    onDelete={() => {}}
                    onResubmit={() => {}}
                    isPinned={false}
                    taggedPins={[]}
                    isNewMessage={idx === displayMessages.length - 1}
                    isResponding={isResponding}
                    onReference={undefined}
                    onRegenerate={undefined}
                    onReply={undefined}
                    onReact={undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Input Footer */}
      <footer className="shrink-0 bg-white px-2 pb-0.5 pt-0">
        <div className="relative mx-auto w-full max-w-[756px]">
          <div
            className="rounded-[24px] border border-[#D9D9D9] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{
              minHeight: "90px",
              transition: "min-height 0.2s ease",
            }}
          >
            <div className="flex flex-col gap-1.5 px-5 py-4">
              {/* Text input area */}
              <div className="w-full">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !isResponding
                    ) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Test your workflow..."
                  className="min-h-[40px] w-full resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-relaxed text-[#1E1E1E] placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-light-grey shadow-none!"
                  rows={1}
                  disabled={isResponding}
                />
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-3">
                <div className="flex flex-1 shrink-0 items-center justify-end gap-4">
                  {isResponding ? (
                    <Button
                      type="button"
                      onClick={() => {
                        // TODO: Implement stop generation logic
                        setIsResponding(false);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A]"
                      title="Stop generation"
                    >
                      <Square className="h-[18px] w-[18px] fill-white" />
                    </Button>
                  ) : input.trim() ? (
                    <Button
                      type="button"
                      onClick={handleSend}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A] disabled:bg-[#CCCCCC] disabled:shadow-none"
                    >
                      <Send className="h-[18px] w-[18px]" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        // Voice input placeholder
                      }}
                      className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-full bg-zinc-300 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A]"
                      title="Voice input"
                    >
                      <Mic
                        className="h-[25px] w-[25px]"
                        strokeWidth={2}
                        style={{ minWidth: "18px", minHeight: "20px" }}
                      />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Footer disclaimer */}
          <div className="mt-1 text-center text-xs text-[#888888]">
            Models can make mistakes. Check important information.
          </div>
        </div>
      </footer>
    </div>
  );
}
