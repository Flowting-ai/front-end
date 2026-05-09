"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LlmIcon } from "@strange-huge/icons/llm";
import { MarkdownRenderer } from "@/lib/markdown-utils";
import { ActivitiesSection } from "./ActivityRow";
import { StreamingCursor } from "./StreamingCursor";
import { springs } from "@/lib/springs";
import { getModelLlmId } from "@/lib/model-icons";
import type { ActivityItem, ModelSelectedMeta } from "@/hooks/use-chat-state";

// ── CyclingLabel — cycles through words with spring + blur swap ───────────────

const THINKING_WORDS = ["Thinking…", "Analysing…", "Processing…", "Considering…"];

function CyclingLabel({ words, textStyle }: { words: string[]; textStyle?: React.CSSProperties }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    if (words.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % words.length), 2800);
    return () => clearInterval(t);
  }, [words.join("|")]); // eslint-disable-line
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={idx}
        initial={{ scale: 0.82, opacity: 0, filter: "blur(5px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        exit={{ scale: 0.82, opacity: 0, filter: "blur(5px)" }}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
        style={{ display: "block", transformOrigin: "left center", ...textStyle }}
      >
        {words[idx]}
      </motion.span>
    </AnimatePresence>
  );
}

// ── SouvenirMark — inline SVG logo ────────────────────────────────────────────

function SouvenirMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 309 309" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <path d="M168.941 131.507C176.475 126.584 186.864 130.006 182.541 135.987L178.915 141.005C175.276 146.04 176.371 151.185 181.686 154.027L187.211 156.981C193.494 160.341 185.62 168.224 176.847 167.357L167.723 166.455C161.03 165.793 153.275 167.689 147.507 171.398L138.855 176.961C131.269 181.838 120.978 178.352 125.361 172.389L128.86 167.629C132.581 162.567 131.511 157.372 126.159 154.511L120.708 151.596C114.425 148.237 122.299 140.353 131.072 141.22L140.064 142.109C146.827 142.778 154.668 140.835 160.447 137.058L168.941 131.507Z" fill="#26211E"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M89.1853 14.4849C126.319 -2.83751 168.814 -4.69913 207.321 9.30974C245.828 23.3187 277.193 52.0513 294.515 89.1854C311.838 126.32 313.699 168.814 299.69 207.321C285.681 245.828 256.949 277.193 219.815 294.515C182.681 311.838 140.186 313.699 101.679 299.69C73.1532 289.312 48.5472 270.854 30.6655 246.887C32.8535 248.323 35.1944 249.668 37.6896 250.912C48.7992 256.448 62.3819 259.962 77.7324 261.307C87.4284 268.277 98.1106 273.953 109.531 278.108C142.313 290.034 178.491 288.45 210.106 273.702C241.72 258.954 266.181 232.252 278.108 199.469C283.403 184.914 286.034 169.69 286.033 154.494C281.08 162.294 274.874 170.072 267.531 177.66C255.47 190.12 240.579 201.823 223.707 212.1C206.835 222.377 188.313 231.027 169.198 237.556C150.084 244.084 130.751 248.363 112.304 250.148C93.8564 251.934 76.6559 251.192 61.6846 247.963C46.7121 244.734 34.2631 239.082 25.0475 231.331C19.5376 226.697 15.5258 221.163 12.527 215.257L12.5597 215.241C11.7017 213.532 10.948 211.784 10.2989 210.004L10.312 209.999C-3.04125 175.311 -3.47945 136.833 9.30965 101.679C23.3187 63.1723 52.0512 31.8074 89.1853 14.4849ZM199.469 30.8923C166.686 18.9659 130.508 20.5505 98.8942 35.298C67.28 50.0456 42.8189 76.7482 30.8923 109.531C25.6071 124.058 22.1938 137.722 21.3143 151.186C26.2178 143.542 32.3225 135.923 39.5193 128.487C51.5798 116.026 66.4713 104.323 83.343 94.0462C100.215 83.7693 118.737 75.1199 137.851 68.5917C156.966 62.0634 176.299 57.7839 194.746 55.9982C205.973 54.9114 216.738 54.7608 226.819 55.5374C229.623 57.945 232.33 60.4734 234.93 63.1176C241.14 69.434 246.681 76.3457 251.478 83.7395C248.196 82.5523 244.55 81.5026 240.524 80.6342C228.296 77.9972 213.526 77.2539 196.959 78.8576C180.437 80.4569 162.851 84.322 145.274 90.3252C127.705 96.3257 110.704 104.271 95.2902 113.66C79.8588 123.06 66.5518 133.58 56.0217 144.459C45.4478 155.384 38.2627 166.06 34.1912 175.648C30.1387 185.192 29.4852 192.851 30.5509 198.596C30.9221 200.596 31.533 202.542 32.4202 204.428C35.0448 209.882 40.173 215.217 48.7685 219.5C59.0176 224.608 73.5755 227.954 91.9162 228.101C110.132 228.248 130.642 225.22 151.71 218.994C172.749 212.777 193.347 203.665 211.75 192.457L211.765 192.482C227.194 183.084 240.499 172.565 251.028 161.687C261.602 150.762 268.787 140.087 272.859 130.499C276.911 120.955 277.565 113.296 276.499 107.551C276.218 106.036 275.977 104.334 275.456 102.822C274.894 101.506 274.309 100.196 273.702 98.8943C258.954 67.2801 232.252 42.8189 199.469 30.8923Z" fill="#26211E"/>
    </svg>
  );
}

