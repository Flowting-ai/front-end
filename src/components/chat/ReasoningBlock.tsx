"use client";

import { useState, useEffect, type JSX } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeURL } from "@/lib/security";

/**
 * Converts reasoning text into formatted JSX elements.
 *
 * Supports: blank-line gaps, Markdown headers (#–######),
 * unordered list items (-, *, +), bold (**text**) and inline links.
 */
export const renderReasoningContent = (text: string): JSX.Element[] => {
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

    // Markdown headers (#–######)
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

    // Unordered list items (-, *, +)
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
        parts.push(
          <strong
            key={`reasoning-bold-${lineIndex}-${boldCount++}`}
            className="font-semibold text-[#6b5fad]"
          >
            {match[2]}
          </strong>,
        );
      } else {
        const safeUrl = sanitizeURL(match[4] ?? "");
        parts.push(
          safeUrl ? (
            <a
              key={`reasoning-link-${lineIndex}-${linkCount++}`}
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6b5fad] underline underline-offset-2 hover:text-[#4e3fa8]"
            >
              {match[3]}
            </a>
          ) : (
            <span
              key={`reasoning-link-${lineIndex}-${linkCount++}`}
              className="text-[#6b5fad]"
            >
              {match[3]}
            </span>
          ),
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

interface ReasoningBlockProps {
  thinkingContent: string;
  isNewMessage: boolean;
  isThinkingInProgress?: boolean;
}

/**
 * Collapsible reasoning section with a Claude-style typewriter reveal effect.
 *
 * - New messages animate character-by-character using `requestAnimationFrame`,
 *   then auto-collapse after a short delay once done.
 * - Historical messages show formatted content immediately, pre-collapsed.
 * - In-progress thinking streams live text without a collapse delay.
 */
export function ReasoningBlock({
  thinkingContent,
  isNewMessage,
  isThinkingInProgress,
}: ReasoningBlockProps) {
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

    // Start with first character immediately to avoid perceived delay
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

    let rafId: number | null = null;
    let lastTick = 0;
    const tick = (ts: number) => {
      if (ts - lastTick >= 16) {
        lastTick = ts;
        const remaining = thinkingContent.length - currentIndex;
        const step = Math.max(1, Math.ceil(remaining * 0.08));
        currentIndex = Math.min(currentIndex + step, thinkingContent.length);
        setDisplayText(thinkingContent.slice(0, currentIndex));
        if (currentIndex >= thinkingContent.length) {
          setIsTypingDone(true);
          setTimeout(() => setIsCollapsed(true), 700);
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
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
}
