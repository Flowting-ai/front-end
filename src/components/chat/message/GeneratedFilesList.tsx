"use client";

import React from "react";
import { m } from "framer-motion";
import { DownloadOneIcon, ViewIcon } from "@strange-huge/icons";
import { useRouter } from "next/navigation";
import { trackFeature } from "@/lib/analytics/events";
import { LIBRARY_FILE_ROUTE } from "@/lib/routes";
import { IconButton } from "@/components/ui/button";
import { FormatGlyph, formatTintTile } from "@/components/Library/FormatGlyph";
import { formatLabel } from "@/lib/library/format";
import type { Format } from "@/lib/library/schemas";
import type { GeneratedFile } from "@/types/chat";

// ── Generated files: the file-type icon (as Library shows it), name, type, View + Download ──

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 12,
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  maxWidth: 315,
  padding: "8px 8px 8px 8px",
  borderRadius: 14,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--neutral-200)",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
  boxSizing: "border-box",
};

// The icon sits on its format's light accent: blue for documents, red for PDFs, green for spreadsheets…
function tileStyle(format: Format): React.CSSProperties {
  const tint = formatTintTile(format);
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 10,
    // The tag tints are badge-strength; mixed halfway into the card they read as a light accent.
    backgroundColor: `color-mix(in srgb, ${tint.background} 50%, var(--card-bg))`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tint.ring} 55%, var(--card-bg))`,
  };
}

const nameStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-title)",
  fontWeight: "var(--font-weight-medium)",
  fontSize: "var(--font-size-body)",
  lineHeight: "var(--line-height-body)",
  color: "var(--neutral-900)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const typeStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: "var(--font-size-caption)",
  lineHeight: "var(--line-height-caption)",
  color: "var(--neutral-500)",
  whiteSpace: "nowrap",
};

// ── The file's Library format (for its icon) and its extension (for the type line) ──

const FORMAT_BY_EXTENSION: Record<string, Format> = {
  pdf: "pdf",
  doc: "document", docx: "document", odt: "document", rtf: "document",
  xls: "sheet", xlsx: "sheet", csv: "sheet", tsv: "sheet", ods: "sheet",
  ppt: "slides", pptx: "slides", key: "slides", odp: "slides",
  txt: "text", md: "text", markdown: "text", json: "text", xml: "text", yaml: "text", yml: "text",
  html: "web", htm: "web",
  eml: "email",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image",
  mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio",
};

function extensionOf(file: GeneratedFile): string {
  const fromName = file.filename.includes(".") ? (file.filename.split(".").pop() ?? "") : "";
  if (fromName) return fromName.toLowerCase();
  const sub = file.mimeType?.split("/").pop() ?? "";
  if (sub.includes("pdf")) return "pdf";
  if (sub.includes("wordprocessingml") || sub.includes("msword")) return "docx";
  if (sub.includes("spreadsheetml") || sub.includes("excel")) return "xlsx";
  if (sub.includes("presentationml") || sub.includes("powerpoint")) return "pptx";
  if (sub.includes("csv")) return "csv";
  if (sub.includes("markdown")) return "md";
  return sub.toLowerCase();
}

function formatOf(file: GeneratedFile, ext: string): Format {
  if (FORMAT_BY_EXTENSION[ext]) return FORMAT_BY_EXTENSION[ext];
  if (file.mimeType?.startsWith("image/")) return "image";
  if (file.mimeType?.startsWith("audio/")) return "audio";
  return "document";
}

// Types a browser shows in a tab. Anything else (Office files, Markdown, CSV…) just downloads when
// opened, so those get Download only, not a View that does the same thing.
const VIEWABLE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "mp3", "wav", "m4a", "ogg", "mp4", "webm", "txt", "json"]);

function canView(file: GeneratedFile, ext: string): boolean {
  const mime = file.mimeType ?? "";
  if (mime === "application/pdf" || mime === "text/plain" || mime === "application/json") return true;
  if (mime.startsWith("image/") || mime.startsWith("audio/") || mime.startsWith("video/")) return true;
  return VIEWABLE_EXTENSIONS.has(ext);
}

/** "PDF", "Spreadsheet · XLSX": the format's word, plus the extension when it adds something. */
function typeLine(format: Format, ext: string): string {
  const label = formatLabel(format);
  const extLabel = ext.toUpperCase();
  return !extLabel || extLabel === label.toUpperCase() ? label : `${label} · ${extLabel}`;
}

/** View for a file saved in Library: opens its file page. Its own component, so the router is only
 *  needed where such a file shows. */
function LibraryViewButton({ fileId, filename }: { fileId: string; filename: string }) {
  const router = useRouter();
  return (
    <IconButton variant="ghost" size="sm" aria-label={`View ${filename}`} title="View" icon={<ViewIcon size={18} />} onClick={() => router.push(LIBRARY_FILE_ROUTE(fileId))} />
  );
}

export function GeneratedFilesList({ files }: { files: GeneratedFile[] }) {
  return (
    <div style={listStyle}>
      {files.map((file, i) => {
        const ext = extensionOf(file);
        const format = formatOf(file, ext);

        // Download goes through our proxy so the browser always saves the file (avoids CORS +
        // Content-Disposition issues from S3).
        const download = () => {
          trackFeature("document_download", { file_ext: ext });
          const link = document.createElement("a");
          link.href = `/api/download?url=${encodeURIComponent(file.url)}&filename=${encodeURIComponent(file.filename)}`;
          link.download = file.filename;
          link.click();
        };
        // View opens the file's Library page when it is saved there (any type: the page has its own
        // viewers, see LibraryViewButton); otherwise it opens the file in a new tab, offered only for
        // types a browser shows.
        const view = () => { window.open(file.url, "_blank", "noopener,noreferrer"); };

        return (
          <m.div
            key={file.url}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 360, damping: 26, delay: i * 0.07 }}
            style={cardStyle}
          >
            <span style={tileStyle(format)}>
              <FormatGlyph format={format} size="sm" />
            </span>

            <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
              <p style={nameStyle} title={file.filename}>{file.filename}</p>
              <p style={typeStyle}>{typeLine(format, ext)}</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {file.documentId ? (
                <LibraryViewButton fileId={file.documentId} filename={file.filename} />
              ) : canView(file, ext) && (
                <IconButton variant="ghost" size="sm" aria-label={`View ${file.filename}`} title="View" icon={<ViewIcon size={18} />} onClick={view} />
              )}
              <IconButton variant="ghost" size="sm" aria-label={`Download ${file.filename}`} title="Download" icon={<DownloadOneIcon size={18} />} onClick={download} />
            </div>
          </m.div>
        );
      })}
    </div>
  );
}
