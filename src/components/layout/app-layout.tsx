
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
import {
  createPin,
  deletePin,
  fetchPins,
  type BackendPin,
} from "@/lib/api/pins";
import { CHAT_DETAIL_ENDPOINT } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { extractThinkingContent } from "@/lib/thinking";

interface AppLayoutProps {
  children: React.ReactElement;
}

export type ChatBoard = {
  id: string;
  name: string;
  time: string;
  isStarred: boolean;
  pinCount: number;
};

type ChatHistory = Record<string, Message[]>;

interface EnsureChatOptions {
  firstMessage: string;
  selectedModel?: AIModel | null;
}

interface EnsureChatResult {
  chatId: string;
  initialResponse?: string | null;
  initialMessageId?: string | null;
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
}

export const AppLayoutContext = createContext<AppLayoutContextType | null>(null);

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

const normalizeChatBoard = (chat: BackendChat): ChatBoard => ({
  id: extractChatId(chat),
  name: chat.title || chat.name || `Chat ${chat.id ?? "New Chat"}`,
  time: formatRelativeTime(chat.updated_at || chat.created_at),
  isStarred: Boolean(chat.is_starred ?? chat.isStarred ?? false),
  pinCount: chat.pin_count ?? chat.pinCount ?? 0,
});

const normalizeBackendMessage = (msg: BackendMessage): Message => {
  const senderRaw = (msg.sender || msg.role || "user").toLowerCase();
  const sender: Message["sender"] =
    senderRaw === "ai" || senderRaw === "assistant" ? "ai" : "user";
  const baseContent = msg.content || msg.message || "";
  const { visibleText, thinkingText } =
    sender === "ai"
      ? extractThinkingContent(baseContent)
      : { visibleText: baseContent, thinkingText: null };
  return {
    id:
      msg.id !== undefined
        ? String(msg.id)
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender,
    content: visibleText,
    thinkingContent: thinkingText,
  };
};

const convertBackendEntryToMessages = (entry: BackendMessage): Message[] => {
  const hasPrompt = typeof entry.prompt === "string" && entry.prompt.length > 0;
  const hasResponse =
    typeof entry.response === "string" && entry.response.length > 0;

  if (!hasPrompt && !hasResponse) {
    return [normalizeBackendMessage(entry)];
  }

  const baseId =
    entry.id !== undefined && entry.id !== null
      ? String(entry.id)
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    });
  }

  return messages;
};

const backendPinToLegacy = (pin: BackendPin): PinType => {
  const createdAt = pin.created_at ? new Date(pin.created_at) : new Date();
  return {
    id: pin.id,
    text: pin.content,
    tags: [],
    notes: "",
    chatId: pin.chat,
    time: createdAt,
    messageId: pin.id, // Use pin ID as messageId since message field was removed
  };
};

const PINS_CACHE_KEY = 'chat-pins-cache';

