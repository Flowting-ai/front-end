"use client";

import { useEffect } from "react";
import { m } from "framer-motion";
import type { CardData } from "@/types/chat";
import { InlineMd } from "./response-blocks-shared";

// �"��"� AnimatedCard �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

export function AnimatedCard({ data, onComplete }: { data: CardData; onComplete: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 380); return () => clearTimeout(t); }, []); // eslint-disable-line
  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: "white", border: "1px solid #EDE1D7", borderRadius: 12, padding: "16px 18px" }}>
      {data.badge && (
        <div style={{ display: "inline-flex", fontSize: 12, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: data.badgeColor ?? "#683D1B", background: `${data.badgeColor ?? "#683D1B"}12`, border: `1px solid ${data.badgeColor ?? "#683D1B"}20`, borderRadius: 6, padding: "2px 8px", marginBottom: 10 }}>
          {data.badge}
        </div>
      )}
      {data.title && <div style={{ fontSize: 16, fontWeight: 600, color: "#26211E", lineHeight: "22px", marginBottom: data.subtitle ? 2 : 8 }}>{data.title}</div>}
      {data.subtitle && <div style={{ fontSize: 12, color: "#9A9089", marginBottom: 10 }}>{data.subtitle}</div>}
      <div style={{ fontSize: 14, color: "#524B47", lineHeight: "22px" }}><InlineMd text={data.body} /></div>
    </m.div>
  );
}
