"use client";

const DEFAULT_API_BASE_URL = "https://1jellyfish-app-7brqd.ondigitalocean.app";

// Normalize the base to avoid accidental double slashes when the env var ends with "/".
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_HOST_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const withBase = (path: string) => `${API_BASE_URL}${path}`;

// Backend routes (see backend docs in API_DOCUMENTATION.md).
const PATHS = {
  csrfInit: "/api/csrf-init/",
  login: "/login/",
  signup: "/signup/",
  user: "/user/",
  tokens: "/tokens/",
  chats: "/chats/",
  chat: "/chat/",
  chatDetail: (chatId: string | number) => `/chats/${chatId}/`,
  chatStar: (chatId: string | number) => `/chats/${chatId}/star/`,
  chatMessages: (chatId: string | number) => `/chats/${chatId}/messages/`,
  chatMessage: (chatId: string | number, messageId: string | number) =>
    `/chats/${chatId}/messages/${messageId}/`,
  chatMessageEdit: (chatId: string | number, messageId: string | number) =>
    `/chats/${chatId}/messages/${messageId}/edit/`,
  chatMessageReaction: (chatId: string | number, messageId: string | number) =>
    `/chats/${chatId}/messages/${messageId}/reaction/`,
  chatPins: (chatId: string | number) => `/chats/${chatId}/pins/`,
  pins: "/pins/",
  pinDetail: (pinId: string | number) => `/pins/${pinId}/`,
  pinFolders: "/pin-folders/",
  pinFolderDetail: (folderId: string | number) => `/pin-folders/${folderId}/`,
  pinFolderIds: "/pin-folders/ids/",
  models: "/get_models",
  documents: "/documents/",
  documentsSearch: "/documents/search/",
  imageGeneration: "/generate-image/",
} as const;

export const CSRF_INIT_ENDPOINT = withBase(PATHS.csrfInit);
export const LOGIN_ENDPOINT = withBase(PATHS.login);
export const SIGNUP_ENDPOINT = withBase(PATHS.signup);
export const USER_ENDPOINT = withBase(PATHS.user);
export const TOKENS_ENDPOINT = withBase(PATHS.tokens);
export const CHATS_ENDPOINT = withBase(PATHS.chats);
export const CHAT_COMPLETION_ENDPOINT = withBase(PATHS.chat);
export const CHAT_DETAIL_ENDPOINT = (chatId: string | number) =>
  withBase(PATHS.chatDetail(chatId));
export const CHAT_STAR_ENDPOINT = (chatId: string | number) =>
  withBase(PATHS.chatStar(chatId));
export const MODELS_ENDPOINT = withBase(PATHS.models);
export const CHAT_MESSAGES_ENDPOINT = (chatId: string | number) =>
  withBase(PATHS.chatMessages(chatId));
export const DELETE_MESSAGE_ENDPOINT = (
  chatId: string | number,
  messageId: string | number
) => withBase(PATHS.chatMessage(chatId, messageId));
export const MESSAGE_EDIT_ENDPOINT = (
  chatId: string | number,
  messageId: string | number
) => withBase(PATHS.chatMessageEdit(chatId, messageId));
export const MESSAGE_REACTION_ENDPOINT = (
  chatId: string | number,
  messageId: string | number
) => withBase(PATHS.chatMessageReaction(chatId, messageId));
export const CHAT_PINS_ENDPOINT = (chatId: string | number) =>
  withBase(PATHS.chatPins(chatId));
export const PIN_DETAIL_ENDPOINT = (pinId: string | number) =>
  withBase(PATHS.pinDetail(pinId));
export const PINS_ENDPOINT = withBase(PATHS.pins);
export const PIN_FOLDERS_ENDPOINT = withBase(PATHS.pinFolders);
export const PIN_FOLDER_DETAIL_ENDPOINT = (folderId: string | number) =>
  withBase(PATHS.pinFolderDetail(folderId));
export const PIN_FOLDER_IDS_ENDPOINT = withBase(PATHS.pinFolderIds);
export const DOCUMENTS_ENDPOINT = withBase(PATHS.documents);
export const DOCUMENT_SEARCH_ENDPOINT = withBase(PATHS.documentsSearch);
export const IMAGE_GENERATION_ENDPOINT = withBase(PATHS.imageGeneration);

export const allTags = ["Finance Research", "Product Analysis Q4", "Marketing Strategy"];
