"use client";
import { Tooltip } from '@/components/Tooltip'
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { m, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/springs";
import { toConnector } from "@/lib/connector";
import { Dropdown, dropdownItemStagger } from "@/components/Dropdown";
import styles from "./compareModels.module.css";
import { Sparkles, X } from "lucide-react";
import { ThemedLlmIcon } from "@/components/ThemedLlmIcon";
import { AtomTwoIcon, FilterMailIcon, PinIcon, TickTwoIcon, SearchOneIcon, ArrowLeftOneIcon, CancelOneIcon, ArrowExpandOneIcon, ArrowShrinkTwoIcon, ArrowUpTwoIcon, MicTwoIcon, StopCircleIcon } from "@strange-huge/icons";
import { Button, IconButton } from "@/components/ui/button";
import { friendlyModelError } from "@/lib/model-error";
import { NETWORK_ERROR_MESSAGE, extractCredits, httpErrorMessage, resolveModelId } from "@/lib/compare/run-events";
import { useCompareRunStore, useModelRun, type CompareReasoning } from "@/lib/compare/compare-run-store";
import { filterCompareModels } from "@/lib/compare/filter-models";
import { formatContextWindow } from "@/lib/models/catalog";
import { BlockErrorBoundary } from "@/components/chat/BlockErrorBoundary";
import { AudioWaveDisplay } from "@/components/shared/AudioWaveDisplay";
import { Tabs, TabsList, TabsTrigger } from "@/components/Tabs";
import type { AIModel } from "@/types/ai-model";
import { useQuery } from "@tanstack/react-query";
import { modelsQuery } from "@/lib/ai-models";
import { MODELS_ENDPOINT } from "@/lib/config";
import { getModelLlmId } from "@/lib/model-icons";
import { apiFetch } from "@/lib/api/client";
import { ContentRenderer } from "@/lib/content-renderer";
import type { DecodedSSEEvent } from "@/lib/sse-decoder";
import { readAguiStream } from "@/lib/agui-stream";
import { usePinboardActions } from "@/context/pinboard-context";
import { PINS_ENABLED } from "@/lib/feature-flags";
import { trackBrowserEvent } from "@/lib/analytics/events";
import { ConnectPromptCard } from "@/components/chat/ConnectorPrompts";
import { PermissionPromptCard } from "@/components/shared/PermissionPromptCard";
import type { ConnectorConnectPrompt, ConnectorPermissionPrompt } from "@/types/chat";
import { parsePermissionPrompt } from "@/lib/api/prompts";
import { isValidUUID, normalizeUuid } from "@/lib/normalizers/normalize-utils";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { BreathingDot } from "@/components/BreathingDot";
import { ReasoningBlock } from "@/components/chat/ReasoningBlock";
import { createReasoningAccumulator } from "@/lib/reasoning";

// â”€â”€ Design tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ChipColor = "neutral" | "green" | "brown" | "red" | "blue" | "purple";

const CHIP_COLORS: Record<ChipColor, { bg: string; text: string }> = {
  neutral: { bg: "var(--neutral-100)", text: "var(--neutral-700)" },
  green:   { bg: "var(--green-50)", text: "var(--green-800)" },
  brown:   { bg: "var(--brown-100)", text: "var(--brown-700)" },
  red:     { bg: "var(--red-100)", text: "var(--red-700)" },
  blue:    { bg: "var(--blue-100)", text: "var(--blue-700)" },
  purple:  { bg: "var(--purple-50)", text: "var(--violet-800)" },
};

const CHIP_SHADOW: Record<ChipColor, string> = {
  neutral: "0px 1px 1.5px 0px var(--neutral-950-20),0px 0px 0px 1px color-mix(in srgb, var(--neutral-600) 50%, transparent)",
  brown:   "0px 1px 1.5px 0px rgba(20,12,5,0.2),0px 0px 0px 1px rgba(126,84,53,0.5)",
  red:     "0px 1px 1.5px 0px color-mix(in srgb, var(--red-950) 20%, transparent),0px 0px 0px 1px var(--red-600-51)",
  green:   "0px 1px 1.5px 0px rgba(17,25,1,0.2),0px 0px 0px 1px rgba(128,183,7,0.5)",
  blue:    "0px 1px 1.5px 0px rgba(2,15,24,0.2),0px 0px 0px 1px var(--blue-600-50)",
  purple:  "0px 1px 1.5px 0px color-mix(in srgb, var(--purple-950) 20%, transparent),0px 0px 0px 1px color-mix(in srgb, var(--violet-700) 50%, transparent)",
};

const CHIP_INNER: Record<ChipColor, string> = {
  neutral: "inset 0px 1px 0px 0px var(--neutral-white-70),inset 0px -1px 0px 0px color-mix(in srgb, var(--neutral-600) 10%, transparent)",
  brown:   "inset 0px 1px 0px 0px rgba(250,241,235,0.7),inset 0px -1px 0px 0px rgba(126,84,53,0.1)",
  red:     "inset 0px 1px 0px 0px color-mix(in srgb, var(--red-50) 70%, transparent),inset 0px -1px 0px 0px color-mix(in srgb, var(--red-600) 10%, transparent)",
  green:   "inset 0px 1px 0px 0px rgba(247,254,230,0.7),inset 0px -1px 0px 0px rgba(128,183,7,0.1)",
  blue:    "inset 0px 1px 0px 0px var(--blue-50-70),inset 0px -1px 0px 0px var(--blue-600-10)",
  purple:  "inset 0px 1px 0px 0px color-mix(in srgb, var(--purple-50) 70%, transparent),inset 0px -1px 0px 0px color-mix(in srgb, var(--violet-700) 10%, transparent)",
};

const CARD_SHADOW        = "0px 2px 2.8px 0px rgba(82,75,71,0.12),0px 0px 0px 1px #F5F5F5";
const CARD_SHADOW_RAISED = "0px 1px 1.5px 0px rgba(82,75,71,0.12),0px 0px 0px 1px rgba(212, 212, 212,0.4),0px 2px 2.8px 0px rgba(82,75,71,0.12),0px 0px 0px 1px #F5F5F5";
const CARD_INSET         = "inset 0px 1px 0px 0px color-mix(in srgb, var(--static-white) 61%, transparent),inset 0px -1px 0px 0px rgba(106,98,93,0.05)";
const CARD_BORDER        = "1px solid var(--neutral-100)";
const PRIMARY            = "var(--neutral-900)";
const SECONDARY          = "var(--neutral-700)";
const TERTIARY           = "var(--neutral-500)";
const ICON_BTN_BG        = "var(--neutral-white)";
const RESP_BORDER        = "var(--brown-100)";
const DARK_GRADIENT      = "linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-800) 100%)";
const DIALOG_SHADOW      = "0px 19px 32px 0px rgba(18,12,8,0.15),0px 2px 2.8px 0px rgba(130,122,116,0.1),0px 0px 0px 1px #F5F5F5";
const TRAY_BG_SHADOW     = "inset 0px -1px 0px 0px color-mix(in srgb, var(--static-white) 90%, transparent),inset 0px 1px 0px 0px #F5F5F5,inset 0px 0px 4px 0px rgba(229, 229, 229,0.5)";
const SLOT_SHADOW        = "0px 0px 0px 1px rgba(212, 212, 212,0.4),0px 2px 2.8px 0px rgba(82,75,71,0.12),0px 0px 0px 1px #F5F5F5";
const BTN_SHADOW         = "0px 0px 0px 1px #3B3632,0px 1.091px 1.091px 0px rgba(59,54,50,0.1),0px 1.455px 3.127px 0px rgba(59,54,50,0.4)";
const BTN_INSET          = "inset 0px 1.455px 0.364px 0px var(--neutral-600),inset 0px -2.182px 0.364px 0px var(--neutral-800),inset 0px -2.545px 6.9px -2.182px var(--neutral-500)";

// â”€â”€ Chip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Chip({ label, color, noCapitalize }: { label: string; color: ChipColor; noCapitalize?: boolean }) {
  const { bg, text } = CHIP_COLORS[color];
  return (
    <div style={{
      position:       "relative",
      display:        "inline-flex",
      alignItems:     "center",
      justifyContent: "center",
      overflow:       "hidden",
      padding:        2,
      borderRadius:   6,
      boxShadow:      CHIP_SHADOW[color],
      flexShrink:     0,
    }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 6, backgroundColor: bg }} />
      <div style={{ position: "relative", display: "inline-flex", alignItems: "center", paddingLeft: 2, paddingRight: 2 }}>
        <span style={{
          fontSize: 12,
          fontWeight:    500,
          lineHeight:    "16px",
          color:         text,
          whiteSpace:    "nowrap",
          fontFamily:    "var(--font-body)",
          textAlign:     "center",
          ...(noCapitalize ? {} : { textTransform: "capitalize" as const }),
        }}>
          {label}
        </span>
      </div>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "inherit", boxShadow: CHIP_INNER[color] }} />
    </div>
  );
}

