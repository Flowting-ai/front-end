"use client";

/**
 * useChatHistory — manages all chat-board, active-chat, and message-history
 * state that was previously embedded inside `AppLayout`.
 *
 * Responsibilities:
 *   - Chat board list (CRUD, star, rename, delete).
 *   - Active chat selection and localStorage persistence.
 *   - Per-chat message-history cache (`chatHistory`).
 *   - Typewriter title-animation system.
 *   - `loadChatBoards` / `loadMessagesForChat` backend fetches.
 *   - `handleAddChat` — creates a local temp-chat and navigates.
 *   - `ensureChatOnServer` — persists a new chat when the first message is sent.
 *   - Rename / delete / star inline UI state and handlers.
 *
 * NOT in scope (handled by other hooks or AppLayout directly):
 *   - Pin operations  → `usePinOperations` (Phase 3)
 *   - Model selection  → `useModelSelection` (Phase 3)
 *   - Persona loading  → stays in AppLayout until Phase 4
 *   - UI-only sidebar state (collapsed, right panel, etc.)
 *
 * Cross-hook dependency pattern:
 *   `ensureChatOnServer` needs to trigger a pin reload after persisting a new
 *   chat. To avoid a circular import between `useChatHistory` and
 *   `usePinOperations`, the parent passes a `loadPinsForChatRef` — a mutable
 *   ref that is populated with `usePinOperations`'s `loadPinsForChat` after
 *   both hooks have been called. The ref is null-checked before use.
 *
 *   Similarly, `onChatDeleted` is a callback the parent wires to
 *   `usePinOperations`'s cache-clear function.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { Message, MessageSource } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";
import type { AuthUser } from "@/context/auth-context";
import type { ChatBoard, ChatBoardType, ChatMetadata } from "@/components/layout/app-layout";
import {
  createChat,
  fetchChatBoards,
  fetchChatMessages,
  renameChat,
  type BackendChat,
  type BackendMessage,
} from "@/lib/api/chat";
import { apiFetch } from "@/lib/api/client";
import { CHATS_ENDPOINT, CHAT_STAR_ENDPOINT } from "@/lib/config";
import { toast } from "@/lib/toast-helper";
import {
  extractMetadata,
  normalizeBackendMessage,
} from "@/lib/normalizers/message-transformer";
import { extractThinkingContent } from "@/lib/parsers/content-parser";

// ─── Re-exported public types ──────────────────────────────────────────────────

/** Shape passed to `ensureChatOnServer`. */
export interface EnsureChatOptions {
  firstMessage: string;
  selectedModel?: AIModel | null;
  pinIds?: string[];
  useFramework?: boolean;
}

/** Return value of `ensureChatOnServer`. */
export interface EnsureChatResult {
  chatId: string;
  initialResponse?: string | null;
  initialMessageId?: string | null;
  initialMetadata?: Message["metadata"];
}

// ─── Private types ─────────────────────────────────────────────────────────────

type ChatHistory = Record<string, Message[]>;

type BackendFileAttachment = {
  file_link?: unknown;
  url?: unknown;
  link?: unknown;
  mime_type?: unknown;
  mimeType?: unknown;
  file_name?: unknown;
  fileName?: unknown;
  name?: unknown;
  origin?: unknown;
};

// ─── Module-level pure helpers (not exported — internal to the hook) ───────────

const formatRelativeTime = (value?: string): string => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
};

const extractChatId = (chat: BackendChat): string => {
  const possibleId =
    chat.id ??
    (chat as { chatId?: unknown }).chatId ??
    (chat as { pk?: unknown }).pk ??
    null;
  if (possibleId !== null && possibleId !== undefined) return String(possibleId);
  console.warn("[useChatHistory] Chat missing id from backend payload", chat);
  return `temp-${crypto.randomUUID()}`;
};

const normalizeChatBoard = (
  chat: BackendChat,
  defaultType: ChatBoardType = "chat",
): ChatBoard => {
  const lastMessageAt = chat.updated_at || chat.created_at || null;
  let metadata: ChatMetadata | undefined =
    "metadata" in chat && chat.metadata && typeof chat.metadata === "object"
      ? { ...(chat.metadata as ChatMetadata) }
      : undefined;

  if (metadata) {
    if (metadata.lastMessageAt === undefined || metadata.lastMessageAt === null) {
      metadata.lastMessageAt = lastMessageAt;
    }
  } else {
    metadata = { lastMessageAt };
  }

  if (metadata && metadata.starMessageId === undefined) {
    const fromChat = (chat as { starMessageId?: string | number | null }).starMessageId;
    if (fromChat !== undefined) metadata.starMessageId = fromChat;
  } else if (!metadata) {
    const fromChat = (chat as { starMessageId?: string | number | null }).starMessageId;
    if (fromChat !== undefined) metadata = { starMessageId: fromChat };
  }

  const hasMetadataStarred =
    metadata !== undefined &&
    Object.prototype.hasOwnProperty.call(metadata, "starred");
  const resolvedStarred = hasMetadataStarred
    ? Boolean((metadata as { starred?: unknown }).starred)
    : undefined;

  const chatType =
    (chat as { type?: ChatBoardType }).type ||
    (chat as { chatType?: ChatBoardType }).chatType ||
    defaultType;

  return {
    id: extractChatId(chat),
    name: chat.chat_title || chat.title || chat.name || "Untitled Chat",
    time: formatRelativeTime(chat.updated_at || chat.created_at),
    isStarred:
      resolvedStarred !== undefined
        ? resolvedStarred
        : Boolean(chat.starred ?? chat.is_starred ?? chat.isStarred ?? false),
    pinCount:
      metadata?.pinCount ?? chat.pins_count ?? chat.pin_count ?? chat.pinCount ?? 0,
    type: chatType,
    metadata,
  };
};

