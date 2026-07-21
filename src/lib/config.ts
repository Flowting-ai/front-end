"use client";

// Absolute backend origin (no trailing slash).
// NEXT_PUBLIC_SERVER_URL is the reliable client-bundle alias (see next.config.ts env block).
// Falls back to SERVER_URL for local dev where next.config.ts bakes it under that key.
const SERVER_ORIGIN = (process.env.NEXT_PUBLIC_SERVER_URL ?? process.env.SERVER_URL ?? "").replace(/\/+$/, "");

const isLocalHost = (host: string): boolean =>
  host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local");

// On deployed origins the browser talks to the backend directly (absolute URL,
// Bearer auth via doFetch, CORS already allows the app origin) — no Vercel
// serverless proxy in the path, so its 300/800s stream kills and 4.5 MB body
// cap don't apply. Local dev keeps the same-origin proxy at
// src/app/api/backend/[...path]/route.ts because the backend's CORS allowlist
// doesn't include localhost.
export const API_BASE_URL =
  SERVER_ORIGIN && typeof window !== "undefined" && !isLocalHost(window.location.hostname)
    ? SERVER_ORIGIN
    : "/api/backend";

export const audience = process.env.AUTH0_AUDIENCE ?? "";

// ── Analytics (Mixpanel) ───────────────────────────────────────────────────────
// Additive only — new exports; nothing above/below is changed.
// Environment-scoped project token, read from env (never hard-coded) — same secret
// convention as `audience` above. Per docs/mixpanel-setup-notion.txt we keep the DEV
// and PROD Mixpanel projects separate so "all testing lands in DEV, production stays
// clean". Local dev and Vercel preview builds talk to the DEV project; only true
// production talks to the PROD project.
//
// - DEV token  → NEXT_PUBLIC_MIXPANEL_TOKEN       (already in the dev secret bundle)
// - PROD token → NEXT_PUBLIC_MIXPANEL_TOKEN_PROD  (paste into the prod secret bundle)
//
// When the relevant token is absent, analytics is a full no-op — so production sends
// nothing until the PROD token is provisioned (deliberately gated behind the DEV
// verification check). NEXT_PUBLIC_VERCEL_ENV, when exposed, distinguishes prod from
// preview; otherwise we fall back to NODE_ENV.
const isMixpanelProd =
  (process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV) === "production";
export const mixpanelToken =
  (isMixpanelProd
    ? process.env.NEXT_PUBLIC_MIXPANEL_TOKEN_PROD
    : process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) ?? "";
export const analyticsEnabled = mixpanelToken.length > 0;

// Interactive XML maps use a keyless style by default. Keeping the URL in one
// env-backed export lets deployments swap providers without changing widget
// code; next.config.ts derives the matching CSP origin from the same variable.
export const mapStyleUrl =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/positron";

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.debug("[Config] API_BASE_URL:", API_BASE_URL);
}

const withBase = (path: string) => `${API_BASE_URL}${path}`;

/**
 * Rewrite a proxied `/api/backend/...` endpoint to a direct, absolute backend
 * URL — bypassing the same-origin proxy.
 *
 * The proxy at `/api/backend/[...path]` runs as a Vercel serverless function,
 * which hard-caps request bodies at 4.5 MB (FUNCTION_PAYLOAD_TOO_LARGE / 413).
 * Multipart *file* uploads can easily exceed that, so on deployed environments
 * they must talk to the backend directly. The browser's CSP `connect-src`
 * already allows the backend origin (see next.config.ts), and `doFetch` injects
 * the Auth0 Bearer token on absolute URLs too — so this is safe for
 * authenticated calls. The backend's ALLOWED_ORIGIN / CORS must include the
 * deployed site origin (verified: e.g. https://devapp.getsouvenir.com).
 *
 * The 4.5 MB cap is a Vercel serverless limit only — it does NOT apply to the
 * route handler under local `next dev`. The backend CORS allowlist also does
 * not include localhost. So we keep the same-origin proxy when running on
 * localhost (and whenever SERVER_ORIGIN is unset), and go direct only on
 * deployed origins where the cap actually bites and CORS is configured.
 */
export const directUpload = (endpoint: string): string => {
  if (!SERVER_ORIGIN || !endpoint.startsWith(API_BASE_URL)) return endpoint;
  if (typeof window !== "undefined" && isLocalHost(window.location.hostname)) return endpoint;
  return `${SERVER_ORIGIN}${endpoint.slice(API_BASE_URL.length)}`;
};

