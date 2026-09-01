// Shared internal navigation routes referenced from more than one file
// (router.push/replace, redirect(), window.location). Centralizing these
// avoids the same path literal drifting out of sync with the actual
// src/app folder structure after a route is renamed.
//
// Routes referenced from only one file should stay as local literals there.

export const ROOT_ROUTE = "/";
export const CHAT_ROUTE = "/chat";
export const CHATS_ROUTE = "/chats";
export const AGENTS_ROUTE = "/agents";
export const AGENTS_TEMPLATES_ROUTE = "/agents/templates";
export const AGENTS_BASICS_NAME_ROUTE = "/agents/basics/name";
export const AGENTS_BASICS_PURPOSE_ROUTE = "/agents/basics/purpose";
export const AGENTS_BASICS_TONE_ROUTE = "/agents/basics/tone";
export const BRAIN_ROUTE = "/brain";
export const BRAIN_THREADS_ROUTE = "/brain/threads";
export const BRAIN_SCHEDULES_ROUTE = "/brain/schedules";
export const TEMPLATE_BASE_ROUTE = "/template";
export const WELCOME_ROUTE = "/welcome";
export const PROJECTS_ROUTE = "/projects";
export const PROJECTS_NEW_ROUTE = "/projects/new";

// NOTE: General/Members/Teams/Plans/Analytics/Activity moved from /org/* to
// /settings/* (Souvenir V1.5) — old /org/{page} paths are now thin redirect
// stubs to these. Connectors and "Souvenir in Slack" moved further still,
// to their own top-level routes — each has its own
// dedicated sidebar destination (see FlatDestinations in LeftSidebar.tsx) and
// its own layout guard (src/app/(app)/connectors, src/app/(app)/souvenir-slack).
// Constant names keep their historical ORG_ prefix to avoid touching every
// call site for a rename — only the string values changed.
export const ORG_BASE_ROUTE = "/org";
export const ORG_GENERAL_ROUTE = "/settings/general";
export const ORG_ACTIVITY_ROUTE = "/settings/activity";
// Merged with the individual "Usage & Billing" page (SETTINGS_BILLING_ROUTE
// below) so every account type — individual, org member, org owner/admin —
// lands on one page. Constant name kept per this file's own precedent (see
// the note above): only the string value changed.
export const ORG_PLANS_ROUTE = "/settings/plans-and-billing";
export const ORG_MEMBERS_ROUTE = "/settings/members";
export const ORG_ANALYTICS_ROUTE = "/settings/analytics";
export const ORG_CHANGE_PLAN_ROUTE = "/org/change-plan";
export const ORG_SOUVENIR_SLACK_ROUTE = "/souvenir-slack";
export const ORG_CONNECTORS_ROUTE = "/connectors";

export const SETTINGS_ROUTE = "/settings";
export const SETTINGS_ACCOUNT_ROUTE = "/settings/account";
export const SETTINGS_HELP_ROUTE = "/settings/help";
export const SETTINGS_CONNECTORS_ROUTE = "/settings/connectors";
export const SETTINGS_AI_ROUTE = "/settings/ai";
// Retired — plans/payment/invoices for every account type now live on
// ORG_PLANS_ROUTE (/settings/plans-and-billing). This route is now just a
// redirect stub (src/app/(app)/settings/(shell)/billing/page.tsx) kept for old
// bookmarks/links; its sub-routes (change-plan, confirmation) are still real
// pages, just no longer linked from here.
export const SETTINGS_BILLING_ROUTE = "/settings/billing";
// Settings v1.5 — PERSONAL > Usage (node 17-22980), split out of the old
// combined "Usage & Billing" page. This page is personal credit-consumption only.
export const SETTINGS_USAGE_ROUTE = "/settings/usage";
export const SETTINGS_BILLING_CHANGE_PLAN_ROUTE = "/settings/billing/change-plan";
export const SETTINGS_BILLING_CONFIRMATION_ROUTE = "/settings/billing/confirmation";
export const TEAM_INVITE_BASE_ROUTE = "/team-invite";

// B1/B2 (pre-login invite landing, "You're on the list! You've been invited
// to join X's workspace" — Sign in vs Sign up depending on whether the
// invited email already has an account). Genuinely public: proxy.ts must
// exempt this route from its logged-out → /auth/login redirect, since this
// page IS the "decide sign in vs sign up" screen for a logged-out invitee.
export const INVITE_LANDING_BASE_ROUTE = "/invite";
export const INVITE_LANDING_ROUTE = (inviteId: string) => `${INVITE_LANDING_BASE_ROUTE}/${inviteId}`;

