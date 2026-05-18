"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useProjects } from "@/context/projects-context";
import { LlmIcon } from "@strange-huge/icons/llm";
import { getModelLlmId } from "@/lib/model-icons";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { ArrowDownOneIcon } from "@strange-huge/icons";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onCitationsToggle?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TopBar({ showCitationsToggle, citationsOpen, onCitationsToggle }: TopBarProps) {
  const { selectedModel, isOpen, open, museActive, museAdvanced } =
    useModelSelectorContext();
  const { getProject, getChats } = useProjects();
  const pathname = usePathname();

  // Detect page type from pathname
  const projectChatMatch = pathname.match(/^\/project\/([^/]+)\/chat\/([^/]+)$/);
  const isProjectChatPage  = !!projectChatMatch;
  // Suppress temp/share on all project pages except project chat (which shows context label instead)
  const isProjectDetailPage = pathname.startsWith('/project') && !isProjectChatPage;
  const isChatsPage         = pathname === '/chats';

  const modelLlmId = museActive
    ? null
    : getModelLlmId(selectedModel?.companyName, selectedModel?.modelName);

  const label = museActive
    ? museAdvanced
      ? "Souvenir Muse (Advanced)"
      : "Souvenir Muse (Basic)"
    : selectedModel?.modelName ?? "Souvenir AI · Muse";

  const modelSelectorButton = (
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
              <img src="/icons/souvenir-logo-white.svg" width={16} height={16} alt="" style={{ display: "block" }} />
            ) : (
              <LlmIcon
                id={modelLlmId!}
                variant={modelLlmId === 'OpenAI' ? 'color' : 'avatar'}
                size={16}
                style={modelLlmId === 'OpenAI' ? { filter: 'brightness(0) invert(1)' } : undefined}
              />
            )}
          </span>
        )}
        {label}
      </span>
    </Button>
  );

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
      {isProjectChatPage && projectChatMatch ? (
        <>
          {/* ── Left: model selector, then project + chat name ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: "1 1 0" }}>
            <div style={{ flexShrink: 0 }}>{modelSelectorButton}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", minWidth: 0, overflow: "hidden" }}>
              <span
                style={{
                  fontFamily:   "var(--font-body)",
                  fontWeight:   "var(--font-weight-semibold)",
                  fontSize:     "13px",
                  lineHeight:   "20px",
                  color:        "var(--neutral-900)",
                  whiteSpace:   "nowrap",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  flexShrink:   1,
                  minWidth:     0,
                }}
              >
                {getProject(projectChatMatch[1])?.name ?? ""}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--font-weight-medium)",
                  fontSize:   "13px",
                  lineHeight: "20px",
                  color:      "var(--neutral-500)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                ·
              </span>
              <span
                style={{
                  fontFamily:   "var(--font-body)",
                  fontWeight:   "var(--font-weight-medium)",
                  fontSize:     "13px",
                  lineHeight:   "20px",
                  color:        "var(--neutral-500)",
                  whiteSpace:   "nowrap",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  flexShrink:   2,
                  minWidth:     0,
                }}
              >
                {getChats(projectChatMatch[1]).find(c => c.id === projectChatMatch[2])?.title ?? ""}
              </span>
            </div>
          </div>

        </>
      ) : (
        <>
          {/* ── Left: model selector (hidden on project pages) ── */}
          {!isProjectDetailPage && !isChatsPage && modelSelectorButton}

        </>
      )}
    </div>
  );
}
