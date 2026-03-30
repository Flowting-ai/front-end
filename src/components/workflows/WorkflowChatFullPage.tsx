"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
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
import {
  workflowAPI,
  type NodeStartEvent,
  type ChunkEvent,
  type NodeEndEvent,
  type NodeCompleteEvent,
  type WorkflowCompleteEvent,
  type WorkflowChatMessage,
  type StreamErrorEvent,
} from "./workflow-api";
import type { WorkflowDTO, NodeStatus } from "./types";
import { extractThinkingContent } from "@/lib/thinking";
import chatStyles from "./workflow-chat-interface.module.css";
import { cn } from "@/lib/utils";

const CONTROL_NODE_IDS = ["start-node", "end-node", "phantom-node"];
const CONTROL_TYPES = ["start", "end", "phantom"];

interface NodeOutput {
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
  content: string;
  isStreaming: boolean;
  status: NodeStatus;
  tokens?: number;
  cost?: number;
  durationMs?: number;
}

const getOutputStatusClass = (status: NodeStatus) => {
  if (status === "running") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "success")
    return "bg-green-100 text-green-700 border-green-200";
  if (status === "error") return "bg-red-100 text-red-700 border-red-200";
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
};

const getCollapsedPreview = (content: string) => {
  const normalized = content
    .replace(/<\/?think>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "No output yet";
  return normalized.length > 140
    ? `${normalized.slice(0, 140)}...`
    : normalized;
};

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
  /** Existing chat session ID (from URL search param). When provided, loads history. */
  chatId?: string | null;
}

