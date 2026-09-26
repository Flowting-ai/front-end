"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import type { TagsData } from "@/types/chat";

// �"��"� AnimatedTags �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const TAG_PALETTES = [
  { bg: "rgba(104,61,27,0.1)",   text: "#683D1B",  border: "rgba(104,61,27,0.2)" },
  { bg: "rgba(59,54,50,0.07)",   text: "#524B47",  border: "rgba(59,54,50,0.14)" },
  { bg: "rgba(13,110,178,0.09)", text: "#0D6EB2",  border: "rgba(13,110,178,0.18)" },
  { bg: "rgba(128,183,7,0.09)",  text: "#627A1A",  border: "rgba(128,183,7,0.2)" },
  { bg: "rgba(156,147,139,0.12)",text: "#6A625D",  border: "rgba(156,147,139,0.24)" },
];

/** Tag colors arrive from the model, and the `15`/`28` alpha suffixes below are
 *  only valid on a 6-digit hex — anything else silently produced an unparseable
 *  color, so it falls back to the cycling palette instead. */
function tagPalette(color: string | undefined, i: number) {
  const pal = TAG_PALETTES[i % TAG_PALETTES.length];
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return pal;
  return { bg: `${color}15`, text: color, border: `${color}28` };
}

export function AnimatedTags({ data, onComplete, animate = true }: { data: TagsData; onComplete: () => void; animate?: boolean }) {
  const [revealedTags, setRevealedTags] = useState(() => animate ? 0 : data.tags.length);
  useEffect(() => {
    if (!animate) { onComplete(); return; }
    let idx = 0;
    let doneT: ReturnType<typeof setTimeout> | null = null;
    const t = setInterval(() => {
      idx++;
      setRevealedTags(idx);
      if (idx >= data.tags.length) { clearInterval(t); doneT = setTimeout(onComplete, 160); }
    }, 90);
    return () => {
      clearInterval(t);
      if (doneT !== null) clearTimeout(doneT);
    };
  }, []); // eslint-disable-line

  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} style={{ fontFamily: "var(--font-body)" }}>
      {data.title && <div style={{ fontSize: 12, fontWeight: 500, color: "#9A9089", marginBottom: 9, textTransform: "uppercase", letterSpacing: "0.5px" }}>{data.title}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {data.tags.slice(0, revealedTags).map((tag, i) => {
          const pal = tagPalette(tag.color, i);
          return (
            <m.span key={tag.label} initial={{ scale: 0.55, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}>
              <span style={{ display: "inline-flex", alignItems: "center", background: pal.bg, border: `1px solid ${pal.border}`, color: pal.text, borderRadius: 99, padding: "3px 11px", fontSize: 13, fontWeight: 500, lineHeight: "19px" }}>
                {tag.label}
              </span>
            </m.span>
          );
        })}
      </div>
    </m.div>
  );
}
