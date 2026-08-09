"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
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
} from "@hugeicons/core-free-icons";
import { LineRenderer } from "@/lib/line-renderer";
import { ActivitiesSection, ActivityRow } from "./ActivityRow";
import { springs } from "@/lib/springs";
import {
  cleanReasoningHeading,
  splitReasoningText,
  type ReasoningSection,
  type ReasoningTimelineItem,
} from "@/lib/reasoning";
import type { ActivityItem, ModelSelectedMeta } from "@/hooks/use-chat-state";

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
  size = 16,
}: {
  modelMeta?: ModelSelectedMeta;
  modelName?: string;
  size?: number;
}) {
  // Always the Souvenir mark — every model is one of the 3 Souvenir Muse
  // tiers, never a raw third-party (Anthropic/Claude) brand.
  const preventDrag = (e: React.DragEvent) => e.preventDefault();
  return <span draggable={false} onDragStart={preventDrag} style={{ userSelect: "none" }}><SouvenirMark size={size} /></span>;
}

// ── AnimatedLogo - Souvenir mark → model icon swing-in with glow burst ────────

interface AnimatedLogoProps {
  modelMeta?: ModelSelectedMeta;
  modelName?: string;
  isThinkingInProgress?: boolean;
  justSelected: boolean;
}

export function AnimatedLogo({
  modelMeta,
  modelName,
  justSelected,
}: AnimatedLogoProps) {
  // Always the Souvenir mark — every model is one of the 3 Souvenir Muse
  // tiers, never a raw third-party (Anthropic/Claude) brand. `hasModel`
  // still distinguishes "thinking, no model chosen yet" from "model
  // selected" so the swing-in animation below keeps firing on selection.
  // Muse-routed responses report only `complexity` (basic/standard/advanced),
  // never a raw modelName — so complexity alone must count as "resolved" too,
  // or this never leaves the "no model yet" state for those responses.
  const hasModel = !!(modelMeta?.modelName || modelName || modelMeta?.complexity);
  const showModel = hasModel;
  const currentModelKey = modelMeta?.modelName || modelName || modelMeta?.complexity;

  const preventDrag = (e: React.DragEvent) => e.preventDefault();

  return (
    <div draggable={false} onDragStart={preventDrag} style={{ position: "relative", width: 16, height: 16, flexShrink: 0, userSelect: "none" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!showModel ? (
          <m.div key="souvenir"
            initial={{ opacity: 0, scale: 0.5, rotate: -8, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: "none" }}
            exit={{ opacity: 0, scale: 0.25, rotate: -20, y: -5, filter: "blur(10px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SouvenirMark size={16} />
          </m.div>
        ) : (
          <m.div key={`model-${currentModelKey}`}
            initial={{ opacity: 0, scale: 0.15, rotate: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: "none" }}
            transition={{ type: "spring", stiffness: 220, damping: 11, mass: 0.9 }}
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SouvenirMark size={16} />
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

function ChevronRight({ isOpen }: { isOpen: boolean }) {
  return (
    <m.svg
      width="12"
      height="12"
      viewBox="0 0 10 10"
      fill="none"
      animate={{ rotate: isOpen ? 90 : 0 }}
      transition={springs.fast}
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M3.5 2 L7 5 L3.5 8"
        stroke="#C0B5AD"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </m.svg>
  );
}

function ResearchTitle({ text }: { text: string }) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const words = [...text.matchAll(/\S+/g)].map((match) => ({
    word: match[0],
    start: match.index,
  }));

  return (
    <m.span
      key={text}
      initial={shouldReduceMotion ? false : { opacity: 0, x: 10, filter: "blur(8px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
    >
      ·{" "}
      {words.map(({ word, start }, index) => (
        <m.span
          key={`${word}-${start}`}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.01, delay: index * 0.08 }}
        >
          {index > 0 ? " " : ""}{word}
        </m.span>
      ))}
    </m.span>
  );
}

function ThinkingTrigger({ open, onToggle, controls, summary }: { open: boolean; onToggle: () => void; controls: string; summary?: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: "relative", width: summary ? "100%" : "fit-content", maxWidth: "100%" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {hovered && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            style={{ position: "absolute", inset: 0, borderRadius: 8, background: "var(--neutral-100, #F7F3F0)", pointerEvents: "none" }}
          />
        )}
      </AnimatePresence>
      <button
        type="button"
        className="kaya-thinking-trigger"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onToggle}
        style={{
          position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 6,
          padding: "4px 0", border: 0, borderRadius: 8, background: "transparent",
          cursor: "pointer", fontFamily: "var(--font-body)", userSelect: "none", maxWidth: "100%",
        }}
      >
        <span style={{ display: "inline-grid", fontSize: 14, lineHeight: "22px", textAlign: "left" }}>
          <span aria-hidden="true" style={{ gridArea: "1 / 1", visibility: "hidden", fontWeight: 500 }}>Thinking</span>
          <span
            style={{
              gridArea: "1 / 1",
              color: "#9A9089",
              fontWeight: 500,
            }}
          >
            Thinking
          </span>
        </span>
        {summary && (
          <span style={{ minWidth: 0, flex: 1, color: "#9A9089", fontSize: 14, lineHeight: "22px", textAlign: "left" }}>
            <ResearchTitle text={summary} />
          </span>
        )}
        <ChevronRight isOpen={open} />
      </button>
    </div>
  );
}

function ThinkingCollapse({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  return (
    <m.div
      id={id}
      aria-hidden={!open}
      inert={!open}
      initial={false}
      animate={{ height: open ? "auto" : 0 }}
      transition={{ ...springs.moderate, bounce: 0 }}
      style={{ overflow: "hidden" }}
    >
      <div style={{ padding: "12px 0 10px", fontFamily: "var(--font-body)", fontSize: 14, color: "#524B47" }}>
        {children}
      </div>
    </m.div>
  );
}

// ── Structured reasoning sections (from backend reasoning_sections[]) ────────

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

function ReasoningStep({
  section, index, total, isActive,
}: {
  section: ReasoningSection;
  index: number;
  total: number;
  isActive: boolean;
}) {
  const heading = cleanReasoningHeading(section.heading);
  const hasBody = section.body.trim().length > 0;
  const isLast = index === total - 1;
  const icon = getReasoningIcon(heading);
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const detail = section.detail?.trim() ?? "";

  return (
    <m.div
      style={{ position: "relative", zIndex: 1, overflow: "hidden" }}
      initial={{ height: 0 }}
      animate={{ height: "auto" }}
      transition={springs.slow}
    >
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, delay: 0.08, ease: "easeOut" }}
      >
        <div style={{ display: "flex", alignItems: "stretch", paddingBottom: isLast ? 0 : 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 20 }}>
            <span style={{ display: "flex", width: 20, height: 28, alignItems: "center", justifyContent: "center", lineHeight: 0 }}>
              <HugeiconsIcon icon={icon} size={16} color={isActive ? "#A89488" : "#C0B5AD"} strokeWidth={1.5} />
            </span>
            {!isLast && (
              <span
                style={{
                  flex: 1,
                  width: 1,
                  minHeight: 12,
                  background: "var(--neutral-200, #EDE1D7)",
                }}
              />
            )}
          </div>

          <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column", paddingLeft: 10 }}>
            <button
              type="button"
              disabled={isActive || !hasBody}
              aria-expanded={!isActive && hasBody ? expanded : undefined}
              aria-controls={!isActive && hasBody ? bodyId : undefined}
              onClick={() => setExpanded((value) => !value)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "3px 0", border: 0, background: "transparent",
                cursor: !isActive && hasBody ? "pointer" : "default", textAlign: "left",
                fontFamily: "var(--font-body)",
              }}
            >
              <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#524B47", fontSize: 14, lineHeight: "22px" }}>
                <strong
                  className={isActive ? "kaya-thinking-step-shimmer" : undefined}
                  style={{ color: "#26211E", fontWeight: 600 }}
                >
                  {heading}{isActive ? "…" : ""}
                </strong>
                {!isActive && detail ? <> {detail}</> : null}
              </span>
              {!isActive && hasBody && <ChevronRight isOpen={expanded} />}
            </button>

            <AnimatePresence initial={false}>
              {expanded && !isActive && hasBody && (
                <m.div
                  id={bodyId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ margin: "8px 0 6px", paddingLeft: 10, borderLeft: "2px solid #EDE1D7" }}>
                    <LineRenderer content={section.body} variant="reasoning" />
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </m.div>
    </m.div>
  );
}

function ReasoningSections({
  sections,
  isStreaming,
}: {
  sections: ReasoningSection[];
  isStreaming: boolean;
}) {
  const valid = sections.filter((s) => cleanReasoningHeading(s.heading).length > 2);
  if (valid.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {valid.map((s, i) => (
        <ReasoningStep
          key={`${s.heading}-${s.body}`}
          section={s}
          index={i}
          total={valid.length}
          isActive={isStreaming && i === valid.length - 1}
        />
      ))}
    </div>
  );
}

// ── Left bar + thinking content ────────────────────────────────────────────────

function TimelineReasoningStep({ content, active }: { content: string; active: boolean }) {
  const parsed = splitReasoningText(content);
  const chunks = parsed.filter((section) => cleanReasoningHeading(section.heading).length > 2);

  if (chunks.length === 0) {
    return (
      <div style={{ overflow: "hidden" }}>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, delay: 0.08, ease: "easeOut" }}
          style={{ display: "flex", gap: 10 }}
        >
          <span style={{ display: "flex", width: 20, height: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#C0B5AD" }} />
          </span>
          <div
            className={active ? "kaya-thinking-step-shimmer" : undefined}
            style={{ minWidth: 0, flex: 1, color: "#524B47", fontFamily: "var(--font-body)", fontSize: 14, lineHeight: "22px" }}
          >
            <LineRenderer content={content} variant="reasoning" />
          </div>
        </m.div>
      </div>
    );
  }

  return (
    <m.div
      initial={{ height: 0 }}
      animate={{ height: "auto" }}
      transition={springs.slow}
      style={{ overflow: "hidden" }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {chunks.map((section, index) => (
          <ReasoningStep
            key={`${section.heading}-${section.body}`}
            section={section}
            index={index}
            total={chunks.length}
            isActive={active && index === chunks.length - 1}
          />
        ))}
      </div>
    </m.div>
  );
}

export interface ReasoningContentProps {
  thinkingContent: string;
  reasoningSections?: ReasoningSection[];
  activities?: ActivityItem[];
  reasoningTimeline?: ReasoningTimelineItem[];
  isStreaming: boolean;
}

export function ReasoningContent({
  thinkingContent,
  reasoningSections,
  activities,
  reasoningTimeline,
  isStreaming,
}: ReasoningContentProps) {
  const hasActivities = Boolean(activities?.length);
  // Show structured sections whenever they exist - even during streaming.
  // When streaming, the last section gets the shimmer "active" treatment.
  // Fall back to raw thinkingContent only when no sections are available.
  const hasStructured = reasoningSections && reasoningSections.length > 0;
  const hasTimeline = Boolean(reasoningTimeline?.length);
  const activityById = new Map((activities ?? []).map((activity) => [activity.id, activity]));

  return (
    <div>
      {hasTimeline ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {reasoningTimeline!.map((item, index) => {
            if (item.kind === "activity") {
              const activity = activityById.get(item.activityId);
              return activity ? (
                <m.div key={item.id} initial={{ height: 0 }} animate={{ height: "auto" }} transition={springs.slow} style={{ overflow: "hidden" }}>
                  <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24, delay: 0.08, ease: "easeOut" }}>
                    <ActivityRow activity={activity} />
                  </m.div>
                </m.div>
              ) : null;
            }
            const isActiveReasoning = isStreaming && index === reasoningTimeline!.length - 1;
            return (
              <TimelineReasoningStep
                key={item.id}
                content={item.content}
                active={isActiveReasoning}
              />
            );
          })}
        </div>
      ) : hasStructured ? (
        <>
          {hasActivities && <ActivitiesSection activities={activities!} />}
          <div style={{ marginTop: hasActivities ? 16 : 0 }}>
            <ReasoningSections sections={reasoningSections!} isStreaming={isStreaming} />
          </div>
        </>
      ) : thinkingContent ? (
        <>
          {hasActivities && <ActivitiesSection activities={activities!} />}
          <div style={{ marginTop: hasActivities ? 16 : 0 }}>
            <TimelineReasoningStep content={thinkingContent} active={isStreaming} />
          </div>
        </>
      ) : hasActivities ? <ActivitiesSection activities={activities!} /> : null}
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
  reasoningSections?: ReasoningSection[];
  /** Live arrival-ordered reasoning/tool trace. */
  reasoningTimeline?: ReasoningTimelineItem[];
  /** Live/final compact research summary emitted by the stream. */
  researchTitle?: string;
}

export function ReasoningBlock({
  thinkingContent,
  isThinkingInProgress,
  activities,
  reasoningSections,
  reasoningTimeline,
  researchTitle,
}: ReasoningBlockProps) {
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const panelId = useId();
  const hasActiveActivity = activities?.some((activity) =>
    activity.status === "start" || activity.status === "executing" || activity.status === "reading",
  );
  const open = manualOpen ?? Boolean(isThinkingInProgress || hasActiveActivity);

  const fallbackTitle = (() => {
    const lastReasoning = reasoningTimeline?.findLast((item) => item.kind === "reasoning");
    if (lastReasoning) {
      const parsedTimeline = splitReasoningText(lastReasoning.content);
      const timelineHeading = cleanReasoningHeading(parsedTimeline.findLast((section) => section.heading)?.heading ?? "");
      if (timelineHeading) return timelineHeading;
    }

    const sectionHeading = cleanReasoningHeading(reasoningSections?.at(-1)?.heading ?? "");
    if (sectionHeading) return sectionHeading;

    const parsedThinking = splitReasoningText(thinkingContent);
    return cleanReasoningHeading(parsedThinking.findLast((section) => section.heading)?.heading ?? "");
  })();
  const summary = researchTitle?.trim() || fallbackTitle;

  if (!thinkingContent && !reasoningSections?.length && !reasoningTimeline?.length && !activities?.length && !isThinkingInProgress) return null;

  return (
    <div style={{ width: "100%", margin: "4px 0 10px", fontFamily: "var(--font-body)" }}>

      {/* ── Outer header ────────────────────────────────────────────────────── */}
      <ThinkingTrigger open={open} onToggle={() => setManualOpen(!open)} controls={panelId} summary={summary || undefined} />

      {/* ── Outer collapse (always mounted - prevents jump on streaming→done) ── */}
      <ThinkingCollapse open={open} id={panelId}>
        <ReasoningContent
          thinkingContent={thinkingContent}
          reasoningSections={reasoningSections}
          activities={activities}
          reasoningTimeline={reasoningTimeline}
          isStreaming={!!isThinkingInProgress}
        />
      </ThinkingCollapse>

    </div>
  );
}

/** Legacy export kept for any external callers */
export const renderReasoningContent = (text: string): React.ReactNode => {
  if (!text) return null;
  return <LineRenderer content={text} />;
};
