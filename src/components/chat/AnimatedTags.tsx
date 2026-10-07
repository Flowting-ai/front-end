"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import type { TagsData } from "@/types/chat";
import { useTheme } from "@/context/theme-context";
import { blendOver, ensureContrast } from "./AnimatedTags.contrast";

// �"��"� AnimatedTags �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const TAG_PALETTES = [
  { bg: "color-mix(in srgb, var(--brown-700) 10%, transparent)",   text: "var(--brown-700)",  border: "color-mix(in srgb, var(--brown-700) 20%, transparent)" },
  { bg: "color-mix(in srgb, var(--neutral-800) 7%, transparent)",   text: "var(--neutral-700)",  border: "var(--neutral-800-15)" },
  { bg: "var(--blue-600-10)", text: "var(--blue-600)",  border: "color-mix(in srgb, var(--blue-600) 18%, transparent)" },
  { bg: "color-mix(in srgb, var(--green-600) 9%, transparent)",  text: "var(--green-800)",  border: "color-mix(in srgb, var(--green-600) 20%, transparent)" },
  { bg: "color-mix(in srgb, var(--neutral-400) 12%, transparent)",text: "var(--neutral-600)",  border: "color-mix(in srgb, var(--neutral-400) 24%, transparent)" },
];

/** Tag colors arrive from the model, and the `15`/`28` alpha suffixes below are
 *  only valid on a 6-digit hex — anything else silently produced an unparseable
 *  color, so it falls back to the cycling palette instead.
 *  In the light theme the label is darkened as needed to stay ≥4.5:1 against
 *  the tint (`15` ≈ 8% alpha) over the chat surface (--neutral-white). */
function tagPalette(color: string | undefined, i: number, isLight: boolean) {
  const pal = TAG_PALETTES[i % TAG_PALETTES.length];
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return pal;
  const text = isLight ? ensureContrast(color, blendOver(color, 0x15 / 255, "#F9F8F5")) : color;
  return { bg: `${color}15`, text, border: `${color}28` };
}

export function AnimatedTags({ data, onComplete, animate = true }: { data: TagsData; onComplete: () => void; animate?: boolean }) {
  const [revealedTags, setRevealedTags] = useState(() => animate ? 0 : data.tags.length);
  const isLight = useTheme().resolved === "light";
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
      {data.title && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--neutral-600)", marginBottom: 9, textTransform: "uppercase", letterSpacing: "0.5px" }}>{data.title}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {data.tags.slice(0, revealedTags).map((tag, i) => {
          const pal = tagPalette(tag.color, i, isLight);
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
