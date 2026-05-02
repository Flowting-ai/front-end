"use client";

import { useState, useEffect, useRef, type JSX } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sanitizeURL } from "@/lib/security";
import { ActivitiesSection } from "./ActivityRow";

// ── Reasoning text parser ─────────────────────────────────────────────────────

interface ReasoningStep {
  verb: string;
  detail: string;
  summary: string;
}

interface ParsedReasoning {
  steps: ReasoningStep[];
  thinkingSummary: string;
}

/**
 * Parses raw thinking content into structured reasoning steps + summary.
 * Looks for bullet points with past-tense verbs as steps and paragraph blocks as summaries.
 */
function parseReasoningContent(text: string): ParsedReasoning {
  if (!text) return { steps: [], thinkingSummary: "" };

  const lines = text.split("\n");
  const steps: ReasoningStep[] = [];
  const bodyLines: string[] = [];
  let currentStep: Partial<ReasoningStep> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentStep) {
        steps.push({
          verb: currentStep.verb ?? "Considered",
          detail: currentStep.detail ?? "",
          summary: currentStep.summary ?? "",
        });
        currentStep = null;
      }
      continue;
    }

    // Bullet with bold verb: "- **Considered** the product stage..."
    // Bullet with verb: "- Considered the product stage..."
    const bulletMatch = trimmed.match(
      /^[-*+•]\s+(?:\*\*([A-Za-z]+(?:ed|ised|ized|ght|wn|ing)?)\*\*|([A-Z][a-z]+(?:ed|ised|ized|ght|wn|ing)?))[\s:]+(.*)$/,
    );

    if (bulletMatch) {
      if (currentStep) {
        steps.push({
          verb: currentStep.verb ?? "Considered",
          detail: currentStep.detail ?? "",
          summary: currentStep.summary ?? "",
        });
      }
      const verb = bulletMatch[1] || bulletMatch[2] || "Considered";
      const detail = bulletMatch[3] || "";
      currentStep = { verb, detail, summary: "" };
      continue;
    }

    // Simple bullet without verb pattern
    const simpleBullet = trimmed.match(/^[-*+•]\s+(.*)$/);
    if (simpleBullet && !currentStep) {
      steps.push({ verb: "Considered", detail: simpleBullet[1], summary: "" });
      continue;
    }

    // If building a step's summary
    if (currentStep) {
      currentStep.summary = currentStep.summary
        ? currentStep.summary + " " + trimmed
        : trimmed;
      continue;
    }

    // Otherwise it's body/thinking summary content
    bodyLines.push(trimmed);
  }

  // Flush final step
  if (currentStep) {
    steps.push({
      verb: currentStep.verb ?? "Considered",
      detail: currentStep.detail ?? "",
      summary: currentStep.summary ?? "",
    });
  }

  // If no structured steps found, use the full text as thinking summary
  if (steps.length === 0 && bodyLines.length === 0) {
    return { steps: [], thinkingSummary: text.trim() };
  }

  return {
    steps,
    thinkingSummary: bodyLines.join("\n"),
  };
}

// ── Inline markdown renderer ──────────────────────────────────────────────────

