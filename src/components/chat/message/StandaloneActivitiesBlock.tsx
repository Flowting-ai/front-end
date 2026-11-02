"use client";

import React, { useState } from "react";
import { m } from "framer-motion";
import { ActivitiesSection } from "../ActivityRow";
import type { ActivityItem } from "@/types/chat";

// ── Standalone Activities Block (collapsible, used when no reasoning) ─────────

const wrapperStyle: React.CSSProperties = { margin: "4px 0 8px" };

const headerRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, minHeight: 20, userSelect: "none" };

const summaryStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--neutral-600)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
};

const toggleStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 3,
  display: "flex",
  alignItems: "center",
  borderRadius: 4,
  flexShrink: 0,
};

const chevronStyle: React.CSSProperties = { display: "block", flexShrink: 0 };

const clipStyle: React.CSSProperties = { overflow: "hidden", minHeight: 0 };

const panelStyle: React.CSSProperties = { paddingTop: 10 };

export function StandaloneActivitiesBlock({
  activities,
}: {
  activities: ActivityItem[];
}) {
  const [isOpen, setIsOpen] = useState(true);

  // Derive summary for collapsed state
  const doneCount = activities.filter((a) => a.status === "done").length;
  const allDone = doneCount === activities.length;
  const summaryText = allDone
    ? `${activities.length} ${activities.length === 1 ? "action" : "actions"} completed`
    : `${doneCount}/${activities.length} actions`;

  return (
    <div style={wrapperStyle}>
      {/* Header row - summary + chevron. Logo/model name live in the
          message-level attribution header above this block, not here. */}
      <div draggable={false} style={headerRowStyle}>
        <span style={summaryStyle}>
          {summaryText}
        </span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          type="button"
          style={toggleStyle}
        >
          <m.svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={chevronStyle}
          >
            <path
              d="M3 5.5 L7 9.5 L11 5.5"
              stroke="var(--neutral-300)"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </m.svg>
        </button>
      </div>

      {/* Collapsible activities panel — grid-rows collapse instead of
          animating `height`, so the transition runs on the compositor
          instead of forcing a layout recalculation every frame. */}
      <div
        aria-hidden={!isOpen}
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? "visible" : "hidden",
          transition: `grid-template-rows 260ms cubic-bezier(0.16,1,0.3,1), opacity 220ms ease, visibility 0s linear ${isOpen ? "0s" : "260ms"}`,
        }}
      >
        <div style={clipStyle}>
          <div style={panelStyle}>
            <ActivitiesSection activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
