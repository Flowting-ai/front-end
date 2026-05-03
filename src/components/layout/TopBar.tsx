"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeInlineMarkdown } from "@/lib/security";
import { usePinboard } from "@/context/pinboard-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  chatId?: string;
  title?: string;
  model?: string;
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onTitleChange?: (chatId: string, title: string) => Promise<void>;
  onCitationsToggle?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TopBar({
  chatId,
  title = "",
  model,
  showCitationsToggle = false,
  citationsOpen = false,
  onTitleChange,
  onCitationsToggle,
}: TopBarProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { isOpen: pinboardOpen, toggle: togglePinboard } = usePinboard();

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const commitTitle = () => {
    const trimmed = sanitizeInlineMarkdown(draftTitle.trim());
    if (trimmed && trimmed !== title && chatId && onTitleChange) {
      void onTitleChange(chatId, trimmed);
    } else {
      setDraftTitle(title);
    }
    setIsEditingTitle(false);
  };

  const cancelTitle = () => {
    setDraftTitle(title);
    setIsEditingTitle(false);
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "56px",
        paddingLeft: "20px",
        paddingRight: "16px",
        backgroundColor: "var(--neutral-white)",
        borderBottom: "1px solid var(--neutral-100)",
        flexShrink: 0,
        gap: "12px",
      }}
    >
      {/* ── Left: Chat title ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelTitle();
              }
            }}
            style={{
              width: "100%",
              maxWidth: "480px",
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-semibold)",
              fontSize: "var(--font-size-body)",
              lineHeight: "var(--line-height-body)",
              color: "var(--neutral-800)",
              backgroundColor: "var(--neutral-50)",
              border: "1px solid var(--blue-300)",
              borderRadius: "8px",
              padding: "4px 10px",
              outline: "none",
              boxShadow: "0 0 0 2px var(--blue-100)",
            }}
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => {
              if (chatId && onTitleChange) {
                setDraftTitle(title);
                setIsEditingTitle(true);
              }
            }}
            title={chatId ? "Double-click to rename" : undefined}
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-semibold)",
              fontSize: "var(--font-size-body)",
              lineHeight: "var(--line-height-body)",
              color: title ? "var(--neutral-800)" : "var(--neutral-400)",
              background: "none",
              border: "none",
              padding: "4px 0",
              cursor: chatId ? "text" : "default",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "480px",
            }}
          >
            {title || "New chat"}
          </button>
        )}
      </div>

      {/* ── Right: model chip + citations + user avatar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        {/* Model chip */}
        {model && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: "999px",
              backgroundColor: "var(--blue-50)",
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-medium)",
              fontSize: "var(--font-size-caption)",
              lineHeight: "var(--line-height-caption)",
              color: "var(--blue-600)",
              whiteSpace: "nowrap",
            }}
          >
            {model}
          </div>
        )}

        {/* Citations toggle */}
        {showCitationsToggle && (
          <button
            type="button"
            onClick={onCitationsToggle}
            title={citationsOpen ? "Hide citations" : "Show citations"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: citationsOpen
                ? "var(--blue-50)"
                : "transparent",
              cursor: "pointer",
              color: citationsOpen ? "var(--blue-600)" : "var(--neutral-500)",
            }}
          >
            {/* Citations icon — simple list SVG */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M2 4h12M2 8h8M2 12h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {/* Pinboard toggle */}
        <button
          type="button"
          onClick={togglePinboard}
          title={pinboardOpen ? "Close pinboard" : "Open pinboard"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: pinboardOpen
              ? "rgba(104,61,27,0.1)"
              : "transparent",
            cursor: "pointer",
            color: pinboardOpen ? "#683D1B" : "var(--neutral-500)",
            transition: "background 120ms",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

      </div>
    </header>
  );
}
