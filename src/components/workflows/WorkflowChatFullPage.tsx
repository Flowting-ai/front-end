"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Share2,
  Pencil,
  Files,
  MessagesSquare,
  Pin,
  Plus,
  Paperclip,
  Globe,
  X,
  Send,
  Mic,
  Square,
  SquareUser,
  Component,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage, type Message } from "@/components/chat/chat-message";
import { toast } from "@/lib/toast-helper";
import { workflowAPI } from "./workflow-api";
import type { WorkflowDTO } from "./types";
import chatStyles from "./workflow-chat-interface.module.css";
import { cn } from "@/lib/utils";

const CONTROL_NODE_IDS = ["start-node", "end-node", "phantom-node"];
const CONTROL_TYPES = ["start", "end", "phantom"];

function countNodes(workflow: WorkflowDTO) {
  const nodes = workflow?.nodes ?? [];
  const byType: Record<string, number> = {
    document: 0,
    chat: 0,
    pin: 0,
    persona: 0,
    model: 0,
  };
  let connectedCount = 0;
  for (const node of nodes) {
    const id = node.id ?? "";
    const type = (node.data?.type ?? "") as string;
    if (CONTROL_NODE_IDS.includes(id) || CONTROL_TYPES.includes(type)) continue;
    connectedCount++;
    if (type in byType) byType[type]++;
  }
  return { connectedCount, byType };
}

interface WorkflowChatFullPageProps {
  workflowId: string;
  workflow: WorkflowDTO;
  onEditWorkflow: () => void;
}

