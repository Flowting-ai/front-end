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
export const WELCOME_ROUTE = "/welcome";
export const PROJECTS_ROUTE = "/projects";
export const PROJECTS_NEW_ROUTE = "/projects/new";

export const ORG_BASE_ROUTE = "/org";
export const ORG_GENERAL_ROUTE = "/org/general";
export const ORG_ACTIVITY_ROUTE = "/org/activity";
export const ORG_PLANS_ROUTE = "/org/plans";
export const ORG_TEAMS_ROUTE = "/org/teams";
export const ORG_MEMBERS_ROUTE = "/org/members";
export const ORG_CHANGE_PLAN_ROUTE = "/org/change-plan";
export const ORG_SOUVENIR_SLACK_ROUTE = "/org/souvenir-slack";
export const ORG_CONNECTORS_ROUTE = "/org/connectors";

export const SETTINGS_ROUTE = "/settings";
export const SETTINGS_ACCOUNT_ROUTE = "/settings/account";
export const SETTINGS_HELP_ROUTE = "/settings/help";
export const SETTINGS_CONNECTORS_ROUTE = "/settings/connectors";
export const SETTINGS_AI_ROUTE = "/settings/ai";
export const SETTINGS_BILLING_ROUTE = "/settings/billing";
export const SETTINGS_BILLING_CHANGE_PLAN_ROUTE = "/settings/billing/change-plan";
export const SETTINGS_BILLING_CONFIRMATION_ROUTE = "/settings/billing/confirmation";
export const TEAM_INVITE_BASE_ROUTE = "/team-invite";

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
export const ORG_TEAM_ROUTE = (teamId: string) => `/org/teams/${teamId}`;
export const TEAM_ROUTE = (teamId: string) => `/teams/${teamId}`;
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
