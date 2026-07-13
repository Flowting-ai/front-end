// Route → screen-name mapping for Layer 1 (screen_viewed). Names are CONCEPTS, not
// routes: a redesign keeps the name and re-points the mapping here. If a screen isn't
// covered, it returns null (no event fires) — surfaced in dev so gaps are visible.
//
// Reconciled against the real App Router routes (some diverge from the doc's registry:
// e.g. /settings/account → settings_profile, /settings/ai → settings_models, several
// extra settings tabs, /slack/link, /agents/basics/* wizard). Pinboard is a panel, not
// a route, so it is tracked as an event property later, not as a screen here.

import type { ScreenName } from "./events";

function settingsScreen(tab: string | undefined): ScreenName | null {
  switch (tab) {
    case undefined:          // /settings → home defaults to the profile tab
    case "account":
      return "settings_profile";
    case "connectors":
      return "settings_connectors";
    case "ai":
      return "settings_models";
    case "billing":
      return "settings_billing";
    case "help":
      return "settings_help";
    case "files":
      return "settings_files";
    case "preferences":
      return "settings_preferences";
    case "notifications":
      return "settings_notifications";
    case "security":
      return "settings_security";
    default:
      return null;
  }
}

function onboardingScreen(segments: string[]): ScreenName {
  const step = segments[1];
  if (!step) return "onboarding_start";
  // Team-invite join flow (and its sub-steps) collapse to a single concept.
  if (step === "team") return "onboarding_team_join";
  // Normalize route-name punctuation to snake_case (e.g. account-type → account_type).
  const normalized = step.replace(/-/g, "_").replace(/[^a-z0-9_]/gi, "");
  return `onboarding_${normalized}`;
}

/**
 * Map an App Router pathname to a stable screen concept, or null if the route is
 * intentionally/unknowingly untracked.
 */
export function routeToScreen(pathname: string): ScreenName | null {
  const path = pathname.replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  const root = segments[0];

  switch (root) {
    case undefined:
      return null; // "/" — landing/redirect, not a tracked screen
    case "chat":
      return "chat";
    case "chats":
      return "chat_history";
    case "brain":
      return "brain"; // + /brain/chats|threads|schedules
    case "agent":
      // Singular: /agent/configure and its tabs.
      return segments[1] === "configure" ? "agent_configure" : null;
    case "agents":
      if (segments[1] === "basics") return "agent_onboarding"; // new-agent wizard steps
      if (segments[2] === "chat") return "chat"; // /agents/[personaId]/chat
      return "agent_library"; // /agents, /agents/templates, /agents/published, /agents/new
    case "projects":
      return "projects";
    case "project":
      // /project/[id]/chat/[chatId] is a chat surface; the project root is the detail view.
      return segments[2] === "chat" ? "chat" : "project_detail";
    case "teams":
      return "teams";
    case "org":
      return "org_manage"; // all /org/* admin tabs collapse to one concept
    case "settings":
      return settingsScreen(segments[1]);
    case "onboarding":
      return onboardingScreen(segments);
    case "welcome":
      return "welcome";
    case "slack":
      return "slack_setup"; // /slack/link
    case "share":
    case "chat-shares":
      return "share_view";
    default:
      return null;
  }
}
