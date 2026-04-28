"use client";
import { useHighlightJs } from "@/hooks/useHighlightJs";
import { sanitizeURL } from "@/lib/security";

import { useState, useRef, useEffect, useMemo, type JSX } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  Pin,
  Copy,
  Pencil,
  Trash2,
  Check,
  X,
  CornerDownRight,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Reply,
  ChevronDown,
  Globe,
  Download,
  FileText,
} from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import Image from "next/image";
import Lottie from "lottie-react";
import frameworkLoadingAnimation from "@/../public/FrameworkLoading.json";

import { renderLatexInlineContent, renderBlockMath } from "./LaTeXRenderer";
import { LinkPreviewCard, MailtoLink, SourceFaviconStack, getHostname, FAVICON_BASE } from "./LinkPreviewCard";
import { ReasoningBlock } from "./ReasoningBlock";
import { CodeBlock } from "./CodeBlock";

type ContentSegment =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language?: string };

const parseContentSegments = (value: string): ContentSegment[] => {
  if (!value) return [];
  const segments: ContentSegment[] = [];
  const codeRegex = /```([\w+-]+)?\s*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: value.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: "code",
      language: match[1]?.trim(),
      value: match[2] ?? "",
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({
      type: "text",
      value: value.slice(lastIndex),
    });
  }

  return segments;
};

const headingClassByLevel: Record<number, string> = {
  1: "text-2xl",
  2: "text-xl",
  3: "text-lg",
  4: "text-base",
  5: "text-sm",
  6: "text-xs",
};

const isTableDivider = (line: string) =>
  /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line.trim());

const isTableRow = (line: string) => {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
};

const parseTableRow = (line: string) => {
  const cleaned = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return cleaned.split("|").map((cell) => cell.trim());
};



const renderInlineContent = (text: string, keyPrefix: string) => {
  if (!text) {
    return [text];
  }

  const nodes: Array<string | JSX.Element> = [];
  // Match markdown links [label](url), bare http(s) URLs, bare www. URLs, and email addresses.
  // Bare-URL character class deliberately excludes markdown syntax chars (* _ ` ~ [ ]) so that
  // trailing bold/italic/code markers (e.g. **https://openai.com**) are never captured as part of the URL.
  // Email group handles both bare addresses (user@example.com) and explicit mailto: prefixes.
  // The optional (?:\*{1,3}|_{1,2})? non-capturing groups around the email consume any surrounding
  // bold/italic markdown markers so they are not left as dangling ** or _ text around the link.
  const linkRegex =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)*_`~\[\]]+)|(www\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.[a-zA-Z]{2,}(?:\/[^\s)*_`~\[\]]*)?)|(?:\*{1,3}|_{1,2})?((?:mailto:)?[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})(?:\*{1,3}|_{1,2})?/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      let before = text.slice(lastIndex, match.index);
      const afterChar = text[match.index + match[0].length];

      // If the link is wrapped in parentheses like "(example.com)", strip them
      const wrappedInParens = before.endsWith("(") && afterChar === ")";
      if (wrappedInParens) {
        before = before.slice(0, -1);
      }

      nodes.push(
        ...renderLatexInlineContent(before, `${keyPrefix}-text-${partIndex++}`),
      );
    }

    if (match[2]) {
      // Markdown link: [label](url)
      const label = match[1];
      const url = match[2];
      nodes.push(
        <LinkPreviewCard
          key={`${keyPrefix}-link-${partIndex++}`}
          url={url}
          label={label}
        />,
      );
    } else if (match[3]) {
      // Bare URL with http/https, strip trailing punctuation from the URL but keep it visually
      const raw = match[3];
      const trimmedUrl = raw.replace(/[).,*_`~\[\]]+$/, "");
      const trailing = raw.slice(trimmedUrl.length);

      nodes.push(
        <LinkPreviewCard
          key={`${keyPrefix}-link-${partIndex++}`}
          url={trimmedUrl}
        />,
      );

      if (trailing) {
        nodes.push(
          ...renderLatexInlineContent(
            trailing,
            `${keyPrefix}-trail-${partIndex++}`,
          ),
        );
      }
    } else if (match[4]) {
      // Bare URL starting with www., strip trailing punctuation from the URL but keep it visually
      const raw = match[4];
      const trimmedUrl = raw.replace(/[).,*_`~\[\]]+$/, "");
      const trailing = raw.slice(trimmedUrl.length);

      nodes.push(
        <LinkPreviewCard
          key={`${keyPrefix}-link-${partIndex++}`}
          url={trimmedUrl}
        />,
      );

      if (trailing) {
        nodes.push(
          ...renderLatexInlineContent(
            trailing,
            `${keyPrefix}-trail-${partIndex++}`,
          ),
        );
      }
    } else if (match[5]) {
      // Email address — strip any explicit mailto: prefix, render as mailto: link
      const email = match[5].replace(/^mailto:/i, "");
      nodes.push(
        <MailtoLink key={`${keyPrefix}-email-${partIndex++}`} email={email} />,
      );
    }

    const afterOffset =
      text[match.index + match[0].length] === ")" &&
      text[match.index - 1] === "("
        ? 1
        : 0;
    lastIndex = match.index + match[0].length + afterOffset;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    nodes.push(
      ...renderLatexInlineContent(
        remaining,
        `${keyPrefix}-text-${partIndex++}`,
      ),
    );
  }

  if (nodes.length === 0) {
    nodes.push(text);
  }

  return nodes;
};


