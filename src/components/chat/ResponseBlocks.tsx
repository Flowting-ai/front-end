"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import katex from "katex";
import { sanitizeKaTeX } from "@/lib/security";
import {
  InformationCircleIcon,
  Alert01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Idea01Icon,
  Copy01Icon,
  Checkmark,
  Exchange01Icon,
  GlobeXIcon,
} from "@hugeicons/core-free-icons";
import type {
  ResponseBlock,
  WebCitation,
  TableData,
  TableCellValue,
  BarChartData,
  StepsData,
  CodeData,
  CalloutData,
  TagsData,
  FollowUpsData,
  PieChartData,
  LineChartData,
  CardData,
  ConnectorErrorData,
  SearchTimeoutData,
} from "@/hooks/use-chat-state";

// ── Shared helpers ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function HIcon({ icon, size = 14, color = "#827A74", strokeWidth = 1.5 }: { icon: any; size?: number; color?: string; strokeWidth?: number }) {
  return <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} />;
}

const INLINE_CODE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-code, monospace)",
  fontSize: 13,
  background: "rgba(59,54,50,0.08)",
  color: "#26211E",
  borderRadius: 4,
  padding: "1px 5px",
  border: "1px solid rgba(82,75,71,0.12)",
  whiteSpace: "pre",
};

// Module-level cache so URL parsing runs once per domain across all renders.
const domainCache = new Map<string, string>()

function extractDomain(url: string): string {
  const cached = domainCache.get(url)
  if (cached !== undefined) return cached
  try {
    const d = new URL(url).hostname.replace(/^www\./, '')
    domainCache.set(url, d)
    return d
  } catch {
    domainCache.set(url, '')
    return ''
  }
}

// ── CitationChip - inline {1} reference chip with popover ────────────────────

export function CitationChip({ n, citation }: { n: number; citation?: WebCitation }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const isPinned = citation?.domain === "pin";
  const effectiveDomain = citation?.domain || (citation?.url ? extractDomain(citation.url) || undefined : undefined);
  const faviconUrl = citation && !isPinned && effectiveDomain
    ? `https://www.google.com/s2/favicons?domain=${effectiveDomain}&sz=32`
    : null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const showPopover = open || hovered;
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span
        role="button" tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, borderRadius: 4, fontSize: 9, fontWeight: 700,
          background: showPopover ? "#683D1B" : "rgba(104,61,27,0.12)",
          color: showPopover ? "white" : "#683D1B",
          cursor: "pointer", transition: "all 140ms", verticalAlign: "middle",
          marginLeft: 2, marginRight: 1, lineHeight: 1, outline: "none",
        }}>
        {n}
      </span>
      <AnimatePresence>
        {showPopover && citation && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{
              position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
              transform: "translateX(-50%)",
              background: "white", borderRadius: 10, padding: "8px 10px",
              zIndex: 20, boxShadow: "0 4px 16px rgba(59,54,50,0.14), 0 0 0 1px #EDE1D7",
              display: "flex", alignItems: "center", gap: 8,
              minWidth: 180, maxWidth: 280, whiteSpace: "nowrap",
            }}>
            {faviconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={faviconUrl} width={16} height={16}
                style={{ borderRadius: 3, flexShrink: 0, display: "block" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} alt="" />
            ) : (
              <span style={{ fontSize: 12, flexShrink: 0 }}>📌</span>
            )}
            <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              {citation.url ? (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 500, color: "#26211E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline", textUnderlineOffset: 2 }}
                >
                  {citation.title}
                </a>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500, color: "#26211E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {citation.title}
                </span>
              )}
              {!isPinned && (
                <span style={{ fontSize: 11, color: "#B6ACA4" }}>{citation.domain}</span>
              )}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// ── SourceList - horizontal scroll row of source cards ───────────────────────

const SourceCard = React.memo(function SourceCard({ citation, index }: { citation: WebCitation; index: number }) {
  const [hovered, setHovered] = useState(false);
  const isPinned = citation.domain === "pin";
  const effectiveDomain = citation.domain || (citation.url ? extractDomain(citation.url) || undefined : undefined);
  const faviconUrl = !isPinned && effectiveDomain
    ? `https://www.google.com/s2/favicons?domain=${effectiveDomain}&sz=32`
    : null;
  return (
    <motion.a
      href={citation.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1], delay: 0.18 + index * 0.07 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
        padding: "7px 10px",
        background: hovered ? "rgba(104,61,27,0.06)" : "white",
        border: `1px solid ${hovered ? "rgba(104,61,27,0.2)" : "#EDE1D7"}`,
        borderRadius: 10, cursor: "pointer",
        maxWidth: 220, minWidth: 140,
        transition: "background 150ms, border-color 150ms",
        textDecoration: "none",
      }}>
      {faviconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={faviconUrl} width={14} height={14}
          style={{ borderRadius: 3, flexShrink: 0, display: "block" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} alt="" />
      ) : (
        <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>📌</span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#26211E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {citation.title}
        </span>
        {!isPinned && (
          <span style={{ fontSize: 10, color: "#B6ACA4", whiteSpace: "nowrap" }}>{citation.domain}</span>
        )}
      </div>
    </motion.a>
  );
})

export function SourceList({ citations }: { citations: WebCitation[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
      style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9C938B", letterSpacing: "0.5px", textTransform: "uppercase" }}>
        Sources
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", overscrollBehaviorX: "contain", paddingBottom: 2 }}>
        {citations.map((c, i) => (
          <SourceCard key={i} citation={c} index={i} />
        ))}
      </div>
    </motion.div>
  );
}

// ── KaTeX helpers ─────────────────────────────────────────────────────────────

/** Render a KaTeX inline span, falling back to the raw source on error. */
function renderKatexInline(math: string, key: number | string): React.ReactNode {
  try {
    const html = katex.renderToString(math, { throwOnError: false, displayMode: false });
    return <span key={key} dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }} />;
  } catch {
    return <span key={key}>${math}$</span>;
  }
}

/**
 * Render a KaTeX display-mode block.
 * Returns null for incomplete/invalid LaTeX so nothing is shown until the
 * closing delimiter arrives (avoids garbled partial output during streaming).
 */
function renderKatexBlock(
  math: string,
  key: number | string,
  tail: React.ReactNode,
): React.ReactNode | null {
  if (!math.trim()) return null;
  try {
    const html = katex.renderToString(math, { throwOnError: false, displayMode: true });
    return (
      <div
        key={key}
        style={{ margin: "10px 0", overflowX: "auto", textAlign: "center" }}
      >
        <span dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }} />
        {tail}
      </div>
    );
  } catch {
    return null;
  }
}

// ── Inline markdown renderer ──────────────────────────────────────────────────

