"use client";

import { useState, useRef, useEffect, useContext, useMemo } from "react";
import chatStyles from "./chat-interface.module.css";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Send,
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
  Reply,
  Globe,
  Palette,
  Check,
  ScanText,
  Upload,
} from "lucide-react";
import { ChatMessage, type Message, type MessageSource } from "./chat-message";
import { InitialPrompts } from "./initial-prompts";
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
import { fetchChatBoards } from "@/lib/api/chat";
import { friendlyApiError } from "@/lib/api/client";
import { reportSessionExpired, reportApiFailure, reportError } from "@/lib/error-reporter";
// Personas are fetched once in AppLayout and shared via context — no separate fetch needed here.
import { getAuthHeaders, ensureFreshToken } from "@/lib/jwt-utils";
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
import { useFileDrop } from "@/hooks/use-file-drop";
import { canAccessFeature } from "@/lib/plan-config";

import {
  API_BASE_URL,
  CHATS_ENDPOINT,
  DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";
import { extractThinkingContent } from "@/lib/thinking";
import { mergeStreamingText } from "@/lib/streaming";
import { getModelIcon } from "@/lib/model-icons";
import { fetchModelsWithCache } from "@/lib/ai-models";
import Image from "next/image";
import { STYLE_TONES, type TonePreset } from "./chat-tones";

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

type MessageAvatar = Pick<Message, "avatarUrl" | "avatarHint">;

// Interface for a mentioned pin
interface MentionedPin {
  id: string;
  label: string;
}

type ClarificationSuggestion = {
  label: string;
  description?: string;
};

type ClarificationPromptPayload = {
  question: string;
  suggestions: ClarificationSuggestion[];
};

type WebSearchPayload = {
  query: string;
  links: string[];
};

type GeneratedFilePayload = {
  url: string;
  s3Key?: string;
  filename?: string;
  mimeType?: string;
};

const normalizeGeneratedFilePayload = (
  raw: unknown,
): GeneratedFilePayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as {
    url?: unknown;
    file_link?: unknown;
    link?: unknown;
    s3_key?: unknown;
    s3Key?: unknown;
    filename?: unknown;
    file_name?: unknown;
    fileName?: unknown;
    name?: unknown;
    mime_type?: unknown;
    mimeType?: unknown;
  };

  const rawUrl = item.url ?? item.file_link ?? item.link;
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!url) return null;

  const filenameRaw =
    item.filename ?? item.file_name ?? item.fileName ?? item.name;
  const filename =
    typeof filenameRaw === "string" && filenameRaw.trim().length > 0
      ? filenameRaw.trim()
      : undefined;

  const s3KeyRaw = item.s3_key ?? item.s3Key;
  const s3Key =
    typeof s3KeyRaw === "string" && s3KeyRaw.trim().length > 0
      ? s3KeyRaw.trim()
      : undefined;

  const mimeTypeRaw = item.mime_type ?? item.mimeType;
  const mimeType =
    typeof mimeTypeRaw === "string" && mimeTypeRaw.trim().length > 0
      ? mimeTypeRaw.trim()
      : undefined;

  return { url, s3Key, filename, mimeType };
};

const dedupeGeneratedFiles = (
  files: GeneratedFilePayload[],
): GeneratedFilePayload[] => {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = file.url.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const DOCUMENT_UPLOAD_ACCEPT =
  ".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,.csv,text/csv,application/csv,.xls,application/vnd.ms-excel,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*";

const DOCUMENT_FILE_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".csv", ".xls", ".xlsx"];

const isDocumentFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (file.type.startsWith("image/")) return true;
  if (DOCUMENT_FILE_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
    return true;
  }
  return (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "application/vnd.ms-excel" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
};

const getDocumentKindLabel = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "Word Document";
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "PowerPoint Presentation";
  if (lower.endsWith(".csv")) return "CSV Document";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) {
    return "Excel Document";
  }
  if (lower.endsWith(".pdf")) return "PDF Document";
  // Avoid showing "Document" when the name itself already says "Document"
  if (lower.startsWith("document")) return "Uploaded File";
  return "Document";
};

const toOptionalTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const UUID_V4_LIKE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeImageUrlForDedup = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    parsed.search = "";
    parsed.hash = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
};

const shouldReplaceImageUrl = (existingUrl: string, incomingUrl: string): boolean => {
  const existing = existingUrl.trim();
  const incoming = incomingUrl.trim();
  if (!existing) return true;
  const isEphemeral = (value: string) =>
    value.startsWith("blob:") || value.startsWith("data:");
  if (isEphemeral(existing) && !isEphemeral(incoming)) return true;
  if (!isEphemeral(existing) && isEphemeral(incoming)) return false;
  try {
    const existingHasQuery = new URL(existing).search.length > 0;
    const incomingHasQuery = new URL(incoming).search.length > 0;
    if (existingHasQuery && !incomingHasQuery) return true;
  } catch {
    // ignore URL parse errors
  }
  return false;
};

const normalizeUuidReference = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const withoutUrn = raw.toLowerCase().startsWith("urn:uuid:")
    ? raw.slice("urn:uuid:".length)
    : raw;
  if (UUID_V4_LIKE_RE.test(withoutUrn)) return withoutUrn;

  // Some UI-local ids append a role suffix (e.g. <uuid>-assistant).
  // Recover the UUID prefix so backend endpoints still receive a valid id.
  const withSuffixMatch = withoutUrn.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-[a-z0-9_-]+$/i,
  );
  return withSuffixMatch ? withSuffixMatch[1] : null;
};

const normalizeClarificationPrompt = (
  raw: unknown,
): ClarificationPromptPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const question =
    toOptionalTrimmedString(payload.question) ??
    toOptionalTrimmedString(payload.prompt) ??
    toOptionalTrimmedString(payload.clarification_question) ??
    "Could you clarify your request?";
  const rawSuggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions
    : Array.isArray(payload.options)
      ? payload.options
      : [];
  const suggestions = rawSuggestions
    .map((item) => {
      if (typeof item === "string") {
        const label = item.trim();
        return label ? ({ label } as ClarificationSuggestion) : null;
      }
      if (!item || typeof item !== "object") return null;
      const option = item as Record<string, unknown>;
      const label =
        toOptionalTrimmedString(option.label) ??
        toOptionalTrimmedString(option.option) ??
        toOptionalTrimmedString(option.title) ??
        toOptionalTrimmedString(option.text);
      if (!label) return null;
      const description =
        toOptionalTrimmedString(option.description) ??
        toOptionalTrimmedString(option.detail) ??
        toOptionalTrimmedString(option.subtitle) ??
        undefined;
      return { label, description };
    })
    .filter((item): item is ClarificationSuggestion => Boolean(item));

  return { question, suggestions };
};

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  doc_execute: "Generating document...",
  csv_execute: "Analyzing spreadsheet...",
  web_search: "Searching the web...",
};

const formatToolDisplayName = (toolName: string): string =>
  TOOL_DISPLAY_NAMES[toolName] ?? `Running ${toolName}...`;

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

