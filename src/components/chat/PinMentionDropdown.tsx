"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownTwoIcon, ArrowUpTwoIcon } from "@strange-huge/icons";
import type { Pin } from "@/lib/api/pins";
import { PinInsert } from "@/components/PinInsert";
import type { PinTag } from "@/components/PinInsert";
import { Badge, type BadgeColor } from "@/components/Badge";

// ── Shortcut chip for keyboard navigation hints ────────────────────────────────

function ShortcutChip({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 20,
        padding: 2,
        borderRadius: 4,
        background:
          "linear-gradient(180deg, var(--neutral-white) 0%, var(--neutral-50) 100%)",
        boxShadow:
          "0px 1px 1.5px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-300-40)",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

// ── Badge color rotation for tag chips ────────────────────────────────────────

const BADGE_COLORS: BadgeColor[] = [
  "Blue",
  "Green",
  "Yellow",
  "Purple",
  "Brown",
  "Red",
  "Neutral",
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
  /** Filtered pin list - computed and passed in by the parent. */
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
          initial={{ opacity: 0, scaleY: 0.95, y: 4 }}
          animate={{ opacity: 1, scaleY: 1, y: 0 }}
          exit={{ opacity: 0, scaleY: 0.95, y: 4 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 60,
            maxHeight: "400px",
            backgroundColor: "var(--neutral-white)",
            borderRadius: "12px",
            boxShadow:
              "0 8px 24px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--neutral-100)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            transformOrigin: "bottom center",
          }}
        >
          {/* Header - matches KDS design exactly (Figma 3208:33092) */}
          <div
            style={{
              padding: "8px 16px",
              borderBottom: "1px solid var(--neutral-100)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Left: "Your pins" / "Search results" + count badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--font-weight-medium)",
                  fontSize: "var(--font-size-caption)",
                  lineHeight: "var(--line-height-caption)",
                  color: "var(--neutral-500)",
                  whiteSpace: "nowrap",
                }}
              >
                {query ? "Search results" : "Your pins"}
              </span>
              <Badge
                label={`${pins.length} ${pins.length === 1 ? "pin" : "pins"}`}
                color="Blue"
              />
            </div>

            {/* Right: "Navigate" + arrow key hints */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--font-weight-medium)",
                  fontSize: "var(--font-size-caption)",
                  lineHeight: "var(--line-height-caption)",
                  color: "var(--neutral-500)",
                  whiteSpace: "nowrap",
                }}
              >
                Navigate
              </span>
              <ShortcutChip>
                <ArrowDownTwoIcon
                  size={16}
                  color="var(--color-text-default)"
                />
              </ShortcutChip>
              <ShortcutChip>
                <ArrowUpTwoIcon size={16} color="var(--color-text-default)" />
              </ShortcutChip>
            </div>
          </div>

          {/* Scrollable pin list */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Pins"
            className="kaya-scrollbar"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              minHeight: 0, // Ensure flex child respects overflow
            }}
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
                  : "No pins yet - create one from a message."}
              </div>
            ) : (
              pins.map((pin, idx) => {
                // Always show tags if available, otherwise fall back to category for stable height
                const tags = (pin.tags && pin.tags.length > 0)
                  ? pin.tags
                  : (pin.category ? [pin.category] : []);

                return (
                  <div
                    key={pin.id}
                    data-pin-index={idx}
                    onMouseEnter={() => onHighlight(idx)}
                  >
                    <PinInsert
                      title={pin.title}
                      type="with-badges"
                      tags={mapTags(tags)}
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
