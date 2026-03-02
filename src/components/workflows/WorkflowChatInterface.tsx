"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import chatStyles from "./workflow-chat-interface.module.css";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Loader2, Square, Mic, Maximize2, Minimize2, ChevronDown } from "lucide-react";
import { ChatMessage, type Message } from "@/components/chat/chat-message";
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
  type AskUserEvent,
} from "./workflow-api";
import type { NodeStatus } from "./types";
import { extractThinkingContent } from "@/lib/thinking";

// Collapsible reasoning block shown inside node output panels
const NodeReasoningBlock = ({ text, isStreaming }: { text: string; isStreaming?: boolean }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <div className="mb-2 rounded-lg border border-[#e8e3f4] bg-[#f9f7ff] overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left"
      >
        <div className="flex items-center gap-1.5">
          {isStreaming && (
            <span className="flex gap-0.5">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-[#7c6fcd] animate-bounce"
                  style={{ animationDelay: `${d * 0.15}s` }}
                />
              ))}
            </span>
          )}
          <span className="text-[11px] font-semibold text-[#6b5fad] tracking-wide">
            {isStreaming ? "Reasoning\u2026" : "Reasoning"}
          </span>
        </div>
        <ChevronDown
          className={`h-3 w-3 text-[#9d8fd4] transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
        />
      </button>
      {!collapsed && (
        <div className="border-t border-[#e8e3f4] px-3 py-2">
          <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-[#6b5fad]/80">
            {text}
            {isStreaming && (
              <span className="inline-block w-[2px] h-[12px] bg-[#9d8fd4] ml-[1px] align-middle animate-[blink_0.8s_step-end_infinite]" />
            )}
          </pre>
        </div>
      )}
    </div>
  );
};

// Helper function to render markdown content for node outputs
const renderMarkdownContent = (content: string): React.ReactElement => {
  if (!content) return <span className="text-zinc-400 italic">No output yet</span>;

  const lines = content.split("\n");
  const elements: React.ReactElement[] = [];
  let i = 0;

  // Helper to detect table rows
  const isTableRow = (line: string) => {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.includes("|", 1);
  };

  const isTableDivider = (line: string) =>
    /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line.trim());

  const parseTableRow = (line: string) => {
    const cleaned = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return cleaned.split("|").map((cell) => cell.trim());
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Detect and render tables
    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headerCells = parseTableRow(line);
      const bodyRows: string[][] = [];
      let j = i + 2; // Skip header and divider

      while (j < lines.length && isTableRow(lines[j])) {
        bodyRows.push(parseTableRow(lines[j]));
        j++;
      }

      elements.push(
        <div key={`table-${i}`} className="my-2 max-w-full overflow-y-auto customScrollbar2">
          <table className="max-w-[200px] w-full table-fixed border-collapse text-xs">
            <thead className="bg-slate-100">
              <tr>
                {headerCells.map((cell, idx) => (
                  <th
                    key={`th-${i}-${idx}`}
                    className="border border-slate-200 px-2 py-1 text-left font-semibold break-words"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIdx) => (
                <tr key={`tr-${i}-${rowIdx}`} className="odd:bg-white even:bg-slate-50">
                  {row.map((cell, cellIdx) => (
                    <td
                      key={`td-${i}-${rowIdx}-${cellIdx}`}
                      className="border border-slate-200 px-2 py-1 align-top break-words"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j;
      continue;
    }

    // Detect and render code blocks
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      let j = i + 1;

      while (j < lines.length && !lines[j].trim().startsWith("```")) {
        codeLines.push(lines[j]);
        j++;
      }

      elements.push(
        <div key={`code-${i}`} className="my-2 rounded bg-slate-900 p-2">
          {language && (
            <div className="mb-1 text-[10px] font-mono text-slate-400">{language}</div>
          )}
          <pre className="overflow-x-auto text-xs text-slate-100">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      i = j + 1; // Skip closing ```
      continue;
    }

    // Detect and render lists
    if (trimmed.match(/^[-*+]\s+/)) {
      const listItems: string[] = [];
      let j = i;

      while (j < lines.length && lines[j].trim().match(/^[-*+]\s+/)) {
        listItems.push(lines[j].trim().replace(/^[-*+]\s+/, ""));
        j++;
      }

      elements.push(
        <ul key={`list-${i}`} className="my-1 ml-4 list-disc space-y-0.5 text-xs">
          {listItems.map((item, idx) => (
            <li key={`li-${i}-${idx}`}>{item}</li>
          ))}
        </ul>
      );
      i = j;
      continue;
    }

    // Detect headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizeClass = level === 1 ? "text-base" : level === 2 ? "text-sm" : "text-xs";

      const headingElement = React.createElement(
        `h${level}`,
        { key: `heading-${i}`, className: `font-semibold ${sizeClass} my-1` },
        text
      );
      elements.push(headingElement);
      i++;
      continue;
    }

    // Render as regular paragraph with bold/italic support
    const processedLine = line
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');

    elements.push(
      <p key={`p-${i}`} className="my-0.5 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: processedLine }} />
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
};

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
  const [nodeMetadata, setNodeMetadata] = useState<
    Map<string, { label: string; type?: string }>
  >(new Map());
  const [isResponding, setIsResponding] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeOutputs, setNodeOutputs] = useState<Map<string, NodeOutput>>(new Map());
  const [expandedNodeOutputId, setExpandedNodeOutputId] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);
  const abortRef = useRef<(() => void) | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeOutputsRef = useRef<Map<string, NodeOutput>>(new Map());
  // Ref to track streaming content without stale closure issues
  const streamingContentRef = useRef<Map<string, string>>(new Map());
  // Track nodes already marked as running to avoid repeated expensive canvas updates.
  const seenRunningNodesRef = useRef<Set<string>>(new Set());

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

  // Fetch workflow metadata so we can map backend node IDs to human-readable labels
  useEffect(() => {
    let isMounted = true;

    const loadWorkflowMetadata = async () => {
      if (!workflowId || workflowId === "temp") return;
      try {
        const workflow = await workflowAPI.get(workflowId);
        if (!isMounted || !workflow?.nodes) return;

        const map = new Map<string, { label: string; type?: string }>();
        for (const node of workflow.nodes) {
          const data: any = node.data || {};
          const label: string =
            data.label ||
            data.name ||
            (typeof node.id === "string" && node.id.trim().length > 0
              ? node.id
              : "Node");
          const type: string | undefined = data.type;
          map.set(node.id, { label, type });
        }
        setNodeMetadata(map);
      } catch (err) {
        console.warn("[WorkflowChatInterface] Failed to load workflow metadata", err);
      }
    };

    void loadWorkflowMetadata();

    return () => {
      isMounted = false;
    };
  }, [workflowId]);

  const getDisplayNodeName = (nodeId: string, fallbackName?: string) => {
    const meta = nodeMetadata.get(nodeId);
    return meta?.label || fallbackName || nodeId;
  };

  const getDisplayNodeType = (nodeId: string, fallbackType?: string) => {
    const meta = nodeMetadata.get(nodeId);
    return meta?.type || fallbackType;
  };

  const handleSend = async (inputOverride?: string) => {
    const trimmedContent = (inputOverride ?? input).trim();
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
        : flowtingLogoUrl,
      avatarHint: selectedModel?.modelName || "Flowting AI",
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
          console.log(
            "[Stream] Node started:",
            event.node_id,
            "Name:",
            event.node_name,
            "Type:",
            event.node_type
          );
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
              nodeName: getDisplayNodeName(event.node_id, event.node_name),
              nodeType: getDisplayNodeType(event.node_id, event.node_type),
              content: "",
              isStreaming: true,
              status: "running",
            });
            nodeOutputsRef.current = next;
            return next;
          });

          // Update message to show active node
          setDisplayMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: `**${getDisplayNodeName(
                      event.node_id,
                      event.node_name
                    )}** is thinking...`,
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
              // If we receive chunks without node_start, create entry with minimal info
              next.set(nodeId, {
                nodeId,
                nodeName: getDisplayNodeName(nodeId),
                nodeType: getDisplayNodeType(nodeId, undefined),
                content: chunkContent,
                isStreaming: true,
                status: "running",
              });
            }
            nodeOutputsRef.current = next;
            return next;
          });

          // Update message with streaming content from ref
          setDisplayMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== aiMessageId) return msg;

              // Use ref for latest content (not stale state)
              const streamContent = streamingContentRef.current.get(nodeId) || chunkContent;
              const { visibleText, thinkingText } = extractThinkingContent(streamContent);
              // Detect partial <think> that hasn't closed yet
              const hasOpenThink = /<think>/i.test(streamContent);
              const hasCloseThink = /<\/think>/i.test(streamContent);
              const stillThinking = hasOpenThink && !hasCloseThink;
              // While still inside an open <think>, extract the raw partial text for display
              const partialThinking = stillThinking
                ? streamContent.replace(/^[\s\S]*<think>/i, "").trim()
                : undefined;

              return {
                ...msg,
                content: visibleText || (stillThinking ? "" : streamContent),
                thinkingContent: thinkingText || partialThinking || msg.thinkingContent || undefined,
                isThinkingInProgress: stillThinking || Boolean(thinkingText),
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
                nodeName: getDisplayNodeName(event.node_id),
                content: finalContent,
                isStreaming: false,
                status: "success",
                tokens: event.tokens_used,
                cost: event.cost,
                durationMs: event.duration_ms,
              });
            }
            nodeOutputsRef.current = next;
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
          console.log("[Stream] Node complete (non-LLM):", event.node_id, "Type:", event.node_type);
          setNodeOutputs((prev) => {
            const next = new Map(prev);
            const existing = next.get(event.node_id);
            // Prefer event.output; fall back to existing content (set by onNodeEnd streaming)
            // to avoid wiping streamed content when event.output is empty.
            const resolvedContent =
              event.output || existing?.content || streamingContentRef.current.get(event.node_id) || "";
            next.set(event.node_id, {
              nodeId: event.node_id,
              nodeName: existing?.nodeName || getDisplayNodeName(event.node_id),
              nodeType: getDisplayNodeType(event.node_id, event.node_type),
              content: resolvedContent,
              isStreaming: false,
              status: "success",
              // Preserve cost/token metadata already populated by onNodeEnd
              tokens: existing?.tokens,
              cost: existing?.cost,
              durationMs: existing?.durationMs,
            });
            nodeOutputsRef.current = next;
            return next;
          });
          seenRunningNodesRef.current.delete(event.node_id);
          const finalOutput = event.output || streamingContentRef.current.get(event.node_id) || "";
          onNodeStatusChange?.(event.node_id, "success", finalOutput);
        },

        onWorkflowComplete: (event: WorkflowCompleteEvent) => {
          console.log("[Stream] Workflow complete! Total cost:", event.total_cost);

          // Prefer backend final_output, but if it's missing, synthesize a rich summary
          // from individual node outputs so the user always sees a meaningful result.
          let finalContent = (event.final_output || "").trim();

          if (!finalContent) {
            const outputs = Array.from(nodeOutputsRef.current.values());
            if (outputs.length > 0) {
              const sections = outputs.map((output, index) => {
                const title = output.nodeName || output.nodeId;
                // Strip thinking tags when synthesising the summary
                const { visibleText } = extractThinkingContent(output.content);
                const body = (visibleText || output.content || "").trim() || "_No output produced_";
                return `### Step ${index + 1}: ${title}\n\n${body}`;
              });
              finalContent = sections.join("\n\n");
            }
          }

          if (!finalContent) {
            finalContent = "Workflow completed successfully.";
          }

          if (typeof event.total_cost === "number") {
            setTotalCost(event.total_cost);
          }

          const { visibleText: finalVisible, thinkingText: finalThinking } = extractThinkingContent(finalContent);

          const finalMessage: Message = {
            id: aiMessageId,
            sender: "ai",
            content: finalVisible || finalContent,
            thinkingContent: finalThinking || undefined,
            isThinkingInProgress: false,
            avatarUrl: selectedModel
              ? getModelIcon(selectedModel.companyName, selectedModel.modelName)
              : flowtingLogoUrl,
            avatarHint: selectedModel?.modelName || "AI model",
            ...(event.images?.length ? { images: event.images } : {}),
            metadata: {
              providerName: selectedModel?.companyName,
              modelName: selectedModel?.modelName,
              totalCost: event.total_cost,
              totalTokens: event.total_tokens,
              totalDurationMs: event.total_duration_ms,
            },
          };

          setDisplayMessages((prev) =>
            prev.map((msg) => (msg.id === aiMessageId ? finalMessage : msg))
          );
          setIsResponding(false);
          setActiveNodeId(null);
          abortRef.current = null;
        },

        onAskUser: (event: AskUserEvent) => {
          const question =
            typeof event.question === "string" && event.question.trim().length > 0
              ? event.question.trim()
              : "Could you clarify your request?";
          const suggestions: Array<{ label: string; description?: string }> = [];
          if (Array.isArray(event.suggestions)) {
            for (const item of event.suggestions) {
              const label =
                typeof item?.label === "string" ? item.label.trim() : "";
              if (!label) continue;
              const description =
                typeof item?.description === "string" &&
                item.description.trim().length > 0
                  ? item.description.trim()
                  : undefined;
              suggestions.push({ label, description });
            }
          }

          setDisplayMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: question,
                    isLoading: false,
                    metadata: {
                      ...msg.metadata,
                      clarification: {
                        question,
                        suggestions,
                      },
                    },
                  }
                : msg,
            ),
          );
          seenRunningNodesRef.current.clear();
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
              nodeOutputsRef.current = next;
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
              : flowtingLogoUrl,
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
          : flowtingLogoUrl,
        avatarHint: selectedModel?.modelName || "Flowting AI",
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

  // Only show output panels for LLM nodes (model/persona) — not context nodes
  const LLM_NODE_TYPES = new Set(["model", "persona"]);
  const outputItems = Array.from(nodeOutputs.values()).filter(
    (o) => !o.nodeType || LLM_NODE_TYPES.has(o.nodeType.toLowerCase())
  );
  const getOutputStatusClass = (status: NodeStatus) => {
    if (status === "running") return "bg-blue-100 text-blue-700 border-blue-200";
    if (status === "success") return "bg-green-100 text-green-700 border-green-200";
    if (status === "error") return "bg-red-100 text-red-700 border-red-200";
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
  };
  const getCollapsedPreview = (content: string) => {
    const { visibleText } = extractThinkingContent(content);
    const normalized = visibleText.replace(/\s+/g, " ").trim();
    if (!normalized) return "No output yet";
    return normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized;
  };

  return (
    <div className={`${isFullscreen ? 'z-50 fixed top-2 bottom-2 right-2 max-w-3/5 w-full max-h-[calc(100vh-15px)]' : 'z-50 fixed top-[60px] right-2 max-w-[588px] w-full max-h-[calc(100vh-65px)] flex-1'} flex min-h-0 h-full flex-col overflow-hidden bg-white border border-main-border rounded-3xl shadow-lg p-2 transition-all duration-500`}>
      {/* Streaming Status Bar */}
      {isResponding && activeNodeId && (
        <div className="absolute top-0 left-0 right-0 bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm text-blue-700">
            <strong>{nodeOutputs.get(activeNodeId)?.nodeName || activeNodeId}</strong>
            {nodeOutputs.get(activeNodeId)?.nodeType && (
              <span className="ml-1.5 text-xs bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 font-medium uppercase">
                {nodeOutputs.get(activeNodeId)?.nodeType}
              </span>
            )}
            {" is processing..."}
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
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute top-2 left-2 z-20 cursor-pointer flex w-auto py-2 px-2 bg-zinc-100 text-xs items-center justify-center gap-2 rounded-full hover:bg-[#F5F5F5] transition-colors shadow-sm"
          aria-label={isFullscreen ? "Minimize" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3 w-3 text-[#666666]" />
          ) : (
            <Maximize2 className="h-3 w-3 text-[#666666]" />
          )}
        </button>
      <button
          onClick={onClose}
          className="absolute top-2 right-6 z-20 cursor-pointer flex w-auto py-2 px-2 bg-zinc-100 text-xs items-center justify-center gap-2 rounded-full hover:bg-[#F5F5F5] transition-colors shadow-sm"
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
          className={`relative flex-1 min-h-0 overflow-y-auto mt-2 ${chatStyles.customScrollbar} ${chatStyles.hidePinButton} ${chatStyles.hideAvatar}`}
          ref={scrollViewportRef}
        >
          <div className={`mx-auto w-full ${isFullscreen ? 'max-w-full px-8' : 'max-w-[850px]'} flex-col gap-3 pr-4 py-4 wrap-break-word transition-all duration-300`}>
            <div className="rounded-[32px] border border-transparent bg-white p-6 shadow-none wrap-break-word">
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
                    disablePinning={true}
                    onSuggestionSelect={(suggestion) => {
                      const trimmedSuggestion = suggestion.trim();
                      if (!trimmedSuggestion || isResponding) return;
                      void handleSend(trimmedSuggestion);
                    }}
                  />
                ))}

                {outputItems.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-[#E7E7E7] bg-[#FAFAFA] p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6F6F6F]">
                      Node Outputs ({outputItems.length})
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
                                    {output.tokens > 0 && `${output.tokens} tokens`}
                                    {output.cost !== undefined && output.cost > 0 && ` • $${output.cost.toFixed(4)}`}
                                    {output.durationMs !== undefined && ` • ${(output.durationMs / 1000).toFixed(2)}s`}
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
                            {isExpanded && (() => {
                              const { visibleText, thinkingText } = extractThinkingContent(output.content);
                              return (
                                <div className="border-t border-[#EFEFEF] px-3 py-3 break-words">
                                  {thinkingText && (
                                    <NodeReasoningBlock
                                      text={thinkingText}
                                      isStreaming={output.isStreaming}
                                    />
                                  )}
                                  <div className="text-xs leading-relaxed text-[#3D3D3D] break-words">
                                    {visibleText
                                      ? renderMarkdownContent(visibleText)
                                      : output.isStreaming
                                        ? <span className="text-zinc-400 italic">Generating…</span>
                                        : <span className="text-zinc-400 italic">No output yet</span>}
                                  </div>
                                </div>
                              );
                            })()}
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
        <div className={`relative mx-auto w-full ${isFullscreen ? 'max-w-full px-8' : 'max-w-[756px]'} transition-all duration-300`}>
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
                      onClick={() => {
                        void handleSend();
                      }}
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
