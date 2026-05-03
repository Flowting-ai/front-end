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
  useAnimation,
} from "framer-motion";
import {
  SearchOneIcon,
  CancelOneIcon,
  CancelCircleIcon,
  ArrowDownOneIcon,
  ArrowUpDownIcon,
  FilterMailIcon,
  DownloadThreeIcon,
  FolderLibraryIcon,
  UnfoldLessIcon,
  MoreVerticalIcon,
  MessagePreviewOneIcon,
  InputShortTextIcon,
} from "@strange-huge/icons";
import { LlmIcon } from "@strange-huge/icons/llm";
import {
  usePinboard,
  type PinItem,
  type PinCategory,
} from "@/context/pinboard-context";
import { PinMarkdownRenderer } from "@/lib/pin-markdown";
import { PinCategory as PinCategoryBadge, type PinCategoryType } from "@/components/PinCategory";
import { Badge, type BadgeColor } from "@/components/Badge";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { Tooltip } from "@/components/Tooltip";

// ── Constants ─────────────────────────────────────────────────────────────────

const SHADOW_CARD =
  "0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)";
const LINE_HEIGHT_PX = 16;
const MAX_SNAP_LINES = 24;
const DRAG_THRESHOLD = 8;
const MAX_OVERSHOOT = 32;
const ELASTIC_FACTOR = 0.2;
const TOP_BAR_H = 110;

// ── Shadow tokens (PinCommentField) ───────────────────────────────────────────

const SHADOW_COMMENT_DEFAULT = "0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-800-10)";
const SHADOW_COMMENT_HOVER   = "0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-800-10), 0px 0px 0px 3px var(--neutral-100-60)";
const SHADOW_COMMENT_FOCUS   = "0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--focus-ring)";

// ── Category → Badge color mapping ────────────────────────────────────────────

const CATEGORY_BADGE_COLOR: Record<PinCategory, BadgeColor> = {
  Code:     "Green",
  Research: "Blue",
  Creative: "Purple",
  Planning: "Yellow",
  Tasks:    "Red",
  Quote:    "Brown",
  Workflow: "Neutral",
};

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
        width:  bb ? bb.inlineSize : entry.contentRect.width,
        height: bb ? bb.blockSize  : entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [ref, bounds] as const;
}

// ── Pin Comment Field ─────────────────────────────────────────────────────────

const PinCommentField = React.forwardRef<
  HTMLTextAreaElement,
  { fluid?: boolean; "aria-label"?: string }