/** Normalize backend sources/citations into MessageSource shape */
function normalizeMessageSources(
  raw: unknown,
): Message["metadata"] extends { sources?: infer S } ? S : never {
  if (!Array.isArray(raw) || raw.length === 0) return undefined as never;
  const out: MessageSource[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      "url" in item &&
      typeof (item as { url: unknown }).url === "string"
    ) {
      const o = item as Record<string, unknown>;
      const url = o.url as string;
      const title = [o.title, o.name].find((v) => typeof v === "string") as
        | string
        | undefined;
      const snippet = typeof o.snippet === "string" ? o.snippet : undefined;
      const authorOrPublisher = [
        o.authorOrPublisher,
        o.author,
        o.publisher,
      ].find((v) => typeof v === "string") as string | undefined;
      const publicationOrAccessDate = [
        o.publicationOrAccessDate,
        o.publicationDate,
        o.date,
        o.accessDate,
        o.publishedDate,
      ].find((v) => typeof v === "string") as string | undefined;
      const relevanceScore =
        typeof o.relevanceScore === "number"
          ? o.relevanceScore
          : typeof o.relevance === "number"
            ? o.relevance
            : typeof o.confidence === "number"
              ? o.confidence
              : typeof o.score === "number"
                ? o.score
                : undefined;
      const num =
        relevanceScore != null
          ? Math.min(100, Math.max(0, Number(relevanceScore)))
          : undefined;
      const imageUrl = [o.imageUrl, o.image, o.ogImage].find(
        (v) => typeof v === "string",
      ) as string | undefined;
      const description = [o.description, o.ogDescription].find(
        (v) => typeof v === "string",
      ) as string | undefined;
      out.push({
        url,
        title: title || undefined,
        snippet: snippet || undefined,
        authorOrPublisher: authorOrPublisher || undefined,
        publicationOrAccessDate: publicationOrAccessDate || undefined,
        relevanceScore: num,
        imageUrl: imageUrl || undefined,
        description: description || undefined,
      });
    }
  }
  return (out.length > 0 ? out : undefined) as never;
}

