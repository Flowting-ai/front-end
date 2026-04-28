"use client";

import { useRef, useEffect, useContext, useMemo } from "react";
import chatStyles from "./chat-interface.module.css";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X, FileText, Reply, Upload } from "lucide-react";
import { ChatMessage, type Message, type MessageSource } from "./chat-message";
import { InitialPrompts } from "./initial-prompts";
import { ReferenceBanner } from "./reference-banner";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PinType } from "../layout/right-sidebar";
import type { AIModel } from "@/types/ai-model";
import { toast } from "@/lib/toast-helper";
import { AppLayoutContext } from "../layout/app-layout";
import { sanitizeURL } from "@/lib/security";
import { stripMarkdown } from "@/lib/markdown-utils";
import { useChatState } from "@/hooks/use-chat-state";
import { useStreamingChat } from "@/hooks/use-streaming-chat";
import type { MessageAvatar } from "@/hooks/use-streaming-chat";
import { normalizeUuidReference } from "@/lib/normalizers/normalize-utils";
import { friendlyApiError } from "@/lib/api/client";
// Personas are fetched once in AppLayout and shared via context — no separate fetch needed here.
import { getAuthHeaders } from "@/lib/jwt-utils";
import { normalizeUrl } from "@/lib/normalizers/normalize-utils";
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
import { useFileDrop } from "@/hooks/use-file-drop";
import { canAccessFeature } from "@/lib/plan-config";

import { CHATS_ENDPOINT, DELETE_MESSAGE_ENDPOINT } from "@/lib/config";
import { extractThinkingContent, extractSources } from "@/lib/parsers/content-parser";
import { getModelIcon } from "@/lib/model-icons";
import { fetchModelsWithCache } from "@/lib/ai-models";
import { PinMentionDropdown, getPinSeparatorColor } from "./PinMentionDropdown";
import {
  AttachmentManager,
  isDocumentFile,
  getDocumentKindLabel,
  DOCUMENT_UPLOAD_ACCEPT,
} from "./AttachmentManager";
import { ChatToolbar } from "./ChatToolbar";

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
  disablePinning?: boolean;
  disableSources?: boolean;
  onBeforePersonaTest?: () => Promise<string | null>;
}






/**
 * Extract titles from markdown links in content: [link text](url).
 * Returns a map of normalized URL -> title (first occurrence per URL, or longest title if we want to prefer descriptive labels).
 */
function extractTitlesFromContentByUrl(content: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!content || typeof content !== "string") return map;
  const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(content)) !== null) {
    const rawUrl = m[2].trim();
    const key = normalizeUrl(rawUrl);
    const title = m[1].trim();
    if (!title) continue;
    // Prefer first occurrence; optionally prefer longer (more descriptive) title
    const existing = map.get(key);
    if (!existing || title.length > existing.length) map.set(key, title);
  }
  return map;
}

/** URLs of generated file downloads — not web citations. */
function getGeneratedDocumentUrlSet(message: Message): Set<string> {
  const out = new Set<string>();
  const raw = message.metadata?.generatedFiles;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { url?: unknown }).url === "string"
      ) {
        out.add((item as { url: string }).url.trim().toLowerCase());
      }
    }
  }
  const docUrl = message.metadata?.documentUrl;
  if (typeof docUrl === "string" && docUrl.trim()) {
    out.add(docUrl.trim().toLowerCase());
  }
  return out;
}

function filterSourcesExcludingGeneratedDocuments(
  message: Message,
  sources: MessageSource[],
): MessageSource[] {
  const drop = getGeneratedDocumentUrlSet(message);
  if (drop.size === 0) return sources;
  return sources.filter(
    (s) =>
      typeof s.url === "string" && !drop.has(s.url.trim().toLowerCase()),
  );
}

/** Return number of sources for an AI message (from metadata or parsed from content). */
function getMessageSourceCount(message: Message): number {
  if (message.sender !== "ai") return 0;
  const fromMeta = message.metadata?.sources;
  if (fromMeta && Array.isArray(fromMeta) && fromMeta.length > 0) {
    return filterSourcesExcludingGeneratedDocuments(message, fromMeta).length;
  }
  return filterSourcesExcludingGeneratedDocuments(
    message,
    extractSources(message.content ?? "") as MessageSource[],
  ).length;
}

