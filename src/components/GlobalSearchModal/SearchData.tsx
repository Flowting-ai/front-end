"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlobalSearchModal, type SearchResult } from "@/components/GlobalSearchModal";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { usePinboard } from "@/context/pinboard-context";
import { PINS_ENABLED } from "@/lib/feature-flags";
import { fetchAgentChatsFor, fetchPersonas, isDraftPersona } from "@/lib/api/personas";
import type { AgentChat, Persona } from "@/lib/api/personas";
import { buildSearchIndex, parseStoredRecents, recentChats, recentsWithOpened, rememberOpened, searchIndex, type NavPage } from "@/lib/search/global-search";
import { SEARCH_RECENT_OPENED_KEY } from "@/lib/storage-keys";
import { trackFeature } from "@/lib/analytics/events";
import {
  CHAT_ROUTE,
  CHATS_ROUTE,
  PROJECTS_ROUTE,
  PROJECTS_NEW_ROUTE,
  AGENTS_ROUTE,
  SCHEDULES_ROUTE,
  SETTINGS_ACCOUNT_ROUTE,
  SETTINGS_HELP_ROUTE,
  ORG_GENERAL_ROUTE,
  ORG_MEMBERS_ROUTE,
  ORG_PLANS_ROUTE,
  ORG_ANALYTICS_ROUTE,
  ORG_CONNECTORS_ROUTE,
  ORG_SOUVENIR_SLACK_ROUTE,
  ORG_ACTIVITY_ROUTE,
  PROJECT_ROUTE,
  PROJECT_CHAT_ROUTE,
  AGENT_CHAT_ROUTE,
} from "@/lib/routes";

// ── Navigable destinations ────────────────────────────────────────────────────

const NAV_PAGES: NavPage[] = [
  { id: "page-chats",         title: "Chat Board",       subtitle: "All chats",   route: CHATS_ROUTE,               keywords: "chats history conversations board recents" },
  { id: "page-projects",      title: "Projects",         subtitle: "Workspaces",  route: PROJECTS_ROUTE,            keywords: "projects folders workspaces" },
  { id: "page-projects-new",  title: "New Project",      subtitle: "Projects",    route: PROJECTS_NEW_ROUTE,        keywords: "new project create workspace" },
  { id: "page-personas",      title: "Agents",           subtitle: "AI agents",   route: AGENTS_ROUTE,              keywords: "personas agents assistants bots ai" },
  { id: "page-schedules",     title: "Schedules",        subtitle: "Automation",  route: SCHEDULES_ROUTE,           keywords: "schedules scheduled tasks automation cron jobs" },
  { id: "page-org-general",   title: "General",          subtitle: "Organization", route: ORG_GENERAL_ROUTE,        keywords: "organization org settings general" },
  { id: "page-org-members",   title: "Members",          subtitle: "Organization", route: ORG_MEMBERS_ROUTE,        keywords: "organization org members people users invite" },
  { id: "page-org-plans",     title: "Plan & Billing",   subtitle: "Settings",    route: ORG_PLANS_ROUTE,          keywords: "organization org plans usage billing payment subscription invoice credits cost" },
  { id: "page-org-analytics", title: "Analytics",        subtitle: "Organization", route: ORG_ANALYTICS_ROUTE,      keywords: "organization org analytics usage insights" },
  { id: "page-org-connectors", title: "Connectors",      subtitle: "Organization", route: ORG_CONNECTORS_ROUTE,     keywords: "organization org connectors integrations tools mcp" },
  { id: "page-org-slack",     title: "Souvenir in Slack", subtitle: "Organization", route: ORG_SOUVENIR_SLACK_ROUTE, keywords: "organization org slack integration" },
  { id: "page-org-activity",  title: "Activity Log",     subtitle: "Organization", route: ORG_ACTIVITY_ROUTE,       keywords: "organization org activity log audit" },
  { id: "page-account",       title: "Account",          subtitle: "Settings",    route: SETTINGS_ACCOUNT_ROUTE,    keywords: "account profile settings me user" },
  { id: "page-help",          title: "Help & Legal",     subtitle: "Settings",    route: SETTINGS_HELP_ROUTE,       keywords: "help legal support docs terms privacy faq" },
];

interface AgentData {
  personas: Persona[];
  chats:    AgentChat[];
  /** Some or all agent chat lists failed to load. */
  partial:  boolean;
}

/**
 * Everything global search reads. Mounted by SearchProvider only after search
 * is first opened, so the app shell neither loads this code nor re-renders on
 * chat/project/pin changes until then.
 */
