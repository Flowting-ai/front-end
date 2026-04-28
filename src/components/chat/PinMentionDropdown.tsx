"use client";

import { cn } from "@/lib/utils";
import { stripMarkdown, renderInlineMarkdown, formatPinTitle } from "@/lib/markdown-utils";
import type { PinType } from "@/components/layout/right-sidebar";

// ─── Color palette ────────────────────────────────────────────────────────────

const LIGHT_COLOR_PALETTE = [
  "#C7E0F4", // Soft Sky Blue
  "#BEE7E8", // Muted Aqua
  "#BFDCE5", // Calm Teal
  "#C9DDF2", // Dusty Blue
  "#CFE6D8", // Muted Mint
  "#D6E8C3", // Soft Olive
  "#C4E1C1", // Gentle Green
  "#E1C7E8", // Dusty Lavender
  "#EBC2D9", // Muted Blush
  "#D8C6F0", // Soft Periwinkle
  "#F3E6B3", // Warm Butter
  "#F6DDBA", // Soft Apricot
  "#EFD1B8", // Muted Peach
  "#E1E5EA", // Cool Gray Mist
  "#E8DED6", // Warm Stone
  "#DDE3E8", // Soft Slate
  "#A9D1F0", // Soft Ocean Blue
];

/**
 * Returns a consistent accent color for a pin based on its ID.
 * The same pin ID always maps to the same color across the entire UI.
 */
export function getPinSeparatorColor(pinId: string): string {
  let hash = 0;
  for (let i = 0; i < pinId.length; i++) {
    hash = pinId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % LIGHT_COLOR_PALETTE.length;
  return LIGHT_COLOR_PALETTE[index];
}

/**
 * Wraps the matched substring in a yellow highlight span.
 * Returns the plain string unchanged when there is no match.
 */
export function highlightMatch(
  text: string,
  query: string,
): React.ReactNode {
  if (!query.trim()) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  return (
    <>
      {before}
      <span className="bg-yellow-100 font-medium">{match}</span>
      {after}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PinMentionDropdownProps {
  /** Whether the dropdown is currently visible. */
  show: boolean;
  /** Filtered list of pins matching the current search query. */
  filteredPins: PinType[];
  /** Text typed after the `@` trigger character. */
  pinSearchQuery: string;
  /** Index of the keyboard-highlighted item (-1 = none). */
  highlightedPinIndex: number;
  setHighlightedPinIndex: (idx: number) => void;
  /** Called when the user clicks or keyboard-selects a pin. */
  onSelectPin: (pin: PinType) => void;
  /** Ref for the dropdown wrapper — used by click-outside detection in useChatState. */
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  /** Ref for the scrollable list inside — used for keyboard-nav auto-scroll in useChatState. */
  pinDropdownScrollRef: React.RefObject<HTMLDivElement | null>;
  /** Map of item index → button element for keyboard-nav focus management. */
  pinItemRefs: React.MutableRefObject<Map<number, HTMLButtonElement>>;
  /** CSS Module class applied to the scrollable list for custom scrollbar styling. */
  customScrollbarClass: string;
}

export function PinMentionDropdown({
  show,
  filteredPins,
  pinSearchQuery,
  highlightedPinIndex,
  setHighlightedPinIndex,
  onSelectPin,
  dropdownRef,
  pinDropdownScrollRef,
  pinItemRefs,
  customScrollbarClass,
}: PinMentionDropdownProps) {
  if (!show) return null;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "absolute bottom-full left-0 right-0 z-50 mb-3 max-h-93 rounded-2xl border border-[#D9D9D9] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)] px-2 py-2",
      )}
      style={{ maxWidth: 700, minWidth: 220, left: 0, right: "auto" }}
    >
      {filteredPins.length > 0 ? (
        <>
          <div className="font-geist font-medium text-left text-sm text-[#888888] px-4 py-2">
            {pinSearchQuery
              ? `Searching: "${pinSearchQuery}"`
              : "Select a pin to mention"}
          </div>
          <div
            ref={pinDropdownScrollRef}
            className={cn(
              "max-h-76 overflow-y-auto flex flex-col",
              customScrollbarClass,
            )}
          >
            {filteredPins.map((pin, idx) => {
              const isHighlighted = idx === highlightedPinIndex;
              const pinText = stripMarkdown(pin.text);
              const displayText =
                pinText.length > 80 ? pinText.slice(0, 80) + "..." : pinText;

              return (
                <button
                  key={pin.id}
                  ref={(el) => {
                    if (el) {
                      pinItemRefs.current.set(idx, el);
                    } else {
                      pinItemRefs.current.delete(idx);
                    }
                  }}
                  type="button"
                  onClick={() => onSelectPin(pin)}
                  onMouseEnter={() => setHighlightedPinIndex(idx)}
                  className={
                    `cursor-pointer w-full border-b border-[#F5F5F5] px-4 py-2 text-left text-[13px] rounded-[16px] transition-colors ` +
                    (isHighlighted
                      ? "hover:bg-[#d2d2d2] text-black bg-zinc-300"
                      : "hover:bg-[#d2d2d2] text-black")
                  }
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-1 h-full min-h-10 rounded-full"
                      style={{ backgroundColor: getPinSeparatorColor(pin.id) }}
                    />
                    <div className="flex flex-col">
                      <p className="truncate font-medium text-inherit text-black text-[13px]">
                        {pinSearchQuery
                          ? highlightMatch(displayText, pinSearchQuery)
                          : renderInlineMarkdown(
                              formatPinTitle(displayText || "Untitled Pin"),
                            )}
                      </p>
                      {pin.tags && pin.tags.length > 0 && (
                        <div className="mt-1 flex gap-1">
                          {pin.tags.slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] text-[#767676]"
                            >
                              {pinSearchQuery
                                ? highlightMatch(tag, pinSearchQuery)
                                : tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="px-4 py-8 text-center text-[#888888]">
          <div className="mb-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              className="mx-auto opacity-40"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 8v4M12 16h.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="text-sm font-medium">
            {pinSearchQuery
              ? "No pinned messages match your search."
              : "No pinned messages available."}
          </div>
          {pinSearchQuery && (
            <div className="text-xs mt-1">Try a different search term.</div>
          )}
        </div>
      )}
    </div>
  );
}
