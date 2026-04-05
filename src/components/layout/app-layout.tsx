"use client";
import type { ReactNode } from "react";
import React, {
  Suspense,
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
import CompareModelsPage from "../compare/compare-models";
import { ModelSwitchDialog, type ModelSwitchConfig } from "../chat/model-switch-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, MessageSource } from "../chat/chat-message";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import type { AIModel } from "@/types/ai-model";
import {
  createChat,
  fetchChatBoards,
  fetchChatMessages,
  renameChat,
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
import { CHATS_ENDPOINT, CHAT_STAR_ENDPOINT, API_BASE_URL } from "@/lib/config";
import { toast } from "@/lib/toast-helper";
import { extractThinkingContent } from "@/lib/thinking";
import { fetchPersonas as fetchPersonasApi, type BackendPersona } from "@/lib/api/personas";

interface AppLayoutProps {
  children: React.ReactElement;
}

export type Persona = {
  id: string;
  name: string;
  avatar: string | null;
  prompt: string;
  modelId: string | number | null;
  modelName: string | null;
  providerName: string | null;
  status: "active" | "paused";
};

export type ChatMetadata = {
  messageCount?: number | null;
  lastMessageAt?: string | null;
  pinCount?: number | null;
  starred?: boolean | null;
  starMessageId?: string | number | null;
};

export type ChatBoardType = "chat" | "persona" | "workflow";

export type ChatBoard = {
  id: string;
  name: string;
  time: string;
  isStarred: boolean;
  pinCount: number;
  type?: ChatBoardType;
  metadata?: ChatMetadata;
};

type ChatHistory = Record<string, Message[]>;

export type RightSidebarPanel = "pinboard" | "files" | "personas" | "compare" | "references";

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
  handleAddChat: (typeOverride?: ChatBoardType | null) => void;
  ensureChatOnServer: (
    options: EnsureChatOptions
  ) => Promise<EnsureChatResult | null>;
  selectedModel: AIModel | null;
  moveChatToTop: (chatId: string) => void;
  setSelectedModel: React.Dispatch<React.SetStateAction<AIModel | null>>;
  useFramework: boolean;
  setUseFramework: React.Dispatch<React.SetStateAction<boolean>>;
  // Selected pins from model switch dialog to include with next message
  selectedPinIdsForNextMessage: string[];
  setSelectedPinIdsForNextMessage: React.Dispatch<React.SetStateAction<string[]>>;
  // References panel (sources/citations from chat)
  referencesSources: MessageSource[];
  setReferencesSources: React.Dispatch<React.SetStateAction<MessageSource[]>>;
  /** Open the right sidebar with the References (Sources) panel. Called from Sources button on AI messages. */
  openReferencesPanel: () => void;
  /** Update a chat board title with typewriter animation effect */
  updateChatTitleWithAnimation: (chatId: string, newTitle: string) => void;
  /** Get the currently animating title for a chat (if any) */
  getAnimatingTitle: (chatId: string) => { targetTitle: string; timestamp: number } | null;
  /** Re-fetch a single chat from the backend and update its title (used after async title generation) */
  refreshChatTitle: (chatId: string) => void;
  // Active personas (fetched once and shared across components)
  activePersonas: Persona[];
  setActivePersonas: React.Dispatch<React.SetStateAction<Persona[]>>;
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

const normalizeChatBoard = (chat: BackendChat, defaultType: ChatBoardType = "chat"): ChatBoard => {
  const lastMessageAt = chat.updated_at || chat.created_at || null;
  let metadata =
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

  // Extract type from chat object or use default
  const chatType = (chat as { type?: ChatBoardType }).type || 
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
    pinCount: metadata?.pinCount ?? chat.pins_count ?? chat.pin_count ?? chat.pinCount ?? 0,
    type: chatType,
    metadata,
  };
};

const extractMetadata = (msg: BackendMessage) => {
  const meta = (msg as { metadata?: Record<string, unknown> }).metadata || {};
  type WebSearchPayload = { query: string; links: string[] };

  const toOptionalTrimmedString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeWebSearchPayload = (raw: unknown): WebSearchPayload | null => {
    if (!raw || typeof raw !== "object") return null;
    const payload = raw as Record<string, unknown>;
    const query =
      toOptionalTrimmedString(payload.query) ??
      toOptionalTrimmedString(payload.search_query) ??
      toOptionalTrimmedString(payload.searchQuery) ??
      "";
    if (!query) return null;

    const rawLinks = Array.isArray(payload.links)
      ? payload.links
      : Array.isArray(payload.urls)
        ? payload.urls
        : Array.isArray(payload.results)
          ? payload.results
          : [];

    const links = rawLinks
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const url =
            toOptionalTrimmedString(obj.url) ??
            toOptionalTrimmedString(obj.link) ??
            "";
          return url;
        }
        return "";
      })
      .filter(Boolean);

    return { query, links };
  };

  const normalizeWebSearchInput = (
    raw: unknown,
  ): WebSearchPayload | WebSearchPayload[] | undefined => {
    if (!raw) return undefined;
    if (Array.isArray(raw)) {
      const items = raw
        .map((entry) => normalizeWebSearchPayload(entry))
        .filter((item): item is WebSearchPayload => Boolean(item));
      return items.length > 0 ? items : undefined;
    }
    return normalizeWebSearchPayload(raw) ?? undefined;
  };
  const pinsRaw: unknown[] = Array.isArray(
    (msg as { taggedPins?: unknown[] }).taggedPins
  )
    ? ((msg as { taggedPins: unknown[] }).taggedPins as unknown[])
    : Array.isArray((msg as { pins_tagged?: unknown[] }).pins_tagged)
    ? ((msg as { pins_tagged: unknown[] }).pins_tagged as unknown[])
    : Array.isArray((msg as { pin_ids?: unknown[] }).pin_ids)
    ? ((msg as { pin_ids: unknown[] }).pin_ids as unknown[])
    : Array.isArray((meta as { pinIds?: unknown[] }).pinIds)
    ? ((meta as { pinIds: unknown[] }).pinIds as unknown[])
    : Array.isArray((meta as { pin_ids?: unknown[] }).pin_ids)
    ? ((meta as { pin_ids: unknown[] }).pin_ids as unknown[])
    : [];

  // pins_tagged may be full pin objects {id, text, title, ...} or plain ID strings
  const extractPinId = (p: unknown): string | null => {
    if (p === undefined || p === null) return null;
    if (typeof p === "string" || typeof p === "number") return String(p) || null;
    if (typeof p === "object") {
      const o = p as Record<string, unknown>;
      const id = o.id ?? o.pin_id ?? o.pinId;
      return id !== undefined && id !== null ? String(id) : null;
    }
    return null;
  };

  const pinIds = pinsRaw
    .map(extractPinId)
    .filter((p): p is string => Boolean(p));

  // Rebuild mentionedPins so pin-attachment cards re-render in loaded history.
  // Only built when pins_tagged/taggedPins contains full objects (with text/title), not bare IDs.
  const rawPinsTagged: unknown[] = Array.isArray(
    (msg as { taggedPins?: unknown[] }).taggedPins
  )
    ? ((msg as { taggedPins: unknown[] }).taggedPins as unknown[])
    : Array.isArray((msg as { pins_tagged?: unknown[] }).pins_tagged)
    ? ((msg as { pins_tagged: unknown[] }).pins_tagged as unknown[])
    : [];

  const mentionedPins: Array<{ id: string; label: string; text: string }> = rawPinsTagged
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const o = p as Record<string, unknown>;
      const id = extractPinId(p);
      if (!id) return null;
      const text = String(o.text ?? o.content ?? o.formattedContent ?? "");
      const label = String(o.title ?? o.label ?? text).slice(0, 80) || id;
      return { id, label, text };
    })
    .filter((p): p is { id: string; label: string; text: string } => p !== null);

  const webSearchRaw =
    (msg as { web_search?: unknown }).web_search ??
    (msg as { webSearch?: unknown }).webSearch ??
    (msg as { web_searches?: unknown }).web_searches ??
    (msg as { webSearches?: unknown }).webSearches ??
    (meta as { web_search?: unknown }).web_search ??
    (meta as { webSearch?: unknown }).webSearch ??
    (meta as { web_searches?: unknown }).web_searches ??
    (meta as { webSearches?: unknown }).webSearches ??
    null;
  const webSearch = normalizeWebSearchInput(webSearchRaw);
  const webSearchEnabled =
    (msg as { web_search_enabled?: unknown }).web_search_enabled ??
    (msg as { webSearchEnabled?: unknown }).webSearchEnabled ??
    (meta as { web_search_enabled?: unknown }).web_search_enabled ??
    (meta as { webSearchEnabled?: unknown }).webSearchEnabled ??
    undefined;

  return {
    modelName:
      (msg as { model_name?: string }).model_name ??
      (msg as { modelName?: string }).modelName ??
      (msg as { llm_model_name?: string }).llm_model_name ??
      (meta as { modelName?: string }).modelName ??
      (meta as { model_name?: string }).model_name ??
      (meta as { llm_model_name?: string }).llm_model_name,
    providerName:
      (msg as { provider_name?: string }).provider_name ??
      (msg as { providerName?: string }).providerName ??
      (msg as { company_name?: string }).company_name ??
      (msg as { companyName?: string }).companyName ??
      (meta as { providerName?: string }).providerName ??
      (meta as { provider_name?: string }).provider_name ??
      (meta as { companyName?: string }).companyName ??
      (meta as { company_name?: string }).company_name,
    llmModelId:
      (msg as { llm_model_id?: string | number | null }).llm_model_id ??
      (meta as { llmModelId?: string | number | null }).llmModelId ??
      (meta as { llm_model_id?: string | number | null }).llm_model_id ??
      null,
    inputTokens:
      (msg as { tokens_input?: number }).tokens_input ??
      (msg as { input_tokens?: number }).input_tokens ??
      (meta as { inputTokens?: number }).inputTokens ??
      (meta as { input_tokens?: number }).input_tokens,
    outputTokens:
      (msg as { tokens_output?: number }).tokens_output ??
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
    mentionedPins: mentionedPins.length > 0 ? mentionedPins : undefined,
    ...(webSearch ? { webSearch } : {}),
    ...(webSearchEnabled !== undefined
      ? { webSearchEnabled: Boolean(webSearchEnabled) }
      : {}),
    userReaction:
      (msg as { user_reaction?: string | null }).user_reaction ??
      (meta as { userReaction?: string | null }).userReaction ??
      (meta as { user_reaction?: string | null }).user_reaction ??
      null,
    cost: (() => {
      const raw = (msg as { cost?: number | string }).cost ?? (meta as { cost?: number | string }).cost;
      if (raw === undefined || raw === null) return undefined;
      const n = typeof raw === "number" ? raw : parseFloat(raw as string);
      return isNaN(n) ? undefined : n;
    })(),
    latencyMs:
      (msg as { latency_ms?: number }).latency_ms ??
      (meta as { latencyMs?: number }).latencyMs ??
      (meta as { latency_ms?: number }).latency_ms,
  };
};