export default function SearchData({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { push } = useRouter();
  const chatHistory = useChatHistoryContext();
  const { chats: projectChats, projects } = useProjects();
  const { pins, openForChat: openPinboardForChat, open: openPinboard } = usePinboard();

  const [query,     setQuery]     = useState("");
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  // Results opened before, newest first (this component only mounts in the browser).
  const [opened, setOpened] = useState<SearchResult[]>(() => {
    try { return parseStoredRecents(localStorage.getItem(SEARCH_RECENT_OPENED_KEY)); } catch { return []; }
  });
  // Typing stays responsive with a long chat list: results follow at lower priority.
  const deferredQuery = useDeferredValue(query);

  // Agents and their chats, refreshed on each open. Both requests are cached
  // and de-duplicated in lib/api (shared with the sidebar), so a reopen within
  // the TTL costs nothing. Those requests are shared, so closing doesn't abort
  // them; it only drops their results.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchPersonas()
      .then(async personas => {
        const { chats, failed } = await fetchAgentChatsFor(personas);
        if (!cancelled) setAgentData({ personas, chats, partial: failed > 0 });
      })
      .catch((err: unknown) => {
        console.error("[search] failed to load agents", err);
        if (!cancelled) setAgentData(prev => ({ personas: prev?.personas ?? [], chats: prev?.chats ?? [], partial: true }));
      });
    return () => { cancelled = true; };
  }, [open]);

  const projectChatIdSet = useMemo(() => new Set(projectChats.map(c => c.id)), [projectChats]);

  // Lower-cased once per change of the sources, and only while open.
  const index = useMemo(() => open ? buildSearchIndex({
    chats:        chatHistory.chats,
    projectChats,
    agentChats:   agentData?.chats ?? [],
    projects,
    personas:     (agentData?.personas ?? []).map(p => ({ ...p, draft: isDraftPersona(p) })),
    pins:         PINS_ENABLED ? pins : [],
    pages:        NAV_PAGES,
  }) : null, [open, chatHistory.chats, projectChats, agentData, projects, pins]);

  const results = useMemo(() => index ? searchIndex(index, deferredQuery) : [], [index, deferredQuery]);
  // Recently opened results that still exist, then the latest chats.
  const recents = useMemo(
    () => open && index ? recentsWithOpened(index, opened, recentChats(chatHistory.chats, projectChatIdSet)) : [],
    [open, index, opened, chatHistory.chats, projectChatIdSet],
  );

  // Chat titles are searched in what the sidebar has loaded (there is no
  // search endpoint yet); say so, and offer the next page.
  const searchingLoadedOnly = query.trim().length > 0 && chatHistory.hasMore;
  const notice = agentData === null
    ? "Loading agent chats…"
    : agentData.partial ? "Some agent chats couldn't be loaded, so results may be incomplete."
    : searchingLoadedOnly ? `Searched your ${chatHistory.chats.length} most recent chats.` : undefined;
  const noticeAction = agentData !== null && !agentData.partial && searchingLoadedOnly
    ? { label: "Search older chats", onClick: chatHistory.loadMore, busy: chatHistory.isLoading }
    : undefined;

  const handleSelect = useCallback((result: SearchResult) => {
    trackFeature("search_result_opened", { result_type: result.type, had_query: query.trim().length > 0 });
    const nextOpened = rememberOpened(opened, result);
    setOpened(nextOpened);
    try { localStorage.setItem(SEARCH_RECENT_OPENED_KEY, JSON.stringify(nextOpened)); } catch { /* storage unavailable */ }
    onClose();
    switch (result.type) {
      case "chat": {
        const projectChat = projectChats.find(c => c.id === result.id);
        if (projectChat) push(PROJECT_CHAT_ROUTE(projectChat.projectId, projectChat.id));
        else push(`${CHAT_ROUTE}?id=${result.id}`);
        break;
      }
      case "agent-chat": {
        const agentChat = agentData?.chats.find(c => c.id === result.id);
        if (agentChat) push(`${AGENT_CHAT_ROUTE(agentChat.personaId)}?chatId=${agentChat.id}`);
        else {
          // The agent list changed since the results were built (chat or agent removed).
          toast.error("That chat is no longer available.");
          push(AGENTS_ROUTE);
        }
        break;
      }
      case "project": push(PROJECT_ROUTE(result.id));    break;
      case "persona": push(AGENT_CHAT_ROUTE(result.id)); break;
      case "pin": {
        if (!PINS_ENABLED) break;
        const pin = pins.find(p => p.id === result.id);
        if (pin?.chatId) { push(`${CHAT_ROUTE}?id=${pin.chatId}`); openPinboardForChat(pin.chatId); }
        else openPinboard();
        break;
      }
      case "page": {
        const page = NAV_PAGES.find(p => p.id === result.id);
        if (page) push(page.route);
        break;
      }
    }
  }, [query, opened, onClose, push, pins, projectChats, agentData, openPinboardForChat, openPinboard]);

  return (
    <GlobalSearchModal
      open={open}
      onClose={onClose}
      onSelect={handleSelect}
      onQuery={setQuery}
      results={results}
      recents={recents}
      notice={notice}
      noticeAction={noticeAction}
    />
  );
}
