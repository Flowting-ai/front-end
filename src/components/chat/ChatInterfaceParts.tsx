"use client";

import React from "react";
import { AnimatePresence, m } from "framer-motion";
import { ArrowDownOneIcon, InformationCircleIcon } from "@strange-huge/icons";
import { IconButton } from "@/components/ui/button";
import { AttachmentManager, type PendingAttachment } from "./AttachmentManager";
import { PinChipStrip } from "./PinChipStrip";
import { MentionChip } from "@/components/chat/MentionChip";
import { UploadNotices } from "@/components/Library/upload/UploadNotices";

// Presentational pieces of ChatInterface's layout.

/** A visually hidden polite live region (screen-reader-only status text). */
export function SrOnlyStatus({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Failed-to-load banner — shown instead of the empty state when the initial
 * history fetch failed, so a transient backend error reads as "couldn't load
 * this conversation, retry" rather than as an empty/deleted chat.
 */
export function ChatLoadError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "32px 16px",
        textAlign: "center",
        fontFamily: "var(--font-body)",
      }}
    >
      <p style={{ margin: 0, fontSize: 14, color: "var(--neutral-500)" }}>
        Couldn&apos;t load this conversation. {error}
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--static-white)",
          background: "var(--neutral-900)",
          border: "none",
          borderRadius: 999,
          padding: "7px 16px",
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}

/** Scroll-to-bottom button, shown while the view isn't following the bottom. */
export function ScrollToBottomButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="scroll-to-bottom"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            x: '-50%',
            zIndex: 10,
          }}
        >
          <IconButton
            variant="secondary"
            size="sm"
            aria-label="Scroll to bottom"
            icon={<ArrowDownOneIcon size={16} />}
            onClick={onClick}
          />
        </m.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Archived chats can't be edited at all — a disabled composer with an
 * explanatory placeholder still looks like a text field you could try typing
 * into. A plain info banner says outright that this chat is read-only instead.
 */
export function ArchivedChatNotice() {
  return (
    <div
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             10,
        padding:         "12px 16px",
        borderRadius:    "var(--toast-radius, 12px)",
        backgroundColor: "var(--neutral-100)",
        boxShadow:       "inset 0 0 0 1px var(--neutral-200)",
      }}
    >
      <InformationCircleIcon size={16} color="var(--neutral-500)" />
      <p
        style={{
          margin:     0,
          fontFamily: "var(--font-body)",
          fontWeight: "var(--font-weight-medium)",
          fontSize:   "var(--font-size-body)",
          lineHeight: "var(--line-height-body)",
          color:      "var(--neutral-600)",
        }}
      >
        This is an archived chat. It&apos;s read-only.
      </p>
    </div>
  );
}

/** The composer's attachments area: @-mentioned pin chips (when shown), upload notices and files. */
export function ComposerAttachmentsSlot({
  showPins,
  mentionedPins,
  onRemoveMention,
  uploadNotices,
  attachments,
  onAttachmentsChange,
}: {
  showPins: boolean;
  mentionedPins: ReadonlyArray<{ id: string; label: string }>;
  onRemoveMention: (id: string) => void;
  uploadNotices: React.ComponentProps<typeof UploadNotices>;
  attachments: PendingAttachment[];
  onAttachmentsChange: (attachments: PendingAttachment[]) => void;
}) {
  return showPins && mentionedPins.length > 0 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <PinChipStrip>
        {mentionedPins.map((mp) => (
          <MentionChip
            key={mp.id}
            label={mp.label}
            onRemove={() => onRemoveMention(mp.id)}
          />
        ))}
      </PinChipStrip>
      <UploadNotices {...uploadNotices} />
      <AttachmentManager
        attachments={attachments}
        onAttachmentsChange={onAttachmentsChange}
        libraryValidates
      />
    </div>
  ) : (
    <>
      <UploadNotices {...uploadNotices} />
      <AttachmentManager
        attachments={attachments}
        onAttachmentsChange={onAttachmentsChange}
        libraryValidates
      />
    </>
  );
}
