"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, m } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiVisionRecognitionIcon,
  AiBrain01Icon,
  HierarchySquare01Icon,
  Idea01Icon,
  Task01Icon,
  Route01Icon,
  GitMergeIcon,
  Search01Icon,
  AiNetworkIcon,
  Compass01Icon,
  Layers01Icon,
  Globe02Icon,
  Brain01Icon,
  Brain02Icon,
  Brain03Icon,
} from "@hugeicons/core-free-icons";
import { LlmIcon } from "@strange-huge/icons/llm";
import { LineRenderer } from "@/lib/line-renderer";
import { ActivitiesSection } from "./ActivityRow";
import { StreamingCursor } from "./StreamingCursor";
import { springs } from "@/lib/springs";
import { getModelLlmId } from "@/lib/model-icons";
import type { ActivityItem, ModelSelectedMeta } from "@/hooks/use-chat-state";

// ── CyclingLabel - cycles through words with spring + blur swap ───────────────

const THINKING_WORDS = ["Thinking…", "Analysing…", "Processing…", "Considering…"];

function CyclingLabel({ words, textStyle }: { words: string[]; textStyle?: React.CSSProperties }) {
  const [idx, setIdx] = useState(0);
  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    setIdx(0);
    if (words.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % words.length), 2800);
    return () => clearInterval(t);
  }, [words.join("|")]); // eslint-disable-line
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {/* eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- cycling label segments; positionally stable */}
      <m.span key={idx}
        initial={{ scale: 0.82, opacity: 0, filter: "blur(5px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        exit={{ scale: 0.82, opacity: 0, filter: "blur(5px)" }}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
        style={{ display: "block", transformOrigin: "left center", ...textStyle }}
      >
        {words[idx]}
      </m.span>
    </AnimatePresence>
  );
}

// ── SouvenirMark - inline SVG logo ────────────────────────────────────────────

function SouvenirMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 309 309" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <path d="M168.94 131.50C176.47 126.58 186.86 130.00 182.54 135.98L178.91 141.00C175.27 146.04 176.37 151.18 181.68 154.02L187.21 156.98C193.49 160.34 185.62 168.22 176.84 167.35L167.72 166.45C161.03 165.79 153.27 167.68 147.50 171.39L138.85 176.96C131.26 181.83 120.97 178.35 125.36 172.38L128.86 167.62C132.58 162.56 131.51 157.37 126.15 154.51L120.70 151.59C114.42 148.23 122.29 140.35 131.07 141.22L140.06 142.10C146.82 142.77 154.66 140.83 160.44 137.05L168.94 131.50Z" fill="#26211E"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M89.18 14.48C126.31 -2.83 168.81 -4.69 207.32 9.30C245.82 23.31 277.19 52.05 294.51 89.18C311.83 126.32 313.69 168.81 299.69 207.32C285.68 245.82 256.94 277.19 219.81 294.51C182.68 311.83 140.18 313.69 101.67 299.69C73.15 289.31 48.54 270.85 30.66 246.88C32.85 248.32 35.19 249.66 37.68 250.91C48.79 256.44 62.38 259.96 77.73 261.30C87.42 268.27 98.11 273.95 109.53 278.10C142.31 290.03 178.49 288.45 210.10 273.70C241.72 258.95 266.18 232.25 278.10 199.46C283.40 184.91 286.03 169.69 286.03 154.49C281.08 162.29 274.87 170.07 267.53 177.66C255.47 190.12 240.57 201.82 223.70 212.1C206.83 222.37 188.31 231.02 169.19 237.55C150.08 244.08 130.75 248.36 112.30 250.14C93.85 251.93 76.65 251.19 61.68 247.96C46.71 244.73 34.26 239.08 25.04 231.33C19.53 226.69 15.52 221.16 12.52 215.25L12.55 215.24C11.70 213.53 10.94 211.78 10.29 210.00L10.31 209.99C-3.04 175.31 -3.47 136.83 9.30 101.67C23.31 63.17 52.05 31.80 89.18 14.48ZM199.46 30.89C166.68 18.96 130.50 20.55 98.89 35.29C67.28 50.04 42.81 76.74 30.89 109.53C25.60 124.05 22.19 137.72 21.31 151.18C26.21 143.54 32.32 135.92 39.51 128.48C51.57 116.02 66.47 104.32 83.34 94.04C100.21 83.76 118.73 75.11 137.85 68.59C156.96 62.06 176.29 57.78 194.74 55.99C205.97 54.91 216.73 54.76 226.81 55.53C229.62 57.94 232.33 60.47 234.93 63.11C241.14 69.43 246.68 76.34 251.47 83.73C248.19 82.55 244.55 81.50 240.52 80.63C228.29 77.99 213.52 77.25 196.95 78.85C180.43 80.45 162.85 84.32 145.27 90.32C127.70 96.32 110.70 104.27 95.29 113.66C79.85 123.06 66.55 133.58 56.02 144.45C45.44 155.38 38.26 166.06 34.19 175.64C30.13 185.19 29.48 192.85 30.55 198.59C30.92 200.59 31.53 202.54 32.42 204.42C35.04 209.88 40.17 215.21 48.76 219.5C59.01 224.60 73.57 227.95 91.91 228.10C110.13 228.24 130.64 225.22 151.71 218.99C172.74 212.77 193.34 203.66 211.75 192.45L211.76 192.48C227.19 183.08 240.49 172.56 251.02 161.68C261.60 150.76 268.78 140.08 272.85 130.49C276.91 120.95 277.56 113.29 276.49 107.55C276.21 106.03 275.97 104.33 275.45 102.82C274.89 101.50 274.30 100.19 273.70 98.89C258.95 67.28 232.25 42.81 199.46 30.89Z" fill="#26211E"/>
    </svg>
  );
}

