"use client";

import { Tooltip } from '@/components/Tooltip'
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { m } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import PdfIcon from "@hugeicons/core-free-icons/Pdf01Icon";
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
import { attachmentSizeBytes, cancelComposerUpload } from "@/lib/library/upload/composer-uploads";
import { Badge, type BadgeColor } from "@/components/Badge";

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
  return <FolderOneIcon size={14} color="var(--neutral-500)" variant="static" />;
}

// ── Type-label → Badge color ──────────────────────────────────────────────────
function getTypeBadgeColor(label: string): BadgeColor {
  switch (label) {
    case "PDF":           return "Red";
    case "Word":          return "Blue";
    case "PPT":           return "Brown";
    case "Excel":         return "Green";
    case "CSV":           return "Green";
    case "JSON": case "XML": case "HTML": return "Purple";
    case "ZIP":           return "Brown";
    default:              return "Neutral";
  }
}

// ── Remove button ─────────────────────────────────────────────────────────────
// The button is 24px (the hit target) around a 15px circle. It sits inside a clickable
// card, so its click and key events must not reach the card (that would open a preview).

function RemoveButton({
  name,
  visible,
  disabled,
  onRemove,
  variant,
}: {
  name: string;
  visible: boolean;
  disabled?: boolean;
  onRemove: () => void;
  variant: "image" | "document";
}) {
  const onImage = variant === "image";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      disabled={disabled}
      aria-label={`Remove ${name}`}
      style={{
        position:       "absolute",
        top:            0,
        right:          0,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        width:          "24px",
        height:         "24px",
        padding:        0,
        border:         "none",
        background:     "none",
        opacity:        visible ? 1 : 0,
        transition:     "opacity 100ms",
        cursor:         disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          width:           "15px",
          height:          "15px",
          borderRadius:    "50%",
          border:          onImage ? "none" : "1px solid var(--border-default)",
          backgroundColor: onImage ? "color-mix(in srgb, var(--static-black) 55%, transparent)" : "var(--neutral-white)",
          color:           onImage ? "var(--static-white)" : "var(--neutral-600)",
          boxShadow:       onImage ? "none" : "0 1px 2px color-mix(in srgb, var(--static-black) 6%, transparent)",
        }}
      >
        <CancelOneIcon size={9} />
      </span>
    </button>
  );
}

// ── Scroll arrow ──────────────────────────────────────────────────────────────

