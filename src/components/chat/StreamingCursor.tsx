"use client";

import { motion } from "framer-motion";

interface StreamingCursorProps {
  isVisible: boolean;
}

/**
 * A subtle breathing dot that appears at the end of streaming content
 * to indicate the AI is still generating. Matches souvenir-chat-preview's BreathingDot.
 */
export function StreamingCursor({ isVisible }: StreamingCursorProps) {
  if (!isVisible) return null;

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.15, 1, 0.15] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      style={{
        display: "inline-block",
        width: "6px",
        height: "6px",
        backgroundColor: "var(--neutral-400, #9C938B)",
        marginLeft: "4px",
        verticalAlign: "middle",
        borderRadius: "50%",
      }}
      aria-hidden
    />
  );
}