function renderInlineMd(text: string): (string | JSX.Element)[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return (
          <strong key={i} style={{ fontWeight: 600, color: "var(--neutral-900)" }}>
            {part.slice(2, -2)}
          </strong>
        );
      if (part.startsWith("`") && part.endsWith("`"))
        return (
          <code
            key={i}
            style={{
              fontFamily: "var(--font-code)",
              fontSize: 13,
              background: "var(--neutral-800-10, rgba(59,54,50,0.1))",
              color: "var(--neutral-900)",
              borderRadius: 4,
              padding: "1px 5px",
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (linkMatch) {
        const safeUrl = sanitizeURL(linkMatch[2]);
        if (safeUrl) {
          return (
            <a
              key={i}
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--brown-500, #683D1B)", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              {linkMatch[1]}
            </a>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
}

/** Legacy export for backward compat */
export const renderReasoningContent = (text: string): JSX.Element[] => {
  if (!text) return [];
  return text
    .split("\n")
    .filter(Boolean)
    .map((line, i) => (
      <div key={`rc-${i}`} style={{ lineHeight: 1.6 }}>
        {renderInlineMd(line.trim())}
      </div>
    ));
};

// ── Reasoning step row ────────────────────────────────────────────────────────

function ReasoningStepRow({
  step,
  isExpanded,
  onToggle,
  isActive,
  isLast,
}: {
  step: ReasoningStep;
  isExpanded: boolean;
  onToggle: () => void;
  isActive: boolean;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        paddingBottom: isLast ? 0 : 12,
      }}
    >
      {/* Left column — dot + vertical connector */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 20,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 20,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: isActive
                ? "var(--neutral-400, #9C938B)"
                : "var(--neutral-300, #C0B5AD)",
            }}
          />
        </span>
        <AnimatePresence>
          {!isLast && (
            <motion.div
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.28, ease: "easeOut", delay: 0.1 }}
              style={{
                width: 1,
                flex: 1,
                background: "var(--neutral-200, #EDE1D7)",
                transformOrigin: "top",
                minHeight: 12,
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Right column — text + expandable summary */}
      <div style={{ flex: 1, paddingLeft: 10, display: "flex", flexDirection: "column" }}>
        <button
          onClick={onToggle}
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "5px 0",
            textAlign: "left",
            fontFamily: "var(--font-body)",
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: "var(--neutral-600, #524B47)",
              flex: 1,
              lineHeight: "20px",
            }}
          >
            <strong
              className={isActive ? "kaya-label-shimmer" : undefined}
              style={{ fontWeight: 600, color: isActive ? undefined : "var(--neutral-900, #26211E)" }}
            >
              {step.verb}
              {isActive ? "…" : ""}
            </strong>
            {!isActive && step.detail && <>{" "}{step.detail}</>}
          </span>
          {!isActive && step.summary && (
            <motion.span
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{ display: "flex", alignItems: "center", lineHeight: 0, flexShrink: 0 }}
            >
              <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                <path
                  d="M3.5 2 L7 5 L3.5 8"
                  stroke="var(--neutral-300, #C0B5AD)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.span>
          )}
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && !isActive && step.summary && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: "hidden" }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: "var(--neutral-600, #524B47)",
                  lineHeight: "22px",
                  borderLeft: "2px solid var(--neutral-200, #EDE1D7)",
                  paddingLeft: 10,
                  margin: "8px 0 6px 0",
                  fontFamily: "var(--font-body)",
                }}
              >
                {renderInlineMd(step.summary)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ReasoningBlockProps {
  thinkingContent: string;
  isNewMessage: boolean;
  isThinkingInProgress?: boolean;
  modelName?: string;
  activities?: import("@/hooks/use-chat-state").ActivityItem[];
}

export function ReasoningBlock({
  thinkingContent,
  isNewMessage,
  isThinkingInProgress,
  modelName,
  activities,
}: ReasoningBlockProps) {
  const [expandedStepIdxs, setExpandedStepIdxs] = useState<Set<number>>(new Set());
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [thinkingDurationS, setThinkingDurationS] = useState<number | null>(null);
  const thinkingStartRef = useRef<number | null>(null);

  // Track thinking duration
  useEffect(() => {
    if (isThinkingInProgress) {
      // Thinking just started
      if (!thinkingStartRef.current) {
        thinkingStartRef.current = Date.now();
      }
    } else if (thinkingStartRef.current) {
      // Thinking just finished — compute duration
      const elapsed = Math.round((Date.now() - thinkingStartRef.current) / 1000);
      setThinkingDurationS(elapsed);
      thinkingStartRef.current = null;
    }
  }, [isThinkingInProgress]);

  if (!thinkingContent) return null;

  const parsed = parseReasoningContent(thinkingContent);
  const hasSteps = parsed.steps.length > 0;
  const hasActivities = activities && activities.length > 0;

  // Derive display model name
  const modelDisplayName = modelName || "Souvenir";
  const modelFull = modelDisplayName.toLowerCase();

  const toggleStep = (i: number) => {
    setExpandedStepIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div style={{ margin: "4px 0 8px" }}>
      {/* ── Model Row — flat, no border/box ── */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 20 }}
      >
        {/* Model name label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            minWidth: 0,
            flex: 1,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {isThinkingInProgress ? (
              <motion.span
                key="thinking-label"
                initial={{ opacity: 0, filter: "blur(5px)", scale: 0.82 }}
                animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                exit={{ opacity: 0, filter: "blur(5px)", scale: 0.82 }}
                transition={{ type: "spring", stiffness: 520, damping: 32 }}
                className="kaya-label-shimmer"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: "18px",
                  display: "block",
                  transformOrigin: "left center",
                }}
              >
                Thinking…
              </motion.span>
            ) : (
              <motion.span
                key="model-label"
                initial={{ opacity: 0, filter: "blur(5px)", scale: 0.82, y: 5 }}
                animate={{ opacity: 1, filter: "blur(0px)", scale: 1, y: 0 }}
                exit={{ opacity: 0, filter: "blur(5px)", scale: 0.82, y: -5 }}
                transition={{ type: "spring", stiffness: 520, damping: 32 }}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: "18px",
                  color: "var(--neutral-600, #524B47)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transformOrigin: "left center",
                  flexShrink: 0,
                }}
              >
                {modelFull}
                {thinkingDurationS !== null && (
                  <span style={{ color: "var(--neutral-400, #9A9089)", fontWeight: 400 }}>
                    · Thought for {thinkingDurationS} second{thinkingDurationS !== 1 ? "s" : ""}
                  </span>
                )}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Toggle chevron */}
          {(hasSteps || parsed.thinkingSummary || hasActivities) && !isThinkingInProgress && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 3,
                marginLeft: 4,
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              <motion.svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
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
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Expanded research panel — flat, no border/box ── */}
      <AnimatePresence initial={false}>
        {isOpen && (hasSteps || parsed.thinkingSummary || hasActivities) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 260, damping: 28 },
              opacity: { duration: 0.22, ease: "easeInOut" },
            }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                paddingTop: 12,
                paddingBottom: 4,
              }}
            >
              {/* Reasoning steps — flat rows with dot + vertical connector */}
              {hasSteps &&
                parsed.steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{
                      height: { type: "spring", stiffness: 300, damping: 28 },
                      opacity: { duration: 0.24, delay: 0.08, ease: "easeOut" },
                    }}
                    style={{ overflow: "hidden" }}
                  >
                    <ReasoningStepRow
                      step={step}
                      isExpanded={expandedStepIdxs.has(i)}
                      onToggle={() => toggleStep(i)}
                      isActive={isThinkingInProgress === true && i === parsed.steps.length - 1}
                      isLast={i === parsed.steps.length - 1 && !parsed.thinkingSummary}
                    />
                  </motion.div>
                ))}

              {/* Activities section — web search, etc. */}
              {hasActivities && (
                <>
                  {hasSteps && (
                    <div style={{ height: 1, background: "rgba(59,54,50,0.08)", margin: "8px 0" }} />
                  )}
                  <ActivitiesSection activities={activities!} />
                </>
              )}

              {/* "Thinking ›" — expandable summary paragraph */}
              {parsed.thinkingSummary && !isThinkingInProgress && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  style={{ paddingTop: hasSteps ? 4 : 0 }}
                >
                  <button
                    onClick={() => setThinkingExpanded(!thinkingExpanded)}
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 0",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        color: "var(--neutral-400, #9A9089)",
                        fontWeight: 500,
                      }}
                    >
                      Thinking
                    </span>
                    <motion.span
                      animate={{ rotate: thinkingExpanded ? 90 : 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      style={{ display: "flex", lineHeight: 0 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                        <path
                          d="M3.5 2 L7 5 L3.5 8"
                          stroke="var(--neutral-300, #C0B5AD)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {thinkingExpanded && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          fontSize: 14,
                          color: "var(--neutral-600, #524B47)",
                          lineHeight: "22px",
                          borderLeft: "2px solid var(--neutral-200, #EDE1D7)",
                          paddingLeft: 10,
                          margin: "4px 0 0 0",
                          overflow: "hidden",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {renderInlineMd(parsed.thinkingSummary)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
