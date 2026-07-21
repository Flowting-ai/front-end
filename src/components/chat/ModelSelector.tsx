"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import type { AIModel } from "@/types/ai-model";
import { LlmIcon } from "@strange-huge/icons/llm";
import { InformationCircleIcon } from "@strange-huge/icons";
import { getModelLlmId } from "@/lib/model-icons";
import { Badge, type BadgeColor } from "@/components/Badge";
import { Tooltip } from "@/components/Tooltip";
import { recordModelUsage } from "@/lib/model-usage";

const TAG_PALETTE: BadgeColor[] = ["Green", "Blue", "Purple", "Brown", "Yellow"];
function tagColor(tag: string): BadgeColor {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

// ── Per-item component so each row can track its own hover state ──────────────

function ModelSelectorItem({
  model,
  isSelected,
  onClick,
}: {
  model: AIModel;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const tooltipContent =
    model.description || (model.thinkingEfforts && model.thinkingEfforts.length > 0) ? (
      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {model.description && <span>{model.description}</span>}
        {model.thinkingEfforts && model.thinkingEfforts.length > 0 && (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {model.thinkingEfforts.map((effort) => (
              <Badge key={effort} label={effort} color="Purple" />
            ))}
          </span>
        )}
      </span>
    ) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        padding: "10px 12px",
        borderRadius: "10px",
        border: "none",
        backgroundColor: isSelected ? "var(--blue-50)" : "transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "background-color 100ms",
      }}
    >
      {/* Avatar ↔ info icon slot */}
      <Tooltip
        content={tooltipContent}
        side="right"
        maxWidth={220}
        disabled={!tooltipContent || !isHovered}
      >
        <span
          style={{
            position: "relative",
            flexShrink: 0,
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 0,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {isHovered ? (
              <m.span
                key="info"
                initial={{ scale: 0.7, opacity: 0, filter: "blur(4px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                exit={{ scale: 0.7, opacity: 0, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--neutral-500)",
                  lineHeight: 0,
                }}
              >
                <InformationCircleIcon size={20} />
              </m.span>
            ) : (
              <m.span
                key="logo"
                initial={{ scale: 0.7, opacity: 0, filter: "blur(4px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                exit={{ scale: 0.7, opacity: 0, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{ display: "flex", lineHeight: 0 }}
              >
                <LlmIcon
                  id={getModelLlmId(model.companyName, model.modelName) ?? ""}
                  variant="color"
                  size={24}
                />
              </m.span>
            )}
          </AnimatePresence>
        </span>
      </Tooltip>

      {/* Model info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: "var(--font-weight-medium)",
            color: "var(--neutral-900)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {model.modelName}
        </div>
        {model.description && (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "var(--neutral-500)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: "2px",
            }}
          >
            {model.description}
          </div>
        )}
        {model.tags && model.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {model.tags.map((tag) => (
              <Badge key={tag} label={tag} color={tagColor(tag)} />
            ))}
            {model.thinkingEfforts && model.thinkingEfforts.length > 0 &&
              model.thinkingEfforts.map((effort) => (
                <Badge key={`effort-${effort}`} label={effort} color="Purple" />
              ))}
          </div>
        )}
      </div>

      {/* Plan badge */}
      {model.modelType === "paid" && <Badge label="Pro" color="Blue" />}

      {/* Selected check */}
      {isSelected && (
        <span style={{ color: "var(--blue-600)", fontSize: "16px" }}>✓</span>
      )}
    </button>
  );
}

interface ModelSelectorProps {
  models: AIModel[];
  selectedModel: AIModel | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (model: AIModel) => void;
}

export function ModelSelector({
  models,
  selectedModel,
  isOpen,
  onOpenChange,
  onSelect,
}: ModelSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredModels = models.filter((model) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      model.modelName.toLowerCase().includes(query) ||
      model.companyName.toLowerCase().includes(query)
    );
  });

  // Group by provider
  const grouped = filteredModels.reduce<Record<string, AIModel[]>>(
    (acc, model) => {
      const provider = model.companyName;
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    },
    {},
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              backgroundColor: "rgba(0,0,0,0.3)",
            }}
          />

          {/* Dialog */}
          <m.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="dialog"
            aria-label="Select model"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 51,
              width: "480px",
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "calc(100vh - 64px)",
              backgroundColor: "var(--neutral-white)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-xl)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--neutral-200)",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--font-size-body-lg)",
                  fontWeight: "var(--font-weight-semibold)",
                  color: "var(--neutral-900)",
                  margin: 0,
                }}
              >
                Select Model
              </h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--neutral-600)",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: "12px 20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--neutral-200)",
                  backgroundColor: "var(--neutral-50)",
                }}
              >
                <Search size={16} style={{ color: "var(--neutral-400)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    backgroundColor: "transparent",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--font-size-body-sm)",
                    color: "var(--neutral-900)",
                  }}
                />
              </div>
            </div>

            {/* Model list */}
            <div
              className="kaya-scrollbar"
              style={{
                flex: 1,
                overflowY: "auto",
                paddingBottom: "16px",
              }}
            >
              {/* Horizontal padding lives on this inner wrapper, not the
                  scrolling element above — keeps the scrollbar flush with the
                  dropdown's edge. */}
              <div style={{ padding: "0 12px" }}>
              {Object.entries(grouped).map(([provider, providerModels]) => (
                <div key={provider} style={{ marginBottom: "12px" }}>
                  {/* Provider label */}
                  <div
                    style={{
                      padding: "8px 8px 4px",
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      fontWeight: "var(--font-weight-semibold)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--neutral-500)",
                    }}
                  >
                    {provider}
                  </div>

                  {/* Models */}
                  {providerModels.map((model) => {
                    const isSelected =
                      selectedModel?.id === model.id &&
                      selectedModel?.modelId === model.modelId;

                    return (
                      <ModelSelectorItem
                        key={`${model.id}-${model.modelId}`}
                        model={model}
                        isSelected={isSelected}
                        onClick={() => {
                          recordModelUsage(model);
                          onSelect(model);
                          onOpenChange(false);
                        }}
                      />
                    );
                  })}
                </div>
              ))}

              {filteredModels.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "24px",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--font-size-body-sm)",
                    color: "var(--neutral-500)",
                  }}
                >
                  {search
                    ? `No models matching "${search}"`
                    : "No models available"}
                </div>
              )}
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
