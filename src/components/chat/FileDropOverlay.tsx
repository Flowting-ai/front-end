"use client";

import { createPortal } from "react-dom";
import { Upload } from "lucide-react";

/**
 * The full-window "drop files" layer shown while files are dragged over a chat. It renders into
 * document.body above everything else (the composer, its model menu, popovers and toasts), so no
 * stacking context on the page can sit on top of it. It never takes pointer events, so the drop
 * still lands on the page's own drop handler.
 */
const TOP_LAYER = 2147483000;

export function FileDropOverlay({ visible }: { visible: boolean }) {
  if (!visible || typeof document === "undefined") return null;
  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: TOP_LAYER,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundColor: "rgba(var(--surface-rgb), 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 12,
          borderRadius: 20,
          border: "2px dashed var(--neutral-300)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: "28px 36px",
          borderRadius: 20,
          background: "var(--card-bg)",
          boxShadow: "var(--shadow-card-default)",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "var(--neutral-100)",
            color: "var(--neutral-900)",
          }}
        >
          <Upload size={22} />
        </span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 16, lineHeight: "22px", fontWeight: 500, color: "var(--neutral-900)" }}>
          Drop files to attach
        </span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: "18px", color: "var(--neutral-500)" }}>
          They upload to this chat. Up to 10 files per message.
        </span>
      </div>
    </div>,
    document.body,
  );
}
