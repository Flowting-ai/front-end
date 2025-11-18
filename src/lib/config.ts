"use client";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_API_BASE_URL;

export const LOGIN_ENDPOINT = `${API_BASE_URL}/login/`;
export const CHAT_COMPLETION_ENDPOINT = `${API_BASE_URL}/chat/`;
export const CHATS_ENDPOINT = `${API_BASE_URL}/chats/`;
export const MODELS_ENDPOINT = `${API_BASE_URL}/get_models`;
export const CHAT_MESSAGES_ENDPOINT = (chatId: string | number) =>
  `${API_BASE_URL}/chats/${chatId}/messages/`;
export const CHAT_PINS_ENDPOINT = (chatId: string | number) =>
  `${API_BASE_URL}/chats/${chatId}/pins/`;
export const PIN_DETAIL_ENDPOINT = (pinId: string | number) =>
  `${API_BASE_URL}/pins/${pinId}/`;
export const TOKENS_ENDPOINT = `${API_BASE_URL}/tokens/`;
