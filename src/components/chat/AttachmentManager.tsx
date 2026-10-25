"use client";

import { Tooltip } from '@/components/Tooltip'
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeftOneIcon,
  ArrowRightOneIcon,
  CancelOneIcon,
} from "@strange-huge/icons";
import {
  useFileUpload,
  getFileTypeLabel,
  formatFileSize,
  type PendingAttachment,
} from "@/hooks/use-file-upload";
import { attachmentSizeBytes, cancelComposerUpload } from "@/lib/library/upload/composer-uploads";
import { Spinner } from "@/components/Spinner";
import { FormatGlyph } from "@/components/Library/FormatGlyph";
import type { Format } from "@/lib/library/schemas";

// Re-export so callers that imported PendingAttachment from here still work.
export type { PendingAttachment };

// ── File type ─────────────────────────────────────────────────────────────────
// The Library format of a file, for the same tinted icon Library lists use.
const FORMAT_BY_EXTENSION: Record<string, Format> = {
  pdf: "pdf", doc: "document", docx: "document", odt: "document", rtf: "document",
  ppt: "slides", pptx: "slides", key: "slides", xls: "sheet", xlsx: "sheet", csv: "sheet", ods: "sheet",
  txt: "text", md: "text", json: "text", xml: "text", html: "web", htm: "web", eml: "email", msg: "email",
};

function formatOfFile(file: File): Format {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return FORMAT_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "text";
}

const CARD_TEXT = { fontFamily: "var(--font-body)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

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
          width:           "18px",
          height:          "18px",
          borderRadius:    "50%",
          backgroundColor: onImage ? "color-mix(in srgb, var(--static-black) 60%, transparent)" : "var(--neutral-900)",
          color:           "var(--static-white)",
        }}
      >
        <CancelOneIcon size={10} />
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
            outline:              isDragging ? "2px dashed var(--neutral-300)" : "none",
            outlineOffset:        "2px",
            minHeight:            "56px",
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
                  width:        "56px",
                  height:       "56px",
                  borderRadius: "14px",
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
                    sizes="56px"
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
                      borderRadius:    "14px",
                    }}
                  >
                    <svg width="26" height="26" viewBox="0 0 28 28">
                      <circle cx="14" cy="14" r="10" fill="none" stroke="var(--neutral-50-30)" strokeWidth="2.5" />
                      <circle
                        cx="14" cy="14" r="10"
                        fill="none"
                        stroke="var(--static-white)"
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
              // ── Document card (the prototype's attachment card: icon, name, then status or type) ──
              <Tooltip key={attachment.id} content={attachment.error ?? attachment.file.name} maxWidth={280}><div
                {...cardProps(attachment)}
                style={{
                  position:        "relative",
                  display:         "flex",
                  alignItems:      "center",
                  gap:             "10px",
                  width:           "232px",
                  height:          "56px",
                  padding:         "0 28px 0 8px",
                  borderRadius:    "14px",
                  border:          attachment.error ? "1px solid var(--red-400, #f87171)" : "1px solid var(--border-default)",
                  backgroundColor: "var(--card-bg)",
                  flexShrink:      0,
                  cursor:          attachment.uploading || attachment.error ? "default" : "pointer",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display:         "flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                    width:           "38px",
                    height:          "38px",
                    borderRadius:    "10px",
                    border:          "1px solid var(--border-default)",
                    backgroundColor: "var(--neutral-50)",
                    flexShrink:      0,
                  }}
                >
                  <FormatGlyph format={formatOfFile(attachment.file)} size="sm" />
                </span>

                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                  <p style={{ ...CARD_TEXT, fontSize: "14px", fontWeight: 500, color: "var(--neutral-900)" }}>
                    {attachment.file.name}
                  </p>
                  <p style={{ ...CARD_TEXT, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: attachment.error ? "var(--red-600, #dc2626)" : "var(--neutral-500)" }}>
                    {attachment.error ? (
                      attachment.error
                    ) : attachment.uploading || attachment.processing ? (
                      <>
                        <Spinner size={12} />
                        {attachment.uploading ? `Uploading ${attachment.uploadProgress ?? 0}%` : "Processing"}
                      </>
                    ) : (
                      `${typeLabel} · ${formatFileSize(attachmentSizeBytes(attachment.file))}`
                    )}
                  </p>
                </div>

                {/* Remove - also while uploading (removing cancels the upload). Always in the DOM so keyboard users can reach it. */}
                <RemoveButton
                  name={attachment.file.name}
                  visible={noHover || isHovered || focusedId === attachment.id}
                  disabled={disabled}
                  onRemove={() => handleRemove(attachment.id)}
                  variant="document"
                />
              </div></Tooltip>
            );
          })}
        </div>

      </div>
    </>
  );
}
