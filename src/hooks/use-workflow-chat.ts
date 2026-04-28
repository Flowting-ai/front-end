"use client";

/**
 * useWorkflowChat — encapsulates all shared streaming-chat state, refs, effects,
 * and callbacks for workflow-execution chat interfaces.
 *
 * Both WorkflowChatInterface (floating overlay) and WorkflowChatFullPage (full-
 * screen chat) duplicate the same ~400-line streaming-callback block, the same
 * state declarations, the same auto-scroll / auto-resize effects, and the same
 * send / abort / copy handlers. This hook consolidates all of that into a single
 * place while keeping both consumers fully functional and unchanged in appearance.
 *
 * ─── Shared state ─────────────────────────────────────────────────────────────
 *   displayMessages    Conversation messages shown in the chat UI.
 *   input              Controlled value of the text-area input field.
 *   isResponding       Whether a workflow stream is currently active.
 *   nodeOutputs        Per-node streaming output map (updated by stream events).
 *   expandedNodeOutputId  Which node-output accordion panel is open.
 *   activeNodeId       The node currently being streamed (null when idle).
 *   totalCost          Accumulated inference cost for the current run.
 *
 * ─── Shared refs ──────────────────────────────────────────────────────────────
 *   scrollViewportRef  Attached to the messages scroll container; used for
 *                      auto-scrolling to bottom.
 *   textareaRef        Attached to the input textarea; used for auto-resizing.
 *   abortRef           Holds the stream abort function returned by executeStream.
 *   streamingContentRef  Per-node accumulated raw content (avoids stale closures).
 *   reasoningContentRef  Accumulated reasoning/thinking content for the current run.
 *   nodeOutputsRef     Mirror of nodeOutputs state accessible inside callbacks.
 *   seenRunningNodesRef  Set of nodeIds already reported as "running" (prevents
 *                        duplicate onNodeStatusChange calls).
 *
 * ─── Shared effects ───────────────────────────────────────────────────────────
 *   Auto-scroll to the bottom of scrollViewportRef whenever displayMessages changes.
 *   Auto-resize the textarea (up to 200 px) whenever input changes.
 *
 * ─── Streaming callbacks ──────────────────────────────────────────────────────
 *   All 15 WorkflowAPI stream callbacks are built inside handleSend, sharing
 *   identical logic across both consumers:
 *   onWorkflowStart, onNodeStart, onChunk, onNodeEnd, onNodeComplete,
 *   onWorkflowComplete, onAskUser, onError, onReasoning, onImage, onWebSearch,
 *   onToolExecuting, onToolComplete, onToolProgress, onGeneratedFile,
 *   onTitle, onMessageSaved, onModelSelected.
 *
 * ─── Component-specific params ────────────────────────────────────────────────
 *   selectedModel        AIModel displayed in avatar/metadata (WorkflowChatInterface).
 *   onRunStart           Called just before a stream starts (WorkflowChatInterface).
 *   onNodeStatusChange   Canvas node-status callback (WorkflowChatInterface).
 *   getNodeDisplayName   Resolves human-readable node label from loaded metadata.
 *   getNodeDisplayType   Resolves node type string from loaded metadata.
 *   flowtingLogoUrl      AI avatar URL (defaults to the Souvenir logo).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { Message } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";
import type { NodeStatus } from "@/components/workflows/types";
import {
  workflowAPI,
  type StreamCallbacks,
  type NodeStartEvent,
  type ChunkEvent,
  type NodeEndEvent,
  type WorkflowCompleteEvent,
  type AskUserEvent,
  type ReasoningEvent,
  type ImageEvent,
  type WebSearchEvent,
  type ToolExecutingEvent,
  type ToolProgressEvent,
  type GeneratedFileEvent,
  type TitleEvent,
  type MessageSavedEvent,
  type ModelSelectedEvent,
} from "@/components/workflows/workflow-api";
import { extractThinkingContent } from "@/lib/parsers/content-parser";
import { mergeStreamingText } from "@/lib/streaming";
import { getModelIcon } from "@/lib/model-icons";
import { toast } from "@/lib/toast-helper";

// ─── Shared type ──────────────────────────────────────────────────────────────

/**
 * A single node's streaming output, accumulated across stream events.
 * Shared by both WorkflowChatInterface and WorkflowChatFullPage.
 */
export interface WorkflowNodeOutput {
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

// ─── Hook params ──────────────────────────────────────────────────────────────

export interface UseWorkflowChatParams {
  /** Backend workflow id used for API calls. */
  workflowId: string;