/** Normalize URL for matching (e.g. when comparing source URL to link in content). */
function normalizeUrlForMatch(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.search = "";
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.origin}${path}`;
  } catch {
    return url.trim();
  }
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
    const key = normalizeUrlForMatch(rawUrl);
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
    extractSourcesFromContent(message.content ?? "") as MessageSource[],
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
    extractSourcesFromContent(message.content ?? "") as MessageSource[],
  )
    .slice(0, 4)
    .map((s) => s.url);
}

/** Extract link-like sources from markdown content (e.g. [text](url) or bare URLs) */
function extractSourcesFromContent(
  content: string,
): Array<{ title?: string; url: string }> {
  if (!content || typeof content !== "string") return [];
  const seen = new Set<string>();
  const out: Array<{ title?: string; url: string }> = [];
  // Markdown links: [text](url)
  const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(content)) !== null) {
    const url = m[2].trim();
    if (seen.has(url)) continue;
    seen.add(url);
    const title = m[1].trim();
    out.push({ url, title: title || undefined });
  }
  // Bare URLs (http/https) not already captured
  const urlRegex = /https?:\/\/[^\s)\]">]+/g;
  while ((m = urlRegex.exec(content)) !== null) {
    const raw = m[0];
    const url = raw.replace(/[.)]+$/, ""); // trim trailing punctuation
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url });
  }
  return out;
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
      type: "document" | "image";
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
  // Use personas from AppLayout context instead of fetching again
  const activePersonas = layoutContext?.activePersonas ?? [];
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [useMistralOcr, setUseMistralOcr] = useState(false);
  const [showStyleSubmenu, setShowStyleSubmenu] = useState(false);
  const [selectedTone, setSelectedTone] = useState<TonePreset | null>(null);
  const styleSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [isResponding, setIsResponding] = useState(false);
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
        : extractSourcesFromContent(content);
    const withoutGenerated = filterSourcesExcludingGeneratedDocuments(
      lastAi,
      rawSources,
    );
    return withoutGenerated.map((s) => {
      const chatTitle = titlesFromChat.get(normalizeUrlForMatch(s.url));
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
        : extractSourcesFromContent(content);

    const filtered = filterSourcesExcludingGeneratedDocuments(
      message,
      rawSources,
    );
    const messageSources = filtered.map((s) => {
      const chatTitle = titlesFromChat.get(normalizeUrlForMatch(s.url));
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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const composerPlaceholder =
    selectedModel || layoutContext?.useFramework
      ? "Let's Play..."
      : "Choose a model or enable framework to start chatting";
  const messageBufferRef = useRef<Message[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // max height
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  // Active personas are provided by AppLayout context — no duplicate fetch needed.

  // Clear input, reference, mentions, and attachments when switching chats
  useEffect(() => {
    setInput("");
    setReferencedMessage(null);
    setMentionedPins([]);
    setShowPinDropdown(false);
    setPinSearchQuery("");
    setWebSearchEnabled(false);
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
      const tagsMatch =
        pin.tags?.some((tag) => tag.toLowerCase().includes(query)) ?? false;

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

  const handleStopGeneration = () => {
    // Mark that a user-initiated stop was requested
    stopRequestedRef.current = true;
    // Abort the in-flight request, if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Stop showing responding UI state immediately
    setIsResponding(false);

    // Ensure any loading AI message is marked as not loading
    setMessages((prev = []) => {
      const next = prev.map((msg) =>
        msg.sender === "ai" && msg.isLoading
          ? { ...msg, isLoading: false, isThinkingInProgress: false }
          : msg,
      );
      messageBufferRef.current = next;
      return next;
    }, layoutContext?.activeChatId ?? undefined);
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
    // Reset any previous stop signal and create a new abort controller
    stopRequestedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      let currentChatId = chatId;

      const getResolvedChatId = (payload: unknown): string | null => {
        if (!payload || typeof payload !== "object") return null;
        const candidate = payload as {
          chat_id?: string | number | null;
          chatId?: string | number | null;
        };
        const raw = candidate.chat_id ?? candidate.chatId ?? null;
        if (raw === null || raw === undefined) return null;
        const resolved = String(raw).trim();
        return resolved.length > 0 ? resolved : null;
      };

      const adoptResolvedChatId = (resolved: string) => {
        if (isPersonaTest || !layoutContext?.setActiveChatId) return;
        const previousChatId = currentChatId;
        if (previousChatId === resolved) return;

        currentChatId = resolved;
        layoutContext.setActiveChatId(resolved);
        if (messageBufferRef.current.length > 0) {
          setMessages(messageBufferRef.current, resolved);
        }

        if (
          previousChatId &&
          previousChatId.startsWith("temp-") &&
          layoutContext.setChatBoards
        ) {
          layoutContext.setChatBoards((prev) => {
            const tempBoard = prev.find((b) => b.id === previousChatId);
            if (!tempBoard) return prev;
            const realBoard = {
              ...tempBoard,
              id: resolved,
            };
            return prev.map((b) =>
              b.id === previousChatId ? realBoard : b,
            );
          });
        }
      };

      const tryResolveTempChatIdFromServer = (
        titleHint?: string,
        retries = 2,
      ) => {
        if (isPersonaTest || !currentChatId || !currentChatId.startsWith("temp-")) {
          return;
        }
        const tempIdSnapshot = currentChatId;
        const normalizedTitleHint = (titleHint || "").trim().toLowerCase();
        const inputPrefix = userMessage.trim().slice(0, 50).toLowerCase();

        void fetchChatBoards()
          .then(({ chats }) => {
            if (!chats || chats.length === 0) {
              if (retries > 0) {
                setTimeout(
                  () => tryResolveTempChatIdFromServer(titleHint, retries - 1),
                  500,
                );
              }
              return;
            }

            if (currentChatId !== tempIdSnapshot) return;

            const candidates = chats.map((chat) => {
              const rawTitle =
                chat.chat_title ||
                (chat as { title?: string }).title ||
                (chat as { name?: string }).name ||
                "";
              return {
                id: String(chat.id),
                title: rawTitle.trim(),
              };
            });

            let matched =
              normalizedTitleHint.length > 0
                ? candidates.find(
                    (chat) =>
                      chat.title.toLowerCase() === normalizedTitleHint,
                  )
                : undefined;

            if (!matched && inputPrefix.length > 0) {
              matched = candidates.find((chat) =>
                chat.title.toLowerCase().startsWith(inputPrefix),
              );
            }

            const fallback = candidates[0];
            const resolvedId = (matched || fallback)?.id;
            if (!resolvedId) {
              if (retries > 0) {
                setTimeout(
                  () => tryResolveTempChatIdFromServer(titleHint, retries - 1),
                  500,
                );
              }
              return;
            }

            if (currentChatId === tempIdSnapshot) {
              adoptResolvedChatId(resolvedId);
            }
          })
          .catch(() => {
            if (retries > 0) {
              setTimeout(
                () => tryResolveTempChatIdFromServer(titleHint, retries - 1),
                500,
              );
            }
          });
      };

      if (!modelForRequest) {
        console.warn("No model selected  backend may need to use a default.");
      }

      const isPersonaTest = Boolean(personaTestConfig);

      // If persona test but no ID yet, call the callback to create/save the persona first
      let resolvedPersonaId = personaTestConfig?.personaId ?? null;
      if (isPersonaTest && !resolvedPersonaId && onBeforePersonaTest) {
        resolvedPersonaId = await onBeforePersonaTest();
      }

      const isExistingChat = Boolean(
        !isPersonaTest && chatId && !chatId.startsWith("temp-"),
      );
      const endpoint = isPersonaTest && resolvedPersonaId
        ? `${API_BASE_URL}/persona/${resolvedPersonaId}/test`
        : isExistingChat && chatId
          ? `${API_BASE_URL}/chats/${chatId}/stream`
          : `${API_BASE_URL}/chats/create`;

      const modelId =
        modelForRequest?.id ??
        modelForRequest?.modelId ??
        personaTestConfig?.modelId ??
        null;
      const useAlgorithm =
        (modelId === null || modelId === undefined) &&
        Boolean(layoutContext?.useFramework);
      const algorithmValue = useAlgorithm
        ? (layoutContext?.frameworkType === 'pro' ? 'pro' : 'base')
        : null;
      const memoryPct = layoutContext?.memoryPercentage ?? 0.2;

      // Build request body - use FormData when file is present, JSON otherwise
      let body: FormData | string;
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
      };

      // Only use FormData when there are non-image files (e.g. PDFs).
      // Images are always sent as base64 data URLs in the JSON payload.
      const nonImageFiles =
        files?.filter((f) => !f.type.startsWith("image/")) ?? [];
      const imageFiles =
        files?.filter((f) => f.type.startsWith("image/")) ?? [];

      if (isPersonaTest) {
        // Persona test: allow files via FormData, otherwise use urlencoded input
        if ((files?.length ?? 0) > 0) {
          const formData = new FormData();
          formData.append("input", userMessage);
          if (modelId !== null && modelId !== undefined) {
            formData.append("model_id", String(modelId));
          }
          if (webSearchEnabled) {
            formData.append("web_search", "true");
          }
          if (selectedTone) {
            formData.append("system_instruction", selectedTone.system_prompt);
          }
          if (useMistralOcr) {
            formData.append("use_mistral_ocr", "true");
          }
          // Append all files (images + documents)
          [...imageFiles, ...nonImageFiles].forEach((file) => {
            formData.append("files", file);
          });
          body = formData;
          // Don't set Content-Type header - browser sets it with boundary for FormData
        } else {
          const params = new URLSearchParams({ input: userMessage });
          if (selectedTone) {
            params.append("system_instruction", selectedTone.system_prompt);
          }
          body = params.toString();
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
      } else if (nonImageFiles.length > 0) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append("input", userMessage);
        if (modelId !== null && modelId !== undefined) {
          formData.append("model_id", String(modelId));
        }
        if (algorithmValue) {
          formData.append("algorithm", algorithmValue);
        }
        formData.append("memory_percentage", String(memoryPct));
        if (webSearchEnabled) {
          formData.append("web_search", "true");
        }
        if (selectedTone) {
          formData.append("system_instruction", selectedTone.system_prompt);
        }
        if (useMistralOcr) {
          formData.append("use_mistral_ocr", "true");
        }
        if (pinIds && pinIds.length > 0) {
          formData.append("pin_ids", JSON.stringify(pinIds));
        }
        // Send reference_message_id for stream endpoint
        const resolvedRefIdFD = normalizeUuidReference(
          referencedMessageId || replyToMessageId || null,
        );
        if (resolvedRefIdFD && isExistingChat) {
          formData.append("reference_message_id", resolvedRefIdFD);
        }
        // Append all files (images + documents)
        [...imageFiles, ...nonImageFiles].forEach((file) => {
          formData.append("files", file);
        });
        body = formData;
        // Don't set Content-Type header - browser sets it with boundary for FormData
      } else {
        // Use FormData (multipart) even without files — required by the API
        const formData = new FormData();
        formData.append("input", userMessage);
        if (modelId !== null && modelId !== undefined) {
          formData.append("model_id", String(modelId));
        }
        if (algorithmValue) {
          formData.append("algorithm", algorithmValue);
        }
        formData.append("memory_percentage", String(memoryPct));
        if (webSearchEnabled) {
          formData.append("web_search", "true");
        }
        if (selectedTone) {
          formData.append("system_instruction", selectedTone.system_prompt);
        }
        if (useMistralOcr) {
          formData.append("use_mistral_ocr", "true");
        }
        if (pinIds && pinIds.length > 0) {
          formData.append("pin_ids", JSON.stringify(pinIds));
        }
        const resolvedRefId = normalizeUuidReference(
          referencedMessageId || replyToMessageId || null,
        );
        if (resolvedRefId && isExistingChat) {
          formData.append("reference_message_id", resolvedRefId);
        }
        // Convert image files to File objects and append
        if (imageFiles.length > 0) {
          imageFiles.forEach((file) => {
            formData.append("files", file);
          });
        }
        body = formData;
        // Remove Content-Type so browser sets multipart boundary
        delete headers["Content-Type"];
      }

      // Add auth headers — ensure token is fresh before streaming request
      await ensureFreshToken();
      const authHeaders = getAuthHeaders(headers);

      let response = await fetch(endpoint, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body,
        signal: controller.signal,
      });

      // Retry once on 401 — the token may have expired between the freshness
      // check and the actual request arriving at the backend.
      if (response.status === 401 && typeof window !== "undefined") {
        const refreshed = await ensureFreshToken();
        if (refreshed) {
          const retryHeaders = getAuthHeaders(headers);
          response = await fetch(endpoint, {
            method: "POST",
            headers: retryHeaders,
            credentials: "include",
            body,
            signal: controller.signal,
          });
        }
        if (response.status === 401) {
          // Session is truly expired — log out silently instead of showing an error
          setMessages(
            (prev = []) =>
              prev.map((msg) =>
                msg.id === loadingMessageId
                  ? { ...msg, content: "Your session has expired. Signing you out\u2026", isLoading: false }
                  : msg,
              ),
            chatId ?? undefined,
          );
          setIsResponding(false);
          reportSessionExpired("chat-stream", 401);
          toast.error("Session expired", {
            description: "Signing you out\u2026",
          });
          window.dispatchEvent(new Event("auth:session-expired"));
          return;
        }
      }

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        reportApiFailure("chat-stream", endpoint, response.status, errorText || "empty response");
        throw new Error(
          friendlyApiError(errorText || "API request failed", response.status),
        );
      }

      // Fallback: some backends return the chat id in response headers for new chats.
      if (!isPersonaTest && layoutContext?.setActiveChatId) {
        const headerChatId =
          response.headers.get("X-Chat-Id") ||
          response.headers.get("x-chat-id");
        const shouldAdoptHeaderId =
          headerChatId &&
          (!currentChatId || currentChatId.startsWith("temp-"));
        if (shouldAdoptHeaderId) {
          adoptResolvedChatId(String(headerChatId));
        }
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let reasoningContent = "";
      let streamMetadata: Record<string, unknown> | null = null;
      let streamFinished = false;
      let shouldStopReading = false;
      const AI_UPDATE_INTERVAL_MS = 16;
      let pendingAiFields: Partial<Message> | null = null;
      let aiUpdateRafId: number | null = null;
      let aiUpdateTimer: ReturnType<typeof setTimeout> | null = null;
      let lastAiFlushAt = 0;

      const applyAiMessageUpdate = (fields: Partial<Message>) => {
        setMessages((prev = []) => {
          const next = prev.map((msg) => {
            if (msg.id !== loadingMessageId) return msg;
            const { metadata: nextMeta, ...rest } = fields;
            const merged: Message = { ...msg, ...rest };
            // Omitting metadata must not wipe msg.metadata (e.g. done sends finalMetadata undefined).
            if (nextMeta !== undefined) {
              merged.metadata = {
                ...(msg.metadata || {}),
                ...nextMeta,
              };
            }
            return merged;
          });
          messageBufferRef.current = next;
          return next;
        }, currentChatId ?? undefined);
      };

      const clearScheduledAiUpdate = () => {
        if (aiUpdateRafId !== null) {
          cancelAnimationFrame(aiUpdateRafId);
          aiUpdateRafId = null;
        }
        if (aiUpdateTimer !== null) {
          clearTimeout(aiUpdateTimer);
          aiUpdateTimer = null;
        }
      };

      const flushQueuedAiUpdate = () => {
        if (!pendingAiFields) return;
        const nextFields = pendingAiFields;
        pendingAiFields = null;
        clearScheduledAiUpdate();
        lastAiFlushAt = Date.now();
        applyAiMessageUpdate(nextFields);
      };

      const queueAiMessageUpdate = (
        fields: Partial<Message>,
        immediate = false,
      ) => {
        if (pendingAiFields) {
          const { metadata: newMeta, ...newRest } = fields;
          const { metadata: pendingMeta, ...pendingRest } = pendingAiFields;
          pendingAiFields = {
            ...pendingRest,
            ...newRest,
            metadata:
              newMeta === undefined
                ? pendingMeta
                : { ...(pendingMeta || {}), ...newMeta },
          };
        } else {
          pendingAiFields = fields;
        }

        if (immediate) {
          flushQueuedAiUpdate();
          return;
        }

        if (aiUpdateRafId !== null || aiUpdateTimer !== null) return;

        const elapsed = Date.now() - lastAiFlushAt;
        if (elapsed >= AI_UPDATE_INTERVAL_MS) {
          aiUpdateRafId = requestAnimationFrame(() => {
            aiUpdateRafId = null;
            flushQueuedAiUpdate();
          });
        } else {
          aiUpdateTimer = setTimeout(() => {
            aiUpdateTimer = null;
            flushQueuedAiUpdate();
          }, AI_UPDATE_INTERVAL_MS - elapsed);
        }
      };

      const appendAiImages = (
        incoming: Array<{ url: string; alt?: string }>,
      ) => {
        if (incoming.length === 0) return;
        setMessages((prev = []) => {
          const next = prev.map((msg) => {
            if (msg.id !== loadingMessageId) return msg;
            const existing = Array.isArray(msg.images)
              ? msg.images
              : msg.imageUrl
                ? [{ url: msg.imageUrl, alt: msg.imageAlt }]
                : [];
            const merged = [...existing];
            const indexByKey = new Map<string, number>();
            merged.forEach((img, idx) => {
              const key = normalizeImageUrlForDedup(img.url);
              if (key) indexByKey.set(key, idx);
            });
            incoming.forEach((img) => {
              const key = normalizeImageUrlForDedup(img.url);
              if (!key) return;
              const existingIndex = indexByKey.get(key);
              if (existingIndex === undefined) {
                merged.push(img);
                indexByKey.set(key, merged.length - 1);
                return;
              }
              const existingImg = merged[existingIndex];
              if (shouldReplaceImageUrl(existingImg.url, img.url)) {
                merged[existingIndex] = {
                  ...existingImg,
                  ...img,
                  alt: img.alt ?? existingImg.alt,
                };
              } else if (!existingImg.alt && img.alt) {
                merged[existingIndex] = { ...existingImg, alt: img.alt };
              }
            });
            return {
              ...msg,
              images: merged,
              imageUrl: merged[0]?.url,
              imageAlt: merged[0]?.alt,
            };
          });
          messageBufferRef.current = next;
          return next;
        }, currentChatId ?? undefined);
      };

      const appendGeneratedFiles = (incoming: GeneratedFilePayload[]) => {
        if (incoming.length === 0) return;
        setMessages((prev = []) => {
          const next = prev.map((msg) => {
            if (msg.id !== loadingMessageId) return msg;
            const existing = Array.isArray(msg.metadata?.generatedFiles)
              ? msg.metadata.generatedFiles
              : [];
            const merged = dedupeGeneratedFiles([...existing, ...incoming]);
            return {
              ...msg,
              metadata: {
                ...(msg.metadata || {}),
                generatedFiles: merged,
              },
            };
          });
          messageBufferRef.current = next;
          return next;
        }, currentChatId ?? undefined);
      };

      const applyClarificationPrompt = (
        clarification: ClarificationPromptPayload,
      ) => {
        setMessages((prev = []) => {
          const next = prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  content: clarification.question,
                  thinkingContent: null,
                  isThinkingInProgress: false,
                  isLoading: false,
                  metadata: {
                    ...msg.metadata,
                    clarification,
                  },
                }
              : msg,
          );
          messageBufferRef.current = next;
          return next;
        }, currentChatId ?? undefined);
      };

      const streamReader = response.body.getReader();
      reader = streamReader;
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
          // Normalize type-based format (no event name, uses parsed.type instead)
          if (!eventName && parsed.type) {
            if (parsed.type === "content") {
              eventName = "chunk";
              if (typeof parsed.content === "string" && !("delta" in parsed)) {
                parsed = { ...parsed, delta: parsed.content };
              }
            } else {
              eventName = parsed.type;
            }
          }

          if (
            eventName === "content" &&
            typeof parsed.content === "string" &&
            !("delta" in parsed)
          ) {
            parsed = { ...parsed, delta: parsed.content };
            eventName = "chunk";
          }

          if (
            eventName === "reasoning" &&
            typeof parsed.content === "string" &&
            !("delta" in parsed)
          ) {
            parsed = { ...parsed, delta: parsed.content };
          }

          if (eventName === "metadata") {
            streamMetadata = parsed;
            const metadataChatId = getResolvedChatId(parsed);
            if (metadataChatId) {
              adoptResolvedChatId(metadataChatId);
              if (layoutContext?.setChatBoards) {
                layoutContext.setChatBoards((prev) =>
                  prev.map((b) =>
                    b.id === metadataChatId
                      ? {
                          ...b,
                          name: parsed.title || parsed.chat_title || b.name,
                        }
                      : b,
                  ),
                );
              }
            }

            // Update chat title if provided by backend (works for both new and existing chats)
            const chatTitle = parsed.title || parsed.chat_title;
            if (
              !isPersonaTest &&
              chatTitle &&
              currentChatId &&
              layoutContext?.updateChatTitleWithAnimation
            ) {
              layoutContext.updateChatTitleWithAnimation(
                currentChatId,
                String(chatTitle),
              );
            }
            continue;
          }

          if (eventName === "web_search") {
            const webSearch = normalizeWebSearchPayload(parsed);
            if (webSearch) {
              queueAiMessageUpdate(
                {
                  metadata: {
                    webSearch,
                  },
                },
                true,
              );
            }
            continue;
          }

          if (eventName === "tool_executing") {
            const toolName = typeof parsed.content === "string" ? parsed.content : "";
            const displayName = formatToolDisplayName(toolName);
            queueAiMessageUpdate({ toolStatus: displayName });
            continue;
          }

          if (eventName === "tool_complete") {
            queueAiMessageUpdate({ toolStatus: null });
            continue;
          }

          if (eventName === "tool_progress") {
            const tool = typeof parsed.tool === "string" ? parsed.tool : "";
            const filename = typeof parsed.filename === "string" ? parsed.filename : "";
            const status = typeof parsed.status === "string" ? parsed.status : "";
            const displayName = formatToolDisplayName(tool);
            const label = filename
              ? `${status === "executing" ? "Running" : displayName} ${tool} for ${filename}...`
              : displayName;
            queueAiMessageUpdate({ toolStatus: label });
            continue;
          }

          if (eventName === "reasoning") {
            const delta = typeof parsed.delta === "string" ? parsed.delta : "";
            reasoningContent = mergeStreamingText(reasoningContent, delta);
            queueAiMessageUpdate({
              thinkingContent: reasoningContent,
              isThinkingInProgress: true,
              isLoading: false,
            });
            continue;
          }

          if (eventName === "model_selected") {
            const modelName =
              typeof parsed.model_name === "string"
                ? parsed.model_name
                : typeof parsed.modelName === "string"
                  ? parsed.modelName
                  : undefined;
            const providerName =
              typeof parsed.company === "string"
                ? parsed.company
                : typeof parsed.provider_name === "string"
                  ? parsed.provider_name
                  : typeof parsed.providerName === "string"
                    ? parsed.providerName
                    : undefined;
            const avatarUrl = getModelIcon(providerName, modelName);
            const avatarHint = [modelName, providerName]
              .filter(Boolean)
              .join(" ")
              .trim();
            queueAiMessageUpdate({
              avatarUrl,
              avatarHint: avatarHint || undefined,
              metadata: {
                modelName,
                providerName,
                llmModelId:
                  parsed.model_id ??
                  parsed.modelId ??
                  parsed.llm_model_id ??
                  parsed.llmModelId ??
                  null,
              },
            }, true);
            continue;
          }

          if (eventName === "chunk") {
            const delta = typeof parsed.delta === "string" ? parsed.delta : "";
            assistantContent = mergeStreamingText(assistantContent, delta);
            const sanitized = extractThinkingContent(assistantContent);
            const hasOpenThink = /<think>/i.test(assistantContent);
            const hasCloseThink = /<\/think>/i.test(assistantContent);
            const stillThinking = hasOpenThink && !hasCloseThink;
            queueAiMessageUpdate({
              content: sanitized.visibleText || "",
              thinkingContent: reasoningContent || sanitized.thinkingText,
              isThinkingInProgress: stillThinking && !reasoningContent,
              isLoading: false,
            });
            continue;
          }

          if (eventName === "image") {
            const eventImages = Array.isArray(parsed.images)
              ? parsed.images
              : typeof parsed.url === "string" && parsed.url
                ? [parsed.url]
                : [];
            const normalizedImages = eventImages
              .map((img: unknown): { url: string; alt?: string } | null => {
                if (typeof img === "string") {
                  const trimmed = img.trim();
                  return trimmed ? { url: trimmed } : null;
                }
                if (img && typeof img === "object") {
                  const obj = img as { url?: unknown; alt?: unknown };
                  const url =
                    typeof obj.url === "string" ? obj.url.trim() : "";
                  if (!url) return null;
                  return {
                    url,
                    alt: typeof obj.alt === "string" ? obj.alt : undefined,
                  };
                }
                return null;
              })
              .filter((img: { url: string; alt?: string } | null): img is { url: string; alt?: string } => Boolean(img));

            appendAiImages(normalizedImages);
            if (normalizedImages.length > 0) {
              queueAiMessageUpdate({
                metadata: {
                  isImageGeneration: true,
                },
              });
            }
            continue;
          }

          if (eventName === "generated_file") {
            const generatedFile = normalizeGeneratedFilePayload(parsed);
            if (generatedFile) {
              appendGeneratedFiles([generatedFile]);
              queueAiMessageUpdate({ isLoading: false });
            }
            continue;
          }

          if (eventName === "title") {
            const titleChatId = getResolvedChatId(parsed);
            if (titleChatId) {
              adoptResolvedChatId(titleChatId);
            }
            const titleCandidate =
              typeof parsed.title === "string"
                ? parsed.title
                : typeof parsed.chat_title === "string"
                  ? parsed.chat_title
                  : "";
            const streamTitle = titleCandidate.trim();
            if (
              !isPersonaTest &&
              streamTitle &&
              currentChatId &&
              layoutContext?.updateChatTitleWithAnimation
            ) {
              layoutContext.updateChatTitleWithAnimation(
                currentChatId,
                streamTitle,
              );
            }
            if (!titleChatId) {
              tryResolveTempChatIdFromServer(streamTitle);
            }
            continue;
          }

          if (eventName === "ask_user") {
            const clarification = normalizeClarificationPrompt(parsed);
            if (!clarification) {
              continue;
            }

            const askUserChatId = getResolvedChatId(parsed);
            if (askUserChatId) {
              adoptResolvedChatId(askUserChatId);
            }

            const askUserTitle = parsed.title || parsed.chat_title;
            if (
              !isPersonaTest &&
              askUserTitle &&
              currentChatId &&
              layoutContext?.updateChatTitleWithAnimation
            ) {
              layoutContext.updateChatTitleWithAnimation(
                currentChatId,
                String(askUserTitle),
              );
            }

            applyClarificationPrompt(clarification);

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
            shouldStopReading = true;
            continue;
          }

          if (eventName === "message_saved") {
            const savedMessageId = normalizeUuidReference(
              parsed.message_id ?? parsed.messageId ?? null,
            );
            if (savedMessageId) {
              queueAiMessageUpdate(
                {
                  chatMessageId: savedMessageId,
                },
                true,
              );
            }
            continue;
          }

          if (eventName === "done") {
            const messageText =
              typeof parsed.response === "string"
                ? parsed.response
                : assistantContent;
            const messageMeta =
              parsed.metadata && typeof parsed.metadata === "object"
                ? parsed.metadata
                : null;
            const resolvedMessageId =
              parsed.message_id ?? parsed.messageId ?? null;
            const webSearchFromDone =
              normalizeWebSearchPayload(
                (parsed as { web_search?: unknown; webSearch?: unknown })
                  .web_search ??
                  (parsed as { web_search?: unknown; webSearch?: unknown })
                    .webSearch ??
                  (messageMeta as { web_search?: unknown; webSearch?: unknown })
                    ?.web_search ??
                  (messageMeta as { web_search?: unknown; webSearch?: unknown })
                    ?.webSearch ??
                  null,
              ) ?? undefined;

            const metadataBase: Message["metadata"] | undefined = messageMeta
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
                  sources: normalizeMessageSources(
                    (messageMeta as { sources?: unknown }).sources ??
                      (messageMeta as { citations?: unknown }).citations,
                  ),
                }
              : undefined;
            const metadata: Message["metadata"] | undefined =
              metadataBase || webSearchFromDone
                ? {
                    ...(metadataBase || {}),
                    ...(webSearchFromDone ? { webSearch: webSearchFromDone } : {}),
                  }
                : undefined;

            const sanitized = extractThinkingContent(
              messageText || assistantContent || "API didn't respond",
            );

            // Extract image data from done event if present
            const doneImages = Array.isArray(parsed.images)
              ? parsed.images
                  .map((img: unknown): { url: string; alt?: string } | null => {
                    if (typeof img === "string") {
                      const trimmed = img.trim();
                      return trimmed ? { url: trimmed } : null;
                    }
                    if (img && typeof img === "object") {
                      const obj = img as { url?: unknown; alt?: unknown };
                      const url =
                        typeof obj.url === "string" ? obj.url.trim() : "";
                      if (!url) return null;
                      return {
                        url,
                        alt: typeof obj.alt === "string" ? obj.alt : undefined,
                      };
                    }
                    return null;
                  })
                  .filter(
                    (img: { url: string; alt?: string } | null): img is { url: string; alt?: string } => Boolean(img),
                  )
              : [];

            type GeneratedAttachmentPayloadItem = {
              url: string;
              name?: string;
              isImage: boolean;
              s3Key?: string;
              mimeType?: string;
            };

            const generatedAttachmentPayload: GeneratedAttachmentPayloadItem[] = Array.isArray(parsed.file_attachments)
              ? parsed.file_attachments
                  .map((item: unknown) => {
                    if (!item || typeof item !== "object") return null;
                    const attachment = item as {
                      file_link?: unknown;
                      url?: unknown;
                      link?: unknown;
                      origin?: unknown;
                      s3_key?: unknown;
                      s3Key?: unknown;
                      mime_type?: unknown;
                      mimeType?: unknown;
                      file_name?: unknown;
                      fileName?: unknown;
                      name?: unknown;
                    };
                    const rawUrl =
                      attachment.file_link ?? attachment.url ?? attachment.link;
                    const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
                    if (!url) return null;

                    const origin =
                      typeof attachment.origin === "string"
                        ? attachment.origin.trim().toLowerCase()
                        : "";
                    if (origin !== "generated") return null;

                    const mimeRaw = attachment.mime_type ?? attachment.mimeType;
                    const mimeType =
                      typeof mimeRaw === "string" ? mimeRaw.trim().toLowerCase() : "";
                    const rawName =
                      attachment.file_name ??
                      attachment.fileName ??
                      attachment.name;
                    const name =
                      typeof rawName === "string" && rawName.trim().length > 0
                        ? rawName.trim()
                        : undefined;
                    const isImage =
                      mimeType.startsWith("image/") ||
                      /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url.toLowerCase());

                    return {
                      url,
                      name,
                      isImage,
                      s3Key:
                        typeof attachment.s3_key === "string"
                          ? attachment.s3_key
                          : undefined,
                      mimeType: mimeType || undefined,
                    };
                  })
                  .filter(
                    (
                      item: GeneratedAttachmentPayloadItem | null,
                    ): item is GeneratedAttachmentPayloadItem =>
                      Boolean(item),
                  )
              : [];

            // Extract uploaded (user) file attachments from done event to update
            // the user message with permanent URLs and original filenames
            const uploadedAttachmentsFromDone: Array<{
              id: string;
              type: "document" | "image";
              name: string;
              url: string;
            }> = Array.isArray(parsed.file_attachments)
              ? parsed.file_attachments
                  .map((item: unknown, idx: number) => {
                    if (!item || typeof item !== "object") return null;
                    const att = item as Record<string, unknown>;
                    const origin =
                      typeof att.origin === "string"
                        ? att.origin.trim().toLowerCase()
                        : "";
                    if (origin !== "uploaded" && origin !== "upload" && origin !== "user")
                      return null;
                    const rawUrl = att.file_link ?? att.url ?? att.link;
                    const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
                    if (!url) return null;
                    const rawName = att.file_name ?? att.fileName ?? att.name;
                    const name =
                      typeof rawName === "string" && rawName.trim().length > 0
                        ? rawName.trim()
                        : (() => {
                            try {
                              const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
                              return seg ? decodeURIComponent(seg) : `Document ${idx + 1}`;
                            } catch {
                              return `Document ${idx + 1}`;
                            }
                          })();
                    const mimeRaw = att.mime_type ?? att.mimeType;
                    const mimeType =
                      typeof mimeRaw === "string" ? mimeRaw.trim().toLowerCase() : "";
                    const isImage =
                      mimeType.startsWith("image/") ||
                      /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url.toLowerCase());
                    return {
                      id: `uploaded-${idx}`,
                      type: isImage ? ("image" as const) : ("document" as const),
                      name,
                      url,
                    };
                  })
                  .filter(
                    (
                      item: { id: string; type: "document" | "image"; name: string; url: string } | null,
                    ): item is { id: string; type: "document" | "image"; name: string; url: string } =>
                      Boolean(item),
                  )
              : [];

            const generatedAttachmentImages = generatedAttachmentPayload
              .filter((item) => item.isImage)
              .map((item) => ({
                url: item.url,
                alt: item.name,
              }));

            const generatedFilesFromDone = Array.isArray(
              parsed.generated_files,
            )
              ? parsed.generated_files
                  .map((item: unknown) => normalizeGeneratedFilePayload(item))
                  .filter(
                    (
                      item: GeneratedFilePayload | null,
                    ): item is GeneratedFilePayload => Boolean(item),
                  )
              : Array.isArray(parsed.generatedFiles)
                ? parsed.generatedFiles
                    .map((item: unknown) => normalizeGeneratedFilePayload(item))
                    .filter(
                      (
                        item: GeneratedFilePayload | null,
                      ): item is GeneratedFilePayload => Boolean(item),
                    )
                : [];

            const generatedFilesFromAttachments = generatedAttachmentPayload.map(
              (item) => ({
                url: item.url,
                filename: item.name,
                s3Key: item.s3Key,
                mimeType: item.mimeType,
              }),
            );

            const mergedGeneratedFiles = dedupeGeneratedFiles([
              ...(generatedFilesFromDone || []),
              ...generatedFilesFromAttachments,
            ]);

            const mergedDoneImages = [...doneImages, ...generatedAttachmentImages];

            const generatedFileUrls = new Set(
              mergedGeneratedFiles.map((f) => f.url.trim().toLowerCase()),
            );
            const mergedSources = [
              ...((metadata?.sources as MessageSource[] | undefined) || []),
            ].filter((source, index, arr) => {
              if (!source || typeof source.url !== "string") return false;
              if (generatedFileUrls.has(source.url.trim().toLowerCase())) {
                return false;
              }
              return arr.findIndex((candidate) => candidate.url === source.url) === index;
            });

            const finalMetadata: Message["metadata"] | undefined =
              metadata || mergedSources.length > 0 || mergedGeneratedFiles.length > 0
                ? {
                    ...(metadata || {}),
                    ...(mergedSources.length > 0 ? { sources: mergedSources } : {}),
                    ...(mergedGeneratedFiles.length > 0
                      ? { generatedFiles: mergedGeneratedFiles }
                      : {}),
                  }
                : undefined;

            // Use reasoning from dedicated events if available, otherwise from done payload or <think> tags
            const reasoningFromMeta =
              (messageMeta as { reasoning?: string; thoughts?: string })
                ?.reasoning ??
              (messageMeta as { thinking?: string; analysis?: string })
                ?.thinking ??
              (messageMeta as { analysis?: string })?.analysis ??
              (messageMeta as { thoughts?: string })?.thoughts ??
              undefined;
            const reasoningFromDone =
              typeof parsed.reasoning === "string"
                ? parsed.reasoning
                : typeof reasoningFromMeta === "string"
                  ? reasoningFromMeta
                  : undefined;
            const finalReasoning =
              reasoningContent || reasoningFromDone || sanitized.thinkingText;

            flushQueuedAiUpdate();
            queueAiMessageUpdate({
              content:
                sanitized.visibleText ||
                (finalReasoning ? "" : "API didn't respond"),
              thinkingContent: finalReasoning || null,
              isThinkingInProgress: false,
              chatMessageId:
                resolvedMessageId !== null && resolvedMessageId !== undefined
                  ? String(resolvedMessageId)
                  : undefined,
              metadata: finalMetadata,
              isLoading: false,
              toolStatus: null,
            }, true);

            if (mergedDoneImages.length > 0) {
              appendAiImages(mergedDoneImages);
              queueAiMessageUpdate({
                metadata: {
                  isImageGeneration: true,
                },
              }, true);
            }

            // Update user message attachments with permanent URLs from backend
            // This replaces blob URLs (which expire) with real server URLs and
            // ensures original filenames are preserved after page refresh.
            if (uploadedAttachmentsFromDone.length > 0 && userMessageId) {
              setMessages((prev = []) => {
                const next = prev.map((msg) => {
                  if (msg.id !== userMessageId) return msg;
                  return {
                    ...msg,
                    metadata: {
                      ...msg.metadata,
                      attachments: uploadedAttachmentsFromDone,
                    },
                  };
                });
                messageBufferRef.current = next;
                return next;
              }, currentChatId ?? undefined);
            }

            const doneChatId = getResolvedChatId(parsed);
            if (doneChatId) {
              adoptResolvedChatId(doneChatId);
              if (layoutContext?.setChatBoards) {
                layoutContext.setChatBoards((prev) =>
                  prev.map((b) =>
                    b.id === doneChatId
                      ? {
                          ...b,
                          name: parsed.title || parsed.chat_title || b.name,
                        }
                      : b,
                  ),
                );
              }
            } else {
              const doneTitleHint =
                typeof parsed.title === "string"
                  ? parsed.title
                  : typeof parsed.chat_title === "string"
                    ? parsed.chat_title
                    : "";
              tryResolveTempChatIdFromServer(doneTitleHint);
            }

            // Update chat title if provided in done event (works for both new and existing chats)
            const doneTitle = parsed.title || parsed.chat_title;
            if (
              !isPersonaTest &&
              doneTitle &&
              currentChatId &&
              layoutContext?.updateChatTitleWithAnimation
            ) {
              layoutContext.updateChatTitleWithAnimation(
                currentChatId,
                String(doneTitle),
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
            const rawError =
              typeof parsed.error === "string"
                ? parsed.error
                : "Unexpected error from model";

            // If the stream error is auth-related, log out instead of showing an error
            const lower = rawError.toLowerCase();
            if (
              lower.includes("token expired") ||
              lower.includes("not authenticated") ||
              lower.includes("unauthorized")
            ) {
              flushQueuedAiUpdate();
              queueAiMessageUpdate({
                content: "Your session has expired. Signing you out\u2026",
                isLoading: false,
              }, true);
              setIsResponding(false);
              streamFinished = true;
              shouldStopReading = true;
              reportSessionExpired("chat-sse-event");
              window.dispatchEvent(new Event("auth:session-expired"));
            } else {
              const errorMessage = friendlyApiError(rawError);
              reportError({
                title: "SSE Stream Error",
                message: rawError,
                severity: "error",
                source: "chat-sse-event",
              });
              flushQueuedAiUpdate();
              queueAiMessageUpdate({
                content: errorMessage,
                thinkingContent: null,
                isLoading: false,
                toolStatus: null,
              }, true);
              setIsResponding(false);
              streamFinished = true;
              shouldStopReading = true;
            }
          }
        }
      };

      // Read the stream
      while (true) {
        const { value, done } = await streamReader.read();
        if (value) processChunk(value);
        if (done || shouldStopReading) break;
      }

      // Flush any remaining data left in the buffer (stream may end without trailing \n\n).
      // Do this even when streamFinished=true so late events (e.g. generated_file)
      // that arrive after done are still rendered without a page refresh.
      if (buffer.trim()) {
        // Append a double newline so the last event gets parsed by processChunk
        buffer += "\n\n";
        processChunk(new Uint8Array(0));
      }

      // Release the connection so the browser can reuse the slot
      streamReader.cancel().catch(() => {});
      flushQueuedAiUpdate();

      // If stream ended without a done/error event, treat accumulated content as complete
      if (!streamFinished) {
        if (assistantContent) {
          const sanitized = extractThinkingContent(assistantContent);
          const finalReasoning = reasoningContent || sanitized.thinkingText;
          queueAiMessageUpdate({
            content: sanitized.visibleText || assistantContent,
            thinkingContent: finalReasoning || null,
            isThinkingInProgress: false,
            isLoading: false,
          }, true);
        } else {
          queueAiMessageUpdate({
            content: "Generation interrupted. Please retry.",
            thinkingContent: null,
            isLoading: false,
          }, true);
        }
        setIsResponding(false);
      }
    } catch (error) {
      // If the user explicitly requested to stop, treat this as a
      // graceful cancellation, not an error.
      if (stopRequestedRef.current) {
        try {
          reader?.cancel();
        } catch {
          // ignore cancellation errors
        }

        setMessages(
          (prev = []) =>
            prev.map((msg) => {
              if (msg.id !== loadingMessageId) return msg;

              const baseContent = msg.content || "";
              const marker = "Generation Stopped By User";
              const hasMarker = baseContent.includes(marker);
              const suffix =
                baseContent.length > 0
                  ? hasMarker
                    ? ""
                    : `\n\n${marker}`
                  : marker;

              return {
                ...msg,
                content: `${baseContent}${suffix}`,
                isLoading: false,
                isThinkingInProgress: false,
                metadata: {
                  ...msg.metadata,
                  stoppedByUser: true,
                },
              };
            }),
          chatId ?? undefined,
        );

        setIsResponding(false);
        return;
      }

      // Release the connection on error too
      try {
        reader?.cancel();
      } catch {
        // ignore cancellation errors
      }
      console.error("Error fetching AI response:", error);

      const rawMsg =
        error instanceof Error && error.message
          ? error.message
          : "Failed to connect to AI service";

      // If the error is auth-related, log out silently
      const lower = rawMsg.toLowerCase();
      if (
        lower.includes("token expired") ||
        lower.includes("session has expired") ||
        lower.includes("not authenticated") ||
        lower.includes("unauthorized") ||
        lower.includes("401")
      ) {
        reportSessionExpired("chat-catch");
        setIsResponding(false);
        window.dispatchEvent(new Event("auth:session-expired"));
        return;
      }

      const errorMessage = friendlyApiError(rawMsg);

      reportError({
        title: "Chat Request Failed",
        message: rawMsg,
        severity: "error",
        source: "chat-catch",
      });

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
        id: (Date.now() + 1).toString(),
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
        avatarUrl: selectedPersona?.imageUrl || "/personas/userAvatar.png",
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
    const newInput =
      lastAtIndex !== -1 ? input.substring(0, lastAtIndex) : input;
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

  const handleClearReference = () => {
    setReferencedMessage(null);
  };

  const handleScroll = () => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      const isAtBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 50;
      setIsScrolledToBottom(isAtBottom);
    }
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
                                href={attachment.url}
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
                    {pinSearchQuery
                      ? `Searching: "${pinSearchQuery}"`
                      : "Select a pin to mention"}
                  </div>
                  <div
                    ref={pinDropdownScrollRef}
                    className={cn(
                      "max-h-76 overflow-y-auto flex flex-col",
                      chatStyles.customScrollbar,
                    )}
                  >
                    {filteredPins.map((pin, idx) => {
                      const isHighlighted = idx === highlightedPinIndex;
                      const pinText = stripMarkdown(pin.text);
                      const displayText =
                        pinText.length > 80
                          ? pinText.slice(0, 80) + "..."
                          : pinText;

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
                              style={{
                                backgroundColor: getPinSeparatorColor(pin.id),
                              }}
                            ></div>
                            <div className="flex flex-col">
                              <p className="truncate font-medium text-inherit text-black text-[13px]">
                                {pinSearchQuery
                                  ? highlightMatch(displayText, pinSearchQuery)
                                  : renderInlineMarkdown(
                                      formatPinTitle(
                                        displayText || "Untitled Pin",
                                      ),
                                    )}
                              </p>
                              {pin.tags && pin.tags.length > 0 && (
                                <div className="mt-1 flex gap-1">
                                  {pin.tags.slice(0, 3).map((tag, i) => (
                                    <span
                                      key={i}
                                      className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] text-[#767676]"
                                    >
                                      {pinSearchQuery
                                        ? highlightMatch(tag, pinSearchQuery)
                                        : tag}
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
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 8v4M12 16h.01"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
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
                    attachment.type !== "image" ? (
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
                              : getDocumentKindLabel(attachment.name)}
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
                      : "Use @ to attach your saved pins .... "
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
                      accept={DOCUMENT_UPLOAD_ACCEPT}
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
                        style={{ width: "auto" }}
                      >
                        <button
                          onClick={() => {
                            handleAttachClick();
                            setShowAttachMenu(false);
                          }}
                          className="flex items-center gap-1.5 rounded-lg cursor-pointer bg-white p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-[#666666]" />
                          <span>Attach images or files</span>
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
                            "flex items-center gap-1.5 rounded-lg cursor-pointer border p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap",
                            webSearchEnabled
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-none bg-white text-[#1E1E1E]",
                          )}
                        >
                          <Globe
                            className={cn(
                              "h-3.5 w-3.5",
                              webSearchEnabled
                                ? "text-blue-600"
                                : "text-[#666666]",
                            )}
                          />
                          <span>Web Search</span>
                          {webSearchEnabled && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                          )}
                        </button>
                        {canAccessFeature(user?.planType, "mistralOcr") && (
                          <button
                            onClick={() => {
                              setUseMistralOcr(!useMistralOcr);
                              setShowAttachMenu(false);
                              toast(
                                useMistralOcr
                                  ? "Mistral OCR disabled"
                                  : "Mistral OCR enabled",
                                {
                                  description: useMistralOcr
                                    ? "Using standard file processing"
                                    : "Files will be processed with Mistral OCR",
                                },
                              );
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg cursor-pointer border p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap",
                              useMistralOcr
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-none bg-white text-[#1E1E1E]",
                            )}
                          >
                            <ScanText
                              className={cn(
                                "h-3.5 w-3.5",
                                useMistralOcr
                                  ? "text-orange-600"
                                  : "text-[#666666]",
                              )}
                            />
                            <span>Mistral OCR</span>
                            {useMistralOcr && (
                              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600"></div>
                            )}
                          </button>
                        )}
                        <div
                          className="relative"
                          onMouseEnter={() => {
                            if (styleSubmenuTimeout.current) {
                              clearTimeout(styleSubmenuTimeout.current);
                              styleSubmenuTimeout.current = null;
                            }
                            setShowStyleSubmenu(true);
                          }}
                          onMouseLeave={() => {
                            styleSubmenuTimeout.current = setTimeout(() => {
                              setShowStyleSubmenu(false);
                              styleSubmenuTimeout.current = null;
                            }, 150);
                          }}
                        >
                          <button
                            onClick={() => setShowStyleSubmenu(!showStyleSubmenu)}
                            className={cn(
                              "w-full flex items-center gap-1.5 rounded-lg cursor-pointer border p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap",
                              selectedTone
                                ? "border-purple-500 bg-purple-50 text-purple-700"
                                : "border-none bg-white text-[#1E1E1E]",
                            )}
                          >
                            <Palette
                              className={cn(
                                "h-3.5 w-3.5",
                                selectedTone
                                  ? "text-purple-600"
                                  : "text-[#666666]",
                              )}
                            />
                            <span>Use Style</span>
                            <ChevronRight
                              className={cn(
                                "h-3 w-3 ml-auto",
                                selectedTone
                                  ? "text-purple-600"
                                  : "text-[#999999]",
                              )}
                            />
                          </button>
                          {showStyleSubmenu && (
                            <div
                              className="absolute w-[250px] max-h-[320px] left-full bottom-0 flex flex-col rounded-lg border border-[#E5E5E5] bg-white py-1 shadow-lg overflow-y-auto customScrollbar2"
                              style={{ marginLeft: "-4px", paddingLeft: "4px" }}
                            >
                              {/* None option to clear selection */}
                              <button
                                onClick={() => {
                                  setSelectedTone(null);
                                  setShowStyleSubmenu(false);
                                  setShowAttachMenu(false);
                                  toast("Style removed", {
                                    description: "Using default AI style",
                                  });
                                }}
                                className={cn(
                                  "cursor-pointer flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#F5F5F5] w-full",
                                  !selectedTone
                                    ? "bg-[#F5F5F5] font-medium text-[#1E1E1E]"
                                    : "text-[#666666]",
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium">None</div>
                                  <div className="text-[10px] text-[#888888]">Default AI behavior</div>
                                </div>
                                {!selectedTone && (
                                  <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                                )}
                              </button>
                              <div className="mx-2 my-1 h-px bg-[#E5E5E5]" />
                              {STYLE_TONES.map((tone) => (
                                <button
                                  key={tone.tone_id}
                                  onClick={() => {
                                    setSelectedTone(tone);
                                    setShowStyleSubmenu(false);
                                    setShowAttachMenu(false);
                                    toast(`Style: ${tone.label}`, {
                                      description: tone.description,
                                    });
                                  }}
                                  className={cn(
                                    "cursor-pointer flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#F5F5F5] w-full",
                                    selectedTone?.tone_id === tone.tone_id
                                      ? "bg-purple-50 text-purple-700 font-medium"
                                      : "text-[#1E1E1E]",
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium">{tone.label}</div>
                                    <div className="text-[10px] text-[#888888] truncate">{tone.description}</div>
                                  </div>
                                  {selectedTone?.tone_id === tone.tone_id && (
                                    <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Choose Persona dropdown and web search indicator */}
                <div className="flex items-center gap-2">
                  {!hidePersonaButton && (
                    <div className="relative" ref={personaDropdownRef}>
                      {/* <Button
                        variant="ghost"
                        onClick={() =>
                          setShowPersonaDropdown(!showPersonaDropdown)
                        }
                        className="pointer-events-none flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#f5f5f5] bg-white px-3 text-xs font-medium text-[#1E1E1E]/30 hover:bg-[#E5E5E5] hover:border-[#D9D9D9]"
                        title="Choose Persona"
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F5F5F5] overflow-hidden border border-[#E5E5E5]">
                          {selectedPersona?.avatar ? (
                            <img
                              src={selectedPersona.avatar}
                              alt={selectedPersona.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserPlus className="h-3 w-3" />
                          )}
                        </div>
                        <span>
                          {selectedPersona
                            ? selectedPersona.name
                            : "Choose Persona"}
                        </span>
                        {selectedPersona && (selectedPersona.modelName || selectedPersona.providerName) && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[10px] font-medium text-[#666666] border border-[#E5E5E5]">
                            {selectedPersona.modelName || selectedPersona.providerName}
                          </span>
                        )}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button> */}

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
                                highlightedPersonaIndex ===
                                activePersonas.length
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
                                    (idx === highlightedPersonaIndex && highlightedPersonaIndex >= 0
                                      ? "bg-[var(--unofficial-accent-2,#E5E5E5)] text-black font-medium"
                                      : selectedPersona?.id === persona.id && highlightedPersonaIndex === -1
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
                                  {(persona.modelName ||
                                    persona.providerName) && (
                                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[10px] font-medium text-[#666666] border border-[#E5E5E5]">
                                      {persona.modelName ||
                                        persona.providerName}
                                    </span>
                                  )}
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
                  {/* Web search indicator button */}
                  {webSearchEnabled && (
                    <button
                      type="button"
                      aria-label="Disable web search"
                      onClick={() => {
                        setWebSearchEnabled(false);
                        toast("Web search disabled", {
                          description: "Results will not include web search",
                        });
                      }}
                      className="cursor-pointer w-auto h-[36px] font-geist font-medium text-sm text-[#4A8CEB] bg-transparent rounded-[8px] flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <Globe size={16} />
                      <p>Web Search</p>
                      <X size={16} />
                    </button>
                  )}
                  {/* Mistral OCR indicator button */}
                  {useMistralOcr && canAccessFeature(user?.planType, "mistralOcr") && (
                    <button
                      type="button"
                      aria-label="Disable Mistral OCR"
                      onClick={() => {
                        setUseMistralOcr(false);
                        toast("Mistral OCR disabled", {
                          description: "Using standard file processing",
                        });
                      }}
                      className="cursor-pointer w-auto h-[36px] font-geist font-medium text-sm text-orange-600 bg-transparent rounded-[8px] flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <ScanText size={16} />
                      <p>Mistral OCR</p>
                      <X size={16} />
                    </button>
                  )}
                  {/* Style/Tone indicator button */}
                  {selectedTone && (
                    <button
                      type="button"
                      aria-label="Remove style"
                      onClick={() => {
                        setSelectedTone(null);
                        toast("Style removed", {
                          description: "Using default AI style",
                        });
                      }}
                      className="cursor-pointer w-auto h-[36px] font-geist font-medium text-sm text-[#9333EA] bg-transparent rounded-[8px] flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <Palette size={16} />
                      <p>{selectedTone.label}</p>
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="flex flex-1 shrink-0 items-center justify-end gap-4">
                  {isResponding ? (
                    <Button
                      type="button"
                      onClick={handleStopGeneration}
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
                      {/* mic icon button replaced to send icon */}
                      <Send
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
