"use client";

import React, { useState, useRef, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders } from "@/lib/jwt-utils";
import {
  ChevronDown,
  ChevronUp,
  Share2,
  Pencil,
  Plus,
  Paperclip,
  Globe,
  X,
  Send,
  Mic,
  Square,
  Info,
  Sparkles,
  FileText,
  Upload,
} from "lucide-react";
import { useFileDrop } from "@/hooks/use-file-drop";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage, type Message } from "@/components/chat/chat-message";
import { toast } from "@/lib/toast-helper";
import { AppLayoutContext } from "@/components/layout/app-layout";
import chatStyles from "./persona-chat-interface.module.css";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/config";
import { getModelIcon } from "@/lib/model-icons";
import { useAuth } from "@/context/auth-context";
import { extractThinkingContent } from "@/lib/thinking";
import { mergeStreamingText } from "@/lib/streaming";
import {
  fetchPersonaChatMessages,
  fetchPersonaChats,
} from "@/lib/api/personas";

const DOCUMENT_FILE_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".csv", ".xls", ".xlsx"];

const DOCUMENT_UPLOAD_ACCEPT =
  ".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,.csv,text/csv,application/csv,.xls,application/vnd.ms-excel,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*";

const isDocumentFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (file.type.startsWith("image/")) return true;
  if (DOCUMENT_FILE_EXTENSIONS.some((ext) => fileName.endsWith(ext))) return true;
  return (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
};

const getDocumentKindLabel = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "Word Document";
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "PowerPoint Presentation";
  if (lower.endsWith(".csv")) return "CSV Document";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "Excel Document";
  if (lower.endsWith(".pdf")) return "PDF Document";
  if (lower.startsWith("document")) return "Uploaded File";
  return "Document";
};

interface PersonaData {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  modelName?: string;
  providerName?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  createdAt?: string;
  isActive?: boolean;
}

interface PersonaChatFullPageProps {
  personaId: string;
  persona: PersonaData;
  onEditPersona: () => void;
  /** Backend or local session ID — used to persist/restore messages. */
  chatId?: string | null;
}

