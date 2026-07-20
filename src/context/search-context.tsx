"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GlobalSearchModal, type SearchResult } from "@/components/GlobalSearchModal";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { usePinboard } from "@/context/pinboard-context";
import { fetchPersonas, fetchPersonaChats } from "@/lib/api/personas";
import type { Persona, PersonaChat } from "@/lib/api/personas";
import { listBrainChats } from "@/lib/api/brain";
import type { BrainChatListItem } from "@/lib/api/brain";
import {
  CHAT_ROUTE,
  CHATS_ROUTE,
  PROJECTS_ROUTE,
  PROJECTS_NEW_ROUTE,
  AGENTS_ROUTE,
  BRAIN_ROUTE,
  BRAIN_THREADS_ROUTE,
  BRAIN_SCHEDULES_ROUTE,
  SETTINGS_ACCOUNT_ROUTE,
  SETTINGS_BILLING_ROUTE,
  SETTINGS_AI_ROUTE,
  SETTINGS_CONNECTORS_ROUTE,
  SETTINGS_HELP_ROUTE,
  ORG_GENERAL_ROUTE,
  ORG_MEMBERS_ROUTE,
  ORG_TEAMS_ROUTE,
  ORG_PLANS_ROUTE,
  ORG_ANALYTICS_ROUTE,
  ORG_CONNECTORS_ROUTE,
  ORG_SOUVENIR_SLACK_ROUTE,
  ORG_ACTIVITY_ROUTE,
  PROJECT_ROUTE,
  PROJECT_CHAT_ROUTE,
  AGENT_CHAT_ROUTE,
} from "@/lib/routes";
import { trackFeature } from "@/lib/analytics/events";

// A chat with a persona/agent, tagged with which persona owns it — mirrors
// the shape `RecentAgentChatsSection` in LeftSidebar.tsx builds for the same
// "all agent chats across all personas" purpose.
type AgentChat = PersonaChat & { personaId: string };

// ── Navigable destinations ────────────────────────────────────────────────────

interface NavPage {
  id:       string;
  title:    string;
  subtitle: string;
  route:    string;
  keywords: string;
}

const NAV_PAGES: NavPage[] = [
  { id: "page-chats",         title: "Chat Board",       subtitle: "All chats",   route: CHATS_ROUTE,               keywords: "chats history conversations board recents" },
  { id: "page-projects",      title: "Projects",         subtitle: "Workspaces",  route: PROJECTS_ROUTE,            keywords: "projects folders workspaces" },
  { id: "page-projects-new",  title: "New Project",      subtitle: "Projects",    route: PROJECTS_NEW_ROUTE,        keywords: "new project create workspace" },
  { id: "page-personas",      title: "Agents",           subtitle: "AI agents",   route: AGENTS_ROUTE,              keywords: "personas agents assistants bots ai" },
  { id: "page-brain",         title: "Brain",            subtitle: "Knowledge",   route: BRAIN_ROUTE,               keywords: "brain knowledge agent memory context" },
  { id: "page-brain-threads", title: "Brain Threads",    subtitle: "Brain",       route: BRAIN_THREADS_ROUTE,       keywords: "brain threads history conversations" },
  { id: "page-schedules",     title: "Schedules",        subtitle: "Brain",       route: BRAIN_SCHEDULES_ROUTE,     keywords: "schedules scheduled tasks automation cron jobs brain" },
  { id: "page-org-general",   title: "General",          subtitle: "Organization", route: ORG_GENERAL_ROUTE,        keywords: "organization org settings general" },
  { id: "page-org-members",   title: "Members",          subtitle: "Organization", route: ORG_MEMBERS_ROUTE,        keywords: "organization org members people users invite" },
  { id: "page-org-teams",     title: "Teams",            subtitle: "Organization", route: ORG_TEAMS_ROUTE,          keywords: "organization org teams" },
  { id: "page-org-plans",     title: "Plans & Usage",    subtitle: "Organization", route: ORG_PLANS_ROUTE,          keywords: "organization org plans usage billing credits" },
  { id: "page-org-analytics", title: "Analytics",        subtitle: "Organization", route: ORG_ANALYTICS_ROUTE,      keywords: "organization org analytics usage insights" },
  { id: "page-org-connectors", title: "Connectors",      subtitle: "Organization", route: ORG_CONNECTORS_ROUTE,     keywords: "organization org connectors integrations tools mcp" },
  { id: "page-org-slack",     title: "Souvenir in Slack", subtitle: "Organization", route: ORG_SOUVENIR_SLACK_ROUTE, keywords: "organization org slack integration" },
  { id: "page-org-activity",  title: "Activity Log",     subtitle: "Organization", route: ORG_ACTIVITY_ROUTE,       keywords: "organization org activity log audit" },
  { id: "page-account",       title: "Account",          subtitle: "Settings",    route: SETTINGS_ACCOUNT_ROUTE,    keywords: "account profile settings me user" },
  { id: "page-billing",       title: "Usage & Billing",  subtitle: "Settings",    route: SETTINGS_BILLING_ROUTE,    keywords: "billing usage payment subscription invoice plan credits cost" },
  { id: "page-ai",            title: "AI & Models",      subtitle: "Settings",    route: SETTINGS_AI_ROUTE,         keywords: "ai models llm settings default model" },
  { id: "page-connectors",    title: "Connectors",       subtitle: "Settings",    route: SETTINGS_CONNECTORS_ROUTE, keywords: "connectors integrations tools apps mcp" },
  { id: "page-help",          title: "Help & Legal",     subtitle: "Settings",    route: SETTINGS_HELP_ROUTE,       keywords: "help legal support docs terms privacy faq" },
];

