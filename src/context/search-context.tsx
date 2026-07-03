"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GlobalSearchModal, type SearchResult } from "@/components/GlobalSearchModal";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { usePinboard } from "@/context/pinboard-context";
import { fetchPersonas } from "@/lib/api/personas";
import type { Persona } from "@/lib/api/personas";
import {
  CHAT_ROUTE,
  CHATS_ROUTE,
  PROJECTS_ROUTE,
  AGENTS_ROUTE,
  BRAIN_ROUTE,
  BRAIN_SCHEDULES_ROUTE,
  SETTINGS_ACCOUNT_ROUTE,
  SETTINGS_BILLING_ROUTE,
  SETTINGS_AI_ROUTE,
  SETTINGS_CONNECTORS_ROUTE,
  SETTINGS_HELP_ROUTE,
  PROJECT_ROUTE,
  AGENT_CHAT_ROUTE,
} from "@/lib/routes";

// ── Navigable destinations ────────────────────────────────────────────────────

interface NavPage {
  id:       string;
  title:    string;
  subtitle: string;
  route:    string;
  keywords: string;
}

const NAV_PAGES: NavPage[] = [
  { id: "page-chats",      title: "Chat Board",      subtitle: "All chats",   route: CHATS_ROUTE,               keywords: "chats history conversations board recents" },
  { id: "page-projects",   title: "Projects",        subtitle: "Workspaces",  route: PROJECTS_ROUTE,            keywords: "projects folders workspaces" },
  { id: "page-personas",   title: "Agents",          subtitle: "AI agents",   route: AGENTS_ROUTE,              keywords: "personas agents assistants bots ai" },
  { id: "page-brain",      title: "Brain",           subtitle: "Knowledge",   route: BRAIN_ROUTE,               keywords: "brain knowledge agent memory context" },
  { id: "page-schedules",  title: "Schedules",       subtitle: "Brain",       route: BRAIN_SCHEDULES_ROUTE,     keywords: "schedules scheduled tasks automation cron jobs brain" },
  { id: "page-account",    title: "Account",         subtitle: "Settings",    route: SETTINGS_ACCOUNT_ROUTE,    keywords: "account profile settings me user" },
  { id: "page-billing",    title: "Usage & Billing", subtitle: "Settings",    route: SETTINGS_BILLING_ROUTE,    keywords: "billing usage payment subscription invoice plan credits cost" },
  { id: "page-ai",         title: "AI & Models",     subtitle: "Settings",    route: SETTINGS_AI_ROUTE,         keywords: "ai models llm settings default model" },
  { id: "page-connectors", title: "Connectors",      subtitle: "Settings",    route: SETTINGS_CONNECTORS_ROUTE, keywords: "connectors integrations tools apps mcp" },
  { id: "page-help",       title: "Help & Legal",    subtitle: "Settings",    route: SETTINGS_HELP_ROUTE,       keywords: "help legal support docs terms privacy faq" },
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

  const openSearch = useCallback(() => setSearchOpen(true), []);

  // Cmd/Ctrl+K opens search from anywhere in the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lazy-load personas the first time search opens (30s-cached, deduplicated)
  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    fetchPersonas()
      .then(p => { if (!cancelled) setSearchPersonas(p); })
      .catch(() => { /* search still works without personas */ });
    return () => { cancelled = true; };
  }, [searchOpen]);

  const projectChatIdSet = useMemo(
    () => new Set(projectChats.map(c => c.id)),
    [projectChats],
  );

  // Last 5 non-project chats shown when search query is empty
  const searchRecents = useMemo<SearchResult[]>(() => {
    return chatHistory.chats
      .filter(c => !projectChatIdSet.has(c.id))
      .slice(0, 5)
      .map(c => ({ id: c.id, type: 'chat' as const, title: c.title || 'Untitled chat' }));
  }, [chatHistory.chats, projectChatIdSet]);

  // Full search — chats, projects, personas, pins, nav pages
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();

    const chatResults: SearchResult[] = chatHistory.chats
      .filter(c => (c.title || '').toLowerCase().includes(q))
      .slice(0, 20)
      .map(c => ({ id: c.id, type: 'chat' as const, title: c.title || 'Untitled chat' }));

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
      .map(p => ({
        id:       p.id,
        type:     'pin' as const,
        title:    p.title || 'Untitled pin',
        subtitle: p.chatName ? `in ${p.chatName}` : undefined,
      }));

    const pageResults: SearchResult[] = NAV_PAGES
      .filter(pg =>
        pg.title.toLowerCase().includes(q) ||
        pg.subtitle.toLowerCase().includes(q) ||
        pg.keywords.includes(q),
      )
      .map(pg => ({ id: pg.id, type: 'page' as const, title: pg.title, subtitle: pg.subtitle }));

    return [...chatResults, ...projectResults, ...personaResults, ...pinResults, ...pageResults];
  }, [searchQuery, chatHistory.chats, projects, searchPersonas, pins]);

  const handleSelect = useCallback((result: SearchResult) => {
    setSearchOpen(false);
    switch (result.type) {
      case 'chat':    push(`${CHAT_ROUTE}?id=${result.id}`); break;
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
  }, [push, pins, openPinboardForChat, openPinboard]);

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
