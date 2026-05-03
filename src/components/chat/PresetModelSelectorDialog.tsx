"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  SearchOneIcon,
  StarIcon,
  TextIcon,
  SourceCodeSquareIcon,
  AiVisionRecognitionIcon,
  ImageTwoIcon,
  AudioWaveOneIcon,
  GlobalSearchIcon,
} from "@strange-huge/icons";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { getModelIcon } from "@/lib/model-icons";
import type { AIModel } from "@/types/ai-model";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_TABS = [
  { value: "all", label: "All" },
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
] as const;

const CATEGORY_TABS = [
  { value: "favorites", label: "Favorites", icon: <StarIcon size={16} /> },
  { value: "text", label: "Text", icon: <TextIcon size={16} /> },
  { value: "code", label: "Code", icon: <SourceCodeSquareIcon size={16} /> },
  { value: "vision", label: "Vision", icon: <AiVisionRecognitionIcon size={16} /> },
  { value: "image", label: "Image", icon: <ImageTwoIcon size={16} /> },
  { value: "audio", label: "Audio", icon: <AudioWaveOneIcon size={16} /> },
  { value: "search", label: "Search", icon: <GlobalSearchIcon size={16} /> },
] as const;

// ── ModelSelectItem shadow constants (same as design-system) ──────────────────

const ITEM_SHADOW_ACTIVE =
  "0px 1px 1.5px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-300-40)";
const ITEM_SHADOW_INNER =
  "inset 0px 1px 0px 0px var(--neutral-50-61), inset 0px -1px 0px 0px var(--neutral-600-05)";

// ── ModelFeaturedCard constants (same as design-system) ───────────────────────

const FEATURED_SELECTED_GRADIENT =
  "linear-gradient(180deg, rgba(221,221,221,0.5) 0%, rgba(143,116,39,0.5) 21.635%, rgba(104,61,27,0.5) 36.058%, rgba(39,13,42,0.5) 63.462%, rgba(11,53,127,0.5) 82.212%, rgba(13,110,178,0.5) 97.115%)";

const FEATURED_TEXT_SHADOW =
  "0px -0.5px 0.364px rgba(0,0,0,0.25), 0px 0.5px 0.364px rgba(255,255,255,0.25)";

const CAPTION_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: "var(--font-weight-medium)",
  fontSize: "var(--font-size-caption)",
  lineHeight: "var(--line-height-caption)",
  color: "var(--neutral-500)",
  whiteSpace: "nowrap",
};

// ── ModelSelectItem ───────────────────────────────────────────────────────────

interface ModelSelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  image?: React.ReactNode;
  label?: string;
  icons?: React.ReactNode;
  selected?: boolean;
}

function ModelSelectItem({
  image,
  label,
  icons,
  selected = false,
  style,
  onMouseEnter: externalEnter,
  onMouseLeave: externalLeave,
  ...props
}: ModelSelectItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = isHovered || selected;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px",
        borderRadius: "10px",
        overflow: "hidden",
        backgroundColor: isActive
          ? "var(--model-select-item-bg-active)"
          : "transparent",
        boxShadow: isActive ? ITEM_SHADOW_ACTIVE : "none",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        transition: "background-color 150ms, box-shadow 150ms",
        ...style,
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        externalEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        externalLeave?.(e);
      }}
      {...props}
    >
      {/* Left: image + label */}
      <div
        style={{
          display: "flex",
          flex: "1 0 0",
          gap: "8px",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        {image && (
          <div
            aria-hidden
            style={{
              width: "22px",
              height: "22px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {image}
          </div>
        )}
        <span
          style={{
            flex: "1 0 0",
            fontFamily: "var(--font-body)",
            fontWeight: "var(--font-weight-medium)",
            fontSize: "14px",
            lineHeight: "22px",
            color: "var(--model-select-item-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </div>

      {/* Right icons slot */}
      {icons && (
        <div
          aria-hidden
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            gap: "2px",
            lineHeight: 0,
            color: "var(--model-select-item-icon)",
          }}
        >
          {icons}
        </div>
      )}

      {/* Inner depth shadow — active state */}
      {isActive && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            pointerEvents: "none",
            boxShadow: ITEM_SHADOW_INNER,
          }}
        />
      )}
    </div>
  );
}