// â”€â”€ CornerNotch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Creates the inverted-border-radius "browser tab" notch effect.
// A beige box with a white circle peeking from one corner produces a concave curve
// that visually joins the active tab to the white content panel below.
function CornerNotch({ side }: { side: "left" | "right" }) {
  return (
    <div style={{ width: 8, height: 8, background: "var(--neutral-100)", overflow: "hidden", position: "relative", flexShrink: 0, alignSelf: "flex-end" }}>
      <div style={{
        position:     "absolute",
        top:          0,
        [side === "left" ? "left" : "right"]: 0,
        width:        16,
        height:       16,
        borderRadius: "50%",
        background:   "var(--neutral-white)",
      }} />
    </div>
  );
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TAG_PALETTE_COMPARE: ChipColor[] = ["green", "blue", "purple", "brown", "neutral"];
function compareTagColor(tag: string): ChipColor {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE_COMPARE[h % TAG_PALETTE_COMPARE.length];
}

interface CompareModel {
  id:              string;
  requestModelId:  string | null;
  displayName:     string;
  company:         string;
  modelName:       string;
  description:     string;
  tierLabel:       string;
  contextLabel:    string;
  featureLabel:    string | null;
  companyName:     string;
  rawModelName:    string;
  type:            string;
  tags?:           string[];
  thinkingEfforts?: string[];
}

// â”€â”€ Model transform â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const resolveRequestModelId = (model: AIModel): string | null =>
  normalizeUuid(model.id) ?? normalizeUuid(model.modelId);


const transformModelForCompare = (model: AIModel): CompareModel => {
  const company   = model.companyName || "Unknown";
  const modelName = model.modelName   || "Unknown Model";
  const displayName =
    company.toLowerCase() !== "unknown" ? `${company} / ${modelName}` : modelName;

  const modalities = [
    ...(model.outputModalities ?? []),
    ...(model.inputModalities  ?? []),
  ]
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase());

  const type = modalities.includes("video")
    ? "video"
    : modalities.includes("image")
      ? "image"
      : "text";

  return {
    id:             `${company}:${modelName}:${String(model.id ?? model.modelId ?? "unknown")}`,
    requestModelId: resolveRequestModelId(model),
    displayName,
    company,
    modelName,
    description:    model.description || (model.version ? `Version ${model.version}` : modelName),
    tierLabel:      model.planType || model.callType || model.modelType || "Standard",
    contextLabel:   formatContextWindow(model.inputLimit) ?? "N/A",
    featureLabel:   type === "video" ? "Video generation"
                  : type === "image" ? "Image generation"
                  : null,
    companyName:     company,
    rawModelName:    modelName,
    type,
    tags:            model.tags,
    thinkingEfforts: model.thinkingEfforts,
  };
};


// â”€â”€ ModelCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ModelCard({
  model,
  isSelected,
  isDisabled,
  onClick,
}: {
  model:      CompareModel;
  isSelected: boolean;
  isDisabled: boolean;
  onClick:    () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const llmId    = getModelLlmId(model.companyName, model.rawModelName) ?? "";
  const isActive = isSelected || isHovered;
  const tierColor: ChipColor = /^power$/i.test(model.tierLabel) ? "purple" : /^pro$/i.test(model.tierLabel) ? "blue" : "neutral";

  return (
    <Tooltip content="This model is missing a backend ID and cannot be tested." disabled={!!model.requestModelId} maxWidth={280}><div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-pressed={isSelected}
      onClick={() => !isDisabled && onClick()}
      onKeyDown={(e) => { if (!isDisabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => !isDisabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width:           "100%",
        height:          "100%",
        borderRadius:    16,
        boxShadow:       isActive ? CARD_SHADOW_RAISED : CARD_SHADOW,
        backgroundColor: "var(--neutral-white)",
        paddingTop:      12,
        paddingBottom:   16,
        paddingLeft:     12,
        paddingRight:    12,
        display:         "flex",
        flexDirection:   "column",
        gap:             8,
        cursor:          isDisabled ? "not-allowed" : "pointer",
        opacity:         isDisabled ? 0.5 : 1,
        position:        "relative",
        transition:      "box-shadow 0.15s",
        outline:         "none",
        boxSizing:       "border-box",
        overflow:        "hidden",
      }}
    >
      {/* Hover warm overlay */}
      {isHovered && !isSelected && (
        <div aria-hidden style={{
          position:      "absolute",
          inset:         0,
          pointerEvents: "none",
          borderRadius:  16,
          background:    "linear-gradient(90deg,color-mix(in srgb, var(--neutral-100) 60%, transparent) 0%,color-mix(in srgb, var(--neutral-100) 60%, transparent) 100%),linear-gradient(90deg,var(--static-white) 0%,var(--static-white) 100%)",
        }} />
      )}
      {/* Selected warm overlay */}
      {isSelected && (
        <div aria-hidden style={{
          position:        "absolute",
          inset:           0,
          pointerEvents:   "none",
          borderRadius:    16,
          backgroundColor: "color-mix(in srgb, var(--neutral-100) 60%, transparent)",
        }} />
      )}
      {/* Inset highlight for both hover and selected */}
      {isActive && (
        <div aria-hidden style={{
          position:      "absolute",
          inset:         0,
          pointerEvents: "none",
          borderRadius:  "inherit",
          boxShadow:     CARD_INSET,
        }} />
      )}

      {/* Header row */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, width: "100%", flexShrink: 0 }}>
        <div style={{
          width:           44,
          height:          44,
          borderRadius:    10,
          padding:         8,
          flexShrink:      0,
          backgroundColor: "color-mix(in srgb, var(--static-white) 0%, transparent)",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          overflow:        "hidden",
        }}>
          <ThemedLlmIcon id={llmId} size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: PRIMARY, lineHeight: "22px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", fontFamily: "var(--font-body)" }}>
            {model.modelName}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: SECONDARY, lineHeight: "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", fontFamily: "var(--font-body)" }}>
            {model.company}
          </div>
        </div>
        {/* Inline checkmark for selected state */}
        {isSelected && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 3, borderRadius: 6, flexShrink: 0 }}>
            <TickTwoIcon animated size={18} color={PRIMARY} />
          </div>
        )}
      </div>

      {/* Description - flex:1 pushes badge row to bottom */}
      <div style={{
        position:        "relative",
        fontSize: 12,
        color:           isActive ? SECONDARY : TERTIARY,
        lineHeight:      "16px",
        maxHeight:       48,
        overflow:        "hidden",
        display:         "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical" as const,
        width:           "100%",
        fontFamily:      "var(--font-body)",
        flex:            1,
      }}>
        {model.description}
      </div>

      {/* Badge row - stays at bottom via marginTop auto */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", paddingTop: 8, gap: 6, width: "100%", marginTop: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Chip label={model.tierLabel}    color={tierColor} />
          <Chip label={model.contextLabel} color="red" noCapitalize />
          {model.thinkingEfforts?.map((e) => (
            <Chip key={`effort-${e}`} label={e} color="purple" />
          ))}
          {model.tags?.map((tag) => (
            <Chip key={tag} label={tag} color={compareTagColor(tag)} />
          ))}
        </div>
      </div>
    </div></Tooltip>
  );
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CompareModelsProps {
  selectedModel?: AIModel | null;
  onModelSelect?: (model: AIModel) => void;
  onClose?: () => void;
}