export function PersonaChatFullPage({
  personaId,
  persona,
  onEditPersona,
  chatId,
}: PersonaChatFullPageProps) {
  const layoutContext = useContext(AppLayoutContext);
  const { user } = useAuth();
  const router = useRouter();
  const [detailsSectionOpen, setDetailsSectionOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const normalizeChatId = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const normalized = id.trim();
    return normalized.length > 0 ? normalized : null;
  };
  const [activeChatId, setActiveChatId] = useState<string | null>(
    normalizeChatId(chatId),
  );

  // Sync activeChatId when the chatId prop changes (user navigates between saved chats).
  // Uses a functional updater so it can read fresh state: if activeChatId already matches
  // (e.g. the URL just caught up after handleSend set it internally), we do nothing.
  useEffect(() => {
    const resolved = normalizeChatId(chatId);
    setActiveChatId((prev) => {
      if (prev === resolved) return prev;
      // Clear messages when:
      // - Switching to a new empty chat (prev had a value, resolved is null)
      // - Switching between two different saved chats
      // Do NOT clear when going from null → a value (first message just assigned a backend ID)
      if (prev && prev !== resolved) {
        setDisplayMessages([]);
        setInput("");
        setIsResponding(false);
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
      }
      return resolved;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
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
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const processFilesRef = useRef<(files: File[]) => void>(() => {});
  const flowtingLogoUrl = "/new-logos/souvenir-logo.svg";

  const { isDragging, dropZoneProps, handlePaste } = useFileDrop({
    onFiles: (files) => processFilesRef.current(files),
    disabled: isResponding,
  });

  // Paste listener for the whole chat area
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // Clear attachments when switching chats
  useEffect(() => {
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.url));
      return [];
    });
  }, [activeChatId]);

  // Click outside to close attach menu
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

  const personaName = persona?.name?.trim() || "Untitled Persona";
  const avatarUrl = persona?.avatar
    ? persona.avatar.startsWith("http") ||
      persona.avatar.startsWith("data:") ||
      persona.avatar.startsWith("blob:")
      ? persona.avatar
      : `${API_BASE_URL}${persona.avatar.startsWith("/") ? "" : "/"}${persona.avatar}`
    : null;

  // Load existing messages from backend when opening a saved chat
  useEffect(() => {
    if (!activeChatId) return;
    let cancelled = false;
    fetchPersonaChatMessages(personaId, activeChatId)
      .then((msgs) => {
        if (cancelled || msgs.length === 0) return;
        const converted: Message[] = msgs.flatMap((m) => {
          const items: Message[] = [];
          if (m.input) {
            // Extract user file attachments from backend data
            const userAttachments: Array<{
              id: string;
              type: "document" | "image";
              name: string;
              url: string;
            }> = [];

            // From file_attachments (structured array with origin)
            if (Array.isArray(m.file_attachments)) {
              m.file_attachments.forEach((att, idx) => {
                if (!att || typeof att !== "object") return;
                const origin = (att.origin || "").trim().toLowerCase();
                if (origin !== "uploaded" && origin !== "upload" && origin !== "user") return;
                const url = (att.file_link || att.url || att.link || "").trim();
                if (!url) return;
                const rawName = att.file_name || att.fileName || att.name || "";
                const name = rawName.trim() || (() => {
                  try {
                    const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
                    return seg ? decodeURIComponent(seg) : `Document ${idx + 1}`;
                  } catch {
                    return `Document ${idx + 1}`;
                  }
                })();
                const mimeType = (att.mime_type || att.mimeType || "").trim().toLowerCase();
                const isImage =
                  mimeType.startsWith("image/") ||
                  /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url.toLowerCase());
                userAttachments.push({
                  id: `uploaded-${idx}`,
                  type: isImage ? "image" : "document",
                  name,
                  url,
                });
              });
            }

            // From file_links (simple URL array) if no structured attachments found
            if (userAttachments.length === 0 && Array.isArray(m.file_links)) {
              m.file_links.forEach((link, idx) => {
                if (typeof link !== "string" || !link.trim()) return;
                const url = link.trim();
                const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url.toLowerCase());
                const name = (() => {
                  try {
                    const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
                    return seg ? decodeURIComponent(seg) : `Document ${idx + 1}`;
                  } catch {
                    return `Document ${idx + 1}`;
                  }
                })();
                userAttachments.push({
                  id: `file-link-${idx}`,
                  type: isImage ? "image" : "document",
                  name,
                  url,
                });
              });
            }

            // From image_links
            if (Array.isArray(m.image_links)) {
              m.image_links.forEach((link, idx) => {
                if (typeof link !== "string" || !link.trim()) return;
                userAttachments.push({
                  id: `img-link-${idx}`,
                  type: "image",
                  name: `Image ${idx + 1}`,
                  url: link.trim(),
                });
              });
            }

            items.push({
              id: `${m.id}-user`,
              sender: "user",
              content: m.input,
              avatarUrl: "/personas/userAvatar.png",
              avatarHint: "User",
              ...(userAttachments.length > 0
                ? { metadata: { attachments: userAttachments } }
                : {}),
            });
          }
          if (m.output || (Array.isArray(m.file_attachments) && m.file_attachments.some((att: Record<string, unknown>) => att && (att.origin === "generated")))) {
            const sanitized = extractThinkingContent(m.output || "");

            // Extract generated images from file_attachments
            const generatedImages: Array<{ url: string; alt?: string }> = [];
            if (Array.isArray(m.file_attachments)) {
              m.file_attachments.forEach((att: Record<string, unknown>) => {
                if (!att || typeof att !== "object") return;
                const origin = (String(att.origin || "")).trim().toLowerCase();
                if (origin !== "generated") return;
                const url = (String(att.file_link || att.url || att.link || "")).trim();
                if (!url) return;
                const mimeType = (String(att.mime_type || att.mimeType || "")).trim().toLowerCase();
                if (mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url)) {
                  generatedImages.push({ url });
                }
              });
            }

            items.push({
              id: `${m.id}-ai`,
              sender: "ai",
              content: sanitized.visibleText || m.output || "",
              thinkingContent: m.reasoning || sanitized.thinkingText || null,
              avatarUrl: avatarUrl || "/new-logos/souvenir-logo.svg",
              avatarHint: personaName,
              ...(generatedImages.length > 0
                ? {
                    images: generatedImages,
                    metadata: { isImageGeneration: true },
                  }
                : {}),
            });
          }
          return items;
        });
        // Restore attachments from localStorage (backend doesn't persist them for persona chats)
        try {
          const storageKey = `persona-attachments-${activeChatId}`;
          const savedMap = JSON.parse(localStorage.getItem(storageKey) || "{}");
          if (Object.keys(savedMap).length > 0) {
            converted.forEach((msg) => {
              if (
                msg.sender === "user" &&
                (!msg.metadata?.attachments || msg.metadata.attachments.length === 0)
              ) {
                const saved = savedMap[msg.content];
                if (Array.isArray(saved) && saved.length > 0) {
                  msg.metadata = { ...msg.metadata, attachments: saved };
                }
              }
            });
          }
        } catch { /* localStorage unavailable */ }

        // Preserve already-rendered local conversation (e.g. streaming on new chat id adoption)
        // and only hydrate when the viewport is empty.
        setDisplayMessages((prev) => (prev.length > 0 ? prev : converted));
      })
      .catch(() => {
        /* silently ignore */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, personaId]);

  useEffect(() => {
    if (scrollViewportRef.current && isScrolledToBottom) {
      scrollViewportRef.current.scrollTop =
        scrollViewportRef.current.scrollHeight;
    }
  }, [displayMessages, isScrolledToBottom]);

  const handleScroll = () => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      const isAtBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 50;
      setIsScrolledToBottom(isAtBottom);
    }
  };

  const handleScrollToBottom = () => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      setIsScrolledToBottom(true);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      const maxHeight = 200;
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textareaRef.current.style.overflowY =
        scrollHeight > maxHeight ? "auto" : "hidden";
    }
  }, [input]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFiles = (files: File[]) => {
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const filesToAdd: Array<{
      id: string;
      type: "document" | "image";
      name: string;
      url: string;
      file: File;
      isUploading: boolean;
      uploadProgress: number;
    }> = [];

    for (const file of files) {
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
      if (!isDocumentFile(file)) {
        toast.error(`${file.name} not supported`, {
          description: "Please upload PDF, Word, PowerPoint, CSV, Excel, or image files only.",
        });
        continue;
      }

      const isImage = file.type.startsWith("image/");
      filesToAdd.push({
        id: crypto.randomUUID(),
        type: isImage ? "image" : "document",
        name: file.name,
        url: URL.createObjectURL(file),
        file,
        isUploading: true,
        uploadProgress: 0,
      });
    }

    if (filesToAdd.length === 0) return;
    setAttachments((prev) => [...prev, ...filesToAdd]);

    filesToAdd.forEach((attachment) => {
      const duration = Math.min(Math.max((attachment.file.size / (1024 * 1024)) * 200, 500), 3000);
      const steps = 20;
      const stepDuration = duration / steps;
      let progress = 0;
      const interval = setInterval(() => {
        progress += 100 / steps;
        if (progress >= 100) {
          clearInterval(interval);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id ? { ...a, isUploading: false, uploadProgress: 100 } : a,
            ),
          );
        } else {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id ? { ...a, uploadProgress: Math.round(progress) } : a,
            ),
          );
        }
      }, stepDuration);
    });
  };
  processFilesRef.current = processFiles;

  const handleShare = () => {
    toast.info("Share", {
      description: "Share persona feature coming soon.",
    });
  };

  const TOOL_DISPLAY_NAMES: Record<string, string> = {
    doc_execute: "Generating document...",
    csv_execute: "Analyzing spreadsheet...",
    web_search: "Searching the web...",
  };

  const formatToolDisplayName = (toolName: string): string =>
    TOOL_DISPLAY_NAMES[toolName] ?? `Running ${toolName}...`;

  const normalizeWebSearchPayload = (
    raw: unknown,
  ): { query: string; links: string[] } | null => {
    if (!raw || typeof raw !== "object") return null;
    const payload = raw as Record<string, unknown>;
    const query =
      (typeof payload.query === "string" ? payload.query.trim() : "") ||
      (typeof payload.search_query === "string"
        ? payload.search_query.trim()
        : "") ||
      (typeof payload.searchQuery === "string"
        ? payload.searchQuery.trim()
        : "");
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
            (typeof obj.url === "string" ? obj.url.trim() : "") ||
            (typeof obj.link === "string" ? obj.link.trim() : "");
          return url;
        }
        return "";
      })
      .filter(Boolean);
    return { query, links };
  };

  const normalizeGeneratedFilePayload = (
    raw: unknown,
  ): { url: string; s3Key?: string; filename?: string; mimeType?: string } | null => {
    if (!raw || typeof raw !== "object") return null;
    const payload = raw as Record<string, unknown>;
    const rawUrl = payload.url ?? payload.file_link ?? payload.link;
    const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
    if (!url) return null;

    const filenameRaw =
      payload.filename ?? payload.file_name ?? payload.fileName ?? payload.name;
    const filename =
      typeof filenameRaw === "string" && filenameRaw.trim().length > 0
        ? filenameRaw.trim()
        : undefined;

    const s3KeyRaw = payload.s3_key ?? payload.s3Key;
    const s3Key =
      typeof s3KeyRaw === "string" && s3KeyRaw.trim().length > 0
        ? s3KeyRaw.trim()
        : undefined;

    const mimeTypeRaw = payload.mime_type ?? payload.mimeType;
    const mimeType =
      typeof mimeTypeRaw === "string" && mimeTypeRaw.trim().length > 0
        ? mimeTypeRaw.trim()
        : undefined;

    return { url, s3Key, filename, mimeType };
  };

  const handleSend = async () => {
    const trimmedContent = input.trim();
    if ((!trimmedContent && attachments.length === 0) || isResponding) return;

    const userMessageId = `user-${Date.now()}`;
    const aiMessageId = `ai-${Date.now() + 1}`;

    // Convert ALL attachments to data URLs so they survive page refresh
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
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(a.file);
          });
          return { id: a.id, type: a.type, name: a.name, url: dataUrl };
        }),
      );
    }

    const userMessage: Message = {
      id: userMessageId,
      sender: "user",
      content: trimmedContent,
      avatarUrl: "/personas/userAvatar.png",
      avatarHint: "User",
      metadata: {
        attachments: persistentAttachments,
      },
    };

    setDisplayMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsResponding(true);

    const loadingMessage: Message = {
      id: aiMessageId,
      sender: "ai",
      content: "",
      isLoading: true,
      avatarUrl: avatarUrl || flowtingLogoUrl,
      avatarHint: personaName,
    };

    setDisplayMessages((prev) => [...prev, loadingMessage]);

    try {
      // Build chat history for persona test
      const chatHistory = displayMessages.map((msg) => ({
        role:
          msg.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.content,
      }));

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const formData = new FormData();
      formData.append("input", trimmedContent);

      // Append file attachments - 30mb limit
      const filesToUpload = attachments.map((a) => a.file);
      const MAX_FILE_SIZE = 30 * 1024 * 1024;
      const oversizedFiles = filesToUpload.filter((f) => f.size > MAX_FILE_SIZE);
      if (oversizedFiles.length > 0) {
        toast.error("File too large", {
          description: `${oversizedFiles[0].name} exceeds 30MB limit.`,
        });
        setIsResponding(false);
        return;
      }
      filesToUpload.forEach((file) => {
        formData.append("files", file);
      });

      // Enable OCR for document files (non-image)
      const hasDocuments = filesToUpload.some((f) => !f.type.startsWith("image/"));
      if (hasDocuments) {
        formData.append("use_mistral_ocr", "true");
      }

      // Clear attachments after capturing files
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      setAttachments([]);

      let resolvedChatId = activeChatId;
      let tempSidebarChatId: string | null = null;

      if (!resolvedChatId) {
        tempSidebarChatId = `temp-${Date.now()}`;
        window.dispatchEvent(
          new CustomEvent("persona-chat-title-updated", {
            detail: {
              personaId,
              chatId: tempSidebarChatId,
              title: "New Chat",
            },
          }),
        );
      }

      const resolveChatIdFromPayload = (payload: unknown): string | null => {
        if (!payload || typeof payload !== "object") return null;
        const candidate = payload as {
          chat_id?: string | number | null;
          chatId?: string | number | null;
        };
        const raw = candidate.chat_id ?? candidate.chatId ?? null;
        if (raw === null || raw === undefined) return null;
        const normalized = String(raw).trim();
        return normalized ? normalized : null;
      };

      const applyResolvedChatId = (nextChatId: string) => {
        const normalizedChatId = nextChatId.trim();
        if (!normalizedChatId || normalizedChatId === resolvedChatId) {
          return;
        }
        if (tempSidebarChatId && tempSidebarChatId !== normalizedChatId) {
          window.dispatchEvent(
            new CustomEvent("persona-chat-id-resolved", {
              detail: {
                personaId,
                tempChatId: tempSidebarChatId,
                chatId: normalizedChatId,
              },
            }),
          );
          tempSidebarChatId = null;
        }
        resolvedChatId = normalizedChatId;
        setActiveChatId(normalizedChatId);
        router.replace(
          `/personas/${personaId}/chat?chatId=${normalizedChatId}`,
        );
      };

      const endpoint = resolvedChatId
        ? `${API_BASE_URL}/persona/${personaId}/chats/${resolvedChatId}/stream`
        : `${API_BASE_URL}/persona/${personaId}/chats/create`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders({}),
        credentials: "include",
        signal: controller.signal,
        body: formData,
      });

      // Capture chatId from response header for new chats (fallback)
      if (!resolvedChatId) {
        const newChatId = response.headers.get("X-Chat-Id");
        if (newChatId) {
          applyResolvedChatId(newChatId);
        }
      }

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      // Handle SSE streaming response
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let reasoningContent = "";

      const updateAiMessage = (fields: Partial<Message>) => {
        setDisplayMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  ...fields,
                  metadata:
                    msg.metadata || fields.metadata
                      ? { ...(msg.metadata || {}), ...(fields.metadata || {}) }
                      : undefined,
                }
              : msg,
          ),
        );
      };

      const reader = response.body.getReader();

      const tryResolveChatIdFromServer = (titleHint?: string, retries = 3) => {
        if (resolvedChatId) return;
        const normalizedTitleHint = (titleHint || "").trim().toLowerCase();
        const inputPrefix = trimmedContent.slice(0, 50).toLowerCase();

        void fetchPersonaChats(personaId)
          .then((chats) => {
            if (!chats || chats.length === 0) {
              if (retries > 0) {
                setTimeout(
                  () => tryResolveChatIdFromServer(titleHint, retries - 1),
                  500,
                );
              }
              return;
            }

            const candidates = chats.map((chat) => ({
              id: String(chat.id),
              title: String(chat.chat_title || "").trim(),
            }));

            let matched =
              normalizedTitleHint.length > 0
                ? candidates.find(
                    (chat) => chat.title.toLowerCase() === normalizedTitleHint,
                  )
                : undefined;

            if (!matched && inputPrefix.length > 0) {
              matched = candidates.find((chat) =>
                chat.title.toLowerCase().startsWith(inputPrefix),
              );
            }

            const fallback = candidates[0];
            const resolved = (matched || fallback)?.id;
            if (!resolved) {
              if (retries > 0) {
                setTimeout(
                  () => tryResolveChatIdFromServer(titleHint, retries - 1),
                  500,
                );
              }
              return;
            }

            if (!resolvedChatId) {
              applyResolvedChatId(resolved);
            }
          })
          .catch(() => {
            if (retries > 0) {
              setTimeout(
                () => tryResolveChatIdFromServer(titleHint, retries - 1),
                500,
              );
            }
          });
      };

      const updateSidebarTitle = (title: string) => {
        const normalizedTitle = title.trim();
        if (!normalizedTitle) return;
        const targetChatId = resolvedChatId || tempSidebarChatId;
        if (!targetChatId) {
          tryResolveChatIdFromServer(normalizedTitle);
          return;
        }
        window.dispatchEvent(
          new CustomEvent("persona-chat-title-updated", {
            detail: {
              personaId,
              chatId: targetChatId,
              title: normalizedTitle,
            },
          }),
        );
      };

      const applySavedMessageId = (payload: Record<string, unknown>) => {
        const rawMessageId = payload.message_id ?? payload.messageId ?? null;
        if (rawMessageId === null || rawMessageId === undefined) return;
        const messageId = String(rawMessageId).trim();
        if (!messageId) return;

        const role =
          typeof payload.role === "string"
            ? payload.role.toLowerCase()
            : typeof payload.sender === "string"
              ? payload.sender.toLowerCase()
              : "";

        if (role === "user") {
          setDisplayMessages((prev) =>
            prev.map((msg) =>
              msg.id === userMessageId
                ? { ...msg, chatMessageId: messageId }
                : msg,
            ),
          );
          return;
        }

        updateAiMessage({ chatMessageId: messageId });
      };

      const processEventChunk = (eventChunk: string) => {
        if (!eventChunk.trim()) return;
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

        if (!dataStr) return;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(dataStr) as Record<string, unknown>;
        } catch (err) {
          console.warn("Failed to parse SSE data", err, dataStr);
          return;
        }

        // Normalize type-based format (no event name, uses parsed.type instead)
        if (!eventName && parsed.type) {
          if (parsed.type === "content") {
            eventName = "chunk";
            if (typeof parsed.content === "string" && !("delta" in parsed)) {
              parsed = { ...parsed, delta: parsed.content };
            }
          } else {
            eventName = String(parsed.type);
          }
        }

        const chatIdFromPayload = resolveChatIdFromPayload(parsed);
        if (!resolvedChatId && chatIdFromPayload) {
          applyResolvedChatId(chatIdFromPayload);
        }

        if (eventName === "metadata") {
          return;
        }

        if (eventName === "web_search") {
          const webSearch = normalizeWebSearchPayload(parsed);
          if (webSearch) {
            updateAiMessage({
              metadata: {
                webSearch,
              },
              isLoading: false,
            });
          }
          return;
        }

        if (eventName === "tool_calls_streaming") {
          const toolName =
            typeof parsed.content === "string"
              ? parsed.content
              : parsed.tool_call && typeof (parsed.tool_call as Record<string, unknown>).name === "string"
                ? String((parsed.tool_call as Record<string, unknown>).name)
                : "";
          if (toolName) {
            updateAiMessage({ toolStatus: formatToolDisplayName(toolName) });
          }
          return;
        }

        if (eventName === "tool_executing") {
          const toolName = typeof parsed.content === "string" ? parsed.content : "";
          const displayName = formatToolDisplayName(toolName);
          updateAiMessage({ toolStatus: displayName });
          return;
        }

        if (eventName === "tool_complete") {
          updateAiMessage({ toolStatus: null });
          return;
        }

        if (eventName === "tool_progress") {
          const tool = typeof parsed.tool === "string" ? parsed.tool : "";
          const filename = typeof parsed.filename === "string" ? parsed.filename : "";
          const status = typeof parsed.status === "string" ? parsed.status : "";
          if (status === "done") {
            updateAiMessage({ toolStatus: null });
          } else {
            const displayName = formatToolDisplayName(tool);
            const label = filename ? `${displayName} (${filename})` : displayName;
            updateAiMessage({ toolStatus: label });
          }
          return;
        }

        if (eventName === "docx_progress") {
          const step = typeof parsed.step === "string" ? parsed.step : "";
          const message = typeof parsed.message === "string" ? parsed.message : "";
          const filename = typeof parsed.filename === "string" ? parsed.filename : "";
          if (step === "done" || step === "error") {
            updateAiMessage({ toolStatus: null });
          } else {
            const label =
              message ||
              (filename ? `Processing ${filename}...` : "Processing document...");
            updateAiMessage({ toolStatus: label });
          }
          return;
        }

        if (eventName === "reasoning") {
          const delta =
            typeof parsed.delta === "string"
              ? parsed.delta
              : typeof parsed.content === "string"
                ? parsed.content
                : "";
          reasoningContent = mergeStreamingText(reasoningContent, delta);
          updateAiMessage({
            thinkingContent: reasoningContent,
            isThinkingInProgress: true,
            isLoading: false,
          });
          return;
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
          const modelAvatar = getModelIcon(providerName, modelName);
          const modelHint = [modelName, providerName]
            .filter(Boolean)
            .join(" ")
            .trim();
          updateAiMessage({
            avatarUrl: modelAvatar,
            avatarHint: modelHint || undefined,
            metadata: {
              modelName,
              providerName,
              llmModelId:
                (parsed.model_id ?? parsed.modelId ?? parsed.llm_model_id ?? parsed.llmModelId ?? null) as string | number | null,
            },
          });
          return;
        }

        if (eventName === "chunk") {
          const delta = typeof parsed.delta === "string" ? parsed.delta : "";
          assistantContent = mergeStreamingText(assistantContent, delta);
          const sanitized = extractThinkingContent(assistantContent);
          const hasOpenThink = /<think>/i.test(assistantContent);
          const hasCloseThink = /<\/think>/i.test(assistantContent);
          const stillThinking = hasOpenThink && !hasCloseThink;
          updateAiMessage({
            content: sanitized.visibleText || "",
            thinkingContent: reasoningContent || sanitized.thinkingText,
            isThinkingInProgress: stillThinking && !reasoningContent,
            isLoading: false,
          });
          return;
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
                const url = typeof obj.url === "string" ? obj.url.trim() : "";
                if (!url) return null;
                return { url, alt: typeof obj.alt === "string" ? obj.alt : undefined };
              }
              return null;
            })
            .filter((img: { url: string; alt?: string } | null): img is { url: string; alt?: string } => Boolean(img));
          if (normalizedImages.length > 0) {
            setDisplayMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                const existing = Array.isArray(msg.images) ? msg.images : [];
                const merged = [...existing, ...normalizedImages];
                return {
                  ...msg,
                  images: merged,
                  isLoading: false,
                  metadata: { ...(msg.metadata || {}), isImageGeneration: true },
                };
              }),
            );
          }
          return;
        }

        if (eventName === "generated_file") {
          const generatedFile = normalizeGeneratedFilePayload(parsed);
          if (!generatedFile) return;
          setDisplayMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== aiMessageId) return msg;
              const existing = Array.isArray(msg.metadata?.generatedFiles)
                ? msg.metadata.generatedFiles
                : [];
              const merged = [...existing, generatedFile].filter(
                (item, index, arr) =>
                  arr.findIndex(
                    (candidate) =>
                      candidate.url.trim().toLowerCase() ===
                      item.url.trim().toLowerCase(),
                  ) === index,
              );
              return {
                ...msg,
                isLoading: false,
                metadata: {
                  ...(msg.metadata || {}),
                  generatedFiles: merged,
                },
              };
            }),
          );
          return;
        }

        if (eventName === "title") {
          const streamTitleCandidate =
            typeof parsed.title === "string"
              ? parsed.title
              : typeof parsed.chat_title === "string"
                ? parsed.chat_title
                : "";
          if (streamTitleCandidate) {
            updateSidebarTitle(streamTitleCandidate);
          } else if (!resolvedChatId) {
            tryResolveChatIdFromServer();
          }
          return;
        }

        if (eventName === "message_saved") {
          applySavedMessageId(parsed);
          return;
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
            toolStatus: null,
          });
          setIsResponding(false);
          return;
        }

        if (eventName === "done") {
          applySavedMessageId(parsed);
          if (!resolvedChatId) {
            const doneTitleCandidate =
              typeof parsed.title === "string"
                ? parsed.title
                : typeof parsed.chat_title === "string"
                  ? parsed.chat_title
                  : "";
            tryResolveChatIdFromServer(doneTitleCandidate);
          }
          const finalContent =
            typeof parsed.content === "string"
              ? parsed.content
              : typeof parsed.response === "string"
                ? parsed.response
                : assistantContent;
          const sanitized = extractThinkingContent(finalContent);
          const finalReasoning =
            reasoningContent ||
            (typeof parsed.reasoning === "string" ? parsed.reasoning : "") ||
            sanitized.thinkingText;

          // Extract metadata from done payload
          const messageMeta =
            parsed.metadata && typeof parsed.metadata === "object"
              ? (parsed.metadata as Record<string, unknown>)
              : null;
          const doneMetadata: Record<string, unknown> = {
            modelName:
              (messageMeta as Record<string, unknown> | null)?.modelName ??
              (messageMeta as Record<string, unknown> | null)?.model_name ??
              persona.modelName,
            providerName:
              (messageMeta as Record<string, unknown> | null)?.providerName ??
              (messageMeta as Record<string, unknown> | null)?.provider_name ??
              persona.providerName,
          };
          if (messageMeta) {
            const metaTyped = messageMeta as Record<string, unknown>;
            if (metaTyped.inputTokens ?? metaTyped.input_tokens)
              doneMetadata.inputTokens = metaTyped.inputTokens ?? metaTyped.input_tokens;
            if (metaTyped.outputTokens ?? metaTyped.output_tokens)
              doneMetadata.outputTokens = metaTyped.outputTokens ?? metaTyped.output_tokens;
            if (metaTyped.totalCost ?? metaTyped.total_cost)
              doneMetadata.totalCost = metaTyped.totalCost ?? metaTyped.total_cost;
          }

          // Extract generated files from done event
          const generatedFilesFromDone: Array<{ url: string; s3Key?: string; filename?: string; mimeType?: string }> = [];
          const rawGenFiles = parsed.generated_files ?? parsed.generatedFiles;
          if (Array.isArray(rawGenFiles)) {
            rawGenFiles.forEach((item: unknown) => {
              const gf = normalizeGeneratedFilePayload(item);
              if (gf) generatedFilesFromDone.push(gf);
            });
          }
          if (generatedFilesFromDone.length > 0) {
            doneMetadata.generatedFiles = generatedFilesFromDone;
          }

          updateAiMessage({
            content:
              sanitized.visibleText ||
              (finalReasoning ? "" : "No response from persona."),
            thinkingContent: finalReasoning || null,
            isThinkingInProgress: false,
            isLoading: false,
            toolStatus: null,
            metadata: doneMetadata as Message["metadata"],
          });

          // Collect all generated images: from parsed.images + file_attachments with origin=generated
          const allGeneratedImages: Array<{ url: string; alt?: string }> = [];

          // From parsed.images (direct array)
          if (Array.isArray(parsed.images)) {
            (parsed.images as unknown[]).forEach((img: unknown) => {
              if (typeof img === "string" && img.trim()) {
                allGeneratedImages.push({ url: img.trim() });
              } else if (img && typeof img === "object") {
                const obj = img as { url?: unknown; alt?: unknown };
                const url = typeof obj.url === "string" ? obj.url.trim() : "";
                if (url) allGeneratedImages.push({ url, alt: typeof obj.alt === "string" ? obj.alt : undefined });
              }
            });
          }

          // From file_attachments with origin=generated
          if (Array.isArray(parsed.file_attachments)) {
            (parsed.file_attachments as Array<Record<string, unknown>>).forEach((att) => {
              if (!att || typeof att !== "object") return;
              const origin = typeof att.origin === "string" ? att.origin.trim().toLowerCase() : "";
              if (origin !== "generated") return;
              const rawUrl = att.file_link ?? att.url ?? att.link;
              const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
              if (!url) return;
              const mimeRaw = att.mime_type ?? att.mimeType;
              const mimeType = typeof mimeRaw === "string" ? mimeRaw.trim().toLowerCase() : "";
              if (mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url)) {
                allGeneratedImages.push({ url });
              }
            });
          }

          // Apply all generated images at once
          if (allGeneratedImages.length > 0) {
            setDisplayMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                const existing = Array.isArray(msg.images) ? msg.images : [];
                // Dedupe by URL
                const seen = new Set(existing.map((i) => i.url.trim().toLowerCase()));
                const newImages = allGeneratedImages.filter(
                  (i) => !seen.has(i.url.trim().toLowerCase()),
                );
                return {
                  ...msg,
                  images: [...existing, ...newImages],
                  metadata: { ...(msg.metadata || {}), isImageGeneration: true },
                };
              }),
            );
          }

          // Update user message attachments with permanent URLs from backend
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

          if (uploadedAttachmentsFromDone.length > 0) {
            setDisplayMessages((prev) =>
              prev.map((msg) =>
                msg.id === userMessageId
                  ? {
                      ...msg,
                      metadata: {
                        ...msg.metadata,
                        attachments: uploadedAttachmentsFromDone,
                      },
                    }
                  : msg,
              ),
            );
          }

          // Persist attachments to localStorage (backend doesn't store them for persona chats)
          const finalAttachments = uploadedAttachmentsFromDone.length > 0
            ? uploadedAttachmentsFromDone
            : persistentAttachments;
          if (finalAttachments && finalAttachments.length > 0) {
            const chatIdForStorage = resolvedChatId || activeChatId;
            if (chatIdForStorage) {
              try {
                const storageKey = `persona-attachments-${chatIdForStorage}`;
                const existing = JSON.parse(localStorage.getItem(storageKey) || "{}");
                existing[trimmedContent] = finalAttachments;
                localStorage.setItem(storageKey, JSON.stringify(existing));
              } catch { /* localStorage full or unavailable */ }
            }
          }
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";

            for (const eventChunk of events) {
              processEventChunk(eventChunk);
            }
          }

          if (done) {
            if (buffer.trim()) {
              const trailingEvents = `${buffer}\n\n`.split("\n\n");
              for (const trailingChunk of trailingEvents) {
                processEventChunk(trailingChunk);
              }
              buffer = "";
            }
            break;
          }
        }
      } finally {
        reader.cancel().catch(() => {});
      }

      // Ensure we have a final message even if stream ended without "done" event
      if (assistantContent) {
        const sanitized = extractThinkingContent(assistantContent);
        updateAiMessage({
          content: sanitized.visibleText || "No response from persona.",
          thinkingContent: reasoningContent || sanitized.thinkingText,
          isThinkingInProgress: false,
          isLoading: false,
          metadata: {
            modelName: persona.modelName,
            providerName: persona.providerName,
          },
        });
      }
    } catch (error) {
      // If aborted by user, show stopped message instead of error
      if (error instanceof Error && error.name === "AbortError") {
        setDisplayMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== aiMessageId) return msg;
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
            };
          }),
        );
      } else {
        const message =
          error instanceof Error
            ? error.message
            : "Sorry, I encountered an error processing your request.";
        const errorMessage: Message = {
          id: aiMessageId,
          sender: "ai",
          content: message,
          avatarUrl: avatarUrl || flowtingLogoUrl,
          avatarHint: personaName,
        };

        setDisplayMessages((prev) =>
          prev.map((msg) => (msg.id === aiMessageId ? errorMessage : msg)),
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsResponding(false);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast("Copied to clipboard!");
  };

  return (
    <div className="relative px-12 py-4 max-h-[95vh] h-full flex flex-col w-full\" {...dropZoneProps}>
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm border-2 border-dashed border-[#7c6fcd] rounded-2xl pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-[#7c6fcd]" />
            <span className="text-sm font-medium text-[#7c6fcd]">Drop files here to attach</span>
          </div>
        </div>
      )}
      {/* Row 2 - Persona details (toggleable) */}
      {detailsSectionOpen && (
        <div className="w-full flex items-center gap-6 shrink-0 min-h-[28px] py-1 flex-wrap mb-3 text-sm">
          {persona.modelName && (
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#3C6CFF] shrink-0" />
              <span className="font-normal text-[#666666]">
                Model: {persona.modelName}
              </span>
            </div>
          )}
          {persona.temperature !== undefined && (
            <div className="flex items-center gap-2">
              <span className="font-normal text-[#666666]">
                Temperature: {persona.temperature}
              </span>
            </div>
          )}
          {persona.maxTokens !== undefined && (
            <div className="flex items-center gap-2">
              <span className="font-normal text-[#666666]">
                Max Tokens: {persona.maxTokens}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Row 3 - Chat area: persona image + name, then messages + input */}
      <div className="border border-main-border rounded-3xl flex-1 min-h-0 flex flex-col w-full overflow-hidden">
        {/* Persona image + name */}
        {displayMessages.length === 0 ? (
          <section className="flex flex-1 flex-col items-center justify-center px-4 py-8">
            <div className="flex flex-col items-center gap-0">
              <div className="w-[146px] h-[146px] flex items-center justify-center overflow-hidden rounded-full border-2 border-[#E5E5E5] mb-4">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={personaName}
                    width={146}
                    height={146}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-[#F5F5F5] flex items-center justify-center text-5xl font-medium text-[#999999]">
                    {personaName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <h1 className="capitalize font-clash font-medium text-[28px] text-[#1E1E1E] text-center">
                {personaName}
              </h1>
            </div>
            {persona.description && (
              <div className="mt-1 max-w-md text-center">
                <p
                  className={`text-sm text-[#8B8B8B] leading-relaxed font-geist transition-all duration-300 ${
                    isDescriptionExpanded
                      ? "max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                      : "max-h-[48px]"
                  }`}
                  style={
                    isDescriptionExpanded ? { scrollbarWidth: "thin" } : {}
                  }
                >
                  {isDescriptionExpanded
                    ? persona.description
                    : persona.description.length > 100
                      ? `${persona.description.slice(0, 100)}...`
                      : persona.description}
                </p>
                {persona.description.length > 100 && (
                  <button
                    type="button"
                    onClick={() =>
                      setIsDescriptionExpanded(!isDescriptionExpanded)
                    }
                    className="mt-2 text-xs text-[#3C6CFF] hover:text-[#2651CC] font-medium transition-colors"
                  >
                    {isDescriptionExpanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}
          </section>
        ) : (
          <div
            className={`flex-1 min-h-0 overflow-y-auto ${chatStyles.customScrollbar ?? ""} ${chatStyles.hidePinButton ?? ""}`}
            ref={scrollViewportRef}
            onScroll={handleScroll}
          >
            <div className="mx-auto w-full max-w-[850px] flex flex-col gap-3 pr-4 py-4">
              <div className="rounded-[32px] border border-transparent bg-white p-6 shadow-none">
                <div className="flex flex-col gap-3">
                  {displayMessages.map((msg, idx) => {
                    const messageAttachments =
                      msg.sender === "user" && msg.metadata?.attachments;
                    return (
                      <React.Fragment key={msg.id}>
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
                                  style={{ width: "60px", height: "60px", padding: "1.08px" }}
                                >
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
                      message={msg}
                      onPin={() => {}}
                      onCopy={handleCopy}
                      onDelete={() => {}}
                      onResubmit={() => {}}
                      isPinned={false}
                      taggedPins={[]}
                      isNewMessage={idx === displayMessages.length - 1}
                      isResponding={isResponding}
                      onReference={undefined}
                      onRegenerate={undefined}
                      onReply={undefined}
                      onReact={undefined}
                      disablePinning={true}
                    />
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scroll to bottom button */}
        {!isScrolledToBottom && displayMessages.length > 0 && (
          <div className="relative pointer-events-none" style={{ height: 0 }}>
            <button
              type="button"
              onClick={handleScrollToBottom}
              className="cursor-pointer absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full bg-white border border-[#D9D9D9] shadow-md hover:bg-[#F5F5F5] transition-colors h-10 w-10"
              aria-label="Scroll to bottom"
              style={{
                bottom: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                pointerEvents: "auto",
              }}
            >
              <ChevronDown className="h-5 w-5 text-[#555555]" />
            </button>
          </div>
        )}

        {/* Chat input footer */}
        <footer className="shrink-0 bg-transparent px-0 pb-0 pt-2">
          <div className="relative w-full max-w-[756px] mx-auto">
            <div
              className="rounded-[24px] border border-[#D9D9D9] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              style={{
                minHeight: attachments.length > 0 ? "162px" : "90px",
                transition: "min-height 0.2s ease",
              }}
            >
              {/* Attachment previews */}
              {attachments.length > 0 && (
                <div className="relative px-5 pt-4">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hidden">
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
                              style={{ width: `${attachment.uploadProgress || 0}%` }}
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
                              setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
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
                          style={{ width: "60px", height: "60px", padding: "1.08px" }}
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
                                  cx="18" cy="18" r="16" fill="none" stroke="#22C55E" strokeWidth="3"
                                  strokeDasharray={`${((attachment.uploadProgress || 0) * 100.48) / 100}, 100.48`}
                                  strokeLinecap="round" transform="rotate(-90 18 18)"
                                />
                              </svg>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(attachment.url);
                              setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
                            }}
                            className="absolute top-0.5 right-0.5 rounded-full bg-white border border-[#E5E5E5] p-0.5 hover:bg-[#F5F5F5] shadow-sm transition-colors z-10 opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-3 w-3 text-[#666666]" />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1.5 px-5 py-4">
                <div className="w-full">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !isResponding) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={`Chat with ${personaName}...`}
                    className="min-h-[40px] w-full resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-relaxed text-[#1E1E1E] placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-light-grey shadow-none!"
                    rows={1}
                    disabled={isResponding}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative" ref={attachMenuRef}>
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
                            fileInputRef.current?.click();
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
                      </div>
                    )}
                  </div>
                  {webSearchEnabled && (
                    <button
                      type="button"
                      aria-label="Disable web search"
                      onClick={() => setWebSearchEnabled(false)}
                      className="flex items-center justify-center gap-2 rounded-[8px] px-2 py-1.5 text-sm font-medium text-[#2563eb] bg-[#F0F7FF] border-none min-h-[36px]"
                    >
                      <Globe className="h-4 w-4" />
                      <span>Web Search</span>
                      <X className="h-4 w-4 ml-1 cursor-pointer" />
                    </button>
                  )}
                  <div className="flex flex-1 shrink-0 items-center justify-end gap-4">
                    {isResponding ? (
                      <Button
                        type="button"
                        onClick={() => abortControllerRef.current?.abort()}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A]"
                        title="Stop generation"
                      >
                        <Square className="h-[18px] w-[18px] fill-white" />
                      </Button>
                    ) : (input.trim() || attachments.length > 0) ? (
                      <Button
                        type="button"
                        onClick={() => handleSend()}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A] disabled:bg-[#CCCCCC] disabled:shadow-none"
                      >
                        <Send className="h-[18px] w-[18px]" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => {
                          toast.info("Voice input", {
                            description: "Voice input coming soon.",
                          });
                        }}
                        className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-full bg-zinc-300 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                        title="Voice input"
                      >
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
            <div className="mt-1 text-center text-xs text-[#888888]">
              Models can make mistakes. Check important information.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
