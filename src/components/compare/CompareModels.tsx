"use client";
import React, { useState, useEffect, useLayoutEffect, useRef, type JSX } from "react";
import styles from "./compareModels.module.css";
import { X, ArrowLeft, Sparkles, ArrowUp, ExternalLink, Mail } from "lucide-react";
import { LlmIcon } from "@strange-huge/icons/llm";
import type { AIModel } from "@/types/ai-model";
import { fetchModelsWithCache } from "@/lib/ai-models";
import { MODELS_ENDPOINT } from "@/lib/config";
import { getModelLlmId } from "@/lib/model-icons";
import { apiFetch } from "@/lib/api/client";
import katex from "katex";
import "katex/dist/katex.min.css";
import { sanitizeKaTeX, sanitizeURL } from "@/lib/security";
import { isValidUUID, normalizeUuid } from "@/lib/normalizers/normalize-utils";

// ── Design tokens ──────────────────────────────────────────────────────────────

type ChipColor = "neutral" | "green" | "brown" | "red" | "blue";

const CHIP_COLORS: Record<ChipColor, { bg: string; text: string }> = {
  neutral: { bg: "#EDE1D7", text: "#524B47" },
  green:   { bg: "#F7FEE6", text: "#456211" },
  brown:   { bg: "#E6D5CA", text: "#683D1B" },
  red:     { bg: "#FFBFB6", text: "#7A201C" },
  blue:    { bg: "#CADCF1", text: "#135487" },
};

const CARD_SHADOW   = "0 2px 2.8px rgba(82,75,71,0.12)";
const CARD_BORDER   = "1px solid #EDE1D7";
const SEL_BORDER    = "1.5px solid #0D6EB2";
const SEL_BG        = "rgba(13, 110, 178, 0.05)";
const PRIMARY       = "#26211E";
const SECONDARY     = "#524B47";
const TERTIARY      = "#827A74";
const ICON_BTN_BG   = "#F7F2ED";
const RESP_BORDER   = "#E5DAD0";
const DARK_GRADIENT = "linear-gradient(180deg, #524B47 0%, #26211E 100%)";

