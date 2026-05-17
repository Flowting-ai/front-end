"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { PdfIcon } from "@hugeicons/core-free-icons";
import {
  ArrowLeftOneIcon,
  ArrowRightOneIcon,
  CancelOneIcon,
  FolderOneIcon,
  FolderThreeIcon,
  ImageTwoIcon,
  SourceCodeIcon,
  TextIcon,
} from "@strange-huge/icons";
import {
  useFileUpload,
  getFileTypeLabel,
  formatFileSize,
  type PendingAttachment,
} from "@/hooks/use-file-upload";

// Re-export so callers that imported PendingAttachment from here still work.
export type { PendingAttachment };

// ── File-type icon helper ─────────────────────────────────────────────────────
function getFileIcon(file: File): React.ReactNode {
  const mime = file.type.toLowerCase();
  const ext  = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (mime.startsWith("image/")) {
    return <ImageTwoIcon size={14} color="var(--neutral-500)" />;
  }
  if (["txt", "md", "csv", "rtf"].includes(ext) ||
      ["text/plain", "text/markdown", "text/csv", "application/rtf", "text/rtf"].includes(mime)) {
    return <TextIcon size={14} color="var(--neutral-500)" />;
  }
  if (["json", "xml", "html", "htm"].includes(ext) ||
      ["application/json", "application/xml", "text/xml", "text/html"].includes(mime)) {
    return <SourceCodeIcon size={14} color="var(--neutral-500)" />;
  }
  if (ext === "zip" || mime === "application/zip" || mime === "application/x-zip-compressed") {
    return <FolderThreeIcon size={14} color="var(--neutral-500)" />;
  }
  if (ext === "pdf" || mime === "application/pdf") {
    return <HugeiconsIcon icon={PdfIcon} size={14} color="var(--neutral-500)" />;
  }
  // Fallback: Word, Excel, PPT, EPUB, etc.
  return <FolderOneIcon size={14} color="var(--neutral-500)" />;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AttachmentManagerProps {
  attachments: PendingAttachment[];
  onAttachmentsChange: (attachments: PendingAttachment[]) => void;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Single-row horizontal scroll strip rendered inside the ChatInput box.
 * Left/right chevron buttons appear automatically when content overflows.
 * Supports drag-and-drop onto the strip itself.
 */
export function AttachmentManager({
  attachments,
  onAttachmentsChange,
  disabled,
}: AttachmentManagerProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft,   setShowLeft]   = useState(false);
  const [showRight,  setShowRight]  = useState(false);
  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { processFiles, removeAttachment: removeOne, FILE_ACCEPT } = useFileUpload();

  // Re-check scroll buttons whenever attachments are added/removed (RAF lets
  // the browser finish laying out the new chips before we measure widths).
  useEffect(() => {
    const id = requestAnimationFrame(updateScrollButtons);
    return () => cancelAnimationFrame(id);
    // updateScrollButtons reads DOM refs - not a reactive dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.length]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onAttachmentsChange(processFiles(e.target.files, attachments));
      e.target.value = "";
    }
  };

  const handleRemove = (id: string) => {
    onAttachmentsChange(removeOne(id, attachments));
  };

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 10);
    setShowRight(
      el.scrollWidth > el.clientWidth &&
        el.scrollLeft < el.scrollWidth - el.clientWidth - 10,
    );
  };

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length && !disabled) {
      onAttachmentsChange(processFiles(e.dataTransfer.files, attachments));
    }
  };

  if (attachments.length === 0) {
    return (
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        onChange={handleFileSelect}
        style={{ display: "none" }}
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        onChange={handleFileSelect}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {/* ── Scroll container ── */}
      <div
        style={{
          position: "relative",
          padding:  "10px 16px 0",
          width:    "100%",
        }}
      >
        {/* File count badge */}
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            "4px",
            marginBottom:   "6px",
            paddingLeft:    "2px",
          }}
        >
          <span
            style={{
              fontFamily:  "var(--font-body)",
              fontSize:    "10px",
              fontWeight:  500,
              color:       "var(--neutral-500)",
              lineHeight:  1,
            }}
          >
            {attachments.length} file{attachments.length !== 1 ? "s" : ""} attached
          </span>
        </div>
        {/* Row */}
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="kds-attach-scroll"
          style={{
            display:              "flex",
            gap:                  "8px",
            overflowX:            "auto",
            overflowY:            "hidden",
            scrollbarWidth:       "none",
            msOverflowStyle:      "none",
            WebkitOverflowScrolling: "touch",
            borderRadius:         "8px",
            outline:              isDragging ? "2px dashed var(--focus-ring)" : "none",
            outlineOffset:        "2px",
            minHeight:            "46px",
            transition:           "outline 100ms",
          }}
        >
          {attachments.map((attachment) => {
            const isImage   = attachment.file.type.startsWith("image/");
            const typeLabel = getFileTypeLabel(attachment.file);

            const isHovered = hoveredId === attachment.id;

            return isImage ? (
              // ── Image thumbnail ────────────────────────────────────────────
              <div
                key={attachment.id}
                onMouseEnter={() => setHoveredId(attachment.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  position:     "relative",
                  width:        "46px",
                  height:       "46px",
                  borderRadius: "8px",
                  border:       "1px solid var(--neutral-200)",
                  overflow:     "hidden",
                  flexShrink:   0,
                  cursor:       "default",
                }}
              >
                {attachment.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    style={{
                      width: "100%", height: "100%", objectFit: "cover",
                      filter: attachment.uploading ? "blur(1.5px)" : "none",
                      transition: "filter 300ms",
                    }}
                  />
                )}

                {/* Circular upload progress ring */}
                {attachment.uploading && (
                  <div
                    style={{
                      position:        "absolute",
                      inset:           0,
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      backgroundColor: "rgba(0,0,0,0.2)",
                      borderRadius:    "8px",
                    }}
                  >
                    <svg width="26" height="26" viewBox="0 0 28 28">
                      <circle cx="14" cy="14" r="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                      <circle
                        cx="14" cy="14" r="10"
                        fill="none"
                        stroke="#22C55E"
                        strokeWidth="2.5"
                        strokeDasharray={`${((attachment.uploadProgress ?? 0) * 62.83) / 100} 62.83`}
                        strokeLinecap="round"
                        transform="rotate(-90 14 14)"
                        style={{ transition: "stroke-dasharray 300ms ease-out" }}
                      />
                    </svg>
                  </div>
                )}

                {/* Type badge - only after upload */}
                {!attachment.uploading && (
                  <span
                    style={{
                      position:        "absolute",
                      bottom:          "2px",
                      left:            "2px",
                      backgroundColor: "rgba(0,0,0,0.55)",
                      color:           "#fff",
                      fontSize:        "7px",
                      fontFamily:      "var(--font-body)",
                      fontWeight:      600,
                      lineHeight:      1,
                      padding:         "2px 3px",
                      borderRadius:    "3px",
                      letterSpacing:   "0.02em",
                    }}
                  >
                    {typeLabel}
                  </span>
                )}

                {/* Remove - only after upload */}
                {isHovered && !attachment.uploading && (
                  <button
                    type="button"
                    onClick={() => handleRemove(attachment.id)}
                    disabled={disabled}
                    aria-label={`Remove ${attachment.file.name}`}
                    style={{
                      position:        "absolute",
                      top:             "2px",
                      right:           "2px",
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      width:           "15px",
                      height:          "15px",
                      borderRadius:    "50%",
                      border:          "none",
                      backgroundColor: "rgba(0,0,0,0.55)",
                      color:           "#fff",
                      cursor:          disabled ? "not-allowed" : "pointer",
                      padding:         0,
                    }}
                  >
                    <CancelOneIcon size={9} />
                  </button>
                )}
              </div>
            ) : (
              // ── Document chip ──────────────────────────────────────────────
              <div
                key={attachment.id}
                onMouseEnter={() => setHoveredId(attachment.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  position:        "relative",
                  display:         "flex",
                  alignItems:      "center",
                  gap:             "8px",
                  width:           "172px",
                  height:          "46px",
                  padding:         "0 28px 0 6px",
                  borderRadius:    "8px",
                  border:          "1px solid var(--neutral-200)",
                  backgroundColor: "var(--neutral-50)",
                  overflow:        "hidden",
                  flexShrink:      0,
                  cursor:          "default",
                }}
              >
                {/* Icon box */}
                <div
                  style={{
                    display:         "flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                    width:           "30px",
                    height:          "30px",
                    borderRadius:    "6px",
                    backgroundColor: "var(--neutral-100)",
                    flexShrink:      0,
                  }}
                >
                  {getFileIcon(attachment.file)}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily:   "var(--font-body)",
                      fontSize:     "11px",
                      fontWeight:   500,
                      color:        "var(--neutral-900)",
                      overflow:     "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace:   "nowrap",
                      margin:       0,
                      lineHeight:   1.2,
                    }}
                  >
                    {attachment.file.name}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize:   "10px",
                      color:      attachment.uploading ? "var(--green-600, #16a34a)" : "var(--neutral-500)",
                      margin:     "2px 0 0",
                      lineHeight: 1,
                      transition: "color 200ms",
                    }}
                  >
                    {attachment.uploading
                      ? `Uploading… ${attachment.uploadProgress ?? 0}%`
                      : `${typeLabel} · ${formatFileSize(attachment.file.size)}`
                    }
                  </p>
                </div>

                {/* Progress bar - sits at the bottom of the chip */}
                {attachment.uploading && (
                  <div
                    style={{
                      position:        "absolute",
                      bottom:          0,
                      left:            0,
                      right:           0,
                      height:          "3px",
                      backgroundColor: "var(--neutral-100)",
                    }}
                  >
                    <motion.div
                      style={{
                        height:          "100%",
                        backgroundColor: "#22C55E",
                        borderRadius:    "0 0 8px 8px",
                      }}
                      animate={{ width: `${attachment.uploadProgress ?? 0}%` }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    />
                  </div>
                )}

                {/* Remove - only after upload */}
                {isHovered && !attachment.uploading && (
                  <button
                    type="button"
                    onClick={() => handleRemove(attachment.id)}
                    disabled={disabled}
                    aria-label={`Remove ${attachment.file.name}`}
                    style={{
                      position:        "absolute",
                      top:             "3px",
                      right:           "3px",
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      width:           "15px",
                      height:          "15px",
                      borderRadius:    "50%",
                      border:          "1px solid var(--neutral-200)",
                      backgroundColor: "#fff",
                      color:           "var(--neutral-600)",
                      cursor:          disabled ? "not-allowed" : "pointer",
                      padding:         0,
                      boxShadow:       "0 1px 2px rgba(0,0,0,0.06)",
                    }}
                  >
                    <CancelOneIcon size={9} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Left scroll chevron ── */}
        {showLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-200)}
            aria-label="Scroll attachments left"
            style={{
              position:        "absolute",
              left:            "4px",
              top:             "50%",
              transform:       "translateY(-25%)",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              width:           "28px",
              height:          "28px",
              borderRadius:    "50%",
              border:          "1px solid var(--neutral-200)",
              backgroundColor: "#fff",
              color:           "var(--neutral-700)",
              boxShadow:       "0 2px 8px rgba(0,0,0,0.10)",
              cursor:          "pointer",
              padding:         0,
              zIndex:          2,
              transition:      "background-color 120ms",
            }}
          >
            <ArrowLeftOneIcon size={14} />
          </button>
        )}

        {/* ── Right scroll chevron ── */}
        {showRight && (
          <button
            type="button"
            onClick={() => scrollBy(200)}
            aria-label="Scroll attachments right"
            style={{
              position:        "absolute",
              right:           "4px",
              top:             "50%",
              transform:       "translateY(-25%)",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              width:           "28px",
              height:          "28px",
              borderRadius:    "50%",
              border:          "1px solid var(--neutral-200)",
              backgroundColor: "#fff",
              color:           "var(--neutral-700)",
              boxShadow:       "0 2px 8px rgba(0,0,0,0.10)",
              cursor:          "pointer",
              padding:         0,
              zIndex:          2,
              transition:      "background-color 120ms",
            }}
          >
            <ArrowRightOneIcon size={14} />
          </button>
        )}
      </div>
    </>
  );
}