function ModelReasoning({ reasoning, streaming, hasAnswer }: {
  reasoning?: CompareReasoning;
  streaming: boolean;
  hasAnswer: boolean;
}) {
  if (!reasoning?.text && !reasoning?.sections.length) return null;
  return (
    <ReasoningBlock
      thinkingContent={reasoning.text}
      reasoningSections={reasoning.sections}
      isThinkingInProgress={streaming && !hasAnswer}
      isNewMessage
    />
  );
}

/**
 * One model's answer area: reasoning, then streaming text, an error with
 * Retry, a waiting state, the formatted answer, or the empty prompt. Used by
 * both the column tray and the expanded view. Wrapped in a boundary so a
 * render error in one answer can't blank the whole modal.
 */
function ModelResponseBody({ modelId, modelName, response, reasoning, error, streaming, testing, fill, onRetry }: {
  modelId: string;
  modelName: string;
  response?: string;
  reasoning?: CompareReasoning;
  error?: string;
  streaming: boolean;
  testing: boolean;
  /** Expanded view: placeholders fill the panel height. */
  fill?: boolean;
  onRetry: (modelId: string) => void;
}) {
  const placeholder: React.CSSProperties = fill
    ? { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }
    : { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 };
  return (
    <BlockErrorBoundary label="answer">
      <ModelReasoning reasoning={reasoning} streaming={streaming} hasAnswer={Boolean(response)} />
      {streaming ? (
        // The same renderer as chat, so markdown, code, tables and math look identical while streaming.
        <ContentRenderer
          content={response || ""}
          isStreaming
          cursor={<BreathingDot size="sm" style={{ backgroundColor: PRIMARY, marginLeft: 2 }} />}
        />
      ) : error ? (
        <>
          {response && <ContentRenderer content={response} />}
          <div role="alert" style={placeholder}>
            <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--color-tag-Red-text)", textAlign: "center", fontFamily: "var(--font-body)" }}>{error}</div>
            <Button variant="outline" size="sm" onClick={() => onRetry(modelId)} disabled={testing}>Retry</Button>
          </div>
        </>
      ) : testing && !response ? (
        <div style={placeholder}>
          <Sparkles strokeWidth={1.5} style={{ width: 48, height: 48, color: "var(--neutral-100)" }} className="animate-pulse" />
          <div style={{ fontSize: 12, color: TERTIARY, textAlign: "center", fontFamily: "var(--font-body)" }}>Waiting to generate...</div>
        </div>
      ) : response ? (
        <ContentRenderer content={response} />
      ) : (
        <div style={placeholder}>
          <Sparkles strokeWidth={1.5} style={{ width: 48, height: 48, color: "var(--neutral-100)" }} />
          <div style={{ fontSize: 12, color: TERTIARY, textAlign: "center", fontFamily: "var(--font-body)" }}>
            Run a prompt to see<br />{modelName}&apos;s<br />answer here.
          </div>
        </div>
      )}
    </BlockErrorBoundary>
  );
}

/**
 * One model's answer area, connector prompts included. It reads only its own run from the store, so a
 * token for this model re-renders this view alone. `expanded` is the single-model panel's layout.
 */
function ModelRunView({ runKey, modelName, testing, onRetry, expanded = false }: {
  runKey: string;
  modelName: string;
  testing: boolean;
  onRetry: (modelId: string) => void;
  expanded?: boolean;
}) {
  const run = useModelRun(runKey);
  const hasContent = Boolean(run.response || run.reasoning);
  const area: React.CSSProperties = expanded
    ? { flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 20, paddingTop: 10, paddingLeft: 10, paddingRight: 10 }
    : { flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 20, padding: 10, display: "flex", flexDirection: "column", alignItems: hasContent ? "flex-start" : "center", justifyContent: hasContent ? "flex-start" : "center" };
  return (
    <>
      <div className="kaya-scrollbar" aria-live="polite" aria-busy={run.streaming || undefined} style={area}>
        <ModelResponseBody modelId={runKey} modelName={modelName} response={run.response} reasoning={run.reasoning}
          error={run.error} streaming={run.streaming} testing={testing} fill={expanded} onRetry={onRetry} />
      </div>
      {(run.connectPrompts.length > 0 || run.permissionPrompts.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          {run.connectPrompts.map((p) => <ConnectPromptCard key={p.request_id} prompt={p} />)}
          {run.permissionPrompts.map((p) => <PermissionPromptCard key={p.request_id} prompt={p} />)}
        </div>
      )}
    </>
  );
}

/** The credits a model's run cost, once it is done. `bar` wraps it in the column's bottom bar. */
function RunCredits({ runKey, bar = false }: { runKey: string; bar?: boolean }) {
  const credits = useCompareRunStore((state) => state.runs[runKey]?.credits);
  if (credits === undefined) return null;
  const chip = <Chip label={`${credits.toFixed(2)} Credits`} color="neutral" noCapitalize />;
  return bar ? <div style={{ display: "flex", alignItems: "center", paddingTop: 2, paddingBottom: 2, flexShrink: 0 }}>{chip}</div> : chip;
}