const renderTextContent = (value: string, keyPrefix: string): JSX.Element[] => {
  const nodes: JSX.Element[] = [];
  const lines = value.replace(/\r/g, "").split("\n");
  const listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const listKey = `${keyPrefix}-list-${nodes.length}`;
    nodes.push(
      <ul
        key={listKey}
        className="ml-5 min-w-0 list-disc space-y-1 break-words text-[#171717]"
      >
        {listBuffer.map((item, index) => (
          <li key={`${listKey}-item-${index}`} className="min-w-0 leading-relaxed">
            {renderInlineContent(item, `${listKey}-item-${index}`)}
          </li>
        ))}
      </ul>,
    );
    listBuffer.length = 0;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    const isBracketMathStart = trimmed.startsWith("\\[");
    const isDollarMathStart = trimmed === "$$" || trimmed.startsWith("$$");
    if (isBracketMathStart || isDollarMathStart) {
      flushList();

      let mathContent = "";
      let closed = false;

      if (isBracketMathStart) {
        // Support single-line "\\[ ... \\]" and multi-line bracket blocks.
        const afterOpen = trimmed.slice(2).trimStart();
        if (afterOpen.endsWith("\\]")) {
          mathContent = afterOpen.slice(0, -2).trimEnd();
          closed = true;
        } else {
          const collected: string[] = [afterOpen];
          for (let j = index + 1; j < lines.length; j++) {
            const current = lines[j];
            const currentTrimmed = current.trim();
            if (currentTrimmed.endsWith("\\]")) {
              collected.push(currentTrimmed.slice(0, -2));
              index = j;
              closed = true;
              break;
            }
            collected.push(current);
          }
          mathContent = collected.join("\n").trim();
        }
      } else {
        // Support single-line "$$ ... $$" and multi-line dollar blocks.
        const afterOpen = trimmed.slice(2).trimStart();
        if (afterOpen.endsWith("$$")) {
          mathContent = afterOpen.slice(0, -2).trimEnd();
          closed = true;
        } else {
          const collected: string[] = [afterOpen];
          for (let j = index + 1; j < lines.length; j++) {
            const current = lines[j];
            const currentTrimmed = current.trim();
            if (currentTrimmed.endsWith("$$")) {
              collected.push(currentTrimmed.slice(0, -2));
              index = j;
              closed = true;
              break;
            }
            collected.push(current);
          }
          mathContent = collected.join("\n").trim();
        }
      }

      if (closed && mathContent) {
        const mathNode = renderBlockMath(mathContent, `${keyPrefix}-math-${index}`);
        if (mathNode) {
          nodes.push(mathNode);
          continue;
        }
        // Fall through to raw rendering when parsing fails.
      }
    }

    if (!trimmed) {
      flushList();
      nodes.push(
        <span
          key={`${keyPrefix}-gap-${index}`}
          className="block h-2"
          aria-hidden="true"
        />,
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = Math.min(headingMatch[1].length, 6);
      const content = headingMatch[2];
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      nodes.push(
        <HeadingTag
          key={`${keyPrefix}-heading-${index}`}
          className={cn(
            "min-w-0 break-words font-semibold text-[#171717] tracking-tight",
            headingClassByLevel[level],
          )}
        >
          {renderInlineContent(content, `${keyPrefix}-heading-${index}`)}
        </HeadingTag>,
      );
      continue;
    }

    if (isTableRow(line) && isTableDivider(lines[index + 1] ?? "")) {
      flushList();
      const headerCells = parseTableRow(line);
      index += 2; // skip divider line
      const bodyRows: string[][] = [];

      while (index < lines.length && isTableRow(lines[index])) {
        bodyRows.push(parseTableRow(lines[index]));
        index++;
      }

      const tableKey = `${keyPrefix}-table-${nodes.length}`;
      const formatCellHtml = (text: string) =>
        text
          .replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>")
          .replace(/(\*|_)(.+?)\1/g, "<em>$2</em>")
          .replace(/`([^`]+)`/g, "<code>$1</code>")
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawUrl) => {
            const safe = sanitizeURL(rawUrl);
            return safe ? `<a href="${safe}">${label}</a>` : label;
          });
      const formatCellPlain = (text: string) =>
        text
          .replace(/(\*\*|__)(.+?)\1/g, "$2")
          .replace(/(\*|_)(.+?)\1/g, "$2")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
      const copyTableAsHtml = () => {
        const htmlRows = [
          `<tr>${headerCells.map((c) => `<th>${formatCellHtml(c)}</th>`).join("")}</tr>`,
          ...bodyRows.map((r) => `<tr>${r.map((c) => `<td>${formatCellHtml(c)}</td>`).join("")}</tr>`),
        ];
        const html = `<table>${htmlRows.join("")}</table>`;
        const plain = [headerCells.map(formatCellPlain).join("\t"), ...bodyRows.map((r) => r.map(formatCellPlain).join("\t"))].join("\n");
        const blob = new Blob([html], { type: "text/html" });
        const plainBlob = new Blob([plain], { type: "text/plain" });
        navigator.clipboard.write([
          new ClipboardItem({ "text/html": blob, "text/plain": plainBlob }),
        ]);
      };
      nodes.push(
        <div key={tableKey} className="relative group/table rounded-2xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={copyTableAsHtml}
            className="absolute top-2 right-2 z-10 opacity-0 group-hover/table:opacity-100 transition-opacity inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium border border-slate-200 text-slate-600 shadow-sm hover:text-white hover:bg-black focus-visible:outline-none"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm" style={{ minWidth: "100%" }}>
              <thead className="bg-slate-50/70 text-slate-700">
                <tr>
                  {headerCells.map((cell, cellIndex) => (
                    <th
                      key={`${tableKey}-header-${cellIndex}`}
                      className="border-b border-slate-200 px-4 py-2.5 text-left font-semibold text-[#171717] whitespace-nowrap"
                      style={{ minWidth: "150px" }}
                    >
                      {renderInlineContent(
                        cell,
                        `${tableKey}-header-${cellIndex}`,
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIndex) => (
                  <tr
                    key={`${tableKey}-row-${rowIndex}`}
                    className="odd:bg-white even:bg-slate-50/50"
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${tableKey}-cell-${rowIndex}-${cellIndex}`}
                        className="border-t border-slate-100 px-4 py-2.5 align-top text-[#171717]"
                        style={{ minWidth: "150px" }}
                      >
                        {renderInlineContent(
                          cell,
                          `${tableKey}-cell-${rowIndex}-${cellIndex}`,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>,
      );

      index -= 1; // adjust for loop increment
      continue;
    }

    const listMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (listMatch) {
      listBuffer.push(listMatch[1]);
      continue;
    }

    flushList();
    nodes.push(
      <p
        key={`${keyPrefix}-paragraph-${index}`}
        className="min-w-0 whitespace-pre-wrap break-words leading-relaxed text-[#171717]"
      >
        {renderInlineContent(line, `${keyPrefix}-paragraph-${index}`)}
      </p>,
    );
  }

  flushList();
  return nodes;
};