export function WorkflowChatFullPage({
  workflowId,
  workflow,
  onEditWorkflow,
}: WorkflowChatFullPageProps) {
  const [nodesSectionOpen, setNodesSectionOpen] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flowtingLogoUrl = "/new-logos/FlowtingLogo.svg";

  // Click outside to close attach menu (same as chat-interface)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAttachMenu]);

  const { connectedCount, byType } = countNodes(workflow);
  const workflowName = workflow?.name?.trim() || "Untitled Workflow";

  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [displayMessages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  const handleShare = () => {
    toast.info("Share", {
      description: "Share workflow feature coming soon.",
    });
  };

  const handleSend = async () => {
    const trimmedContent = input.trim();
    if (!trimmedContent || isResponding) return;

    const userMessageId = `user-${Date.now()}`;
    const aiMessageId = `ai-${Date.now() + 1}`;

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

    const loadingMessage: Message = {
      id: aiMessageId,
      sender: "ai",
      content: "",
      isLoading: true,
      avatarUrl: flowtingLogoUrl,
      avatarHint: "Flowting AI",
    };

    setDisplayMessages((prev) => [...prev, loadingMessage]);

    try {
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
        avatarUrl: flowtingLogoUrl,
        avatarHint: "Flowting AI",
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
        avatarUrl: flowtingLogoUrl,
        avatarHint: "Flowting AI",
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

  return (
    <div className="px-12 py-4 max-h-[95vh] h-full flex flex-col w-full">
      {/* Row 1 - h-9 (36px), full width, justify-between */}
      <div className="w-full flex items-center justify-between shrink-0 h-9 mb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNodesSectionOpen((o) => !o)}
            className={`text-sm ${nodesSectionOpen ? "text-[#FAFAFA] bg-[#171717]" : "text-[#171717] bg-[#F5F5F5]"} hover:bg-black hover:text-white cursor-pointer rounded-[8px] flex items-center gap-2 px-4 h-9 transition-all duration-300`}
          >
            <span>
              {connectedCount} Node{connectedCount !== 1 ? "s" : ""} Connected
            </span>
            {nodesSectionOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onEditWorkflow}
            className="text-sm text-[#171717] bg-[#F5F5F5] cursor-pointer hover:bg-black hover:text-white rounded-[8px] flex items-center gap-2 px-4 h-9 transition-all duration-300"
          >
            <Pencil className="h-4 w-4" />
            <span>Edit Workflow</span>
          </button>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="pointer-events-none text-sm text-[#0A0A0A]/20 bg-[#F5F5F5]/0 hover:bg-zinc-300 border border-[#D4D4D4] rounded-[8px] shadow-sm flex items-center gap-2 px-4 h-9 transition-all duration-300"
        >
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </button>
      </div>

      {/* Row 2 - toggleable node breakdown, h-7 when visible, full width */}
      {nodesSectionOpen && (
        <div className="w-full flex items-center gap-4 shrink-0 min-h-[28px] py-1 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Files size={16} className="text-[#B47800] shrink-0" />
            <span className="font-normal text-sm text-[#666666]">
              {byType.document} Document{byType.document !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MessagesSquare size={16} className="text-[#B47800] shrink-0" />
            <span className="font-normal text-sm text-[#666666]">
              {byType.chat} Chat{byType.chat !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Pin size={16} className="text-[#B47800] shrink-0" />
            <span className="font-normal text-sm text-[#666666]">
              {byType.pin} Pin{byType.pin !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SquareUser size={16} className="text-[#3C6CFF] shrink-0" />
            <span className="font-normal text-sm text-[#666666]">
              {byType.persona} Persona{byType.persona !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Component size={16} className="text-[#3C6CFF] shrink-0" />
            <span className="font-normal text-sm text-[#666666]">
              {byType.model} Model{byType.model !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* Row 3 - Chat area: workflow image + name, then messages + input */}
      <div className="border border-main-border rounded-3xl flex-1 min-h-0 flex flex-col w-full overflow-hidden">
        {/* Workflow image + name (same design as WorkflowChatInterface) */}
        {displayMessages.length === 0 ? (
          <section className="flex flex-1 flex-col items-center justify-center px-4 py-8">
            <div className="flex flex-col items-center gap-0">
              <div className="w-[146px] h-[146px] flex items-center justify-center overflow-hidden">
                <Image
                  src="/icons/FlowtingAI_LightGrey.png"
                  alt="Workflow"
                  width={81}
                  height={81}
                  className="object-contain"
                />
              </div>
              <h1 className="capitalize font-clash font-medium text-[28px] text-[#1E1E1E] text-center">
                {workflowName}
              </h1>
            </div>
            <p className="mt-1 text-sm text-[#8B8B8B] leading-relaxed font-geist text-center max-w-md">
              Your intelligent assistant for reports, automation,
              <br /> and creative workflows.
            </p>
          </section>
        ) : (
          <div
            className={`flex-1 min-h-0 overflow-y-auto ${chatStyles.customScrollbar ?? ""} ${chatStyles.hidePinButton ?? ""}`}
            ref={scrollViewportRef}
          >
            <div className="mx-auto w-full max-w-[850px] flex flex-col gap-3 pr-4 py-4">
              <div className="rounded-[32px] border border-transparent bg-white p-6 shadow-none">
                <div className="flex flex-col gap-3">
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
                      disablePinning={true}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat input footer - same as chat-interface: attach (files + web search), textarea, send/stop/mic */}
        <footer className="shrink-0 bg-transparent px-0 pb-0 pt-2">
          <div className="relative w-full max-w-[756px] mx-auto">
            <div
              className="rounded-[24px] border border-[#D9D9D9] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              style={{
                minHeight: "90px",
                transition: "min-height 0.2s ease",
              }}
            >
              <div className="flex flex-col gap-1.5 px-5 py-4">
                <div className="w-full">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
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
                <div className="flex items-center gap-3">
                  <div className="relative" ref={attachMenuRef}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf,image/*"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files?.length) {
                          toast.info("Attachments", {
                            description: "File attachment in workflow chat can be wired to your workflow when supported.",
                          });
                        }
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-0 hover:bg-[#F5F5F5] hover:border-[#D9D9D9]"
                    >
                      <Plus className="h-5 w-5 text-[#555555]" />
                    </Button>
                    {showAttachMenu && (
                      <div
                        className="absolute bottom-full left-0 mb-2 flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-2 shadow-lg"
                        style={{ width: "160px" }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowAttachMenu(false);
                          }}
                          className="flex gap-1.5 rounded-lg border border-[#E5E5E5] bg-white p-2 text-left text-xs font-medium text-[#1E1E1E] transition-colors hover:bg-[#F5F5F5] whitespace-nowrap"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-[#666666]" />
                          <span>Attach Files</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWebSearchEnabled(!webSearchEnabled);
                            setShowAttachMenu(false);
                            toast(
                              webSearchEnabled
                                ? "Web search disabled"
                                : "Web search enabled",
                              {
                                description: webSearchEnabled
                                  ? "Results will not include web search"
                                  : "Results will include web search",
                              },
                            );
                          }}
                          className={cn(
                            "flex gap-1.5 rounded-lg border p-2 text-left text-xs font-medium transition-colors whitespace-nowrap",
                            webSearchEnabled
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-[#E5E5E5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]",
                          )}
                        >
                          <Globe
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              webSearchEnabled ? "text-blue-600" : "text-[#666666]",
                            )}
                          />
                          <span>Web Search</span>
                          {webSearchEnabled && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  {webSearchEnabled && (
                    <button
                      type="button"
                      aria-label="Disable web search"
                      onClick={() => setWebSearchEnabled(false)}
                      className="flex items-center justify-center gap-2 rounded-[8px] px-2 py-1.5 text-sm font-medium text-[#2563eb] bg-[#F0F7FF] border-none min-h-[36px]"
                    >
                      <Globe className="h-4 w-4" />
                      <span>Web Search</span>
                      <X className="h-4 w-4 ml-1 cursor-pointer" />
                    </button>
                  )}
                  <div className="flex flex-1 shrink-0 items-center justify-end gap-4">
                    {isResponding ? (
                      <Button
                        type="button"
                        onClick={() => setIsResponding(false)}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A]"
                        title="Stop generation"
                      >
                        <Square className="h-[18px] w-[18px] fill-white" />
                      </Button>
                    ) : input.trim() ? (
                      <Button
                        type="button"
                        onClick={() => handleSend()}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A] disabled:bg-[#CCCCCC] disabled:shadow-none"
                      >
                        <Send className="h-[18px] w-[18px]" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => {
                          toast.info("Voice input", {
                            description: "Voice input coming soon.",
                          });
                        }}
                        className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-full bg-zinc-300 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
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
            <div className="mt-1 text-center text-xs text-[#888888]">
              Models can make mistakes. Check important information.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