/**
 * True when a multipart request should skip the same-origin Next.js proxy
 * and go straight to the backend (see `directUpload` above). Callers that
 * build their own absolute backend URL (bespoke proxies like /api/chat,
 * /api/brain-chat rather than the generic /api/backend/[...path] rewrite)
 * use this to decide whether to bypass their proxy entirely.
 */
export const shouldUseDirectBackend = (): boolean => {
  if (!SERVER_ORIGIN) return false;
  if (typeof window === "undefined") return false;
  return !isLocalHost(window.location.hostname);
};

/** Absolute backend origin (no trailing slash), or "" if unset. Only meaningful
 *  together with `shouldUseDirectBackend()` — see `directUpload` for why. */
export const BACKEND_ORIGIN = SERVER_ORIGIN;

// ── Health ────────────────────────────────────────────────────────────────────
export const HEALTH_ENDPOINT = withBase("/health");

// ── Users ────────────────────────────────────────────────────────────────────
export const USER_ENDPOINT = withBase("/users/me");
export const USER_CREATE_ENDPOINT = withBase("/users/create");
export const USER_ONBOARDING_ENDPOINT = withBase("/users/me/onboarding");

// ── Stripe ────────────────────────────────────────────────────────────────────
/** All Stripe operations go through the backend API proxy. */
export const STRIPE_CHECKOUT_ENDPOINT = withBase("/stripe/checkout");
export const STRIPE_SUBSCRIPTION_ENDPOINT = withBase("/stripe/subscription");
export const STRIPE_SUBSCRIPTION_RESUME_ENDPOINT = withBase("/stripe/subscription/resume");
export const STRIPE_TOPUP_ENDPOINT = withBase("/stripe/topup");
export const STRIPE_TOPUP_CHARGE_ENDPOINT = withBase("/stripe/topup/charge");
export const STRIPE_BILLING_ENDPOINT = withBase("/stripe/billing");
export const STRIPE_PORTAL_ENDPOINT = withBase("/stripe/portal");
/** Start a free trial (grants 1000 credits). */
export const STRIPE_TRIAL_ENDPOINT = withBase("/stripe/trial");

// ── Memory ───────────────────────────────────────────────────────────────────
export const MEMORY_USER_ENDPOINT = withBase("/memory/user");

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
  withBase(`/chats/${chatId}`)
