"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import GlobeXIcon from "@hugeicons/core-free-icons/GlobeXIcon";
import Exchange01Icon from "@hugeicons/core-free-icons/Exchange01Icon";
import type { SearchTimeoutData } from "@/types/chat";
import { HIcon } from "./response-blocks-shared";

// �"��"� AnimatedSearchTimeout �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

export function AnimatedSearchTimeout({ data, onComplete, onRetry }: { data: SearchTimeoutData; onComplete: () => void; onRetry?: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 420); return () => clearTimeout(t); }, []); // eslint-disable-line
  const [retryHovered, setRetryHovered] = useState(false);
  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "color-mix(in srgb, var(--yellow-500) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--yellow-500) 22%, transparent)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ width: 3, borderRadius: 99, background: "var(--yellow-500)", flexShrink: 0, alignSelf: "stretch", minHeight: 32 }} />
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ lineHeight: 0 }}><HIcon icon={GlobeXIcon} size={16} color="var(--yellow-700)" strokeWidth={1.5} /></span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--neutral-900)" }}>Web search timed out</span>
          </div>
          <div style={{ display: "inline-flex", alignSelf: "flex-start", fontSize: 13, fontFamily: "var(--font-code, monospace)", color: "var(--neutral-500)", background: "color-mix(in srgb, var(--neutral-800) 8%, transparent)", border: "1px solid rgba(82,75,71,0.12)", borderRadius: 5, padding: "2px 8px" }}>
            {data.query}
          </div>
        </div>
        <button onMouseEnter={() => setRetryHovered(true)} onMouseLeave={() => setRetryHovered(false)} onClick={onRetry}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: retryHovered ? "color-mix(in srgb, var(--yellow-500) 10%, transparent)" : "white", border: "1px solid color-mix(in srgb, var(--yellow-500) 32%, transparent)", borderRadius: 8, padding: "6px 12px", fontSize: 14, fontWeight: 600, color: "var(--yellow-700)", cursor: "pointer", transition: "background 140ms" }}>
          <HIcon icon={Exchange01Icon} size={16} color="var(--yellow-700)" strokeWidth={1.5} />
          {data.cta}
        </button>
      </div>
    </m.div>
  );
}
