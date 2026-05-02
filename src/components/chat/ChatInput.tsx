"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PlusSignIcon,
  ArrowUpTwoIcon,
  ArrowDownOneIcon,
} from "@strange-huge/icons";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils";
import { StopCircle } from "lucide-react";

const SHADOW_DEFAULT = "var(--shadow-chat-input)";
const SHADOW_HOVER = "var(--shadow-chat-input-hover)";
const SHADOW_FOCUS = "var(--shadow-chat-input-focus)";

export interface ChatInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  placeholder?: string;
  textareaLabel?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSend?: (value: string) => void;
  onAdd?: () => void;
  onStop?: () => void;
  modelName?: string;
  onModelClick?: React.MouseEventHandler<HTMLButtonElement>;
  chips?: React.ReactNode;
  isStreaming?: boolean;
  disabled?: boolean;
}

export const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>(
  function ChatInput(
    {
      placeholder = "How can I help you today?",
      textareaLabel = "Message",
      value: controlledValue,
      onChange,
      onSend,
      onAdd,
      onStop,
      modelName = "Souvenir",
      onModelClick,
      chips,
      isStreaming = false,
      disabled = false,
      className,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      ...props
    },
    ref,
  ) {
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState("");
    const value = isControlled ? controlledValue : internalValue;

    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-grow textarea
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) setInternalValue(e.target.value);
      onChange?.(e.target.value);
    };

    const handleSend = () => {
      if (!value || disabled) return;
      const text = value;
      if (!isControlled) setInternalValue("");
      onChange?.("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      onSend?.(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && value && !disabled) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(true);
      externalMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(false);
      externalMouseLeave?.(e);
    };

    const shadow = isFocused
      ? SHADOW_FOCUS
      : isHovered
        ? SHADOW_HOVER
        : SHADOW_DEFAULT;

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          width: "100%",
          maxWidth: "674px",
          padding: "20px",
          borderRadius: "24px",
          backgroundColor: "var(--chat-input-bg)",
          boxShadow: shadow,
          overflow: "hidden",
          transition: "box-shadow 150ms",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* Textarea + placeholder */}
        <div style={{ position: "relative" }}>
          <AnimatePresence initial={false}>
            {!value && (
              <motion.div
                key="placeholder"
                aria-hidden
                initial={{ opacity: 0, filter: "blur(2px)" }}
                animate={{
                  opacity: 1,
                  filter: "blur(0px)",
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
                  fontSize: "var(--font-size-body-lg)",
                  lineHeight: "var(--line-height-body-lg)",
                  color: "var(--chat-input-placeholder)",
                }}
              >
                {placeholder}
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            ref={textareaRef}
            className="kaya-chat-textarea"
            rows={1}
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label={textareaLabel}
            aria-multiline="true"
            style={{
              width: "100%",
              maxHeight: "396px",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              overflowY: "auto",
              overscrollBehaviorY: "none",
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-regular)",
              fontSize: "var(--font-size-body-lg)",
              lineHeight: "var(--line-height-body-lg)",
              color: "var(--chat-input-text)",
              caretColor: "var(--focus-ring)",
            }}
          />
        </div>

        {/* Footer bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {/* Left: attach + chips */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <IconButton
              variant="ghost"
              size="md"
              icon={<PlusSignIcon size={20} />}
              aria-label="Add attachment"
              onClick={onAdd}
              disabled={disabled}
            />
            {chips && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                {chips}
              </div>
            )}
          </div>

          {/* Right: model selector + send/stop */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Button
              variant="ghost"
              size="md"
              rightIcon={<ArrowDownOneIcon size={16} />}
              onClick={onModelClick}
              disabled={disabled}
            >
              {modelName}
            </Button>

            <IconButton
              variant="default"
              size="md"
              aria-label={isStreaming ? "Stop generation" : "Send message"}
              icon={
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={isStreaming ? "stop" : value ? "send" : "send-disabled"}
                    initial={{ scale: 0.5, opacity: 0, filter: "blur(4px)" }}
                    animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                    exit={{ scale: 0.5, opacity: 0, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {isStreaming ? (
                      <StopCircle size={20} />
                    ) : (
                      <ArrowUpTwoIcon size={20} />
                    )}
                  </motion.span>
                </AnimatePresence>
              }
              onClick={isStreaming ? onStop : handleSend}
              disabled={!isStreaming && (!value || disabled)}
            />
          </div>
        </div>
      </div>
    );
  },
);

ChatInput.displayName = "ChatInput";

export default ChatInput;
