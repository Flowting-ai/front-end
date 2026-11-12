"use client";

import React, { useEffect, useImperativeHandle } from "react";
import { useVirtualizer, type ScrollToOptions } from "@tanstack/react-virtual";
import { LiveChatMessage } from "./LiveChatMessage";
import { AgentCreatedCard } from "@/components/AgentEditor/AgentCreatedCard";
import { shouldAdjustScrollOnItemResize } from "@/lib/stick-to-bottom";
import type { SelectedPersonaInfo } from "@/lib/chat-personas";
import type { UIMessage } from "@/types/chat";
import { estimateMessageSize } from "./chat-interface-helpers";

/** What ChatInterface drives on the virtualizer from its effects and handlers. */
export interface ChatMessageListHandle {
  scrollToIndex: (index: number, options: ScrollToOptions) => void;
  /** Whether the row at `index` is currently rendered (inside the virtual window). */
  isIndexRendered: (index: number) => boolean;
}

interface ChatMessageListProps {
  ref: React.Ref<ChatMessageListHandle>;
  /** The scrolling element (owned by ChatInterface). */
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  /** The list element, observed by ChatInterface's follow-the-bottom logic. */
  listRef: React.RefObject<HTMLDivElement | null>;
  messages: UIMessage[];
  isSettling: boolean;
  chatId: string | undefined;
  archived: boolean;
  isStreaming: boolean;
  isRevealing: boolean;
  revealingMessage: UIMessage | undefined;
  revealingKey: string | null;
  isPinned: (messageId: string) => boolean;
  selectedPersonaId?: string | null;
  onUseAgent?: (agent: SelectedPersonaInfo) => void;
  onRegenerate: () => void;
  onRevealSettled: (() => void) | undefined;
  onEdit: (messageId: string, newContent: string) => void;
  onPromptDecided: (messageId: string, requestId: string, decision: string) => void;
  onPromptAnswered: () => void;
}

/**
 * The conversation's rows, virtualised: only renders visible rows. Kept apart
 * from ChatInterface because TanStack Virtual's API can't be memoized by the
 * React Compiler (it skips any component using it), and so the virtualizer's
 * scroll updates re-render only this list.
 */
export function ChatMessageList({
  ref,
  scrollerRef,
  listRef,
  messages,
  isSettling,
  chatId,
  archived,
  isStreaming,
  isRevealing,
  revealingMessage,
  revealingKey,
  isPinned,
  selectedPersonaId,
  onUseAgent,
  onRegenerate,
  onRevealSettled,
  onEdit,
  onPromptDecided,
  onPromptAnswered,
}: ChatMessageListProps) {
  const msgVirtualizer = useVirtualizer({
    count:            messages.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize:     (i) => estimateMessageSize(messages[i]),
    overscan:         10,
  });

  // Set during the layout phase, so ChatInterface's effects can use it from mount.
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, options) => msgVirtualizer.scrollToIndex(index, options),
    isIndexRendered: (index) => msgVirtualizer.getVirtualItems().some((row) => row.index === index),
  }), [msgVirtualizer]);

  // The last (streaming) row's growth is left to the stick-to-bottom logic
  // in ChatInterface instead of the virtualizer's scroll compensation — see
  // shouldAdjustScrollOnItemResize.
  useEffect(() => {
    msgVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, _delta, instance) =>
      shouldAdjustScrollOnItemResize(item, instance.options.count, instance.scrollOffset ?? 0);
  }, [msgVirtualizer]);

  return (
    <div ref={listRef} style={{ position: 'relative', height: msgVirtualizer.getTotalSize(), visibility: isSettling ? 'hidden' : 'visible' }}>
      {msgVirtualizer.getVirtualItems().map((vRow) => {
        const message = messages[vRow.index];
        const idx     = vRow.index;
        return (
          <div
            // Keyed by the stable reactKey, not `id` — `id` gets swapped in
            // place from a temp id to the real backend UUID once the
            // message_saved event arrives (use-streaming-chat.ts), and
            // keying by `id` directly made that swap look like a new row
            // to React, remounting it and replaying its entrance
            // animation on content that was already fully visible.
            key={message.reactKey ?? message.id}
            data-index={vRow.index}
            ref={msgVirtualizer.measureElement}
            style={{
              position:   'absolute',
              top:        0,
              left:       0,
              width:      '100%',
              transform:  `translateY(${vRow.start}px)`,
              // Promote only the row that is still streaming to its own
              // compositor layer so translateY updates don't trigger a
              // full-page repaint. Settled rows drop the hint: a permanent
              // layer rasterizes text with grayscale anti-aliasing, which
              // reads as a slight blur.
              willChange: message.isLoading ? 'transform' : undefined,
              // Contain layout so height changes to this row (e.g. the
              // last streaming message growing) don't cause ancestor
              // reflows that disturb the scroll position of other rows.
              contain:    'layout',
            }}
          >
            {message.agentCard ? (
              <AgentCreatedCard
                agent={message.agentCard.persona}
                published={message.agentCard.published}
                inUse={!!selectedPersonaId && selectedPersonaId === message.agentCard.persona.activeVersionId}
                onUse={onUseAgent}
              />
            ) : (
            <LiveChatMessage
              message={message}
              isLast={idx === messages.length - 1}
              isNewMessage={idx === messages.length - 1 && isStreaming}
              chatId={chatId}
              pinned={message.role === 'assistant' ? isPinned(message.id) : false}
              archived={archived}
              onRegenerate={
                idx === messages.length - 1 &&
                message.role === "assistant" &&
                !isStreaming &&
                !(isRevealing && message === revealingMessage)
                  ? onRegenerate
                  : undefined
              }
              onRevealSettled={
                (message.reactKey ?? message.id) === revealingKey
                  ? onRevealSettled
                  : undefined
              }
              onEdit={
                message.role === "user" && !message.localOnly
                  ? onEdit
                  : undefined
              }
              onPromptDecided={onPromptDecided}
              onPromptAnswered={onPromptAnswered}
            />
            )}
          </div>
        );
      })}
    </div>
  );
}