// ── Chip ───────────────────────────────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: ChipColor }) {
  const { bg, text } = CHIP_COLORS[color];
  return (
    <span
      style={{
        display:         "inline-flex",
        alignItems:      "center",
        padding:         "2px 8px",
        borderRadius:    999,
        fontSize:        11,
        fontWeight:      500,
        lineHeight:      "16px",
        backgroundColor: bg,
        color:           text,
        whiteSpace:      "nowrap",
        flexShrink:      0,
      }}
    >
      {label}
    </span>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Model transform ────────────────────────────────────────────────────────────

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

// ── Markdown rendering helpers ─────────────────────────────────────────────────

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
      {faviconSrc && <img src={faviconSrc} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" />}
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
            {renderInlineContent(item, `${listKey}-item-${idx}`)}
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
          {renderInlineContent(headingMatch[2], `${keyPrefix}-heading-${index}`)}
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
                  {renderInlineContent(cell, `${tk}-header-${ci}`)}
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={`${tk}-row-${ri}`} className="odd:bg-white even:bg-[#F7F2ED]/50">
                  {row.map((cell, ci) => (
                    <td key={`${tk}-cell-${ri}-${ci}`} className="border-t border-[#EDE1D7] px-3 py-2 align-top text-[#26211E]">
                      {renderInlineContent(cell, `${tk}-cell-${ri}-${ci}`)}
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
        {renderInlineContent(line, `${keyPrefix}-paragraph-${index}`)}
      </p>,
    );
  }

  flushList();
  return nodes;
};

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
  <div className="w-full space-y-1">
    {parseContentSegments(content).map((seg, idx) =>
      seg.type === "code"
        ? <CodeBlock key={`${modelId}-code-${idx}`} code={seg.value} language={seg.language} />
        : <div key={`${modelId}-text-${idx}`} className="text-sm">{renderTextContent(seg.value, `${modelId}-text-${idx}`)}</div>,
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

// ── ModelCard ──────────────────────────────────────────────────────────────────

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
  const llmId = getModelLlmId(model.companyName, model.rawModelName) ?? "";
  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-pressed={isSelected}
      onClick={() => !isDisabled && onClick()}
      onKeyDown={(e) => { if (!isDisabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
      title={!model.requestModelId ? "This model is missing a backend ID and cannot be tested." : undefined}
      style={{
        width:           381,
        borderRadius:    16,
        border:          isSelected ? SEL_BORDER : CARD_BORDER,
        backgroundColor: isSelected ? SEL_BG : "#FFFFFF",
        boxShadow:       CARD_SHADOW,
        padding:         "12px 12px 16px 12px",
        display:         "flex",
        flexDirection:   "column",
        gap:             8,
        cursor:          isDisabled ? "not-allowed" : "pointer",
        opacity:         isDisabled ? 0.5 : 1,
        position:        "relative",
        transition:      "border-color 0.15s, background-color 0.15s",
        outline:         "none",
        boxSizing:       "border-box",
      }}
    >
      {/* Selected checkmark */}
      {isSelected && (
        <div style={{
          position:        "absolute",
          top:             12,
          right:           12,
          width:           18,
          height:          18,
          borderRadius:    "50%",
          backgroundColor: "#0D6EB2",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          flexShrink:      0,
        }}>
          <svg width={10} height={8} viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width:           44,
          height:          44,
          borderRadius:    10,
          padding:         8,
          flexShrink:      0,
          backgroundColor: ICON_BTN_BG,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
        }}>
          <LlmIcon id={llmId} variant="avatar" size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: PRIMARY, lineHeight: "22px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {model.modelName}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: SECONDARY, lineHeight: "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {model.company}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{
        fontSize:        11,
        color:           TERTIARY,
        lineHeight:      "16px",
        display:         "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical" as const,
        overflow:        "hidden",
      }}>
        {model.description}
      </div>

      {/* Badge row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Chip label={model.tierLabel}    color="brown" />
          <Chip label={model.contextLabel} color="red"   />
        </div>
        {model.featureLabel && <Chip label={model.featureLabel} color="green" />}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface CompareModelsProps {
  selectedModel?: AIModel | null;
  onModelSelect?: (model: AIModel) => void;
  onClose?: () => void;
}

export default function CompareModels({ selectedModel, onModelSelect, onClose }: CompareModelsProps = {}) {
  void selectedModel;

  const [selectedModels,      setSelectedModels]      = useState<string[]>([]);
  const [showResults,         setShowResults]          = useState(false);
  const [prompt,              setPrompt]               = useState("");
  const [models,              setModels]               = useState<CompareModel[]>([]);
  const [isLoading,           setIsLoading]            = useState(true);
  const [testResponses,       setTestResponses]        = useState<Record<string, string>>({});
  const [isTesting,           setIsTesting]            = useState(false);
  const [streamingModels,     setStreamingModels]      = useState<Set<string>>(new Set());
  const [fullModels,          setFullModels]           = useState<AIModel[]>([]);
  const [promptInputCollapsed, setPromptInputCollapsed] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const promptInputRef     = useRef<HTMLTextAreaElement>(null);

  // ── Auto-grow textarea ───────────────────────────────────────────────────────

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

  // ── Fetch models ─────────────────────────────────────────────────────────────

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

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelect = (model: CompareModel) => {
    if (!model.requestModelId) return;
    if (selectedModels.length < 3 && !selectedModels.includes(model.requestModelId)) {
      setSelectedModels((prev) => [...prev, model.requestModelId!]);
    }
  };

  const handleRemove = (id: string) => {
    setSelectedModels((prev) => prev.filter((mid) => mid !== id));
  };

  const handleSelectModel = (modelId: string) => {
    const fullModel = fullModels.find((m) => resolveRequestModelId(m) === modelId);
    if (fullModel && onModelSelect) {
      const reqId = resolveRequestModelId(fullModel);
      if (!reqId) return;
      onModelSelect({ ...fullModel, id: reqId, modelId: reqId });
    }
  };

  const handleTestModels = async () => {
    if (!prompt.trim() || selectedModels.length < 2 || isTesting) return;

    setPromptInputCollapsed(true);
    setIsTesting(true);
    setTestResponses({});
    setStreamingModels(new Set());

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
      const response = await apiFetch(`${MODELS_ENDPOINT}/test`, {
        method: "POST",
        body: JSON.stringify({
          model_ids: validModelIds,
          prompt:    trimmedPrompt,
          modelIds:  validModelIds,
          message:   trimmedPrompt,
        }),
        signal:  controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!response.ok) throw new Error(`Failed to test models: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      try {
        const decoder = new TextDecoder();
        let buffer = "";
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

        const handleEvent = (eventType: string, payload: Record<string, unknown>) => {
          const modelIdStr = resolveModelIdFromPayload(payload);
          if (!modelIdStr || !selectedModelSet.has(modelIdStr)) return;
          if (!(modelIdStr in streamingResponses)) streamingResponses[modelIdStr] = "";

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
          }
        };

        const processChunk = (chunk: string) => {
          const lines = chunk.split("\n");
          let explicitEvent = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) explicitEvent = line.slice(6).trim().toLowerCase();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) return;
          try {
            const payload = JSON.parse(dataStr) as Record<string, unknown>;
            handleEvent(resolveEventType(explicitEvent, payload), payload);
          } catch { /* ignore incomplete chunks */ }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";
          for (const ev of events) processChunk(ev);
        }
        if (buffer.trim()) for (const ev of `${buffer}\n\n`.split("\n\n")) processChunk(ev);
        setStreamingModels(new Set());
      } finally {
        reader.cancel().catch(() => {});
      }
      reader.cancel().catch(() => {});
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

  // ── Results view ─────────────────────────────────────────────────────────────

  if (showResults) {
    const modelsToShow = selectedModels
      .map((id) => models.find((m) => m.requestModelId === id))
      .filter((c): c is CompareModel => Boolean(c));

    return (
      <div style={{
        width:           1050,
        maxHeight:       "90vh",
        borderRadius:    16,
        border:          CARD_BORDER,
        backgroundColor: "#F7F2ED",
        boxShadow:       CARD_SHADOW,
        display:         "flex",
        flexDirection:   "column",
        overflow:        "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding:         "14px 20px",
          display:         "flex",
          alignItems:      "center",
          gap:             12,
          backgroundColor: "#FFFFFF",
          borderBottom:    CARD_BORDER,
          flexShrink:      0,
        }}>
          <button
            onClick={() => setShowResults(false)}
            aria-label="Back"
            style={{
              width:           32,
              height:          32,
              borderRadius:    8,
              border:          CARD_BORDER,
              backgroundColor: "#FFFFFF",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              cursor:          "pointer",
              flexShrink:      0,
            }}
          >
            <ArrowLeft size={16} color={PRIMARY} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Clash Grotesk Variable", fontWeight: 400, fontSize: 20, lineHeight: "120%", letterSpacing: "-0.02em", color: PRIMARY }}>
              Compare results
            </div>
            <div style={{ fontSize: 13, color: TERTIARY, marginTop: 2 }}>
              Analyze model performance across your test prompts.
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width:           28,
                height:          28,
                borderRadius:    8,
                border:          CARD_BORDER,
                backgroundColor: "#FFFFFF",
                display:         "flex",
                alignItems:      "center",
                justifyContent:  "center",
                cursor:          "pointer",
                flexShrink:      0,
              }}
            >
              <X size={14} color={SECONDARY} />
            </button>
          )}
        </div>

        {/* Model output columns */}
        <div style={{
          flex:     1,
          minHeight: 0,
          display:  "flex",
          gap:      12,
          padding:  "12px 12px 0 12px",
          overflow: "hidden",
        }}>
          {modelsToShow.map((model) => {
            const responseKey     = model.requestModelId ?? model.id;
            const modelResponse   = testResponses[responseKey];
            const isModelStreaming = streamingModels.has(responseKey);
            const llmId           = getModelLlmId(model.companyName, model.rawModelName) ?? "";

            return (
              <div
                key={model.id}
                style={{
                  flex:            1,
                  minWidth:        0,
                  minHeight:       0,
                  borderRadius:    8,
                  border:          CARD_BORDER,
                  backgroundColor: "#FFFFFF",
                  boxShadow:       CARD_SHADOW,
                  display:         "flex",
                  flexDirection:   "column",
                  gap:             10,
                  padding:         12,
                  boxSizing:       "border-box",
                }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width:           44,
                      height:          44,
                      borderRadius:    10,
                      padding:         8,
                      flexShrink:      0,
                      backgroundColor: ICON_BTN_BG,
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                    }}>
                      <LlmIcon id={llmId} variant="avatar" size={24} />
                    </div>
                    <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, lineHeight: "22px", color: PRIMARY }}>
                      <span style={{ fontWeight: 700 }}>{model.company}</span>
                      {model.modelName && <span style={{ fontWeight: 400 }}>/{model.modelName}</span>}
                    </div>
                  </div>
                  <button
                    aria-label="Expand"
                    style={{
                      width:           28,
                      height:          28,
                      borderRadius:    10,
                      border:          CARD_BORDER,
                      backgroundColor: "#FFFFFF",
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      cursor:          "pointer",
                      flexShrink:      0,
                    }}
                  >
                    <ExternalLink size={12} color={SECONDARY} />
                  </button>
                </div>

                {/* Use this model */}
                <button
                  onClick={() => handleSelectModel(model.requestModelId ?? model.id)}
                  style={{
                    width:       "100%",
                    padding:     "8px 16px",
                    borderRadius: 8,
                    border:      "none",
                    background:  DARK_GRADIENT,
                    color:       "#F7F2ED",
                    fontSize:    14,
                    fontWeight:  500,
                    textShadow:  "0 0.364px 0.364px rgba(255,255,255,0.25), 0 -0.727px 0.364px rgba(0,0,0,0.25)",
                    cursor:      "pointer",
                    flexShrink:  0,
                  }}
                >
                  ✓ Use this model
                </button>

                {/* Response area */}
                <div
                  className="kaya-scrollbar"
                  style={{
                    flex:         1,
                    minHeight:    0,
                    overflowY:    "auto",
                    borderTop:    `1px solid ${RESP_BORDER}`,
                    borderBottom: `1px solid ${RESP_BORDER}`,
                    borderRadius: 20,
                    padding:      10,
                    display:      "flex",
                    flexDirection: "column",
                    alignItems:   modelResponse ? "flex-start" : "center",
                    justifyContent: modelResponse ? "flex-start" : "center",
                  }}
                >
                  {isModelStreaming ? (
                    <div style={{ width: "100%", fontSize: 11, lineHeight: "16px", color: PRIMARY, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {modelResponse || ""}
                      <span className={styles.streamingCursor} />
                    </div>
                  ) : isTesting && !modelResponse ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Sparkles strokeWidth={1.5} style={{ width: 48, height: 48, color: "#EDE1D7" }} className="animate-pulse" />
                      <div style={{ fontSize: 11, color: TERTIARY, textAlign: "center" }}>
                        Waiting to generate...
                      </div>
                    </div>
                  ) : modelResponse ? (
                    <FormattedResponse content={modelResponse} modelId={responseKey} />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Sparkles strokeWidth={1.5} style={{ width: 48, height: 48, color: "#EDE1D7" }} />
                      <div style={{ fontSize: 11, color: TERTIARY, textAlign: "center" }}>
                        Run a prompt to see<br />{model.modelName}&apos;s<br />answer here.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compare chat input */}
        <div style={{ padding: "12px 12px 16px", flexShrink: 0 }}>
          <div style={{
            borderRadius:    24,
            border:          "1px solid rgba(59,54,50,0.1)",
            boxShadow:       CARD_SHADOW,
            backgroundColor: "#FFFFFF",
            padding:         20,
            display:         "flex",
            alignItems:      "flex-end",
            gap:             24,
          }}>
            <textarea
              ref={promptInputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setPromptInputCollapsed(false)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTestModels(); } }}
              placeholder="How can I help you today?"
              disabled={isTesting}
              rows={1}
              style={{
                flex:        1,
                fontSize:    16,
                fontWeight:  400,
                lineHeight:  "22px",
                color:       prompt ? "#26211E" : "#6A625D",
                fontFamily:  "var(--font-geist-sans, Geist, sans-serif)",
                background:  "none",
                border:      "none",
                outline:     "none",
                resize:      "none",
                minHeight:   22,
                opacity:     isTesting ? 0.6 : 1,
              }}
            />
            <button
              onClick={handleTestModels}
              disabled={!prompt.trim() || isTesting}
              aria-label="Send"
              style={{
                width:          36,
                height:         36,
                borderRadius:   10,
                background:     DARK_GRADIENT,
                border:         "1px solid #000000",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                cursor:         !prompt.trim() || isTesting ? "not-allowed" : "pointer",
                flexShrink:     0,
                opacity:        !prompt.trim() || isTesting ? 0.5 : 1,
                transition:     "opacity 0.15s",
              }}
            >
              <ArrowUp size={20} color="#FFFFFF" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Compare & Select view ─────────────────────────────────────────────────────

  return (
    <div style={{
      width:           858,
      maxHeight:       "90vh",
      borderRadius:    16,
      border:          CARD_BORDER,
      backgroundColor: "#FFFFFF",
      boxShadow:       CARD_SHADOW,
      display:         "flex",
      flexDirection:   "column",
      overflow:        "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "Clash Grotesk Variable", fontWeight: 400, fontSize: 20, lineHeight: "120%", letterSpacing: "-0.02em", color: PRIMARY }}>
            Compare & select
          </div>
          <div style={{ fontSize: 13, color: TERTIARY, marginTop: 4 }}>
            Pick up to 3 models to pit against each other.
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width:           28,
              height:          28,
              borderRadius:    8,
              border:          CARD_BORDER,
              backgroundColor: "#FFFFFF",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              cursor:          "pointer",
              flexShrink:      0,
              marginLeft:      12,
            }}
          >
            <X size={14} color={SECONDARY} />
          </button>
        )}
      </div>

      {/* Selected model slots */}
      <div style={{ padding: "0 20px 16px", display: "flex", gap: 8, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => {
          const modelId = selectedModels[i];
          const model   = models.find((m) => m.requestModelId === modelId);
          const llmId   = model ? (getModelLlmId(model.companyName, model.rawModelName) ?? "") : "";
          return (
            <div key={i} style={{ flex: 1, minWidth: 0 }}>
              {model ? (
                <div style={{
                  height:          40,
                  borderRadius:    8,
                  border:          CARD_BORDER,
                  backgroundColor: "#FFFFFF",
                  boxShadow:       CARD_SHADOW,
                  display:         "flex",
                  alignItems:      "center",
                  padding:         "0 12px",
                  gap:             8,
                  boxSizing:       "border-box",
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <LlmIcon id={llmId} variant="avatar" size={20} />
                  </div>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {model.displayName}
                  </span>
                  <button
                    onClick={() => handleRemove(modelId)}
                    aria-label="Remove"
                    style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 2 }}
                  >
                    <X size={14} color={TERTIARY} />
                  </button>
                </div>
              ) : (
                <div style={{
                  height:          40,
                  borderRadius:    8,
                  border:          "1px dashed rgba(156,147,139,1)",
                  backgroundColor: "transparent",
                  display:         "flex",
                  alignItems:      "center",
                  padding:         "0 12px",
                  gap:             8,
                  boxSizing:       "border-box",
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: "1px dashed #B6ACA4", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: TERTIARY }}>Empty slot {i + 1}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px dashed #EDE1D7`, margin: "0 20px", flexShrink: 0 }} />

      {/* Section header */}
      <div style={{ padding: "12px 20px 8px", fontSize: 13, fontWeight: 600, color: SECONDARY, flexShrink: 0 }}>
        Available models
      </div>

      {/* Model card grid */}
      <div className="kaya-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px 20px" }}>
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 381px)", gap: 16, justifyContent: "center" }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                style={{ width: 381, borderRadius: 16, border: CARD_BORDER, backgroundColor: "#EDE1D7", display: "flex", flexDirection: "column", gap: 12, padding: 12, boxSizing: "border-box" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#D5C9C0" }} className="animate-pulse" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ height: 14, borderRadius: 4, backgroundColor: "#D5C9C0", width: "60%" }} className="animate-pulse" />
                    <div style={{ height: 11, borderRadius: 4, backgroundColor: "#D5C9C0", width: "40%" }} className="animate-pulse" />
                  </div>
                </div>
                <div style={{ height: 48, borderRadius: 4, backgroundColor: "#D5C9C0" }} className="animate-pulse" />
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ height: 20, width: 64, borderRadius: 999, backgroundColor: "#D5C9C0" }} className="animate-pulse" />
                  <div style={{ height: 20, width: 56, borderRadius: 999, backgroundColor: "#D5C9C0" }} className="animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : models.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, fontSize: 14, color: TERTIARY }}>
            No models available
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 381px)", gap: 16, justifyContent: "center" }}>
            {models.map((model) => {
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

      {/* Footer */}
      <div style={{
        padding:         "12px 20px",
        borderTop:       CARD_BORDER,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        flexShrink:      0,
        backgroundColor: "#FFFFFF",
      }}>
        <span style={{ fontSize: 12, color: TERTIARY }}>
          {selectedModels.length} of 3 models selected
        </span>
        <button
          onClick={() => selectedModels.length >= 2 && setShowResults(true)}
          disabled={selectedModels.length < 2}
          style={{
            height:      36,
            padding:     "0 16px",
            borderRadius: 8,
            border:      "none",
            background:  selectedModels.length >= 2 ? DARK_GRADIENT : "#EDE1D7",
            color:       selectedModels.length >= 2 ? "#F7F2ED" : TERTIARY,
            fontSize:    14,
            fontWeight:  500,
            cursor:      selectedModels.length >= 2 ? "pointer" : "not-allowed",
            display:     "flex",
            alignItems:  "center",
            gap:         8,
            transition:  "background 0.2s, color 0.2s",
          }}
        >
          Test models
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2.5 7h9M7.5 3l4 4-4 4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
