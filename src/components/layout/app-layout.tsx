"use client";
import type { ReactNode } from "react";
import React, {
  useState,
  createContext,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar, type PinType } from "./right-sidebar";
import { RightSidebarCollapsed } from "./right-sidebar-collapsed";
import { Topbar } from "./top-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "../chat/chat-message";
import { useRouter, usePathname } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/auth-context";
import type { AIModel } from "@/types/ai-model";
import {
  createChat,
  fetchChatBoards,
  fetchChatMessages,
  type BackendChat,
  type BackendMessage,
} from "@/lib/api/chat";
import { apiFetch } from "@/lib/api/client";
import {
  createPin,
  deletePin,
  fetchAllPins,
  type BackendPin,
} from "@/lib/api/pins";
import { CHAT_DETAIL_ENDPOINT, CHAT_STAR_ENDPOINT } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { extractThinkingContent } from "@/lib/thinking";

interface AppLayoutProps {
  children: React.ReactElement;
}

export type ChatMetadata = {
  messageCount?: number | null;
  lastMessageAt?: string | null;
  pinCount?: number | null;
  starred?: boolean | null;
  starMessageId?: string | number | null;
};

export type ChatBoard = {
  id: string;
  name: string;
  time: string;
  isStarred: boolean;
  pinCount: number;
  metadata?: ChatMetadata;
};

type ChatHistory = Record<string, Message[]>;

export type RightSidebarPanel = "pinboard" | "files" | "personas" | "compare";

interface EnsureChatOptions {
  firstMessage: string;
  selectedModel?: AIModel | null;
  pinIds?: string[];
  useFramework?: boolean;
}

interface EnsureChatResult {
  chatId: string;
  initialResponse?: string | null;
  initialMessageId?: string | null;
  initialMetadata?: Message["metadata"];
}

