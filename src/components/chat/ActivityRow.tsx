"use client";

import React, { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiWebBrowsingIcon,
  PdfIcon,
  CodeIcon,
  AiSheetsIcon,
  Link01Icon,
  Doc01Icon,
  AiBrain01Icon,
  Spinner,
  Checkmark,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { QuillWriteOneIcon, NeuralNetworkIcon } from "@strange-huge/icons";
import type { ActivityItem, ActivityType } from "@/hooks/use-chat-state";

// ── Activity type display config ──────────────────────────────────────────────

const ACTIVITY_VERB: Record<ActivityType, string> = {
  "web-search": "Searching the web",
  "read-pages": "Reading document",
  "csv-execute": "Analysing data",
  "fetch-resource": "Fetching resource",
  "tool-call": "Running tool",
  "doc-execute": "Generating document",
  "docx-progress": "Generating document",
  "skills": "Loading skill",
  "other": "Processing",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconEntry = { icon: any; isHuge: boolean };

const ACTIVITY_ICON: Record<ActivityType, IconEntry> = {
  "web-search":    { icon: AiWebBrowsingIcon,  isHuge: true  },
  "read-pages":    { icon: PdfIcon,            isHuge: true  },
  "csv-execute":   { icon: AiSheetsIcon,       isHuge: true  },
  "fetch-resource":{ icon: Link01Icon,         isHuge: true  },
  "tool-call":     { icon: CodeIcon,           isHuge: true  },
  "doc-execute":   { icon: QuillWriteOneIcon,  isHuge: false },
  "docx-progress": { icon: Doc01Icon,          isHuge: true  },
  "skills":        { icon: NeuralNetworkIcon,  isHuge: false },
  "other":         { icon: AiBrain01Icon,      isHuge: true  },
};

// ── Icon helper ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function HIcon({ icon, size = 14, color = "#827A74", strokeWidth = 1.5 }: { icon: any; size?: number; color?: string; strokeWidth?: number }) {
  return <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} />;
}

function ActivityIcon({ type, isDone }: { type: ActivityType; isDone: boolean }) {
  const { icon, isHuge } = ACTIVITY_ICON[type] ?? ACTIVITY_ICON["other"];
  const color = isDone ? "#80B707" : "#827A74";
  if (isHuge) return <HIcon icon={icon} size={14} color={color} strokeWidth={1.5} />;
  const Icon = icon as React.ComponentType<{ size?: number; color?: string }>;
  return <Icon size={14} color={color} />;
}

// Spinner using HugeIcons Spinner icon (rotating)
function SpinnerIcon() {
  return (
    <m.span
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      style={{ display: "flex", alignItems: "center", lineHeight: 0, flexShrink: 0 }}
    >
      <HIcon icon={Spinner} size={14} color="#B6ACA4" strokeWidth={2} />
    </m.span>
  );
}

// Checkmark using HugeIcons Checkmark icon (green)
function CheckmarkIcon() {
  return (
    <span style={{ display: "flex", alignItems: "center", lineHeight: 0, flexShrink: 0 }}>
      <HIcon icon={Checkmark} size={14} color="#80B707" strokeWidth={2.5} />
    </span>
  );
}

// Error icon
function ErrorIcon() {
  return (
    <span style={{ display: "flex", alignItems: "center", lineHeight: 0, flexShrink: 0 }}>
      <HIcon icon={Cancel01Icon} size={14} color="var(--red-500, #DC3545)" strokeWidth={2} />
    </span>
  );
}

// ── Favicon helper ───────────────────────────────────────────────────────────