// ── AnimatedLogo — Souvenir mark → model icon swing-in with glow burst ────────

function AnimatedLogo({
  modelMeta,
  modelName,
  isThinkingInProgress,
  justSelected,
}: {
  modelMeta?: ModelSelectedMeta;
  modelName?: string;
  isThinkingInProgress?: boolean;
  justSelected: boolean;
}) {
  const llmId = getModelLlmId(modelMeta?.company, modelMeta?.modelName || modelName);
  const hasModel = !!(modelMeta?.modelName || modelName);
  const showModel = hasModel && !isThinkingInProgress;

  const iconWrap: React.CSSProperties = {
    width: 16, height: 16, borderRadius: 4, overflow: "hidden",
    flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 0,
  };

  return (
    <div style={{ position: "relative", width: 16, height: 16, flexShrink: 0 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!showModel ? (
          <motion.div key="souvenir"
            initial={{ opacity: 0, scale: 0.5, rotate: -8, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.25, rotate: -20, y: -5, filter: "blur(10px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SouvenirMark size={16} />
          </motion.div>
        ) : (
          <motion.div key={`model-${llmId}`}
            initial={{ opacity: 0, scale: 0.15, rotate: 14, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 220, damping: 11, mass: 0.9 }}
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {llmId
              ? <span style={iconWrap}><LlmIcon id={llmId} variant="avatar" size={16} /></span>
              : <SouvenirMark size={16} />}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Glow burst rings on model selection */}
      {justSelected && [0, 100, 230].map((ms) => (
        <motion.div key={ms}
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: 4.5, opacity: 0 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: ms / 1000 }}
          style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(104,61,27,0.35)", pointerEvents: "none" }}
        />
      ))}
    </div>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function Chevron({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      animate={{ rotate: isOpen ? 180 : 0 }}
      transition={springs.fast}
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d="M3 5.5 L7 9.5 L11 5.5"
        stroke="var(--neutral-400, #9C938B)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

const chevronBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "2px",
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 4,
  flexShrink: 0,
  lineHeight: 0,
};

const COLLAPSE_TRANSITION = {
  height: springs.moderate,
  opacity: { duration: 0.2, ease: "easeInOut" as const },
};

// ── ModelNameLabel — plain name text only (logo handled by AnimatedLogo) ──────

function ModelNameLabel({
  modelMeta,
  modelName,
}: {
  modelMeta?: ModelSelectedMeta;
  modelName?: string;
}) {
  const complexity = modelMeta?.complexity;
  const isMuse = complexity === "basic" || complexity === "advanced";
  if (isMuse) return <span>Souvenir Muse ({complexity === "advanced" ? "Advanced" : "Basic"})</span>;
  return <span>{modelMeta?.modelName || modelName || "souvenir"}</span>;
}

// ── Left bar + thinking content ────────────────────────────────────────────────

function ThinkingContent({
  thinkingContent,
  hasActivities,
  activities,
  isStreaming,
}: {
  thinkingContent: string;
  hasActivities: boolean;
  activities?: ActivityItem[];
  isStreaming: boolean;
}) {
  return (
    // paddingLeft creates the gutter for the absolutely-positioned bar.
    // The bar's bottom: 0 aligns with this div's bottom, which is flush
    // with visible text thanks to .kaya-thinking-md stripping p margins.
    <div style={{ position: "relative", paddingLeft: 12 }}>
      <div
        className={isStreaming ? "kaya-reasoning-active" : undefined}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          borderRadius: 2,
          backgroundColor: isStreaming ? undefined : "var(--neutral-200, #EDE1D7)",
          transition: "background-color 0.4s",
        }}
      />

      {hasActivities && <ActivitiesSection activities={activities!} />}

      {thinkingContent && (
        <div
          className="kaya-thinking-md"
          style={{
            fontSize: 14,
            color: "var(--neutral-500, #6E645D)",
            fontFamily: "var(--font-body)",
            lineHeight: "22px",
            marginTop: hasActivities ? 8 : 0,
          }}
        >
          <MarkdownRenderer content={thinkingContent} />
          <StreamingCursor isVisible={isStreaming} />
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ReasoningBlockProps {
  thinkingContent: string;
  isNewMessage: boolean;
  isThinkingInProgress?: boolean;
  modelName?: string;
  modelMeta?: ModelSelectedMeta;
  activities?: ActivityItem[];
}

export function ReasoningBlock({
  thinkingContent,
  isThinkingInProgress,
  modelName,
  modelMeta,
  activities,
}: ReasoningBlockProps) {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerOpen, setInnerOpen] = useState(true);
  const [thinkingDurationS, setThinkingDurationS] = useState<number | null>(null);
  const [justSelected, setJustSelected] = useState(false);
  const thinkingStartRef = useRef<number | null>(null);
  const prevModelRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isThinkingInProgress) {
      if (!thinkingStartRef.current) thinkingStartRef.current = Date.now();
    } else if (thinkingStartRef.current) {
      const elapsed = Math.round((Date.now() - thinkingStartRef.current) / 1000);
      setThinkingDurationS(elapsed);
      thinkingStartRef.current = null;
    }
  }, [isThinkingInProgress]);

  // Trigger glow burst when model name first arrives
  const currentModel = modelMeta?.modelName || modelName;
  useEffect(() => {
    if (currentModel && currentModel !== prevModelRef.current) {
      prevModelRef.current = currentModel;
      setJustSelected(true);
      const t = setTimeout(() => setJustSelected(false), 1200);
      return () => clearTimeout(t);
    }
  }, [currentModel]);

  if (!thinkingContent && !isThinkingInProgress) return null;

  const hasActivities = Boolean(activities?.length);
  const hasContent = Boolean(thinkingContent) || hasActivities;

  const outerVisible = isThinkingInProgress || outerOpen;
  const innerVisible = isThinkingInProgress || innerOpen;

  const shimmerStyle: React.CSSProperties = {
    backgroundImage: "linear-gradient(90deg, #B6ACA4 0%, #3B3632 45%, #3B3632 55%, #B6ACA4 100%)",
    backgroundSize: "200% 100%",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    animation: "svLabelShimmer 2.4s ease-in-out infinite",
  };

  return (
    <div style={{ margin: "4px 0 10px" }}>

      {/* ── Outer header ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 20, userSelect: "none" }}>
        {/* Animated logo — Souvenir mark while thinking, model icon after model_selected */}
        <AnimatedLogo
          modelMeta={modelMeta}
          modelName={modelName}
          isThinkingInProgress={isThinkingInProgress}
          justSelected={justSelected}
        />

        <AnimatePresence mode="wait" initial={false}>
          {isThinkingInProgress ? (
            <motion.div
              key="streaming"
              initial={{ opacity: 0, filter: "blur(5px)", scale: 0.82 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(5px)", scale: 0.82 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
              style={{ display: "flex", alignItems: "center", fontSize: 14, fontWeight: 500, lineHeight: "18px" }}
            >
              <CyclingLabel words={THINKING_WORDS} textStyle={shimmerStyle} />
            </motion.div>
          ) : (
            <motion.span
              key="done"
              initial={{ opacity: 0, filter: "blur(5px)", scale: 0.82, y: 5 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1, y: 0 }}
              exit={{ opacity: 0, filter: "blur(5px)", scale: 0.82, y: -5 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 14, fontWeight: 500, lineHeight: "18px", color: "var(--neutral-600, #524B47)",
              }}
            >
              <ModelNameLabel modelMeta={modelMeta} modelName={modelName} />
              {thinkingDurationS !== null && (
                <span style={{ color: "var(--neutral-400, #9A9089)", fontWeight: 400 }}>
                  · {thinkingDurationS}s
                </span>
              )}
              {hasContent && (
                <button
                  type="button"
                  aria-label={outerOpen ? "Collapse" : "Expand"}
                  style={chevronBtnStyle}
                  onClick={() => setOuterOpen((o) => !o)}
                >
                  <Chevron isOpen={outerOpen} />
                </button>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Outer collapse (always mounted — prevents jump on streaming→done) ── */}
      <motion.div
        initial={false}
        animate={{ height: outerVisible ? "auto" : 0, opacity: outerVisible ? 1 : 0 }}
        transition={COLLAPSE_TRANSITION}
        style={{ overflow: "hidden" }}
      >
        <div style={{ marginTop: 8 }}>

          {/* Inner header: "Thinking [chevron]" — shown only after streaming */}
          <AnimatePresence initial={false}>
            {!isThinkingInProgress && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ marginBottom: 6 }}
              >
                {/* Chevron sits inline, immediately after "Thinking" */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: hasContent ? "pointer" : "default",
                    userSelect: "none",
                  }}
                  onClick={hasContent ? () => setInnerOpen((o) => !o) : undefined}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--neutral-500, #6E645D)",
                    }}
                  >
                    Thinking
                  </span>
                  {hasContent && (
                    <button
                      type="button"
                      aria-label={innerOpen ? "Collapse reasoning" : "Expand reasoning"}
                      style={chevronBtnStyle}
                    >
                      <Chevron isOpen={innerOpen} />
                    </button>
                  )}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inner collapse (always mounted) */}
          <motion.div
            initial={false}
            animate={{ height: innerVisible ? "auto" : 0, opacity: innerVisible ? 1 : 0 }}
            transition={COLLAPSE_TRANSITION}
            style={{ overflow: "hidden" }}
          >
            <ThinkingContent
              thinkingContent={thinkingContent}
              hasActivities={hasActivities}
              activities={activities}
              isStreaming={!!isThinkingInProgress}
            />
          </motion.div>

        </div>
      </motion.div>

    </div>
  );
}

/** Legacy export kept for any external callers */
export const renderReasoningContent = (text: string): React.ReactNode => {
  if (!text) return null;
  return <MarkdownRenderer content={text} />;
};