>(function PinCommentField({ fluid = false, "aria-label": ariaLabel }, forwardedRef) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState("");
  const [taHeight, setTaHeight] = useState(16);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const shakeControls = useAnimation();

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      internalRef.current = el;
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef],
  );

  const shadow = isFocused
    ? SHADOW_COMMENT_FOCUS
    : isHovered
      ? SHADOW_COMMENT_HOVER
      : SHADOW_COMMENT_DEFAULT;

  const measureHeight = (ta: HTMLTextAreaElement): number => {
    const prev = ta.style.height;
    ta.style.height = "auto";
    const h = ta.scrollHeight;
    ta.style.height = prev;
    return h;
  };

  useLayoutEffect(() => {
    const ta = internalRef.current;
    if (!ta) return;
    setTaHeight(Math.min(measureHeight(ta), 32));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const ta = internalRef.current;
    if (!ta) return;
    const naturalHeight = measureHeight(ta);
    if (naturalHeight <= 32) {
      setTaHeight(naturalHeight);
      setValue(e.target.value);
    } else {
      ta.value = value;
      shakeControls.start({
        x: [0, -3, 3, -2, 2, -1, 1, 0],
        transition: { duration: 0.25, ease: "easeInOut" },
      });
    }
  };

  return (
    <motion.div
      animate={shakeControls}
      style={{
        position:        "relative",
        backgroundColor: "var(--neutral-white)",
        borderRadius:    6,
        padding:         6,
        width:           fluid ? "100%" : 292,
        boxShadow:       shadow,
        overflow:        "clip",
        transition:      "box-shadow 150ms",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence initial={false}>
        {!value && (
          <motion.span
            key="placeholder"
            aria-hidden
            initial={{ opacity: 0, filter: "blur(2px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: { duration: 0.2 } }}
            exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: 0.15 } }}
            style={{
              position:      "absolute",
              top:           6,
              left:          6,
              right:         6,
              pointerEvents: "none",
              fontFamily:    "var(--font-body)",
              fontWeight:    "var(--font-weight-medium)",
              fontSize:      "var(--font-size-caption)",
              lineHeight:    "var(--line-height-caption)",
              color:         "var(--color-text-placeholder)",
              whiteSpace:    "nowrap",
              overflow:      "hidden",
            }}
          >
            Type your comment here...
          </motion.span>
        )}
      </AnimatePresence>
      <textarea
        ref={setRef}
        rows={1}
        value={value}
        aria-label={ariaLabel}
        onChange={handleChange}
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          display:    "block",
          width:      "100%",
          height:     taHeight,
          resize:     "none",
          border:     "none",
          outline:    "none",
          background: "transparent",
          padding:    0,
          margin:     0,
          fontFamily: "var(--font-body)",
          fontWeight: "var(--font-weight-medium)",
          fontSize:   "var(--font-size-caption)",
          lineHeight: "var(--line-height-caption)",
          color:      "var(--neutral-900)",
          overflowY:  "hidden",
        }}
      />
    </motion.div>
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

  const timeAgo = getTimeAgo(pin.createdAt);

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

  const onExpandedChangeRef = useRef(onExpandedChange);
  useEffect(() => { onExpandedChangeRef.current = onExpandedChange; });
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    onExpandedChangeRef.current(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (isExpanded && focusCommentRef.current) {
      focusCommentRef.current = false;
      const id = requestAnimationFrame(() => {
        commentFieldRef.current?.focus();
        commentFieldRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      return () => cancelAnimationFrame(id);
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
        if (extraLines * LINE_HEIGHT_PX + clampedDelta > MAX_SNAP_LINES * LINE_HEIGHT_PX) {
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
          const stretch = Math.min(rawDelta * ELASTIC_FACTOR, MAX_OVERSHOOT);
          cardHeightMV.set(dragInfo.current.startHeight + stretch);
        } else {
          cardHeightMV.set(Math.max(dragInfo.current.startHeight + rawDelta, 60));
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
      const snappedDelta = Math.round(clampedDelta / LINE_HEIGHT_PX) * LINE_HEIGHT_PX;
      const newExtra = Math.max(0, extraLines + snappedDelta / LINE_HEIGHT_PX);
      if (newExtra >= MAX_SNAP_LINES) {
        setIsExpanded(true);
        setExtraLines(0);
      } else {
        setExtraLines(newExtra);
      }
    } else {
      const dt = performance.now() - lastMoveRef.current.time;
      const velocity = dt > 0 ? (e.clientY - lastMoveRef.current.y) / dt : 0;
      const shouldCollapse = -rawDelta > DRAG_THRESHOLD || velocity < -0.3;
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
      commentFieldRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const visibleLines = 2 + extraLines;
  const cageH = visibleLines * LINE_HEIGHT_PX + (extraLines > 0 ? 12 : 0);

  return (
    <motion.div
      ref={cardRef}
      style={{
        height:          cardHeightMV,
        position:        "relative",
        width:           "100%",
        borderRadius:    16,
        backgroundColor: "var(--neutral-white)",
        boxShadow:       SHADOW_CARD,
        overflow:        "clip",
        isolation:       "isolate",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { if (!isDraggingRef.current) setIsHovered(false); }}
    >
      {/* Inner content — measured by useMeasure */}
      <div
        ref={contentRef as React.Ref<HTMLDivElement>}
        style={{
          display:       "flex",
          flexDirection: "column",
          gap:           16,
          alignItems:    "flex-start",
          paddingTop:    12,
          paddingBottom: isDragging ? 64 : 16,
          paddingLeft:   12,
          paddingRight:  12,
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", gap: 4, alignItems: "flex-start", width: "100%", flexShrink: 0 }}>
          <div style={{ display: "flex", flex: "1 0 0", gap: 12, alignItems: "center", minWidth: 0 }}>
            <PinCategoryBadge type={pin.category as PinCategoryType} style={{ flexShrink: 0 }} />
            <p
              style={{
                flex:         "1 0 0",
                fontFamily:   "var(--font-body)",
                fontWeight:   "var(--font-weight-medium)",
                fontSize:     "var(--font-size-body)",
                lineHeight:   "var(--line-height-body)",
                color:        "var(--neutral-900)",
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
                margin:       0,
                minWidth:     0,
              }}
            >
              {pin.title}
            </p>
          </div>
          <div ref={menuBtnRef} style={{ position: "relative", flexShrink: 0 }}>
            <Tooltip content="More options">
              <IconButton
                variant="ghost"
                size="sm"
                icon={<MoreVerticalIcon size={20} />}
                aria-label="More options"
                onClick={() => setMenuOpen((v) => !v)}
              />
            </Tooltip>
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
        <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%", flexWrap: "wrap", flexShrink: 0 }}>
          <Badge label={pin.category} color={CATEGORY_BADGE_COLOR[pin.category]} />
          {pin.modelName && <Badge label={pin.modelName} color="Neutral" />}
        </div>

        {/* Description */}
        <div
          style={{
            height:    showFull ? "auto" : `${cageH}px`,
            minHeight: showFull ? undefined : `${cageH}px`,
            maxHeight: showFull ? undefined : `${cageH}px`,
            overflow:  showFull ? "visible" : "hidden",
            width:     "100%",
            flexShrink: 0,
            position:  "relative",
          }}
        >
          <PinMarkdownRenderer content={pin.content} />
          {!showFull && extraLines === 0 && (
            <div
              aria-hidden
              style={{
                position:   "absolute",
                bottom:     0,
                left:       0,
                right:      0,
                height:     14,
                background: "linear-gradient(to bottom, transparent, var(--neutral-white))",
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
              style={{ width: "100%", flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}
            >
              <ExpandedMeta timeAgo={timeAgo} chatName={pin.chatName} />
              <PinCommentField ref={commentFieldRef} fluid aria-label="Add a comment" />
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
              <PinActionBar onRemove={() => onRemove(pin.id)} onComment={handleCommentClick} hideComment />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drag handle */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={isExpanded ? "Collapse pin" : "Expand pin"}
        aria-expanded={isExpanded}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isExpanded) { e.preventDefault(); setIsExpanded(true); } }}
        onDoubleClick={(e) => { e.stopPropagation(); if (!isExpanded) setIsExpanded(true); }}
        style={{
          position:       "absolute",
          bottom:         4,
          left:           "calc(50% - 16px)",
          width:          32,
          height:         12,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          cursor:         isDragging ? "grabbing" : "grab",
          userSelect:     "none",
          touchAction:    "none",
          zIndex:         2,
        }}
      >
        <div
          style={{
            width:           32,
            height:          2,
            borderRadius:    1,
            backgroundColor: "var(--neutral-200)",
            pointerEvents:   "none",
          }}
        />
      </motion.div>

      {/* Absolute action bar — collapsed/intermediate state */}
      <AnimatePresence initial={false}>
        {!isExpanded && (isHovered || isDragging || extraLines > 0) ? (
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

// ── ExpandedMeta ──────────────────────────────────────────────────────────────

function ExpandedMeta({ timeAgo, chatName }: { timeAgo: string; chatName?: string }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
      <Badge label={timeAgo} color="Green" />
      {chatName && (
        <p
          style={{
            flex:         "1 0 0",
            fontFamily:   "var(--font-body)",
            fontWeight:   "var(--font-weight-semibold)",
            fontSize:     "var(--font-size-caption)",
            lineHeight:   "var(--line-height-caption)",
            color:        "#1e293b",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
            margin:       0,
            minWidth:     0,
          }}
        >
          {chatName}
        </p>
      )}
      <div style={{ width: 24, height: 24, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
        <LlmIcon id="Claude" variant="avatar" size={24} />
      </div>
    </div>
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
      initial={instant ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 4, filter: "blur(4px)" }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        position:        "absolute",
        bottom:          0,
        left:            0,
        right:           0,
        backgroundColor: "var(--neutral-white)",
        paddingBottom:   16,
        paddingLeft:     12,
        paddingRight:    12,
        paddingTop:      8,
        zIndex:          1,
        pointerEvents:   isPresent ? "auto" : "none",
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Tooltip content="Show in chat">
          <IconButton variant="ghost" size="sm" icon={<MessagePreviewOneIcon size={20} />} aria-label="Show in chat" />
        </Tooltip>
        {!hideComment && (
          <Tooltip content="Comment">
            <IconButton variant="ghost" size="sm" icon={<InputShortTextIcon size={20} />} aria-label="Comment" onClick={onComment} />
          </Tooltip>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={onRemove}>
        Unpin
      </Button>
    </div>
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
        top:  rect.bottom + 4,
        left: align === "right" ? rect.right : rect.left,
      });
    }
  }, [anchorRef, align]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const style: React.CSSProperties = pos
    ? {
        position:  "fixed",
        top:       pos.top,
        ...(align === "right" ? { right: window.innerWidth - pos.left } : { left: pos.left }),
        minWidth:  140,
        maxHeight: 280,
        overflowY: "auto",
        padding:   "4px 0",
        borderRadius: 10,
        background:   "var(--neutral-white)",
        boxShadow:    "0px 4px 12px rgba(0,0,0,0.12), 0px 0px 0px 1px rgba(0,0,0,0.06)",
        zIndex:       9999,
        display:      "flex",
        flexDirection: "column" as const,
      }
    : { position: "fixed", top: 0, left: 0, opacity: 0, pointerEvents: "none" as const };

  return (
    <div ref={menuRef} style={style}>
      {items.map((item) => (
        <DropdownMenuItemRow key={item.label} item={item} />
      ))}
    </div>
  );
}

function DropdownMenuItemRow({ item }: { item: DropdownItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={item.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        8,
        width:      "100%",
        padding:    "6px 12px",
        border:     "none",
        background: hovered ? "var(--neutral-50)" : "transparent",
        fontFamily: "var(--font-body)",
        fontSize:   12,
        fontWeight: item.active ? 600 : 400,
        color:      item.active ? "var(--neutral-900)" : "var(--neutral-600)",
        cursor:     "pointer",
        textAlign:  "left",
        transition: "background 100ms",
      }}
    >
      {item.active && <CheckIcon size={14} color="var(--neutral-900)" />}
      <span style={{ marginLeft: item.active ? 0 : 22 }}>{item.label}</span>
    </button>
  );
}

function CheckIcon({ size = 14, color = "var(--neutral-600)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const style: React.CSSProperties = pos
    ? {
        position:  "fixed",
        top:       pos.top,
        right:     pos.right,
        minWidth:  160,
        padding:   "4px 0",
        borderRadius: 10,
        background:   "var(--neutral-white)",
        boxShadow:    "0px 4px 12px rgba(0,0,0,0.12), 0px 0px 0px 1px rgba(0,0,0,0.06)",
        zIndex:       9999,
        display:      "flex",
        flexDirection: "column",
      }
    : { position: "fixed", top: 0, left: 0, opacity: 0, pointerEvents: "none" };

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
              position:  "absolute",
              top:       0,
              right:     "100%",
              marginRight: 4,
              minWidth:  130,
              padding:   "4px 0",
              borderRadius: 10,
              background:   "var(--neutral-white)",
              boxShadow:    "0px 4px 12px rgba(0,0,0,0.12), 0px 0px 0px 1px rgba(0,0,0,0.06)",
              zIndex:       10000,
              display:      "flex",
              flexDirection: "column",
            }}
          >
            {ALL_CATEGORIES.map((cat) => (
              <MenuItemBtn key={cat} label={cat} active={pin.category === cat} onClick={() => onChangeCategory(cat)} />
            ))}
          </div>
        )}
      </div>
      <div style={{ height: 1, background: "var(--neutral-100)", margin: "4px 8px" }} />
      <MenuItemBtn label="Remove pin" danger onClick={onRemove} />
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
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        width:          "100%",
        padding:        "6px 12px",
        border:         "none",
        background:     hovered ? "var(--neutral-50)" : "transparent",
        fontFamily:     "var(--font-body)",
        fontSize:       12,
        fontWeight:     active ? 600 : 400,
        color:          danger ? "var(--red-600, #dc2626)" : active ? "var(--neutral-900)" : "var(--neutral-600)",
        cursor:         "pointer",
        textAlign:      "left",
        transition:     "background 100ms",
      }}
    >
      {label}
      {hasSubmenu && <ChevronLeftIcon size={12} />}
    </button>
  );
}

function ChevronLeftIcon({ size = 12, color = "var(--neutral-400)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [bottomH, setBottomH] = useState(68);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const hasExpanded = expandedIds.size > 0;

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
    [],
  );

  const handleCollapseAll = () => setCollapseSignal((s) => s + 1);

  useEffect(() => {
    if (!bottomBarRef.current) return;
    const ro = new ResizeObserver(() => {
      if (bottomBarRef.current) setBottomH(bottomBarRef.current.offsetHeight);
    });
    ro.observe(bottomBarRef.current);
    return () => ro.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAtTop(el.scrollTop < 8);
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  }, [pins.length, bottomH]);

  const filteredPins = (() => {
    let result = pins;
    if (categoryFilter !== "All") result = result.filter((p) => p.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
    }
    if (sortOrder === "oldest") result = [...result].reverse();
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
          transition={{ type: "spring", stiffness: 260, damping: 32, mass: 0.9 }}
          style={{
            height:        "100%",
            flexShrink:    0,
            overflow:      "hidden",
            display:       "flex",
            flexDirection: "column",
            background:    "var(--neutral-50)",
            borderRadius:  16,
            position:      "relative",
            paddingBottom: 8,
          }}
        >
          {/* ── Top overlay — Header + Filter bar ── */}
          <div
            style={{
              position:      "absolute",
              top:           0,
              left:          0,
              right:         0,
              display:       "flex",
              flexDirection: "column",
              gap:           12,
              padding:       "0 8px 8px 8px",
              background:    "var(--neutral-50)",
              zIndex:        2,
            }}
          >
            {/* Pinboard Header */}
            <div
              style={{
                position:       "relative",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "flex-end",
                gap:            8,
                height:         58,
                paddingTop:     22,
                background:     "var(--neutral-50)",
                width:          "100%",
              }}
            >
              {/* Title */}
              <AnimatePresence initial={false}>
                {!searchOpen && (
                  <motion.p
                    key="title"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    style={{
                      position:      "absolute",
                      left:          0,
                      top:           22,
                      bottom:        0,
                      margin:        0,
                      display:       "flex",
                      alignItems:    "center",
                      fontFamily:    "var(--font-title)",
                      fontWeight:    "var(--font-weight-regular, 400)",
                      fontSize:      "var(--font-size-heading)",
                      lineHeight:    "var(--line-height-heading)",
                      color:         "var(--neutral-700)",
                      whiteSpace:    "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    Pinboard
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Search area */}
              <Tooltip content="Search" disabled={searchOpen}>
                <div
                  style={{
                    display:    "flex",
                    alignItems: "center",
                    flex:       searchOpen ? "1 0 0" : undefined,
                    minWidth:   0,
                  }}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {!searchOpen ? (
                      <motion.span
                        key="search-btn"
                        layout
                        initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", duration: 0.3, bounce: 0 } }}
                        exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)", transition: { type: "spring", duration: 0.2, bounce: 0 } }}
                        style={{ display: "inline-flex", flexShrink: 0 }}
                      >
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={<SearchOneIcon size={20} />}
                          aria-label="Open search"
                          onClick={() => setSearchOpen(true)}
                        />
                      </motion.span>
                    ) : (
                      <motion.div
                        key="search-input"
                        initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: { type: "spring", duration: 0.3, bounce: 0 } }}
                        exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)", transition: { duration: 0.15, ease: "easeIn" } }}
                        style={{ flex: "1 0 0", minWidth: 0 }}
                      >
                        <div
                          style={{
                            display:      "flex",
                            alignItems:   "center",
                            gap:          6,
                            padding:      "6px 10px",
                            borderRadius: 8,
                            background:   "var(--neutral-white)",
                            boxShadow:    "0px 1px 2px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-800-10)",
                          }}
                        >
                          <SearchOneIcon size={16} color="var(--neutral-400)" />
                          <input
                            type="text"
                            placeholder="Search for your pin..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                            aria-label="Search pins"
                            style={{
                              flex:       1,
                              border:     "none",
                              outline:    "none",
                              background: "transparent",
                              fontFamily: "var(--font-body)",
                              fontSize:   "var(--font-size-body)",
                              lineHeight: "var(--line-height-body)",
                              color:      "var(--neutral-800)",
                              minWidth:   0,
                            }}
                          />
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Close search"
                            onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (() => { setSearchQuery(""); setSearchOpen(false); })()}
                            style={{ display: "inline-flex", cursor: "pointer", lineHeight: 0 }}
                          >
                            <CancelCircleIcon size={16} color="var(--neutral-400)" />
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Tooltip>

              {/* Close pinboard */}
              <Tooltip content="Close Pinboard">
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close pinboard"
                  onClick={close}
                />
              </Tooltip>
            </div>

            {/* Filter bar */}
            <div
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                width:          "100%",
              }}
            >
              {/* Category filter button */}
              <div style={{ position: "relative" }}>
                <Button
                  ref={categoryBtnRef}
                  variant="secondary"
                  size="sm"
                  rightIcon={<ArrowDownOneIcon size={16} />}
                  onClick={() => setCategoryDropdownOpen((v) => !v)}
                >
                  {filterLabel}
                </Button>
                {categoryDropdownOpen && (
                  <DropdownMenu
                    anchorRef={categoryBtnRef as React.RefObject<HTMLElement>}
                    items={[
                      { label: "All pins", active: categoryFilter === "All", onClick: () => { setCategoryFilter("All"); setCategoryDropdownOpen(false); } },
                      ...ALL_CATEGORIES.map((cat) => ({
                        label:  cat,
                        active: categoryFilter === cat,
                        onClick: () => { setCategoryFilter(cat); setCategoryDropdownOpen(false); },
                      })),
                    ]}
                    onClose={() => setCategoryDropdownOpen(false)}
                  />
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AnimatePresence initial={false}>
                  {hasExpanded && (
                    <motion.div
                      key="collapse-all"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: "spring", stiffness: 500, damping: 32 }}
                      style={{ display: "inline-flex", transformOrigin: "center" }}
                    >
                      <Tooltip content="Collapse all Pins">
                        <IconButton
                          variant="secondary"
                          size="sm"
                          icon={<UnfoldLessIcon size={20} />}
                          aria-label="Collapse open pins"
                          onClick={handleCollapseAll}
                        />
                      </Tooltip>
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div
                  ref={filterBtnRef}
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  style={{ display: "inline-flex", position: "relative" }}
                >
                  <Tooltip content="Filter">
                    <IconButton
                      variant="secondary"
                      size="sm"
                      icon={<FilterMailIcon size={20} />}
                      aria-label="Filter pins"
                      onClick={() => setFilterDropdownOpen((v) => !v)}
                    />
                  </Tooltip>
                  {filterDropdownOpen && (
                    <DropdownMenu
                      anchorRef={filterBtnRef as React.RefObject<HTMLElement>}
                      align="right"
                      items={[
                        { label: "All categories", active: categoryFilter === "All", onClick: () => { setCategoryFilter("All"); setFilterDropdownOpen(false); } },
                        ...ALL_CATEGORIES.map((cat) => ({
                          label:  cat,
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
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  style={{ display: "inline-flex", position: "relative" }}
                >
                  <Tooltip content="Sort">
                    <IconButton
                      variant="secondary"
                      size="sm"
                      icon={<ArrowUpDownIcon size={20} />}
                      aria-label="Sort pins"
                      onClick={() => setSortDropdownOpen((v) => !v)}
                    />
                  </Tooltip>
                  {sortDropdownOpen && (
                    <DropdownMenu
                      anchorRef={sortBtnRef as React.RefObject<HTMLElement>}
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
              flex:                "1 1 0",
              minHeight:           0,
              overflowY:           "auto",
              overflowX:           "hidden",
              overscrollBehaviorY: "contain",
              paddingTop:          118,
              paddingBottom:       bottomH,
              paddingLeft:         8,
              paddingRight:        8,
              outline:             "none",
            }}
          >
            <div
              style={{
                display:       "flex",
                flexDirection: "column",
                gap:           8,
                alignItems:    "stretch",
                width:         "100%",
              }}
            >
              {filteredPins.length === 0 ? (
                <div
                  style={{
                    display:        "flex",
                    flexDirection:  "column",
                    alignItems:     "center",
                    justifyContent: "center",
                    padding:        "48px 16px",
                    textAlign:      "center",
                  }}
                >
                  <div
                    style={{
                      width:          48,
                      height:         48,
                      borderRadius:   12,
                      background:     "var(--neutral-100)",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      marginBottom:   12,
                      fontSize:       20,
                    }}
                  >
                    📌
                  </div>
                  <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "var(--neutral-600)", marginBottom: 4 }}>
                    {searchQuery ? "No matching pins" : "No pins yet"}
                  </p>
                  <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 11, color: "var(--neutral-400)" }}>
                    {searchQuery ? "Try a different search term" : "Pin responses to save them here"}
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
                    onExpandedChange={handlePinExpandedChange(pin.id)}
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
                position:             "absolute",
                top:                  TOP_BAR_H,
                left:                 0,
                right:                0,
                height,
                backdropFilter:       `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage:            "linear-gradient(to bottom, black 0%, transparent 100%)",
                WebkitMaskImage:      "linear-gradient(to bottom, black 0%, transparent 100%)",
                pointerEvents:        "none",
                zIndex:               1,
                opacity:              atTop ? 0 : 1,
                transition:           "opacity 150ms ease",
              }}
            />
          ))}
          <div
            aria-hidden
            style={{
              position:      "absolute",
              top:           TOP_BAR_H,
              left:          0,
              right:         0,
              height:        40,
              background:    "linear-gradient(to bottom, var(--neutral-50) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex:        1,
              opacity:       atTop ? 0 : 1,
              transition:    "opacity 150ms ease",
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
                position:             "absolute",
                bottom:               bottomH,
                left:                 0,
                right:                0,
                height,
                backdropFilter:       `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage:            "linear-gradient(to top, black 0%, transparent 100%)",
                WebkitMaskImage:      "linear-gradient(to top, black 0%, transparent 100%)",
                pointerEvents:        "none",
                zIndex:               1,
                opacity:              atBottom ? 0 : 1,
                transition:           "opacity 150ms ease",
              }}
            />
          ))}
          <div
            aria-hidden
            style={{
              position:      "absolute",
              bottom:        bottomH,
              left:          0,
              right:         0,
              height:        40,
              background:    "linear-gradient(to top, var(--neutral-50) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex:        1,
              opacity:       atBottom ? 0 : 1,
              transition:    "opacity 150ms ease",
            }}
          />

          {/* ── Bottom toolbar ── */}
          <div
            ref={bottomBarRef}
            style={{
              position:   "absolute",
              bottom:     0,
              left:       0,
              right:      0,
              display:    "flex",
              gap:        8,
              alignItems: "stretch",
              padding:    "16px 8px",
              background: "var(--neutral-50)",
              zIndex:     2,
            }}
          >
            <Button
              variant="ghost"
              size="md"
              fluid
              leftIcon={<DownloadThreeIcon size={16} />}
            >
              Export
            </Button>
            <Button
              variant="secondary"
              size="md"
              fluid
              leftIcon={<FolderLibraryIcon size={16} />}
            >
              Organize
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
