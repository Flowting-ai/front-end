"use client";
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, type JSX } from "react";
import Image from "next/image";
import { m, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/springs";
import { Dropdown, dropdownItemStagger } from "@/components/Dropdown";
import styles from "./compareModels.module.css";
import { Sparkles, ExternalLink, Mail, X } from "lucide-react";
import { LlmIcon } from "@strange-huge/icons/llm";
import { AtomTwoIcon, FilterMailIcon, PinIcon, TickTwoIcon, SearchOneIcon, ArrowLeftOneIcon, CancelOneIcon, ArrowExpandOneIcon, ArrowShrinkTwoIcon, ArrowUpTwoIcon, MicTwoIcon, StopCircleIcon } from "@strange-huge/icons";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { AudioWaveDisplay } from "@/components/shared/AudioWaveDisplay";
import { Tabs, TabsList, TabsTrigger } from "@/components/Tabs";
import type { AIModel } from "@/types/ai-model";
import { fetchModelsWithCache } from "@/lib/ai-models";
import { MODELS_ENDPOINT } from "@/lib/config";
import { getModelLlmId } from "@/lib/model-icons";
import { apiFetch } from "@/lib/api/client";
import { usePinboardActions } from "@/context/pinboard-context";
import { ConnectPromptCard, PermissionPromptCard } from "@/components/chat/ConnectorPrompts";
import type { ConnectorConnectPrompt, ConnectorPermissionPrompt } from "@/hooks/use-chat-state";
import katex from "katex";
import "katex/dist/katex.min.css";
import { sanitizeKaTeX, sanitizeURL } from "@/lib/security";
import { isValidUUID, normalizeUuid } from "@/lib/normalizers/normalize-utils";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { BreathingDot } from "@/components/BreathingDot";

// â”€â”€ Design tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ChipColor = "neutral" | "green" | "brown" | "red" | "blue" | "purple";

const CHIP_COLORS: Record<ChipColor, { bg: string; text: string }> = {
  neutral: { bg: "#EDE1D7", text: "#524B47" },
  green:   { bg: "#F7FEE6", text: "#456211" },
  brown:   { bg: "#E6D5CA", text: "#683D1B" },
  red:     { bg: "#FFBFB6", text: "#7A201C" },
  blue:    { bg: "#CADCF1", text: "#135487" },
  purple:  { bg: "#EDE9FE", text: "#5B21B6" },
};

const CHIP_SHADOW: Record<ChipColor, string> = {
  neutral: "0px 1px 1.5px 0px rgba(18,12,8,0.2),0px 0px 0px 1px rgba(106,98,93,0.5)",
  brown:   "0px 1px 1.5px 0px rgba(20,12,5,0.2),0px 0px 0px 1px rgba(126,84,53,0.5)",
  red:     "0px 1px 1.5px 0px rgba(24,2,2,0.2),0px 0px 0px 1px rgba(159,38,35,0.5)",
  green:   "0px 1px 1.5px 0px rgba(17,25,1,0.2),0px 0px 0px 1px rgba(128,183,7,0.5)",
  blue:    "0px 1px 1.5px 0px rgba(2,15,24,0.2),0px 0px 0px 1px rgba(13,110,178,0.5)",
  purple:  "0px 1px 1.5px 0px rgba(10,2,24,0.2),0px 0px 0px 1px rgba(109,40,217,0.5)",
};

const CHIP_INNER: Record<ChipColor, string> = {
  neutral: "inset 0px 1px 0px 0px rgba(247,242,237,0.7),inset 0px -1px 0px 0px rgba(106,98,93,0.1)",
  brown:   "inset 0px 1px 0px 0px rgba(250,241,235,0.7),inset 0px -1px 0px 0px rgba(126,84,53,0.1)",
  red:     "inset 0px 1px 0px 0px rgba(253,231,231,0.7),inset 0px -1px 0px 0px rgba(159,38,35,0.1)",
  green:   "inset 0px 1px 0px 0px rgba(247,254,230,0.7),inset 0px -1px 0px 0px rgba(128,183,7,0.1)",
  blue:    "inset 0px 1px 0px 0px rgba(231,244,253,0.7),inset 0px -1px 0px 0px rgba(13,110,178,0.1)",
  purple:  "inset 0px 1px 0px 0px rgba(237,233,254,0.7),inset 0px -1px 0px 0px rgba(109,40,217,0.1)",
};

const CARD_SHADOW        = "0px 2px 2.8px 0px rgba(82,75,71,0.12),0px 0px 0px 1px #EDE1D7";
const CARD_SHADOW_RAISED = "0px 1px 1.5px 0px rgba(82,75,71,0.12),0px 0px 0px 1px rgba(182,172,164,0.4),0px 2px 2.8px 0px rgba(82,75,71,0.12),0px 0px 0px 1px #EDE1D7";
const CARD_INSET         = "inset 0px 1px 0px 0px rgba(247,242,237,0.61),inset 0px -1px 0px 0px rgba(106,98,93,0.05)";
const CARD_BORDER        = "1px solid #EDE1D7";
const PRIMARY            = "#26211E";
const SECONDARY          = "#524B47";
const TERTIARY           = "#827A74";
const ICON_BTN_BG        = "#F7F2ED";
const RESP_BORDER        = "#E5DAD0";
const DARK_GRADIENT      = "linear-gradient(180deg, #524B47 0%, #3B3632 100%)";
const DIALOG_SHADOW      = "0px 19px 32px 0px rgba(18,12,8,0.15),0px 2px 2.8px 0px rgba(130,122,116,0.1),0px 0px 0px 1px #EDE1D7";
const TRAY_BG_SHADOW     = "inset 0px -1px 0px 0px rgba(255,255,255,0.9),inset 0px 1px 0px 0px #EDE1D7,inset 0px 0px 4px 0px rgba(209,198,189,0.5)";
const SLOT_SHADOW        = "0px 0px 0px 1px rgba(182,172,164,0.4),0px 2px 2.8px 0px rgba(82,75,71,0.12),0px 0px 0px 1px #EDE1D7";
const BTN_SHADOW         = "0px 0px 0px 1px #3B3632,0px 1.091px 1.091px 0px rgba(59,54,50,0.1),0px 1.455px 3.127px 0px rgba(59,54,50,0.4)";
const BTN_INSET          = "inset 0px 1.455px 0.364px 0px #6A625D,inset 0px -2.182px 0.364px 0px #3B3632,inset 0px -2.545px 6.9px -2.182px #827A74";

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
    <div style={{ width: 8, height: 8, background: "#EDE1D7", overflow: "hidden", position: "relative", flexShrink: 0, alignSelf: "flex-end" }}>
      <div style={{
        position:     "absolute",
        top:          0,
        [side === "left" ? "left" : "right"]: 0,
        width:        16,
        height:       16,
        borderRadius: "50%",
        background:   "#FFFFFF",
      }} />
    </div>
  );
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface CompareModel {
  id:             string;
  requestModelId: string | null;
  displayName:    string;
  company:        string;
  modelName:      string;
  description:    string;
  tierLabel:      string;
  contextLabel:   string;
  featureLabel:   string | null;
  companyName:    string;
  rawModelName:   string;
  type:           string;
}

