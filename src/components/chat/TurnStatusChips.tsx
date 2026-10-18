"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import AiWebBrowsingIcon from "@hugeicons/core-free-icons/AiWebBrowsingIcon";
import { ContextPanelContent } from "@/components/ContextPanel";
import { useProjectPanel } from "@/context/project-panel-context";
import { trackFeature } from "@/lib/analytics/events";
import type { ActivityStatus, UIMessage } from "@/types/chat";
import styles from "./TurnStatusChips.module.css";

// Two chips riding just above the composer while a reply is running:
//   left  — "Using browser", only while the agent is driving the browser;
//           click opens the Context panel, which follows the agent to its
//           Browser tab.
//   right — how long the turn has run, with a ring for steps done / started.
//           Hidden for quick replies (under SHOW_AFTER_MS) so a one-line
//           answer doesn't flash a timer.

const SHOW_AFTER_MS = 3000;
// Must match FloatingPanel's CONTEXT_PANEL_TITLE so its toggle recognises
// the panel this chip opens.
const CONTEXT_PANEL_TITLE = "Context";
const RUNNING: ReadonlySet<ActivityStatus> = new Set(["start", "executing", "reading"]);

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

export function TurnStatusChips({ messages, active }: { messages: UIMessage[]; active: boolean }) {
  const turn = active ? messages.findLast((msg) => msg.role === "assistant" && msg.isLoading) : undefined;
  const activities = turn?.activities;

  const browserStep = useMemo(
    () => activities?.findLast((a) => a.type === "browser" && RUNNING.has(a.status)),
    [activities],
  );
  const browserLabel = browserStep
    ? browserStep.progressMessage || browserStep.label || browserStep.detail || "Browsing"
    : undefined;
  // "Using browser · Browsing" says it twice; only show a detail that adds something.
  const browserDetail = browserLabel && !/^brows(ing|er)$/i.test(browserLabel) ? browserLabel : undefined;

  const steps = activities?.length ?? 0;
  const done = activities?.filter((a) => !RUNNING.has(a.status)).length ?? 0;

  // The clock starts when this turn's message appears and ticks each second;
  // keyed on the turn id so re-renders of the same turn don't restart it.
  const turnId = turn?.id;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!turnId) return;
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - start), 1000);
    return () => {
      window.clearInterval(id);
      setElapsed(0);
    };
  }, [turnId]);
  const showTimer = !!turn && elapsed >= SHOW_AFTER_MS;

  const { panel, setPanel } = useProjectPanel();
  const openBrowserPanel = () => {
    if (panel?.title === CONTEXT_PANEL_TITLE) return;
    trackFeature("context_panel_opened");
    setPanel({
      title: CONTEXT_PANEL_TITLE,
      content: <ContextPanelContent />,
      onClose: () => setPanel(null),
      sidePadding: 8,
    });
  };

  if (!browserLabel && !showTimer) return null;

  return (
    <div className={styles.row}>
      <AnimatePresence initial={false}>
        {browserLabel && (
          <m.button
            key="browser"
            type="button"
            className={`${styles.chip} ${styles.browser}`}
            onClick={openBrowserPanel}
            title="Show the browser"
            aria-label={`Using browser: ${browserLabel}. Show the browser`}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={styles.browserIcon} aria-hidden>
              <span className={styles.orbit} />
              <HugeiconsIcon icon={AiWebBrowsingIcon} size={14} />
            </span>
            <span className={styles.label}>Using browser</span>
            {browserDetail && (
              <m.span key={browserDetail} className={styles.detail} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {browserDetail}
              </m.span>
            )}
          </m.button>
        )}
      </AnimatePresence>

      <span className={styles.spacer} />

      <AnimatePresence initial={false}>
        {showTimer && (
          <m.div
            key="timer"
            className={styles.chip}
            role="timer"
            aria-label={`Working for ${formatElapsed(elapsed)}${steps ? `, ${done} of ${steps} steps done` : ""}`}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProgressRing value={steps ? done / steps : null} />
            {steps > 0 && <span className={styles.detail}>{done}/{steps} steps</span>}
            <span className={styles.time}>{formatElapsed(elapsed)}</span>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Determinate ring when steps are known, a spinning arc otherwise. */
function ProgressRing({ value }: { value: number | null }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className={value === null ? styles.spin : undefined} aria-hidden>
      <circle cx="8" cy="8" r={r} fill="none" stroke="var(--neutral-200)" strokeWidth="2" />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke="var(--neutral-700)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={value === null ? c * 0.7 : c * (1 - Math.max(0.06, value))}
        transform="rotate(-90 8 8)"
        style={{ transition: "stroke-dashoffset 400ms ease" }}
      />
    </svg>
  );
}
