"use client";

import { useModelSelectorContext } from "@/context/model-selector-context";
import { getModelIcon } from "@/lib/model-icons";
import { Button } from "@/components/Button";
import { ArrowDownOneIcon } from "@strange-huge/icons";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onCitationsToggle?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TopBar({
  showCitationsToggle = false,
  citationsOpen = false,
  onCitationsToggle,
}: TopBarProps) {
  const { selectedModel, open } = useModelSelectorContext();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "56px",
        paddingLeft: "20px",
        paddingRight: "16px",
        backgroundColor: "var(--neutral-white)",
        borderBottom: "1px solid var(--neutral-100)",
        flexShrink: 0,
        gap: "12px",
      }}
    >
      {/* ── Left: Model Selector Button ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <Button
          variant="ghost"
          size="md"
          image={getModelIcon(
            selectedModel?.companyName,
            selectedModel?.modelName,
          )}
          rightIcon={<ArrowDownOneIcon size={16} />}
          onClick={open}
          aria-haspopup="dialog"
          aria-expanded={undefined}
        >
          {selectedModel?.modelName ?? "Select model"}
        </Button>
      </div>

      {/* ── Right: Citations toggle ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        {showCitationsToggle && (
          <button
            type="button"
            onClick={onCitationsToggle}
            title={citationsOpen ? "Hide citations" : "Show citations"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: citationsOpen
                ? "var(--blue-50)"
                : "transparent",
              cursor: "pointer",
              color: citationsOpen ? "var(--blue-600)" : "var(--neutral-500)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M2 4h12M2 8h8M2 12h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