// ── ModelLogo - static logo for non-reasoning headers ─────────────────────────

export function ModelLogo({
  modelMeta,
  modelName,
  size = 16,
}: {
  modelMeta?: ModelSelectedMeta;
  modelName?: string;
  size?: number;
}) {
  const llmId = getModelLlmId(modelMeta?.company, modelMeta?.modelName || modelName);
  const iconWrap: React.CSSProperties = {
    width: size, height: size, borderRadius: 4, overflow: "hidden",
    flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 0,
    userSelect: "none",
  };
  const preventDrag = (e: React.DragEvent) => e.preventDefault();
  if (llmId) return <span draggable={false} onDragStart={preventDrag} style={iconWrap}><LlmIcon id={llmId} variant="color" size={size} /></span>;
  return <span draggable={false} onDragStart={preventDrag} style={{ userSelect: "none" }}><SouvenirMark size={size} /></span>;
}

// ── AnimatedLogo - Souvenir mark → model icon swing-in with glow burst ────────

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
  const showModel = hasModel;

  const iconWrap: React.CSSProperties = {
    width: 16, height: 16, borderRadius: 4, overflow: "hidden",
    flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 0,
    userSelect: "none",
  };
  const preventDrag = (e: React.DragEvent) => e.preventDefault();

  return (
    <div draggable={false} onDragStart={preventDrag} style={{ position: "relative", width: 16, height: 16, flexShrink: 0, userSelect: "none" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!showModel ? (
          <m.div key="souvenir"
            initial={{ opacity: 0, scale: 0.5, rotate: -8, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.25, rotate: -20, y: -5, filter: "blur(10px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SouvenirMark size={16} />
          </m.div>
        ) : (
          <m.div key={`model-${llmId}`}
            initial={{ opacity: 0, scale: 0.15, rotate: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 220, damping: 11, mass: 0.9 }}
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {llmId
              ? <span style={iconWrap}><LlmIcon id={llmId} variant="color" size={16} /></span>
              : <SouvenirMark size={16} />}
          </m.div>
        )}
      </AnimatePresence>
      {/* Glow burst rings on model selection */}
      {justSelected && [0, 100, 230].map((ms) => (
        <m.div key={ms}
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
    <m.svg
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
    </m.svg>
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
  height: { duration: 0.25, ease: "easeInOut" as const },
  opacity: { duration: 0.2, ease: "easeInOut" as const },
};

// ── ModelNameLabel - plain name text only (logo handled by AnimatedLogo) ──────

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
  const name = modelMeta?.modelName || modelName
  if (!name) return null
  return <span>{name}</span>;
}

// ── Structured reasoning sections (from backend reasoning_sections[]) ────────

type ReasoningSection = { heading: string; body: string };

/** Strip trailing **..** patterns and ellipsis the model sometimes appends. */
function cleanHeading(heading: string): string {
  return heading
    .replace(/\*\*[^*]*\*\*$/, "")
    .replace(/…$/, "")
    .replace(/^#+\s*/, "") // strip any leading markdown heading hashes
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REASONING_ICON_MAP: Array<{ pattern: RegExp; icon: any }> = [
  { pattern: /consider|observ|perceiv|notic|review|assess/i,          icon: AiVisionRecognitionIcon },
  { pattern: /evaluat|analys|analyz|weigh|compar|examin/i,            icon: Brain02Icon             },
  { pattern: /map|chart|structur|hierarch|organiz|categor/i,          icon: HierarchySquare01Icon   },
  { pattern: /identif|find|discov|recogniz|detect|pinpoint/i,         icon: Idea01Icon              },
  { pattern: /plan|schedul|sequenc|step|outlin|task|priorit/i,        icon: Task01Icon              },
  { pattern: /strateg|approach|route|direct|path|tactic/i,            icon: Route01Icon             },
  { pattern: /synthes|combin|integrat|merge|unif|consolidat/i,        icon: GitMergeIcon            },
  { pattern: /search|research|web|look|investigat|fetch|query/i,      icon: Search01Icon            },
  { pattern: /explor|navigat|browse|survey|scan/i,                    icon: Compass01Icon           },
  { pattern: /layer|section|part|segment|component|module/i,          icon: Layers01Icon            },
  { pattern: /context|scope|background|domain|global|world/i,         icon: Globe02Icon             },
  { pattern: /reason|think|process|cogit|reflect|infer/i,             icon: AiBrain01Icon           },
  { pattern: /brain|neural|cognitive|learn|adapt|model/i,             icon: Brain01Icon             },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getReasoningIcon(heading: string): any {
  for (const { pattern, icon } of REASONING_ICON_MAP) {
    if (pattern.test(heading)) return icon;
  }
  return AiNetworkIcon; // fallback
}

/** Render inline markdown bold + text for step summaries */
function renderStepBody(text: string) {
  // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- regex-split text segments have no stable IDs; positions are stable
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- regex-split text segments have no stable IDs
      return <strong key={i} style={{ fontWeight: 600, color: "var(--neutral-800, #3B3632)" }}>{part.slice(2, -2)}</strong>;
    // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- regex-split text segments have no stable IDs
    return <span key={i}>{part}</span>;
  });
}

function StepBody({ text }: { text: string }) {
  // eslint-disable-next-line react-doctor/no-render-in-render -- renderStepBody is a stable module-level helper, not an inline component
  return <>{renderStepBody(text)}</>
}

function ReasoningStep({
  section, index, total, isActive,
}: {
  section: ReasoningSection;
  index: number;
  total: number;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const heading = cleanHeading(section.heading);
  const hasBody = section.body.trim().length > 0;
  const isLast = index === total - 1;
  const icon = getReasoningIcon(heading);

  const headingStyle: React.CSSProperties = isActive
    ? {
        fontWeight: 600,
        fontSize: 14,
        backgroundImage: "linear-gradient(90deg, #B6ACA4 0%, #3B3632 45%, #3B3632 55%, #B6ACA4 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        animation: "svLabelShimmer 2.4s ease-in-out infinite",
      }
    : {
        fontWeight: 600,
        fontSize: 14,
        color: "var(--neutral-800, #26211E)",
      };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        paddingBottom: isLast ? 0 : 12,
      }}
    >
      {/* Left column - icon + animated vertical connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 22, flexShrink: 0 }}>
        <span
          style={{
            width: 22, height: 26,
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 0, flexShrink: 0,
          }}
        >
          <HugeiconsIcon
            icon={icon}
            size={15}
            color={isActive ? "#A89488" : "#C0B5AD"}
            strokeWidth={1.6}
          />
        </span>
        <AnimatePresence>
          {!isLast && (
            <m.div
              key="line"
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

      {/* Right column - heading button + expandable body */}
      <div style={{ flex: 1, paddingLeft: 9, display: "flex", flexDirection: "column" }}>
        <button
          type="button"
          onClick={() => hasBody && setOpen((o) => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", background: "transparent", border: "none",
            cursor: hasBody ? "pointer" : "default",
            padding: "4px 0", textAlign: "left",
            fontFamily: "var(--font-body)",
          }}
        >
          <span style={{ flex: 1, lineHeight: "22px", ...headingStyle }}>
            {heading}{isActive ? "…" : ""}
          </span>
          {hasBody && !isActive && (
            <m.span
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{ display: "flex", alignItems: "center", lineHeight: 0, flexShrink: 0 }}
            >
              <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                <path d="M3.5 2 L7 5 L3.5 8" stroke="#C0B5AD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </m.span>
          )}
        </button>

        <AnimatePresence initial={false}>
          {open && hasBody && !isActive && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: "hidden" }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "var(--neutral-600, #524B47)",
                  lineHeight: "21px",
                  borderLeft: "2px solid var(--neutral-200, #EDE1D7)",
                  paddingLeft: 10,
                  margin: "6px 0 4px 0",
                  fontFamily: "var(--font-body)",
                }}
              >
                <StepBody text={section.body} />
              </p>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ReasoningSections({
  sections,
  isStreaming,
}: {
  sections: ReasoningSection[];
  isStreaming: boolean;
}) {
  const valid = sections.filter((s) => cleanHeading(s.heading).length > 2);
  if (valid.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {valid.map((s, i) => (
        <m.div
          key={s.heading}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <ReasoningStep
            section={s}
            index={i}
            total={valid.length}
            isActive={isStreaming && i === valid.length - 1}
          />
        </m.div>
      ))}
    </div>
  );
}

// ── Left bar + thinking content ────────────────────────────────────────────────

function ThinkingContent({
  thinkingContent,
  reasoningSections,
  hasActivities,
  activities,
  isStreaming,
}: {
  thinkingContent: string;
  reasoningSections?: ReasoningSection[];
  hasActivities: boolean;
  activities?: ActivityItem[];
  isStreaming: boolean;
}) {
  // Show structured sections whenever they exist - even during streaming.
  // When streaming, the last section gets the shimmer "active" treatment.
  // Fall back to raw thinkingContent only when no sections are available.
  const hasStructured = reasoningSections && reasoningSections.length > 0;

  return (
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

      {hasStructured ? (
        <div style={{ marginTop: hasActivities ? 8 : 0 }}>
          <ReasoningSections sections={reasoningSections!} isStreaming={isStreaming} />
        </div>
      ) : thinkingContent ? (
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
          <LineRenderer content={thinkingContent} />
          <StreamingCursor isVisible={isStreaming} />
        </div>
      ) : null}
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
  /** Structured reasoning steps from the backend - rendered as collapsible steps when done. */
  reasoningSections?: Array<{ heading: string; body: string }>;
}

export function ReasoningBlock({
  thinkingContent,
  isThinkingInProgress,
  modelName,
  modelMeta,
  activities,
  reasoningSections,
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
  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
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
  const hasModel = !!(modelMeta?.modelName || modelName);

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
      <div draggable={false} style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 20, userSelect: "none" }}>
        {/* Animated logo - Souvenir mark while thinking, model icon after model_selected */}
        <AnimatedLogo
          modelMeta={modelMeta}
          modelName={modelName}
          isThinkingInProgress={isThinkingInProgress}
          justSelected={justSelected}
        />

        <AnimatePresence mode="wait" initial={false}>
          {isThinkingInProgress && !hasModel ? (
            <m.div
              key="souvenir"
              initial={{ opacity: 0, filter: "blur(5px)", scale: 0.82 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(5px)", scale: 0.82 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
              style={{ display: "flex", alignItems: "center", fontSize: 14, fontWeight: 500, lineHeight: "18px" }}
            >
              <span style={shimmerStyle}>Souvenir</span>
            </m.div>
          ) : isThinkingInProgress && hasModel ? (
            <m.div
              key={`thinking-${modelMeta?.modelName || modelName}`}
              initial={{ opacity: 0, filter: "blur(5px)", scale: 0.82 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(5px)", scale: 0.82 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 500, lineHeight: "18px", color: "var(--neutral-600, #524B47)" }}
            >
              <ModelNameLabel modelMeta={modelMeta} modelName={modelName} />
              <span style={{ color: "var(--neutral-400, #9A9089)", fontWeight: 400 }}>· Thinking…</span>
            </m.div>
          ) : (
            <m.span
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
            </m.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Outer collapse (always mounted - prevents jump on streaming→done) ── */}
      <m.div
        initial={false}
        animate={{ height: outerVisible ? "auto" : 0, opacity: outerVisible ? 1 : 0 }}
        transition={COLLAPSE_TRANSITION}
        style={{ overflow: "hidden" }}
      >
        <div style={{ marginTop: 8 }}>

          {/* Inner header: "Thinking [chevron]" - shown only after streaming */}
          <AnimatePresence initial={false}>
            {!isThinkingInProgress && (
              // eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- interactive div; keyboard events handled by inner span
              <m.div
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
              </m.div>
            )}
          </AnimatePresence>

          {/* Inner collapse (always mounted) */}
          <m.div
            initial={false}
            animate={{ height: innerVisible ? "auto" : 0, opacity: innerVisible ? 1 : 0 }}
            transition={COLLAPSE_TRANSITION}
            style={{ overflow: "hidden" }}
          >
            <ThinkingContent
              thinkingContent={thinkingContent}
              reasoningSections={reasoningSections}
              hasActivities={hasActivities}
              activities={activities}
              isStreaming={!!isThinkingInProgress}
            />
          </m.div>

        </div>
      </m.div>

    </div>
  );
}

/** Legacy export kept for any external callers */
export const renderReasoningContent = (text: string): React.ReactNode => {
  if (!text) return null;
  return <LineRenderer content={text} />;
};
