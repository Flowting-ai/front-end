"use client";

import React, { useState, useRef, useEffect, useDeferredValue } from "react";
import { BreathingDot } from "@/components/BreathingDot";
import { ContentRenderer } from "@/lib/content-renderer";
import { nextReveal, REVEAL_DRAIN_MS, REVEAL_STEP_MS } from "@/lib/reveal";
import type { WebCitation } from "@/types/chat";

// ── StreamingTextContent - renders live content with BreathingDot cursor ──────
// Uses full MarkdownRenderer (same as completed messages) for consistent
// formatting quality during streaming — code blocks, math, GFM tables all
// render properly while the stream is active.

const cursorStyle: React.CSSProperties = { marginLeft: 4, backgroundColor: "var(--neutral-500)" };

export function StreamingTextContent({
  content,
  citations,
  animate,
  isLoading,
  stopped,
  revealFrom = "",
  onCaughtUp,
}: {
  content: string;
  citations?: WebCitation[];
  /** Reveal the text progressively. False for history and reduced motion: shown in full. */
  animate: boolean;
  isLoading: boolean;
  /** User pressed Stop: freeze the reveal where it is instead of draining the buffered text. */
  stopped: boolean;
  /** Text already on screen when this mounts — what a remounted row (e.g. scrolled
   *  back into view mid-stream) showed before, so its reveal doesn't replay. */
  revealFrom?: string;
  /** Called with `content` once the stream is over and all of it is on screen. */
  onCaughtUp?: (content: string) => void;
}) {
  const [displayedContent, setDisplayedContent] = useState(revealFrom);
  const displayedRef = useRef(revealFrom);
  const lastStepAtRef = useRef<number | null>(null);
  const drainStartedAtRef = useRef<number | null>(null);

  // Steps through `nextReveal` on animation frames, at most every
  // REVEAL_STEP_MS: each step re-renders the message's whole Markdown.
  // Restarted whenever the content grows, so each run closes over the latest
  // text; the step clock and drain deadline live in refs so a restart doesn't
  // reset them. The loop stops while there's nothing it can reveal (caught up,
  // or held at a widget still being written) until the content changes.
  useEffect(() => {
    if (!animate || stopped) return;

    let active = true;
    let frame: number | null = null;
    const show = (next: string) => {
      if (!active || next === displayedRef.current) return;
      displayedRef.current = next;
      setDisplayedContent(next);
    };

    const tick = (now: number) => {
      frame = null;
      if (isLoading) drainStartedAtRef.current = null;
      else drainStartedAtRef.current ??= now;
      const drainMsLeft = drainStartedAtRef.current === null
        ? undefined
        : Math.max(0, REVEAL_DRAIN_MS - (now - drainStartedAtRef.current));
      // The first step after a pause goes straight away.
      const elapsedMs = lastStepAtRef.current === null ? REVEAL_STEP_MS : now - lastStepAtRef.current;
      const deadlineDue = drainMsLeft !== undefined && drainMsLeft <= elapsedMs;
      if (elapsedMs < REVEAL_STEP_MS && !deadlineDue) {
        frame = requestAnimationFrame(tick);
        return;
      }
      lastStepAtRef.current = now;
      const previous = displayedRef.current;
      const next = nextReveal({ displayed: previous, target: content, elapsedMs, drainMsLeft });
      show(next);
      const held = next === previous && drainMsLeft === undefined;
      if (next === content || held) lastStepAtRef.current = null;
      else frame = requestAnimationFrame(tick);
    };

    // A hidden tab gets no animation frames, and nobody is watching the
    // reveal: show everything at once (also when the tab comes back).
    const showAll = () => show(content);
    if (document.hidden) void Promise.resolve().then(showAll);
    else frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", showAll);

    return () => {
      active = false;
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", showAll);
    };
  }, [animate, stopped, content, isLoading]);

  const caughtUp = animate && !stopped && !isLoading && displayedContent === content;
  useEffect(() => {
    if (caughtUp) onCaughtUp?.(content);
  }, [caughtUp, content, onCaughtUp]);

  // A stopped message that was being revealed stays frozen at what the user saw.
  // One that was never animated (e.g. loaded from history) shows in full.
  const shownContent = animate ? displayedContent : content;
  const showCursor = !stopped && (isLoading || shownContent !== content);
  // Markdown re-parse is the expensive part of each reveal step; deferring it
  // lets typing and scrolling interrupt a long render instead of queueing behind it.
  const renderedContent = useDeferredValue(shownContent);
  const dot = <BreathingDot style={cursorStyle} />;
  return <ContentRenderer content={renderedContent} webCitations={citations} isStreaming={showCursor} cursor={showCursor ? dot : undefined} />;
}
