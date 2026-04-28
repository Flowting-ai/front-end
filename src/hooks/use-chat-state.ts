"use client";

/**
 * useChatState — centralises every piece of UI/interaction state that previously
 * lived as 30+ individual `useState` calls inside `chat-interface.tsx`.
 *
 * Responsibilities:
 *   - Owns all composer, attachment, toolbar, pin-mention, dialog, and
 *     response-tracking state.
 *   - Manages all DOM refs used by the chat composer area.
 *   - Runs side-effects that are purely about maintaining that state
 *     (click-outside listeners, auto-resize, chat-switch reset, etc.).
 *   - Exposes stable handler callbacks for pure state-update operations.
 *
 * NOT in scope (handled by `useStreamingChat` / component):
 *   - SSE streaming logic and abort controllers.
 *   - API calls (fetchAiResponse, deleteChat, selectPersona model fetch).
 *   - `processFiles` (depends on `isDocumentFile` utility in chat-interface).
 *   - The scroll-to-bottom effect driven by the `messages` prop.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { Message } from "@/components/chat/chat-message";
import type { PinType } from "@/components/layout/right-sidebar";
import type { TonePreset } from "@/components/chat/chat-tones";
import type { Persona } from "@/components/layout/app-layout";
import { stripMarkdown } from "@/lib/markdown-utils";

// ─── Local type definitions ────────────────────────────────────────────────

export interface AttachmentItem {
  id: string;
  type: "document" | "image";
  name: string;
  url: string;
  file: File;
  isUploading?: boolean;
  uploadProgress?: number;
}

export interface MentionedPin {
  id: string;
  label: string;
}

export interface RegenerationState {
  aiMessage: Message;
  userMessage: Message;
}

// ─── Hook parameters ───────────────────────────────────────────────────────

export interface UseChatStateParams {
  /** Active chat ID — triggers composer/state reset when it changes. */
  activeChatId?: string | null;
  /** Pins available for @-mention in the composer. */
  availablePins?: PinType[];
}

// ─── The constant is scoped to this module to avoid string literals ────────

const PIN_INSERT_EVENT = "pin-insert-to-chat";

// ─── Hook implementation ───────────────────────────────────────────────────

