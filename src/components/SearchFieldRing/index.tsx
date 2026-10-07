'use client'

import { useEffect } from 'react'

/**
 * Pink focus ring on EVERY search field while it is active.
 *
 * `InputField` already draws the ring itself, but the app also has search boxes built from a raw
 * <input> (agents, models, pins, highlights, Slack panels, …). Rather than patching each one, this
 * listens for focus once, document-wide: when the focused element is a search input
 * (type="search", role="searchbox", or a placeholder / aria-label that says "search"), it marks the
 * field's visible box with `data-search-field` (once) and `data-search-active` (while focused), and
 * `globals.css` paints the ring on those attributes, animating it in and out (same 2px --focus-ring
 * outline InputField uses, so there is never a double ring).
 */

const SEARCH = /search/i

function isSearchInput(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false
  if (el.type === 'search' || el.getAttribute('role') === 'searchbox') return true
  return SEARCH.test(el.placeholder || '') || SEARCH.test(el.getAttribute('aria-label') || '')
}

/** The nearest ancestor (or the input itself) that actually looks like the field: rounded, and with a
 *  fill, border or shadow, and at least as wide as the input. Falls back to the input. */
function fieldBox(input: HTMLInputElement): HTMLElement {
  const width = input.getBoundingClientRect().width
  let el: HTMLElement | null = input
  for (let depth = 0; el && el !== document.body && depth < 5; depth++, el = el.parentElement) {
    const cs = getComputedStyle(el)
    const rounded = parseFloat(cs.borderTopLeftRadius) >= 4
    const painted = cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
    if (rounded && painted && el.getBoundingClientRect().width >= width) return el
  }
  return input
}

export function SearchFieldRing() {
  useEffect(() => {
    let active: HTMLElement | null = null
    let raf = 0
    // Only the active attribute is removed: data-search-field stays on the box, so the ring has a
    // transparent state to transition back to instead of vanishing.
    const clear = () => {
      cancelAnimationFrame(raf)
      active?.removeAttribute('data-search-active')
      active = null
    }
    const onFocusIn = (e: FocusEvent) => {
      clear()
      if (!isSearchInput(e.target)) return
      const box = fieldBox(e.target)
      active = box
      // First focus: give the box its transparent ring and let it paint once, so turning the
      // ring on in the next frame animates (a ring added in the same frame would just appear).
      const first = !box.hasAttribute('data-search-field')
      box.setAttribute('data-search-field', '')
      if (first) void box.offsetWidth
      raf = requestAnimationFrame(() => {
        if (active === box) box.setAttribute('data-search-active', '')
      })
    }
    const onFocusOut = () => clear()
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      clear()
    }
  }, [])
  return null
}
