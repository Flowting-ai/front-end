"use client";

// Client-side requests go through a same-origin rewrite path to avoid CORS.
// next.config.ts rewrites /api/backend/:path* → SERVER_URL/:path*.
export const API_BASE_URL = "/api/backend";

export const audience = process.env.AUTH0_AUDIENCE ?? "";

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.debug("[Config] API_BASE_URL:", API_BASE_URL);
}

const withBase = (path: string) => `${API_BASE_URL}${path}`;

// ── Health ────────────────────────────────────────────────────────────────────
export const HEALTH_ENDPOINT = withBase("/health");

// ── Users ────────────────────────────────────────────────────────────────────
export const USER_ENDPOINT = withBase("/users/me");
export const USER_CREATE_ENDPOINT = withBase("/users/create");
export const USER_ONBOARDING_ENDPOINT = withBase("/users/me/onboarding");

// ── Stripe ────────────────────────────────────────────────────────────────────
/** Same-origin Next route handlers - honor `checkout_flow` (e.g. change-plan cancel → /settings/.../change-plan). */
export const STRIPE_CHECKOUT_ENDPOINT = "/api/stripe/checkout";
export const STRIPE_SUBSCRIPTION_ENDPOINT = "/api/stripe/subscription";
export const STRIPE_TOPUP_ENDPOINT = "/api/stripe/topup";
/** Backend (proxied) Stripe reads — billing snapshot + hosted portal link. */
export const STRIPE_BILLING_ENDPOINT = withBase("/stripe/billing");
export const STRIPE_PORTAL_ENDPOINT = withBase("/stripe/portal");

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
export const CHAT_DELETE_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}`);
export const CHAT_STAR_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}/star`);
export const DELETE_MESSAGE_ENDPOINT = (messageId: string) =>
  withBase(`/chats/message/${messageId}`);
export const CHAT_SAVE_TO_DRIVE_ENDPOINT = (attachmentId: string) =>
  withBase(`/chats/files/${attachmentId}/save-to-drive`);
export const CHAT_PROMPT_RESPOND_ENDPOINT = (promptId: string) =>
  withBase(`/chats/prompts/${promptId}`);

// ── LLM Models ───────────────────────────────────────────────────────────────
export const MODELS_ENDPOINT = withBase("/llm/models");
export const MODELS_ALL_ENDPOINT = withBase("/llm/models/all");
export const MODELS_BLOCK_ENDPOINT = withBase("/llm/models/block");
export const MODELS_TEST_ENDPOINT = withBase("/llm/models/test");

