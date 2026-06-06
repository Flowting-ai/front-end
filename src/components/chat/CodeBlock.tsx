"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { HIGHLIGHT_COLORS } from "@/components/HighlightCard";
import type { HighlightSpec } from "@/lib/markdown-utils";
import { applyMarksToHtml } from "@/lib/apply-marks";

// Module-level cache - one load shared across all CodeBlock instances
let _hljsPromise: Promise<typeof import("@/lib/highlight").default> | null = null;

function loadHljs() {
  if (!_hljsPromise) {
    _hljsPromise = import("@/lib/highlight").then((mod) => mod.default);
  }
  return _hljsPromise;
}

interface CodeBlockProps {
  language?: string;
  value: string;
  elementKey: string;
  highlights?: HighlightSpec[];
}

// applyMarksToHtml is imported from @/lib/apply-marks

/**
 * Plain-text fallback (hljs not yet loaded): split the code string around
 * highlight matches and return React nodes with <HighlightMark> elements.
 */
function renderPlainWithMarks(text: string, specs: HighlightSpec[]): React.ReactNode {
  type M = { start: number; end: number; spec: HighlightSpec }
  const matches: M[] = []
  for (const spec of specs) {
    let pos = 0
    let idx: number
    while ((idx = text.indexOf(spec.text, pos)) !== -1) {
      matches.push({ start: idx, end: idx + spec.text.length, spec })
      pos = idx + 1
    }
  }
  if (!matches.length) return text

  matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const resolved: M[] = []
  let cursor = 0
  for (const m of matches) {
    if (m.start >= cursor) { resolved.push(m); cursor = m.end }
  }

  const nodes: React.ReactNode[] = []
  let p = 0
  for (const m of resolved) {
    if (m.start > p) nodes.push(text.slice(p, m.start))
    const { bg } = HIGHLIGHT_COLORS[m.spec.colorIndex]
    nodes.push(
      <mark
        key={`mark-${m.spec.id}-${m.start}`}
        data-highlight-id={m.spec.id}
        style={{ backgroundColor: bg, color: 'inherit', borderRadius: 2, padding: '0 1px' }}
      >
        {text.slice(m.start, m.end)}
      </mark>
    )
    p = m.end
  }
  if (p < text.length) nodes.push(text.slice(p))
  return nodes
}

export function CodeBlock({ language, value, elementKey, highlights }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
// Raw hljs output — recomputed only when code content changes
  const [rawHtml, setRawHtml] = useState<string | null>(null);
  // Display HTML with highlight marks applied on top
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  // Run hljs whenever the code itself changes
  useEffect(() => {
    let cancelled = false;
    const trimmed = value.trimEnd();

    loadHljs().then((hljs) => {
      if (cancelled) return;
      try {
        const result =
          language && hljs.getLanguage(language)
            ? hljs.highlight(trimmed, { language, ignoreIllegals: true })
            : hljs.highlightAuto(trimmed);
        setRawHtml(result.value);
      } catch {
        setRawHtml(null);
      }
    });

    return () => { cancelled = true; };
  }, [value, language]);

  // Re-apply marks whenever the raw syntax-highlighted HTML or specs change
  useEffect(() => {
    if (rawHtml === null) { setHighlightedHtml(null); return; }
    setHighlightedHtml(highlights?.length ? applyMarksToHtml(rawHtml, highlights) : rawHtml);
  }, [rawHtml, highlights]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.cssText = "position: fixed; opacity: 0;";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      key={elementKey}
      style={{
        position: "relative",
        borderRadius: "16px",
        backgroundColor: "var(--neutral-50)",
        border: "1px solid var(--neutral-200)",
        overflow: "hidden",
        margin: "12px 0",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid var(--neutral-200)",
        }}
      >
        {language && (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: "var(--font-weight-semibold)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--neutral-600)",
            }}
          >
            {language}
          </span>
        )}
        {!language && <span />}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
<button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy code"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              borderRadius: "999px",
              border: "1px solid var(--neutral-200)",
              backgroundColor: "var(--neutral-white)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: "var(--font-weight-medium)",
              color: copied ? "var(--green-600)" : "var(--neutral-800)",
              cursor: "pointer",
              transition: "color 150ms",
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Code content */}
      <pre
        className="kaya-scrollbar"
        style={{
          overflowX: "auto",
          padding: "16px",
          margin: 0,
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: "13px",
          lineHeight: "1.6",
          whiteSpace: "pre",
          wordBreak: "normal",
          background: "transparent",
        }}
      >
        {highlightedHtml != null ? (
          <code
            className={language ? `language-${language} hljs` : "hljs"}
            // eslint-disable-next-line react/no-danger, react-doctor/no-danger -- hljs + mark output is library/app-generated, not user content
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            style={{ background: "transparent", padding: 0 }}
          />
        ) : (
          <code className={language ? `language-${language}` : ""}>
            {highlights?.length
              ? renderPlainWithMarks(value.trimEnd(), highlights)
              : value.trimEnd()}
          </code>
        )}
      </pre>
    </div>
  );
}
