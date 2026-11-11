"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, m } from "framer-motion";
import { IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { ImageDownloadTwoIcon, ArrowExpandOneIcon } from "@strange-huge/icons";
import { ImageLightbox, downloadImage, overlayButtonStyle } from "./ImageLightbox";

// ── Generated Image Card with download button ──────────────────────────────────
// The expanded view it opens is shared with the images a person attaches to
// their own message — see ImageLightbox.

// Static styles live at module level so a streaming re-render doesn't
// allocate them again.
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

const hoverOverlayStyle: React.CSSProperties = {
  position: "absolute",
  top: "8px",
  right: "8px",
};

const hoverButtonsStyle: React.CSSProperties = { display: "flex", gap: "6px" };

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
    downloadImage(img.url, filename);
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
      <ImageLightbox
        open={expanded}
        onOpenChange={setExpanded}
        url={img.url}
        alt="Generated image"
        onDownload={handleDownload}
      />
    </m.div>
  );
}
