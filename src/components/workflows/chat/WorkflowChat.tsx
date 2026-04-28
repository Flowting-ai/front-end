"use client";

/**
 * WorkflowChat — unified workflow chat component.
 *
 * Replaces two separate files that shared ~60% of their code:
 *   - WorkflowChatInterface.tsx  (floating overlay panel on the canvas)
 *   - WorkflowChatFullPage.tsx   (full-page dedicated chat route)
 *
 * Both old files are kept as thin re-export shims for backward compatibility.
 *
 * Usage:
 *   // Floating overlay (on canvas)
 *   <WorkflowChat mode="overlay" workflowId={…} workflowName={…} onClose={…}
 *                 selectedModel={…} onRunStart={…} onNodeStatusChange={…} />
 *
 *   // Full-page dedicated chat
 *   <WorkflowChat mode="fullpage" workflowId={…} workflow={…}
 *                 onEditWorkflow={…} chatId={…} />
 */

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  Minimize2,
  Loader2,
  Pencil,
  Files,
  MessagesSquare,
  Pin,
  Plus,
  Paperclip,
  Globe,
  SquareUser,
  Component,
  Send,
  Square,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/components/chat/chat-message";
import type { Message } from "@/components/chat/chat-message";
import { toast } from "@/lib/toast-helper";
import { cn } from "@/lib/utils";
import { sanitizeInlineMarkdown } from "@/lib/security";
import { workflowAPI } from "../workflow-api";
import type { WorkflowChatMessage } from "../workflow-api";
import type { WorkflowDTO, NodeStatus } from "../types";
import { extractThinkingContent } from "@/lib/parsers/content-parser";
import { isValidUUID } from "@/lib/normalizers/normalize-utils";
import { useWorkflowChat } from "@/hooks/use-workflow-chat";
import type { WorkflowNodeOutput } from "@/hooks/use-workflow-chat";
import type { AIModel } from "@/types/ai-model";
import chatStyles from "./workflow-chat-interface.module.css";

// ── Internal constants ───────────────────────────────────────────────────────

const LLM_NODE_TYPES = new Set(["model", "persona"]);
/** Node IDs that are framework-internal and should be hidden from outputs. */
const CONTROL_NODE_IDS = ["start-node", "end-node", "phantom-node"];
/** Node types that are framework-internal and should be hidden from outputs. */
const CONTROL_TYPES = ["start", "end", "phantom"];
const INLINE_MD_CODE_CLASS =
  "rounded bg-slate-800 px-1 py-0.5 text-[10px] font-mono text-slate-100";

// ── Internal utilities ───────────────────────────────────────────────────────

/**
 * Converts inline markdown (bold, italic, inline code) to HTML in a single
 * regex pass so patterns never interfere with each other's replacement output.
 */
const processInlineMarkdown = (text: string): string =>
  text.replace(
    /`([^`\n]+)`|\*\*\*([^*\n]+)\*\*\*|\*\*([^*\n]+)\*\*|__([^_\n]+)__|(?<![*a-zA-Z0-9])\*([^*\n]+)\*(?![*a-zA-Z0-9])|(?<![_a-zA-Z0-9])_([^_\n]+)_(?![_a-zA-Z0-9])/g,
    (_full, code, boldItalic, bold, boldU, italic, italicU) => {
      if (code !== undefined)
        return `<code class="${INLINE_MD_CODE_CLASS}">${code}</code>`;
      if (boldItalic !== undefined)
        return `<strong class="font-semibold"><em class="italic">${boldItalic}</em></strong>`;
      if (bold !== undefined)
        return `<strong class="font-semibold">${bold}</strong>`;
      if (boldU !== undefined)
        return `<strong class="font-semibold">${boldU}</strong>`;
      if (italic !== undefined) return `<em class="italic">${italic}</em>`;
      if (italicU !== undefined) return `<em class="italic">${italicU}</em>`;
      return _full;
    },
  );

/** Renders a markdown string as a React element tree for node output panels. */
const renderMarkdownContent = (content: string): React.ReactElement => {
  if (!content)
    return <span className="text-zinc-400 italic">No output yet</span>;

  const lines = content.split("\n");
  const elements: React.ReactElement[] = [];
  let i = 0;

  const isTableRow = (line: string) => {
    const t = line.trim();
    return t.startsWith("|") && t.includes("|", 1);
  };
  const isTableDivider = (line: string) =>
    /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line.trim());
  const parseTableRow = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    // Table
    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headerCells = parseTableRow(line);
      const bodyRows: string[][] = [];
      let j = i + 2;
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
                  <th key={`th-${i}-${idx}`} className="border border-slate-200 px-2 py-1 text-left font-semibold break-words">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIdx) => (
                <tr key={`tr-${i}-${rowIdx}`} className="odd:bg-white even:bg-slate-50">
                  {row.map((cell, cellIdx) => (
                    <td key={`td-${i}-${rowIdx}-${cellIdx}`} className="border border-slate-200 px-2 py-1 align-top break-words">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      i = j;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith("```")) {
        codeLines.push(lines[j]);
        j++;
      }
      elements.push(
        <WorkflowCodeBlock key={`code-${i}`} code={codeLines.join("\n")} language={language || undefined} />,
      );
      i = j + 1;
      continue;
    }

    // Unordered list
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
            <li key={`li-${i}-${idx}`} dangerouslySetInnerHTML={{ __html: sanitizeInlineMarkdown(processInlineMarkdown(item)) }} />
          ))}
        </ul>,
      );
      i = j;
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizeClass = level === 1 ? "text-base" : level === 2 ? "text-sm" : "text-xs";
      elements.push(
        React.createElement(`h${level}`, {
          key: `heading-${i}`,
          className: `font-semibold ${sizeClass} my-1`,
          dangerouslySetInnerHTML: { __html: sanitizeInlineMarkdown(processInlineMarkdown(text)) },
        }),
      );
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="my-0.5 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeInlineMarkdown(processInlineMarkdown(line)) }} />,
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
};

