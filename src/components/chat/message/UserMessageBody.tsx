"use client";

import React from "react";
import { PINS_ENABLED } from "@/lib/feature-flags";
import { SentImageAttachment } from "./SentImageAttachment";
import { SentLibraryAttachment } from "@/components/Library/chat/SentLibraryAttachment";
import { MessageBubble } from "@/components/MessageBubble";
import { formatDate } from "@/lib/utils/format-utils";
import type { UIMessage } from "@/types/chat";

// ── User message: right-aligned bubble with pin + file chips above it ─────────

const columnStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, width: "100%", maxWidth: 566 };

const chipRowStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "flex-end" };

// Shared by pin chips and file chips.
const chipStyle: React.CSSProperties = {
  display:         "inline-flex",
  alignItems:      "center",
  gap:             "5px",
  padding:         "4px 8px",
  borderRadius:    "8px",
  backgroundColor: "color-mix(in srgb, var(--neutral-800) 7%, transparent)",
  border:          "1px solid var(--neutral-800-10)",
  maxWidth:        "220px",
};

const chipIconStyle: React.CSSProperties = { flexShrink: 0 };

const chipLabelStyle: React.CSSProperties = {
  fontFamily:   "var(--font-body)",
  fontSize:     "12px",
  fontWeight:   500,
  color:        "var(--neutral-700)",
  overflow:     "hidden",
  textOverflow: "ellipsis",
  whiteSpace:   "nowrap",
};

// The upload progress and the extension badge share one style.
const chipMetaStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "12px",
  color:      "var(--neutral-600)",
  flexShrink: 0,
};

const chipLinkStyle: React.CSSProperties = { textDecoration: "none", flexShrink: 0 };

export function UserMessageBody({
  message,
  archived,
  onRegenerate,
  onEdit,
}: {
  message: UIMessage;
  archived: boolean;
  onRegenerate?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
}) {
  return (
    <div style={columnStyle}>
      {/* Pin attachment chips - appear above file chips and bubble */}
      {PINS_ENABLED && message.mentionedPins && message.mentionedPins.length > 0 && (
        <div style={chipRowStyle}>
          {message.mentionedPins.map((pin) => (
            <div
              key={pin.id}
              style={chipStyle}
            >
              {/* Pin icon */}
              <svg
                width="12" height="12" viewBox="0 0 24 24"
                fill="none" stroke="var(--neutral-500)" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
                style={chipIconStyle}
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              <span style={chipLabelStyle}>
                @{pin.label}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* File attachment chips - appear above the message bubble */}
      {message.attachments && message.attachments.length > 0 && (
        <div style={chipRowStyle}>
          {message.attachments.map((att) => {
            const ext = att.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
            const isImage = att.file_type.startsWith("image/");
            // The picture itself as soon as there is something to show it from —
            // the local file while it uploads, the backend's link afterwards — so
            // the sent message doesn't start as a document chip and turn into a
            // picture later. An image with no link at all still falls back below.
            const chip = isImage && att.url ? (
              <SentImageAttachment key={att.id} att={att} url={att.url} uploading={att.uploading} />
            ) : (
              <div
                key={att.id}
                style={chipStyle}
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="var(--neutral-500)" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={chipIconStyle}
                >
                  {isImage ? (
                    <>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </>
                  ) : (
                    <>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </>
                  )}
                </svg>
                <span style={chipLabelStyle}>
                  {att.file_name}
                </span>
                {att.uploading ? (
                  <span style={chipMetaStyle}>
                    {att.uploadProgress !== undefined && att.uploadProgress < 100
                      ? `${att.uploadProgress}%`
                      : "Uploading…"}
                  </span>
                ) : (
                  <span style={chipMetaStyle}>
                    {ext}
                  </span>
                )}
              </div>
            );
            // An image opens its lightbox in place, so it must not also be a link
            // that navigates away; everything else still opens in a new tab.
            const node = att.url && !att.uploading && !isImage ? (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                style={chipLinkStyle}
              >
                {chip}
              </a>
            ) : (
              <React.Fragment key={att.id}>{chip}</React.Fragment>
            );
            // A Library file that was deleted (or is locked) reads "File deleted" / "Locked file", not its name.
            return att.libraryFileId ? (
              <SentLibraryAttachment key={att.id} fileId={att.libraryFileId} state={att.libraryState}>{node}</SentLibraryAttachment>
            ) : node;
          })}
        </div>
      )}

      {/* A file sent with no text has nothing to put in a bubble: the chips above
          are the message, so an empty bubble would just be a stray blank slab. */}
      {(message.content.trim() || !message.attachments?.length) && (
      <MessageBubble
        role="user"
        content={message.content}
        timestamp={formatDate(message.created_at)}
        onRetry={onRegenerate}
        onEditSave={onEdit ? (newContent) => onEdit(message.id, newContent) : undefined}
        maxWidth={566}
        hideActions={archived}
      />
      )}
    </div>
  );
}
