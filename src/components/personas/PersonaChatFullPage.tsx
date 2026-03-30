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
} from "lucide-react";
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
      // Keep local in-flight messages when a brand new chat gets its first backend id.
      // Only clear when switching between two concrete chat sessions.
      if (prev && resolved && prev !== resolved) {
        setDisplayMessages([]);
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
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const flowtingLogoUrl = "/new-logos/souvenir-logo.svg";

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
            items.push({
              id: `${m.id}-user`,
              sender: "user",
              content: m.input,
              avatarUrl: "/personas/userAvatar.png",
              avatarHint: "User",
            });
          }
          if (m.output) {
            const sanitized = extractThinkingContent(m.output);
            items.push({
              id: `${m.id}-ai`,
              sender: "ai",
              content: sanitized.visibleText || m.output,
              thinkingContent: m.reasoning || sanitized.thinkingText || null,
              avatarUrl: avatarUrl || "/new-logos/souvenir-logo.svg",
              avatarHint: personaName,
            });
          }
          return items;
        });
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

  const handleShare = () => {
    toast.info("Share", {
      description: "Share persona feature coming soon.",
    });
  };

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

  const handleSend = async () => {
    const trimmedContent = input.trim();
    if (!trimmedContent || isResponding) return;

    const userMessageId = `user-${Date.now()}`;
    const aiMessageId = `ai-${Date.now() + 1}`;

    const userMessage: Message = {
      id: userMessageId,
      sender: "user",
      content: trimmedContent,
      avatarUrl: "/personas/userAvatar.png",
      avatarHint: "User",
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

        if (eventName === "reasoning") {
          const delta = typeof parsed.delta === "string" ? parsed.delta : "";
          reasoningContent = mergeStreamingText(reasoningContent, delta);
          updateAiMessage({
            thinkingContent: reasoningContent,
            isThinkingInProgress: true,
            isLoading: false,
          });
          return;
        }

        if (eventName === "chunk") {
          const delta = typeof parsed.delta === "string" ? parsed.delta : "";
          assistantContent = mergeStreamingText(assistantContent, delta);
          const sanitized = extractThinkingContent(assistantContent);
          updateAiMessage({
            content: sanitized.visibleText || "",
            thinkingContent: reasoningContent || sanitized.thinkingText,
            isThinkingInProgress: false,
            isLoading: false,
          });
          return;
        }

        if (eventName === "image") {
          const imageUrl = typeof parsed.url === "string" ? parsed.url : "";
          const imageAlt =
            typeof parsed.alt === "string" ? parsed.alt : undefined;
          if (imageUrl) {
            updateAiMessage({ imageUrl, imageAlt });
          }
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
              : assistantContent;
          const sanitized = extractThinkingContent(finalContent);
          const finalReasoning =
            reasoningContent ||
            (typeof parsed.reasoning === "string" ? parsed.reasoning : "") ||
            sanitized.thinkingText;
          updateAiMessage({
            content:
              sanitized.visibleText ||
              (finalReasoning ? "" : "No response from persona."),
            thinkingContent: finalReasoning || null,
            isThinkingInProgress: false,
            isLoading: false,
            metadata: {
              modelName: persona.modelName,
              providerName: persona.providerName,
            },
          });
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
    <div className="px-12 py-4 max-h-[95vh] h-full flex flex-col w-full">
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
                  {displayMessages.map((msg, idx) => (
                    <ChatMessage
                      key={msg.id}
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
                  ))}
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
                minHeight: "90px",
                transition: "min-height 0.2s ease",
              }}
            >
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
                      accept=".pdf,application/pdf,image/*"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files?.length) {
                          toast.info("Attachments", {
                            description:
                              "File attachment coming soon for persona chats.",
                          });
                        }
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-0 hover:bg-[#F5F5F5] hover:border-[#D9D9D9]"
                    >
                      <Plus className="h-5 w-5 text-[#555555]" />
                    </Button>
                    {/* {showAttachMenu && (
                      <div
                        className="absolute bottom-full left-0 mb-2 flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-2 shadow-lg"
                        style={{ width: "160px" }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowAttachMenu(false);
                          }}
                          className="flex gap-1.5 rounded-lg border border-[#E5E5E5] bg-white p-2 text-left text-xs font-medium text-[#1E1E1E] transition-colors hover:bg-[#F5F5F5] whitespace-nowrap"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-[#666666]" />
                          <span>Attach Files</span>
                        </button>
                        <button
                          type="button"
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
                            "flex gap-1.5 rounded-lg border p-2 text-left text-xs font-medium transition-colors whitespace-nowrap",
                            webSearchEnabled
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-[#E5E5E5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]",
                          )}
                        >
                          <Globe
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              webSearchEnabled ? "text-blue-600" : "text-[#666666]",
                            )}
                          />
                          <span>Web Search</span>
                          {webSearchEnabled && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
                          )}
                        </button>
                      </div>
                    )} */}
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
                    ) : input.trim() ? (
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
