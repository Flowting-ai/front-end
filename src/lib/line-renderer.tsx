"use client"

/**
 * LineRenderer — universal line-based content renderer for all chat surfaces.
 *
 * Pipeline:
 *   1. Split on \n → raw lines
 *   2. Walk lines  → typed Block[]
 *      (heading / code / table / ul / ol / hr / blockquote / latex / paragraph / empty)
 *   3. Render each Block with the right element
 *   4. Inline rendering (bold, italic, code, links, citations, highlights)
 *      runs PER LINE — bold/italic can NEVER span paragraph breaks.
 *
 * Replaces MarkdownRenderer in ContentRenderer, ReasoningBlock, and anywhere
 * chat markdown is rendered. Structurally eliminates the cross-paragraph **
 * formatting bug.
 */

import React from "react"
import katex from "katex"
import { CodeBlock } from "@/components/chat/CodeBlock"
import { CitationChip } from "@/components/chat/ResponseBlocks"
import { HighlightMark } from "@/components/HighlightMark"
import { sanitizeKaTeX } from "@/lib/security"
import type { WebCitation } from "@/hooks/use-chat-state"
import type { HighlightSpec } from "./markdown-utils"

// ── KaTeX helpers ──────────────────────────────────────────────────────────────

function renderKatex(math: string, display: boolean, key: string): React.ReactNode {
  try {
    const html = katex.renderToString(math, { throwOnError: false, displayMode: display })
    return (
      <span
        key={key}
        style={{ display: display ? "block" : "inline-block", margin: display ? "8px 0" : "0 2px", overflowX: display ? "auto" : undefined }}
        // eslint-disable-next-line react/no-danger -- KaTeX output is library-generated and sanitized
        dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }}
      />
    )
  } catch {
    return <code key={key}>{math}</code>
  }
}

// ── Inline renderer ────────────────────────────────────────────────────────────
// Processes ONE line of text into React nodes.
// Bold/italic markers can NEVER cross a \n boundary.

type InlineCtx = {
  webCitations?: WebCitation[]
  urlMap?: Map<string, number>  // url → 0-based citation index
}

