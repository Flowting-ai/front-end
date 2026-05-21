"use client";

import { useState, useEffect } from "react";
import { Copy, Check, WrapText } from "lucide-react";

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
}

export function CodeBlock({ language, value, elementKey }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

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
        setHighlightedHtml(result.value);
      } catch {
        setHighlightedHtml(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [value, language]);

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
            onClick={() => setWordWrap(!wordWrap)}
            aria-label={wordWrap ? "Disable word wrap" : "Enable word wrap"}
            aria-pressed={wordWrap}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: wordWrap ? "var(--neutral-200)" : "transparent",
              color: "var(--neutral-600)",
              cursor: "pointer",
              transition: "background-color 150ms",
            }}
          >
            <WrapText size={14} />
          </button>
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
          overflowX: wordWrap ? "visible" : "auto",
          padding: "16px",
          margin: 0,
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: "13px",
          lineHeight: "1.6",
          whiteSpace: wordWrap ? "pre-wrap" : "pre",
          wordBreak: wordWrap ? "break-all" : "normal",
          background: "transparent",
        }}
      >
        {highlightedHtml != null ? (
          <code
            className={language ? `language-${language} hljs` : "hljs"}
            // eslint-disable-next-line react/no-danger, react-doctor/no-danger -- highlight.js output is library-generated, not user content
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            style={{ background: "transparent", padding: 0 }}
          />
        ) : (
          <code className={language ? `language-${language}` : ""}>
            {value.trimEnd()}
          </code>
        )}
      </pre>
    </div>
  );
}
