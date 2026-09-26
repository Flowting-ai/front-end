"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { m } from "framer-motion";
import type { ResponseBlock, WebCitation } from "@/types/chat";
import { TextBlockContent } from "./TextBlockContent";
import { AnimatedTable } from "./AnimatedTable";
import { AnimatedBarChart } from "./AnimatedBarChart";
import { AnimatedSteps } from "./AnimatedSteps";
import { AnimatedCodeBlock } from "./AnimatedCodeBlock";
import { AnimatedCallout } from "./AnimatedCallout";
import { AnimatedTags } from "./AnimatedTags";
import { AnimatedPieChart } from "./AnimatedPieChart";
import { AnimatedLineChart } from "./AnimatedLineChart";
import { AnimatedCard } from "./AnimatedCard";
import { AnimatedConnectorError } from "./AnimatedConnectorError";
import { AnimatedSearchTimeout } from "./AnimatedSearchTimeout";
import { AnimatedFollowUps } from "./AnimatedFollowUps";

// �"��"� BreathingDot - streaming cursor �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

function BreathingDot() {
  return (
    <m.span
      animate={{ opacity: [0.15, 1, 0.15] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#826B60", verticalAlign: "middle", marginLeft: 4 }}
    />
  );
}

// �"��"� StructuredResponseWrapper - breathing dot until block starts animating �"��"��"�

function StructuredResponseWrapper({ firstTokenDelay, onComplete, children }: {
  firstTokenDelay: number;
  onComplete: () => void;
  children: (onComplete: () => void) => React.ReactNode;
}) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), firstTokenDelay);
    return () => clearTimeout(t);
  }, [firstTokenDelay]);

  if (!started) {
    return <div style={{ height: 22, display: "flex", alignItems: "center" }}><BreathingDot /></div>;
  }
  return <>{children(onComplete)}</>;
}


// �"��"� BlockSequenceRenderer �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�
// Animates each block in sequence - each block calls onComplete to advance.

export interface BlockSequenceRendererProps {
  blocks: ResponseBlock[];
  /** ms delay before first block appears (default 0 for completed messages) */
  firstTokenDelay?: number;
  onAllComplete?: () => void;
  onFollowUp?: (prompt: string) => void;
  onRetry?: () => void;
  /** If true, all blocks are rendered static immediately (no sequential animation) */
  static?: boolean;
  /** Message-level web citations � used as fallback when a text block has no per-block citations */
  webCitations?: WebCitation[];
}

export const BlockSequenceRenderer = React.memo(function BlockSequenceRenderer({
  blocks,
  firstTokenDelay = 0,
  onAllComplete,
  onFollowUp,
  onRetry,
  static: isStatic = false,
  webCitations,
}: BlockSequenceRendererProps) {
  const [activeIdx, setActiveIdx] = useState(isStatic ? blocks.length : 0);
  const [allDone, setAllDone] = useState(isStatic);
  const onAllCompleteRef = useRef(onAllComplete);
  useEffect(() => {
    onAllCompleteRef.current = onAllComplete;
  }, [onAllComplete]);

  const handleBlockDone = useCallback((idx: number) => {
    if (idx < blocks.length - 1) {
      setActiveIdx(idx + 1);
    } else {
      setAllDone(true);
      onAllCompleteRef.current?.();
    }
  }, [blocks.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {blocks.map((block, i) => {
        if (i > activeIdx && !isStatic) return null;
        const isDone = isStatic || i < activeIdx || allDone;
        const isFirst = i === 0;
        const wrapDelay = isFirst && !isStatic ? firstTokenDelay : 0;

        // text block - static render (real streaming handled by SSE in chat)
        if (block.kind === "text") {
          return (
            <div key={`b${i}`}>
              <TextBlockContent text={block.content} citations={block.webCitations ?? webCitations} />
              {!isDone && <BreathingDot />}
            </div>
          );
        }

        // Use wrapper for breathing-dot delay on first structured block
        const wrap = (children: (done: () => void) => React.ReactNode) => isDone
          ? <div key={`b${i}`}>{children(() => {})}</div>
          : (
            <StructuredResponseWrapper key={`b${i}`} firstTokenDelay={wrapDelay} onComplete={() => handleBlockDone(i)}>
              {children}
            </StructuredResponseWrapper>
          );

        if (block.kind === "table")           return wrap((d) => <AnimatedTable       data={block.data} onComplete={d} animate={false} />);
        if (block.kind === "bar-chart")        return wrap((d) => <AnimatedBarChart    data={block.data} onComplete={d} animate={!isDone} />);
        if (block.kind === "steps")            return wrap((d) => <AnimatedSteps       data={block.data} onComplete={d} animate={!isDone} />);
        if (block.kind === "code")             return wrap((d) => <AnimatedCodeBlock   data={block.data} onComplete={d} animate={!isDone} />);
        if (block.kind === "callout")          return wrap((d) => <AnimatedCallout     data={block.data} onComplete={d} />);
        if (block.kind === "tags")             return wrap((d) => <AnimatedTags        data={block.data} onComplete={d} animate={!isDone} />);
        if (block.kind === "pie-chart")        return wrap((d) => <AnimatedPieChart    data={block.data} onComplete={d} animate={!isDone} />);
        if (block.kind === "line-chart")       return wrap((d) => <AnimatedLineChart   data={block.data} onComplete={d} animate={!isDone} />);
        if (block.kind === "card")             return wrap((d) => <AnimatedCard        data={block.data} onComplete={d} />);
        if (block.kind === "connector-error")  return wrap((d) => <AnimatedConnectorError data={block.data} onComplete={d} onRetry={onRetry} />);
        if (block.kind === "search-timeout")   return wrap((d) => <AnimatedSearchTimeout  data={block.data} onComplete={d} onRetry={onRetry} />);
        if (block.kind === "follow-ups") {
          return wrap((d) => <AnimatedFollowUps data={block.data} onComplete={d} onFollowUp={onFollowUp} animate={!isDone} />);
        }
        return null;
      })}
    </div>
  );
});
