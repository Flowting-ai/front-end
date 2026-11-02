"use client";

import React from "react";
import { AnimatePresence } from "framer-motion";
import { TurnStatusChips } from "./TurnStatusChips";
import { PinMentionDropdown } from "./PinMentionDropdown";
import { QueuedMessagesTray } from "./QueuedMessagesTray";
import { LibrarySearchOffNote } from "@/components/Library/chat/LibrarySearchOffNote";
import { InlineCreditNotice } from "@/components/InlineCreditNotice";
import { ExhaustionBanner } from "@/components/ExhaustionBanner";
import { ArchivedChatNotice } from "./ChatInterfaceParts";
import type { UIMessage } from "@/types/chat";

interface ChatComposerAreaProps {
  /** Workspace credit notice (team plan only, dismissible per status level). */
  creditNotice: Omit<React.ComponentProps<typeof InlineCreditNotice>, "status"> & {
    status: React.ComponentProps<typeof InlineCreditNotice>["status"] | null | undefined;
  };
  archived: boolean;
  readOnly: boolean;
  messages: UIMessage[];
  isStreaming: boolean;
  /** Queued messages tray; keyed by `queueKey`. */
  queueKey: string;
  tray: Omit<React.ComponentProps<typeof QueuedMessagesTray>, "key">;
  inputWrapperRef: React.Ref<HTMLDivElement>;
  /** The pin @-mention dropdown, or null when pin actions are hidden. */
  pinDropdown: React.ComponentProps<typeof PinMentionDropdown> | null;
  /** The hidden file input behind the add button. */
  fileInputRef: React.Ref<HTMLInputElement>;
  fileAccept: string;
  onFileSelect: React.ChangeEventHandler<HTMLInputElement>;
  /** The composer itself (ChatInput). */
  children: React.ReactNode;
}

/** Input area: credit notice, turn status, queued messages tray and the composer. */
export function ChatComposerArea({
  creditNotice,
  archived,
  readOnly,
  messages,
  isStreaming,
  queueKey,
  tray,
  inputWrapperRef,
  pinDropdown,
  fileInputRef,
  fileAccept,
  onFileSelect,
  children,
}: ChatComposerAreaProps) {
  const { status: creditNoticeStatus, ...creditNoticeProps } = creditNotice;
  return (
    <div
      style={{
        padding: "16px 16px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Workspace credit notice — team plan only, dismissible per status level */}
      <AnimatePresence>
        {creditNoticeStatus && (
          <InlineCreditNotice
            key={creditNoticeStatus}
            status={creditNoticeStatus}
            {...creditNoticeProps}
          />
        )}
      </AnimatePresence>

      {/* Chat input wrapper */}
      <div
        style={{
          width:    '100%',
          maxWidth: '754px',
        }}
      >
        {!archived && !readOnly && <TurnStatusChips messages={messages} active={isStreaming} />}
        <ExhaustionBanner>
        {/* Queued messages, just above the box and tucked under its top
            edge (the box sits above it, zIndex 1). Keyed by chat so a
            chat switch swaps the tray at once rather than animating. */}
        {!archived && !readOnly && (
          <QueuedMessagesTray key={queueKey} {...tray} />
        )}
        {/* position:relative wrapper lets PinMentionDropdown use absolute positioning */}
        <div
          ref={inputWrapperRef}
          style={{ width: "100%", position: "relative", zIndex: 1 }}
        >
        {archived ? (
          <ArchivedChatNotice />
        ) : (
          <>
        {pinDropdown && <PinMentionDropdown {...pinDropdown} />}

        {children}
        <LibrarySearchOffNote />
          </>
        )}
        </div>
        </ExhaustionBanner>
      </div>

      {/* Hidden file input for drag-drop fallback via onAdd */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={fileAccept}
        onChange={onFileSelect}
        style={{ display: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}
