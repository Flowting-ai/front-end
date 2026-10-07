'use client'

/**
 * Module-level singleton that bridges the jump-gutter / highlight-panel jump
 * handlers to ChatInterface's virtualizer.
 *
 * The chat messages list is virtualised — only visible rows exist in the DOM.
 * When a gutter pill is clicked for a message that has been scrolled out of
 * view, `document.querySelector('[data-message-id="..."]')` returns null.
 *
 * ChatInterface registers a scroll function on mount and unregisters on unmount.
 * FloatingPanel / HighlightSidebar call `scrollChatToMessage` which first
 * brings the virtual row into view, then calls back once the DOM element is
 * available so the caller can fine-scroll to the exact highlight mark.
 */

type OnRendered = (el: Element) => void

interface ChatScrollerFn {
  (messageId: string, onRendered: OnRendered): void
}

let _scroller: ChatScrollerFn | null = null
let _onJump: (() => void) | null = null

/** `onJump` runs before a fast-path jump (the registered scroller handles its
 *  own), so the chat can stop following the bottom — otherwise a streaming
 *  reply would pull the view straight back down. */
export function registerChatScroller(fn: ChatScrollerFn | null, onJump?: () => void): void {
  _scroller = fn
  _onJump = fn ? onJump ?? null : null
}

/**
 * Scroll the chat virtualizer to the message with the given ID, then call
 * `onRendered` with the DOM element once it appears.
 *
 * Falls back to a direct DOM query first — if the element is already rendered
 * (visible), the callback fires synchronously without involving the virtualizer.
 */
export function scrollChatToMessage(messageId: string, onRendered: OnRendered): void {
  // Fast path: element already in DOM (message is in the visible viewport)
  const existing = document.querySelector(`[data-message-id="${messageId}"]`)
  if (existing) {
    _onJump?.()
    onRendered(existing)
    return
  }

  // Delegate to the registered virtualizer scroller
  if (_scroller) {
    _scroller(messageId, onRendered)
    return
  }

  // No scroller registered (non-chat page) — nothing to do
}