interface AppLayoutContextType {
  chatBoards: ChatBoard[];
  setChatBoards: React.Dispatch<React.SetStateAction<ChatBoard[]>>;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  pins: PinType[];
  onPinMessage: (pin: PinType) => Promise<void>;
  onUnpinMessage: (pinId: string) => Promise<void>;
  handleAddChat: () => void;
  ensureChatOnServer: (
    options: EnsureChatOptions
  ) => Promise<EnsureChatResult | null>;
  selectedModel: AIModel | null;
  setSelectedModel: React.Dispatch<React.SetStateAction<AIModel | null>>;
  useFramework: boolean;
  setUseFramework: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AppLayoutContext = createContext<AppLayoutContextType | null>(
  null
);

const formatRelativeTime = (value?: string) => {
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
  if (possibleId !== null && possibleId !== undefined) {
    return String(possibleId);
  }
  console.warn("Chat missing id from backend payload", chat);
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeChatBoard = (chat: BackendChat): ChatBoard => {
  let metadata =
    "metadata" in chat && chat.metadata && typeof chat.metadata === "object"
      ? { ...(chat.metadata as ChatMetadata) }
      : undefined;

  if (metadata && metadata.starMessageId === undefined) {
    const fromChat = (chat as { starMessageId?: string | number | null })
      .starMessageId;
    if (fromChat !== undefined) {
      metadata.starMessageId = fromChat;
    }
  } else if (!metadata) {
    const fromChat = (chat as { starMessageId?: string | number | null })
      .starMessageId;
    if (fromChat !== undefined) {
      metadata = { starMessageId: fromChat };
    }
  }

  const hasMetadataStarred =
    metadata !== undefined &&
    Object.prototype.hasOwnProperty.call(metadata, "starred");
  const resolvedStarred = hasMetadataStarred
    ? Boolean((metadata as { starred?: unknown }).starred)
    : undefined;

  return {
    id: extractChatId(chat),
    name: chat.title || chat.name || "Untitled Chat",
    time: formatRelativeTime(chat.updated_at || chat.created_at),
    isStarred:
      resolvedStarred !== undefined
        ? resolvedStarred
        : Boolean(chat.is_starred ?? chat.isStarred ?? false),
    pinCount: chat.pin_count ?? chat.pinCount ?? metadata?.pinCount ?? 0,
    metadata,
  };
};

const extractMetadata = (msg: BackendMessage) => {
  const meta = (msg as { metadata?: Record<string, unknown> }).metadata || {};
  const pinsRaw: unknown[] = Array.isArray(
    (msg as { pins_tagged?: unknown[] }).pins_tagged
  )
    ? ((msg as { pins_tagged: unknown[] }).pins_tagged as unknown[])
    : Array.isArray((meta as { pinIds?: unknown[] }).pinIds)
    ? ((meta as { pinIds: unknown[] }).pinIds as unknown[])
    : Array.isArray((meta as { pin_ids?: unknown[] }).pin_ids)
    ? ((meta as { pin_ids: unknown[] }).pin_ids as unknown[])
    : [];

  const pinIds = pinsRaw
    .map((p) => (p !== undefined && p !== null ? String(p) : null))
    .filter((p): p is string => Boolean(p));

  return {
    modelName:
      (msg as { model_name?: string }).model_name ??
      (meta as { modelName?: string }).modelName ??
      (meta as { model_name?: string }).model_name,
    providerName:
      (msg as { provider_name?: string }).provider_name ??
      (meta as { providerName?: string }).providerName ??
      (meta as { provider_name?: string }).provider_name,
    llmModelId:
      (msg as { llm_model_id?: string | number | null }).llm_model_id ??
      (meta as { llmModelId?: string | number | null }).llmModelId ??
      (meta as { llm_model_id?: string | number | null }).llm_model_id ??
      null,
    inputTokens:
      (msg as { input_tokens?: number }).input_tokens ??
      (meta as { inputTokens?: number }).inputTokens ??
      (meta as { input_tokens?: number }).input_tokens,
    outputTokens:
      (msg as { output_tokens?: number }).output_tokens ??
      (meta as { outputTokens?: number }).outputTokens ??
      (meta as { output_tokens?: number }).output_tokens,
    createdAt:
      (msg as { created_at?: string }).created_at ??
      (meta as { createdAt?: string }).createdAt ??
      (meta as { created_at?: string }).created_at,
    documentId:
      (msg as { document_id?: string | null }).document_id ??
      (meta as { documentId?: string | null }).documentId ??
      (meta as { document_id?: string | null }).document_id ??
      null,
    documentUrl:
      (msg as { document_url?: string | null }).document_url ??
      (meta as { documentUrl?: string | null }).documentUrl ??
      (meta as { document_url?: string | null }).document_url ??
      null,
    pinIds,
    userReaction:
      (msg as { user_reaction?: string | null }).user_reaction ??
      (meta as { userReaction?: string | null }).userReaction ??
      (meta as { user_reaction?: string | null }).user_reaction ??
      null,
  };
};

const normalizeBackendMessage = (msg: BackendMessage): Message => {
  const senderRaw = (msg.sender || msg.role || "user").toLowerCase();
  const sender: Message["sender"] =
    senderRaw === "ai" || senderRaw === "assistant" ? "ai" : "user";
  const baseContent =
    msg.content ||
    msg.message ||
    (msg as { response?: string }).response ||
    (msg as { prompt?: string }).prompt ||
    "";
  const { visibleText, thinkingText } =
    sender === "ai"
      ? extractThinkingContent(baseContent)
      : { visibleText: baseContent, thinkingText: null };
  const metadata = extractMetadata(msg);
  const rawId =
    msg.id !== undefined && msg.id !== null
      ? msg.id
      : (msg as { message_id?: string | number | null }).message_id ?? null;
  const resolvedId =
    rawId !== null && rawId !== undefined
      ? String(rawId)
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: resolvedId,
    sender,
    content: visibleText,
    thinkingContent: thinkingText,
    metadata,
    chatMessageId:
      rawId !== null && rawId !== undefined ? String(rawId) : undefined,
    referencedMessageId:
      (msg as { referenced_message_id?: string | null })
        .referenced_message_id ?? null,
  };
};

const convertBackendEntryToMessages = (entry: BackendMessage): Message[] => {
  const hasPrompt = typeof entry.prompt === "string" && entry.prompt.length > 0;
  const hasResponse =
    typeof entry.response === "string" && entry.response.length > 0;

  if (!hasPrompt && !hasResponse) {
    return [normalizeBackendMessage(entry)];
  }

  const baseIdRaw =
    entry.id !== undefined && entry.id !== null
      ? entry.id
      : (entry as { message_id?: string | number | null }).message_id ??
        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const baseId = String(baseIdRaw);
  const messages: Message[] = [];
  const chatMessageId = baseId;
  const pinId =
    entry.pin && entry.pin.id !== undefined && entry.pin.id !== null
      ? String(entry.pin.id)
      : undefined;

  if (hasPrompt) {
    messages.push({
      id: `${baseId}-prompt`,
      sender: "user",
      content: entry.prompt as string,
      chatMessageId,
      metadata: extractMetadata(entry),
    });
  }

  if (hasResponse) {
    const sanitized = extractThinkingContent(entry.response as string);
    messages.push({
      id: `${baseId}-response`,
      sender: "ai",
      content:
        sanitized.visibleText ||
        (sanitized.thinkingText ? "" : (entry.response as string)),
      thinkingContent: sanitized.thinkingText,
      chatMessageId,
      pinId,
      metadata: extractMetadata(entry),
      referencedMessageId:
        (entry as { referenced_message_id?: string | null })
          .referenced_message_id ?? null,
    });
  }

  return messages;
};

const backendPinToLegacy = (
  pin: BackendPin,
  fallback?: Partial<PinType>
): PinType => {
  const createdAt = pin.created_at ? new Date(pin.created_at) : new Date();
  const resolvedFolder =
    (pin as { folderId?: string | null }).folderId ??
    (pin as { folder_id?: string | null }).folder_id ??
    fallback?.folderId ??
    undefined;
  const resolvedChatId =
    (pin as { chat?: string | null }).chat ??
    (pin as { sourceChatId?: string | null }).sourceChatId ??
    fallback?.sourceChatId ??
    fallback?.chatId ??
    "";
  const resolvedMessageId =
    (pin as { sourceMessageId?: string | null }).sourceMessageId ??
    fallback?.sourceMessageId ??
    fallback?.messageId ??
    null;
  const resolvedTitle =
    (pin as { title?: string | null }).title ??
    fallback?.title ??
    fallback?.text ??
    "Untitled Pin";
  const resolvedText =
    (pin as { formattedContent?: string | null }).formattedContent ??
    pin.content ??
    fallback?.formattedContent ??
    fallback?.text ??
    resolvedTitle;
  return {
    id: pin.id,
    text: resolvedTitle,
    title: resolvedTitle,
    tags: pin.tags ?? fallback?.tags ?? [],
    notes: fallback?.notes ?? "",
    chatId: resolvedChatId,
    time: createdAt,
    messageId: resolvedMessageId ?? undefined,
    folderId: resolvedFolder || undefined,
    folderName: (pin as { folderName?: string | null }).folderName ?? null,
    sourceChatId: resolvedChatId,
    sourceMessageId: resolvedMessageId ?? null,
    formattedContent:
      (pin as { formattedContent?: string | null }).formattedContent ?? null,
    comments:
      (pin as { comments?: string[] }).comments ?? fallback?.comments ?? [],
  };
};

const PINS_CACHE_KEY = "chat-pins-cache";

export default function AppLayout({ children }: AppLayoutProps) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [activeRightSidebarPanel, setActiveRightSidebarPanel] =
    useState<RightSidebarPanel | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [useFramework, setUseFramework] = useState(true);

