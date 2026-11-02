"use client";

import React from "react";
import type { ChipsScroll } from "./use-chips-scroll";

interface ChipsRowProps {
  chips: React.ReactNode;
  scroll: ChipsScroll;
}

/**
 * Feature/setting chips beside the `+` button: one horizontally scrolling
 * row, with a slim custom scroll indicator once it overflows.
 */
export function ChipsRow({ chips, scroll }: ChipsRowProps) {
  const {
    chipsScrollRef,
    isThumbDragging,
    isChipsOverflowing,
    thumbWidthPct,
    thumbOffsetPct,
    handleThumbMouseDown,
    handleTrackMouseDown,
  } = scroll;

  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 1, minWidth: 0, gap: "3px" }}>
      <div
        ref={chipsScrollRef}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          overflowX: "auto",
          scrollbarWidth: "none",
          flexShrink: 1,
          minWidth: 0,
          paddingTop: "3px",
          paddingBottom: "3px",
          paddingLeft: "3px",
          paddingRight: "3px",
        }}
      >
        {chips}
      </div>
      {isChipsOverflowing && (
        // Padded hit zone so the 2 px visual track is easy to grab
        <div
          style={{
            paddingTop: "4px",
            paddingBottom: "4px",
            marginLeft: "3px",
            marginRight: "3px",
            userSelect: "none",
          }}
        >
          <div
            style={{
              height: 2,
              borderRadius: 999,
              backgroundColor: "var(--neutral-800-05)",
              position: "relative",
              cursor: isThumbDragging ? "grabbing" : "pointer",
            }}
            onMouseDown={handleTrackMouseDown}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                height: "100%",
                borderRadius: 999,
                backgroundColor: "var(--neutral-800-30)",
                width: `${thumbWidthPct}%`,
                left: `${thumbOffsetPct}%`,
                transition: isThumbDragging ? "none" : "left 60ms",
                cursor: isThumbDragging ? "grabbing" : "grab",
              }}
              onMouseDown={handleThumbMouseDown}
            />
          </div>
        </div>
      )}
    </div>
  );
}
