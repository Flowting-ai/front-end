"use client";

import React from "react";
import { AnimatePresence, m } from "framer-motion";

interface ComposerTextareaProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  placeholder: string;
  textareaLabel: string;
  textareaMaxHeight: string;
  isRecording: boolean;
  disabled: boolean;
  szFont: string;
  szLineHeight: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onPaste: React.ClipboardEventHandler<HTMLTextAreaElement>;
}

/** The auto-growing textarea, under an animated placeholder that fades out once there's text. */
export function ComposerTextarea({
  textareaRef,
  value,
  placeholder,
  textareaLabel,
  textareaMaxHeight,
  isRecording,
  disabled,
  szFont,
  szLineHeight,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  onPaste,
}: ComposerTextareaProps) {
  return (
    <div style={{ position: "relative" }}>
      {/* Custom animated placeholder - fades out when user starts typing */}
      <AnimatePresence initial={false}>
        {!value && (
          <m.div
            key="placeholder"
            aria-hidden
            initial={{ opacity: 0, filter: "blur(2px)" }}
            animate={{
              opacity: 1,
              filter: "blur(0px)", transitionEnd: { filter: "none" },
              transition: { duration: 0.2 },
            }}
            exit={{
              opacity: 0,
              filter: "blur(2px)",
              transition: { duration: 0.15 },
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              pointerEvents: "none",
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-regular)",
              fontSize: szFont,
              lineHeight: szLineHeight,
              color: "var(--chat-input-placeholder)",
            }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span
                // Keyed by the text so a new placeholder (e.g. "Queue a
                // follow-up…" while a reply streams) swaps in animated.
                key={isRecording ? "listening" : `default:${placeholder}`}
                initial={{ scale: 0.75, opacity: 0, filter: "blur(4px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                exit={{ scale: 0.75, opacity: 0, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{ display: "block", transformOrigin: "left center" }}
              >
                {isRecording ? "Listening..." : placeholder}
              </m.span>
            </AnimatePresence>
          </m.div>
        )}
      </AnimatePresence>

      <textarea
        ref={textareaRef}
        className="kaya-chat-textarea"
        rows={1}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        disabled={disabled}
        readOnly={isRecording}
        aria-label={textareaLabel}
        aria-multiline="true"
        style={{
          width: "100%",
          maxHeight: textareaMaxHeight,
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "none",
          overflowY: "auto",
          overscrollBehaviorY: "none",
          fontFamily: "var(--font-body)",
          fontWeight: "var(--font-weight-regular)",
          fontSize: szFont,
          lineHeight: szLineHeight,
          color: "var(--chat-input-text)",
          caretColor: "var(--focus-ring)",
          cursor: disabled ? "not-allowed" : undefined,
        }}
      />
    </div>
  );
}
