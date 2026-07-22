"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  SearchOneIcon,
  CancelOneIcon,
  AtomTwoIcon,
  AiVisionRecognitionIcon,
  ImageTwoIcon,
  InformationCircleIcon,
} from "@strange-huge/icons";
import { LlmIcon } from "@strange-huge/icons/llm";
import { IconButton } from "@/components/IconButton";
import { Tooltip } from "@/components/Tooltip";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { getModelLlmId } from "@/lib/model-icons";
import type { AIModel } from "@/types/ai-model";
import { ModelSelectItem } from "@/components/ModelSelectItem";
import { trackFeature } from "@/lib/analytics/events";
import { ModelFeaturedCard } from "@/components/ModelFeaturedCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/Tabs";
import { InputField } from "@/components/InputField";
import { Badge, type BadgeColor } from "@/components/Badge";
import { Divider } from "@/components/Divider";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_TABS = [
  { value: "all",   label: "All"     },
  { value: "free",  label: "Starter" },
  { value: "pro",   label: "Pro"     },
  { value: "power", label: "Power"   },
] as const;

const CATEGORY_TABS = [
  { value: "all",    label: "All",    icon: <AtomTwoIcon             size={16} /> },
  { value: "vision", label: "Vision", icon: <AiVisionRecognitionIcon size={16} /> },
  { value: "image",  label: "Image",  icon: <ImageTwoIcon            size={16} /> },
] as const;

// Mirrors the actual filter predicate below (inputModalities/outputModalities
// checks) so this copy never drifts from what the tabs really do.
const CATEGORY_INFO = [
  {
    value: "all",
    label: "All",
    description: "Every model in the catalog — no input/output filter applied.",
  },
  {
    value: "vision",
    label: "Vision",
    description: "Input modalities include image or vision — the model can see images you attach, like screenshots or photos.",
  },
  {
    value: "image",
    label: "Image",
    description: "Output modalities include image — a dedicated image-generation model, not a chat model with an extra output.",
  },
] as const;

function CategoryInfoContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "2px" }}>
      {CATEGORY_INFO.map((c, i) => (
        <React.Fragment key={c.value}>
          {i > 0 && <Divider decorative />}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ ...CAPTION_STYLE, fontWeight: 700, whiteSpace: "normal", color: "var(--tooltip-text)" }}>
              {c.label}
            </span>
            <span style={{ ...CAPTION_STYLE, fontWeight: 400, whiteSpace: "normal", color: "var(--tooltip-text)", opacity: 0.8 }}>
              {c.description}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

const CAPTION_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: "var(--font-weight-medium)",
  fontSize: "var(--font-size-caption)",
  lineHeight: "var(--line-height-caption)",
  color: "var(--neutral-500)",
  whiteSpace: "nowrap",
};

// Same modality checks as the category filter (kept in sync deliberately) —
// rendered as the model row's own right-end badges instead of a filter.
function ModelModalityIcons({ model }: { model: AIModel }) {
  const inputs = model.inputModalities ?? [];
  const outputs = model.outputModalities ?? [];
  const hasVision = inputs.some((v) => v === "image" || v === "vision");
  const hasImage = outputs.some((v) => v === "image");
  if (!hasVision && !hasImage) return null;
  return (
    <>
      {hasVision && (
        <Tooltip content="Vision — can see images you attach" side="top">
          <span style={{ display: "flex" }}>
            <AiVisionRecognitionIcon size={16} />
          </span>
        </Tooltip>
      )}
      {hasImage && (
        <Tooltip content="Image — can generate images" side="top">
          <span style={{ display: "flex" }}>
            <ImageTwoIcon size={16} />
          </span>
        </Tooltip>
      )}
    </>
  );
}

// ── Model row hover tooltip — mirrors the Instructions tab's model picker
// (app/(app)/agent/configure/instructions/page.tsx) so tags / reasoning
// effort / description read the same way in both surfaces.

// Deterministic tag → Badge color, same hash as the Instructions tab's
// local tagColor (not exported there, so duplicated here rather than
// forcing a shared-utils extraction for a 4-line pure function).
const TAG_PALETTE: BadgeColor[] = ["Green", "Blue", "Purple", "Brown", "Yellow"];
function tagColor(tag: string): BadgeColor {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

// The tooltip renders on the dark gradient background (--tooltip-bg-from/to),
// so headers and empty-state copy dim the light --tooltip-text color via
// opacity instead of a light-mode neutral shade that would read low-contrast.
const TOOLTIP_SECTION_HEADER_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: "var(--font-weight-medium)",
  fontSize: "var(--font-size-caption)",
  lineHeight: "var(--line-height-caption)",
  color: "var(--tooltip-text)",
  opacity: 0.6,
};

const TOOLTIP_EMPTY_TEXT_STYLE: React.CSSProperties = {
  color: "var(--tooltip-text)",
  opacity: 0.6,
  fontStyle: "italic",
};