export function useChatState({
  activeChatId,
  availablePins = [],
}: UseChatStateParams = {}) {
  // ── Refs ──────────────────────────────────────────────────────────────────

  /** The main message composer textarea. */
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Scrollable message list viewport. */
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  /** Wrapper for the @-pin mention dropdown (used for click-outside). */
  const dropdownRef = useRef<HTMLDivElement>(null);
  /** Scroll container inside the pin dropdown for keyboard-nav auto-scroll. */
  const pinDropdownScrollRef = useRef<HTMLDivElement>(null);
  /** Map of dropdown item index → button element for focus management. */
  const pinItemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  /** Horizontal scroll container for attachment chips. */
  const attachmentScrollRef = useRef<HTMLDivElement>(null);
  /** Hidden <input type="file"> trigger. */
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Wrapper for the "attach" menu (used for click-outside detection). */
  const attachMenuRef = useRef<HTMLDivElement>(null);
  /** Wrapper for the persona picker dropdown (used for click-outside). */
  const personaDropdownRef = useRef<HTMLDivElement>(null);
  /** Timeout handle used to delay hiding the style/tone sub-menu. */
  const styleSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Composer ─────────────────────────────────────────────────────────────

  const [input, setInput] = useState("");
  const [referencedMessage, setReferencedMessage] = useState<Message | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

  // ── Pin-mention dropdown ──────────────────────────────────────────────────

  const [mentionedPins, setMentionedPins] = useState<MentionedPin[]>([]);
  const [showPinDropdown, setShowPinDropdown] = useState(false);
  const [pinSearchQuery, setPinSearchQuery] = useState("");
  const [highlightedPinIndex, setHighlightedPinIndex] = useState(0);

  // ── Attachments ───────────────────────────────────────────────────────────

  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  /** Whether the right-scroll caret should be visible on the attachment bar. */
  const [showScrollButton, setShowScrollButton] = useState(false);
  /** Whether the left-scroll caret should be visible on the attachment bar. */
  const [showLeftScrollButton, setShowLeftScrollButton] = useState(false);

  // ── Toolbar menus ─────────────────────────────────────────────────────────

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);
  const [highlightedPersonaIndex, setHighlightedPersonaIndex] = useState(0);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [useMistralOcr, setUseMistralOcr] = useState(false);
  const [showStyleSubmenu, setShowStyleSubmenu] = useState(false);
  const [selectedTone, setSelectedTone] = useState<TonePreset | null>(null);

  // ── Scroll ────────────────────────────────────────────────────────────────

  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);

  // ── Response / streaming status ───────────────────────────────────────────

  const [isResponding, setIsResponding] = useState(false);
  const [isRegeneratingResponse, setIsRegeneratingResponse] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  // ── Message-level actions ─────────────────────────────────────────────────

  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [regenerationState, setRegenerationState] = useState<RegenerationState | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");

  // ── Dialogs ───────────────────────────────────────────────────────────────

  const [isChatDeleteDialogOpen, setIsChatDeleteDialogOpen] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // ── Derived: filtered pin list for the @-mention dropdown ─────────────────

  const filteredPins = useMemo(() => {
    if (!pinSearchQuery.trim()) return availablePins;
    const query = pinSearchQuery.toLowerCase();
    return availablePins.filter((pin) => {
      const textMatch = stripMarkdown(pin.text).toLowerCase().includes(query);
      const idMatch = pin.id.toLowerCase().includes(query);
      const tagsMatch =
        pin.tags?.some((tag) => tag.toLowerCase().includes(query)) ?? false;
      return textMatch || idMatch || tagsMatch;
    });
  }, [availablePins, pinSearchQuery]);

  // ── Effects ───────────────────────────────────────────────────────────────

  /**
   * Reset composer state whenever the user switches to a different chat.
   * Attachment blob URLs are revoked to free memory.
   */
  useEffect(() => {
    setInput("");
    setReferencedMessage(null);
    setMentionedPins([]);
    setShowPinDropdown(false);
    setPinSearchQuery("");
    setWebSearchEnabled(false);
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.url));
      return [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  /** Auto-resize the composer textarea to fit its content (max 200 px). */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [input]);

  /** Close the "attach" menu when clicking outside its bounding box. */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target as Node)
      ) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAttachMenu]);

  /** Close the persona picker when clicking outside its bounding box. */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        personaDropdownRef.current &&
        !personaDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPersonaDropdown(false);
      }
    };
    if (showPersonaDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPersonaDropdown]);

  /**
   * When the persona picker opens, reset keyboard focus to the first item and
   * shift DOM focus to the listbox so arrow-key navigation works immediately.
   */
  useEffect(() => {
    if (showPersonaDropdown) {
      setHighlightedPersonaIndex(-1);
      if (personaDropdownRef.current) {
        const listbox = personaDropdownRef.current.querySelector(
          '[role="listbox"]',
        ) as HTMLElement | null;
        listbox?.focus();
      }
    }
  }, [showPersonaDropdown]);

  /**
   * Listen for the `pin-insert-to-chat` custom event dispatched by the
   * right-sidebar "Insert" button, and inject the cleaned pin text into the
   * composer without triggering a full re-render of the parent.
   */
  useEffect(() => {
    const handlePinInsert = (event: Event) => {
      const custom = event as CustomEvent<{ text?: string }>;
      const text = custom.detail?.text;
      if (!text) return;
      const cleanText = stripMarkdown(text);
      setInput((prev) => (prev ? `${prev}\n${cleanText}` : cleanText));
      textareaRef.current?.focus();
    };
    if (typeof window !== "undefined") {
      window.addEventListener(PIN_INSERT_EVENT, handlePinInsert as EventListener);
      return () =>
        window.removeEventListener(PIN_INSERT_EVENT, handlePinInsert as EventListener);
    }
  }, []);

  /**
   * Recalculate whether left/right scroll carets should be shown for the
   * horizontal attachment chip bar whenever the list of attachments changes.
   */
  useEffect(() => {
    const checkScrollability = () => {
      const el = attachmentScrollRef.current;
      if (!el) return;
      const isScrollable = el.scrollWidth > el.clientWidth;
      setShowScrollButton(
        isScrollable && el.scrollLeft < el.scrollWidth - el.clientWidth - 10,
      );
      setShowLeftScrollButton(el.scrollLeft > 10);
    };
    checkScrollability();
    const timer = setTimeout(checkScrollability, 100);
    return () => clearTimeout(timer);
  }, [attachments]);

  /** Reset keyboard selection to the first pin whenever the dropdown opens or the list changes. */
  useEffect(() => {
    if (showPinDropdown && filteredPins.length > 0) {
      setHighlightedPinIndex(0);
    }
  }, [showPinDropdown, filteredPins.length]);

  /** Scroll the keyboard-highlighted pin item into view during arrow-key navigation. */
  useEffect(() => {
    if (showPinDropdown && highlightedPinIndex >= 0) {
      const el = pinItemRefs.current.get(highlightedPinIndex);
      if (el && pinDropdownScrollRef.current) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [highlightedPinIndex, showPinDropdown]);

  /** Close the pin-mention dropdown when clicking outside the dropdown or textarea. */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowPinDropdown(false);
      }
    };
    if (showPinDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPinDropdown]);

  // ── Stable handlers ───────────────────────────────────────────────────────

  /** Scroll the message list to the bottom imperatively. */
  const handleScrollToBottom = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, []);

  /** Update `isScrolledToBottom` as the user scrolls the message list. */
  const handleScroll = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    const isAtBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 50;
    setIsScrolledToBottom(isAtBottom);
  }, []);

  /** Dismiss the referenced-message banner without clearing the composer. */
  const handleClearReference = useCallback(() => {
    setReferencedMessage(null);
  }, []);

  /** Remove a previously mentioned pin chip from the composer. */
  const handleRemoveMention = useCallback((pinId: string) => {
    setMentionedPins((prev) => prev.filter((mp) => mp.id !== pinId));
  }, []);

  /**
   * Select a pin from the @-mention dropdown:
   *   - Strips the trailing `@...` fragment from the input.
   *   - Adds the pin to the mentioned-pins list (deduplicated).
   *   - Closes the dropdown and returns focus to the textarea.
   */
  const handleSelectPin = useCallback(
    (pin: PinType) => {
      const pinLabel = stripMarkdown(pin.text).slice(0, 50) || pin.id;
      const lastAtIndex = input.lastIndexOf("@");
      const newInput =
        lastAtIndex !== -1 ? input.substring(0, lastAtIndex) : input;
      setInput(newInput);
      setMentionedPins((prev) =>
        prev.some((mp) => mp.id === pin.id)
          ? prev
          : [...prev, { id: pin.id, label: pinLabel }],
      );
      setShowPinDropdown(false);
      setPinSearchQuery("");
      textareaRef.current?.focus();
    },
    [input],
  );

  /** Mark a message as the active reply target and focus the textarea. */
  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
    textareaRef.current?.focus();
  }, []);

  /** Open the delete-confirmation dialog for a given message. */
  const handleDeleteRequest = useCallback((message: Message) => {
    setMessageToDelete(message);
  }, []);

  /**
   * Clear all transient composer state after a message has been sent.
   * Callers are responsible for revoking attachment blob URLs before calling
   * this (since `setAttachments([])` does not revoke them automatically here).
   */
  const clearComposerState = useCallback(() => {
    setReferencedMessage(null);
    setMentionedPins([]);
    setReplyToMessage(null);
    setPinSearchQuery("");
  }, []);

  // ── Return value ──────────────────────────────────────────────────────────

  return {
    // Refs
    textareaRef,
    scrollViewportRef,
    dropdownRef,
    pinDropdownScrollRef,
    pinItemRefs,
    attachmentScrollRef,
    fileInputRef,
    attachMenuRef,
    personaDropdownRef,
    styleSubmenuTimeout,

    // Composer
    input,
    setInput,
    referencedMessage,
    setReferencedMessage,
    replyToMessage,
    setReplyToMessage,

    // Pin-mention
    mentionedPins,
    setMentionedPins,
    showPinDropdown,
    setShowPinDropdown,
    pinSearchQuery,
    setPinSearchQuery,
    highlightedPinIndex,
    setHighlightedPinIndex,
    filteredPins,

    // Attachments
    attachments,
    setAttachments,
    showScrollButton,
    setShowScrollButton,
    showLeftScrollButton,
    setShowLeftScrollButton,

    // Toolbar
    showAttachMenu,
    setShowAttachMenu,
    showPersonaDropdown,
    setShowPersonaDropdown,
    highlightedPersonaIndex,
    setHighlightedPersonaIndex,
    selectedPersona,
    setSelectedPersona,
    webSearchEnabled,
    setWebSearchEnabled,
    useMistralOcr,
    setUseMistralOcr,
    showStyleSubmenu,
    setShowStyleSubmenu,
    selectedTone,
    setSelectedTone,

    // Scroll
    isScrolledToBottom,
    setIsScrolledToBottom,

    // Response / streaming status
    isResponding,
    setIsResponding,
    isRegeneratingResponse,
    setIsRegeneratingResponse,
    lastMessageId,
    setLastMessageId,

    // Message actions
    messageToDelete,
    setMessageToDelete,
    regenerationState,
    setRegenerationState,
    regeneratePrompt,
    setRegeneratePrompt,

    // Dialogs
    isChatDeleteDialogOpen,
    setIsChatDeleteDialogOpen,
    isDeletingChat,
    setIsDeletingChat,
    isUploadDialogOpen,
    setIsUploadDialogOpen,
    uploadFile,
    setUploadFile,

    // Handlers
    handleScrollToBottom,
    handleScroll,
    handleClearReference,
    handleRemoveMention,
    handleSelectPin,
    handleReply,
    handleDeleteRequest,
    clearComposerState,
  };
}

/** Convenience type alias — use for prop-drilling or context values. */
export type ChatStateReturn = ReturnType<typeof useChatState>;