function renderInlineSegment(text: string, prefix: string, ctx: InlineCtx): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const { webCitations, urlMap } = ctx

  // Handles (in priority order):
  //  1. **bold** / __bold__
  //  2. *italic* / _italic_   (single delimiter)
  //  3. `inline code`
  //  4. [link text](url)  — must come before bare-URL so markdown links win
  //  5. ~~strikethrough~~
  //  6. {N} citation chip
  //  7. $inline math$  — rendered via KaTeX
  //  8. bare https?:// URL  — auto-linked if not already inside [](…)
  //  9. \(inline math\)  — LaTeX \(...\) delimiter, rendered via KaTeX
  const re =
    /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|(?<!\*)\*([^*\n]+?)\*(?!\*)|(?<!_)_([^_\n]+?)_(?!_)|`([^`\n]+?)`|\[([^\]\n]+?)\]\((https?:\/\/[^\)\n]+?)\)|~~([^~\n]+?)~~|\{(\d+)\}|\$([^$\n]+?)\$|(https?:\/\/[^\s\])\n>"']+)|\\\((.+?)\\\)/g

  let last = 0
  let idx = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))

    const key = `${prefix}-in${idx++}`

    if (m[1] !== undefined) {
      // **bold**
      nodes.push(<strong key={key} style={{ fontWeight: 600 }}>{m[1]}</strong>)
    } else if (m[2] !== undefined) {
      // __bold__
      nodes.push(<strong key={key} style={{ fontWeight: 600 }}>{m[2]}</strong>)
    } else if (m[3] !== undefined) {
      // *italic*
      nodes.push(<em key={key}>{m[3]}</em>)
    } else if (m[4] !== undefined) {
      // _italic_
      nodes.push(<em key={key}>{m[4]}</em>)
    } else if (m[5] !== undefined) {
      // `inline code`
      nodes.push(
        <code
          key={key}
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "13px",
            background: "var(--neutral-800-10)",
            color: "var(--neutral-900)",
            borderRadius: "4px",
            padding: "1px 5px",
            border: "1px solid var(--neutral-700-12)",
            whiteSpace: "pre",
          }}
        >
          {m[5]}
        </code>,
      )
    } else if (m[6] !== undefined && m[7] !== undefined) {
      // [link](url)
      const href = m[7]
      if (urlMap?.has(href)) {
        const n = urlMap.get(href)!
        nodes.push(<CitationChip key={key} n={n + 1} citation={webCitations?.[n]} />)
      } else {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--brown-500)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            {m[6]}
          </a>,
        )
      }
    } else if (m[8] !== undefined) {
      // ~~strikethrough~~
      nodes.push(<s key={key}>{m[8]}</s>)
    } else if (m[9] !== undefined) {
      // {N} citation chip
      const n = parseInt(m[9], 10)
      nodes.push(<CitationChip key={key} n={n} citation={webCitations?.[n - 1]} />)
    } else if (m[10] !== undefined) {
      // $inline math$ — render with KaTeX
      nodes.push(renderKatex(m[10], false, key))
    } else if (m[12] !== undefined) {
      // \(inline math\) — LaTeX \(...\) delimiter, render with KaTeX
      nodes.push(renderKatex(m[12], false, key))
    } else if (m[11] !== undefined) {
      // bare https?:// URL — auto-link it
      const href = m[11]
      let display = href
      try { display = new URL(href).hostname + new URL(href).pathname.replace(/\/$/, "") } catch { /* use raw */ }
      if (urlMap?.has(href)) {
        const n = urlMap.get(href)!
        nodes.push(<CitationChip key={key} n={n + 1} citation={webCitations?.[n]} />)
      } else {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--brown-500)", textDecoration: "underline", textUnderlineOffset: "2px" }}
          >
            {display}
          </a>,
        )
      }
    }

    last = m.index + m[0].length
  }

  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length === 0 ? [text] : nodes
}

// Apply text-highlight marks around known highlight spans, then run inline rendering.
function renderInlineLine(
  text: string,
  prefix: string,
  ctx: InlineCtx,
  highlights?: HighlightSpec[],
): React.ReactNode[] {
  if (!highlights?.length) return renderInlineSegment(text, prefix, ctx)

  // Find all highlight matches in this line
  type Span = { start: number; end: number; spec: HighlightSpec }
  const spans: Span[] = []
  for (const spec of highlights) {
    let pos = 0
    let idx: number
    while ((idx = text.indexOf(spec.text, pos)) !== -1) {
      spans.push({ start: idx, end: idx + spec.text.length, spec })
      pos = idx + 1
    }
  }
  if (!spans.length) return renderInlineSegment(text, prefix, ctx)

  // Sort and remove overlaps
  spans.sort((a, b) => a.start - b.start || b.end - a.end)
  const resolved: Span[] = []
  let cursor = 0
  for (const s of spans) {
    if (s.start >= cursor) { resolved.push(s); cursor = s.end }
  }

  // Build nodes: non-highlighted → renderInlineSegment, highlighted → HighlightMark
  const nodes: React.ReactNode[] = []
  let p = 0
  let i = 0
  for (const s of resolved) {
    if (s.start > p) {
      nodes.push(...renderInlineSegment(text.slice(p, s.start), `${prefix}-hl${i}pre`, ctx))
    }
    nodes.push(
      <HighlightMark
        key={`${prefix}-hl${i}`}
        colorIndex={s.spec.colorIndex}
        data-highlight-id={s.spec.id}
      >
        {renderInlineSegment(text.slice(s.start, s.end), `${prefix}-hl${i}txt`, ctx)}
      </HighlightMark>,
    )
    p = s.end
    i++
  }
  if (p < text.length) {
    nodes.push(...renderInlineSegment(text.slice(p), `${prefix}-hl${i}post`, ctx))
  }
  return nodes
}

// ── Block types ────────────────────────────────────────────────────────────────

type TableRow = string[]

type Block =
  | { kind: "empty" }
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { kind: "code"; lang: string; lines: string[] }
  | { kind: "latex"; content: string; display: boolean }
  | { kind: "table"; headers: TableRow; rows: TableRow[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; start: number; items: string[] }
  | { kind: "hr" }
  | { kind: "blockquote"; text: string }
  | { kind: "paragraph"; lines: string[] }

// Split a GFM table row: "| a | b | c |" → ["a", "b", "c"]
function parseTableRow(line: string): TableRow {
  return line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s|:-]+\|[\s|:-]*$/.test(line.trim())
}

// ── Parser ─────────────────────────────────────────────────────────────────────

function parseBlocks(content: string): Block[] {
  const raw = content.split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < raw.length) {
    const line = raw[i]
    const t = line.trim()

    // ── Empty line ──────────────────────────────────────────────────────────────
    if (!t) {
      if (blocks[blocks.length - 1]?.kind !== "empty") blocks.push({ kind: "empty" })
      i++
      continue
    }

    // ── Fenced code block ───────────────────────────────────────────────────────
    if (t.startsWith("```")) {
      const lang = t.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < raw.length && !raw[i].trim().startsWith("```")) {
        codeLines.push(raw[i])
        i++
      }
      i++ // consume closing ```
      blocks.push({ kind: "code", lang, lines: codeLines })
      continue
    }

    // ── LaTeX display block $$…$$ ───────────────────────────────────────────────
    if (t === "$$" || (t.startsWith("$$") && !t.endsWith("$$"))) {
      const latexLines: string[] = []
      if (t !== "$$") latexLines.push(t.slice(2))
      i++
      while (i < raw.length && raw[i].trim() !== "$$") {
        latexLines.push(raw[i])
        i++
      }
      i++
      blocks.push({ kind: "latex", content: latexLines.join("\n").trim(), display: true })
      continue
    }
    // Single-line $$…$$ display block
    if (t.startsWith("$$") && t.endsWith("$$") && t.length > 4) {
      blocks.push({ kind: "latex", content: t.slice(2, -2).trim(), display: true })
      i++
      continue
    }
    // \[…\] display math
    if (t.startsWith("\\[")) {
      const latexLines: string[] = [t.slice(2)]
      i++
      while (i < raw.length && !raw[i].includes("\\]")) {
        latexLines.push(raw[i])
        i++
      }
      if (i < raw.length) {
        const lastLine = raw[i]
        latexLines.push(lastLine.slice(0, lastLine.indexOf("\\]")))
        i++
      }
      blocks.push({ kind: "latex", content: latexLines.join("\n").trim(), display: true })
      continue
    }

    // ── Heading ─────────────────────────────────────────────────────────────────
    const headingMatch = t.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: Math.min(headingMatch[1].length, 6) as 1 | 2 | 3 | 4 | 5 | 6,
        text: headingMatch[2],
      })
      i++
      continue
    }

    // ── Horizontal rule ─────────────────────────────────────────────────────────
    if (/^[-*_]{3,}$/.test(t)) {
      blocks.push({ kind: "hr" })
      i++
      continue
    }

    // ── Blockquote ──────────────────────────────────────────────────────────────
    if (t.startsWith("> ")) {
      blocks.push({ kind: "blockquote", text: t.slice(2) })
      i++
      continue
    }

    // ── GFM Table ───────────────────────────────────────────────────────────────
    // Detect: current line is a table row AND the next line is a separator
    if (t.startsWith("|") && i + 1 < raw.length && isTableSeparator(raw[i + 1])) {
      const headers = parseTableRow(t)
      i += 2 // skip header + separator
      const rows: TableRow[] = []
      while (i < raw.length && raw[i].trim().startsWith("|")) {
        rows.push(parseTableRow(raw[i]))
        i++
      }
      blocks.push({ kind: "table", headers, rows })
      continue
    }

    // ── Unordered list ──────────────────────────────────────────────────────────
    if (/^[-*+] /.test(t)) {
      const items: string[] = []
      while (i < raw.length && /^[-*+] /.test(raw[i].trim())) {
        items.push(raw[i].trim().slice(2))
        i++
      }
      blocks.push({ kind: "ul", items })
      continue
    }

    // ── Ordered list ────────────────────────────────────────────────────────────
    const olMatch = t.match(/^(\d+)\. /)
    if (olMatch) {
      const start = Number(olMatch[1])
      const items: string[] = []
      while (i < raw.length && /^\d+\. /.test(raw[i].trim())) {
        items.push(raw[i].trim().replace(/^\d+\.\s/, ""))
        i++
      }
      blocks.push({ kind: "ol", start, items })
      continue
    }

    // ── Paragraph ───────────────────────────────────────────────────────────────
    const paraLines: string[] = []
    while (i < raw.length) {
      const pl = raw[i]
      const pt = pl.trim()
      if (!pt) break
      if (/^#{1,6} /.test(pt)) break
      if (pt.startsWith("```")) break
      if (pt === "$$" || (pt.startsWith("$$") && !pt.endsWith("$$"))) break
      if (pt.startsWith("\\[")) break
      if (/^[-*_]{3,}$/.test(pt)) break
      if (pt.startsWith("> ")) break
      if (/^[-*+] /.test(pt)) break
      if (/^\d+\. /.test(pt)) break
      // Stop at a table header (next line is separator)
      if (pt.startsWith("|") && i + 1 < raw.length && isTableSeparator(raw[i + 1])) break
      paraLines.push(pl)
      i++
    }
    if (paraLines.length > 0) blocks.push({ kind: "paragraph", lines: paraLines })
  }

  return blocks
}

