"use client";

import { useState } from "react";
import { Copy, Check, WrapText } from "lucide-react";

interface CodeBlockProps {
  language?: string;
  value: string;
  elementKey: string;
}

export function CodeBlock({ language, value, elementKey }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
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
              fontSize: "11px",
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
              fontSize: "11px",
              fontWeight: "var(--font-weight-medium)",
              color: copied ? "var(--green-600)" : "var(--neutral-800)",
              cursor: "pointer",
              transition: "all 150ms",
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
        }}
      >
        <code className={language ? `language-${language}` : ""}>
          {value.trimEnd()}
        </code>
      </pre>
    </div>
  );
}
