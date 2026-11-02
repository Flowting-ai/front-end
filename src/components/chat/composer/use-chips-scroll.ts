import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll state of the horizontally scrolling chips row, plus the drag / click
 * handlers of its custom scroll indicator (the native scrollbar is hidden).
 */
export function useChipsScroll(chips: ReactNode) {
  const chipsScrollRef = useRef<HTMLDivElement>(null);
  const [chipsScroll, setChipsScroll] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
  const [isThumbDragging, setIsThumbDragging] = useState(false);

  const isDraggingRef        = useRef(false);
  const dragStartXRef        = useRef(0);
  const dragStartScrollLeft  = useRef(0);

  // Track chips scroll position + overflow so the indicator stays in sync.
  useEffect(() => {
    const el = chipsScrollRef.current;
    if (!el) return;
    const measure = () => setChipsScroll({
      scrollLeft: el.scrollLeft,
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
  }, [chips]);

  // Global mouse handlers for thumb drag — attached once, use only refs.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !chipsScrollRef.current) return;
      const el = chipsScrollRef.current;
      const thumbPx     = (el.clientWidth / el.scrollWidth) * el.clientWidth;
      const maxThumbMove = el.clientWidth - thumbPx;
      if (maxThumbMove <= 0) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const dx = e.clientX - dragStartXRef.current;
      el.scrollLeft = Math.max(0, Math.min(
        dragStartScrollLeft.current + (dx / maxThumbMove) * maxScroll,
        maxScroll,
      ));
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsThumbDragging(false);
      document.body.style.cursor = "";
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
    isDraggingRef.current        = true;
    dragStartXRef.current        = e.clientX;
    dragStartScrollLeft.current  = chipsScrollRef.current?.scrollLeft ?? 0;
    setIsThumbDragging(true);
    document.body.style.cursor     = "grabbing";
    document.body.style.userSelect = "none";
  };

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = chipsScrollRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    el.scrollLeft = Math.max(0, Math.min(ratio * (el.scrollWidth - el.clientWidth), el.scrollWidth - el.clientWidth));
  };

  const isChipsOverflowing = chipsScroll.scrollWidth > chipsScroll.clientWidth;
  const thumbWidthPct = chipsScroll.clientWidth > 0
    ? (chipsScroll.clientWidth / chipsScroll.scrollWidth) * 100
    : 100;
  const maxScrollLeft = chipsScroll.scrollWidth - chipsScroll.clientWidth;
  const thumbOffsetPct = maxScrollLeft > 0
    ? (chipsScroll.scrollLeft / maxScrollLeft) * (100 - thumbWidthPct)
    : 0;

  return {
    chipsScrollRef,
    isThumbDragging,
    isChipsOverflowing,
    thumbWidthPct,
    thumbOffsetPct,
    handleThumbMouseDown,
    handleTrackMouseDown,
  };
}

export type ChipsScroll = ReturnType<typeof useChipsScroll>;
