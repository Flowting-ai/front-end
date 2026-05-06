"use client";

import { apiFetch, apiFetchJson, ApiError } from "./client";
import {
  PINS_ENDPOINT,
  PIN_DETAIL_ENDPOINT,
  CREATE_PIN_ENDPOINT,
  PIN_FOLDERS_ENDPOINT,
  PIN_FOLDERS_CREATE_ENDPOINT,
  PIN_MOVE_ENDPOINT,
} from "@/lib/config";

// ── Normalised shape used throughout the UI ───────────────────────────────────

export interface Pin {
  id: string;
  /** Display title — normalised from pins_title | title | first line of content */
  title: string;
  /** Full body text — normalised from content | text | formattedContent */
  content: string;
  /** Tag names extracted from backend tags array */
  tags: string[];
  message_id?: string;
  category?: string;
  folder_id?: string;
  folder_name?: string;
  created_at: string;
  updated_at?: string;
  color?: string;
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
    tags.push(...rawTags.split(",").map((s) => s.trim()).filter(Boolean));
  }

  return {
    id,
    title,
    content: rawContent,
    tags,
    message_id:
      typeof raw.message_id === "string" ? raw.message_id :
      typeof raw.messageId  === "string" ? raw.messageId  : undefined,
    category:    typeof raw.category    === "string" ? raw.category    : undefined,
    folder_id:   typeof raw.folder_id   === "string" ? raw.folder_id   :
                 typeof raw.folderId    === "string" ? raw.folderId    : undefined,
    folder_name: typeof raw.folder_name === "string" ? raw.folder_name :
                 typeof raw.folderName  === "string" ? raw.folderName  : undefined,
    created_at:  typeof raw.created_at  === "string" ? raw.created_at  : new Date().toISOString(),
    updated_at:  typeof raw.updated_at  === "string" ? raw.updated_at  : undefined,
    color:       typeof raw.color       === "string" ? raw.color       : undefined,
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
  return apiFetchJson<PinFolder[]>(PIN_FOLDERS_ENDPOINT);
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
  return apiFetchJson<PinFolder>(PIN_FOLDERS_CREATE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ folder_name }),
  });
}

export async function movePinToFolder(
  pinId: string,
  folderId: string | null,
): Promise<Pin> {
  const raw = await apiFetchJson<RawPin>(PIN_MOVE_ENDPOINT(pinId), {
    method: "PATCH",
    body: JSON.stringify({ folder_id: folderId }),
  });
  return normalizePin(raw);
}
