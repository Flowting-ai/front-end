import { useEffect, useRef, type RefObject } from "react";
import { isCoarsePointer } from "./composer-sizes";

// A send counts toward refocusing only if its stream starts within this long.
const SEND_TO_STREAM_MS = 1_000;

/**
 * Keeps keyboard focus in the chat box across a reply: hands it back once the
 * reply is done (if it was lost), and focuses on each new `focusRequest`.
 * Returns the ref a send stamps (performance.now()) when it left the focused box.
 */
export function useComposerFocus(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  isStreaming: boolean,
  focusRequest: number | undefined,
) {
  // When a message was last sent from the focused box (performance.now()),
  // and whether that focus should come back after the reply — see below.
  const focusedSendAtRef = useRef<number | null>(null);
  const focusedAtSendRef = useRef(false);
  const wasStreamingRef = useRef(isStreaming);

  // The box stays editable while a reply streams, so focus normally never
  // leaves it. If it did drop to <body> anyway (e.g. a host that disables
  // the box while streaming), hand it back once the reply is done — but
  // only if the user was typing here when they sent, never away from
  // another control they moved to, and not on touch screens, where focusing
  // would pop the on-screen keyboard back up.
  useEffect(() => {
    const wasStreaming = wasStreamingRef.current;
    wasStreamingRef.current = isStreaming;
    if (!wasStreaming && isStreaming) {
      // Judge focus when the stream starts, not at send: a send the host
      // turned down (credits, takeover) starts no stream, and must not make
      // a later one (e.g. a Regenerate click) pull focus back here. A host
      // that disables the box while streaming has already moved focus to
      // <body>, so a send from this box moments ago counts too.
      const sentAt = focusedSendAtRef.current;
      focusedSendAtRef.current = null;
      focusedAtSendRef.current = document.activeElement === textareaRef.current
        || (sentAt !== null && performance.now() - sentAt < SEND_TO_STREAM_MS);
      return;
    }
    if (!wasStreaming || isStreaming) return;
    const hadFocus = focusedAtSendRef.current;
    focusedAtSendRef.current = false;
    if (!hadFocus) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (isCoarsePointer()) return;
    textareaRef.current?.focus();
  }, [isStreaming, textareaRef]);

  // Focus on request, caret after the text — runs after the commit that
  // put the text in, so the caret lands at its real end.
  useEffect(() => {
    if (!focusRequest) return;
    const el = textareaRef.current;
    if (!el || el.disabled) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusRequest, textareaRef]);

  return focusedSendAtRef;
}
