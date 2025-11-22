"use client";

import { useState, useRef, useEffect, useContext, useMemo } from "react";
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
} from "lucide-react";
import { ChatMessage, type Message } from "./chat-message";
import { InitialPrompts } from "./initial-prompts";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { ReferenceBanner } from "./reference-banner";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PinType } from "../layout/right-sidebar";
import type { AIModel } from "@/types/ai-model";
import { useToast } from "@/hooks/use-toast";
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
import { generateImage } from "@/lib/api/images";
import { addReaction, removeReaction } from "@/lib/api/messages";

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
      toast({
        title: "Reaction failed",
        description:
          error instanceof Error ? error.message : "Unable to update reaction.",
        variant: "destructive",
      });
    }
  };
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isResponding, setIsResponding] = useState(false);
  const layoutContext = useContext(AppLayoutContext);
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
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
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
      toast({
        title: "Open or start a chat",
        description: "Select a chat before uploading a document.",
        variant: "destructive",
      });
      return;
    }
    if (!uploadFile) {
      toast({
        title: "Choose a file",
        description: "Select a document to upload.",
        variant: "destructive",
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
      toast({
        title: "Document uploaded",
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
      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Unable to upload document.",
        variant: "destructive",
      });
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleOpenImageDialog = () => {
    if (!layoutContext?.activeChatId) {
      toast({
        title: "Open or start a chat",
        description: "Select a chat before generating an image.",
        variant: "destructive",
      });
      return;
    }
    setIsImageDialogOpen(true);
  };

  const handleGenerateImage = async () => {
    const targetChatId = layoutContext?.activeChatId;
    const trimmedPrompt = imagePrompt.trim();
    if (!targetChatId) {
      toast({
        title: "Open or start a chat",
        description: "Select a chat before generating an image.",
        variant: "destructive",
      });
      return;
    }
    if (!trimmedPrompt) {
      toast({
        title: "Enter a prompt",
        description: "Add a short description for the image.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingImage(true);
    const requestAvatar = resolveModelAvatar(selectedModel);
    const imageMessageId = `img-${Date.now()}`;

    // Optimistic placeholder while the image is generating
    setMessages(
      (prev = []) => [
        ...prev,
        {
          id: imageMessageId,
          sender: "ai",
          content: `Generating image: ${trimmedPrompt}`,
          avatarUrl: requestAvatar.avatarUrl,
          avatarHint: requestAvatar.avatarHint,
          isLoading: true,
        },
      ],
      targetChatId
    );

    try {
      const { imageUrl } = await generateImage({
        prompt: trimmedPrompt,
        chatId: targetChatId,
        csrfToken,
      });

      setMessages(
        (prev = []) =>
          prev.map((msg) =>
            msg.id === imageMessageId
              ? {
                  ...msg,
                  isLoading: false,
                  content: trimmedPrompt,
                  imageUrl,
                }
              : msg
          ),
        targetChatId
      );
      toast({
        title: "Image ready",
        description: "Added to the conversation.",
      });
      setIsImageDialogOpen(false);
      setImagePrompt("");
    } catch (error) {
      console.error("Image generation failed", error);
      setMessages(
        (prev = []) =>
          prev.map((msg) =>
            msg.id === imageMessageId
              ? {
                  ...msg,
                  isLoading: false,
                  content:
                    error instanceof Error
                      ? error.message
                      : "Unable to generate image.",
                }
              : msg
          ),
        targetChatId
      );
      toast({
        title: "Image generation failed",
        description:
          error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
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

  return (
    <div className="relative flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-[#F5F5F5]">
      {/* Empty state: centered prompt box */}
      {(messages || []).length === 0 ? (
        <section className="flex flex-1 items-center justify-center bg-[#F5F5F5] px-4 py-8">
          <InitialPrompts userName={user?.name ?? user?.email ?? null} />
        </section>
      ) : (
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          ref={scrollViewportRef}
          onScroll={handleScroll}
        >
          <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-10 sm:px-6 lg:px-0">
            <div className="rounded-[32px] border border-[#D9D9D9] bg-white p-6 shadow-[0px_2px_4px_rgba(25,33,61,0.08)]">
              <div className="space-y-6">
                {messages.map((msg) => {
                  const refMsg = msg.referencedMessageId
                    ? messages.find(
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
                    onReference={msg.sender === "ai" ? handleReference : undefined}
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

      {/* Chat Input Footer */}
      <footer className="shrink-0 bg-[#F5F5F5] px-4 pb-6 pt-4 sm:px-8 lg:px-10">
        <div className="relative mx-auto w-full max-w-[1280px]">
          {showPinDropdown && availablePins.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute bottom-full left-0 right-0 z-50 mb-3 max-h-64 overflow-y-auto rounded-2xl border border-[#D9D9D9] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
            >
              <div className="border-b border-[#F0F0F0] bg-[#F9F9F9] px-4 py-3 text-left text-xs font-semibold text-[#555555]">
                Select a pin to mention
              </div>
              {availablePins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => handleSelectPin(pin)}
                  className="w-full border-b border-[#F5F5F5] px-4 py-3 text-left text-sm hover:bg-[#F8F8F8]"
                >
                  <p className="truncate font-medium text-[#1E1E1E]">
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

          <div className="rounded-[24px] border border-[#D9D9D9] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
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

            <div className="flex items-start gap-3 px-5 py-4">
              <Button
                variant="ghost"
                onClick={handleOpenUploadDialog}
                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-0 hover:bg-[#F5F5F5] hover:border-[#D9D9D9]"
              >
                <Plus className="h-5 w-5 text-[#555555]" />
              </Button>

              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && showPinDropdown) {
                      e.preventDefault();
                      setShowPinDropdown(false);
                    } else if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !isResponding &&
                      !showPinDropdown
                    ) {
                      e.preventDefault();
                      handleSend(input);
                    }
                  }}
                  placeholder={composerPlaceholder}
                  className="min-h-[40px] w-full resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-relaxed text-[#1E1E1E] placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={1}
                  disabled={isResponding}
                />
              </div>

              <div className="flex shrink-0 items-center gap-4">
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
                  <Button
                    type="button"
                    onClick={() => handleSend(input)}
                    disabled={!selectedModel}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A] disabled:bg-[#CCCCCC] disabled:shadow-none"
                    title={!selectedModel ? "Select a model to send a message" : "Send message"}
                  >
                    <Send className="h-[18px] w-[18px]" />
                  </Button>
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
                    <Mic className="h-[18px] w-[18px]" />
                  </Button>
                )}
              </div>
            </div>
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

      <Dialog
        open={isImageDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isGeneratingImage) {
            setIsImageDialogOpen(false);
          }
        }}
      >
        <DialogContent className="rounded-[25px]">
          <DialogHeader>
            <DialogTitle>Generate image</DialogTitle>
            <DialogDescription>
              Send an image generation request tied to this chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="image-prompt">Prompt</Label>
              <Textarea
                id="image-prompt"
                rows={3}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="e.g., astronaut riding a horse"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-[25px]"
              onClick={() => setIsImageDialogOpen(false)}
              disabled={isGeneratingImage}
            >
              Cancel
            </Button>
            <Button
              className="rounded-[25px]"
              onClick={handleGenerateImage}
              disabled={isGeneratingImage}
            >
              {isGeneratingImage && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isGeneratingImage ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