function renderInlineRich(line: string, citations?: WebCitation[]): React.ReactNode[] {
  // Match (in priority order): \(...\) inline math, $...$ inline math,
  // **bold**, `code`, {N} citation chip, [label](url) link.
  const regex = /\\\([\s\S]+?\\\)|\$[^$\n]+?\$|(\*\*[^*]+\*\*)|(`[^`\n]+`)|(\{\d+\})|(\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={count++}>{line.slice(lastIndex, match.index)}</span>);
    }

    const raw = match[0];
    if (raw.startsWith("\\(")) {
      // \(...\) inline math
      nodes.push(renderKatexInline(raw.slice(2, -2), count++));
    } else if (raw.startsWith("$")) {
      // $...$ inline math
      nodes.push(renderKatexInline(raw.slice(1, -1), count++));
    } else if (match[1] !== undefined) {
      // **bold**
      nodes.push(<strong key={count++} style={{ fontWeight: 600, color: "#26211E" }}>{match[1].slice(2, -2)}</strong>);
    } else if (match[2] !== undefined) {
      // `code`
      nodes.push(<code key={count++} style={INLINE_CODE_STYLE}>{match[2].slice(1, -1)}</code>);
    } else if (match[3] !== undefined) {
      // {N} citation chip
      const n = parseInt(match[3].slice(1, -1), 10);
      nodes.push(<CitationChip key={count++} n={n} citation={citations?.[n - 1]} />);
    } else if (match[4] !== undefined) {
      // [label](url)
      const lm = match[4].match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (lm)
        nodes.push(<a key={count++} href={lm[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#8B5523", textDecoration: "underline", textUnderlineOffset: 2 }}>{lm[1]}</a>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    nodes.push(<span key={count++}>{line.slice(lastIndex)}</span>);
  }

  return nodes.length ? nodes : [<span key={0}>{line}</span>];
}

// Inline markdown for non-citation content (reasoning steps, callout bodies)
function renderInlineMd(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} style={{ fontWeight: 600, color: "#26211E" }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} style={INLINE_CODE_STYLE}>{part.slice(1, -1)}</code>;
    const lm = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (lm) return <a key={i} href={lm[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#8B5523", textDecoration: "underline", textUnderlineOffset: 2 }}>{lm[1]}</a>;
    return <span key={i}>{part}</span>;
  });
}

function isBoldHeading(line: string) {
  return /^\*\*[^*]+\*\*:?\s*$/.test(line.trim());
}

const GAP = 14;

// Normalise inline bold-as-title: **Title** that appears with no whitespace
// boundary gets blank lines inserted so it renders as its own paragraph/heading.
function normalizeBoldTitles(text: string): string {
  return text
    // Insert blank line BEFORE **..** when immediately preceded by a non-whitespace char
    .replace(/([^\s\n])(\*\*[^*\n]+\*\*)/g, '$1\n\n$2')
    // Insert blank line AFTER **..** when immediately followed by a letter (new sentence)
    .replace(/(\*\*[^*\n]+\*\*)([A-Za-z])/g, '$1\n\n$2');
}

// Full block text renderer - supports headings, lists, blockquotes, bold, code, citations
export function renderTextBlock(text: string, citations?: WebCitation[], cursor?: React.ReactNode): React.ReactNode {
  const blocks = normalizeBoldTitles(text).split(/\n\n+/);

  return (
    <div style={{ color: "#3B3632", fontSize: 16 }}>
      {blocks.map((block, bi) => {
        const isLast = bi === blocks.length - 1;
        const tail = isLast ? cursor : null;
        const trimmedBlock = block.trim();

        // ── Display math block: \[...\] ──────────────────────────────────────
        if (trimmedBlock.startsWith("\\[")) {
          const closeIdx = trimmedBlock.indexOf("\\]", 2);
          if (closeIdx !== -1) {
            const math = trimmedBlock.slice(2, closeIdx).trim();
            return renderKatexBlock(math, bi, tail);
          }
          // Unclosed \[ during streaming — render nothing until it closes
          return null;
        }

        // ── Display math block: $$...$$ ──────────────────────────────────────
        if (trimmedBlock.startsWith("$$")) {
          const rest = trimmedBlock.slice(2);
          const closeIdx = rest.indexOf("$$");
          if (closeIdx !== -1) {
            const math = rest.slice(0, closeIdx).trim();
            return renderKatexBlock(math, bi, tail);
          }
          // Unclosed $$ during streaming — render nothing until it closes
          return null;
        }

        const lines = block.split("\n").filter((l, li, arr) => l.trim() !== "" || li < arr.length - 1);
        const first = lines[0] ?? "";

        if (first.startsWith("# ")) return (
          <div key={bi} style={{ fontSize: 22, fontWeight: 700, color: "#26211E", fontFamily: "var(--font-body)", lineHeight: "30px", marginTop: bi > 0 ? 10 : 0, marginBottom: isLast ? 0 : GAP + 2 }}>
            {renderInlineRich(first.slice(2), citations)}{tail}
          </div>
        );

        if (first.startsWith("## ")) return (
          <div key={bi} style={{ fontSize: 18, fontWeight: 600, color: "#26211E", fontFamily: "var(--font-body)", lineHeight: "26px", marginTop: bi > 0 ? 8 : 0, marginBottom: isLast ? 0 : GAP }}>
            {renderInlineRich(first.slice(3), citations)}{tail}
          </div>
        );

        if (first.startsWith("### ")) return (
          <div key={bi} style={{ fontSize: 16, fontWeight: 600, color: "#26211E", fontFamily: "var(--font-body)", lineHeight: "24px", marginTop: bi > 0 ? 6 : 0, marginBottom: isLast ? 0 : GAP }}>
            {renderInlineRich(first.slice(4), citations)}{tail}
          </div>
        );

        if (lines.length > 0 && lines.every((l) => l.startsWith("> "))) return (
          <div key={bi} style={{ borderLeft: "2.5px solid #EDE1D7", paddingLeft: 12, marginBottom: isLast ? 0 : GAP, color: "#6A625D", fontStyle: "italic", lineHeight: "26px" }}>
            {lines.map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInlineRich(l.slice(2), citations)}
              </React.Fragment>
            ))}
            {tail}
          </div>
        );

        const nonEmpty = lines.filter((l) => l.trim() !== "");
        if (nonEmpty.length > 0 && nonEmpty.every((l) => /^[-*]\s/.test(l.trim()))) return (
          <ul key={bi} style={{ margin: 0, marginBottom: isLast ? 0 : GAP, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 5 }}>
            {nonEmpty.map((l, li) => {
              const isLastItem = li === nonEmpty.length - 1;
              return (
                <li key={li} style={{ lineHeight: "24px", color: "#3B3632", fontSize: 16 }}>
                  {renderInlineRich(l.replace(/^[-*]\s/, ""), citations)}
                  {isLastItem && tail}
                </li>
              );
            })}
          </ul>
        );

        if (nonEmpty.length > 0 && nonEmpty.every((l) => /^\d+\.\s/.test(l.trim()))) return (
          <ol key={bi} style={{ margin: 0, marginBottom: isLast ? 0 : GAP, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 5 }}>
            {nonEmpty.map((l, li) => {
              const isLastItem = li === nonEmpty.length - 1;
              return (
                <li key={li} style={{ lineHeight: "24px", color: "#3B3632", fontSize: 16 }}>
                  {renderInlineRich(l.replace(/^\d+\.\s/, ""), citations)}
                  {isLastItem && tail}
                </li>
              );
            })}
          </ol>
        );

        if (lines.length === 1 && isBoldHeading(first)) return (
          <p key={bi} style={{ margin: 0, marginBottom: isLast ? 0 : GAP, lineHeight: "26px", fontWeight: 600, fontSize: 16, color: "#26211E" }}>
            {renderInlineRich(first, citations)}{tail}
          </p>
        );

        return (
          <p key={bi} style={{ margin: 0, marginBottom: isLast ? 0 : GAP, lineHeight: "26px", fontWeight: 400, fontSize: 16, color: "#3B3632" }}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInlineRich(line, citations)}
              </React.Fragment>
            ))}
            {tail}
          </p>
        );
      })}
    </div>
  );
}

// ── BreathingDot - streaming cursor ──────────────────────────────────────────

function BreathingDot() {
  return (
    <motion.span
      animate={{ opacity: [0.15, 1, 0.15] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#826B60", verticalAlign: "middle", marginLeft: 4 }}
    />
  );
}

// ── StructuredResponseWrapper - breathing dot until block starts animating ───

function StructuredResponseWrapper({ firstTokenDelay, onComplete, children }: {
  firstTokenDelay: number;
  onComplete: () => void;
  children: (onComplete: () => void) => React.ReactNode;
}) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), firstTokenDelay);
    return () => clearTimeout(t);
  }, [firstTokenDelay]);

  if (!started) {
    return <div style={{ height: 22, display: "flex", alignItems: "center" }}><BreathingDot /></div>;
  }
  return <>{children(onComplete)}</>;
}

// ── TableCell renderer ────────────────────────────────────────────────────────

function renderTableCell(cell: TableCellValue, badgeMap?: TableData["badgeMap"]): React.ReactNode {
  if (typeof cell === "object") {
    if (cell.type === "check") return (
      <span style={{ fontWeight: 600, fontSize: 14, color: cell.value ? "#80B707" : "#C0B5AD" }}>
        {cell.value ? "✓" : "-"}
      </span>
    );
    if (cell.type === "badge") return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        background: cell.bg, color: cell.color, border: `1px solid ${cell.border ?? cell.bg}`,
        borderRadius: 99, padding: "2px 9px", fontSize: 12, fontWeight: 600, lineHeight: "18px", whiteSpace: "nowrap",
      }}>
        {cell.label}
      </span>
    );
    if (cell.type === "rich") return (
      <div>
        <div style={{ fontSize: 14, color: "#26211E", fontWeight: 500 }}>{cell.text}</div>
        {cell.sub && <div style={{ fontSize: 11, color: "#9C938B", marginTop: 1 }}>{cell.sub}</div>}
        {cell.badge && (
          <span style={{
            display: "inline-flex", marginTop: 4, background: cell.badge.bg, color: cell.badge.color,
            border: `1px solid ${cell.badge.border ?? cell.badge.bg}`, borderRadius: 99,
            padding: "1px 7px", fontSize: 11, fontWeight: 600, lineHeight: "16px",
          }}>
            {cell.badge.label}
          </span>
        )}
      </div>
    );
  }
  const strVal = String(cell);
  if (badgeMap?.[strVal]) {
    const bs = badgeMap[strVal];
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        background: bs.bg, color: bs.color, border: `1px solid ${bs.border ?? bs.bg}`,
        borderRadius: 99, padding: "2px 9px", fontSize: 12, fontWeight: 600, lineHeight: "18px", whiteSpace: "nowrap",
      }}>
        {strVal}
      </span>
    );
  }
  if (strVal === "✓") return <span style={{ color: "#80B707", fontWeight: 700 }}>✓</span>;
  if (strVal === "-") return <span style={{ color: "#C0B5AD", fontWeight: 400 }}>-</span>;
  return strVal;
}

function sortableValue(cell: TableCellValue): string | number {
  if (typeof cell === "string" || typeof cell === "number") return cell;
  if (typeof cell === "object") {
    if (cell.type === "badge") return cell.label;
    if (cell.type === "rich") return cell.text;
    if (cell.type === "check") return cell.value ? 1 : 0;
  }
  return "";
}

// ── AnimatedTable ─────────────────────────────────────────────────────────────

function AnimatedTable({ data, onComplete }: { data: TableData; onComplete: () => void }) {
  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const [revealedRows, setRevealedRows] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [mdCopied, setMdCopied] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const v = data.variant ?? "basic";
  const isCompact = v === "compact";
  const isMinimal = v === "minimal";
  const isHoverable = v === "hoverable";
  const isFinancial = v === "financial";
  const isMixed = v === "mixed-content";

  const gridCols = data.headers
    .map((_, ci) => ((v === "feature-comparison" || v === "minimal" || isMixed) && ci === 0) ? "2fr" : "1fr")
    .join(" ");

  const cellPad = isCompact ? "6px 12px" : "10px 14px";
  const skelH = isCompact ? 9 : isMixed ? 28 : 12;
  const skelW = (ri: number, ci: number) => {
    if (v === "feature-comparison" && ci > 0) return 30 + ((ri * 7) % 20);
    if (isFinancial && ci > 0) return 55 + ((ri * 13 + ci * 9) % 25);
    return 40 + ((ri * 11 + ci * 17 + ri + ci) % 38);
  };

  const displayRows = useMemo(() => {
    const indexed = data.rows.map((row, i) => ({ row, origIdx: i }));
    if (sortCol === null) return indexed;
    return [...indexed].sort((a, b) => {
      const av = sortableValue(a.row[sortCol]), bv = sortableValue(b.row[sortCol]);
      const cmp = (typeof av === "number" && typeof bv === "number") ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data.rows, sortCol, sortDir]);

  useEffect(() => {
    const rowDelay = isCompact ? 52 : 72;
    const skT = setTimeout(() => {
      setSkeletonVisible(false);
      let idx = 0;
      const iv = setInterval(() => {
        idx++;
        setRevealedRows(idx);
        if (idx >= data.rows.length) {
          clearInterval(iv);
          setIsDone(true);
          setTimeout(onComplete, 280);
        }
      }, rowDelay);
    }, 500);
    return () => clearTimeout(skT);
  }, []); // eslint-disable-line

  const handleSort = (ci: number) => {
    if (!data.sortable) return;
    if (sortCol === ci) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(ci); setSortDir("asc"); }
  };

  const copyMarkdown = () => {
    const allRows = [data.headers, ...data.rows];
    const widths = data.headers.map((_, ci) => Math.max(...allRows.map((r) => String(r[ci]).length)));
    const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toRow = (r: any[]) => "| " + r.map((c, i) => pad(String(typeof c === "object" ? (c as Record<string, string>).text ?? (c as Record<string, string>).label ?? "" : c), widths[i])).join(" | ") + " |";
    const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
    navigator.clipboard.writeText([toRow(data.headers), sep, ...data.rows.map(toRow)].join("\n")).catch(() => {});
    setMdCopied(true);
    setTimeout(() => setMdCopied(false), 1500);
  };

  const rowBg = (ri: number, isAccentRow: boolean, isTotalsRow: boolean) => {
    if (isAccentRow) return "rgba(104,61,27,0.04)";
    if (isTotalsRow) return "rgba(59,54,50,0.05)";
    if (isHoverable && hoveredRow === ri) return "rgba(104,61,27,0.04)";
    if (v === "striped" && ri % 2 === 1) return "rgba(59,54,50,0.05)";
    return "white";
  };
  const cellBorderLeft = (ci: number) => {
    if (isMinimal || isHoverable || isMixed) return "none";
    return ci > 0 ? "1px solid rgba(59,54,50,0.05)" : "none";
  };
  const rowBorderBottom = (ri: number) => {
    if (ri >= data.rows.length - 1) return "none";
    if (isMinimal) return "1px solid rgba(59,54,50,0.05)";
    return "1px solid rgba(82,75,71,0.12)";
  };

  return (
    <div>
      <div style={{ border: "1px solid #F2E8E0", borderRadius: 12, overflow: "hidden", fontSize: 14, ...(isMinimal ? { border: "none", borderRadius: 0 } : {}) }}>
        <AnimatePresence>
          {data.caption && isDone && (
            <motion.div key="cap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
              style={{ padding: "7px 14px", borderBottom: "1px solid #F2E8E0", fontSize: 11, color: "#9C938B", fontStyle: "italic" }}>
              {data.caption}
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, background: isMinimal ? "transparent" : "rgba(59,54,50,0.05)", borderBottom: "1px solid #F2E8E0" }}>
          {data.headers.map((h, ci) => (
            <div key={ci} onClick={() => handleSort(ci)}
              style={{
                padding: isCompact ? "6px 12px" : "9px 14px",
                fontWeight: 600, color: "#26211E", fontSize: 14, letterSpacing: "0.1px",
                borderLeft: (!isMinimal && !isHoverable) ? (ci > 0 ? "1px solid rgba(59,54,50,0.10)" : "none") : "none",
                cursor: data.sortable ? "pointer" : "default",
                userSelect: "none", display: "flex", alignItems: "center", gap: 5,
                justifyContent: (isFinancial && ci > 0) ? "flex-end" : (v === "feature-comparison" && ci > 0) ? "center" : "flex-start",
              }}
              onMouseEnter={(e) => { if (data.sortable) e.currentTarget.style.background = "rgba(59,54,50,0.10)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <span>{h}</span>
              {data.sortable && (
                <span style={{ fontSize: 10, lineHeight: 1, color: sortCol === ci ? "#683D1B" : "#C0B5AD" }}>
                  {sortCol === ci ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Skeleton */}
        <AnimatePresence>
          {skeletonVisible && (
            <motion.div key="skeleton" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {data.rows.map((_, ri) => (
                <motion.div key={ri}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: ri * 0.045, duration: 0.18 }}
                  style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: rowBorderBottom(ri), background: v === "striped" && ri % 2 === 1 ? "rgba(59,54,50,0.05)" : "white" }}>
                  {data.headers.map((_, ci) => (
                    <div key={ci} style={{ padding: cellPad, borderLeft: cellBorderLeft(ci), display: "flex", justifyContent: (isFinancial && ci > 0) ? "flex-end" : (v === "feature-comparison" && ci > 0) ? "center" : "flex-start" }}>
                      {isMixed && ci === 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "100%" }}>
                          <motion.div animate={{ opacity: [0.35, 0.85, 0.35] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: (ri + ci) * 0.06 }}
                            style={{ height: 11, width: `${skelW(ri, ci)}%`, background: "rgba(59,54,50,0.10)", borderRadius: 3 }} />
                          <motion.div animate={{ opacity: [0.25, 0.65, 0.25] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: (ri + ci) * 0.06 + 0.1 }}
                            style={{ height: 8, width: `${skelW(ri, ci) * 0.6}%`, background: "rgba(59,54,50,0.05)", borderRadius: 3 }} />
                        </div>
                      ) : (
                        <motion.div animate={{ opacity: [0.35, 0.85, 0.35] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: (ri + ci) * 0.06 }}
                          style={{ height: skelH, width: `${skelW(ri, ci)}%`, background: "rgba(59,54,50,0.10)", borderRadius: 4 }} />
                      )}
                    </div>
                  ))}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real rows */}
        <AnimatePresence initial={false}>
          {displayRows.slice(0, revealedRows).map(({ row, origIdx }, ri) => {
            const isTotalsRow = !!(data.totalsRow && origIdx === data.rows.length - 1);
            const isAccentRow = !!(data.accentRows?.includes(origIdx));
            const bg = rowBg(ri, isAccentRow, isTotalsRow);
            return (
              <motion.div key={`r-${origIdx}`}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onMouseEnter={() => { if (isHoverable) setHoveredRow(ri); }}
                onMouseLeave={() => { if (isHoverable) setHoveredRow(null); }}
                style={{ display: "grid", gridTemplateColumns: gridCols, position: "relative", borderBottom: rowBorderBottom(ri), borderTop: isTotalsRow ? "2px solid rgba(59,54,50,0.15)" : "none", background: bg, transition: "background 100ms", cursor: isHoverable ? "pointer" : "default" }}>
                {isAccentRow && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#683D1B" }} />}
                {row.map((cell, ci) => {
                  const isNumericCell = typeof cell === "number";
                  const rightAlign = (isFinancial && ci > 0) || isNumericCell;
                  const centerAlign = v === "feature-comparison" && ci > 0 && typeof cell === "object";
                  return (
                    <div key={ci} style={{
                      padding: cellPad,
                      paddingLeft: isAccentRow && ci === 0 ? 17 : (isCompact ? 12 : 14),
                      color: ci === 0 && !isTotalsRow ? "#26211E" : isTotalsRow ? "#26211E" : "#524B47",
                      fontWeight: isTotalsRow ? 600 : ci === 0 && !isMixed ? 500 : 400,
                      borderLeft: cellBorderLeft(ci),
                      fontSize: isCompact ? 12 : isNumericCell ? 13 : 14,
                      textAlign: rightAlign ? "right" : centerAlign ? "center" : "left",
                      display: centerAlign ? "flex" : "block",
                      alignItems: centerAlign ? "center" : undefined,
                      justifyContent: centerAlign ? "center" : undefined,
                      lineHeight: isMixed ? "1" : "20px",
                    }}>
                      {renderTableCell(cell, data.badgeMap)}
                    </div>
                  );
                })}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isDone && (
          <motion.div key="actions" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
            style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, paddingLeft: 1 }}>
            <span style={{ fontSize: 11, color: "#C0B5AD", flex: 1 }}>
              {data.rows.length} rows · {data.headers.length} col
            </span>
            <button onClick={copyMarkdown} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "3px 9px",
              borderRadius: 6, border: "1px solid rgba(82,75,71,0.12)",
              background: "transparent", cursor: "pointer", fontSize: 11, color: "#827A74",
              fontFamily: "inherit", transition: "all 120ms",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,54,50,0.05)"; e.currentTarget.style.color = "#524B47"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#827A74"; }}>
              {mdCopied ? <HIcon icon={Checkmark} size={11} color="#80B707" strokeWidth={2.5} /> : <HIcon icon={Copy01Icon} size={11} color="#827A74" strokeWidth={1.5} />}
              {mdCopied ? "Copied!" : "Copy markdown"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── AnimatedBarChart - 6 variants ─────────────────────────────────────────────

const BAR_PALETTE = ["#683D1B", "#0D6EB2", "#80B707", "#9C938B", "#A28847", "#524B47"];

function BarChartShell({ title, variant, children }: { title?: string; variant: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #F2E8E0", borderRadius: 12, padding: "16px 18px 14px" }}>
      {title && <div style={{ fontSize: 13, fontWeight: 600, color: "#26211E", marginBottom: 4 }}>{title}</div>}
      <div style={{ fontSize: 10, color: "#C0B5AD", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 14 }}>
        {variant} chart
      </div>
      {children}
    </div>
  );
}

function AnimatedBarChart({ data, onComplete }: { data: BarChartData; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const v = data.variant ?? "vertical";

  const chartH: number = (() => {
    switch (v) {
      case "positive-negative": return 220;
      case "grouped": return Math.max((data.labels?.length ?? 1) * 44, 180);
      case "stacked": return Math.max((data.labels?.length ?? 1) * 44, 180);
      case "stacked-100": return 180;
      default: return Math.max((data.bars?.length ?? 1) * 36, 140);
    }
  })();

  let totalDelay: number;
  if (v === "grouped" || v === "stacked") {
    const n = (data.labels?.length ?? 1) * (data.datasets?.length ?? 1);
    totalDelay = Math.max(n - 1, 0) * 60 + 980;
  } else if (v === "stacked-100") {
    const n = (data.labels?.length ?? 1) * (data.datasets?.length ?? 1);
    totalDelay = Math.max(n - 1, 0) * 50 + 780;
  } else {
    totalDelay = Math.max((data.bars?.length ?? 1) - 1, 0) * 100 + 980;
  }

  useEffect(() => {
    const t = setTimeout(() => { setRevealed(true); setTimeout(onComplete, totalDelay); }, 140);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  if (v === "vertical") {
    const maxVal = data.bars.length > 0 ? (data.maxValue ?? Math.max(...data.bars.map((b) => b.value)) * 1.2) : 1;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ position: "relative", height: chartH }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <motion.div key={pct} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: "absolute", bottom: `${pct * chartH}px`, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.10)", pointerEvents: "none" }} />
          ))}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: "100%" }}>
            {data.bars.map((bar, i) => {
              const barH = Math.max((bar.value / maxVal) * chartH, 4);
              const color = bar.color ?? BAR_PALETTE[i % BAR_PALETTE.length];
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: i * 0.1 + 0.55, duration: 0.2 }}
                    style={{ fontSize: 11, fontWeight: 600, color: "#524B47", marginBottom: 4, lineHeight: 1 }}>
                    {bar.value}{data.unit ?? ""}
                  </motion.div>
                  <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 140, damping: 18, mass: 1, delay: i * 0.1 }}
                    style={{ width: "100%", height: barH, background: color, borderRadius: "4px 4px 0 0", transformOrigin: "bottom" }} />
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(59,54,50,0.15)", margin: "0 0 8px" }} />
        <div style={{ display: "flex", gap: 10 }}>
          {data.bars.map((bar, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#9C938B", lineHeight: "16px" }}>{bar.label}</div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  if (v === "horizontal") {
    const maxVal = data.bars.length > 0 ? Math.max(...data.bars.map((b) => b.value)) * 1.1 : 1;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.bars.map((bar, i) => {
            const color = bar.color ?? BAR_PALETTE[i % BAR_PALETTE.length];
            const pct = bar.value / maxVal;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 120, fontSize: 12, color: "#524B47", textAlign: "right", flexShrink: 0, lineHeight: "16px" }}>{bar.label}</div>
                <div style={{ flex: 1, position: "relative", height: 24, background: "rgba(59,54,50,0.05)", borderRadius: 4, overflow: "hidden" }}>
                  <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: revealed ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 120, damping: 20, delay: i * 0.08 }}
                    style={{ position: "absolute", inset: 0, width: `${pct * 100}%`, background: color, borderRadius: 4, transformOrigin: "left" }} />
                </div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: i * 0.08 + 0.5, duration: 0.2 }}
                  style={{ width: 44, fontSize: 12, fontWeight: 600, color: "#26211E", flexShrink: 0 }}>
                  {bar.value}{data.unit ?? ""}
                </motion.div>
              </div>
            );
          })}
        </div>
      </BarChartShell>
    );
  }

  if (v === "grouped" && data.datasets && data.labels) {
    const allVals = data.datasets.flatMap((ds) => ds.values);
    const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.15 : 1;
    const nDatasets = data.datasets.length;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ position: "relative", height: chartH }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <motion.div key={pct} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: "absolute", bottom: `${pct * chartH}px`, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.10)", pointerEvents: "none" }} />
          ))}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: "100%" }}>
            {data.labels.map((label, gi) => (
              <div key={gi} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, height: "100%" }}>
                {data.datasets!.map((ds, di) => {
                  const val = ds.values[gi];
                  const barH = Math.max((val / maxVal) * chartH, 3);
                  const color = ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length];
                  const globalIdx = gi * nDatasets + di;
                  return (
                    <motion.div key={di} initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                      transition={{ type: "spring", stiffness: 140, damping: 18, mass: 1, delay: globalIdx * 0.06 }}
                      style={{ flex: 1, height: barH, background: color, borderRadius: "3px 3px 0 0", transformOrigin: "bottom" }} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(59,54,50,0.15)", margin: "0 0 8px" }} />
        <div style={{ display: "flex", gap: 16 }}>
          {data.labels.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#9C938B", lineHeight: "16px" }}>{label}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          {data.datasets.map((ds, di) => (
            <div key={di} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#827A74" }}>{ds.label}</span>
            </div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  if (v === "stacked" && data.datasets && data.labels) {
    const totals = data.labels.map((_, gi) => data.datasets!.reduce((s, ds) => s + ds.values[gi], 0));
    const maxTotal = Math.max(...totals) * 1.1;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ position: "relative", height: chartH }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <motion.div key={pct} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: "absolute", bottom: `${pct * chartH}px`, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.10)", pointerEvents: "none" }} />
          ))}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: "100%" }}>
            {data.labels.map((label, gi) => {
              const total = totals[gi];
              const colH = (total / maxTotal) * chartH;
              return (
                <div key={gi} style={{ flex: 1, height: colH, display: "flex", flexDirection: "column-reverse", borderRadius: "4px 4px 0 0", overflow: "hidden" }}>
                  {data.datasets!.map((ds, di) => {
                    const segH = (ds.values[gi] / maxTotal) * chartH;
                    const color = ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length];
                    return (
                      <motion.div key={di} initial={{ height: 0 }} animate={{ height: revealed ? segH : 0 }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: gi * 0.12 + di * 0.05 }}
                        style={{ width: "100%", background: color, flexShrink: 0 }} />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(59,54,50,0.15)", margin: "0 0 8px" }} />
        <div style={{ display: "flex", gap: 14 }}>
          {data.labels.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#9C938B", lineHeight: "16px" }}>{label}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          {data.datasets.map((ds, di) => (
            <div key={di} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#827A74" }}>{ds.label}</span>
            </div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  if (v === "stacked-100" && data.datasets && data.labels) {
    const totals = data.labels.map((_, gi) => data.datasets!.reduce((s, ds) => s + ds.values[gi], 0));
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ display: "flex", gap: 10, height: chartH }}>
          {data.labels.map((label, gi) => {
            const total = totals[gi];
            return (
              <div key={gi} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, borderRadius: 4, overflow: "hidden", height: "100%" }}>
                {data.datasets!.map((ds, di) => {
                  const pct = total > 0 ? (ds.values[gi] / total) * 100 : 0;
                  const color = ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length];
                  return (
                    <motion.div key={di} initial={{ flex: 0 }} animate={{ flex: revealed ? pct : 0 }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: gi * 0.1 + di * 0.04 }}
                      style={{ background: color, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", minHeight: pct > 8 ? 16 : 0 }}>
                      {pct > 8 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: 600, lineHeight: 1 }}>{Math.round(pct)}%</span>}
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{ height: 1, background: "rgba(59,54,50,0.15)", margin: "6px 0 8px" }} />
        <div style={{ display: "flex", gap: 10 }}>
          {data.labels.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#9C938B", lineHeight: "16px" }}>{label}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          {data.datasets.map((ds, di) => (
            <div key={di} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#827A74" }}>{ds.label}</span>
            </div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  if (v === "positive-negative") {
    const absMax = Math.max(Math.max(...data.bars.map((b) => Math.abs(b.value))) * 1.15, 1);
    const halfH = chartH / 2;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ position: "relative", height: chartH }}>
          <div style={{ position: "absolute", top: halfH, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.30)", zIndex: 1 }} />
          {[-1, 1].map((side) => (
            <motion.div key={side} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: "absolute", top: halfH - side * halfH * 0.5, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.05)", pointerEvents: "none" }} />
          ))}
          <div style={{ position: "absolute", inset: 0, display: "flex", gap: 10 }}>
            {data.bars.map((bar, i) => {
              const color = bar.color ?? (bar.value >= 0 ? "#80B707" : "#E05454");
              const barH = Math.max(Math.abs(bar.value) / absMax * halfH, 3);
              const isPos = bar.value >= 0;
              return (
                <div key={i} style={{ flex: 1, height: "100%", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: halfH, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                    {isPos && (
                      <motion.div initial={{ height: 0 }} animate={{ height: revealed ? barH : 0 }}
                        transition={{ type: "spring", stiffness: 140, damping: 18, delay: i * 0.1 }}
                        style={{ width: "68%", background: color, borderRadius: "3px 3px 0 0" }} />
                    )}
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: halfH, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
                    {!isPos && (
                      <motion.div initial={{ height: 0 }} animate={{ height: revealed ? barH : 0 }}
                        transition={{ type: "spring", stiffness: 140, damping: 18, delay: i * 0.1 }}
                        style={{ width: "68%", background: color, borderRadius: "0 0 3px 3px" }} />
                    )}
                  </div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: i * 0.1 + 0.55, duration: 0.2 }}
                    style={{ position: "absolute", top: halfH - 8, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 700, color, lineHeight: "16px", background: "white", padding: "0 3px", borderRadius: 3, zIndex: 2 }}>
                    {bar.value > 0 ? "+" : ""}{bar.value}
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {data.bars.map((bar, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#9C938B", lineHeight: "16px" }}>{bar.label}</div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  return null;
}

// ── AnimatedSteps ─────────────────────────────────────────────────────────────

function AnimatedSteps({ data, onComplete }: { data: StepsData; onComplete: () => void }) {
  const [revealedSteps, setRevealedSteps] = useState(0);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setRevealedSteps(idx);
      if (idx >= data.steps.length) { clearInterval(interval); setTimeout(onComplete, 320); }
    }, 220);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
      {data.title && <div style={{ fontSize: 14, fontWeight: 600, color: "#26211E", marginBottom: 18, lineHeight: "20px" }}>{data.title}</div>}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <AnimatePresence initial={false}>
          {data.steps.slice(0, revealedSteps).map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "flex", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.04 }}
                  style={{ width: 24, height: 24, borderRadius: "50%", background: "#683D1B", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </motion.div>
                {i < data.steps.length - 1 && (
                  <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                    transition={{ duration: 0.22, delay: 0.12, ease: "easeOut" }}
                    style={{ width: 1, flex: 1, minHeight: 20, background: "#EDE1D7", transformOrigin: "top", marginTop: 4 }} />
                )}
              </div>
              <div style={{ paddingBottom: i < data.steps.length - 1 ? 18 : 0, paddingTop: 2, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#26211E", lineHeight: "20px" }}>{step.label}</div>
                {step.description && <div style={{ fontSize: 13, color: "#827A74", lineHeight: "20px", marginTop: 3 }}>{step.description}</div>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── AnimatedCodeBlock ─────────────────────────────────────────────────────────

function highlightCode(line: string): React.ReactNode[] {
  const KW_COLOR = "#7BB8F5";
  const STR_COLOR = "#F0B060";
  const CMT_COLOR = "#6A625D";
  const NUM_COLOR = "#C598E8";
  const DEF_COLOR = "#E8DDD6";
  const DIM_COLOR = "rgba(232,221,214,0.5)";

  const JS_KEYWORDS = new Set([
    "import", "export", "from", "const", "let", "var", "function", "async", "await",
    "return", "new", "if", "else", "for", "of", "in", "class", "extends", "interface",
    "type", "default", "true", "false", "null", "undefined", "process", "console", "log",
  ]);

  if (line.trim().startsWith("//") || line.trim().startsWith("#")) {
    return [<span key="c" style={{ color: CMT_COLOR, fontStyle: "italic" }}>{line}</span>];
  }

  const tokens: React.ReactNode[] = [];
  let rem = line, k = 0;

  while (rem.length > 0) {
    if (rem.startsWith("//")) { tokens.push(<span key={k++} style={{ color: CMT_COLOR, fontStyle: "italic" }}>{rem}</span>); break; }
    const strM = rem.match(/^(['"`])(?:(?!\1)[^\\]|\\.)*\1/);
    if (strM) { tokens.push(<span key={k++} style={{ color: STR_COLOR }}>{strM[0]}</span>); rem = rem.slice(strM[0].length); continue; }
    const wordM = rem.match(/^[a-zA-Z_$][\w$]*/);
    if (wordM) { const w = wordM[0]; tokens.push(<span key={k++} style={{ color: JS_KEYWORDS.has(w) ? KW_COLOR : DEF_COLOR }}>{w}</span>); rem = rem.slice(w.length); continue; }
    const numM = rem.match(/^\d+\.?\d*/);
    if (numM) { tokens.push(<span key={k++} style={{ color: NUM_COLOR }}>{numM[0]}</span>); rem = rem.slice(numM[0].length); continue; }
    const ch = rem[0];
    const isPunct = ".:,;(){}[]=+-><!".includes(ch);
    tokens.push(<span key={k++} style={{ color: isPunct ? DIM_COLOR : DEF_COLOR }}>{ch}</span>);
    rem = rem.slice(1);
  }
  return tokens;
}