// Streaming-aware typewriter hook: reveals content character-by-character
// with an ease-out lerp for a smooth, Claude-like streaming feel.
const useStreamingTypewriter = (
  fullText: string,
  enabled: boolean = true,
) => {
  const [revealedLen, setRevealedLen] = useState(enabled ? 0 : fullText.length);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const enabledRef = useRef(enabled);

  // When the effect becomes disabled (e.g. message is no longer "new"),
  // snap to full content immediately.
  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      setRevealedLen(fullText.length);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [enabled, fullText.length]);

  useEffect(() => {
    if (!enabled) return;

    const TICK_MS = 16; // ~60fps for fluid animation

    const animate = (timestamp: number) => {
      if (!enabledRef.current) return;
      if (timestamp - lastTickRef.current >= TICK_MS) {
        lastTickRef.current = timestamp;
        setRevealedLen((prev) => {
          if (prev >= fullText.length) return prev;
          const remaining = fullText.length - prev;
          // Ease-out lerp: reveal a fraction of the remaining distance each tick.
          // Fast when far behind, gracefully decelerates as it catches up.
          const charsPerTick = Math.max(1, Math.ceil(remaining * 0.06));
          return Math.min(prev + charsPerTick, fullText.length);
        });
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [fullText, enabled]);

  if (!enabled) return fullText;
  return fullText.slice(0, revealedLen);
};

export interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  avatarUrl?: string;
  avatarHint?: string;
  isLoading?: boolean;
  toolStatus?: string | null;
  chatMessageId?: string;
  pinId?: string;
  referencedMessageId?: string | null;
  thinkingContent?: string | null;
  isThinkingInProgress?: boolean;
  imageUrl?: string;
  imageAlt?: string;
  images?: Array<{ url: string; alt?: string }>;
  metadata?: {
    modelName?: string;
    providerName?: string;
    llmModelId?: string | number | null;
    inputTokens?: number;
    outputTokens?: number;
    createdAt?: string;
    documentId?: string | null;
    documentUrl?: string | null;
    pinIds?: string[];
    userReaction?: string | null;
    cost?: number;
    latencyMs?: number;
    replyToMessageId?: string | null;
    replyToContent?: string | null;
    isImageGeneration?: boolean;
    totalCost?: number;
    totalTokens?: number;
    totalDurationMs?: number;
    attachments?: Array<{
      id: string;
      type: "pdf" | "document" | "image";
      name: string;
      url: string;
    }>;
    generatedFiles?: GeneratedFilePayload[];
    mentionedPins?: Array<{
      id: string;
      label: string;
      text?: string;
    }>;
    clarification?: {
      question: string;
      suggestions?: Array<{
        label: string;
        description?: string;
      }>;
    };
    /** True when the user manually stopped generation for this message. */
    stoppedByUser?: boolean;
    /** Sources or citations (from backend or parsed from content). Shown in References panel. */
    sources?: MessageSource[];
    /** True when web search was enabled for this message. */
    webSearchEnabled?: boolean;
    /** Web search results emitted during streaming (query + link list). */
    webSearch?:
      | {
          query: string;
          links: string[];
        }
      | Array<{
          query: string;
          links: string[];
        }>;
  };
}

/** One source/citation item for the Citations panel */
export type MessageSource = {
  /** Name of the article, document, or webpage */
  title?: string;
  /** Direct URL to the original material */
  url: string;
  /** Short excerpt of the text the AI used (snippet/context) */
  snippet?: string;
  /** Human creator or organization behind the content */
  authorOrPublisher?: string;
  /** When the content was published or last updated (e.g. "2024-01-15" or "Last updated March 2024") */
  publicationOrAccessDate?: string;
  /** How strongly this source supports the claim, 0–100. Shown as relevance/confidence. */
  relevanceScore?: number;
  /** Website metadata: image URL (e.g. og:image). Fetched from link when not provided. */
  imageUrl?: string;
  /** Website metadata: description (e.g. og:description). Fetched from link when not provided. */
  description?: string;
};

type WebSearchPayload = {
  query: string;
  links: string[];
};

type GeneratedFilePayload = {
  url: string;
  s3Key?: string;
  filename?: string;
  mimeType?: string;
};


const normalizeWebSearches = (
  input: NonNullable<Message["metadata"]>["webSearch"] | undefined,
): WebSearchPayload[] => {
  if (!input) return [];
  const items = Array.isArray(input) ? input : [input];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const payload = item as { query?: unknown; links?: unknown };
      const query =
        typeof payload.query === "string" ? payload.query.trim() : "";
      if (!query) return null;
      const links = Array.isArray(payload.links)
        ? payload.links
            .map((link) =>
              typeof link === "string" ? link.trim() : String(link || "").trim(),
            )
            .filter(Boolean)
        : [];
      return { query, links };
    })
    .filter(
      (item): item is WebSearchPayload => Boolean(item && item.query),
    );
};