// ── Context ───────────────────────────────────────────────────────────────────

interface SearchContextValue {
  searchOpen: boolean;
  openSearch: () => void;
}

const SearchContext = createContext<SearchContextValue>({
  searchOpen: false,
  openSearch: () => {},
});

export function useSearch() {
  return useContext(SearchContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const { push } = useRouter();
  const chatHistory = useChatHistoryContext();
  const { chats: projectChats, projects } = useProjects();
  const { pins, openForChat: openPinboardForChat, open: openPinboard } = usePinboard();

  const [searchOpen,     setSearchOpen]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchPersonas, setSearchPersonas] = useState<Persona[]>([]);
  const [agentChats,     setAgentChats]     = useState<AgentChat[]>([]);
  const [brainThreads,   setBrainThreads]   = useState<BrainChatListItem[]>([]);

  const openSearch = useCallback(() => {
    trackFeature("search");
    setSearchOpen(true);
  }, []);

  // Cmd/Ctrl+K opens search from anywhere in the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openSearch]);

  // Lazy-load personas + this user's agent chats (across all personas) + Brain
  // threads the first time search opens (mirrors RecentAgentChatsSection's
  // fetch-all-personas-then-fetch-each-persona's-chats pattern in LeftSidebar).
  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;

    fetchPersonas()
      .then(personaList => {
        if (cancelled) return;
        setSearchPersonas(personaList);
        return Promise.all(
          personaList.map(p =>
            fetchPersonaChats(p.id)
              .then(chats => chats.map(c => ({ ...c, personaId: p.id })))
              .catch(() => [] as AgentChat[]),
          ),
        );
      })
      .then(chatLists => { if (!cancelled && chatLists) setAgentChats(chatLists.flat()); })
      .catch(() => { /* search still works without agents/agent chats */ });

    listBrainChats()
      .then(threads => { if (!cancelled) setBrainThreads(threads); })
      .catch(() => { /* search still works without brain threads */ });

    return () => { cancelled = true; };
  }, [searchOpen]);

  const projectChatIdSet = useMemo(
    () => new Set(projectChats.map(c => c.id)),
    [projectChats],
  );

  const projectNameById = useMemo(
    () => new Map(projects.map(p => [p.id, p.name])),
    [projects],
  );

  const personaNameById = useMemo(
    () => new Map(searchPersonas.map(p => [p.id, p.name])),
    [searchPersonas],
  );

  // Every chat-like title the app knows about right now — used to resolve a
  // pin's parent chat name across ALL sources (regular chats, project chats,
  // agent chats, Brain threads), since `PinItem.chatName` is never actually
  // populated by the backend/pinboard-context.
  const chatNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of chatHistory.chats) map.set(c.id, c.title || 'Untitled chat');
    for (const c of projectChats) map.set(c.id, c.title || 'Untitled chat');
    for (const c of agentChats) map.set(c.id, c.title || 'Untitled chat');
    for (const t of brainThreads) map.set(t.id, t.chat_title || 'Untitled thread');
    return map;
  }, [chatHistory.chats, projectChats, agentChats, brainThreads]);

  // Last 5 non-project chats shown when search query is empty
  const searchRecents = useMemo<SearchResult[]>(() => {
    return chatHistory.chats
      .filter(c => !projectChatIdSet.has(c.id))
      .slice(0, 5)
      .map(c => ({ id: c.id, type: 'chat' as const, title: c.title || 'Untitled chat' }));
  }, [chatHistory.chats, projectChatIdSet]);

  // Full search — chats, project chats, agent chats, Brain threads, projects,
  // personas, pins, nav pages
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();

    const chatResults: SearchResult[] = chatHistory.chats
      .filter(c => (c.title || '').toLowerCase().includes(q))
      .slice(0, 20)
      .map(c => ({ id: c.id, type: 'chat' as const, title: c.title || 'Untitled chat' }));

    const projectChatResults: SearchResult[] = projectChats
      .filter(c => c.title.toLowerCase().includes(q))
      .slice(0, 20)
      .map(c => {
        const projectName = projectNameById.get(c.projectId);
        return { id: c.id, type: 'chat' as const, title: c.title || 'Untitled chat', subtitle: projectName ? `in ${projectName}` : undefined };
      });

    const agentChatResults: SearchResult[] = agentChats
      .filter(c => (c.title || '').toLowerCase().includes(q))
      .slice(0, 20)
      .map(c => {
        const personaName = personaNameById.get(c.personaId);
        return { id: c.id, type: 'agent-chat' as const, title: c.title || 'Untitled chat', subtitle: personaName ? `with ${personaName}` : undefined };
      });

    const brainThreadResults: SearchResult[] = brainThreads
      .filter(t => (t.chat_title || '').toLowerCase().includes(q))
      .slice(0, 20)
      .map(t => ({ id: t.id, type: 'brain-thread' as const, title: t.chat_title || 'Untitled thread' }));

    const projectResults: SearchResult[] = projects
      .filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .slice(0, 10)
      .map(p => ({ id: p.id, type: 'project' as const, title: p.name, subtitle: p.description || undefined }));

    const personaResults: SearchResult[] = searchPersonas
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)),
      )
      .slice(0, 10)
      .map(p => ({ id: p.id, type: 'persona' as const, title: p.name, subtitle: p.handle || undefined }));

    const pinResults: SearchResult[] = pins
      .filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.content || '').toLowerCase().includes(q) ||
        (p.tags ?? []).some(t => t.toLowerCase().includes(q)),
      )
      .slice(0, 10)
      .map(p => {
        const chatName = (p.chatId ? chatNameById.get(p.chatId) : undefined) ?? p.chatName;
        return {
          id:       p.id,
          type:     'pin' as const,
          title:    p.title || 'Untitled pin',
          subtitle: chatName ? `in ${chatName}` : undefined,
        };
      });

    const pageResults: SearchResult[] = NAV_PAGES
      .filter(pg =>
        pg.title.toLowerCase().includes(q) ||
        pg.subtitle.toLowerCase().includes(q) ||
        pg.keywords.includes(q),
      )
      .map(pg => ({ id: pg.id, type: 'page' as const, title: pg.title, subtitle: pg.subtitle }));

    return [
      ...chatResults, ...projectChatResults,
      ...agentChatResults, ...brainThreadResults,
      ...projectResults, ...personaResults,
      ...pinResults, ...pageResults,
    ];
  }, [
    searchQuery, chatHistory.chats, projectChats, agentChats, brainThreads,
    projects, searchPersonas, pins, projectNameById, personaNameById, chatNameById,
  ]);

  const handleSelect = useCallback((result: SearchResult) => {
    setSearchOpen(false);
    switch (result.type) {
      case 'chat': {
        const projectChat = projectChats.find(c => c.id === result.id);
        if (projectChat) push(PROJECT_CHAT_ROUTE(projectChat.projectId, projectChat.id));
        else push(`${CHAT_ROUTE}?id=${result.id}`);
        break;
      }
      case 'agent-chat': {
        const agentChat = agentChats.find(c => c.id === result.id);
        if (agentChat) push(`${AGENT_CHAT_ROUTE(agentChat.personaId)}?chatId=${agentChat.id}`);
        break;
      }
      case 'brain-thread': push(`${BRAIN_ROUTE}?id=${result.id}`); break;
      case 'project': push(PROJECT_ROUTE(result.id));        break;
      case 'persona': push(AGENT_CHAT_ROUTE(result.id));     break;
      case 'pin': {
        const pin = pins.find(p => p.id === result.id);
        if (pin?.chatId) { push(`${CHAT_ROUTE}?id=${pin.chatId}`); openPinboardForChat(pin.chatId); }
        else openPinboard();
        break;
      }
      case 'page': {
        const page = NAV_PAGES.find(p => p.id === result.id);
        if (page) push(page.route);
        break;
      }
    }
  }, [push, pins, projectChats, agentChats, openPinboardForChat, openPinboard]);

  return (
    <SearchContext.Provider value={{ searchOpen, openSearch }}>
      {children}
      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSelect}
        onQuery={setSearchQuery}
        results={searchResults}
        recents={searchRecents}
      />
    </SearchContext.Provider>
  );
}
