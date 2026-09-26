"use client";

import React, { useState, useEffect } from "react";
import { m } from "framer-motion";
import type { BarChartData } from "@/types/chat";

// �"��"� AnimatedBarChart - 6 variants �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const BAR_PALETTE = ["#683D1B", "#0D6EB2", "#80B707", "#9C938B", "#A28847", "#524B47"];

function BarChartShell({ title, variant, children }: { title?: string; variant: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #F2E8E0", borderRadius: 12, padding: "16px 18px 14px" }}>
      {title && <div style={{ fontSize: 13, fontWeight: 600, color: "#26211E", marginBottom: 4 }}>{title}</div>}
      <div style={{ fontSize: 12, color: "#C0B5AD", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 14 }}>
        {variant} chart
      </div>
      {children}
    </div>
  );
}

export function AnimatedBarChart({ data, onComplete, animate = true }: { data: BarChartData; onComplete: () => void; animate?: boolean }) {
  const [revealed, setRevealed] = useState(!animate);
  const v = data.variant ?? "vertical";

  const chartH: number = (() => {
    switch (v) {
      case "positive-negative": return 220;
      case "grouped": return Math.max((data.labels?.length ?? 1) * 44, 180);
      case "stacked": return Math.max((data.labels?.length ?? 1) * 44, 180);
      case "stacked-100": return 180;
      default: return Math.max((data.bars?.length ?? 1) * 36, 140);
    }
  })();

  let totalDelay: number;
  if (v === "grouped" || v === "stacked") {
    const n = (data.labels?.length ?? 1) * (data.datasets?.length ?? 1);
    totalDelay = Math.max(n - 1, 0) * 60 + 980;
  } else if (v === "stacked-100") {
    const n = (data.labels?.length ?? 1) * (data.datasets?.length ?? 1);
    totalDelay = Math.max(n - 1, 0) * 50 + 780;
  } else {
    totalDelay = Math.max((data.bars?.length ?? 1) - 1, 0) * 100 + 980;
  }

  useEffect(() => {
    if (!animate) { onComplete(); return; }
    let doneT: ReturnType<typeof setTimeout> | null = null;
    const t = setTimeout(() => { setRevealed(true); doneT = setTimeout(onComplete, totalDelay); }, 140);
    return () => {
      clearTimeout(t);
      if (doneT !== null) clearTimeout(doneT);
    };
  }, []); // eslint-disable-line

  if (v === "vertical") {
    const maxVal = data.bars.length > 0 ? (data.maxValue ?? Math.max(...data.bars.map((b) => b.value)) * 1.2) : 1;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ position: "relative", height: chartH }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <m.div key={pct} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: "absolute", bottom: `${pct * chartH}px`, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.10)", pointerEvents: "none" }} />
          ))}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: "100%" }}>
            {data.bars.map((bar, i) => {
              const barH = Math.max((bar.value / maxVal) * chartH, 4);
              const color = bar.color ?? BAR_PALETTE[i % BAR_PALETTE.length];
              return (
                <div key={bar.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                  <m.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: i * 0.1 + 0.55, duration: 0.2 }}
                    style={{ fontSize: 12, fontWeight: 600, color: "#524B47", marginBottom: 4, lineHeight: 1 }}>
                    {bar.value}{data.unit ?? ""}
                  </m.div>
                  <m.div initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 140, damping: 18, mass: 1, delay: i * 0.1 }}
                    style={{ width: "100%", height: barH, background: color, borderRadius: "4px 4px 0 0", transformOrigin: "bottom" }} />
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(59,54,50,0.15)", margin: "0 0 8px" }} />
        <div style={{ display: "flex", gap: 10 }}>
          {data.bars.map((bar) => (
            <div key={bar.label} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9C938B", lineHeight: "16px" }}>{bar.label}</div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  if (v === "horizontal") {
    const maxVal = data.bars.length > 0 ? Math.max(...data.bars.map((b) => b.value)) * 1.1 : 1;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.bars.map((bar, i) => {
            const color = bar.color ?? BAR_PALETTE[i % BAR_PALETTE.length];
            const pct = bar.value / maxVal;
            return (
              <div key={bar.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 120, fontSize: 12, color: "#524B47", textAlign: "right", flexShrink: 0, lineHeight: "16px" }}>{bar.label}</div>
                <div style={{ flex: 1, position: "relative", height: 24, background: "rgba(59,54,50,0.05)", borderRadius: 4, overflow: "hidden" }}>
                  <m.div initial={{ scaleX: 0 }} animate={{ scaleX: revealed ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 120, damping: 20, delay: i * 0.08 }}
                    style={{ position: "absolute", inset: 0, width: `${pct * 100}%`, background: color, borderRadius: 4, transformOrigin: "left" }} />
                </div>
                <m.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: i * 0.08 + 0.5, duration: 0.2 }}
                  style={{ width: 44, fontSize: 12, fontWeight: 600, color: "#26211E", flexShrink: 0 }}>
                  {bar.value}{data.unit ?? ""}
                </m.div>
              </div>
            );
          })}
        </div>
      </BarChartShell>
    );
  }

  if (v === "grouped" && data.datasets && data.labels) {
    const allVals = data.datasets.flatMap((ds) => ds.values);
    const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.15 : 1;
    const nDatasets = data.datasets.length;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ position: "relative", height: chartH }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <m.div key={pct} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: "absolute", bottom: `${pct * chartH}px`, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.10)", pointerEvents: "none" }} />
          ))}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: "100%" }}>
            {data.labels.map((label, gi) => (
              <div key={label} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, height: "100%" }}>
                {data.datasets!.map((ds, di) => {
                  const val = ds.values[gi];
                  const barH = Math.max((val / maxVal) * chartH, 3);
                  const color = ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length];
                  const globalIdx = gi * nDatasets + di;
                  return (
                    <m.div key={ds.label} initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                      transition={{ type: "spring", stiffness: 140, damping: 18, mass: 1, delay: globalIdx * 0.06 }}
                      style={{ flex: 1, height: barH, background: color, borderRadius: "3px 3px 0 0", transformOrigin: "bottom" }} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(59,54,50,0.15)", margin: "0 0 8px" }} />
        <div style={{ display: "flex", gap: 16 }}>
          {data.labels.map((label) => (
            <div key={label} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9C938B", lineHeight: "16px" }}>{label}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          {data.datasets.map((ds, di) => (
            <div key={ds.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#827A74" }}>{ds.label}</span>
            </div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  if (v === "stacked" && data.datasets && data.labels) {
    const totals = data.labels.map((_, gi) => data.datasets!.reduce((s, ds) => s + ds.values[gi], 0));
    const maxTotal = Math.max(...totals) * 1.1;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ position: "relative", height: chartH }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <m.div key={pct} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: "absolute", bottom: `${pct * chartH}px`, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.10)", pointerEvents: "none" }} />
          ))}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: "100%" }}>
            {data.labels.map((label, gi) => {
              const total = totals[gi];
              const colH = (total / maxTotal) * chartH;
              return (
                <div key={label} style={{ flex: 1, height: colH, display: "flex", flexDirection: "column-reverse", borderRadius: "4px 4px 0 0", overflow: "hidden" }}>
                  {data.datasets!.map((ds, di) => {
                    const segH = (ds.values[gi] / maxTotal) * chartH;
                    const color = ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length];
                    return (
                      <m.div key={ds.label} initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: gi * 0.12 + di * 0.05 }}
                        style={{ width: "100%", height: segH, background: color, flexShrink: 0, transformOrigin: "bottom" }} />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(59,54,50,0.15)", margin: "0 0 8px" }} />
        <div style={{ display: "flex", gap: 14 }}>
          {data.labels.map((label) => (
            <div key={label} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9C938B", lineHeight: "16px" }}>{label}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          {data.datasets.map((ds, di) => (
            <div key={ds.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#827A74" }}>{ds.label}</span>
            </div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  if (v === "stacked-100" && data.datasets && data.labels) {
    const totals = data.labels.map((_, gi) => data.datasets!.reduce((s, ds) => s + ds.values[gi], 0));
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ display: "flex", gap: 10, height: chartH }}>
          {data.labels.map((label, gi) => {
            const total = totals[gi];
            return (
              <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, borderRadius: 4, overflow: "hidden", height: "100%" }}>
                {data.datasets!.map((ds, di) => {
                  const pct = total > 0 ? (ds.values[gi] / total) * 100 : 0;
                  const color = ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length];
                  return (
                    <m.div key={ds.label} initial={{ flex: 0 }} animate={{ flex: revealed ? pct : 0 }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: gi * 0.1 + di * 0.04 }}
                      style={{ background: color, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", minHeight: pct > 8 ? 16 : 0 }}>
                      {pct > 8 && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600, lineHeight: 1 }}>{Math.round(pct)}%</span>}
                    </m.div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{ height: 1, background: "rgba(59,54,50,0.15)", margin: "6px 0 8px" }} />
        <div style={{ display: "flex", gap: 10 }}>
          {data.labels.map((label) => (
            <div key={label} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9C938B", lineHeight: "16px" }}>{label}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          {data.datasets.map((ds, di) => (
            <div key={ds.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#827A74" }}>{ds.label}</span>
            </div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  if (v === "positive-negative") {
    const absMax = Math.max(Math.max(...data.bars.map((b) => Math.abs(b.value))) * 1.15, 1);
    const halfH = chartH / 2;
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ position: "relative", height: chartH }}>
          <div style={{ position: "absolute", top: halfH, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.30)", zIndex: 1 }} />
          {[-1, 1].map((side) => (
            <m.div key={side} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: "absolute", top: halfH - side * halfH * 0.5, left: 0, right: 0, height: 1, background: "rgba(59,54,50,0.05)", pointerEvents: "none" }} />
          ))}
          <div style={{ position: "absolute", inset: 0, display: "flex", gap: 10 }}>
            {data.bars.map((bar, i) => {
              const color = bar.color ?? (bar.value >= 0 ? "#80B707" : "#E05454");
              const barH = Math.max(Math.abs(bar.value) / absMax * halfH, 3);
              const isPos = bar.value >= 0;
              return (
                <div key={bar.label} style={{ flex: 1, height: "100%", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: halfH, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                    {isPos && (
                      <m.div initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                        transition={{ type: "spring", stiffness: 140, damping: 18, delay: i * 0.1 }}
                        style={{ width: "68%", height: barH, background: color, borderRadius: "3px 3px 0 0", transformOrigin: "bottom" }} />
                    )}
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: halfH, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
                    {!isPos && (
                      <m.div initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                        transition={{ type: "spring", stiffness: 140, damping: 18, delay: i * 0.1 }}
                        style={{ width: "68%", height: barH, background: color, borderRadius: "0 0 3px 3px", transformOrigin: "top" }} />
                    )}
                  </div>
                  <m.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: i * 0.1 + 0.55, duration: 0.2 }}
                    style={{ position: "absolute", top: halfH - 8, left: "50%", transform: "translateX(-50%)", fontSize: 12, fontWeight: 700, color, lineHeight: "16px", background: "white", padding: "0 3px", borderRadius: 3, zIndex: 2 }}>
                    {bar.value > 0 ? "+" : ""}{bar.value}
                  </m.div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {data.bars.map((bar) => (
            <div key={bar.label} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9C938B", lineHeight: "16px" }}>{bar.label}</div>
          ))}
        </div>
      </BarChartShell>
    );
  }

  return null;
}
