"use client"

/**
 * XmlTable.tsx
 *
 * Renders a <table>...</table> XML block from the assistant.
 * Visual design mirrors souvenir-chat-preview AnimatedTable exactly:
 *   - Skeleton shimmer phase then animated row-by-row reveal
 *   - Header: dark-05 bg, bold neutral-900 text
 *   - Rows: col-0 neutral-900/medium, others neutral-700/regular
 *   - Footer: row/col count + "Copy markdown" + "Export CSV"
 *
 * See: docs/frontend-rendering.md - Tables section.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, m } from "framer-motion"

interface ParsedTable {
  headers: string[]
  rows: string[][]
}

function tableFromDoc(doc: Document): ParsedTable | null {
  const tableEl = doc.querySelector("table")
  if (!tableEl) return null
  const headers: string[] = []
  tableEl.querySelectorAll("thead th").forEach((th) => headers.push(th.textContent ?? ""))
  const rows: string[][] = []
  tableEl.querySelectorAll("tbody tr").forEach((tr) => {
    const cells: string[] = []
    tr.querySelectorAll("td").forEach((td) => cells.push(td.textContent ?? ""))
    if (cells.length > 0) rows.push(cells)
  })
  if (headers.length === 0) {
    tableEl.querySelectorAll("tr:first-child th").forEach((th) => headers.push(th.textContent ?? ""))
  }
  if (rows.length === 0) {
    tableEl.querySelectorAll("tr").forEach((tr, ri) => {
      if (ri === 0 && headers.length > 0) return
      const cells: string[] = []
      tr.querySelectorAll("td").forEach((td) => cells.push(td.textContent ?? ""))
      if (cells.length > 0) rows.push(cells)
    })
  }
  return { headers, rows }
}

function parseTableXml(xml: string): ParsedTable | null {
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml")
    if (!doc.querySelector("parsererror")) return tableFromDoc(doc)
  } catch {
    // Fall through to HTML parsing below.
  }

  try {
    const doc = new DOMParser().parseFromString(xml, "text/html")
    return tableFromDoc(doc)
  } catch {
    return null
  }
}

function AnimatedTable({ data, animate = true }: { data: ParsedTable; animate?: boolean }) {
  const [skeletonVisible, setSkeletonVisible] = useState(() => animate)
  const [revealedRows, setRevealedRows] = useState(() => animate ? 0 : data.rows.length)
  const [isDone, setIsDone] = useState(() => !animate)
  const [mdCopied, setMdCopied] = useState(false)
  const { headers, rows } = data
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length), 1)
  const skelW = (ri: number, ci: number) => 40 + ((ri * 11 + ci * 17 + ri + ci) % 38)
  const gridCols =
    headers.length > 0
      ? headers.map((_, ci) => (ci === 0 ? "1.6fr" : "1fr")).join(" ")
      : Array.from({ length: colCount }, (_, ci) => (ci === 0 ? "1.6fr" : "1fr")).join(" ")

  // Keep a ref so the interval can always read the latest row count even as
  // streaming appends new rows — avoids stale-closure capture.
  const rowsLenRef = useRef(rows.length)
  rowsLenRef.current = rows.length

  useEffect(() => {
    if (!animate) return
    // Hoist iv outside setTimeout so the cleanup function can always cancel it,
    // even if the timeout fires but the component unmounts before the interval ends.
    let iv: ReturnType<typeof setInterval> | null = null
    const skelTimer = setTimeout(() => {
      setSkeletonVisible(false)
      let idx = 0
      iv = setInterval(() => {
        idx++
        setRevealedRows(idx)
        if (idx >= rowsLenRef.current) {
          clearInterval(iv!)
          iv = null
          setIsDone(true)
        }
      }, 72)
    }, 500)
    return () => {
      clearTimeout(skelTimer)
      if (iv !== null) clearInterval(iv)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rowBorderBottom = (ri: number) =>
    ri < rows.length - 1 ? "1px solid var(--neutral-700-12)" : "none"

  const copyMarkdown = () => {
    const allRows = [headers, ...rows]
    const widths = Array.from({ length: colCount }, (_, ci) =>
      Math.max(...allRows.map((r) => (r[ci] ?? "").length), 1),
    )
    const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length))
    const toRow = (r: string[]) =>
      "| " + Array.from({ length: colCount }, (_, i) => pad(r[i] ?? "", widths[i]!)).join(" | ") + " |"
    const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |"
    navigator.clipboard.writeText([toRow(headers), sep, ...rows.map(toRow)].join("\n")).catch(() => {})
    setMdCopied(true)
    setTimeout(() => setMdCopied(false), 1500)
  }

  const exportCSV = () => {
    const csv = [headers, ...rows]
      .map((r) => Array.from({ length: colCount }, (_, i) => `"${(r[i] ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "table.csv",
    })
    a.click()
  }

  return (
    <div style={{ margin: "16px 0" }}>
      <div style={{ border: "1px solid var(--neutral-100)", borderRadius: 12, overflow: "hidden", fontSize: 14 }}>
        {headers.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: gridCols, background: "var(--neutral-800-05)", borderBottom: "1px solid var(--neutral-100)" }}>
            {headers.map((h, ci) => (
              <div key={ci} style={{ padding: "9px 14px", fontWeight: 600, color: "var(--neutral-900)", fontSize: 14, letterSpacing: "0.1px", borderLeft: ci > 0 ? "1px solid var(--neutral-800-10)" : "none" }}>
                {h}
              </div>
            ))}
          </div>
        )}
        <AnimatePresence>
          {skeletonVisible && (
            <m.div key="skeleton" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {rows.map((_, ri) => (
                <m.div key={ri} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ri * 0.045, duration: 0.18 }}
                  style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: rowBorderBottom(ri), background: "var(--neutral-white)" }}>
                  {Array.from({ length: colCount }).map((_, ci) => (
                    <div key={ci} style={{ padding: "10px 14px", borderLeft: ci > 0 ? "1px solid var(--neutral-800-05)" : "none" }}>
                      <m.div
                        animate={{ opacity: [0.35, 0.85, 0.35] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: (ri + ci) * 0.06 }}
                        style={{ height: 12, width: `${skelW(ri, ci)}%`, background: "var(--neutral-800-10)", borderRadius: 4 }}
                      />
                    </div>
                  ))}
                </m.div>
              ))}
            </m.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {rows.slice(0, revealedRows).map((row, ri) => (
            <m.div key={ri} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: rowBorderBottom(ri), background: "var(--neutral-white)" }}>
              {Array.from({ length: colCount }).map((_, ci) => (
                <div key={ci} style={{ padding: "10px 14px", color: ci === 0 ? "var(--neutral-900)" : "var(--neutral-700)", fontWeight: ci === 0 ? 500 : 400, borderLeft: ci > 0 ? "1px solid var(--neutral-800-05)" : "none", fontSize: 14, lineHeight: "20px", wordBreak: "break-word" }}>
                  {row[ci] ?? ""}
                </div>
              ))}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {isDone && (
          <m.div key="actions" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
            style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, paddingLeft: 1 }}>
            <span style={{ fontSize: 12, color: "var(--neutral-300)", flex: 1 }}>
              {rows.length} {rows.length === 1 ? "row" : "rows"} · {headers.length} col
            </span>
            <TableActionButton onClick={copyMarkdown}>
              {mdCopied ? <span style={{ color: "var(--green-600)" }}>Copied!</span> : "Copy markdown"}
            </TableActionButton>
            <TableActionButton onClick={exportCSV}>Export CSV</TableActionButton>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TableActionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--neutral-700-12)", background: hov ? "var(--neutral-800-05)" : "transparent", cursor: "pointer", fontSize: 12, color: hov ? "var(--neutral-700)" : "var(--neutral-500)", fontFamily: "var(--font-body)", transition: "background 120ms, color 120ms" }}>
      {children}
    </button>
  )
}

interface XmlTableProps {
  xml: string
  animate?: boolean
}

export function XmlTable({ xml, animate = false }: XmlTableProps) {
  const data = useMemo(() => parseTableXml(xml) ?? "error", [xml])
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div style={{ height: 80, margin: "16px 0", borderRadius: 12, border: "1px solid var(--neutral-100)", background: "var(--neutral-800-05)" }} aria-hidden />
    )
  }

  if (!data || data === "error") {
    return (
      <pre className="kaya-scrollbar" style={{ fontSize: 12, color: "var(--neutral-500)", overflowX: "auto", margin: "12px 0", padding: "10px 14px", background: "var(--neutral-800-05)", borderRadius: 8, border: "1px solid var(--neutral-100)", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "var(--font-code)" }}>
        {xml}
      </pre>
    )
  }

  return <AnimatedTable data={data} animate={animate} />
}
