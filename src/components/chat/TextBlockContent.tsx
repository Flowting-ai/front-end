"use client";

import React from "react";
import katex from "katex";
import { sanitizeKaTeX } from "@/lib/security";
import type { WebCitation } from "@/types/chat";
import { CitationChip } from "./CitationChip";
import { INLINE_CODE_STYLE } from "./response-blocks-shared";

// �"��"� KaTeX helpers �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

/** Render a KaTeX inline span, falling back to the raw source on error. */
function renderKatexInline(math: string, key: number | string): React.ReactNode {
  try {
    const html = katex.renderToString(math, { throwOnError: false, displayMode: false });
    // eslint-disable-next-line react/no-danger -- KaTeX output is library-generated and sanitized
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
        className="kaya-scrollbar"
        style={{ margin: "10px 0", overflowX: "auto", textAlign: "center" }}
      >
        {/* eslint-disable-next-line react/no-danger -- KaTeX output is library-generated and sanitized */}
        <span dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }} />
        {tail}
      </div>
    );
  } catch {
    return null;
  }
}

// �"��"� Inline markdown renderer �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

function renderInlineRich(line: string, citations?: WebCitation[]): React.ReactNode[] {
  // Build url?index map for citation chip lookup (same logic as LineRenderer).
  const urlMap = citations && citations.length > 0
    ? new Map(citations.map((c, i) => [c.url, i] as [string | undefined, number]).filter(([u]) => u))
    : null

  // Match (in priority order): \(...\) inline math, $...$ inline math,
  // **bold**, `code`, {N} citation chip, [label](url) link, bare URL (https?://, www., or domain/path).
  const regex = /\\\([\s\S]+?\\\)|\$[^$\n]+?\$|(\*\*[^*]+\*\*)|(`[^`\n]+`)|(\{\d+\})|(\[[^\]]+\]\(https?:\/\/[^)]+\))|(https?:\/\/[^\s\])\n>"']+|www\.[^\s\])\n>"']+|(?:[a-zA-Z0-9][a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}\/[^\s\])\n>"']*)/g;
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
      // [label](url) — always render as a proper link, never as a citation chip
      const lm = match[4].match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (lm) {
        nodes.push(<a key={count++} href={lm[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#8B5523", textDecoration: "underline", textUnderlineOffset: 2 }}>{lm[1]}</a>);
      }
    } else if (match[5] !== undefined) {
      // bare URL (https?://, www., or domain/path) — auto-link it
      const raw = match[5]
      const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      const cidx = urlMap?.get(href)
      let display = raw
      try {
        const u = new URL(href)
        display = u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "")
      } catch { /* use raw */ }
      if (cidx !== undefined) {
        nodes.push(<CitationChip key={count++} n={cidx + 1} citation={citations?.[cidx]} />)
      } else {
        nodes.push(<a key={count++} href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#8B5523", textDecoration: "underline", textUnderlineOffset: 2 }}>{display}</a>)
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    nodes.push(<span key={count++}>{line.slice(lastIndex)}</span>);
  }

  return nodes.length ? nodes : [<span key={0}>{line}</span>];
}

function InlineRich({ text, citations }: { text: string; citations?: WebCitation[] }) {
  return <>{renderInlineRich(text, citations)}</>
}


function isBoldHeading(line: string) {
  return /^\*\*[^*]+\*\*:?\s*$/.test(line.trim());
}

// Gap between sibling prose blocks (paragraph to paragraph, list to paragraph).
// Heading gaps are asymmetric and live in HEADING_STYLE below.
const GAP = "var(--prose-block-gap)";

// One rung of the prose ladder each. `marginTop` is ~2x `marginBottom` so a
// heading sits nearer the content it introduces than the section it follows —
// adjacent margins collapse, so the space above resolves to the larger of the
// previous block's bottom margin and this top margin.
const HEADING_STYLE = {
  h1: {
    fontSize: "var(--prose-size-h1)", lineHeight: "var(--prose-line-h1)",
    fontWeight: 600, color: "var(--prose-heading)", fontFamily: "var(--font-body)",
    marginTop: "var(--prose-h1-space-before)", marginBottom: "var(--prose-h1-space-after)",
  },
  h2: {
    fontSize: "var(--prose-size-h2)", lineHeight: "var(--prose-line-h2)",
    fontWeight: 600, color: "var(--prose-heading)", fontFamily: "var(--font-body)",
    marginTop: "var(--prose-h2-space-before)", marginBottom: "var(--prose-h2-space-after)",
  },
  h3: {
    fontSize: "var(--prose-size-h3)", lineHeight: "var(--prose-line-h3)",
    fontWeight: 600, color: "var(--prose-heading)", fontFamily: "var(--font-body)",
    marginTop: "var(--prose-h3-space-before)", marginBottom: "var(--prose-h3-space-after)",
  },
} as const;

// Normalise inline bold-as-title: **Title** that appears with no whitespace
// boundary gets blank lines inserted so it renders as its own paragraph/heading.
function normalizeBoldTitles(text: string): string {
  return text
    // Collapse bold markers split across line breaks (LLM sometimes puts ** on its own line):
    // **text\n**  ?  **text**
    .replace(/(\*\*[^*\n]+)\n\s*(\*\*)/g, '$1$2')
    // **\ntext**  ?  **text**
    .replace(/(\*\*)\n+([^*\n]+\*\*)/g, '$1$2')
    // Insert blank line BEFORE **..** when immediately preceded by a non-whitespace char
    .replace(/([^\s\n])(\*\*[^*\n]+\*\*)/g, '$1\n\n$2')
    // Insert blank line AFTER **..** when immediately followed by a letter (new sentence)
    .replace(/(\*\*[^*\n]+\*\*)([A-Za-z])/g, '$1\n\n$2');
}

// Full block text renderer - supports headings, lists, blockquotes, bold, code, citations
// Block index (bi) is the only stable key: same markdown can produce adjacent same-type blocks.
/* eslint-disable react/no-array-index-as-key */
function renderTextBlock(text: string, citations?: WebCitation[], cursor?: React.ReactNode): React.ReactNode {
  const blocks = normalizeBoldTitles(text).split(/\n\n+/);

  return (
    <div style={{
      color: "var(--prose-text)",
      fontSize: "var(--prose-size-body)",
      lineHeight: "var(--prose-line-body)",
      fontFamily: "var(--font-body)",
      maxWidth: "var(--prose-measure)",
    }}>
      {blocks.map((block, bi) => {
        const isLast = bi === blocks.length - 1;
        const tail = isLast ? cursor : null;
        const trimmedBlock = block.trim();

        // �"��"� Display math block: \[...\] �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�
        if (trimmedBlock.startsWith("\\[")) {
          const closeIdx = trimmedBlock.indexOf("\\]", 2);
          if (closeIdx !== -1) {
            const math = trimmedBlock.slice(2, closeIdx).trim();
            return renderKatexBlock(math, bi, tail);
          }
          // Unclosed \[ during streaming �" render nothing until it closes
          return null;
        }

        // �"��"� Display math block: $$...$$ �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�
        if (trimmedBlock.startsWith("$$")) {
          const rest = trimmedBlock.slice(2);
          const closeIdx = rest.indexOf("$$");
          if (closeIdx !== -1) {
            const math = rest.slice(0, closeIdx).trim();
            return renderKatexBlock(math, bi, tail);
          }
          // Unclosed $$ during streaming �" render nothing until it closes
          return null;
        }

        const lines = block.split("\n").filter((l, li, arr) => l.trim() !== "" || li < arr.length - 1);
        const first = lines[0] ?? "";

        if (first.startsWith("# ")) return (
          <div key={bi} style={{ ...HEADING_STYLE.h1, marginTop: bi > 0 ? HEADING_STYLE.h1.marginTop : 0, marginBottom: isLast ? 0 : HEADING_STYLE.h1.marginBottom }}>
            <InlineRich text={first.slice(2)} citations={citations} />{tail}
          </div>
        );

        if (first.startsWith("## ")) return (
          <div key={bi} style={{ ...HEADING_STYLE.h2, marginTop: bi > 0 ? HEADING_STYLE.h2.marginTop : 0, marginBottom: isLast ? 0 : HEADING_STYLE.h2.marginBottom }}>
            <InlineRich text={first.slice(3)} citations={citations} />{tail}
          </div>
        );

        if (first.startsWith("### ")) return (
          <div key={bi} style={{ ...HEADING_STYLE.h3, marginTop: bi > 0 ? HEADING_STYLE.h3.marginTop : 0, marginBottom: isLast ? 0 : HEADING_STYLE.h3.marginBottom }}>
            <InlineRich text={first.slice(4)} citations={citations} />{tail}
          </div>
        );

        if (lines.length > 0 && lines.every((l) => l.startsWith("> "))) return (
          <div key={bi} style={{ borderLeft: "2.5px solid var(--prose-quote-border)", paddingLeft: "var(--space-3)", marginBottom: isLast ? 0 : GAP, color: "var(--prose-quote-text)", fontStyle: "italic", lineHeight: "var(--prose-line-body)" }}>
            {lines.map((l, li) => (
              // eslint-disable-next-line react/no-array-index-as-key
              <React.Fragment key={li}>
                {li > 0 && <br />}
                <InlineRich text={l.slice(2)} citations={citations} />
              </React.Fragment>
            ))}
            {tail}
          </div>
        );

        const nonEmpty = lines.filter((l) => l.trim() !== "");
        if (nonEmpty.length > 0 && nonEmpty.every((l) => /^[-*]\s/.test(l.trim()))) return (
          <ul key={bi} style={{ margin: 0, marginBottom: isLast ? 0 : GAP, paddingLeft: "var(--prose-list-indent)", display: "flex", flexDirection: "column", gap: "var(--prose-list-item-gap)" }}>
            {nonEmpty.map((l, li) => {
              const isLastItem = li === nonEmpty.length - 1;
              return (
                // eslint-disable-next-line react/no-array-index-as-key
                <li key={li} style={{ lineHeight: "var(--prose-line-body)", color: "var(--prose-text)", fontSize: "var(--prose-size-body)" }}>
                  <InlineRich text={l.replace(/^[-*]\s/, "")} citations={citations} />
                  {isLastItem && tail}
                </li>
              );
            })}
          </ul>
        );

        if (nonEmpty.length > 0 && nonEmpty.every((l) => /^\d+\.\s/.test(l.trim()))) return (
          <ol key={bi} style={{ margin: 0, marginBottom: isLast ? 0 : GAP, paddingLeft: "var(--prose-list-indent)", display: "flex", flexDirection: "column", gap: "var(--prose-list-item-gap)" }}>
            {nonEmpty.map((l, li) => {
              const isLastItem = li === nonEmpty.length - 1;
              return (
                // eslint-disable-next-line react/no-array-index-as-key
                <li key={li} style={{ lineHeight: "var(--prose-line-body)", color: "var(--prose-text)", fontSize: "var(--prose-size-body)" }}>
                  <InlineRich text={l.replace(/^\d+\.\s/, "")} citations={citations} />
                  {isLastItem && tail}
                </li>
              );
            })}
          </ol>
        );

        if (lines.length === 1 && isBoldHeading(first)) return (
          <p key={bi} style={{ margin: 0, marginBottom: isLast ? 0 : GAP, lineHeight: "var(--prose-line-body)", fontWeight: 600, fontSize: "var(--prose-size-body)", color: "var(--prose-heading)" }}>
            <InlineRich text={first} citations={citations} />{tail}
          </p>
        );

        return (
          <p key={bi} style={{ margin: 0, marginBottom: isLast ? 0 : GAP, lineHeight: "var(--prose-line-body)", fontWeight: 400, fontSize: "var(--prose-size-body)", color: "var(--prose-text)" }}>
            {lines.map((line, li) => (
              // eslint-disable-next-line react/no-array-index-as-key
              <React.Fragment key={li}>
                {li > 0 && <br />}
                <InlineRich text={line} citations={citations} />
              </React.Fragment>
            ))}
            {tail}
          </p>
        );
      })}
    </div>
  );
}
/* eslint-enable react/no-array-index-as-key */

export function TextBlockContent({ text, citations, cursor }: { text: string; citations?: WebCitation[]; cursor?: React.ReactNode }) {
  return <>{renderTextBlock(text, citations, cursor)}</>
}
