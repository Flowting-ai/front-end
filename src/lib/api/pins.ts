"use client";

import { apiFetch, apiFetchJson, ApiError } from "./client";
import {
  PINS_ENDPOINT,
  PIN_DETAIL_ENDPOINT,
  CREATE_PIN_ENDPOINT,
  PIN_FOLDERS_ENDPOINT,
  PIN_FOLDERS_CREATE_ENDPOINT,
  PIN_FOLDER_DETAIL_ENDPOINT,
  PIN_MOVE_ENDPOINT,
  PIN_COMMENT_ENDPOINT,
  PIN_COMMENT_CRUD_ENDPOINT,
  PIN_TAGS_ENDPOINT,
} from "@/lib/config";

// ── Normalised shape used throughout the UI ───────────────────────────────────

export interface PinComment {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface Pin {
  id: string;
  /** Display title - normalised from pins_title | title | first line of content */
  title: string;
  /** Full body text - normalised from content | text | formattedContent */
  content: string;
  /** Tag names extracted from backend tags array */
  tags: string[];
  message_id?: string;
  chat_id?: string;
  category?: string;
  folder_id?: string;
  folder_name?: string;
  created_at: string;
  updated_at?: string;
  color?: string;
  model_name?: string;
  comments?: PinComment[];
}

export interface PinFolder {
  id: string;
  name: string;
  pin_count: number;
}

// ── Raw backend shape (field names vary by endpoint) ─────────────────────────

type RawPin = Record<string, unknown>;

function normalizePin(raw: RawPin): Pin {
  const id = String(raw.id ?? "");

  // Title: backends use pins_title, title, or the first line of content
  const rawTitle =
    (typeof raw.pins_title === "string" ? raw.pins_title : null) ??
    (typeof raw.title === "string" ? raw.title : null) ??
    null;

  // Content: content, text, or formattedContent
  const rawContent =
    (typeof raw.content === "string" ? raw.content : null) ??
    (typeof raw.text === "string" ? raw.text : null) ??
    (typeof raw.formattedContent === "string" ? raw.formattedContent : null) ??
    "";

  const title = rawTitle?.trim() || rawContent.split("\n")[0].slice(0, 120) || "Untitled Pin";

  // Tags: array of { tag_name } objects, plain strings, or comma-separated string
  const rawTags = raw.tags ?? raw.tag_names ?? raw.tag_list ?? [];
  const tags: string[] = [];
  if (Array.isArray(rawTags)) {
    for (const t of rawTags) {
      if (typeof t === "string" && t.trim()) tags.push(t.trim());
      else if (t && typeof t === "object" && typeof (t as Record<string, unknown>).tag_name === "string") {
        const name = ((t as Record<string, unknown>).tag_name as string).trim();
        if (name) tags.push(name);
      }
    }
  } else if (typeof rawTags === "string" && rawTags.trim()) {
    tags.push(...rawTags.split(",").flatMap((s) => { const v = s.trim(); return v ? [v] : [] }));
  }

  // Comments: array of { id, content, created_at, updated_at } from detail endpoint
  const rawComments = raw.comments ?? raw.pin_comments ?? raw.comment_texts ?? raw.commentTexts ?? [];
  const comments: PinComment[] = Array.isArray(rawComments)
    ? rawComments
        .flatMap((c) => {
          const rc = c as Record<string, unknown>;
          const mapped = {
            id:         String(rc.id ?? ""),
            content:    typeof rc.comment_text === "string" ? rc.comment_text :
                        typeof rc.content     === "string" ? rc.content     :
                        String(rc.text ?? ""),
            created_at: typeof rc.created_at === "string" ? rc.created_at : new Date().toISOString(),
            updated_at: typeof rc.updated_at === "string" ? rc.updated_at : undefined,
          };
          return mapped.id ? [mapped] : [];
        })
    : [];

  return {
    id,
    title,
    content: rawContent,
    tags,
    message_id:
      typeof raw.message_id === "string" ? raw.message_id :
      typeof raw.messageId  === "string" ? raw.messageId  : undefined,
    chat_id:
      typeof raw.chat_id === "string" ? raw.chat_id :
      typeof raw.chatId  === "string" ? raw.chatId  : undefined,
    category:    typeof raw.category    === "string" ? raw.category    : undefined,
    folder_id:   typeof raw.folder_id   === "string" ? raw.folder_id   :
                 typeof raw.folderId    === "string" ? raw.folderId    : undefined,
    folder_name: typeof raw.folder_name === "string" ? raw.folder_name :
                 typeof raw.folderName  === "string" ? raw.folderName  : undefined,
    created_at:  typeof raw.created_at  === "string" ? raw.created_at  : new Date().toISOString(),
    updated_at:  typeof raw.updated_at  === "string" ? raw.updated_at  : undefined,
    color:       typeof raw.color       === "string" ? raw.color       : undefined,
    model_name:  typeof raw.model_name  === "string" ? raw.model_name  :
                 typeof raw.modelName   === "string" ? raw.modelName   :
                 typeof raw.model       === "string" ? raw.model       : undefined,
    comments,
  };
}

export async function listPins(search?: string): Promise<Pin[]> {
  const url = search
    ? `${PINS_ENDPOINT}?search=${encodeURIComponent(search)}`
    : PINS_ENDPOINT;
  const data = await apiFetchJson<RawPin[] | { pins: RawPin[] }>(url);
  const raw = Array.isArray(data) ? data : (data.pins ?? []);
  return raw.map(normalizePin);
}

export async function getPin(pinId: string): Promise<Pin> {
  const raw = await apiFetchJson<RawPin>(PIN_DETAIL_ENDPOINT(pinId));
  return normalizePin(raw);
}

export async function listPinFolders(): Promise<PinFolder[]> {
  const data = await apiFetchJson<
    Array<Record<string, unknown>> | { folders: Array<Record<string, unknown>> }
  >(PIN_FOLDERS_ENDPOINT);
  const raw = Array.isArray(data) ? data : (data.folders ?? []);
  return raw.map((f) => ({
    id:        String(f.id ?? ""),
    name:
      (typeof f.name        === "string" ? f.name        : null) ??
      (typeof f.folder_name === "string" ? f.folder_name : null) ??
      (typeof f.label       === "string" ? f.label       : null) ??
      "Untitled Folder",
    pin_count: typeof f.pin_count === "number" ? f.pin_count :
               typeof f.pins_count === "number" ? f.pins_count : 0,
  }));
}

export async function createPin(messageId: string): Promise<Pin> {
  const raw = await apiFetchJson<RawPin>(CREATE_PIN_ENDPOINT(messageId), { method: "POST" });
  return normalizePin(raw);
}

export async function deletePin(pinId: string): Promise<void> {
  const response = await apiFetch(PIN_DETAIL_ENDPOINT(pinId), { method: "DELETE" });
  if (!response.ok) {
    throw new ApiError(response.status, "api_error", `Failed to delete pin`);
  }
}

export async function createPinFolder(folder_name: string): Promise<PinFolder> {
  const raw = await apiFetchJson<Record<string, unknown>>(PIN_FOLDERS_CREATE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ folder_name }),
  });
  return {
    id: String(raw.id ?? ""),
    name:
      (typeof raw.name        === "string" ? raw.name        : null) ??
      (typeof raw.folder_name === "string" ? raw.folder_name : null) ??
      (typeof raw.label       === "string" ? raw.label       : null) ??
      folder_name,
    pin_count: typeof raw.pin_count   === "number" ? raw.pin_count   :
               typeof raw.pins_count  === "number" ? raw.pins_count  : 0,
  };
}

