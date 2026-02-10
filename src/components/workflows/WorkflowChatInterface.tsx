"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import chatStyles from "./workflow-chat-interface.module.css";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Loader2, Square, Mic } from "lucide-react";
import { ChatMessage, type Message } from "@/components/chat/chat-message";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { AIModel } from "@/types/ai-model";
import { getModelIcon } from "@/lib/model-icons";
import { toast } from "@/lib/toast-helper";
import Image from "next/image";
import {
  workflowAPI,
  type StreamCallbacks,
  type NodeStartEvent,
  type ChunkEvent,
  type NodeEndEvent,
  type WorkflowCompleteEvent,
} from "./workflow-api";
import type { NodeStatus } from "./types";

interface NodeOutput {
  nodeId: string;
  nodeName?: string;
  content: string;
  isStreaming: boolean;
  status: NodeStatus;
  tokens?: number;
  cost?: number;
  durationMs?: number;
}

interface WorkflowChatInterfaceProps {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
  selectedModel?: AIModel | null;
  onRunStart?: () => void;
  onNodeStatusChange?: (nodeId: string, status: NodeStatus, output?: string) => void;
}

export function WorkflowChatInterface({
  workflowId,
  workflowName: _workflowName,
  onClose,
  selectedModel,
  onRunStart,
  onNodeStatusChange,
}: WorkflowChatInterfaceProps) {
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeOutputs, setNodeOutputs] = useState<Map<string, NodeOutput>>(new Map());
  const [expandedNodeOutputId, setExpandedNodeOutputId] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);
  const abortRef = useRef<(() => void) | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Ref to track streaming content without stale closure issues
  const streamingContentRef = useRef<Map<string, string>>(new Map());
  // Track nodes already marked as running to avoid repeated expensive canvas updates.
  const seenRunningNodesRef = useRef<Set<string>>(new Set());

  const userAvatar = PlaceHolderImages.find((p) => p.id === "user-avatar");
  const defaultAiAvatar = PlaceHolderImages.find((p) => p.id === "ai-avatar");

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
      avatarUrl: userAvatar?.imageUrl,
      avatarHint: userAvatar?.imageHint,
    };

    setDisplayMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsResponding(true);
    setNodeOutputs(new Map());
    setExpandedNodeOutputId(null);
    setTotalCost(0);
    setActiveNodeId(null);
    streamingContentRef.current = new Map(); // Reset streaming content ref
    seenRunningNodesRef.current = new Set();
    onRunStart?.();

    // Add streaming message placeholder
    const streamingMessage: Message = {
      id: aiMessageId,
      sender: "ai",
      content: "Starting workflow...",
      isLoading: true,
      avatarUrl: selectedModel
        ? getModelIcon(selectedModel.companyName, selectedModel.modelName)
        : defaultAiAvatar?.imageUrl,
      avatarHint: selectedModel?.modelName || "AI model",
    };

    setDisplayMessages((prev) => [...prev, streamingMessage]);

    try {
      if (!workflowId || workflowId === "temp") {
        throw new Error("Save the workflow first, then run workflow chat.");
      }

      // Streaming callbacks
      const callbacks: StreamCallbacks = {
        onWorkflowStart: (event) => {
          console.log("[Stream] Workflow started:", event.run_id);
          setDisplayMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: "Workflow running...", isLoading: true }
                : msg
            )
          );
        },

        onNodeStart: (event: NodeStartEvent) => {
          console.log("[Stream] Node started:", event.node_id);
          setActiveNodeId(event.node_id);
          setExpandedNodeOutputId(event.node_id);
          if (!seenRunningNodesRef.current.has(event.node_id)) {
            seenRunningNodesRef.current.add(event.node_id);
            onNodeStatusChange?.(event.node_id, "running");
          }
          // Initialize streaming content for this node
          streamingContentRef.current.set(event.node_id, "");
          setNodeOutputs((prev) => {
            const next = new Map(prev);
            next.set(event.node_id, {
              nodeId: event.node_id,
              nodeName: event.node_name || event.node_id,
              content: "",
              isStreaming: true,
              status: "running",
            });
            return next;
          });

          // Update message to show active node
          setDisplayMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: `**${event.node_name || event.node_id}** is thinking...`,
                    isLoading: true,
                  }
                : msg
            )
          );
        },

        onChunk: (event: ChunkEvent) => {
          const nodeId = event.node_id || "unknown_node";
          const chunkContent = event.content || "";

          console.log("[Stream] Chunk received:", {
            node_id: nodeId,
            content: chunkContent,
            chunk_index: event.chunk_index,
          });

          // Some backends emit chunks without node_start; keep the active node in sync.
          setActiveNodeId(nodeId);
          setExpandedNodeOutputId(nodeId);
          if (!seenRunningNodesRef.current.has(nodeId)) {
            seenRunningNodesRef.current.add(nodeId);
            onNodeStatusChange?.(nodeId, "running");
          }

          // Update ref with latest content (avoids stale closure)
          const currentContent = streamingContentRef.current.get(nodeId) || "";
          const newContent = currentContent + chunkContent;
          streamingContentRef.current.set(nodeId, newContent);

          console.log("[Stream] Updated content:", newContent.slice(0, 100) + "...");

          // Append chunk to node output state
          setNodeOutputs((prev) => {
            const next = new Map(prev);
            const existing = next.get(nodeId);
            if (existing) {
              next.set(nodeId, {
                ...existing,
                content: existing.content + chunkContent,
                isStreaming: true,
                status: "running",
              });
            } else {
              next.set(nodeId, {
                nodeId,
                nodeName: nodeId,
                content: chunkContent,
                isStreaming: true,
                status: "running",
              });
            }
            return next;
          });

          // Update message with streaming content from ref
          setDisplayMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== aiMessageId) return msg;

              // Use ref for latest content (not stale state)
              const streamContent = streamingContentRef.current.get(nodeId) || chunkContent;

              return {
                ...msg,
                content: streamContent,
                // Keep streaming visible instead of skeleton placeholders.
                isLoading: false,
              };
            })
          );
        },

        onNodeEnd: (event: NodeEndEvent) => {
          console.log("[Stream] Node ended:", event.node_id, "Cost:", event.cost);
          setActiveNodeId(null);
          const fallbackContent =
            streamingContentRef.current.get(event.node_id) || "";
          const finalContent = event.output || fallbackContent;
          setNodeOutputs((prev) => {
            const next = new Map(prev);
            const existing = next.get(event.node_id);
            if (existing) {
              next.set(event.node_id, {
                ...existing,
                content: finalContent || existing.content,
                isStreaming: false,
                status: "success",
                tokens: event.tokens_used,
                cost: event.cost,
                durationMs: event.duration_ms,
              });
            } else {
              next.set(event.node_id, {
                nodeId: event.node_id,
                nodeName: event.node_id,
                content: finalContent,
                isStreaming: false,
                status: "success",
                tokens: event.tokens_used,
                cost: event.cost,
                durationMs: event.duration_ms,
              });
            }
            return next;
          });
          seenRunningNodesRef.current.delete(event.node_id);
          onNodeStatusChange?.(event.node_id, "success", finalContent);

          // Accumulate total cost
          if (event.cost) {
            setTotalCost((prev) => prev + event.cost!);
          }
        },

        onNodeComplete: (event) => {
          console.log("[Stream] Node complete (non-LLM):", event.node_id);
          setNodeOutputs((prev) => {
            const next = new Map(prev);
            next.set(event.node_id, {
              nodeId: event.node_id,
              nodeName: event.node_id,
              content: event.output,
              isStreaming: false,
              status: "success",
            });
            return next;
          });
          seenRunningNodesRef.current.delete(event.node_id);
          onNodeStatusChange?.(event.node_id, "success", event.output);
        },

        onWorkflowComplete: (event: WorkflowCompleteEvent) => {
          console.log("[Stream] Workflow complete! Total cost:", event.total_cost);

          const finalMessage: Message = {
            id: aiMessageId,
            sender: "ai",
            content: event.final_output || "Workflow completed successfully.",
            avatarUrl: selectedModel
              ? getModelIcon(selectedModel.companyName, selectedModel.modelName)
              : defaultAiAvatar?.imageUrl,
            avatarHint: selectedModel?.modelName || "AI model",
            metadata: {
              providerName: selectedModel?.companyName,
              modelName: selectedModel?.modelName,
            },
          };

          setDisplayMessages((prev) =>
            prev.map((msg) => (msg.id === aiMessageId ? finalMessage : msg))
          );
          setIsResponding(false);
          setActiveNodeId(null);
          abortRef.current = null;
        },

        onError: (event) => {
          console.error("[Stream] Error:", event.error);
          if (event.node_id) {
            setNodeOutputs((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.node_id!);
              if (existing) {
                next.set(event.node_id!, {
                  ...existing,
                  isStreaming: false,
                  status: "error",
                });
              }
              return next;
            });
            seenRunningNodesRef.current.delete(event.node_id);
            onNodeStatusChange?.(event.node_id, "error");
          }

          const errorMessage: Message = {
            id: aiMessageId,
            sender: "ai",
            content: `Error: ${event.error}`,
            avatarUrl: selectedModel
              ? getModelIcon(selectedModel.companyName, selectedModel.modelName)
              : defaultAiAvatar?.imageUrl,
            avatarHint: selectedModel?.modelName || "AI model",
          };

          setDisplayMessages((prev) =>
            prev.map((msg) => (msg.id === aiMessageId ? errorMessage : msg))
          );
          setIsResponding(false);
          setActiveNodeId(null);
          abortRef.current = null;
        },
      };

      // Start streaming execution
      const { abort } = await workflowAPI.executeStream(
        workflowId,
        trimmedContent,
        callbacks
      );
      abortRef.current = abort;
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
          : defaultAiAvatar?.imageUrl,
        avatarHint: selectedModel?.modelName || "AI model",
      };

      setDisplayMessages((prev) =>
        prev.map((msg) => (msg.id === aiMessageId ? errorMessage : msg))
      );
      setIsResponding(false);
    }
  };

  const handleAbort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setIsResponding(false);
      if (activeNodeId) {
        onNodeStatusChange?.(activeNodeId, "error");
      }
      setActiveNodeId(null);
      toast("Workflow execution cancelled");
    }
  }, [activeNodeId, onNodeStatusChange]);

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

  const outputItems = Array.from(nodeOutputs.values());
  const getOutputStatusClass = (status: NodeStatus) => {
    if (status === "running") return "bg-blue-100 text-blue-700 border-blue-200";
    if (status === "success") return "bg-green-100 text-green-700 border-green-200";
    if (status === "error") return "bg-red-100 text-red-700 border-red-200";
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
  };
  const getCollapsedPreview = (content: string) => {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (!normalized) return "No output yet";
    return normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized;
  };

  return (
    <div className="top-[60px] max-h-[calc(100vh-65px)] right-2 relative flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-white border border-main-border rounded-3xl shadow-lg">
      {/* Streaming Status Bar */}
      {isResponding && activeNodeId && (
        <div className="absolute top-0 left-0 right-0 bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm text-blue-700">
            <strong>{nodeOutputs.get(activeNodeId)?.nodeName || activeNodeId}</strong> is processing...
          </span>
          {totalCost > 0 && (
            <span className="ml-auto text-xs text-blue-500">
              Cost: ${totalCost.toFixed(4)}
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <button
          onClick={onClose}
          className="absolute top-2 right-3.5 z-20 cursor-pointer flex w-auto py-2 px-2 bg-zinc-100 text-xs items-center justify-center gap-2 rounded-full hover:bg-[#F5F5F5] transition-colors shadow-sm"
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

                {outputItems.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-[#E7E7E7] bg-[#FAFAFA] p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6F6F6F]">
                      Node Outputs
                    </div>
                    <div className="space-y-2">
                      {outputItems.map((output) => {
                        const isExpanded = expandedNodeOutputId === output.nodeId;
                        return (
                          <div
                            key={output.nodeId}
                            className="rounded-xl border border-[#E4E4E4] bg-white"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedNodeOutputId((prev) =>
                                  prev === output.nodeId ? null : output.nodeId
                                )
                              }
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-[#1E1E1E]">
                                  {output.nodeName || output.nodeId}
                                </div>
                                {!isExpanded && (
                                  <div className="truncate text-xs text-[#6B7280]">
                                    {getCollapsedPreview(output.content)}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOutputStatusClass(
                                  output.status
                                )}`}
                              >
                                {output.status}
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="border-t border-[#EFEFEF] px-3 py-2">
                                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[#3D3D3D]">
                                  {output.content || "No output yet"}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                      onClick={handleAbort}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-red-700"
                      title="Stop workflow execution"
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
