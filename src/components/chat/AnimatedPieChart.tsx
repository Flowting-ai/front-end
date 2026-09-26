"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import type { PieChartData } from "@/types/chat";

// �"��"� AnimatedPieChart �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const PIE_COLORS_HEX = ["#683D1B", "#0D6EB2", "#80B707", "#9C938B", "#524B47", "#A28847"];

export function AnimatedPieChart({ data, onComplete, animate = true }: { data: PieChartData; onComplete: () => void; animate?: boolean }) {
  const [revealedCount, setRevealedCount] = useState(() => animate ? 0 : data.segments.length);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const R = 90, CX = 110, CY = 110, SW = 26;
  const circ = 2 * Math.PI * R;
  const total = data.segments.reduce((s, seg) => s + seg.value, 0);

  let cumPct = 0;
  const arcs = data.segments.map((seg, i) => {
    const pct = seg.value / total;
    const startDeg = cumPct * 360 - 90;
    cumPct += pct;
    return { pct, startDeg, dashLen: pct * circ, gapLen: (1 - pct) * circ, color: seg.color ?? PIE_COLORS_HEX[i % PIE_COLORS_HEX.length], label: seg.label, value: seg.value };
  });

  useEffect(() => {
    if (!animate) { onComplete(); return; }
    let idx = 0;
    let doneT: ReturnType<typeof setTimeout> | null = null;
    const t = setInterval(() => {
      idx++;
      setRevealedCount(idx);
      if (idx >= data.segments.length) { clearInterval(t); doneT = setTimeout(onComplete, 800); }
    }, 180);
    return () => {
      clearInterval(t);
      if (doneT !== null) clearTimeout(doneT);
    };
  }, []); // eslint-disable-line

  return (
    <div style={{ background: "white", border: "1px solid #F2E8E0", borderRadius: 12, padding: "18px 20px" }}>
      {data.title && <div style={{ fontSize: 13, fontWeight: 600, color: "#26211E", marginBottom: 4 }}>{data.title}</div>}
      <div style={{ fontSize: 12, color: "#C0B5AD", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 16 }}>pie chart</div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <svg width={220} height={220} viewBox="0 0 220 220" style={{ display: "block", maxWidth: "100%" }}>
          <circle r={R} cx={CX} cy={CY} fill="none" stroke="rgba(59,54,50,0.07)" strokeWidth={SW} />
          {arcs.map((arc, i) => (
            <circle key={arc.label} r={R} cx={CX} cy={CY} fill="none" stroke={arc.color}
              strokeWidth={i === hoveredIdx ? SW + 4 : SW}
              strokeDasharray={`${arc.dashLen} ${arc.gapLen}`}
              strokeDashoffset={i < revealedCount ? 0 : arc.dashLen}
              transform={`rotate(${arc.startDeg} ${CX} ${CY})`}
              style={{ transition: "stroke-dashoffset 0.52s cubic-bezier(0.16,1,0.3,1), stroke-width 120ms", strokeLinecap: "butt", cursor: "pointer" }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
          {hoveredIdx !== null ? (
            <>
              <text x={CX} y={CY - 6} textAnchor="middle" fill={arcs[hoveredIdx].color} fontSize={22} fontWeight="700" fontFamily="inherit">{Math.round(arcs[hoveredIdx].pct * 100)}%</text>
              <text x={CX} y={CY + 16} textAnchor="middle" fill="#9C938B" fontSize={10} fontFamily="inherit">{data.unit ? `${Math.round(arcs[hoveredIdx].pct * total)}${data.unit}` : arcs[hoveredIdx].label.split(" ").slice(0, 2).join(" ")}</text>
            </>
          ) : (
            <>
              {data.centerLabel && <text x={CX} y={CY - 4} textAnchor="middle" fill="#26211E" fontSize={24} fontWeight="700" fontFamily="inherit">{data.centerLabel}</text>}
              <text x={CX} y={CY + 16} textAnchor="middle" fill="#9C938B" fontSize={10} fontFamily="inherit">total</text>
            </>
          )}
        </svg>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
        {arcs.map((arc, i) => (
          <m.div key={arc.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: i < revealedCount ? 1 : 0, y: i < revealedCount ? 0 : 4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default", opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.45 : undefined, transition: "opacity 120ms" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: arc.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#524B47", lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{arc.label}</div>
              <div style={{ fontSize: 12, color: "#9C938B", lineHeight: "15px" }}>
                {Math.round(arc.pct * 100)}%
                {data.unit && <span style={{ marginLeft: 4 }}>{Math.round(arc.pct * total)}{data.unit}</span>}
              </div>
            </div>
          </m.div>
        ))}
      </div>
    </div>
  );
}
