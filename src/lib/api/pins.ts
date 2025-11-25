"use client";

import { CHAT_PINS_ENDPOINT, PIN_DETAIL_ENDPOINT, PIN_FOLDERS_ENDPOINT, PINS_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface BackendPin {
  id: string;
  chat: string;
  content: string;
  model_name?: string;
  created_at?: string;
  folderId?: string | null;
  folder_id?: string | null;
}

export async function fetchPins(
  chatId: string,
  csrfToken?: string | null
): Promise<BackendPin[]> {
  const response = await apiFetch(
    CHAT_PINS_ENDPOINT(chatId),
    { method: "GET" },
    csrfToken
  );
  if (!response.ok) {
    throw new Error(`Failed to load pins for chat ${chatId}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data as BackendPin[];
  }
  return [];
}

export async function createPin(
  chatId: string,
  messageId: string,
  csrfToken?: string | null
): Promise<BackendPin> {
  const response = await apiFetch(
    CHAT_PINS_ENDPOINT(chatId),
    {
      method: "POST",
      body: JSON.stringify({ messageId }),
    },
    csrfToken
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to create pin");
  }

  return (await response.json()) as BackendPin;
}

export async function deletePin(
  pinId: string,
  csrfToken?: string | null
): Promise<void> {
  const response = await apiFetch(
    PIN_DETAIL_ENDPOINT(pinId),
    { method: "DELETE" },
    csrfToken
  );

  if (!response.ok) {
    throw new Error("Failed to delete pin");
  }
}

export async function fetchAllPins(csrfToken?: string | null): Promise<BackendPin[]> {
  const response = await apiFetch(PINS_ENDPOINT, { method: "GET" }, csrfToken);
  if (!response.ok) {
    throw new Error("Failed to load pins");
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data as BackendPin[];
  }
  return [];
}

export interface PinFolder {
  id: string;
  name: string;
  isDefault?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function fetchPinFolders(csrfToken?: string | null): Promise<PinFolder[]> {
  const response = await apiFetch(PIN_FOLDERS_ENDPOINT, { method: "GET" }, csrfToken);
  if (!response.ok) {
    throw new Error("Failed to load pin folders");
  }
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data as PinFolder[];
}

export async function createPinFolder(name: string, csrfToken?: string | null): Promise<PinFolder> {
  const response = await apiFetch(
    PIN_FOLDERS_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
    csrfToken
  );
  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || "Failed to create pin folder");
  }
  return (await response.json()) as PinFolder;
}

export async function movePinToFolder(
  pinId: string,
  folderId: string | null,
  csrfToken?: string | null
): Promise<void> {
  const response = await apiFetch(
    PIN_DETAIL_ENDPOINT(pinId),
    {
      method: "PATCH",
      body: JSON.stringify({ folderId }),
    },
    csrfToken
  );

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || "Failed to move pin");
  }
}
