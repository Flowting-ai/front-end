"use client";

import React from "react";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { LlmIcon } from "@strange-huge/icons/llm";
import { getModelLlmId } from "@/lib/model-icons";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import {
  ArrowDownOneIcon,
  BubbleChatTemporaryIcon,
  ShareOneIcon,
} from "@strange-huge/icons";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onCitationsToggle?: () => void;
  onTemporaryChat?: React.MouseEventHandler<HTMLButtonElement>;
  onShare?: React.MouseEventHandler<HTMLButtonElement>;
}

// ── Component ─────────────────────────────────────────────────────────────────
// Figma 3220:33872 — absolute, top:-1 / left:-1 / right:-1 so the element
// overlaps the 1px neutral-200 border on three sides. pt-[12px] px-[12px],
// bg rgba(255,255,255,0.1).

export function TopBar({
  onTemporaryChat,
  onShare,
}: TopBarProps) {
  const { selectedModel, isOpen, open, museActive, museAdvanced } =
    useModelSelectorContext();

  const modelLlmId = museActive
    ? null
    : getModelLlmId(selectedModel?.companyName, selectedModel?.modelName);

  const label = museActive
    ? museAdvanced
      ? "Souvenir Muse (Advanced)"
      : "Souvenir Muse (Basic)"
    : selectedModel?.modelName ?? "Souvenir AI · Muse";

  return (
    <div
      style={{
        position:        "absolute",
        top:             -1,
        left:            -1,
        right:           -1,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        paddingTop:      "12px",
        paddingLeft:     "12px",
        paddingRight:    "12px",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        zIndex:          1,
      }}
    >
      {/* ── Left: model selector ── */}
      <Button
        variant="default"
        size="sm"
        rightIcon={<ArrowDownOneIcon />}
        onClick={(e) => open(e.currentTarget)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {(museActive || modelLlmId) && (
            <span
              style={{
                width:          "16px",
                height:         "16px",
                borderRadius:   "4px",
                overflow:       "hidden",
                flexShrink:     0,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
              }}
            >
              {museActive ? (
                <img
                  src="/icons/souvenir-logo-white.svg"
                  width={16}
                  height={16}
                  alt=""
                  style={{ display: "block" }}
                />
              ) : (
                <LlmIcon id={modelLlmId!} variant="avatar" size={16} />
              )}
            </span>
          )}
          {label}
        </span>
      </Button>

      {/* ── Right: temporary chat + share (Figma 3220:33874) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <IconButton
          variant="ghost"
          aria-label="New temporary chat"
          icon={<BubbleChatTemporaryIcon />}
          onClick={onTemporaryChat}
        />
        <IconButton
          variant="ghost"
          aria-label="Share chat"
          icon={<ShareOneIcon />}
          onClick={onShare}
        />
      </div>
    </div>
  );
}
