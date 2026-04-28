"use client";

import { X, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import type { AttachmentItem } from "@/hooks/use-chat-state";

// ─── File-type constants & helpers ────────────────────────────────────────────
// Exported so they can be consumed by chat-interface (processFiles, upload dialog)
// and by any other component that needs to validate or label file attachments.

export const DOCUMENT_UPLOAD_ACCEPT =
  ".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,.csv,text/csv,application/csv,.xls,application/vnd.ms-excel,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*";

export const DOCUMENT_FILE_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".csv",
  ".xls",
  ".xlsx",
];

/** Returns true when the file is one of the supported document or image types. */
export function isDocumentFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (file.type.startsWith("image/")) return true;
  if (DOCUMENT_FILE_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
    return true;
  }
  return (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-powerpoint" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "application/vnd.ms-excel" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

/** Returns a human-readable label for a given filename (e.g. "PDF Document"). */
export function getDocumentKindLabel(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "Word Document";
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx"))
    return "PowerPoint Presentation";
  if (lower.endsWith(".csv")) return "CSV Document";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "Excel Document";
  if (lower.endsWith(".pdf")) return "PDF Document";
  if (lower.startsWith("document")) return "Uploaded File";
  return "Document";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AttachmentManagerProps {
  /** Current list of pending attachments shown in the composer bar. */
  attachments: AttachmentItem[];
  /** Called when the user removes an individual attachment chip. */
  onRemoveAttachment: (id: string, url: string) => void;
  /** Ref for the horizontal scroll container — synced with useChatState scroll effects. */
  attachmentScrollRef: React.RefObject<HTMLDivElement | null>;
  /** Whether to show the left-scroll caret (scrolled past the start). */
  showLeftScrollButton: boolean;
  /** Whether to show the right-scroll caret (more content to the right). */
  showScrollButton: boolean;
  setShowLeftScrollButton: (visible: boolean) => void;
  setShowScrollButton: (visible: boolean) => void;
}

/**
 * Renders the horizontal attachment chip bar inside the composer input box.
 * Displays document chips (with progress bar) and image thumbnails (with
 * circular progress ring) and scroll carets when the list overflows.
 * Returns null when there are no attachments.
 */
export function AttachmentManager({
  attachments,
  onRemoveAttachment,
  attachmentScrollRef,
  showLeftScrollButton,
  showScrollButton,
  setShowLeftScrollButton,
  setShowScrollButton,
}: AttachmentManagerProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="relative px-5 pt-4">
      <div
        ref={attachmentScrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          setShowLeftScrollButton(el.scrollLeft > 10);
          setShowScrollButton(
            el.scrollWidth > el.clientWidth &&
              el.scrollLeft < el.scrollWidth - el.clientWidth - 10,
          );
        }}
      >
        {attachments.map((attachment) =>
          attachment.type !== "image" ? (
            <div
              key={attachment.id}
              className="group relative shrink-0 flex items-center gap-2.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] p-1.5 overflow-hidden"
              style={{ width: "180.3px", height: "60px" }}
            >
              {attachment.isUploading && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-[#22C55E] transition-all duration-300"
                  style={{ width: `${attachment.uploadProgress ?? 0}%` }}
                />
              )}
              <div className="flex h-full w-12 items-center justify-center rounded-lg bg-[#F5F5F5]">
                <FileText className="h-5 w-5 text-[#666666]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-[#1E1E1E]">
                  {attachment.name}
                </p>
                <p className="text-[10px] text-[#888888]">
                  {attachment.isUploading
                    ? `Uploading... ${attachment.uploadProgress ?? 0}%`
                    : getDocumentKindLabel(attachment.name)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveAttachment(attachment.id, attachment.url)}
                className="absolute top-0.5 right-0.5 rounded-full bg-white border border-[#E5E5E5] p-0.5 hover:bg-[#F5F5F5] shadow-sm transition-colors z-10 opacity-0 group-hover:opacity-100"
              >
                <X className="h-3 w-3 text-[#666666]" />
              </button>
            </div>
          ) : (
            <div
              key={attachment.id}
              className="group relative shrink-0 rounded-[11px] border border-[#E5E5E5] bg-[#FAFAFA] overflow-hidden"
              style={{ width: "60px", height: "60px", padding: "1.08px" }}
            >
              <Image
                src={attachment.url}
                alt={attachment.name}
                width={0}
                height={0}
                className={`w-full h-full object-cover rounded-[10px] transition-all duration-300 ${attachment.isUploading ? "blur-sm" : "blur-0"}`}
              />
              {attachment.isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-[10px]">
                  <svg className="w-8 h-8" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth="3"
                      strokeDasharray={`${((attachment.uploadProgress ?? 0) * 100.48) / 100}, 100.48`}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemoveAttachment(attachment.id, attachment.url)}
                className="absolute top-0.5 right-0.5 rounded-full bg-white border border-[#E5E5E5] p-0.5 hover:bg-[#F5F5F5] shadow-sm transition-colors z-10 opacity-0 group-hover:opacity-100"
              >
                <X className="h-3 w-3 text-[#666666]" />
              </button>
            </div>
          ),
        )}
      </div>

      {showLeftScrollButton && (
        <button
          type="button"
          onClick={() => {
            attachmentScrollRef.current?.scrollBy({
              left: -200,
              behavior: "smooth",
            });
          }}
          className="absolute left-3 top-1/2 translate-y-[-25%] flex h-8 w-8 items-center justify-center rounded-full bg-white border border-[#D9D9D9] shadow-md hover:bg-[#F5F5F5] transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-[#666666]" />
        </button>
      )}

      {showScrollButton && (
        <button
          type="button"
          onClick={() => {
            attachmentScrollRef.current?.scrollBy({
              left: 200,
              behavior: "smooth",
            });
          }}
          className="absolute right-3 top-1/2 translate-y-[-25%] flex h-8 w-8 items-center justify-center rounded-full bg-white border border-[#D9D9D9] shadow-md hover:bg-[#F5F5F5] transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-[#666666]" />
        </button>
      )}
    </div>
  );
}
