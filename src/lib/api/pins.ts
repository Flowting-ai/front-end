"use client";

import { CHAT_PINS_ENDPOINT, PIN_DETAIL_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface BackendPinMeta {
  tag?: string;
  title?: string;
  should_pin?: boolean;
  assistant_message?: string;
}

export interface BackendPin {
  id: string;
  chat: string;
  message: string;
  content: string;
  model_name?: string;
  tags?: BackendPinMeta | null;
  created_at?: string;
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
