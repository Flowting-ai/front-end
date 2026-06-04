"use client";

import React, { useCallback, useRef, useMemo, useState, useEffect, Suspense } from "react";
import { m } from "framer-motion";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { FolderAddIcon, MoreHorizontalIcon, PlusSignIcon } from "@strange-huge/icons";
import { Sidebar, SidebarMenuItem, SidebarMenuSkeleton, SidebarProjectsSection } from "@/components/ui";
import { AccountMenu } from "@/components/AccountMenu";
import { useAuth } from "@/context/auth-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { usePinboard } from "@/context/pinboard-context";
import { fetchPersonas, fetchPersonaChats, renamePersonaChat, deletePersonaChat } from "@/lib/api/personas";
import type { Persona, PersonaChat } from "@/lib/api/personas";
import type { PersonaChatEventDetail } from "@/hooks/use-sidebar-events";
import { ChatHistoryItem } from "./ChatHistoryItem";
import { openDeleteChatDialog } from "./AppDialogs";
import type { UseChatHistoryResult } from "@/hooks/use-chat-history";
import type { ProjectChat } from "@/context/projects-context";
import { GlobalSearchModal, type SearchResult } from "@/components/GlobalSearchModal";
import { toast } from "sonner";

// ── Collapse state persistence ────────────────────────────────────────────────

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sidebar_collapsed") === "true";
}

// ── Navigable destinations for global search ──────────────────────────────────
// Static "pages" surfaced in search so users can jump anywhere in the app — not
// just to chats/projects. `keywords` widens matching beyond the visible label
// (e.g. "subscription" → Usage & Billing). Only enabled routes are listed; keep
// in sync with the nav in SettingsSidebar / the sidebar's section buttons.

interface NavPage {
  id:        string;
  title:     string;
  subtitle:  string;
  route:     string;
  keywords:  string;
}

const NAV_PAGES: NavPage[] = [
  { id: "page-chats",      title: "Chat Board",      subtitle: "All chats",      route: "/chats",               keywords: "chats history conversations board recents" },
  { id: "page-projects",   title: "Projects",        subtitle: "Workspaces",     route: "/projects",            keywords: "projects folders workspaces" },
  { id: "page-personas",   title: "Agents",          subtitle: "AI agents",      route: "/personas",            keywords: "personas agents assistants bots ai" },
  { id: "page-brain",      title: "Brain",           subtitle: "Knowledge",      route: "/brain",               keywords: "brain knowledge agent memory context" },
  { id: "page-schedules",  title: "Schedules",       subtitle: "Brain",          route: "/brain/schedules",     keywords: "schedules scheduled tasks automation cron jobs brain" },
  { id: "page-account",    title: "Account",         subtitle: "Settings",       route: "/settings/account",    keywords: "account profile settings me user" },
  { id: "page-billing",    title: "Usage & Billing", subtitle: "Settings",       route: "/settings/billing",    keywords: "billing usage payment subscription invoice plan credits cost" },
  { id: "page-ai",         title: "AI & Models",     subtitle: "Settings",       route: "/settings/ai",         keywords: "ai models llm settings default model" },
  { id: "page-connectors", title: "Connectors",      subtitle: "Settings",       route: "/settings/connectors", keywords: "connectors integrations tools apps mcp" },
  { id: "page-help",       title: "Help & Legal",    subtitle: "Settings",       route: "/settings/help",       keywords: "help legal support docs terms privacy faq" },
];

// ── Section show/hide animation - matches Sidebar design system ───────────────

const sectionHeightVariants = {
  open: {
    height: "auto" as const,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const },
  },
  closed: {
    height: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const, delay: 0.14 },
  },
};

// ── Shared section props ──────────────────────────────────────────────────────

interface SectionProps {
  activeChatId?: string;
  onSelectChat: (id: string) => void;
  chatHistory: UseChatHistoryResult;
}

// ── Starred section ───────────────────────────────────────────────────────────