export const ONBOARDING_HELLO_ROUTE = "/onboarding/hello";
export const ONBOARDING_ACCOUNT_TYPE_ROUTE = "/onboarding/account-type";
export const ONBOARDING_WORKSPACE_ROUTE = "/onboarding/workspace";
export const ONBOARDING_CONNECTORS_ROUTE = "/onboarding/connectors";
export const ONBOARDING_IMPORT_ROUTE = "/onboarding/import";
export const ONBOARDING_INVITE_ROUTE = "/onboarding/invite";
export const ONBOARDING_PLANS_ROUTE = "/onboarding/plans";
export const ONBOARDING_PRICING_ROUTE = "/onboarding/pricing";
export const ONBOARDING_BASE_ROUTE = "/onboarding";
export const ONBOARDING_TEAM_BASE_ROUTE = "/onboarding/team";
export const ONBOARDING_TONE_ROUTE = "/onboarding/tone";

// ── v1.5 workspace-onboarding flow (docs v1.5/onboarding-v1.5-flow.md) ───────
// ONBOARDING_WORKSPACE_ROUTE above is reused for this flow's step 2 (same URL,
// new content) — only these two are new routes.
export const ONBOARDING_SETUP_ROUTE = "/onboarding/setup";
export const ONBOARDING_PROFILE_ROUTE = "/onboarding/profile";
// A2 (join an existing workspace) — screen 1 only; screens 2/3 reuse the
// ONBOARDING_PROFILE_ROUTE page and the add-to-slack-modal above verbatim.
export const ONBOARDING_JOIN_ROUTE = "/onboarding/join";

export const AUTH_LOGIN_ROUTE = "/auth/login";

export const PROJECT_BASE_ROUTE = "/project";
export const AGENT_BASE_ROUTE = "/agent";
export const TEAMS_BASE_ROUTE = "/teams";

export const AGENT_CONFIGURE_BASE_ROUTE = "/agent/configure";
export const AGENT_CONFIGURE_INSTRUCTIONS_BASE_ROUTE = "/agent/configure/instructions";
export const AGENT_CONFIGURE_SHARING_BASE_ROUTE = "/agent/configure/sharing";
export const AGENT_CONFIGURE_TAB_ROUTE = (tab: string) => `${AGENT_CONFIGURE_BASE_ROUTE}/${tab}`;

export const PROJECT_ROUTE = (projectId: string) => `/project/${projectId}`;
export const PROJECT_CHAT_ROUTE = (projectId: string, chatId: string) =>
  `/project/${projectId}/chat/${chatId}`;
export const PROJECT_CHAT_NEW_ROUTE = (projectId: string) => `/project/${projectId}/chat/new`;
export const AGENT_CHAT_ROUTE = (personaId: string) => `/agents/${personaId}/chat`;
export const CHAT_SHARE_ROUTE = (shareId: string) => `/chat-shares/${shareId}`;

export const ONBOARDING_TEAM_WELCOME_ROUTE = (inviteId: string) => `${ONBOARDING_TEAM_BASE_ROUTE}/${inviteId}`;
export const ONBOARDING_TEAM_CONFIRM_ROUTE = (inviteId: string) => `/onboarding/team/${inviteId}/confirm`;
export const ONBOARDING_TEAM_JOIN_ROUTE = (inviteId: string) => `/onboarding/team/${inviteId}/join`;
export const ONBOARDING_TEAM_PROFILE_ROUTE = (inviteId: string) => `/onboarding/team/${inviteId}/profile`;

type AgentConfigureQueryOpts = { name?: string | null; versionId?: string | null };

const withAgentConfigureQuery = (
  base: string,
  repoId: string,
  opts?: AgentConfigureQueryOpts,
) => {
  let route = `${base}?repoId=${repoId}`;
  if (opts?.name) route += `&name=${encodeURIComponent(opts.name)}`;
  if (opts?.versionId) route += `&versionId=${opts.versionId}`;
  return route;
};

export const AGENT_CONFIGURE_INSTRUCTIONS_ROUTE = (repoId: string, opts?: AgentConfigureQueryOpts) =>
  withAgentConfigureQuery(AGENT_CONFIGURE_INSTRUCTIONS_BASE_ROUTE, repoId, opts);

export const AGENT_CONFIGURE_SHARING_ROUTE = (repoId: string, opts?: AgentConfigureQueryOpts) =>
  withAgentConfigureQuery(AGENT_CONFIGURE_SHARING_BASE_ROUTE, repoId, opts);

export const AUTH_LOGOUT_ROUTE = (returnTo: string) =>
  `/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
