"use client"

import { useState, useEffect, useMemo, useCallback, useRef, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import { usePinboard, type PinItem } from "@/context/pinboard-context"
import type { PinMentionable } from "@/components/chat/PinMentionDropdown"

interface MentionedPin {
  id: string;
  label: string;
}

/**
 * @-mention / pin-attachment state for the chat composer: the dropdown, the
 * chips strip, and the window-level "pin:insert" listener the Pinboard
 * sidebar/expanded modal dispatch when the user clicks "Insert" on a pin.
 *
 * Takes the composer's `setInputValue` because selecting a pin also strips
 * the typed `@query` fragment back out of the input text.
 *
 * `pinInsertListenerEnabled` (default true) gates the window "pin:insert"
 * listener only — pass `false` when another mounted composer (e.g. an
 * AnimatePresence sibling mid-crossfade) is the one that should handle it,
 * so the same event isn't double-applied while both are briefly mounted.
 */
export function usePinMentions(
  setInputValue: Dispatch<SetStateAction<string>>,
  pinInsertListenerEnabled = true,
) {
  const { pins } = usePinboard();

  const [showPinDropdown, setShowPinDropdown] = useState(false);
  const [pinQuery, setPinQuery] = useState("");
  const [highlightedPinIndex, setHighlightedPinIndex] = useState(0);
  const [mentionedPins, setMentionedPins] = useState<MentionedPin[]>([]);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  // Listen for pin:insert events dispatched by the Pinboard sidebar / expanded
  // modal's "Insert" button. Adds the pin as a real @-mention chip — the same
  // outcome as picking it from the PinMentionDropdown — rather than splicing
  // its raw content into the input text.
  useEffect(() => {
    if (!pinInsertListenerEnabled) return;
    const handler = (e: Event) => {
      const pin = (e as CustomEvent<PinMentionable>).detail;
      if (!pin?.id) return;
      const label = (pin.title || pin.content).slice(0, 50) || pin.id;
      if (mentionedPins.some((m) => m.id === pin.id)) {
        toast.info(`"${label}" is already added to this chat`);
        return;
      }
      setMentionedPins((prev) => [...prev, { id: pin.id, label }]);
      toast.success(`"${label}" added to chat`);
    };
    window.addEventListener("pin:insert", handler);
    return () => window.removeEventListener("pin:insert", handler);
  }, [mentionedPins, pinInsertListenerEnabled]);

  const filteredPins = useMemo<PinItem[]>(() => {
    if (!pinQuery.trim()) return pins.slice(0, 10);
    const q = pinQuery.toLowerCase();
    return pins.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [pins, pinQuery]);

  // Reset highlighted index whenever the filtered list changes.
  useEffect(() => {
    setHighlightedPinIndex(0);
  }, [filteredPins]);

  // Close the dropdown when the user clicks outside the input wrapper.
  useEffect(() => {
    if (!showPinDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputWrapperRef.current &&
        !inputWrapperRef.current.contains(e.target as Node)
      ) {
        setShowPinDropdown(false);
        setPinQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPinDropdown]);

  const handleMentionChange = useCallback((query: string | null) => {
    if (query === null) {
      setShowPinDropdown(false);
      setPinQuery("");
    } else {
      setShowPinDropdown(true);
      setPinQuery(query);
    }
  }, []);

  const handlePinSelect = useCallback((pin: PinMentionable) => {
    const label = (pin.title || pin.content).slice(0, 50) || pin.id;
    // Strip the `@query` fragment that the user typed from the input value.
    setInputValue((prev) => {
      const lastAt = prev.lastIndexOf("@");
      return lastAt !== -1 ? prev.substring(0, lastAt) : prev;
    });
    setMentionedPins((prev) =>
      prev.some((m) => m.id === pin.id)
        ? prev
        : [...prev, { id: pin.id, label }],
    );
    setShowPinDropdown(false);
    setPinQuery("");
  }, [setInputValue]);

  const handleRemoveMention = useCallback((pinId: string) => {
    setMentionedPins((prev) => prev.filter((m) => m.id !== pinId));
  }, []);

  const handlePinNavigate = useCallback(
    (action: "up" | "down" | "select" | "close") => {
      switch (action) {
        case "down":
          setHighlightedPinIndex((i) =>
            i < filteredPins.length - 1 ? i + 1 : 0,
          );
          break;
        case "up":
          setHighlightedPinIndex((i) =>
            i > 0 ? i - 1 : filteredPins.length - 1,
          );
          break;
        case "select":
          if (filteredPins[highlightedPinIndex]) {
            handlePinSelect(filteredPins[highlightedPinIndex]);
          }
          break;
        case "close":
          setShowPinDropdown(false);
          setPinQuery("");
          break;
      }
    },
    [filteredPins, highlightedPinIndex, handlePinSelect],
  );

  const clearMentions = useCallback(() => setMentionedPins([]), []);

  return {
    mentionedPins,
    filteredPins,
    showPinDropdown,
    pinQuery,
    highlightedPinIndex,
    setHighlightedPinIndex,
    inputWrapperRef,
    handleMentionChange,
    handlePinSelect,
    handleRemoveMention,
    handlePinNavigate,
    clearMentions,
  };
}