function StarredSection({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");

  const starredChats = chatHistory.chats.filter((c) => c.starred);

  // Don't render the section at all when no chats are starred.
  // Component remounts next time a chat is starred → shown resets to true.
  if (starredChats.length === 0) return null;

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Starred"
        shown={shown}
        onShowClick={() => setShown((s) => !s)}
      />
      <m.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden"); }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible"); }}
      >
        <div
          style={{
            paddingTop: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {starredChats.map((chat) => (
            <ChatHistoryItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onSelect={onSelectChat}
              onRename={chatHistory.rename}
              onDelete={chatHistory.remove}
              onStar={chatHistory.star}
            />
          ))}
        </div>
      </m.div>
    </>
  );
}

// ── Recents list ──────────────────────────────────────────────────────────────

function RecentsList({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const { chats, isLoading, hasMore, loadMore, rename, remove, star } = chatHistory;

  // Suppress hydration mismatch: the server always renders with isLoading=false,
  // so defer the loading skeleton until after mount so the first client render
  // matches the server output.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const loading = mounted && isLoading;

  if (loading && chats.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          padding: "4px 0",
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <SidebarMenuSkeleton key={i} fluid />
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div
        style={{
          padding: "8px 6px",
          fontFamily: "var(--font-body)",
          fontSize: "var(--font-size-caption)",
          color: "var(--neutral-400)",
        }}
      >
        No chats yet
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {chats.map((chat) => (
        <ChatHistoryItem
          key={chat.id}
          chat={chat}
          isActive={chat.id === activeChatId}
          onSelect={onSelectChat}
          onRename={rename}
          onDelete={remove}
          onStar={star}
        />
      ))}
      {hasMore && (
        <SidebarMenuItem
          fluid
          variant="default"
          label="Load more"
          onClick={loadMore}
        />
      )}
    </div>
  );
}

// ── Recents section - header with show/hide + animated collapse ───────────────

function RecentsSection(props: SectionProps) {
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Recents"
        shown={shown}
        onShowClick={() => setShown((s) => !s)}
      />
      <m.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden"); }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible"); }}
      >
        <div style={{ paddingTop: "4px" }}>
          <RecentsList {...props} />
        </div>
      </m.div>
    </>
  );
}

// ── Shared dropdown item styles ────────────────────────────────────────────────

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "7px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontWeight: "var(--font-weight-medium)",
  fontSize: "var(--font-size-body)",
  lineHeight: "var(--line-height-body)",
  color: "var(--neutral-700)",
  outline: "none",
  userSelect: "none",
}

const menuItemDestructiveStyle: React.CSSProperties = {
  ...menuItemStyle,
  color: "var(--red-500)",
}

// ── ProjectChatItem - sidebar project chat row with rename/delete menu ─────────

interface ProjectChatItemProps {
  chat:     ProjectChat
  isActive: boolean
  onSelect: () => void
  onRename: (chatId: string, title: string) => Promise<void>
  onDelete: (chatId: string) => void
}

