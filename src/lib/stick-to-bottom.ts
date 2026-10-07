/**
 * Stick-to-bottom ("follow") decisions for the chat scroller, kept free of the
 * DOM so they can be unit-tested. ChatInterface owns the listeners and the
 * actual scrolling; this only decides whether the view should follow new
 * content at the bottom.
 *
 * Follow is turned off only by the view moving toward history — a wheel or
 * touch gesture, keys, a scrollbar drag, or any scroll that lowers scrollTop
 * by more than the scroll range shrank — never by content growing or
 * shrinking. Coming back down within the threshold of the bottom sticks it
 * again.
 */

/** Distance from the bottom (px) still treated as "at the bottom". */
export const STICK_THRESHOLD_PX = 80

/** How long after a user gesture its scroll events count as the user's (ms). */
export const USER_SCROLL_WINDOW_MS = 150

/** Sub-pixel/rounding slack when telling a real upward scroll from a clamp. */
const MOVE_TOLERANCE_PX = 2

/** `up` is toward history; `down` also covers gestures with no known direction. */
export type ScrollIntent = "up" | "down"

export interface ScrollMetrics {
  scrollTop:    number
  scrollHeight: number
  clientHeight: number
}

export interface StickToBottom {
  /** True while the view should follow new content at the bottom. */
  readonly stuck: boolean
  /** The user asked for the bottom (send, regenerate, edit, scroll-to-bottom). */
  stick(): void
  /** The app moved the view away on the user's behalf (e.g. jump to a message). */
  unstick(): void
  /** A wheel / touch / key gesture that is about to scroll the view. */
  userIntent(direction: ScrollIntent, now: number): void
  /** A pointer pressed on the scroller itself (its scrollbar). */
  pointerDown(): void
  /** Returns whether a pointer pressed on the scroller was released. */
  pointerUp(now: number): boolean
  /** Feeds a scroll event; returns whether the view is stuck afterwards. */
  onScroll(metrics: ScrollMetrics, now: number): boolean
  /**
   * Whether a follow scroll may run now. Held off while the user is mid-gesture
   * toward history or dragging the scrollbar, so it can't cancel their scroll
   * before its own scroll event has had the chance to unstick the view.
   */
  canFollow(now: number): boolean
}

export function createStickToBottom({
  threshold = STICK_THRESHOLD_PX,
  windowMs  = USER_SCROLL_WINDOW_MS,
}: { threshold?: number; windowMs?: number } = {}): StickToBottom {
  let stuck = true
  let intent: ScrollIntent | null = null
  let intentUntil = -Infinity
  let pointerHeld = false
  let last: { scrollTop: number; maxScrollTop: number } | null = null

  const inWindow = (now: number) => pointerHeld || now < intentUntil

  return {
    get stuck() { return stuck },

    stick() {
      stuck = true
      intent = null
      intentUntil = -Infinity
      // A scrollbar release the browser never reported must not block
      // following for good.
      pointerHeld = false
    },

    unstick() {
      stuck = false
    },

    userIntent(direction, now) {
      intent = direction
      intentUntil = now + windowMs
      pointerHeld = false
    },

    pointerDown() {
      pointerHeld = true
      intent = "down"
    },

    pointerUp(now) {
      if (!pointerHeld) return false
      pointerHeld = false
      intentUntil = now + windowMs
      return true
    },

    onScroll({ scrollTop, scrollHeight, clientHeight }, now) {
      const maxScrollTop = scrollHeight - clientHeight
      const dist = maxScrollTop - scrollTop
      const movedUpBy = last ? last.scrollTop - scrollTop : 0
      // The browser clamps scrollTop down when the scroll range shrinks
      // (content shrinking, the composer growing); that much movement isn't
      // the user's.
      const clampedBy = last ? Math.max(0, last.maxScrollTop - maxScrollTop) : 0
      last = { scrollTop, maxScrollTop }

      if (movedUpBy > clampedBy + MOVE_TOLERANCE_PX) {
        // Moving toward history is always someone's intent: content growth
        // never lowers scrollTop (scroll anchoring is off) and a follow only
        // raises it. This covers scrolls with no gesture we can see — keys
        // pressed with focus on the page, find-in-page, selection drags,
        // screen readers, a smooth jump to a message — and even a few px from
        // a trackpad, which would otherwise sit inside the threshold.
        stuck = false
      } else if (movedUpBy > 0 && inWindow(now) && intent === "up") {
        // Mid-gesture toward history: nothing re-sticks until it ends.
        stuck = false
      } else if (inWindow(now) && intent !== "up") {
        stuck = dist <= threshold
      } else if (!stuck && movedUpBy <= 0 && dist <= threshold) {
        // Re-stick when the view is back at the bottom and isn't moving up —
        // so a jump the app made (unstick) isn't undone by its own first,
        // still-near-the-bottom frame, which always moves up.
        stuck = true
      }
      return stuck
    },

    canFollow(now) {
      if (!stuck || pointerHeld) return false
      return !(intent === "up" && now < intentUntil)
    },
  }
}

/** The scroll direction a navigation key asks for, or null for other keys. */
export function scrollIntentForKey(key: string, shiftKey: boolean): ScrollIntent | null {
  switch (key) {
    case "ArrowUp":
    case "PageUp":
    case "Home":
      return "up"
    case "ArrowDown":
    case "PageDown":
    case "End":
      return "down"
    case " ":
      return shiftKey ? "up" : "down"
    default:
      return null
  }
}

/**
 * Whether the virtualizer should shift the scroll position to compensate for a
 * row changing size (TanStack's `shouldAdjustScrollPositionOnItemSizeChange`).
 *
 * Rows above the viewport keep the default compensation so what the user is
 * reading doesn't move. The last row — the one that streams — is left to the
 * stick-to-bottom logic: the default would add its growth to the scroll
 * position whenever its top is above the viewport, dragging a user who is
 * reading higher up inside a long streaming reply down with every chunk.
 */
export function shouldAdjustScrollOnItemResize(
  item: { index: number; start: number },
  itemCount: number,
  scrollOffset: number,
): boolean {
  if (item.index === itemCount - 1) return false
  return item.start < scrollOffset
}