  const [pins, setPins_] = useState<PinType[]>([]);
  const [pinsChatId, setPinsChatId] = useState<string | null>(null);
  const [chatBoards, setChatBoards_] = useState<ChatBoard[]>([]);
  const [activeChatId, setActiveChatId_] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistory>({});

  // Wrapper for setActiveChatId that moves the selected chat to the top
  const setActiveChatId = useCallback(
    (id: string | null | ((prev: string | null) => string | null)) => {
      setActiveChatId_((prevId) => {
        const nextId = typeof id === "function" ? id(prevId) : id;

        // If changing to a different chat, move it to the top
        if (nextId && nextId !== prevId) {
          setChatBoards_((prevBoards) => {
            const chatIndex = prevBoards.findIndex(
              (board) => board.id === nextId
            );
            if (chatIndex > 0) {
              const reordered = [...prevBoards];
              const [selectedChat] = reordered.splice(chatIndex, 1);
              return [selectedChat, ...reordered];
            }
            return prevBoards;
          });
        }

        return nextId;
      });
    },
    []
  );

  const [chatToDelete, setChatToDelete] = useState<ChatBoard | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [isDeletingChatBoard, setIsDeletingChatBoard] = useState(false);
  const [isRenamingChatBoard, setIsRenamingChatBoard] = useState(false);
  const [starUpdatingChatId, setStarUpdatingChatId] = useState<string | null>(
    null
  );

  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const isPersonasRoute =
    pathname?.startsWith("/personas") || pathname?.startsWith("/personaAdmin");
  const { user, csrfToken, setCsrfToken } = useAuth();
  const csrfTokenRef = useRef<string | null>(csrfToken);
  const { toast } = useToast();

