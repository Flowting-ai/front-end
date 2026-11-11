"use client";

import React, { useEffect, useMemo, useState } from "react";
import { m } from "framer-motion";
import type { ActivityItem } from "@/types/chat";
import styles from "./ImageGenerationPreview.module.css";

const STAGES = ["Sketching the composition", "Blocking in colors", "Adding detail", "Finishing touches"];
const STAGE_MS = 5000;

const IMAGE_TOOL_RE = /image|picture|illustrat|draw|paint/i;

/**
 * The image-generation call still waiting on its picture, if any.
 *
 * The sandbox reports `execute` done a few seconds before the `image` event
 * lands, so a finished call counts as pending until an image has arrived for
 * it — matched by order: the Nth image call is answered by the Nth image.
 */
export function findPendingImageGeneration(
  activities: ActivityItem[] | undefined,
  imageCount: number,
): ActivityItem | undefined {
  const calls = (activities ?? []).filter(
    (a) =>
      a.status !== "error" && a.status !== "stopped" &&
      (a.generatesImage ||
        ((a.status === "start" || a.status === "executing") &&
          IMAGE_TOOL_RE.test(`${a.toolName ?? ""} ${a.detail ?? ""}`))),
  );
  return calls[imageCount];
}

// ── Palette from the prompt ────────────────────────────────────────────────
// The real picture doesn't exist until the end, so the paint-in borrows its
// mood from what was asked for: "sunset" warms it, "storm" greys it, etc.
// Words the prompt doesn't cover fall back to hues hashed from the prompt, so
// every image still gets its own palette.
const MOOD_HUES: [RegExp, number[]][] = [
  [/sunset|sunrise|golden|autumn|fire|warm|desert/i, [18, 32, 45, 340]],
  [/night|space|galaxy|neon|midnight|cyber/i, [235, 260, 290, 200]],
  [/storm|rain|fog|mist|cloud|grey|gray/i, [210, 220, 200, 230]],
  [/ocean|sea|lake|water|river|beach|puddle|ice|snow|winter/i, [195, 205, 185, 220]],
  [/forest|jungle|grass|meadow|garden|tree|leaf/i, [110, 135, 85, 160]],
  [/lavender|purple|violet|lilac/i, [270, 285, 300, 250]],
  [/rose|pink|flower|blossom|cherry/i, [335, 350, 320, 15]],
];

function promptPalette(prompt: string | undefined): string[] {
  const text = prompt ?? "";
  const muted = /storm|fog|mist|grey|gray|night/i.test(text);
  // Two hues from every mood the prompt touches, so "snowy forest at sunset"
  // blends warm sky with cool snow instead of picking one.
  const hues: number[] = [];
  for (const [re, set] of MOOD_HUES) if (re.test(text)) hues.push(set[0], set[1]);
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  while (hues.length < 4) hues.push((h >>> (hues.length * 7)) % 360);
  const sat = muted ? 28 : 62;
  return hues.slice(0, 4).map((hue, i) => `hsl(${hue} ${sat}% ${muted ? 58 + i * 5 : 70 + i * 4}%)`);
}

/** Simulated progressive preview: an abstract, prompt-tinted canvas paints in
 *  top to bottom and sharpens while the image is generated. The real image
 *  takes over (blurred → sharp) the moment it arrives. */
export function ImageGenerationPreview({ activity, ref }: { activity?: ActivityItem; ref?: React.Ref<HTMLDivElement> }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), STAGE_MS);
    return () => window.clearInterval(id);
  }, []);

  const prompt = activity?.imageHints?.prompt;
  const aspect = activity?.imageHints?.aspect ?? 1;
  // Re-tint only every ~40 streamed characters; the colours themselves
  // cross-fade (registered custom properties), so a re-tint is a slow drift.
  const paletteSeed = prompt ? prompt.slice(0, Math.floor(prompt.length / 40) * 40 || prompt.length) : undefined;
  const palette = useMemo(() => promptPalette(paletteSeed), [paletteSeed]);
  const caption = STAGES[stage];

  return (
    <m.div
      // AnimatePresence's popLayout measures the exiting card through this ref.
      ref={ref}
      className={styles.card}
      data-stage={stage}
      role="status"
      aria-live="polite"
      aria-label={`Generating image: ${caption}`}
      style={{
        aspectRatio: String(aspect),
        // Same footprint GeneratedImageCard gives the finished image (320px
        // wide, ≤300px tall), so the hand-off doesn't jump in size.
        width: Math.min(320, 300 * aspect),
        "--c1": palette[0],
        "--c2": palette[1],
        "--c3": palette[2],
        "--c4": palette[3],
      } as React.CSSProperties}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      // Dissolves outward while the real image sharpens in beneath it.
      exit={{ opacity: 0, scale: 1.03, filter: "blur(16px)", transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], layout: { duration: 0.4 } }}
      layout
    >
      {/* Unpainted canvas */}
      <span className={styles.canvas} />

      {/* Painted region — feathered front moving down, noise clearing and
          blur easing off as stages advance */}
      <span className={styles.paint}>
        <span className={styles.wash}>
          <span className={styles.blob} />
          <span className={styles.blob} />
          <span className={styles.blob} />
          <span className={styles.blob} />
        </span>
        <span className={styles.grain} />
        <span className={styles.sheen} />
      </span>

      {/* Glow riding the paint front */}
      <span className={styles.front} />

      <div className={styles.footer}>
        <span className={styles.dot} aria-hidden />
        <m.span key={caption} className={styles.caption} initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          {caption}…
        </m.span>
      </div>
    </m.div>
  );
}
