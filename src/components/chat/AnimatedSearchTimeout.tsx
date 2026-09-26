"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import { GlobeXIcon, Exchange01Icon } from "@hugeicons/core-free-icons";
import type { SearchTimeoutData } from "@/types/chat";
import { HIcon } from "./response-blocks-shared";

// �"��"� AnimatedSearchTimeout �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

export function AnimatedSearchTimeout({ data, onComplete, onRetry }: { data: SearchTimeoutData; onComplete: () => void; onRetry?: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 420); return () => clearTimeout(t); }, []); // eslint-disable-line
  const [retryHovered, setRetryHovered] = useState(false);
  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
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
    </m.div>
  );
}
