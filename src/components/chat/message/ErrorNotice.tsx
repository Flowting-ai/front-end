"use client";

import React from "react";
import { m } from "framer-motion";

// ── ErrorNotice - a failure below output that was already shown ───────────────
// Styled after the connector-error card (AnimatedConnectorError).

const noticeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginTop: 12,
  padding: "10px 12px 10px 14px",
  borderRadius: 12,
  background: "color-mix(in srgb, var(--red-500) 4%, transparent)",
  border: "1px solid color-mix(in srgb, var(--red-500) 18%, transparent)",
};

const messageStyle: React.CSSProperties = { flex: 1, minWidth: 0, fontFamily: "var(--font-body)", fontSize: 14, lineHeight: "22px", color: "var(--neutral-700)" };

const retryStyle: React.CSSProperties = {
  flexShrink: 0,
  background: "transparent",
  border: "1px solid color-mix(in srgb, var(--red-500) 28%, transparent)",
  borderRadius: 8,
  padding: "6px 12px",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--red-600)",
  cursor: "pointer",
};

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <m.div
      role="alert"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={noticeStyle}
    >
      <span style={messageStyle}>
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={retryStyle}
        >
          Retry
        </button>
      )}
    </m.div>
  );
}