const normalizeBackendMessage = (msg: BackendMessage): Message => {
  const senderRaw = (msg.sender || msg.role || "user").toLowerCase();
  const sender: Message["sender"] =
    senderRaw === "ai" || senderRaw === "assistant" ? "ai" : "user";
  const baseContent =
    msg.content ||
    msg.message ||
    msg.output ||
    msg.input ||
    (msg as { response?: string }).response ||
    (msg as { prompt?: string }).prompt ||
    "";
  const { visibleText, thinkingText } =
    sender === "ai"
      ? extractThinkingContent(baseContent)
      : { visibleText: baseContent, thinkingText: null };
  // Use dedicated reasoning field from backend if available, fallback to <think> tag extraction
  const backendReasoning =
    (msg as { reasoning?: string | null }).reasoning ??
    (msg as { thinking_content?: string | null }).thinking_content ??
    null;
  const finalReasoning = backendReasoning || thinkingText;
  const metadata: Message["metadata"] = extractMetadata(msg);
  // Parse attachments from backend
  const rawAttachments = (msg as { attachments?: unknown[] }).attachments;
  if (Array.isArray(rawAttachments) && rawAttachments.length > 0 && metadata) {
    metadata.attachments = rawAttachments
      .filter((a): a is Record<string, unknown> => a !== null && typeof a === "object")
      .map((a, i) => ({
        id: String(a.id ?? `att-${i}`),
        type: (String(a.type ?? a.file_type ?? "image").startsWith("image") ||
               String(a.name ?? a.file_name ?? "").match(/\.(png|jpe?g|gif|webp|svg|bmp)$/i))
          ? "image" as const
          : "pdf" as const,
        name: String(a.name ?? a.file_name ?? a.filename ?? "attachment"),
        url: String(a.url ?? a.file_url ?? a.file ?? ""),
      }))
      .filter((a) => a.url);
  }
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
    thinkingContent: finalReasoning,
    isThinkingInProgress: false,
    metadata,
    chatMessageId:
      rawId !== null && rawId !== undefined ? String(rawId) : undefined,
    referencedMessageId:
      (msg as BackendMessage).reference_id ??
      (msg as { referenced_message_id?: string | null })
        .referenced_message_id ?? null,
  };
};

