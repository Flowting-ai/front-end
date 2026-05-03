"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  animate,
  useIsPresent,
} from "framer-motion";
import {
  usePinboard,
  type PinItem,
  type PinCategory,
} from "@/context/pinboard-context";
import { PinMarkdownRenderer } from "@/lib/pin-markdown";

// ── Constants ─────────────────────────────────────────────────────────────────

const SHADOW_CARD =
  "0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)";
const LINE_HEIGHT_PX = 16;
const MAX_SNAP_LINES = 24;
const DRAG_THRESHOLD = 8;
const MAX_OVERSHOOT = 32;
const ELASTIC_FACTOR = 0.2;
const TOP_BAR_H = 110;

// ── Category Config (matches KDS PinCategory) ─────────────────────────────────

interface CategoryCfg {
  bg: string;
  ring: string;
  color: string;
  label: string;
}

const CATEGORY_CONFIG: Record<PinCategory, CategoryCfg> = {
  Code: {
    bg: "#e5f2c5",
    ring: "rgba(128,183,7,0.5)",
    color: "#80b707",
    label: "</>",
  },
  Research: {
    bg: "#cadcf1",
    ring: "rgba(13,110,178,0.5)",
    color: "#0d6eb2",
    label: "🧪",
  },
  Creative: {
    bg: "#ded0df",
    ring: "rgba(103,79,104,0.5)",
    color: "#674f68",
    label: "🎨",
  },
  Planning: {
    bg: "#e9dfc9",
    ring: "rgba(143,116,39,0.5)",
    color: "#8f7427",
    label: "📅",
  },
  Tasks: {
    bg: "#ffbfb6",
    ring: "rgba(159,38,35,0.5)",
    color: "#9f2623",
    label: "📝",
  },
  Quote: {
    bg: "#e6d5ca",
    ring: "rgba(126,84,53,0.5)",
    color: "#7e5435",
    label: "✍️",
  },
  Workflow: {
    bg: "#ede1d7",
    ring: "rgba(106,98,93,0.5)",
    color: "#6a625d",
    label: "⚙️",
  },
};

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon({
  size = 20,
  color = "var(--neutral-600)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CloseIcon({
  size = 20,
  color = "var(--neutral-600)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ClearCircleIcon({
  size = 16,
  color = "var(--neutral-400)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function CollapseAllIcon({
  size = 20,
  color = "var(--neutral-600)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 20 5-5 5 5" />
      <path d="m7 4 5 5 5-5" />
    </svg>
  );
}

function FilterIcon({
  size = 20,
  color = "var(--neutral-600)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function SortIcon({
  size = 20,
  color = "var(--neutral-600)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
    </svg>
  );
}

