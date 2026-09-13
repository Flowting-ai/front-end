'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps Tab/Shift+Tab focus cycling within `containerRef`'s subtree while
 * `active`, moves focus into it on activation, and restores focus to
 * whatever was focused before on deactivation/unmount.
 *
 * For any custom modal overlay that isn't built on a focus-managing dialog
 * primitive (Radix Dialog, etc.) — a plain `position: fixed` div over the
 * page does not remove the rest of the page from tab order, so Tab/Enter
 * still reach — and can activate — controls behind the overlay (e.g. two
 * sidebar buttons that each open their own modal: tabbing past the first
 * modal's own controls lands back on the trigger row and can open the
 * second modal on top of the first). Pass `onEscape` to also close on Esc,
 * since trapping Tab needs some keyboard-only way out.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
): void {
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetParent !== null)

    // Move focus into the modal immediately — otherwise focus stays on
    // whatever triggered it (behind the overlay) until the user tabs.
    const first = getFocusable()[0]
    ;(first ?? container).focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault()
        onEscape()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = focusable[0]
      const lastEl  = focusable[focusable.length - 1]
      const activeEl = document.activeElement

      if (e.shiftKey) {
        if (activeEl === firstEl || !container.contains(activeEl)) {
          e.preventDefault()
          lastEl.focus()
        }
      } else {
        if (activeEl === lastEl || !container.contains(activeEl)) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }

    // Capture phase: intercepts Tab before it can reach — or activate —
    // anything behind the overlay, regardless of that element's own handlers.
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      previouslyFocused.current?.focus?.()
    }
  }, [active, containerRef, onEscape])
}