const extractUserAttachmentsFromEntry = (
  entry: BackendMessage,
): Array<{ id: string; type: "pdf" | "image"; name: string; url: string }> => {
  const out: Array<{ id: string; type: "pdf" | "image"; name: string; url: string }> = [];

  const addAttachment = (
    url: unknown,
    fallbackType: "pdf" | "image",
    index: number,
  ) => {
    if (typeof url !== "string" || url.trim().length === 0) return;
    const cleanUrl = url.trim();
    const lowerUrl = cleanUrl.toLowerCase();
    const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(lowerUrl);
    const isPdf = /\.pdf(\?|$)/.test(lowerUrl);
    const type: "pdf" | "image" = isImage
      ? "image"
      : isPdf
        ? "pdf"
        : fallbackType;
    out.push({
      id: `att-${index}-${type}`,
      type,
      name: type === "image" ? `Image ${index + 1}` : `Document ${index + 1}`,
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
  if (normalized === "uploaded" || normalized === "upload" || normalized === "user") {
    return "uploaded";
  }
  return null;
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
          const mimeType = typeof mimeRaw === "string" ? mimeRaw.trim() : undefined;
          const origin = getAttachmentOrigin(file.origin);
          const rawName = file.file_name ?? file.fileName ?? file.name;
          const name = typeof rawName === "string" && rawName.trim().length > 0
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
        (item.isImage ? `Image ${index + 1}` : `Document ${index + 1}`),
      url: item.url,
    }));

  const generatedImages = parsed
    .filter((item) => item.origin === "generated" && item.isImage)
    .map((item) => ({
      url: item.url,
      alt: item.name,
    }));

  const generatedDocuments = parsed
    .filter((item) => item.origin === "generated" && !item.isImage)
    .map((item, index) => ({
      url: item.url,
      filename: item.name || `Document ${index + 1}`,
      mimeType: item.mimeType,
    }));

  return {
    userAttachments,
    generatedImages,
    generatedDocuments,
  };
};

const getImagesFromBackendMessage = (
  entry: BackendMessage,
): { images?: Array<{ url: string; alt?: string }>; imageUrl?: string } => {
  const fileAttachments = extractFileAttachmentsFromEntry(entry);
  if (fileAttachments.generatedImages.length > 0) {
    return { images: fileAttachments.generatedImages };
  }

  // New API: generated_images is an array of model-produced image URLs
  const generatedImages = entry.generated_images;
  if (Array.isArray(generatedImages) && generatedImages.length > 0) {
    const images = generatedImages
      .filter((url): url is string => typeof url === "string" && url.length > 0)
      .map((url) => ({ url }));
    if (images.length > 0) return { images };
  }
  // Legacy: images array or single image_url
  const raw = (entry as Record<string, unknown>).images;
  if (Array.isArray(raw) && raw.length > 0) {
    return {
      images: raw.map((img: unknown) => {
        if (typeof img === "string") return { url: img };
        if (img && typeof img === "object" && "url" in img)
          return { url: String((img as { url: string }).url), alt: (img as { alt?: string }).alt };
        return { url: "" };
      }).filter((img) => img.url),
    };
  }
  const singleUrl =
    (entry as Record<string, unknown>).image_url ??
    (entry as Record<string, unknown>).imageUrl;
  if (typeof singleUrl === "string" && singleUrl) {
    return { imageUrl: singleUrl };
  }
  return {};
};

