"use client";

import React, { useEffect, useRef, useState } from "react";

interface PinChipStripProps {
  children: React.ReactNode;
}

/**
 * Single-row horizontal scroll strip for @-mention pin chips.
 * Mirrors the overflow scroll indicator and drag-to-scroll behaviour
 * used by the chips row in ChatInput.
 */
export function PinChipStrip({ children }: PinChipStripProps) {
  const scrollRef       = useRef<HTMLDivElement>(null);
  const isDraggingRef   = useRef(false);
  const dragStartXRef   = useRef(0);
  const dragStartScroll = useRef(0);

  const [scroll,     setScroll]     = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Measure scroll metrics whenever children change or the strip is resized.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setScroll({
      scrollLeft:  el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [children]);

  // Global mouse handlers — only refs used so no deps needed.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !scrollRef.current) return;
      const el        = scrollRef.current;
      const thumbPx   = (el.clientWidth / el.scrollWidth) * el.clientWidth;
      const maxThumb  = el.clientWidth - thumbPx;
      if (maxThumb <= 0) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const dx        = e.clientX - dragStartXRef.current;
      el.scrollLeft   = Math.max(0, Math.min(
        dragStartScroll.current + (dx / maxThumb) * maxScroll,
        maxScroll,
      ));
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current          = false;
      setIsDragging(false);
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, []);

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current          = true;
    dragStartXRef.current          = e.clientX;
    dragStartScroll.current        = scrollRef.current?.scrollLeft ?? 0;
    setIsDragging(true);
    document.body.style.cursor     = "grabbing";
    document.body.style.userSelect = "none";
  };

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    el.scrollLeft = Math.max(0, Math.min(
      ratio * (el.scrollWidth - el.clientWidth),
      el.scrollWidth - el.clientWidth,
    ));
  };

  const isOverflowing  = scroll.scrollWidth > scroll.clientWidth;
  const thumbWidthPct  = scroll.clientWidth > 0
    ? (scroll.clientWidth / scroll.scrollWidth) * 100
    : 100;
  const maxScrollLeft  = scroll.scrollWidth - scroll.clientWidth;
  const thumbOffsetPct = maxScrollLeft > 0
    ? (scroll.scrollLeft / maxScrollLeft) * (100 - thumbWidthPct)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      {/* Single-row scrollable strip */}
      <div
        ref={scrollRef}
        style={{
          display:       "flex",
          flexWrap:      "nowrap",
          gap:           "4px",
          overflowX:     "auto",
          scrollbarWidth: "none",
          paddingTop:    "3px",
          paddingBottom: "3px",
          paddingLeft:   "3px",
          paddingRight:  "3px",
        }}
      >
        {children}
      </div>

      {/* Dynamic scroll indicator — only visible when content overflows */}
      {isOverflowing && (
        <div
          style={{
            paddingTop:    "4px",
            paddingBottom: "4px",
            marginLeft:    "3px",
            marginRight:   "3px",
            userSelect:    "none",
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            style={{
              height:          2,
              borderRadius:    999,
              backgroundColor: "rgba(59,54,50,0.06)",
              position:        "relative",
              cursor:          isDragging ? "grabbing" : "pointer",
            }}
            onMouseDown={handleTrackMouseDown}
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
              style={{
                position:        "absolute",
                top:             0,
                height:          "100%",
                borderRadius:    999,
                backgroundColor: "var(--neutral-800-30)",
                width:           `${thumbWidthPct}%`,
                left:            `${thumbOffsetPct}%`,
                transition:      isDragging ? "none" : "left 60ms",
                cursor:          isDragging ? "grabbing" : "grab",
              }}
              onMouseDown={handleThumbMouseDown}
            />
          </div>
        </div>
      )}
    </div>
  );
}
