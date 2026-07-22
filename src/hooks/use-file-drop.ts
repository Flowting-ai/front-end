"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseFileDropOptions {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function useFileDrop({ onFiles, disabled }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);
  // Keeps the listeners below stable across re-renders (they only ever need
  // the latest onFiles) so the drag-enter/leave counter isn't torn down and
  // re-attached mid-drag — which risked missing an event and leaving the
  // counter (and the "Drop files here" overlay) stuck.
  const onFilesRef = useRef(onFiles);
  useEffect(() => { onFilesRef.current = onFiles; }, [onFiles]);

  const reset = useCallback(() => {
    dragCountRef.current = 0;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (disabled) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current--;
      if (dragCountRef.current <= 0) {
        reset();
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      reset();

      if (e.dataTransfer?.files.length) {
        onFilesRef.current(Array.from(e.dataTransfer.files));
      }
    };

    // Failsafe: a drag session doesn't always end with a matching `drop` or a
    // fully-balanced set of `dragenter`/`dragleave` pairs — e.g. the user
    // drags a file back out to the OS desktop, cancels the OS-level drag with
    // Escape, or drops outside the viewport. Several browser/OS combinations
    // don't reliably fire a final `dragleave` on the document in those cases,
    // so the counter never returns to 0 and the overlay is stuck until a
    // reload. `dragend` fires on the drag SOURCE and reliably marks the end
    // of every drag gesture regardless of where/how it ended; window `blur`
    // and tab-hide are an extra fallback for drags that hand off to another
    // application entirely.
    const handleDragEnd = () => reset();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") reset();
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("dragend", handleDragEnd);
    window.addEventListener("blur", handleDragEnd);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("dragend", handleDragEnd);
      window.removeEventListener("blur", handleDragEnd);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [disabled, reset]);

  return { isDragging };
}
