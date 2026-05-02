"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ActivityItem, ActivityType } from "@/hooks/use-chat-state";

// ── Activity type display config ──────────────────────────────────────────────

const ACTIVITY_VERB: Record<ActivityType, string> = {
  "web-search": "Searching the web",
  "read-pages": "Reading document",
  "csv-execute": "Analysing data",
  "fetch-resource": "Fetching resource",
  "tool-call": "Running tool",
  "docx-progress": "Generating document",
  "other": "Processing",
};

// SVG icons for each activity type (matching preview's HugeIcons style)
function ActivityIcon({ type, isDone }: { type: ActivityType; isDone: boolean }) {
  const color = isDone ? "var(--neutral-300, #C0B5AD)" : "var(--neutral-400, #A89488)";
  switch (type) {
    case "web-search":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      );
    case "read-pages":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "csv-execute":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      );
    case "fetch-resource":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "tool-call":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case "docx-progress":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M12 18v-6" />
          <path d="M9 15l3 3 3-3" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
  }
}

// Spinner SVG (matching preview)
function SpinnerIcon() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      style={{ display: "flex", alignItems: "center", lineHeight: 0, flexShrink: 0 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-300, #B6ACA4)" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
    </motion.span>
  );
}

// Checkmark SVG (matching preview)
function CheckmarkIcon() {
  return (
    <span style={{ display: "flex", alignItems: "center", lineHeight: 0, flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#80B707" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

// Error icon
function ErrorIcon() {
  return (
    <span style={{ display: "flex", alignItems: "center", lineHeight: 0, flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red-500, #DC3545)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    </span>
  );
}

// ── ActivityRow component ─────────────────────────────────────────────────────

export function ActivityRow({ activity }: { activity: ActivityItem }) {
  const [resultsOpen, setResultsOpen] = useState(false);
  const isActive = activity.status === "start" || activity.status === "executing" || activity.status === "reading";
  const isDone = activity.status === "done";
  const isError = activity.status === "error";
  const verb = ACTIVITY_VERB[activity.type] ?? "Processing";
  const hasResults = isDone && activity.results && activity.results.length > 0;

  // Build detail text
  const detailText = activity.detail || activity.toolName?.replace(/_/g, " ") || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header row — clickable when has results */}
      <button
        onClick={() => hasResults && setResultsOpen(!resultsOpen)}
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: "none",
          cursor: hasResults ? "pointer" : "default",
          padding: "4px 0",
          width: "100%",
          textAlign: "left",
          fontFamily: "var(--font-body)",
        }}
      >
        {/* Status icon — spinner, checkmark, or error */}
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
            — {detailText}
          </span>
        )}

        {/* Result count */}
        {hasResults && (
          <span style={{ fontSize: 14, fontWeight: 400, color: "var(--neutral-300, #B6ACA4)", flexShrink: 0 }}>
            {activity.results!.length} results
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
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ fontSize: 14, fontWeight: 400, color: "var(--neutral-300, #C0B5AD)", flexShrink: 0 }}
          >
            working…
          </motion.span>
        )}

        {/* Action badge + chevron for expandable rows */}
        {hasResults && (
          <>
            <span
              style={{
                fontSize: 9,
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
            <motion.svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              animate={{ rotate: resultsOpen ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{ display: "block", flexShrink: 0 }}
            >
              <path
                d="M3 5.5 L7 9.5 L11 5.5"
                stroke="var(--neutral-400, #9C938B)"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          </>
        )}
      </button>

      {/* Collapsible results list (for web search etc.) */}
      <AnimatePresence initial={false}>
        {resultsOpen && hasResults && (
          <motion.div
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
                <motion.div
                  key={ri}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: ri * 0.04, duration: 0.18 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 400,
                    minHeight: 20,
                  }}
                >
                  <span style={{ color: "var(--neutral-300, #C0B5AD)", flexShrink: 0 }}>·</span>
                  <span
                    style={{
                      color: "var(--neutral-800, #3B3632)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.title}
                  </span>
                  {r.domain && (
                    <span style={{ color: "var(--neutral-300, #C0B5AD)", flexShrink: 0 }}>
                      {r.domain}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
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

// ── Activities section — renders all activities ───────────────────────────────

export function ActivitiesSection({ activities }: { activities: ActivityItem[] }) {
  if (!activities || activities.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
      {activities.map((activity, i) => (
        <motion.div
          key={activity.id || i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.06 }}
        >
          <ActivityRow activity={activity} />
        </motion.div>
      ))}
    </div>
  );
}