const filenameFromUrl = (url: string): string | undefined => {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : undefined;
  } catch {
    return undefined;
  }
};

const isImageAttachment = (url: string, mimeType?: string | null): boolean => {
  if (typeof mimeType === "string" && mimeType.toLowerCase().startsWith("image/")) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url.toLowerCase());
};

const getAttachmentOrigin = (origin: unknown): "generated" | "uploaded" | null => {
  if (typeof origin !== "string") return null;
  const normalized = origin.trim().toLowerCase();
  if (normalized === "generated") return "generated";
  if (normalized === "uploaded" || normalized === "upload" || normalized === "user")
    return "uploaded";
  return null;
};

const extractUserAttachmentsFromEntry = (
  entry: BackendMessage,
): Array<{ id: string; type: "pdf" | "image"; name: string; url: string }> => {
  const out: Array<{ id: string; type: "pdf" | "image"; name: string; url: string }> = [];

  const addAttachment = (url: unknown, fallbackType: "pdf" | "image", index: number) => {
    if (typeof url !== "string" || url.trim().length === 0) return;
    const cleanUrl = url.trim();
    const lowerUrl = cleanUrl.toLowerCase();
    const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(lowerUrl);
    const isPdf = /\.pdf(\?|$)/.test(lowerUrl);
    const type: "pdf" | "image" = isImage ? "image" : isPdf ? "pdf" : fallbackType;
    out.push({
      id: `att-${index}-${type}`,
      type,
      name:
        type === "image"
          ? `Image ${index + 1}`
          : filenameFromUrl(cleanUrl) || `Document ${index + 1}`,
      url: cleanUrl,
    });
  };

  const imageLinks = entry.image_links;
  if (Array.isArray(imageLinks)) {
    imageLinks.forEach((url, i) => addAttachment(url, "image", i));
  }
  const fileLinks = entry.file_links;
  if (Array.isArray(fileLinks)) {
    const offset = out.length;
    fileLinks.forEach((url, i) => addAttachment(url, "pdf", offset + i));
  }

  return out;
};

const extractFileAttachmentsFromEntry = (entry: BackendMessage) => {
  const rawAttachments = (entry as { file_attachments?: unknown }).file_attachments;
  const parsed = Array.isArray(rawAttachments)
    ? rawAttachments
        .map((att, index) => {
          if (!att || typeof att !== "object") return null;
          const file = att as BackendFileAttachment;
          const rawUrl = file.file_link ?? file.url ?? file.link;
          const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
          if (!url) return null;

          const mimeRaw = file.mime_type ?? file.mimeType;
          const mimeType =
            typeof mimeRaw === "string" ? mimeRaw.trim() : undefined;
          const origin = getAttachmentOrigin(file.origin);
          const rawName = file.file_name ?? file.fileName ?? file.name;
          const name =
            typeof rawName === "string" && rawName.trim().length > 0
              ? rawName.trim()
              : undefined;

          return {
            id: `file-att-${index}`,
            url,
            mimeType,
            origin,
            name,
            isImage: isImageAttachment(url, mimeType),
          };
        })
        .filter(
          (
            item,
          ): item is {
            id: string;
            url: string;
            mimeType: string | undefined;
            origin: "generated" | "uploaded" | null;
            name: string | undefined;
            isImage: boolean;
          } => item !== null,
        )
    : [];

  const userAttachments = parsed
    .filter((item) => item.origin === "uploaded")
    .map((item, index) => ({
      id: `${item.id}-user-${index}`,
      type: item.isImage ? ("image" as const) : ("pdf" as const),
      name:
        item.name ||
        (item.isImage
          ? `Image ${index + 1}`
          : filenameFromUrl(item.url) || `Document ${index + 1}`),
      url: item.url,
    }));

  const generatedImages = parsed
    .filter((item) => item.origin === "generated" && item.isImage)
    .map((item) => ({ url: item.url, alt: item.name }));

  const generatedDocuments = parsed
    .filter((item) => item.origin === "generated" && !item.isImage)
    .map((item, index) => ({
      url: item.url,
      filename: item.name || filenameFromUrl(item.url) || `Document ${index + 1}`,
      mimeType: item.mimeType,
    }));

  return { userAttachments, generatedImages, generatedDocuments };
};

