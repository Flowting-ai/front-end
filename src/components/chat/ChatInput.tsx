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
import { toast } from "sonner";
import { AudioWaveDisplay } from "@/components/shared/AudioWaveDisplay";
import { trackFeature } from "@/lib/analytics/events";

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
   * Pin chips (@-mention pins and pin-folder selections) rendered in their
   * own row above the regular chips row, so they stay visually separate from
   * feature/setting badges.
   */
  pinChips?: React.ReactNode;
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
  /**
   * When true, the model selector button is shown but non-interactive
   * (greyed out, pointer-events disabled). Use when a persona's model
   * is fixed and should not be changed.
   */
  disabledModelSelector?: boolean;
  /**
   * When true, the model selector button is hidden entirely from the footer.
   * Use in persona chat where the model is fully managed by the persona.
   */
  hideModelSelector?: boolean;
  /**
   * When true, the leading + add button is hidden entirely.
   * Use in test-chat panels where file/menu attachment is not needed.
   */
  hideAddButton?: boolean;
  /**
   * Called when the user pastes image files from the clipboard (Ctrl+V / Ctrl+Shift+V).
   * Receives the array of pasted File objects (always images). Wire this up to your
   * attachment state so screenshots land directly in the attachments strip.
   * Text paste is handled natively by the textarea and does not trigger this callback.
   */
  onFilePaste?: (files: File[]) => void;
  /**
   * When true, the send button is enabled and shows the send icon even when
   * the text input is empty. Set this when attachments are present so users
   * can send files without typing a message.
   */
  hasAttachments?: boolean;
  /**
   * Fraction of the model's context window currently used (0–1).
   * A progress ring is shown around the send button for all values.
   * Green at 0–60%, amber at 60–85%, red at 85%+.
   */
  contextUsedPct?: number;
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
    pinChips,
    attachmentsSlot,
    isStreaming = false,
    disabled = false,
    compact = false,
    onMentionChange,
    isPinDropdownOpen = false,
    onPinNavigate,
    disabledModelSelector = false,
    hideModelSelector = false,
    hideAddButton = false,
    onFilePaste,
    hasAttachments = false,
    contextUsedPct,
    className,
    onMouseEnter: externalMouseEnter,
    onMouseLeave: externalMouseLeave,
    ref,
    ...props
  }: ChatInputProps & { ref?: React.Ref<HTMLDivElement> },
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
    const [mounted,       setMounted]       = useState(false);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRecordingTextRef = useRef<string>("");
    const chipsScrollRef = useRef<HTMLDivElement>(null);
    const [chipsScroll, setChipsScroll] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
    const [isThumbDragging, setIsThumbDragging] = useState(false);
    const isDraggingRef        = useRef(false);
    const dragStartXRef        = useRef(0);
    const dragStartScrollLeft  = useRef(0);

    // Stable ref for onChange to avoid stale closure in transcript effect
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => { setMounted(true); }, []);

    // Track chips scroll position + overflow so the indicator stays in sync.
    useEffect(() => {
      const el = chipsScrollRef.current;
      if (!el) return;
      const measure = () => setChipsScroll({
        scrollLeft: el.scrollLeft,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
      measure();
      el.addEventListener("scroll", measure, { passive: true });
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => {
        el.removeEventListener("scroll", measure);
        ro.disconnect();
      };
    }, [chips]);

    // Global mouse handlers for thumb drag — attached once, use only refs.
    useEffect(() => {
      const onMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current || !chipsScrollRef.current) return;
        const el = chipsScrollRef.current;
        const thumbPx     = (el.clientWidth / el.scrollWidth) * el.clientWidth;
        const maxThumbMove = el.clientWidth - thumbPx;
        if (maxThumbMove <= 0) return;
        const maxScroll = el.scrollWidth - el.clientWidth;
        const dx = e.clientX - dragStartXRef.current;
        el.scrollLeft = Math.max(0, Math.min(
          dragStartScrollLeft.current + (dx / maxThumbMove) * maxScroll,
          maxScroll,
        ));
      };
      const onMouseUp = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsThumbDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup",   onMouseUp);
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup",   onMouseUp);
      };
    }, []);

    const handleThumbMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current        = true;
      dragStartXRef.current        = e.clientX;
      dragStartScrollLeft.current  = chipsScrollRef.current?.scrollLeft ?? 0;
      setIsThumbDragging(true);
      document.body.style.cursor     = "grabbing";
      document.body.style.userSelect = "none";
    };

    const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      const el = chipsScrollRef.current;
      if (!el) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      el.scrollLeft = Math.max(0, Math.min(ratio * (el.scrollWidth - el.clientWidth), el.scrollWidth - el.clientWidth));
    };

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
      trackFeature("voice_input");
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
      if (value || hasAttachments) { handleSend(); return; }
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
      if ((!value && !hasAttachments) || disabled) return;
      const text = value;
      if (!isControlled) setInternalValue("");
      onChange?.("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      onSend?.(text);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!onFilePaste) return;
      const items = Array.from(e.clipboardData.items);
      const files = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length > 0) {
        // Prevent the browser inserting a broken text/html representation of the image
        e.preventDefault();
        onFilePaste(files);
      }
      // Text paste: no preventDefault — let the textarea handle it natively
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

      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && value && !disabled && !isRecording) {
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
        : value || hasAttachments
          ? "send"
          : "mic";

    // Button is disabled only when the disabled prop is set AND there's no
    // in-progress action to cancel, AND browser doesn't support speech with
    // no text to send.
    const isActionDisabled =
      (disabled && !isStreaming && !isRecording) ||
      (!value && !hasAttachments && !isRecording && !isStreaming && !(mounted && browserSupportsSpeechRecognition));

    const isChipsOverflowing = chipsScroll.scrollWidth > chipsScroll.clientWidth;
    const thumbWidthPct = chipsScroll.clientWidth > 0
      ? (chipsScroll.clientWidth / chipsScroll.scrollWidth) * 100
      : 100;
    const maxScrollLeft = chipsScroll.scrollWidth - chipsScroll.clientWidth;
    const thumbOffsetPct = maxScrollLeft > 0
      ? (chipsScroll.scrollLeft / maxScrollLeft) * (100 - thumbWidthPct)
      : 0;

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
          transition: "box-shadow 150ms",
          cursor: disabled ? "not-allowed" : undefined,
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
                    animate={{ scale: 1, opacity: 1, filter: "none" }}
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
            onPaste={handlePaste}
            disabled={disabled}
            readOnly={isRecording}
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
              fontSize: szFont,
              lineHeight: szLineHeight,
              color: "var(--chat-input-text)",
              caretColor: "var(--focus-ring)",
              cursor: disabled ? "not-allowed" : undefined,
            }}
          />
        </div>

        {/* ── Footer bar ── */}
        <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "6px" }}>

          {/* Pin items row — @-mention pins and pin-folder chips, separate from feature badges */}
          {pinChips && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", paddingLeft: "3px", paddingRight: "3px" }}>
              {pinChips}
            </div>
          )}

          {/* Main action row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              gap: "8px",
            }}
          >
            {/* Left: attach button + chips column */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: 1, minWidth: 0 }}>
              {!hideAddButton && <div style={{ flexShrink: 0 }}>
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
              </div>}
              {chips && (
                <div style={{ display: "flex", flexDirection: "column", flexShrink: 1, minWidth: 0, gap: "3px" }}>
                  <div
                    ref={chipsScrollRef}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      overflowX: "auto",
                      scrollbarWidth: "none",
                      flexShrink: 1,
                      minWidth: 0,
                      paddingTop: "3px",
                      paddingBottom: "3px",
                      paddingLeft: "3px",
                      paddingRight: "3px",
                    }}
                  >
                    {chips}
                  </div>
                  {isChipsOverflowing && (
                    // Padded hit zone so the 2 px visual track is easy to grab
                    <div
                      style={{
                        paddingTop: "4px",
                        paddingBottom: "4px",
                        marginLeft: "3px",
                        marginRight: "3px",
                        userSelect: "none",
                      }}
                    >
                      <div
                        style={{
                          height: 2,
                          borderRadius: 999,
                          backgroundColor: "rgba(59,54,50,0.06)",
                          position: "relative",
                          cursor: isThumbDragging ? "grabbing" : "pointer",
                        }}
                        onMouseDown={handleTrackMouseDown}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            height: "100%",
                            borderRadius: 999,
                            backgroundColor: "var(--neutral-800-30)",
                            width: `${thumbWidthPct}%`,
                            left: `${thumbOffsetPct}%`,
                            transition: isThumbDragging ? "none" : "left 60ms",
                            cursor: isThumbDragging ? "grabbing" : "grab",
                          }}
                          onMouseDown={handleThumbMouseDown}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: model selector + action button — never shrinks */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
            {hideModelSelector ? null : disabledModelSelector ? (
              <span
                style={{ display: "inline-flex", cursor: "pointer" }}
                onClick={() =>
                  toast.info("Model locked to agent", {
                    description:
                      "This chat uses the agent's model. Remove the agent chip to unlock model selection.",
                  })
                }
              >
                <Button
                  variant="ghost"
                  size={szBtn}
                  rightIcon={<ArrowDownOneIcon size={16} />}
                  style={{ opacity: 0.45, pointerEvents: "none" }}
                >
                  {modelName}
                </Button>
              </span>
            ) : modelMenu !== undefined ? (
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
              style={{ display: "inline-flex", position: "relative" }}
            >
              {/* Context window exhaustion ring — visible at all usage levels (0–100%) */}
              {contextUsedPct !== undefined && (() => {
                const CIRC = 125.66; // 2π × r20
                const pct  = Math.min(1, Math.max(0, contextUsedPct))
                const color = pct >= 0.85
                  ? "#ef4444"
                  : pct >= 0.60
                    ? "#f59e0b"
                    : "#22c55e";
                return (
                  <svg
                    aria-hidden
                    width={44}
                    height={44}
                    viewBox="0 0 44 44"
                    style={{
                      position:      "absolute",
                      top:           -4,
                      left:          -4,
                      pointerEvents: "none",
                      zIndex:        1,
                      overflow:      "visible",
                    }}
                  >
                    <circle cx={22} cy={22} r={20} fill="none"
                      stroke={color} strokeWidth={1.5} strokeOpacity={0.15} />
                    <circle cx={22} cy={22} r={20} fill="none"
                      stroke={color} strokeWidth={1.5} strokeLinecap="round"
                      strokeDasharray={CIRC}
                      strokeDashoffset={CIRC * (1 - pct)}
                      transform="rotate(-90 22 22)"
                    />
                  </svg>
                );
              })()}
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
      </div>
    );
}

ChatInput.displayName = "ChatInput";

export default ChatInput;