function modelInfoSection(header: string, emptyText: string, content: React.ReactNode | null): React.ReactNode {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={TOOLTIP_SECTION_HEADER_STYLE}>{header}</span>
      {content ?? <span style={TOOLTIP_EMPTY_TEXT_STYLE}>{emptyText}</span>}
    </span>
  );
}

function modelInfoContent(model: AIModel): React.ReactNode {
  const hasTags = !!(model.tags && model.tags.length > 0);
  const hasEfforts = !!(model.thinkingEfforts && model.thinkingEfforts.length > 0);

  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {modelInfoSection(
        "Tags",
        "No tags for this model yet.",
        hasTags ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {model.tags!.map((tag) => (
              <Badge key={tag} label={tag} color={tagColor(tag)} />
            ))}
          </span>
        ) : null,
      )}

      <Divider decorative />

      {modelInfoSection(
        "Description",
        "No information on this model yet.",
        model.description ? <span>{model.description}</span> : null,
      )}

      <Divider decorative />

      {modelInfoSection(
        "Reasoning effort",
        "No reasoning effort levels for this model yet.",
        hasEfforts ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {model.thinkingEfforts!.map((effort) => (
              <Badge key={effort} label={effort} color="Purple" />
            ))}
          </span>
        ) : null,
      )}
    </span>
  );
}

// ── Featured mode row (Muse / Advanced) ──────────────────────────────────────
// Two ModelFeaturedCards side-by-side, behaving as a radio pair.
// One card is always selected; initialMode seeds local state on mount.

type FeaturedMode = "muse" | "advanced"

interface FeaturedModeRowProps {
  /** null means neither card is selected (a specific model is active) */
  mode: FeaturedMode | null
  onMuseSelect: () => void
  onAdvancedSelect: () => void
}

function FeaturedModeRow({ mode, onMuseSelect, onAdvancedSelect }: FeaturedModeRowProps) {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", width: "100%", flexShrink: 0 }}>
      <div style={{ flex: "1 0 0", minWidth: 0 }}>
        <ModelFeaturedCard
          subtitle="Souvenir Muse"
          title="Basic"
          description="Cost-efficient routing for everyday tasks. Fast, smart, and easy on your credits."
          selected={mode === "muse"}
          onSelectedChange={(next) => { if (next) onMuseSelect() }}
        />
      </div>
      <div style={{ flex: "1 0 0", minWidth: 0 }}>
        <ModelFeaturedCard
          subtitle="Souvenir Muse"
          title="Advanced"
          description="Top-tier models for your most demanding work. Maximum quality, no compromises."
          selected={mode === "advanced"}
          onSelectedChange={(next) => { if (next) onAdvancedSelect() }}
        />
      </div>
    </div>
  )
}

// ── PresetModelSelectorContent ────────────────────────────────────────────────

interface PresetModelSelectorContentProps {
  models: AIModel[];
  selectedModel: AIModel | null;
  onSelect: (model: AIModel) => void;
  museActive: boolean;
  museAdvanced: boolean;
  onMuseSelect: () => void;
  onAdvancedSelect: () => void;
  /** Flip info tooltips to open leftward — set when the anchor trigger sits
   * near the right edge of the viewport (e.g. the project page's top-right
   * model button), leaving no room for them to open to the right. */
  preferLeftTooltips: boolean;
}

