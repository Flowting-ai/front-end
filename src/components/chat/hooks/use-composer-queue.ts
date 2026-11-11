import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import {
  combineQueuedMessages,
  getChatQueue,
  joinMessageText,
  mergeAttachments,
  queueMessage,
  restoreQueuedMessage,
  takeAllQueuedMessages,
  takeNextQueuedMessage,
  takeQueuedMessage,
  type QueuedMessage,
  type QueuedMessagePart,
  type QueuedTurnContext,
} from "@/lib/message-queue";
import { PINS_ENABLED } from "@/lib/feature-flags";
import type { PendingAttachment } from "../AttachmentManager";
import type { QueuedRowExit } from "../QueuedMessagesTray";

// A queued message goes out this long after the reply before it has finished,
// so the finished reply registers before the next turn starts below it.
const QUEUE_SEND_DELAY_MS = 450;

// Touch screens: focusing the box on its own would pop the keyboard up.
export const prefersNoAutoFocus = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

type MentionedPin = { id: string; label: string };

// ── Queue actions ────────────────────────────────────────────────────────

/**
 * The composer's side of the message queue (see message-queue.ts): queuing
 * the composer's message, taking queued ones back to edit or remove them, and
 * putting them all back when the reply they waited on failed or was stopped.
 */
export function useComposerQueue({
  queueKey,
  queuedMessages,
  queueHeldBy,
  replyInFlight,
  attachments,
  mentionedPins,
  setInputValue,
  setAttachments,
  clearMentions,
  restoreMentions,
  onClearAddMenuFiles,
  askSave,
  queueContext,
  maxFiles,
  setComposerFocusRequest,
}: {
  queueKey: string;
  queuedMessages: readonly QueuedMessage[];
  queueHeldBy: string | undefined | null;
  replyInFlight: boolean;
  attachments: PendingAttachment[];
  mentionedPins: MentionedPin[];
  setInputValue: Dispatch<SetStateAction<string>>;
  setAttachments: Dispatch<SetStateAction<PendingAttachment[]>>;
  clearMentions: () => void;
  restoreMentions: (pins: MentionedPin[]) => void;
  onClearAddMenuFiles: (() => void) | undefined;
  askSave: (files: File[]) => Promise<void>;
  queueContext: () => QueuedTurnContext;
  maxFiles: number;
  setComposerFocusRequest: Dispatch<SetStateAction<number>>;
}) {
  // Screen-reader-only status for queue changes (the tray itself is silent).
  const [queueAnnouncement, setQueueAnnouncement] = useState("");
  // How the next row to leave the tray goes — see QueuedRowExit.
  const [queuedRowExit, setQueuedRowExit] = useState<QueuedRowExit>("dismissed");
  // Where a message taken out to edit stood, so re-queuing it puts it back
  // in its place rather than at the end. Cleared by a direct send or a switch.
  const editedQueueSlotRef = useRef<{ key: string; index: number } | null>(null);
  useEffect(() => {
    editedQueueSlotRef.current = null;
  }, [queueKey]);

  // The composer's message joins the end of the queue (or an edited one
  // goes back to its place) as a message of its own.
  const queueFromComposer = (text: string) => {
    const slot = editedQueueSlotRef.current?.key === queueKey ? editedQueueSlotRef.current.index : undefined;
    editedQueueSlotRef.current = null;
    // Asked now, not when it goes out: the answer rides on its files (markSaveChoice), and the
    // queue holds until it's given.
    void askSave(attachments.map((a) => a.file));
    queueMessage(
      queueKey,
      { content: text, attachments, mentionedPins: PINS_ENABLED ? mentionedPins : [] },
      queueContext(),
      slot,
    );
    setInputValue("");
    setAttachments([]);
    clearMentions();
    onClearAddMenuFiles?.();
    const count = getChatQueue(queueKey)?.messages.length ?? 1;
    setQueueAnnouncement(count > 1
      ? `Message queued. ${count} messages will be sent in order as each reply finishes.`
      : "Message queued. It will be sent when the current reply finishes.");
  };

  // Queued messages back into the composer, ahead of anything typed since.
  // Updaters, not this render's values: on a chat switch the composer is
  // emptied in the same commit, and the old chat's draft must not carry over.
  const putBackInComposer = (part: QueuedMessagePart, focus: boolean) => {
    const max = maxFiles;
    setQueuedRowExit("dismissed");
    setInputValue((draft) => joinMessageText(part.content, draft));
    setAttachments((current) => mergeAttachments(part.attachments, current, max).attachments.slice(0, max));
    if (mergeAttachments(part.attachments, attachments, max).overflow) {
      toast.error("File limit reached", {
        description: `A message can carry up to ${max} files, so the newest ones were left out.`,
      });
    }
    restoreMentions(PINS_ENABLED ? part.mentionedPins : []);
    if (focus) setComposerFocusRequest((n) => n + 1);
  };

  // Edit: take one queued message back into the composer to change it.
  const handleEditQueued = (id: string): boolean => {
    setQueuedRowExit("dismissed");
    const taken = takeQueuedMessage(queueKey, id);
    if (!taken) return false;
    const slot = editedQueueSlotRef.current;
    editedQueueSlotRef.current = {
      key: queueKey,
      index: slot?.key === queueKey ? Math.min(slot.index, taken.index) : taken.index,
    };
    putBackInComposer(taken.message, true);
    setQueueAnnouncement("Queued message moved back to the message box.");
    return true;
  };

  // ArrowUp in an empty box: the most recently queued message, like
  // recalling the last command in a terminal.
  const handleRecallQueued = (): boolean => {
    const last = queuedMessages[queuedMessages.length - 1];
    return last ? handleEditQueued(last.id) : false;
  };

  const handleRemoveQueued = (id: string) => {
    const key = queueKey;
    setQueuedRowExit("dismissed");
    const taken = takeQueuedMessage(key, id);
    if (!taken) return;
    // The Remove button leaves with its row; keep keyboard focus nearby.
    if (!prefersNoAutoFocus()) setComposerFocusRequest((n) => n + 1);
    setQueueAnnouncement("Queued message removed.");
    toast("Queued message removed", {
      id: `queued-removed-${taken.message.id}`,
      action: { label: "Undo", onClick: () => restoreQueuedMessage(key, taken.message, taken.index) },
    });
  };

  // The reply the queue was waiting on failed or was stopped: the queued
  // messages go back into the composer, in order, instead of out — nothing
  // is sent unasked.
  useEffect(() => {
    if (!queueHeldBy || replyInFlight) return;
    const held = takeAllQueuedMessages(queueKey);
    if (!held || held.messages.length === 0) return;
    editedQueueSlotRef.current = null;
    // The hold lands in the queue store (outside React), so this effect is where it is answered.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    putBackInComposer(combineQueuedMessages(held.messages), !prefersNoAutoFocus());
    const plural = held.messages.length > 1;
    if (queueHeldBy === "error") {
      toast(plural ? "Your queued messages weren't sent" : "Your queued message wasn't sent", {
        description: `The reply before ${plural ? "them" : "it"} didn't finish, so ${plural ? "they're" : "it's"} back in the message box.`,
      });
    }
    setQueueAnnouncement(`${queueHeldBy === "error" ? "The reply didn't finish." : "The reply was stopped."} ${
      plural ? "Your queued messages are" : "Your queued message is"} back in the message box.`);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when a hold lands or the reply ends
  }, [queueHeldBy, replyInFlight, queueKey]);

  return {
    queueAnnouncement,
    queuedRowExit,
    setQueuedRowExit,
    editedQueueSlotRef,
    queueFromComposer,
    handleEditQueued,
    handleRecallQueued,
    handleRemoveQueued,
  };
}

