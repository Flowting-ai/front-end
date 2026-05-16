"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { FolderAddIcon, MoreHorizontalIcon } from "@strange-huge/icons";
import { Sidebar, SidebarMenuItem, SidebarMenuSkeleton, SidebarProjectsSection } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { fetchPersonaChats } from "@/lib/api/personas";
import type { PersonaChat } from "@/lib/api/personas";
import type { PersonaChatEventDetail } from "@/hooks/use-sidebar-events";
import { ChatHistoryItem } from "./ChatHistoryItem";
import { openDeleteChatDialog } from "./AppDialogs";
import type { UseChatHistoryResult } from "@/hooks/use-chat-history";
import type { ProjectChat } from "@/context/projects-context";

// ── Collapse state persistence ────────────────────────────────────────────────

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sidebar_collapsed") === "true";
}

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
      <motion.div
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
      </motion.div>
    </>
  );
}

// ── Recents list ──────────────────────────────────────────────────────────────

function RecentsList({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const { chats, isLoading, hasMore, loadMore, rename, remove, star } = chatHistory;

  if (isLoading && chats.length === 0) {
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
      <motion.div
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
      </motion.div>
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
            zIndex: 200,
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
  const router      = useRouter()
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
      <motion.div
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
            onClick={() => router.push("/projects/new")}
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
                onClick={() => router.push(`/project/${project.id}`)}
                onExpandedChange={(v) => toggleExpand(project.id, v)}
              >
                {chats.length > 0 && [
                  <SidebarMenuItem key="__header" fluid variant="header" label="Recent" />,
                  ...chats.slice(0, 5).map(chat => (
                    <ProjectChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={pathname === `/project/${project.id}/chat/${chat.id}`}
                      onSelect={() => router.push(`/project/${project.id}/chat/${chat.id}`)}
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
              onClick={() => router.push("/projects")}
            />
          )}
        </div>
      </motion.div>
    </>
  )
}

// ── Personas section - recent chats for the active persona ───────────────────

function PersonasSection() {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const personaMatch = pathname?.match(/^\/personas\/([^/]+)\/chat/)
  const personaId    = personaMatch?.[1] ?? null
  const activeChatId = searchParams.get("chatId")

  const [shown,     setShown]     = useState(true)
  const [overflow,  setOverflow]  = useState<"visible" | "hidden">("visible")
  const [chats,     setChats]     = useState<PersonaChat[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!personaId) return
    setIsLoading(true)
    fetchPersonaChats(personaId)
      .then(setChats)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [personaId])

  useEffect(() => {
    if (!personaId) return

    const handleCreated = (e: Event) => {
      const { personaId: eid, chatId, title } = (e as CustomEvent<PersonaChatEventDetail>).detail
      if (eid !== personaId) return
      setChats((prev) => {
        if (prev.some((c) => c.id === chatId)) return prev
        return [{ id: chatId, title, created_at: new Date().toISOString() }, ...prev]
      })
    }

    const handleTitleUpdated = (e: Event) => {
      const { personaId: eid, chatId, title } = (e as CustomEvent<PersonaChatEventDetail>).detail
      if (eid !== personaId) return
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)))
    }

    window.addEventListener("persona:chat-created",       handleCreated)
    window.addEventListener("persona:chat-title-updated", handleTitleUpdated)
    return () => {
      window.removeEventListener("persona:chat-created",       handleCreated)
      window.removeEventListener("persona:chat-title-updated", handleTitleUpdated)
    }
  }, [personaId])

  if (!personaId) return null

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Recent chats"
        shown={shown}
        onShowClick={() => setShown((s) => !s)}
      />
      <motion.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden") }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible") }}
      >
        <div style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {isLoading && chats.length === 0 && (
            Array.from({ length: 3 }).map((_, i) => (
              <SidebarMenuSkeleton key={i} fluid />
            ))
          )}

          {!isLoading && chats.length === 0 && (
            <div
              style={{
                padding:    "8px 6px",
                fontFamily: "var(--font-body)",
                fontSize:   "var(--font-size-caption)",
                color:      "var(--neutral-400)",
              }}
            >
              No recent persona chats yet
            </div>
          )}

          {chats.map((chat) => (
            <SidebarMenuItem
              key={chat.id}
              fluid
              variant="chat-item"
              label={chat.title}
              selected={chat.id === activeChatId}
              onClick={() => router.push(`/personas/${personaId}/chat?chatId=${chat.id}`)}
            />
          ))}
        </div>
      </motion.div>
    </>
  )
}

// ── LeftSidebar ───────────────────────────────────────────────────────────────

interface LeftSidebarProps {
  activeChatId?: string;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
}

export function LeftSidebar({
  activeChatId,
  onSelectChat,
  onNewChat,
}: LeftSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const chatHistory = useChatHistoryContext();
  const { chats: projectChats } = useProjects();
  const isPersonaPage = pathname?.startsWith("/personas") || pathname?.startsWith("/persona");
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

  const resolvedActiveChatId = activeChatId ?? searchParams.get("id") ?? undefined;

  const handleCollapse = () => {
    collapsedRef.current = !collapsedRef.current;
    // Don't persist persona-page collapse state — it always starts collapsed.
    if (typeof window !== "undefined" && !isPersonaPage) {
      localStorage.setItem("sidebar_collapsed", String(collapsedRef.current));
    }
  };

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      router.push("/chat");
    }
  };

  const handleSelectChat = (id: string) => {
    if (onSelectChat) {
      onSelectChat(id);
    } else {
      router.push(`/chat?id=${id}`);
    }
  };

  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.name || ""
    : "";

  const sectionProps: SectionProps = {
    activeChatId: resolvedActiveChatId,
    onSelectChat: handleSelectChat,
    chatHistory: filteredChatHistory,
  };

  return (
    <Sidebar
      key={isPersonaPage ? "persona" : "default"}
      userName={displayName || "Account"}
      userEmail={user?.email ?? ""}
      avatarSrc={undefined}
      defaultCollapsed={isPersonaPage ? true : collapsedRef.current}
      onCollapse={handleCollapse}
      onNewChat={handleNewChat}
      onSearch={() => {
        /* wired in Day 7 - search dialog */
      }}
      onProjectsClick={() => router.push("/projects")}
      onPersonasClick={() => router.push("/personas")}
      onSettingsClick={() => router.push("/settings")}
      projectItems={<ProjectsSection />}
      recentItems={
        isPersonaPage ? (
          <PersonasSection />
        ) : (
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
  );
}
