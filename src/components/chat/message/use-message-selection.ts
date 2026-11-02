"use client";

import { useState, useEffect, useMemo, type RefObject } from "react";
import { toast } from "sonner";
import { applyRenderedHighlights, clearRenderedHighlights, getRenderedSelectionRange } from "@/lib/rendered-highlights";
import { HIGHLIGHTS_ENABLED } from "@/lib/feature-flags";
import { trackBrowserEvent } from "@/lib/analytics/events";
import type { useHighlight } from "@/context/highlight-context";

type HighlightApi = ReturnType<typeof useHighlight>;

/**
 * Text selection on an assistant answer: opens the SelectionPopover (and keeps
 * it on the selection while the list scrolls), applies saved highlight marks
 * to the rendered text, and handles the popover's Highlight / Copy actions.
 * The three effects run in this order, after the caller's own effects above
 * the call.
 */
export function useMessageSelection({
  messageId,
  chatId,
  isAssistant,
  disableHighlight,
  contentRef,
  highlights,
  addHighlight,
  openHighlightPanel,
  closePinboard,
}: {
  messageId: string;
  chatId?: string;
  isAssistant: boolean;
  disableHighlight: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  highlights: HighlightApi["highlights"];
  addHighlight: HighlightApi["addHighlight"];
  openHighlightPanel: () => void;
  closePinboard: () => void;
}) {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<DOMRect | null>(null);

  const messageHighlights = useMemo(
    () => highlights
      // Include highlights that belong to this message, OR highlights whose
      // messageId is missing/null (e.g. created before the API sent message_id).
      // For the latter case the rehype plugin's text-search naturally limits
      // the mark to whichever message actually contains the selected text.
      .flatMap(h => (h.messageId === messageId || !h.messageId)
        ? [{ id: h.id, text: h.text, colorIndex: h.colorIndex, startOffset: h.startOffset, endOffset: h.endOffset }]
        : []),
    [highlights, messageId],
  )

  // ── Text selection → SelectionPopover (assistant messages only) ──────────
  useEffect(() => {
    if (!isAssistant || disableHighlight) return

    // Mouse-driven selections are finalized on `mouseup` — opening on every
    // intermediate `selectionchange` while the mouse is still dragging would
    // make the popover jump around mid-drag. Keyboard selections (Shift+Arrow,
    // Shift+Home, etc.) have no equivalent "selection finished" event — each
    // key press IS a discrete, complete selection change — so those are
    // opened directly from `selectionchange` instead, gated on the mouse not
    // currently being held down.
    let mouseIsDown = false

    const showSelectionPopover = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      if (!contentRef.current?.contains(range.commonAncestorContainer)) return
      const rect = range.getBoundingClientRect()
      if (!rect.width) return
      setSelectionAnchor(rect)
      setSelectionOpen(true)
    }

    const handleMouseDown = () => { mouseIsDown = true }

    const handleMouseUp = () => {
      mouseIsDown = false
      requestAnimationFrame(showSelectionPopover)
    }

    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        setSelectionOpen(false)
        setSelectionAnchor(null)
        return
      }
      if (!mouseIsDown) requestAnimationFrame(showSelectionPopover)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [disableHighlight, isAssistant, contentRef])

  // Keep the popover anchored to the live selection while the message list
  // scrolls. `selectionAnchor` is a viewport-relative DOMRect captured once
  // at selection time and applied as the popover's `position: fixed`
  // coordinates (see SelectionPopover) — without this, scrolling moves the
  // selected text to a new position on screen but the popover's coordinates
  // never get told, so it stays frozen where it first appeared instead of
  // following the text. `scroll` events don't bubble, but a capture-phase
  // listener on `document` still observes them fire on any scrollable
  // descendant (the message list's own scroll container), so this works
  // without needing a ref to that container from this per-message component.
  useEffect(() => {
    if (!selectionOpen) return
    let rafId: number | null = null
    const reposition = () => {
      rafId = null
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelectionOpen(false)
        setSelectionAnchor(null)
        return
      }
      const range = sel.getRangeAt(0)
      if (!contentRef.current?.contains(range.commonAncestorContainer)) {
        setSelectionOpen(false)
        setSelectionAnchor(null)
        return
      }
      const rect = range.getBoundingClientRect()
      if (rect.width) setSelectionAnchor(rect)
    }
    // rAF-throttled so a fast scroll doesn't fire a flurry of setState +
    // floating-ui recomputations, one per raw scroll event.
    const onScroll = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(reposition)
    }
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [selectionOpen, contentRef])

  useEffect(() => {
    if (!HIGHLIGHTS_ENABLED || !isAssistant || disableHighlight) return
    const root = contentRef.current
    if (!root) return

    let frame: number | null = null
    const observer = new MutationObserver(() => scheduleApply())

    const apply = () => {
      frame = null
      observer.disconnect()
      if (messageHighlights.length) {
        applyRenderedHighlights(root, messageHighlights)
      } else {
        clearRenderedHighlights(root)
      }
      observer.observe(root, { childList: true, characterData: true, subtree: true })
    }

    const scheduleApply = () => {
      if (frame != null) return
      frame = requestAnimationFrame(apply)
    }

    scheduleApply()
    observer.observe(root, { childList: true, characterData: true, subtree: true })

    return () => {
      if (frame != null) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [disableHighlight, isAssistant, messageHighlights, contentRef])

  const handleHighlight = () => {
    if (!HIGHLIGHTS_ENABLED) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    if (!contentRef.current) return

    const selectionRange = getRenderedSelectionRange(contentRef.current, sel)
    if (!selectionRange) return

    const { selectedText: text, startOffset, endOffset } = selectionRange

    addHighlight({ text, messageId, startOffset, endOffset, chatId })
    trackBrowserEvent("highlight_created", { source: "chat" })
    closePinboard()
    openHighlightPanel()
    sel.removeAllRanges()
    setSelectionOpen(false)
    setSelectionAnchor(null)
  };

  const handleCopySelection = () => {
    const sel = window.getSelection()
    const text = sel?.toString()
    if (!text) return
    navigator.clipboard.writeText(text)
      .then(() => toast.success('Copied to clipboard'))
      .catch(() => toast.error('Failed to copy'))
  };

  return { selectionOpen, selectionAnchor, handleHighlight, handleCopySelection };
}
