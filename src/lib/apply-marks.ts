'use client'

import { HIGHLIGHT_COLORS } from '@/components/HighlightCard'
import { hasRawRange } from '@/lib/highlight-offsets'
import type { HighlightSpec } from '@/lib/markdown-utils'

// ── Range-based mark injection (code / plain HTML) ────────────────────────────
//
// Works by collecting ALL text nodes into a flat offset table, matching against
// the FULL concatenated text (no span-boundary interference), then using the
// DOM Range API to wrap matches that may span multiple sibling elements.
// Processing in reverse order keeps earlier offsets valid after each mutation.

interface Entry { node: Text; start: number; len: number }

function collectTextNodes(root: Node, doc: Document): Entry[] {
  const entries: Entry[] = []
  let offset = 0
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = n as Text
    // Skip anything inside .katex — LaTeX/KaTeX content is intentionally NOT
    // highlighted. Including its text nodes here would also corrupt offset
    // arithmetic (MathML duplicates visible chars) and break KaTeX layout.
    if (t.parentElement?.closest('.katex')) continue
    entries.push({ node: t, start: offset, len: t.length })
    offset += t.length
  }
  return entries
}

/**
 * In-place: inject `<mark data-highlight-id>` into a parsed DOM tree.
 * Handles cross-span matches (hljs keywords, etc.).
 * Does NOT touch .katex elements — LaTeX is never highlighted.
 */
export function applyRangeMarks(root: Element, specs: HighlightSpec[], doc: Document, offsetBase = 0): void {
  const entries = collectTextNodes(root, doc)
  if (!entries.length) return

  const fullText = entries.map(e => e.node.textContent ?? '').join('')

  type M = { start: number; end: number; spec: HighlightSpec }
  const matches: M[] = []
  for (const spec of specs) {
    if (hasRawRange(spec)) {
      const start = spec.startOffset - offsetBase
      const end = spec.endOffset - offsetBase
      if (end > 0 && start < fullText.length) {
        matches.push({ start: Math.max(0, start), end: Math.min(fullText.length, end), spec })
      }
    } else {
      let pos = 0, idx: number
      while ((idx = fullText.indexOf(spec.text, pos)) !== -1) {
        matches.push({ start: idx, end: idx + spec.text.length, spec })
        pos = idx + 1
      }
    }
  }
  if (!matches.length) return

  matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const resolved: M[] = []
  let cursor = 0
  for (const m of matches) {
    if (m.start >= cursor) { resolved.push(m); cursor = m.end }
  }

  for (let i = resolved.length - 1; i >= 0; i--) {
    const m = resolved[i]
    const startE = entries.find(e => e.start <= m.start && e.start + e.len > m.start)
    const endE   = entries.find(e => e.start < m.end   && e.start + e.len >= m.end)
    if (!startE || !endE) continue

    try {
      const range = doc.createRange()
      range.setStart(startE.node, m.start - startE.start)
      range.setEnd(endE.node,     m.end   - endE.start)

      const mark = doc.createElement('mark')
      mark.setAttribute('data-highlight-id', m.spec.id)
      const { bg } = HIGHLIGHT_COLORS[m.spec.colorIndex]
      mark.style.cssText = `background-color:${bg};color:inherit;border-radius:2px;padding:0 1px;`

      try {
        range.surroundContents(mark)
      } catch {
        mark.appendChild(range.extractContents())
        range.insertNode(mark)
      }
    } catch { /* detached node or shadow DOM — skip */ }
  }
}

/**
 * Parse `html` into a temporary DOM, inject marks, return the modified HTML.
 * Used for plain / hljs (syntax-highlighted) HTML via the Range approach.
 *
 * LaTeX/KaTeX content is intentionally never highlighted: collectTextNodes
 * skips `.katex`, so any KaTeX present in `html` passes through untouched.
 */
export function applyMarksToHtml(html: string, specs: HighlightSpec[], wrapTag = 'pre', offsetBase = 0): string {
  if (typeof window === 'undefined' || !specs.length) return html
  try {
    const doc  = new DOMParser().parseFromString(`<${wrapTag}>${html}</${wrapTag}>`, 'text/html')
    const root = doc.querySelector(wrapTag)!
    // Range-based marks for all non-katex text (collectTextNodes skips .katex)
    applyRangeMarks(root, specs, doc, offsetBase)
    return root.innerHTML
  } catch {
    return html
  }
}