function ProjectChatItem({ chat, isActive, onSelect, onRename, onDelete }: ProjectChatItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const triggerRef       = useRef<HTMLButtonElement>(null)
  const pendingRenameRef = useRef(false)

  const handleCommit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== chat.title) void onRename(chat.id, trimmed)
    setIsEditing(false)
  }

  const handleMoreClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation()
    setMenuOpen(true)
  }

  const handleDelete = () => {
    openDeleteChatDialog({
      chatId:    chat.id,
      chatTitle: chat.title,
      onConfirm: async () => onDelete(chat.id),
    })
  }

  return (
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <div style={{ position: "relative", width: "100%" }}>
        <SidebarMenuItem
          fluid
          variant={isEditing ? "chat-item-edit" : "chat-item"}
          label={chat.title}
          selected={isActive}
          onClick={() => { if (!isEditing) onSelect() }}
          onMoreClick={handleMoreClick}
          onRename={() => setIsEditing(true)}
          onCommit={handleCommit}
          onCancel={() => setIsEditing(false)}
        />
        <DropdownMenu.Trigger
          ref={triggerRef}
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
            border: "none",
            background: "none",
            padding: 0,
          }}
        />
      </div>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(e) => {
            if (pendingRenameRef.current) {
              e.preventDefault()
              pendingRenameRef.current = false
            }
          }}
          style={{
            backgroundColor: "var(--neutral-white)",
            borderRadius: "12px",
            padding: "4px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
            zIndex: 5,
            minWidth: "168px",
            outline: "none",
          }}
        >
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => { pendingRenameRef.current = true; setIsEditing(true) }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--neutral-50)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
          >
            Rename
          </DropdownMenu.Item>

          <DropdownMenu.Separator style={{ height: "1px", backgroundColor: "var(--neutral-100)", margin: "4px 0" }} />

          <DropdownMenu.Item
            style={menuItemDestructiveStyle}
            onSelect={handleDelete}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--red-50, #fff5f5)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ── Projects section - reads from ProjectsContext ──────────────────────────────

const PROJECT_LIMIT = 5

function ProjectsSection() {
  const { push }    = useRouter()
  const pathname    = usePathname()
  const chatHistory = useChatHistoryContext()
  const { projects, getChats, removeChat, renameChat } = useProjects()

  const [shown,        setShown]        = useState(true)
  const [overflow,     setOverflow]     = useState<"visible" | "hidden">("visible")
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(() => new Set(projects.map(p => p.id)))

  const visibleProjects = projects.slice(0, PROJECT_LIMIT)

  // Auto-expand the project whose route is active (only expands, never collapses).
  React.useEffect(() => {
    const active = projects.find(p => pathname.startsWith(`/project/${p.id}`))
    if (!active) return
    setExpandedIds(prev => {
      if (prev.has(active.id)) return prev
      const next = new Set(prev)
      next.add(active.id)
      return next
    })
  }, [pathname, projects])
  const hasMore = projects.length > PROJECT_LIMIT

  function toggleExpand(id: string, expanded: boolean) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      expanded ? next.add(id) : next.delete(id)
      return next
    })
  }

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Projects"
        shown={shown}
        onShowClick={() => setShown(s => !s)}
      />
      <m.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden") }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible") }}
      >
        <div style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <SidebarMenuItem
            fluid
            variant="default"
            label="New project"
            icon={<FolderAddIcon size={20} />}
            onClick={() => push("/projects/new")}
          />

          {projects.length === 0 && (
            <div style={{
              padding:    "8px 6px",
              fontFamily: "var(--font-body)",
              fontSize:   "var(--font-size-caption)",
              color:      "var(--neutral-400)",
            }}>
              No projects yet
            </div>
          )}

          {visibleProjects.map(project => {
            const chats     = getChats(project.id)
            const isActive  = pathname.startsWith(`/project/${project.id}`)
            const isExpanded = expandedIds.has(project.id)

            return (
              <SidebarProjectsSection
                key={project.id}
                fluid
                label={project.name}
                active={isActive}
                expanded={isExpanded}
                onClick={() => push(`/project/${project.id}`)}
                onExpandedChange={(v) => toggleExpand(project.id, v)}
              >
                {chats.length > 0 && [
                  ...chats.slice(0, 5).map(chat => (
                    <ProjectChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={pathname === `/project/${project.id}/chat/${chat.id}`}
                      onSelect={() => push(`/project/${project.id}/chat/${chat.id}`)}
                      onRename={async (chatId, title) => {
                        renameChat(project.id, chatId, title)
                        await chatHistory.rename(chatId, title)
                      }}
                      onDelete={(chatId) => removeChat(project.id, chatId)}
                    />
                  )),
                ]}
              </SidebarProjectsSection>
            )
          })}

          {hasMore && (
            <SidebarMenuItem
              fluid
              variant="default"
              icon={<MoreHorizontalIcon size={20} />}
              label="Show all"
              onClick={() => push("/projects")}
            />
          )}
        </div>
      </m.div>
    </>
  )
}

