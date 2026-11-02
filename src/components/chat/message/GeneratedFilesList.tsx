"use client";

import React from "react";
import { m } from "framer-motion";
import { trackFeature } from "@/lib/analytics/events";
import { Tooltip } from "@/components/Tooltip";
import type { GeneratedFile } from "@/types/chat";

// ── Generated files: type badge, name, View + Download links ──────────────────

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginTop: "12px",
};

const cardStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 10px 8px 8px",
  borderRadius: "10px",
  backgroundColor: "rgba(59,54,50,0.05)",
  border: "1px solid var(--neutral-800-10)",
  width: "fit-content",
  maxWidth: "420px",
  boxSizing: "border-box",
};

const badgeTextStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--static-white)",
  letterSpacing: "0.4px",
  lineHeight: 1,
};

const filenameStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--neutral-700)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
};

// Shared by View and Download.
const actionLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 6,
  backgroundColor: "transparent",
  border: "none",
  cursor: "pointer",
  transition: "background-color 120ms",
  textDecoration: "none",
  color: "inherit",
};

const hoverOn = (e: React.MouseEvent<HTMLAnchorElement>) => {
  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--neutral-800-10)"
}
const hoverOff = (e: React.MouseEvent<HTMLAnchorElement>) => {
  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent"
}

// ── Derive file type label + badge colour ──────────────────────
function fileTypeLabel(file: GeneratedFile): string {
  if (file.mimeType) {
    const sub = file.mimeType.split("/").pop() ?? ""
    if (sub.includes("pdf")) return "PDF"
    if (sub.includes("wordprocessingml") || sub.includes("msword")) return "DOCX"
    if (sub.includes("spreadsheetml") || sub.includes("excel")) return "XLSX"
    if (sub.includes("presentationml") || sub.includes("powerpoint")) return "PPTX"
    if (sub.includes("csv")) return "CSV"
    if (sub.includes("markdown") || sub.includes("md")) return "MD"
    return sub.toUpperCase().slice(0, 5) || "FILE"
  }
  const fromName = (file.filename.split(".").pop() ?? "").toUpperCase()
  return fromName.slice(0, 5) || "FILE"
}

function badgeColorFor(ext: string): string {
  switch (ext) {
    case "PDF":  return "var(--danger-500)"
    case "DOCX": case "DOC": return "var(--blue-600)"
    case "XLSX": case "XLS": return "var(--success-700)"
    case "CSV":  return "var(--success-800)"
    case "PPTX": case "PPT": return "var(--warning-600)"
    case "MD":   return "var(--violet-500)"
    default:     return "var(--neutral-600)"
  }
}

export function GeneratedFilesList({ files }: { files: GeneratedFile[] }) {
  return (
    <div style={listStyle}>
      {files.map((file, i) => {
        const ext = fileTypeLabel(file)
        const badgeColor = badgeColorFor(ext)

        // Download URL goes through our proxy so the browser always saves
        // the file (avoids CORS + Content-Disposition issues from S3)
        const downloadHref = `/api/download?url=${encodeURIComponent(file.url)}&filename=${encodeURIComponent(file.filename)}`

        return (
          <m.div key={file.url}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 360,
              damping: 26,
              delay: i * 0.07,
            }}
            style={cardStyle}
          >
            {/* Coloured type badge */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                backgroundColor: badgeColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={badgeTextStyle}>
                {ext}
              </span>
            </div>

            {/* Filename */}
            <span style={filenameStyle}>
              {file.filename}
            </span>

            {/* Action buttons */}
            <div style={actionsStyle}>
              {/* View - opens file in new tab (browsers show PDF inline, download DOCX/XLSX etc.) */}
              <Tooltip content="View"><a aria-label="View"
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                style={actionLinkStyle}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                {/* External link icon */}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 2h4v4M14 2 8 8M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"
                    stroke="var(--neutral-400)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a></Tooltip>

              {/* Download - proxied through /api/download so browser always saves */}
              <Tooltip content="Download"><a aria-label="Download"
                href={downloadHref}
                download={file.filename}
                onClick={() => trackFeature("document_download", { file_ext: file.filename?.split(".").pop()?.toLowerCase() })}
                style={actionLinkStyle}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                {/* Download arrow icon */}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2v8m0 0L5.5 7.5M8 10l2.5-2.5M2 13h12"
                    stroke="var(--neutral-400)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a></Tooltip>
            </div>
          </m.div>
        )
      })}
    </div>
  );
}