const CODE_COLLAPSE_THRESHOLD = 20;

function AnimatedCodeBlock({ data, onComplete }: { data: CodeData; onComplete: () => void }) {
  const lines = data.code.split("\n");
  const totalLines = lines.length;
  const isLong = totalLines > CODE_COLLAPSE_THRESHOLD;

  const [revealedLines, setRevealedLines] = useState(0);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copyHovered, setCopyHovered] = useState(false);

  const streamDone = revealedLines >= totalLines;
  const visibleLines = streamDone && isLong && !expanded
    ? lines.slice(0, CODE_COLLAPSE_THRESHOLD)
    : lines.slice(0, revealedLines);
  const hiddenCount = totalLines - CODE_COLLAPSE_THRESHOLD;

  useEffect(() => {
    let idx = 0;
    const interval = Math.min(55, Math.round(1400 / totalLines));
    const t = setInterval(() => {
      idx++;
      setRevealedLines(idx);
      if (idx >= totalLines) { clearInterval(t); setTimeout(onComplete, 200); }
    }, interval);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
      {data.caption && <div style={{ fontSize: 12, color: "#827A74", marginBottom: 6 }}>{data.caption}</div>}
      <div style={{ background: "#1E1A17", borderRadius: 10, overflow: "hidden", boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.9), 0px 1px 1px rgba(59,54,50,0.12), 0px 2px 4px rgba(59,54,50,0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px 7px 14px", borderBottom: "1px solid rgba(255,255,255,0.055)", background: "linear-gradient(180deg, rgba(82,75,71,0.30) 0%, rgba(38,33,30,0.30) 100%)" }}>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.4px", color: "rgba(182,172,164,0.55)", fontFamily: "var(--font-code, monospace)", textTransform: "uppercase" }}>
            {data.language ?? "code"}
          </span>
          <motion.button onClick={() => { navigator.clipboard.writeText(data.code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
            onMouseEnter={() => setCopyHovered(true)}
            onMouseLeave={() => setCopyHovered(false)}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={{
              width: 76, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "5px 0 6px", borderRadius: 8, border: "none", cursor: "pointer",
              background: copyHovered ? "linear-gradient(180deg, #6A625D 0%, #3B3632 100%)" : "linear-gradient(180deg, #524B47 0%, #26211E 100%)",
              boxShadow: ["0px 0px 0px 1px rgba(0,0,0,0.85)", "0px 1px 1px rgba(59,54,50,0.10)", "0px 1.5px 3px rgba(59,54,50,0.35)", copyHovered ? "inset 0px 1px 0.4px rgba(247,242,237,0.42)" : "inset 0px 1px 0.4px rgba(247,242,237,0.28)", "inset 0px -2px 0.4px #120C08"].join(", "),
              transition: "background 160ms ease, box-shadow 160ms ease",
            }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {copied ? (
                <motion.span key="done" initial={{ opacity: 0, y: 6, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.85 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <HIcon icon={Checkmark} size={12} color="#80B707" strokeWidth={2.5} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#80B707", fontFamily: "var(--font-body)", whiteSpace: "nowrap" }}>Copied</span>
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ opacity: 0, y: 6, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.85 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <HIcon icon={Copy01Icon} size={12} color="rgba(182,172,164,0.72)" strokeWidth={1.5} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(182,172,164,0.72)", fontFamily: "var(--font-body)", whiteSpace: "nowrap" }}>Copy</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
        <pre style={{ margin: 0, padding: "14px 16px", fontSize: 13, lineHeight: "20px", fontFamily: "var(--font-code, monospace)", overflowX: "auto" }}>
          {visibleLines.map((line, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.08 }}
              style={{ display: "flex", gap: 14 }}>
              <span style={{ color: "rgba(59,54,50,0.55)", userSelect: "none", fontSize: 11, minWidth: 18, textAlign: "right", flexShrink: 0, lineHeight: "20px" }}>{i + 1}</span>
              <span>{highlightCode(line)}</span>
            </motion.div>
          ))}
          {!streamDone && (
            <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.7, repeat: Infinity }}
              style={{ display: "inline-block", width: 7, height: 14, background: "#683D1B", borderRadius: 1, verticalAlign: "middle", marginLeft: 32 }} />
          )}
        </pre>
        <AnimatePresence initial={false}>
          {streamDone && isLong && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {!expanded ? (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", top: -48, left: 0, right: 0, height: 48, background: "linear-gradient(to bottom, transparent, #1E1A17)", pointerEvents: "none" }} />
                  <button onClick={() => setExpanded(true)} style={{ width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.055)", border: "none", borderRadius: "0 0 10px 10px", cursor: "pointer", transition: "background 120ms" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4.5 L6 8 L10 4.5" stroke="rgba(182,172,164,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(182,172,164,0.5)", fontFamily: "var(--font-body)" }}>Show {hiddenCount} more {hiddenCount === 1 ? "line" : "lines"} of code</span>
                  </button>
                </div>
              ) : (
                <button onClick={() => setExpanded(false)} style={{ width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.055)", border: "none", borderRadius: "0 0 10px 10px", cursor: "pointer", transition: "background 120ms" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 7.5 L6 4 L10 7.5" stroke="rgba(182,172,164,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(182,172,164,0.5)", fontFamily: "var(--font-body)" }}>Show less</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── AnimatedCallout ───────────────────────────────────────────────────────────

const CALLOUT_CFG = {
  info:    { bg: "rgba(13,110,178,0.07)",  border: "#0D6EB2", icon: InformationCircleIcon, color: "#0D6EB2" },
  warning: { bg: "rgba(200,146,10,0.08)",  border: "#C8920A", icon: Alert01Icon,           color: "#C8920A" },
  success: { bg: "rgba(128,183,7,0.07)",   border: "#80B707", icon: CheckmarkCircle01Icon, color: "#80B707" },
  error:   { bg: "rgba(200,50,50,0.07)",   border: "#C83232", icon: Cancel01Icon,          color: "#C83232" },
  tip:     { bg: "rgba(104,61,27,0.07)",   border: "#683D1B", icon: Idea01Icon,            color: "#683D1B" },
} as const;

function AnimatedCallout({ data, onComplete }: { data: CalloutData; onComplete: () => void }) {
  const cfg = CALLOUT_CFG[data.variant];
  useEffect(() => { const t = setTimeout(onComplete, 440); return () => clearTimeout(t); }, []); // eslint-disable-line
  return (
    <motion.div initial={{ opacity: 0, x: -10, y: 4 }} animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      style={{ borderLeft: `3px solid ${cfg.border}`, background: cfg.bg, borderRadius: "0 10px 10px 0", padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, marginTop: 1, lineHeight: 0 }}>
        <HIcon icon={cfg.icon} size={16} color={cfg.color} strokeWidth={1.8} />
      </span>
      <div>
        {data.title && <div style={{ fontWeight: 600, fontSize: 14, color: "#26211E", marginBottom: 4, lineHeight: "20px" }}>{data.title}</div>}
        <div style={{ fontSize: 14, lineHeight: "21px", color: "#524B47" }}>{renderInlineMd(data.body)}</div>
      </div>
    </motion.div>
  );
}

// ── AnimatedTags ──────────────────────────────────────────────────────────────

const TAG_PALETTES = [
  { bg: "rgba(104,61,27,0.1)",   text: "#683D1B",  border: "rgba(104,61,27,0.2)" },
  { bg: "rgba(59,54,50,0.07)",   text: "#524B47",  border: "rgba(59,54,50,0.14)" },
  { bg: "rgba(13,110,178,0.09)", text: "#0D6EB2",  border: "rgba(13,110,178,0.18)" },
  { bg: "rgba(128,183,7,0.09)",  text: "#627A1A",  border: "rgba(128,183,7,0.2)" },
  { bg: "rgba(156,147,139,0.12)",text: "#6A625D",  border: "rgba(156,147,139,0.24)" },
];

function AnimatedTags({ data, onComplete }: { data: TagsData; onComplete: () => void }) {
  const [revealedTags, setRevealedTags] = useState(0);
  useEffect(() => {
    let idx = 0;
    const t = setInterval(() => {
      idx++;
      setRevealedTags(idx);
      if (idx >= data.tags.length) { clearInterval(t); setTimeout(onComplete, 160); }
    }, 90);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
      {data.title && <div style={{ fontSize: 12, fontWeight: 500, color: "#9A9089", marginBottom: 9, textTransform: "uppercase", letterSpacing: "0.5px" }}>{data.title}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {data.tags.slice(0, revealedTags).map((tag, i) => {
          const pal = TAG_PALETTES[i % TAG_PALETTES.length];
          const bg = tag.color ? `${tag.color}15` : pal.bg;
          const fg = tag.color ?? pal.text;
          const bd = tag.color ? `${tag.color}28` : pal.border;
          return (
            <motion.span key={i} initial={{ scale: 0.55, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}>
              <span style={{ display: "inline-flex", alignItems: "center", background: bg, border: `1px solid ${bd}`, color: fg, borderRadius: 99, padding: "3px 11px", fontSize: 13, fontWeight: 500, lineHeight: "19px" }}>
                {tag.label}
              </span>
            </motion.span>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── AnimatedPieChart ──────────────────────────────────────────────────────────

const PIE_COLORS_HEX = ["#683D1B", "#0D6EB2", "#80B707", "#9C938B", "#524B47", "#A28847"];

function AnimatedPieChart({ data, onComplete }: { data: PieChartData; onComplete: () => void }) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const R = 90, CX = 110, CY = 110, SW = 26;
  const circ = 2 * Math.PI * R;
  const total = data.segments.reduce((s, seg) => s + seg.value, 0);

  let cumPct = 0;
  const arcs = data.segments.map((seg, i) => {
    const pct = seg.value / total;
    const startDeg = cumPct * 360 - 90;
    cumPct += pct;
    return { pct, startDeg, dashLen: pct * circ, gapLen: (1 - pct) * circ, color: seg.color ?? PIE_COLORS_HEX[i % PIE_COLORS_HEX.length], label: seg.label, value: seg.value };
  });

  useEffect(() => {
    let idx = 0;
    const t = setInterval(() => {
      idx++;
      setRevealedCount(idx);
      if (idx >= data.segments.length) { clearInterval(t); setTimeout(onComplete, 800); }
    }, 180);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  return (
    <div style={{ background: "white", border: "1px solid #F2E8E0", borderRadius: 12, padding: "18px 20px" }}>
      {data.title && <div style={{ fontSize: 13, fontWeight: 600, color: "#26211E", marginBottom: 4 }}>{data.title}</div>}
      <div style={{ fontSize: 10, color: "#C0B5AD", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 16 }}>pie chart</div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <svg width={220} height={220} viewBox="0 0 220 220" style={{ display: "block", maxWidth: "100%" }}>
          <circle r={R} cx={CX} cy={CY} fill="none" stroke="rgba(59,54,50,0.07)" strokeWidth={SW} />
          {arcs.map((arc, i) => (
            <circle key={i} r={R} cx={CX} cy={CY} fill="none" stroke={arc.color}
              strokeWidth={i === hoveredIdx ? SW + 4 : SW}
              strokeDasharray={`${arc.dashLen} ${arc.gapLen}`}
              strokeDashoffset={i < revealedCount ? 0 : arc.dashLen}
              transform={`rotate(${arc.startDeg} ${CX} ${CY})`}
              style={{ transition: "stroke-dashoffset 0.52s cubic-bezier(0.16,1,0.3,1), stroke-width 120ms", strokeLinecap: "butt", cursor: "pointer" }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
          {hoveredIdx !== null ? (
            <>
              <text x={CX} y={CY - 6} textAnchor="middle" fill={arcs[hoveredIdx].color} fontSize={22} fontWeight="700" fontFamily="inherit">{Math.round(arcs[hoveredIdx].pct * 100)}%</text>
              <text x={CX} y={CY + 16} textAnchor="middle" fill="#9C938B" fontSize={10} fontFamily="inherit">{data.unit ? `${Math.round(arcs[hoveredIdx].pct * total)}${data.unit}` : arcs[hoveredIdx].label.split(" ").slice(0, 2).join(" ")}</text>
            </>
          ) : (
            <>
              {data.centerLabel && <text x={CX} y={CY - 4} textAnchor="middle" fill="#26211E" fontSize={24} fontWeight="700" fontFamily="inherit">{data.centerLabel}</text>}
              <text x={CX} y={CY + 16} textAnchor="middle" fill="#9C938B" fontSize={10} fontFamily="inherit">total</text>
            </>
          )}
        </svg>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
        {arcs.map((arc, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: i < revealedCount ? 1 : 0, y: i < revealedCount ? 0 : 4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default", opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.45 : undefined, transition: "opacity 120ms" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: arc.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#524B47", lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{arc.label}</div>
              <div style={{ fontSize: 11, color: "#9C938B", lineHeight: "15px" }}>
                {Math.round(arc.pct * 100)}%
                {data.unit && <span style={{ marginLeft: 4 }}>{Math.round(arc.pct * total)}{data.unit}</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── AnimatedLineChart ─────────────────────────────────────────────────────────

function AnimatedLineChart({ data, onComplete }: { data: LineChartData; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverContainerX, setHoverContainerX] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const W = 700, H = 160;
  const PAD = { top: 14, right: 18, bottom: 32, left: 38 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const LINE_COLORS = ["#683D1B", "#0D6EB2", "#80B707", "#9C938B"];

  const allY = data.lines.flatMap((l) => l.points.map((p) => p.y));
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const range = maxY - minY || 1;
  const maxXIdx = (data.lines[0]?.points.length ?? 1) - 1 || 1;

  const toSVG = (xi: number, y: number) => ({
    x: PAD.left + (xi / maxXIdx) * chartW,
    y: PAD.top + (1 - (y - minY) / range) * chartH,
  });

  useEffect(() => {
    const t = setTimeout(() => { setRevealed(true); setTimeout(onComplete, 1300); }, 120);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !containerRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const contRect = containerRef.current.getBoundingClientRect();
    const scaleX = W / svgRect.width;
    const svgX = (e.clientX - svgRect.left) * scaleX;
    if (svgX < PAD.left || svgX > PAD.left + chartW) { setHoverIdx(null); return; }
    const xi = Math.round((svgX - PAD.left) / chartW * maxXIdx);
    setHoverIdx(Math.max(0, Math.min(maxXIdx, xi)));
    setHoverContainerX(e.clientX - contRect.left);
  };

  const tooltipItems = hoverIdx !== null
    ? data.lines.map((line, li) => ({ label: line.label ?? `Series ${li + 1}`, value: line.points[hoverIdx]?.y ?? 0, color: line.color ?? LINE_COLORS[li % LINE_COLORS.length] }))
    : [];

  const crosshairSvgX = hoverIdx !== null ? PAD.left + (hoverIdx / maxXIdx) * chartW : 0;
  const tooltipWidth = 120;
  const tooltipLeft = Math.min(Math.max(hoverContainerX - tooltipWidth / 2, 4), (containerRef.current?.clientWidth ?? 360) - tooltipWidth - 4);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: "white", border: "1px solid #F2E8E0", borderRadius: 12, padding: "16px 18px 12px" }}>
      {data.title && <div style={{ fontSize: 13, fontWeight: 600, color: "#26211E", marginBottom: 14 }}>{data.title}</div>}
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const yv = PAD.top + pct * chartH;
            return <motion.line key={pct} x1={PAD.left} x2={PAD.left + chartW} y1={yv} y2={yv} stroke="rgba(59,54,50,0.07)" strokeWidth={1} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.3, delay: 0.1 }} />;
          })}
          {[0, 0.5, 1].map((pct) => {
            const val = maxY - pct * range;
            return <text key={pct} x={PAD.left - 6} y={PAD.top + pct * chartH + 4} textAnchor="end" fill="#C0B5AD" fontSize={11} fontFamily="inherit">{Math.round(val)}{data.unit ?? ""}</text>;
          })}
          {data.lines.map((line, li) => {
            const color = line.color ?? LINE_COLORS[li % LINE_COLORS.length];
            const pts = line.points.map((p, i) => { const { x, y } = toSVG(i, p.y); return `${x},${y}`; }).join(" ");
            const areaPts = pts + ` ${PAD.left + chartW},${PAD.top + chartH} ${PAD.left},${PAD.top + chartH}`;
            return (
              <g key={li}>
                <motion.polygon points={areaPts} fill={`${color}10`} stroke="none" initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: 0.35, duration: 0.4 }} />
                <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} pathLength={1} strokeDasharray="1"
                  strokeDashoffset={revealed ? 0 : 1} strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)" }} />
                {line.points.map((p, i) => {
                  const { x, y } = toSVG(i, p.y);
                  const isHovered = hoverIdx === i;
                  return (
                    <motion.circle key={i} cx={x} cy={y} r={isHovered ? 4 : 2.5}
                      fill={isHovered ? "white" : color} stroke={isHovered ? color : "none"} strokeWidth={isHovered ? 2 : 0}
                      initial={{ scale: 0 }} animate={{ scale: revealed ? 1 : 0 }}
                      transition={{ type: "spring", stiffness: 480, damping: 22, delay: revealed ? 0 : 0.9 + i * 0.025 }}
                      style={{ transformOrigin: `${x}px ${y}px` }} />
                  );
                })}
              </g>
            );
          })}
          <line x1={PAD.left} x2={PAD.left + chartW} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="rgba(59,54,50,0.14)" strokeWidth={0.8} />
          {data.lines[0]?.points.map((p, i) => {
            const total = data.lines[0].points.length;
            const skip = Math.ceil(total / 7);
            if (i % skip !== 0 && i !== total - 1) return null;
            const { x } = toSVG(i, 0);
            return <text key={i} x={x} y={H - 6} textAnchor="middle" fill="#C0B5AD" fontSize={11} fontFamily="inherit">{p.x}</text>;
          })}
          {hoverIdx !== null && <line x1={crosshairSvgX} x2={crosshairSvgX} y1={PAD.top} y2={PAD.top + chartH} stroke="rgba(59,54,50,0.18)" strokeWidth={0.8} strokeDasharray="4 3" />}
        </svg>
        <AnimatePresence initial={false}>
          {hoverIdx !== null && tooltipItems.length > 0 && (
            <motion.div key="tooltip" initial={{ opacity: 0, y: 4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.96 }} transition={{ duration: 0.12 }}
              style={{ position: "absolute", top: -8, left: tooltipLeft, width: tooltipWidth, background: "#26211E", borderRadius: 8, padding: "7px 10px", pointerEvents: "none", zIndex: 10, boxShadow: "0 4px 12px rgba(18,12,8,0.22)" }}>
              <div style={{ fontSize: 10, color: "#9C938B", fontWeight: 500, marginBottom: 5, letterSpacing: "0.3px" }}>{data.lines[0]?.points[hoverIdx]?.x}</div>
              {tooltipItems.map((item, ti) => (
                <div key={ti} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: ti > 0 ? 3 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    {tooltipItems.length > 1 && <span style={{ fontSize: 10, color: "#9C938B", maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "white", fontVariantNumeric: "tabular-nums" }}>{item.value}{data.unit ?? ""}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {data.lines.length > 1 && (
        <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          {data.lines.map((line, li) => (
            <div key={li} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 12, height: 2, background: line.color ?? LINE_COLORS[li % LINE_COLORS.length], borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: "#827A74" }}>{line.label}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── AnimatedCard ──────────────────────────────────────────────────────────────

function AnimatedCard({ data, onComplete }: { data: CardData; onComplete: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 380); return () => clearTimeout(t); }, []); // eslint-disable-line
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: "white", border: "1px solid #EDE1D7", borderRadius: 12, padding: "16px 18px" }}>
      {data.badge && (
        <div style={{ display: "inline-flex", fontSize: 10, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: data.badgeColor ?? "#683D1B", background: `${data.badgeColor ?? "#683D1B"}12`, border: `1px solid ${data.badgeColor ?? "#683D1B"}20`, borderRadius: 6, padding: "2px 8px", marginBottom: 10 }}>
          {data.badge}
        </div>
      )}
      {data.title && <div style={{ fontSize: 16, fontWeight: 600, color: "#26211E", lineHeight: "22px", marginBottom: data.subtitle ? 2 : 8 }}>{data.title}</div>}
      {data.subtitle && <div style={{ fontSize: 12, color: "#9A9089", marginBottom: 10 }}>{data.subtitle}</div>}
      <div style={{ fontSize: 14, color: "#524B47", lineHeight: "22px" }}>{renderInlineMd(data.body)}</div>
    </motion.div>
  );
}

// ── AnimatedConnectorError ────────────────────────────────────────────────────

function AnimatedConnectorError({ data, onComplete, onRetry }: { data: ConnectorErrorData; onComplete: () => void; onRetry?: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 420); return () => clearTimeout(t); }, []); // eslint-disable-line
  const [retryHovered, setRetryHovered] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "rgba(195,56,56,0.04)", border: "1px solid rgba(195,56,56,0.18)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ width: 3, borderRadius: 99, background: "#C33838", flexShrink: 0, alignSelf: "stretch", minHeight: 32 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14 }}>{data.icon ?? "⚠️"}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#26211E" }}>{data.connector}</span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "#A82E2E", background: "rgba(195,56,56,0.1)", border: "1px solid rgba(195,56,56,0.2)", borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>Auth expired</span>
          </div>
          <button onMouseEnter={() => setRetryHovered(true)} onMouseLeave={() => setRetryHovered(false)} onClick={onRetry}
            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: retryHovered ? "rgba(195,56,56,0.08)" : "white", border: "1px solid rgba(195,56,56,0.28)", borderRadius: 8, padding: "6px 12px", fontSize: 14, fontWeight: 600, color: "#A82E2E", cursor: "pointer", transition: "background 140ms" }}>
            <HIcon icon={Exchange01Icon} size={16} color="#A82E2E" strokeWidth={1.5} />
            {data.cta}
          </button>
        </div>
        {data.message && <div style={{ fontSize: 14, color: "#827A74", lineHeight: "22px" }}>{data.message}</div>}
      </div>
    </motion.div>
  );
}

// ── AnimatedSearchTimeout ─────────────────────────────────────────────────────

function AnimatedSearchTimeout({ data, onComplete, onRetry }: { data: SearchTimeoutData; onComplete: () => void; onRetry?: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 420); return () => clearTimeout(t); }, []); // eslint-disable-line
  const [retryHovered, setRetryHovered] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "rgba(162,136,71,0.05)", border: "1px solid rgba(162,136,71,0.22)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ width: 3, borderRadius: 99, background: "#A28847", flexShrink: 0, alignSelf: "stretch", minHeight: 32 }} />
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ lineHeight: 0 }}><HIcon icon={GlobeXIcon} size={16} color="#7A6030" strokeWidth={1.5} /></span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#26211E" }}>Web search timed out</span>
          </div>
          <div style={{ display: "inline-flex", alignSelf: "flex-start", fontSize: 13, fontFamily: "var(--font-code, monospace)", color: "#827A74", background: "rgba(59,54,50,0.08)", border: "1px solid rgba(82,75,71,0.12)", borderRadius: 5, padding: "2px 8px" }}>
            {data.query}
          </div>
        </div>
        <button onMouseEnter={() => setRetryHovered(true)} onMouseLeave={() => setRetryHovered(false)} onClick={onRetry}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: retryHovered ? "rgba(162,136,71,0.1)" : "white", border: "1px solid rgba(162,136,71,0.32)", borderRadius: 8, padding: "6px 12px", fontSize: 14, fontWeight: 600, color: "#7A6030", cursor: "pointer", transition: "background 140ms" }}>
          <HIcon icon={Exchange01Icon} size={16} color="#7A6030" strokeWidth={1.5} />
          {data.cta}
        </button>
      </div>
    </motion.div>
  );
}

// ── FollowUps renderer ────────────────────────────────────────────────────────

function AnimatedFollowUps({ data, onComplete, onFollowUp }: {
  data: FollowUpsData;
  onComplete: () => void;
  onFollowUp?: (prompt: string) => void;
}) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    let idx = 0;
    const t = setInterval(() => {
      idx++;
      setRevealed(idx);
      if (idx >= data.prompts.length) { clearInterval(t); setTimeout(onComplete, 160); }
    }, 100);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#9A9089", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Follow-up suggestions
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.prompts.slice(0, revealed).map((prompt, i) => (
          <motion.button key={i}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onFollowUp?.(prompt)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid #EDE1D7", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "#524B47", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 140ms", fontFamily: "var(--font-body)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(104,61,27,0.04)"; e.currentTarget.style.borderColor = "rgba(104,61,27,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#EDE1D7"; }}>
            <span style={{ color: "#C0B5AD", flexShrink: 0 }}>→</span>
            {prompt}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ── BlockSequenceRenderer ─────────────────────────────────────────────────────
// Animates each block in sequence - each block calls onComplete to advance.

export interface BlockSequenceRendererProps {
  blocks: ResponseBlock[];
  /** ms delay before first block appears (default 0 for completed messages) */
  firstTokenDelay?: number;
  onAllComplete?: () => void;
  onFollowUp?: (prompt: string) => void;
  onRetry?: () => void;
  /** If true, all blocks are rendered static immediately (no sequential animation) */
  static?: boolean;
}

export function BlockSequenceRenderer({
  blocks,
  firstTokenDelay = 0,
  onAllComplete,
  onFollowUp,
  onRetry,
  static: isStatic = false,
}: BlockSequenceRendererProps) {
  const [activeIdx, setActiveIdx] = useState(isStatic ? blocks.length : 0);
  const [allDone, setAllDone] = useState(isStatic);
  const onAllCompleteRef = useRef(onAllComplete);
  onAllCompleteRef.current = onAllComplete;

  const handleBlockDone = useCallback((idx: number) => {
    if (idx < blocks.length - 1) {
      setActiveIdx(idx + 1);
    } else {
      setAllDone(true);
      onAllCompleteRef.current?.();
    }
  }, [blocks.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {blocks.map((block, i) => {
        if (i > activeIdx && !isStatic) return null;
        const isDone = isStatic || i < activeIdx || allDone;
        const isFirst = i === 0;
        const wrapDelay = isFirst && !isStatic ? firstTokenDelay : 0;

        // text block - static render (real streaming handled by SSE in chat)
        if (block.kind === "text") {
          return (
            <div key={`b${i}`}>
              {renderTextBlock(block.content, block.webCitations)}
              {!isDone && <BreathingDot />}
            </div>
          );
        }

        // Use wrapper for breathing-dot delay on first structured block
        const wrap = (children: (done: () => void) => React.ReactNode) => isDone
          ? <div key={`b${i}`}>{children(() => {})}</div>
          : (
            <StructuredResponseWrapper key={`b${i}`} firstTokenDelay={wrapDelay} onComplete={() => handleBlockDone(i)}>
              {children}
            </StructuredResponseWrapper>
          );

        if (block.kind === "table")           return wrap((d) => <AnimatedTable    data={block.data} onComplete={d} />);
        if (block.kind === "bar-chart")        return wrap((d) => <AnimatedBarChart data={block.data} onComplete={d} />);
        if (block.kind === "steps")            return wrap((d) => <AnimatedSteps    data={block.data} onComplete={d} />);
        if (block.kind === "code")             return wrap((d) => <AnimatedCodeBlock data={block.data} onComplete={d} />);
        if (block.kind === "callout")          return wrap((d) => <AnimatedCallout  data={block.data} onComplete={d} />);
        if (block.kind === "tags")             return wrap((d) => <AnimatedTags     data={block.data} onComplete={d} />);
        if (block.kind === "pie-chart")        return wrap((d) => <AnimatedPieChart data={block.data} onComplete={d} />);
        if (block.kind === "line-chart")       return wrap((d) => <AnimatedLineChart data={block.data} onComplete={d} />);
        if (block.kind === "card")             return wrap((d) => <AnimatedCard     data={block.data} onComplete={d} />);
        if (block.kind === "connector-error")  return wrap((d) => <AnimatedConnectorError data={block.data} onComplete={d} onRetry={onRetry} />);
        if (block.kind === "search-timeout")   return wrap((d) => <AnimatedSearchTimeout  data={block.data} onComplete={d} onRetry={onRetry} />);
        if (block.kind === "follow-ups") {
          return wrap((d) => <AnimatedFollowUps data={block.data} onComplete={d} onFollowUp={onFollowUp} />);
        }
        return null;
      })}
    </div>
  );
}
