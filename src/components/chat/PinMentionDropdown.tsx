"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign } from "lucide-react";
import type { Pin } from "@/lib/api/pins";
import { usePinOperations } from "@/hooks/use-pin-operations";

const PIN_COLORS: Record<string, string> = {
  blue: "var(--blue-100)",
  red: "var(--red-100)",
  green: "var(--green-100)",
  yellow: "var(--yellow-100)",
  purple: "var(--purple-100)",
  default: "var(--neutral-100)",
};

function getPinColor(color?: string): string {
  if (!color) return PIN_COLORS.default;
  return PIN_COLORS[color.toLowerCase()] ?? PIN_COLORS.default;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          backgroundColor: "var(--yellow-100)",
          borderRadius: "2px",
          padding: "0 1px",
        }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface PinMentionDropdownProps {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  onSelect: (pin: Pin) => void;
  onClose: () => void;
}

export function PinMentionDropdown({
  isOpen,
  query,
  position,
  onSelect,
  onClose,
}: PinMentionDropdownProps) {
  const { pins, isLoading, searchPins } = usePinOperations();
  const [filteredPins, setFilteredPins] = useState<Pin[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (query) {
      searchPins(query).then(setFilteredPins);
    } else {
      setFilteredPins(pins.slice(0, 10));
    }
    setSelectedIndex(0);
  }, [query, isOpen, pins]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) =>
          i < filteredPins.length - 1 ? i + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) =>
          i > 0 ? i - 1 : filteredPins.length - 1,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredPins[selectedIndex]) {
          onSelect(filteredPins[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredPins, selectedIndex, onSelect, onClose]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(
      `[data-pin-index="${selectedIndex}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          role="listbox"
          aria-label="Pin mentions"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            zIndex: 60,
            width: "320px",
            maxHeight: "240px",
            backgroundColor: "var(--neutral-white)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--neutral-200)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--neutral-100)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <AtSign size={14} style={{ color: "var(--neutral-500)" }} />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                fontWeight: "var(--font-weight-medium)",
                color: "var(--neutral-600)",
              }}
            >
              Mention a Pin
            </span>
          </div>

          {/* List */}
          <div
            ref={listRef}
            className="kaya-scrollbar"
            style={{ flex: 1, overflowY: "auto", padding: "4px" }}
          >
            {isLoading && (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--neutral-500)",
                }}
              >
                Loading pins…
              </div>
            )}

            {!isLoading && filteredPins.length === 0 && (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--neutral-500)",
                }}
              >
                {query
                  ? `No pins matching "@${query}"`
                  : "No pins yet"}
              </div>
            )}

            {filteredPins.map((pin, idx) => (
              <button
                key={pin.id}
                type="button"
                role="option"
                aria-selected={idx === selectedIndex}
                data-pin-index={idx}
                onClick={() => onSelect(pin)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor:
                    idx === selectedIndex
                      ? "var(--neutral-100)"
                      : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background-color 100ms",
                }}
              >
                {/* Color dot */}
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: getPinColor(pin.color),
                    border: "1px solid var(--neutral-300)",
                    flexShrink: 0,
                  }}
                />

                {/* Title */}
                <span
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-body)",
                    fontSize: "13px",
                    color: "var(--neutral-800)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {highlightMatch(pin.title, query)}
                </span>

                {/* Folder */}
                {pin.folder_name && (
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      color: "var(--neutral-400)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pin.folder_name}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