const convertBackendEntryToMessages = (entry: BackendMessage): Message[] => {
  // New API: input = user message, output = AI response
  // Legacy API: prompt = user message, response = AI response
  const userText = entry.input ?? (entry as { prompt?: string }).prompt;
  const aiText = entry.output ?? (entry as { response?: string }).response;

  const hasPrompt = typeof userText === "string" && userText.length > 0;
  const hasResponse = typeof aiText === "string" && aiText.length > 0;
  const { images: entryImages, imageUrl: entryImageUrl } = getImagesFromBackendMessage(entry);
  const {
    userAttachments: uploadedFileAttachments,
    generatedDocuments,
  } = extractFileAttachmentsFromEntry(entry);
  const hasImages = !!(entryImages?.length || entryImageUrl);

  if (!hasPrompt && !hasResponse && !hasImages) {
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
    const priorSources =
      (promptMetadata?.sources as MessageSource[] | undefined) || [];
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
        sanitized.visibleText ||
        (responseReasoning ? "" : (aiText as string)),
      thinkingContent: responseReasoning,
      isThinkingInProgress: false,
      chatMessageId,
      pinId,
      metadata: aiMetadata,
      referencedMessageId: entry.reference_id ?? entry.referenced_message_id ?? null,
      ...(images && { images }),
      ...(imageUrl && !images && { imageUrl }),
    });
  }

  return messages;
};

