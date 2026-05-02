"use client";

import { useState, useRef } from "react";
import { X, FileText, Image as ImageIcon, Upload } from "lucide-react";
import type { Attachment } from "@/types/chat";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_ATTACHMENTS = 10;

const SUPPORTED_TYPES: Record<string, string[]> = {
  document: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/csv",
  ],
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
};

const ACCEPT_STRING = [
  ...SUPPORTED_TYPES.document,
  ...SUPPORTED_TYPES.image,
].join(",");

function isImageFile(type: string): boolean {
  return SUPPORTED_TYPES.image.includes(type);
}

function getFileIcon(type: string) {
  if (isImageFile(type)) return <ImageIcon size={14} />;
  return <FileText size={14} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface PendingAttachment {
  id: string;
  file: File;
  preview?: string;
  uploading: boolean;
  error?: string;
}

interface AttachmentManagerProps {
  attachments: PendingAttachment[];
  onAttachmentsChange: (attachments: PendingAttachment[]) => void;
  disabled?: boolean;
}

export function AttachmentManager({
  attachments,
  onAttachmentsChange,
  disabled,
}: AttachmentManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (max ${formatFileSize(MAX_FILE_SIZE)})`;
    }

    const allTypes = [
      ...SUPPORTED_TYPES.document,
      ...SUPPORTED_TYPES.image,
    ];
    if (!allTypes.includes(file.type)) {
      return "Unsupported file type. Supported: PDF, DOCX, TXT, PNG, JPG, WEBP";
    }

    return null;
  };

  const addFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    if (attachments.length + fileArray.length > MAX_ATTACHMENTS) {
      toast.error(`Max ${MAX_ATTACHMENTS} files allowed`);
      return;
    }

    const newAttachments: PendingAttachment[] = [];

    for (const file of fileArray) {
      // Duplicate check
      const isDuplicate = attachments.some(
        (a) => a.file.name === file.name && a.file.size === file.size,
      );
      if (isDuplicate) {
        toast.info(`"${file.name}" already attached`);
        continue;
      }

      const error = validateFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
        continue;
      }

      const preview = isImageFile(file.type)
        ? URL.createObjectURL(file)
        : undefined;

      newAttachments.push({
        id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview,
        uploading: false,
      });
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
  };

  const removeAttachment = (id: string) => {
    const attachment = attachments.find((a) => a.id === id);
    if (attachment?.preview) {
      URL.revokeObjectURL(attachment.preview);
    }
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const triggerFileSelect = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  if (attachments.length === 0) {
    return (
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_STRING}
        onChange={handleFileSelect}
        style={{ display: "none" }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_STRING}
        onChange={handleFileSelect}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {/* Attachment chips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          padding: "8px 0",
        }}
      >
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "8px",
              backgroundColor: "var(--neutral-50)",
              border: attachment.error
                ? "1px solid var(--red-300)"
                : "1px solid var(--neutral-200)",
              maxWidth: "200px",
            }}
          >
            {/* Preview or icon */}
            {attachment.preview ? (
              <img
                src={attachment.preview}
                alt=""
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "4px",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span style={{ color: "var(--neutral-500)", display: "flex" }}>
                {getFileIcon(attachment.file.type)}
              </span>
            )}

            {/* File name */}
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                color: "var(--neutral-700)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "120px",
              }}
            >
              {attachment.file.name}
            </span>

            {/* Size */}
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                color: "var(--neutral-400)",
                whiteSpace: "nowrap",
              }}
            >
              {formatFileSize(attachment.file.size)}
            </span>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeAttachment(attachment.id)}
              aria-label={`Remove ${attachment.file.name}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "var(--neutral-200)",
                color: "var(--neutral-600)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={10} />
            </button>
          </div>
        ))}

        {/* Add more button */}
        {attachments.length < MAX_ATTACHMENTS && (
          <button
            type="button"
            onClick={triggerFileSelect}
            disabled={disabled}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px dashed var(--neutral-300)",
              backgroundColor: "transparent",
              color: "var(--neutral-500)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <Upload size={12} />
            Add
          </button>
        )}
      </div>
    </div>
  );
}

