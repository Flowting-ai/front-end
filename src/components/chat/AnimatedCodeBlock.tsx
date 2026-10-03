"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import Checkmark from "@hugeicons/core-free-icons/Tick01Icon";
import type { CodeData } from "@/types/chat";
import { HIcon } from "./response-blocks-shared";

// �"��"� AnimatedCodeBlock �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

function highlightCode(line: string): React.ReactNode[] {
  const KW_COLOR = "var(--info-300)";
  const STR_COLOR = "var(--warning-200)";
  const CMT_COLOR = "var(--neutral-600)";
  const NUM_COLOR = "var(--violet-300)";
  const DEF_COLOR = "var(--neutral-200)";
  const DIM_COLOR = "color-mix(in srgb, var(--neutral-200) 50%, transparent)";

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

export function AnimatedCodeBlock({ data, onComplete, animate = true }: { data: CodeData; onComplete: () => void; animate?: boolean }) {
  const lines = data.code.split("\n");
  const totalLines = lines.length;
  const isLong = totalLines > CODE_COLLAPSE_THRESHOLD;

  const [revealedLines, setRevealedLines] = useState(() => animate ? 0 : totalLines);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(!animate && isLong);
  const [copyHovered, setCopyHovered] = useState(false);

  const streamDone = revealedLines >= totalLines;
  const visibleLines = streamDone && isLong && !expanded
    ? lines.slice(0, CODE_COLLAPSE_THRESHOLD)
    : lines.slice(0, revealedLines);
  const hiddenCount = totalLines - CODE_COLLAPSE_THRESHOLD;

  useEffect(() => {
    if (!animate) { onComplete(); return; }
    let idx = 0;
    let doneT: ReturnType<typeof setTimeout> | null = null;
    const interval = Math.min(55, Math.round(1400 / totalLines));
    const t = setInterval(() => {
      idx++;
      setRevealedLines(idx);
      if (idx >= totalLines) { clearInterval(t); doneT = setTimeout(onComplete, 200); }
    }, interval);
    return () => {
      clearInterval(t);
      if (doneT !== null) clearTimeout(doneT);
    };
  }, []); // eslint-disable-line

  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
      {data.caption && <div style={{ fontSize: 12, color: "var(--neutral-500)", marginBottom: 6 }}>{data.caption}</div>}
      <div style={{ background: "#1E1A17", borderRadius: 10, overflow: "hidden", boxShadow: "0px 0px 0px 1px color-mix(in srgb, var(--static-black) 90%, transparent), 0px 1px 1px rgba(59,54,50,0.12), 0px 2px 4px rgba(59,54,50,0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px 7px 14px", borderBottom: "1px solid color-mix(in srgb, var(--static-white) 5.5%, transparent)", background: "linear-gradient(180deg, color-mix(in srgb, var(--neutral-700) 30%, transparent) 0%, color-mix(in srgb, var(--neutral-900) 30%, transparent) 100%)" }}>
          <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.4px", color: "color-mix(in srgb, var(--neutral-200) 55%, transparent)", fontFamily: "var(--font-code, monospace)", textTransform: "uppercase" }}>
            {data.language ?? "code"}
          </span>
          <m.button onClick={() => { navigator.clipboard.writeText(data.code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
            onMouseEnter={() => setCopyHovered(true)}
            onMouseLeave={() => setCopyHovered(false)}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={{
              width: 76, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "5px 0 6px", borderRadius: 8, border: "none", cursor: "pointer",
              background: copyHovered ? "linear-gradient(180deg, var(--neutral-600) 0%, var(--neutral-800) 100%)" : "linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)",
              boxShadow: ["0px 0px 0px 1px color-mix(in srgb, var(--static-black) 85%, transparent)", "0px 1px 1px rgba(59,54,50,0.10)", "0px 1.5px 3px rgba(59,54,50,0.35)", copyHovered ? "inset 0px 1px 0.4px color-mix(in srgb, var(--static-white) 42%, transparent)" : "inset 0px 1px 0.4px color-mix(in srgb, var(--static-white) 28%, transparent)", "inset 0px -2px 0.4px #120C08"].join(", "),
              transition: "background 160ms ease, box-shadow 160ms ease",
            }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {copied ? (
                <m.span key="done" initial={{ opacity: 0, y: 6, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.85 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <HIcon icon={Checkmark} size={12} color="var(--green-600)" strokeWidth={2.5} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--green-600)", fontFamily: "var(--font-body)", whiteSpace: "nowrap" }}>Copied</span>
                </m.span>
              ) : (
                <m.span key="copy" initial={{ opacity: 0, y: 6, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.85 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <HIcon icon={Copy01Icon} size={12} color="color-mix(in srgb, var(--neutral-200) 72%, transparent)" strokeWidth={1.5} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "color-mix(in srgb, var(--neutral-200) 72%, transparent)", fontFamily: "var(--font-body)", whiteSpace: "nowrap" }}>Copy</span>
                </m.span>
              )}
            </AnimatePresence>
          </m.button>
        </div>
        <pre className="kaya-scrollbar" style={{ margin: 0, padding: "14px 16px", fontSize: 13, lineHeight: "20px", fontFamily: "var(--font-code, monospace)", overflowX: "auto" }}>
          {visibleLines.map((line, i) => (
            // eslint-disable-next-line react/no-array-index-as-key
            <m.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.08 }}
              style={{ display: "flex", gap: 14 }}>
              <span style={{ color: "color-mix(in srgb, var(--neutral-800) 55%, transparent)", userSelect: "none", fontSize: 12, minWidth: 18, textAlign: "right", flexShrink: 0, lineHeight: "20px" }}>{i + 1}</span>
              <span>{highlightCode(line)}</span>
            </m.div>
          ))}
          {!streamDone && (
            <m.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.7, repeat: Infinity }}
              style={{ display: "inline-block", width: 7, height: 14, background: "var(--brown-700)", borderRadius: 1, verticalAlign: "middle", marginLeft: 32 }} />
          )}
        </pre>
        <AnimatePresence initial={false}>
          {streamDone && isLong && (
            <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {!expanded ? (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", top: -48, left: 0, right: 0, height: 48, background: "linear-gradient(to bottom, transparent, var(--neutral-900))", pointerEvents: "none" }} />
                  <button onClick={() => setExpanded(true)} style={{ width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "color-mix(in srgb, var(--static-white) 3%, transparent)", borderTop: "1px solid color-mix(in srgb, var(--static-white) 5.5%, transparent)", border: "none", borderRadius: "0 0 10px 10px", cursor: "pointer", transition: "background 120ms" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--static-white) 6%, transparent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--static-white) 3%, transparent)")}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4.5 L6 8 L10 4.5" stroke="color-mix(in srgb, var(--neutral-200) 50%, transparent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "color-mix(in srgb, var(--neutral-200) 50%, transparent)", fontFamily: "var(--font-body)" }}>Show {hiddenCount} more {hiddenCount === 1 ? "line" : "lines"} of code</span>
                  </button>
                </div>
              ) : (
                <button onClick={() => setExpanded(false)} style={{ width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "color-mix(in srgb, var(--static-white) 3%, transparent)", borderTop: "1px solid color-mix(in srgb, var(--static-white) 5.5%, transparent)", border: "none", borderRadius: "0 0 10px 10px", cursor: "pointer", transition: "background 120ms" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--static-white) 6%, transparent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--static-white) 3%, transparent)")}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 7.5 L6 4 L10 7.5" stroke="color-mix(in srgb, var(--neutral-200) 50%, transparent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "color-mix(in srgb, var(--neutral-200) 50%, transparent)", fontFamily: "var(--font-body)" }}>Show less</span>
                </button>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </m.div>
  );
}