export const CHAT_VISIBILITY_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}/visibility`);
export const CHAT_COPY_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}/copy`);
export const CHAT_STAR_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}/star`);
export const DELETE_MESSAGE_ENDPOINT = (messageId: string) =>
  withBase(`/chats/message/${messageId}`);
export const CHAT_SAVE_TO_DRIVE_ENDPOINT = (attachmentId: string) =>
  withBase(`/chats/files/${attachmentId}/save-to-drive`);
export const CHAT_PROMPT_RESPOND_ENDPOINT = (promptId: string) =>
  withBase(`/chats/prompts/${promptId}`);
export const CHAT_PENDING_PROMPTS_ENDPOINT = (chatId: string) =>
  withBase(`/chats/${chatId}/prompts/pending`);

// ── LLM Models ───────────────────────────────────────────────────────────────
export const MODELS_ENDPOINT = withBase("/llm/models");
export const MODELS_ALL_ENDPOINT = withBase("/llm/models/all");
export const MODELS_BLOCK_ENDPOINT = withBase("/llm/models/block");
export const MODELS_TEST_ENDPOINT = withBase("/llm/models/test");

// ── Personas ─────────────────────────────────────────────────────────────────
export const PERSONAS_ENDPOINT = withBase("/persona");
export const PERSONA_DETAIL_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}`);
export const PERSONA_USE_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}/use`);
export const PERSONA_ENHANCE_ENDPOINT = withBase("/persona/enhance-prompt");
export const PERSONA_STARTER_ENDPOINT = withBase("/persona/starter");
export const PERSONA_PAUSE_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}/pause`);
export const PERSONA_ACTIVE_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}/active`);
export const PERSONA_PUBLISH_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}/publish`);
export const PERSONA_GUIDE_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}/guide`);
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
export const PERSONA_VERSION_KNOWLEDGE_URL_ENDPOINT = (repoId: string, versionId: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}/knowledge-url`);
export const PERSONA_VERSION_FILES_ENDPOINT = (repoId: string, versionId: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}/files`);
export const PERSONA_VERSION_CONNECTOR_HINTS_ENDPOINT = (repoId: string, versionId: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}/connector-hints`);
export const PERSONA_VERSION_BLOCKED_CONNECTORS_ENDPOINT = (repoId: string, versionId: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}/blocked-connectors`);
export const PERSONA_VERSION_BLOCKED_CONNECTOR_ENDPOINT = (repoId: string, versionId: string, slug: string) =>
  withBase(`/persona/${repoId}/versions/${versionId}/blocked-connectors/${encodeURIComponent(slug)}`);
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
export const PROJECT_VISIBILITY_ENDPOINT = (projectId: string) => withBase(`/projects/${projectId}/visibility`)
export const PROJECT_CHATS_ENDPOINT  = (projectId: string) => withBase(`/projects/${projectId}/chats`)
export const PROJECT_CHAT_LINK_ENDPOINT = (projectId: string, chatId: string) =>
  withBase(`/projects/${projectId}/chats/${chatId}`)
export const PROJECT_FILES_ENDPOINT  = (projectId: string) =>
  withBase(`/projects/${projectId}/files`)
export const PROJECT_FILE_ENDPOINT   = (projectId: string, documentId: string) =>
  withBase(`/projects/${projectId}/files/${documentId}`)

// ── Persona Shares ─────────────────────────────────────────────────────────
export const PERSONA_SHARES_ENDPOINT           = withBase('/persona-shares')
export const PERSONA_SHARES_RECEIVED_ENDPOINT  = withBase('/persona-shares/received')
export const PERSONA_SHARES_SENT_ENDPOINT      = withBase('/persona-shares/sent')
export const PERSONA_SHARES_DASHBOARD_ENDPOINT = withBase('/persona-shares/dashboard')
export const PERSONA_SHARE_DETAIL_ENDPOINT     = (id: string) => withBase(`/persona-shares/${id}`)
export const PERSONA_SHARE_ACCEPT_ENDPOINT     = (id: string) => withBase(`/persona-shares/${id}/accept`)

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

// ── Organizations & Teams ─────────────────────────────────────────────────────
export const ORG_TEAMS_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/teams`)
export const ORG_TEAM_ENDPOINT = (orgId: string, teamId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}`)
export const ORG_TEAM_EDITORS_ENDPOINT = (orgId: string, teamId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/editors`)
export const ORG_TEAM_EDITOR_ENDPOINT = (orgId: string, teamId: string, memberId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/editors/${memberId}`)
export const ORG_TEAM_INVITES_ENDPOINT = (orgId: string, teamId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/invites`)
export const ORG_TEAM_INVITE_ENDPOINT = (orgId: string, teamId: string, inviteId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/invites/${inviteId}`)
export const ORG_TEAM_OVERFLOW_ENDPOINT = (orgId: string, teamId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/overflow`)
export const ORG_TEAM_PROJECT_MEMBERS_ENDPOINT = (orgId: string, teamId: string, projectId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/projects/${projectId}/members`)
export const ORG_TEAM_PROJECT_MEMBER_ENDPOINT = (orgId: string, teamId: string, projectId: string, memberId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/projects/${projectId}/members/${memberId}`)
export const ORG_TEAM_CONNECTORS_ENDPOINT = (orgId: string, teamId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/connectors`)
export const ORG_TEAM_CONNECTOR_CATALOG_ENDPOINT = (orgId: string, teamId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/connectors/catalog`)
export const ORG_TEAM_CONNECTOR_ENDPOINT = (orgId: string, teamId: string, slug: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/connectors/${encodeURIComponent(slug)}`)
export const ORG_TEAM_CONNECTIONS_ENDPOINT = (orgId: string, teamId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/connections`)
export const ORG_TEAM_PERSONA_SHARES_ENDPOINT = (orgId: string, teamId: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/persona-shares`)
export const ORG_TEAM_CONNECTION_ENDPOINT = (orgId: string, teamId: string, slug: string) =>
  withBase(`/organizations/${orgId}/teams/${teamId}/connections/${encodeURIComponent(slug)}`)
export const TEAM_INVITE_PREVIEW_ENDPOINT = (inviteId: string) =>
  withBase(`/team-invite/${inviteId}`)
export const TEAM_INVITE_ACCEPT_ENDPOINT = (inviteId: string) =>
  withBase(`/team-invite/${inviteId}/accept`)

// ── Organization ──────────────────────────────────────────────────────────────
export const ORGANIZATIONS_ENDPOINT = withBase('/organizations')
export const ORG_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}`)
export const ORG_SETTINGS_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/settings`)
export const ORG_PLAN_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/plan`)
export const ORG_PLAN_POOL_CAP_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/plan/pool-cap`)
export const ORG_PLAN_USAGE_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/plan/usage`)
export const ORG_POOL_STATUS_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/pool-status`)
export const ORG_POOL_CAP_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/plan/pool-cap`)
export const ORG_AUDIT_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/audit`)
export const ORG_TRANSFER_OWNER_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/transfer-owner`)
export const ORG_CONNECTOR_ACCOUNTS_ENDPOINT = (orgId: string, slug: string) =>
  withBase(`/organizations/${orgId}/connectors/${encodeURIComponent(slug)}/accounts`)
