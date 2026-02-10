"use client";

import { useState, useRef, useEffect, useContext, useMemo } from "react";
import chatStyles from "./chat-interface.module.css";
import { Button } from "@/components/ui/button";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Send,
  Trash2,
  X,
  Loader2,
  Plus,
  Mic,
  Square,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  UserPlus,
  Paperclip,
  ScanText,
  Reply,
  Globe,
} from "lucide-react";
import { ChatMessage, type Message } from "./chat-message";
import { InitialPrompts } from "./initial-prompts";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { ReferenceBanner } from "./reference-banner";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PinType } from "../layout/right-sidebar";
import type { AIModel } from "@/types/ai-model";
import { toast } from "@/lib/toast-helper";
import { AppLayoutContext } from "../layout/app-layout";
import { cn } from "@/lib/utils";
import {
  renderInlineMarkdown,
  formatPinTitle,
  stripMarkdown,
} from "@/lib/markdown-utils";
import { fetchPersonas as fetchPersonasApi } from "@/lib/api/personas";
import { API_BASE_URL } from "@/lib/config";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
import { useTokenUsage } from "@/context/token-context";
import {
  CHAT_COMPLETION_ENDPOINT,
  CHATS_ENDPOINT,
  CHAT_TURN_ENDPOINT,
  PERSONA_TEST_ENDPOINT,
  CHAT_DETAIL_ENDPOINT,
  DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";
import { extractThinkingContent } from "@/lib/thinking";
import { getModelIcon } from "@/lib/model-icons";
import { uploadDocument } from "@/lib/api/documents";
import Image from "next/image";

interface ChatInterfaceProps {
  onPinMessage?: (pin: PinType) => Promise<void> | void;
  onUnpinMessage?: (messageId: string) => Promise<void> | void;
  messages?: Message[];
  setMessages?: (
    messages: Message[] | ((prev: Message[]) => Message[]),
    chatIdOverride?: string,
  ) => void;
  selectedModel?: AIModel | null;
  hidePersonaButton?: boolean;
  customEmptyState?: React.ReactNode;
  disableInput?: boolean;
  hideAttachButton?: boolean;
  personaTestConfig?: {
    personaId?: string;
    prompt?: string;
    modelId?: number | string | null;
  };
}

type MessageAvatar = Pick<Message, "avatarUrl" | "avatarHint">;

// Interface for a mentioned pin
interface MentionedPin {
  id: string;
  label: string;
}

export function ChatInterface({
  onPinMessage,
  onUnpinMessage,
  messages = [],
  setMessages = () => {},
  selectedModel = null,
  hidePersonaButton = false,
  customEmptyState,
  disableInput = false,
  hideAttachButton = false,
  personaTestConfig,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  // For pin mention dropdown keyboard navigation
  const [highlightedPinIndex, setHighlightedPinIndex] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [referencedMessage, setReferencedMessage] = useState<Message | null>(
    null,
  );
  const [mentionedPins, setMentionedPins] = useState<MentionedPin[]>([]);
  const [showPinDropdown, setShowPinDropdown] = useState(false);
  const [pinSearchQuery, setPinSearchQuery] = useState("");
  const [attachments, setAttachments] = useState<
    Array<{
      id: string;
      type: "pdf" | "image";
      name: string;
      url: string;
      file: File;
      isUploading?: boolean;
      uploadProgress?: number;
    }>
  >([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showLeftScrollButton, setShowLeftScrollButton] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);
  const [highlightedPersonaIndex, setHighlightedPersonaIndex] = useState(0);
  const [selectedPersona, setSelectedPersona] = useState<any>(null);
  const [activePersonas, setActivePersonas] = useState<any[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const personaDropdownRef = useRef<HTMLDivElement>(null);
  const PIN_INSERT_EVENT = "pin-insert-to-chat";

  // Close attach menu when clicking outside
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
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAttachMenu]);

  // Close persona dropdown when clicking outside
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
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPersonaDropdown]);

  // Reset highlighted persona index when dropdown opens
  useEffect(() => {
    if (showPersonaDropdown && activePersonas.length > 0) {
      setHighlightedPersonaIndex(-1); // -1 means no highlight by default
      // Auto-focus dropdown for keyboard navigation
      if (personaDropdownRef.current) {
        const dropdown = personaDropdownRef.current.querySelector(
          '[role="listbox"]',
        ) as HTMLElement;
        if (dropdown) {
          dropdown.focus();
        }
      }
    }
  }, [showPersonaDropdown, activePersonas.length]);

  useEffect(() => {
    const handlePinInsert = (event: Event) => {
      const custom = event as CustomEvent<{ text?: string }>;
      const text = custom.detail?.text;
      if (!text) return;
      // Strip any remaining markdown symbols for clean insertion
      const cleanText = stripMarkdown(text);
      setInput((prev) => (prev ? `${prev}\n${cleanText}` : cleanText));
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener(
        PIN_INSERT_EVENT,
        handlePinInsert as EventListener,
      );
      return () => {
        window.removeEventListener(
          PIN_INSERT_EVENT,
          handlePinInsert as EventListener,
        );
      };
    }
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pinDropdownScrollRef = useRef<HTMLDivElement>(null);
  const pinItemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const attachmentScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userAvatar = PlaceHolderImages.find((p) => p.id === "user-avatar");
  const defaultAiAvatar = PlaceHolderImages.find((p) => p.id === "ai-avatar");
  const qwenAvatarUrl = "/Qwen.svg";
  const resolveModelAvatar = (
    modelOverride?: AIModel | null,
  ): MessageAvatar => {
    if (modelOverride) {
      const hintParts = [
        modelOverride.modelName,
        modelOverride.companyName,
      ].filter(Boolean);
      return {
        avatarUrl: getModelIcon(
          modelOverride.companyName,
          modelOverride.modelName,
        ),
        avatarHint: hintParts.join(" ").trim(),
      };
    }
    return {
      avatarUrl: defaultAiAvatar?.imageUrl ?? qwenAvatarUrl,
      avatarHint: defaultAiAvatar?.imageHint ?? "AI model",
    };
  };

  const resolveAvatarFromMetadata = (
    message: Message,
  ): MessageAvatar | null => {
    if (message.sender !== "ai") return null;
    const provider = message.metadata?.providerName || null;
    const modelName = message.metadata?.modelName || null;
    if (!provider && !modelName) return null;
    const hintParts = [modelName, provider].filter(Boolean);
    return {
      avatarUrl: getModelIcon(provider, modelName),
      avatarHint: hintParts.join(" ").trim() || undefined,
    };
  };
  const isMobile = useIsMobile();
  // Prevent hydration mismatch: don't render until isMobile is known
  if (typeof isMobile === "undefined") {
    return null;
  }
  const [isResponding, setIsResponding] = useState(false);
  const layoutContext = useContext(AppLayoutContext);
  const displayMessages = messages;
  const { user, csrfToken } = useAuth();
  const { usagePercent, isLoading: isTokenUsageLoading } = useTokenUsage();

  const handleReact = (message: Message, reaction: string | null) => {
    if (message.sender !== "ai") return;

    const chatId = layoutContext?.activeChatId ?? undefined;
    const current = message.metadata?.userReaction || null;
    const nextReaction =
      reaction === null || current === reaction ? null : reaction;

    setMessages(
      (prev = []) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                metadata: {
                  ...m.metadata,
                  userReaction: nextReaction,
                },
              }
            : m,
        ),
      chatId,
    );

    if (nextReaction === "like") {
      toast.success("Message liked");
      return;
    }

    if (nextReaction === "dislike") {
      toast.success("Message disliked");
      return;
    }

    toast.info("Reaction removed");
  };
  const pinsById = useMemo(() => {
    const entries = (layoutContext?.pins || []).map((p) => [p.id, p]);
    return new Map<string, PinType>(entries as [string, PinType][]);
  }, [layoutContext?.pins]);
  const getCsrfToken = () => {
    if (csrfToken) return csrfToken;
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [regenerationState, setRegenerationState] = useState<{
    aiMessage: Message;
    userMessage: Message;
  } | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");
  const [isRegeneratingResponse, setIsRegeneratingResponse] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [isChatDeleteDialogOpen, setIsChatDeleteDialogOpen] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSourceUrl, setUploadSourceUrl] = useState("");
  const composerPlaceholder =
    selectedModel || layoutContext?.useFramework
      ? "Let's Play..."
      : "Choose a model or enable framework to start chatting";
  const messageBufferRef = useRef<Message[]>([]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // max height
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  // Fetch active personas
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const backendPersonas = await fetchPersonasApi(undefined, csrfToken);
        // Transform backend personas to match the dropdown format
        // Status mapping: "test" → active, "completed" → paused (but we only want active)
        const activeOnly = backendPersonas
          .filter((bp) => bp.status === "test") // Only show "test" personas as active
          .map((bp) => ({
            id: bp.id,
            name: bp.name,
            avatar: bp.imageUrl
              ? bp.imageUrl.startsWith("http") ||
                bp.imageUrl.startsWith("data:") ||
                bp.imageUrl.startsWith("blob:")
                ? bp.imageUrl
                : `${API_BASE_URL}${bp.imageUrl.startsWith("/") ? "" : "/"}${bp.imageUrl}`
              : null,
            prompt: bp.prompt,
            modelId: bp.modelId,
            status: "active",
          }));
        setActivePersonas(activeOnly);
      } catch (error) {
        console.error("Failed to fetch personas:", error);
      }
    };
    loadPersonas();
  }, [csrfToken]);

  // Clear reference, mentions, and attachments when switching chats
  useEffect(() => {
    setReferencedMessage(null);
    setMentionedPins([]);
    setShowPinDropdown(false);
    setPinSearchQuery("");
    // Cleanup attachment URLs and clear attachments
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.url));
      return [];
    });
  }, [layoutContext?.activeChatId]);

  // Check if attachment area is scrollable and show carets accordingly
  useEffect(() => {
    const checkScrollability = () => {
      if (attachmentScrollRef.current) {
        const el = attachmentScrollRef.current;
        const isScrollable = el.scrollWidth > el.clientWidth;
        setShowScrollButton(
          isScrollable && el.scrollLeft < el.scrollWidth - el.clientWidth - 10,
        );
        setShowLeftScrollButton(el.scrollLeft > 10);
      }
    };

    // Check immediately and after a short delay to ensure layout is complete
    checkScrollability();
    const timer = setTimeout(checkScrollability, 100);

    return () => clearTimeout(timer);
  }, [attachments]);

  // Get available pins
  const availablePins = layoutContext?.pins || [];

  // Filter pins based on search query
  const filteredPins = useMemo(() => {
    if (!pinSearchQuery.trim()) {
      return availablePins;
    }

    const query = pinSearchQuery.toLowerCase();
    return availablePins.filter((pin) => {
      // Match against pin text content
      const textMatch = stripMarkdown(pin.text).toLowerCase().includes(query);
      
      // Match against pin ID
      const idMatch = pin.id.toLowerCase().includes(query);
      
      // Match against tags if available
      const tagsMatch = pin.tags?.some((tag) => 
        tag.toLowerCase().includes(query)
      ) ?? false;
      
      return textMatch || idMatch || tagsMatch;
    });
  }, [availablePins, pinSearchQuery]);

  // Helper function to highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return text;
    
    const before = text.slice(0, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);
    
    return (
      <>
        {before}
        <span className="bg-yellow-100 font-medium">{match}</span>
        {after}
      </>
    );
  };

  // Light aesthetic color palette for pin separators @ highlighted pin rows
  const lightColorPalette = [
    "#C7E0F4", // Soft Sky Blue
    "#BEE7E8", // Muted Aqua
    "#BFDCE5", // Calm Teal
    "#C9DDF2", // Dusty Blue
    "#CFE6D8", // Muted Mint
    "#D6E8C3", // Soft Olive
    "#C4E1C1", // Gentle Green
    "#E1C7E8", // Dusty Lavender
    "#EBC2D9", // Muted Blush
    "#D8C6F0", // Soft Periwinkle
    "#F3E6B3", // Warm Butter
    "#F6DDBA", // Soft Apricot
    "#EFD1B8", // Muted Peach
    "#E1E5EA", // Cool Gray Mist
    "#E8DED6", // Warm Stone
    "#DDE3E8", // Soft Slate,
    "#A9D1F0", //Soft Ocean Blue
  ];

  // Get consistent color for a pin based on its ID
  const getPinSeparatorColor = (pinId: string) => {
    // Simple hash function to get a consistent index from the pin ID
    let hash = 0;
    for (let i = 0; i < pinId.length; i++) {
      hash = pinId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % lightColorPalette.length;
    return lightColorPalette[index];
  };

  // Reset highlighted index when dropdown opens or filtered pins change
  useEffect(() => {
    if (showPinDropdown && filteredPins.length > 0) {
      setHighlightedPinIndex(0);
    }
  }, [showPinDropdown, filteredPins.length]);

  // Auto-scroll highlighted pin into view when navigating with keyboard
  useEffect(() => {
    if (showPinDropdown && highlightedPinIndex >= 0) {
      const highlightedElement = pinItemRefs.current.get(highlightedPinIndex);
      if (highlightedElement && pinDropdownScrollRef.current) {
        highlightedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [highlightedPinIndex, showPinDropdown]);

  // Close dropdown when clicking outside
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

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport && isScrolledToBottom) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isScrolledToBottom]);

  // Show scroll-to-bottom button when not at bottom
  const handleScrollToBottom = () => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  };

  const fetchAiResponse = async (
    userMessage: string,
    loadingMessageId: string,
    chatId: string | null,
    userMessageId: string | undefined,
    modelForRequest: AIModel | null,
    avatarForRequest: MessageAvatar,
    referencedMessageId?: string | null,
    regenerateMessageId?: string | null,
    userMessageBackendId?: string | null,
    pinIds?: string[],
    personaChatHistory?: Array<{ role: "user" | "assistant"; content: string }>,
    replyToMessageId?: string | null,
    files?: File[],
  ) => {
    try {
      if (!modelForRequest) {
        console.warn("No model selected  backend may need to use a default.");
      }

      const token = getCsrfToken();

      const isPersonaTest = Boolean(personaTestConfig);
      const isExistingChat = Boolean(
        !isPersonaTest && chatId && !chatId.startsWith("temp-"),
      );
      const endpoint = isPersonaTest
        ? PERSONA_TEST_ENDPOINT
        : isExistingChat
          ? CHAT_TURN_ENDPOINT
          : CHATS_ENDPOINT;

      const modelId =
        modelForRequest?.modelId ??
        modelForRequest?.id ??
        personaTestConfig?.modelId ??
        null;

      // Build request body - use FormData when file is present, JSON otherwise
      let body: FormData | string;
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
      };

      if (files && files.length > 0 && !isPersonaTest) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append("message", userMessage);
        if (modelId !== null && modelId !== undefined) {
          formData.append("modelId", String(modelId));
        }
        formData.append(
          "useFramework",
          String(layoutContext?.useFramework ?? false),
        );
        if (user) {
          formData.append(
            "user",
            JSON.stringify({
              id: user.id ?? null,
              email: user.email ?? null,
              name: user.name ?? null,
            }),
          );
        }
        if (isExistingChat && chatId) {
          formData.append("chatId", chatId);
        }
        if (referencedMessageId) {
          formData.append("referencedMessageId", referencedMessageId);
        }
        if (regenerateMessageId) {
          formData.append("regenerateMessageId", regenerateMessageId);
        }
        if (userMessageBackendId) {
          formData.append("userMessageId", userMessageBackendId);
        }
        if (pinIds && pinIds.length > 0) {
          formData.append("pinIds", JSON.stringify(pinIds));
        }
        // Append all files
        files.forEach((file) => {
          formData.append("files", file);
        });
        body = formData;
        // Don't set Content-Type header - browser sets it with boundary for FormData
      } else {
        // Use JSON when no file
        const payload: Record<string, unknown> = {
          message: userMessage,
          modelId,
          useFramework: layoutContext?.useFramework ?? false,
          user: user
            ? {
                id: user.id ?? null,
                email: user.email ?? null,
                name: user.name ?? null,
              }
            : null,
        };

        if (isExistingChat && chatId) {
          payload.chatId = chatId;
        }
        if (isPersonaTest && personaTestConfig?.personaId) {
          payload.personaId = personaTestConfig.personaId;
        }
        if (isPersonaTest && personaTestConfig?.prompt) {
          payload.prompt = personaTestConfig.prompt;
        }
        if (isPersonaTest && personaChatHistory) {
          payload.chatHistory = personaChatHistory;
        }
        if (referencedMessageId) {
          payload.referencedMessageId = referencedMessageId;
        }
        if (regenerateMessageId) {
          payload.regenerateMessageId = regenerateMessageId;
        }
        if (userMessageBackendId) {
          payload.userMessageId = userMessageBackendId;
        }
        if (pinIds && pinIds.length > 0) {
          payload.pinIds = pinIds;
        }

        body = JSON.stringify(payload);
        headers["Content-Type"] = "application/json";
      }

      if (token) {
        headers["X-CSRFToken"] = token;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        credentials: "include",
        body,
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(errorText || "API request failed");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let assistantReasoning = "";
      let streamMetadata: Record<string, unknown> | null = null;
      let streamFinished = false;
      let currentChatId = chatId;

      const mergeReasoningContent = (
        ...parts: Array<string | null | undefined>
      ): string | null => {
        const uniqueParts: string[] = [];
        for (const part of parts) {
          const normalized = typeof part === "string" ? part.trim() : "";
          if (!normalized || uniqueParts.includes(normalized)) continue;
          uniqueParts.push(normalized);
        }
        return uniqueParts.length > 0 ? uniqueParts.join("\n\n") : null;
      };

      const updateAiMessage = (fields: Partial<Message>) => {
        setMessages((prev = []) => {
          const next = prev.map((msg) =>
            msg.id === loadingMessageId ? { ...msg, ...fields } : msg,
          );
          messageBufferRef.current = next;
          return next;
        }, currentChatId ?? undefined);
      };

      const reader = response.body.getReader();
      const processChunk = (value: Uint8Array) => {
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const eventChunk of events) {
          const lines = eventChunk.split("\n");
          let eventName = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataStr += line.slice(5).trim();
            }
          }
          if (!dataStr) continue;
          let parsed: any;
          try {
            parsed = JSON.parse(dataStr);
          } catch (err) {
            console.warn("Failed to parse SSE data", err, dataStr);
            continue;
          }

          const payloadType =
            typeof parsed?.type === "string" ? parsed.type : "";

          if (eventName === "reasoning" || payloadType === "reasoning") {
            const reasoningDelta =
              typeof parsed.content === "string"
                ? parsed.content
                : typeof parsed.reasoning_content === "string"
                  ? parsed.reasoning_content
                  : typeof parsed.delta === "string"
                    ? parsed.delta
                    : "";
            if (reasoningDelta) {
              assistantReasoning += reasoningDelta;
              const sanitized = extractThinkingContent(assistantContent);
              updateAiMessage({
                content: sanitized.visibleText || "",
                thinkingContent: mergeReasoningContent(
                  assistantReasoning,
                  sanitized.thinkingText,
                ),
              });
            }
            continue;
          }

          if (eventName === "metadata") {
            streamMetadata = parsed;
            if (
              !isPersonaTest &&
              parsed.chat_id &&
              layoutContext?.setActiveChatId
            ) {
              const resolved = String(parsed.chat_id);
              currentChatId = resolved;
              layoutContext.setActiveChatId(resolved);
              // Re-sync buffered messages to the resolved chat id
              if (messageBufferRef.current.length > 0) {
                setMessages(messageBufferRef.current, resolved);
              }
            }

            // Update chat title if provided by backend (works for both new and existing chats)
            const chatTitle = parsed.title || parsed.chat_title;
            if (
              !isPersonaTest &&
              chatTitle &&
              currentChatId &&
              layoutContext?.setChatBoards
            ) {
              layoutContext.setChatBoards((prev) =>
                prev.map((board) =>
                  board.id === currentChatId
                    ? { ...board, name: String(chatTitle) }
                    : board,
                ),
              );
            }
            continue;
          }

          if (eventName === "chunk") {
            const delta =
              typeof parsed.delta === "string"
                ? parsed.delta
                : typeof parsed.content === "string" &&
                    (payloadType === "content" || payloadType === "text")
                  ? parsed.content
                  : "";
            assistantContent += delta;
            const sanitized = extractThinkingContent(assistantContent);
            updateAiMessage({
              content: sanitized.visibleText || "",
              thinkingContent: mergeReasoningContent(
                assistantReasoning,
                sanitized.thinkingText,
              ),
              // Flip off loading state once the first chunk arrives so UI shows streaming text.
              isLoading: false,
            });
            continue;
          }

          if (eventName === "image") {
            const imageUrl = typeof parsed.url === "string" ? parsed.url : "";
            const imageAlt = typeof parsed.alt === "string" ? parsed.alt : undefined;
            if (imageUrl) {
              updateAiMessage({
                imageUrl,
                imageAlt,
              });
            }
            continue;
          }

          if (eventName === "done") {
            const messageText =
              typeof parsed.response === "string"
                ? parsed.response
                : assistantContent;
            const doneReasoning =
              typeof parsed.reasoning === "string"
                ? parsed.reasoning
                : typeof parsed.reasoning_content === "string"
                  ? parsed.reasoning_content
                  : typeof parsed.thinking === "string"
                    ? parsed.thinking
                    : "";
            if (doneReasoning) {
              if (!assistantReasoning) {
                assistantReasoning = doneReasoning;
              } else if (doneReasoning.includes(assistantReasoning)) {
                assistantReasoning = doneReasoning;
              } else if (!assistantReasoning.includes(doneReasoning)) {
                assistantReasoning = `${assistantReasoning}\n\n${doneReasoning}`;
              }
            }
            const messageMeta =
              parsed.metadata && typeof parsed.metadata === "object"
                ? parsed.metadata
                : null;
            const resolvedMessageId =
              parsed.message_id ?? parsed.messageId ?? null;

            const metadata: Message["metadata"] | undefined = messageMeta
              ? {
                  modelName:
                    (messageMeta as { modelName?: string }).modelName ??
                    (messageMeta as { model_name?: string }).model_name,
                  providerName:
                    (messageMeta as { providerName?: string }).providerName ??
                    (messageMeta as { provider_name?: string }).provider_name,
                  inputTokens:
                    (messageMeta as { inputTokens?: number }).inputTokens ??
                    (messageMeta as { input_tokens?: number }).input_tokens,
                  outputTokens:
                    (messageMeta as { outputTokens?: number }).outputTokens ??
                    (messageMeta as { output_tokens?: number }).output_tokens,
                  createdAt:
                    (messageMeta as { createdAt?: string }).createdAt ??
                    (messageMeta as { created_at?: string }).created_at,
                  llmModelId:
                    (messageMeta as { llmModelId?: string | number | null })
                      .llmModelId ??
                    (messageMeta as { llm_model_id?: string | number | null })
                      .llm_model_id ??
                    null,
                  pinIds: Array.isArray(
                    (messageMeta as { pinIds?: unknown[] }).pinIds,
                  )
                    ? (
                        (messageMeta as { pinIds: unknown[] })
                          .pinIds as unknown[]
                      ).map(String)
                    : Array.isArray(
                          (messageMeta as { pin_ids?: unknown[] }).pin_ids,
                        )
                      ? (
                          (messageMeta as { pin_ids: unknown[] })
                            .pin_ids as unknown[]
                        ).map(String)
                      : undefined,
                  userReaction:
                    (messageMeta as { userReaction?: string | null })
                      .userReaction ??
                    (messageMeta as { user_reaction?: string | null })
                      .user_reaction ??
                    null,
                  documentId:
                    (messageMeta as { documentId?: string | null })
                      .documentId ??
                    (messageMeta as { document_id?: string | null })
                      .document_id ??
                    null,
                  documentUrl:
                    (messageMeta as { documentUrl?: string | null })
                      .documentUrl ??
                    (messageMeta as { document_url?: string | null })
                      .document_url ??
                    null,
                }
              : undefined;

            const sanitized = extractThinkingContent(
              messageText || assistantContent || "API didn't respond",
            );
            const mergedThinkingContent = mergeReasoningContent(
              assistantReasoning,
              sanitized.thinkingText,
            );

            // Extract image data from done event if present
            const doneImageUrl =
              Array.isArray(parsed.images) && parsed.images.length > 0
                ? parsed.images[0]?.url
                : undefined;
            const doneImageAlt =
              Array.isArray(parsed.images) && parsed.images.length > 0
                ? parsed.images[0]?.alt
                : undefined;

            updateAiMessage({
              content:
                sanitized.visibleText ||
                (mergedThinkingContent ? "" : "API didn't respond"),
              thinkingContent: mergedThinkingContent,
              chatMessageId:
                resolvedMessageId !== null && resolvedMessageId !== undefined
                  ? String(resolvedMessageId)
                  : undefined,
              metadata,
              isLoading: false,
              ...(doneImageUrl && { imageUrl: doneImageUrl }),
              ...(doneImageAlt && { imageAlt: doneImageAlt }),
            });

            if (
              !isPersonaTest &&
              parsed.chat_id &&
              layoutContext?.setActiveChatId
            ) {
              const resolved = String(parsed.chat_id);
              currentChatId = resolved;
              layoutContext.setActiveChatId(resolved);
              if (messageBufferRef.current.length > 0) {
                setMessages(messageBufferRef.current, resolved);
              }
            }

            // Update chat title if provided in done event (works for both new and existing chats)
            const doneTitle = parsed.title || parsed.chat_title;
            if (
              !isPersonaTest &&
              doneTitle &&
              currentChatId &&
              layoutContext?.setChatBoards
            ) {
              layoutContext.setChatBoards((prev) =>
                prev.map((board) =>
                  board.id === currentChatId
                    ? { ...board, name: String(doneTitle) }
                    : board,
                ),
              );
            }

            // Move chat to top when message is successfully sent
            if (
              !isPersonaTest &&
              currentChatId &&
              layoutContext?.moveChatToTop
            ) {
              layoutContext.moveChatToTop(currentChatId);
            }

            setLastMessageId(loadingMessageId);
            setIsResponding(false);
            streamFinished = true;
          }

          if (eventName === "error") {
            const errorMessage =
              typeof parsed.error === "string"
                ? parsed.error
                : "Unexpected error from model";
            updateAiMessage({
              content: errorMessage,
              thinkingContent: null,
              isLoading: false,
            });
            setIsResponding(false);
            streamFinished = true;
          }
        }
      };

      // Read the stream
      while (true) {
        const { value, done } = await reader.read();
        if (done || streamFinished) break;
        if (value) processChunk(value);
      }

      // If stream ended without a done/error event, treat as interrupted
      if (!streamFinished) {
        updateAiMessage({
          content: "Generation interrupted. Please retry.",
          thinkingContent: null,
          isLoading: false,
        });
        setIsResponding(false);
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);

      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Failed to connect to AI service";

      const errorResponse: Message = {
        id: loadingMessageId,
        sender: "ai",
        content: errorMessage,
        avatarUrl: avatarForRequest.avatarUrl,
        avatarHint: avatarForRequest.avatarHint,
      };

      setMessages(
        (prev = []) =>
          prev.map((msg) =>
            msg.id === loadingMessageId ? errorResponse : msg,
          ),
        chatId ?? undefined,
      );

      toast.error("Unable to reach model", {
        description: errorMessage,
      });
      setIsResponding(false);
    }
  };

  const handleSend = async (content: string, messageIdToUpdate?: string) => {
    const trimmedContent = content.trim();
    // Allow sending if: model selected OR framework enabled OR persona test
    const canSend =
      selectedModel || layoutContext?.useFramework || personaTestConfig;
    if (!canSend) {
      toast.error("Select a model or enable framework", {
        description:
          "Choose a model or enable framework mode before sending a message.",
      });
      return;
    }
    if (trimmedContent === "" || isResponding) return;
    setIsResponding(true);

    const activeModel = selectedModel;
    const requestAvatar = resolveModelAvatar(activeModel);
    const personaHistory = personaTestConfig
      ? (messages || [])
          .filter(
            (m) =>
              (m.sender === "user" || m.sender === "ai") &&
              typeof m.content === "string" &&
              m.content.trim().length > 0,
          )
          .map((m) => ({
            role:
              m.sender === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          }))
      : undefined;

    // Capture the referenced message ID and mentioned pin IDs before clearing
    const refMessageId =
      referencedMessage?.chatMessageId || referencedMessage?.id || null;
    // Merge mentioned pins with pins selected from model switch dialog
    const contextPinIds = layoutContext?.selectedPinIdsForNextMessage || [];
    const mentionedPinIds = mentionedPins.map((mp) => mp.id);
    const pinIdsToSend = [...new Set([...mentionedPinIds, ...contextPinIds])];
    const replyToMsgId =
      replyToMessage?.chatMessageId || replyToMessage?.id || null;
    const replyToContent = replyToMessage?.content || null;

    // Extract all files from attachments
    const filesToUpload = attachments.map((a) => a.file);

    // File size validation (50MB limit per file)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const oversizedFiles = filesToUpload.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error("File too large", {
        description: `${oversizedFiles[0].name} exceeds 50MB limit.`,
      });
      setIsResponding(false);
      return;
    }

    let chatId = personaTestConfig
      ? "persona-test"
      : (layoutContext?.activeChatId ?? null);

    if (messageIdToUpdate) {
      // This is an edit and resubmit
      const userMessageIndex = (messages || []).findIndex(
        (m) => m.id === messageIdToUpdate,
      );
      if (userMessageIndex === -1) {
        setIsResponding(false);
        return;
      }

      const updatedMessages = (messages || []).slice(0, userMessageIndex + 1);
      updatedMessages[userMessageIndex] = {
        ...updatedMessages[userMessageIndex],
        content: trimmedContent,
        metadata: {
          ...updatedMessages[userMessageIndex].metadata,
          replyToMessageId: replyToMsgId,
          replyToContent: replyToContent,
          mentionedPins:
            mentionedPins.length > 0
              ? mentionedPins.map((mp) => {
                  const pin = pinsById.get(mp.id);
                  return {
                    id: mp.id,
                    label: mp.label,
                    text: pin?.text || "",
                  };
                })
              : undefined,
        },
      };

      const loadingMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        isLoading: true,
        content: "",
        avatarUrl: requestAvatar.avatarUrl,
        avatarHint: requestAvatar.avatarHint,
      };

      const nextList = [...updatedMessages, loadingMessage];
      messageBufferRef.current = nextList;
      setMessages(nextList, chatId ?? undefined);
      const backendUserMessageId =
        updatedMessages[userMessageIndex].chatMessageId ?? null;
      fetchAiResponse(
        trimmedContent,
        loadingMessage.id,
        chatId,
        messageIdToUpdate,
        activeModel,
        requestAvatar,
        refMessageId,
        undefined,
        backendUserMessageId,
        pinIdsToSend,
        personaHistory,
        replyToMsgId,
        filesToUpload,
      );
      // Clear reference, mentions, reply, attachments, and context pins after sending
      setReferencedMessage(null);
      setMentionedPins([]);
      setReplyToMessage(null);
      setPinSearchQuery("");
      layoutContext?.setSelectedPinIdsForNextMessage?.([]);
      // Cleanup attachment URLs and clear attachments
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      setAttachments([]);
    } else {
      // This is a new message
      const turnId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const userMessageId = `${turnId}-user`;
      const assistantMessageId = `${turnId}-assistant`;

      // If we don't have a chat id yet, use a temp so UI state works until metadata returns
      if (!chatId) {
        chatId = `temp-${Date.now()}`;
        layoutContext?.setActiveChatId?.(chatId);
      }

      const userMessage: Message = {
        id: userMessageId,
        sender: "user",
        content: trimmedContent,
        avatarUrl: userAvatar?.imageUrl,
        avatarHint: userAvatar?.imageHint,
        metadata: {
          replyToMessageId: replyToMsgId,
          replyToContent: replyToContent,
          attachments:
            attachments.length > 0
              ? attachments.map((a) => ({
                  id: a.id,
                  type: a.type,
                  name: a.name,
                  url: a.url,
                }))
              : undefined,
          mentionedPins:
            mentionedPins.length > 0
              ? mentionedPins.map((mp) => {
                  const pin = pinsById.get(mp.id);
                  return {
                    id: mp.id,
                    label: mp.label,
                    text: pin?.text || "",
                  };
                })
              : undefined,
        },
      };

      const loadingMessage: Message = {
        id: assistantMessageId,
        sender: "ai",
        isLoading: true,
        content: "",
        avatarUrl: requestAvatar.avatarUrl,
        avatarHint: requestAvatar.avatarHint,
      };

      setMessages((prev = []) => {
        const next = [...prev, userMessage, loadingMessage];
        messageBufferRef.current = next;
        return next;
      }, chatId);
      setInput("");
      setIsScrolledToBottom(true);
      fetchAiResponse(
        trimmedContent,
        loadingMessage.id,
        chatId,
        userMessage.id,
        activeModel,
        requestAvatar,
        refMessageId,
        undefined,
        userMessage.chatMessageId ?? null,
        pinIdsToSend,
        personaHistory,
        replyToMsgId,
        filesToUpload,
      );
      // Clear reference, mentions, reply, attachments, and context pins after sending
      setReferencedMessage(null);
      setMentionedPins([]);
      setReplyToMessage(null);
      setPinSearchQuery("");
      layoutContext?.setSelectedPinIdsForNextMessage?.([]);
      // Cleanup attachment URLs and clear attachments
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      setAttachments([]);
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    // Check if user typed @ at the end
    const lastChar = value[value.length - 1];
    if (lastChar === "@") {
      setShowPinDropdown(true);
      setPinSearchQuery("");
      return;
    }

    // If dropdown is open, check for search query after @
    if (showPinDropdown) {
      // Find the last @ position
      const lastAtIndex = value.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        // Extract text after @
        const textAfterAt = value.substring(lastAtIndex + 1);
        
        // Check if there's a terminating character (space, punctuation, or newline)
        const hasTerminator = /[\s,.!?;:\n]/.test(textAfterAt);
        
        if (hasTerminator) {
          // Close dropdown if terminator found
          setShowPinDropdown(false);
          setPinSearchQuery("");
        } else {
          // Update search query
          setPinSearchQuery(textAfterAt);
        }
      } else {
        // @ was deleted, close dropdown
        setShowPinDropdown(false);
        setPinSearchQuery("");
      }
    }
  };

  const handleSelectPin = (pin: PinType) => {
    const pinLabel = stripMarkdown(pin.text).slice(0, 50) || pin.id;

    // Remove @ and any text after it from input
    const lastAtIndex = input.lastIndexOf("@");
    const newInput = lastAtIndex !== -1 ? input.substring(0, lastAtIndex) : input;
    setInput(newInput);

    // Add to mentioned pins if not already added
    if (!mentionedPins.some((mp) => mp.id === pin.id)) {
      setMentionedPins((prev) => [...prev, { id: pin.id, label: pinLabel }]);
    }

    setShowPinDropdown(false);
    setPinSearchQuery("");
    textareaRef.current?.focus();
  };

  const handleRemoveMention = (pinId: string) => {
    setMentionedPins((prev) => prev.filter((mp) => mp.id !== pinId));
  };

  const handleSelectPersona = (persona: any) => {
    setSelectedPersona(persona);
    setShowPersonaDropdown(false);
    toast.success(`Persona selected: ${persona.name}`);
  };

  const handleAddNewPersona = () => {
    setShowPersonaDropdown(false);
    // Navigate to persona creation - adjust URL as needed
    window.location.href = "/personas/new";
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const filesToAdd: Array<{
      id: string;
      type: "pdf" | "image";
      name: string;
      url: string;
      file: File;
      isUploading: boolean;
      uploadProgress: number;
    }> = [];

    // Process each selected file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check for duplicate file name
      const isDuplicate =
        attachments.some((a) => a.name === file.name) ||
        filesToAdd.some((f) => f.name === file.name);
      if (isDuplicate) {
        toast.error(`${file.name} already added`, {
          description: "This file is already in your attachments.",
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large`, {
          description: "Maximum file size is 50MB per file.",
        });
        continue;
      }

      // Determine file type
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const isImage = file.type.startsWith("image/");

      if (!isPdf && !isImage) {
        toast.error(`${file.name} not supported`, {
          description: "Please upload PDF or image files only.",
        });
        continue;
      }

      const attachmentId = crypto.randomUUID();
      const objectUrl = URL.createObjectURL(file);

      filesToAdd.push({
        id: attachmentId,
        type: isPdf ? "pdf" : "image",
        name: file.name,
        url: objectUrl,
        file: file,
        isUploading: true,
        uploadProgress: 0,
      });
    }

    if (filesToAdd.length === 0) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setAttachments((prev) => [...prev, ...filesToAdd]);

    // Simulate upload progress for each file
    filesToAdd.forEach((attachment) => {
      const fileSize = attachment.file.size;
      // Adjust upload duration based on file size (larger files take longer)
      const uploadDuration = Math.min(
        Math.max((fileSize / (1024 * 1024)) * 200, 500),
        3000,
      );
      const steps = 20;
      const stepDuration = uploadDuration / steps;

      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 100 / steps;
        if (currentProgress >= 100) {
          currentProgress = 100;
          clearInterval(interval);
          // Mark as uploaded
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id
                ? { ...a, isUploading: false, uploadProgress: 100 }
                : a,
            ),
          );
        } else {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id
                ? { ...a, uploadProgress: Math.round(currentProgress) }
                : a,
            ),
          );
        }
      }, stepDuration);
    });

    // Reset the input so the same files can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleOpenUploadDialog = () => {
    if (!layoutContext?.activeChatId) {
      toast.error("Open or start a chat", {
        description: "Select a chat before uploading a document.",
      });
      return;
    }
    setIsUploadDialogOpen(true);
  };

  const handleUploadDocument = async () => {
    if (!layoutContext?.activeChatId) {
      toast.error("Open or start a chat", {
        description: "Select a chat before uploading a document.",
      });
      return;
    }
    if (!uploadFile) {
      toast.error("Choose a file", {
        description: "Select a document to upload.",
      });
      return;
    }
    setUploadingDocument(true);
    try {
      const result = await uploadDocument({
        file: uploadFile,
        chatId: layoutContext.activeChatId,
        sourceUrl: uploadSourceUrl || undefined,
        csrfToken,
      });
      toast("Document uploaded", {
        description:
          result.message ||
          `Saved as ${result.documentId ?? "document"}${
            result.fileLink ? ` (${result.fileLink})` : ""
          }`,
      });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      setUploadSourceUrl("");
    } catch (error) {
      console.error("Document upload failed", error);
      toast.error("Upload failed", {
        description:
          error instanceof Error ? error.message : "Unable to upload document.",
      });
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleClearReference = () => {
    setReferencedMessage(null);
  };

  const handleScroll = () => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      const isAtBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 1;
      setIsScrolledToBottom(isAtBottom);
    }
  };

  const handlePin = async (message: Message) => {
    if (!layoutContext || !layoutContext.activeChatId) return;

    const identifier = message.chatMessageId ?? message.id;
    if (!identifier) {
      toast.error("Unable to pin", {
        description: "Please wait for the response to finish generating.",
      });
      return;
    }

    const isPinned =
      layoutContext.pins.some(
        (p) => p.messageId === identifier || p.id === identifier,
      ) || false;

    try {
      if (isPinned) {
        if (onUnpinMessage) {
          await onUnpinMessage(identifier);
          toast("Unpinned from pinboard", {
            description: "Response has been unpinned from the pinboard.",
          });
        }
      } else {
        if (onPinMessage) {
          const newPin: PinType = {
            id: identifier,
            messageId: identifier,
            text: message.content,
            tags: [],
            notes: "",
            chatId: layoutContext.activeChatId,
            time: new Date(),
          };
          await onPinMessage(newPin);
        }
      }
    } catch (error) {
      console.error("Failed to toggle pin", error);
      toast.error("Pin action failed", {
        description: "Please try again.",
      });
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast("Copied to clipboard!");
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleDeleteRequest = (message: Message) => {
    setMessageToDelete(message);
  };

  const handleRegenerateRequest = (aiMessage: Message) => {
    if (isResponding) {
      toast("Please wait", {
        description: "Hold on for the current response to finish.",
      });
      return;
    }
    const allMessages = displayMessages;
    const aiIndex = allMessages.findIndex((msg) => msg.id === aiMessage.id);
    if (aiIndex === -1) {
      toast.error("Unable to regenerate", {
        description:
          "We could not locate the original message for this response.",
      });
      return;
    }
    const linkedUser =
      [...allMessages.slice(0, aiIndex)]
        .reverse()
        .find((msg) => msg.sender === "user") || null;
    if (!linkedUser) {
      toast.error("Unable to regenerate", {
        description: "We could not find the prompt that created this response.",
      });
      return;
    }
    setRegeneratePrompt(linkedUser.content);
    setRegenerationState({
      aiMessage,
      userMessage: linkedUser,
    });
    handleConfirmRegenerate({
      aiMessage,
      userMessage: linkedUser,
      prompt: linkedUser.content,
    });
  };

  const handleConfirmRegenerate = (override?: {
    aiMessage: Message;
    userMessage: Message;
    prompt: string;
  }) => {
    const regen = override ?? regenerationState;
    if (!regen) return;
    const trimmedPrompt = (override?.prompt ?? regeneratePrompt).trim();
    // Allow regenerating if: model selected OR framework enabled
    const canRegenerate = selectedModel || layoutContext?.useFramework;
    if (!canRegenerate) {
      toast.error("Select a model or enable framework", {
        description:
          "Choose a model or enable framework mode before regenerating a response.",
      });
      setRegenerationState(null);
      setRegeneratePrompt("");
      return;
    }
    if (trimmedPrompt === "") {
      toast.error("Missing prompt", {
        description: "Update the prompt before regenerating.",
      });
      setRegenerationState(null);
      setRegeneratePrompt("");
      return;
    }
    const chatId = layoutContext?.activeChatId;
    if (!chatId) {
      toast.error("No chat selected", {
        description: "Pick a chat before regenerating a response.",
      });
      setRegenerationState(null);
      setRegeneratePrompt("");
      return;
    }

    const backendAiMessageId =
      regen.aiMessage.chatMessageId ?? regen.aiMessage.id;
    const backendUserMessageId =
      regen.userMessage.chatMessageId ?? regen.userMessage.id;

    if (!backendAiMessageId || !backendUserMessageId) {
      toast.error("Missing identifiers", {
        description: "We could not determine which messages to regenerate.",
      });
      setRegenerationState(null);
      setRegeneratePrompt("");
      return;
    }

    setIsResponding(true);
    setIsRegeneratingResponse(true);

    const avatar = resolveModelAvatar(selectedModel);

    setMessages(
      (prev = []) =>
        prev.map((msg) => {
          if (msg.id === regen.userMessage.id) {
            return { ...msg, content: trimmedPrompt };
          }
          if (msg.id === regen.aiMessage.id) {
            return {
              ...msg,
              content: "",
              isLoading: true,
              thinkingContent: null,
            };
          }
          return msg;
        }),
      chatId,
    );
    setLastMessageId(regen.aiMessage.id);

    fetchAiResponse(
      trimmedPrompt,
      regen.aiMessage.id,
      chatId,
      regen.userMessage.id,
      selectedModel,
      avatar,
      regen.userMessage.referencedMessageId ?? null,
      backendAiMessageId,
      backendUserMessageId,
    )
      .catch(() => {
        // fetchAiResponse already surfaces the error via toast.
      })
      .finally(() => {
        setIsRegeneratingResponse(false);
        setRegenerationState(null);
        setRegeneratePrompt("");
      });
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;

    const chatId = layoutContext?.activeChatId;
    const identifier = messageToDelete.chatMessageId ?? messageToDelete.id;

    if (!chatId || !identifier) {
      toast.error("Unable to delete", {
        description: "Missing chat or message information.",
      });
      setMessageToDelete(null);
      return;
    }

    try {
      // Call backend to delete message and all following messages
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = getCsrfToken();
      if (token) {
        headers["X-CSRFToken"] = token;
      }

      const response = await fetch(
        DELETE_MESSAGE_ENDPOINT(chatId, identifier),
        {
          method: "DELETE",
          headers,
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete message");
      }

      const data = await response.json();
      const deletedIds = data.deleted_message_ids || [];

      // Remove all deleted messages from UI
      setMessages((prev) =>
        (prev || []).filter((m) => {
          const msgId = m.chatMessageId || m.id;
          return !deletedIds.includes(msgId);
        }),
      );

      // Unpin any pinned messages that were deleted
      const pinsToUnpin =
        layoutContext?.pins.filter((p) => deletedIds.includes(p.messageId)) ||
        [];

      for (const pin of pinsToUnpin) {
        if (onUnpinMessage && pin.messageId) {
          await onUnpinMessage(pin.messageId);
        }
      }

      setMessageToDelete(null);
      toast("Messages deleted", {
        description: data.message || `Deleted ${data.deleted_count} message(s)`,
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Delete failed", {
        description: "Unable to delete message. Please try again.",
      });
      setMessageToDelete(null);
    }
  };

  const handleConfirmChatDelete = async () => {
    const currentLayout = layoutContext;
    if (!currentLayout?.activeChatId) {
      toast.error("No chat selected", {
        description: "Choose a chat before deleting.",
      });
      return;
    }
    const chatId = currentLayout.activeChatId;
    setIsDeletingChat(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = getCsrfToken();
      if (token) {
        headers["X-CSRFToken"] = token;
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

      setMessages([], chatId);
      const boardIndex = currentLayout.chatBoards.findIndex(
        (board) => board.id === chatId,
      );
      currentLayout.setChatBoards((prev) =>
        prev.filter((board) => board.id !== chatId),
      );
      let nextChatId: string | null = null;
      if (boardIndex !== -1) {
        const after = currentLayout.chatBoards[boardIndex + 1];
        const before = currentLayout.chatBoards[boardIndex - 1];
        nextChatId = after?.id ?? before?.id ?? null;
      }
      if (currentLayout.activeChatId === chatId) {
        currentLayout.setActiveChatId(nextChatId);
      }
      setInput("");
      setReferencedMessage(null);
      setMessageToDelete(null);
      setIsChatDeleteDialogOpen(false);
      toast("Chat deleted", {
        description: "This conversation has been removed.",
      });
    } catch (error) {
      console.error("Failed to delete chat", error);
      toast.error("Delete failed", {
        description:
          error instanceof Error ? error.message : "Unable to delete chat.",
      });
    } finally {
      setIsDeletingChat(false);
    }
  };

  const isMessagePinned = (message: Message) => {
    const identifier = message.chatMessageId ?? message.id;
    return (
      layoutContext?.pins.some(
        (p) => p.messageId === identifier || p.id === identifier,
      ) || false
    );
  };

  const getMessagesToDelete = (message: Message) => {
    if (!message) return [];

    const messageIndex = displayMessages.findIndex((m) => m.id === message.id);
    if (messageIndex === -1) return [];

    return displayMessages.slice(messageIndex);
  };

  return (
    <div className="relative flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-white">
      {/* Empty state: centered prompt box */}
      {displayMessages.length === 0 ? (
        <section className="flex flex-1 items-center justify-center bg-white px-4 py-8">
          {customEmptyState || (
            <InitialPrompts userName={user?.name ?? user?.email ?? null} />
          )}
        </section>
      ) : (
        <div
          className={`relative flex-1 min-h-0 overflow-y-auto ${chatStyles.customScrollbar}`}
          ref={scrollViewportRef}
          onScroll={handleScroll}
        >
          <div className="mx-auto w-full max-w-[850px] flex-col gap-3 pr-4 py-4">
            <div className="rounded-[32px] border border-transparent bg-white p-6 shadow-none">
              <div className="flex-col gap-3">
                {displayMessages.map((msg) => {
                  const refMsg = msg.referencedMessageId
                    ? displayMessages.find(
                        (m) =>
                          (m.chatMessageId || m.id) === msg.referencedMessageId,
                      )
                    : null;
                  const metadataAvatar = resolveAvatarFromMetadata(msg);
                  const taggedPins =
                    (msg.metadata?.pinIds || [])
                      .map((id) => {
                        const pin = pinsById.get(id);
                        return pin
                          ? {
                              id,
                              label: stripMarkdown(pin.text).slice(0, 80) || id,
                            }
                          : { id, label: id };
                      })
                      .filter(Boolean) || [];
                  const enrichedMessage =
                    msg.sender === "ai"
                      ? {
                          ...msg,
                          avatarUrl:
                            msg.avatarUrl ||
                            metadataAvatar?.avatarUrl ||
                            getModelIcon(
                              msg.metadata?.providerName,
                              msg.metadata?.modelName,
                            ) ||
                            qwenAvatarUrl,
                          avatarHint:
                            msg.avatarHint ||
                            metadataAvatar?.avatarHint ||
                            "AI model",
                        }
                      : msg;

                  const messageAttachments =
                    msg.sender === "user" && msg.metadata?.attachments;
                  const messagePins =
                    msg.sender === "user" && msg.metadata?.mentionedPins;

                  return (
                    <div key={msg.id} className="flex flex-col gap-2">
                      {/* Display pinned message attachments above user message */}
                      {messagePins && messagePins.length > 0 && (
                        <div className="flex gap-2 flex-wrap ml-auto max-w-[85%]">
                          {messagePins.map((pin: any) => {
                            const pinText = stripMarkdown(pin.text || pin.label);
                            const displayText = pinText.length > 80 ? pinText.slice(0, 80) + "..." : pinText;
                            const pinColor = getPinSeparatorColor(pin.id);
                            
                            return (
                              <div
                                key={pin.id}
                                className="group relative shrink-0 flex items-center gap-2.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] p-1.5 overflow-hidden cursor-pointer hover:bg-[#F5F5F5] transition-colors"
                                style={{ minWidth: "180px", maxWidth: "280px", height: "60px" }}
                                onClick={() => {
                                  // Emit event to insert pin content into input
                                  if (typeof window !== "undefined") {
                                    window.dispatchEvent(
                                      new CustomEvent("pin-insert-to-chat", {
                                        detail: { text: pin.text || pin.label },
                                      }),
                                    );
                                  }
                                }}
                              >
                                <div 
                                  className="flex h-full w-1 rounded-full shrink-0"
                                  style={{ backgroundColor: pinColor }}
                                ></div>
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F5] shrink-0">
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 16 16"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M8 2L9.5 6.5L14 8L9.5 9.5L8 14L6.5 9.5L2 8L6.5 6.5L8 2Z"
                                        fill="#666"
                                        stroke="#666"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate text-xs font-medium text-[#1E1E1E]">
                                      {displayText}
                                    </p>
                                    <p className="text-[10px] text-[#888888]">
                                      Pinned Message
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Display file attachments above user message */}
                      {messageAttachments && messageAttachments.length > 0 && (
                        <div className="flex gap-2 flex-wrap ml-auto max-w-[85%]">
                          {messageAttachments.map((attachment: any) =>
                            attachment.type === "pdf" ? (
                              <div
                                key={attachment.id}
                                className="group relative shrink-0 flex items-center gap-2.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] p-1.5 overflow-hidden"
                                style={{ width: "180.3px", height: "60px" }}
                              >
                                <div className="flex h-full w-12 items-center justify-center rounded-lg bg-[#F5F5F5]">
                                  <FileText className="h-5 w-5 text-[#666666]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-xs font-medium text-[#1E1E1E]">
                                    {attachment.name}
                                  </p>
                                  <p className="text-[10px] text-[#888888]">
                                    PDF Document
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div
                                key={attachment.id}
                                className="group relative shrink-0 rounded-[11px] border border-[#E5E5E5] bg-[#FAFAFA] overflow-hidden"
                                style={{
                                  width: "60px",
                                  height: "60px",
                                  padding: "1.08px",
                                }}
                              >
                                <Image
                                  src={attachment.url}
                                  alt={attachment.name}
                                  width={0}
                                  height={0}
                                  className="w-full h-full object-cover rounded-[10px]"
                                />
                              </div>
                            ),
                          )}
                        </div>
                      )}
                      <ChatMessage
                        message={enrichedMessage}
                        isPinned={isMessagePinned(msg)}
                        onPin={handlePin}
                        onCopy={handleCopy}
                        onDelete={handleDeleteRequest}
                        onResubmit={handleSend}
                        onRegenerate={
                          msg.sender === "ai"
                            ? handleRegenerateRequest
                            : undefined
                        }
                        onReply={msg.sender === "ai" ? handleReply : undefined}
                        onReact={msg.sender === "ai" ? handleReact : undefined}
                        referencedMessage={refMsg}
                        isNewMessage={msg.id === lastMessageId}
                        taggedPins={taggedPins}
                        isResponding={isResponding}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to bottom button - floating above the chat input */}
      {!isScrolledToBottom && (
        <div className="relative pointer-events-none" style={{ height: 0 }}>
          <button
            type="button"
            onClick={handleScrollToBottom}
            className="cursor-pointer absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full bg-white border border-[#D9D9D9] shadow-md hover:bg-[#F5F5F5] transition-colors h-10 w-10"
            aria-label="Scroll to bottom"
            style={{
              bottom: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              pointerEvents: "auto",
              zIndex: 30,
            }}
          >
            {/* Down arrow with vertical line icon, perfectly centered */}
            <span className="flex items-center justify-center h-full w-full">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#666"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <line x1="12" y1="5" x2="12" y2="17" />
                <polyline points="6 13 12 19 18 13" />
              </svg>
            </span>
          </button>
        </div>
      )}

      {/* Chat Input Footer */}
      <footer className="shrink-0 bg-white px-2 pb-0.5 pt-0">
        <div className="relative mx-auto w-full max-w-[756px]">
          {showPinDropdown && (
            <div
              ref={dropdownRef}
              className={cn(
                "absolute bottom-full left-0 right-0 z-50 mb-3 max-h-93 rounded-2xl border border-[#D9D9D9] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)] px-2 py-2",
              )}
              style={{ maxWidth: 700, minWidth: 220, left: 0, right: "auto" }}
            >
              {filteredPins.length > 0 ? (
                <>
                  <div className="font-geist font-medium text-left text-sm text-[#888888] px-4 py-2">
                    {pinSearchQuery ? `Searching: "${pinSearchQuery}"` : "Select a pin to mention"}
                  </div>
                  <div
                    ref={pinDropdownScrollRef}
                    className={cn("max-h-76 overflow-y-auto flex flex-col", chatStyles.customScrollbar)}
                  >
                    {filteredPins.map((pin, idx) => {
                      const isHighlighted = idx === highlightedPinIndex;
                      const pinText = stripMarkdown(pin.text);
                      const displayText = pinText.length > 80 ? pinText.slice(0, 80) + "..." : pinText;
                      
                      return (
                        <button
                          key={pin.id}
                          ref={(el) => {
                            if (el) {
                              pinItemRefs.current.set(idx, el);
                            } else {
                              pinItemRefs.current.delete(idx);
                            }
                          }}
                          type="button"
                          onClick={() => handleSelectPin(pin)}
                          onMouseEnter={() => setHighlightedPinIndex(idx)}
                          className={
                            `cursor-pointer w-full border-b border-[#F5F5F5] px-4 py-2 text-left text-[13px] rounded-[16px] transition-colors ` +
                            (isHighlighted
                              ? "hover:bg-[#d2d2d2] text-black bg-zinc-300"
                              : "hover:bg-[#d2d2d2] text-black")
                          }
                        >
                          <div className="flex items-center gap-4">
                            <div 
                              className="w-1 h-full min-h-10 rounded-full" 
                              style={{ backgroundColor: getPinSeparatorColor(pin.id) }}
                            ></div> 
                            <div className="flex flex-col">
                              <p className="truncate font-medium text-inherit text-black text-[13px]">
                                {pinSearchQuery 
                                  ? highlightMatch(displayText, pinSearchQuery)
                                  : renderInlineMarkdown(
                                      formatPinTitle(displayText || "Untitled Pin"),
                                    )}
                              </p>
                              {pin.tags && pin.tags.length > 0 && (
                                <div className="mt-1 flex gap-1">
                                  {pin.tags.slice(0, 3).map((tag, i) => (
                                    <span
                                      key={i}
                                      className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] text-[#767676]"
                                    >
                                      {pinSearchQuery ? highlightMatch(tag, pinSearchQuery) : tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="px-4 py-8 text-center text-[#888888]">
                  <div className="mb-2">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="mx-auto opacity-40"
                    >
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium">
                    {pinSearchQuery
                      ? "No pinned messages match your search."
                      : "No pinned messages available."}
                  </div>
                  {pinSearchQuery && (
                    <div className="text-xs mt-1">
                      Try a different search term.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div
            className="rounded-[24px] border border-[#D9D9D9] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{
              minHeight: attachments.length > 0 ? "162px" : "90px",
              transition: "min-height 0.2s ease",
            }}
          >
            {referencedMessage && (
              <div className="px-5 pt-4">
                <ReferenceBanner
                  referencedMessage={referencedMessage}
                  onClear={handleClearReference}
                />
              </div>
            )}
            {mentionedPins.length > 0 && (
              <div className="flex flex-wrap gap-2 px-5 pt-4">
                {mentionedPins.map((mp) => (
                  <div
                    key={mp.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F5] px-3 py-1 text-sm text-[#1E1E1E]"
                  >
                    <span>@{mp.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMention(mp.id)}
                      className="rounded-full p-0.5 hover:bg-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {attachments.length > 0 && (
              <div className="relative px-5 pt-4">
                <div
                  ref={attachmentScrollRef}
                  className="flex gap-2 overflow-x-auto scrollbar-hidden"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    setShowLeftScrollButton(el.scrollLeft > 10);
                    setShowScrollButton(
                      el.scrollWidth > el.clientWidth &&
                        el.scrollLeft < el.scrollWidth - el.clientWidth - 10,
                    );
                  }}
                >
                  {attachments.map((attachment) =>
                    attachment.type === "pdf" ? (
                      <div
                        key={attachment.id}
                        className="group relative shrink-0 flex items-center gap-2.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] p-1.5 overflow-hidden"
                        style={{ width: "180.3px", height: "60px" }}
                      >
                        {attachment.isUploading && (
                          <div
                            className="absolute bottom-0 left-0 h-1 bg-[#22C55E] transition-all duration-300"
                            style={{
                              width: `${attachment.uploadProgress || 0}%`,
                            }}
                          />
                        )}
                        <div className="flex h-full w-12 items-center justify-center rounded-lg bg-[#F5F5F5]">
                          <FileText className="h-5 w-5 text-[#666666]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-medium text-[#1E1E1E]">
                            {attachment.name}
                          </p>
                          <p className="text-[10px] text-[#888888]">
                            {attachment.isUploading
                              ? `Uploading... ${attachment.uploadProgress || 0}%`
                              : "PDF Document"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(attachment.url);
                            setAttachments((prev) =>
                              prev.filter((a) => a.id !== attachment.id),
                            );
                          }}
                          className="absolute top-0.5 right-0.5 rounded-full bg-white border border-[#E5E5E5] p-0.5 hover:bg-[#F5F5F5] shadow-sm transition-colors z-10 opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3 text-[#666666]" />
                        </button>
                      </div>
                    ) : (
                      <div
                        key={attachment.id}
                        className="group relative shrink-0 rounded-[11px] border border-[#E5E5E5] bg-[#FAFAFA] overflow-hidden"
                        style={{
                          width: "60px",
                          height: "60px",
                          padding: "1.08px",
                        }}
                      >
                        <Image
                          src={attachment.url}
                          alt={attachment.name}
                          width={0}
                          height={0}
                          className={`w-full h-full object-cover rounded-[10px] transition-all duration-300 ${attachment.isUploading ? "blur-sm" : "blur-0"}`}
                        />
                        {attachment.isUploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-[10px]">
                            <svg className="w-8 h-8" viewBox="0 0 36 36">
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="#22C55E"
                                strokeWidth="3"
                                strokeDasharray={`${((attachment.uploadProgress || 0) * 100.48) / 100}, 100.48`}
                                strokeLinecap="round"
                                transform="rotate(-90 18 18)"
                              />
                            </svg>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(attachment.url);
                            setAttachments((prev) =>
                              prev.filter((a) => a.id !== attachment.id),
                            );
                          }}
                          className="absolute top-0.5 right-0.5 rounded-full bg-white border border-[#E5E5E5] p-0.5 hover:bg-[#F5F5F5] shadow-sm transition-colors z-10 opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3 text-[#666666]" />
                        </button>
                      </div>
                    ),
                  )}
                </div>
                {showLeftScrollButton && (
                  <button
                    type="button"
                    onClick={() => {
                      if (attachmentScrollRef.current) {
                        attachmentScrollRef.current.scrollBy({
                          left: -200,
                          behavior: "smooth",
                        });
                      }
                    }}
                    //left caret for attached files
                    className="absolute left-3 top-1/2 translate-y-[-25%] flex h-8 w-8 items-center justify-center rounded-full bg-white border border-[#D9D9D9] shadow-md hover:bg-[#F5F5F5] transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-[#666666]" />
                  </button>
                )}
                {showScrollButton && (
                  <button
                    type="button"
                    onClick={() => {
                      if (attachmentScrollRef.current) {
                        attachmentScrollRef.current.scrollBy({
                          left: 200,
                          behavior: "smooth",
                        });
                      }
                    }}
                    //right caret for attached files
                    className="absolute right-3 top-1/2 translate-y-[-25%] flex h-8 w-8 items-center justify-center rounded-full bg-white border border-[#D9D9D9] shadow-md hover:bg-[#F5F5F5] transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-[#666666]" />
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5 px-5 py-4">
              {/* Reply indicator */}
              {replyToMessage && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]">
                  <Reply className="h-4 w-4 text-[#666666]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[#666666] font-medium">
                      Replying to{" "}
                      {replyToMessage.sender === "ai" ? "AI" : "You"}
                    </span>
                    <p className="text-xs text-[#8a8a8a] truncate">
                      {replyToMessage.content.slice(0, 80)}
                      {replyToMessage.content.length > 80 ? "..." : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyToMessage(null)}
                    className="p-1 hover:bg-[#E5E5E5] rounded transition-colors"
                  >
                    <X className="h-4 w-4 text-[#666666]" />
                  </button>
                </div>
              )}
              {/* Text input area */}
              <div className="w-full">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (showPinDropdown && filteredPins.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightedPinIndex(
                          (prev) => (prev + 1) % filteredPins.length,
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightedPinIndex(
                          (prev) =>
                            (prev - 1 + filteredPins.length) %
                            filteredPins.length,
                        );
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        handleSelectPin(filteredPins[highlightedPinIndex]);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setShowPinDropdown(false);
                        setPinSearchQuery("");
                      }
                      return;
                    }
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !isResponding &&
                      !showPinDropdown
                    ) {
                      e.preventDefault();
                      handleSend(input);
                    }
                  }}
                  placeholder={
                    disableInput
                      ? "Save to start chatting..."
                      : "Ask your persona .... "
                  }
                  className="min-h-[40px] w-full resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-relaxed text-[#1E1E1E] placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-light-grey shadow-none!"
                  rows={1}
                  disabled={isResponding || disableInput}
                />
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-3">
                {!hideAttachButton && (
                  <div className="relative" ref={attachMenuRef}>
                    {/* Hidden file input - must be outside conditional to persist in DOM */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf,image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-0 hover:bg-[#F5F5F5] hover:border-[#D9D9D9]"
                    >
                      <Plus className="h-5 w-5 text-[#555555]" />
                    </Button>

                    {showAttachMenu && (
                      <div
                        className="absolute bottom-full left-0 mb-2 flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-2 shadow-lg"
                        style={{ width: "160px" }}
                      >
                        <button
                          onClick={() => {
                            handleAttachClick();
                            setShowAttachMenu(false);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white p-2 text-left text-xs font-medium text-[#1E1E1E] transition-colors hover:bg-[#F5F5F5] whitespace-nowrap"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-[#666666]" />
                          <span>Attach Files</span>
                        </button>
                        <button
                          onClick={() => {
                            setWebSearchEnabled(!webSearchEnabled);
                            setShowAttachMenu(false);
                            toast(
                              webSearchEnabled
                                ? "Web search disabled"
                                : "Web search enabled",
                              {
                                description: webSearchEnabled
                                  ? "Results will not include web search"
                                  : "Results will include web search",
                              },
                            );
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border p-2 text-left text-xs font-medium transition-colors hover:bg-[#F5F5F5] whitespace-nowrap",
                            webSearchEnabled
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-[#E5E5E5] bg-white text-[#1E1E1E]",
                          )}
                        >
                          <Globe
                            className={cn(
                              "h-3.5 w-3.5",
                              webSearchEnabled ? "text-blue-600" : "text-[#666666]",
                            )}
                          />
                          <span>Web Search</span>
                          {webSearchEnabled && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!hidePersonaButton && (
                  <div className="relative" ref={personaDropdownRef}>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setShowPersonaDropdown(!showPersonaDropdown)
                      }
                      className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3 text-xs font-medium text-[#1E1E1E] hover:bg-[#F5F5F5] hover:border-[#D9D9D9]"
                      title="Choose Persona"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F5F5F5]">
                        <UserPlus className="h-3 w-3" />
                      </div>
                      <span>
                        {selectedPersona
                          ? selectedPersona.name
                          : "Choose Persona"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>

                    {showPersonaDropdown && (
                      <div
                        className="absolute bottom-full left-0 mb-2 rounded-lg border border-[#E5E5E5] bg-white shadow-lg overflow-hidden"
                        style={{ width: "291px", maxHeight: "181px" }}
                        role="listbox"
                        aria-expanded={showPersonaDropdown}
                        tabIndex={-1}
                        onKeyDown={(e) => {
                          if (activePersonas.length === 0) return;

                          // Total items = personas + "Add new persona" button
                          const totalItems = activePersonas.length + 1;

                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setHighlightedPersonaIndex((prev) => {
                              const next =
                                prev === -1 ? 0 : (prev + 1) % totalItems;
                              return next;
                            });
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHighlightedPersonaIndex((prev) => {
                              if (prev === -1 || prev === 0)
                                return totalItems - 1;
                              return prev - 1;
                            });
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            if (
                              highlightedPersonaIndex >= 0 &&
                              highlightedPersonaIndex < activePersonas.length
                            ) {
                              handleSelectPersona(
                                activePersonas[highlightedPersonaIndex],
                              );
                            } else if (
                              highlightedPersonaIndex === activePersonas.length
                            ) {
                              handleAddNewPersona();
                            }
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setShowPersonaDropdown(false);
                          }
                        }}
                      >
                        <div
                          className="max-h-[calc(5*32px)] overflow-y-auto overflow-x-hidden px-[5px] py-1"
                          style={{ scrollbarWidth: "thin" }}
                        >
                          {activePersonas.length === 0 ? (
                            <div className="px-2 py-4 text-center text-xs text-[#888888]">
                              No active personas available
                            </div>
                          ) : (
                            activePersonas.map((persona, idx) => (
                              <button
                                key={persona.id}
                                type="button"
                                role="option"
                                aria-selected={
                                  selectedPersona?.id === persona.id
                                }
                                onClick={() => handleSelectPersona(persona)}
                                onMouseEnter={() =>
                                  setHighlightedPersonaIndex(idx)
                                }
                                onMouseLeave={() =>
                                  setHighlightedPersonaIndex(-1)
                                }
                                className={
                                  `w-full flex items-center gap-2 rounded-[6px] pl-2 pr-2 py-[5.5px] text-left text-xs transition-colors ` +
                                  (idx === highlightedPersonaIndex &&
                                  highlightedPersonaIndex >= 0
                                    ? "bg-[var(--unofficial-accent-2,#E5E5E5)] text-black font-medium"
                                    : selectedPersona?.id === persona.id
                                      ? "bg-[var(--unofficial-accent-2,#E5E5E5)] text-black font-medium"
                                      : "bg-white text-[#1E1E1E] hover:bg-[var(--unofficial-accent-2,#E5E5E5)]")
                                }
                                style={{
                                  width: "280px",
                                  minHeight: "32px",
                                  paddingRight: "8px",
                                }}
                              >
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] border border-[#E5E5E5]">
                                  {persona.avatar ? (
                                    <img
                                      src={persona.avatar}
                                      alt={persona.name}
                                      className="h-full w-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-medium text-[#666666]">
                                      {persona.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span className="flex-1 truncate font-medium pr-0">
                                  {persona.name}
                                </span>
                              </button>
                            ))
                          )}
                        </div>

                        {activePersonas.length > 0 && (
                          <>
                            <div
                              className="mx-[5px] my-1"
                              style={{
                                width: "280px",
                                height: "1px",
                                backgroundColor:
                                  "var(--general-border, #E5E5E5)",
                              }}
                            />
                            <div className="px-[5px] pb-1">
                              <button
                                type="button"
                                onClick={handleAddNewPersona}
                                onMouseEnter={() =>
                                  setHighlightedPersonaIndex(
                                    activePersonas.length,
                                  )
                                }
                                onMouseLeave={() =>
                                  setHighlightedPersonaIndex(-1)
                                }
                                className={
                                  `w-full flex items-center gap-2 rounded-[6px] px-2 py-[5.5px] text-left text-xs transition-colors ` +
                                  (highlightedPersonaIndex ===
                                  activePersonas.length
                                    ? "bg-[var(--unofficial-accent-2,#E5E5E5)] text-black font-medium"
                                    : "bg-white text-[#1E1E1E] hover:bg-[var(--unofficial-accent-2,#E5E5E5)]")
                                }
                                style={{
                                  width: "280px",
                                  minHeight: "32px",
                                  paddingRight: "8px",
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                <span className="font-medium">
                                  Add new persona
                                </span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-1 shrink-0 items-center justify-end gap-4">
                  {/* <span className="text-sm font-medium text-[#888888]">
                  {isTokenUsageLoading ? "--" : `${usagePercent}%`}
                </span> */}
                  {isResponding ? (
                    <Button
                      type="button"
                      onClick={() => {
                        // TODO: Implement stop generation logic
                        setIsResponding(false);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A]"
                      title="Stop generation"
                    >
                      <Square className="h-[18px] w-[18px] fill-white" />
                    </Button>
                  ) : input.trim() ? (
                    <TooltipProvider>
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          {/* enable send button when framework is selected */}
                          <Button
                            type="button"
                            onClick={() => handleSend(input)}
                            disabled={
                              (!selectedModel &&
                                !layoutContext?.useFramework) ||
                              disableInput
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A] disabled:bg-[#CCCCCC] disabled:shadow-none"
                          >
                            <Send className="h-[18px] w-[18px]" />
                          </Button>
                        </TooltipTrigger>
                        {((!selectedModel && !layoutContext?.useFramework) ||
                          disableInput) && (
                          <TooltipContent
                            side="top"
                            className="bg-[#1E1E1E] text-white px-3 py-2 text-sm"
                          >
                            {disableInput
                              ? "Save to test first to enable chat"
                              : "Please select a model to start the conversation"}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        // TODO: Implement voice input logic
                        toast.info("Voice input", {
                          description: "Voice input feature coming soon!",
                        });
                      }}
                      className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-full bg-zinc-300 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A]"
                      title="Voice input"
                    >
                      {/* mic icon button  */}
                      <Mic
                        className="h-[25px] w-[25px]"
                        strokeWidth={2}
                        style={{ minWidth: "18px", minHeight: "20px" }}
                      />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Footer disclaimer */}
          <div className="mt-1 text-center text-xs text-[#888888]">
            Models can make mistakes. Check important information.
          </div>
        </div>
      </footer>

      <Dialog
        open={isUploadDialogOpen}
        onOpenChange={(open) => {
          if (!open && !uploadingDocument) {
            setIsUploadDialogOpen(false);
          }
        }}
      >
        <DialogContent className="rounded-[25px]">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              Attach a file to this chat so the backend can use it for RAG.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chat-upload-file">File</Label>
              <Input
                id="chat-upload-file"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xlsx,.xls"
                onChange={(event) =>
                  setUploadFile(event.target.files?.item(0) ?? null)
                }
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {uploadFile.name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat-upload-source">Source URL (optional)</Label>
              <Input
                id="chat-upload-source"
                placeholder="https://example.com/document"
                value={uploadSourceUrl}
                onChange={(e) => setUploadSourceUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-[25px]"
              onClick={() => setIsUploadDialogOpen(false)}
              disabled={uploadingDocument}
            >
              Cancel
            </Button>
            <Button
              className="rounded-[25px]"
              onClick={handleUploadDocument}
              disabled={uploadingDocument}
            >
              {uploadingDocument && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {uploadingDocument ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isChatDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isDeletingChat) {
            setIsChatDeleteDialogOpen(false);
          }
        }}
      >
        <AlertDialogContent className="rounded-[25px] bg-white border border-[#D4D4D4]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black">
              Delete entire chat?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              This action removes every message in this conversation. It cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[25px] bg-white border border-[#D4D4D4] text-black hover:bg-[#f5f5f5]"
              onClick={() => setIsChatDeleteDialogOpen(false)}
              disabled={isDeletingChat}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[25px] bg-white border border-[#D4D4D4] text-red-600 hover:bg-[#f5f5f5]"
              onClick={handleConfirmChatDelete}
              disabled={isDeletingChat}
            >
              {isDeletingChat ? "Deleting..." : "Delete chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!messageToDelete}
        onOpenChange={(open) => !open && setMessageToDelete(null)}
      >
        <AlertDialogContent className="rounded-[25px] bg-white border border-[#D4D4D4]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black">
              Delete Message?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              {messageToDelete &&
                (() => {
                  const messagesToDelete = getMessagesToDelete(messageToDelete);
                  const count = messagesToDelete.length;

                  if (count > 1) {
                    return `This will delete this message and ${count - 1} message(s) that came after it. This action cannot be undone.`;
                  }
                  return "This will permanently delete this message. This action cannot be undone.";
                })()}
            </AlertDialogDescription>
            {messageToDelete &&
              (() => {
                const messagesToDelete = getMessagesToDelete(messageToDelete);
                const pinnedMessages = messagesToDelete.filter(isMessagePinned);

                if (pinnedMessages.length > 0) {
                  return (
                    <div className="font-semibold text-red-600 mt-2 text-sm">
                      Warning: {pinnedMessages.length} pinned message(s) will be
                      affected.
                    </div>
                  );
                }
                return null;
              })()}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[25px] bg-white border border-[#D4D4D4] text-black hover:bg-[#f5f5f5]"
              onClick={() => setMessageToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[25px] bg-white border border-[#D4D4D4] text-red-600 hover:bg-[#f5f5f5]"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
