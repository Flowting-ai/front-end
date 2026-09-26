"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HIcon({ icon, size = 14, color = "#827A74", strokeWidth = 1.5 }: { icon: any; size?: number; color?: string; strokeWidth?: number }) {
  return <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} />;
}

export const INLINE_CODE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-code)",
  fontSize: "var(--prose-size-code)",
  background: "var(--neutral-800-10)",
  color: "var(--prose-heading)",
  borderRadius: 4,
  padding: "1px 5px",
  border: "1px solid var(--neutral-700-12)",
  whiteSpace: "pre",
};


// Inline markdown for non-citation content (reasoning steps, callout bodies)
function renderInlineMd(text: string): React.ReactNode[] {
  // eslint-disable-next-line react/no-array-index-as-key
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      // eslint-disable-next-line react/no-array-index-as-key
      return <strong key={i} style={{ fontWeight: 600, color: "#26211E" }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      // eslint-disable-next-line react/no-array-index-as-key
      return <code key={i} style={INLINE_CODE_STYLE}>{part.slice(1, -1)}</code>;
    const lm = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    // eslint-disable-next-line react/no-array-index-as-key
    if (lm) return <a key={i} href={lm[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#8B5523", textDecoration: "underline", textUnderlineOffset: 2 }}>{lm[1]}</a>;
    // eslint-disable-next-line react/no-array-index-as-key
    return <span key={i}>{part}</span>;
  });
}

export function InlineMd({ text }: { text: string }) {
  return <>{renderInlineMd(text)}</>
}
