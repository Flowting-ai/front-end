'use client'

import type { HighlightEntry } from '@/context/highlight-context'

/**
 * Scroll the browser to the given highlight inside a message element.
 *
 * Resolution order:
 *  1. [data-highlight-id] mark  — present when the renderer's text-search found
 *     the selection inside a single text node (plain text / simple formatting).
 *  2. <mark> text-content match — same-text fallback if the ID attribute is
 *     missing for some reason.
 *  3. Character-offset walk     — walks the DOM text nodes of the message
 *     element and inserts a transient anchor at h.startOffset so the exact
 *     selection position is reached even when inline markdown syntax
 *     (**, *, `) made the renderer's text-search fail (i.e. spec.text is the
 *     rendered visible text but the raw markdown line has syntax characters).
 *  4. Message element           — last-resort scroll to the message container.
 */
export function scrollToHighlight(
  msgEl: Element,
  h: Pick<HighlightEntry, 'id' | 'text' | 'startOffset'>,
): void {
  // 1. Exact data-highlight-id mark
  const byId = msgEl.querySelector(`[data-highlight-id="${h.id}"]`)
  if (byId) {
    byId.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  // 2. Text-content match across any <mark> inside the message
  const byText = Array.from(msgEl.querySelectorAll('mark')).find(
    m => m.textContent?.trim() === h.text.trim(),
  )
  if (byText) {
    byText.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  // 3. Character-offset walk — handles formatted text where spec.text ≠ raw
  //    markdown so the renderer never created a <mark data-highlight-id>.
  if (typeof h.startOffset === 'number') {
    const anchor = scrollToOffset(msgEl, h.startOffset)
    if (anchor) return
  }

  // 4. Fall back to message container
  msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/**
 * Insert a zero-size invisible anchor at `charOffset` characters into the
 * text content of `root`, scroll to it, then remove it.
 * Returns true on success.
 */
function scrollToOffset(root: Element, charOffset: number): boolean {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let accumulated = 0
  let node: Node | null

  while ((node = walker.nextNode())) {
    const text = node as Text
    const len  = text.length
    if (accumulated + len >= charOffset) {
      const offsetInNode = charOffset - accumulated
      try {
        const range = document.createRange()
        range.setStart(text, Math.min(offsetInNode, len))
        range.collapse(true)

        // Temporary invisible anchor inserted at the caret position
        const anchor = document.createElement('span')
        anchor.setAttribute('aria-hidden', 'true')
        anchor.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;'
        range.insertNode(anchor)
        anchor.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Defer removal so the browser has time to begin the smooth scroll
        requestAnimationFrame(() => anchor.remove())
        return true
      } catch {
        // Range operations can fail across shadow DOM or unusual node types
        return false
      }
    }
    accumulated += len
  }
  return false
}
