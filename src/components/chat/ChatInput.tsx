"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PlusSignIcon,
  ArrowUpTwoIcon,
  ArrowDownOneIcon,
  MicTwoIcon,
  StopCircleIcon,
} from "@strange-huge/icons";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

// ── Shadow tokens ──────────────────────────────────────────────────────────────

const SHADOW_DEFAULT = "var(--shadow-chat-input)";
const SHADOW_HOVER = "var(--shadow-chat-input-hover)";
const SHADOW_FOCUS = "var(--shadow-chat-input-focus)";

// ── Audio-reactive waveform ────────────────────────────────────────────────────
// Mirrors the AudioWaveOneIcon shape (7 bars, same x positions and default heights)
// but animates bar heights in real time from a live AnalyserNode.

const BAR_X = [3, 6, 9, 12, 15, 18, 21];
const BAR_DEFAULT = [2, 10, 18, 12, 6, 10, 2];
const CENTER_Y = 12;
const LERP = 0.35;

function AudioWaveDisplay({
  analyser,
  color = "currentColor",
  size = 20,
}: {
  analyser: AnalyserNode | null;
  color?: string;
  size?: number;
}) {
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const heightsRef = useRef<number[]>([...BAR_DEFAULT]);
  const rafRef = useRef<number>(0);

  // Direct DOM mutation — no setState, no re-renders.
  // RAF-driven setState inside Framer Motion's composited subtree gets batched/dropped.
  const updatePaths = (heights: number[]) => {
    heights.forEach((h, i) => {
      const el = pathRefs.current[i];
      if (el)
        el.setAttribute(
          "d",
          `M${BAR_X[i]} ${(CENTER_Y - h / 2).toFixed(2)}V${(CENTER_Y + h / 2).toFixed(2)}`,
        );
    });
  };

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (!analyser) {
      const decay = () => {
        const next = heightsRef.current.map(
          (h, i) => h + (BAR_DEFAULT[i] - h) * LERP,
        );
        heightsRef.current = next;
        updatePaths(next);
        if (!next.every((h, i) => Math.abs(h - BAR_DEFAULT[i]) < 0.1))
          rafRef.current = requestAnimationFrame(decay);
      };
      rafRef.current = requestAnimationFrame(decay);
      return () => cancelAnimationFrame(rafRef.current);
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const voiceBins = Math.floor(bufferLength * 0.4);
    const binPerBar = Math.floor(voiceBins / BAR_X.length);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const targets = BAR_X.map((_, i) => {
        const start = 1 + i * binPerBar;
        const end = start + binPerBar;
        let sum = 0;
        for (let j = start; j < end; j++) sum += dataArray[j] ?? 0;
        return 2 + (sum / binPerBar / 255) * 18;
      });
      const next = heightsRef.current.map((h, i) => h + (targets[i] - h) * LERP);
      heightsRef.current = next;
      updatePaths(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  const p = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {BAR_X.map((x, i) => {
        const h = BAR_DEFAULT[i];
        const y1 = CENTER_Y - h / 2;
        const y2 = CENTER_Y + h / 2;
        return (
          <path
            key={x}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            d={`M${x} ${y1.toFixed(2)}V${y2.toFixed(2)}`}
            {...p}
          />
        );
      })}
    </svg>
  );
}

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
  chips?: React.ReactNode;
  isStreaming?: boolean;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

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
    const [isRecording, setIsRecording] = useState(false);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const [isMicHovered, setIsMicHovered] = useState(false);

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
        // Mic permission denied or unavailable — revert all state
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

        {/* ── Main content — textarea + animated placeholder ── */}
        <div style={{ position: "relative" }}>
          {/* Custom animated placeholder — fades out when user starts typing */}
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
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={isRecording ? "listening" : "default"}
                    initial={{ scale: 0.75, opacity: 0, filter: "blur(4px)" }}
                    animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                    exit={{ scale: 0.75, opacity: 0, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    style={{ display: "block", transformOrigin: "left center" }}
                  >
                    {isRecording ? "Listening..." : placeholder}
                  </motion.span>
                </AnimatePresence>
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
              fontSize: "var(--font-size-body-lg)",
              lineHeight: "var(--line-height-body-lg)",
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

          {/* Right: model selector + action button */}
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
                      // Wave state: no filter on enter — any filter creates a GPU compositing
                      // layer that kills SVG path updates inside AudioWaveDisplay.
                      return (
                        <motion.span
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
                        </motion.span>
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
  },
);

ChatInput.displayName = "ChatInput";

export default ChatInput;