export function WorkflowChatFullPage({
  workflowId,
  workflow,
  onEditWorkflow,
  chatId,
}: WorkflowChatFullPageProps) {
  const isValidUUID = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const [activeChatId, setActiveChatId] = useState<string | null>(
    chatId && isValidUUID(chatId) ? chatId : null,
  );
  const [nodesSectionOpen, setNodesSectionOpen] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [nodeOutputs, setNodeOutputs] = useState<Map<string, NodeOutput>>(
    new Map(),
  );
  const [expandedNodeOutputId, setExpandedNodeOutputId] = useState<
    string | null
  >(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  // Per-node streaming content (avoids stale-closure issues)
  const streamingContentRef = useRef<Map<string, string>>(new Map());
  const nodeOutputsRef = useRef<Map<string, NodeOutput>>(new Map());
  const flowtingLogoUrl = "/new-logos/souvenir-logo.svg";

  // Click outside to close attach menu (same as chat-interface)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target as Node)
      ) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAttachMenu]);

  const { connectedCount, byType } = countNodes(workflow);
  const workflowName = workflow?.name?.trim() || "Untitled Workflow";

  // Sync activeChatId with prop — handles navigating between workflow chat sessions.
  // Functional updater avoids clearing messages when handleSend already set activeChatId
  // and the URL is just catching up.
  useEffect(() => {
    const resolved = chatId && isValidUUID(chatId) ? chatId : null;
    setActiveChatId((prev) => {
      if (prev === resolved) return prev;
      setDisplayMessages([]);
      return resolved;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Load message history when a saved chatId is available.
  useEffect(() => {
    if (!activeChatId) return;
    let cancelled = false;
    workflowAPI
      .getChatMessages(workflowId, activeChatId)
      .then((msgs: WorkflowChatMessage[]) => {
        if (cancelled || msgs.length === 0) return;
        const converted: Message[] = msgs.flatMap((m) => {
          const items: Message[] = [];
          if (m.input) {
            items.push({
              id: `${m.message_id}-user`,
              sender: "user",
              content: m.input,
              avatarUrl: "/personas/userAvatar.png",
              avatarHint: "User",
            });
          }
          if (m.output) {
            const sanitized = extractThinkingContent(m.output);
            items.push({
              id: `${m.message_id}-ai`,
              sender: "ai",
              content: sanitized.visibleText || m.output,
              thinkingContent: m.reasoning || sanitized.thinkingText || null,
              avatarUrl: flowtingLogoUrl,
              avatarHint: workflowName,
            });
          }
          return items;
        });
        setDisplayMessages(converted);
      })
      .catch(() => {
        /* silently ignore */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, workflowId]);

  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop =
        scrollViewportRef.current.scrollHeight;
    }
  }, [displayMessages]);

  useEffect(() => {
    if (textareaRef.current) {
      const maxHeight = 200;
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textareaRef.current.style.overflowY =
        scrollHeight > maxHeight ? "auto" : "hidden";
    }
  }, [input]);

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
    streamingContentRef.current = new Map(); // reset per-node streaming content
    nodeOutputsRef.current = new Map();
    setNodeOutputs(new Map());
    setExpandedNodeOutputId(null);

    try {
      const streamCallbacks = {
        onNodeStart: (event: NodeStartEvent) => {
          const nodeId = event.node_id;
          const nodeName = event.node_name || event.name || nodeId;
          streamingContentRef.current.set(nodeId, "");
          setExpandedNodeOutputId(nodeId);
          setNodeOutputs((prev) => {
            const next = new Map(prev);
            next.set(nodeId, {
              nodeId,
              nodeName,
              nodeType: event.node_type,
              content: "",
              isStreaming: true,
              status: "running",
            });
            nodeOutputsRef.current = next;
            return next;
          });
          setDisplayMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: `**${nodeName}** is thinking...`,
                    isLoading: true,
                  }
                : msg,
            ),
          );
        },

        onChunk: (event: ChunkEvent) => {
          const nodeId = event.node_id || "unknown_node";
          const chunk = event.content || "";
          const current = streamingContentRef.current.get(nodeId) || "";
          const updated = current + chunk;
          streamingContentRef.current.set(nodeId, updated);

          // Ensure this node has an entry even if node_start was missed
          setNodeOutputs((prev) => {
            const next = new Map(prev);
            const existing = next.get(nodeId);
            if (existing) {
              next.set(nodeId, {
                ...existing,
                content: existing.content + chunk,
                isStreaming: true,
                status: "running",
              });
            } else {
              next.set(nodeId, {
                nodeId,
                nodeName: nodeId,
                content: chunk,
                isStreaming: true,
                status: "running",
              });
            }
            nodeOutputsRef.current = next;
            return next;
          });

          const { visibleText, thinkingText } = extractThinkingContent(updated);
          const hasOpenThink = /<think>/i.test(updated);
          const hasCloseThink = /<\/think>/i.test(updated);
          const stillThinking = hasOpenThink && !hasCloseThink;
          setDisplayMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: visibleText || (stillThinking ? "" : updated),
                    thinkingContent:
                      thinkingText ||
                      (stillThinking
                        ? updated.replace(/^[\s\S]*<think>/i, "").trim()
                        : undefined) ||
                      msg.thinkingContent ||
                      undefined,
                    isThinkingInProgress:
                      stillThinking || Boolean(thinkingText),
                    isLoading: false,
                  }
                : msg,
            ),
          );
        },

        onNodeEnd: (event: NodeEndEvent) => {
          const fallback = streamingContentRef.current.get(event.node_id) || "";
          const finalContent = event.output || fallback;
          setNodeOutputs((prev) => {
            const next = new Map(prev);
            const existing = next.get(event.node_id);
            next.set(event.node_id, {
              ...(existing ?? {
                nodeId: event.node_id,
                nodeName: event.node_id,
                content: "",
                isStreaming: false,
                status: "success",
              }),
              content: finalContent || existing?.content || "",
              isStreaming: false,
              status: "success",
              tokens: event.tokens_used,
              cost: event.cost,
              durationMs: event.duration_ms,
            });
            nodeOutputsRef.current = next;
            return next;
          });
        },

        onNodeComplete: (event: NodeCompleteEvent) => {
          setNodeOutputs((prev) => {
            const next = new Map(prev);
            const existing = next.get(event.node_id);
            const resolved =
              event.output ||
              existing?.content ||
              streamingContentRef.current.get(event.node_id) ||
              "";
            next.set(event.node_id, {
              nodeId: event.node_id,
              nodeName: existing?.nodeName || event.node_id,
              nodeType: event.node_type,
              content: resolved,
              isStreaming: false,
              status: "success",
              tokens: existing?.tokens,
              cost: existing?.cost,
              durationMs: existing?.durationMs,
            });
            nodeOutputsRef.current = next;
            return next;
          });
        },

        onWorkflowComplete: (event: WorkflowCompleteEvent) => {
          let rawFinal = (event.final_output || "").trim();
          if (!rawFinal) {
            const outputs = Array.from(nodeOutputsRef.current.values());
            if (outputs.length > 0) {
              rawFinal = outputs
                .map((o, i) => {
                  const body =
                    o.content
                      .replace(/<\/?think>[\s\S]*?<\/think>/gi, "")
                      .trim() || "_No output produced_";
                  return `### Step ${i + 1}: ${o.nodeName || o.nodeId}\n\n${body}`;
                })
                .join("\n\n");
            }
          }
          if (!rawFinal) rawFinal = "Workflow completed successfully.";
          const { visibleText: finalVisible, thinkingText: finalThinking } =
            extractThinkingContent(rawFinal);
          setDisplayMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: finalVisible || rawFinal,
                    thinkingContent:
                      finalThinking || msg.thinkingContent || undefined,
                    isThinkingInProgress: false,
                    isLoading: false,
                    ...(event.images?.length ? { images: event.images } : {}),
                  }
                : msg,
            ),
          );
          setIsResponding(false);
          abortRef.current = null;
        },

        onError: (event: StreamErrorEvent) => {
          if (event.node_id) {
            setNodeOutputs((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.node_id!);
              if (existing)
                next.set(event.node_id!, {
                  ...existing,
                  isStreaming: false,
                  status: "error",
                });
              nodeOutputsRef.current = next;
              return next;
            });
          }
          setDisplayMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: `Error: ${event.error}`, isLoading: false }
                : msg,
            ),
          );
          setIsResponding(false);
          abortRef.current = null;
        },
      };

      // Use the same backend endpoint as Test Workflow to avoid
      // workflow chat endpoint schema mismatches.
      const streamResult = await workflowAPI.executeStream(
        workflowId,
        trimmedContent,
        streamCallbacks,
      );
      abortRef.current = streamResult.abort;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Sorry, I encountered an error processing your request.";
      setDisplayMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, content: message, isLoading: false }
            : msg,
        ),
      );
      setIsResponding(false);
    }
  };

  const handleAbort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setIsResponding(false);
      toast("Workflow execution cancelled");
    }
  }, []);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast("Copied to clipboard!");
  };

  return (
    <div className="px-12 py-4 max-h-[95vh] h-full flex flex-col w-full">
      {/* Row 1 - h-9 (36px), full width, justify-between */}
      <div className="w-full flex items-center justify-start shrink-0 h-9 mb-3">
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
        {/* Workkflow chat input area - Workflow image + name (same design as WorkflowChatInterface) */}
        {displayMessages.length === 0 ? (
          <section className="flex flex-1 min-h-0 overflow-hidden flex-col items-center justify-center px-4 py-8">
            <div className="flex flex-col items-center gap-0">
              <div className="w-[146px] h-[146px] flex items-center justify-center overflow-hidden">
                <Image
                  src="/new-logos/souvenir-logo-chat.svg"
                  alt="Souvenir AI Chat"
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

                  {/* Per-node / per-model output panel */}
                  {/* Only show LLM nodes (model/persona) — not pin/chat/document context nodes */}
                  {(() => {
                    const LLM_NODE_TYPES = new Set(["model", "persona"]);
                    const llmOutputs = Array.from(nodeOutputs.values()).filter(
                      (o) =>
                        !o.nodeType ||
                        LLM_NODE_TYPES.has(o.nodeType.toLowerCase()),
                    );
                    if (llmOutputs.length === 0) return null;
                    return (
                      <div className="mt-6 rounded-2xl border border-[#E7E7E7] bg-[#FAFAFA] p-4">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6F6F6F]">
                          Node Outputs ({llmOutputs.length})
                        </div>
                        <div className="space-y-2">
                          {llmOutputs.map((output) => {
                            const isExpanded =
                              expandedNodeOutputId === output.nodeId;
                            const thinkStripped = output.content
                              .replace(/<think>[\s\S]*?<\/think>/gi, "")
                              .trim();
                            return (
                              <div
                                key={output.nodeId}
                                className="rounded-xl border border-[#E4E4E4] bg-white"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedNodeOutputId((prev) =>
                                      prev === output.nodeId
                                        ? null
                                        : output.nodeId,
                                    )
                                  }
                                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50/50 transition-colors rounded-xl"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="truncate text-sm font-medium text-[#1E1E1E]">
                                        {output.nodeName || output.nodeId}
                                      </span>
                                      {output.nodeType && (
                                        <span className="shrink-0 rounded-md bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 uppercase">
                                          {output.nodeType}
                                        </span>
                                      )}
                                    </div>
                                    {!isExpanded && (
                                      <div className="truncate text-xs text-[#6B7280]">
                                        {getCollapsedPreview(output.content)}
                                      </div>
                                    )}
                                    {output.tokens !== undefined && (
                                      <div className="mt-1 text-[10px] text-[#8B8B8B]">
                                        {output.tokens > 0 &&
                                          `${output.tokens} tokens`}
                                        {output.cost !== undefined &&
                                          output.cost > 0 &&
                                          ` • $${output.cost.toFixed(4)}`}
                                        {output.durationMs !== undefined &&
                                          ` • ${(output.durationMs / 1000).toFixed(2)}s`}
                                      </div>
                                    )}
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOutputStatusClass(output.status)}`}
                                  >
                                    {output.status}
                                  </span>
                                </button>
                                {isExpanded && (
                                  <div className="border-t border-[#EFEFEF] px-3 py-3 break-words">
                                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#3D3D3D] break-words">
                                      {thinkStripped ||
                                        (output.isStreaming ? (
                                          <span className="text-zinc-400 italic">
                                            Generating…
                                          </span>
                                        ) : (
                                          <span className="text-zinc-400 italic">
                                            No output yet
                                          </span>
                                        ))}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat input footer - same as chat-interface: attach (files + web search), textarea, send/stop/mic */}
        <footer className="shrink-0 bg-transparent px-0 pb-0 pt-2">
          <div className="relative w-full max-w-[756px] mx-auto flex flex-col">
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
                      if (e.key === "Enter" && !e.shiftKey && !isResponding) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Chat with ..."
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
                            description:
                              "File attachment in workflow chat can be wired to your workflow when supported.",
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
                    {/* {showAttachMenu && (
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
                    )} */}
                    {showAttachMenu && (
                      <div
                        className="absolute bottom-full left-0 mb-2 flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-2 shadow-lg"
                        style={{ width: "auto" }}
                      >
                        <button
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowAttachMenu(false);
                          }}
                          className="flex items-center gap-1.5 rounded-lg cursor-pointer bg-white p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-[#666666]" />
                          <span>Attach images or files</span>
                        </button>
                        <button
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
                            "flex items-center gap-1.5 rounded-lg cursor-pointer border p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap",
                            webSearchEnabled
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-none bg-white text-[#1E1E1E]",
                          )}
                        >
                          <Globe
                            className={cn(
                              "h-3.5 w-3.5",
                              webSearchEnabled
                                ? "text-blue-600"
                                : "text-[#666666]",
                            )}
                          />
                          <span>Web Search</span>
                          {webSearchEnabled && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600"></div>
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
                        onClick={handleAbort}
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
                        <Send
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
            <div className="mt-1 shrink-0 text-center text-xs text-[#888888]">
              Models can make mistakes. Check important information.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