function ScrollArrow({ direction, disabled, onClick }: { direction: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Scroll attachments ${direction}`}
      style={{
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        width:           "24px",
        height:          "24px",
        borderRadius:    "50%",
        border:          "1px solid var(--border-default)",
        backgroundColor: "var(--neutral-white)",
        color:           "var(--neutral-700)",
        cursor:          disabled ? "default" : "pointer",
        opacity:         disabled ? 0.4 : 1,
        padding:         0,
        transition:      "background-color 120ms, opacity 120ms",
      }}
    >
      {direction === "left" ? <ArrowLeftOneIcon size={12} /> : <ArrowRightOneIcon size={12} />}
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AttachmentManagerProps {
  attachments: PendingAttachment[];
  onAttachmentsChange: (attachments: PendingAttachment[]) => void;
  disabled?: boolean;
  /** Files go to Library, whose check refuses bad files (see useFileUpload). */
  libraryValidates?: boolean;
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
  libraryValidates = false,
}: AttachmentManagerProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft,   setShowLeft]   = useState(false);
  const [showRight,  setShowRight]  = useState(false);
  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [focusedId,  setFocusedId]  = useState<string | null>(null);
  // No hover on touch screens, so the remove button is always shown there.
  const [noHover,    setNoHover]    = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { processFiles, removeAttachment: removeOne, FILE_ACCEPT } = useFileUpload({ libraryValidates });

  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const sync = () => setNoHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
    // A keyboard user removes from the button, which is about to unmount. Hand focus to a
    // neighbouring card (or back to the message box) instead of dropping it on the page body.
    const fromKeyboard = scrollRef.current?.contains(document.activeElement) ?? false;
    const index = attachments.findIndex((a) => a.id === id);
    const neighbour = attachments[index + 1] ?? attachments[index - 1];
    const strip = scrollRef.current;
    const textarea = strip?.closest("form, [role='group'], body")?.querySelector<HTMLTextAreaElement>("textarea.kaya-chat-textarea")
      ?? document.querySelector<HTMLTextAreaElement>("textarea.kaya-chat-textarea");
    const removed = attachments.find((a) => a.id === id);
    if (removed) cancelComposerUpload(removed.file);
    onAttachmentsChange(removeOne(id, attachments));
    if (!fromKeyboard) return;
    requestAnimationFrame(() => {
      const next = neighbour && strip?.querySelector<HTMLElement>(`[data-attachment-id="${neighbour.id}"]`);
      (next ?? textarea)?.focus();
    });
  };

  // Opens the local file in a new tab. Images already have a standing preview
  // object URL; other file types get one created on demand and revoked shortly
  // after (long enough for the new tab to finish loading it).
  const handlePreview = (attachment: PendingAttachment) => {
    const url = attachment.preview ?? URL.createObjectURL(attachment.file);
    window.open(url, "_blank", "noopener,noreferrer");
    if (!attachment.preview) {
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  };

  // A card opens its preview only when it is a finished upload. The remove button is
  // a child of the card, so it must stop its own click and key events from reaching these.
  const cardProps = (attachment: PendingAttachment) => {
    const canPreview = !attachment.uploading && !attachment.error;
    return {
      role:      "button" as const,
      "data-attachment-id": attachment.id,
      tabIndex:  canPreview ? 0 : -1,
      "aria-label": canPreview ? `Preview ${attachment.file.name}` : attachment.file.name,
      "aria-disabled": canPreview ? undefined : true,
      onMouseEnter: () => setHoveredId(attachment.id),
      onMouseLeave: () => setHoveredId(null),
      onFocus: () => setFocusedId(attachment.id),
      onBlur: (e: React.FocusEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusedId(null);
      },
      onClick: () => canPreview && handlePreview(attachment),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget || !canPreview) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handlePreview(attachment);
        }
      },
    };
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
    if (!disabled && e.dataTransfer.types.includes("Files")) setIsDragging(true);
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
              fontSize: "12px",
              fontWeight:  500,
              color:       "var(--neutral-500)",
              lineHeight:  1,
            }}
          >
            {attachments.length} file{attachments.length !== 1 ? "s" : ""} attached
          </span>
          {/* Scroll arrows sit in this header row, not over the cards, so they never cover a card or its remove button. */}
          {(showLeft || showRight) && (
            <span style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
              <ScrollArrow direction="left" disabled={!showLeft} onClick={() => scrollBy(-200)} />
              <ScrollArrow direction="right" disabled={!showRight} onClick={() => scrollBy(200)} />
            </span>
          )}
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
              <Tooltip key={attachment.id} content={attachment.error ?? attachment.file.name} maxWidth={280}><div
                {...cardProps(attachment)}
                style={{
                  position:     "relative",
                  width:        "46px",
                  height:       "46px",
                  borderRadius: "8px",
                  border:       attachment.error ? "1px solid var(--red-400, #f87171)" : "1px solid var(--border-default)",
                  overflow:     "hidden",
                  flexShrink:   0,
                  cursor:       attachment.uploading || attachment.error ? "default" : "pointer",
                }}
              >
                {attachment.preview && (
                  <Image
                    src={attachment.preview}
                    alt={attachment.file.name}
                    fill
                    sizes="46px"
                    unoptimized
                    style={{
                      objectFit: "cover",
                      filter: attachment.uploading || attachment.processing ? "blur(1.5px)" : "none",
                      transition: "filter 300ms",
                    }}
                  />
                )}

                {/* Circular upload progress ring (spins on while the server processes the file) */}
                {(attachment.uploading || attachment.processing) && (
                  <div
                    style={{
                      position:        "absolute",
                      inset:           0,
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      backgroundColor: "color-mix(in srgb, var(--static-black) 20%, transparent)",
                      borderRadius:    "8px",
                    }}
                  >
                    <svg width="26" height="26" viewBox="0 0 28 28">
                      <circle cx="14" cy="14" r="10" fill="none" stroke="var(--neutral-50-30)" strokeWidth="2.5" />
                      <circle
                        cx="14" cy="14" r="10"
                        fill="none"
                        stroke="var(--success-500)"
                        strokeWidth="2.5"
                        strokeDasharray={`${((attachment.uploadProgress ?? 0) * 62.83) / 100} 62.83`}
                        strokeLinecap="round"
                        transform="rotate(-90 14 14)"
                        style={{ transition: "stroke-dasharray 300ms ease-out" }}
                      />
                    </svg>
                  </div>
                )}

                {/* Type badge - only after upload (or a Failed badge if it errored) */}
                {!attachment.uploading && (
                  <span
                    style={{
                      position:        "absolute",
                      bottom:          "2px",
                      left:            "2px",
                      backgroundColor: attachment.error ? "var(--red-600, #dc2626)" : "color-mix(in srgb, var(--static-black) 55%, transparent)",
                      color:           "var(--static-white)",
                      fontSize: "12px",
                      fontFamily:      "var(--font-body)",
                      fontWeight:      600,
                      lineHeight:      1,
                      padding:         "2px 3px",
                      borderRadius:    "3px",
                      letterSpacing:   "0.02em",
                    }}
                  >
                    {attachment.error ? "Failed" : typeLabel}
                  </span>
                )}

                {/* Remove - also while uploading (removing cancels the upload). Always in the DOM so keyboard users can reach it. */}
                {(
                  <RemoveButton
                    name={attachment.file.name}
                    visible={noHover || isHovered || focusedId === attachment.id}
                    disabled={disabled}
                    onRemove={() => handleRemove(attachment.id)}
                    variant="image"
                  />
                )}
              </div></Tooltip>
            ) : (
              // ── Document chip ──────────────────────────────────────────────
              <Tooltip key={attachment.id} content={attachment.error ?? attachment.file.name} maxWidth={280}><div
                {...cardProps(attachment)}
                style={{
                  position:        "relative",
                  display:         "flex",
                  alignItems:      "center",
                  gap:             "8px",
                  width:           "172px",
                  height:          "46px",
                  padding:         "0 28px 0 6px",
                  borderRadius:    "8px",
                  border:          attachment.error ? "1px solid var(--red-400, #f87171)" : "1px solid var(--border-default)",
                  backgroundColor: "var(--neutral-50)",
                  overflow:        "hidden",
                  flexShrink:      0,
                  cursor:          attachment.uploading || attachment.error ? "default" : "pointer",
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
                      fontSize: "12px",
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
                  {attachment.processing ? (
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize:   "12px",
                        color:      "var(--neutral-500)",
                        margin:     "2px 0 0",
                        lineHeight: 1,
                      }}
                    >
                      Processing…
                    </p>
                  ) : attachment.uploading ? (
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize:   "12px",
                        color:      "var(--green-600, #16a34a)",
                        margin:     "2px 0 0",
                        lineHeight: 1,
                        transition: "color 200ms",
                      }}
                    >
                      {`Uploading… ${attachment.uploadProgress ?? 0}%`}
                    </p>
                  ) : attachment.error ? (
                    <p
                      style={{
                        fontFamily:   "var(--font-body)",
                        fontSize:     "12px",
                        color:        "var(--red-600, #dc2626)",
                        margin:       "2px 0 0",
                        lineHeight:   1.2,
                        overflow:     "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace:   "nowrap",
                      }}
                    >
                      {attachment.error}
                    </p>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                      <Badge label={typeLabel} color={getTypeBadgeColor(typeLabel)} style={{ padding: '1.5px' }} />
                      <span
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize:   "12px",
                          color:      "var(--neutral-500)",
                          lineHeight: 1,
                        }}
                      >
                        {formatFileSize(attachmentSizeBytes(attachment.file))}
                      </span>
                    </div>
                  )}
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
                    <m.div
                      style={{
                        width:           "100%",
                        height:          "100%",
                        backgroundColor: "var(--success-500)",
                        borderRadius:    "0 0 8px 8px",
                        transformOrigin: "left",
                      }}
                      animate={{ scaleX: (attachment.uploadProgress ?? 0) / 100 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    />
                  </div>
                )}

                {/* Remove - also while uploading (removing cancels the upload). Always in the DOM so keyboard users can reach it. */}
                {(
                  <RemoveButton
                    name={attachment.file.name}
                    visible={noHover || isHovered || focusedId === attachment.id}
                    disabled={disabled}
                    onRemove={() => handleRemove(attachment.id)}
                    variant="document"
                  />
                )}
              </div></Tooltip>
            );
          })}
        </div>

      </div>
    </>
  );
}