export default function AppLayout({ children }: AppLayoutProps) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(true);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);

  const [pins, setPins_] = useState<PinType[]>([]);
  const [pinsChatId, setPinsChatId] = useState<string | null>(null);
  const [chatBoards, setChatBoards_] = useState<ChatBoard[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistory>({});

  const [chatToDelete, setChatToDelete] = useState<ChatBoard | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [isDeletingChatBoard, setIsDeletingChatBoard] = useState(false);

  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const { user, csrfToken, setCsrfToken } = useAuth();
  const csrfTokenRef = useRef<string | null>(csrfToken);
  const { toast } = useToast();

  // Helper to save pins to localStorage
  const savePinsToCache = useCallback((chatId: string, pinsData: PinType[]) => {
    try {
      const cache = JSON.parse(localStorage.getItem(PINS_CACHE_KEY) || '{}');
      cache[chatId] = pinsData;
      localStorage.setItem(PINS_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to save pins to cache', error);
    }
  }, []);

  // Helper to load pins from localStorage
  const loadPinsFromCache = useCallback((chatId: string): PinType[] => {
    try {
      const cache = JSON.parse(localStorage.getItem(PINS_CACHE_KEY) || '{}');
      const cachedPins = cache[chatId];
      if (Array.isArray(cachedPins)) {
        return cachedPins.map(pin => ({
          ...pin,
          time: new Date(pin.time)
        }));
      }
    } catch (error) {
      console.error('Failed to load pins from cache', error);
    }
    return [];
  }, []);

  // Wrapper for setPins that also caches
  const setPins = useCallback((updater: PinType[] | ((prev: PinType[]) => PinType[])) => {
    setPins_((prev) => {
      const newPins = typeof updater === 'function' ? updater(prev) : updater;
      if (pinsChatId) {
        savePinsToCache(pinsChatId, newPins);
      }
      return newPins;
    });
  }, [pinsChatId, savePinsToCache]);

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

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrfTokenRef.current) {
        headers["X-CSRFToken"] = csrfTokenRef.current;
      }

      const response = await fetch(CHAT_DETAIL_ENDPOINT(chatId), {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete chat");
      }

      setChatHistory((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });

      setChatBoards_((prev) => {
        const nextBoards = prev.filter((board) => board.id !== chatId);
        if (activeChatId === chatId) {
          const removedIndex = prev.findIndex((board) => board.id === chatId);
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

      setChatToDelete(null);
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

  // Redirect to login if not authenticated
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn && !pathname.startsWith('/auth')) {
        router.replace('/auth/login');
    }
  }, [pathname, router]);

  const loadChatBoards = useCallback(async () => {
    if (!user) return;
    try {
      const { chats: backendChats, csrfToken: freshToken } =
        await fetchChatBoards(csrfTokenRef.current);
      if (freshToken && freshToken !== csrfTokenRef.current) {
        csrfTokenRef.current = freshToken;
        setCsrfToken(freshToken);
      }
      const normalized = backendChats.map(normalizeChatBoard);
      setChatBoards_(normalized);
      setActiveChatId((prev) => {
        if (prev && normalized.some((chat) => chat.id === prev)) {
          return prev;
        }
        return normalized.length > 0 ? normalized[0].id : null;
      });
    } catch (error) {
      console.error("Failed to load chats from backend", error);
    }
  }, [setCsrfToken, user]);

  useEffect(() => {
    loadChatBoards();
  }, [loadChatBoards]);

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

  const loadPinsForChat = useCallback(async (chatId: string) => {
    // Load from cache first for immediate display
    const cachedPins = loadPinsFromCache(chatId);
    if (cachedPins.length > 0) {
      setPins_(cachedPins);
      setPinsChatId(chatId);
    }

    // Then fetch from server to sync
    try {
      const backendPins = await fetchPins(chatId, csrfTokenRef.current);
      const normalized = backendPins.map(backendPinToLegacy);
      setPins_(normalized);
      setPinsChatId(chatId);
      savePinsToCache(chatId, normalized);
      setChatBoards_((prev) =>
        prev.map((board) =>
          board.id === chatId ? { ...board, pinCount: normalized.length } : board
        )
      );
    } catch (error) {
      console.error(`Failed to load pins for chat ${chatId}`, error);
      // If fetch fails but we have cache, keep the cached pins
      if (cachedPins.length === 0) {
        setPins_([]);
        setPinsChatId(chatId);
      }
    }
  }, [loadPinsFromCache, savePinsToCache]);

  useEffect(() => {
    if (!activeChatId) return;
    if (chatHistory[activeChatId]) return;
    loadMessagesForChat(activeChatId);
  }, [activeChatId, chatHistory, loadMessagesForChat]);

  useEffect(() => {
    if (!activeChatId) {
      // Don't clear pins when no active chat - keep the last loaded pins visible
      return;
    }
    if (pinsChatId === activeChatId) {
      return;
    }
    loadPinsForChat(activeChatId);
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
      const content = pinRequest.text;
      if (!chatId || !content) {
        console.warn("Missing chatId or content for pin action");
        return;
      }

      try {
        const backendPin = await createPin(chatId, content, csrfTokenRef.current);
        const normalized = backendPinToLegacy(backendPin);
        if (chatId === activeChatId) {
          setPins((prev) => [normalized, ...prev.filter((p) => p.id !== normalized.id)]);
          setPinsChatId(chatId);
        }
        setChatBoards_((prevBoards) =>
          prevBoards.map((board) =>
            board.id === chatId
              ? { ...board, pinCount: (board.pinCount || 0) + 1 }
              : board
          )
        );
      } catch (error) {
        console.error("Failed to pin message", error);
        throw error;
      }
    },
    [activeChatId, setPins]
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
        setPins((prevPins) => prevPins.filter((pin) => pin.id !== pinToRemove.id));
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
    }: EnsureChatOptions): Promise<EnsureChatResult | null> => {
      if (activeChatId) {
        return { chatId: activeChatId, initialResponse: null };
      }
      const payload = {
        title: firstMessage.slice(0, 60) || "New Chat",
        firstMessage,
        model: selectedModel
          ? {
              companyName: selectedModel.companyName,
              modelName: selectedModel.modelName,
              version: selectedModel.version,
            }
          : null,
        user,
      };
      try {
        const {
          chat: created,
          csrfToken: freshToken,
          initialResponse,
          initialMessageId,
        } = await createChat(payload, csrfTokenRef.current);
        if (freshToken && freshToken !== csrfTokenRef.current) {
          csrfTokenRef.current = freshToken;
          setCsrfToken(freshToken);
        }
        const normalized = normalizeChatBoard(created);
        setChatBoards_((prev) => [normalized, ...prev]);
        setActiveChatId(normalized.id);
        setChatHistory((prev) =>
          prev[normalized.id] ? prev : { ...prev, [normalized.id]: [] }
        );
        // Load pins for the new chat (will be empty initially but won't clear existing display)
        loadPinsForChat(normalized.id);
        return {
          chatId: normalized.id,
          initialResponse: initialResponse ?? null,
          initialMessageId: initialMessageId ?? null,
        };
      } catch (error) {
        console.error("Failed to create chat on server", error);
        throw error;
      }
    },
    [activeChatId, loadPinsForChat, setCsrfToken, user]
  );

  const handleAddChat = () => {
    setActiveChatId(null);
    router.push('/');
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
  };

  const pageContentProps = {
    onPinMessage: handlePinMessage,
    onUnpinMessage: handleUnpinMessage,
    messages: activeChatId ? chatHistory[activeChatId] || [] : [],
    setMessages: setMessagesForActiveChat,
    selectedModel: selectedModel,
    setIsRightSidebarVisible: setIsRightSidebarCollapsed,
    isRightSidebarVisible: !isRightSidebarCollapsed,
  };
  
  const pageContent = React.cloneElement(children, pageContentProps);

  const sidebarProps = {
    isCollapsed: isLeftSidebarCollapsed,
    onToggle: () => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed),
    chatBoards: chatBoards,
    setChatBoards: setChatBoards_,
    activeChatId: activeChatId,
    setActiveChatId: setActiveChatId,
    onAddChat: handleAddChat,
    renamingChatId: renamingChatId,
    setRenamingChatId: setRenamingChatId,
    renamingText: renamingText,
    setRenamingText: setRenamingText,
    renameInputRef: renameInputRef,
    handleDeleteClick: handleDeleteClick,
  };

  if (isMobile) {
    return (
        <AppLayoutContext.Provider value={contextValue}>
            <div className="flex flex-col h-screen bg-background w-full">
                <Topbar
                  selectedModel={selectedModel}
                  onModelSelect={setSelectedModel}
                >
                    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 flex gap-0 w-[80vw]">
                             <LeftSidebar {...sidebarProps} isCollapsed={false} />
                        </SheetContent>
                    </Sheet>
                </Topbar>
                 <main className="flex-1 flex flex-col min-w-0">
                    {pageContent}
                </main>
            </div>
            <AlertDialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
              <AlertDialogContent className="rounded-[25px]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this chat board.
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
    )
  }

  return (
    <AppLayoutContext.Provider value={contextValue}>
      <div className="flex flex-col h-screen bg-background w-full">
        <Topbar
          selectedModel={selectedModel}
          onModelSelect={setSelectedModel}
        />
        <div className="flex flex-1 overflow-hidden">
          <LeftSidebar {...sidebarProps} />
          <main className="flex-1 flex flex-col min-w-0">
              {pageContent}
          </main>
          <RightSidebar
              isCollapsed={isRightSidebarCollapsed}
              onToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
              pins={pins}
              setPins={setPins}
              chatBoards={chatBoards}
          />
        </div>
      </div>
      <AlertDialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
        <AlertDialogContent className="rounded-[25px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this chat board.
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
