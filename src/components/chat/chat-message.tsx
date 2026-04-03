"use client";
import { useHighlightJs } from "@/hooks/useHighlightJs";
import katex from "katex";
import "katex/dist/katex.min.css";

import chatStyles from "./chat-interface.module.css";
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
  // Eye,
  // EyeOff,
  ThumbsUp,
  ThumbsDown,
  Reply,
  ExternalLink,
  ChevronDown,
  Globe,
  Download,
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

const renderLatexInlineContent = (text: string, keyPrefix: string) => {
  const nodes: Array<string | JSX.Element> = [];
  // Match block: $$...$$ or \[...\], inline: \(...\) or $...$
  const latexRegex =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let latexCount = 0;

  while ((match = latexRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      nodes.push(
        ...renderBoldInlineContent(
          beforeText,
          `${keyPrefix}-pre-${latexCount}`,
        ),
      );
    }

    const blockContent = match[1] ?? match[2];
    const inlineContent = match[3] ?? match[4];
    const isBlock = Boolean(blockContent);
    const latexContent = (isBlock ? blockContent : inlineContent) ?? "";

    try {
      const html = katex.renderToString(latexContent, {
        throwOnError: false,
        displayMode: isBlock,
      });
      nodes.push(
        <span
          key={`${keyPrefix}-latex-${latexCount++}`}
          className={isBlock ? "block my-2" : "inline-block mx-0.5"}
          dangerouslySetInnerHTML={{ __html: html }}
        />,
      );
    } catch {
      // If KaTeX fails, show the raw LaTeX
      nodes.push(
        <code
          key={`${keyPrefix}-latex-err-${latexCount++}`}
          className="bg-red-100 text-red-800 px-1 rounded"
        >
          {match[0]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    nodes.push(...renderBoldInlineContent(remaining, `${keyPrefix}-post`));
  }

  if (nodes.length === 0) {
    nodes.push(...renderBoldInlineContent(text, `${keyPrefix}-all`));
  }

  return nodes;
};

const renderBoldInlineContent = (text: string, keyPrefix: string) => {
  const boldRegex = /(\*\*|__)(.+?)\1/g;
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let boldCount = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong
        key={`${keyPrefix}-bold-${boldCount++}`}
        className="font-semibold text-[#171717]"
      >
        {match[2]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  if (nodes.length === 0) {
    nodes.push(text);
  }

  return nodes;
};

interface LinkPreviewProps {
  url: string;
  label?: string;
}

const linkPreviewCache = new Map<
  string,
  { siteName: string; faviconUrl: string; title?: string; description?: string }
>();

const LinkPreview = ({ url, label }: LinkPreviewProps) => {
  const normalizedUrl = url.trim();
  const hostname = getHostname(normalizedUrl) || normalizedUrl;
  const [showCard, setShowCard] = useState(false);
  const [preview, setPreview] = useState<{
    siteName: string;
    faviconUrl: string;
    title?: string;
    description?: string;
  } | null>(linkPreviewCache.get(normalizedUrl) ?? null);

  const displayLabel = (
    label ||
    preview?.title ||
    hostname ||
    normalizedUrl
  ).trim();

  const fetchPreview = async () => {
    if (linkPreviewCache.has(normalizedUrl)) {
      const cached = linkPreviewCache.get(normalizedUrl)!;
      if (!preview || preview.title !== cached.title) setPreview(cached);
      return;
    }
    const faviconUrl = hostname
      ? `${FAVICON_BASE}${encodeURIComponent(hostname)}`
      : "";
    // Set basic preview immediately
    const basic = { siteName: hostname, faviconUrl };
    linkPreviewCache.set(normalizedUrl, basic);
    setPreview(basic);

    // Fetch metadata for title and description
    try {
      const fullUrl = normalizedUrl.startsWith("http")
        ? normalizedUrl
        : `https://${normalizedUrl}`;
      const encoded = encodeURIComponent(fullUrl);
      const res = await fetch(`/api/link-metadata?url=${encoded}`);
      if (res.ok) {
        const data = await res.json();
        const enriched = {
          siteName: hostname,
          faviconUrl,
          title: typeof data.title === "string" ? data.title : undefined,
          description:
            typeof data.description === "string" ? data.description : undefined,
        };
        linkPreviewCache.set(normalizedUrl, enriched);
        setPreview(enriched);
      }
    } catch {
      // Keep basic preview on error
    }
  };

  // Eagerly fetch metadata on mount so the title is available for display
  useEffect(() => {
    void fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedUrl]);

  const faviconSrc =
    preview?.faviconUrl ||
    (hostname ? `${FAVICON_BASE}${encodeURIComponent(hostname)}` : "");

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        setShowCard(true);
      }}
      onMouseLeave={() => {
        setShowCard(false);
      }}
    >
      <a
        href={
          normalizedUrl.startsWith("http")
            ? normalizedUrl
            : `https://${normalizedUrl}`
        }
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1 rounded-full border border-main-border bg-[#F4F4F5] px-2 py-0.5 text-xs font-medium text-[#0A0A0A] hover:bg-[#E4E4E7] hover:text-[#111827] transition-all duration-200 max-w-full align-middle"
      >
        {faviconSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconSrc}
            alt=""
            className="h-3.5 w-3.5 shrink-0 rounded-sm"
          />
        )}
        <span className="truncate max-w-[200px]">{displayLabel}</span>
        <ExternalLink
          className="ml-0.5 h-3 w-3 shrink-0 text-zinc-400 transition-all duration-150 group-hover:text-zinc-600"
          aria-hidden="true"
        />
      </a>
      {showCard && (
        <span
          className="absolute left-0 bottom-full mb-2 w-72 rounded-[12px] border border-zinc-200 bg-white shadow-xl z-50 overflow-hidden"
          style={{ pointerEvents: "none", display: "block" }}
        >
          <span className="flex items-start gap-3 p-3" style={{ display: "flex" }}>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#F4F4F5] border border-zinc-200 overflow-hidden mt-0.5">
              {faviconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={faviconSrc}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
              ) : (
                <span className="text-sm font-semibold text-zinc-500">
                  {(hostname || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="flex flex-col min-w-0 gap-0.5" style={{ display: "flex" }}>
              <span className="text-[13px] font-semibold text-[#111827] line-clamp-2">
                {preview?.title || label || hostname}
              </span>
              {preview?.description && (
                <span className="text-[11px] text-[#6B7280] line-clamp-2 leading-snug">
                  {preview.description}
                </span>
              )}
              <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                <ExternalLink className="h-3 w-3 shrink-0" />
                {hostname}
              </span>
            </span>
          </span>
        </span>
      )}
    </span>
  );
};

const renderInlineContent = (text: string, keyPrefix: string) => {
  if (!text) {
    return [text];
  }

  const nodes: Array<string | JSX.Element> = [];
  // Match either markdown links [label](url) or bare URLs (with http://, https://, or www. prefix only)
  const linkRegex =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)|(www\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.[a-zA-Z]{2,}(?:\/[^\s)]*)?)/g;
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
        <LinkPreview
          key={`${keyPrefix}-link-${partIndex++}`}
          url={url}
          label={label}
        />,
      );
    } else if (match[3]) {
      // Bare URL with http/https, strip trailing punctuation from the URL but keep it visually
      const raw = match[3];
      const trimmedUrl = raw.replace(/[).,]+$/, "");
      const trailing = raw.slice(trimmedUrl.length);

      nodes.push(
        <LinkPreview
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
      const trimmedUrl = raw.replace(/[).,]+$/, "");
      const trailing = raw.slice(trimmedUrl.length);

      nodes.push(
        <LinkPreview
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

// Helper to render formatted reasoning content
const renderReasoningContent = (text: string): JSX.Element[] => {
  if (!text) return [];

  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let lineIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(
        <span key={`reasoning-gap-${lineIndex++}`} className="block h-2" />,
      );
      continue;
    }

    // Check for headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      const fontSize =
        level === 1
          ? "text-[13px]"
          : level === 2
            ? "text-[12.5px]"
            : "text-[12px]";
      elements.push(
        <div
          key={`reasoning-h-${lineIndex++}`}
          className={`font-semibold ${fontSize} text-[#6b5fad] mb-1 mt-2`}
        >
          {content}
        </div>,
      );
      continue;
    }

    // Check for list items
    const listMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (listMatch) {
      elements.push(
        <div key={`reasoning-li-${lineIndex++}`} className="flex gap-2 ml-3">
          <span className="text-[#9d8fd4] select-none">•</span>
          <span>{listMatch[1]}</span>
        </div>,
      );
      continue;
    }

    // Regular paragraph with bold and link support
    const parts: (string | JSX.Element)[] = [];
    const inlineRegex = /(\*\*|__)(.+?)\1|\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIdx = 0;
    let match;
    let boldCount = 0;
    let linkCount = 0;

    while ((match = inlineRegex.exec(trimmed)) !== null) {
      if (match.index > lastIdx) {
        parts.push(trimmed.slice(lastIdx, match.index));
      }
      if (match[1]) {
        // Bold
        parts.push(
          <strong
            key={`reasoning-bold-${lineIndex}-${boldCount++}`}
            className="font-semibold text-[#6b5fad]"
          >
            {match[2]}
          </strong>,
        );
      } else {
        // Link
        parts.push(
          <a
            key={`reasoning-link-${lineIndex}-${linkCount++}`}
            href={match[4]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6b5fad] underline underline-offset-2 hover:text-[#4e3fa8]"
          >
            {match[3]}
          </a>,
        );
      }
      lastIdx = match.index + match[0].length;
    }

    if (lastIdx < trimmed.length) {
      parts.push(trimmed.slice(lastIdx));
    }

    if (parts.length === 0) {
      parts.push(trimmed);
    }

    elements.push(
      <div key={`reasoning-p-${lineIndex++}`} className="leading-relaxed">
        {parts}
      </div>,
    );
  }

  return elements;
};

