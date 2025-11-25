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
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  Image as ImageIcon,
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
import { generateImage } from "@/lib/api/images";
import { addReaction, removeReaction } from "@/lib/api/messages";

const FALLBACK_MESSAGES: Message[] = [
  {
    id: "layout-demo-user-1",
    sender: "user",
    content:
      "Morning! I need you to synthesize the last sprint's experimentation metrics into something story-driven for the exec readout. Call out the lifts we saw on the onboarding flows and highlight anything that might spook finance about burn. Give me specific numbers so I can copy them straight into the deck.",
    metadata: {
      createdAt: "2024-06-10T14:18:00Z",
    },
  },
  {
    id: "layout-demo-ai-1",
    sender: "ai",
    content:
      "Absolutely. Over the last seven days, blended win rate rose 6.2% while latency decreased 14.3%, so we are finally under the two-second mark across the board. The onboarding control lost to the variation on activation, but only by 0.7%, so I would call that statistically neutral. I can group the highlights into a narrative around faster answers, cleaner guardrails, and a clear finance-friendly cost reduction if that helps with your slides.",
    metadata: {
      modelName: "Qwen 2.5 72B",
      providerName: "Alibaba Cloud",
      createdAt: "2024-06-10T14:18:12Z",
    },
  },
  {
    id: "layout-demo-user-2",
    sender: "user",
    content:
      "Perfect. While you are at it, audit the finance summarizer persona because the PMs keep pinging me about volatility in the valuation scenarios. I want at least two concrete transcripts we can use as pull quotes, plus a short list of gaps that need follow-up work this sprint. Prioritize anything that would land poorly in front of the CFO.",
    metadata: {
      createdAt: "2024-06-10T14:19:05Z",
    },
  },
  {
    id: "layout-demo-ai-2",
    sender: "ai",
    content:
      "On it. Finance summarizer accuracy dipped 3.5%, almost entirely on long-horizon equity dilution cases where the prompt failed to pin the vesting schedule. I pulled two transcripts showing the issue and added inline annotations so you can drop screenshots into the deck. To stabilize it, we either expand the conditioning window by 15% or ship the pending retrieval rules; I penciled both options into the action plan.",
    metadata: {
      modelName: "Claude 3 Opus",
      providerName: "Anthropic",
      createdAt: "2024-06-10T14:19:34Z",
    },
  },
  {
    id: "layout-demo-user-3",
    sender: "user",
    content:
      "Great, thanks. Last piece: draft a forward-looking blurb that sets expectations for the multi-model routing pilot kicking off next week. I need language that balances optimism with a clear ask for headcount so we can actually run the vendor comparison. Think of it like the closer slide before the appendix.",
    metadata: {
      createdAt: "2024-06-10T14:20:11Z",
    },
  },
  {
    id: "layout-demo-ai-3",
    sender: "ai",
    content:
      "Done. The closer slide now tees up the routing pilot as the fastest path to lower response times without sacrificing domain accuracy, ending with a specific ask for one additional applied scientist and a shared infra block. I also left a note suggesting an appendix table that compares vendor SLAs and token pricing so you can defend the investment if procurement raises eyebrows. Ready for any final polish whenever you are.",
    metadata: {
      modelName: "Gemini 1.5 Pro",
      providerName: "Google",
      createdAt: "2024-06-10T14:20:38Z",
    },
  },
];

