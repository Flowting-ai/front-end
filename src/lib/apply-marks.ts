'use client'

import { HIGHLIGHT_COLORS } from '@/components/HighlightCard'
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
    // Skip anything inside .katex — KaTeX elements are handled separately by
    // applyKatexHighlights. Including their text nodes here would:
    //  (a) corrupt offset arithmetic (MathML duplicates visible chars), and
    //  (b) cause Range manipulation inside KaTeX's sizing spans, breaking layout.
    if (t.parentElement?.closest('.katex')) continue
    entries.push({ node: t, start: offset, len: t.length })
    offset += t.length
  }
  return entries
}

/**
 * In-place: inject `<mark data-highlight-id>` into a parsed DOM tree.
 * Handles cross-span matches (hljs keywords, etc.).
 * Does NOT touch .katex elements — use applyKatexHighlights for those.
 */
export function applyRangeMarks(root: Element, specs: HighlightSpec[], doc: Document): void {
  const entries = collectTextNodes(root, doc)
  if (!entries.length) return

  const fullText = entries.map(e => e.node.textContent ?? '').join('')

  type M = { start: number; end: number; spec: HighlightSpec }
  const matches: M[] = []
  for (const spec of specs) {
    let pos = 0, idx: number
    while ((idx = fullText.indexOf(spec.text, pos)) !== -1) {
      matches.push({ start: idx, end: idx + spec.text.length, spec })
      pos = idx + 1
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

// ── KaTeX-specific highlight injection ───────────────────────────────────────
//
// KaTeX renders into a deeply-nested span tree for precise layout. Using Range
// manipulation INSIDE that tree (extractContents) breaks the sizing spans and
// corrupts the visual output.
//
// Strategy: leave KaTeX's internals untouched. Instead, wrap the outer
// <span class="katex"> in a <mark> when the formula's visible text matches.
//
// Visible text is read from <span class="katex-html"> only — the sibling
// <span class="katex-mathml"> contains a hidden MathML copy for screen readers
// whose text content would produce doubled or extra characters.
//
// Match logic:
//   visibleText.includes(spec.text)  — user selected a substring of the formula
//   spec.text.includes(visibleText)  — user selected text spanning formula + more

/**
 * Wrap each matching <span class="katex"> in a <mark>.
 */
// Strip all whitespace (including newlines the browser inserts between
// KaTeX stacking spans) and invisible Unicode glyphs (zero-width space,
// non-breaking space, etc.) so that spec.text from sel.toString() can be
// compared reliably against .katex-html.textContent.
function normKatex(s: string): string {
  return s.replace(/[\s​‌‍ ﻿]/g, '')
}

export function applyKatexHighlights(root: Element, specs: HighlightSpec[], doc: Document): void {
  const katexEls = Array.from(root.querySelectorAll('.katex'))
  if (!katexEls.length) return

  for (const katexEl of katexEls) {
    // Read visible text from katex-html only (not mathml / annotation text)
    const katexHtml = katexEl.querySelector('.katex-html')
    const rawVisible = (katexHtml ?? katexEl).textContent ?? ''
    const visibleNorm = normKatex(rawVisible)
    if (!visibleNorm) continue

    const matchingSpec = specs.find(spec => {
      const norm = normKatex(spec.text)
      // Match when the formula's normalized visible text contains the
      // normalized spec text.  Normalization removes whitespace / newlines
      // that browsers insert between KaTeX stacking elements (fractions,
      // integrals, etc.) when computing sel.toString().
      return norm.length > 0 && visibleNorm.includes(norm)
    })
    if (!matchingSpec) continue

    const { bg } = HIGHLIGHT_COLORS[matchingSpec.colorIndex]
    const mark = doc.createElement('mark')
    mark.setAttribute('data-highlight-id', matchingSpec.id)
    // inline-block keeps the mark tight around the formula without
    // disrupting the text baseline of surrounding content
    mark.style.cssText =
      `background-color:${bg};color:inherit;border-radius:3px;` +
      `padding:1px 3px;display:inline-block;`
    katexEl.parentNode?.insertBefore(mark, katexEl)
    mark.appendChild(katexEl)
  }
}

/**
 * Parse `html` into a temporary DOM, inject marks, return the modified HTML.
 * Handles both plain/hljs HTML (Range approach) and KaTeX HTML (wrap approach).
 */
export function applyMarksToHtml(html: string, specs: HighlightSpec[], wrapTag = 'pre'): string {
  if (typeof window === 'undefined' || !specs.length) return html
  try {
    const doc  = new DOMParser().parseFromString(`<${wrapTag}>${html}</${wrapTag}>`, 'text/html')
    const root = doc.querySelector(wrapTag)!
    // KaTeX first — wraps the outer .katex span, no inner DOM manipulation
    applyKatexHighlights(root, specs, doc)
    // Range-based marks for all non-katex text (collectTextNodes skips .katex)
    applyRangeMarks(root, specs, doc)
    return root.innerHTML
  } catch {
    return html
  }
}
