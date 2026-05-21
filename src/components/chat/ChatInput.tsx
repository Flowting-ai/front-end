"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  PlusSignIcon,
  ArrowUpTwoIcon,
  ArrowDownOneIcon,
  MicTwoIcon,
  StopCircleIcon,
} from "@strange-huge/icons";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/Button";
import { Dropdown } from "@/components/Dropdown";
import { cn } from "@/lib/utils";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { AudioWaveDisplay } from "@/components/shared/AudioWaveDisplay";

// ── Shadow tokens ──────────────────────────────────────────────────────────────

const SHADOW_DEFAULT = "var(--shadow-chat-input)";
const SHADOW_HOVER = "var(--shadow-chat-input-hover)";
const SHADOW_FOCUS = "var(--shadow-chat-input-focus)";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatInputProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  placeholder?: string;
  textareaLabel?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSend?: (value: string) => void;
  onAdd?: () => void;
  onStop?: () => void;
  modelName?: string;
  onModelClick?: React.MouseEventHandler<HTMLButtonElement>;
  /**
   * When set, the leading `+` IconButton opens a Dropdown.Float panel
   * (placement="top-start"). Typical contents: a `<Dropdown>` with rows
   * for "Add files", "Web search", "Use style", "Add persona", "Pin folders".
   */
  addMenu?: React.ReactNode;
  /**
   * When set, the model-selector Button opens a Dropdown.Float panel
   * (placement="top-end"). Typical contents: a `<Dropdown size="md">` with
   * switch rows and a "More models" submenu.
   */
  modelMenu?: React.ReactNode;
  chips?: React.ReactNode;
  /**
   * Content rendered inside the input box, above the textarea.
   * Intended for the AttachmentManager chip strip.
   */
  attachmentsSlot?: React.ReactNode;
  isStreaming?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /**
   * Called when the user triggers an `@`-mention in the textarea.
   * Receives the text typed after `@` as the query, or `null` when mention
   * mode ends (space/punctuation typed, `@` deleted, or focus lost).
   */
  onMentionChange?: (query: string | null) => void;
  /**
   * When true, the Enter key navigates the pin dropdown instead of sending
   * the message. ArrowUp/Down/Escape are also delegated to `onPinNavigate`.
   */
  isPinDropdownOpen?: boolean;
  /**
   * Keyboard-navigation callback fired when `isPinDropdownOpen` is true.
   * The parent moves selection state and calls `onSelect` on "select".
   */
  onPinNavigate?: (action: "up" | "down" | "select" | "close") => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatInput(
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
    addMenu,
    modelMenu,
    chips,
    attachmentsSlot,
    isStreaming = false,
    disabled = false,
    compact = false,
    onMentionChange,
    isPinDropdownOpen = false,
    onPinNavigate,
    className,
    onMouseEnter: externalMouseEnter,
    onMouseLeave: externalMouseLeave,
    ref,
    ...props
  }: ChatInputProps & { ref?: React.Ref<HTMLDivElement> },
// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
) {
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState("");
    const value = isControlled ? controlledValue : internalValue;

    const [isFocused,     setIsFocused]     = useState(false);
    const [isHovered,     setIsHovered]     = useState(false);
    const [isRecording,   setIsRecording]   = useState(false);
    const [analyser,      setAnalyser]      = useState<AnalyserNode | null>(null);
    const [isMicHovered,  setIsMicHovered]  = useState(false);
    const [addMenuOpen,   setAddMenuOpen]   = useState(false);
    const [modelMenuOpen, setModelMenuOpen] = useState(false);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRecordingTextRef = useRef<string>("");

    // Stable ref for onChange to avoid stale closure in transcript effect
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
      useSpeechRecognition();

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        audioCtxRef.current?.close();
        SpeechRecognition.abortListening();
      };
    }, []);

    // Auto-grow textarea
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      // eslint-disable-next-line react-doctor/js-batch-dom-css -- forced reflow: must read scrollHeight after resetting to auto
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    // Live transcript → textarea value during recording
    useEffect(() => {
      if (!isRecording) return;
      const base = preRecordingTextRef.current;
      const combined =
        base && transcript ? `${base} ${transcript}` : transcript || base;
      if (!isControlled) setInternalValue(combined);
      onChangeRef.current?.(combined);
    }, [transcript, isRecording, isControlled]);

    // ── Recording toggle ─────────────────────────────────────────────────────

    const startRecording = async () => {
      if (!browserSupportsSpeechRecognition) return;
      preRecordingTextRef.current = value ?? "";
      resetTranscript();

      // Set recording state immediately for instant UI feedback.
      setIsRecording(true);
      SpeechRecognition.startListening({ continuous: true, interimResults: true });

      // Create AudioContext synchronously while still inside the user-gesture call
      // stack. If created after an `await`, Chrome starts it suspended and
      // getByteFrequencyData returns all zeros.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Resume in case the context was auto-suspended (e.g. tab in background)
        if (ctx.state === "suspended") await ctx.resume();

        const source = ctx.createMediaStreamSource(stream);
        const analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.smoothingTimeConstant = 0.75;
        source.connect(analyserNode);
        setAnalyser(analyserNode);
      } catch {
        // Mic permission denied or unavailable - revert all state
        ctx.close();
        audioCtxRef.current = null;
        SpeechRecognition.abortListening();
        setIsRecording(false);
      }
    };

    const stopRecording = () => {
      SpeechRecognition.stopListening();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      streamRef.current = null;
      audioCtxRef.current = null;
      setAnalyser(null);
      setIsRecording(false);
    };

    // Single handler for the action button (stop stream / stop recording / send / start recording)
    const handleActionClick = () => {
      if (isStreaming) { onStop?.(); return; }
      if (isRecording) { stopRecording(); return; }
      if (value) { handleSend(); return; }
      startRecording();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (!isControlled) setInternalValue(newValue);
      onChange?.(newValue);

      // @-mention detection - only when the parent opts in via onMentionChange.
      if (onMentionChange) {
        const lastChar = newValue[newValue.length - 1];
        if (lastChar === "@") {
          // User just typed @: open the dropdown with an empty query.
          onMentionChange("");
          return;
        }
        if (isPinDropdownOpen) {
          const lastAtIdx = newValue.lastIndexOf("@");
          if (lastAtIdx !== -1) {
            const afterAt = newValue.substring(lastAtIdx + 1);
            // A space/punctuation after @ means the user abandoned the mention.
            if (/[\s,.!?;:\n]/.test(afterAt)) {
              onMentionChange(null);
            } else {
              onMentionChange(afterAt);
            }
          } else {
            // @ was deleted - close the dropdown.
            onMentionChange(null);
          }
        }
      }
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
      // While the pin dropdown is open, delegate arrow keys / Enter / Escape
      // to the parent so it can move the highlighted selection or confirm.
      if (isPinDropdownOpen && onPinNavigate) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onPinNavigate("down");
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onPinNavigate("up");
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          onPinNavigate("select");
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onPinNavigate("close");
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey && value && !disabled && !isRecording) {
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

    // Derive a stable string key for the AnimatePresence icon swap
    const iconKey = isStreaming
      ? "stream-stop"
      : isRecording
        ? isMicHovered
          ? "rec-stop"
          : "wave"
        : value
          ? "send"
          : "mic";

    // Button is disabled only when the disabled prop is set AND there's no
    // in-progress action to cancel, AND browser doesn't support speech with
    // no text to send.
    const isActionDisabled =
      (disabled && !isStreaming && !isRecording) ||
      (!value && !isRecording && !isStreaming && !browserSupportsSpeechRecognition);

    const szPadding    = compact ? "12px 16px"                  : "20px"
    const szGap        = compact ? "12px"                       : "24px"
    const szRadius     = compact ? "20px"                       : "24px"
    const szBtn        = compact ? "sm" as const                : "md" as const
    const szFont       = compact ? "var(--font-size-body)"      : "var(--font-size-body-lg)"
    const szLineHeight = compact ? "var(--line-height-body)"    : "var(--line-height-body-lg)"

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: szGap,
          width: "100%",
          maxWidth: "100%",
          padding: szPadding,
          borderRadius: szRadius,
          backgroundColor: "var(--chat-input-bg)",
          boxShadow: shadow,
          overflow: "hidden",
          transition: "box-shadow 150ms",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* ── Recording state announcer (screen readers only) ── */}
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {isRecording ? "Recording started. Listening." : ""}
        </span>

        {/* ── Attachments slot - chip strip rendered above the textarea ── */}
        {attachmentsSlot}

        {/* ── Main content - textarea + animated placeholder ── */}
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
                  fontSize: szFont,
                  lineHeight: szLineHeight,
                  color: "var(--chat-input-placeholder)",
                }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.span
                    key={isRecording ? "listening" : "default"}
                    initial={{ scale: 0.75, opacity: 0, filter: "blur(4px)" }}
                    animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
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
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            readOnly={isRecording}
            aria-label={textareaLabel}
            aria-multiline="true"
            style={{
              width: "100%",
              maxHeight: "396px",
              background: "transparent",
              border: "none",
              // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
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
            }}
          />
        </div>

        {/* ── Footer bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {/* Left: attach button + chips slot */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {addMenu !== undefined ? (
              <Dropdown.Float
                open={addMenuOpen}
                onOpenChange={setAddMenuOpen}
                placement="top-start"
                trigger={
                  <IconButton
                    variant="ghost"
                    size={szBtn}
                    icon={<PlusSignIcon size={20} />}
                    aria-label="Add attachment"
                    disabled={disabled}
                  />
                }
              >
                {/* Wrap in a click handler so any menu action closes the dropdown immediately */}
                {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- click-only wrapper; keyboard users select items directly */}
                <div onClick={() => setAddMenuOpen(false)}>
                  {addMenu}
                </div>
              </Dropdown.Float>
            ) : (
              <IconButton
                variant="ghost"
                size={szBtn}
                icon={<PlusSignIcon size={20} />}
                aria-label="Add attachment"
                onClick={onAdd}
                disabled={disabled}
              />
            )}
            {chips && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                {chips}
              </div>
            )}
          </div>

          {/* Right: model selector + action button */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {modelMenu !== undefined ? (
              <Dropdown.Float
                open={modelMenuOpen}
                onOpenChange={setModelMenuOpen}
                placement="top-end"
                trigger={
                  <Button
                    variant="ghost"
                    size={szBtn}
                    rightIcon={<ArrowDownOneIcon size={16} />}
                    disabled={disabled}
                  >
                    {modelName}
                  </Button>
                }
              >
                {modelMenu}
              </Dropdown.Float>
            ) : (
              <Button
                variant="ghost"
                size={szBtn}
                rightIcon={<ArrowDownOneIcon size={16} />}
                onClick={onModelClick}
                disabled={disabled}
              >
                {modelName}
              </Button>
            )}

            <span
              onMouseEnter={() => setIsMicHovered(true)}
              onMouseLeave={() => setIsMicHovered(false)}
              style={{ display: "inline-flex" }}
            >
              <IconButton
                variant="default"
                size="md"
                aria-label={
                  isStreaming
                    ? "Stop generation"
                    : isRecording
                      ? "Stop recording"
                      : value
                        ? "Send message"
                        : "Start voice input"
                }
                icon={
                  <AnimatePresence mode="popLayout" initial={false}>
                    {(() => {
                      const isWave = iconKey === "wave";
                      // Wave state: no filter on enter - any filter creates a GPU compositing
                      // layer that kills SVG path updates inside AudioWaveDisplay.
                      return (
                        <m.span
                          key={iconKey}
                          initial={
                            isWave
                              ? { scale: 0.5, opacity: 0 }
                              : { scale: 0.5, opacity: 0, filter: "blur(4px)" }
                          }
                          animate={
                            isWave
                              ? { scale: 1, opacity: 1 }
                              : { scale: 1, opacity: 1, filter: "blur(0px)" }
                          }
                          exit={{ scale: 0.5, opacity: 0, filter: "blur(4px)" }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isStreaming ? (
                            <StopCircleIcon size={20} />
                          ) : isRecording ? (
                            isMicHovered ? (
                              <StopCircleIcon size={20} />
                            ) : (
                              <AudioWaveDisplay analyser={analyser} size={20} />
                            )
                          ) : value ? (
                            <ArrowUpTwoIcon
                              size={20}
                              animated
                              triggered={isMicHovered}
                            />
                          ) : (
                            <MicTwoIcon size={20} />
                          )}
                        </m.span>
                      );
                    })()}
                  </AnimatePresence>
                }
                onClick={handleActionClick}
                disabled={isActionDisabled}
              />
            </span>
          </div>
        </div>
      </div>
    );
}

ChatInput.displayName = "ChatInput";

export default ChatInput;