  /**
   * AI-message avatar URL. Defaults to "/new-logos/souvenir-logo.svg".
   * WorkflowChatInterface overrides this with model-specific icons.
   */
  flowtingLogoUrl?: string;

  /**
   * When provided, the selected AI model is used to populate avatar icons
   * and metadata fields in AI messages and the final workflow-complete payload.
   * Only used by WorkflowChatInterface.
   */
  selectedModel?: AIModel | null;

  /**
   * Called immediately before the stream starts (after the user message is
   * appended). Used by WorkflowChatInterface to signal the canvas to enter
   * its "running" visual state.
   */
  onRunStart?: () => void;

  /**
   * Called whenever a workflow node changes status (running → success | error).
   * Used by WorkflowChatInterface to update canvas node highlights.
   * WorkflowChatFullPage does not provide this callback.
   */
  onNodeStatusChange?: (
    nodeId: string,
    status: NodeStatus,
    output?: string,
  ) => void;

  /**
   * Resolves a human-readable display label for a workflow node. In
   * WorkflowChatInterface this reads from pre-loaded workflow metadata; in
   * WorkflowChatFullPage it falls back to the raw nodeId.
   *
   * @default (nodeId, fallback) => fallback ?? nodeId
   */
  getNodeDisplayName?: (nodeId: string, fallback?: string) => string;

