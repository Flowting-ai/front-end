"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Copy01Icon, Checkmark } from "@hugeicons/core-free-icons";
import type { TableData, TableCellValue } from "@/types/chat";
import { HIcon } from "./response-blocks-shared";

// �"��"� TableCell renderer �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

function renderTableCell(cell: TableCellValue, badgeMap?: TableData["badgeMap"]): React.ReactNode {
  if (typeof cell === "object") {
    if (cell.type === "check") return (
      <span style={{ fontWeight: 600, fontSize: 14, color: cell.value ? "#80B707" : "#C0B5AD" }}>
        {cell.value ? "✓" : "-"}
      </span>
    );
    if (cell.type === "badge") return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        background: cell.bg, color: cell.color, border: `1px solid ${cell.border ?? cell.bg}`,
        borderRadius: 99, padding: "2px 9px", fontSize: 12, fontWeight: 600, lineHeight: "18px", whiteSpace: "nowrap",
      }}>
        {cell.label}
      </span>
    );
    if (cell.type === "rich") return (
      <div>
        <div style={{ fontSize: 14, color: "#26211E", fontWeight: 500 }}>{cell.text}</div>
        {cell.sub && <div style={{ fontSize: 12, color: "#9C938B", marginTop: 1 }}>{cell.sub}</div>}
        {cell.badge && (
          <span style={{
            display: "inline-flex", marginTop: 4, background: cell.badge.bg, color: cell.badge.color,
            border: `1px solid ${cell.badge.border ?? cell.badge.bg}`, borderRadius: 99,
            padding: "1px 7px", fontSize: 12, fontWeight: 600, lineHeight: "16px",
          }}>
            {cell.badge.label}
          </span>
        )}
      </div>
    );
  }
  const strVal = String(cell);
  if (badgeMap?.[strVal]) {
    const bs = badgeMap[strVal];
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        background: bs.bg, color: bs.color, border: `1px solid ${bs.border ?? bs.bg}`,
        borderRadius: 99, padding: "2px 9px", fontSize: 12, fontWeight: 600, lineHeight: "18px", whiteSpace: "nowrap",
      }}>
        {strVal}
      </span>
    );
  }
  if (strVal === "✓") return <span style={{ color: "#80B707", fontWeight: 700 }}>�"</span>;
  if (strVal === "-") return <span style={{ color: "#C0B5AD", fontWeight: 400 }}>-</span>;
  return strVal;
}

function TableCellContent({ cell, badgeMap }: { cell: TableCellValue; badgeMap?: TableData["badgeMap"] }) {
  return <>{renderTableCell(cell, badgeMap)}</>
}

function sortableValue(cell: TableCellValue): string | number {
  if (typeof cell === "string" || typeof cell === "number") return cell;
  if (typeof cell === "object") {
    if (cell.type === "badge") return cell.label;
    if (cell.type === "rich") return cell.text;
    if (cell.type === "check") return cell.value ? 1 : 0;
  }
  return "";
}


// �"��"� AnimatedTable �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

