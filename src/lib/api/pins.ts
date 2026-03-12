"use client";

import {
  PINS_ENDPOINT,
  PIN_DETAIL_ENDPOINT,
  CREATE_PIN_ENDPOINT,
  PIN_FOLDERS_ENDPOINT,
  PIN_FOLDERS_CREATE_ENDPOINT,
  PIN_MOVE_ENDPOINT,
} from "@/lib/config";
import { apiFetch } from "./client";

export interface TagResponse {
  id: string;
  tag_name: string;
}

export interface CommentResponse {
  id: string;
  comment_text: string;
  created_at: string;
}

export interface BackendPin {
  id: string;
  pins_title: string;
  message_id: string;
  folder_id: string;
  content: string;
  tags?: TagResponse[];
  comments?: CommentResponse[];
  created_at: string;
}

export interface PinFolder {
  id: string;
  folder_name: string;
  name: string; // alias for folder_name — for UI compatibility
  pin_count?: number;
  created_at: string;
}

export async function fetchAllPins(): Promise<BackendPin[]> {
  const response = await apiFetch(PINS_ENDPOINT, { method: "GET" });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? (data as BackendPin[]) : [];
}

export async function fetchPinById(pinId: string): Promise<BackendPin | null> {
  const response = await apiFetch(PIN_DETAIL_ENDPOINT(pinId), { method: "GET" });
  if (!response.ok) return null;
  return (await response.json()) as BackendPin;
}

/** Create a pin from a message. Only messageId is used; extra options are ignored by the new backend. */
export async function createPin(
  _chatIdOrMessageId: string,
  messageId?: string,
  _options?: { folderId?: string | null; tags?: string[]; comments?: string[]; content?: string }
): Promise<BackendPin> {
  // New API: POST /pins/message/{message_id}
  // If called with (messageId) — single arg form
  // If called with (chatId, messageId, options) — legacy form
  const id = messageId ?? _chatIdOrMessageId;
  const response = await apiFetch(CREATE_PIN_ENDPOINT(id), {
    method: "POST",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to create pin");
  }
  return (await response.json()) as BackendPin;
}

export async function deletePin(pinId: string): Promise<void> {
  await apiFetch(PIN_DETAIL_ENDPOINT(pinId), { method: "DELETE" });
}

const normalizeFolder = (f: { id: string; folder_name: string; pin_count?: number; created_at: string }): PinFolder => ({
  ...f,
  name: f.folder_name,
});

export async function fetchPinFolders(): Promise<PinFolder[]> {
  const response = await apiFetch(PIN_FOLDERS_ENDPOINT, { method: "GET" });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizeFolder) : [];
}

export async function createPinFolder(folder_name: string): Promise<PinFolder> {
  const response = await apiFetch(PIN_FOLDERS_CREATE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ folder_name }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to create pin folder");
  }
  return normalizeFolder(await response.json());
}

export async function movePinToFolder(
  pinId: string,
  folderId: string
): Promise<BackendPin> {
  const response = await apiFetch(PIN_MOVE_ENDPOINT(pinId), {
    method: "PATCH",
    body: JSON.stringify({ folder_id: folderId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to move pin");
  }
  return (await response.json()) as BackendPin;
}

// Not available in current backend — stubs for UI compatibility
export async function renamePinFolder(
  _folderId: string,
  _name: string
): Promise<PinFolder> {
  throw new Error("Rename folder is not supported in the current backend.");
}

export async function deletePinFolder(_folderId: string): Promise<void> {
  throw new Error("Delete folder is not supported in the current backend.");
}

export async function updatePinComments(
  _pinId: string,
  _comments: string[]
): Promise<BackendPin> {
  throw new Error("Pin comments are not supported in the current backend.");
}