/**
 * Validate a folder name against the API rules and the caller's existing
 * folder name list. Returns an error string on failure, null on success.
 * Rules: non-empty after trim, max 255 chars (API limit), no duplicate
 * (case-insensitive) within the provided list.
 */
export function validateFolderName(
  name: string,
  existingNames: string[],
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Folder name cannot be empty.";
  if (trimmed.length > 255) return "Folder name cannot exceed 255 characters.";
  const lower = trimmed.toLowerCase();
  if (existingNames.some((n) => n.trim().toLowerCase() === lower))
    return "A folder with this name already exists.";
  return null;
}

export async function renamePinFolder(folderId: string, folder_name: string): Promise<PinFolder> {
  const raw = await apiFetchJson<Record<string, unknown>>(PIN_FOLDER_DETAIL_ENDPOINT(folderId), {
    method: "PATCH",
    body: JSON.stringify({ folder_name }),
  });
  return {
    id: String(raw.id ?? folderId),
    name:
      (typeof raw.name        === "string" ? raw.name        : null) ??
      (typeof raw.folder_name === "string" ? raw.folder_name : null) ??
      (typeof raw.label       === "string" ? raw.label       : null) ??
      folder_name,
    pin_count: typeof raw.pin_count  === "number" ? raw.pin_count  :
               typeof raw.pins_count === "number" ? raw.pins_count : 0,
  };
}

export async function deletePinFolder(folderId: string): Promise<void> {
  const res = await apiFetch(PIN_FOLDER_DETAIL_ENDPOINT(folderId), { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new ApiError(res.status, "api_error", "Failed to delete folder");
  }
}

export async function movePinToFolder(
  pinId: string,
  folderId: string,
): Promise<Pin> {
  const raw = await apiFetchJson<RawPin>(PIN_MOVE_ENDPOINT(pinId), {
    method: "PATCH",
    body: JSON.stringify({ folder_id: folderId }),
  });
  return normalizePin(raw);
}

export async function updatePinTags(pinId: string, tags: string[]): Promise<void> {
  await apiFetch(PIN_TAGS_ENDPOINT(pinId), {
    method: 'PUT',
    body:   JSON.stringify({ tags }),
  })
}

function normalizeCommentResponse(raw: Record<string, unknown>): PinComment {
  return {
    id:         String(raw.id ?? ""),
    content:    typeof raw.comment_text === "string" ? raw.comment_text
              : typeof raw.content      === "string" ? raw.content
              : "",
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
}

export async function addPinComment(pinId: string, content: string): Promise<PinComment> {
  const raw = await apiFetchJson<Record<string, unknown>>(PIN_COMMENT_ENDPOINT(pinId), {
    method: "POST",
    body:   JSON.stringify({ comment_text: content }),
  });
  return normalizeCommentResponse(raw);
}

export async function editPinComment(
  pinId: string,
  commentId: string,
  content: string,
): Promise<PinComment> {
  const raw = await apiFetchJson<Record<string, unknown>>(PIN_COMMENT_CRUD_ENDPOINT(pinId, commentId), {
    method: "PATCH",
    body:   JSON.stringify({ comment_text: content }),
  });
  return normalizeCommentResponse(raw);
}

export async function deletePinComment(pinId: string, commentId: string): Promise<void> {
  const res = await apiFetch(PIN_COMMENT_CRUD_ENDPOINT(pinId, commentId), { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new ApiError(res.status, "api_error", "Failed to delete comment");
  }
}
