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

// ── Model logo + name ──────────────────────────────────────────────────────────

function ModelLabel({
  modelMeta,
  modelName,
}: {
  modelMeta?: ModelSelectedMeta;
  modelName?: string;
}) {
  const complexity = modelMeta?.complexity;
  const isMuse = complexity === "basic" || complexity === "advanced";

  const iconWrap: React.CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: 4,
    overflow: "hidden",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
  };

  if (isMuse) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={iconWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/logo/souvenir-logo.svg"
            width={16}
            height={16}
            alt=""
            style={{ display: "block" }}
          />
        </span>
        Souvenir Muse ({complexity === "advanced" ? "Advanced" : "Basic"})
      </span>
    );
  }

  const llmId = getModelLlmId(modelMeta?.company, modelMeta?.modelName || modelName);
  const displayName = modelMeta?.modelName || modelName || "souvenir";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {llmId && (
        <span style={iconWrap}>
          <LlmIcon id={llmId} variant="avatar" size={16} />
        </span>
      )}
      {displayName}
    </span>
  );
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
  const thinkingStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (isThinkingInProgress) {
      if (!thinkingStartRef.current) {
        thinkingStartRef.current = Date.now();
      }
    } else if (thinkingStartRef.current) {
      const elapsed = Math.round((Date.now() - thinkingStartRef.current) / 1000);
      setThinkingDurationS(elapsed);
      thinkingStartRef.current = null;
    }
  }, [isThinkingInProgress]);

  if (!thinkingContent && !isThinkingInProgress) return null;

  const hasActivities = Boolean(activities?.length);
  const hasContent = Boolean(thinkingContent) || hasActivities;

  const outerVisible = isThinkingInProgress || outerOpen;
  const innerVisible = isThinkingInProgress || innerOpen;

  return (
    <div style={{ margin: "4px 0 10px" }}>

      {/* ── Outer header ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", minHeight: 20, userSelect: "none" }}>
        <AnimatePresence mode="wait" initial={false}>
          {isThinkingInProgress ? (
            <motion.span
              key="streaming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="kaya-label-shimmer"
              style={{ fontSize: 14, fontWeight: 500, lineHeight: "18px" }}
            >
              Thinking…
            </motion.span>
          ) : (
            // Chevron sits inline, immediately after the time text
            <motion.span
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 14,
                fontWeight: 500,
                lineHeight: "18px",
                color: "var(--neutral-600, #524B47)",
              }}
            >
              <ModelLabel modelMeta={modelMeta} modelName={modelName} />
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
