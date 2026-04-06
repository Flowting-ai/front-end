"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface UseFileDropOptions {
  onFiles: (files: File[]) => void;
  /** Limit to these MIME type prefixes, e.g. ["image/"] */
  accept?: string[];
  disabled?: boolean;
}

/**
 * Hook that provides drag-and-drop + paste file handling for any drop zone.
 * Returns drag state and event handlers to spread onto the target element.
 */
export function useFileDrop({ onFiles, accept, disabled }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const filterFiles = useCallback(
    (fileList: FileList | DataTransferItem[]): File[] => {
      const files: File[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const item = fileList[i];
        const file = item instanceof File ? item : (item as DataTransferItem).getAsFile?.();
        if (!file) continue;
        if (accept && accept.length > 0) {
          const matches = accept.some((prefix) => file.type.startsWith(prefix));
          if (!matches) continue;
        }
        files.push(file);
      }
      return files;
    },
    [accept],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (e.dataTransfer?.types?.includes("Files")) {
        setIsDragging(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      const droppedFiles = e.dataTransfer?.files;
      if (droppedFiles && droppedFiles.length > 0) {
        const filtered = filterFiles(droppedFiles);
        if (filtered.length > 0) onFiles(filtered);
      }
    },
    [disabled, filterFiles, onFiles],
  );

  // Paste handler — attach to the element or to the document
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind !== "file") continue;
        const file = items[i].getAsFile();
        if (!file) continue;
        if (accept && accept.length > 0) {
          if (!accept.some((prefix) => file.type.startsWith(prefix))) continue;
        }
        files.push(file);
      }
      if (files.length > 0) {
        e.preventDefault();
        onFiles(files);
      }
    },
    [disabled, accept, onFiles],
  );

  const dropZoneProps = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  return { isDragging, dropZoneProps, handlePaste };
}
