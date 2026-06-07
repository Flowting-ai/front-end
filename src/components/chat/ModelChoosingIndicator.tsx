"use client";

import { AnimatePresence, m } from "framer-motion";

interface ModelChoosingIndicatorProps {
  modelName?: string | null;
  isVisible: boolean;
}

/**
 * Animated indicator shown when the AI backend reports a model selection event.
 * Displays with a fade+scale entry, shimmer text, and auto-hides.
 */
export function ModelChoosingIndicator({
  modelName,
  isVisible,
}: ModelChoosingIndicatorProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <m.div
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -2 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            borderRadius: "8px",
            backgroundColor: "var(--neutral-50)",
            border: "1px solid var(--neutral-200)",
            marginBottom: "8px",
          }}
        >
          {/* Animated sparkle icon */}
          <m.svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="kaya-model-choosing"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M8 1L9.5 6.5L15 8L9.5 9.5L8 15L6.5 9.5L1 8L6.5 6.5L8 1Z"
              fill="var(--neutral-600)"
            />
          </m.svg>

          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: "var(--font-weight-medium)",
              color: "var(--neutral-600)",
            }}
          >
            Using{" "}
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span
                key={modelName ?? "model"}
                initial={{ opacity: 0, filter: "blur(3px)" }}
                animate={{ opacity: 1, filter: "none" }}
                exit={{ opacity: 0, filter: "blur(3px)" }}
                transition={{ duration: 0.2 }}
                style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--neutral-800)" }}
              >
                {modelName ?? "model"}
              </m.span>
            </AnimatePresence>
          </span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
