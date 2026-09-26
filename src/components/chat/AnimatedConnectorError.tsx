"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import { Exchange01Icon } from "@hugeicons/core-free-icons";
import type { ConnectorErrorData } from "@/types/chat";
import { HIcon } from "./response-blocks-shared";

// �"��"� AnimatedConnectorError �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

export function AnimatedConnectorError({ data, onComplete, onRetry }: { data: ConnectorErrorData; onComplete: () => void; onRetry?: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 420); return () => clearTimeout(t); }, []); // eslint-disable-line
  const [retryHovered, setRetryHovered] = useState(false);
  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "rgba(195,56,56,0.04)", border: "1px solid rgba(195,56,56,0.18)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ width: 3, borderRadius: 99, background: "#C33838", flexShrink: 0, alignSelf: "stretch", minHeight: 32 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14 }}>{data.icon ?? "⚠️"}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#26211E" }}>{data.connector}</span>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "#A82E2E", background: "rgba(195,56,56,0.1)", border: "1px solid rgba(195,56,56,0.2)", borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>Auth expired</span>
          </div>
          <button onMouseEnter={() => setRetryHovered(true)} onMouseLeave={() => setRetryHovered(false)} onClick={onRetry}
            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: retryHovered ? "rgba(195,56,56,0.08)" : "white", border: "1px solid rgba(195,56,56,0.28)", borderRadius: 8, padding: "6px 12px", fontSize: 14, fontWeight: 600, color: "#A82E2E", cursor: "pointer", transition: "background 140ms" }}>
            <HIcon icon={Exchange01Icon} size={16} color="#A82E2E" strokeWidth={1.5} />
            {data.cta}
          </button>
        </div>
        {data.message && <div style={{ fontSize: 14, color: "#827A74", lineHeight: "22px" }}>{data.message}</div>}
      </div>
    </m.div>
  );
}