// â”€â”€ Model transform â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const resolveRequestModelId = (model: AIModel): string | null =>
  normalizeUuid(model.id) ?? normalizeUuid(model.modelId);

function formatCtx(limit: number): string {
  if (!limit || limit <= 0) return "N/A";
  if (limit >= 1_000_000) return `${Math.round(limit / 1_000_000)}M ctx`;
  if (limit >= 1_000)     return `${Math.round(limit / 1_000)}k ctx`;
  return `${limit} ctx`;
}

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
    contextLabel:   formatCtx(model.inputLimit ?? 0),
    featureLabel:   type === "video" ? "Video generation"
                  : type === "image" ? "Image generation"
                  : null,
    companyName:    company,
    rawModelName:   modelName,
    type,
  };
};

// â”€â”€ Markdown rendering helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FAVICON_BASE = "https://www.google.com/s2/favicons?sz=32&domain=";

const headingClassByLevel: Record<number, string> = {
  1: "text-2xl", 2: "text-xl", 3: "text-lg",
  4: "text-base", 5: "text-sm", 6: "text-xs",
};

const isTableDivider = (line: string) =>
  /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line.trim());

const isTableRow = (line: string) => {
  const t = line.trim();
  return t.startsWith("|") && t.includes("|", 1);
};

const parseTableRow = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

const getHostname = (url: string): string => {
  try { return new URL(url).hostname; } catch { return ""; }
};

const renderLatexInlineContent = (text: string, keyPrefix: string) => {
  const nodes: Array<string | JSX.Element> = [];
  const latexRegex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let latexCount = 0;

  while ((match = latexRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderBoldInlineContent(text.slice(lastIndex, match.index), `${keyPrefix}-pre-${latexCount}`));
    }
    const blockContent  = match[1] ?? match[2];
    const inlineContent = match[3] ?? match[4];
    const isBlock       = Boolean(blockContent);
    const latexContent  = (isBlock ? blockContent : inlineContent) ?? "";
    try {
      const html = katex.renderToString(latexContent, { throwOnError: false, displayMode: isBlock });
      nodes.push(
        <span key={`${keyPrefix}-latex-${latexCount++}`}
          className={isBlock ? "block my-2" : "inline-block mx-0.5"}
          dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }}
        />,
      );
    } catch {
      nodes.push(
        <code key={`${keyPrefix}-latex-err-${latexCount++}`} className="bg-red-100 text-red-800 px-1 rounded">
          {match[0]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(...renderBoldInlineContent(text.slice(lastIndex), `${keyPrefix}-post`));
  if (nodes.length === 0) nodes.push(...renderBoldInlineContent(text, `${keyPrefix}-all`));
  return nodes;
};

const renderBoldInlineContent = (text: string, keyPrefix: string) => {
  const markdownRegex = /(\*\*\*|___)([\s\S]+?)\1|(\*\*|__)([\s\S]+?)\3|\*([^*\n]+?)\*|`([^`\n]+)`/g;
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = markdownRegex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if      (match[2] !== undefined) nodes.push(<strong key={`${keyPrefix}-bi-${count++}`} className="font-semibold text-[#26211E]"><em>{match[2]}</em></strong>);
    else if (match[4] !== undefined) nodes.push(<strong key={`${keyPrefix}-bold-${count++}`} className="font-semibold text-[#26211E]">{match[4]}</strong>);
    else if (match[5] !== undefined) nodes.push(<em key={`${keyPrefix}-em-${count++}`}>{match[5]}</em>);
    else if (match[6] !== undefined) nodes.push(<code key={`${keyPrefix}-code-${count++}`} className="rounded bg-[#F4F4F5] px-1 py-0.5 font-mono text-[0.875em] text-[#26211E]">{match[6]}</code>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  if (nodes.length === 0) nodes.push(text);
  return nodes;
};

const SimpleLinkPreview = ({ url, label, k }: { url: string; label?: string; k: string }) => {
  const normalizedUrl = sanitizeURL(url.trim());
  const hostname      = getHostname(normalizedUrl) || normalizedUrl;
  const displayLabel  = (label || hostname || normalizedUrl).trim();
  const faviconSrc    = hostname ? `${FAVICON_BASE}${encodeURIComponent(hostname)}` : "";
  return (
    <a key={k} href={normalizedUrl.startsWith("http") ? normalizedUrl : `https://${normalizedUrl}`}
      target="_blank" rel="noopener noreferrer"
      className="group inline-flex items-center gap-1 rounded-full border border-[#EDE1D7] bg-[#F7F2ED] px-2 py-0.5 text-xs font-medium text-[#26211E] hover:bg-[#EDE1D7] transition-all duration-200 max-w-full align-middle"
    >
      {faviconSrc && <Image src={faviconSrc} alt="" width={14} height={14} className="h-3.5 w-3.5 shrink-0 rounded-sm" unoptimized />}
      <span className="truncate max-w-50">{displayLabel}</span>
      <ExternalLink size={12} className="shrink-0 opacity-60 group-hover:opacity-100" />
    </a>
  );
};