// ── PersonaChatItem — rename / delete dropdown for individual persona chats ───

const personaChatMenuItemStyle: React.CSSProperties = {
  display:     "flex",
  alignItems:  "center",
  gap:         "8px",
  padding:     "7px 10px",
  borderRadius:"8px",
  cursor:      "pointer",
  fontFamily:  "var(--font-body)",
  fontWeight:  "var(--font-weight-medium)",
  fontSize:    "var(--font-size-body)",
  lineHeight:  "var(--line-height-body)",
  color:       "var(--neutral-700)",
  outline:     "none",
  userSelect:  "none",
};

const personaChatMenuItemDestructiveStyle: React.CSSProperties = {
  ...personaChatMenuItemStyle,
  color: "var(--red-500)",
};

interface PersonaChatItemProps {
  personaId: string
  chat:      PersonaChat
  isActive:  boolean
  onSelect:  () => void
  onRename:  (chatId: string, title: string) => void
  onDelete:  (chatId: string) => void
}

function PersonaChatItem({
  personaId,
  chat,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: PersonaChatItemProps) {
  const [isEditing,  setIsEditing]  = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const triggerRef                  = useRef<HTMLButtonElement>(null)
  const pendingRenameRef            = useRef(false)

  const handleCommit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== chat.title) {
      void renamePersonaChat(personaId, chat.id, trimmed)
        .then(() => { onRename(chat.id, trimmed); toast.success("Chat renamed") })
        .catch(() => toast.error("Failed to rename chat"))
    }
    setIsEditing(false)
  }

  const handleMoreClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation()
    setMenuOpen(true)
  }

  const handleDelete = () => {
    openDeleteChatDialog({
      chatId:    chat.id,
      chatTitle: chat.title,
      onConfirm: async () => {
        await deletePersonaChat(personaId, chat.id)
          .then(() => { onDelete(chat.id); toast.success("Chat deleted") })
          .catch(() => { toast.error("Failed to delete chat") })
      },
    })
  }

  return (
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <div style={{ position: "relative", width: "100%" }}>
        <SidebarMenuItem
          fluid
          variant={isEditing ? "chat-item-edit" : "chat-item"}
          label={chat.title}
          selected={isActive}
          onClick={() => { if (!isEditing) onSelect() }}
          onMoreClick={handleMoreClick}
          onRename={() => setIsEditing(true)}
          onCommit={handleCommit}
          onCancel={() => setIsEditing(false)}
        />
        <DropdownMenu.Trigger
          ref={triggerRef}
          style={{
            position:      "absolute",
            right:         "8px",
            top:           "50%",
            width:         1,
            height:        1,
            opacity:       0,
            pointerEvents: "none",
            border:        "none",
            background:    "none",
            padding:       0,
          }}
        />
      </div>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(e) => {
            if (pendingRenameRef.current) {
              e.preventDefault()
              pendingRenameRef.current = false
            }
          }}
          style={{
            backgroundColor: "var(--neutral-white)",
            borderRadius:    "12px",
            padding:         "4px",
            boxShadow:       "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
            zIndex:          5,
            minWidth:        "168px",
            outline:         "none",
          }}
        >
          <DropdownMenu.Item
            style={personaChatMenuItemStyle}
            onSelect={() => { pendingRenameRef.current = true; setIsEditing(true) }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--neutral-50)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
          >
            Rename
          </DropdownMenu.Item>

          <DropdownMenu.Separator
            style={{ height: "1px", backgroundColor: "var(--neutral-100)", margin: "4px 0" }}
          />

          <DropdownMenu.Item
            style={personaChatMenuItemDestructiveStyle}
            onSelect={handleDelete}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--red-50, #fff5f5)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ── Personas section - all personas, each collapsible with their chats ───────