// ── Personas ─────────────────────────────────────────────────────────────────
export const PERSONAS_ENDPOINT = withBase("/persona");
export const PERSONA_DETAIL_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}`);
export const PERSONA_ENHANCE_ENDPOINT = withBase("/persona/enhance-prompt");
export const PERSONA_PAUSE_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}/pause`);
export const PERSONA_ACTIVE_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}/active`);
// Versions
export const PERSONA_VERSIONS_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}/versions`);
export const PERSONA_VERSION_DETAIL_ENDPOINT = (repoId: string, versionId: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}`);
export const PERSONA_VERSION_TEST_ENDPOINT = (repoId: string, versionId: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}/test`);
export const PERSONA_VERSION_DOCUMENT_ENDPOINT = (repoId: string, versionId: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}/document`);
export const PERSONA_VERSION_DOCUMENT_DELETE_ENDPOINT = (repoId: string, versionId: string, documentId: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}/document/${documentId}`);
export const PERSONA_VERSION_CONNECTORS_ENDPOINT = (repoId: string, versionId: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}/connectors`);
export const PERSONA_CHATS_ENDPOINT = (personaId: string) =>
  withBase(`/persona/${personaId}/chats`);
export const PERSONA_CHATS_CREATE_ENDPOINT = (personaId: string) =>
  withBase(`/persona/${personaId}/chats/create`);
export const PERSONA_CHAT_MESSAGES_ENDPOINT = (personaId: string, chatId: string) =>
  withBase(`/persona/${personaId}/chats/${chatId}/messages`);
export const PERSONA_CHAT_STREAM_ENDPOINT = (personaId: string, chatId: string) =>
  withBase(`/persona/${personaId}/chats/${chatId}/stream`);
export const PERSONA_CHAT_STOP_ENDPOINT = (personaId: string, chatId: string) =>
  withBase(`/persona/${personaId}/chats/${chatId}/stop`);
export const PERSONA_CHATS_RENAME_ENDPOINT = (personaId: string) =>
  withBase(`/persona/${personaId}/chats/rename`);
export const PERSONA_CHAT_DELETE_MESSAGE_ENDPOINT = (
  personaId: string,
  chatId: string,
  messageId: string,
) => withBase(`/persona/${personaId}/chats/${chatId}/message/${messageId}`);

// ── Highlights ───────────────────────────────────────────────────────────────
export const HIGHLIGHTS_ENDPOINT = withBase('/highlights')
export const HIGHLIGHT_DETAIL_ENDPOINT = (highlightId: string) =>
  withBase(`/highlights/${highlightId}`)

// ── Pins ─────────────────────────────────────────────────────────────────────
export const PINS_ENDPOINT = withBase("/pins");
export const PIN_DETAIL_ENDPOINT = (pinId: string) => withBase(`/pins/${pinId}`);
export const CREATE_PIN_ENDPOINT = (messageId: string) =>
  withBase(`/pins/message/${messageId}`);
export const PIN_FOLDERS_ENDPOINT = withBase("/pins/folders/all");
export const PIN_FOLDERS_CREATE_ENDPOINT = withBase("/pins/folders");
export const PIN_FOLDER_DETAIL_ENDPOINT = (folderId: string) => withBase(`/pins/folders/${folderId}`);
export const PIN_MOVE_ENDPOINT = (pinId: string) => withBase(`/pins/${pinId}/folder`)
export const PIN_TAGS_ENDPOINT = (pinId: string) => withBase(`/pins/${pinId}/tags`)
export const PIN_COMMENT_ENDPOINT = (pinId: string) => withBase(`/pins/${pinId}/comments`)
export const PIN_COMMENT_CRUD_ENDPOINT = (pinId: string, commentId: string) => withBase(`/pins/${pinId}/comments/${commentId}`);

// ── Projects ──────────────────────────────────────────────────────────────────
export const PROJECTS_ENDPOINT = withBase('/projects')
export const PROJECT_DETAIL_ENDPOINT = (projectId: string) => withBase(`/projects/${projectId}`)
export const PROJECT_CHATS_ENDPOINT  = (projectId: string) => withBase(`/projects/${projectId}/chats`)
export const PROJECT_CHAT_LINK_ENDPOINT = (projectId: string, chatId: string) =>
  withBase(`/projects/${projectId}/chats/${chatId}`)
export const PROJECT_FILES_ENDPOINT  = (projectId: string) =>
  withBase(`/projects/${projectId}/files`)
export const PROJECT_FILE_ENDPOINT   = (projectId: string, documentId: string) =>
  withBase(`/projects/${projectId}/files/${documentId}`)

// ── Connectors ────────────────────────────────────────────────────────────────
export const CONNECTORS_ENDPOINT            = withBase('/connectors')
export const CONNECTOR_DETAIL_ENDPOINT      = (slug: string) => withBase(`/connectors/${slug}`)
export const CONNECTOR_LINK_ENDPOINT        = (slug: string) => withBase(`/connectors/${slug}/link`)

// ── Workflows ─────────────────────────────────────────────────────────────────
export const WORKFLOWS_ENDPOINT = withBase("/workflow");
export const WORKFLOW_DETAIL_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}`);
export const WORKFLOW_PAUSE_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}/pause`);
export const WORKFLOW_EXECUTE_STREAM_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}/execute/stream`);
export const WORKFLOW_CHATS_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}/chats`);
export const WORKFLOW_CHATS_CREATE_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}/chats/create`);
export const WORKFLOW_CHAT_MESSAGES_ENDPOINT = (workflowId: string, chatId: string) =>
  withBase(`/workflow/${workflowId}/chats/${chatId}/messages`);
export const WORKFLOW_CHAT_STREAM_ENDPOINT = (workflowId: string, chatId: string) =>
  withBase(`/workflow/${workflowId}/chats/${chatId}/stream`);
export const WORKFLOW_CHAT_STOP_ENDPOINT = (workflowId: string, chatId: string) =>
  withBase(`/workflow/${workflowId}/chats/${chatId}/stop`);
export const WORKFLOW_CHATS_RENAME_ENDPOINT = (workflowId: string) =>
  withBase(`/workflow/${workflowId}/chats/rename`);
export const WORKFLOW_CHAT_DELETE_MESSAGE_ENDPOINT = (
  workflowId: string,
  chatId: string,
  messageId: string,
) => withBase(`/workflow/${workflowId}/chats/${chatId}/message/${messageId}`);