const renderInlineContent = (text: string, keyPrefix: string) => {
  if (!text) return [text];
  const nodes: Array<string | JSX.Element> = [];
  const linkRegex =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)*_`~\[\]]+)|(www\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.[a-zA-Z]{2,}(?:\/[^\s)*_`~\[\]]*)?)|(?:\*{1,3}|_{1,2})?((?:mailto:)?[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})(?:\*{1,3}|_{1,2})?/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      let before    = text.slice(lastIndex, match.index);
      const afterCh = text[match.index + match[0].length];
      if (before.endsWith("(") && afterCh === ")") before = before.slice(0, -1);
      nodes.push(...renderLatexInlineContent(before, `${keyPrefix}-text-${partIndex++}`));
    }
    if (match[2]) {
      nodes.push(<SimpleLinkPreview k={`${keyPrefix}-link-${partIndex++}`} url={match[2]} label={match[1]} />);
    } else if (match[3]) {
      const trimmed = match[3].replace(/[).,*_`~\[\]]+$/, "");
      const trailing = match[3].slice(trimmed.length);
      nodes.push(<SimpleLinkPreview k={`${keyPrefix}-link-${partIndex++}`} url={trimmed} />);
      if (trailing) nodes.push(...renderLatexInlineContent(trailing, `${keyPrefix}-trail-${partIndex++}`));
    } else if (match[4]) {
      const trimmed  = match[4].replace(/[).,*_`~\[\]]+$/, "");
      const trailing = match[4].slice(trimmed.length);
      nodes.push(<SimpleLinkPreview k={`${keyPrefix}-link-${partIndex++}`} url={trimmed} />);
      if (trailing) nodes.push(...renderLatexInlineContent(trailing, `${keyPrefix}-trail-${partIndex++}`));
    } else if (match[5]) {
      const email = match[5].replace(/^mailto:/i, "");
      nodes.push(
        <a key={`${keyPrefix}-email-${partIndex++}`} href={`mailto:${email}`}
          className="group inline-flex items-center gap-1 rounded-full border border-[#EDE1D7] bg-[#F7F2ED] px-2 py-0.5 text-xs font-medium text-[#26211E] hover:bg-[#EDE1D7] transition-all duration-200 align-middle"
        >
          <Mail className="h-3.5 w-3.5 shrink-0 text-[#827A74] group-hover:text-[#524B47] transition-colors" aria-hidden />
          <span className="truncate max-w-50">{email}</span>
        </a>,
      );
    }
    const afterOffset =
      text[match.index + match[0].length] === ")" && text[match.index - 1] === "(" ? 1 : 0;
    lastIndex = match.index + match[0].length + afterOffset;
  }
  if (lastIndex < text.length) {
    nodes.push(...renderLatexInlineContent(text.slice(lastIndex), `${keyPrefix}-text-${partIndex++}`));
  }
  if (nodes.length === 0) nodes.push(text);
  return nodes;
};

