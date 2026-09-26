"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, m } from "framer-motion";
import type { LineChartData } from "@/types/chat";

// �"��"� AnimatedLineChart �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

export function AnimatedLineChart({ data, onComplete, animate = true }: { data: LineChartData; onComplete: () => void; animate?: boolean }) {
  const [revealed, setRevealed] = useState(!animate);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverContainerX, setHoverContainerX] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const W = 700, H = 160;
  const PAD = { top: 14, right: 18, bottom: 32, left: 38 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const LINE_COLORS = ["#683D1B", "#0D6EB2", "#80B707", "#9C938B"];

  const allY = data.lines.flatMap((l) => l.points.map((p) => p.y));
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const range = maxY - minY || 1;
  const maxXIdx = (data.lines[0]?.points.length ?? 1) - 1 || 1;

  const toSVG = (xi: number, y: number) => ({
    x: PAD.left + (xi / maxXIdx) * chartW,
    y: PAD.top + (1 - (y - minY) / range) * chartH,
  });

  useEffect(() => {
    if (!animate) { onComplete(); return; }
    let doneT: ReturnType<typeof setTimeout> | null = null;
    const t = setTimeout(() => { setRevealed(true); doneT = setTimeout(onComplete, 1300); }, 120);
    return () => {
      clearTimeout(t);
      if (doneT !== null) clearTimeout(doneT);
    };
  }, []); // eslint-disable-line

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !containerRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const contRect = containerRef.current.getBoundingClientRect();
    const scaleX = W / svgRect.width;
    const svgX = (e.clientX - svgRect.left) * scaleX;
    if (svgX < PAD.left || svgX > PAD.left + chartW) { setHoverIdx(null); return; }
    const xi = Math.round((svgX - PAD.left) / chartW * maxXIdx);
    setHoverIdx(Math.max(0, Math.min(maxXIdx, xi)));
    setHoverContainerX(e.clientX - contRect.left);
  };

  const tooltipItems = hoverIdx !== null
    ? data.lines.map((line, li) => ({ label: line.label ?? `Series ${li + 1}`, value: line.points[hoverIdx]?.y ?? 0, color: line.color ?? LINE_COLORS[li % LINE_COLORS.length] }))
    : [];

  const crosshairSvgX = hoverIdx !== null ? PAD.left + (hoverIdx / maxXIdx) * chartW : 0;
  const tooltipWidth = 120;
  const tooltipLeft = Math.min(Math.max(hoverContainerX - tooltipWidth / 2, 4), (containerRef.current?.clientWidth ?? 360) - tooltipWidth - 4);

  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: "white", border: "1px solid #F2E8E0", borderRadius: 12, padding: "16px 18px 12px" }}>
      {data.title && <div style={{ fontSize: 13, fontWeight: 600, color: "#26211E", marginBottom: 14 }}>{data.title}</div>}
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const yv = PAD.top + pct * chartH;
            return <m.line key={pct} x1={PAD.left} x2={PAD.left + chartW} y1={yv} y2={yv} stroke="rgba(59,54,50,0.07)" strokeWidth={1} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.3, delay: 0.1 }} />;
          })}
          {[0, 0.5, 1].map((pct) => {
            const val = maxY - pct * range;
            return <text key={pct} x={PAD.left - 6} y={PAD.top + pct * chartH + 4} textAnchor="end" fill="#C0B5AD" fontSize={11} fontFamily="inherit">{Math.round(val)}{data.unit ?? ""}</text>;
          })}
          {data.lines.map((line, li) => {
            const color = line.color ?? LINE_COLORS[li % LINE_COLORS.length];
            const pts = line.points.map((p, i) => { const { x, y } = toSVG(i, p.y); return `${x},${y}`; }).join(" ");
            const areaPts = pts + ` ${PAD.left + chartW},${PAD.top + chartH} ${PAD.left},${PAD.top + chartH}`;
            return (
              <g key={line.label ?? `line-${li}`}>
                <m.polygon points={areaPts} fill={`${color}10`} stroke="none" initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: 0.35, duration: 0.4 }} />
                <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} pathLength={1} strokeDasharray="1"
                  strokeDashoffset={revealed ? 0 : 1} strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)" }} />
                {line.points.map((p, i) => {
                  const { x, y } = toSVG(i, p.y);
                  const isHovered = hoverIdx === i;
                  return (
                    <m.circle key={String(p.x)} cx={x} cy={y} r={isHovered ? 4 : 2.5}
                      fill={isHovered ? "white" : color} stroke={isHovered ? color : "none"} strokeWidth={isHovered ? 2 : 0}
                      initial={{ scale: 0 }} animate={{ scale: revealed ? 1 : 0 }}
                      transition={{ type: "spring", stiffness: 480, damping: 22, delay: revealed ? 0 : 0.9 + i * 0.025 }}
                      style={{ transformOrigin: `${x}px ${y}px` }} />
                  );
                })}
              </g>
            );
          })}
          <line x1={PAD.left} x2={PAD.left + chartW} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="rgba(59,54,50,0.14)" strokeWidth={0.8} />
          {data.lines[0]?.points.map((p, i) => {
            const total = data.lines[0].points.length;
            const skip = Math.ceil(total / 7);
            if (i % skip !== 0 && i !== total - 1) return null;
            const { x } = toSVG(i, 0);
            return <text key={String(p.x)} x={x} y={H - 6} textAnchor="middle" fill="#C0B5AD" fontSize={11} fontFamily="inherit">{p.x}</text>;
          })}
          {hoverIdx !== null && <line x1={crosshairSvgX} x2={crosshairSvgX} y1={PAD.top} y2={PAD.top + chartH} stroke="rgba(59,54,50,0.18)" strokeWidth={0.8} strokeDasharray="4 3" />}
        </svg>
        <AnimatePresence initial={false}>
          {hoverIdx !== null && tooltipItems.length > 0 && (
            <m.div key="tooltip" initial={{ opacity: 0, y: 4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.96 }} transition={{ duration: 0.12 }}
              style={{ position: "absolute", top: -8, left: tooltipLeft, width: tooltipWidth, background: "#26211E", borderRadius: 8, padding: "7px 10px", pointerEvents: "none", zIndex: 10, boxShadow: "0 4px 12px rgba(18,12,8,0.22)" }}>
              <div style={{ fontSize: 12, color: "#9C938B", fontWeight: 500, marginBottom: 5, letterSpacing: "0.3px" }}>{data.lines[0]?.points[hoverIdx]?.x}</div>
              {tooltipItems.map((item, ti) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: ti > 0 ? 3 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    {tooltipItems.length > 1 && <span style={{ fontSize: 12, color: "#9C938B", maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "white", fontVariantNumeric: "tabular-nums" }}>{item.value}{data.unit ?? ""}</span>
                </div>
              ))}
            </m.div>
          )}
        </AnimatePresence>
      </div>
      {data.lines.length > 1 && (
        <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          {data.lines.map((line, li) => (
            <div key={line.label ?? `legend-${li}`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 12, height: 2, background: line.color ?? LINE_COLORS[li % LINE_COLORS.length], borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: "#827A74" }}>{line.label}</span>
            </div>
          ))}
        </div>
      )}
    </m.div>
  );
}