const formatWebSearchLabel = (url: string): string => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    const suffix = path && path !== "/" ? path : "";
    return `${parsed.hostname}${suffix}`;
  } catch {
    return url;
  }
};

const normalizeGeneratedFiles = (
  input: NonNullable<Message["metadata"]>["generatedFiles"] | undefined,
): GeneratedFilePayload[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const normalized: GeneratedFilePayload[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const candidate = item as {
      url?: unknown;
      s3Key?: unknown;
      s3_key?: unknown;
      filename?: unknown;
      file_name?: unknown;
      mimeType?: unknown;
      mime_type?: unknown;
    };

    const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
    if (!url) continue;

    const dedupeKey = url.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const filename =
      typeof candidate.filename === "string" && candidate.filename.trim()
        ? candidate.filename.trim()
        : typeof candidate.file_name === "string" && candidate.file_name.trim()
          ? candidate.file_name.trim()
          : undefined;
    const s3Key =
      typeof candidate.s3Key === "string" && candidate.s3Key.trim()
        ? candidate.s3Key.trim()
        : typeof candidate.s3_key === "string" && candidate.s3_key.trim()
          ? candidate.s3_key.trim()
          : undefined;
    const mimeType =
      typeof candidate.mimeType === "string" && candidate.mimeType.trim()
        ? candidate.mimeType.trim()
        : typeof candidate.mime_type === "string" && candidate.mime_type.trim()
          ? candidate.mime_type.trim()
          : undefined;

    normalized.push({ url, s3Key, filename, mimeType });
  }

  return normalized;
};

function filenameFromUrl(url: string): string | undefined {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : undefined;
  } catch {
    return undefined;
  }
}

function getGeneratedDocumentShortType(
  mimeType: string | undefined,
  filename: string | undefined,
  url: string,
): string {
  const mime = (mimeType || "").toLowerCase();
  if (mime === "application/pdf" || mime.includes("pdf")) return "PDF";
  if (mime === "text/markdown" || mime === "text/x-markdown") return "MD";
  if (mime === "text/csv" || mime === "application/csv") return "CSV";
  if (
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "DOC";
  }
  if (
    mime === "application/vnd.ms-excel" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "XLS";
  }
  if (
    mime === "application/vnd.ms-powerpoint" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "PPT";
  }
  if (mime.startsWith("text/")) return "TXT";

  const path = url.split("?")[0].toLowerCase();
  const extFromUrl = path.match(/\.([a-z0-9]+)$/i)?.[1];
  const name = (filename || "").toLowerCase();
  const extFromName = name.includes(".")
    ? name.slice(name.lastIndexOf(".") + 1)
    : undefined;
  const ext = (extFromName || extFromUrl || "").toUpperCase();
  if (ext === "JPEG") return "JPG";
  if (ext && ext.length <= 8) return ext;
  return "FILE";
}