function PresetModelSelectorContent({
  models,
  selectedModel,
  onSelect,
  museActive,
  museAdvanced,
  onMuseSelect,
  onAdvancedSelect,
  preferLeftTooltips,
}: PresetModelSelectorContentProps) {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [category, setCategory] = useState("all");
  const [provider, setProvider] = useState("all");
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  // Tracks the panel's own rendered width so each row's info tooltip can be
  // capped to match it (the dialog's width can shrink below DROPDOWN_WIDTH
  // via its `calc(100vw - 32px)` clamp on narrow viewports).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dropdownWidth, setDropdownWidth] = useState(DROPDOWN_WIDTH);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDropdownWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Derive sorted company list (most models first) — same logic as CompareModels
  const companies = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of models) counts[m.companyName] = (counts[m.companyName] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [models]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAtTop(el.scrollTop < 34);
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  };

  // Filter models by search + tier + category + provider
  const filtered = models.filter((m) => {
    if (provider !== "all" && m.companyName !== provider) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !m.modelName.toLowerCase().includes(q) &&
        !m.companyName.toLowerCase().includes(q)
      )
        return false;
    }
    // Mirror CompareModels tierLabel logic: planType is the raw backend value.
    const tl = ((m.planType ?? m.callType ?? m.modelType) as string ?? "").toLowerCase();
    if (tier === "free"  && tl !== "free"  && tl !== "starter") return false;
    if (tier === "pro"   && tl !== "paid"  && tl !== "pro")     return false;
    if (tier === "power" && tl !== "power")                     return false;

    if (category !== "all") {
      const inputs  = m.inputModalities  ?? [];
      const outputs = m.outputModalities ?? [];
      switch (category) {
        case "vision":
          if (!inputs.some((v) => v === "image" || v === "vision")) return false;
          break;
        case "image":
          if (!outputs.some((v) => v === "image")) return false;
          break;
      }
    }

    return true;
  });

  return (
    <div ref={containerRef} style={{ padding: "8px" }}>
      {/* Inner container */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          height: "500px",
          maxHeight: "500px",
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
          <div style={{ flex: "1 1 0", minWidth: 100 }}>
            <InputField
              size="small"
              showLabel={false}
              label="Search models"
              showSubtitle={false}
              leftIcon={<SearchOneIcon size={16} />}
              rightIcon={search ? (
                <IconButton
                  size="xs"
                  variant="ghost"
                  aria-label="Clear search"
                  icon={<CancelOneIcon size={12} />}
                  onClick={() => setSearch("")}
                />
              ) : undefined}
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

        {/* ── Featured: Muse + Advanced radio pair ── */}
        <FeaturedModeRow
          mode={museActive ? (museAdvanced ? "advanced" : "muse") : null}
          onMuseSelect={onMuseSelect}
          onAdvancedSelect={onAdvancedSelect}
        />

        {/* ── Provider / company filter tabs (below Muse buttons) ── */}
        {companies.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <Tabs value={provider} onValueChange={setProvider}>
              <TabsList size="small" scrollable justify="space-evenly" pillTopInset={0.5} pillBottomInset={1}>
                <TabsTrigger value="all" icon={<AtomTwoIcon size={16} />}>
                  All
                </TabsTrigger>
                {companies.map((company) => {
                  const rep   = models.find((m) => m.companyName === company);
                  const llmId = rep ? (getModelLlmId(rep.companyName, rep.modelName) ?? "") : "";
                  return (
                    <TabsTrigger
                      key={company}
                      value={company}
                      icon={llmId ? <LlmIcon id={llmId} variant="color" size={16} /> : undefined}
                    >
                      {company}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

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
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <div style={{ flex: "0 1 auto", minWidth: 0 }}>
              <Tabs value={category} onValueChange={setCategory}>
                <TabsList size="small" scrollable pillTopInset={0.5} pillBottomInset={1}>
                  {CATEGORY_TABS.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} icon={t.icon}>
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <Tooltip content={<CategoryInfoContent />} side={preferLeftTooltips ? "left" : "right"} align="center" maxWidth={280}>
              <IconButton
                size="xs"
                variant="ghost"
                icon={<InformationCircleIcon size={16} />}
                aria-label="What do All, Vision, and Image filter on?"
              />
            </Tooltip>
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
              {/* Section header - outside scroll so gradient doesn't affect it */}
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
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {filtered.map((model) => {
                      const isSelected =
                        !museActive &&
                        selectedModel?.id === model.id &&
                        selectedModel?.modelId === model.modelId;
                      return (
                        <ModelSelectItem
                          key={`${model.id}-${model.modelId}`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          llm={getModelLlmId(model.companyName, model.modelName) ?? undefined}
                          label={model.modelName}
                          icons={<ModelModalityIcons model={model} />}
                          info={modelInfoContent(model)}
                          infoSide={preferLeftTooltips ? "left" : "right"}
                          infoMaxWidth={dropdownWidth}
                          selected={isSelected}
                          onClick={() => {
                            trackFeature("model_selector_manual", { model_id: String(model.modelId), model_type: model.modelType });
                            onSelect(model);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              trackFeature("model_selector_manual", { model_id: String(model.modelId), model_type: model.modelType });
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

// Approximate rendered height of PresetModelSelectorContent (500px inner + 16px padding)
const DROPDOWN_HEIGHT = 516;
const DROPDOWN_WIDTH = 432;
const GAP = 8;

export function PresetModelSelectorDialog() {
  const {
    models,
    selectedModel,
    selectModel,
    isOpen,
    anchorEl,
    close,
    museActive,
    museAdvanced,
    activateMuse,
    deactivateMuse,
    setMuseAdvanced,
  } = useModelSelectorContext();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  // When the anchor (the "Model" trigger button) sits near the right edge of
  // the viewport — e.g. the project overview page's top-right button — the
  // dropdown panel below gets clamped so its own right edge hugs the
  // viewport boundary, leaving no room for tooltips that open further right.
  // Flip those to the left in that case.
  const [preferLeftTooltips, setPreferLeftTooltips] = useState(false);

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
    setPreferLeftTooltips(left + DROPDOWN_WIDTH >= vw - 24);
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
        <m.div
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
            museActive={museActive}
            museAdvanced={museAdvanced}
            onMuseSelect={() => { setMuseAdvanced(false); activateMuse() }}
            onAdvancedSelect={() => { setMuseAdvanced(true); close() }}
            preferLeftTooltips={preferLeftTooltips}
          />
        </m.div>
      )}
    </AnimatePresence>
  );
}
