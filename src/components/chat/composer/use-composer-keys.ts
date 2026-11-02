import type React from "react";
import { PINS_ENABLED } from "@/lib/feature-flags";
import { isImeKey } from "@/lib/ime";
import type { useAgentMention } from "@/hooks/use-agent-mention";

interface ComposerKeysOptions {
  value: string;
  isControlled: boolean;
  setInternalValue: (value: string) => void;
  onChange?: (value: string) => void;
  /** `@agent` mentions are on (ChatInputProps.agentMention was given). */
  agentMentionOn: boolean;
  mention: ReturnType<typeof useAgentMention>;
  onMentionChange?: (query: string | null) => void;
  isPinDropdownOpen: boolean;
  onPinNavigate?: (action: "up" | "down" | "select" | "close") => void;
  onRecallQueued?: () => boolean;
  isStreaming: boolean;
  allowQueue: boolean;
  hasAttachments: boolean;
  disabled: boolean;
  isRecording: boolean;
  sendBlocked: boolean;
  handleSend: () => void;
  holdSendUntilReady: () => void;
}

/**
 * The textarea's change and keydown handlers: `@` mentions (agents and pins),
 * ArrowUp to recall a queued message, and Enter to send (Shift+Enter and IME
 * composition insert text instead).
 */
export function useComposerKeys({
  value,
  isControlled,
  setInternalValue,
  onChange,
  agentMentionOn,
  mention,
  onMentionChange,
  isPinDropdownOpen,
  onPinNavigate,
  onRecallQueued,
  isStreaming,
  allowQueue,
  hasAttachments,
  disabled,
  isRecording,
  sendBlocked,
  handleSend,
  holdSendUntilReady,
}: ComposerKeysOptions) {
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (!isControlled) setInternalValue(newValue);
    onChange?.(newValue);

    if (agentMentionOn) mention.update(newValue, e.target.selectionStart ?? newValue.length);

    // @-mention detection - only when the parent opts in via onMentionChange.
    if (PINS_ENABLED && onMentionChange) {
      const lastChar = newValue[newValue.length - 1];
      if (lastChar === "@") {
        // User just typed @: open the dropdown with an empty query.
        onMentionChange("");
        return;
      }
      if (isPinDropdownOpen) {
        const lastAtIdx = newValue.lastIndexOf("@");
        if (lastAtIdx !== -1) {
          const afterAt = newValue.substring(lastAtIdx + 1);
          // A space/punctuation after @ means the user abandoned the mention.
          if (/[\s,.!?;:\n]/.test(afterAt)) {
            onMentionChange(null);
          } else {
            onMentionChange(afterAt);
          }
        } else {
          // @ was deleted - close the dropdown.
          onMentionChange(null);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // The agent list, while open, owns arrows / Enter / Tab / Escape.
    if (agentMentionOn && mention.onKeyDown(e)) return;

    // While the pin dropdown is open, delegate arrow keys / Enter / Escape
    // to the parent so it can move the highlighted selection or confirm.
    if (PINS_ENABLED && isPinDropdownOpen && onPinNavigate) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onPinNavigate("down");
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onPinNavigate("up");
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onPinNavigate("select");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onPinNavigate("close");
        return;
      }
    }

    // ArrowUp in an empty box brings a queued message back to edit, like
    // recalling the last command in a terminal.
    if (
      e.key === "ArrowUp" && !value && onRecallQueued &&
      !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && !isImeKey(e)
    ) {
      if (onRecallQueued()) e.preventDefault();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !isImeKey(e)) {
      // Enter still means "send" while a reply streams: swallow it rather
      // than insert a newline, and keep the draft to send once it's done —
      // or, with allowQueue, send it to be queued.
      if (isStreaming && !allowQueue) {
        e.preventDefault();
        return;
      }
      // Attachments alone are a message too (the button sends them), so Enter sends them as well.
      if ((value || hasAttachments) && !disabled && !isRecording) {
        e.preventDefault();
        // Files still uploading: hold the send and fire it once they are ready.
        if (sendBlocked) { holdSendUntilReady(); return; }
        handleSend();
      }
    }
  };

  return { handleInputChange, handleKeyDown };
}

/**
 * Pasting image files hands them to `onFilePaste` (text pastes natively).
 * Off while a reply streams, unless the next message can be queued.
 */
export function usePasteFiles(
  onFilePaste: ((files: File[]) => void) | undefined,
  isStreaming: boolean,
  allowQueue: boolean,
) {
  return (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Attachments can't be added or removed while a reply streams (the
    // attachment list and drag-and-drop are locked), so images wait too —
    // unless the next message can be queued, files and all.
    if (!onFilePaste || (isStreaming && !allowQueue)) return;
    const items = Array.from(e.clipboardData.items);
    const files = items
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) {
      // Prevent the browser inserting a broken text/html representation of the image
      e.preventDefault();
      onFilePaste(files);
    }
    // Text paste: no preventDefault — let the textarea handle it natively
  };
}