interface ChatInterfaceProps {
  onPinMessage?: (pin: PinType) => Promise<void> | void;
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
  const [referencedMessage, setReferencedMessage] = useState<Message | null>(null);
  const [mentionedPins, setMentionedPins] = useState<MentionedPin[]>([]);
  const [showPinDropdown, setShowPinDropdown] = useState(false);
  const [attachments, setAttachments] = useState<Array<{id: string; type: 'pdf' | 'image'; name: string; url: string; isUploading?: boolean; uploadProgress?: number}>>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showLeftScrollButton, setShowLeftScrollButton] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  
  // Temporary test attachments - remove later
  useEffect(() => {
    // Add initial attachments with uploading state
    setAttachments([
      {id: '1', type: 'pdf', name: 'Project_Requirements_Document.pdf', url: '/test.pdf', isUploading: true, uploadProgress: 0},
      {id: '2', type: 'pdf', name: 'Technical_Specifications.pdf', url: '/test2.pdf'},
      {id: '3', type: 'image', name: 'Screenshot.png', url: 'https://picsum.photos/200/200?random=1', isUploading: true, uploadProgress: 0},
      {id: '4', type: 'image', name: 'Chart.jpg', url: 'https://picsum.photos/200/200?random=2'},
      {id: '5', type: 'pdf', name: 'Meeting_Notes.pdf', url: '/test3.pdf'},
      {id: '6', type: 'image', name: 'Diagram.png', url: 'https://picsum.photos/200/200?random=3'},
      {id: '7', type: 'pdf', name: 'API_Documentation.pdf', url: '/test4.pdf'},
      {id: '8', type: 'image', name: 'Mockup.jpg', url: 'https://picsum.photos/200/200?random=4'},
      {id: '9', type: 'pdf', name: 'User_Research_Report.pdf', url: '/test5.pdf'},
      {id: '10', type: 'image', name: 'Wireframe.png', url: 'https://picsum.photos/200/200?random=5'},
      {id: '11', type: 'pdf', name: 'Sprint_Planning.pdf', url: '/test6.pdf'},
      {id: '12', type: 'image', name: 'Analytics.jpg', url: 'https://picsum.photos/200/200?random=6'},
      {id: '13', type: 'pdf', name: 'Architecture_Design.pdf', url: '/test7.pdf'},
      {id: '14', type: 'image', name: 'Prototype.png', url: 'https://picsum.photos/200/200?random=7'},
    ]);
    
    // Simulate upload progress for first PDF and first image
    const interval = setInterval(() => {
      setAttachments(prev => prev.map(att => {
        if ((att.id === '1' || att.id === '3') && att.isUploading) {
          const newProgress = (att.uploadProgress || 0) + 10;
          if (newProgress >= 100) {
            return { ...att, isUploading: false, uploadProgress: 100 };
          }
          return { ...att, uploadProgress: newProgress };
        }
        return att;
      }));
    }, 300);
    
    // Force scroll button to show for testing
    setTimeout(() => setShowScrollButton(true), 100);
    
    // Cleanup interval after upload completes
    setTimeout(() => clearInterval(interval), 3500);
    
    return () => clearInterval(interval);
  }, []);
  
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
      toast({
        title: "Reaction failed",
        description:
          error instanceof Error ? error.message : "Unable to update reaction.",
        variant: "destructive",
      });
    }
  };
  const isMobile = useIsMobile();
  // Prevent hydration mismatch: don't render until isMobile is known
  if (typeof isMobile === "undefined") {
    return null;
  }
  const { toast } = useToast();
  const [isResponding, setIsResponding] = useState(false);
  const layoutContext = useContext(AppLayoutContext);
  const isUsingFallbackMessages =
    messages.length === 0 && !layoutContext?.activeChatId;
  const displayMessages = isUsingFallbackMessages ? FALLBACK_MESSAGES : messages;
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
    }
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
    const allMessages = displayMessages;
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

    const messageIndex = displayMessages.findIndex((m) => m.id === message.id);
    if (messageIndex === -1) return [];

    return displayMessages.slice(messageIndex);
  };

  return (
    <div className="relative flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-[#F5F5F5]">
      {/* Empty state: centered prompt box */}
      {displayMessages.length === 0 ? (
        <section className="flex flex-1 items-center justify-center bg-[#F5F5F5] px-4 py-8">
          <InitialPrompts userName={user?.name ?? user?.email ?? null} />
        </section>
      ) : (
        <div
          className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden"
          ref={scrollViewportRef}
          onScroll={handleScroll}
        >
          <div className="mx-auto w-full max-w-[1280px] space-y-3 px-4 py-4 sm:px-8 lg:px-10">
            <div className="rounded-[32px] border border-transparent bg-[#F5F5F5] p-6 shadow-none">
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

      {/* Chat Input Footer */}
      <footer className="shrink-0 bg-[#F5F5F5] px-4 pb-0.5 pt-0 sm:px-8 lg:px-10">
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
                        className="group relative flex-shrink-0 flex items-center gap-2.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] p-1.5 overflow-hidden"
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
                        className="group relative flex-shrink-0 rounded-[11px] border border-[#E5E5E5] bg-[#FAFAFA] overflow-hidden"
                        style={{ width: '60px', height: '60px', padding: '1.08px' }}
                      >
                        <img 
                          src={attachment.url} 
                          alt={attachment.name}
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
                  placeholder="Ask anything... Hit '@' to add in a pin"
                  className="min-h-[40px] w-full resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-relaxed text-[#1E1E1E] placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={1}
                  disabled={isResponding}
                />
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-3">
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
                          toast({ title: "Attach Context", description: "Coming soon!" });
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
                          disabled={!selectedModel}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A] disabled:bg-[#CCCCCC] disabled:shadow-none"
                        >
                          <Send className="h-[18px] w-[18px]" />
                        </Button>
                      </TooltipTrigger>
                      {!selectedModel && (
                        <TooltipContent side="top" className="bg-[#1E1E1E] text-white px-3 py-2 text-sm">
                          Please select a model to start the conversation
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
              {isDeletingChat ? "Deleting…" : "Delete chat"}
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
                    ⚠️ {pinnedMessages.length} pinned message(s) will be affected.
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