function InlineContent({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  return <>{renderInlineContent(text, keyPrefix)}</>
}

const renderTextContent = (value: string, keyPrefix: string): JSX.Element[] => {
  const nodes: JSX.Element[] = [];
  const lines = value.replace(/\r/g, "").split("\n");
  const listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const listKey = `${keyPrefix}-list-${nodes.length}`;
    nodes.push(
      <ul key={listKey} className="ml-5 list-disc space-y-1 text-[#26211E]">
        {listBuffer.map((item, idx) => (
          <li key={`${listKey}-item-${idx}`} className="leading-relaxed">
            <InlineContent text={item} keyPrefix={`${listKey}-item-${idx}`} />
          </li>
        ))}
      </ul>,
    );
    listBuffer.length = 0;
  };

  for (let index = 0; index < lines.length; index++) {
    const line    = lines[index];
    const trimmed = line.trim();

    const isBracketMath = trimmed.startsWith("\\[");
    const isDollarMath  = trimmed === "$$" || trimmed.startsWith("$$");

    if (isBracketMath || isDollarMath) {
      flushList();
      let mathContent = "";
      let closed = false;

      if (isBracketMath) {
        const afterOpen = trimmed.slice(2).trimStart();
        if (afterOpen.endsWith("\\]")) {
          mathContent = afterOpen.slice(0, -2).trimEnd();
          closed = true;
        } else {
          const collected = [afterOpen];
          for (let j = index + 1; j < lines.length; j++) {
            const ct = lines[j].trim();
            if (ct.endsWith("\\]")) { collected.push(ct.slice(0, -2)); index = j; closed = true; break; }
            collected.push(lines[j]);
          }
          mathContent = collected.join("\n").trim();
        }
      } else {
        const afterOpen = trimmed.slice(2).trimStart();
        if (afterOpen.endsWith("$$")) {
          mathContent = afterOpen.slice(0, -2).trimEnd();
          closed = true;
        } else {
          const collected = [afterOpen];
          for (let j = index + 1; j < lines.length; j++) {
            const ct = lines[j].trim();
            if (ct.endsWith("$$")) { collected.push(ct.slice(0, -2)); index = j; closed = true; break; }
            collected.push(lines[j]);
          }
          mathContent = collected.join("\n").trim();
        }
      }

      if (closed && mathContent) {
        try {
          const html = katex.renderToString(mathContent, { throwOnError: false, displayMode: true });
          // eslint-disable-next-line react/no-danger -- KaTeX output is library-generated and sanitized
          nodes.push(<div key={`${keyPrefix}-math-${index}`} className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }} />);
          continue;
        } catch { /* fall through */ }
      }
    }

    if (!trimmed) {
      flushList();
      nodes.push(<span key={`${keyPrefix}-gap-${index}`} className="block h-2" aria-hidden />);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level      = Math.min(headingMatch[1].length, 6);
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      nodes.push(
        <HeadingTag key={`${keyPrefix}-heading-${index}`}
          className={`font-semibold text-[#26211E] tracking-tight ${headingClassByLevel[level]}`}
        >
          <InlineContent text={headingMatch[2]} keyPrefix={`${keyPrefix}-heading-${index}`} />
        </HeadingTag>,
      );
      continue;
    }

    if (isTableRow(line) && isTableDivider(lines[index + 1] ?? "")) {
      flushList();
      const headerCells = parseTableRow(line);
      index += 2;
      const bodyRows: string[][] = [];
      while (index < lines.length && isTableRow(lines[index])) { bodyRows.push(parseTableRow(lines[index])); index++; }
      const tk = `${keyPrefix}-table-${nodes.length}`;
      nodes.push(
        <div key={tk} className="overflow-x-auto rounded-lg border border-[#EDE1D7] my-2">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#F7F2ED] text-[#524B47]">
              <tr>{headerCells.map((cell, ci) => (
                <th key={`${tk}-header-${ci}`} className="border-b border-[#EDE1D7] px-3 py-2 text-left font-semibold text-[#26211E]">
                  <InlineContent text={cell} keyPrefix={`${tk}-header-${ci}`} />
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={`${tk}-row-${ri}`} className="odd:bg-white even:bg-[#F7F2ED]/50">
                  {row.map((cell, ci) => (
                    <td key={`${tk}-cell-${ri}-${ci}`} className="border-t border-[#EDE1D7] px-3 py-2 align-top text-[#26211E]">
                      <InlineContent text={cell} keyPrefix={`${tk}-cell-${ri}-${ci}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      index -= 1;
      continue;
    }

    const listMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (listMatch) { listBuffer.push(listMatch[1]); continue; }

    flushList();
    nodes.push(
      <p key={`${keyPrefix}-paragraph-${index}`} className="whitespace-pre-wrap leading-relaxed text-[#26211E]">
        <InlineContent text={line} keyPrefix={`${keyPrefix}-paragraph-${index}`} />
      </p>,
    );
  }

  flushList();
  return nodes;
};

function TextContent({ value, keyPrefix }: { value: string; keyPrefix: string }) {
  return <>{renderTextContent(value, keyPrefix)}</>
}

type ContentSegment = { type: "text"; value: string } | { type: "code"; value: string; language?: string };

const parseContentSegments = (value: string): ContentSegment[] => {
  if (!value) return [];
  const segments: ContentSegment[] = [];
  const codeRegex = /```([\w+-]+)?\s*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = codeRegex.exec(value)) !== null) {
    if (match.index > lastIndex) segments.push({ type: "text", value: value.slice(lastIndex, match.index) });
    segments.push({ type: "code", language: match[1]?.trim(), value: match[2] ?? "" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) segments.push({ type: "text", value: value.slice(lastIndex) });
  return segments;
};

const FormattedResponse = ({ content, modelId }: { content: string; modelId: string }) => (
  <div className="w-full space-y-1" style={{ fontFamily: "var(--font-body)" }}>
    {parseContentSegments(content).map((seg, idx) =>
      seg.type === "code"
        ? <CodeBlock key={`${modelId}-code-${idx}`} code={seg.value} language={seg.language} />
        : <div key={`${modelId}-text-${idx}`} className="text-sm"><TextContent value={seg.value} keyPrefix={`${modelId}-text-${idx}`} /></div>,
    )}
  </div>
);

const CodeBlock = ({ code, language }: { code: string; language?: string }) => {
  const codeRef    = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (codeRef.current) {
      import("@/lib/highlight").then((hljs) => { if (codeRef.current) hljs.default.highlightElement(codeRef.current); });
    }
  }, [code, language]);
  return (
    <div className="relative rounded-lg overflow-hidden my-2 border border-[#EDE1D7]">
      <div className="flex items-center justify-between bg-[#F7F2ED] px-3 py-1.5 text-xs">
        <span className="font-mono text-[#524B47]">{language || "code"}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#EDE1D7] transition-colors text-[#524B47]"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="m-0 p-3 overflow-x-auto bg-[#F7F2ED]/50 text-sm">
        <code ref={codeRef} className={language ? `language-${language}` : ""}>{code}</code>
      </pre>
    </div>
  );
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
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-pressed={isSelected}
      onClick={() => !isDisabled && onClick()}
      onKeyDown={(e) => { if (!isDisabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => !isDisabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={!model.requestModelId ? "This model is missing a backend ID and cannot be tested." : undefined}
      style={{
        width:           "100%",
        height:          "100%",
        borderRadius:    16,
        boxShadow:       isActive ? CARD_SHADOW_RAISED : CARD_SHADOW,
        backgroundColor: "#FFFFFF",
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
          background:    "linear-gradient(90deg,rgba(237,225,215,0.6) 0%,rgba(237,225,215,0.6) 100%),linear-gradient(90deg,#FFF 0%,#FFF 100%)",
        }} />
      )}
      {/* Selected warm overlay */}
      {isSelected && (
        <div aria-hidden style={{
          position:        "absolute",
          inset:           0,
          pointerEvents:   "none",
          borderRadius:    16,
          backgroundColor: "rgba(237,225,215,0.6)",
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
          backgroundColor: "rgba(255,255,255,0)",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          overflow:        "hidden",
        }}>
          <LlmIcon id={llmId} variant="color" size={24} />
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
      <div style={{ position: "relative", display: "flex", alignItems: "center", paddingTop: 8, gap: 6, width: "100%", marginTop: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <Chip label={model.tierLabel}    color={tierColor} />
          <Chip label={model.contextLabel} color="red" noCapitalize />
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CompareModelsProps {
  selectedModel?: AIModel | null;
  onModelSelect?: (model: AIModel) => void;
  onClose?: () => void;
}

export default function CompareModels({ selectedModel, onModelSelect, onClose }: CompareModelsProps = {}) {
  void selectedModel;

  const [selectedModels,       setSelectedModels]       = useState<string[]>([]);
  const [showResults,          setShowResults]           = useState(false);
  const [prompt,               setPrompt]                = useState("");
  const [models,               setModels]                = useState<CompareModel[]>([]);
  const [isLoading,            setIsLoading]             = useState(true);
  const [testResponses,        setTestResponses]         = useState<Record<string, string>>({});
  const [isTesting,            setIsTesting]             = useState(false);
  const [streamingModels,      setStreamingModels]       = useState<Set<string>>(new Set());
  const [fullModels,           setFullModels]            = useState<AIModel[]>([]);
  const [promptInputCollapsed, setPromptInputCollapsed]  = useState(false);
  const [activeTab,            setActiveTab]             = useState<string>("all");
  const [searchQuery,          setSearchQuery]           = useState("");
  const [showSearch,           setShowSearch]            = useState(false);
  const [atTop,           setAtTop]           = useState(true);
  const [atBottom,        setAtBottom]        = useState(false);
  const [expandedModelId,  setExpandedModelId]  = useState<string | null>(null);
  const [testCredits,      setTestCredits]      = useState<Record<string, number>>({});
  const [testMessageIds,   setTestMessageIds]   = useState<Record<string, string>>({});
  const [connectPromptsPerModel,    setConnectPromptsPerModel]    = useState<Record<string, import('@/hooks/use-chat-state').ConnectorConnectPrompt[]>>({});
  const [permissionPromptsPerModel, setPermissionPromptsPerModel] = useState<Record<string, import('@/hooks/use-chat-state').ConnectorPermissionPrompt[]>>({});
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

  const filteredModels = useMemo(() => {
    let result = activeTab === "all" ? models : models.filter((m) => m.company === activeTab);
    if (selectedTiers.size > 0) {
      result = result.filter((m) => {
        const t = (m.tierLabel ?? "").toLowerCase();
        if (selectedTiers.has("starter") && (t === "free" || t === "starter")) return true;
        if (selectedTiers.has("pro")     && (t === "paid" || t === "pro"))     return true;
        if (selectedTiers.has("power")   && t === "power")                     return true;
        return false;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) =>
        m.modelName.toLowerCase().includes(q) ||
        m.company.toLowerCase().includes(q),
      );
    }
    return result;
  }, [models, activeTab, searchQuery, selectedTiers]);

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

  // â”€â”€ Fetch models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchModelsWithCache()
      .then((ms) => {
        if (cancelled) return;
        setFullModels(ms);
        setModels(ms.map(transformModelForCompare));
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setModels([]);
        setFullModels([]);
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
    const content   = testResponses[responseKey] ?? "";
    const messageId = testMessageIds[responseKey];
    if (!content || !messageId) return;
    const title = content.split("\n")[0].slice(0, 80) || modelDisplayName;
    addPin({ content, title, category: "Quote", messageId, modelName: modelDisplayName });
    openPinboard();
  }, [testResponses, testMessageIds, addPin, openPinboard]);

  const handleTestModels = async () => {
    if (!prompt.trim() || selectedModels.length < 2 || isTesting) return;

    setPromptInputCollapsed(true);
    setPrompt("");
    setIsTesting(true);
    setTestResponses({});
    setTestCredits({});
    setTestMessageIds({});
    setStreamingModels(new Set());
    setConnectPromptsPerModel({});
    setPermissionPromptsPerModel({});
    // Revoke object URLs for pasted images to avoid memory leaks
    setPastedImages((prev) => { prev.forEach((url) => URL.revokeObjectURL(url)); return []; });

    try {
      const modelIds      = selectedModels.map((id) => id.trim()).filter((id) => id.length > 0);
      const validModelIds = modelIds.filter((id) => isValidUUID(id));
      const invalidIds    = modelIds.filter((id) => !isValidUUID(id));

      if (validModelIds.length === 0) throw new Error("No valid model IDs found");

      if (invalidIds.length > 0) {
        const errMsg = `Error: Invalid model ID selected (${invalidIds.join(", ")})`;
        const errorResponses: Record<string, string> = {};
        selectedModels.forEach((id) => { errorResponses[id] = errMsg; });
        setTestResponses(errorResponses);
        setStreamingModels(new Set());
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const trimmedPrompt = prompt.trim();

      const streamingResponses: Record<string, string> = {};
      const selectedModelSet = new Set(selectedModels);
      selectedModels.forEach((id) => { streamingResponses[id] = ""; });

      const resolveModelIdFromPayload = (payload: Record<string, unknown>): string | null => {
        const raw = payload.model_id ?? payload.modelId ?? null;
        if (raw === null || raw === undefined) return null;
        const resolved = String(raw).trim();
        return resolved.length > 0 ? resolved : null;
      };

      const resolveEventType = (explicit: string, payload: Record<string, unknown>): string => {
        if (explicit) return explicit;
        const raw = payload.type;
        return typeof raw === "string" ? raw.trim().toLowerCase() : "";
      };

      const handleEvent = (eventType: string, payload: Record<string, unknown>, fallbackModelId?: string) => {
        const modelIdStr = resolveModelIdFromPayload(payload) ?? fallbackModelId ?? null;
        if (!modelIdStr || !selectedModelSet.has(modelIdStr)) return;
        if (!(modelIdStr in streamingResponses)) streamingResponses[modelIdStr] = "";

        // Extract message_id from any event that carries it
        const rawMsgId = payload.message_id ?? payload.messageId ?? null;
        if (typeof rawMsgId === "string" && rawMsgId.trim()) {
          setTestMessageIds((prev) =>
            prev[modelIdStr] === rawMsgId.trim() ? prev : { ...prev, [modelIdStr]: rawMsgId.trim() },
          );
        }

        switch (eventType) {
          case "metadata":
          case "start":
            setStreamingModels((prev) => new Set(prev).add(modelIdStr));
            break;
          case "content":
          case "chunk": {
            const chunk =
              typeof payload.content === "string" ? payload.content
              : typeof payload.delta  === "string" ? payload.delta
              : "";
            if (!chunk) return;
            streamingResponses[modelIdStr] = (streamingResponses[modelIdStr] || "") + chunk;
            setStreamingModels((prev) => new Set(prev).add(modelIdStr));
            setTestResponses({ ...streamingResponses });
            break;
          }
          case "reasoning": break;
          case "image": {
            const imageUrl = typeof payload.url === "string" ? payload.url.trim() : "";
            if (!imageUrl) return;
            streamingResponses[modelIdStr] = `${streamingResponses[modelIdStr] || ""}\n\n![image](${imageUrl})`;
            setTestResponses({ ...streamingResponses });
            break;
          }
          case "done":
          case "end": {
            const final = typeof payload.response === "string" ? payload.response : "";
            if (final) { streamingResponses[modelIdStr] = final; setTestResponses({ ...streamingResponses }); }
            const creditsRaw =
              typeof payload.credits_used  === "number" ? payload.credits_used  :
              typeof payload.creditsUsed   === "number" ? payload.creditsUsed   :
              typeof payload.credits       === "number" ? payload.credits       :
              typeof payload.cost          === "number" ? payload.cost          :
              null;
            if (creditsRaw !== null) setTestCredits((prev) => ({ ...prev, [modelIdStr]: creditsRaw }));
            setStreamingModels((prev) => { const n = new Set(prev); n.delete(modelIdStr); return n; });
            break;
          }
          case "error": {
            const errText = typeof payload.error === "string" ? payload.error : "Unknown error";
            streamingResponses[modelIdStr] = `Error: ${errText}`;
            setTestResponses({ ...streamingResponses });
            setStreamingModels((prev) => { const n = new Set(prev); n.delete(modelIdStr); return n; });
            break;
          }
          case "tool_connect_prompt": {
            const prompt: ConnectorConnectPrompt = {
              request_id:     typeof payload.request_id     === "string" ? payload.request_id     : `ccp-${Date.now()}`,
              connector_slug: typeof payload.connector_slug === "string" ? payload.connector_slug : "",
              display_name:   typeof payload.display_name   === "string" ? payload.display_name   : (typeof payload.connector_slug === "string" ? payload.connector_slug : ""),
              auth_mode:      (typeof payload.auth_mode     === "string" ? payload.auth_mode      : "oauth2") as "oauth2" | "api_key",
              tool_name:      typeof payload.tool_name      === "string" ? payload.tool_name      : "",
              icon_url:       typeof payload.icon_url       === "string" ? payload.icon_url       : undefined,
            };
            setConnectPromptsPerModel((prev) => ({
              ...prev,
              [modelIdStr]: [...(prev[modelIdStr] ?? []), prompt],
            }));
            break;
          }
          case "tool_permission_prompt": {
            const prompt: ConnectorPermissionPrompt = {
              request_id:     typeof payload.request_id     === "string" ? payload.request_id     : `cpp-${Date.now()}`,
              connector_slug: typeof payload.connector_slug === "string" ? payload.connector_slug : "",
              display_name:   typeof payload.display_name   === "string" ? payload.display_name   : (typeof payload.connector_slug === "string" ? payload.connector_slug : ""),
              tool_name:      typeof payload.tool_name      === "string" ? payload.tool_name      : "",
              icon_url:       typeof payload.icon_url       === "string" ? payload.icon_url       : undefined,
            };
            setPermissionPromptsPerModel((prev) => ({
              ...prev,
              [modelIdStr]: [...(prev[modelIdStr] ?? []), prompt],
            }));
            break;
          }
        }
      };

      const processChunk = (chunk: string, fallbackModelId?: string) => {
        const lines = chunk.split("\n");
        let explicitEvent = "";
        const dataLines: string[] = [];
        for (const line of lines) {
          const trimmedLine = line.replace(/\r$/, "");
          if (trimmedLine.startsWith("event:")) explicitEvent = trimmedLine.slice(6).trim().toLowerCase();
          else if (trimmedLine.startsWith("data:")) dataLines.push(trimmedLine.slice(5));
        }
        if (dataLines.length === 0) return;
        const dataStr = dataLines.join("\n").trim();
        if (!dataStr || dataStr === "[DONE]") return;
        try {
          const payload = JSON.parse(dataStr) as Record<string, unknown>;
          handleEvent(resolveEventType(explicitEvent, payload), payload, fallbackModelId);
        } catch { /* ignore incomplete chunks */ }
      };

      // Fire one request per model in parallel so all columns stream simultaneously
      await Promise.all(validModelIds.map(async (modelId) => {
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

        if (!resp.ok) {
          streamingResponses[modelId] = `Error: ${resp.status}`;
          setTestResponses({ ...streamingResponses });
          setStreamingModels((prev) => { const n = new Set(prev); n.delete(modelId); return n; });
          return;
        }

        const reader = resp.body?.getReader();
        if (!reader) {
          streamingResponses[modelId] = "Error: No response body";
          setTestResponses({ ...streamingResponses });
          return;
        }

        try {
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            // eslint-disable-next-line no-await-in-loop -- sequential SSE stream reader; chunks must arrive in order
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";
            for (const ev of events) processChunk(ev, modelId);
          }
          if (buffer.trim()) for (const ev of `${buffer}\n\n`.split("\n\n")) processChunk(ev, modelId);
        } finally {
          reader.cancel().catch(() => {});
        }
      }));
      setStreamingModels(new Set());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Error testing models:", error);
      const errorResponses: Record<string, string> = {};
      selectedModels.forEach((id) => { errorResponses[id] = "Error: Failed to get response"; });
      setTestResponses(errorResponses);
    } finally {
      abortControllerRef.current = null;
      setIsTesting(false);
    }
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
        background:    "#F7F2ED",
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
              <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 16, backgroundColor: "rgba(247,242,237,0.5)", boxShadow: TRAY_BG_SHADOW, padding: 12 }}>
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden", background: "#EDE1D7", boxShadow: CARD_SHADOW }}>
                  {/* Tabs header */}
                  <div style={{ display: "flex", alignItems: "stretch", background: "#EDE1D7", flexShrink: 0 }}>
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
                          <div key={model.id} style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, backgroundColor: "#FFFFFF", borderRadius: "8px 8px 0 0", flexShrink: 0 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, padding: 8, flexShrink: 0, backgroundColor: "rgba(255,255,255,0)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                              <LlmIcon id={llmId} variant="color" size={24} />
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
                          style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, backgroundColor: "#EDE1D7", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", flexShrink: 0 }}
                        >
                          <div style={{ width: 44, height: 44, borderRadius: 10, padding: 8, flexShrink: 0, backgroundColor: "rgba(255,255,255,0)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            <LlmIcon id={llmId} variant="color" size={24} />
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
                  const modelResponse    = testResponses[responseKey];
                  const isModelStreaming = streamingModels.has(responseKey);
                  const credits          = testCredits[responseKey];
                  return (
                    <m.div
                      key={expandedModelId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={springs.fast}
                      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12, padding: 12, background: "#FFFFFF", borderRadius: 8 }}
                    >
                      {/* Response area */}
                      <div className="kaya-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 20, paddingTop: 10, paddingLeft: 10, paddingRight: 10 }}>
                        {isModelStreaming ? (
                          <div style={{ width: "100%", fontSize: 14, lineHeight: "22px", color: PRIMARY, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-body)" }}>
                            {modelResponse || ""}<BreathingDot size="sm" style={{ backgroundColor: PRIMARY, marginLeft: 2 }} />
                          </div>
                        ) : isTesting && !modelResponse ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
                            <Sparkles strokeWidth={1.5} style={{ width: 48, height: 48, color: "#EDE1D7" }} className="animate-pulse" />
                            <div style={{ fontSize: 12, color: TERTIARY, textAlign: "center", fontFamily: "var(--font-body)" }}>Waiting to generate...</div>
                          </div>
                        ) : modelResponse ? (
                          <FormattedResponse content={modelResponse} modelId={responseKey} />
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
                            <Sparkles strokeWidth={1.5} style={{ width: 48, height: 48, color: "#EDE1D7" }} />
                            <div style={{ fontSize: 12, color: TERTIARY, textAlign: "center", fontFamily: "var(--font-body)" }}>
                              Run a prompt to see<br />{expandedModel.modelName}&apos;s<br />answer here.
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Connector prompts — shown below the response in expanded view */}
                      {(connectPromptsPerModel[responseKey]?.length > 0 || permissionPromptsPerModel[responseKey]?.length > 0) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                          {connectPromptsPerModel[responseKey]?.map((p) => (
                            <ConnectPromptCard key={p.request_id} prompt={p} />
                          ))}
                          {permissionPromptsPerModel[responseKey]?.map((p) => (
                            <PermissionPromptCard key={p.request_id} prompt={p} />
                          ))}
                        </div>
                      )}
                      {/* Bottom action bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                          {credits !== undefined && <Chip label={`${credits.toFixed(2)} Credits`} color="neutral" noCapitalize />}
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
              <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", gap: 12, padding: 12, borderRadius: 16, backgroundColor: "rgba(247,242,237,0.5)", boxShadow: TRAY_BG_SHADOW }}>
                {modelsToShow.map((model) => {
                  const responseKey      = model.requestModelId ?? model.id;
                  const modelResponse    = testResponses[responseKey];
                  const isModelStreaming = streamingModels.has(responseKey);
                  const llmId            = getModelLlmId(model.companyName, model.rawModelName) ?? "";
                  const credits          = testCredits[responseKey];
                  return (
                    <div key={model.id} style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: 8, backgroundColor: "#FFFFFF", boxShadow: CARD_SHADOW, display: "flex", flexDirection: "column", gap: 10, padding: 12, boxSizing: "border-box" }}>
                      {/* Column header */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
                        <div style={{ display: "flex", flex: 1, alignItems: "flex-start", gap: 6, minWidth: 0 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, padding: 8, flexShrink: 0, backgroundColor: "rgba(255,255,255,0)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            <LlmIcon id={llmId} variant="color" size={24} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, minWidth: 0, alignSelf: "stretch" }}>
                            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
                              {model.displayName}
                            </div>
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
                      {/* Response area */}
                      <div className="kaya-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 20, padding: 10, display: "flex", flexDirection: "column", alignItems: modelResponse ? "flex-start" : "center", justifyContent: modelResponse ? "flex-start" : "center" }}>
                        {isModelStreaming ? (
                          <div style={{ width: "100%", fontSize: 14, lineHeight: "22px", color: PRIMARY, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-body)" }}>
                            {modelResponse || ""}<BreathingDot size="sm" style={{ backgroundColor: PRIMARY, marginLeft: 2 }} />
                          </div>
                        ) : isTesting && !modelResponse ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <Sparkles strokeWidth={1.5} style={{ width: 48, height: 48, color: "#EDE1D7" }} className="animate-pulse" />
                            <div style={{ fontSize: 12, color: TERTIARY, textAlign: "center", fontFamily: "var(--font-body)" }}>Waiting to generate...</div>
                          </div>
                        ) : modelResponse ? (
                          <FormattedResponse content={modelResponse} modelId={responseKey} />
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <Sparkles strokeWidth={1.5} style={{ width: 48, height: 48, color: "#EDE1D7" }} />
                            <div style={{ fontSize: 12, color: TERTIARY, textAlign: "center", fontFamily: "var(--font-body)" }}>
                              Run a prompt to see<br />{model.modelName}&apos;s<br />answer here.
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Connector prompts — shown below the response */}
                      {(connectPromptsPerModel[responseKey]?.length > 0 || permissionPromptsPerModel[responseKey]?.length > 0) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                          {connectPromptsPerModel[responseKey]?.map((p) => (
                            <ConnectPromptCard key={p.request_id} prompt={p} />
                          ))}
                          {permissionPromptsPerModel[responseKey]?.map((p) => (
                            <PermissionPromptCard key={p.request_id} prompt={p} />
                          ))}
                        </div>
                      )}
                      {/* Bottom bar: credits */}
                      {credits !== undefined && (
                        <div style={{ display: "flex", alignItems: "center", paddingTop: 2, paddingBottom: 2, flexShrink: 0 }}>
                          <Chip label={`${credits.toFixed(2)} Credits`} color="neutral" noCapitalize />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat input */}
          <div style={{ flexShrink: 0, paddingLeft: 9, paddingRight: 9 }}>
            <div style={{ borderRadius: 12, border: "1px solid rgba(59,54,50,0.1)", boxShadow: CARD_SHADOW, backgroundColor: "#FFFFFF", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
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
                        style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", border: "none", background: "rgba(38,33,30,0.7)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontSize: 10, lineHeight: 1 }}
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
                style={{ flex: 1, fontSize: 16, fontWeight: 400, lineHeight: "22px", color: prompt ? "#26211E" : "#6A625D", fontFamily: "var(--font-body)", background: "none", border: "none", outline: "none", resize: "none", minHeight: 22, opacity: isTesting ? 0.6 : 1 }}
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
      background:    "#F7F2ED",
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
        background:    "#F7F2ED",
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
                    background:   "var(--neutral-white)",
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
                      icon={repLlmId ? <LlmIcon id={repLlmId} variant="color" size={16} /> : undefined}
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
                <Dropdown size="sm">
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
                    backgroundColor: "#EDE1D7", display: "flex", flexDirection: "column",
                    gap: 12, padding: 12, boxSizing: "border-box",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#D5C9C0" }} className="animate-pulse" />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ height: 16, borderRadius: 4, backgroundColor: "#D5C9C0", width: "60%" }} className="animate-pulse" />
                        <div style={{ height: 11, borderRadius: 4, backgroundColor: "#D5C9C0", width: "40%" }} className="animate-pulse" />
                      </div>
                    </div>
                    <div style={{ height: 48, borderRadius: 4, backgroundColor: "#D5C9C0" }} className="animate-pulse" />
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ height: 20, width: 64, borderRadius: 6, backgroundColor: "#D5C9C0" }} className="animate-pulse" />
                      <div style={{ height: 20, width: 56, borderRadius: 6, backgroundColor: "#D5C9C0" }} className="animate-pulse" />
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
            background:    "linear-gradient(to bottom, #F7F2ED 0%, transparent 100%)",
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
            background:    "linear-gradient(to top, #F7F2ED 0%, transparent 100%)",
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
              backgroundColor: "rgba(247,242,237,0.5)",
            }}>
              <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10 }}>
                <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 10, backgroundColor: "rgba(247,242,237,0.5)" }} />
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
                    backgroundColor: "#FFFFFF",
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
                          backgroundColor: "rgba(255,255,255,0)",
                          display:         "flex",
                          alignItems:      "center",
                          justifyContent:  "center",
                          overflow:        "hidden",
                        }}>
                          <LlmIcon id={llmId} variant="color" size={24} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
                            {model.company}/{model.modelName}
                          </div>
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
                      border:        "1px dashed #9C938B",
                      pointerEvents: "none",
                    }} />
                    <div style={{ display: "flex", flex: 1, gap: 12, alignItems: "center", minWidth: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 4, border: "1px dashed #B6ACA4", flexShrink: 0 }} />
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
