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
  // The fade below is a mask on the scrolling element, and a mask covers the whole
  // element — scrollbar included, which left the bar fading out along with the
  // messages. The scrollbar's gutter is reserved by `scrollbar-gutter: stable` and
  // its width is the platform's, not a number we author, so it's measured here and
  // held out of the mask (see the second mask layer below).
  const [gutter, setGutter] = React.useState(0);
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setGutter(el.offsetWidth - el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollerRef]);
  // Two layers, unioned: the fade over the messages, and a solid strip that keeps
  // the scrollbar's column at full opacity.
  const fade = "linear-gradient(to bottom, #000 calc(100% - 40px), transparent)";
  const maskLayers = `${fade}, linear-gradient(#000, #000)`;
  const maskSizes = `calc(100% - ${gutter}px) 100%, ${gutter}px 100%`;

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
          // Matches the 40px fade, so the last message ends clear of it when scrolled to the bottom.
          paddingBottom: "40px",
          // Messages fade out over the last 40px as they near the composer instead of stopping at a
          // hard edge. A mask (not a coloured overlay) reveals whatever is behind, so it matches the
          // translucent card in both themes.
          maskImage: maskLayers,
          WebkitMaskImage: maskLayers,
          maskSize: maskSizes,
          WebkitMaskSize: maskSizes,
          maskPosition: "left top, right top",
          WebkitMaskPosition: "left top, right top",
          maskRepeat: "no-repeat, no-repeat",
          WebkitMaskRepeat: "no-repeat, no-repeat",
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
            exactly 2px from the layout's edge. Reading-comfort padding lives on the
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
