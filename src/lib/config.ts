"use client";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_API_BASE_URL;

export const LOGIN_ENDPOINT = `${API_BASE_URL}/login/`;
export const SIGNUP_ENDPOINT = `${API_BASE_URL}/signup/`;
export const CHAT_COMPLETION_ENDPOINT = `${API_BASE_URL}/chat/`;
export const CHATS_ENDPOINT = `${API_BASE_URL}/chats/`;
export const CHAT_DETAIL_ENDPOINT = (chatId: string | number) =>
  `${API_BASE_URL}/chats/${chatId}/`;
export const MODELS_ENDPOINT = `${API_BASE_URL}/get_models`;
export const CHAT_MESSAGES_ENDPOINT = (chatId: string | number) =>
  `${API_BASE_URL}/chats/${chatId}/messages/`;
export const DELETE_MESSAGE_ENDPOINT = (chatId: string | number, messageId: string | number) =>
  `${API_BASE_URL}/chats/${chatId}/messages/${messageId}/`;
export const MESSAGE_REACTION_ENDPOINT = (chatId: string | number, messageId: string | number) =>
  `${API_BASE_URL}/chats/${chatId}/messages/${messageId}/reaction/`;
export const CHAT_PINS_ENDPOINT = (chatId: string | number) =>
  `${API_BASE_URL}/chats/${chatId}/pins/`;
export const PIN_DETAIL_ENDPOINT = (pinId: string | number) =>
  `${API_BASE_URL}/pins/${pinId}/`;
export const PINS_ENDPOINT = `${API_BASE_URL}/pins/`;
export const PIN_FOLDERS_ENDPOINT = `${API_BASE_URL}/pin-folders/`;
export const DOCUMENTS_ENDPOINT = `${API_BASE_URL}/documents/`;
export const DOCUMENT_SEARCH_ENDPOINT = `${API_BASE_URL}/documents/search/`;
export const GENERATE_IMAGE_ENDPOINT = `${API_BASE_URL}/generate-image/`;
export const TOKENS_ENDPOINT = `${API_BASE_URL}/tokens/`;

export const allTags = ["Finance Research", "Product Analysis Q4", "Marketing Strategy"];