  /**
   * Resolves the type string for a workflow node (e.g. "model", "persona").
   * Used to populate `nodeType` in WorkflowNodeOutput entries.
   *
   * @default (_nodeId, fallback) => fallback
   */
  getNodeDisplayType?: (
    nodeId: string,
    fallback?: string,
  ) => string | undefined;
}

// ─── Hook implementation ──────────────────────────────────────────────────────

const DEFAULT_LOGO_URL = "/new-logos/souvenir-logo.svg";

export function useWorkflowChat({
  workflowId,
  flowtingLogoUrl = DEFAULT_LOGO_URL,
  selectedModel,
  onRunStart,
  onNodeStatusChange,
  getNodeDisplayName = (nodeId, fallback) => fallback ?? nodeId,
  getNodeDisplayType = (_nodeId, fallback) => fallback,
}: UseWorkflowChatParams) {
  // ── Core state ───────────────────────────────────────────────────────────────

  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [nodeOutputs, setNodeOutputs] = useState<Map<string, WorkflowNodeOutput>>(
    new Map(),
  );
  const [expandedNodeOutputId, setExpandedNodeOutputId] = useState<
    string | null
  >(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState(0);

  // ── Refs ─────────────────────────────────────────────────────────────────────

  /** Attached to the messages scroll container — used for auto-scroll. */
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  /** Attached to the input textarea — used for auto-resize. */
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Holds the abort function returned by executeStream. */
  const abortRef = useRef<(() => void) | null>(null);
  /** Per-node accumulated raw streaming content; prevents stale-closure issues. */
  const streamingContentRef = useRef<Map<string, string>>(new Map());
  /** Accumulated reasoning/thinking text for the current stream. */
  const reasoningContentRef = useRef("");
  /** Mirror of nodeOutputs accessible inside async callbacks. */
  const nodeOutputsRef = useRef<Map<string, WorkflowNodeOutput>>(new Map());
  /** Tracks which nodes have already been reported as "running" to avoid duplicate calls. */
  const seenRunningNodesRef = useRef<Set<string>>(new Set());

  // ── Effects ──────────────────────────────────────────────────────────────────

  /** Auto-scroll to the bottom of the messages list whenever it grows. */
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop =
        scrollViewportRef.current.scrollHeight;
    }
  }, [displayMessages]);

  /** Auto-resize the textarea (capped at 200 px) when the input value changes. */
  useEffect(() => {
    if (!textareaRef.current) return;
    const maxHeight = 200;
    textareaRef.current.style.height = "auto";
    const scrollHeight = textareaRef.current.scrollHeight;
    textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    textareaRef.current.style.overflowY =
      scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const aiAvatarUrl = selectedModel
    ? getModelIcon(selectedModel.companyName, selectedModel.modelName)
    : flowtingLogoUrl;

  const aiAvatarHint = selectedModel?.modelName || "Flowting AI";

  // ── Core handlers ─────────────────────────────────────────────────────────────

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
  }, []);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    toast("Copied to clipboard!");
  }, []);

  const handleAbort = useCallback(() => {
    if (!abortRef.current) return;
    abortRef.current();
    abortRef.current = null;
    setIsResponding(false);
    if (activeNodeId) {
      onNodeStatusChange?.(activeNodeId, "error");
    }
    setActiveNodeId(null);
    toast("Workflow execution cancelled");
  }, [activeNodeId, onNodeStatusChange]);

  /**
   * Submits the current `input` (or an explicit `inputOverride`) to the
   * workflow stream API, appends user/AI messages optimistically, and
   * drives all streaming state updates via the callbacks below.
   *
   * @param inputOverride  Optional pre-supplied content — used by
   *   WorkflowChatInterface's suggestion-select flow where a suggestion
   *   is sent directly without going through the controlled input field.
   */
  const handleSend = useCallback(
    async (inputOverride?: string) => {
      const trimmedContent = (inputOverride ?? input).trim();
      if (!trimmedContent || isResponding) return;

      const userMessageId = `user-${crypto.randomUUID()}`;
      const aiMessageId = `ai-${crypto.randomUUID()}`;

      // Append user message.
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

      // Reset per-run refs.
      streamingContentRef.current = new Map();
      reasoningContentRef.current = "";
      nodeOutputsRef.current = new Map();
      seenRunningNodesRef.current = new Set();

      onRunStart?.();

      // Append streaming placeholder.
      const streamingPlaceholder: Message = {
        id: aiMessageId,
        sender: "ai",
        content: "Starting workflow...",
        isLoading: true,
        avatarUrl: aiAvatarUrl,
        avatarHint: aiAvatarHint,
      };
      setDisplayMessages((prev) => [...prev, streamingPlaceholder]);

      try {
        if (!workflowId || workflowId === "temp") {
          throw new Error("Save the workflow first, then run workflow chat.");
        }

        const callbacks: StreamCallbacks = {
          // ── Workflow lifecycle ────────────────────────────────────────────────

          onWorkflowStart: () => {
            setDisplayMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? { ...msg, content: "Workflow running...", isLoading: true }
                  : msg,
              ),
            );
          },

          // ── Node lifecycle ────────────────────────────────────────────────────

          onNodeStart: (event: NodeStartEvent) => {
            const nodeId = event.node_id;
            const nodeName =
              getNodeDisplayName(nodeId, event.node_name ?? event.name) ??
              nodeId;
            const nodeType = getNodeDisplayType(nodeId, event.node_type);

            setActiveNodeId(nodeId);
            setExpandedNodeOutputId(nodeId);

            if (!seenRunningNodesRef.current.has(nodeId)) {
              seenRunningNodesRef.current.add(nodeId);
              onNodeStatusChange?.(nodeId, "running");
            }

            // Initialise streaming content slot.
            streamingContentRef.current.set(nodeId, "");

            setNodeOutputs((prev) => {
              const next = new Map(prev);
              next.set(nodeId, {
                nodeId,
                nodeName,
                nodeType,
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

            // Catch chunks that arrive without a preceding node_start.
            setActiveNodeId(nodeId);
            setExpandedNodeOutputId(nodeId);
            if (!seenRunningNodesRef.current.has(nodeId)) {
              seenRunningNodesRef.current.add(nodeId);
              onNodeStatusChange?.(nodeId, "running");
            }

            // Accumulate into ref first (no stale-closure risk).
            const current = streamingContentRef.current.get(nodeId) ?? "";
            const updated = current + chunk;
            streamingContentRef.current.set(nodeId, updated);

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
                  nodeName: getNodeDisplayName(nodeId),
                  nodeType: getNodeDisplayType(nodeId),
                  content: chunk,
                  isStreaming: true,
                  status: "running",
                });
              }
              nodeOutputsRef.current = next;
              return next;
            });

            setDisplayMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                const streamContent =
                  streamingContentRef.current.get(nodeId) ?? chunk;
                const { visibleText, thinkingText } =
                  extractThinkingContent(streamContent);
                const hasOpenThink = /<think>/i.test(streamContent);
                const hasCloseThink = /<\/think>/i.test(streamContent);
                const stillThinking = hasOpenThink && !hasCloseThink;
                const partialThinking = stillThinking
                  ? streamContent.replace(/^[\s\S]*<think>/i, "").trim()
                  : undefined;
                return {
                  ...msg,
                  content: visibleText || (stillThinking ? "" : streamContent),
                  thinkingContent:
                    thinkingText ||
                    partialThinking ||
                    msg.thinkingContent ||
                    undefined,
                  isThinkingInProgress: stillThinking || Boolean(thinkingText),
                  isLoading: false,
                };
              }),
            );
          },

          onNodeEnd: (event: NodeEndEvent) => {
            setActiveNodeId(null);
            const fallback =
              streamingContentRef.current.get(event.node_id) ?? "";
            const finalContent = event.output || fallback;

            setNodeOutputs((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.node_id);
              next.set(event.node_id, {
                ...(existing ?? {
                  nodeId: event.node_id,
                  nodeName: getNodeDisplayName(event.node_id),
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

            seenRunningNodesRef.current.delete(event.node_id);
            onNodeStatusChange?.(event.node_id, "success", finalContent);

            if (event.cost) {
              setTotalCost((prev) => prev + event.cost!);
            }
          },

          onNodeComplete: (event) => {
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
                nodeName:
                  existing?.nodeName ||
                  getNodeDisplayName(event.node_id),
                nodeType: getNodeDisplayType(event.node_id, event.node_type),
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

            seenRunningNodesRef.current.delete(event.node_id);
            const finalOutput =
              event.output ||
              streamingContentRef.current.get(event.node_id) ||
              "";
            onNodeStatusChange?.(event.node_id, "success", finalOutput);
          },

          // ── Workflow complete ─────────────────────────────────────────────────

          onWorkflowComplete: (event: WorkflowCompleteEvent) => {
            let rawFinal = (event.final_output || "").trim();

            if (!rawFinal) {
              const outputs = Array.from(nodeOutputsRef.current.values());
              if (outputs.length > 0) {
                const sections = outputs.map((o, idx) => {
                  const title = o.nodeName || o.nodeId;
                  const { visibleText } = extractThinkingContent(o.content);
                  const body =
                    (visibleText || o.content || "").trim() ||
                    "_No output produced_";
                  return `### Step ${idx + 1}: ${title}\n\n${body}`;
                });
                rawFinal = sections.join("\n\n");
              }
            }

            if (!rawFinal) rawFinal = "Workflow completed successfully.";

            if (typeof event.total_cost === "number") {
              setTotalCost(event.total_cost);
            }

            const { visibleText: finalVisible, thinkingText: finalThinking } =
              extractThinkingContent(rawFinal);

            const finalMessage: Message = {
              id: aiMessageId,
              sender: "ai",
              content: finalVisible || rawFinal,
              thinkingContent: finalThinking || undefined,
              isThinkingInProgress: false,
              avatarUrl: aiAvatarUrl,
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
              prev.map((msg) => (msg.id === aiMessageId ? finalMessage : msg)),
            );
            setIsResponding(false);
            setActiveNodeId(null);
            abortRef.current = null;
          },

          // ── Clarification request ─────────────────────────────────────────────

          onAskUser: (event: AskUserEvent) => {
            const question =
              typeof event.question === "string" &&
              event.question.trim().length > 0
                ? event.question.trim()
                : "Could you clarify your request?";

            const suggestions: Array<{
              label: string;
              description?: string;
            }> = [];
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
                        clarification: { question, suggestions },
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

          // ── Error ─────────────────────────────────────────────────────────────

          onError: (event) => {
            console.error("[useWorkflowChat/stream] Error:", event.error);

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
              avatarUrl: aiAvatarUrl,
              avatarHint: selectedModel?.modelName || "AI model",
              isLoading: false,
            };
            setDisplayMessages((prev) =>
              prev.map((msg) => (msg.id === aiMessageId ? errorMessage : msg)),
            );
            setIsResponding(false);
            setActiveNodeId(null);
            abortRef.current = null;
          },

          // ── Reasoning / thinking ──────────────────────────────────────────────

          onReasoning: (event: ReasoningEvent) => {
            reasoningContentRef.current = mergeStreamingText(
              reasoningContentRef.current,
              event.delta,
            );
            setDisplayMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? {
                      ...msg,
                      thinkingContent: reasoningContentRef.current,
                      isThinkingInProgress: true,
                      isLoading: false,
                    }
                  : msg,
              ),
            );
          },

          // ── Rich media ───────────────────────────────────────────────────────

          onImage: (event: ImageEvent) => {
            const eventImages = Array.isArray(event.images)
              ? event.images
              : event.url
                ? [{ url: event.url, alt: event.alt }]
                : [];
            const normalizedImages = eventImages.filter(
              (img): img is { url: string; alt?: string } =>
                Boolean(img?.url),
            );
            if (normalizedImages.length === 0) return;

            setDisplayMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                const existing = Array.isArray(msg.images) ? msg.images : [];
                return {
                  ...msg,
                  images: [...existing, ...normalizedImages],
                  isLoading: false,
                  metadata: {
                    ...(msg.metadata || {}),
                    isImageGeneration: true,
                  },
                };
              }),
            );
          },

          onWebSearch: (event: WebSearchEvent) => {
            if (!event.query && !event.links?.length) return;
            setDisplayMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? {
                      ...msg,
                      isLoading: false,
                      metadata: {
                        ...(msg.metadata || {}),
                        webSearch: {
                          query: event.query,
                          links: event.links,
                        },
                      },
                    }
                  : msg,
              ),
            );
          },

          // ── Tool execution ───────────────────────────────────────────────────

          onToolExecuting: (event: ToolExecutingEvent) => {
            const displayName = (event.content || "")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
            setDisplayMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? { ...msg, toolStatus: displayName }
                  : msg,
              ),
            );
          },

          onToolComplete: () => {
            setDisplayMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? { ...msg, toolStatus: null }
                  : msg,
              ),
            );
          },

          onToolProgress: (event: ToolProgressEvent) => {
            const tool = event.tool || "";
            const displayName = tool
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
            const label = event.filename
              ? `${
                  event.status === "executing" ? "Running" : displayName
                } ${tool} for ${event.filename}...`
              : displayName;
            setDisplayMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? { ...msg, toolStatus: label }
                  : msg,
              ),
            );
          },

          // ── File generation ──────────────────────────────────────────────────

          onGeneratedFile: (event: GeneratedFileEvent) => {
            if (!event.url) return;
            setDisplayMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                const existing = Array.isArray(msg.metadata?.generatedFiles)
                  ? msg.metadata.generatedFiles
                  : [];
                const newFile = {
                  url: event.url,
                  s3Key: event.s3_key,
                  filename: event.filename,
                  mimeType: event.mime_type,
                };
                const merged = [...existing, newFile].filter(
                  (item, index, arr) =>
                    arr.findIndex(
                      (c) =>
                        c.url.trim().toLowerCase() ===
                        item.url.trim().toLowerCase(),
                    ) === index,
                );
                return {
                  ...msg,
                  isLoading: false,
                  metadata: {
                    ...(msg.metadata || {}),
                    generatedFiles: merged,
                  },
                };
              }),
            );
          },

          // ── Metadata events ──────────────────────────────────────────────────

          onTitle: (_event: TitleEvent) => {
            // Workflow chats do not use dynamic stream-generated titles.
          },

          onMessageSaved: (event: MessageSavedEvent) => {
            if (!event.message_id) return;
            setDisplayMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? { ...msg, chatMessageId: event.message_id }
                  : msg,
              ),
            );
          },

          onModelSelected: (event: ModelSelectedEvent) => {
            const modelName = event.model_name;
            const providerName = event.company || event.provider_name;
            const modelAvatar = getModelIcon(providerName, modelName);
            const modelHint = [modelName, providerName]
              .filter(Boolean)
              .join(" ")
              .trim();
            setDisplayMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? {
                      ...msg,
                      avatarUrl: modelAvatar,
                      avatarHint: modelHint || undefined,
                      metadata: {
                        ...(msg.metadata || {}),
                        modelName,
                        providerName,
                      },
                    }
                  : msg,
              ),
            );
          },
        };

        // Execute the workflow stream.
        const { abort } = await workflowAPI.executeStream(
          workflowId,
          trimmedContent,
          callbacks,
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
          avatarUrl: aiAvatarUrl,
          avatarHint: aiAvatarHint,
        };
        setDisplayMessages((prev) =>
          prev.map((msg) => (msg.id === aiMessageId ? errorMessage : msg)),
        );
        setIsResponding(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      input,
      isResponding,
      workflowId,
      aiAvatarUrl,
      aiAvatarHint,
      onRunStart,
      onNodeStatusChange,
      getNodeDisplayName,
      getNodeDisplayType,
      selectedModel,
    ],
  );

  // ── Return value ──────────────────────────────────────────────────────────────

  return {
    // State
    displayMessages,
    setDisplayMessages,
    input,
    setInput,
    isResponding,
    setIsResponding,
    nodeOutputs,
    setNodeOutputs,
    expandedNodeOutputId,
    setExpandedNodeOutputId,
    activeNodeId,
    setActiveNodeId,
    totalCost,
    // Refs (passed directly to JSX elements)
    scrollViewportRef,
    textareaRef,
    // Handlers
    handleInputChange,
    handleSend,
    handleAbort,
    handleCopy,
  };
}

/** Convenience type alias. */
export type WorkflowChatReturn = ReturnType<typeof useWorkflowChat>;
