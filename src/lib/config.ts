"use client";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API!.replace(/\/+$/, "");

export const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE ?? "";

// Debug: log API URL on load
if (typeof window !== "undefined") {
  console.log("[Config] API_BASE_URL:", API_BASE_URL);
}

const withBase = (path: string) => `${API_BASE_URL}${path}`;

// ── Users ────────────────────────────────────────────────────────────────────
export const USER_ENDPOINT = withBase("/users/me");
export const USER_CREATE_ENDPOINT = withBase("/users/create");

// ── Chats ────────────────────────────────────────────────────────────────────
export const CHATS_ENDPOINT = withBase("/chats");
export const CHATS_CREATE_ENDPOINT = withBase("/chats/create");
export const CHATS_RENAME_ENDPOINT = withBase("/chats/rename");
export const CHAT_MESSAGES_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}/messages`);
export const CHAT_STREAM_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}/stream`);
export const CHAT_STOP_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}/stop`);
export const CHAT_STAR_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}/star`);
export const DELETE_MESSAGE_ENDPOINT = (messageId: string) =>
  withBase(`/chats/message/${messageId}`);

// ── LLM Models ───────────────────────────────────────────────────────────────
export const MODELS_ENDPOINT = withBase("/llm/models");
export const MODELS_ALL_ENDPOINT = withBase("/llm/models/all");
export const MODELS_BLOCK_ENDPOINT = withBase("/llm/models/block");

// ── Personas ─────────────────────────────────────────────────────────────────
export const PERSONAS_ENDPOINT = withBase("/persona");
export const PERSONA_DETAIL_ENDPOINT = (personaId: string) =>
  withBase(`/persona/${personaId}`);
export const PERSONA_ENHANCE_ENDPOINT = withBase("/persona/enhance-prompt");
export const PERSONA_TEST_ENDPOINT = (personaId: string) =>
  withBase(`/persona/${personaId}/test`);
export const PERSONA_CHATS_ENDPOINT = (personaId: string) =>
  withBase(`/persona/${personaId}/chats`);
export const PERSONA_CHATS_CREATE_ENDPOINT = (personaId: string) =>
  withBase(`/persona/${personaId}/chats/create`);
export const PERSONA_CHAT_MESSAGES_ENDPOINT = (
  personaId: string,
  chatId: string
) => withBase(`/persona/${personaId}/chats/${chatId}/messages`);
export const PERSONA_CHAT_STREAM_ENDPOINT = (
  personaId: string,
  chatId: string
) => withBase(`/persona/${personaId}/chats/${chatId}/stream`);
export const PERSONA_CHAT_STOP_ENDPOINT = (personaId: string, chatId: string) =>
  withBase(`/persona/${personaId}/chats/${chatId}/stop`);
export const PERSONA_CHATS_RENAME_ENDPOINT = (personaId: string) =>
  withBase(`/persona/${personaId}/chats/rename`);
export const PERSONA_CHAT_DELETE_MESSAGE_ENDPOINT = (
  personaId: string,
  chatId: string,
  messageId: string
) => withBase(`/persona/${personaId}/chats/${chatId}/message/${messageId}`);

// ── Pins ─────────────────────────────────────────────────────────────────────
export const PINS_ENDPOINT = withBase("/pins");
export const PIN_DETAIL_ENDPOINT = (pinId: string) =>
  withBase(`/pins/${pinId}`);
export const CREATE_PIN_ENDPOINT = (messageId: string) =>
  withBase(`/pins/message/${messageId}`);
export const PIN_FOLDERS_ENDPOINT = withBase("/pins/folders/all");
export const PIN_FOLDERS_CREATE_ENDPOINT = withBase("/pins/folders");
export const PIN_MOVE_ENDPOINT = (pinId: string) =>
  withBase(`/pins/${pinId}/folder`);

// ── Workflows ─────────────────────────────────────────────────────────────────
export const WORKFLOWS_ENDPOINT = withBase("/workflow");
export const WORKFLOW_DETAIL_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}`);
export const WORKFLOW_CHATS_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}/chats`);
export const WORKFLOW_CHATS_CREATE_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}/chats/create`);
export const WORKFLOW_CHAT_MESSAGES_ENDPOINT = (
  workflowId: string,
  chatId: string
) => withBase(`/workflow/${workflowId}/chats/${chatId}/messages`);
export const WORKFLOW_CHAT_STREAM_ENDPOINT = (
  workflowId: string,
  chatId: string
) => withBase(`/workflow/${workflowId}/chats/${chatId}/stream`);
export const WORKFLOW_CHAT_STOP_ENDPOINT = (workflowId: string, chatId: string) =>
  withBase(`/workflow/${workflowId}/chats/${chatId}/stop`);
export const WORKFLOW_CHATS_RENAME_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}/chats/rename`);
export const WORKFLOW_CHAT_DELETE_MESSAGE_ENDPOINT = (
  workflowId: string,
  chatId: string,
  messageId: string
) => withBase(`/workflow/${workflowId}/chats/${chatId}/message/${messageId}`);

export const allTags = ["Finance Research", "Product Analysis Q4", "Marketing Strategy"];
