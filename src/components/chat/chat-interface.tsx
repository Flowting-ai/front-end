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
} from "lucide-react";
import { ChatMessage, type Message } from "./chat-message";
import { InitialPrompts } from "./initial-prompts";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { ReferenceBanner } from "./reference-banner";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PinType } from "../layout/right-sidebar";
import type { AIModel } from "@/types/ai-model";
import { toast } from "sonner";
import { AppLayoutContext } from "../layout/app-layout";
import { cn } from "@/lib/utils";
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
  CHAT_DETAIL_ENDPOINT,
  DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";
import { extractThinkingContent } from "@/lib/thinking";
import { getModelIcon } from "@/lib/model-icons";
import { uploadDocument } from "@/lib/api/documents";
import { addReaction, removeReaction } from "@/lib/api/messages";
import Image from "next/image";

interface ChatInterfaceProps {
  onPinMessage?: (pin: PinType) => Promise<void> | void;
  onUnpinMessage?: (messageId: string) => Promise<void> | void;
  messages?: Message[];
  setMessages?: (
    messages: Message[] | ((prev: Message[]) => Message[]),
    chatIdOverride?: string
  ) => void;
  selectedModel?: AIModel | null;
  hidePersonaButton?: boolean;
  customEmptyState?: React.ReactNode;
  disableInput?: boolean;
  hideAttachButton?: boolean;
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
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  // For pin mention dropdown keyboard navigation
  const [highlightedPinIndex, setHighlightedPinIndex] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [referencedMessage, setReferencedMessage] = useState<Message | null>(null);
  const [mentionedPins, setMentionedPins] = useState<MentionedPin[]>([]);
  const [showPinDropdown, setShowPinDropdown] = useState(false);
  const [attachments, setAttachments] = useState<Array<{id: string; type: 'pdf' | 'image'; name: string; url: string; isUploading?: boolean; uploadProgress?: number}>>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showLeftScrollButton, setShowLeftScrollButton] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const PIN_INSERT_EVENT = "pin-insert-to-chat";
  
  // Close attach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAttachMenu]);

  useEffect(() => {
    const handlePinInsert = (event: Event) => {
      const custom = event as CustomEvent<{ text?: string }>;
      const text = custom.detail?.text;
      if (!text) return;
      setInput((prev) => (prev ? `${prev}\n${text}` : text));
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener(PIN_INSERT_EVENT, handlePinInsert as EventListener);
      return () => {
        window.removeEventListener(PIN_INSERT_EVENT, handlePinInsert as EventListener);
      };
    }
  }, []);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const attachmentScrollRef = useRef<HTMLDivElement>(null);
  const userAvatar = PlaceHolderImages.find((p) => p.id === "user-avatar");
  const defaultAiAvatar = PlaceHolderImages.find((p) => p.id === "ai-avatar");
  const qwenAvatarUrl = "/Qwen.svg";
  const resolveModelAvatar = (modelOverride?: AIModel | null): MessageAvatar => {
    if (modelOverride) {
      const hintParts = [modelOverride.modelName, modelOverride.companyName].filter(Boolean);
      return {
        avatarUrl: getModelIcon(
          modelOverride.companyName,
          modelOverride.modelName
        ),
        avatarHint: hintParts.join(" ").trim(),
      };
    }
    return {
      avatarUrl: defaultAiAvatar?.imageUrl ?? qwenAvatarUrl,
      avatarHint: defaultAiAvatar?.imageHint ?? "AI model",
    };
  };

  const resolveAvatarFromMetadata = (message: Message): MessageAvatar | null => {
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

  const handleReact = async (message: Message, reaction: string | null) => {
    if (message.sender !== "ai") return;
    const chatId = layoutContext?.activeChatId;
    const messageId = message.chatMessageId || message.id;
    if (!chatId || !messageId) return;

    const current = message.metadata?.userReaction || null;
    const isRemoving = reaction === null || current === reaction;

    try {
      if (isRemoving) {
        await removeReaction({ chatId, messageId, csrfToken });
      } else {
        await addReaction({ chatId, messageId, reaction: reaction as any, csrfToken });
      }

      setMessages((prev = []) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                metadata: {
                  ...m.metadata,
                  userReaction: isRemoving ? null : reaction,
                },
              }
            : m
        ),
        chatId
      );
    } catch (error) {
      console.error("Reaction failed", error);
      toast.error("Reaction failed", {
        description:
          error instanceof Error ? error.message : "Unable to update reaction.",
      });
    }
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
  const [isChatDeleteDialogOpen, setIsChatDeleteDialogOpen] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSourceUrl, setUploadSourceUrl] = useState("");
  const composerPlaceholder = selectedModel
    ? "Let's Play..."
    : "Choose a model to start chatting";

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // max height
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  // Clear reference and mentions when switching chats
  useEffect(() => {
    setReferencedMessage(null);
    setMentionedPins([]);
    setShowPinDropdown(false);
  }, [layoutContext?.activeChatId]);

  // Get available pins
  const availablePins = layoutContext?.pins || [];

  // Reset highlighted index when dropdown opens or availablePins changes
  useEffect(() => {
    if (showPinDropdown && availablePins.length > 0) {
      setHighlightedPinIndex(0);
    }
  }, [showPinDropdown, availablePins.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowPinDropdown(false);
      }
    };

    if (showPinDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
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
    chatId: string,
    userMessageId: string | undefined,
    modelForRequest: AIModel | null,
    avatarForRequest: MessageAvatar,
    referencedMessageId?: string | null,
    regenerateMessageId?: string | null,
    userMessageBackendId?: string | null,
    pinIds?: string[]
  ) => {
    try {
      if (!modelForRequest) {
        console.warn("No model selected  backend may need to use a default.");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = getCsrfToken();
      if (token) {
        headers["X-CSRFToken"] = token;
      }

      const payload: Record<string, unknown> = {
        prompt: userMessage,
        chatId,
        model: modelForRequest
          ? {
              companyName: modelForRequest.companyName,
              modelName: modelForRequest.modelName,
              version: modelForRequest.version,
            }
          : null,
        user: user
          ? {
              id: user.id ?? null,
              email: user.email ?? null,
              name: user.name ?? null,
            }
          : null,
      };

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

      const response = await fetch(CHAT_COMPLETION_ENDPOINT, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error body:", errorText);
        let parsedMessage = "API request failed";
        try {
          const parsed = JSON.parse(errorText);
          parsedMessage =
            parsed?.detail ??
            parsed?.message ??
            parsed?.error ??
            errorText ??
            parsedMessage;
        } catch {
          parsedMessage = errorText || parsedMessage;
        }
        throw new Error(parsedMessage);
      }

      const data = await response.json();

      const messageText =
        typeof data.message === "string"
          ? data.message
          : typeof data.response === "string"
          ? data.response
          : typeof data.message?.response === "string"
          ? data.message.response
          : typeof data.message?.content === "string"
          ? data.message.content
          : typeof data.message?.message === "string"
          ? data.message.message
          : "";

      const messageMeta =
        (data.metadata && typeof data.metadata === "object" ? data.metadata : null) ||
        (data.message?.metadata && typeof data.message.metadata === "object"
          ? data.message.metadata
          : null);

      const resolvedMessageId =
        data.messageId ??
        data.message_id ??
        (data.message?.message_id ?? data.message?.id) ??
        null;

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
            documentId:
              (messageMeta as { documentId?: string | null }).documentId ??
              (messageMeta as { document_id?: string | null }).document_id ??
              null,
            documentUrl:
              (messageMeta as { documentUrl?: string | null }).documentUrl ??
              (messageMeta as { document_url?: string | null }).document_url ??
              null,
            llmModelId:
              (messageMeta as { llmModelId?: string | number | null }).llmModelId ??
              (messageMeta as { llm_model_id?: string | number | null }).llm_model_id ??
              null,
            pinIds: Array.isArray((messageMeta as { pinIds?: unknown[] }).pinIds)
              ? ((messageMeta as { pinIds: unknown[] }).pinIds as unknown[]).map(String)
              : Array.isArray((messageMeta as { pin_ids?: unknown[] }).pin_ids)
              ? ((messageMeta as { pin_ids: unknown[] }).pin_ids as unknown[]).map(String)
              : undefined,
            userReaction:
              (messageMeta as { userReaction?: string | null }).userReaction ??
              (messageMeta as { user_reaction?: string | null }).user_reaction ??
              null,
          }
        : undefined;

      const sanitized = extractThinkingContent(
        messageText || "API didn't respond"
      );

      const aiResponse: Message = {
        id: loadingMessageId,
        sender: "ai",
        content:
          sanitized.visibleText ||
          (sanitized.thinkingText ? "" : "API didn't respond"),
        thinkingContent: sanitized.thinkingText,
        avatarUrl: avatarForRequest.avatarUrl,
        avatarHint: avatarForRequest.avatarHint,
        chatMessageId:
          resolvedMessageId !== null && resolvedMessageId !== undefined
            ? String(resolvedMessageId)
            : undefined,
        referencedMessageId: referencedMessageId ?? null,
        metadata,
      };

      setMessages(
        (prev = []) =>
          prev.map((msg) => {
            if (msg.id === loadingMessageId) {
              return {
                ...aiResponse,
                chatMessageId:
                  resolvedMessageId !== null && resolvedMessageId !== undefined
                    ? String(resolvedMessageId)
                    : aiResponse.chatMessageId,
              };
            }
            if (userMessageId && msg.id === userMessageId) {
              return {
                ...msg,
                chatMessageId:
                  resolvedMessageId !== null && resolvedMessageId !== undefined
                    ? String(resolvedMessageId)
                    : msg.chatMessageId,
              };
            }
            return msg;
          }),
        chatId
      );
      setLastMessageId(loadingMessageId);
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
          prev.map((msg) => (msg.id === loadingMessageId ? errorResponse : msg)),
        chatId
      );

      toast.error("Unable to reach model", {
        description: errorMessage,
      });
    } finally {
      setIsResponding(false);
    }
  };

  const handleSend = async (content: string, messageIdToUpdate?: string) => {
    const trimmedContent = content.trim();
    if (!selectedModel) {
      toast.error("Select a model", {
        description: "Choose a model before sending a message.",
      });
      return;
    }
    if (trimmedContent === "" || isResponding) return;
    setIsResponding(true);

    const activeModel = selectedModel;
    const requestAvatar = resolveModelAvatar(activeModel);

    // Capture the referenced message ID and mentioned pin IDs before clearing
    const refMessageId = referencedMessage?.chatMessageId || referencedMessage?.id || null;
    const pinIdsToSend = mentionedPins.map(mp => mp.id);

    let chatId = layoutContext?.activeChatId ?? null;
    let initialAiResponse: string | null = null;
    let initialAiMessageId: string | null = null;
    let initialAiMetadata: Message["metadata"] | undefined;

    let isTempChat = chatId?.startsWith("temp-");

    if ((!chatId || isTempChat) && layoutContext?.ensureChatOnServer) {
      try {
        const ensured = await layoutContext.ensureChatOnServer({
          firstMessage: trimmedContent,
          selectedModel: activeModel,
          pinIds: pinIdsToSend,
        });
        chatId = ensured?.chatId ?? null;
        isTempChat = chatId?.startsWith("temp-");
        initialAiResponse = ensured?.initialResponse ?? null;
        initialAiMessageId = ensured?.initialMessageId ?? null;
        initialAiMetadata = ensured?.initialMetadata ?? undefined;
      } catch (error) {
        console.error("Failed to create chat", error);
        toast.error("Unable to start chat", {
          description: "Please try again in a moment.",
        });
        setIsResponding(false);
        return;
      }
    }

    if (!chatId || isTempChat) {
      toast.error("Chat unavailable", {
        description: "We couldn't determine which chat to use.",
      });
      setIsResponding(false);
      return;
    }

    if (messageIdToUpdate) {
      // This is an edit and resubmit
      const userMessageIndex = (messages || []).findIndex(
        (m) => m.id === messageIdToUpdate
      );
      if (userMessageIndex === -1) {
        setIsResponding(false);
        return;
      }

      const updatedMessages = (messages || []).slice(0, userMessageIndex + 1);
      updatedMessages[userMessageIndex] = {
        ...updatedMessages[userMessageIndex],
        content: trimmedContent,
      };

      const loadingMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        isLoading: true,
        content: "",
        avatarUrl: requestAvatar.avatarUrl,
        avatarHint: requestAvatar.avatarHint,
      };

      setMessages([...updatedMessages, loadingMessage], chatId);
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
        pinIdsToSend
      );
      // Clear reference and mentions after sending
      setReferencedMessage(null);
      setMentionedPins([]);
    } else {
      // This is a new message
      const turnId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const userMessageId = `${turnId}-user`;
      const assistantMessageId = `${turnId}-assistant`;

      const userMessage: Message = {
        id: userMessageId,
        sender: "user",
        content: trimmedContent,
        avatarUrl: userAvatar?.imageUrl,
        avatarHint: userAvatar?.imageHint,
      };

      const loadingMessage: Message = {
        id: assistantMessageId,
        sender: "ai",
        isLoading: true,
        content: "",
        avatarUrl: requestAvatar.avatarUrl,
        avatarHint: requestAvatar.avatarHint,
      };

      setMessages(
        (prev = []) => [...prev, userMessage, loadingMessage],
        chatId
      );
      setInput("");
      setIsScrolledToBottom(true);
      if (initialAiResponse !== null) {
        const initialSanitized = extractThinkingContent(initialAiResponse);
        const aiResponse: Message = {
          id: loadingMessage.id,
          sender: "ai",
          content:
            initialSanitized.visibleText ||
            (initialSanitized.thinkingText ? "" : initialAiResponse),
          thinkingContent: initialSanitized.thinkingText,
          avatarUrl: requestAvatar.avatarUrl,
          avatarHint: requestAvatar.avatarHint,
          chatMessageId: initialAiMessageId ?? undefined,
          metadata: initialAiMetadata,
          referencedMessageId: refMessageId,
        };
        setMessages(
          (prev = []) =>
            prev.map((msg) => {
              if (msg.id === loadingMessage.id) {
                return aiResponse;
              }
              if (msg.id === userMessage.id && initialAiMessageId) {
                return { ...msg, chatMessageId: initialAiMessageId };
              }
              return msg;
            }),
          chatId
        );
        setLastMessageId(loadingMessage.id);
        setIsResponding(false);
        // Clear reference after sending
        setReferencedMessage(null);
        return;
      }
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
        pinIdsToSend
      );
      // Clear reference and mentions after sending
      setReferencedMessage(null);
      setMentionedPins([]);
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    // Check if user typed @ at the end
    const lastChar = value[value.length - 1];
    if (lastChar === '@') {
      setShowPinDropdown(true);
    }
  };

  const handleSelectPin = (pin: PinType) => {
    const pinLabel = pin.text.slice(0, 50) || pin.id;

    // Remove the trailing @ from input
    const newInput = input.slice(0, -1);
    setInput(newInput);

    // Add to mentioned pins if not already added
    if (!mentionedPins.some(mp => mp.id === pin.id)) {
      setMentionedPins(prev => [...prev, { id: pin.id, label: pinLabel }]);
    }

    setShowPinDropdown(false);
    textareaRef.current?.focus();
  };

  const handleRemoveMention = (pinId: string) => {
    setMentionedPins(prev => prev.filter(mp => mp.id !== pinId));
  };

  const handleOpenUploadDialog = () => {
    if (!layoutContext?.activeChatId) {
      toast({
        title: "Open or start a chat",
        description: "Select a chat before uploading a document.",
        variant: "destructive",
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
        (p) => p.messageId === identifier || p.id === identifier
      ) || false;

    try {
      if (isPinned) {
        if (onUnpinMessage) {
          await onUnpinMessage(identifier);
          toast("Unpinned from board!");
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
          toast("Pinned to board!");
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
        description: "We could not locate the original message for this response.",
      });
      return;
    }
    const linkedUser =
      [...allMessages.slice(0, aiIndex)].reverse().find((msg) => msg.sender === "user") ||
      null;
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
    if (!selectedModel) {
      toast.error("Select a model", {
        description: "Choose a model before regenerating a response.",
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
            return { ...msg, content: "", isLoading: true, thinkingContent: null };
          }
          return msg;
        }),
      chatId
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
      backendUserMessageId
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

      const response = await fetch(DELETE_MESSAGE_ENDPOINT(chatId, identifier), {
        method: "DELETE",
        headers,
        credentials: "include",
      });

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
        })
      );

      // Unpin any pinned messages that were deleted
      const pinsToUnpin = layoutContext?.pins.filter((p) =>
        deletedIds.includes(p.messageId)
      ) || [];

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
        (board) => board.id === chatId
      );
      currentLayout.setChatBoards((prev) =>
        prev.filter((board) => board.id !== chatId)
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
        (p) => p.messageId === identifier || p.id === identifier
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
    <div className="relative flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-[var(--Background-Default-Default,#FFFFFF)]">
      {/* Empty state: centered prompt box */}
      {displayMessages.length === 0 ? (
        <section className="flex flex-1 items-center justify-center bg-[var(--Background-Default-Default,#FFFFFF)] px-4 py-8">
          {customEmptyState || <InitialPrompts userName={user?.name ?? user?.email ?? null} />}
        </section>
      ) : (
        <div
          className={`relative flex-1 min-h-0 overflow-y-auto ${chatStyles.customScrollbar}`}
          ref={scrollViewportRef}
          onScroll={handleScroll}
        >
          <div className="mx-auto w-full max-w-[756px] space-y-3 px-4 py-4 sm:px-8 lg:px-10">
            <div className="rounded-[32px] border border-transparent bg-[var(--Background-Default-Default,#FFFFFF)] p-6 shadow-none">
              <div className="space-y-3">
                {displayMessages.map((msg) => {
                  const refMsg = msg.referencedMessageId
                    ? displayMessages.find(
                        (m) => (m.chatMessageId || m.id) === msg.referencedMessageId
                      )
                    : null;
                  const metadataAvatar = resolveAvatarFromMetadata(msg);
                  const taggedPins =
                    (msg.metadata?.pinIds || [])
                      .map((id) => {
                        const pin = pinsById.get(id);
                        return pin
                          ? { id, label: pin.text.slice(0, 80) || id }
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
                              msg.metadata?.modelName
                            ) ||
                            qwenAvatarUrl,
                          avatarHint:
                            msg.avatarHint ||
                            metadataAvatar?.avatarHint ||
                            "AI model",
                        }
                      : msg;

                return (
                  <ChatMessage
                    key={msg.id}
                    message={enrichedMessage}
                    isPinned={isMessagePinned(msg)}
                    onPin={handlePin}
                    onCopy={handleCopy}
                    onDelete={handleDeleteRequest}
                    onResubmit={handleSend}
                    onRegenerate={
                      msg.sender === "ai" ? handleRegenerateRequest : undefined
                    }
                    onReact={msg.sender === "ai" ? handleReact : undefined}
                    referencedMessage={refMsg}
                    isNewMessage={msg.id === lastMessageId}
                    taggedPins={taggedPins}
                  />
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
            className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full bg-white border border-[#D9D9D9] shadow-md hover:bg-[#F5F5F5] transition-colors h-10 w-10"
            aria-label="Scroll to bottom"
            style={{ bottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', pointerEvents: 'auto', zIndex: 30 }}
          >
            {/* Down arrow with vertical line icon, perfectly centered */}
            <span className="flex items-center justify-center h-full w-full">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <line x1="12" y1="5" x2="12" y2="17" />
                <polyline points="6 13 12 19 18 13" />
              </svg>
            </span>
          </button>
        </div>
      )}

      {/* Chat Input Footer */}
      <footer className="shrink-0 bg-[var(--Background-Default-Default,#FFFFFF)] px-4 pb-0.5 pt-0 sm:px-8 lg:px-10">
        <div className="relative mx-auto w-full max-w-[756px]">
          {showPinDropdown && availablePins.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute bottom-full left-0 right-0 z-50 mb-3 max-h-64 overflow-y-auto rounded-2xl border border-[#D9D9D9] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
              style={{ maxWidth: 500, minWidth: 220, left: 0, right: 'auto' }}
            >
              <div className="border-b border-[#F0F0F0] bg-[#F9F9F9] px-4 py-3 text-left text-xs font-semibold text-[#555555] rounded-t-2xl">
                Select a pin to mention
              </div>
              {availablePins.map((pin, idx) => (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => handleSelectPin(pin)}
                  className={
                    `w-full border-b border-[#F5F5F5] px-4 py-2 text-left text-[13px] rounded-none last:rounded-b-2xl transition-colors ` +
                    (idx === highlightedPinIndex
                      ? 'bg-[#d2d2d2] text-black font-semibold shadow-inner'
                      : 'hover:bg-[#d2d2d2] text-black')
                  }
                  style={{ borderRadius: idx === highlightedPinIndex ? 16 : 0 }}
                >
                  <p className="truncate font-medium text-inherit text-black text-[13px]">
                    {pin.text.slice(0, 60) || "Untitled Pin"}
                  </p>
                  {pin.tags && pin.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {pin.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] text-[#767676]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div 
            className="rounded-[24px] border border-[#D9D9D9] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]" 
            style={{ 
              minHeight: attachments.length > 0 ? '162px' : '90px',
              transition: 'min-height 0.2s ease'
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
                    setShowScrollButton(el.scrollWidth > el.clientWidth && el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
                  }}
                >
                  {attachments.map((attachment) => (
                    attachment.type === 'pdf' ? (
                      <div
                        key={attachment.id}
                        className="group relative shrink-0 flex items-center gap-2.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] p-1.5 overflow-hidden"
                        style={{ width: '180.3px', height: '60px' }}
                      >
                        {attachment.isUploading && (
                          <div 
                            className="absolute bottom-0 left-0 h-1 bg-[#22C55E] transition-all duration-300"
                            style={{ width: `${attachment.uploadProgress || 0}%` }}
                          />
                        )}
                        <div className="flex h-full w-12 items-center justify-center rounded-lg bg-[#F5F5F5]">
                          <FileText className="h-5 w-5 text-[#666666]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-medium text-[#1E1E1E]">{attachment.name}</p>
                          <p className="text-[10px] text-[#888888]">
                            {attachment.isUploading ? `Uploading... ${attachment.uploadProgress || 0}%` : 'PDF Document'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter(a => a.id !== attachment.id))}
                          className="absolute top-0.5 right-0.5 rounded-full bg-white border border-[#E5E5E5] p-0.5 hover:bg-[#F5F5F5] shadow-sm transition-colors z-10 opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3 text-[#666666]" />
                        </button>
                      </div>
                    ) : (
                      <div
                        key={attachment.id}
                        className="group relative shrink-0 rounded-[11px] border border-[#E5E5E5] bg-[#FAFAFA] overflow-hidden"
                        style={{ width: '60px', height: '60px', padding: '1.08px' }}
                      >
                        <Image
                          src={attachment.url} 
                          alt={attachment.name}
                          width={0}
                          height={0}
                          className={`w-full h-full object-cover rounded-[10px] transition-all duration-300 ${attachment.isUploading ? 'blur-sm' : 'blur-0'}`}
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
                                strokeDasharray={`${(attachment.uploadProgress || 0) * 100.48 / 100}, 100.48`}
                                strokeLinecap="round"
                                transform="rotate(-90 18 18)"
                              />
                            </svg>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter(a => a.id !== attachment.id))}
                          className="absolute top-0.5 right-0.5 rounded-full bg-white border border-[#E5E5E5] p-0.5 hover:bg-[#F5F5F5] shadow-sm transition-colors z-10 opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3 text-[#666666]" />
                        </button>
                      </div>
                    )
                  ))}
                </div>
                {showLeftScrollButton && (
                  <button
                    type="button"
                    onClick={() => {
                      if (attachmentScrollRef.current) {
                        attachmentScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
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
                        attachmentScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
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
              {/* Text input area */}
              <div className="w-full">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (showPinDropdown && availablePins.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightedPinIndex((prev) => (prev + 1) % availablePins.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightedPinIndex((prev) => (prev - 1 + availablePins.length) % availablePins.length);
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        handleSelectPin(availablePins[highlightedPinIndex]);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setShowPinDropdown(false);
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
                  placeholder={disableInput ? "Save to start chatting..." : "Ask your persona .... "}
                  className="min-h-[40px] w-full resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-relaxed text-[#1E1E1E] placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-light-grey"
                  rows={1}
                  disabled={isResponding || disableInput}
                />
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-3">
                {!hideAttachButton && (
                  <div className="relative" ref={attachMenuRef}>
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
                      style={{ width: '160px' }}
                    >
                      <button
                        onClick={() => {
                          handleOpenUploadDialog();
                          setShowAttachMenu(false);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white p-2 text-left text-xs font-medium text-[#1E1E1E] transition-colors hover:bg-[#F5F5F5] whitespace-nowrap"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-[#666666]" />
                        <span>Attach Files</span>
                      </button>
                      <button
                        onClick={() => {
                          toast("Attach Context", { description: "Coming soon!" });
                          setShowAttachMenu(false);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white p-2 text-left text-xs font-medium text-[#1E1E1E] transition-colors hover:bg-[#F5F5F5] whitespace-nowrap"
                      >
                        <ScanText className="h-3.5 w-3.5 text-[#666666]" />
                        <span>Attach Context</span>
                      </button>
                    </div>
                  )}
                </div>
                )}
                
                {!hidePersonaButton && (
                  <Button
                    variant="ghost"
                    disabled
                    className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-3 text-xs font-medium text-[#AAAAAA] opacity-50 cursor-not-allowed"
                    title="Choose Persona (Coming Soon)"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E5E5]">
                      <UserPlus className="h-3 w-3" />
                    </div>
                    <span>Choose Persona</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                )}

                <div className="flex flex-1 shrink-0 items-center justify-end gap-4">
                <span className="text-sm font-medium text-[#888888]">
                  {isTokenUsageLoading ? "--" : `${usagePercent}%`}
                </span>
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
                        <Button
                          type="button"
                          onClick={() => handleSend(input)}
                          disabled={!selectedModel || disableInput}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A] disabled:bg-[#CCCCCC] disabled:shadow-none"
                        >
                          <Send className="h-[18px] w-[18px]" />
                        </Button>
                      </TooltipTrigger>
                      {(!selectedModel || disableInput) && (
                        <TooltipContent side="top" className="bg-[#1E1E1E] text-white px-3 py-2 text-sm">
                          {disableInput ? "Save to test first to enable chat" : "Please select a model to start the conversation"}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      // TODO: Implement voice input logic
                      toast({
                        title: "Voice input",
                        description: "Voice input feature coming soon!",
                      });
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A]"
                    title="Voice input"
                  >
                    {/* mic icon button  */}
                    <Mic className="h-[25px] w-[25px]" strokeWidth={2} style={{ minWidth: '18px', minHeight: '20px' }} />
                  </Button>
                )}
                </div>
              </div>
            </div>
          </div>
          
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
            <AlertDialogTitle className="text-black">Delete entire chat?</AlertDialogTitle>
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
            <AlertDialogTitle className="text-black">Delete Message?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              {messageToDelete && (() => {
                const messagesToDelete = getMessagesToDelete(messageToDelete);
                const count = messagesToDelete.length;

                if (count > 1) {
                  return `This will delete this message and ${count - 1} message(s) that came after it. This action cannot be undone.`;
                }
                return "This will permanently delete this message. This action cannot be undone.";
              })()}
            </AlertDialogDescription>
            {messageToDelete && (() => {
              const messagesToDelete = getMessagesToDelete(messageToDelete);
              const pinnedMessages = messagesToDelete.filter(isMessagePinned);

              if (pinnedMessages.length > 0) {
                return (
                  <div className="font-semibold text-red-600 mt-2 text-sm">
                    Warning: {pinnedMessages.length} pinned message(s) will be affected.
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
