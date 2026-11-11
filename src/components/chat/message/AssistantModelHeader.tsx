"use client";

import React from "react";
import { AnimatePresence, m } from "framer-motion";
import { ModelLogo, AnimatedLogo } from "../ReasoningBlock";
import type { UIMessage } from "@/types/chat";

// ── Model attribution: the header row, and the shimmer label shown before ─────
// ── the model is known ────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginBottom: "4px",
  userSelect: "none",
};

const headerLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--model-name-text)",
};

const loadingWrapperStyle: React.CSSProperties = { margin: "4px 0 8px" };

const loadingRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, minHeight: 20, userSelect: "none" };

const loadingLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  lineHeight: "18px",
};

/** Resolve the actual model display name — never expose "souvenir" as a routing label. */
export function resolveModelDisplayName(message: UIMessage): string | null {
  const raw = message.modelMeta?.modelName ?? message.modelName ?? message.model_name ?? message.model
  if (!raw) return null
  // Never expose an internal routing label as the model name.
  if (raw.toLowerCase().startsWith('souvenir')) return null
  return raw
}

/* Assistant model-attribution header — always its own line above
   whatever comes next (the Thinking trigger, an activities
   summary, or bare content), never merged into any of those rows.
   Gated only on identity being resolved, not on hasThinking/
   showReasoning/activities — ReasoningBlock's "Thinking" trigger
   and StandaloneActivitiesBlock's summary row no longer show their
   own duplicate logo/name, this is the one place it renders. */
export function AssistantModelHeader({
  message,
  modelDisplayName,
  justModelSelected,
}: {
  message: UIMessage;
  modelDisplayName: string | null;
  justModelSelected: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {(message.modelName || !message.isLoading) && (
        <m.div
          key="model-header"
          initial={{ opacity: 0, y: -4, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          draggable={false}
          style={headerStyle}
        >
          <AnimatedLogo
            modelMeta={message.modelMeta}
            modelName={message.modelName || message.model_name || message.model}
            isThinkingInProgress={false}
            justSelected={justModelSelected}
          />
          <AnimatePresence mode="popLayout" initial={false}>
            {(() => {
              // Same fallback as the loading-state label below: a generic
              // "Souvenir" placeholder rather than blanking the text
              // entirely, since modelDisplayName can genuinely resolve to
              // null (e.g. an unrecognized "souvenir"-prefixed placeholder
              // name) while the logo next to it renders regardless.
              const label = modelDisplayName ?? "Souvenir";
              return (
                <m.span
                  key={label}
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                  transition={{ type: "spring", stiffness: 520, damping: 32 }}
                  style={headerLabelStyle}
                >
                  {label}
                </m.span>
              );
            })()}
          </AnimatePresence>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** Loading state - shimmer label shown only before model identity is known.
 *  Once modelMeta/modelName is set, the header above takes over. */
export function ModelLoadingLabel({ message, modelDisplayName }: { message: UIMessage; modelDisplayName: string | null }) {
  return (
    <div style={loadingWrapperStyle}>
      <div draggable={false} style={loadingRowStyle}>
        <ModelLogo modelMeta={message.modelMeta} modelName={message.modelName || message.model_name || message.model} size={16} />
        <span
          className="kaya-label-shimmer"
          style={loadingLabelStyle}
        >
          {modelDisplayName ?? "Souvenir"}
        </span>
      </div>
    </div>
  );
}