const backendPinToLegacy = (
  pin: BackendPin,
  fallback?: Partial<PinType>
): PinType => {
  const toTagStrings = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((tag) => {
        if (typeof tag === "string") return tag.trim();
        if (!tag || typeof tag !== "object") return "";
        const candidate = tag as {
          tag_name?: unknown;
          name?: unknown;
          label?: unknown;
          text?: unknown;
        };
        const value =
          candidate.tag_name ?? candidate.name ?? candidate.label ?? candidate.text;
        return typeof value === "string" ? value.trim() : "";
      })
      .filter((tag) => tag.length > 0);
  };

  const toCommentStrings = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((comment) => {
        if (typeof comment === "string") return comment.trim();
        if (!comment || typeof comment !== "object") return "";
        const candidate = comment as {
          comment_text?: unknown;
          text?: unknown;
          content?: unknown;
        };
        const value = candidate.comment_text ?? candidate.text ?? candidate.content;
        return typeof value === "string" ? value.trim() : "";
      })
      .filter((comment) => comment.length > 0);
  };

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
    (pin as { message_id?: string | null }).message_id ??
    (pin as { messageId?: string | null }).messageId ??
    fallback?.sourceMessageId ??
    fallback?.messageId ??
    null;
  const resolvedTitle =
    (pin as { title?: string | null }).title ??
    (pin as { pins_title?: string | null }).pins_title ??
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
    text: resolvedText, // Full content, not just title
    title: resolvedTitle,
    tags: toTagStrings(pin.tags).length > 0 ? toTagStrings(pin.tags) : (fallback?.tags ?? []),
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
      toCommentStrings((pin as { comments?: unknown[] }).comments).length > 0
        ? toCommentStrings((pin as { comments?: unknown[] }).comments)
        : (fallback?.comments ?? []),
  };
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('leftSidebarCollapsed');
    if (stored === 'true') {
      setIsLeftSidebarCollapsed(true);
    }
  }, []);
  const [activeRightSidebarPanel, setActiveRightSidebarPanel] =
    useState<RightSidebarPanel | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [useFramework, setUseFramework] = useState(true);
  const [selectedPinIdsForNextMessage, setSelectedPinIdsForNextMessage] = useState<string[]>([]);
  const [referencesSources, setReferencesSources] = useState<MessageSource[]>([]);
  const [pendingModelFromCompare, setPendingModelFromCompare] = useState<AIModel | null>(null);
  const [isModelSwitchConfirmOpen, setIsModelSwitchConfirmOpen] = useState(false);
  const [activePersonas, setActivePersonas] = useState<Persona[]>([]);

  const [pins, setPins_] = useState<PinType[]>([]);
  const [pinsChatId, setPinsChatId] = useState<string | null>(null);
  const [chatBoards, setChatBoards_] = useState<ChatBoard[]>([]);
  const [activeChatId, setActiveChatId_] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistory>({});
  // Track chat boards with animating titles: chatId -> { targetTitle, timestamp }
  const [animatingTitles, setAnimatingTitles] = useState<Map<string, { targetTitle: string; timestamp: number }>>(new Map());
  const pathname = usePathname();
  const router = useRouter();

  // Handle model selection from compare page
  const handleModelSelectFromCompare = (model: AIModel) => {
    // Check if there's a current model and if there are messages in the active chat
    const hasMessages = activeChatId && chatHistory[activeChatId] && chatHistory[activeChatId].length > 0;
    const isDifferentModel = selectedModel && selectedModel.modelName !== model.modelName;

    if (hasMessages && isDifferentModel) {
      // Store the pending model and close compare dialog
      setPendingModelFromCompare(model);
      setIsCompareModalOpen(false);
      // Confirmation dialog will open via useEffect below
    } else {
      // No messages or same model, just switch
      setUseFramework(false);
      setSelectedModel(model);
      setIsCompareModalOpen(false);
    }
  };

  const handleConfirmModelSwitch = (config: ModelSwitchConfig) => {
    setUseFramework(false);
    setSelectedModel(config.model);
    setPendingModelFromCompare(null);
    // TODO: Handle additional config like chatMemory, includePins, includeFiles if needed
  };

  // Open confirmation dialog after compare dialog closes
  useEffect(() => {
    if (pendingModelFromCompare && !isCompareModalOpen) {
      // Use a small delay to ensure compare dialog is fully closed
      const timer = setTimeout(() => {
        setIsModelSwitchConfirmOpen(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pendingModelFromCompare, isCompareModalOpen]);

  // Persist left sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('leftSidebarCollapsed', isLeftSidebarCollapsed.toString());
  }, [isLeftSidebarCollapsed]);

  // Persist active chat ID so page refresh restores the same chat
  useEffect(() => {
    if (activeChatId && !activeChatId.startsWith('temp-')) {
      localStorage.setItem('activeChatId', activeChatId);
    }
  }, [activeChatId]);

  // setActiveChatId without automatic reordering - chats only move to top when messages are sent
  const setActiveChatId = useCallback(
    (id: string | null | ((prev: string | null) => string | null)) => {
      setActiveChatId_((prevId) => {
        const nextId = typeof id === "function" ? id(prevId) : id;
        return nextId;
      });
    },
    []
  );

  // Move a specific chat to the top of the list (called when messages are sent)
  const moveChatToTop = useCallback((chatId: string) => {
    setChatBoards_((prevBoards) => {
      const chatIndex = prevBoards.findIndex((board) => board.id === chatId);
      if (chatIndex > 0) {
        const reordered = [...prevBoards];
        const [selectedChat] = reordered.splice(chatIndex, 1);
        return [selectedChat, ...reordered];
      }
      return prevBoards;
    });
  }, []);

  // Update chat title with animation - trigger typewriter effect in sidebar
  const updateChatTitleWithAnimation = useCallback((chatId: string, newTitle: string) => {
    // First update the actual chat board with the new title immediately
    setChatBoards_((prev) =>
      prev.map((board) =>
        board.id === chatId ? { ...board, name: newTitle } : board
      )
    );

    // Then trigger the animation by storing the target title with a timestamp
    setAnimatingTitles((prev) => {
      const next = new Map(prev);
      next.set(chatId, { targetTitle: newTitle, timestamp: Date.now() });
      return next;
    });
  }, []);

  // Fetch a single chat from the backend and update its title in the sidebar.
  // Called after the SSE stream ends to pick up titles generated asynchronously.
  const refreshChatTitle = useCallback((chatId: string) => {
    if (!chatId || chatId.startsWith("temp-")) return;
    void apiFetch(`/chats/${chatId}/`, { method: "GET" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { title?: string; name?: string };
        const title = (data?.title || data?.name || "").trim();
        if (title) updateChatTitleWithAnimation(chatId, title);
      })
      .catch(() => { /* silently ignore */ });
  }, [updateChatTitleWithAnimation]);

  // Get animating title info for a specific chat
  const getAnimatingTitle = useCallback((chatId: string) => {
    return animatingTitles.get(chatId) ?? null;
  }, [animatingTitles]);

  const [chatToDelete, setChatToDelete] = useState<ChatBoard | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [isDeletingChatBoard, setIsDeletingChatBoard] = useState(false);
  const [isRenamingChatBoard, setIsRenamingChatBoard] = useState(false);
  const hasStartedNewChatAfterLoginRef = useRef(false);
  const [starUpdatingChatId, setStarUpdatingChatId] = useState<string | null>(
    null
  );

  const isMobile = useIsMobile();
  const isChatRoute = pathname === "/";
  const isPersonasRoute =
    pathname?.startsWith("/personas") || pathname?.startsWith("/personas/admin");
  const isWorkflowChatRoute = !!pathname?.match(/^\/workflows\/[^/]+\/chat/);
  const isWorkflowAdminOverviewRoute = pathname === "/workflows/admin";
  const isPersonaChatRoute = !!pathname?.match(/^\/personas\/[^/]+\/chat/);
  const isSettingsSectionRoute = pathname?.startsWith("/settings");
  const { user, isAuthenticated } = useAuth();
  const hasFetchedChats = useRef(false);
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  // Drop legacy per-browser pins cache (was shown after logout / account switch).
  useEffect(() => {
    try {
      localStorage.removeItem("chat-pins-cache");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setPins_([]);
      setPinsChatId(null);
    }
  }, [isAuthenticated]);

  const setPins = useCallback(
    (updater: PinType[] | ((prev: PinType[]) => PinType[])) => {
      setPins_((prev) =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    []
  );

  useEffect(() => {
    if (renamingChatId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingChatId]);

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
        toast("Chat deleted", {
          description: "This chat board has been removed.",
        });
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
      await loadChatBoards(true); // Force reload after delete
      toast("Chat deleted", {
        description: "This chat board has been removed.",
      });
    } catch (error) {
      console.error("Failed to delete chat board", error);
      toast.error("Delete failed", {
        description:
          error instanceof Error ? error.message : "Unable to delete chat.",
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

  const loadChatBoards = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      console.debug("[loadChatBoards] Skipped: Not authenticated");
      return;
    }
    // Skip if already fetched unless force reload
    if (hasFetchedChats.current && !force) {
      console.debug("[loadChatBoards] Skipped: Already fetched. Use force=true to reload.");
      return;
    }
    try {
      const { chats: backendChats } =
        await fetchChatBoards();
      hasFetchedChats.current = true;
      const normalizedWithSort = backendChats.map((chat) => {
        const board = normalizeChatBoard(chat);
        const timestamp = Date.parse(
          chat.updated_at || chat.created_at || ""
        );
        return {
          board,
          sortTime: Number.isNaN(timestamp) ? 0 : timestamp,
          isStarred: board.isStarred,
        };
      });
      const normalized = normalizedWithSort
        .sort((a, b) => b.sortTime - a.sortTime)
        .map((entry) => entry.board);
      let combinedBoards: ChatBoard[] = normalized;
      setChatBoards_((prev) => {
        const tempBoards = prev.filter(
          (board) =>
            board.id.startsWith("temp-") &&
            !normalized.some((chat) => chat.id === board.id)
        );
        combinedBoards = [...tempBoards, ...normalized];
        console.debug(
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
        const savedId = typeof window !== 'undefined' ? localStorage.getItem('activeChatId') : null;
        if (savedId && combinedBoards.some((chat) => chat.id === savedId)) {
          return savedId;
        }
        return combinedBoards.length > 0 ? combinedBoards[0].id : null;
      });
    } catch (error) {
      console.error("Failed to load chats from backend", error);
    }
    }, [isAuthenticated]);

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
      toast("Chat renamed", {
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
      await renameChat(targetId, nextName);

      handleRenameCancel();
      toast("Chat renamed", {
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
        toast(nextValue ? "Chat starred" : "Star removed", {
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
        const response = await apiFetch(
          CHAT_STAR_ENDPOINT(chatId),
          {
            method: "PATCH",
            body: JSON.stringify({ starred: nextValue }),
          },
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

        toast(nextValue ? "Chat starred" : "Star removed", {
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
        toast.error("Star update failed", {
          description:
            error instanceof Error ? error.message : "Unable to update star.",
        });
      } finally {
        setStarUpdatingChatId(null);
      }
    },
    []
  );

  const loadMessagesForChat = useCallback(async (chatId: string) => {
    try {
      const backendMessages = await fetchChatMessages(chatId);
      // DEBUG: Log raw backend messages to inspect attachments shape
      console.debug("[DEBUG] Raw backend messages:", JSON.stringify(backendMessages, null, 2));
      const normalized = backendMessages.flatMap(convertBackendEntryToMessages);
      console.debug("[DEBUG] Normalized messages:", normalized.map(m => ({ id: m.id, sender: m.sender, attachments: m.metadata?.attachments, thinkingContent: m.thinkingContent?.slice(0, 50) })));
      setChatHistory((prev) => ({ ...prev, [chatId]: normalized }));

      // Some pin payloads omit chat identifiers; recover link from message ids.
      const messageIds = new Set(
        normalized
          .map((msg) => {
            const rawId = msg.chatMessageId ?? msg.id;
            return rawId !== undefined && rawId !== null ? String(rawId) : "";
          })
          .filter((id) => id.length > 0),
      );

      if (messageIds.size > 0) {
        setPins_((prevPins) => {
          let changed = false;
          const nextPins = prevPins.map((pin) => {
            const linkedChatId = String(pin.chatId || pin.sourceChatId || "");
            if (linkedChatId.length > 0) return pin;

            const pinMessageId = String(pin.messageId || pin.sourceMessageId || "");
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
    } catch (error) {
      console.error(`Failed to load messages for chat ${chatId}`, error);
    }
  }, []);

  const loadPinsForChat = useCallback(
    async (_chatId: string | null = null) => {
      if (!isAuthenticated) return;

      const cacheKey = "all";

      try {
        const backendPins = await fetchAllPins();

        if (!isAuthenticatedRef.current) return;

        const normalized = backendPins.map((backendPin) =>
          backendPinToLegacy(backendPin)
        );

        // /pins list/detail may not include chat identifiers; recover linkage for
        // the active chat by matching pin message IDs against loaded chat messages.
        const activeMessageIds = _chatId
          ? new Set(
              (chatHistory[_chatId] ?? [])
                .map((msg) => {
                  const rawId = msg.chatMessageId ?? msg.id;
                  return rawId !== undefined && rawId !== null
                    ? String(rawId)
                    : "";
                })
                .filter((id) => id.length > 0),
            )
          : new Set<string>();

        const normalizedWithChatLink = normalized.map((pin) => {
          const existingChatId = String(pin.chatId || pin.sourceChatId || "");
          if (existingChatId.length > 0 || !_chatId || activeMessageIds.size === 0) {
            return pin;
          }

          const pinMessageId = String(pin.messageId || pin.sourceMessageId || "");
          if (!pinMessageId || !activeMessageIds.has(pinMessageId)) {
            return pin;
          }

          return {
            ...pin,
            chatId: _chatId,
            sourceChatId: pin.sourceChatId ?? _chatId,
          };
        });
        setPins_(normalizedWithChatLink);
        setPinsChatId(cacheKey);
        setChatBoards_((prev) =>
          prev.map((board) =>
            board.id === _chatId
              ? { ...board, pinCount: normalizedWithChatLink.length }
              : board
          )
        );
      } catch (error) {
        console.error("Failed to load pins", error);
        if (!isAuthenticatedRef.current) return;
        setPins_([]);
        setPinsChatId(cacheKey);
      }
    },
    [chatHistory, isAuthenticated]
  );

  useEffect(() => {
    if (!activeChatId) return;
    if (!isAuthenticated) return;
    if (chatHistory[activeChatId]) return;
    loadMessagesForChat(activeChatId);
  }, [activeChatId, chatHistory, loadMessagesForChat, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!pinsChatId && isChatRoute) {
      loadPinsForChat(activeChatId ?? null);
    }
  }, [
    activeChatId,
    isAuthenticated,
    isChatRoute,
    loadPinsForChat,
    pinsChatId,
  ]);

  // Fetch active personas once on mount
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const backendPersonas = await fetchPersonasApi(undefined);
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
            modelId: bp.modelId ?? bp.model_id ?? null,
            modelName: bp.modelName ?? bp.model_name ?? null,
            providerName: bp.providerName ?? bp.provider_name ?? null,
            status: "active" as const,
          }));
        setActivePersonas(activeOnly);
      } catch (error) {
        console.error("Failed to fetch personas:", error);
        setActivePersonas([]);
      }
    };
    if (user) {
      loadPersonas();
    }
  }, [user]);

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
          {
            folderId: pinRequest.folderId ?? null,
            tags: pinRequest.tags,
            comments: pinRequest.comments,
            content: pinRequest.text, // Pass full content explicitly
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
              ? {
                  ...board,
                  pinCount: (board.pinCount || 0) + 1,
                  metadata: {
                    ...board.metadata,
                    pinCount: (board.pinCount || 0) + 1,
                  },
                }
              : board
          )
        );
        // Open the right sidebar and show toast
        setActiveRightSidebarPanel("pinboard");
        toast("Pinned!", {
          description: "Response has been pinned to your pinboard.",
        });
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
        await deletePin(pinToRemove.id);
        setPins((prevPins) =>
          prevPins.filter((pin) => pin.id !== pinToRemove.id)
        );
        setChatBoards_((prevBoards) =>
          prevBoards.map((board) =>
            board.id === pinToRemove.chatId
              ? {
                  ...board,
                  pinCount: Math.max(0, (board.pinCount || 1) - 1),
                  metadata: {
                    ...board.metadata,
                    pinCount: Math.max(0, (board.pinCount || 1) - 1),
                  },
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

      // Preserve the type from the temp chat if it exists
      const tempChatBoard = currentActiveId 
        ? chatBoards.find(board => board.id === currentActiveId)
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
        type: chatType, // Include the type in the payload
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
    [activeChatId, chatBoards, chatHistory, loadPinsForChat, user]
  );

  const handleAddChat = (typeOverride?: ChatBoardType | null) => {
    handleRenameCancel();

    // Determine the type based on explicit override or current route
    const isOnPersonaPage =
      pathname?.startsWith("/personas/admin") || pathname?.startsWith("/personas");
    const isOnWorkflowPage =
      pathname?.startsWith("/workflows/admin") || pathname?.startsWith("/workflows");

    const chatType: ChatBoardType =
      typeOverride ??
      (isOnPersonaPage
        ? "persona"
        : isOnWorkflowPage
        ? "workflow"
        : "chat");

    // Check if there's already a temp chat of the same type
    const existingTemp = chatBoards.find((board) =>
      board.id.startsWith("temp-") && (board.type || "chat") === chatType
    );
    if (existingTemp) {
      const tempMessages = chatHistory[existingTemp.id] ?? [];
      if (tempMessages.length === 0) {
        // Reuse the empty temp chat — just make sure it's active and on the right route
        setActiveChatId(existingTemp.id);
        setChatHistory((prev) =>
          prev[existingTemp.id]
            ? prev
            : { ...prev, [existingTemp.id]: [] }
        );
        if (chatType === "persona") {
          router.push("/personas");
        } else if (chatType === "workflow") {
          router.push("/workflows");
        } else {
          router.push("/");
        }
        return;
      }
      // Temp chat has messages — remove it and create a fresh one below
      setChatBoards_((prev) => prev.filter((b) => b.id !== existingTemp.id));
      setChatHistory((prev) => {
        const next = { ...prev };
        delete next[existingTemp.id];
        return next;
      });
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
      type: chatType,
      metadata: { messageCount: 0, pinCount: 0, lastMessageAt: new Date().toISOString() },
    };

    // Add new chat while preserving all existing chats
    setChatBoards_((prev) => {
      console.debug(
        "[handleAddChat] Current boards:",
        prev.length,
        "Adding new temp chat:",
        tempId,
        "Type:",
        chatType
      );
      return [placeholder, ...prev];
    });
    setChatHistory((prev) => ({ ...prev, [tempId]: [] }));
    setActiveChatId(tempId);
    // Navigate to appropriate route based on type
    if (chatType === "persona") {
      router.push("/personas");
    } else if (chatType === "workflow") {
      router.push("/workflows");
    } else {
      router.push("/");
    }
  };

  // Stable ref so the effect doesn't re-fire when handleAddChat identity changes
  const handleAddChatRef = useRef(handleAddChat);
  handleAddChatRef.current = handleAddChat;

  // Track previous route so we can detect transitions into the main chat board.
  const prevPathRef = useRef<string | null>(null);

  // Whenever we navigate from a non-chat route into the main chat board route,
  // automatically focus a single "new chat" board (type "chat").
  useEffect(() => {
    const current = pathname ?? null;
    const prev = prevPathRef.current;

    const isChatRouteNow =
      current === "/" || (current !== null && current.startsWith("/chats"));
    const wasChatRouteBefore =
      prev === "/" || (prev !== null && prev.startsWith("/chats"));

    // Only trigger when navigating INTO chat routes from a non-chat route.
    // Skip when prev === null (initial mount / page refresh) so we restore the
    // previous chat from localStorage instead of always opening a blank new chat.
    if (isChatRouteNow && !wasChatRouteBefore && prev !== null) {
      handleAddChatRef.current("chat");
    }

    prevPathRef.current = current;
  }, [pathname]);

  // Load chat boards once when user is authenticated, then (optionally) start a fresh chat after login
  useEffect(() => {
    if (!isAuthenticated || hasFetchedChats.current) return;

    const shouldStartNewChat =
      typeof window !== "undefined" &&
      window.localStorage.getItem("startNewChatOnLogin") === "true";

    (async () => {
      await loadChatBoards();

      if (shouldStartNewChat && !hasStartedNewChatAfterLoginRef.current) {
        hasStartedNewChatAfterLoginRef.current = true;
        handleAddChatRef.current();
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("startNewChatOnLogin");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loadChatBoards]);

  const isRightSidebarVisible =
    !isPersonasRoute &&
    !isWorkflowChatRoute &&
    !isPersonaChatRoute &&
    !isSettingsSectionRoute &&
    !isWorkflowAdminOverviewRoute &&
    activeRightSidebarPanel !== null;

  const setIsRightSidebarVisible = (value: React.SetStateAction<boolean>) => {
    if (
      isPersonasRoute ||
      isWorkflowChatRoute ||
      isPersonaChatRoute ||
      isSettingsSectionRoute ||
      isWorkflowAdminOverviewRoute
    ) {
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
    if (
      isPersonasRoute ||
      isWorkflowChatRoute ||
      isPersonaChatRoute ||
      isSettingsSectionRoute ||
      isWorkflowAdminOverviewRoute
    ) {
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
    moveChatToTop,
    selectedPinIdsForNextMessage,
    setSelectedPinIdsForNextMessage,
    referencesSources,
    setReferencesSources,
    openReferencesPanel: () => {
      if (
        !isPersonasRoute &&
        !isWorkflowChatRoute &&
        !isPersonaChatRoute &&
        !isWorkflowAdminOverviewRoute
      )
        setActiveRightSidebarPanel("references");
    },
    updateChatTitleWithAnimation,
    getAnimatingTitle,
    refreshChatTitle,
    activePersonas,
    setActivePersonas,
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

  // Only inject chat props on the main chat route.
  const pageContent = !isChatRoute || isPersonasRoute
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
            {!isSettingsSectionRoute && (
              <Topbar
                selectedModel={selectedModel}
                onModelSelect={setSelectedModel}
                useFramework={useFramework}
                onFrameworkChange={setUseFramework}
                chatBoards={chatBoards}
                activeChatId={activeChatId}
                hasMessages={
                  activeChatId
                    ? (chatHistory[activeChatId]?.length || 0) > 0
                    : false
                }
                messageCount={
                  activeChatId ? (chatHistory[activeChatId]?.length || 0) : 0
                }
                pins={pins}
                onPinsSelect={setSelectedPinIdsForNextMessage}
              >
                <Sheet
                  open={isMobileMenuOpen}
                  onOpenChange={setIsMobileMenuOpen}
                >
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="chat-layout-mobile-sheet"
                  >
                    <Suspense fallback={null}>
                      <LeftSidebar {...sidebarProps} isCollapsed={false} />
                    </Suspense>
                  </SheetContent>
                </Sheet>
              </Topbar>
            )}
            {isSettingsSectionRoute && (
              <div className="w-full h-full flex">
                <Suspense fallback={null}>
                  <LeftSidebar {...sidebarProps} isCollapsed={false} />
                </Suspense>
                <main className="flex-1 h-full" />
              </div>
            )}
            {!isSettingsSectionRoute && (
              <main className="chat-layout-mobile-main">{pageContent}</main>
            )}
          </div>
        </div>
        <AlertDialog
          open={!!chatToDelete}
          onOpenChange={(open) => !open && setChatToDelete(null)}
        >
          <AlertDialogContent className="rounded-[8px] bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#171717] text-lg font-semibold">
                Delete Chat Board?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#6B7280] space-y-3">
                <p>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-[#171717]">
                    &quot;{chatToDelete?.name}&quot;
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
        <Suspense fallback={null}>
          <LeftSidebar {...sidebarProps} />
        </Suspense>
        <div className="chat-layout-sidebar-area">
          {!isSettingsSectionRoute && (
            <Topbar
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
              useFramework={useFramework}
              onFrameworkChange={setUseFramework}
              chatBoards={chatBoards}
              activeChatId={activeChatId}
              hasMessages={
                activeChatId
                  ? (chatHistory[activeChatId]?.length || 0) > 0
                  : false
              }
              messageCount={
                activeChatId ? (chatHistory[activeChatId]?.length || 0) : 0
              }
              pins={pins}
              onPinsSelect={setSelectedPinIdsForNextMessage}
            />
          )}
          <div className="chat-layout-main-wrapper">
            <div className="chat-layout-content-panel">
              <main className="chat-layout-main">
                {/* chat-layout-window--max960 */}
                <div className={cn("chat-layout-window", isPersonasRoute ? "max-w-full" : "max-w-full")}>
                  {pageContent}
                </div>
              </main>
            </div>
            {!isPersonasRoute &&
              !isWorkflowChatRoute &&
              !isPersonaChatRoute &&
                !isSettingsSectionRoute &&
                !isWorkflowAdminOverviewRoute && (
              <div className="hidden h-full lg:flex items-stretch">
                <RightSidebar
                  isOpen={isRightSidebarVisible}
                  activePanel={activeRightSidebarPanel}
                  onClose={() => setActiveRightSidebarPanel(null)}
                  pins={pins}
                  setPins={setPins}
                  chatBoards={chatBoards}
                  referencesSources={referencesSources}
                  className="order1"
                />
                <RightSidebarCollapsed
                  activePanel={activeRightSidebarPanel}
                  onSelect={handleRightSidebarSelect}
                  isCompareActive={isCompareModalOpen}
                  onCompareClick={() => setIsCompareModalOpen(!isCompareModalOpen)}
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
        <AlertDialogContent className="rounded-[8px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              chat board.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[8px]"
              onClick={() => setChatToDelete(null)}
              disabled={isDeletingChatBoard}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[8px]"
              onClick={confirmDelete}
              disabled={isDeletingChatBoard}
            >
              {isDeletingChatBoard ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={isCompareModalOpen} onOpenChange={setIsCompareModalOpen}>
        <DialogContent
          id="compare-models-parent"
          className="min-w-[1006px] w-auto max-h-full h-auto flex items-center justify-center overflow-x-hidden overflow-y-hidden px-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Compare Models</DialogTitle>
          </DialogHeader>
          <CompareModelsPage
            selectedModel={selectedModel}
            onModelSelect={handleModelSelectFromCompare}
            onClose={() => setIsCompareModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
      {selectedModel && pendingModelFromCompare && (
        <ModelSwitchDialog
          open={isModelSwitchConfirmOpen}
          onOpenChange={setIsModelSwitchConfirmOpen}
          currentModel={selectedModel}
          //selecting the same model chosen from compare models page by the user
          pendingModel={pendingModelFromCompare}
          onModelSwitch={handleConfirmModelSwitch}
          chatBoards={chatBoards}
        />
      )}
    </AppLayoutContext.Provider>
  );
}