/** Return up to 4 source URLs for an AI message (for favicons on Sources button). */
function getMessageSourceUrls(message: Message): string[] {
  if (message.sender !== "ai") return [];
  const fromMeta = message.metadata?.sources;
  if (fromMeta && Array.isArray(fromMeta) && fromMeta.length > 0) {
    return filterSourcesExcludingGeneratedDocuments(message, fromMeta)
      .slice(0, 4)
      .map((s: { url?: string }) =>
        s && typeof s.url === "string" ? s.url : "",
      )
      .filter(Boolean);
  }
  return filterSourcesExcludingGeneratedDocuments(
    message,
    extractSources(message.content ?? "") as MessageSource[],
  )
    .slice(0, 4)
    .map((s) => s.url);
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
  disablePinning = false,
  disableSources = false,
  onBeforePersonaTest,
}: ChatInterfaceProps) {
  const layoutContext = useContext(AppLayoutContext);
  // Use personas from AppLayout context instead of fetching again
  const activePersonas = layoutContext?.activePersonas ?? [];

  // All chat UI/interaction state centralised in one hook.
  // Must be called before the isMobile guard to preserve hook call order.
  const {
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
    input, setInput,
    referencedMessage, setReferencedMessage,
    replyToMessage, setReplyToMessage,
    mentionedPins, setMentionedPins,
    showPinDropdown, setShowPinDropdown,
    pinSearchQuery, setPinSearchQuery,
    highlightedPinIndex, setHighlightedPinIndex,
    filteredPins,
    attachments, setAttachments,
    showScrollButton, setShowScrollButton,
    showLeftScrollButton, setShowLeftScrollButton,
    showAttachMenu, setShowAttachMenu,
    showPersonaDropdown, setShowPersonaDropdown,
    highlightedPersonaIndex, setHighlightedPersonaIndex,
    selectedPersona, setSelectedPersona,
    webSearchEnabled, setWebSearchEnabled,
    useMistralOcr, setUseMistralOcr,
    showStyleSubmenu, setShowStyleSubmenu,
    selectedTone, setSelectedTone,
    isScrolledToBottom, setIsScrolledToBottom,
    isResponding, setIsResponding,
    isRegeneratingResponse, setIsRegeneratingResponse,
    lastMessageId, setLastMessageId,
    messageToDelete, setMessageToDelete,
    regenerationState, setRegenerationState,
    regeneratePrompt, setRegeneratePrompt,
    isChatDeleteDialogOpen, setIsChatDeleteDialogOpen,
    isDeletingChat, setIsDeletingChat,
    isUploadDialogOpen, setIsUploadDialogOpen,
    uploadFile, setUploadFile,
    handleScrollToBottom,
    handleScroll,
    handleClearReference,
    handleRemoveMention,
    handleSelectPin,
    handleReply,
    handleDeleteRequest,
    clearComposerState,
  } = useChatState({
    activeChatId: layoutContext?.activeChatId,
    availablePins: layoutContext?.pins ?? [],
  });

  const { messageBufferRef, fetchAiResponse, handleStopGeneration } =
    useStreamingChat({
      setMessages,
      layoutContext: layoutContext ?? null,
      personaTestConfig,
      onBeforePersonaTest,
      setIsResponding,
      setLastMessageId,
      setIsRegeneratingResponse,
      webSearchEnabled,
      selectedTone,
      useMistralOcr,
    });

  const processFilesRef = useRef<(files: File[]) => void>(() => {});
  const { isDragging, dropZoneProps, handlePaste } = useFileDrop({
    onFiles: (files) => processFilesRef.current(files),
    disabled: disableInput || hideAttachButton,
  });

  // Paste listener for the whole chat area
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const flowtingLogoUrl = "/new-logos/souvenir-logo.svg";
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
    // When no model is selected, use Flowting logo (framework mode)
    return {
      avatarUrl: flowtingLogoUrl,
      avatarHint: "Flowting AI Framework",
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
  const displayMessages = messages;
  const { user } = useAuth();

  // References panel: from last AI message (metadata.sources or links parsed from content).
  // Prefer source titles extracted from the chat (e.g. [Title](url)) when available; otherwise use generic (API/fetched/hostname).
  const sourcesForPanel = useMemo((): MessageSource[] => {
    let lastAi: Message | null = null;
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      if (displayMessages[i].sender === "ai") {
        lastAi = displayMessages[i];
        break;
      }
    }
    if (!lastAi) return [];
    const content = lastAi.content ?? "";
    const titlesFromChat = extractTitlesFromContentByUrl(content);
    const fromMeta = lastAi.metadata?.sources;
    const rawSources: MessageSource[] =
      fromMeta && fromMeta.length > 0
        ? fromMeta
        : extractSources(content);
    const withoutGenerated = filterSourcesExcludingGeneratedDocuments(
      lastAi,
      rawSources,
    );
    return withoutGenerated.map((s) => {
      const chatTitle = titlesFromChat.get(normalizeUrl(s.url));
      const title = chatTitle?.trim() || s.title?.trim();
      return { ...s, title: title || undefined };
    });
  }, [displayMessages]);

  // Stable key so we only sync when source content actually changes (avoids loop from new array refs).
  const sourcesSyncKey = useMemo(
    () =>
      JSON.stringify(
        sourcesForPanel.map((s) => ({ url: s.url, title: s.title ?? "" })),
      ),
    [sourcesForPanel],
  );

  // Sync references to layout so the right-sidebar References panel can show them.
  // Depend only on sourcesSyncKey (stable string) so we avoid loops from new array refs or context identity.
  useEffect(() => {
    layoutContext?.setReferencesSources(sourcesForPanel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only run when source content (key) changes
  }, [sourcesSyncKey]);


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

  const handleOpenSources = (message: Message) => {
    if (message.sender !== "ai" || !layoutContext) return;

    // Extract sources from the specific message (similar to sourcesForPanel logic)
    const content = message.content ?? "";
    const titlesFromChat = extractTitlesFromContentByUrl(content);
    const fromMeta = message.metadata?.sources;
    const rawSources: MessageSource[] =
      fromMeta && fromMeta.length > 0
        ? fromMeta
        : extractSources(content);

    const filtered = filterSourcesExcludingGeneratedDocuments(
      message,
      rawSources,
    );
    const messageSources = filtered.map((s) => {
      const chatTitle = titlesFromChat.get(normalizeUrl(s.url));
      const title = chatTitle?.trim() || s.title?.trim();
      return { ...s, title: title || undefined };
    });

    // Update the references sources with this specific message's sources
    layoutContext.setReferencesSources(messageSources);

    // Open the references panel
    layoutContext.openReferencesPanel();
  };

  const pinsById = useMemo(() => {
    const entries = (layoutContext?.pins || []).map((p) => [p.id, p]);
    return new Map<string, PinType>(entries as [string, PinType][]);
  }, [layoutContext?.pins]);

  const composerPlaceholder =
    selectedModel || layoutContext?.useFramework
      ? "Let's Play..."
      : "Choose a model or enable framework to start chatting";

  // Active personas are provided by AppLayout context — no duplicate fetch needed.


  // Scroll to bottom when new messages arrive (messages is a prop — kept in component).
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport && isScrolledToBottom) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isScrolledToBottom]);


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

    const streamingAssistantMetadata: Message["metadata"] = {
      webSearchEnabled,
      ...(activeModel
        ? {
            modelName: activeModel.modelName,
            providerName: activeModel.companyName,
            llmModelId: activeModel.modelId ?? activeModel.id ?? null,
          }
        : {}),
    };

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
        id: crypto.randomUUID(),
        sender: "ai",
        isLoading: true,
        content: "",
        avatarUrl: requestAvatar.avatarUrl,
        avatarHint: requestAvatar.avatarHint,
        metadata: { ...streamingAssistantMetadata },
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
      // Clear composer state and attachments after sending (edit path)
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      setAttachments([]);
      clearComposerState();
      layoutContext?.setSelectedPinIdsForNextMessage?.([]);
    } else {
      // This is a new message
      const turnId = crypto.randomUUID();
      const userMessageId = `${turnId}-user`;
      const assistantMessageId = `${turnId}-assistant`;

      // If we don't have a chat id yet, use a temp so UI state works until metadata returns
      if (!chatId) {
        chatId = `temp-${crypto.randomUUID()}`;
        layoutContext?.setActiveChatId?.(chatId);
      }

      // Convert image attachments to base64 data URLs so they persist after blob URLs are revoked
      let persistentAttachments:
        | Array<{
            id: string;
            type: "document" | "image";
            name: string;
            url: string;
          }>
        | undefined;
      if (attachments.length > 0) {
        persistentAttachments = await Promise.all(
          attachments.map(async (a) => {
            if (a.type === "image") {
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(a.file);
              });
              return { id: a.id, type: a.type, name: a.name, url: dataUrl };
            }
            return { id: a.id, type: a.type, name: a.name, url: a.url };
          }),
        );
      }

      const userMessage: Message = {
        id: userMessageId,
        sender: "user",
        content: trimmedContent,
        avatarUrl: selectedPersona?.avatar || "/personas/userAvatar.png",
        avatarHint: selectedPersona?.name || "User",
        metadata: {
          replyToMessageId: replyToMsgId,
          replyToContent: replyToContent,
          attachments: persistentAttachments,
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
        metadata: { ...streamingAssistantMetadata },
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
      // Clear composer state and attachments after sending (new message path)
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      setAttachments([]);
      clearComposerState();
      layoutContext?.setSelectedPinIdsForNextMessage?.([]);
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

  const handleSelectPersona = async (persona: any) => {
    setSelectedPersona(persona);
    setShowPersonaDropdown(false);
    toast.success(`Persona selected: ${persona.name}`);

    // If persona has a modelId, look up from cached models and update selected model in topbar
    if (persona.modelId && layoutContext) {
      try {
        const models = await fetchModelsWithCache();

        // Find the model matching the persona's modelId
        const matchingModel = models.find(
          (m) =>
            String(m.id) === String(persona.modelId) ||
            String(m.modelId) === String(persona.modelId),
        );

        if (matchingModel) {
          // Update the selected model in the topbar
          layoutContext.setSelectedModel(matchingModel);
          layoutContext.setUseFramework(false);
          toast.info(`Switched to ${matchingModel.modelName}`);
        }
      } catch (error) {
        console.error("Failed to fetch models for persona:", error);
        // Don't show error toast - persona is still selected, just model wasn't updated
      }
    }
  };

  const handleAddNewPersona = () => {
    setShowPersonaDropdown(false);
    // Navigate to persona creation - adjust URL as needed
    window.location.href = "/personas/new";
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
    // Reset the input so the same files can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFiles = (files: File[]) => {
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const filesToAdd: Array<{
      id: string;
      type: "document" | "image";
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
      const isDocument = isDocumentFile(file);
      const isImage = file.type.startsWith("image/");

      if (!isDocument) {
        toast.error(`${file.name} not supported`, {
          description: "Please upload PDF, Word, PowerPoint, CSV, Excel, or image files only.",
        });
        continue;
      }

      const attachmentId = crypto.randomUUID();
      const objectUrl = URL.createObjectURL(file);

      filesToAdd.push({
        id: attachmentId,
        type: isImage ? "image" : "document",
        name: file.name,
        url: objectUrl,
        file: file,
        isUploading: true,
        uploadProgress: 0,
      });
    }

    if (filesToAdd.length === 0) {
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
  };
  processFilesRef.current = processFiles;

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

  const handleUploadDocument = () => {
    if (!uploadFile) {
      toast.error("Choose a file", {
        description: "Select a document to upload.",
      });
      return;
    }

    const isDocument = isDocumentFile(uploadFile);
    const isImage = uploadFile.type.startsWith("image/");

    if (!isDocument) {
      toast.error(`${uploadFile.name} not supported`, {
        description: "Please upload PDF, Word, PowerPoint, CSV, Excel, or image files only.",
      });
      return;
    }

    const attachmentId = crypto.randomUUID();
    const objectUrl = URL.createObjectURL(uploadFile);
    setAttachments((prev) => [
      ...prev,
      {
        id: attachmentId,
        type: isImage ? "image" : "document",
        name: uploadFile.name,
        url: objectUrl,
        file: uploadFile,
        isUploading: false,
        uploadProgress: 100,
      },
    ]);

    toast("File attached", {
      description: `${uploadFile.name} will be sent with your next message.`,
    });
    setIsUploadDialogOpen(false);
    setUploadFile(null);
  };

  const handlePin = async (message: Message) => {
    if (!layoutContext || !layoutContext.activeChatId) return;

    const identifier = normalizeUuidReference(
      message.chatMessageId ?? message.id,
    );
    if (!identifier) {
      toast.error("Unable to pin", {
        description:
          "This response is still syncing. Please wait a moment and try again.",
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

      const response = await fetch(
        DELETE_MESSAGE_ENDPOINT(identifier),
        {
          method: "DELETE",
          headers: getAuthHeaders(headers),
          credentials: "include",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          friendlyApiError(errorText || "Failed to delete message", response.status),
        );
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
      const msg = error instanceof Error ? error.message : "Unable to delete message.";
      toast.error("Delete failed", {
        description: friendlyApiError(msg),
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

      const response = await fetch(CHATS_ENDPOINT, {
        method: "DELETE",
        headers: getAuthHeaders(headers),
        credentials: "include",
        body: JSON.stringify({ chat_id: chatId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          friendlyApiError(errorText || "Failed to delete chat", response.status),
        );
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
      const msg = error instanceof Error ? error.message : "Unable to delete chat.";
      toast.error("Delete failed", {
        description: friendlyApiError(msg),
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
    <div
      className="relative flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-white"
      {...dropZoneProps}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm border-2 border-dashed border-[#7c6fcd] rounded-2xl pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-[#7c6fcd]" />
            <span className="text-sm font-medium text-[#7c6fcd]">Drop files here to attach</span>
          </div>
        </div>
      )}
      {/* Empty state: centered prompt box */}
      {displayMessages.length === 0 ? (
        <section className="flex flex-1 items-center justify-center bg-white px-4 py-8">
          {customEmptyState || (
            <InitialPrompts firstName={user?.firstName ?? user?.name ?? null} />
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
                            flowtingLogoUrl,
                          avatarHint:
                            msg.avatarHint ||
                            metadataAvatar?.avatarHint ||
                            "Flowting AI",
                        }
                      : msg;

                  const messageAttachments =
                    msg.sender === "user" && msg.metadata?.attachments;
                  // Build pin cards from mentionedPins (in-session) or fall back to
                  // pinIds + pinsById (loaded from history where backend sends bare IDs)
                  const messagePins: Array<{ id: string; label: string; text: string }> | false =
                    msg.sender === "user" &&
                    (() => {
                      if (msg.metadata?.mentionedPins?.length) {
                        return msg.metadata.mentionedPins.map((mp) => ({
                          id: mp.id,
                          label: mp.label,
                          text: mp.text ?? "",
                        }));
                      }
                      const ids = msg.metadata?.pinIds ?? [];
                      if (ids.length === 0) return false;
                      return ids.map((id) => {
                        const pin = pinsById.get(id);
                        const text = pin?.text ?? "";
                        return {
                          id,
                          label: pin ? stripMarkdown(text).slice(0, 80) || id : id,
                          text,
                        };
                      });
                    })();

                  return (
                    <div key={msg.id} className="flex flex-col gap-2">
                      {/* Display pinned message attachments above user message */}
                      {messagePins && messagePins.length > 0 && (
                        <div className="flex gap-2 flex-wrap ml-auto max-w-[85%]">
                          {messagePins.map((pin: any) => {
                            const pinText = stripMarkdown(
                              pin.text || pin.label,
                            );
                            const displayText =
                              pinText.length > 80
                                ? pinText.slice(0, 80) + "..."
                                : pinText;
                            const pinColor = getPinSeparatorColor(pin.id);

                            return (
                              <div
                                key={pin.id}
                                className="group relative shrink-0 flex items-center gap-2.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] p-1.5 overflow-hidden cursor-pointer hover:bg-[#F5F5F5] transition-colors"
                                style={{
                                  minWidth: "180px",
                                  maxWidth: "280px",
                                  height: "60px",
                                }}
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
                        <div className="flex gap-2 flex-wrap justify-end mx-auto w-full max-w-[756px]">
                          {messageAttachments.map((attachment: any) =>
                            attachment.type !== "image" ? (
                              <a
                                key={attachment.id}
                                href={sanitizeURL(attachment.url ?? "")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative shrink-0 flex items-center gap-2.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] p-1.5 overflow-hidden no-underline cursor-pointer transition-colors hover:bg-[#F0F0F0]"
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
                                    {getDocumentKindLabel(String(attachment.name ?? ""))}
                                  </p>
                                </div>
                              </a>
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
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={attachment.url}
                                  alt={attachment.name}
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
                        onOpenSources={
                          !disableSources && msg.sender === "ai"
                            ? () => handleOpenSources(msg)
                            : undefined
                        }
                        sourceCount={getMessageSourceCount(msg)}
                        sourceUrls={getMessageSourceUrls(msg)}
                        onSuggestionSelect={
                          msg.sender === "ai"
                            ? (suggestion) => {
                                const trimmedSuggestion = suggestion.trim();
                                if (!trimmedSuggestion || isResponding) return;
                                void handleSend(trimmedSuggestion);
                              }
                            : undefined
                        }
                        disablePinning={disablePinning}
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
          <PinMentionDropdown
            show={showPinDropdown}
            filteredPins={filteredPins}
            pinSearchQuery={pinSearchQuery}
            highlightedPinIndex={highlightedPinIndex}
            setHighlightedPinIndex={setHighlightedPinIndex}
            onSelectPin={handleSelectPin}
            dropdownRef={dropdownRef}
            pinDropdownScrollRef={pinDropdownScrollRef}
            pinItemRefs={pinItemRefs}
            customScrollbarClass={chatStyles.customScrollbar}
          />

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

            <AttachmentManager
              attachments={attachments}
              onRemoveAttachment={(id, url) => {
                URL.revokeObjectURL(url);
                setAttachments((prev) => prev.filter((a) => a.id !== id));
              }}
              attachmentScrollRef={attachmentScrollRef}
              showLeftScrollButton={showLeftScrollButton}
              showScrollButton={showScrollButton}
              setShowLeftScrollButton={setShowLeftScrollButton}
              setShowScrollButton={setShowScrollButton}
            />

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
                      : "Use @ to attach your saved pins .... "
                  }
                  className="min-h-[40px] w-full resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-relaxed text-[#1E1E1E] placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-light-grey shadow-none!"
                  rows={1}
                  disabled={isResponding || disableInput}
                />
              </div>

              {/* Action buttons row */}
              <ChatToolbar
                hideAttachButton={hideAttachButton}
                showAttachMenu={showAttachMenu}
                setShowAttachMenu={setShowAttachMenu}
                attachMenuRef={attachMenuRef}
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
                onAttachClick={handleAttachClick}
                webSearchEnabled={webSearchEnabled}
                setWebSearchEnabled={setWebSearchEnabled}
                useMistralOcr={useMistralOcr}
                setUseMistralOcr={setUseMistralOcr}
                canUseMistralOcr={canAccessFeature(user?.planType, "mistralOcr")}
                showStyleSubmenu={showStyleSubmenu}
                setShowStyleSubmenu={setShowStyleSubmenu}
                selectedTone={selectedTone}
                setSelectedTone={setSelectedTone}
                styleSubmenuTimeout={styleSubmenuTimeout}
                hidePersonaButton={hidePersonaButton}
                showPersonaDropdown={showPersonaDropdown}
                setShowPersonaDropdown={setShowPersonaDropdown}
                personaDropdownRef={personaDropdownRef}
                activePersonas={activePersonas}
                selectedPersona={selectedPersona}
                highlightedPersonaIndex={highlightedPersonaIndex}
                setHighlightedPersonaIndex={setHighlightedPersonaIndex}
                onSelectPersona={handleSelectPersona}
                onAddNewPersona={handleAddNewPersona}
                isResponding={isResponding}
                onStopGeneration={handleStopGeneration}
                input={input}
                onSend={handleSend}
                selectedModel={selectedModel}
                useFramework={layoutContext?.useFramework ?? false}
                disableInput={disableInput}
              />
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
          if (!open) setIsUploadDialogOpen(false);
        }}
      >
        <DialogContent className="rounded-[8px]">
          <DialogHeader>
            <DialogTitle>Attach document</DialogTitle>
            <DialogDescription>
              Select a PDF, Word, PowerPoint, CSV, Excel, or image file to attach to your next message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chat-upload-file">File</Label>
              <Input
                id="chat-upload-file"
                type="file"
                accept={DOCUMENT_UPLOAD_ACCEPT}
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
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-[8px]"
              onClick={() => setIsUploadDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-[8px]"
              onClick={handleUploadDocument}
              disabled={!uploadFile}
            >
              Attach
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
        <AlertDialogContent className="rounded-[8px] bg-white border border-[#D4D4D4]">
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
              className="rounded-[8px] bg-white border border-[#D4D4D4] text-black hover:bg-[#f5f5f5]"
              onClick={() => setIsChatDeleteDialogOpen(false)}
              disabled={isDeletingChat}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[8px] bg-white border border-[#D4D4D4] text-red-600 hover:bg-[#f5f5f5]"
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
        <AlertDialogContent className="rounded-[8px] bg-white border border-[#D4D4D4]">
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
              className="rounded-[8px] bg-white border border-[#D4D4D4] text-black hover:bg-[#f5f5f5]"
              onClick={() => setMessageToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[8px] bg-white border border-[#D4D4D4] text-red-600 hover:bg-[#f5f5f5]"
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
