"use client";

import React from "react";
import { ChatMessagesSkeleton } from "@/components/chat/ChatMessagesSkeleton";
import { ChatLoadError, ScrollToBottomButton, SrOnlyStatus } from "./ChatInterfaceParts";

interface ChatMessagesPaneProps {
  /** A reply is arriving or revealing — read out by the response status region. */
  responding: boolean;
  queueAnnouncement: string;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  isLoadingMessages: boolean;
  isStreaming: boolean;
  isSettling: boolean;
  isEmpty: boolean;
  messagesLoadError: string | null | undefined;
  onRetry: () => void;
  emptyState?: React.ReactNode;
  atBottom: boolean;
  onScrollToBottom: () => void;
  /** The message list (ChatMessageList). */
  children: React.ReactNode;
}

/**
 * Messages area + scroll-to-bottom button, wrapped so the button can be
 * absolutely positioned at the bottom of the scroll area.
 */
export function ChatMessagesPane({
  responding,
  queueAnnouncement,
  scrollerRef,
  messagesEndRef,
  onScroll,
  isLoadingMessages,
  isStreaming,
  isSettling,
  isEmpty,
  messagesLoadError,
  onRetry,
  emptyState,
  atBottom,
  onScrollToBottom,
  children,
}: ChatMessagesPaneProps) {
  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <SrOnlyStatus>
        {responding ? "Assistant is responding." : "Assistant response complete."}
      </SrOnlyStatus>
      <SrOnlyStatus>{queueAnnouncement}</SrOnlyStatus>
      <div
        ref={scrollerRef}
        className="kaya-scrollbar"
        // role="log" is a polite live region; aria-busy holds announcements
        // while tokens stream, so the finished answer is read once, not per token.
        role="log"
        aria-label="Conversation"
        aria-relevant="additions"
        aria-busy={isLoadingMessages || isStreaming ? true : undefined}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          paddingTop: "24px",
          paddingBottom: "24px",
          paddingRight: "2px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          // Bottom-following is owned by the stick-to-bottom logic; browser
          // scroll anchoring would fight it (and the virtualizer's own
          // compensation) as rows resize.
          overflowAnchor: "none",
        }}
      >
        {/* 2px right padding on the scrolling element above sits the scrollbar
            exactly 2px from the layout's edge (same convention as
            PersonaChatInterface.tsx). Reading-comfort padding lives on the
            inner wrapper below, not on the scrolling element. */}
        <div style={{ width: "100%", maxWidth: "720px", padding: "0 16px", boxSizing: "border-box" }}>
        {/* Loading skeleton — shown while fetching AND while the virtualizer
            settles its initial measurements so the first visible frame is jitter-free */}
        {(isLoadingMessages || isSettling) && <ChatMessagesSkeleton />}

        {/* Failed-to-load banner (messages is legitimately [] for an empty
            chat too, so messagesLoadError is what tells them apart). */}
        {!isLoadingMessages && !isSettling && isEmpty && messagesLoadError && (
          <ChatLoadError error={messagesLoadError} onRetry={onRetry} />
        )}

        {/* Empty state — shown when no messages and not loading */}
        {!isLoadingMessages && !isSettling && isEmpty && !messagesLoadError && emptyState}

        {/* Messages — virtualised. Hidden (not unmounted) during settling so
            the virtualizer can measure items while the spinner is still shown. */}
        {children}

        <div ref={messagesEndRef} />
      </div>
    </div>

    <ScrollToBottomButton visible={!atBottom} onClick={onScrollToBottom} />
    </div>
  );
}
