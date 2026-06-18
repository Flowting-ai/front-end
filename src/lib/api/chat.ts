"use client";

import { apiFetch, apiFetchJson, ApiError } from "./client";
import {
  API_BASE_URL,
  CHATS_ENDPOINT,
  CHATS_RENAME_ENDPOINT,
  CHAT_MESSAGES_ENDPOINT,
  CHAT_STAR_ENDPOINT,
  CHAT_STOP_ENDPOINT,
  CHAT_SAVE_TO_DRIVE_ENDPOINT,
  CHAT_PROMPT_RESPOND_ENDPOINT,
  CHAT_VISIBILITY_ENDPOINT,
  CHAT_COPY_ENDPOINT,
  DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";
import type {
  Chat,
  Message,
  ChatsListResponse,
  MessagesListResponse,
} from "@/types/chat";

// ── Chat list ─────────────────────────────────────────────────────────────────

/** Raw shape the backend may return for a single chat. */
interface BackendChat {
  id: string;
  owner_user_id?: string;
  can_edit?: boolean;
  visibility?: "private" | "team";
  team_id?: string | null;
  starred?: boolean;
  is_starred?: boolean;
  isStarred?: boolean;
  chat_title?: string;
  title?: string;
  name?: string;
  message_count?: number;
  pins_count?: number;
  pin_count?: number;
  updated_at?: string;
  created_at?: string;
  model?: string;
  last_message_at?: string;
  project_id?: string | null;
}

/** Normalize a backend chat object into the canonical Chat type. */
function normalizeChat(raw: BackendChat): Chat {
  return {
    id: raw.id,
    owner_user_id: raw.owner_user_id,
    can_edit: raw.can_edit ?? false,
    visibility: raw.visibility ?? "private",
    team_id: raw.team_id ?? null,
    title: raw.chat_title ?? raw.title ?? raw.name ?? "Untitled",
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? raw.created_at ?? new Date().toISOString(),
    starred: raw.starred ?? raw.is_starred ?? raw.isStarred ?? false,
    model: raw.model,
    message_count: raw.message_count ?? 0,
    pins_count: raw.pins_count ?? raw.pin_count ?? 0,
    last_message_at: raw.last_message_at,
    project_id: raw.project_id ?? null,
  };
}

export async function listChats(cursor?: string): Promise<ChatsListResponse> {
  const url = cursor
    ? `${CHATS_ENDPOINT}?cursor=${encodeURIComponent(cursor)}`
    : CHATS_ENDPOINT;

  const response = await apiFetch(url);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      "list_chats_failed",
      "Failed to load chats",
    );
  }

  const data = await response.json();

  // The backend may return:
  //   1. A raw array of chats
  //   2. { results: [...] }
  //   3. { chats: [...], next_cursor?, has_more? }
  let rawChats: BackendChat[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;

  if (Array.isArray(data)) {
    rawChats = data;
  } else if (Array.isArray(data?.results)) {
    rawChats = data.results;
    nextCursor = data.next_cursor ?? null;
    hasMore = data.has_more ?? false;
  } else if (Array.isArray(data?.chats)) {
    rawChats = data.chats;
    nextCursor = data.next_cursor ?? null;
    hasMore = data.has_more ?? false;
  }

  return {
    chats: rawChats.map(normalizeChat),
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

// ── Chat CRUD ─────────────────────────────────────────────────────────────────

export async function createChat(model?: string): Promise<Chat> {
  // Note: /chats/create is multipart/form-data and streams a response.
  // This function is for sidebar "create" - the actual streaming is handled
  // by the /api/chat proxy route. Here we just return a placeholder.
  const fd = new FormData();
  fd.append("input", ""); // Required field but empty for pre-creation
  if (model) fd.append("model_id", model);

  // For sidebar-only creation, we don't actually call the backend
  // since /chats/create requires input and streams immediately.
  // Instead we return an optimistic chat and let streaming handle creation.
  return {
    id: `temp-${Date.now()}`,
    can_edit: true,
    title: "New chat",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    starred: false,
  };
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  await apiFetchJson(CHATS_RENAME_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify({ chat_id: chatId, chat_title: title }),
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  const response = await apiFetch(CHATS_ENDPOINT, {
    method: "DELETE",
    body: JSON.stringify({ chat_id: chatId }),
  });
  if (!response.ok && response.status !== 204) {
    throw new ApiError(
      response.status,
      "delete_chat_failed",
      "Failed to delete chat",
    );
  }
}

export async function starChat(chatId: string): Promise<void> {
  await apiFetchJson(CHAT_STAR_ENDPOINT(chatId), {
    method: "PATCH",
  });
}

export async function copyChat(chatId: string): Promise<{ chatId: string; chatTitle: string }> {
  const data = await apiFetchJson<{ chat_id: string; chat_title: string }>(
    CHAT_COPY_ENDPOINT(chatId),
    { method: "POST" },
  );
  return { chatId: data.chat_id, chatTitle: data.chat_title };
}

// ── Messages ─────────────────────────────────────────────────────────────────

/** Raw shape the backend may return for a single message entry. */
interface BackendMessage {
  id?: number | string;
  message_id?: number | string;
  chat_id?: number | string;
  sender?: string;
  role?: string;
  // Paired format: single row contains both user and AI
  input?: string;
  output?: string;
  prompt?: string;
  response?: string;
  // Single-role format
  content?: string;
  message?: string;
  // Metadata
  created_at?: string;
  model_name?: string;
  reasoning?: string | null;
  thinking_content?: string | null;
  image_links?: (string | null)[] | null;
  file_attachments?: Array<{
    file_link?: string | null;
    url?: string | null;
    link?: string | null;
    mime_type?: string | null;
    file_name?: string | null;
    name?: string | null;
    origin?: string | null;
  }> | null;
  pin_ids?: (string | null)[] | null;
  metadata?: Record<string, unknown>;
  // Web search sources attached to the message
  sources?: Array<{ id?: string; url?: string; title?: string; favicon?: string; domain?: string }> | null;
  web_citations?: Array<{ title?: string; url?: string; domain?: string }> | null;
  // Structured web searches (query + link URLs)
  web_searches?: Array<{ query: string; links: string[] }> | null;
  // Structured reasoning steps
  reasoning_sections?: Array<{ heading: string; body: string }> | null;
  // Structured response blocks persisted by the backend (table, chart, steps, etc.)
  response_blocks?: Array<{ kind: string; [key: string]: unknown }> | null;
}

/** Normalize a backend message entry into one or two Message objects. */
function normalizeMessages(raw: BackendMessage, chatId: string): Message[] {
  const baseId = String(raw.id ?? raw.message_id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const createdAt = raw.created_at ?? new Date().toISOString();

  const userText = raw.input ?? raw.prompt;
  const aiText = raw.output ?? raw.response;

  // Paired format - has both user input and AI output in one row
  if (userText || aiText) {
    const messages: Message[] = [];
    const sources = parseSources(raw);
    const allFileAtts = normalizeFileAttachments(raw);

    // Route by origin: uploaded files belong to the user turn;
    // generated + unknown-origin files belong to the assistant turn.
    const uploadedAtts = allFileAtts.filter(
      (a) => a.origin === "uploaded" || a.origin === "user",
    );
    const assistantAtts = allFileAtts.filter(
      (a) => a.origin !== "uploaded" && a.origin !== "user",
    );

    if (userText) {
      messages.push({
        id: `${baseId}-prompt`,
        role: "user",
        content: userText,
        created_at: createdAt,
        chat_id: chatId,
        file_attachments: uploadedAtts.length > 0 ? uploadedAtts : undefined,
      });
    }
    // Emit an assistant message when there is text content OR generated
    // file/image attachments (e.g. image generation produces an empty output
    // string but stores the result in file_attachments with origin="generated").
    const imageLinks = Array.isArray(raw.image_links)
      ? (raw.image_links.filter((u): u is string => typeof u === "string" && u.length > 0))
      : undefined;
    const hasAssistantPayload = Boolean(aiText) || assistantAtts.length > 0 || (imageLinks && imageLinks.length > 0);
    if (hasAssistantPayload) {
      messages.push({
        // Use baseId (the real backend ID) for the assistant message so that
        // features like pinning send the correct ID to POST /pins/message/{id}.
        // The user turn gets the "-prompt" suffix since the backend only knows
        // the single ID for the AI response.
        id: baseId,
        role: "assistant",
        content: aiText ?? "",
        created_at: createdAt,
        chat_id: chatId,
        thinking: raw.reasoning ?? raw.thinking_content ?? undefined,
        reasoning_sections: raw.reasoning_sections ?? undefined,
        model_name: raw.model_name ?? undefined,
        sources: sources.length > 0 ? sources : undefined,
        web_searches: raw.web_searches ?? undefined,
        file_attachments: assistantAtts.length > 0 ? assistantAtts : undefined,
        image_links: imageLinks && imageLinks.length > 0 ? imageLinks : undefined,
        response_blocks: Array.isArray(raw.response_blocks) && raw.response_blocks.length > 0
          ? raw.response_blocks.filter((b): b is { kind: string; [key: string]: unknown } =>
              b !== null && typeof b === "object" && typeof (b as Record<string, unknown>).kind === "string")
          : undefined,
      });
    }
    return messages;
  }

  // Single-role format (content/message fields)
  const senderRaw = (raw.sender ?? raw.role ?? "user").toLowerCase();
  const role: Message["role"] = (senderRaw === "ai" || senderRaw === "assistant") ? "assistant" : "user";
  const content = raw.content ?? raw.message ?? "";
  const sources = parseSources(raw);
  const fileAttachments = normalizeFileAttachments(raw);
  const imageLinks = Array.isArray(raw.image_links)
    ? (raw.image_links.filter((u): u is string => typeof u === "string" && u.length > 0))
    : undefined;

  const singleResponseBlocks = role === "assistant" && Array.isArray(raw.response_blocks) && raw.response_blocks.length > 0
    ? raw.response_blocks.filter((b): b is { kind: string; [key: string]: unknown } =>
        b !== null && typeof b === "object" && typeof (b as Record<string, unknown>).kind === "string")
    : undefined;

  return [{
    id: baseId,
    role,
    content,
    created_at: createdAt,
    chat_id: chatId,
    thinking: raw.reasoning ?? raw.thinking_content ?? undefined,
    reasoning_sections: raw.reasoning_sections ?? undefined,
    model_name: raw.model_name ?? undefined,
    sources: sources.length > 0 ? sources : undefined,
    web_searches: raw.web_searches ?? undefined,
    file_attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
    image_links: imageLinks && imageLinks.length > 0 ? imageLinks : undefined,
    ...(singleResponseBlocks ? { response_blocks: singleResponseBlocks } : {}),
  }];
}

/** Extract and normalise file_attachments from a backend message entry. */
function normalizeFileAttachments(raw: BackendMessage): import("@/types/chat").BackendFileAttachment[] {
  if (!Array.isArray(raw.file_attachments) || raw.file_attachments.length === 0) return [];
  return raw.file_attachments
    .flatMap((a) => a != null ? [{
      file_link: a.file_link ?? undefined,
      url: a.url ?? undefined,
      link: a.link ?? undefined,
      mime_type: a.mime_type ?? undefined,
      file_name: a.file_name ?? undefined,
      name: a.name ?? undefined,
      origin: a.origin ?? undefined,
    }] : []);
}

/** Extract sources from any of the known backend shapes. */
function parseSources(raw: BackendMessage): import("@/types/chat").Source[] {
  // Explicit sources array
  if (Array.isArray(raw.sources) && raw.sources.length > 0) {
    return raw.sources
      .flatMap((s, i) => s && (s.url || s.title) ? [{
        id: s.id ?? String(i),
        url: s.url ?? "",
        title: s.title ?? s.url ?? "",
        favicon: s.favicon,
      }] : []);
  }
  // Explicit web_citations array
  if (Array.isArray(raw.web_citations) && raw.web_citations.length > 0) {
    return raw.web_citations
      .flatMap((s, i) => s && (s.url || s.title) ? [{
        id: String(i),
        url: s.url ?? "",
        title: s.title ?? s.url ?? "",
      }] : []);
  }
  // web_searches format: [{query, links: string[]}] - links are bare URLs
  if (Array.isArray(raw.web_searches) && raw.web_searches.length > 0) {
    const allLinks = raw.web_searches.flatMap((ws) => (ws.links ?? []).filter(Boolean));
    if (allLinks.length > 0) {
      return allLinks.map((url, i) => {
        let domain = "";
        let title = url;
        try {
          const u = new URL(url);
          domain = u.hostname.replace(/^www\./, "");
          const pathParts = u.pathname.split("/").filter(Boolean);
          title = pathParts.length > 0 ? `${domain} - ${pathParts[pathParts.length - 1].replace(/-/g, " ")}` : domain;
        } catch { /* ignore */ }
        return { id: String(i), url, title };
      });
    }
  }
  // Buried in metadata
  const meta = raw.metadata;
  if (meta) {
    const ms = (meta.sources ?? meta.web_citations ?? meta.citations) as Array<Record<string, string>> | undefined;
    if (Array.isArray(ms) && ms.length > 0) {
      return ms
        .flatMap((s, i) => s && (s.url || s.title) ? [{
          id: s.id ?? String(i),
          url: s.url ?? "",
          title: s.title ?? s.url ?? "",
          favicon: s.favicon,
        }] : []);
    }
  }
  return [];
}

export async function getChatMessages(
  chatId: string,
  cursor?: string,
): Promise<MessagesListResponse> {
  const url = cursor
    ? `${CHAT_MESSAGES_ENDPOINT(chatId)}?cursor=${encodeURIComponent(cursor)}`
    : CHAT_MESSAGES_ENDPOINT(chatId);

  const response = await apiFetch(url);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      "get_messages_failed",
      "Failed to load messages",
    );
  }

  const data = await response.json();

  let rawMessages: BackendMessage[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;

  if (Array.isArray(data)) {
    rawMessages = data;
  } else if (Array.isArray(data?.results)) {
    rawMessages = data.results;
    nextCursor = data.next_cursor ?? null;
    hasMore = data.has_more ?? false;
  } else if (Array.isArray(data?.messages)) {
    rawMessages = data.messages;
    nextCursor = data.next_cursor ?? null;
    hasMore = data.has_more ?? false;
  }

  const messages = rawMessages.flatMap((raw) => normalizeMessages(raw, chatId));

  return {
    messages,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

export async function deleteMessage(messageId: string): Promise<void> {
  const response = await apiFetch(DELETE_MESSAGE_ENDPOINT(messageId), {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    throw new ApiError(
      response.status,
      "delete_message_failed",
      "Failed to delete message",
    );
  }
}

/** POST /chats/{chat_id}/stop — abort an in-flight stream. */
export async function stopChat(chatId: string): Promise<void> {
  await apiFetch(CHAT_STOP_ENDPOINT(chatId), { method: "POST" });
}

/** POST /chats/files/{attachment_id}/save-to-drive */
export async function saveFileToDrive(
  attachmentId: string,
  folderId?: string | null,
): Promise<unknown> {
  return apiFetchJson<unknown>(CHAT_SAVE_TO_DRIVE_ENDPOINT(attachmentId), {
    method: "POST",
    body:   JSON.stringify(folderId ? { folder_id: folderId } : {}),
  });
}

/**
 * POST to the backend's prompt gate to unblock a mid-stream permission/confirmation prompt.
 * Uses `respondUrl` (backend-relative path from the SSE event) when provided; falls back to
 * the standard /chats/prompts/{promptId} endpoint.
 */
export async function respondToChatPrompt(
  promptId: string,
  response: unknown,
  respondUrl?: string,
): Promise<void> {
  const path = respondUrl
    ? `${API_BASE_URL}${respondUrl}`
    : CHAT_PROMPT_RESPOND_ENDPOINT(promptId);
  const res = await apiFetch(path, {
    method: "POST",
    body:   JSON.stringify({ response }),
  });
  if (!res.ok && res.status !== 204) {
    throw new ApiError(res.status, "prompt_respond_failed", "Failed to respond to prompt");
  }
}

/** PATCH /chats/{chat_id}/visibility */
export async function setChatVisibility(
  chatId: string,
  visibility: "private" | "team",
  teamId?: string,
): Promise<void> {
  const body: Record<string, unknown> = { visibility };
  if (visibility === "team" && teamId) body.teamId = teamId;
  await apiFetch(CHAT_VISIBILITY_ENDPOINT(chatId), {
    method: "PATCH",
    body:   JSON.stringify(body),
  });
}
