import type { UIMessage } from "@/types/chat";

// Pure pieces of ChatInterface's render logic, kept here so they can be unit tested.

/**
 * Role-aware size estimate for a message row in the virtualized list, so the
 * corrections when items are first measured are small, preventing
 * scroll-position jumps when scrolling upward. User bubbles: short (≈80px
 * base). AI messages scale with content length. These are estimates only —
 * measureElement always wins once rendered.
 */
export function estimateMessageSize(msg: UIMessage | undefined): number {
  if (!msg) return 200
  if (msg.agentCard) return 190
  if (msg.role === "user") {
    // Base height for the bubble + padding; add ~16px per 80 chars
    return 80 + Math.ceil((msg.content?.length ?? 0) / 80) * 16
  }
  // Assistant: base 120px + rough line estimate from content length
  const contentLen = msg.content?.length ?? 0
  const hasBlocks = (msg.responseBlocks?.length ?? 0) > 0
  return Math.min(120 + Math.ceil(contentLen / 60) * 20 + (hasBlocks ? 300 : 0), 2000)
}

/** Why a queued message can't go out yet beyond waiting its turn. */
export function getQueuePausedReason({ creditsBlocked, poolPaused, personaConfigLoading }: {
  creditsBlocked: boolean;
  poolPaused: boolean;
  personaConfigLoading: boolean;
}): string | null {
  return creditsBlocked
    ? "paused, out of credits"
    : poolPaused
      ? "paused, workspace out of credits"
      : personaConfigLoading
        ? "waiting for the agent to load"
        : null;
}

/** What the queue is waiting for, after "Queued ·" in the tray. */
export function getQueueStatus({ pausedReason, waitingOnReply, queuedCount, askingSave, hookBusy }: {
  pausedReason: string | null;
  waitingOnReply: boolean;
  queuedCount: number;
  askingSave: boolean;
  hookBusy: boolean;
}): string {
  return pausedReason
    ?? (waitingOnReply
      ? queuedCount > 1 ? "sent in order as each reply finishes" : "sends when this reply finishes"
      : askingSave
        ? "waiting for your answer about saving files"
        : hookBusy
          ? "waiting for your reply in another chat"
          : "sending next…");
}

/** The composer's placeholder, from the most to the least blocking state. */
export function getComposerPlaceholder({ readOnly, poolPaused, creditsBlocked, personaConfigLoading, queuedCount, sendQueues, hasMessages = false }: {
  readOnly: boolean;
  poolPaused: boolean;
  creditsBlocked: boolean;
  personaConfigLoading: boolean;
  queuedCount: number;
  sendQueues: boolean;
  /** The chat already has a reply: the opening greeting gives way to a generic follow-up prompt. */
  hasMessages?: boolean;
}): string {
  return readOnly
    ? 'Create your own copy to continue this chat.'
    : poolPaused
    ? 'Workspace out of credits. Contact your admin.'
    : creditsBlocked
      ? 'Credits exhausted. Buy a top-up to continue.'
      : personaConfigLoading
        ? 'Loading agent…'
        : queuedCount > 0
          ? 'Queue another message…'
          : sendQueues
            ? 'Queue a follow-up…'
            : hasMessages
              ? 'Ask a follow-up…'
              : 'How can I help you today?';
}
