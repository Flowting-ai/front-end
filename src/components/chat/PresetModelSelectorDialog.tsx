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
import { ModelSelectItem } from "@/components/ModelSelectItem";
import { ModelFeaturedCard } from "@/components/ModelFeaturedCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/Tabs";
import { InputField } from "@/components/InputField";

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

const CAPTION_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: "var(--font-weight-medium)",
  fontSize: "var(--font-size-caption)",
  lineHeight: "var(--line-height-caption)",
  color: "var(--neutral-500)",
  whiteSpace: "nowrap",
};

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
            <InputField
              size="small"
              showLabel={false}
              label="Search models"
              showSubtitle={false}
              leftIcon={<SearchOneIcon size={16} />}
              placeholder="Look up your model…"
              value={search}
              onChange={setSearch}
              fluid
            />
          </div>
          <Tabs value={tier} onValueChange={setTier}>
            <TabsList size="small">
              {TIER_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* ── Featured Muse card ── */}
        <ModelFeaturedCard
          title="Muse"
          description="Knows the work before you ask. Each task finds its way to the right mind, without you lifting a setting."
          learnMoreHref="#"
          proSwitch
        />

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
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList size="small" scrollable>
                {CATEGORY_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} icon={t.icon}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
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
                  padding: "4px 38px 2px 34px",
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

// Approximate rendered height of PresetModelSelectorContent (440px inner + 16px padding)
const DROPDOWN_HEIGHT = 456;
const DROPDOWN_WIDTH = 480;
const GAP = 8;

export function PresetModelSelectorDialog() {
  const { models, selectedModel, selectModel, isOpen, anchorEl, close } =
    useModelSelectorContext();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  // Compute fixed position from anchor element each time the dropdown opens
  useLayoutEffect(() => {
    if (!isOpen || !anchorEl) return;

    const rect = anchorEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Vertical: prefer below, flip above if not enough space
    const spaceBelow = vh - rect.bottom - GAP;
    const openAbove = spaceBelow < DROPDOWN_HEIGHT && rect.top >= DROPDOWN_HEIGHT + GAP;
    const top = openAbove ? rect.top - GAP - DROPDOWN_HEIGHT : rect.bottom + GAP;

    // Horizontal: left-align with anchor, clamp to viewport
    const rawLeft = rect.left;
    const left = Math.min(rawLeft, vw - DROPDOWN_WIDTH - 16);

    setStyle({ top, left: Math.max(16, left) });
  }, [isOpen, anchorEl]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        anchorEl?.contains(e.target as Node)
      ) return;
      close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, anchorEl, close]);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          key="dropdown"
          role="dialog"
          aria-modal
          aria-label="Select model"
          initial={{ opacity: 0, scale: 0.97, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -4 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{
            position: "fixed",
            zIndex: 51,
            width: `${DROPDOWN_WIDTH}px`,
            maxWidth: `calc(100vw - 32px)`,
            backgroundColor: "var(--popover-bg)",
            borderRadius: "18px",
            boxShadow: "var(--shadow-popover)",
            isolation: "isolate",
            ...style,
          }}
        >
          <PresetModelSelectorContent
            models={models}
            selectedModel={selectedModel}
            onSelect={selectModel}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
