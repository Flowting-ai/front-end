"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "framer-motion";
import { Dialog, useFocusReturn } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { ImageDownloadTwoIcon, ArrowExpandOneIcon, CancelOneIcon } from "@strange-huge/icons";

// ── Generated Image Card with download button ──────────────────────────────────

// Static styles live at module level so a streaming re-render doesn't
// allocate them again.
const overlayButtonStyle: React.CSSProperties = {
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

const cardStyle: React.CSSProperties = {
  position: "relative",
  borderRadius: "10px",
  overflow: "hidden",
  border: "1px solid var(--border-default)",
  maxWidth: "320px",
};

// The thumbnail is a button (keyboard-reachable, opens the lightbox) that looks like the bare image.
const thumbButtonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 0,
  border: "none",
  background: "none",
  cursor: "zoom-in",
};

const imageStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  maxHeight: "300px",
  objectFit: "cover",
  cursor: "zoom-in",
};

const srOnlyStyle: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0,
};

const hoverOverlayStyle: React.CSSProperties = {
  position: "absolute",
  top: "8px",
  right: "8px",
};

const hoverButtonsStyle: React.CSSProperties = { display: "flex", gap: "6px" };

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

function isFocusVisible(el: Element) {
  try { return el.matches(":focus-visible"); } catch { return true; }
}

export function GeneratedImageCard({ img, index }: { img: { url: string; s3Key?: string }; index: number }) {
  const [hovered, setHovered] = useState(false);
  // Keyboard focus inside the card shows the same Expand/Download buttons hover does.
  const [focusWithin, setFocusWithin] = useState(false);
  // When the pointer was last pressed in the card or its lightbox (React events bubble out of the
  // portal): focus that follows a click, or comes back when a click closes the lightbox, is not
  // keyboard focus even where the browser still reports :focus-visible.
  const pointerDownAt = useRef(-Infinity);
  const [expanded, setExpanded] = useState(false);
  // The lightbox is a Radix Dialog: focus moves in and is trapped, Escape closes, and focus goes back
  // to what opened it (the thumbnail or the Expand button).
  const { capture, handleCloseAutoFocus } = useFocusReturn();

  // The lightbox is portalled but still inside this card for React's mouse events, so no
  // mouseleave comes when it closes under the pointer: hover is cleared on open instead.
  function openLightbox() {
    setHovered(false);
    setExpanded(true);
  }

  function handleDownload() {
    const filename = img.s3Key
      ? img.s3Key.split("/").pop() ?? "image.png"
      : `image-${index + 1}.png`;
    // Route through the /api/download proxy: it streams the image server-side
    // with Content-Disposition: attachment, so the browser always saves it.
    // A direct client fetch would fail CORS on presigned S3 URLs and fall back
    // to opening a blank tab.
    const a = document.createElement("a");
    a.href = `/api/download?url=${encodeURIComponent(img.url)}&filename=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <m.div
      key={img.url}
      // Lands blurred and sharpens, picking up where the generation
      // preview's "developing" canvas left off.
      initial={{ opacity: 0, scale: 0.97, filter: "blur(18px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: index * 0.1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Keyboard focus only: a mouse click focuses the thumbnail too, and the buttons should still go on mouse-out.
      onPointerDown={() => { pointerDownAt.current = performance.now(); }}
      onKeyDown={() => { pointerDownAt.current = -Infinity; }}
      onFocus={(e) => setFocusWithin(performance.now() - pointerDownAt.current > 1000 && isFocusVisible(e.target))}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false); }}
      style={cardStyle}
    >
      <button
        type="button"
        onClick={openLightbox}
        aria-label="Expand generated image"
        className="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        style={thumbButtonStyle}
      >
        <Image
          src={img.url}
          alt="Generated image"
          width={0}
          height={0}
          sizes="100%"
          unoptimized
          style={imageStyle}
        />
      </button>
      <AnimatePresence>
        {(hovered || focusWithin) && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={hoverOverlayStyle}
          >
            <div style={hoverButtonsStyle}>
              <Tooltip content="Expand image">
                <IconButton
                  onClick={openLightbox}
                  aria-label="Expand image"
                  icon={<ArrowExpandOneIcon size={16} />}
                  style={overlayButtonStyle}
                />
              </Tooltip>
              <Tooltip content="Download image">
                <IconButton
                  onClick={handleDownload}
                  aria-label="Download image"
                  icon={<ImageDownloadTwoIcon size={16} animated />}
                  style={overlayButtonStyle}
                />
              </Tooltip>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            aria-describedby={undefined}
            // A click on the backdrop closes; the image and buttons stop it.
            onClick={() => setExpanded(false)}
            onCloseAutoFocus={handleCloseAutoFocus}
            style={lightboxStyle}
          >
            {capture}
            <DialogPrimitive.Title style={srOnlyStyle}>Expanded image</DialogPrimitive.Title>
            <div style={lightboxButtonsStyle} onClick={(e) => e.stopPropagation()}>
              <IconButton onClick={handleDownload} aria-label="Download image" icon={<ImageDownloadTwoIcon size={18} />} style={overlayButtonStyle} />
              <IconButton onClick={() => setExpanded(false)} aria-label="Close" icon={<CancelOneIcon size={18} />} style={overlayButtonStyle} />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned URL, same as the card */}
            <img
              src={img.url}
              alt="Generated image"
              onClick={(e) => e.stopPropagation()}
              style={lightboxImageStyle}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </Dialog>
    </m.div>
  );
}
