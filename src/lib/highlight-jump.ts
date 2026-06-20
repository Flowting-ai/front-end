'use client'

import type { HighlightEntry } from '@/context/highlight-context'
import { scrollToRenderedOffset } from '@/lib/rendered-highlights'

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
    const anchor = scrollToRenderedOffset(msgEl, h.startOffset)
    if (anchor) return
  }

  // 4. Fall back to message container
  msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