export default function CompareModels({ selectedModel, onModelSelect, onClose }: CompareModelsProps = {}) {
  void selectedModel;

  const [selectedModels,       setSelectedModels]       = useState<string[]>([]);
  const [showResults,          setShowResults]           = useState(false);
  const [prompt,               setPrompt]                = useState("");
  // The shared ["models"] query, the same cache the model selector reads.
  const modelsQ = useQuery(modelsQuery());
  const fullModels: AIModel[] = useMemo(() => modelsQ.data ?? [], [modelsQ.data]);
  const models: CompareModel[] = useMemo(() => fullModels.map(transformModelForCompare), [fullModels]);
  const isLoading = modelsQ.isPending;
  const [lastPrompt,           setLastPrompt]            = useState("");
  const [isTesting,            setIsTesting]             = useState(false);
  const [promptInputCollapsed, setPromptInputCollapsed]  = useState(false);
  const [activeTab,            setActiveTab]             = useState<string>("all");
  const [searchQuery,          setSearchQuery]           = useState("");
  const [showSearch,           setShowSearch]            = useState(false);
  const [atTop,           setAtTop]           = useState(true);
  const [atBottom,        setAtBottom]        = useState(false);
  const [expandedModelId,  setExpandedModelId]  = useState<string | null>(null);
  // Per-model run state lives in the compare run store, so streaming one model re-renders one column.
  const updateRun = useCompareRunStore((state) => state.update);
  const resetRun = useCompareRunStore((state) => state.reset);
  const resetAllRuns = useCompareRunStore((state) => state.resetAll);
  // A new modal starts clean, and closing it drops the answers.
  useEffect(() => {
    resetAllRuns();
    return resetAllRuns;
  }, [resetAllRuns]);
  const [filterOpen,      setFilterOpen]      = useState(false);
  const [selectedTiers,   setSelectedTiers]   = useState<Set<string>>(new Set());
  const [pastedImages,    setPastedImages]     = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const promptInputRef     = useRef<HTMLTextAreaElement>(null);
  const gridScrollRef      = useRef<HTMLDivElement>(null);
  const audioCtxRef           = useRef<AudioContext | null>(null);
  const streamRef             = useRef<MediaStream | null>(null);
  const preRecordingTextRef   = useRef<string>("");
  const [isRecording,  setIsRecording]  = useState(false);
  const [analyser,     setAnalyser]     = useState<AnalyserNode | null>(null);
  const [isMicHovered, setIsMicHovered] = useState(false);

  const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  // Sync live transcript â†’ prompt synchronously during render to avoid an effect
  // chain (transcript effect sets prompt â†’ layout effect reacts to prompt).
  const prevTranscriptRef = useRef(transcript);
  if (isRecording && prevTranscriptRef.current !== transcript) {
    prevTranscriptRef.current = transcript;
    const base     = preRecordingTextRef.current;
    const combined = base && transcript ? `${base} ${transcript}` : transcript || base;
    setPrompt(combined);
  }
  if (!isRecording) prevTranscriptRef.current = transcript;

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
      SpeechRecognition.abortListening();
    };
  }, []);

  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAtTop(el.scrollTop < 34);
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  }, []);

  const companies = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of models) counts[m.company] = (counts[m.company] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [models]);

  const filteredModels = useMemo(
    () => filterCompareModels(models, { company: activeTab, tiers: selectedTiers, query: searchQuery }),
    [models, activeTab, searchQuery, selectedTiers],
  );

  // â”€â”€ Auto-grow textarea â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useLayoutEffect(() => {
    if (!showResults) return;
    const el = promptInputRef.current;
    if (!el) return;
    const minH = 22;
    const maxH = 22 * 7;
    if (promptInputCollapsed) {
      el.style.height = `${minH}px`;
      el.classList.remove("overflow-y-auto", "kaya-scrollbar");
      return;
    }
    el.style.height = "auto";
    if (el.scrollHeight > maxH) {
      el.style.height = `${maxH}px`;
      el.classList.add("overflow-y-auto", "kaya-scrollbar");
    } else {
      el.style.height = `${Math.max(minH, el.scrollHeight)}px`;
      el.classList.remove("overflow-y-auto", "kaya-scrollbar");
    }
  }, [prompt, showResults, promptInputCollapsed]);


  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleSelect = (model: CompareModel) => {
    if (!model.requestModelId) return;
    if (selectedModels.includes(model.requestModelId)) {
      setSelectedModels((prev) => prev.filter((id) => id !== model.requestModelId));
    } else if (selectedModels.length < 3) {
      setSelectedModels((prev) => [...prev, model.requestModelId!]);
    }
  };

  const handleRemove = (id: string) => {
    setSelectedModels((prev) => prev.filter((mid) => mid !== id));
  };

  const startRecording = async () => {
    if (!browserSupportsSpeechRecognition) return;
    preRecordingTextRef.current = prompt;
    resetTranscript();
    setIsRecording(true);
    SpeechRecognition.startListening({ continuous: true, interimResults: true });

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (ctx.state === "suspended") await ctx.resume();
      const source       = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize               = 256;
      analyserNode.smoothingTimeConstant = 0.75;
      source.connect(analyserNode);
      setAnalyser(analyserNode);
    } catch {
      ctx.close();
      audioCtxRef.current = null;
      SpeechRecognition.abortListening();
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    SpeechRecognition.stopListening();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    streamRef.current   = null;
    audioCtxRef.current = null;
    setAnalyser(null);
    setIsRecording(false);
  };

  const handlePromptButtonClick = () => {
    if (isTesting) { abortControllerRef.current?.abort(); return; }
    if (isRecording) { stopRecording(); return; }
    if (prompt.trim()) handleTestModels();
    else startRecording();
  };

  const handlePromptPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const urls = imageItems
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)
      .map((f) => URL.createObjectURL(f));
    setPastedImages((prev) => [...prev, ...urls]);
  };

  const handleSelectModel = (modelId: string) => {
    const fullModel = fullModels.find((m) => resolveRequestModelId(m) === modelId);
    if (fullModel && onModelSelect) {
      const reqId = resolveRequestModelId(fullModel);
      if (!reqId) return;
      onModelSelect({ ...fullModel, id: reqId, modelId: reqId });
    }
  };

  const { addPin, open: openPinboard } = usePinboardActions();

  const handleSavePin = useCallback((responseKey: string, modelDisplayName: string) => {
    if (!PINS_ENABLED) return;
    const run       = useCompareRunStore.getState().runs[responseKey];
    const content   = run?.response ?? "";
    const messageId = run?.messageId;
    if (!content || !messageId) return;
    const title = content.split("\n")[0].slice(0, 80) || modelDisplayName;
    addPin({ content, title, category: "Quote", messageId, modelName: modelDisplayName });
    trackBrowserEvent("pin_created", { source: "brain" });
    openPinboard();
  }, [addPin, openPinboard]);

  /**
   * Streams `modelIds` in parallel for `trimmedPrompt`. Each model succeeds or
   * fails on its own (errors land in the run's `error`, never in the answer text),
   * so one failure doesn't blank the other columns. Also used by per-model retry.
   */
  const runModels = async (modelIds: string[], trimmedPrompt: string) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsTesting(true);

    const streamingResponses: Record<string, string> = {};
    const reasoningByModel = new Map(modelIds.map((id) => [id, createReasoningAccumulator()]));
    const runModelSet = new Set(modelIds);
    modelIds.forEach((id) => { streamingResponses[id] = ""; });

    // Each write touches one model's entry, so a single-model retry keeps the other answers.
    const publish = (id: string) => updateRun(id, { response: streamingResponses[id] });
    const stopStreaming = (id: string) => updateRun(id, (run) => (run.streaming ? { streaming: false } : {}));
    const failModel = (id: string, message: string) => updateRun(id, { error: message, streaming: false });

    const handleEvent = (eventType: string, payload: Record<string, unknown>, fallbackModelId?: string) => {
      const modelIdStr = resolveModelId(payload) ?? fallbackModelId ?? null;
      if (!modelIdStr || !runModelSet.has(modelIdStr)) return;
      if (!(modelIdStr in streamingResponses)) streamingResponses[modelIdStr] = "";

      // Extract message_id from any event that carries it
      const rawMsgId = payload.message_id ?? payload.messageId ?? null;
      if (typeof rawMsgId === "string" && rawMsgId.trim()) {
        const messageId = rawMsgId.trim();
        updateRun(modelIdStr, (run) => (run.messageId === messageId ? {} : { messageId }));
      }

      switch (eventType) {
        case "content": {
          const chunk = typeof payload.content === "string" ? payload.content : "";
          if (!chunk) return;
          streamingResponses[modelIdStr] = (streamingResponses[modelIdStr] || "") + chunk;
          updateRun(modelIdStr, { response: streamingResponses[modelIdStr], streaming: true });
          break;
        }
        case "reasoning_heading":
        case "reasoning_body": {
          const accumulator = reasoningByModel.get(modelIdStr) ?? createReasoningAccumulator();
          reasoningByModel.set(modelIdStr, accumulator);
          const content = typeof payload.content === "string" ? payload.content : "";
          accumulator.event(eventType, content);
          const snapshot = accumulator.snapshot();
          updateRun(modelIdStr, { reasoning: { text: snapshot.text, sections: snapshot.sections } });
          break;
        }
        case "image": {
          const imageUrl = typeof payload.url === "string" ? payload.url.trim() : "";
          if (!imageUrl) return;
          streamingResponses[modelIdStr] = `${streamingResponses[modelIdStr] || ""}\n\n![image](${imageUrl})`;
          publish(modelIdStr);
          break;
        }
        case "done": {
          const final = typeof payload.response === "string" ? payload.response : "";
          if (final) { streamingResponses[modelIdStr] = final; publish(modelIdStr); }
          const credits = extractCredits(payload);
          if (credits !== null) updateRun(modelIdStr, { credits });
          stopStreaming(modelIdStr);
          break;
        }
        case "error": {
          const errText = typeof payload.error === "string" ? payload.error : "Unknown error";
          failModel(modelIdStr, friendlyModelError(errText));
          break;
        }
        case "tool_connect_prompt": {
          const prompt: ConnectorConnectPrompt = {
            request_id:     typeof payload.prompt_id      === "string" ? payload.prompt_id      : `ccp-${Date.now()}`,
            connector:      toConnector(payload),
            auth_mode:      (typeof payload.auth_mode     === "string" ? payload.auth_mode      : "oauth2") as "oauth2" | "api_key",
            tool_name:      typeof payload.tool_slug      === "string" ? payload.tool_slug      : "",
          };
          updateRun(modelIdStr, (run) => ({ connectPrompts: [...run.connectPrompts, prompt] }));
          break;
        }
        case "permission_prompt": {
          const prompt = parsePermissionPrompt(payload);
          if (!prompt) break;
          updateRun(modelIdStr, (run) => ({ permissionPrompts: [...run.permissionPrompts, prompt] }));
          break;
        }
      }
    };

    const processDecodedEvent = (event: DecodedSSEEvent, fallbackModelId?: string) => {
      if (!event.appEvent) return;
      const rawEvent = event.raw.rawEvent;
      const modelTag = rawEvent && typeof rawEvent === "object"
        ? rawEvent as Record<string, unknown>
        : {};
      handleEvent(
        event.appEvent.eventName,
        { ...event.raw, ...modelTag, ...event.appEvent.parsed },
        fallbackModelId,
      );
    };

    const streamOne = async (modelId: string) => {
      const resp = await apiFetch(`${MODELS_ENDPOINT}/test`, {
        method: "POST",
        body: JSON.stringify({
          model_ids: [modelId],
          prompt:    trimmedPrompt,
          modelIds:  [modelId],
          message:   trimmedPrompt,
        }),
        signal:  controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!resp.ok) { failModel(modelId, httpErrorMessage(resp.status)); return; }

      if (!resp.body) { failModel(modelId, NETWORK_ERROR_MESSAGE); return; }
      await readAguiStream(resp.body, (event) => processDecodedEvent(event, modelId));
    };

    try {
      await Promise.all(modelIds.map(async (modelId) => {
        try {
          await streamOne(modelId);
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") { stopStreaming(modelId); return; }
          console.error("Error testing model:", modelId, error);
          failModel(modelId, NETWORK_ERROR_MESSAGE);
        }
      }));
    } finally {
      modelIds.forEach(stopStreaming);
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsTesting(false);
    }
  };

  const handleTestModels = async () => {
    if (!prompt.trim() || selectedModels.length < 2 || isTesting) return;

    const trimmedPrompt = prompt.trim();
    setLastPrompt(trimmedPrompt);
    setPromptInputCollapsed(true);
    setPrompt("");
    resetAllRuns();
    // Revoke object URLs for pasted images to avoid memory leaks
    setPastedImages((prev) => { prev.forEach((url) => URL.revokeObjectURL(url)); return []; });

    const modelIds   = selectedModels.map((id) => id.trim()).filter((id) => id.length > 0);
    const invalidIds = modelIds.filter((id) => !isValidUUID(id));
    if (modelIds.length === 0 || invalidIds.length > 0) {
      const message = `Invalid model ID selected (${invalidIds.join(", ") || "none"}).`;
      selectedModels.forEach((id) => updateRun(id, { error: message }));
      return;
    }

    await runModels(modelIds, trimmedPrompt);
  };

  /** Re-runs one model with the last prompt, keeping the other columns as they are. */
  const handleRetryModel = (modelId: string) => {
    if (isTesting || !lastPrompt) return;
    resetRun(modelId);
    void runModels([modelId], lastPrompt);
  };

  // â”€â”€ Results view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (showResults) {
    const modelsToShow = selectedModels
      .map((id) => models.find((m) => m.requestModelId === id))
      .filter((c): c is CompareModel => Boolean(c));

    const expandedModel = expandedModelId
      ? (modelsToShow.find((m) => m.requestModelId === expandedModelId) ?? null)
      : null;

    const handleGoBack = () => { setShowResults(false); setExpandedModelId(null); };

    return (
      <div style={{
        width:         1212,
        height:        "98vh",
        maxHeight:     "98vh",
        borderRadius:  20,
        background:    "var(--neutral-50)",
        boxShadow:     DIALOG_SHADOW,
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        padding:       8,
        boxSizing:     "border-box",
      }}>
        {/* Inner wrapper */}
        <div style={{
          borderRadius:  20,
          display:       "flex",
          flexDirection: "column",
          gap:           12,
          flex:          1,
          minHeight:     0,
          padding:       16,
          overflow:      "hidden",
        }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingLeft: 4, flex: 1, minWidth: 0 }}>
              <button
                onClick={handleGoBack}
                aria-label="Back"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: 10, border: "none", backgroundColor: "transparent", cursor: "pointer", flexShrink: 0 }}
              >
                <ArrowLeftOneIcon animated size={20} color={PRIMARY} />
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, justifyContent: "center", flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-title)", fontWeight: 400, fontSize: 24, lineHeight: "32px", color: PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Compare results
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 14, lineHeight: "22px", color: PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Analyze model performance across your test prompts.
                </div>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 8, border: "none", backgroundColor: "transparent", cursor: "pointer", flexShrink: 0 }}
              >
                <CancelOneIcon animated size={20} color={SECONDARY} />
              </button>
            )}
          </div>

          {/* Content: expanded tab view OR normal columns tray */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {expandedModelId ? (
              /* â”€â”€ Expanded tab view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
              <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 16, backgroundColor: "color-mix(in srgb, var(--static-white) 50%, transparent)", boxShadow: TRAY_BG_SHADOW, padding: 12 }}>
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden", background: "var(--neutral-100)", boxShadow: CARD_SHADOW }}>
                  {/* Tabs header */}
                  <div style={{ display: "flex", alignItems: "stretch", background: "var(--neutral-100)", flexShrink: 0 }}>
                    {/* Collapse button */}
                    <div style={{ display: "flex", alignItems: "center", paddingLeft: 12, paddingRight: 4, paddingTop: 10, paddingBottom: 10, flexShrink: 0 }}>
                      <button
                        onClick={() => setExpandedModelId(null)}
                        aria-label="Collapse"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: 10, border: "none", backgroundColor: "transparent", cursor: "pointer" }}
                      >
                        <ArrowShrinkTwoIcon animated size={20} color={SECONDARY} />
                      </button>
                    </div>
                    {/* Tab items */}
                    {modelsToShow.map((model) => {
                      const isActive = model.requestModelId === expandedModelId;
                      const llmId = getModelLlmId(model.companyName, model.rawModelName) ?? "";
                      if (isActive) {
                        return (
                          <div key={model.id} style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, backgroundColor: "var(--neutral-white)", borderRadius: "8px 8px 0 0", flexShrink: 0 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, padding: 8, flexShrink: 0, backgroundColor: "color-mix(in srgb, var(--static-white) 0%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                              <ThemedLlmIcon id={llmId} size={24} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", height: 44, justifyContent: "center", paddingRight: 8, flexShrink: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: PRIMARY, whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
                                {model.displayName}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <button
                          key={model.id}
                          onClick={() => setExpandedModelId(model.requestModelId)}
                          style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, backgroundColor: "var(--neutral-100)", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", flexShrink: 0 }}
                        >
                          <div style={{ width: 44, height: 44, borderRadius: 10, padding: 8, flexShrink: 0, backgroundColor: "color-mix(in srgb, var(--static-white) 0%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            <ThemedLlmIcon id={llmId} size={24} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", height: 44, justifyContent: "center", paddingRight: 8, flexShrink: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: PRIMARY, whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
                              {model.displayName}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    <div style={{ flex: 1 }} />
                  </div>
                {/* Expanded content panel */}
                <AnimatePresence mode="wait" initial={false}>
                {expandedModel && (() => {
                  const responseKey      = expandedModel.requestModelId ?? expandedModel.id;
                  return (
                    <m.div
                      key={expandedModelId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={springs.fast}
                      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12, padding: 12, background: "var(--neutral-white)", borderRadius: 8 }}
                    >
                      <ModelRunView runKey={responseKey} modelName={expandedModel.modelName} testing={isTesting} onRetry={handleRetryModel} expanded />
                      {/* Bottom action bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                          <RunCredits runKey={responseKey} />
                        </div>
                        {/* Use this model */}
                        <Button
                          variant="default"
                          size="md"
                          onClick={() => handleSelectModel(expandedModel.requestModelId ?? expandedModel.id)}
                          leftIcon={<TickTwoIcon animated size={16} />}
                        >
                          Use this model
                        </Button>
                      </div>
                    </m.div>
                  );
                })()}
                </AnimatePresence>
                </div>
              </div>
            ) : (
              /* â”€â”€ Normal columns tray â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
              <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", gap: 12, padding: 12, borderRadius: 16, backgroundColor: "color-mix(in srgb, var(--static-white) 50%, transparent)", boxShadow: TRAY_BG_SHADOW }}>
                {modelsToShow.map((model) => {
                  const responseKey      = model.requestModelId ?? model.id;
                  const llmId            = getModelLlmId(model.companyName, model.rawModelName) ?? "";
                  return (
                    <div key={model.id} style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: 8, backgroundColor: "var(--neutral-white)", boxShadow: CARD_SHADOW, display: "flex", flexDirection: "column", gap: 10, padding: 12, boxSizing: "border-box" }}>
                      {/* Column header */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
                        <div style={{ display: "flex", flex: 1, alignItems: "flex-start", gap: 6, minWidth: 0 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, padding: 8, flexShrink: 0, backgroundColor: "color-mix(in srgb, var(--static-white) 0%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            <ThemedLlmIcon id={llmId} size={24} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, minWidth: 0, alignSelf: "stretch" }}>
                            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
                              {model.displayName}
                            </div>
                            {((model.tags && model.tags.length > 0) || (model.thinkingEfforts && model.thinkingEfforts.length > 0)) && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                                {model.thinkingEfforts?.map((e) => (
                                  <Chip key={`effort-${e}`} label={e} color="purple" />
                                ))}
                                {model.tags?.map((tag) => (
                                  <Chip key={tag} label={tag} color={compareTagColor(tag)} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setExpandedModelId(model.requestModelId)}
                          aria-label="Expand"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: 10, border: "none", backgroundColor: "transparent", cursor: "pointer", flexShrink: 0 }}
                        >
                          <ArrowExpandOneIcon animated size={20} color={SECONDARY} />
                        </button>
                      </div>
                      {/* Use this model button */}
                      <div style={{ flexShrink: 0 }}>
                        <Button
                          variant="default"
                          size="md"
                          fluid
                          onClick={() => handleSelectModel(model.requestModelId ?? model.id)}
                          leftIcon={<TickTwoIcon animated size={16} />}
                        >
                          Use this model
                        </Button>
                      </div>
                      <ModelRunView runKey={responseKey} modelName={model.modelName} testing={isTesting} onRetry={handleRetryModel} />
                      {/* Bottom bar: credits */}
                      <RunCredits runKey={responseKey} bar />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat input */}
          <div style={{ flexShrink: 0, paddingLeft: 9, paddingRight: 9 }}>
            <div style={{ borderRadius: 12, border: "1px solid rgba(59,54,50,0.1)", boxShadow: CARD_SHADOW, backgroundColor: "var(--neutral-white)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Pasted image thumbnails */}
              {pastedImages.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {pastedImages.map((url, i) => (
                    <div key={url} style={{ position: "relative", width: 56, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0, boxShadow: "0 0 0 1px rgba(59,54,50,0.12)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- object URL, not a remote URL */}
                      <img src={url} alt={`Pasted image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        type="button"
                        onClick={() => setPastedImages((prev) => { URL.revokeObjectURL(url); return prev.filter((u) => u !== url); })}
                        aria-label="Remove pasted image"
                        style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--neutral-900) 70%, transparent)", color: "var(--static-white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontSize: 10, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <textarea
                ref={promptInputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setPromptInputCollapsed(false)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!isTesting) handleTestModels(); } }}
                onPaste={handlePromptPaste}
                placeholder={isRecording ? "Listening..." : "How can I help you today?"}
                disabled={isTesting}
                rows={1}
                style={{ flex: 1, fontSize: 16, fontWeight: 400, lineHeight: "22px", color: prompt ? "var(--neutral-900)" : "var(--neutral-600)", fontFamily: "var(--font-body)", background: "none", border: "none", outline: "none", resize: "none", minHeight: 22, opacity: isTesting ? 0.6 : 1 }}
              />
              <span
                onMouseEnter={() => setIsMicHovered(true)}
                onMouseLeave={() => setIsMicHovered(false)}
                style={{ display: "inline-flex", flexShrink: 0 }}
              >
                <IconButton
                  variant="default"
                  size="md"
                  aria-label={isTesting ? "Stop generation" : isRecording ? "Stop recording" : prompt.trim() ? "Send" : "Start recording"}
                  onClick={handlePromptButtonClick}
                  icon={
                    <AnimatePresence mode="popLayout" initial={false}>
                      {(() => {
                        const iconKey = isTesting
                          ? "stop-gen"
                          : isRecording
                            ? (isMicHovered ? "stop-rec" : "wave")
                            : prompt.trim() ? "send" : "mic";
                        const isWave = iconKey === "wave";
                        return (
                          <m.span
                            key={iconKey}
                            initial={isWave ? { scale: 0.5, opacity: 0 } : { scale: 0.5, opacity: 0, filter: "blur(4px)" }}
                            animate={isWave ? { scale: 1,   opacity: 1 } : { scale: 1,   opacity: 1, filter: "blur(0px)" }}
                            exit={{ scale: 0.5, opacity: 0, filter: "blur(4px)" }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            {isTesting
                              ? <StopCircleIcon size={20} />
                              : isRecording
                                ? isMicHovered
                                  ? <StopCircleIcon size={20} />
                                  : <AudioWaveDisplay analyser={analyser} size={20} />
                                : prompt.trim()
                                  ? <ArrowUpTwoIcon size={20} animated triggered={isMicHovered} />
                                  : <MicTwoIcon size={20} />
                            }
                          </m.span>
                        );
                      })()}
                    </AnimatePresence>
                  }
                />
              </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // â”€â”€ Compare & Select view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div style={{
      width:         1212,
      height:        "98vh",
      maxHeight:     "98vh",
      borderRadius:  20,
      background:    "var(--neutral-50)",
      boxShadow:     DIALOG_SHADOW,
      display:       "flex",
      flexDirection: "column",
      overflow:      "hidden",
      padding:       8,
      boxSizing:     "border-box",
    }}>
      {/* Inner content wrapper */}
      <div style={{
        borderRadius:  20,
        background:    "var(--neutral-50)",
        padding:       16,
        display:       "flex",
        flexDirection: "column",
        gap:           12,
        flex:          1,
        minHeight:     0,
        overflow:      "hidden",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{
              fontFamily:   "var(--font-title)",
              fontWeight:   400,
              fontSize:     24,
              lineHeight:   "32px",
              color:        PRIMARY,
              overflow:     "hidden",
              textOverflow: "ellipsis",
              whiteSpace:   "nowrap",
            }}>
              Compare Models
            </div>
            <div style={{ fontSize: 14, fontWeight: 400, lineHeight: "22px", color: PRIMARY, fontFamily: "var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Select models to compare
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                padding:         6,
                borderRadius:    8,
                border:          "none",
                backgroundColor: "transparent",
                display:         "flex",
                alignItems:      "center",
                justifyContent:  "center",
                cursor:          "pointer",
                flexShrink:      0,
              }}
            >
              <X size={20} color={SECONDARY} />
            </button>
          )}
        </div>

        {/* Scrollable main area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>

          {/* Tabs + search row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {/* Available Models label / Search input */}
            {!showSearch ? (
              <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500, lineHeight: "22px", color: PRIMARY, fontFamily: "var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Available Models
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  style={{
                    width:        "100%",
                    padding:      "7px 36px 7px 10px",
                    borderRadius: 10,
                    border:       "none",
                    outline:      "none",
                    background:   "var(--field-surface)",
                    boxShadow:    "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)",
                    fontFamily:   "var(--font-body)",
                    fontSize:     "var(--font-size-body)",
                    lineHeight:   "var(--line-height-body)",
                    color:        "var(--neutral-700)",
                  }}
                />
                <button
                  onClick={() => { setSearchQuery(""); setShowSearch(false); }}
                  aria-label="Clear search"
                  style={{
                    position:        "absolute",
                    right:           8,
                    top:             "50%",
                    transform:       "translateY(-50%)",
                    padding:         3,
                    borderRadius:    4,
                    border:          "none",
                    backgroundColor: "transparent",
                    display:         "flex",
                    alignItems:      "center",
                    cursor:          "pointer",
                  }}
                >
                  <X size={14} color={TERTIARY} />
                </button>
              </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList size="small">
                <TabsTrigger value="all" icon={<AtomTwoIcon size={16} />}>
                  All
                </TabsTrigger>
                {companies.map((company) => {
                  const repModel = models.find((m) => m.company === company);
                  const repLlmId = repModel ? (getModelLlmId(repModel.companyName, repModel.rawModelName) ?? "") : "";
                  return (
                    <TabsTrigger
                      key={company}
                      value={company}
                      icon={repLlmId ? <ThemedLlmIcon id={repLlmId} size={16} /> : undefined}
                    >
                      {company}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            {/* Search + Filter buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery(""); }}
                aria-label={showSearch ? "Close search" : "Search models"}
                style={{ padding: 6, borderRadius: 8, border: "none", backgroundColor: "transparent", display: "flex", alignItems: "center", cursor: "pointer" }}
              >
                <SearchOneIcon animated size={20} color={SECONDARY} />
              </button>
              <Dropdown.Float
                trigger={
                  <button
                    aria-label="Filter models"
                    style={{ padding: 6, borderRadius: 8, border: "none", backgroundColor: "transparent", display: "flex", alignItems: "center", cursor: "pointer" }}
                  >
                    <FilterMailIcon animated size={20} color={selectedTiers.size > 0 ? PRIMARY : SECONDARY} />
                  </button>
                }
                open={filterOpen}
                onOpenChange={setFilterOpen}
                placement="bottom-end"
              >
                <Dropdown size="sm" maxHeight={false}>
                  <Dropdown.Section label="Tier" fluid>
                    {([
                      { id: "starter", label: "Starter" },
                      { id: "pro",     label: "Pro"     },
                      { id: "power",   label: "Power"   },
                    ] as { id: string; label: string; disabled?: boolean }[]).map((tier, i) => (
                      <m.div key={tier.id} {...dropdownItemStagger(i)}>
                        <Dropdown.Item
                          label={tier.label}
                          showCheckbox
                          checkboxChecked={selectedTiers.has(tier.id)}
                          onCheckboxChange={() => {
                            setSelectedTiers((prev) => {
                              const next = new Set(prev);
                              if (next.has(tier.id)) next.delete(tier.id); else next.add(tier.id);
                              return next;
                            });
                          }}
                          disabled={tier.disabled}
                          fluid
                        />
                      </m.div>
                    ))}
                  </Dropdown.Section>
                </Dropdown>
              </Dropdown.Float>
            </div>
          </div>

          {/* Card grid */}
          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <div
            ref={gridScrollRef}
            className="kaya-scrollbar"
            onScroll={handleGridScroll}
            style={{
              position:            "absolute",
              inset:               0,
              overflowY:           "auto",
              overscrollBehaviorY: "contain",
              padding:             2,
            }}
          >
            {isLoading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  // eslint-disable-next-line react/no-array-index-as-key
                  <div key={idx} style={{
                    borderRadius: 16, boxShadow: CARD_SHADOW,
                    backgroundColor: "var(--neutral-100)", display: "flex", flexDirection: "column",
                    gap: 12, padding: 12, boxSizing: "border-box",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "var(--legacy-d5c9c0)" }} className="animate-pulse" />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ height: 16, borderRadius: 4, backgroundColor: "var(--legacy-d5c9c0)", width: "60%" }} className="animate-pulse" />
                        <div style={{ height: 11, borderRadius: 4, backgroundColor: "var(--legacy-d5c9c0)", width: "40%" }} className="animate-pulse" />
                      </div>
                    </div>
                    <div style={{ height: 48, borderRadius: 4, backgroundColor: "var(--legacy-d5c9c0)" }} className="animate-pulse" />
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ height: 20, width: 64, borderRadius: 6, backgroundColor: "var(--legacy-d5c9c0)" }} className="animate-pulse" />
                      <div style={{ height: 20, width: 56, borderRadius: 6, backgroundColor: "var(--legacy-d5c9c0)" }} className="animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredModels.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, fontSize: 14, color: TERTIARY, fontFamily: "var(--font-body)" }}>
                No models available
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {filteredModels.map((model) => {
                  const isSelected = !!model.requestModelId && selectedModels.includes(model.requestModelId);
                  const isDisabled = (selectedModels.length >= 3 && !isSelected) || !model.requestModelId;
                  return (
                    <ModelCard
                      key={model.id}
                      model={model}
                      isSelected={isSelected}
                      isDisabled={isDisabled}
                      onClick={() => handleSelect(model)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Top blur */}
          {[{ height: 40, blur: 2 }, { height: 28, blur: 3 }, { height: 18, blur: 5 }, { height: 10, blur: 6 }]
            .map(({ height, blur }) => (
              <div key={blur} aria-hidden style={{
                position:             "absolute",
                top: 0, left: 0, right: 0,
                height:               `${height}px`,
                backdropFilter:       `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage:            "linear-gradient(to bottom, black 0%, transparent 100%)",
                WebkitMaskImage:      "linear-gradient(to bottom, black 0%, transparent 100%)",
                pointerEvents:        "none",
                zIndex:               10,
                opacity:              atTop ? 0 : 1,
                transition:           "opacity 150ms ease",
              }} />
            ))}
          <div aria-hidden style={{
            position:      "absolute",
            top:           0, left: 0, right: 0,
            height:        "40px",
            background:    "linear-gradient(to bottom, var(--neutral-white) 0%, transparent 100%)",
            pointerEvents: "none",
            zIndex:        11,
            opacity:       atTop ? 0 : 1,
            transition:    "opacity 150ms ease",
          }} />

          {/* Bottom blur */}
          {[{ height: 40, blur: 2 }, { height: 28, blur: 3 }, { height: 18, blur: 5 }, { height: 10, blur: 6 }]
            .map(({ height, blur }) => (
              <div key={blur} aria-hidden style={{
                position:             "absolute",
                bottom: 0, left: 0, right: 0,
                height:               `${height}px`,
                backdropFilter:       `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage:            "linear-gradient(to top, black 0%, transparent 100%)",
                WebkitMaskImage:      "linear-gradient(to top, black 0%, transparent 100%)",
                pointerEvents:        "none",
                zIndex:               10,
                opacity:              atBottom ? 0 : 1,
                transition:           "opacity 150ms ease",
              }} />
            ))}
          <div aria-hidden style={{
            position:      "absolute",
            bottom:        0, left: 0, right: 0,
            height:        "40px",
            background:    "linear-gradient(to top, var(--neutral-white) 0%, transparent 100%)",
            pointerEvents: "none",
            zIndex:        11,
            opacity:       atBottom ? 0 : 1,
            transition:    "opacity 150ms ease",
          }} />
          </div>
        </div>

        {/* Bottom section: tray + footer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>

          {/* Model selection tray */}
          <div style={{ padding: 1 }}>
            <div style={{
              position:        "relative",
              display:         "flex",
              alignItems:      "stretch",
              justifyContent:  "center",
              gap:             8,
              padding:         "8px 16px",
              borderRadius:    10,
              backgroundColor: "var(--neutral-50-50)",
            }}>
              <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10 }}>
                <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 10, backgroundColor: "var(--neutral-50-50)" }} />
                <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", boxShadow: TRAY_BG_SHADOW }} />
              </div>
              {[0, 1, 2].map((slotIndex) => {
                const i = slotIndex;
                const modelId = selectedModels[i];
                const model   = models.find((m) => m.requestModelId === modelId);
                const llmId   = model ? (getModelLlmId(model.companyName, model.rawModelName) ?? "") : "";
                return model ? (
                  <div key={`slot-${slotIndex}`} style={{
                    position:        "relative",
                    flex:            1,
                    alignSelf:       "stretch",
                    display:         "flex",
                    alignItems:      "center",
                    gap:             8,
                    borderRadius:    8,
                    backgroundColor: "var(--neutral-white)",
                    boxShadow:       SLOT_SHADOW,
                    padding:         12,
                    boxSizing:       "border-box",
                    overflow:        "hidden",
                  }}>
                    <div style={{ display: "flex", flex: 1, alignItems: "center", minWidth: 0 }}>
                      <div style={{ display: "flex", flex: 1, gap: 12, alignItems: "center", minWidth: 0 }}>
                        <div style={{
                          width:           44,
                          height:          44,
                          borderRadius:    10,
                          padding:         8,
                          flexShrink:      0,
                          backgroundColor: "color-mix(in srgb, var(--static-white) 0%, transparent)",
                          display:         "flex",
                          alignItems:      "center",
                          justifyContent:  "center",
                          overflow:        "hidden",
                        }}>
                          <ThemedLlmIcon id={llmId} size={24} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
                            {model.company}/{model.modelName}
                          </div>
                          {((model.tags && model.tags.length > 0) || (model.thinkingEfforts && model.thinkingEfforts.length > 0)) && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                              {model.thinkingEfforts?.map((e) => (
                                <Chip key={`effort-${e}`} label={e} color="purple" />
                              ))}
                              {model.tags?.map((tag) => (
                                <Chip key={tag} label={tag} color={compareTagColor(tag)} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      <button
                        onClick={() => handleRemove(modelId)}
                        aria-label="Remove model"
                        style={{
                          display:         "flex",
                          alignItems:      "center",
                          justifyContent:  "center",
                          padding:         3,
                          borderRadius:    6,
                          border:          "none",
                          backgroundColor: "transparent",
                          cursor:          "pointer",
                        }}
                      >
                        <X size={18} color={SECONDARY} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={`slot-empty-${slotIndex}`} style={{
                    position:     "relative",
                    flex:         1,
                    alignSelf:    "stretch",
                    display:      "flex",
                    alignItems:   "center",
                    borderRadius: 8,
                    padding:      12,
                    boxSizing:    "border-box",
                    overflow:     "hidden",
                  }}>
                    <div aria-hidden style={{
                      position:      "absolute",
                      inset:         0,
                      borderRadius:  8,
                      border:        "1px dashed var(--neutral-400)",
                      pointerEvents: "none",
                    }} />
                    <div style={{ display: "flex", flex: 1, gap: 12, alignItems: "center", minWidth: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 4, border: "1px dashed var(--border-default)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
                          Empty Slot {i + 1}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer action bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Chip label={`${selectedModels.length} of 3 selected`} color="neutral" noCapitalize />
            <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, lineHeight: "22px", color: PRIMARY, fontFamily: "var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Pick up-to 3 models to compare
            </div>
            <Button
              variant="default"
              size="md"
              disabled={selectedModels.length < 2}
              onClick={() => selectedModels.length >= 2 && setShowResults(true)}
              rightIcon={
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M8.5 4l4.5 4-4.5 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            >
              Test models
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