// Reasoning section with Claude-style typewriter effect
const ReasoningSection = ({
  thinkingContent,
  isNewMessage,
  isThinkingInProgress,
}: {
  thinkingContent: string;
  isNewMessage: boolean;
  isThinkingInProgress?: boolean;
}) => {
  const [displayText, setDisplayText] = useState(
    isNewMessage ? "" : thinkingContent,
  );
  const [isTypingDone, setIsTypingDone] = useState(!isNewMessage);
  const [isCollapsed, setIsCollapsed] = useState(!isNewMessage);

  useEffect(() => {
    if (isThinkingInProgress) {
      setDisplayText(thinkingContent);
      setIsTypingDone(false);
      setIsCollapsed(false);
      return;
    }

    if (!isNewMessage) {
      setDisplayText(thinkingContent);
      setIsTypingDone(true);
      setIsCollapsed(true);
      return;
    }

    // Start with first character immediately to avoid delay
    let currentIndex = 0;
    setDisplayText(thinkingContent.charAt(0) || "");
    currentIndex = 1;
    setIsTypingDone(false);
    setIsCollapsed(false);

    if (thinkingContent.length <= 1) {
      setIsTypingDone(true);
      setTimeout(() => setIsCollapsed(true), 700);
      return;
    }

    const intervalId = setInterval(() => {
      if (currentIndex < thinkingContent.length) {
        setDisplayText(thinkingContent.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(intervalId);
        setIsTypingDone(true);
        setTimeout(() => setIsCollapsed(true), 700);
      }
    }, 6);

    return () => clearInterval(intervalId);
  }, [thinkingContent, isNewMessage, isThinkingInProgress]);

  return (
    <div className="mb-3 rounded-xl border border-[#e8e3f4] bg-[#f9f7ff] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          {(!isTypingDone || isThinkingInProgress) && (
            <span className="flex gap-0.5">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-1.5 w-1.5 rounded-full bg-[#7c6fcd] animate-bounce"
                  style={{ animationDelay: `${dot * 0.15}s` }}
                />
              ))}
            </span>
          )}
          <span className="text-xs font-semibold text-[#6b5fad] tracking-wide">
            {!isTypingDone || isThinkingInProgress
              ? "Reasoning\u2026"
              : "Reasoning"}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[#9d8fd4] transition-transform duration-200",
            isCollapsed ? "" : "rotate-180",
          )}
        />
      </button>
      {!isCollapsed && (
        <div className="border-t border-[#e8e3f4] px-3 py-2">
          {!isTypingDone || isThinkingInProgress ? (
            <pre className="whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-[#6b5fad]/80">
              {displayText}
              <span className="inline-block w-[2px] h-[13px] bg-[#9d8fd4] ml-[1px] align-middle animate-[blink_0.8s_step-end_infinite]" />
            </pre>
          ) : (
            <div className="font-sans text-[11.5px] leading-relaxed text-[#6b5fad]/80 space-y-1">
              {renderReasoningContent(displayText)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const renderTextContent = (value: string, keyPrefix: string): JSX.Element[] => {
  const nodes: JSX.Element[] = [];
  const lines = value.replace(/\r/g, "").split("\n");
  const listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const listKey = `${keyPrefix}-list-${nodes.length}`;
    nodes.push(
      <ul key={listKey} className="ml-5 list-disc space-y-1 text-[#171717]">
        {listBuffer.map((item, index) => (
          <li key={`${listKey}-item-${index}`} className="leading-relaxed">
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
        try {
          const html = katex.renderToString(mathContent, {
            throwOnError: false,
            displayMode: true,
          });
          nodes.push(
            <div
              key={`${keyPrefix}-math-${index}`}
              className="my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />,
          );
          continue;
        } catch {
          // Fall through to raw rendering when parsing fails.
        }
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
            "font-semibold text-[#171717] tracking-tight",
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
      nodes.push(
        <div
          key={tableKey}
          className="overflow-x-auto rounded-2xl border border-slate-200"
        >
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50/70 text-slate-700">
              <tr>
                {headerCells.map((cell, cellIndex) => (
                  <th
                    key={`${tableKey}-header-${cellIndex}`}
                    className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-[#171717]"
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
                      className="border-t border-slate-100 px-3 py-2 align-top text-[#171717]"
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
        className="whitespace-pre-wrap leading-relaxed text-[#171717]"
      >
        {renderInlineContent(line, `${keyPrefix}-paragraph-${index}`)}
      </p>,
    );
  }

  flushList();
  return nodes;
};

// Streaming-aware typewriter hook: reveals content word-by-word
// without resetting when new streamed content arrives.
const useStreamingTypewriter = (
  fullText: string,
  enabled: boolean = true,
  wordsPerTick: number = 2,
  intervalMs: number = 30,
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

    const animate = (timestamp: number) => {
      if (!enabledRef.current) return;
      if (timestamp - lastTickRef.current >= intervalMs) {
        lastTickRef.current = timestamp;
        setRevealedLen((prev) => {
          if (prev >= fullText.length) return prev;
          // Advance by wordsPerTick words (find next word boundaries)
          let target = prev;
          let wordsFound = 0;
          while (target < fullText.length && wordsFound < wordsPerTick) {
            // Skip whitespace
            while (target < fullText.length && /\s/.test(fullText[target])) {
              target++;
            }
            // Skip non-whitespace (word characters)
            while (target < fullText.length && !/\s/.test(fullText[target])) {
              target++;
            }
            wordsFound++;
          }
          return target;
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
  }, [fullText, enabled, wordsPerTick, intervalMs]);

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

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

const FAVICON_BASE = "https://www.google.com/s2/favicons?sz=32&domain=";

function SourceFaviconStack({ urls }: { urls: string[] }) {
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const list = urls.slice(0, 4).filter(Boolean);
  const markFailed = (i: number) => {
    setFailed((prev) => new Set(prev).add(i));
  };
  if (list.length === 0) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#E4E4E7] border border-main-border text-[10px] font-semibold text-[#525252]">
        ?
      </span>
    );
  }
  return (
    <span className="flex items-center -space-x-1">
      {list.map((url, i) => {
        const hostname = getHostname(url);
        const faviconUrl = hostname
          ? `${FAVICON_BASE}${encodeURIComponent(hostname)}`
          : "";
        const showFallback = !faviconUrl || failed.has(i);
        return (
          <span
            key={`${url}-${i}`}
            className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden bg-[#E4E4E7] border border-main-border rounded-md text-[10px] font-semibold text-[#525252]"
            style={{ zIndex: i + 1 }}
          >
            {showFallback ? (
              <span aria-hidden>
                {hostname ? hostname.charAt(0).toUpperCase() : "?"}
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faviconUrl}
                alt=""
                className="w-5 h-5 object-contain"
                onError={() => markFailed(i)}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

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
                      const hostname = getHostname(link) || link;
                      const faviconUrl = hostname
                        ? `${FAVICON_BASE}${encodeURIComponent(hostname)}`
                        : "";
                      return (
                        <a
                          key={link}
                          href={link}
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
    2,
    30,
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
        "h-9 w-9 text-xs font-semibold border border-transparent bg-transparent text-[#111827]",
        isLogoAvatar ? "rounded-none!" : "rounded-full",
      )}
    >
      {message.avatarUrl && (
        <AvatarImage
          src={message.avatarUrl}
          alt={isUser ? "User" : "AI"}
          className="object-cover"
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
        <div className="w-auto flex flex-col items-center justify-start gap-1">
          {(!isUser ||
            (isUser &&
              message.avatarUrl &&
              message.avatarUrl !== "/personas/userAvatar.png")) && (
            <div className="mt-4 shrink-0 h-9 w-9 relative flex items-center justify-center overflow-hidden">
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
            "flex flex-1 flex-col gap-2",
            isUser ? "items-end text-left" : "items-start text-left",
          )}
        >
          <div
            className={cn(
              "relative flex w-full max-w-162 flex-col",
              isUser ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "group/bubble chat-message-bubble relative px-4 py-2",
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
                <ReasoningSection
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
                    className="min-h-[1.5em] resize-none overflow-hidden border-0 bg-transparent text-sm text-[#171717] ring-0 shadow-none focus-visible:ring-0"
                    style={{ width: "auto", maxWidth: "100%" }}
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
                  <div className="bg-zinc-400/50 w-[300px] h-4 animate-pulse rounded-md"></div>
                  <div className="bg-zinc-400/50 w-[175px] h-4 animate-pulse rounded-md"></div>
                </div>
              ) : (
                // <LoadingState />
                <div className="flex flex-col gap-4 text-sm">
                  {!isMediaGeneration && contentSegments.length === 0 && (
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {contentToDisplay}
                    </p>
                  )}
                  {!isMediaGeneration && contentSegments.map((segment, index) => {
                    if (segment.type === "code") {
                      return (
                        <div
                          key={`code-${message.id}-${index}`}
                          className={`relative border border-zinc-100 rounded-2xl bg-[#F5F5F5] py-2 overflow-hidden`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/70 px-4">
                            {segment.language && (
                              <span className="text-black">
                                {segment.language}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onCopy(segment.value)}
                              className="cursor-pointer inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium border border-main-border text-black transition hover:text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </button>
                          </div>
                          <pre
                            className={`overflow-x-auto rounded-2xl bg-transparent p-2 font-normal text-sm leading-relaxed ${chatStyles.customScrollbar}`}
                          >
                            <code
                              className={`language-${segment.language || "ts"}`}
                            >
                              {segment.value.trimEnd()}
                            </code>
                          </pre>
                        </div>
                      );
                    }

                    if (!segment.value) {
                      return <br key={`text-${message.id}-${index}`} />;
                    }

                    return (
                      <div
                        key={`text-${message.id}-${index}`}
                        className="space-y-2"
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
                  {!isUser && generatedFiles.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {generatedFiles.map((file, idx) => (
                        <a
                          key={`${message.id ?? "msg"}-generated-file-${idx}`}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-left transition-colors hover:bg-[#EEF2FF]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-[#111827]">
                              {file.filename || `Generated file ${idx + 1}`}
                            </span>
                            <span className="block truncate text-[11px] text-[#6B7280]">
                              {file.mimeType || "Click to download"}
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D1D5DB] bg-white px-2 py-1 text-[11px] font-medium text-[#374151] group-hover:border-[#93C5FD] group-hover:text-[#1D4ED8]">
                            <Download className="h-3 w-3" />
                            Download
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
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