// ── ModelFeaturedCard (Muse) ───────────────────────────────────────────────────

interface Ripple {
  key: number;
  x: number;
  y: number;
  r: number;
}

function ModelFeaturedCard() {
  const [isSelected, setIsSelected] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    return () => {
      if (selectTimerRef.current) clearTimeout(selectTimerRef.current);
      rippleTimersRef.current.forEach(clearTimeout);
      rippleTimersRef.current.clear();
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSelected) {
      setIsSelected(false);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const r = Math.sqrt(
      Math.max(x, rect.width - x) ** 2 + Math.max(y, rect.height - y) ** 2,
    );
    const key = Date.now();
    setRipples((prev) => [...prev, { key, x, y, r }]);

    const rippleTimer = setTimeout(() => {
      setRipples((prev) => prev.filter((rp) => rp.key !== key));
      rippleTimersRef.current.delete(rippleTimer);
    }, 1000);
    rippleTimersRef.current.add(rippleTimer);

    if (selectTimerRef.current) clearTimeout(selectTimerRef.current);
    selectTimerRef.current = setTimeout(() => {
      setIsSelected(true);
      selectTimerRef.current = null;
    }, 480);
  };

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "12px",
        overflow: "clip",
        padding: "12px",
        width: "100%",
        flexShrink: 0,
        boxShadow: "var(--shadow-preset-featured-outer)",
        cursor: "pointer",
      }}
      onClick={handleClick}
    >
      {/* Base gradient background */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)",
          borderRadius: "inherit",
          pointerEvents: "none",
        }}
      />

      {/* Persistent selected gradient */}
      {isSelected && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "1px",
            borderRadius: "8.727px",
            filter: "blur(7.273px)",
            backgroundImage: FEATURED_SELECTED_GRADIENT,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Click ripple effects */}
      <AnimatePresence>
        {ripples.flatMap(({ key, x, y, r }) => [
          <motion.div
            key={`${key}-fill`}
            aria-hidden
            style={{
              position: "absolute",
              left: x - r,
              top: y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              backgroundImage: FEATURED_SELECTED_GRADIENT,
              filter: "blur(7.273px)",
              pointerEvents: "none",
              transformOrigin: "center",
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35, ease: "easeIn" } }}
            transition={{ scale: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } }}
          />,
          <motion.div
            key={`${key}-warp`}
            aria-hidden
            style={{
              position: "absolute",
              left: x - r,
              top: y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              background: "transparent",
              boxShadow:
                "0 0 32px 12px rgba(220,195,140,0.6), inset 0 0 24px 8px rgba(220,195,140,0.25)",
              pointerEvents: "none",
              transformOrigin: "center",
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.1, opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.2, 0.8, 0.4, 1] }}
          />,
          <motion.div
            key={`${key}-burst`}
            aria-hidden
            style={{
              position: "absolute",
              left: x - 56,
              top: y - 56,
              width: 112,
              height: 112,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,248,215,0.9) 0%, rgba(210,165,75,0.5) 40%, transparent 70%)",
              filter: "blur(7px)",
              pointerEvents: "none",
              transformOrigin: "center",
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.2, 0.65, 0.4, 1] }}
          />,
        ])}
      </AnimatePresence>

      {/* Content */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          textShadow: FEATURED_TEXT_SHADOW,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-title)",
            fontWeight: 400,
            fontSize: "24px",
            lineHeight: "32px",
            color: "var(--neutral-50)",
            margin: 0,
          }}
        >
          Muse
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: "11px",
            lineHeight: "14px",
            color: "var(--neutral-200)",
            margin: 0,
          }}
        >
          Knows the work before you ask. Each task finds its way to the right
          mind, without you lifting a setting.{" "}
          <a href="#" style={{ color: "inherit", textDecoration: "underline" }}>
            Learn more
          </a>
        </p>
      </div>

      {/* Inner depth shadow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          boxShadow: "var(--shadow-preset-featured-inner)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── AnimatedTabsList ───────────────────────────────────────────────────────────

interface Tab {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface AnimatedTabsListProps {
  value: string;
  onValueChange: (v: string) => void;
  tabs: readonly Tab[];
  scrollable?: boolean;
  size?: "small" | "medium";
}

function AnimatedTabsList({
  value,
  onValueChange,
  tabs,
  scrollable = false,
  size = "small",
}: AnimatedTabsListProps) {
  const isSmall = size === "small";
  const radius = isSmall ? "8px" : "10px";
  const rowRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null);
  const isFirstPill = useRef(true);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const active = row.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active) { setPill(null); return; }

    const newPill = { x: active.offsetLeft, width: active.offsetWidth };

    if (isFirstPill.current) {
      setPill(newPill);
      isFirstPill.current = false;
      return;
    }
    setPill(newPill);
  }, [value]);

  return (
    <div
      role="tablist"
      style={{
        position: "relative",
        display: scrollable ? "block" : "inline-flex",
        alignItems: "flex-start",
        ...(scrollable && {
          overflowX: "clip" as React.CSSProperties["overflowX"],
          overflowY: "visible",
          overflowClipMargin: "8px",
        }),
      }}
    >
      {/* Beige pill background */}
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            backgroundColor: "var(--tab-bg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            boxShadow: "var(--shadow-tab-inner)",
          }}
        />
      </div>

      {/* Triggers row */}
      <div
        ref={rowRef}
        style={{
          position: "relative",
          display: "flex",
          gap: "4px",
          alignItems: "center",
          flexShrink: 0,
          ...(scrollable && {
            overflowX: "auto",
            overscrollBehaviorX: "contain",
            scrollbarWidth: "none" as const,
            paddingLeft: "1px",
          }),
        }}
      >
        {/* Animated pill indicator */}
        {pill && (
          <>
            <motion.div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                borderRadius: radius,
                backgroundColor: "var(--tab-item-bg-selected)",
                boxShadow: scrollable ? undefined : "var(--shadow-tab-item-selected)",
                pointerEvents: "none",
              }}
              animate={{ x: pill.x, width: pill.width }}
              initial={false}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
            <motion.div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                borderRadius: radius,
                boxShadow: "var(--shadow-tab-item-selected-inner)",
                pointerEvents: "none",
              }}
              animate={{ x: pill.x, width: pill.width }}
              initial={false}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </>
        )}

        {tabs.map((tab) => {
          const isSelected = tab.value === value;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={isSelected}
              onClick={() => onValueChange(tab.value)}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: isSmall ? "2px" : "4px",
                padding: isSmall ? "7px" : "7px 8px",
                borderRadius: radius,
                border: "none",
                cursor: "pointer",
                backgroundColor: "transparent",
                flexShrink: scrollable ? 0 : undefined,
                zIndex: 1,
              }}
            >
              {tab.icon && (
                <span
                  aria-hidden
                  style={{
                    display: "inline-flex",
                    flexShrink: 0,
                    lineHeight: 0,
                    color: isSelected
                      ? "var(--tab-item-text-selected)"
                      : "var(--tab-item-text-default)",
                    transition: "color 150ms",
                  }}
                >
                  {tab.icon}
                </span>
              )}
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--font-weight-medium)",
                  fontSize: isSmall
                    ? "var(--font-size-caption)"
                    : "var(--font-size-body)",
                  lineHeight: isSmall
                    ? "var(--line-height-caption)"
                    : "var(--line-height-body)",
                  color: isSelected
                    ? "var(--tab-item-text-selected)"
                    : "var(--tab-item-text-default)",
                  whiteSpace: "nowrap",
                  padding: "0 2px",
                  transition: "color 150ms",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── SearchInput ───────────────────────────────────────────────────────────────

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
}