// ── Style tokens ───────────────────────────────────────────────────────────────

const TEXT: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "16px",
  lineHeight: "26px",
  color: "var(--neutral-800)",
  margin: 0,
  wordBreak: "break-word",
  overflowWrap: "break-word",
}

const HEADING_SIZE: Record<number, string> = {
  1: "22px", 2: "18px", 3: "16px", 4: "15px", 5: "14px", 6: "13px",
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface LineRendererProps {
  content: string
  webCitations?: WebCitation[]
  highlights?: HighlightSpec[]
}

export function LineRenderer({ content, webCitations, highlights }: LineRendererProps) {
  // Build a URL→index map once so inline citation matching is O(1)
  const urlMap = React.useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>()
    webCitations?.forEach((c, i) => { if (c.url) m.set(c.url, i) })
    return m
  }, [webCitations])

  const ctx: InlineCtx = { webCitations, urlMap }

  const blocks = React.useMemo(() => parseBlocks(content), [content])

  const rendered = blocks.map((block, bi) => {
    const k = `lr-b${bi}`

    // Helper: render one line with inline markdown + citations + highlights
    const inline = (line: string, lineKey: string) =>
      renderInlineLine(line, lineKey, ctx, highlights)

    switch (block.kind) {

      case "empty":
        return <div key={k} aria-hidden style={{ height: "14px" }} />

      case "heading": {
        return (
          <p
            key={k}
            style={{
              ...TEXT,
              fontWeight: 600,
              fontSize: HEADING_SIZE[block.level],
              lineHeight: "30px",
              color: "var(--neutral-900)",
              margin: "8px 0 2px",
            }}
          >
            {inline(block.text, k)}
          </p>
        )
      }

      case "code":
        return (
          <CodeBlock
            key={k}
            language={block.lang || undefined}
            value={block.lines.join("\n")}
            elementKey={k}
          />
        )

      case "latex":
        return renderKatex(block.content, block.display, k)

      case "table":
        return (
          <div
            key={k}
            className="kaya-scrollbar"
            style={{
              overflowX: "auto",
              margin: "12px 0",
              borderRadius: "8px",
              border: "1px solid var(--neutral-200)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
                lineHeight: "22px",
                fontFamily: "var(--font-body)",
              }}
            >
              <thead style={{ backgroundColor: "var(--neutral-50)" }}>
                <tr>
                  {block.headers.map((h, hi) => (
                    <th
                      key={hi}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "13px",
                        color: "var(--neutral-700)",
                        borderBottom: "1px solid var(--neutral-200)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {inline(h, `${k}-th${hi}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: "10px 14px",
                          borderBottom: "1px solid var(--neutral-100)",
                          color: "var(--neutral-800)",
                          verticalAlign: "top",
                          minWidth: "120px",
                          wordBreak: "break-word",
                        }}
                      >
                        {inline(cell, `${k}-td${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

      case "ul":
        return (
          <ul
            key={k}
            style={{
              margin: "0 0 14px",
              paddingLeft: "20px",
              listStyleType: "disc",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
            }}
          >
            {block.items.map((item, ii) => (
              <li key={ii} style={{ ...TEXT, lineHeight: "24px" }}>
                {inline(item, `${k}-li${ii}`)}
              </li>
            ))}
          </ul>
        )

      case "ol":
        return (
          <ol
            key={k}
            start={block.start}
            style={{
              margin: "0 0 14px",
              paddingLeft: "22px",
              listStyleType: "decimal",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
            }}
          >
            {block.items.map((item, ii) => (
              <li key={ii} style={{ ...TEXT, lineHeight: "24px" }}>
                {inline(item, `${k}-li${ii}`)}
              </li>
            ))}
          </ol>
        )

      case "hr":
        return (
          <hr
            key={k}
            style={{
              border: "none",
              borderTop: "1px solid var(--neutral-200)",
              margin: "16px 0",
            }}
          />
        )

      case "blockquote":
        return (
          <blockquote
            key={k}
            style={{
              margin: "0 0 14px",
              paddingLeft: "12px",
              borderLeft: "2.5px solid var(--neutral-200)",
              color: "var(--neutral-600)",
              fontStyle: "italic",
              ...TEXT,
            }}
          >
            {inline(block.text, k)}
          </blockquote>
        )

      case "paragraph":
        return (
          <p key={k} style={{ ...TEXT, marginBottom: "14px" }}>
            {block.lines.flatMap((line, li) => {
              const nodes = inline(line, `${k}-pl${li}`)
              return li < block.lines.length - 1
                ? [...nodes, <br key={`${k}-br${li}`} />]
                : nodes
            })}
          </p>
        )
    }
  })

  return <>{rendered}</>
}