function PersonasSectionAll() {
  const { push }            = useRouter()
  const pathname            = usePathname()
  const personaSearchParams = useSearchParams()

  const personaMatch    = pathname?.match(/^\/personas\/([^/]+)\/chat/)
  const activePersonaId = personaMatch?.[1] ?? null
  const activeChatId    = personaSearchParams.get("chatId")

  const [shown,           setShown]           = useState(true)
  const [overflow,        setOverflow]        = useState<"visible" | "hidden">("visible")
  const [personas,        setPersonas]        = useState<Persona[]>([])
  // eslint-disable-next-line react-doctor/rendering-usetransition-loading -- guards async fetch, not a state transition
  const [isLoading,       setIsLoading]       = useState(true)
  const [expandedIds,     setExpandedIds]     = useState<Set<string>>(new Set())
  const [personaChatsMap, setPersonaChatsMap] = useState<
    Record<string, { chats: PersonaChat[]; loaded: boolean; loading: boolean }>
  >({})

  // Load all personas once on mount
  useEffect(() => {
    fetchPersonas()
      .then(setPersonas)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  // Load chats for a given persona — idempotent (no-op if already loaded/loading)
  const loadPersonaChats = useCallback((personaId: string) => {
    setPersonaChatsMap(prev => {
      if (prev[personaId]?.loaded || prev[personaId]?.loading) return prev
      return { ...prev, [personaId]: { chats: [], loaded: false, loading: true } }
    })
    fetchPersonaChats(personaId)
      .then(chats =>
        setPersonaChatsMap(prev => ({
          ...prev,
          [personaId]: { chats, loaded: true, loading: false },
        }))
      )
      .catch(() =>
        setPersonaChatsMap(prev => ({
          ...prev,
          [personaId]: { chats: [], loaded: true, loading: false },
        }))
      )
  }, [])

  // Auto-expand and load the active persona whenever the URL changes
  useEffect(() => {
    if (!activePersonaId) return
    setExpandedIds(prev => {
      if (prev.has(activePersonaId)) return prev
      return new Set([...prev, activePersonaId])
    })
    loadPersonaChats(activePersonaId)
  }, [activePersonaId, loadPersonaChats])

  // Listen for chat created / title-updated events
  useEffect(() => {
    const handleCreated = (e: Event) => {
      const { personaId, chatId, title } = (e as CustomEvent<PersonaChatEventDetail>).detail
      const newChat: PersonaChat = { id: chatId, title, created_at: new Date().toISOString() }
      setPersonaChatsMap(prev => {
        const existing = prev[personaId]
        if (!existing) {
          return { ...prev, [personaId]: { chats: [newChat], loaded: true, loading: false } }
        }
        if (existing.chats.some(c => c.id === chatId)) return prev
        return { ...prev, [personaId]: { ...existing, chats: [newChat, ...existing.chats] } }
      })
    }

    const handleTitleUpdated = (e: Event) => {
      const { personaId, chatId, title } = (e as CustomEvent<PersonaChatEventDetail>).detail
      setPersonaChatsMap(prev => {
        const existing = prev[personaId]
        if (!existing) return prev
        return {
          ...prev,
          [personaId]: {
            ...existing,
            chats: existing.chats.map(c => c.id === chatId ? { ...c, title } : c),
          },
        }
      })
    }

    window.addEventListener("persona:chat-created",       handleCreated)
    window.addEventListener("persona:chat-title-updated", handleTitleUpdated)
    return () => {
      window.removeEventListener("persona:chat-created",       handleCreated)
      window.removeEventListener("persona:chat-title-updated", handleTitleUpdated)
    }
  }, [])

  const handleExpand = useCallback((personaId: string, expanded: boolean) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      expanded ? next.add(personaId) : next.delete(personaId)
      return next
    })
    if (expanded) loadPersonaChats(personaId)
  }, [loadPersonaChats])

  const handleChatRename = useCallback((personaId: string, chatId: string, title: string) => {
    setPersonaChatsMap(prev => {
      const existing = prev[personaId]
      if (!existing) return prev
      return {
        ...prev,
        [personaId]: {
          ...existing,
          chats: existing.chats.map(c => c.id === chatId ? { ...c, title } : c),
        },
      }
    })
  }, [])

  const handleChatDelete = useCallback((personaId: string, chatId: string) => {
    setPersonaChatsMap(prev => {
      const existing = prev[personaId]
      if (!existing) return prev
      return {
        ...prev,
        [personaId]: {
          ...existing,
          chats: existing.chats.filter(c => c.id !== chatId),
        },
      }
    })
  }, [])

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Agents"
        shown={shown}
        onShowClick={() => setShown(s => !s)}
      />
      <m.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden") }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible") }}
      >
        <div style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} fluid />
          ))}

          {!isLoading && personas.length === 0 && (
            <div
              style={{
                padding:    "8px 6px",
                fontFamily: "var(--font-body)",
                fontSize:   "var(--font-size-caption)",
                color:      "var(--neutral-400)",
              }}
            >
              No agents yet
            </div>
          )}

          {personas.map(persona => {
            const isExpanded = expandedIds.has(persona.id)
            const isActive   = activePersonaId === persona.id
            const chatData   = personaChatsMap[persona.id]

            return (
              <SidebarProjectsSection
                key={persona.id}
                fluid
                label={persona.name}
                active={isActive}
                expanded={isExpanded}
                onClick={() => push(`/personas/${persona.id}/chat`)}
                onExpandedChange={(v) => handleExpand(persona.id, v)}
              >
                {/* New chat button */}
                <SidebarMenuItem
                  fluid
                  variant="default"
                  label="New chat"
                  icon={<PlusSignIcon size={20} />}
                  onClick={() => push(`/personas/${persona.id}/chat`)}
                />

                {/* Loading skeletons */}
                {chatData?.loading && !chatData.loaded && Array.from({ length: 2 }).map((_, i) => (
                  <SidebarMenuSkeleton key={i} fluid />
                ))}

                {/* Chat items */}
                {chatData?.chats.map(chat => (
                  <PersonaChatItem
                    key={chat.id}
                    personaId={persona.id}
                    chat={chat}
                    isActive={isActive && chat.id === activeChatId}
                    onSelect={() => push(`/personas/${persona.id}/chat?chatId=${chat.id}`)}
                    onRename={(chatId, title) => handleChatRename(persona.id, chatId, title)}
                    onDelete={(chatId) => handleChatDelete(persona.id, chatId)}
                  />
                ))}

                {/* Empty state */}
                {chatData?.loaded && chatData.chats.length === 0 && (
                  <div
                    style={{
                      padding:    "4px 6px",
                      fontFamily: "var(--font-body)",
                      fontSize:   "var(--font-size-caption)",
                      color:      "var(--neutral-400)",
                    }}
                  >
                    No chats yet
                  </div>
                )}
              </SidebarProjectsSection>
            )
          })}
        </div>
      </m.div>
    </>
  )
}

