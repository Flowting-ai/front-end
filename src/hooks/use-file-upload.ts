"use client";

import type React from "react";

/**
 * useFileUpload - global file upload constraints and helpers.
 *
 * Single source of truth for:
 *   - MAX_FILE_SIZE  (30 MB hard limit)
 *   - MAX_FILES      (10 attachments per message)
 *   - ALLOWED_TYPES  (mime-type → label map)
 *
 * All attachment mutation goes through `processFiles`, which validates,
 * deduplicates, and fires a KDS toast for every violated constraint.
 */

import { useCallback } from "react";
import { toast } from "sonner";

// ── Constraints ───────────────────────────────────────────────────────────────

export const FILE_CONSTRAINTS = {
  maxSizeBytes: 30 * 1024 * 1024, // 30 MB
  maxFiles:     10,
  /** All accepted MIME types. */
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-word",
    "application/msword",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
    "text/markdown",
    "application/json",
    "text/xml",
    "application/xml",
    "application/rtf",
    "text/rtf",
    "text/html",
    "application/epub+zip",
    "application/zip",
    "application/x-zip-compressed",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "image/tiff",
    "image/avif",
  ] as const,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingAttachment {
  id: string;
  file: File;
  /** Object URL for image previews (revoke on removal). */
  preview?: string;
  uploading: boolean;
  /** 0–100 upload progress (simulated client-side). */
  uploadProgress?: number;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a short, human-readable label for a file based on its MIME type. */
export function getFileTypeLabel(file: File): string {
  const mime = file.type.toLowerCase();
  if (mime === "application/pdf") return "PDF";
  if (
    mime === "application/msword" ||
    mime === "application/vnd.ms-word" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "Word";
  if (
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return "PPT";
  if (
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return "Excel";
  if (mime === "text/csv") return "CSV";
  if (mime === "text/plain") return "TXT";
  if (mime === "text/markdown") return "MD";
  if (mime === "application/json") return "JSON";
  if (mime === "text/xml" || mime === "application/xml") return "XML";
  if (mime === "application/rtf" || mime === "text/rtf") return "RTF";
  if (mime === "text/html") return "HTML";
  if (mime === "application/epub+zip") return "EPUB";
  if (mime === "application/zip" || mime === "application/x-zip-compressed") return "ZIP";
  if (mime.startsWith("image/")) {
    const sub = mime.split("/")[1]?.toUpperCase() ?? "Image";
    return sub === "JPEG" ? "JPG" : sub;
  }
  // Fallback: use file extension
  const ext = file.name.split(".").pop()?.toUpperCase();
  return ext ?? "File";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The accept string for <input type="file"> elements. */
export const FILE_ACCEPT = [
  "application/pdf",
  "application/msword",
  "application/vnd.ms-word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
  // extension fallbacks for browsers that don't send MIME for Office docs
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".csv",
  ".txt", ".md", ".json", ".xml", ".rtf", ".html", ".htm", ".epub",
  ".zip", ".svg", ".tiff", ".tif", ".avif",
].join(",");

/** File extensions that are accepted as a MIME-type fallback. */
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv",
  "txt", "md", "json", "xml", "rtf", "html", "svg", "tiff", 
  "tif", "avif", "png", "jpg", "jpeg", "webp",
]);

function isAllowedType(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/")) return true;
  if ((FILE_CONSTRAINTS.allowedMimeTypes as readonly string[]).some((t) => mime === t)) return true;
  // Fallback: check extension for browsers that don't report a MIME type (e.g. .md → "")
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXTENSIONS.has(ext);
}

function isDuplicate(file: File, existing: PendingAttachment[]): boolean {
  return existing.some(
    (a) => a.file.name === file.name && a.file.size === file.size,
  );
}

function makeAttachment(file: File): PendingAttachment {
  return {
    id:            `attach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    preview:       file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    uploading:     false,
    uploadProgress: 100,
  };
}

/**
 * Simulates upload progress for one attachment.
 * Runs a timed interval and updates the matching attachment via `setAttachments`.
 * Returns a cleanup function that cancels the interval.
 */
export function startUploadSimulation(
  id: string,
  fileSize: number,
  setAttachments: React.Dispatch<React.SetStateAction<PendingAttachment[]>>,
): () => void {
  // Scale duration by file size: ~200ms per MB, clamped 500ms–3s
  const duration = Math.min(Math.max((fileSize / (1024 * 1024)) * 200, 500), 3000);
  const steps = 20;
  const stepDuration = duration / steps;
  let current = 0;

  const interval = setInterval(() => {
    current += 100 / steps;
    if (current >= 100) {
      clearInterval(interval);
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, uploading: false, uploadProgress: 100 } : a,
        ),
      );
    } else {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, uploadProgress: Math.round(current) } : a,
        ),
      );
    }
  }, stepDuration);

  return () => clearInterval(interval);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns a `processFiles` function you can call whenever the user picks or
 * drops files. It validates against global constraints and returns the updated
 * attachment list, firing KDS toasts for every violation.
 *
 * Usage:
 * ```tsx
 * const { processFiles } = useFileUpload();
 * const next = processFiles(fileList, currentAttachments);
 * setAttachments(next);
 * ```
 */
export function useFileUpload() {
  const { maxSizeBytes, maxFiles } = FILE_CONSTRAINTS;

  const processFiles = useCallback(
    (incoming: FileList | File[], current: PendingAttachment[]): PendingAttachment[] => {
      const files = Array.from(incoming);
      const slotsLeft = maxFiles - current.length;

      if (slotsLeft <= 0) {
        toast.error("File limit reached", {
          description: `You can attach a maximum of ${maxFiles} files per message.`,
        });
        return current;
      }

      const toAdd: PendingAttachment[] = [];
      const duplicates: string[] = [];
      const oversized: string[] = [];
      const unsupported: string[] = [];
      let skipped = 0;

      for (const file of files) {
        // Slot limit (respect already-queued toAdd)
        if (toAdd.length >= slotsLeft) {
          skipped++;
          continue;
        }

        // Duplicate
        if (isDuplicate(file, current) || isDuplicate(file, toAdd)) {
          duplicates.push(file.name);
          continue;
        }

        // Size
        if (file.size > maxSizeBytes) {
          oversized.push(file.name);
          continue;
        }

        // Type
        if (!isAllowedType(file)) {
          unsupported.push(file.name);
          continue;
        }

        toAdd.push(makeAttachment(file));
      }

      // ── Toasts ────────────────────────────────────────────────────────────

      if (duplicates.length > 0) {
        toast.error(
          duplicates.length === 1
            ? `"${duplicates[0]}" already attached`
            : `${duplicates.length} duplicate files skipped`,
          { description: duplicates.length > 1 ? duplicates.join(", ") : undefined },
        );
      }

      if (oversized.length > 0) {
        const limit = `${maxSizeBytes / (1024 * 1024)} MB`;
        toast.error(
          oversized.length === 1
            ? `"${oversized[0]}" exceeds ${limit}`
            : `${oversized.length} files exceed ${limit}`,
          { description: "Please upload smaller files." },
        );
      }

      if (unsupported.length > 0) {
        const names = unsupported.join(", ");
        toast.error(
          unsupported.length === 1
            ? `"${unsupported[0]}" isn't supported`
            : `${unsupported.length} files aren't supported`,
          {
            description:
              `${unsupported.length === 1 ? `"${unsupported[0]}"` : `These files (${names})`} can't be attached.` +
              " Supported: PDF, Word, PowerPoint, Excel, CSV, TXT, MD, JSON, XML, RTF, HTML, EPUB, ZIP, PNG, JPG, WEBP, SVG, TIFF, AVIF.",
          },
        );
      }

      if (skipped > 0) {
        toast.error("File limit reached", {
          description: `${skipped} file${skipped > 1 ? "s were" : " was"} skipped - max ${maxFiles} attachments per message.`,
        });
      }

      return toAdd.length > 0 ? [...current, ...toAdd] : current;
    },
    [maxSizeBytes, maxFiles],
  );

  /**
   * Revoke the object URL of a single attachment before removing it from state.
   */
  const removeAttachment = useCallback(
    (id: string, current: PendingAttachment[]): PendingAttachment[] => {
      const target = current.find((a) => a.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return current.filter((a) => a.id !== id);
    },
    [],
  );

  return { processFiles, removeAttachment, FILE_ACCEPT, FILE_CONSTRAINTS };
}
