import { useEffect, useMemo, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { UIMessage } from "@/types/chat";
import type { ChatMessageListHandle } from "../ChatMessageList";

// How long to wait, once a stream has ended, for a reply's reveal to report
// settled before the completion UI stops waiting — see handleRevealSettled.
// The short wait applies while the reply's row isn't rendered (nothing on
// screen to wait for); the cap applies while it is.
const REVEAL_SETTLE_FALLBACK_MS = 2_000;
const REVEAL_SETTLE_MAX_MS = 30_000;

/**
 * The reply streamed in this session whose text reveal hasn't settled yet
 * (`revealingKey`, see ChatInterface): the message, whether it is still
 * revealing, the settle callback for its row, and a backstop for a settle
 * that never arrives.
 */
export function useRevealSettle({
  revealingKey,
  setRevealingKey,
  isStreaming,
  messages,
  listRef,
}: {
  revealingKey: string | null;
  setRevealingKey: Dispatch<SetStateAction<string | null>>;
  isStreaming: boolean;
  messages: UIMessage[];
  listRef: RefObject<ChatMessageListHandle | null>;
}) {
  // The streamed reply whose text is still being revealed, if any. Errors and
  // stopped replies don't wait: they're announced, and can be retried, at once.
  const revealingMessage = revealingKey === null
    ? undefined
    : messages.findLast((m) => (m.reactKey ?? m.id) === revealingKey);
  const isRevealing = !!revealingMessage && !revealingMessage.isError && !revealingMessage.stoppedByUser;

  // Bound to the key, so a late call from an earlier reply's row can't end a
  // newer reply's wait.
  const handleRevealSettled = useMemo(
    () => revealingKey === null
      ? undefined
      : () => setRevealingKey((key) => (key === revealingKey ? null : key)),
    [revealingKey, setRevealingKey],
  );

  // Backstop for a settle that never arrives (e.g. the row was virtualized
  // away mid-reveal and unmounted). Once the stream has ended, stop waiting
  // shortly if the row isn't rendered, or after a hard cap if it is.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    if (revealingKey === null || isStreaming) return;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const index = messagesRef.current.findLastIndex((m) => (m.reactKey ?? m.id) === revealingKey);
      const rendered = index !== -1 && (listRef.current?.isIndexRendered(index) ?? false);
      if (rendered && Date.now() - startedAt < REVEAL_SETTLE_MAX_MS) {
        timer = setTimeout(check, REVEAL_SETTLE_FALLBACK_MS);
        return;
      }
      setRevealingKey((key) => (key === revealingKey ? null : key));
    };
    timer = setTimeout(check, REVEAL_SETTLE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [revealingKey, isStreaming, setRevealingKey, listRef]);

  return { revealingMessage, isRevealing, handleRevealSettled };
}