/**
 * The next queued message goes out once `queueReady` — the reply before it
 * has finished and the thread is settled. A short beat first lets the
 * finished reply register. Each one then waits for its own reply, so they go
 * out in order, one per turn.
 */
export function useQueuedSend({
  queueReady,
  queueKey,
  pageHidden,
  isSendingRef,
  askingSaveRef,
  setQueuedRowExit,
  sendTurn,
}: {
  queueReady: boolean;
  queueKey: string;
  pageHidden: boolean;
  isSendingRef: RefObject<boolean>;
  askingSaveRef: RefObject<number>;
  setQueuedRowExit: Dispatch<SetStateAction<QueuedRowExit>>;
  /** Stable; always sends with the composer's latest settings. */
  sendTurn: (turn: QueuedMessagePart & { fromQueue: boolean }) => Promise<unknown>;
}) {
  useEffect(() => {
    if (!queueReady) return;
    let cancelled = false;
    const send = () => {
      // A send that started this very tick has the floor (see isSendingRef).
      if (cancelled || isSendingRef.current || askingSaveRef.current > 0) return;
      setQueuedRowExit("sent");
      const message = takeNextQueuedMessage(queueKey);
      if (message) void sendTurn({ ...message, fromQueue: true });
    };
    // Hidden tab: no beat (nobody is watching) and no timer — background
    // tabs throttle timers, up to a minute apart.
    if (pageHidden) {
      queueMicrotask(send);
      return () => { cancelled = true; };
    }
    const timer = setTimeout(send, QUEUE_SEND_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs, setter and sendTurn are stable
  }, [queueReady, queueKey, pageHidden]);
}