export function AnimatedTable({ data, onComplete, animate = true }: { data: TableData; onComplete: () => void; animate?: boolean }) {
  const [skeletonVisible, setSkeletonVisible] = useState(() => animate);
  const [revealedRows, setRevealedRows] = useState(() => animate ? 0 : data.rows.length);
  const [isDone, setIsDone] = useState(() => !animate);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [mdCopied, setMdCopied] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const v = data.variant ?? "basic";
  const isCompact = v === "compact";
  const isMinimal = v === "minimal";
  const isHoverable = v === "hoverable";
  const isFinancial = v === "financial";
  const isMixed = v === "mixed-content";

  const gridCols = data.headers
    .map((_, ci) => ((v === "feature-comparison" || v === "minimal" || isMixed) && ci === 0) ? "2fr" : "1fr")
    .join(" ");

  const cellPad = isCompact ? "6px 12px" : "10px 14px";
  const skelH = isCompact ? 9 : isMixed ? 28 : 12;
  const skelW = (ri: number, ci: number) => {
    if (v === "feature-comparison" && ci > 0) return 30 + ((ri * 7) % 20);
    if (isFinancial && ci > 0) return 55 + ((ri * 13 + ci * 9) % 25);
    return 40 + ((ri * 11 + ci * 17 + ri + ci) % 38);
  };

  const displayRows = useMemo(() => {
    const indexed = data.rows.map((row, i) => ({ row, origIdx: i }));
    if (sortCol === null) return indexed;
    return [...indexed].sort((a, b) => {
      const av = sortableValue(a.row[sortCol]), bv = sortableValue(b.row[sortCol]);
      const cmp = (typeof av === "number" && typeof bv === "number") ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data.rows, sortCol, sortDir]);

  useEffect(() => {
    if (!animate) return;
    const rowDelay = isCompact ? 52 : 72;
    let iv: ReturnType<typeof setInterval> | null = null;
    let doneT: ReturnType<typeof setTimeout> | null = null;
    const skT = setTimeout(() => {
      setSkeletonVisible(false);
      let idx = 0;
      iv = setInterval(() => {
        idx++;
        setRevealedRows(idx);
        if (idx >= data.rows.length) {
          clearInterval(iv!);
          iv = null;
          setIsDone(true);
          doneT = setTimeout(onComplete, 280);
        }
      }, rowDelay);
    }, 500);
    return () => {
      clearTimeout(skT);
      if (iv !== null) clearInterval(iv);
      if (doneT !== null) clearTimeout(doneT);
    };
  }, []); // eslint-disable-line

  const handleSort = (ci: number) => {
    if (!data.sortable) return;
    if (sortCol === ci) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(ci); setSortDir("asc"); }
  };

  const copyMarkdown = () => {
    const allRows = [data.headers, ...data.rows];
    const widths = data.headers.map((_, ci) => Math.max(...allRows.map((r) => String(r[ci]).length)));
    const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toRow = (r: any[]) => "| " + r.map((c, i) => pad(String(typeof c === "object" ? (c as Record<string, string>).text ?? (c as Record<string, string>).label ?? "" : c), widths[i])).join(" | ") + " |";
    const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
    navigator.clipboard.writeText([toRow(data.headers), sep, ...data.rows.map(toRow)].join("\n")).catch(() => {});
    setMdCopied(true);
    setTimeout(() => setMdCopied(false), 1500);
  };

  const rowBg = (ri: number, isAccentRow: boolean, isTotalsRow: boolean) => {
    if (isAccentRow) return "rgba(104,61,27,0.04)";
    if (isTotalsRow) return "rgba(59,54,50,0.05)";
    if (isHoverable && hoveredRow === ri) return "rgba(104,61,27,0.04)";
    if (v === "striped" && ri % 2 === 1) return "rgba(59,54,50,0.05)";
    return "white";
  };
  const cellBorderLeft = (ci: number) => {
    if (isMinimal || isHoverable || isMixed) return "none";
    return ci > 0 ? "1px solid rgba(59,54,50,0.05)" : "none";
  };
  const rowBorderBottom = (ri: number) => {
    if (ri >= data.rows.length - 1) return "none";
    if (isMinimal) return "1px solid rgba(59,54,50,0.05)";
    return "1px solid rgba(82,75,71,0.12)";
  };

  return (
    <div>
      <div style={{ border: "1px solid #F2E8E0", borderRadius: 12, overflow: "hidden", fontSize: 14, ...(isMinimal ? { border: "none", borderRadius: 0 } : {}) }}>
        <AnimatePresence>
          {data.caption && isDone && (
            <m.div key="cap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
              style={{ padding: "7px 14px", borderBottom: "1px solid #F2E8E0", fontSize: 12, color: "#9C938B", fontStyle: "italic" }}>
              {data.caption}
            </m.div>
          )}
        </AnimatePresence>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, background: isMinimal ? "transparent" : "rgba(59,54,50,0.05)", borderBottom: "1px solid #F2E8E0" }}>
          {data.headers.map((h, ci) => (
            // eslint-disable-next-line react/no-array-index-as-key
            <div key={ci} onClick={() => handleSort(ci)}
              style={{
                padding: isCompact ? "6px 12px" : "9px 14px",
                fontWeight: 600, color: "#26211E", fontSize: 14, letterSpacing: "0.1px",
                borderLeft: (!isMinimal && !isHoverable) ? (ci > 0 ? "1px solid rgba(59,54,50,0.10)" : "none") : "none",
                cursor: data.sortable ? "pointer" : "default",
                userSelect: "none", display: "flex", alignItems: "center", gap: 5,
                justifyContent: (isFinancial && ci > 0) ? "flex-end" : (v === "feature-comparison" && ci > 0) ? "center" : "flex-start",
              }}
              onMouseEnter={(e) => { if (data.sortable) e.currentTarget.style.background = "rgba(59,54,50,0.10)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <span>{h}</span>
              {data.sortable && (
                <span style={{ fontSize: 12, lineHeight: 1, color: sortCol === ci ? "#683D1B" : "#C0B5AD" }}>
                  {sortCol === ci ? (sortDir === "asc" ? "�'" : "↓") : "↕"}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Skeleton: use a CSS-only pulse animation so the shimmer runs on the GPU
             and causes zero JS-thread work or layout recalculations during streaming. */}
        <AnimatePresence>
          {skeletonVisible && (
            <m.div key="skeleton" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {data.rows.map((_, ri) => (
                // eslint-disable-next-line react/no-array-index-as-key
                <m.div key={ri}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: ri * 0.045, duration: 0.18 }}
                  style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: rowBorderBottom(ri), background: v === "striped" && ri % 2 === 1 ? "rgba(59,54,50,0.05)" : "white" }}>
                  {data.headers.map((_, ci) => (
                    // eslint-disable-next-line react/no-array-index-as-key
                    <div key={ci} style={{ padding: cellPad, borderLeft: cellBorderLeft(ci), display: "flex", justifyContent: (isFinancial && ci > 0) ? "flex-end" : (v === "feature-comparison" && ci > 0) ? "center" : "flex-start" }}>
                      {isMixed && ci === 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "100%" }}>
                          <div style={{ height: 11, width: `${skelW(ri, ci)}%`, background: "rgba(59,54,50,0.10)", borderRadius: 3, animation: `kaya-skeleton-pulse 1.4s ease-in-out infinite`, animationDelay: `${(ri + ci) * 0.06}s` }} />
                          <div style={{ height: 8, width: `${skelW(ri, ci) * 0.6}%`, background: "rgba(59,54,50,0.05)", borderRadius: 3, animation: `kaya-skeleton-pulse 1.4s ease-in-out infinite`, animationDelay: `${(ri + ci) * 0.06 + 0.1}s` }} />
                        </div>
                      ) : (
                        <div style={{ height: skelH, width: `${skelW(ri, ci)}%`, background: "rgba(59,54,50,0.10)", borderRadius: 4, animation: `kaya-skeleton-pulse 1.4s ease-in-out infinite`, animationDelay: `${(ri + ci) * 0.06}s` }} />
                      )}
                    </div>
                  ))}
                </m.div>
              ))}
            </m.div>
          )}
        </AnimatePresence>

        {/* Real rows */}
        <AnimatePresence initial={false}>
          {displayRows.slice(0, revealedRows).map(({ row, origIdx }, ri) => {
            const isTotalsRow = !!(data.totalsRow && origIdx === data.rows.length - 1);
            const isAccentRow = !!(data.accentRows?.includes(origIdx));
            const bg = rowBg(ri, isAccentRow, isTotalsRow);
            return (
              <m.div key={`r-${origIdx}`}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onMouseEnter={() => { if (isHoverable) setHoveredRow(ri); }}
                onMouseLeave={() => { if (isHoverable) setHoveredRow(null); }}
                style={{ display: "grid", gridTemplateColumns: gridCols, position: "relative", borderBottom: rowBorderBottom(ri), borderTop: isTotalsRow ? "2px solid rgba(59,54,50,0.15)" : "none", background: bg, transition: "background 100ms", cursor: isHoverable ? "pointer" : "default" }}>
                {isAccentRow && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#683D1B" }} />}
                {row.map((cell, ci) => {
                  const isNumericCell = typeof cell === "number";
                  const rightAlign = (isFinancial && ci > 0) || isNumericCell;
                  const centerAlign = v === "feature-comparison" && ci > 0 && typeof cell === "object";
                  return (
                    // eslint-disable-next-line react/no-array-index-as-key
                    <div key={ci} style={{
                      padding: cellPad,
                      paddingLeft: isAccentRow && ci === 0 ? 17 : (isCompact ? 12 : 14),
                      color: ci === 0 && !isTotalsRow ? "#26211E" : isTotalsRow ? "#26211E" : "#524B47",
                      fontWeight: isTotalsRow ? 600 : ci === 0 && !isMixed ? 500 : 400,
                      borderLeft: cellBorderLeft(ci),
                      fontSize: isCompact ? 12 : isNumericCell ? 13 : 14,
                      textAlign: rightAlign ? "right" : centerAlign ? "center" : "left",
                      display: centerAlign ? "flex" : "block",
                      alignItems: centerAlign ? "center" : undefined,
                      justifyContent: centerAlign ? "center" : undefined,
                      lineHeight: isMixed ? "1" : "20px",
                    }}>
                      <TableCellContent cell={cell} badgeMap={data.badgeMap} />
                    </div>
                  );
                })}
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isDone && (
          <m.div key="actions" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
            style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, paddingLeft: 1 }}>
            <span style={{ fontSize: 12, color: "#C0B5AD", flex: 1 }}>
              {data.rows.length} rows · {data.headers.length} col
            </span>
            <button onClick={copyMarkdown} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "3px 9px",
              borderRadius: 6, border: "1px solid rgba(82,75,71,0.12)",
              background: "transparent", cursor: "pointer", fontSize: 12, color: "#827A74",
              fontFamily: "inherit", transition: "all 120ms",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,54,50,0.05)"; e.currentTarget.style.color = "#524B47"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#827A74"; }}>
              {mdCopied ? <HIcon icon={Checkmark} size={11} color="#80B707" strokeWidth={2.5} /> : <HIcon icon={Copy01Icon} size={11} color="#827A74" strokeWidth={1.5} />}
              {mdCopied ? "Copied!" : "Copy markdown"}
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
