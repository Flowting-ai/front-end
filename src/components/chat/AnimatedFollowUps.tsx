"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import type { FollowUpsData } from "@/types/chat";

// �"��"� FollowUps renderer �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

export function AnimatedFollowUps({ data, onComplete, onFollowUp, animate = true }: {
  data: FollowUpsData;
  onComplete: () => void;
  onFollowUp?: (prompt: string) => void;
  animate?: boolean;
}) {
  const [revealed, setRevealed] = useState(() => animate ? 0 : data.prompts.length);

  useEffect(() => {
    if (!animate) { onComplete(); return; }
    let idx = 0;
    let doneT: ReturnType<typeof setTimeout> | null = null;
    const t = setInterval(() => {
      idx++;
      setRevealed(idx);
      if (idx >= data.prompts.length) { clearInterval(t); doneT = setTimeout(onComplete, 160); }
    }, 100);
    return () => {
      clearInterval(t);
      if (doneT !== null) clearTimeout(doneT);
    };
  }, []); // eslint-disable-line

  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#9A9089", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Follow-up suggestions
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.prompts.slice(0, revealed).map((prompt) => (
          <m.button key={prompt}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onFollowUp?.(prompt)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid #EDE1D7", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "#524B47", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 140ms", fontFamily: "var(--font-body)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(104,61,27,0.04)"; e.currentTarget.style.borderColor = "rgba(104,61,27,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#EDE1D7"; }}>
            <span style={{ color: "#C0B5AD", flexShrink: 0 }}>�'</span>
            {prompt}
          </m.button>
        ))}
      </div>
    </m.div>
  );
}