function ChevronDownIcon({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ShowInChatIcon({
  size = 20,
  color = "var(--neutral-600)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CommentIcon({
  size = 20,
  color = "var(--neutral-600)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
      <path d="M2 10h20" />
    </svg>
  );
}

function ExportIcon({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function OrganizeIcon({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MoreIcon({
  size = 20,
  color = "var(--neutral-600)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

// ── useMeasure ────────────────────────────────────────────────────────────────

function useMeasure() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const ref = useCallback((node: HTMLElement | null) => setElement(node), []);
  useLayoutEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const bb = entry.borderBoxSize?.[0];
      setBounds({
        width: bb ? bb.inlineSize : entry.contentRect.width,
        height: bb ? bb.blockSize : entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [ref, bounds] as const;
}

// ── PinCategory Badge ─────────────────────────────────────────────────────────

function PinCategoryBadge({ type }: { type: PinCategory }) {
  const cfg = CATEGORY_CONFIG[type];
  return (
    <div
      style={{
        position: "relative",
        width: 45,
        height: 45,
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0px 0px 0px 1px ${cfg.ring}`,
        flexShrink: 0,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 8,
          backgroundColor: cfg.bg,
        }}
      />
      <span
        style={{
          position: "relative",
          fontSize: type === "Code" ? 18 : 16,
          lineHeight: 0,
        }}
      >
        {cfg.label}
      </span>
    </div>
  );
}

// ── Pin Comment Field ─────────────────────────────────────────────────────────

const PinCommentField = React.forwardRef<
  HTMLTextAreaElement,
  { fluid?: boolean }
>(function PinCommentField({ fluid = false }, forwardedRef) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState("");
  const [height, setHeight] = useState(16);
  const internalRef = useRef<HTMLTextAreaElement>(null);

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      internalRef.current = el;
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef]
  );

  const shadow = isFocused
    ? "0px 1px 2px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--focus-ring, #2563eb)"
    : isHovered
      ? "0px 1px 2px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(82,75,71,0.1), 0px 0px 0px 3px rgba(247,242,237,0.6)"
      : "0px 1px 2px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(82,75,71,0.1)";

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const ta = internalRef.current;
    if (!ta) return;
    const prev = ta.style.height;
    ta.style.height = "auto";
    const sh = ta.scrollHeight;
    ta.style.height = prev;
    if (sh <= 32) {
      setHeight(sh);
      setValue(e.target.value);
    } else {
      ta.value = value; // reject overflow
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: fluid ? "100%" : 292,
        padding: 6,
        borderRadius: 6,
        background: "var(--neutral-white)",
        boxShadow: shadow,
        transition: "box-shadow 150ms ease",
      }}
    >
      <textarea
        ref={setRef}
        rows={1}
        placeholder="Type your comment here..."
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: "100%",
          height,
          minHeight: 16,
          maxHeight: 32,
          resize: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: "var(--font-body)",
          fontWeight: "var(--font-weight-medium)",
          fontSize: 11,
          lineHeight: "16px",
          color: "var(--neutral-800)",
          overflow: "hidden",
        }}
      />
    </div>
  );
});

// ── Pin Card (full drag-to-expand) ────────────────────────────────────────────

interface PinCardProps {
  pin: PinItem;
  onRemove: (id: string) => void;
  onUpdateCategory: (id: string, category: PinCategory) => void;
  collapseSignal: number;
  onExpandedChange: (open: boolean) => void;
}

function PinCard({
  pin,
  onRemove,
  onUpdateCategory,
  collapseSignal,
  onExpandedChange,
}: PinCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [extraLines, setExtraLines] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLDivElement>(null);
  const [contentRef, contentBounds] = useMeasure();
  const commentFieldRef = useRef<HTMLTextAreaElement>(null);
  const focusCommentRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef({ startY: 0, startHeight: 0 });
  const rafRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;
  const collapsingRef = useRef(false);
  const lastMoveRef = useRef({ y: 0, time: 0 });
  const skipActionBarEntry = useRef(false);

  const cardHeightMV = useMotionValue(0);
  const springCfg = {
    type: "spring" as const,
    stiffness: 380,
    damping: 28,
    mass: 0.8,
  };
  const collapseCfg = {
    type: "tween" as const,
    ease: [0, 0.64, 0.12, 0.99] as [number, number, number, number],
    duration: 0.35,
  };

  const cat = CATEGORY_CONFIG[pin.category];
  const timeAgo = getTimeAgo(pin.createdAt);

  // Animate card height when content changes
  useEffect(() => {
    if (isDraggingRef.current) return;
    if (contentBounds.height > 0) {
      const cfg = collapsingRef.current ? collapseCfg : springCfg;
      collapsingRef.current = false;
      animate(cardHeightMV, contentBounds.height, cfg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentBounds.height]);

  const isOpen = isExpanded || extraLines > 0;

  // Collapse signal from parent
  const initialSignalRef = useRef(collapseSignal);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  useEffect(() => {
    if (collapseSignal === initialSignalRef.current) return;
    if (!isOpenRef.current) return;
    collapsingRef.current = true;
    setIsExpanded(false);
    setExtraLines(0);
  }, [collapseSignal]);

  // Notify parent
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    onExpandedChange(isOpen);
  }, [isOpen, onExpandedChange]);

  // Focus comment field after expand
  useEffect(() => {
    if (isExpanded && focusCommentRef.current) {
      focusCommentRef.current = false;
      requestAnimationFrame(() => commentFieldRef.current?.focus());
    }
  }, [isExpanded]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    cardHeightMV.stop();
    const h = cardHeightMV.get();
    dragInfo.current = { startY: e.clientY, startHeight: h };
    skipActionBarEntry.current = isExpanded || isHovered;
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    setIsDragging(true);
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const clientY = e.clientY;
    lastMoveRef.current = { y: clientY, time: performance.now() };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rawDelta = clientY - dragInfo.current.startY;
      if (!isExpandedRef.current) {
        const minDelta = -extraLines * LINE_HEIGHT_PX;
        const clampedDelta = Math.max(minDelta, rawDelta);
        if (
          extraLines * LINE_HEIGHT_PX + clampedDelta >
          MAX_SNAP_LINES * LINE_HEIGHT_PX
        ) {
          isDraggingRef.current = false;
          skipActionBarEntry.current = false;
          setIsDragging(false);
          setIsExpanded(true);
          setExtraLines(0);
          return;
        }
        cardHeightMV.set(dragInfo.current.startHeight + clampedDelta);
      } else {
        if (rawDelta > 0) {
          const stretch = Math.min(
            rawDelta * ELASTIC_FACTOR,
            MAX_OVERSHOOT
          );
          cardHeightMV.set(dragInfo.current.startHeight + stretch);
        } else {
          cardHeightMV.set(
            Math.max(dragInfo.current.startHeight + rawDelta, 60)
          );
        }
      }
    });
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    cancelAnimationFrame(rafRef.current);
    const rawDelta = e.clientY - dragInfo.current.startY;
    isDraggingRef.current = false;
    skipActionBarEntry.current = false;
    setIsDragging(false);

    if (!isExpandedRef.current) {
      const minDelta = -extraLines * LINE_HEIGHT_PX;
      const clampedDelta = Math.max(minDelta, rawDelta);
      const snappedDelta =
        Math.round(clampedDelta / LINE_HEIGHT_PX) * LINE_HEIGHT_PX;
      const newExtra = Math.max(
        0,
        extraLines + snappedDelta / LINE_HEIGHT_PX
      );
      if (newExtra >= MAX_SNAP_LINES) {
        setIsExpanded(true);
        setExtraLines(0);
      } else {
        setExtraLines(newExtra);
      }
    } else {
      const dt = performance.now() - lastMoveRef.current.time;
      const velocity =
        dt > 0 ? (e.clientY - lastMoveRef.current.y) / dt : 0;
      const shouldCollapse =
        -rawDelta > DRAG_THRESHOLD || velocity < -0.3;
      if (shouldCollapse) {
        collapsingRef.current = true;
        setIsExpanded(false);
        setExtraLines(0);
      } else if (rawDelta > 0) {
        animate(cardHeightMV, dragInfo.current.startHeight, {
          type: "tween",
          ease: [0, 0.64, 0.12, 0.99],
          duration: 0.35,
        });
      }
    }
  };

  const showFull = isExpanded || isDragging;
  const handleCommentClick = () => {
    if (!isExpanded) {
      focusCommentRef.current = true;
      setIsExpanded(true);
    } else {
      commentFieldRef.current?.focus();
    }
  };

  const visibleLines = 2 + extraLines;
  const cageH =
    visibleLines * LINE_HEIGHT_PX + (extraLines > 0 ? 12 : 0);

  return (
    <motion.div
      ref={cardRef}
      style={{
        height: cardHeightMV,
        position: "relative",
        width: "100%",
        borderRadius: 16,
        backgroundColor: "var(--neutral-white)",
        boxShadow: SHADOW_CARD,
        overflow: "clip",
        isolation: "isolate",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isDraggingRef.current) setIsHovered(false);
      }}
    >
      {/* Inner content — measured by useMeasure */}
      <div
        ref={contentRef as React.Ref<HTMLDivElement>}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "flex-start",
          paddingTop: 12,
          paddingBottom: isDragging ? 64 : 16,
          paddingLeft: 12,
          paddingRight: 12,
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "flex-start",
            width: "100%",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flex: "1 0 0",
              gap: 12,
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <PinCategoryBadge type={pin.category} />
            <p
              style={{
                flex: "1 0 0",
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-medium)",
                fontSize: "var(--font-size-body)",
                lineHeight: "var(--line-height-body)",
                color: "var(--neutral-900)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                margin: 0,
                minWidth: 0,
              }}
            >
              {pin.title}
            </p>
          </div>
          <div ref={menuBtnRef} style={{ position: "relative", flexShrink: 0 }}>
            <IconBtn
              icon={<MoreIcon size={20} />}
              label="More options"
              onClick={() => setMenuOpen((v) => !v)}
            />
            {menuOpen && (
              <PinCardMenu
                pin={pin}
                anchorRef={menuBtnRef}
                onRemove={() => { onRemove(pin.id); setMenuOpen(false); }}
                onCopy={() => { navigator.clipboard.writeText(pin.content); setMenuOpen(false); }}
                onChangeCategory={(cat) => { onUpdateCategory(pin.id, cat); setMenuOpen(false); }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Labels */}
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            width: "100%",
            flexWrap: "wrap",
          }}
        >
          <PinBadge
            label={pin.category}
            color={cat.bg}
            textColor={cat.color}
          />
          {pin.modelName && (
            <PinBadge
              label={pin.modelName}
              color="var(--neutral-100)"
              textColor="var(--neutral-600)"
            />
          )}
        </div>

        {/* Description — rendered as formatted markdown */}
        <div
          style={{
            height: showFull ? "auto" : `${cageH}px`,
            minHeight: showFull ? undefined : `${cageH}px`,
            maxHeight: showFull ? undefined : `${cageH}px`,
            overflow: showFull ? "visible" : "hidden",
            width: "100%",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <PinMarkdownRenderer content={pin.content} />
          {/* Fade overlay when collapsed to indicate more content */}
          {!showFull && extraLines === 0 && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 14,
                background:
                  "linear-gradient(to bottom, transparent, var(--neutral-white))",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {/* Expanded content — metadata + comment */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="expanded-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.15 } }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              style={{
                width: "100%",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {/* Expanded metadata */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <PinBadge
                  label={timeAgo}
                  color="var(--green-50, #ecfdf5)"
                  textColor="var(--green-700, #15803d)"
                />
                {pin.chatName && (
                  <p
                    style={{
                      flex: "1 0 0",
                      fontFamily: "var(--font-body)",
                      fontWeight: "var(--font-weight-semibold)",
                      fontSize: "var(--font-size-caption, 11px)",
                      lineHeight: "var(--line-height-caption, 16px)",
                      color: "#1e293b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      margin: 0,
                      minWidth: 0,
                    }}
                  >
                    {pin.chatName}
                  </p>
                )}
              </div>
              <PinCommentField ref={commentFieldRef} fluid />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline action bar — expanded state */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="action-bar-expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.12 } }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              style={{ width: "100%", flexShrink: 0 }}
            >
              <PinActionBar
                onRemove={() => onRemove(pin.id)}
                hideComment
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drag handle */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={isExpanded ? "Collapse pin" : "Expand pin"}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onDoubleClick={() => {
          if (!isExpanded) setIsExpanded(true);
        }}
        style={{
          position: "absolute",
          bottom: 4,
          left: "calc(50% - 16px)",
          width: 32,
          height: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
          touchAction: "none",
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: 32,
            height: 2,
            borderRadius: 1,
            backgroundColor: "var(--neutral-200)",
            pointerEvents: "none",
          }}
        />
      </motion.div>

      {/* Absolute action bar — collapsed/intermediate state */}
      <AnimatePresence initial={false}>
        {!isExpanded &&
        (isHovered || isDragging || extraLines > 0) ? (
          <AbsoluteActionBar
            key="action-bar-absolute"
            onRemove={() => onRemove(pin.id)}
            onComment={handleCommentClick}
            instant={skipActionBarEntry.current}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

// ── AbsoluteActionBar ─────────────────────────────────────────────────────────

function AbsoluteActionBar({
  onRemove,
  onComment,
  instant,
}: {
  onRemove: () => void;
  onComment: () => void;
  instant?: boolean;
}) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      initial={
        instant
          ? { opacity: 1, y: 0, filter: "blur(0px)" }
          : { opacity: 0, y: 8, filter: "blur(4px)" }
      }
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 4, filter: "blur(4px)" }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "var(--neutral-white)",
        paddingBottom: 16,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        zIndex: 1,
        pointerEvents: isPresent ? "auto" : "none",
      }}
    >
      <PinActionBar onRemove={onRemove} onComment={onComment} />
    </motion.div>
  );
}

// ── PinActionBar ──────────────────────────────────────────────────────────────

function PinActionBar({
  onRemove,
  onComment,
  hideComment = false,
}: {
  onRemove: () => void;
  onComment?: () => void;
  hideComment?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <IconBtn
          icon={<ShowInChatIcon size={20} />}
          label="Show in chat"
          onClick={() => {}}
        />
        {!hideComment && (
          <IconBtn
            icon={<CommentIcon size={20} />}
            label="Comment"
            onClick={onComment}
          />
        )}
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          type="button"
          onClick={onRemove}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid var(--neutral-200)",
            background: "var(--neutral-white)",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--neutral-600)",
            cursor: "pointer",
            transition: "background 120ms",
          }}
        >
          Unpin
        </button>
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 8,
            border: "none",
            background: "var(--neutral-800)",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--neutral-white)",
            cursor: "pointer",
            transition: "background 120ms",
          }}
        >
          Insert
        </button>
      </div>
    </div>
  );
}

// ── Pin Badge ─────────────────────────────────────────────────────────────────

function PinBadge({
  label,
  color,
  textColor,
}: {
  label: string;
  color: string;
  textColor: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        background: color,
        fontFamily: "var(--font-body)",
        fontSize: 11,
        fontWeight: 500,
        lineHeight: "16px",
        color: textColor,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── Time utility ──────────────────────────────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ── Icon Button (ghost, sm) ───────────────────────────────────────────────────

function IconBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "none",
        background: hovered ? "rgba(59,54,50,0.08)" : "transparent",
        cursor: "pointer",
        transition: "background 120ms",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {icon}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── DROPDOWN MENU ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const ALL_CATEGORIES: PinCategory[] = [
  "Code",
  "Research",
  "Creative",
  "Planning",
  "Tasks",
  "Quote",
  "Workflow",
];

interface DropdownItem {
  label: string;
  active?: boolean;
  onClick: () => void;
}

function DropdownMenu({
  items,
  onClose,
  anchorRef,
  align = "left",
}: {
  items: DropdownItem[];
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  align?: "left" | "right";
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        left: align === "right" ? rect.right : rect.left,
      });
    }
  }, [anchorRef, align]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const style: React.CSSProperties = pos
    ? {
        position: "fixed",
        top: pos.top,
        ...(align === "right"
          ? { right: window.innerWidth - pos.left }
          : { left: pos.left }),
        minWidth: 140,
        maxHeight: 280,
        overflowY: "auto",
        padding: "4px 0",
        borderRadius: 10,
        background: "var(--neutral-white)",
        boxShadow:
          "0px 4px 12px rgba(0,0,0,0.12), 0px 0px 0px 1px rgba(0,0,0,0.06)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column" as const,
      }
    : {
        position: "fixed",
        top: 0,
        left: 0,
        opacity: 0,
        pointerEvents: "none" as const,
      };

  return (
    <div
      ref={menuRef}
      style={style}
    >
      {items.map((item) => (
        <DropdownMenuItem key={item.label} item={item} />
      ))}
    </div>
  );
}

function DropdownMenuItem({ item }: { item: DropdownItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={item.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 12px",
        border: "none",
        background: hovered
          ? "var(--neutral-50)"
          : "transparent",
        fontFamily: "var(--font-body)",
        fontSize: 12,
        fontWeight: item.active ? 600 : 400,
        color: item.active
          ? "var(--neutral-900)"
          : "var(--neutral-600)",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 100ms",
      }}
    >
      {item.active && (
        <CheckIcon size={14} color="var(--neutral-900)" />
      )}
      <span style={{ marginLeft: item.active ? 0 : 22 }}>
        {item.label}
      </span>
    </button>
  );
}

function CheckIcon({
  size = 14,
  color = "var(--neutral-600)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Pin Card Context Menu ─────────────────────────────────────────────────────

function PinCardMenu({
  pin,
  onRemove,
  onCopy,
  onChangeCategory,
  onClose,
  anchorRef,
}: {
  pin: PinItem;
  onRemove: () => void;
  onCopy: () => void;
  onChangeCategory: (cat: PinCategory) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [categorySubmenuOpen, setCategorySubmenuOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const style: React.CSSProperties = pos
    ? {
        position: "fixed",
        top: pos.top,
        right: pos.right,
        minWidth: 160,
        padding: "4px 0",
        borderRadius: 10,
        background: "var(--neutral-white)",
        boxShadow:
          "0px 4px 12px rgba(0,0,0,0.12), 0px 0px 0px 1px rgba(0,0,0,0.06)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }
    : {
        position: "fixed",
        top: 0,
        left: 0,
        opacity: 0,
        pointerEvents: "none",
      };

  return (
    <div ref={menuRef} style={style}>
      <MenuItemBtn label="Copy content" onClick={onCopy} />
      <div style={{ position: "relative" }}>
        <MenuItemBtn
          label="Change category"
          hasSubmenu
          onClick={() => setCategorySubmenuOpen((v) => !v)}
        />
        {categorySubmenuOpen && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: "100%",
              marginRight: 4,
              minWidth: 130,
              padding: "4px 0",
              borderRadius: 10,
              background: "var(--neutral-white)",
              boxShadow:
                "0px 4px 12px rgba(0,0,0,0.12), 0px 0px 0px 1px rgba(0,0,0,0.06)",
              zIndex: 10000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {ALL_CATEGORIES.map((cat) => (
              <MenuItemBtn
                key={cat}
                label={cat}
                active={pin.category === cat}
                onClick={() => onChangeCategory(cat)}
              />
            ))}
          </div>
        )}
      </div>
      <div
        style={{
          height: 1,
          background: "var(--neutral-100)",
          margin: "4px 8px",
        }}
      />
      <MenuItemBtn
        label="Remove pin"
        danger
        onClick={onRemove}
      />
    </div>
  );
}

function MenuItemBtn({
  label,
  onClick,
  danger = false,
  active = false,
  hasSubmenu = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  hasSubmenu?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "6px 12px",
        border: "none",
        background: hovered
          ? "var(--neutral-50)"
          : "transparent",
        fontFamily: "var(--font-body)",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: danger
          ? "var(--red-600, #dc2626)"
          : active
            ? "var(--neutral-900)"
            : "var(--neutral-600)",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 100ms",
      }}
    >
      {label}
      {hasSubmenu && <ChevronLeftIcon size={12} />}
    </button>
  );
}

function ChevronLeftIcon({
  size = 12,
  color = "var(--neutral-400)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── RIGHT SIDEBAR (PINBOARD) ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function RightSidebar() {
  const { pins, isOpen, close, removePin, updatePinCategory } = usePinboard();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set()
  );
  const hasExpanded = expandedIds.size > 0;

  // ── Filter & Sort state ───────────────────────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState<PinCategory | "All">("All");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryBtnRef = useRef<HTMLButtonElement>(null);
  const filterBtnRef = useRef<HTMLDivElement>(null);
  const sortBtnRef = useRef<HTMLDivElement>(null);

  const handlePinExpandedChange = useCallback(
    (id: string) => (expanded: boolean) => {
      setExpandedIds((prev) => {
        const has = prev.has(id);
        if (expanded === has) return prev;
        const next = new Set(prev);
        if (expanded) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    []
  );

  const handleCollapseAll = () => setCollapseSignal((s) => s + 1);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAtTop(el.scrollTop < 8);
    setAtBottom(
      el.scrollHeight - el.scrollTop - el.clientHeight < 8
    );
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(
      el.scrollHeight - el.scrollTop - el.clientHeight < 8
    );
  }, [pins.length]);

  const filteredPins = (() => {
    let result = pins;
    // Category filter
    if (categoryFilter !== "All") {
      result = result.filter((p) => p.category === categoryFilter);
    }
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q)
      );
    }
    // Sort
    if (sortOrder === "oldest") {
      result = [...result].reverse();
    }
    return result;
  })();

  const filterLabel = categoryFilter === "All" ? "All pins" : categoryFilter;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="pinboard-sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 332, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 32,
            mass: 0.9,
          }}
          style={{
            height: "100%",
            flexShrink: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "var(--neutral-50)",
            borderRadius: 16,
            position: "relative",
            paddingBottom: 8,
          }}
        >
          {/* ── Top overlay — Header + Filter bar ── */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "0 8px 8px 8px",
              background: "var(--neutral-50)",
              zIndex: 2,
            }}
          >
            {/* Pinboard Header */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
                height: 58,
                paddingTop: 22,
                background: "var(--neutral-50)",
                width: "100%",
              }}
            >
              {/* Title */}
              <AnimatePresence initial={false}>
                {!searchOpen && (
                  <motion.p
                    key="title"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      transition: { duration: 0.12 },
                    }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 22,
                      bottom: 0,
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      fontFamily: "var(--font-title)",
                      fontWeight: "var(--font-weight-regular, 400)",
                      fontSize: "var(--font-size-heading)",
                      lineHeight: "var(--line-height-heading)",
                      color: "var(--neutral-700)",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    Pinboard
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Search area */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: searchOpen ? "1 0 0" : undefined,
                  minWidth: 0,
                }}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {!searchOpen ? (
                    <motion.span
                      key="search-btn"
                      layout
                      initial={{
                        opacity: 0,
                        y: 4,
                        filter: "blur(4px)",
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: {
                          type: "spring",
                          duration: 0.3,
                          bounce: 0,
                        },
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.25,
                        filter: "blur(4px)",
                        transition: {
                          type: "spring",
                          duration: 0.2,
                          bounce: 0,
                        },
                      }}
                      style={{
                        display: "inline-flex",
                        flexShrink: 0,
                      }}
                    >
                      <IconBtn
                        icon={<SearchIcon size={20} />}
                        label="Search"
                        onClick={() => setSearchOpen(true)}
                      />
                    </motion.span>
                  ) : (
                    <motion.div
                      key="search-input"
                      initial={{
                        opacity: 0,
                        scale: 0.95,
                        filter: "blur(4px)",
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        filter: "blur(0px)",
                        transition: {
                          type: "spring",
                          duration: 0.3,
                          bounce: 0,
                        },
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.95,
                        filter: "blur(4px)",
                        transition: { duration: 0.15 },
                      }}
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          borderRadius: 8,
                          background: "var(--neutral-white)",
                          boxShadow:
                            "0px 1px 2px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(82,75,71,0.1)",
                        }}
                      >
                        <SearchIcon
                          size={16}
                          color="var(--neutral-400)"
                        />
                        <input
                          type="text"
                          placeholder="Search pins..."
                          value={searchQuery}
                          onChange={(e) =>
                            setSearchQuery(e.target.value)
                          }
                          autoFocus
                          style={{
                            flex: 1,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontFamily: "var(--font-body)",
                            fontSize: 13,
                            lineHeight: "18px",
                            color: "var(--neutral-800)",
                            minWidth: 0,
                          }}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            style={{
                              display: "flex",
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            <ClearCircleIcon size={16} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right section — layout animated */}
              <motion.div
                layout
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 32,
                  mass: 0.8,
                }}
                style={{ display: "flex", gap: 0 }}
              >
                {searchOpen && (
                  <IconBtn
                    icon={<CloseIcon size={20} />}
                    label="Close search"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                  />
                )}
                <IconBtn
                  icon={<CloseIcon size={20} />}
                  label="Close pinboard"
                  onClick={close}
                />
              </motion.div>
            </div>

            {/* Filter bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              {/* Category dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  ref={categoryBtnRef}
                  type="button"
                  onClick={() => setCategoryDropdownOpen((v) => !v)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--neutral-200)",
                    background: "var(--neutral-white)",
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--neutral-600)",
                    cursor: "pointer",
                  }}
                >
                  {filterLabel}
                  <ChevronDownIcon size={14} />
                </button>
                {categoryDropdownOpen && (
                  <DropdownMenu
                    anchorRef={categoryBtnRef}
                    items={[
                      { label: "All pins", active: categoryFilter === "All", onClick: () => { setCategoryFilter("All"); setCategoryDropdownOpen(false); } },
                      ...ALL_CATEGORIES.map((cat) => ({
                        label: cat,
                        active: categoryFilter === cat,
                        onClick: () => { setCategoryFilter(cat); setCategoryDropdownOpen(false); },
                      })),
                    ]}
                    onClose={() => setCategoryDropdownOpen(false)}
                  />
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <AnimatePresence initial={false}>
                  {hasExpanded && (
                    <motion.div
                      key="collapse-all"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 32,
                      }}
                      style={{
                        display: "inline-flex",
                        transformOrigin: "center",
                      }}
                    >
                      <IconBtn
                        icon={<CollapseAllIcon size={20} />}
                        label="Collapse all"
                        onClick={handleCollapseAll}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div
                  ref={filterBtnRef}
                  layout
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 32,
                  }}
                  style={{ display: "inline-flex", position: "relative" }}
                >
                  <IconBtn
                    icon={<FilterIcon size={20} />}
                    label="Filter"
                    onClick={() => setFilterDropdownOpen((v) => !v)}
                  />
                  {filterDropdownOpen && (
                    <DropdownMenu
                      anchorRef={filterBtnRef}
                      align="right"
                      items={[
                        { label: "All categories", active: categoryFilter === "All", onClick: () => { setCategoryFilter("All"); setFilterDropdownOpen(false); } },
                        ...ALL_CATEGORIES.map((cat) => ({
                          label: cat,
                          active: categoryFilter === cat,
                          onClick: () => { setCategoryFilter(cat); setFilterDropdownOpen(false); },
                        })),
                      ]}
                      onClose={() => setFilterDropdownOpen(false)}
                    />
                  )}
                </motion.div>
                <motion.div
                  ref={sortBtnRef}
                  layout
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 32,
                  }}
                  style={{ display: "inline-flex", position: "relative" }}
                >
                  <IconBtn
                    icon={<SortIcon size={20} />}
                    label="Sort"
                    onClick={() => setSortDropdownOpen((v) => !v)}
                  />
                  {sortDropdownOpen && (
                    <DropdownMenu
                      anchorRef={sortBtnRef}
                      align="right"
                      items={[
                        { label: "Newest first", active: sortOrder === "newest", onClick: () => { setSortOrder("newest"); setSortDropdownOpen(false); } },
                        { label: "Oldest first", active: sortOrder === "oldest", onClick: () => { setSortOrder("oldest"); setSortDropdownOpen(false); } },
                      ]}
                      onClose={() => setSortDropdownOpen(false)}
                    />
                  )}
                </motion.div>
              </div>
            </div>
          </div>

          {/* ── Scrollable pin list ── */}
          <div
            ref={scrollRef}
            tabIndex={-1}
            className="kaya-scrollbar"
            onScroll={handleScroll}
            style={{
              flex: "1 1 0",
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehaviorY: "contain",
              paddingTop: 118,
              paddingBottom: 68,
              paddingLeft: 8,
              paddingRight: 8,
              outline: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "stretch",
                width: "100%",
              }}
            >
              {filteredPins.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "48px 16px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "var(--neutral-100)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                      fontSize: 20,
                    }}
                  >
                    📌
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--neutral-600)",
                      marginBottom: 4,
                    }}
                  >
                    {searchQuery
                      ? "No matching pins"
                      : "No pins yet"}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-body)",
                      fontSize: 11,
                      color: "var(--neutral-400)",
                    }}
                  >
                    {searchQuery
                      ? "Try a different search term"
                      : "Pin responses to save them here"}
                  </p>
                </div>
              ) : (
                filteredPins.map((pin) => (
                  <PinCard
                    key={pin.id}
                    pin={pin}
                    onRemove={removePin}
                    onUpdateCategory={updatePinCategory}
                    collapseSignal={collapseSignal}
                    onExpandedChange={handlePinExpandedChange(
                      pin.id
                    )}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Top edge fade — progressive blur ── */}
          {[
            { height: 40, blur: 2 },
            { height: 28, blur: 3 },
            { height: 18, blur: 5 },
            { height: 10, blur: 6 },
          ].map(({ height, blur }) => (
            <div
              key={`top-blur-${blur}`}
              aria-hidden
              style={{
                position: "absolute",
                top: TOP_BAR_H,
                left: 0,
                right: 0,
                height,
                backdropFilter: `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage:
                  "linear-gradient(to bottom, black 0%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 0%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 1,
                opacity: atTop ? 0 : 1,
                transition: "opacity 150ms ease",
              }}
            />
          ))}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: TOP_BAR_H,
              left: 0,
              right: 0,
              height: 40,
              background:
                "linear-gradient(to bottom, var(--neutral-50) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 1,
              opacity: atTop ? 0 : 1,
              transition: "opacity 150ms ease",
            }}
          />

          {/* ── Bottom edge fade — progressive blur ── */}
          {[
            { height: 40, blur: 2 },
            { height: 28, blur: 3 },
            { height: 18, blur: 5 },
            { height: 10, blur: 6 },
          ].map(({ height, blur }) => (
            <div
              key={`bot-blur-${blur}`}
              aria-hidden
              style={{
                position: "absolute",
                bottom: 68,
                left: 0,
                right: 0,
                height,
                backdropFilter: `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage:
                  "linear-gradient(to top, black 0%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to top, black 0%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 1,
                opacity: atBottom ? 0 : 1,
                transition: "opacity 150ms ease",
              }}
            />
          ))}
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 68,
              left: 0,
              right: 0,
              height: 40,
              background:
                "linear-gradient(to top, var(--neutral-50) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 1,
              opacity: atBottom ? 0 : 1,
              transition: "opacity 150ms ease",
            }}
          />

          {/* ── Bottom toolbar ── */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              gap: 8,
              alignItems: "stretch",
              padding: "16px 8px",
              background: "var(--neutral-50)",
              zIndex: 2,
            }}
          >
            <ToolbarButton
              icon={<ExportIcon size={16} />}
              label="Export"
              variant="ghost"
            />
            <ToolbarButton
              icon={<OrganizeIcon size={16} />}
              label="Organize"
              variant="secondary"
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ── Toolbar Button ────────────────────────────────────────────────────────────

function ToolbarButton({
  icon,
  label,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  variant: "ghost" | "secondary";
}) {
  const [hovered, setHovered] = useState(false);
  const isGhost = variant === "ghost";
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 16px",
        borderRadius: 10,
        border: "1px solid var(--neutral-200)",
        background: isGhost
          ? hovered
            ? "var(--neutral-50)"
            : "var(--neutral-white)"
          : hovered
            ? "var(--neutral-100)"
            : "var(--neutral-white)",
        fontFamily: "var(--font-body)",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--neutral-700)",
        cursor: "pointer",
        transition: "background 120ms",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
