"use client";

import { useEffect } from "react";
import { m } from "framer-motion";
import {
  InformationCircleIcon,
  Alert01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Idea01Icon,
} from "@hugeicons/core-free-icons";
import type { CalloutData } from "@/types/chat";
import { HIcon, InlineMd } from "./response-blocks-shared";

// �"��"� AnimatedCallout �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const CALLOUT_CFG = {
  info:    { bg: "rgba(13,110,178,0.07)",  border: "#0D6EB2", icon: InformationCircleIcon, color: "#0D6EB2" },
  warning: { bg: "rgba(200,146,10,0.08)",  border: "#C8920A", icon: Alert01Icon,           color: "#C8920A" },
  success: { bg: "rgba(128,183,7,0.07)",   border: "#80B707", icon: CheckmarkCircle01Icon, color: "#80B707" },
  error:   { bg: "rgba(200,50,50,0.07)",   border: "#C83232", icon: Cancel01Icon,          color: "#C83232" },
  tip:     { bg: "rgba(104,61,27,0.07)",   border: "#683D1B", icon: Idea01Icon,            color: "#683D1B" },
} as const;

/** How long the callout holds the sequence before the next block starts. A flat
 *  delay let a long body hand off before it was readable, so it scales with the
 *  word count the way the streaming text blocks around it do. */
function calloutDwellMs(data: CalloutData): number {
  const words = `${data.title ?? ""} ${data.body}`.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(2600, Math.max(440, 320 + words * 28));
}

export function AnimatedCallout({ data, onComplete }: { data: CalloutData; onComplete: () => void }) {
  const cfg = CALLOUT_CFG[data.variant] ?? CALLOUT_CFG.info;
  const dwell = calloutDwellMs(data);
  useEffect(() => { const t = setTimeout(onComplete, dwell); return () => clearTimeout(t); }, []); // eslint-disable-line
  return (
    <m.div initial={{ opacity: 0, x: -10, y: 4 }} animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      style={{ borderLeft: `3px solid ${cfg.border}`, background: cfg.bg, borderRadius: "0 10px 10px 0", padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start", fontFamily: "var(--font-body)" }}>
      <span style={{ flexShrink: 0, marginTop: 1, lineHeight: 0 }}>
        <HIcon icon={cfg.icon} size={16} color={cfg.color} strokeWidth={1.8} />
      </span>
      <div>
        {data.title && <div style={{ fontWeight: 600, fontSize: 14, color: "#26211E", marginBottom: 4, lineHeight: "20px" }}><InlineMd text={data.title} /></div>}
        <div style={{ fontSize: 14, lineHeight: "21px", color: "#524B47" }}><InlineMd text={data.body} /></div>
      </div>
    </m.div>
  );
}
