"use client";

import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, useFocusReturn } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/button";
import { ImageDownloadTwoIcon, CancelOneIcon } from "@strange-huge/icons";

// ── The expanded-image view, shared by generated images and the images a
//    person attached to their own message, so both zoom and download alike ──

export const overlayButtonStyle: React.CSSProperties = {
  background: "color-mix(in srgb, var(--static-black) 55%, transparent)",
  backdropFilter: "blur(4px)",
  borderRadius: "8px",
  color: "var(--static-white)",
  border: "none",
  padding: "6px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const srOnlyStyle: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0,
};

const lightboxStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px",
  background: "color-mix(in srgb, var(--static-black) 80%, transparent)",
  cursor: "zoom-out",
  outline: "none",
};

const lightboxButtonsStyle: React.CSSProperties = { position: "absolute", top: "16px", right: "16px", display: "flex", gap: "8px" };

const lightboxImageStyle: React.CSSProperties = { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px", cursor: "default" };

/**
 * Saves the image instead of opening it. Routes through the /api/download proxy:
 * it streams the image server-side with Content-Disposition: attachment, so the
 * browser always saves it. A direct client fetch would fail CORS on presigned S3
 * URLs and fall back to opening a blank tab.
 */
export function downloadImage(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * The lightbox itself: a Radix Dialog, so focus moves in and is trapped, Escape
 * closes, and focus goes back to whatever opened it. A click on the backdrop
 * closes; the image and the buttons stop it.
 */
export function ImageLightbox({
  open,
  onOpenChange,
  url,
  alt,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  alt: string;
  onDownload: () => void;
}) {
  const { capture, handleCloseAutoFocus } = useFocusReturn();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onClick={() => onOpenChange(false)}
          onCloseAutoFocus={handleCloseAutoFocus}
          style={lightboxStyle}
        >
          {capture}
          <DialogPrimitive.Title style={srOnlyStyle}>Expanded image</DialogPrimitive.Title>
          <div style={lightboxButtonsStyle} onClick={(e) => e.stopPropagation()}>
            <IconButton onClick={onDownload} aria-label="Download image" icon={<ImageDownloadTwoIcon size={18} />} style={overlayButtonStyle} />
            <IconButton onClick={() => onOpenChange(false)} aria-label="Close" icon={<CancelOneIcon size={18} />} style={overlayButtonStyle} />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned URL, same as the card */}
          <img
            src={url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={lightboxImageStyle}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
