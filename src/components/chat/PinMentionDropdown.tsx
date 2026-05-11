"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Pin } from "@/lib/api/pins";
import { PinInsert } from "@/components/PinInsert";
import type { PinTag } from "@/components/PinInsert";
import type { BadgeColor } from "@/components/Badge";

// ── Badge color rotation for tag chips ────────────────────────────────────────

const BADGE_COLORS: BadgeColor[] = [
  "Blue", "Green", "Yellow", "Purple", "Brown", "Red", "Neutral",
];

function mapTags(tags: string[]): PinTag[] {
  return tags.map((label, i) => ({
    label,
    color: BADGE_COLORS[i % BADGE_COLORS.length],
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface PinMentionDropdownProps {
  isOpen: boolean;
  /** Filtered pin list — computed and passed in by the parent. */
  pins: Pin[];
  /** Current search query (text typed after `@`). */
  query: string;
  /** Index of the keyboard-highlighted item. */
  highlightedIndex: number;
  /** Called when the mouse enters an item row (syncs keyboard selection). */
  onHighlight: (index: number) => void;
  /** Called when the user clicks or keyboard-confirms a pin. */
  onSelect: (pin: Pin) => void;
}

export function PinMentionDropdown({
  isOpen,
  pins,
  query,
  highlightedIndex,
  onHighlight,
  onSelect,
}: PinMentionDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll the keyboard-highlighted row into view.
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(
      `[data-pin-index="${highlightedIndex}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "absolute",
            bottom: "calc(100% + 12px)",
            left: 0,
            right: 0,
            zIndex: 60,
            maxHeight: "320px",
            backgroundColor: "var(--neutral-white, #fff)",
            borderRadius: "16px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
            border: "1px solid var(--neutral-200, #E5E5E5)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "8px 16px",
              borderBottom: "1px solid var(--neutral-100, #F5F5F5)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--font-size-caption)",
                fontWeight: "var(--font-weight-medium)",
                color: "var(--neutral-500)",
              }}
            >
              {query ? `Searching: "${query}"` : "Select a pin to mention"}
            </span>
          </div>

          {/* Scrollable pin list — role="listbox" owns the option set */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Pin mentions"
            className="kaya-scrollbar"
            style={{ flex: 1, overflowY: "auto", padding: "4px" }}
          >
            {pins.length === 0 ? (
              <div
                style={{
                  padding: "24px 16px",
                  textAlign: "center",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--font-size-body)",
                  color: "var(--neutral-500)",
                }}
              >
                {query
                  ? `No pins matching "${query}"`
                  : "No pins yet — create one from a message."}
              </div>
            ) : (
              pins.map((pin, idx) => {
                const hasTags = pin.tags && pin.tags.length > 0;
                const subtitle =
                  pin.content.length > 80
                    ? pin.content.slice(0, 80) + "…"
                    : pin.content;

                return (
                  // Wrapper carries data-pin-index for the scrollIntoView query
                  // and routes mouse-enter back to the parent's index tracker.
                  <div
                    key={pin.id}
                    data-pin-index={idx}
                    onMouseEnter={() => onHighlight(idx)}
                  >
                    <PinInsert
                      title={pin.title || subtitle}
                      type={hasTags ? "with-badges" : "with-subtitle"}
                      tags={hasTags ? mapTags(pin.tags) : []}
                      subtitle={!hasTags ? subtitle : undefined}
                      highlight={!!query}
                      searchQuery={query}
                      isFocused={idx === highlightedIndex}
                      onAdd={() => onSelect(pin)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