const getImagesFromBackendMessage = (
  entry: BackendMessage,
): { images?: Array<{ url: string; alt?: string }>; imageUrl?: string } => {
  const fileAttachments = extractFileAttachmentsFromEntry(entry);
  if (fileAttachments.generatedImages.length > 0) {
    return { images: fileAttachments.generatedImages };
  }

  const generatedImages = entry.generated_images;
  if (Array.isArray(generatedImages) && generatedImages.length > 0) {
    const images = generatedImages
      .filter((url): url is string => typeof url === "string" && url.length > 0)
      .map((url) => ({ url }));
    if (images.length > 0) return { images };
  }

  const raw = (entry as Record<string, unknown>).images;
  if (Array.isArray(raw) && raw.length > 0) {
    return {
      images: raw
        .map((img: unknown) => {
          if (typeof img === "string") return { url: img };
          if (img && typeof img === "object" && "url" in img)
            return {
              url: String((img as { url: string }).url),
              alt: (img as { alt?: string }).alt,
            };
          return { url: "" };
        })
        .filter((img) => img.url),
    };
  }

  const singleUrl =
    (entry as Record<string, unknown>).image_url ??
    (entry as Record<string, unknown>).imageUrl;
  if (typeof singleUrl === "string" && singleUrl) return { imageUrl: singleUrl };

  return {};
};

/**
 * Converts a single backend message entry (which may contain both a user prompt
 * and an AI response) into the array of `Message` objects used by the chat UI.
 */
const convertBackendEntryToMessages = (entry: BackendMessage): Message[] => {
  const userText = entry.input ?? (entry as { prompt?: string }).prompt;
  const aiText = entry.output ?? (entry as { response?: string }).response;

  const hasPrompt = typeof userText === "string" && userText.length > 0;
  const hasResponse = typeof aiText === "string" && aiText.length > 0;
  const { images: entryImages, imageUrl: entryImageUrl } = getImagesFromBackendMessage(entry);
  const { userAttachments: uploadedFileAttachments, generatedDocuments } =
    extractFileAttachmentsFromEntry(entry);
  const hasImages = !!(entryImages?.length || entryImageUrl);

  if (!hasPrompt && !hasResponse && !hasImages) {
    return [normalizeBackendMessage(entry)];
  }

  const baseIdRaw =
    entry.id !== undefined && entry.id !== null
      ? entry.id
      : (entry as { message_id?: string | number | null }).message_id ??
        crypto.randomUUID();
  const baseId = String(baseIdRaw);
  const messages: Message[] = [];
  const chatMessageId = baseId;
  const pinId =
    entry.pin && entry.pin.id !== undefined && entry.pin.id !== null
      ? String(entry.pin.id)
      : undefined;

  let promptMetadata: Message["metadata"] | undefined;

  if (hasPrompt) {
    promptMetadata = extractMetadata(entry);
    const userAttachments = extractUserAttachmentsFromEntry(entry);
    const mergedUserAttachments = [...uploadedFileAttachments, ...userAttachments];
    if (promptMetadata && mergedUserAttachments.length > 0) {
      const seenUrls = new Set<string>();
      promptMetadata.attachments = mergedUserAttachments.filter((attachment) => {
        if (seenUrls.has(attachment.url)) return false;
        seenUrls.add(attachment.url);
        return true;
      });
    }
    messages.push({
      id: `${baseId}-prompt`,
      sender: "user",
      content: userText as string,
      chatMessageId,
      metadata: promptMetadata,
    });
  }

  if (hasResponse || hasImages) {
    const sanitized = extractThinkingContent((aiText as string) || "");
    const images = entryImages;
    const imageUrl = entryImageUrl;
    const entryReasoning = entry.reasoning ?? entry.thinking_content ?? null;
    const responseReasoning = entryReasoning || sanitized.thinkingText;

    const generatedFileUrlSet = new Set(
      generatedDocuments.map((d) => d.url.trim().toLowerCase()),
    );
    const priorSources = (promptMetadata?.sources as MessageSource[] | undefined) || [];
    const sourcesWithoutGeneratedFiles = priorSources.filter(
      (s) =>
        typeof s.url === "string" &&
        !generatedFileUrlSet.has(s.url.trim().toLowerCase()),
    );

    const priorGeneratedFiles = Array.isArray(promptMetadata?.generatedFiles)
      ? promptMetadata!.generatedFiles!
      : [];
    const seenGenUrls = new Set<string>();
    const mergedGeneratedFilesForAi = [
      ...priorGeneratedFiles,
      ...generatedDocuments,
    ].filter((f) => {
      if (!f || typeof f.url !== "string") return false;
      const k = f.url.trim().toLowerCase();
      if (!k || seenGenUrls.has(k)) return false;
      seenGenUrls.add(k);
      return true;
    });

    const aiMetadata: Message["metadata"] = {
      ...(promptMetadata || {}),
      sources:
        sourcesWithoutGeneratedFiles.length > 0
          ? sourcesWithoutGeneratedFiles
          : undefined,
      ...(mergedGeneratedFilesForAi.length > 0
        ? { generatedFiles: mergedGeneratedFilesForAi }
        : {}),
    };

    messages.push({
      id: `${baseId}-response`,
      sender: "ai",
      content:
        sanitized.visibleText || (responseReasoning ? "" : (aiText as string)),
      thinkingContent: responseReasoning,
      isThinkingInProgress: false,
      chatMessageId,
      pinId,
      metadata: aiMetadata,
      referencedMessageId:
        entry.reference_id ?? entry.referenced_message_id ?? null,
      ...(images && { images }),
      ...(imageUrl && !images && { imageUrl }),
    });
  }

  return messages;
};

