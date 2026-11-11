"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ImageLightbox, downloadImage } from "./ImageLightbox";
import type { Attachment } from "@/types/chat";

// ── An image the person attached to their own message: the same tile the
//    composer previewed, and the same lightbox a generated image opens ──

const cardStyle: React.CSSProperties = {
  position:        "relative",
  display:         "inline-flex",
  alignItems:      "center",
  gap:             "10px",
  padding:         "6px",
  paddingRight:    "12px",
  borderRadius:    "14px",
  backgroundColor: "color-mix(in srgb, var(--neutral-800) 7%, transparent)",
  border:          "1px solid var(--neutral-800-10)",
  maxWidth:        "260px",
};

// The tile is a button (keyboard-reachable, opens the lightbox) that looks like the bare image.
const tileButtonStyle: React.CSSProperties = {
  position:     "relative",
  width:        56,
  height:       56,
  padding:      0,
  border:       "none",
  background:   "none",
  borderRadius: 10,
  overflow:     "hidden",
  flexShrink:   0,
  cursor:       "zoom-in",
};

const textStyle: React.CSSProperties = {
  display:       "flex",
  flexDirection: "column",
  gap:           2,
  minWidth:      0,
};

const nameStyle: React.CSSProperties = {
  fontFamily:   "var(--font-body)",
  fontSize:     "12px",
  fontWeight:   500,
  color:        "var(--neutral-700)",
  overflow:     "hidden",
  textOverflow: "ellipsis",
  whiteSpace:   "nowrap",
};

const metaStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize:   "12px",
  color:      "var(--neutral-600)",
  flexShrink: 0,
};

export function SentImageAttachment({ att, url }: { att: Attachment; url: string }) {
  const [expanded, setExpanded] = useState(false);

  const ext = att.file_name.split(".").pop()?.toUpperCase() ?? "IMAGE";

  function handleDownload() {
    downloadImage(url, att.file_name || "image.png");
  }

  // No hover overlay here, unlike the generated-image card: its buttons need a
  // 320px card to sit on, and over a 56px tile they would cover the picture and
  // swallow the click that opens it. Expand and Download live in the lightbox.
  return (
    <div style={cardStyle}>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Expand ${att.file_name || "image"}`}
        className="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        style={tileButtonStyle}
      >
        <Image src={url} alt="" fill sizes="56px" unoptimized style={{ objectFit: "cover" }} />
      </button>
      <span style={textStyle}>
        <span style={nameStyle}>{att.file_name}</span>
        <span style={metaStyle}>{ext}</span>
      </span>
      <ImageLightbox
        open={expanded}
        onOpenChange={setExpanded}
        url={url}
        alt={att.file_name || "Attached image"}
        onDownload={handleDownload}
      />
    </div>
  );
}