function SearchInput({ value, onChange }: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const BASE_SHADOW = "0px 1px 1.5px 0px var(--neutral-700-12)";

  let containerShadow: string;
  if (value.length > 0 && !isFocused) {
    containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--neutral-100)`;
  } else if (isHovered && !isFocused) {
    containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--neutral-200)`;
  } else {
    containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--neutral-100)`;
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "2px",
        backgroundColor: "var(--text-field-bg)",
        padding: "7px",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: containerShadow,
        outlineStyle: "solid",
        outlineWidth: "2px",
        outlineOffset: "3px",
        outlineColor: isFocused ? "var(--focus-ring)" : "transparent",
        transition: "box-shadow 150ms, outline-color 150ms",
        cursor: "text",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left icon */}
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          flexShrink: 0,
          color: "var(--text-field-icon)",
          lineHeight: 0,
        }}
      >
        <SearchOneIcon size={16} />
      </span>

      {/* Input + animated placeholder */}
      <div
        style={{
          position: "relative",
          flex: 1,
          padding: "0 2px",
          display: "flex",
          alignItems: "center",
          minWidth: 0,
        }}
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
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                pointerEvents: "none",
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-regular)",
                fontSize: "var(--font-size-caption)",
                lineHeight: "var(--line-height-caption)",
                color: "var(--text-field-placeholder)",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              Look up your model…
            </motion.span>
          )}
        </AnimatePresence>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-label="Search models"
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            padding: 0,
            fontFamily: "var(--font-body)",
            fontWeight: "var(--font-weight-regular)",
            fontSize: "var(--font-size-caption)",
            lineHeight: "var(--line-height-caption)",
            color: "var(--text-field-text)",
            width: "100%",
          }}
        />
      </div>
    </div>
  );
}

// ── Utility: derive capability icons from model modalities ────────────────────

function getCapabilityIcons(model: AIModel): React.ReactNode {
  const inputs = model.inputModalities ?? [];
  const outputs = model.outputModalities ?? [];
  const icons: React.ReactNode[] = [];

  if (inputs.includes("image") || inputs.includes("vision")) {
    icons.push(<AiVisionRecognitionIcon key="vision" size={16} />);
  }
  if (outputs.includes("image")) {
    icons.push(<ImageTwoIcon key="image" size={16} />);
  }
  if (inputs.includes("audio") || outputs.includes("audio")) {
    icons.push(<AudioWaveOneIcon key="audio" size={16} />);
  }

  return icons.length > 0 ? <>{icons}</> : null;
}

// ── PresetModelSelectorContent ────────────────────────────────────────────────

interface PresetModelSelectorContentProps {
  models: AIModel[];
  selectedModel: AIModel | null;
  onSelect: (model: AIModel) => void;
}

function PresetModelSelectorContent({
  models,
  selectedModel,
  onSelect,
}: PresetModelSelectorContentProps) {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [category, setCategory] = useState("favorites");
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAtTop(el.scrollTop < 34);
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  };

  // Filter models by search + tier
  const filtered = models.filter((m) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !m.modelName.toLowerCase().includes(q) &&
        !m.companyName.toLowerCase().includes(q)
      )
        return false;
    }
    if (tier === "free" && m.modelType !== "free") return false;
    if (tier === "pro" && m.modelType !== "paid") return false;
    return true;
  });

  return (
    <div style={{ padding: "8px" }}>
      {/* Inner container */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          height: "440px",
          maxHeight: "440px",
        }}
      >
        {/* ── Header: search + tier tabs ── */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            width: "100%",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: "1 0 0", minWidth: 0 }}>
            <SearchInput value={search} onChange={setSearch} />
          </div>
          <AnimatedTabsList
            value={tier}
            onValueChange={setTier}
            tabs={TIER_TABS}
            size="small"
          />
        </div>

        {/* ── Featured Muse card ── */}
        <ModelFeaturedCard />

        {/* ── Category tabs + model list ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flex: "1 0 0",
            minHeight: 0,
            width: "100%",
          }}
        >
          {/* Category tabs */}
          <div style={{ flexShrink: 0 }}>
            <AnimatedTabsList
              value={category}
              onValueChange={setCategory}
              tabs={CATEGORY_TABS}
              scrollable
              size="small"
            />
          </div>

          {/* Model list */}
          {filtered.length > 0 && (
            <div
              style={{
                flex: "1 0 0",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Section header — outside scroll so gradient doesn't affect it */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  padding: "4px 8px 2px 34px",
                  flexShrink: 0,
                }}
              >
                <span style={{ ...CAPTION_STYLE, flex: "1 0 0" }}>
                  Top Models
                </span>
                <span style={{ ...CAPTION_STYLE, flexShrink: 0 }}>Input</span>
              </div>

              {/* Scroll area + gradient overlays */}
              <div
                style={{ position: "relative", flex: "1 0 0", minHeight: 0 }}
              >
                {/* Scrollable content */}
                <div
                  className="kaya-scrollbar"
                  onScroll={handleScroll}
                  style={{
                    position: "absolute",
                    inset: 0,
                    overflowY: "auto",
                    overscrollBehaviorY: "contain",
                    padding: "2px",
                    paddingRight: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      marginRight: "-6px",
                    }}
                  >
                    {filtered.map((model) => {
                      const isSelected =
                        selectedModel?.id === model.id &&
                        selectedModel?.modelId === model.modelId;
                      return (
                        <ModelSelectItem
                          key={`${model.id}-${model.modelId}`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          image={
                            <img
                              src={getModelIcon(
                                model.companyName,
                                model.modelName,
                              )}
                              alt=""
                              style={{
                                width: "18px",
                                height: "18px",
                                borderRadius: "4px",
                                display: "block",
                              }}
                            />
                          }
                          label={model.modelName}
                          icons={getCapabilityIcons(model)}
                          selected={isSelected}
                          onClick={() => onSelect(model)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelect(model);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* ── Top fade: progressive blur + color ── */}
                {[
                  { height: 40, blur: 2 },
                  { height: 28, blur: 3 },
                  { height: 18, blur: 5 },
                  { height: 10, blur: 6 },
                ].map(({ height, blur }) => (
                  <div
                    key={blur}
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: `${height}px`,
                      backdropFilter: `blur(${blur}px)`,
                      WebkitBackdropFilter: `blur(${blur}px)`,
                      maskImage:
                        "linear-gradient(to bottom, black 0%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to bottom, black 0%, transparent 100%)",
                      pointerEvents: "none",
                      zIndex: 10,
                      opacity: atTop ? 0 : 1,
                      transition: "opacity 150ms ease",
                    }}
                  />
                ))}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "40px",
                    background:
                      "linear-gradient(to bottom, white 0%, transparent 100%)",
                    pointerEvents: "none",
                    zIndex: 11,
                    opacity: atTop ? 0 : 1,
                    transition: "opacity 150ms ease",
                  }}
                />

                {/* ── Bottom fade: progressive blur + color ── */}
                {[
                  { height: 40, blur: 2 },
                  { height: 28, blur: 3 },
                  { height: 18, blur: 5 },
                  { height: 10, blur: 6 },
                ].map(({ height, blur }) => (
                  <div
                    key={blur}
                    aria-hidden
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${height}px`,
                      backdropFilter: `blur(${blur}px)`,
                      WebkitBackdropFilter: `blur(${blur}px)`,
                      maskImage:
                        "linear-gradient(to top, black 0%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to top, black 0%, transparent 100%)",
                      pointerEvents: "none",
                      zIndex: 10,
                      opacity: atBottom ? 0 : 1,
                      transition: "opacity 150ms ease",
                    }}
                  />
                ))}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "40px",
                    background:
                      "linear-gradient(to top, white 0%, transparent 100%)",
                    pointerEvents: "none",
                    zIndex: 11,
                    opacity: atBottom ? 0 : 1,
                    transition: "opacity 150ms ease",
                  }}
                />
              </div>
            </div>
          )}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "1 0 0",
                fontFamily: "var(--font-body)",
                fontSize: "var(--font-size-caption)",
                color: "var(--neutral-500)",
              }}
            >
              {search ? `No models matching "${search}"` : "No models available"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PresetModelSelectorDialog ──────────────────────────────────────────────────

export function PresetModelSelectorDialog() {
  const { models, selectedModel, selectModel, isOpen, close } =
    useModelSelectorContext();

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              backgroundColor: "rgba(0,0,0,0.25)",
            }}
          />

          {/* Centering shell — full viewport, flex center, never animated */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 51,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              role="dialog"
              aria-modal
              aria-label="Select model"
              style={{
                pointerEvents: "auto",
                width: "480px",
                maxWidth: "calc(100vw - 32px)",
                backgroundColor: "var(--popover-bg)",
                borderRadius: "18px",
                boxShadow: "var(--shadow-popover)",
                isolation: "isolate",
              }}
            >
              <PresetModelSelectorContent
                models={models}
                selectedModel={selectedModel}
                onSelect={selectModel}
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
