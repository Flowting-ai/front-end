"use client";

import { useEffect } from "react";
import { m } from "framer-motion";
import InformationCircleIcon from "@hugeicons/core-free-icons/InformationCircleIcon";
import Alert01Icon from "@hugeicons/core-free-icons/Alert01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import CheckmarkCircle01Icon from "@hugeicons/core-free-icons/CheckmarkCircle01Icon";
import Idea01Icon from "@hugeicons/core-free-icons/Idea01Icon";
import type { CalloutData } from "@/types/chat";
import { HIcon, InlineMd } from "./response-blocks-shared";

// �"��"� AnimatedCallout �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const CALLOUT_CFG = {
  info:    { bg: "color-mix(in srgb, var(--blue-600) 7%, transparent)",  border: "var(--blue-600)", icon: InformationCircleIcon, color: "var(--blue-600)" },
  warning: { bg: "color-mix(in srgb, var(--warning-500) 8%, transparent)",  border: "var(--warning-500)", icon: Alert01Icon,           color: "var(--warning-500)" },
  success: { bg: "color-mix(in srgb, var(--green-600) 7%, transparent)",   border: "var(--green-600)", icon: CheckmarkCircle01Icon, color: "var(--green-600)" },
  error:   { bg: "color-mix(in srgb, var(--red-500) 7%, transparent)",   border: "var(--red-500)", icon: Cancel01Icon,          color: "var(--red-500)" },
  tip:     { bg: "color-mix(in srgb, var(--brown-700) 7%, transparent)",   border: "var(--brown-700)", icon: Idea01Icon,            color: "var(--brown-700)" },
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
        {data.title && <div style={{ fontWeight: 600, fontSize: 14, color: "var(--neutral-900)", marginBottom: 4, lineHeight: "20px" }}><InlineMd text={data.title} /></div>}
        <div style={{ fontSize: 14, lineHeight: "21px", color: "var(--neutral-700)" }}><InlineMd text={data.body} /></div>
      </div>
    </m.div>
  );
}