function FaviconImg({ domain, size = 14 }: { domain?: string; size?: number }) {
  if (!domain || domain === "pin") return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- external favicon URL, next/image doesn't support arbitrary external domains without config
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      width={size}
      height={size}
      alt=""
      style={{ borderRadius: 3, flexShrink: 0, display: "block" }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ── ActivityRow component ─────────────────────────────────────────────────────

export function ActivityRow({ activity }: { activity: ActivityItem }) {
  const isActive = activity.status === "start" || activity.status === "executing" || activity.status === "reading";
  const isDone = activity.status === "done";
  const isError = activity.status === "error";
  const verb = activity.label ?? ACTIVITY_VERB[activity.type] ?? "Processing";
  const hasResults = activity.results && activity.results.length > 0;
  // Web-search results auto-expand (visible inline while done); other types need a click
  const isWebSearch = activity.type === "web-search";
  const [manualOpen, setManualOpen] = useState(false);
  const resultsVisible = isWebSearch ? (isDone && hasResults) : manualOpen;

  // Build detail text
  const detailText = activity.detail || activity.toolName?.replace(/_/g, " ") || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header row - clickable when has results */}
      <button
        onClick={() => !isWebSearch && hasResults && setManualOpen(!manualOpen)}
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: "none",
          cursor: (!isWebSearch && hasResults) ? "pointer" : "default",
          padding: "4px 0",
          width: "100%",
          textAlign: "left",
          fontFamily: "var(--font-body)",
        }}
      >
        {/* Status icon - spinner, checkmark, or error */}
        {isActive && <SpinnerIcon />}
        {isDone && <CheckmarkIcon />}
        {isError && <ErrorIcon />}

        {/* Activity type icon */}
        <span style={{ display: "flex", alignItems: "center", lineHeight: 0, flexShrink: 0 }}>
          <ActivityIcon type={activity.type} isDone={isDone} />
        </span>

        {/* Verb */}
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--neutral-600, #524B47)", flexShrink: 0 }}>
          {verb}
        </span>

        {/* Detail */}
        {detailText && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: "var(--neutral-400, #9A9089)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            - {detailText}
          </span>
        )}

        {/* Result count */}
        {isDone && hasResults && (
          <span style={{ fontSize: 14, fontWeight: 400, color: "var(--neutral-300, #B6ACA4)", flexShrink: 0 }}>
            {activity.results!.length} {activity.type === "web-search" ? "results" : "files"}
          </span>
        )}

        {/* Duration */}
        {isDone && activity.durationS !== undefined && (
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--neutral-300, #B6ACA4)", flexShrink: 0 }}>
            {activity.durationS < 1 ? `${Math.round(activity.durationS * 1000)}ms` : `${activity.durationS.toFixed(1)}s`}
          </span>
        )}

        {/* Active "working..." indicator */}
        {isActive && (
          <m.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ fontSize: 14, fontWeight: 400, color: "var(--neutral-300, #C0B5AD)", flexShrink: 0 }}
          >
            working…
          </m.span>
        )}

        {/* Action badge + chevron for non-web-search expandable rows */}
        {!isWebSearch && isDone && hasResults && (
          <>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--neutral-600, #6A625D)",
                letterSpacing: "0.4px",
                background: "rgba(59,54,50,0.08)",
                borderRadius: 4,
                padding: "1px 5px",
                flexShrink: 0,
                textTransform: "uppercase",
              }}
            >
              Action
            </span>
            <m.svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              animate={{ rotate: manualOpen ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{ display: "block", flexShrink: 0 }}
            >
              <path d="M3 5.5 L7 9.5 L11 5.5" stroke="var(--neutral-400, #9C938B)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </m.svg>
          </>
        )}
      </button>

      {/* Results list - web-search auto-expands, others behind chevron */}
      <AnimatePresence initial={false}>
        {resultsVisible && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 300, damping: 28 },
              opacity: { duration: 0.2 },
            }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 48, paddingTop: 4, paddingBottom: 4 }}>
              {activity.results!.map((r, ri) => (
                <m.a
                  key={ri}
                  href={r.url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: ri * 0.05, duration: 0.18 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 13, fontWeight: 400, minHeight: 20,
                    textDecoration: "none",
                    borderRadius: 6,
                    padding: "2px 4px",
                    margin: "0 -4px",
                    color: "inherit",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,54,50,0.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <FaviconImg domain={r.domain} size={13} />
                  {!r.domain && <span style={{ color: "var(--neutral-300, #C0B5AD)", flexShrink: 0 }}>·</span>}
                  <span style={{ color: "var(--neutral-700, #524B47)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </span>
                  {r.domain && r.domain !== "pin" && (
                    <span style={{ color: "var(--neutral-300, #C0B5AD)", flexShrink: 0, fontSize: 12 }}>{r.domain}</span>
                  )}
                  {r.domain === "pin" && (
                    <span style={{ color: "var(--neutral-400, #9A9089)", flexShrink: 0, fontStyle: "italic", fontSize: 12 }}>pin</span>
                  )}
                </m.a>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Progress message (for tool_progress / docx_progress) */}
      {isActive && activity.progressMessage && (
        <div style={{ paddingLeft: 44, fontSize: 13, color: "var(--neutral-400, #9A9089)", fontStyle: "italic", paddingTop: 4 }}>
          {activity.progressMessage}
        </div>
      )}
    </div>
  );
}

// ── Activities section - renders all activities ───────────────────────────────

export function ActivitiesSection({ activities }: { activities: ActivityItem[] }) {
  if (!activities || activities.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
      {activities.map((activity, i) => (
        <m.div
          key={activity.id || i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.06 }}
        >
          <ActivityRow activity={activity} />
        </m.div>
      ))}
    </div>
  );
}
