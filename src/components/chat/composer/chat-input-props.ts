import type React from "react";
import type { DropdownPlacement } from "@/components/Dropdown";
import type { SelectedPersonaInfo } from "@/lib/chat-personas";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatInputProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  placeholder?: string;
  textareaLabel?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSend?: (value: string) => void;
  onAdd?: () => void;
  onStop?: () => void;
  modelName?: string;
  /** Provider or name the selector button's logo resolves from (see ModelIcon). Defaults to `modelName`. */
  modelIcon?: string | null;
  onModelClick?: React.MouseEventHandler<HTMLButtonElement>;
  /**
   * When set, the leading `+` IconButton opens a Dropdown.Float panel
   * (placement="top-start"). Typical contents: a `<Dropdown>` with rows
   * for "Add files", "Web search", "Use style", "Add persona", "Pin folders".
   */
  addMenu?: React.ReactNode;
  /**
   * When set, the model-selector Button opens a Dropdown.Float panel
   * (placement="top-end"). Typical contents: a `<Dropdown size="md">` with
   * switch rows and a "More models" submenu.
   */
  modelMenu?: React.ReactNode;
  /**
   * Overrides the model-menu Dropdown.Float's placement — defaults to
   * "top-end" (a dropup, right for a composer anchored to the bottom of the
   * viewport). Pages that instead center this composer vertically (e.g. the
   * project pages' "new chat" state) don't have room above the trigger for a
   * dropup and need it opening downward instead.
   */
  modelMenuPlacement?: DropdownPlacement;
  /**
   * Caps how tall the auto-growing textarea gets before it scrolls instead
   * of growing further. Defaults to 396px (18 lines at the 22px line-height
   * both text sizes share).
   */
  textareaMaxHeight?: string;
  chips?: React.ReactNode;
  /**
   * Pin chips (@-mention pins and pin-folder selections) rendered in their
   * own row above the regular chips row, so they stay visually separate from
   * feature/setting badges.
   */
  pinChips?: React.ReactNode;
  /**
   * Content rendered inside the input box, above the textarea.
   * Intended for the AttachmentManager chip strip.
   */
  attachmentsSlot?: React.ReactNode;
  isStreaming?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /**
   * Called when the user triggers an `@`-mention in the textarea.
   * Receives the text typed after `@` as the query, or `null` when mention
   * mode ends (space/punctuation typed, `@` deleted, or focus lost).
   */
  onMentionChange?: (query: string | null) => void;
  /**
   * When true, the Enter key navigates the pin dropdown instead of sending
   * the message. ArrowUp/Down/Escape are also delegated to `onPinNavigate`.
   */
  isPinDropdownOpen?: boolean;
  /**
   * Keyboard-navigation callback fired when `isPinDropdownOpen` is true.
   * The parent moves selection state and calls `onSelect` on "select".
   */
  onPinNavigate?: (action: "up" | "down" | "select" | "close") => void;
  /**
   * When true, the model selector button is shown but non-interactive
   * (greyed out, pointer-events disabled). Use when a persona's model
   * is fixed and should not be changed.
   */
  disabledModelSelector?: boolean;
  /**
   * When true, the model selector button is hidden entirely from the footer.
   * Use in persona chat where the model is fully managed by the persona.
   */
  hideModelSelector?: boolean;
  /**
   * When true, the leading + add button is hidden entirely.
   * Use in test-chat panels where file/menu attachment is not needed.
   */
  hideAddButton?: boolean;
  /**
   * Called when the user pastes image files from the clipboard (Ctrl+V / Ctrl+Shift+V).
   * Receives the array of pasted File objects (always images). Wire this up to your
   * attachment state so screenshots land directly in the attachments strip.
   * Text paste is handled natively by the textarea and does not trigger this callback.
   */
  onFilePaste?: (files: File[]) => void;
  /**
   * When true, the send button is enabled and shows the send icon even when
   * the text input is empty. Set this when attachments are present so users
   * can send files without typing a message.
   */
  hasAttachments?: boolean;
  /** Attachments are still uploading or processing: Send (and Enter) waits until they are ready. */
  sendBlocked?: boolean;
  /**
   * Turns on `@agent` mentions: typing `@` offers the user's agents, and picking
   * one removes the `@word` from the text and hands the agent to `onSelect`.
   */
  agentMention?: {
    onSelect: (agent: SelectedPersonaInfo) => void;
    /** The agent already attached to the chat, shown as selected in the list. */
    selectedAgentId?: string | null;
  };
  /**
   * Lets the user queue their next message while a reply streams: Enter, and
   * a Queue button shown beside Stop once there's something to send, hand it
   * to `onSend` (the host does the queuing), and files can be added. Without
   * it the box can be typed in while streaming but holds the send back.
   */
  allowQueue?: boolean;
  /**
   * A send right now would be queued rather than go out at once (e.g. a
   * message is already waiting) — the send button is labelled to match.
   */
  sendQueues?: boolean;
  /**
   * ArrowUp in an empty box: bring the queued message back into the box to
   * edit. Returns true when there was one.
   */
  onRecallQueued?: () => boolean;
  /** Each new value focuses the box with the caret at the end — e.g. once a queued message is back in it. */
  focusRequest?: number;
}