// ─── Hook params ───────────────────────────────────────────────────────────────

export interface UseChatHistoryParams {
  /** Whether the current user is authenticated. */
  isAuthenticated: boolean;
  /** Current auth user — used for plan checks in ensureChatOnServer. */
  user: AuthUser | null;
  /** Current Next.js pathname — drives new-chat type detection in handleAddChat. */
  pathname: string | null;
  /** Next.js router instance — used for navigation in handleAddChat. */
  router: { push: (url: string) => void };
  /**
   * Mutable ref populated by the parent after calling `usePinOperations`.
   * `ensureChatOnServer` calls `ref.current?.(chatId)` to trigger a pin
   * reload for the newly persisted chat without a circular hook import.
   */
  loadPinsForChatRef: React.MutableRefObject<
    ((chatId: string | null) => Promise<void>) | null
  >;
  /**
   * Optional callback fired when a chat is permanently deleted from the
   * backend. The parent uses this to let `usePinOperations` clear its
   * cached pin data for the removed chat.
   */
  onChatDeleted?: (chatId: string) => void;
}

// ─── Hook implementation ───────────────────────────────────────────────────────

export function useChatHistory({
  isAuthenticated,
  user,
  pathname,
  router,
  loadPinsForChatRef,
  onChatDeleted,
}: UseChatHistoryParams) {
  // ── Chat boards ─────────────────────────────────────────────────────────────

  const [chatBoards, setChatBoards] = useState<ChatBoard[]>([]);
  const [activeChatId, setActiveChatId_] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistory>({});

  // ── Title animation ─────────────────────────────────────────────────────────

  const [animatingTitles, setAnimatingTitles] = useState<
    Map<string, { targetTitle: string; timestamp: number }>
  >(new Map());

  // ── Rename / delete / star UI state ────────────────────────────────────────

  const [chatToDelete, setChatToDelete] = useState<ChatBoard | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState("");
  const [isDeletingChatBoard, setIsDeletingChatBoard] = useState(false);
  const [isRenamingChatBoard, setIsRenamingChatBoard] = useState(false);
  const [starUpdatingChatId, setStarUpdatingChatId] = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────

  /** Focus target for inline rename input. */
  const renameInputRef = useRef<HTMLInputElement>(null);
  /** Guards against double-fetching on mount. */
  const hasFetchedChats = useRef(false);
  /** Guards against creating a new-chat-after-login twice. */
  const hasStartedNewChatAfterLoginRef = useRef(false);
  /**
   * Stable wrapper around `handleAddChat` so the navigation effect below can
   * reference it without re-running when `handleAddChat`'s identity changes.
   */
  const handleAddChatRef = useRef<(typeOverride?: ChatBoardType | null) => void>(
    () => {},
  );
  /** Tracks previous pathname so we detect transitions into the main chat route. */
  const prevPathRef = useRef<string | null>(null);

  // ── Stable setActiveChatId ──────────────────────────────────────────────────

  /**
   * setActiveChatId — wraps the raw setter so external callers (e.g. useStreamingChat)
   * can pass either a value or an updater function without triggering automatic
   * re-ordering (chats only move to top when `moveChatToTop` is called explicitly).
   */
  const setActiveChatId = useCallback(
    (id: string | null | ((prev: string | null) => string | null)) => {
      setActiveChatId_((prevId) =>
        typeof id === "function" ? id(prevId) : id,
      );
    },
    [],
  );

  // ── Persist activeChatId ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeChatId && !activeChatId.startsWith("temp-")) {
      localStorage.setItem("activeChatId", activeChatId);
    }
  }, [activeChatId]);

  // ── Focus rename input when renamingChatId is set ──────────────────────────

  useEffect(() => {
    if (renamingChatId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingChatId]);

  // ── Chat board CRUD ─────────────────────────────────────────────────────────

  /** Move a specific chat to the top of the sidebar (called after a message is sent). */
  const moveChatToTop = useCallback((chatId: string) => {
    setChatBoards((prev) => {
      const idx = prev.findIndex((b) => b.id === chatId);
      if (idx > 0) {
        const reordered = [...prev];
        const [board] = reordered.splice(idx, 1);
        return [board, ...reordered];
      }
      return prev;
    });
  }, []);

  /** Immediately update the board title and kick off the typewriter animation. */
  const updateChatTitleWithAnimation = useCallback(
    (chatId: string, newTitle: string) => {
      setChatBoards((prev) =>
        prev.map((b) => (b.id === chatId ? { ...b, name: newTitle } : b)),
      );
      setAnimatingTitles((prev) => {
        const next = new Map(prev);
        next.set(chatId, { targetTitle: newTitle, timestamp: Date.now() });
        return next;
      });
    },
    [],
  );

  /**
   * Re-fetch a single chat from the backend and update its sidebar title.
   * Called after SSE streams end to pick up titles generated asynchronously.
   */
  const refreshChatTitle = useCallback(
    (chatId: string) => {
      if (!chatId || chatId.startsWith("temp-")) return;
      void apiFetch(`/chats/${chatId}/`, { method: "GET" })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as { title?: string; name?: string };
          const title = (data?.title || data?.name || "").trim();
          if (title) updateChatTitleWithAnimation(chatId, title);
        })
        .catch(() => {});
    },
    [updateChatTitleWithAnimation],
  );

  /** Returns animation metadata for a given chatId, or null. */
  const getAnimatingTitle = useCallback(
    (chatId: string) => animatingTitles.get(chatId) ?? null,
    [animatingTitles],
  );

  // ── Backend fetching ────────────────────────────────────────────────────────

  /**
   * Fetches all chat boards from the backend and merges them with any
   * in-flight temp chats already in local state. Pass `force = true` to
   * bypass the single-fetch guard (e.g. after deleting a chat).
   */
  const loadChatBoards = useCallback(
    async (force = false) => {
      if (!isAuthenticated) {
        console.debug("[useChatHistory/loadChatBoards] Skipped: not authenticated");
        return;
      }
      if (hasFetchedChats.current && !force) {
        console.debug("[useChatHistory/loadChatBoards] Skipped: already fetched");
        return;
      }
      try {
        const { chats: backendChats } = await fetchChatBoards();
        hasFetchedChats.current = true;
        const normalizedWithSort = backendChats.map((chat) => {
          const board = normalizeChatBoard(chat);
          const timestamp = Date.parse(chat.updated_at || chat.created_at || "");
          return {
            board,
            sortTime: Number.isNaN(timestamp) ? 0 : timestamp,
          };
        });
        const normalized = normalizedWithSort
          .sort((a, b) => b.sortTime - a.sortTime)
          .map((e) => e.board);

        let combinedBoards: ChatBoard[] = normalized;
        setChatBoards((prev) => {
          const tempBoards = prev.filter(
            (b) =>
              b.id.startsWith("temp-") && !normalized.some((n) => n.id === b.id),
          );
          combinedBoards = [...tempBoards, ...normalized];
          console.debug(
            "[useChatHistory/loadChatBoards]",
            "prev:", prev.length,
            "backend:", normalized.length,
            "temp:", tempBoards.length,
            "combined:", combinedBoards.length,
          );
          return combinedBoards;
        });

        setActiveChatId((prev) => {
          if (prev && combinedBoards.some((b) => b.id === prev)) return prev;
          const savedId =
            typeof window !== "undefined"
              ? localStorage.getItem("activeChatId")
              : null;
          if (savedId && combinedBoards.some((b) => b.id === savedId))
            return savedId;
          return combinedBoards.length > 0 ? combinedBoards[0].id : null;
        });
      } catch (error) {
        console.error("[useChatHistory/loadChatBoards] Failed:", error);
      }
    },
    [isAuthenticated, setActiveChatId],
  );

  /**
   * Fetches messages for a single chat from the backend and populates
   * `chatHistory[chatId]`. Also back-fills any pins that were loaded without
   * a chat ID by matching their message IDs against the fetched messages.
   */
  const loadMessagesForChat = useCallback(
    async (chatId: string, setPins?: React.Dispatch<React.SetStateAction<import("@/components/layout/right-sidebar").PinType[]>>) => {
      try {
        const backendMessages = await fetchChatMessages(chatId);
        const normalized = backendMessages.flatMap(convertBackendEntryToMessages);
        setChatHistory((prev) => ({ ...prev, [chatId]: normalized }));

        if (setPins) {
          const messageIds = new Set(
            normalized
              .map((msg) => {
                const rawId = msg.chatMessageId ?? msg.id;
                return rawId !== undefined && rawId !== null ? String(rawId) : "";
              })
              .filter((id) => id.length > 0),
          );

          if (messageIds.size > 0) {
            setPins((prevPins) => {
              let changed = false;
              const nextPins = prevPins.map((pin) => {
                const linkedChatId = String(pin.chatId || pin.sourceChatId || "");
                if (linkedChatId.length > 0) return pin;
                const pinMessageId = String(
                  pin.messageId || pin.sourceMessageId || "",
                );
                if (!pinMessageId || !messageIds.has(pinMessageId)) return pin;
                changed = true;
                return {
                  ...pin,
                  chatId,
                  sourceChatId: pin.sourceChatId ?? chatId,
                };
              });
              return changed ? nextPins : prevPins;
            });
          }
        }
      } catch (error) {
        console.error(
          `[useChatHistory/loadMessagesForChat] Failed for chat ${chatId}:`,
          error,
        );
      }
    },
    [],
  );

  // ── Message state updater ───────────────────────────────────────────────────

  /**
   * Updates the message list for the active chat (or a specific chat when
   * `chatIdOverride` is provided). This is the `setMessages` function passed
   * down to `ChatInterface` and `useStreamingChat`.
   */
  const setMessagesForActiveChat = useCallback(
    (
      messages: Message[] | ((prev: Message[]) => Message[]),
      chatIdOverride?: string,
    ) => {
      const targetChatId = chatIdOverride ?? activeChatId;
      if (!targetChatId) return;
      setChatHistory((prev) => {
        const prevMessages = prev[targetChatId] || [];
        const nextMessages =
          typeof messages === "function" ? messages(prevMessages) : messages;
        return { ...prev, [targetChatId]: nextMessages };
      });
    },
    [activeChatId],
  );

  // ── handleAddChat ───────────────────────────────────────────────────────────

  /**
   * Creates a client-side temp chat of the appropriate type and navigates to
   * the corresponding route. Reuses an existing empty temp chat of the same
   * type if one already exists.
   */
  const handleAddChat = useCallback(
    (typeOverride?: ChatBoardType | null) => {
      setRenamingChatId(null);
      setRenamingText("");

      const isOnPersonaPage =
        pathname?.startsWith("/personas/admin") ||
        pathname?.startsWith("/personas");
      const isOnWorkflowPage =
        pathname?.startsWith("/workflows/admin") ||
        pathname?.startsWith("/workflows");

      const chatType: ChatBoardType =
        typeOverride ??
        (isOnPersonaPage ? "persona" : isOnWorkflowPage ? "workflow" : "chat");

      const existingTemp = chatBoards.find(
        (b) => b.id.startsWith("temp-") && (b.type || "chat") === chatType,
      );
      if (existingTemp) {
        const tempMessages = chatHistory[existingTemp.id] ?? [];
        if (tempMessages.length === 0) {
          setActiveChatId(existingTemp.id);
          setChatHistory((prev) =>
            prev[existingTemp.id] ? prev : { ...prev, [existingTemp.id]: [] },
          );
          if (chatType === "persona") router.push("/personas");
          else if (chatType === "workflow") router.push("/workflows");
          else router.push("/");
          return;
        }
        setChatBoards((prev) => prev.filter((b) => b.id !== existingTemp.id));
        setChatHistory((prev) => {
          const next = { ...prev };
          delete next[existingTemp.id];
          return next;
        });
      }

      const tempId = `temp-${crypto.randomUUID()}`;
      const placeholder: ChatBoard = {
        id: tempId,
        name: "New chat",
        time: "Just now",
        isStarred: false,
        pinCount: 0,
        type: chatType,
        metadata: {
          messageCount: 0,
          pinCount: 0,
          lastMessageAt: new Date().toISOString(),
        },
      };

      setChatBoards((prev) => {
        console.debug(
          "[useChatHistory/handleAddChat] boards:", prev.length,
          "adding:", tempId,
          "type:", chatType,
        );
        return [placeholder, ...prev];
      });
      setChatHistory((prev) => ({ ...prev, [tempId]: [] }));
      setActiveChatId(tempId);

      if (chatType === "persona") router.push("/personas");
      else if (chatType === "workflow") router.push("/workflows");
      else router.push("/");
    },
    [chatBoards, chatHistory, pathname, router, setActiveChatId],
  );

  // Keep handleAddChatRef in sync for effects that need a stable reference
  handleAddChatRef.current = handleAddChat;

  // ── ensureChatOnServer ──────────────────────────────────────────────────────

  /**
   * If no real backend chat exists yet (activeChatId is null or temp-*),
   * creates one on the server, normalises the response, and updates local
   * state. The caller receives the resolved chatId plus any initial AI message
   * the backend might have generated for the first message.
   */
  const ensureChatOnServer = useCallback(
    async ({
      firstMessage,
      selectedModel,
      pinIds,
      useFramework,
    }: EnsureChatOptions): Promise<EnsureChatResult | null> => {
      const currentActiveId = activeChatId;
      const isTempChat = currentActiveId?.startsWith("temp-") ?? false;
      if (currentActiveId && !isTempChat) {
        return { chatId: currentActiveId, initialResponse: null };
      }

      const tempChatBoard = currentActiveId
        ? chatBoards.find((b) => b.id === currentActiveId)
        : null;
      const chatType = tempChatBoard?.type || "chat";

      const payload = {
        title: firstMessage.slice(0, 60) || "New Chat",
        firstMessage,
        model: selectedModel
          ? {
              modelId: selectedModel.id ?? selectedModel.modelId,
              companyName: selectedModel.companyName,
              modelName: selectedModel.modelName,
              version: selectedModel.version,
            }
          : null,
        useFramework: Boolean(useFramework),
        user,
        pinIds,
        type: chatType,
      };

      try {
        const {
          chat: created,
          initialResponse,
          initialMessageId,
          initialMessageMetadata,
          message,
        } = await createChat(payload);

        const normalized = normalizeChatBoard(created, chatType);
        const tempMessages =
          isTempChat && currentActiveId ? chatHistory[currentActiveId] ?? [] : [];

        setChatBoards((prev) => {
          const filtered = prev.filter(
            (b) => b.id !== normalized.id && b.id !== currentActiveId,
          );
          return [normalized, ...filtered];
        });
        setActiveChatId(normalized.id);
        setChatHistory((prev) => {
          const next: ChatHistory = {
            ...prev,
            [normalized.id]: prev[normalized.id] ?? tempMessages,
          };
          if (isTempChat && currentActiveId && currentActiveId !== normalized.id) {
            delete next[currentActiveId];
          }
          return next;
        });

        // Trigger a pin reload for the new chat via the injected ref
        void loadPinsForChatRef.current?.(normalized.id);

        return {
          chatId: normalized.id,
          initialResponse: initialResponse ?? null,
          initialMessageId: initialMessageId ?? null,
          initialMetadata:
            initialMessageMetadata && typeof initialMessageMetadata === "object"
              ? (initialMessageMetadata as Message["metadata"])
              : message
                ? extractMetadata(message as BackendMessage)
                : undefined,
        };
      } catch (error) {
        console.error("[useChatHistory/ensureChatOnServer] Failed:", error);
        throw error;
      }
    },
    [activeChatId, chatBoards, chatHistory, loadPinsForChatRef, user, setActiveChatId],
  );

  // ── Rename handlers ─────────────────────────────────────────────────────────

  const resetRenameState = useCallback(() => {
    setRenamingChatId(null);
    setRenamingText("");
  }, []);

  const handleRenameCancel = useCallback(() => {
    resetRenameState();
    renameInputRef.current?.blur();
  }, [resetRenameState]);

  const handleRenameConfirm = useCallback(async () => {
    if (!renamingChatId || isRenamingChatBoard) return;
    const targetId = renamingChatId;
    const nextName = renamingText.trim();
    if (!nextName) {
      toast.error("Name required", {
        description: "Enter a chat name before saving.",
      });
      return;
    }

    const targetBoard = chatBoards.find((b) => b.id === targetId);
    if (!targetBoard) {
      resetRenameState();
      return;
    }

    const previousName = targetBoard.name;
    if (previousName === nextName) {
      resetRenameState();
      return;
    }

    if (targetId.startsWith("temp-")) {
      setChatBoards((prev) =>
        prev.map((b) => (b.id === targetId ? { ...b, name: nextName } : b)),
      );
      handleRenameCancel();
      toast("Chat renamed", { description: "Name updated successfully." });
      return;
    }

    setIsRenamingChatBoard(true);
    setChatBoards((prev) =>
      prev.map((b) => (b.id === targetId ? { ...b, name: nextName } : b)),
    );

    try {
      await renameChat(targetId, nextName);
      handleRenameCancel();
      toast("Chat renamed", { description: "Name updated successfully." });
    } catch (error) {
      console.error("[useChatHistory/handleRenameConfirm] Failed:", error);
      setChatBoards((prev) =>
        prev.map((b) =>
          b.id === targetId ? { ...b, name: previousName } : b,
        ),
      );
      setRenamingText(previousName);
      toast.error("Rename failed", {
        description:
          error instanceof Error ? error.message : "Unable to rename chat.",
      });
    } finally {
      setIsRenamingChatBoard(false);
    }
  }, [
    chatBoards,
    handleRenameCancel,
    isRenamingChatBoard,
    renamingChatId,
    renamingText,
    resetRenameState,
  ]);

  // ── Delete handlers ─────────────────────────────────────────────────────────

  const handleDeleteClick = useCallback((board: ChatBoard) => {
    setChatToDelete(board);
  }, []);

  /**
   * Removes the chat from local state and navigates to the next available
   * chat. Also calls `onChatDeleted` so pin state can be cleared.
   */
  const confirmDelete = useCallback(async () => {
    if (!chatToDelete) return;
    const chatId = chatToDelete.id;
    setIsDeletingChatBoard(true);

    const removeChatLocally = (id: string) => {
      setChatHistory((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setChatBoards((prev) => {
        const nextBoards = prev.filter((b) => b.id !== id);
        if (activeChatId === id) {
          const removedIndex = prev.findIndex((b) => b.id === id);
          const fallback =
            nextBoards[removedIndex] ??
            nextBoards[removedIndex - 1] ??
            nextBoards[0] ??
            null;
          setActiveChatId(fallback ? fallback.id : null);
        }
        return nextBoards;
      });
      onChatDeleted?.(id);
    };

    try {
      if (chatId.startsWith("temp-")) {
        removeChatLocally(chatId);
        setChatToDelete(null);
        toast("Chat deleted", { description: "This chat board has been removed." });
        return;
      }

      const response = await apiFetch(CHATS_ENDPOINT, {
        method: "DELETE",
        body: JSON.stringify({ chat_id: chatId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete chat");
      }

      removeChatLocally(chatId);
      setChatToDelete(null);
      await loadChatBoards(true);
      toast("Chat deleted", { description: "This chat board has been removed." });
    } catch (error) {
      console.error("[useChatHistory/confirmDelete] Failed:", error);
      toast.error("Delete failed", {
        description:
          error instanceof Error ? error.message : "Unable to delete chat.",
      });
    } finally {
      setIsDeletingChatBoard(false);
    }
  }, [
    activeChatId,
    chatToDelete,
    loadChatBoards,
    onChatDeleted,
    setActiveChatId,
  ]);

  // ── Star handler ─────────────────────────────────────────────────────────────

  const handleToggleStar = useCallback(async (board: ChatBoard) => {
    const chatId = board.id;
    const nextValue = !board.isStarred;

    if (chatId.startsWith("temp-")) {
      setChatBoards((prev) =>
        prev.map((b) => (b.id === chatId ? { ...b, isStarred: nextValue } : b)),
      );
      toast(nextValue ? "Chat starred" : "Star removed", {
        description: nextValue ? "Added to your favorites." : "Removed from favorites.",
      });
      return;
    }

    setStarUpdatingChatId(chatId);
    setChatBoards((prev) =>
      prev.map((b) => (b.id === chatId ? { ...b, isStarred: nextValue } : b)),
    );

    try {
      const response = await apiFetch(CHAT_STAR_ENDPOINT(chatId), {
        method: "PATCH",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update star");
      }

      try {
        const data = await response.json();
        const resolved =
          typeof (data as { starred?: unknown }).starred === "boolean"
            ? Boolean((data as { starred: boolean }).starred)
            : typeof (data as { is_starred?: unknown }).is_starred === "boolean"
              ? Boolean((data as { is_starred: boolean }).is_starred)
              : nextValue;
        setChatBoards((prev) =>
          prev.map((b) =>
            b.id === chatId ? { ...b, isStarred: resolved } : b,
          ),
        );
      } catch {
        // Non-JSON response is fine — the optimistic update stands.
      }

      toast(nextValue ? "Chat starred" : "Star removed", {
        description: nextValue ? "Added to your favorites." : "Removed from favorites.",
      });
    } catch (error) {
      console.error("[useChatHistory/handleToggleStar] Failed:", error);
      setChatBoards((prev) =>
        prev.map((b) =>
          b.id === chatId ? { ...b, isStarred: !nextValue } : b,
        ),
      );
      toast.error("Star update failed", {
        description:
          error instanceof Error ? error.message : "Unable to update star.",
      });
    } finally {
      setStarUpdatingChatId(null);
    }
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Auto-load messages when activeChatId changes and there's no cached history
  useEffect(() => {
    if (!activeChatId || !isAuthenticated || chatHistory[activeChatId]) return;
    void loadMessagesForChat(activeChatId);
  }, [activeChatId, chatHistory, isAuthenticated, loadMessagesForChat]);

  // Load chat boards once when the user becomes authenticated; optionally
  // start a fresh chat if `startNewChatOnLogin` was set in localStorage.
  useEffect(() => {
    if (!isAuthenticated || hasFetchedChats.current) return;
    (async () => {
      await loadChatBoards();
      const shouldStartNew =
        typeof window !== "undefined" &&
        window.localStorage.getItem("startNewChatOnLogin") === "true";
      if (shouldStartNew && !hasStartedNewChatAfterLoginRef.current) {
        hasStartedNewChatAfterLoginRef.current = true;
        handleAddChatRef.current();
        window.localStorage.removeItem("startNewChatOnLogin");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loadChatBoards]);

  // Whenever the user navigates from a non-chat route into the main chat board,
  // automatically open a new blank "chat" board.
  useEffect(() => {
    const current = pathname ?? null;
    const prev = prevPathRef.current;
    const isChatNow =
      current === "/" || (current !== null && current.startsWith("/chats"));
    const wasChatBefore =
      prev === "/" || (prev !== null && prev.startsWith("/chats"));

    // Skip initial mount (prev === null) so we restore the last active chat.
    if (isChatNow && !wasChatBefore && prev !== null) {
      handleAddChatRef.current("chat");
    }
    prevPathRef.current = current;
  }, [pathname]);

  // ── Return value ────────────────────────────────────────────────────────────

  return {
    // State
    chatBoards,
    setChatBoards,
    activeChatId,
    setActiveChatId,
    chatHistory,
    setChatHistory,
    animatingTitles,
    chatToDelete,
    setChatToDelete,
    renamingChatId,
    setRenamingChatId,
    renamingText,
    setRenamingText,
    isDeletingChatBoard,
    isRenamingChatBoard,
    starUpdatingChatId,
    // Refs
    renameInputRef,
    hasFetchedChats,
    // Data fetching
    loadChatBoards,
    loadMessagesForChat,
    // Message updater (passed to ChatInterface / useStreamingChat)
    setMessagesForActiveChat,
    // Chat management
    handleAddChat,
    ensureChatOnServer,
    moveChatToTop,
    updateChatTitleWithAnimation,
    refreshChatTitle,
    getAnimatingTitle,
    // Rename
    resetRenameState,
    handleRenameCancel,
    handleRenameConfirm,
    // Delete
    handleDeleteClick,
    confirmDelete,
    // Star
    handleToggleStar,
  };
}

/** Convenience type alias. */
export type ChatHistoryReturn = ReturnType<typeof useChatHistory>;
