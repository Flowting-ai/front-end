
"use client";

import { useState, useRef, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Mic, Library, Trash2, X } from "lucide-react";
import { ChatMessage, type Message } from "./chat-message";
import { InitialPrompts } from "./initial-prompts";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { ReferenceBanner } from "./reference-banner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Pin } from "../layout/right-sidebar";
import type { AIModel } from "@/types/ai-model";
import { useToast } from "@/hooks/use-toast";
import { AppLayoutContext } from '@/context/app-layout-context';
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
import { useAuth } from "@/context/auth-context";
import {
  CHAT_COMPLETION_ENDPOINT,
  CHAT_DETAIL_ENDPOINT,
  DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";
import { extractThinkingContent } from "@/lib/thinking";
import { getModelIcon } from "@/lib/model-icons";

interface ChatInterfaceProps {
  onPinMessage?: (pin: Pin) => Promise<void> | void;
  onUnpinMessage?: (messageId: string) => Promise<void> | void;
  messages?: Message[];
  setMessages?: (
    messages: Message[] | ((prev: Message[]) => Message[]),
    chatIdOverride?: string
  ) => void;
  selectedModel?: AIModel | null; // 👈 
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
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const [referencedMessage, setReferencedMessage] = useState<Message | null>(null);
  const [mentionedPins, setMentionedPins] = useState<MentionedPin[]>([]);
  const [showPinDropdown, setShowPinDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userAvatar = PlaceHolderImages.find((p) => p.id === "user-avatar");
  const defaultAiAvatar = PlaceHolderImages.find((p) => p.id === "ai-avatar");
  const resolveModelAvatar = (modelOverride?: AIModel | null): MessageAvatar => {
    if (modelOverride) {
      const hintParts = [modelOverride.modelName, modelOverride.companyName].filter(Boolean);
      return {
        avatarUrl: getModelIcon(modelOverride.modelName || modelOverride.companyName),
        avatarHint: hintParts.join(" ").trim(),
      };
    }
    return {
      avatarUrl: defaultAiAvatar?.imageUrl,
      avatarHint: defaultAiAvatar?.imageHint,
    };
  };
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isResponding, setIsResponding] = useState(false);
  const layoutContext = useContext(AppLayoutContext);
  const { user, csrfToken } = useAuth();

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
  const activeChatBoard = layoutContext?.chatBoards.find(
    (board) => board.id === layoutContext?.activeChatId
  );

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
      if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
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

      const sanitized = extractThinkingContent(
        data.message || "API didn't respond"
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
        chatMessageId: data.messageId ?? undefined,
        referencedMessageId: referencedMessageId ?? null,
        metadata: data.metadata ? {
          modelName: data.metadata.modelName,
          providerName: data.metadata.providerName,
          inputTokens: data.metadata.inputTokens,
          outputTokens: data.metadata.outputTokens,
          createdAt: data.metadata.createdAt,
        } : undefined,
      };

      setMessages(
        (prev = []) =>
          prev.map((msg) => {
            if (msg.id === loadingMessageId) {
              return {
                ...aiResponse,
                chatMessageId: data.messageId ?? aiResponse.chatMessageId,
              };
            }
            if (userMessageId && msg.id === userMessageId) {
              return {
                ...msg,
                chatMessageId: data.messageId ?? msg.chatMessageId,
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

      toast({
        title: "Unable to reach model",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  const handleSend = async (content: string, messageIdToUpdate?: string) => {
    const trimmedContent = content.trim();
    if (!selectedModel) {
      toast({
        title: "Select a model",
        description: "Choose a model before sending a message.",
        variant: "destructive",
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

    if (!chatId && layoutContext?.ensureChatOnServer) {
      try {
        const ensured = await layoutContext.ensureChatOnServer({
          firstMessage: trimmedContent,
          selectedModel: activeModel,
        });
        chatId = ensured?.chatId ?? null;
        initialAiResponse = ensured?.initialResponse ?? null;
        initialAiMessageId = ensured?.initialMessageId ?? null;
      } catch (error) {
        console.error("Failed to create chat", error);
        toast({
          title: "Unable to start chat",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
        setIsResponding(false);
        return;
      }
    }

    if (!chatId) {
      toast({
        title: "Chat unavailable",
        description: "We couldn't determine which chat to use.",
        variant: "destructive",
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

  const handleSelectPin = (pin: Pin) => {
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

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleReference = (message: Message) => {
    setReferencedMessage(message);
    textareaRef.current?.focus();
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
      const isAtTopFlag = viewport.scrollTop === 0;
      setIsAtTop(isAtTopFlag);
    }
  };

  const scrollToBottom = () => {
    if (!scrollViewportRef.current) return;
    scrollViewportRef.current.scrollTo({
      top: scrollViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
    setIsScrolledToBottom(true);
  };

  const scrollToTop = () => {
    if (!scrollViewportRef.current) return;
    scrollViewportRef.current.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePin = async (message: Message) => {
    if (!layoutContext || !layoutContext.activeChatId) return;

    const identifier = message.chatMessageId ?? message.id;
    if (!identifier) {
      toast({
        title: "Unable to pin",
        description: "Please wait for the response to finish generating.",
        variant: "destructive",
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
          toast({ title: "Unpinned from board!" });
        }
      } else {
        if (onPinMessage) {
          const newPin: Pin = {
            id: identifier,
            messageId: identifier,
            text: message.content,
            tags: [],
            notes: "",
            chatId: layoutContext.activeChatId,
            time: new Date(),
          };
          await onPinMessage(newPin);
          toast({ title: "Pinned to board!" });
        }
      }
    } catch (error) {
      console.error("Failed to toggle pin", error);
      toast({
        title: "Pin action failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard!" });
  };

  const handleDeleteRequest = (message: Message) => {
    setMessageToDelete(message);
  };

  const handleRegenerateRequest = (aiMessage: Message) => {
    if (isResponding) {
      toast({
        title: "Please wait",
        description: "Hold on for the current response to finish.",
      });
      return;
    }
    const allMessages = messages || [];
    const aiIndex = allMessages.findIndex((msg) => msg.id === aiMessage.id);
    if (aiIndex === -1) {
      toast({
        title: "Unable to regenerate",
        description: "We could not locate the original message for this response.",
        variant: "destructive",
      });
      return;
    }
    const linkedUser =
      [...allMessages.slice(0, aiIndex)].reverse().find((msg) => msg.sender === "user") ||
      null;
    if (!linkedUser) {
      toast({
        title: "Unable to regenerate",
        description: "We could not find the prompt that created this response.",
        variant: "destructive",
      });
      return;
    }
    setRegeneratePrompt(linkedUser.content);
    setRegenerationState({
      aiMessage,
      userMessage: linkedUser,
    });
  };

  const handleCancelRegenerate = () => {
    if (isRegeneratingResponse) return;
    setRegenerationState(null);
    setRegeneratePrompt("");
  };

  const handleConfirmRegenerate = () => {
    if (!regenerationState) return;
    const trimmedPrompt = regeneratePrompt.trim();
    if (!selectedModel) {
      toast({
        title: "Select a model",
        description: "Choose a model before regenerating a response.",
        variant: "destructive",
      });
      return;
    }
    if (trimmedPrompt === "") {
      toast({
        title: "Missing prompt",
        description: "Update the prompt before regenerating.",
        variant: "destructive",
      });
      return;
    }
    const chatId = layoutContext?.activeChatId;
    if (!chatId) {
      toast({
        title: "No chat selected",
        description: "Pick a chat before regenerating a response.",
        variant: "destructive",
      });
      return;
    }

    const backendAiMessageId =
      regenerationState.aiMessage.chatMessageId ?? regenerationState.aiMessage.id;
    const backendUserMessageId =
      regenerationState.userMessage.chatMessageId ?? regenerationState.userMessage.id;

    if (!backendAiMessageId || !backendUserMessageId) {
      toast({
        title: "Missing identifiers",
        description: "We could not determine which messages to regenerate.",
        variant: "destructive",
      });
      return;
    }

    setIsResponding(true);
    setIsRegeneratingResponse(true);

    const avatar = resolveModelAvatar(selectedModel);

    setMessages(
      (prev = []) =>
        prev.map((msg) => {
          if (msg.id === regenerationState.userMessage.id) {
            return { ...msg, content: trimmedPrompt };
          }
          if (msg.id === regenerationState.aiMessage.id) {
            return { ...msg, content: "", isLoading: true, thinkingContent: null };
          }
          return msg;
        }),
      chatId
    );
    setLastMessageId(regenerationState.aiMessage.id);

    fetchAiResponse(
      trimmedPrompt,
      regenerationState.aiMessage.id,
      chatId,
      regenerationState.userMessage.id,
      selectedModel,
      avatar,
      regenerationState.userMessage.referencedMessageId ?? null,
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
      toast({
        title: "Unable to delete",
        description: "Missing chat or message information.",
        variant: "destructive",
      });
      setMessageToDelete(null);
      return;
    }

    try {
      // Call backend to delete message and all following messages
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
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
      toast({
        title: "Messages deleted",
        description: data.message || `Deleted ${data.deleted_count} message(s)`,
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Delete failed",
        description: "Unable to delete message. Please try again.",
        variant: "destructive",
      });
      setMessageToDelete(null);
    }
  };

  const handleConfirmChatDelete = async () => {
    const currentLayout = layoutContext;
    if (!currentLayout?.activeChatId) {
      toast({
        title: "No chat selected",
        description: "Choose a chat before deleting.",
        variant: "destructive",
      });
      return;
    }
    const chatId = currentLayout.activeChatId;
    setIsDeletingChat(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
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
      toast({
        title: "Chat deleted",
        description: "This conversation has been removed.",
      });
    } catch (error) {
      console.error("Failed to delete chat", error);
      toast({
        title: "Delete failed",
        description:
          error instanceof Error ? error.message : "Unable to delete chat.",
        variant: "destructive",
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

    // Find the index of the message to delete
    const messageIndex = messages.findIndex((m) => m.id === message.id);
    if (messageIndex === -1) return [];

    // All messages from this one onwards will be deleted
    return messages.slice(messageIndex);
  };

  const isSendDisabled = !selectedModel || !input.trim() || isResponding;

  return (
    <div className="flex flex-col flex-1 bg-background overflow-hidden">
      <div className="border-b border-slate-200 bg-white/70 backdrop-blur-sm px-4 py-2 sm:px-6 lg:px-10 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Active Chat
          </p>
          <p className="text-sm font-semibold text-card-foreground truncate">
            {activeChatBoard?.name ?? "Untitled chat"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setIsChatDeleteDialogOpen(true)}
            disabled={!layoutContext?.activeChatId || isDeletingChat}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea
        className="flex-1"
        viewportRef={scrollViewportRef}
        onScroll={handleScroll}
      >
        <div className="mx-auto w-full max-w-[min(1400px,100%)] space-y-6 px-4 py-4 sm:px-6 lg:px-10">
          {(messages || []).length === 0 ? (
            <InitialPrompts onPromptClick={handlePromptClick} />
          ) : (
            messages.map((msg) => {
              // Find the referenced message if this message references one
              const refMsg = msg.referencedMessageId
                ? messages.find(m => (m.chatMessageId || m.id) === msg.referencedMessageId)
                : null;

              return (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isPinned={isMessagePinned(msg)}
                  onPin={handlePin}
                  onCopy={handleCopy}
                  onDelete={handleDeleteRequest}
                  onResubmit={handleSend}
                  onRegenerate={msg.sender === "ai" ? handleRegenerateRequest : undefined}
                  onReference={msg.sender === "ai" ? handleReference : undefined}
                  referencedMessage={refMsg}
                  isNewMessage={msg.id === lastMessageId}
                />
              );
            })
          )}
        </div>
      </ScrollArea>

      {(messages || []).length > 0 && (
        <div className="absolute bottom-24 right-4 flex-col gap-2 hidden md:flex z-10">
          {!isAtTop && (
            <Button
              onClick={scrollToTop}
              variant="outline"
              size="icon"
              className="rounded-full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </Button>
          )}
          {!isScrolledToBottom && (
            <Button
              onClick={scrollToBottom}
              variant="outline"
              size="icon"
              className="rounded-full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </Button>
          )}
        </div>
      )}

      <footer className="shrink-0 border-t bg-white/80 backdrop-blur-sm p-4">
        {referencedMessage && (
          <ReferenceBanner
            referencedMessage={referencedMessage}
            onClear={handleClearReference}
          />
        )}
        <div className="relative mx-auto w-full max-w-[min(1400px,100%)]">
          {/* @ Pin Dropdown */}
          {showPinDropdown && availablePins.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-50"
            >
              <div className="p-2 border-b bg-slate-50">
                <p className="text-xs font-medium text-slate-600">Select a pin to mention</p>
              </div>
              {availablePins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => handleSelectPin(pin)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {pin.text.slice(0, 60) || "Untitled Pin"}
                  </p>
                  {pin.tags && pin.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {pin.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full"
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

          <div className="relative flex flex-col p-3 rounded-[28px] border border-input/60 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)] focus-within:ring-2 focus-within:ring-ring">
            {/* Mentioned Pins Chips */}
            {mentionedPins.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-2">
                {mentionedPins.map((mp) => (
                  <div
                    key={mp.id}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    <span className="font-medium">@{mp.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMention(mp.id)}
                      className="hover:bg-blue-100 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && showPinDropdown) {
                  e.preventDefault();
                  setShowPinDropdown(false);
                } else if (e.key === "Enter" && !e.shiftKey && !isResponding && !showPinDropdown) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder={
                selectedModel ? "Type @ to mention pins..." : "Select a model to start chatting"
              }
              className="pr-12 text-base resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-2 min-h-[48px]"
              rows={1}
              disabled={isResponding}
            />
            <div className="flex items-center justify-between mt-1 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="ghost" className="rounded-[25px] h-8 px-3">
                  <Library className="mr-2 h-4 w-4" />
                  Library
                </Button>
                <Select>
                  <SelectTrigger className="rounded-[25px] bg-transparent w-auto gap-2 h-8 px-3 border-0">
                    <SelectValue placeholder="Choose Persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="researcher">Researcher</SelectItem>
                    <SelectItem value="writer">Creative Writer</SelectItem>
                    <SelectItem value="technical">Technical Expert</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="rounded-[25px] bg-transparent w-auto gap-2 h-8 px-3 border-0">
                    <SelectValue placeholder="Add Context" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">From File</SelectItem>
                    <SelectItem value="url">From URL</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size={isMobile ? "icon" : "lg"}
                onClick={() => handleSend(input)}
                disabled={isSendDisabled}
                className="bg-primary text-primary-foreground h-9 rounded-[25px] px-4 flex items-center gap-2"
                title={!selectedModel ? "Select a model to send a message" : undefined}
              >
                {!isMobile && "Send Message"}
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </footer>

      <Dialog
        open={!!regenerationState}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelRegenerate();
          }
        }}
      >
        <DialogContent className="rounded-[25px]">
          <DialogHeader>
            <DialogTitle>Regenerate response</DialogTitle>
            <DialogDescription>
              Adjust the original prompt and the assistant will respond again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Prompt
            </label>
            <Textarea
              value={regeneratePrompt}
              onChange={(e) => setRegeneratePrompt(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-[25px]"
              onClick={handleCancelRegenerate}
              disabled={isRegeneratingResponse}
            >
              Cancel
            </Button>
            <Button
              className="rounded-[25px]"
              onClick={handleConfirmRegenerate}
              disabled={
                isRegeneratingResponse || regeneratePrompt.trim() === ""
              }
            >
              {isRegeneratingResponse ? "Regenerating..." : "Regenerate"}
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
        <AlertDialogContent className="rounded-[25px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entire chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This action removes every message in this conversation. It cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[25px]"
              onClick={() => setIsChatDeleteDialogOpen(false)}
              disabled={isDeletingChat}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[25px] bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmChatDelete}
              disabled={isDeletingChat}
            >
              {isDeletingChat ? "Deleting…" : "Delete chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!messageToDelete}
        onOpenChange={(open) => !open && setMessageToDelete(null)}
      >
        <AlertDialogContent className="rounded-[25px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>
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
                  <div className="font-semibold text-destructive mt-2 text-sm">
                    ⚠️ {pinnedMessages.length} pinned message(s) will be affected.
                  </div>
                );
              }
              return null;
            })()}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[25px]"
              onClick={() => setMessageToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[25px] bg-destructive hover:bg-destructive/90"
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

    