// ── LeftSidebar ───────────────────────────────────────────────────────────────

interface LeftSidebarProps {
  activeChatId?: string;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
}

function LeftSidebarImpl({
  activeChatId,
  onSelectChat,
  onNewChat,
}: LeftSidebarProps) {
  const { push } = useRouter();
  const pathname = usePathname();
  const chatSearchParams = useSearchParams();
  const { user, logout, isAuthenticated } = useAuth();
  const chatHistory = useChatHistoryContext();
  const { chats: projectChats, projects } = useProjects();
  const { pins, openForChat: openPinboardForChat, open: openPinboard } = usePinboard();

  // ── Global search state ───────────────────────────────────────────────────
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  // Personas are lazy-loaded the first time search opens (30s-cached fetch).
  const [searchPersonas, setSearchPersonas] = useState<Persona[]>([]);

  const isPersonaPage = pathname?.startsWith("/personas") || pathname?.startsWith("/persona");
  const isProjectPage = pathname?.startsWith("/project") ?? false;
  const isNewChatPage = pathname === '/chat' && !chatSearchParams.get('id');

  // Determines which Sidebar key to use (triggers remount on section change)
  // and which nav item to pre-select on mount.
  const sidebarSectionKey = isPersonaPage ? 'persona'
    : isProjectPage ? 'projects'
    : isNewChatPage ? 'new-chat'
    : 'chat-board';

  const computedDefaultBodySection = (
    isPersonaPage ? 'persona'
    : isProjectPage ? 'projects'
    : isNewChatPage ? 'new-chat'
    : 'chat-board'
  ) as 'chat-board' | 'persona' | 'workflow' | 'new-chat' | 'projects';

  const collapsedRef = useRef<boolean>(readCollapsed());

  // Exclude project chats from the Recents/Starred lists - they are already
  // shown inside the Projects section and would be confusing duplicates.
  const projectChatIdSet = useMemo(
    () => new Set(projectChats.map(c => c.id)),
    [projectChats],
  );
  const filteredChatHistory = useMemo(
    () => ({ ...chatHistory, chats: chatHistory.chats.filter(c => !projectChatIdSet.has(c.id)) }),
    [chatHistory, projectChatIdSet],
  );

  // Cmd/Ctrl+K opens the search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lazy-load personas the first time the search modal opens. fetchPersonas is
  // 30s-cached + deduped, so reopening is cheap.
  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    fetchPersonas()
      .then(p => { if (!cancelled) setSearchPersonas(p); })
      .catch(() => { /* search still works without personas */ });
    return () => { cancelled = true; };
  }, [searchOpen]);

  // ── Search data ───────────────────────────────────────────────────────────

  // Last 5 non-project chats as "recents" shown when query is empty
  const searchRecents = useMemo<SearchResult[]>(() => {
    return chatHistory.chats
      .filter(c => !projectChatIdSet.has(c.id))
      .slice(0, 5)
      .map(c => ({
        id:    c.id,
        type:  'chat' as const,
        title: c.title || 'Untitled chat',
      }));
  }, [chatHistory.chats, projectChatIdSet]);

  // Global search — matches across every entity in the app: chats, projects,
  // personas, pinned messages, and navigable pages (settings, brain, etc.).
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();

    const chatResults: SearchResult[] = chatHistory.chats
      .filter(c => (c.title || '').toLowerCase().includes(q))
      .slice(0, 20)
      .map(c => ({
        id:    c.id,
        type:  'chat' as const,
        title: c.title || 'Untitled chat',
      }));

    const projectResults: SearchResult[] = projects
      .filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .slice(0, 10)
      .map(p => ({
        id:       p.id,
        type:     'project' as const,
        title:    p.name,
        subtitle: p.description || undefined,
      }));

    const personaResults: SearchResult[] = searchPersonas
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)),
      )
      .slice(0, 10)
      .map(p => ({
        id:       p.id,
        type:     'persona' as const,
        title:    p.name,
        subtitle: p.handle || undefined,
      }));

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
      .map(pg => ({
        id:       pg.id,
        type:     'page' as const,
        title:    pg.title,
        subtitle: pg.subtitle,
      }));

    return [...chatResults, ...projectResults, ...personaResults, ...pinResults, ...pageResults];
  }, [searchQuery, chatHistory.chats, projects, searchPersonas, pins]);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    switch (result.type) {
      case 'chat':
        push(`/chat?id=${result.id}`);
        break;
      case 'project':
        push(`/project/${result.id}`);
        break;
      case 'persona':
        push(`/personas/${result.id}/chat`);
        break;
      case 'pin': {
        // Jump to the source chat and open the pinboard filtered to it; fall
        // back to just opening the pinboard if the pin has no chat link.
        const pin = pins.find(p => p.id === result.id);
        if (pin?.chatId) {
          push(`/chat?id=${pin.chatId}`);
          openPinboardForChat(pin.chatId);
        } else {
          openPinboard();
        }
        break;
      }
      case 'page': {
        const page = NAV_PAGES.find(p => p.id === result.id);
        if (page) push(page.route);
        break;
      }
    }
  }, [push, pins, openPinboardForChat, openPinboard]);

  const resolvedActiveChatId = activeChatId ?? chatSearchParams.get("id") ?? undefined;

  const handleCollapse = () => {
    collapsedRef.current = !collapsedRef.current;
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar_collapsed", String(collapsedRef.current));
    }
  };

  const handleNewChat = () => {
    const isAlreadyOnNewChat = pathname === "/chat" && !chatSearchParams.get("id");
    if (isAlreadyOnNewChat) {
      toast.info("Already on new chat");
      return;
    }
    toast.info("Opening new chat");
    if (onNewChat) {
      onNewChat();
    } else {
      push("/chat");
    }
  };

  const handleSelectChat = (id: string) => {
    if (onSelectChat) {
      onSelectChat(id);
    } else {
      push(`/chat?id=${id}`);
    }
  };

  const displayName = user
    ? user.firstName?.trim() || user.name?.split(" ")[0]?.trim() || ""
    : "";

  // "pro" → "Pro", "starter" → "Starter", null / "none" → undefined (hidden)
  const planLabel = user?.planType
    ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
    : undefined;

  const sectionProps: SectionProps = {
    activeChatId: resolvedActiveChatId,
    onSelectChat: handleSelectChat,
    chatHistory: filteredChatHistory,
  };

  return (
    <>
    <Sidebar
      key={sidebarSectionKey}
      defaultCollapsed={collapsedRef.current}
      defaultBodySection={computedDefaultBodySection}
      searchActive={searchOpen}
      onCollapse={handleCollapse}
      onNewChat={handleNewChat}
      onSearch={() => setSearchOpen(true)}
      onChatsClick={() => { toast.info("Opening Chat Board"); push("/chats") }}
      onProjectsClick={() => { toast.info("Opening Projects"); push("/projects") }}
      onPersonasClick={() => { toast.info("Opening Agents"); push("/personas") }}
      onBrainClick={() => { toast.info("Opening Brain"); push("/brain/threads") }}
      accountMenu={(collapsed) => (
        <AccountMenu
          name={displayName || "Account"}
          plan={planLabel}
          credits={user?.creditsRemaining ?? undefined}
          avatarSrc={user?.profilePicture ?? undefined}
          collapsed={collapsed}
          panelWidth={274}
          placement="top-start"
          onProfile={() => push("/settings/account")}
          onUpgradePlan={() => push("/settings/billing")}
          onSettings={() => push("/settings")}
          onWhatsNew={() => toast.info("What's new — coming soon!")}
          onHelp={() => push("/settings/help")}
          onLogOut={() => { if (isAuthenticated) { void logout() } else { push("/auth/login") } }}
        />
      )}
      projectItems={<ProjectsSection />}
      recentItems={
        isPersonaPage ? (
          <PersonasSectionAll />
        ) : isProjectPage ? null : (
          // Both sections share sectionProps; StarredSection self-hides when empty.
          // gap:'8px' on the wrapper adds space between Starred and Recents only
          // when both are present - gap does not apply to null children.
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <StarredSection {...sectionProps} />
            <RecentsSection {...sectionProps} />
          </div>
        )
      }
    />
    <GlobalSearchModal
      open={searchOpen}
      onClose={() => setSearchOpen(false)}
      onSelect={handleSearchSelect}
      onQuery={setSearchQuery}
      results={searchResults}
      recents={searchRecents}
    />
    </>
  );
}

export function LeftSidebar(props: LeftSidebarProps) {
  return (
    <Suspense fallback={null}>
      <LeftSidebarImpl {...props} />
    </Suspense>
  );
}