function GeneratedDocumentInlineCard({
  file,
  fallbackName,
}: {
  file: GeneratedFilePayload;
  fallbackName: string;
}) {
  const displayName =
    (file.filename && file.filename.trim()) ||
    filenameFromUrl(file.url) ||
    fallbackName;
  const typeLabel = getGeneratedDocumentShortType(
    file.mimeType,
    file.filename,
    file.url,
  );

  const viewerUrl = sanitizeURL(file.url ?? "");

  return (
    <a
      href={viewerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[60px] w-full max-w-[540px] items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-white px-3 shadow-sm shadow-zinc-300 cursor-pointer transition-colors hover:bg-[#FAFAFA] no-underline"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
          <FileText
            className="h-5 w-5 text-[#B8B8B8]"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className="truncate text-sm font-semibold text-[#171717]"
            title={displayName}
          >
            {displayName}
          </p>
          <p className="truncate text-xs font-normal text-[#A3A3A3]">
            Document • {typeLabel}
          </p>
        </div>
      </div>
      <span
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#D4D4D4] bg-white px-3 text-sm font-medium text-[#171717] transition-colors hover:bg-[#F0F0F0]"
      >
        <Download className="h-4 w-4 shrink-0 text-[#171717]" aria-hidden />
        Download
      </span>
    </a>
  );
}

const WebSearchCard = ({ searches }: { searches: WebSearchPayload[] }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (searches.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-[#374151]">
          <Globe className="h-3.5 w-3.5 text-[#6B7280]" />
          <span>Searched the web</span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[#9CA3AF] transition-transform duration-200",
            isOpen ? "rotate-180" : "",
          )}
        />
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          {searches.map((search, searchIndex) => (
            <div
              key={`${search.query}-${searchIndex}`}
              className={cn(
                "pt-2",
                searchIndex === 0 ? "pt-0" : "border-t border-[#E5E7EB] mt-2",
              )}
            >
              <div className="flex items-center justify-between gap-3 text-xs text-[#6B7280]">
                <span className="truncate">{search.query}</span>
                <span className="shrink-0">
                  {search.links.length} results
                </span>
              </div>
              {search.links.length > 0 && (
                <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-[#E5E7EB] bg-white">
                  <div className="divide-y divide-[#F0F0F0]">
                    {search.links.map((link) => {
                      const safeLink = sanitizeURL(link);
                      const hostname = getHostname(safeLink) || safeLink;
                      const faviconUrl = hostname
                        ? `${FAVICON_BASE}${encodeURIComponent(hostname)}`
                        : "";
                      return (
                        <a
                          key={link}
                          href={safeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-[#111827] hover:bg-[#F9FAFB]"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {faviconUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={faviconUrl}
                                alt=""
                                className="h-4 w-4 shrink-0 rounded-sm"
                              />
                            )}
                            <span className="truncate">
                              {formatWebSearchLabel(link)}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] text-[#9CA3AF]">
                            {hostname}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface ChatMessageProps {
  message: Message;
  isPinned?: boolean;
  taggedPins?: { id: string; label: string }[];
  onPin: (message: Message) => void;
  onCopy: (content: string) => void;
  onDelete: (message: Message) => void;
  onResubmit: (newContent: string, messageId: string) => void;
  onReference?: (message: Message) => void;
  onRegenerate?: (message: Message) => void;
  onReply?: (message: Message) => void;
  onReact?: (message: Message, reaction: string | null) => void;
  referencedMessage?: Message | null;
  isNewMessage: boolean;
  isResponding?: boolean;
  /** When set, show a "Sources" button that opens the references panel. Only for AI messages. */
  onOpenSources?: () => void;
  /** Number of sources (1–4) for the Sources button. */
  sourceCount?: number;
  /** Source URLs (max 4) for showing domain favicons on the Sources button. */
  sourceUrls?: string[];
  /** When true, disables the pin button (for personas and workflow chats) */
  disablePinning?: boolean;
  /** Optional handler for AI clarification suggestions. */
  onSuggestionSelect?: (suggestion: string) => void;
}

export function ChatMessage({
  message,
  isPinned,
  taggedPins = [],
  onPin,
  onCopy,
  onDelete,
  onResubmit,
  onReference,
  onRegenerate,
  onReply,
  onReact,
  referencedMessage,
  isNewMessage,
  isResponding,
  disablePinning = false,
  onOpenSources,
  sourceCount = 0,
  sourceUrls = [],
  onSuggestionSelect,
}: ChatMessageProps) {
  const isUser = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [avatarVisible, setAvatarVisible] = useState(false);


  useHighlightJs(message.content);

  useEffect(() => {
    if (!isUser) {
      const id = requestAnimationFrame(() => {
        setAvatarVisible(true);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isUser]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();

      // Auto-resize logic for height and width
      const adjustSize = () => {
        // Calculate width based on content first
        const span = document.createElement("span");
        span.style.cssText =
          "position: absolute; visibility: hidden; white-space: pre; font-size: 14px; font-family: inherit; line-height: 1.5;";
        span.textContent = textarea.value || textarea.placeholder;
        document.body.appendChild(span);
        const textWidth = span.offsetWidth;
        document.body.removeChild(span);

        // If text is less than one line (less than 550px), shrink width
        // Otherwise, keep at 550px max width
        if (textWidth < 550) {
          textarea.style.width = `${Math.max(textWidth + 40, 100)}px`;
        } else {
          textarea.style.width = "550px";
        }

        // Then reset height to get accurate scrollHeight
        textarea.style.height = "0px";
        const newHeight = textarea.scrollHeight;
        textarea.style.height = `${newHeight}px`;
      };

      adjustSize();
      textarea.addEventListener("input", adjustSize);

      return () => {
        if (textarea) {
          textarea.removeEventListener("input", adjustSize);
        }
      };
    }
  }, [isEditing, editedContent]);
  const handleSaveAndResubmit = () => {
    onResubmit(editedContent, message.id);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveAndResubmit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const isTypewriterActive = isNewMessage && !isUser && !message.isLoading;
  const revealedContent = useStreamingTypewriter(
    message.content,
    isTypewriterActive,
  );
  const contentToDisplay = revealedContent;
  const contentSegments = useMemo(
    () => parseContentSegments(contentToDisplay),
    [contentToDisplay],
  );
  const clarificationSuggestions =
    !isUser && Array.isArray(message.metadata?.clarification?.suggestions)
      ? (message.metadata?.clarification?.suggestions ?? [])
      : [];
  const webSearches = useMemo(
    () => normalizeWebSearches(message.metadata?.webSearch),
    [message.metadata?.webSearch],
  );
  const generatedFiles = useMemo(
    () => normalizeGeneratedFiles(message.metadata?.generatedFiles),
    [message.metadata?.generatedFiles],
  );

  const generatedDocumentItems = useMemo(() => {
    const items = [...generatedFiles];
    const docUrl = message.metadata?.documentUrl?.trim();
    if (docUrl) {
      const lower = docUrl.toLowerCase();
      if (!items.some((i) => i.url.trim().toLowerCase() === lower)) {
        items.push({
          url: docUrl,
          filename: filenameFromUrl(docUrl),
          mimeType: undefined,
        });
      }
    }
    return items;
  }, [generatedFiles, message.metadata?.documentUrl]);

  const actionButtonClasses =
    "h-8 w-8 rounded-full text-[#6B7280] transition-colors hover:text-[#111827] hover:bg-[#E4E4E7]";

  const UserActions = ({ className }: { className?: string } = {}) => (
    <TooltipProvider>
      <div
        className={cn(
          "bg-transparent inline-flex items-center gap-1",
          // , className
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={actionButtonClasses}
              onClick={() => onCopy(message.content)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={actionButtonClasses}
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={actionButtonClasses}
              onClick={() => onDelete(message)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          {/* <TooltipContent>
            <p>Delete</p>
          </TooltipContent> */}
        </Tooltip>
      </div>
    </TooltipProvider>
  );

  // Check if this is an image/video generation message
  const isMediaGeneration = !!(
    message.metadata?.isImageGeneration ||
    message.imageUrl ||
    message.images?.length
  );

  const AiActions = ({ className }: { className?: string } = {}) => {
    // Hide AI actions for messages that were explicitly stopped by the user
    if (message.metadata?.stoppedByUser) {
      return null;
    }

    return (
      <TooltipProvider>
        <div
          className={cn(
            "bg-transparent inline-flex items-center gap-1 w-full justify-between",
            // ,className
          )}
        >
          <div className="inline-flex items-center gap-1">
            {/* Pin button - disabled for media generations */}
            {!disablePinning && !isMediaGeneration && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      actionButtonClasses,
                      isPinned && "bg-[#4A4A4A] text-white hover:bg-[#4A4A4A]",
                    )}
                    onClick={() => onPin(message)}
                    aria-pressed={isPinned}
                  >
                    <Pin className={cn("h-4 w-4", isPinned && "fill-white")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPinned ? "Unpin" : "Pin"} message</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Copy button - disabled for media generations */}
            {!isMediaGeneration && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={actionButtonClasses}
                    onClick={() => onCopy(message.content)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy</p>
                </TooltipContent>
              </Tooltip>
            )}
            {message.metadata?.webSearchEnabled && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={actionButtonClasses}
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Searched the web</p>
                </TooltipContent>
              </Tooltip>
            )}
            {onRegenerate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={actionButtonClasses}
                    onClick={() => onRegenerate(message)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Regenerate</p>
                </TooltipContent>
              </Tooltip>
            )}
            {onReply && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={actionButtonClasses}
                    onClick={() => onReply(message)}
                  >
                    <Reply className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reply</p>
                </TooltipContent>
              </Tooltip>
            )}
            {onReference && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={actionButtonClasses}
                    onClick={() => onReference(message)}
                  >
                    <CornerDownRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reply to this message</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={actionButtonClasses}
                  onClick={() => onDelete(message)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete</p>
              </TooltipContent>
            </Tooltip>
            {onReact && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      actionButtonClasses,
                      message.metadata?.userReaction === "like" &&
                        "bg-[#E4E4E7] text-[#111827]",
                    )}
                    onClick={() =>
                      onReact(
                        message,
                        message.metadata?.userReaction === "like"
                          ? null
                          : "like",
                      )
                    }
                    aria-pressed={message.metadata?.userReaction === "like"}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Good response</p>
                </TooltipContent>
              </Tooltip>
            )}
            {onReact && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      actionButtonClasses,
                      message.metadata?.userReaction === "dislike" &&
                        "bg-[#E4E4E7] text-[#111827]",
                    )}
                    onClick={() =>
                      onReact(
                        message,
                        message.metadata?.userReaction === "dislike"
                          ? null
                          : "dislike",
                      )
                    }
                    aria-pressed={message.metadata?.userReaction === "dislike"}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Needs improvement</p>
                </TooltipContent>
              </Tooltip>
            )}
            {onOpenSources && sourceCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-1 border border-main-border px-3 py-1 rounded-full h-8  hover:bg-zinc-100 text-[#0A0A0A] hover:text-[#111827] transition-colors"
                    onClick={onOpenSources}
                  >
                    <SourceFaviconStack urls={sourceUrls.slice(0, 4)} />
                    <span className="text-xs font-medium">Sources</span>
                  </Button>
                </TooltipTrigger>
                {/* <TooltipContent>
                <p>View sources</p>
              </TooltipContent>  */}
              </Tooltip>
            )}
          </div>
          {(message.metadata?.modelName || message.metadata?.providerName) && (
            <span className="text-xs text-[#6B7280] font-medium pr-[5px]">
              {message.metadata.modelName || message.metadata.providerName}
            </span>
          )}
        </div>
      </TooltipProvider>
    );
  };

  // const handlePin = (message: Message) => {
  //   // Show toast immediately using toastify
  //   if (typeof window !== "undefined") {
  //     import("react-toastify").then(({ toast }) => {
  //       toast.info("Pin is being generated", {
  //         autoClose: 5000,
  //         position: "top-right",
  //       });
  //     });
  //   }
  //   onPin(message);
  // };

  // const LoadingState = () => (
  //   <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[#6B7280]">
  //     {[0, 1, 2].map((dot) => (
  //       <span
  //         key={dot}
  //         className="h-2 w-2 rounded-full bg-[#D4D4D8] animate-bounce"
  //         style={{ animationDelay: `${dot * 0.12}s` }}
  //       />
  //     ))}
  //     <span>Thinking…</span>
  //   </div>
  // );

  const extractInitials = (value: string, fallback: string) => {
    const cleaned = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (cleaned.length >= 2) return cleaned.slice(0, 2);
    if (cleaned.length === 1) return `${cleaned}${cleaned}`;
    return fallback;
  };

  const fallbackText = (() => {
    if (isUser) {
      const hint = message.avatarHint || "User";
      return extractInitials(hint, "US");
    }
    const hint =
      message.avatarHint ||
      message.metadata?.modelName ||
      message.metadata?.providerName ||
      "AI";
    return extractInitials(hint, "AI");
  })();

  const isLogoAvatar = (() => {
    const url = message.avatarUrl;
    if (!url) return false;
    const lower = url.toLowerCase();

    // Known framework/user logo paths
    if (lower === "/new-logos/souvenir-logo.svg") return true;
    if (lower === "/personas/useravatar.png") return true;

    // Treat generic SVG/model/icon assets as logos, but exclude persona/workflow folders
    if (
      lower.endsWith(".svg") &&
      !lower.includes("/personas/") &&
      !lower.includes("/workflows/")
    ) {
      return true;
    }

    if (
      lower.includes("/models/") ||
      lower.includes("/icons/") ||
      lower.includes("logo")
    ) {
      return true;
    }

    return false;
  })();

  const AvatarComponent = (
    <Avatar
      className={cn(
        "size-9 text-xs font-semibold bg-transparent text-[#111827]",
        isLogoAvatar ? "rounded-none!" : "rounded-full",
      )}
    >
      {message.avatarUrl && (
        <AvatarImage
          src={message.avatarUrl}
          alt={isUser ? "User" : "AI"}
          className={cn(
            "size-full object-center",
            isLogoAvatar ? "object-contain" : "object-cover",
          )}
          data-ai-hint={message.avatarHint}
        />
      )}
      <AvatarFallback className="bg-transparent text-xs font-semibold text-[#111827]">
        {fallbackText}
      </AvatarFallback>
    </Avatar>
  );

  const renderActions = (className?: string) => {
    // Hide action icons ONLY for AI messages that are currently being generated
    // All completed messages (previous responses) keep their action icons visible
    if (!isUser && message.isLoading) {
      return null;
    }

    return isUser ? (
      <UserActions className={className} />
    ) : (
      <AiActions className={className} />
    );
  };

  return (
    <div className="group/message w-full">
      <div
        className={cn(
          "relative mx-auto flex w-full items-start my-2",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        {/* Show avatar for both AI and user (when persona is selected) */}
        <div className="flex w-auto shrink-0 min-w-9 flex-col items-center justify-start gap-1">
          {(!isUser ||
            (isUser &&
              message.avatarUrl &&
              message.avatarUrl !== "/personas/userAvatar.png")) && (
            <div className="relative mt-4 flex size-9 shrink-0 items-center justify-center">
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  avatarVisible
                    ? "opacity-100 translate-y-0 transition-all duration-500"
                    : "opacity-0 -translate-y-[5px] transition-all duration-500",
                )}
              >
                {AvatarComponent}
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-2",
            isUser ? "items-end text-left" : "items-start text-left",
          )}
        >
          <div
            className={cn(
              "relative flex w-full min-w-0 max-w-162 flex-col",
              isUser ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "group/bubble chat-message-bubble relative max-w-full min-w-0 px-4 py-2",
                isUser
                  ? "chat-message-bubble--user bg-white text-[#111827] border border-[#E4E4E7] rounded-tl-[25px] rounded-tr-[12px] rounded-b-[25px] px-4 py-2"
                  : "chat-message-bubble--ai bg-white text-[#111827] px-6 py-5",
              )}
            >
              {/* Reply indicator for user messages */}
              {isUser &&
                message.metadata?.replyToMessageId &&
                message.metadata?.replyToContent && (
                  <div className="mb-2 flex items-start gap-2 px-2 py-1.5 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]">
                    <Reply className="mt-0.5 h-3 w-3 shrink-0 text-[#666666]" />
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-xs font-medium text-[#666666]">
                        Replying to AI
                      </p>
                      <p className="text-xs text-[#8a8a8a] line-clamp-1">
                        {message.metadata.replyToContent.slice(0, 80)}
                        {message.metadata.replyToContent.length > 80
                          ? "..."
                          : ""}
                      </p>
                    </div>
                  </div>
                )}
              {message.referencedMessageId && referencedMessage && (
                <div className="mb-3 border-b border-slate-200 pb-3">
                  <div className="flex items-start gap-2 text-xs">
                    <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 font-semibold text-slate-500">
                        Replying to:
                      </p>
                      <p className="text-slate-600 line-clamp-2 italic">
                        {referencedMessage.content}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {(message.thinkingContent || message.isThinkingInProgress) && (
                <ReasoningBlock
                  thinkingContent={message.thinkingContent || ""}
                  isNewMessage={isNewMessage && !isUser}
                  isThinkingInProgress={message.isThinkingInProgress}
                />
              )}
              {!isUser && webSearches.length > 0 && (
                <WebSearchCard searches={webSearches} />
              )}

              {isEditing && isUser ? (
                <div className="space-y-2">
                  <Textarea
                    ref={textareaRef}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="min-h-[1.5em] w-full min-w-0 resize-none overflow-hidden border-0 bg-transparent text-sm text-[#171717] ring-0 shadow-none focus-visible:ring-0"
                    style={{ maxWidth: "100%" }}
                    rows={1}
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveAndResubmit}
                      className="h-7 w-7"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-7 w-7"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : message.isLoading ? (
                <div className="max-w-125 w-auto flex flex-col gap-2">
                  {message.toolStatus ? (
                    <p className="text-sm text-zinc-500 animate-pulse">{message.toolStatus}</p>
                  ) : (
                    <>
                      <div className="bg-zinc-400/50 w-[300px] h-4 animate-pulse rounded-md"></div>
                      <div className="bg-zinc-400/50 w-[175px] h-4 animate-pulse rounded-md"></div>
                    </>
                  )}
                </div>
              ) : (
                // <LoadingState />
                <div className="flex min-w-0 flex-col gap-4 text-sm">
                  {!isMediaGeneration && contentSegments.length === 0 && (
                    <p className="min-w-0 whitespace-pre-wrap break-words leading-relaxed">
                      {contentToDisplay}
                    </p>
                  )}
                  {!isMediaGeneration && contentSegments.map((segment, index) => {
                    if (segment.type === "code") {
                      return (
                        <CodeBlock
                          key={`code-${message.id}-${index}`}
                          elementKey={`code-${message.id}-${index}`}
                          language={segment.language}
                          value={segment.value}
                          onCopy={onCopy}
                        />
                      );
                    }

                    if (!segment.value) {
                      return <br key={`text-${message.id}-${index}`} />;
                    }

                    return (
                      <div
                        key={`text-${message.id}-${index}`}
                        className="min-w-0 space-y-2"
                      >
                        {renderTextContent(
                          segment.value,
                          `text-${message.id}-${index}`,
                        )}
                      </div>
                    );
                  })}
                  {(message.isLoading || isResponding) &&
                    !message.imageUrl &&
                    !message.images?.length &&
                    !isUser &&
                    message.metadata?.isImageGeneration && (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <Skeleton
                          className="w-full max-w-md aspect-square rounded-2xl bg-zinc-200"
                          aria-label="Image generating"
                        />
                      </div>
                    )}
                  {(message.images?.length
                    ? message.images
                    : message.imageUrl
                      ? [{ url: message.imageUrl }]
                      : []
                  ).map((img, idx) => (
                    <div
                      key={`${message.id ?? "msg"}-img-${idx}`}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      <Image
                        src={img.url}
                        alt={
                          message.imageAlt ||
                          message.content ||
                          "Generated image"
                        }
                        width={0}
                        height={0}
                        sizes="100vw"
                        unoptimized={img.url.startsWith("data:")}
                        className="w-full h-auto object-contain bg-white"
                      />
                    </div>
                  ))}
                  {!isUser &&
                    !message.isLoading &&
                    onSuggestionSelect &&
                    clarificationSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {clarificationSuggestions.map((suggestion, idx) => (
                          <button
                            key={`${message.id}-clarification-${idx}-${suggestion.label}`}
                            type="button"
                            onClick={() => onSuggestionSelect(suggestion.label)}
                            className="inline-flex max-w-full flex-col items-start rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-left transition-colors hover:bg-[#EEF2FF]"
                          >
                            <span className="text-xs font-medium text-[#111827]">
                              {suggestion.label}
                            </span>
                            {suggestion.description && (
                              <span className="mt-1 text-[11px] text-[#6B7280]">
                                {suggestion.description}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>
            {!isUser &&
              !message.isLoading &&
              generatedDocumentItems.length > 0 && (
                <div className="mt-2 mb-6 flex w-full min-w-0 flex-col gap-2 px-6">
                  {generatedDocumentItems.map((file, idx) => (
                    <GeneratedDocumentInlineCard
                      key={`${message.id ?? "msg"}-doc-${idx}-${file.url}`}
                      file={file}
                      fallbackName={`Document ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            <div
              className={cn(
                "mt-1 flex w-full",
                isUser ? "justify-end" : "justify-start",
              )}
            >
              {renderActions(
                "flex items-center gap-1 rounded-full bg-[#F5F5F5]/80 px-1.5 py-1 text-xs backdrop-blur-sm",
              )}
            </div>
          </div>
          {/* Show tagged pins above user chat bubble only */}
          {isUser && taggedPins.length > 0 && (
            <div
              className={cn(
                "mb-1 flex flex-wrap gap-2",
                isUser ? "justify-end" : "justify-start",
              )}
            >
              {taggedPins.map((pin) => (
                <span
                  key={pin.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F2F2F4] px-3 py-1 text-xs font-medium text-[#44404D]"
                >
                  <Pin className="h-3 w-3" />
                  <span className="truncate max-w-[240px]">@{pin.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