export const ORG_CONNECTOR_ACCOUNT_ENDPOINT = (orgId: string, accountId: string) =>
  withBase(`/organizations/${orgId}/connectors/accounts/${accountId}`)
export const ORG_CONNECTOR_USED_BY_ENDPOINT = (orgId: string, slug: string) =>
  withBase(`/organizations/${orgId}/connectors/${encodeURIComponent(slug)}/used-by`)
export const ORG_CATALOG_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/connectors/catalog`)
export const ORG_PERSONAL_REQUEST_ENDPOINT = (orgId: string, slug: string) =>
  withBase(`/organizations/${orgId}/connectors/${encodeURIComponent(slug)}/personal-request`)
export const ORG_PERSONAL_REQUESTS_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/connectors/personal-requests`)
export const ORG_PERSONAL_REQUEST_DETAIL_ENDPOINT = (orgId: string, requestId: string) =>
  withBase(`/organizations/${orgId}/connectors/personal-requests/${requestId}`)
export const ORG_MEMBERS_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/members`)
export const ORG_MEMBER_ENDPOINT = (orgId: string, memberId: string) =>
  withBase(`/organizations/${orgId}/members/${memberId}`)
export const ORG_MEMBER_ROLE_ENDPOINT = (orgId: string, memberId: string) =>
  withBase(`/organizations/${orgId}/members/${memberId}/role`)
export const ORG_MEMBER_CAP_ENDPOINT = (orgId: string, memberId: string) =>
  withBase(`/organizations/${orgId}/members/${memberId}/cap`)

// ── Chat shares ────────────────────────────────────────────────────────────────
export const CHAT_SHARES_ENDPOINT                = withBase('/chat-shares')
export const CHAT_SHARES_SHARED_WITH_ME_ENDPOINT = withBase('/chat-shares/shared-with-me')
export const CHAT_SHARE_ENDPOINT = (shareId: string) => withBase(`/chat-shares/${shareId}`)
export const CHAT_SHARE_FORK_ENDPOINT = (shareId: string) => withBase(`/chat-shares/${shareId}/fork`)

// ── Slack mapping ──────────────────────────────────────────────────────────────
export const SLACK_INSTALL_ENDPOINT = withBase('/slack/install')
export const SLACK_STATUS_ENDPOINT  = withBase('/slack/status')
/** POST to complete a /connect deep link, DELETE to unlink the user's Slack identity. */
export const SLACK_LINK_ENDPOINT    = withBase('/slack/link')
export const ORG_SLACK_CHANNELS_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/slack/channels`)
export const ORG_SLACK_CHANNEL_MAPPING_ENDPOINT = (orgId: string, channelId: string) =>
  withBase(`/organizations/${orgId}/slack/channels/${encodeURIComponent(channelId)}/mapping`)
/** DELETE — remove the Slack bot from the organization (revokes + drops install). */
export const ORG_SLACK_INSTALLATION_ENDPOINT = (orgId: string) =>
  withBase(`/organizations/${orgId}/slack/installation`)
export const ORG_SLACK_PROJECT_CHANNEL_ENDPOINT = (orgId: string, projectId: string) =>
  withBase(`/organizations/${orgId}/slack/projects/${projectId}/channel`)

// ── Persona visibility ─────────────────────────────────────────────────────────
export const PERSONA_VISIBILITY_ENDPOINT = (repoId: string) =>
  withBase(`/persona/${repoId}/visibility`)

// ── Overflow approve ───────────────────────────────────────────────────────────
export const ORG_OVERFLOW_APPROVE_ENDPOINT = (orgId: string, requestId: string) =>
  withBase(`/organizations/${orgId}/overflow/${requestId}/approve`)
