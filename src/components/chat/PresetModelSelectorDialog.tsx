"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  ImageTwoIcon,
} from "@strange-huge/icons";
import { Tooltip } from "@/components/Tooltip";
import { Popover } from "@/components/Popover";
import { useModelSelectorContext } from "@/context/model-selector-context";
import type { AIModel } from "@/types/ai-model";
import { ModelSelectItem } from "@/components/ModelSelectItem";
import { SouvenirModelIcon } from "@/components/SouvenirModelIcon";
import { trackFeature } from "@/lib/analytics/events";
import { Badge, type BadgeColor } from "@/components/Badge";
import { sortModelsByTier } from "@/lib/ai-models";

// ── Constants ─────────────────────────────────────────────────────────────────

// Scroll cap for the model list itself — the dialog around it has no fixed
// height anymore (see PresetModelSelectorContent's inner container), so this
// is what actually stops it from growing unbounded with a long result set.
const MODEL_LIST_MAX_HEIGHT = 360;

// Small modality indicator icon rendered at the right end of a model row.
function ModelModalityIcons({ model }: { model: AIModel }) {
  const outputs = model.outputModalities ?? [];
  const hasImage = outputs.some((v) => v === "image");
  if (!hasImage) return null;
  return (
    <Tooltip content="Image — can generate images" side="top">
      <span style={{ display: "flex" }}>
        <ImageTwoIcon size={16} />
      </span>
    </Tooltip>
  );
}

// ── Model row hover tooltip — shows the model's tags only (reasoning effort
// was dropped from this surface; the Instructions tab dropped the tooltip
// entirely).

// Deterministic tag → Badge color, same hash duplicated in
// ChangeAgentModelModal/shared.tsx rather than forcing a shared-utils
// extraction for a 4-line pure function.
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

  return modelInfoSection(
    "Tags",
    "No tags for this model yet.",
    hasTags ? (
      <span style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {model.tags!.map((tag) => (
          <Badge key={tag} label={tag} color={tagColor(tag)} />
        ))}
      </span>
    ) : null,
  );
}

// ── PresetModelSelectorContent ────────────────────────────────────────────────

interface PresetModelSelectorContentProps {
  models: AIModel[];
  selectedModel: AIModel | null;
  onSelect: (model: AIModel) => void;
  /** Flip info tooltips to open leftward — set when the anchor trigger sits
   * near the right edge of the viewport (e.g. the project page's top-right
   * model button), leaving no room for them to open to the right. */
  preferLeftTooltips: boolean;
}

function PresetModelSelectorContent({
  models,
  selectedModel,
  onSelect,
  preferLeftTooltips,
}: PresetModelSelectorContentProps) {
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

  // No search — just the 3 tiers, Advanced → Standard → Basic.
  const filtered = sortModelsByTier(models);

  return (
    <div ref={containerRef} style={{ padding: "8px" }}>
      {/* Inner container */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          // No fixed height — the dialog now sizes to its actual content
          // (however many rows match), instead of always reserving the same
          // tall block regardless of result count. The scroll cap lives on
          // the model list itself (MODEL_LIST_MAX_HEIGHT below).
        }}
      >
        {/* ── Model list ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            width: "100%",
          }}
        >
          {filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Scrollable content — sizes to content up to
                  MODEL_LIST_MAX_HEIGHT, then scrolls, instead of always
                  stretching to fill a fixed-height dialog. */}
              <div
                className="kaya-scrollbar"
                style={{
                  maxHeight: `${MODEL_LIST_MAX_HEIGHT}px`,
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
                      selectedModel?.id === model.id &&
                      selectedModel?.modelId === model.modelId;
                    return (
                      <ModelSelectItem
                        key={`${model.id}-${model.modelId}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        image={<SouvenirModelIcon size={18} />}
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
            </div>
          )}

          {/* Empty state — fixed height rather than flex:1 (nothing to grow
              into now that the dialog sizes to content) so the message
              isn't squashed to near-zero height. */}
          {filtered.length === 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "120px",
                fontFamily: "var(--font-body)",
                fontSize: "var(--font-size-caption)",
                color: "var(--neutral-500)",
              }}
            >
              No models available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PresetModelSelectorDialog ──────────────────────────────────────────────────

// Worst-case rendered height of PresetModelSelectorContent, used only to decide
// whether to flip the dropdown above the anchor when there isn't enough room
// below. The dialog itself is fluid (no fixed height) — this is a conservative
// upper estimate (outer padding + gap + MODEL_LIST_MAX_HEIGHT), so it stays
// safe even though the actual rendered height is usually shorter.
const DROPDOWN_HEIGHT = 16 /* outer padding */ + 16 /* gap */ + MODEL_LIST_MAX_HEIGHT;
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

  // NOTE on Dropdown.Float: this dialog is intentionally NOT presented via
  // `Dropdown.Float`. That component clones and renders its own `trigger`
  // element (wrapping it in a ref'd <span> to compute position) — it has no
  // prop for an externally-supplied anchor element. Every real trigger for
  // this dialog (TopBar, chat page, project chat page, agent-configure) lives
  // in a completely different part of the tree and calls
  // `useModelSelectorContext().open(anchorEl)` imperatively from its own
  // button's onClick, while this dialog is mounted once, globally, in
  // `app/(app)/layout.tsx`. There is no way to hand that external `anchorEl`
  // to `Dropdown.Float` without rendering a second, fake trigger element in
  // its place — which would diverge from its real click/focus semantics
  // rather than reuse them. So positioning + outside-click/Escape stay
  // hand-rolled here (computed from `anchorEl` above), and only the *visual
  // chrome* is shared: the panel now renders through `<Popover>` — the same
  // surface primitive `<Dropdown>` itself wraps — instead of hand-styled
  // background/radius/shadow, so it matches the design system's popover
  // surfaces. `variant="modal"` (18 px radius) is used rather than
  // `Dropdown`'s default `"dropdown"` (12 px) because this panel is a rich,
  // multi-section surface (search + scrollable list) rather than a simple
  // menu — per Popover's own documented guidance for
  // when to use each variant. `maxHeight={false}` disables Popover's own
  // internal scroll-cap since `PresetModelSelectorContent` already manages
  // its own fixed-height scroll area with custom fade overlays.
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <m.div
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
            ...style,
          }}
        >
          <Popover
            ref={dropdownRef}
            variant="modal"
            maxHeight={false}
            style={{
              width: `${DROPDOWN_WIDTH}px`,
              maxWidth: `calc(100vw - 32px)`,
              isolation: "isolate",
            }}
          >
            <PresetModelSelectorContent
              models={models}
              selectedModel={selectedModel}
              onSelect={selectModel}
              preferLeftTooltips={preferLeftTooltips}
            />
          </Popover>
        </m.div>
      )}
    </AnimatePresence>
  );
}