  // Helper to save pins to localStorage
  const savePinsToCache = useCallback((chatId: string, pinsData: PinType[]) => {
    try {
      const cache = JSON.parse(localStorage.getItem(PINS_CACHE_KEY) || "{}");
      cache[chatId] = pinsData;
      localStorage.setItem(PINS_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error("Failed to save pins to cache", error);
    }
  }, []);

  // Helper to load pins from localStorage
  const loadPinsFromCache = useCallback((chatId: string): PinType[] => {
    try {
      const cache = JSON.parse(localStorage.getItem(PINS_CACHE_KEY) || "{}");
      const cachedPins = cache[chatId];
      if (Array.isArray(cachedPins)) {
        return cachedPins.map((pin) => ({
          ...pin,
          time: new Date(pin.time),
        }));
      }
    } catch (error) {
      console.error("Failed to load pins from cache", error);
    }
    return [];
  }, []);

  // Wrapper for setPins that also caches
  const setPins = useCallback(
    (updater: PinType[] | ((prev: PinType[]) => PinType[])) => {
      setPins_((prev) => {
        const newPins = typeof updater === "function" ? updater(prev) : updater;
        if (pinsChatId) {
          savePinsToCache(pinsChatId, newPins);
        }
        return newPins;
      });
    },
    [pinsChatId, savePinsToCache]
  );

  useEffect(() => {
    if (renamingChatId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingChatId]);

  useEffect(() => {
    csrfTokenRef.current = csrfToken;
  }, [csrfToken]);

  const handleDeleteClick = (board: ChatBoard) => {
    setChatToDelete(board);
  };

  const confirmDelete = async () => {
    if (!chatToDelete) return;
    const chatId = chatToDelete.id;
    setIsDeletingChatBoard(true);

    const removeChatLocally = (id: string) => {
      setChatHistory((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      setChatBoards_((prev) => {
        const nextBoards = prev.filter((board) => board.id !== id);
        if (activeChatId === id) {
          const removedIndex = prev.findIndex((board) => board.id === id);
          const fallback =
            nextBoards[removedIndex] ??
            nextBoards[removedIndex - 1] ??
            nextBoards[0] ??
            null;
          setActiveChatId(fallback ? fallback.id : null);
        }
        return nextBoards;
      });

      if (pinsChatId === chatId) {
        setPins_([]);
        setPinsChatId(null);
      }
    };

    try {
      if (chatId.startsWith("temp-")) {
        removeChatLocally(chatId);
        setChatToDelete(null);
        toast({
          title: "Chat deleted",
          description: "This chat board has been removed.",
        });
        return;
      }

      const response = await apiFetch(
        CHAT_DETAIL_ENDPOINT(chatId),
        { method: "DELETE" },
        csrfTokenRef.current
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete chat");
      }

      removeChatLocally(chatId);
      setChatToDelete(null);
      await loadChatBoards();
      toast({
        title: "Chat deleted",
        description: "This chat board has been removed.",
      });
    } catch (error) {
      console.error("Failed to delete chat board", error);
      toast({
        title: "Delete failed",
        description:
          error instanceof Error ? error.message : "Unable to delete chat.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingChatBoard(false);
    }
  };

  const resetRenameState = useCallback(() => {
    setRenamingChatId(null);
    setRenamingText("");
  }, []);

  const handleRenameCancel = useCallback(() => {
    resetRenameState();
    renameInputRef.current?.blur();
  }, [resetRenameState, renameInputRef]);

  const loadChatBoards = useCallback(async () => {
    if (!user) {
      console.log("[loadChatBoards] Skipped: No user logged in");
      return;
    }
    try {
      const { chats: backendChats, csrfToken: freshToken } =
        await fetchChatBoards(csrfTokenRef.current);
      if (freshToken && freshToken !== csrfTokenRef.current) {
        csrfTokenRef.current = freshToken;
        setCsrfToken(freshToken);
      }
      const normalized = backendChats.map(normalizeChatBoard);
      let combinedBoards: ChatBoard[] = normalized;
      setChatBoards_((prev) => {
        const tempBoards = prev.filter(
          (board) =>
            board.id.startsWith("temp-") &&
            !normalized.some((chat) => chat.id === board.id)
        );
        combinedBoards = [...tempBoards, ...normalized];
        console.log(
          "[loadChatBoards] Previous boards:",
          prev.length,
          "Backend chats:",
          normalized.length,
          "Temp boards:",
          tempBoards.length,
          "Combined:",
          combinedBoards.length
        );
        return combinedBoards;
      });
      setActiveChatId((prev) => {
        if (prev && combinedBoards.some((chat) => chat.id === prev)) {
          return prev;
        }
        return combinedBoards.length > 0 ? combinedBoards[0].id : null;
      });
    } catch (error) {
      console.error("Failed to load chats from backend", error);
    }
  }, [setCsrfToken, user]);

  useEffect(() => {
    loadChatBoards();
  }, [loadChatBoards]);

  const handleRenameConfirm = useCallback(async () => {
    if (!renamingChatId || isRenamingChatBoard) return;
    const targetId = renamingChatId;
    const nextName = renamingText.trim();
    if (!nextName) {
      toast({
        title: "Name required",
        description: "Enter a chat name before saving.",
        variant: "destructive",
      });
      return;
    }

    const targetBoard = chatBoards.find((board) => board.id === targetId);
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
      setChatBoards_((prev) =>
        prev.map((board) =>
          board.id === targetId ? { ...board, name: nextName } : board
        )
      );
      handleRenameCancel();
      toast({
        title: "Chat renamed",
        description: "Name updated successfully.",
      });
      return;
    }

    setIsRenamingChatBoard(true);
    setChatBoards_((prev) =>
      prev.map((board) =>
        board.id === targetId ? { ...board, name: nextName } : board
      )
    );

    try {
      const response = await apiFetch(
        CHAT_DETAIL_ENDPOINT(targetId),
        {
          method: "PATCH",
          body: JSON.stringify({ title: nextName, name: nextName }),
        },
        csrfTokenRef.current
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to rename chat");
      }

      await loadChatBoards();
      handleRenameCancel();
      toast({
        title: "Chat renamed",
        description: "Name updated successfully.",
      });
    } catch (error) {
      console.error("Failed to rename chat board", error);
      setChatBoards_((prev) =>
        prev.map((board) =>
          board.id === targetId ? { ...board, name: previousName } : board
        )
      );
      setRenamingText(previousName);
      toast({
        title: "Rename failed",
        description:
          error instanceof Error ? error.message : "Unable to rename chat.",
        variant: "destructive",
      });
    } finally {
      setIsRenamingChatBoard(false);
    }
  }, [
    chatBoards,
    handleRenameCancel,
    isRenamingChatBoard,
    loadChatBoards,
    renamingChatId,
    renamingText,
    resetRenameState,
    toast,
  ]);

  const handleToggleStar = useCallback(
    async (board: ChatBoard) => {
      const chatId = board.id;
      const nextValue = !board.isStarred;

      if (chatId.startsWith("temp-")) {
        setChatBoards_((prev) =>
          prev.map((item) =>
            item.id === chatId ? { ...item, isStarred: nextValue } : item
          )
        );
        toast({
          title: nextValue ? "Chat starred" : "Star removed",
          description: nextValue
            ? "Added to your favorites."
            : "Removed from favorites.",
        });
        return;
      }

      setStarUpdatingChatId(chatId);
      setChatBoards_((prev) =>
        prev.map((item) =>
          item.id === chatId ? { ...item, isStarred: nextValue } : item
        )
      );

      try {
        let response = await apiFetch(
          CHAT_STAR_ENDPOINT(chatId),
          {
            method: "PATCH",
            body: JSON.stringify({ starred: nextValue }),
          },
          csrfTokenRef.current
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to update star");
        }

        // Sync with backend confirmation in case it adjusts the value.
        try {
          const data = await response.json();
          const resolved =
            typeof (data as { starred?: unknown }).starred === "boolean"
              ? Boolean((data as { starred: boolean }).starred)
              : typeof (data as { is_starred?: unknown }).is_starred ===
                "boolean"
              ? Boolean((data as { is_starred: boolean }).is_starred)
              : nextValue;
          setChatBoards_((prev) =>
            prev.map((item) =>
              item.id === chatId ? { ...item, isStarred: resolved } : item
            )
          );
        } catch {
          // Best-effort; ignore JSON parse issues for non-JSON responses.
        }

        toast({
          title: nextValue ? "Chat starred" : "Star removed",
          description: nextValue
            ? "Added to your favorites."
            : "Removed from favorites.",
        });
      } catch (error) {
        console.error("Failed to toggle star", error);
        setChatBoards_((prev) =>
          prev.map((item) =>
            item.id === chatId ? { ...item, isStarred: !nextValue } : item
          )
        );
        toast({
          title: "Star update failed",
          description:
            error instanceof Error ? error.message : "Unable to update star.",
          variant: "destructive",
        });
      } finally {
        setStarUpdatingChatId(null);
      }
    },
    [toast]
  );

  const loadMessagesForChat = useCallback(async (chatId: string) => {
    try {
      const backendMessages = await fetchChatMessages(
        chatId,
        csrfTokenRef.current
      );
      const normalized = backendMessages.flatMap(convertBackendEntryToMessages);
      setChatHistory((prev) => ({ ...prev, [chatId]: normalized }));
    } catch (error) {
      console.error(`Failed to load messages for chat ${chatId}`, error);
    }
  }, []);

  const loadPinsForChat = useCallback(
    async (_chatId: string | null = null) => {
      const cacheKey = "all";
      const cachedPins = loadPinsFromCache(cacheKey);
      if (cachedPins.length > 0) {
        setPins_(cachedPins);
        setPinsChatId(cacheKey);
      }
      const cachedById = new Map(cachedPins.map((pin) => [pin.id, pin]));

      try {
        const backendPins = await fetchAllPins(csrfTokenRef.current);
        const normalized = backendPins.map((backendPin) =>
          backendPinToLegacy(backendPin, cachedById.get(backendPin.id))
        );
        setPins_(normalized);
        setPinsChatId(cacheKey);
        savePinsToCache(cacheKey, normalized);
        setChatBoards_((prev) =>
          prev.map((board) =>
            board.id === _chatId
              ? { ...board, pinCount: normalized.length }
              : board
          )
        );
      } catch (error) {
        console.error("Failed to load pins", error);
        if (cachedPins.length === 0) {
          setPins_([]);
          setPinsChatId(cacheKey);
        }
      }
    },
    [loadPinsFromCache, savePinsToCache]
  );

  useEffect(() => {
    if (!activeChatId) return;
    if (!user) return;
    if (chatHistory[activeChatId]) return;
    loadMessagesForChat(activeChatId);
  }, [activeChatId, chatHistory, loadMessagesForChat, user]);

  useEffect(() => {
    if (!pinsChatId) {
      loadPinsForChat(activeChatId ?? null);
    }
  }, [activeChatId, loadPinsForChat, pinsChatId]);

  const setMessagesForActiveChat = (
    messages: Message[] | ((prev: Message[]) => Message[]),
    chatIdOverride?: string
  ) => {
    const targetChatId = chatIdOverride ?? activeChatId;
    if (!targetChatId) return;
    setChatHistory((prev) => {
      const prevMessages = prev[targetChatId] || [];
      const nextMessages =
        typeof messages === "function" ? messages(prevMessages) : messages;
      return { ...prev, [targetChatId]: nextMessages };
    });
  };

  const handlePinMessage = useCallback(
    async (pinRequest: PinType) => {
      const chatId = pinRequest.chatId || activeChatId;
      const messageId = pinRequest.messageId || pinRequest.id;
      if (!chatId || !messageId) {
        console.warn("Missing chatId or messageId for pin action");
        return;
      }

      try {
        const backendPin = await createPin(
          chatId,
          messageId,
          csrfTokenRef.current,
          {
            folderId: pinRequest.folderId ?? null,
            tags: pinRequest.tags,
            comments: pinRequest.comments,
          }
        );
        const normalized = backendPinToLegacy(backendPin, pinRequest);
        // Always update pins state regardless of active chat since pins are loaded globally
        setPins((prev) => [
          normalized,
          ...prev.filter((p) => p.id !== normalized.id),
        ]);
        setChatBoards_((prevBoards) =>
          prevBoards.map((board) =>
            board.id === chatId
              ? { ...board, pinCount: (board.pinCount || 0) + 1 }
              : board
          )
        );
        // Open the right sidebar and show toast
        setActiveRightSidebarPanel("pinboard");
        toast({
          title: "Pinned!",
          description: "Response has been pinned to your pinboard.",
        });
      } catch (error) {
        console.error("Failed to pin message", error);
        throw error;
      }
    },
    [activeChatId, setPins, toast]
  );

  const handleUnpinMessage = useCallback(
    async (messageId: string) => {
      const pinToRemove = pins.find(
        (pin) => pin.messageId === messageId || pin.id === messageId
      );
      if (!pinToRemove) {
        return;
      }

      try {
        await deletePin(pinToRemove.id, csrfTokenRef.current);
        setPins((prevPins) =>
          prevPins.filter((pin) => pin.id !== pinToRemove.id)
        );
        setChatBoards_((prevBoards) =>
          prevBoards.map((board) =>
            board.id === pinToRemove.chatId
              ? {
                  ...board,
                  pinCount: Math.max(0, (board.pinCount || 1) - 1),
                }
              : board
          )
        );
      } catch (error) {
        console.error("Failed to unpin message", error);
        throw error;
      }
    },
    [pins, setPins]
  );

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
      const payload = {
        title: firstMessage.slice(0, 60) || "New Chat",
        firstMessage,
        model: selectedModel
          ? {
              modelId: selectedModel.modelId ?? selectedModel.id,
              companyName: selectedModel.companyName,
              modelName: selectedModel.modelName,
              version: selectedModel.version,
            }
          : null,
        useFramework: Boolean(useFramework),
        user,
        pinIds,
      };
      try {
        const {
          chat: created,
          csrfToken: freshToken,
          initialResponse,
          initialMessageId,
          initialMessageMetadata,
          message,
        } = await createChat(payload, csrfTokenRef.current);
        if (freshToken && freshToken !== csrfTokenRef.current) {
          csrfTokenRef.current = freshToken;
          setCsrfToken(freshToken);
        }
        const normalized = normalizeChatBoard(created);
        const tempMessages =
          isTempChat && currentActiveId
            ? chatHistory[currentActiveId] ?? []
            : [];
        setChatBoards_((prev) => {
          const filtered = prev.filter(
            (board) =>
              board.id !== normalized.id && board.id !== currentActiveId
          );
          return [normalized, ...filtered];
        });
        setActiveChatId(normalized.id);
        setChatHistory((prev) => {
          const next = {
            ...prev,
            [normalized.id]: prev[normalized.id] ?? tempMessages,
          };
          if (
            isTempChat &&
            currentActiveId &&
            currentActiveId !== normalized.id
          ) {
            delete next[currentActiveId];
          }
          return next;
        });
        // Load pins for the new chat (will be empty initially but won't clear existing display)
        loadPinsForChat(normalized.id);
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
        console.error("Failed to create chat on server", error);
        throw error;
      }
    },
    [activeChatId, chatHistory, loadPinsForChat, setCsrfToken, user]
  );

  const handleAddChat = () => {
    handleRenameCancel();

    // Check if there's already a temp chat
    const existingTemp = chatBoards.find((board) =>
      board.id.startsWith("temp-")
    );
    if (existingTemp) {
      setActiveChatId(existingTemp.id);
      setChatHistory((prev) =>
        prev[existingTemp.id] ? prev : { ...prev, [existingTemp.id]: [] }
      );
      router.push("/");
      return;
    }

    // Create new temp chat
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const placeholder: ChatBoard = {
      id: tempId,
      name: "New chat",
      time: "Just now",
      isStarred: false,
      pinCount: 0,
      metadata: { messageCount: 0, pinCount: 0 },
    };

    // Add new chat while preserving all existing chats
    setChatBoards_((prev) => {
      console.log(
        "[handleAddChat] Current boards:",
        prev.length,
        "Adding new temp chat:",
        tempId
      );
      return [placeholder, ...prev];
    });
    setChatHistory((prev) => ({ ...prev, [tempId]: [] }));
    setActiveChatId(tempId);
    router.push("/");
  };

  const isRightSidebarVisible =
    !isPersonasRoute && activeRightSidebarPanel !== null;

  const setIsRightSidebarVisible = (value: React.SetStateAction<boolean>) => {
    if (isPersonasRoute) {
      return;
    }
    setActiveRightSidebarPanel((prev) => {
      const current = prev !== null;
      const nextVisible = typeof value === "function" ? value(current) : value;
      if (nextVisible) {
        return prev ?? "pinboard";
      }
      return null;
    });
  };

  const handleRightSidebarSelect = (panel: RightSidebarPanel) => {
    if (isPersonasRoute) {
      return;
    }
    setActiveRightSidebarPanel((prev) => (prev === panel ? null : panel));
  };

  const contextValue: AppLayoutContextType = {
    chatBoards,
    setChatBoards: setChatBoards_,
    activeChatId,
    setActiveChatId,
    pins,
    onPinMessage: handlePinMessage,
    onUnpinMessage: handleUnpinMessage,
    handleAddChat,
    ensureChatOnServer,
    selectedModel,
    setSelectedModel,
    useFramework,
    setUseFramework,
  };

  const pageContentProps = {
    onPinMessage: handlePinMessage,
    onUnpinMessage: handleUnpinMessage,
    messages: activeChatId ? chatHistory[activeChatId] || [] : [],
    setMessages: setMessagesForActiveChat,
    selectedModel: selectedModel,
    setIsRightSidebarVisible,
    isRightSidebarVisible,
  };

  // Only pass chat-related props to chat pages, not persona pages
  const pageContent = isPersonasRoute
    ? children
    : React.cloneElement(children, {
        key: activeChatId ?? "no-chat",
        ...pageContentProps,
      });

  const sidebarProps = {
    isCollapsed: isLeftSidebarCollapsed,
    onToggle: () => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed),
    chatBoards: chatBoards,
    activeChatId: activeChatId,
    setActiveChatId: setActiveChatId,
    onAddChat: handleAddChat,
    renamingChatId: renamingChatId,
    setRenamingChatId: setRenamingChatId,
    renamingText: renamingText,
    setRenamingText: setRenamingText,
    renameInputRef: renameInputRef,
    handleDeleteClick: handleDeleteClick,
    onRenameConfirm: handleRenameConfirm,
    onRenameCancel: handleRenameCancel,
    isRenamingPending: isRenamingChatBoard,
    onToggleStar: handleToggleStar,
    starUpdatingChatId: starUpdatingChatId,
  };

  useEffect(() => {
    if (isPersonasRoute) {
      setActiveRightSidebarPanel(null);
    }
  }, [isPersonasRoute]);

  if (isMobile) {
    return (
      <AppLayoutContext.Provider value={contextValue}>
        <div className="chat-layout-mobile-shell--full">
          <div className="chat-layout-mobile-container">
            <Topbar
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
              useFramework={useFramework}
              onFrameworkChange={setUseFramework}
            >
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="chat-layout-mobile-sheet">
                  <LeftSidebar {...sidebarProps} isCollapsed={false} />
                </SheetContent>
              </Sheet>
            </Topbar>
            <main className="chat-layout-mobile-main">{pageContent}</main>
          </div>
        </div>
        <AlertDialog
          open={!!chatToDelete}
          onOpenChange={(open) => !open && setChatToDelete(null)}
        >
          <AlertDialogContent className="rounded-[25px] bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#171717] text-lg font-semibold">
                Delete Chat Board?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#6B7280] space-y-3">
                <p>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-[#171717]">
                    "{chatToDelete?.name}"
                  </span>
                  ?
                </p>
                <p className="text-sm">
                  This action cannot be undone. This will permanently delete
                  this chat board and all its messages.
                </p>
                {chatToDelete &&
                  (chatToDelete.isStarred ||
                    (chatToDelete.pinCount && chatToDelete.pinCount > 0)) && (
                    <div className="mt-3 space-y-2 rounded-lg bg-[#FEF3C7] border border-[#FDE047] p-3">
                      <p className="text-sm font-medium text-[#92400E]">
                        ⚠️ Warning:
                      </p>
                      <ul className="text-sm text-[#92400E] space-y-1 ml-4 list-disc">
                        {chatToDelete.isStarred && (
                          <li>
                            This chat is <strong>starred</strong>
                          </li>
                        )}
                        {chatToDelete.pinCount && chatToDelete.pinCount > 0 && (
                          <li>
                            This chat contains{" "}
                            <strong>
                              {chatToDelete.pinCount} pinned{" "}
                              {chatToDelete.pinCount === 1
                                ? "message"
                                : "messages"}
                            </strong>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel
                className="rounded-lg px-4 text-[#171717] hover:bg-[#f5f5f5] border-[#d4d4d4]"
                onClick={() => setChatToDelete(null)}
                disabled={isDeletingChatBoard}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-lg px-4 bg-red-600 text-white hover:bg-red-700"
                onClick={confirmDelete}
                disabled={isDeletingChatBoard}
              >
                {isDeletingChatBoard ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppLayoutContext.Provider>
    );
  }

  return (
    <AppLayoutContext.Provider value={contextValue}>
      <div className="chat-layout-shell--full">
        <LeftSidebar {...sidebarProps} />
        <div className="chat-layout-sidebar-area">
          <Topbar
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
            useFramework={useFramework}
            onFrameworkChange={setUseFramework}
          />
          <div className="chat-layout-main-wrapper">
            <div className="chat-layout-content-panel">
              <main className="chat-layout-main">
                <div className="chat-layout-window chat-layout-window--max960">
                  {pageContent}
                </div>
              </main>
            </div>
            {!isPersonasRoute && (
              <div className="hidden h-full lg:flex items-stretch">
                <RightSidebar
                  isOpen={isRightSidebarVisible}
                  activePanel={activeRightSidebarPanel}
                  onClose={() => setActiveRightSidebarPanel(null)}
                  pins={pins}
                  setPins={setPins}
                  chatBoards={chatBoards}
                  className="order1"
                />
                <RightSidebarCollapsed
                  activePanel={activeRightSidebarPanel}
                  onSelect={handleRightSidebarSelect}
                  className="order2"
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <AlertDialog
        open={!!chatToDelete}
        onOpenChange={(open) => !open && setChatToDelete(null)}
      >
        <AlertDialogContent className="rounded-[25px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              chat board.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[25px]"
              onClick={() => setChatToDelete(null)}
              disabled={isDeletingChatBoard}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[25px]"
              onClick={confirmDelete}
              disabled={isDeletingChatBoard}
            >
              {isDeletingChatBoard ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayoutContext.Provider>
  );
}
