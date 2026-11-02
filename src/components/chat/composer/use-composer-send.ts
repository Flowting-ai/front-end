import { useEffect, useState, type RefObject } from "react";
import { isCoarsePointer } from "./composer-sizes";

interface ComposerSendOptions {
  value: string;
  isControlled: boolean;
  setInternalValue: (value: string) => void;
  onChange?: (value: string) => void;
  onSend?: (value: string) => void;
  hasAttachments: boolean;
  disabled: boolean;
  sendBlocked: boolean;
  isStreaming: boolean;
  allowQueue: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Stamped when a send leaves the focused box — see useComposerFocus. */
  focusedSendAtRef: RefObject<number | null>;
}

/**
 * Sending the draft: clears the box and hands the text to `onSend`, holds an
 * Enter pressed while files upload until they are ready (`sendWhenReady`),
 * and the Queue button's send.
 */
export function useComposerSend({
  value,
  isControlled,
  setInternalValue,
  onChange,
  onSend,
  hasAttachments,
  disabled,
  sendBlocked,
  isStreaming,
  allowQueue,
  textareaRef,
  focusedSendAtRef,
}: ComposerSendOptions) {
  const handleSend = () => {
    // Typing ahead is allowed while a reply streams; sending waits for it,
    // unless the host queues it (allowQueue).
    if ((!value && !hasAttachments) || disabled || sendBlocked || (isStreaming && !allowQueue)) return;
    focusedSendAtRef.current = document.activeElement === textareaRef.current ? performance.now() : null;
    const text = value;
    if (!isControlled) setInternalValue("");
    onChange?.("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend?.(text);
  };

  // Enter pressed while attachments upload: send as soon as they are ready.
  // Dropped if the draft is emptied in the meantime.
  const [sendWhenReady, setSendWhenReady] = useState(false);
  if (sendWhenReady && !value && !hasAttachments) setSendWhenReady(false);
  useEffect(() => {
    if (!sendWhenReady || sendBlocked || isStreaming || disabled) return;
    // Intentional: the held send fires the moment uploads finish.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSendWhenReady(false);
    handleSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendWhenReady, sendBlocked, isStreaming, disabled]);

  // The Queue button leaves once the box empties, so the keyboard focus it
  // held goes back to the box — the next thing to do is usually type again.
  const handleQueueClick = () => {
    handleSend();
    if (!isCoarsePointer()) textareaRef.current?.focus();
  };

  const holdSendUntilReady = () => setSendWhenReady(true);

  return { handleSend, sendWhenReady, holdSendUntilReady, handleQueueClick };
}