/** Returns a Tailwind class string for a given node execution status badge. */
const getOutputStatusClass = (status: NodeStatus): string => {
  if (status === "running") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "success") return "bg-green-100 text-green-700 border-green-200";
  if (status === "error") return "bg-red-100 text-red-700 border-red-200";
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
};

/** Returns a short, think-stripped preview of node output content. */
const getCollapsedPreview = (content: string): string => {
  const { visibleText } = extractThinkingContent(content);
  const normalized = visibleText.replace(/\s+/g, " ").trim();
  if (!normalized) return "No output yet";
  return normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized;
};

/** Counts non-control nodes in a workflow DTO by type. */
function countNodes(workflow: WorkflowDTO) {
  const nodes = workflow?.nodes ?? [];
  const byType: Record<string, number> = { document: 0, chat: 0, pin: 0, persona: 0, model: 0 };
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

// ── Internal shared sub-components ──────────────────────────────────────────

/** Collapsible reasoning/thinking block shown inside overlay node output panels. */
const NodeReasoningBlock = ({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming?: boolean;
}) => {
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

/** Syntax-highlighted code block with copy button, used in overlay node output panels. */
const WorkflowCodeBlock = ({
  code,
  language,
}: {
  code: string;
  language?: string;
}) => {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (codeRef.current) {
      import("@/lib/highlight").then((hljs) => {
        if (codeRef.current) hljs.default.highlightElement(codeRef.current);
      });
    }
  }, [code, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-slate-200 text-xs">
      <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5">
        <span className="font-mono text-slate-500">{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="px-2 py-0.5 rounded text-slate-500 hover:bg-slate-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="m-0 p-3 overflow-x-auto bg-slate-50">
        <code ref={codeRef} className={language ? `language-${language}` : ""}>
          {code}
        </code>
      </pre>
    </div>
  );
};

// ── Props types ──────────────────────────────────────────────────────────────

type OverlayProps = {
  mode: "overlay";
  workflowId: string;
  workflowName: string;
  onClose: () => void;
  selectedModel?: AIModel | null;
  onRunStart?: () => void;
  onNodeStatusChange?: (nodeId: string, status: NodeStatus, output?: string) => void;
};

type FullPageProps = {
  mode: "fullpage";
  workflowId: string;
  /** Full workflow DTO (used for name, node count, and history loading). */
  workflow: WorkflowDTO;
  onEditWorkflow: () => void;
  /** Existing chat session ID from URL. When provided, loads message history. */
  chatId?: string | null;
};

export type WorkflowChatProps = OverlayProps | FullPageProps;

// ── Main component ───────────────────────────────────────────────────────────

export function WorkflowChat(props: WorkflowChatProps) {
  const { workflowId } = props;

  // ── Overlay-mode state ────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodeMetadata, setNodeMetadata] = useState<
    Map<string, { label: string; type?: string }>
  >(new Map());

  // ── FullPage-mode state ───────────────────────────────────────────────────
  const [nodesSectionOpen, setNodesSectionOpen] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(
    props.mode === "fullpage" && props.chatId && isValidUUID(props.chatId)
      ? props.chatId
      : null,
  );

  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Node name resolvers (overlay mode only) ───────────────────────────────
  const getDisplayNodeName = (nodeId: string, fallback?: string) =>
    nodeMetadata.get(nodeId)?.label ?? fallback ?? nodeId;
  const getDisplayNodeType = (nodeId: string, fallback?: string) =>
    nodeMetadata.get(nodeId)?.type ?? fallback;

  // ── Shared hook ───────────────────────────────────────────────────────────
  const {
    displayMessages,
    setDisplayMessages,
    input,
    setInput,
    isResponding,
    nodeOutputs,
    expandedNodeOutputId,
    setExpandedNodeOutputId,
    activeNodeId,
    totalCost,
    scrollViewportRef,
    textareaRef,
    handleInputChange,
    handleSend,
    handleAbort,
    handleCopy,
  } = useWorkflowChat({
    workflowId,
    selectedModel: props.mode === "overlay" ? props.selectedModel : undefined,
    onRunStart: props.mode === "overlay" ? props.onRunStart : undefined,
    onNodeStatusChange:
      props.mode === "overlay" ? props.onNodeStatusChange : undefined,
    getNodeDisplayName:
      props.mode === "overlay" ? getDisplayNodeName : undefined,
    getNodeDisplayType:
      props.mode === "overlay" ? getDisplayNodeType : undefined,
  });

  // ── Overlay-mode: load node metadata from API ─────────────────────────────
  useEffect(() => {
    if (props.mode !== "overlay") return;
    let isMounted = true;
    const load = async () => {
      if (!workflowId || workflowId === "temp") return;
      try {
        const workflow = await workflowAPI.get(workflowId);
        if (!isMounted || !workflow?.nodes) return;
        const map = new Map<string, { label: string; type?: string }>();
        for (const node of workflow.nodes) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        console.warn("[WorkflowChat] Failed to load workflow metadata", err);
      }
    };
    void load();
    return () => { isMounted = false; };
  }, [workflowId, props.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FullPage-mode: sync activeChatId when URL param changes ──────────────
  useEffect(() => {
    if (props.mode !== "fullpage") return;
    const resolved =
      props.chatId && isValidUUID(props.chatId) ? props.chatId : null;
    setActiveChatId((prev) => {
      if (prev === resolved) return prev;
      setDisplayMessages([]);
      return resolved;
    });
  }, [props.mode === "fullpage" ? props.chatId : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FullPage-mode: load message history when activeChatId is set ─────────
  useEffect(() => {
    if (props.mode !== "fullpage" || !activeChatId) return;
    let cancelled = false;
    const flowtingLogoUrl = "/new-logos/souvenir-logo.svg";
    const workflowName =
      props.workflow?.name?.trim() || "Untitled Workflow";
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
      .catch(() => { /* silently ignore */ });
    return () => { cancelled = true; };
  }, [activeChatId, workflowId, props.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FullPage-mode: close attach menu on outside click ────────────────────
  useEffect(() => {
    if (props.mode !== "fullpage" || !showAttachMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target as Node)
      ) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAttachMenu, props.mode]);

  // ── Derived ───────────────────────────────────────────────────────────────

  /** LLM-only node outputs (model/persona), filtering out context-only nodes. */
  const llmOutputItems = Array.from(nodeOutputs.values()).filter(
    (o) => !o.nodeType || LLM_NODE_TYPES.has(o.nodeType.toLowerCase()),
  );

  // ── Shared input footer helpers ───────────────────────────────────────────

  const sendButton = (
    <Button
      type="button"
      onClick={() => { void handleSend(); }}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A] disabled:bg-[#CCCCCC] disabled:shadow-none"
    >
      <Send className="h-[18px] w-[18px]" />
    </Button>
  );

  const stopButton = (
    <Button
      type="button"
      onClick={handleAbort}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-red-700"
      title="Stop workflow execution"
    >
      <Square className="h-[18px] w-[18px] fill-white" />
    </Button>
  );

  const idleButton = (
    <Button
      type="button"
      className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-full bg-zinc-300 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
      title="Voice input"
    >
      <Send
        className="h-[25px] w-[25px]"
        strokeWidth={2}
        style={{ minWidth: "18px", minHeight: "20px" }}
      />
    </Button>
  );

  // ── OVERLAY mode render ───────────────────────────────────────────────────

  if (props.mode === "overlay") {
    const { onClose } = props;

    return (
      <div
        className={`${
          isFullscreen
            ? "z-50 fixed top-2 bottom-2 right-2 max-w-3/5 w-full max-h-[calc(100vh-15px)]"
            : "z-50 fixed top-[60px] right-2 max-w-[588px] w-full max-h-[calc(100vh-65px)] flex-1"
        } flex min-h-0 h-full flex-col overflow-hidden bg-white border border-main-border rounded-3xl shadow-lg p-2 transition-all duration-500`}
      >
        {/* Streaming status bar */}
        {isResponding && activeNodeId && (
          <div className="absolute top-0 left-0 right-0 bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2 z-10">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-700">
              <strong>
                {nodeOutputs.get(activeNodeId)?.nodeName || activeNodeId}
              </strong>
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

        {/* Header buttons */}
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

        {/* Messages area */}
        {displayMessages.length === 0 ? (
          <section className="flex flex-1 items-center justify-center bg-white px-4 py-8 mt-2">
            <div className="text-center max-w-md">
              <div className="mb-6 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full">
                  <Image
                    src="/new-logos/souvenir-logo-chat.svg"
                    alt="Workflow Logo"
                    width={81}
                    height={81}
                    className="object-contain"
                  />
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
            <div
              className={`mx-auto w-full ${isFullscreen ? "max-w-full px-8" : "max-w-[850px]"} flex-col gap-3 pr-4 py-4 wrap-break-word transition-all duration-300`}
            >
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
                        const trimmed = suggestion.trim();
                        if (!trimmed || isResponding) return;
                        void handleSend(trimmed);
                      }}
                    />
                  ))}

                  {/* Node outputs — timeline design */}
                  {llmOutputItems.length > 0 && (
                    <div className="mt-6 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 sm:p-5">
                      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#475569]">
                        Node Outputs ({llmOutputItems.length})
                      </h3>
                      <div className={chatStyles.nodeOutputsTimeline}>
                        {llmOutputItems.map((output) => {
                          const isExpanded = expandedNodeOutputId === output.nodeId;
                          return (
                            <div
                              key={output.nodeId}
                              className={chatStyles.timelineItem}
                              data-status={output.status}
                            >
                              <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedNodeOutputId((prev) =>
                                      prev === output.nodeId ? null : output.nodeId,
                                    )
                                  }
                                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50/80 transition-colors rounded-t-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                                  aria-expanded={isExpanded}
                                  aria-controls={`node-output-content-${output.nodeId}`}
                                  id={`node-output-trigger-${output.nodeId}`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="truncate text-sm font-semibold text-[#1E293B]">
                                        {output.nodeName || output.nodeId}
                                      </span>
                                      {output.nodeType && (
                                        <span className="shrink-0 rounded-md bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 uppercase">
                                          {output.nodeType}
                                        </span>
                                      )}
                                    </div>
                                    {!isExpanded && (
                                      <p className="truncate text-xs text-[#64748B] mt-0.5">
                                        {getCollapsedPreview(output.content)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOutputStatusClass(output.status)}`}
                                      aria-label={`Status: ${output.status}`}
                                    >
                                      {output.status}
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 text-[#64748B]" aria-hidden />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-[#64748B]" aria-hidden />
                                    )}
                                  </div>
                                </button>

                                {/* Token / cost / duration — always visible */}
                                {(output.tokens !== undefined ||
                                  output.cost !== undefined ||
                                  output.durationMs !== undefined) && (
                                  <div
                                    className="px-3 py-1.5 border-t border-[#F1F5F9] bg-[#F8FAFC] flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#475569]"
                                    role="region"
                                    aria-label="Usage and cost"
                                  >
                                    {output.tokens !== undefined && output.tokens > 0 && (
                                      <span>
                                        <strong className="font-semibold text-[#334155]">Tokens:</strong> {output.tokens}
                                      </span>
                                    )}
                                    {output.cost !== undefined && output.cost > 0 && (
                                      <span>
                                        <strong className="font-semibold text-[#334155]">Cost:</strong> ${output.cost.toFixed(4)}
                                      </span>
                                    )}
                                    {output.durationMs !== undefined && (
                                      <span>
                                        <strong className="font-semibold text-[#334155]">Duration:</strong> {(output.durationMs / 1000).toFixed(2)}s
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Expanded content */}
                                {isExpanded && (
                                  <div
                                    id={`node-output-content-${output.nodeId}`}
                                    role="region"
                                    aria-labelledby={`node-output-trigger-${output.nodeId}`}
                                    className="border-t border-[#E2E8F0] px-3 py-3 break-words bg-white"
                                  >
                                    {(() => {
                                      const { visibleText, thinkingText } =
                                        extractThinkingContent(output.content);
                                      return (
                                        <>
                                          {thinkingText && (
                                            <NodeReasoningBlock
                                              text={thinkingText}
                                              isStreaming={output.isStreaming}
                                            />
                                          )}
                                          <div className="text-xs leading-relaxed text-[#334155] break-words">
                                            {visibleText
                                              ? renderMarkdownContent(visibleText)
                                              : output.isStreaming
                                                ? <span className="text-slate-400 italic">Generating…</span>
                                                : <span className="text-slate-400 italic">No output yet</span>}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
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

        {/* Overlay input footer — simple (no attach / web search) */}
        <footer className="shrink-0 bg-white px-2 pb-0.5 pt-0">
          <div
            className={`relative mx-auto w-full ${isFullscreen ? "max-w-full px-8" : "max-w-[756px]"} transition-all duration-300`}
          >
            <div
              className="rounded-[24px] border border-[#D9D9D9] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              style={{ minHeight: "90px", transition: "min-height 0.2s ease" }}
            >
              <div className="flex flex-col gap-1.5 px-5 py-4">
                <div className="w-full">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !isResponding) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Test your workflow..."
                    className="min-h-[40px] w-full resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-relaxed text-[#1E1E1E] placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-light-grey shadow-none!"
                    rows={1}
                    disabled={isResponding}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 shrink-0 items-center justify-end gap-4">
                    {isResponding ? stopButton : input.trim() ? sendButton : idleButton}
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
    );
  }

  // ── FULLPAGE mode render ──────────────────────────────────────────────────

  const { workflow, onEditWorkflow } = props;
  const workflowName = workflow?.name?.trim() || "Untitled Workflow";
  const { connectedCount, byType } = countNodes(workflow);

  return (
    <div className="px-12 py-4 max-h-[95vh] h-full flex flex-col w-full">

      {/* Toolbar row: node count toggle + edit button */}
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

      {/* Collapsible node type breakdown */}
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

      {/* Chat container */}
      <div className="border border-main-border rounded-3xl flex-1 min-h-0 flex flex-col w-full overflow-hidden">

        {/* Empty state or messages */}
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

                  {/* Per-node output panel (simple card design for full-page view) */}
                  {llmOutputItems.length > 0 && (
                    <div className="mt-6 rounded-2xl border border-[#E7E7E7] bg-[#FAFAFA] p-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6F6F6F]">
                        Node Outputs ({llmOutputItems.length})
                      </div>
                      <div className="space-y-2">
                        {llmOutputItems.map((output) => {
                          const isExpanded = expandedNodeOutputId === output.nodeId;
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
                                    prev === output.nodeId ? null : output.nodeId,
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
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOutputStatusClass(output.status)}`}
                                >
                                  {output.status}
                                </span>
                              </button>
                              {isExpanded && (
                                <div className="border-t border-[#EFEFEF] px-3 py-3 break-words">
                                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#3D3D3D] break-words">
                                    {thinkStripped || (
                                      output.isStreaming ? (
                                        <span className="text-zinc-400 italic">Generating…</span>
                                      ) : (
                                        <span className="text-zinc-400 italic">No output yet</span>
                                      )
                                    )}
                                  </p>
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

        {/* FullPage input footer — with attach menu and web search */}
        <footer className="shrink-0 bg-transparent px-0 pb-0 pt-2">
          <div className="relative w-full max-w-[756px] mx-auto flex flex-col">
            <div
              className="rounded-[24px] border border-[#D9D9D9] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              style={{ minHeight: "90px", transition: "min-height 0.2s ease" }}
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
                        void handleSend();
                      }
                    }}
                    placeholder="Chat with ..."
                    className="min-h-[40px] w-full resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-relaxed text-[#1E1E1E] placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-light-grey shadow-none!"
                    rows={1}
                    disabled={isResponding}
                  />
                </div>

                <div className="flex items-center gap-3">
                  {/* Attach menu */}
                  <div className="relative" ref={attachMenuRef}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,.csv,text/csv,application/csv,.xls,application/vnd.ms-excel,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
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

                  {/* Web search active pill */}
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
                        onClick={() => void handleSend()}
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
