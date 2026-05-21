"use client";

import { useEffect, useRef } from "react";

// Mirrors the AudioWaveOneIcon shape (7 bars) but animates bar heights in
// real time from a live AnalyserNode. Direct DOM mutation — no setState, no
// re-renders. RAF-driven setState inside Framer Motion's composited subtree
// gets batched/dropped.

const BAR_X       = [3, 6, 9, 12, 15, 18, 21];
const BAR_DEFAULT = [2, 10, 18, 12, 6, 10, 2];
const CENTER_Y    = 12;
const LERP        = 0.35;

export function AudioWaveDisplay({
  analyser,
  color = "currentColor",
  size  = 20,
}: {
  analyser: AnalyserNode | null;
  color?: string;
  size?: number;
}) {
  const pathRefs   = useRef<(SVGPathElement | null)[]>([]);
  const heightsRef = useRef<number[]>([...BAR_DEFAULT]);
  const rafRef     = useRef<number>(0);

  const updatePaths = (heights: number[]) => {
    heights.forEach((h, i) => {
      const el = pathRefs.current[i];
      if (el)
        el.setAttribute(
          "d",
          `M${BAR_X[i]} ${(CENTER_Y - h / 2).toFixed(2)}V${(CENTER_Y + h / 2).toFixed(2)}`,
        );
    });
  };

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (!analyser) {
      const decay = () => {
        const next = heightsRef.current.map((h, i) => h + (BAR_DEFAULT[i] - h) * LERP);
        heightsRef.current = next;
        updatePaths(next);
        // eslint-disable-next-line react-doctor/js-length-check-first -- length check is the leading condition via ||
        if (next.length !== BAR_DEFAULT.length || !next.every((h, i) => Math.abs(h - BAR_DEFAULT[i]) < 0.1))
          rafRef.current = requestAnimationFrame(decay);
      };
      rafRef.current = requestAnimationFrame(decay);
      return () => cancelAnimationFrame(rafRef.current);
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray    = new Uint8Array(bufferLength);
    const voiceBins    = Math.floor(bufferLength * 0.4);
    const binPerBar    = Math.floor(voiceBins / BAR_X.length);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const targets = BAR_X.map((_, i) => {
        const start = 1 + i * binPerBar;
        const end   = start + binPerBar;
        let sum = 0;
        for (let j = start; j < end; j++) sum += dataArray[j] ?? 0;
        return 2 + (sum / binPerBar / 255) * 18;
      });
      const next = heightsRef.current.map((h, i) => h + (targets[i] - h) * LERP);
      heightsRef.current = next;
      updatePaths(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  const p = {
    stroke:          color,
    strokeWidth:     1.5,
    strokeLinecap:   "round" as const,
    strokeLinejoin:  "round" as const,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {BAR_X.map((x, i) => {
        const h  = BAR_DEFAULT[i];
        const y1 = CENTER_Y - h / 2;
        const y2 = CENTER_Y + h / 2;
        return (
          <path
            key={x}
            ref={(el) => { pathRefs.current[i] = el; }}
            d={`M${x} ${y1.toFixed(2)}V${y2.toFixed(2)}`}
            {...p}
          />
        );
      })}
    </svg>
  );
}
