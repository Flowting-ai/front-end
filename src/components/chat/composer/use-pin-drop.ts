import { useState } from "react";
import type React from "react";
import { PIN_DRAG_MIME_TYPE, type PinDragPayload } from "@/lib/pin-drag";
import { PINS_ENABLED } from "@/lib/feature-flags";

/**
 * Dropping a pin card from the Pinboard on the chat box. Fires the same
 * `pin:insert` CustomEvent its own "Insert" button dispatches (see
 * RightSidebar.tsx's toPinboardPin) — ChatInterface.tsx's existing listener
 * does the actual work (dedupe + add as an @-mention chip), so there's
 * nothing to wire here.
 */
export function usePinDrop() {
  const [isPinDragOver, setIsPinDragOver] = useState(false);

  const handlePinDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!PINS_ENABLED || !e.dataTransfer.types.includes(PIN_DRAG_MIME_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsPinDragOver(true);
  };

  const handlePinDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsPinDragOver(false);
  };

  const handlePinDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!PINS_ENABLED) return;
    const raw = e.dataTransfer.getData(PIN_DRAG_MIME_TYPE);
    if (!raw) return;
    e.preventDefault();
    setIsPinDragOver(false);
    try {
      const pin = JSON.parse(raw) as PinDragPayload;
      if (!pin?.id) return;
      window.dispatchEvent(new CustomEvent("pin:insert", { detail: pin }));
    } catch {
      // Malformed payload — ignore rather than throw on drop.
    }
  };

  return { isPinDragOver, handlePinDragOver, handlePinDragLeave, handlePinDrop };
}
