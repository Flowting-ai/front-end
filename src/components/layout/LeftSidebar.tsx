"use client";

import React, { useCallback, useRef, useMemo, useState, useEffect, Suspense } from "react";
import { m } from "framer-motion";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { BubbleChatAddIcon, FolderAddIcon, MoreHorizontalIcon, PlusSignIcon, SettingsOneIcon, UserAddOneIcon, UserAiIcon } from "@strange-huge/icons";
import { Sidebar, SidebarMenuItem, SidebarMenuSkeleton, SidebarProjectsSection } from "@/components/ui";
import { DEFAULT_ADMIN_GROUPS } from "@/components/Sidebar";
import { AccountMenu } from "@/components/AccountMenu";
import { useAuth } from "@/context/auth-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { fetchPersonas, fetchPersonaChats, renamePersonaChat, deletePersonaChat, personasForTeamContext, PERSONAS_LIST_UPDATED_EVENT } from "@/lib/api/personas";
import type { Persona, PersonaChat } from "@/lib/api/personas";
import { listTasks } from "@/lib/api/tasks";
import type { ScheduledTaskListItem } from "@/lib/api/tasks";
import { CHAT_CREATED_EVENT, emitBrainNewThread } from "@/hooks/use-sidebar-events";
import type { PersonaChatEventDetail, ChatCreatedEventDetail } from "@/hooks/use-sidebar-events";
import { BrainSidebarSections } from "@/app/(app)/brain/BrainSidebarSections";
import { ChatHistoryItem } from "./ChatHistoryItem";
import { openDeleteChatDialog } from "./AppDialogs";
import type { UseChatHistoryResult } from "@/hooks/use-chat-history";
import type { Project, ProjectChat } from "@/context/projects-context";
import { useSearch } from "@/context/search-context";
import { useOrg } from "@/context/org-context";
import { TeamSwitcherDropdown } from "@/components/TeamSwitcherDropdown";
import type { Team as SwitcherTeam } from "@/components/TeamSwitcherDropdown";
import { DropdownFloat } from "@/components/Dropdown";
import { TeamSwitcherRow } from "@/components/TeamSwitcherRow";
import { RoleBadge } from "@/components/RoleBadge";
import type { WorkspaceRole } from "@/components/RoleBadge";
import { Tooltip } from "@/components/Tooltip";
import type { Team } from "@/types/teams";
import { Badge } from "@/components/Badge";
import { toast } from "sonner";
import type { SidebarAdminGroup } from "@/components/Sidebar";
import type { ChipColor } from "@/components/Chip";

// -- Collapse state persistence ------------------------------------------------

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sidebar_collapsed") === "true";
}

// -- Organization admin nav ----------------------------------------------------
// The sidebar's in-place "admin" body section (entered via the org badge) renders
// the Sidebar component's default groups — Organization / Models
// (DEFAULT_ADMIN_GROUPS), matching the design-system "Org section" story. We don't
// redefine that content here; we only wire each item's behaviour via
// onAdminSectionClick. The `id`s below are those default item ids.
//
// Items with a real destination navigate there; the rest surface a "coming soon"
// toast so nothing is ever a dead click.
const ADMIN_SECTION_ROUTES: Record<string, string> = {
  // Organization ? /org/*
  general:           "/org/general",
  members:           "/org/members",
  teams:             "/org/teams",
  "plans-usage":     "/org/plans",
  analytics:         "/org/analytics",
  connectors:        "/org/connectors",
  "souvenir-slack":  "/org/souvenir-slack",
  "activity-log":    "/org/activity",
  // Models ? AI & Models
  "model-providers": "/settings/ai",
};

// Items with no page yet — surfaced as "coming soon" (id ? toast label).
const ADMIN_SECTION_COMING_SOON: Record<string, string> = {};

// Default admin groups without the "Company Data" section.
const ORG_ADMIN_GROUPS = DEFAULT_ADMIN_GROUPS.filter(g => g.id !== 'company-data');

const TEAM_SETTINGS_SECTIONS = new Set([
  'team-projects',
  'team-connectors',
  'team-requests',
  'team-activity',
])

// -- Section show/hide animation - matches Sidebar design system ---------------

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

// -- Shared section props ------------------------------------------------------

interface SectionProps {
  activeChatId?: string;
  onSelectChat: (id: string) => void;
  chatHistory: UseChatHistoryResult;
}

// -- Starred section -----------------------------------------------------------

function StarredSection({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");

  const starredChats = chatHistory.chats.filter((c) => c.starred);

  // Don't render the section at all when no chats are starred.
  // Component remounts next time a chat is starred ? shown resets to true.
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

// -- Recents list --------------------------------------------------------------

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
          <SidebarMenuSkeleton key={i} index={i} fluid />
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

// -- Recents section - header with show/hide + animated collapse ---------------

function RecentsSection(props: SectionProps) {
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Recent Chats"
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

// -- Shared dropdown item styles ------------------------------------------------

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

// -- ProjectChatItem - sidebar project chat row with rename/delete menu ---------

interface ProjectChatItemProps {
  chat:     ProjectChat
  isActive: boolean
  href?:    string
  onSelect: () => void
  onRename: (chatId: string, title: string) => Promise<void>
  onDelete: (chatId: string) => void
}

function ProjectChatItem({ chat, isActive, href, onSelect, onRename, onDelete }: ProjectChatItemProps) {
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
          href={isEditing ? undefined : href}
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

// -- Projects section - reads from ProjectsContext ------------------------------

const PROJECT_LIMIT = 2
const CHAT_LIMIT    = 10

interface ProjectsSectionProps {
  label?: string
  showNewProject?: boolean
  projectsFilter?: (project: Project) => boolean
  newProjectHref?: string
  emptyLabel?: string
}

function ProjectsSection({
  label = "Projects",
  showNewProject = true,
  projectsFilter,
  newProjectHref = "/projects/new",
  emptyLabel = "No projects yet",
}: ProjectsSectionProps) {
  const { push }    = useRouter()
  const pathname    = usePathname()
  const chatHistory = useChatHistoryContext()
  const { projects: allProjects, getChats, removeChat, renameChat, loadProjectChats } = useProjects()

  const [shown,        setShown]        = useState(true)
  const [overflow,     setOverflow]     = useState<"visible" | "hidden">("visible")
  const projects = useMemo(
    () => projectsFilter ? allProjects.filter(projectsFilter) : allProjects,
    [allProjects, projectsFilter],
  )
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(() => new Set(projects.map(p => p.id)))

  const visibleProjects = useMemo(() => projects.slice(0, PROJECT_LIMIT), [projects])

  React.useEffect(() => {
    visibleProjects.forEach(project => {
      if (project.chatCount > 0 && getChats(project.id).length === 0) {
        void loadProjectChats(project.id)
      }
    })
  }, [visibleProjects, getChats, loadProjectChats])

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
        label={label}
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
          {showNewProject && (
            <SidebarMenuItem
              fluid
              variant="default"
              label="New project"
              icon={<FolderAddIcon size={20} />}
              href={newProjectHref}
              onClick={() => push(newProjectHref)}
            />
          )}

          {projects.length === 0 && (
            <div style={{
              padding:    "8px 6px",
              fontFamily: "var(--font-body)",
              fontSize:   "var(--font-size-caption)",
              color:      "var(--neutral-400)",
            }}>
              {emptyLabel}
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
                {chats.length > 0 && (
                <>
                  {chats.slice(0, CHAT_LIMIT).map(chat => (
                    <ProjectChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={pathname === `/project/${project.id}/chat/${chat.id}`}
                      href={`/project/${project.id}/chat/${chat.id}`}
                      onSelect={() => push(`/project/${project.id}/chat/${chat.id}`)}
                      onRename={async (chatId, title) => {
                        renameChat(project.id, chatId, title)
                        await chatHistory.rename(chatId, title)
                      }}
                      onDelete={(chatId) => removeChat(project.id, chatId)}
                    />
                  ))}
                  {chats.length > CHAT_LIMIT && (
                    <SidebarMenuItem
                      fluid
                      variant="default"
                      icon={<MoreHorizontalIcon size={20} animated />}
                      label="View all Project Chats"
                      selected={pathname === `/project/${project.id}`}
                      href={`/project/${project.id}`}
                      onClick={() => push(`/project/${project.id}`)}
                    />
                  )}
                </>
              )}
              </SidebarProjectsSection>
            )
          })}

          {hasMore && (
            <SidebarMenuItem
              fluid
              variant="default"
              icon={<MoreHorizontalIcon size={20} animated />}
              label="See all projects"
              href="/projects"
              onClick={() => push("/projects")}
            />
          )}
        </div>
      </m.div>
    </>
  )
}

// -- Teams sidebar components --------------------------------------------------

function SidebarDivider() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '2px 0' }}>
      <div style={{ height: 1, width: 272, backgroundColor: 'rgba(59,54,50,0.15)' }} />
    </div>
  )
}

// ── WorkspaceSwitcher — TeamSwitcherRow trigger + portaled TeamSwitcherDropdown ─

interface WorkspaceSwitcherProps {
  teams: Team[]
  projects: Project[]
  activeTeamId: string | null
  role: WorkspaceRole
  onTeamSelect: (id: string | null) => void
}

function WorkspaceSwitcher({ teams, projects, activeTeamId, role, onTeamSelect }: WorkspaceSwitcherProps) {
  const { push }    = useRouter()
  const [open, setOpen] = useState(false)

  // Only show active (non-archived) teams — mirrors the /org/teams page filter.
  // Archived teams have archived=true set via PATCH and may still appear in the
  // API response until their deleted_at is set by a subsequent hard-delete.
  const activeTeams = teams.filter(t => !t.archived)

  if (activeTeams.length === 0) return null

  const isPersonal    = activeTeamId === 'personal'
  const activeTeam    = (isPersonal || activeTeamId === null)
    ? null
    : (activeTeams.find(t => t.id === activeTeamId) ?? null)
  const displayTeam   = activeTeam ?? (isPersonal ? null : (activeTeams[0] ?? null))
  const triggerName   = isPersonal ? 'Personal Projects' : (displayTeam?.name ?? 'Teams')
  const triggerTeamId = displayTeam?.id ?? 'workspace'
  const triggerRole   = ((displayTeam?.myRole ?? role) as WorkspaceRole)

  const switcherTeams: SwitcherTeam[] = activeTeams.map(t => ({
    id:           t.id,
    name:         t.name,
    projectCount: projects.filter(p => p.teamId === t.id).length,
    userRole:     t.myRole as WorkspaceRole,
  }))

  const handleActionSelect = (teamId: string, action: string) => {
    const isAdminRole = role === 'admin'
    switch (action) {
      case 'manage':     push(isAdminRole ? `/org/teams/${teamId}` : `/teams/${teamId}`); break
      case 'projects':   push(`/teams/${teamId}?section=projects`); break
      case 'connectors': push(`/teams/${teamId}?section=connectors`); break
      case 'request':    push(isAdminRole ? `/org/members` : `/teams/${teamId}?section=requests`); break
      case 'activity':   push(isAdminRole ? `/org/activity` : `/teams/${teamId}?section=activity`); break
      case 'usage':      push('/org/plans'); break
    }
    setOpen(false)
  }

  return (
    <DropdownFloat
      trigger={
        <TeamSwitcherRow
          teamName={triggerName}
          teamId={triggerTeamId}
          projectCount={activeTeam ? projects.filter(p => p.teamId === activeTeam.id).length : 0}
          currentUserRole={triggerRole}
          isOpen={open}
        />
      }
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
    >
      <TeamSwitcherDropdown
        teams={switcherTeams}
        activeTeamId={activeTeamId ?? undefined}
        currentUserRole={role}
        onSelectTeam={(teamId) => { onTeamSelect(teamId); setOpen(false) }}
        onSelectPersonal={() => { onTeamSelect('personal'); setOpen(false) }}
        onActionSelect={handleActionSelect}
        onManageTeams={() => { push('/org/teams'); setOpen(false) }}
      />
    </DropdownFloat>
  )
}

interface TeamsSidebarContentProps {
  role: 'admin' | 'editor' | 'member'
  teams: Team[]
  activeTeamId: string | null
  setActiveTeamId: (id: string | null) => void  // 'personal' | teamId | null (All workspace)
}

function TeamsSidebarContent({ role, teams, activeTeamId, setActiveTeamId }: TeamsSidebarContentProps) {
  const { projects } = useProjects()
  const { push } = useRouter()
  const isPersonalView = activeTeamId === 'personal'
  const nonArchivedTeams = teams.filter(t => !t.archived)
  // Match the design system's DefaultProjectItems: when no team is explicitly
  // selected, the active team falls back to the first active team (the same
  // team WorkspaceSwitcher displays), so the panel and the trigger stay in sync.
  const activeTeam = isPersonalView
    ? null
    : (nonArchivedTeams.find(team => team.id === activeTeamId) ?? nonArchivedTeams[0] ?? null)
  const effectiveActiveTeamId = activeTeam?.id ?? null
  // Design rule (DefaultProjectItems): "New project" shows for non-members.
  // Org admins/owners (role !== 'member') always can; a plain org member who
  // is an editor on a team can create within a team they can edit.
  const isAdmin = role !== 'member'
  const showNewPersonalProject = isAdmin || nonArchivedTeams.some(team => team.canEdit)
  const showNewTeamProject = isAdmin || Boolean(activeTeam?.canEdit)
  const teamProjectsLabel = activeTeam ? `${activeTeam.name} projects` : 'Workspace projects'
  const teamNewProjectHref = effectiveActiveTeamId ? `/projects/new?teamId=${effectiveActiveTeamId}` : '/projects/new'
  const personalProjectFilter = useCallback((project: Project) => project.teamId === null, [])
  const teamProjectFilter = useCallback(
    (project: Project) => project.teamId !== null && (effectiveActiveTeamId ? project.teamId === effectiveActiveTeamId : true),
    [effectiveActiveTeamId],
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
      <WorkspaceSwitcher
        teams={teams}
        projects={projects}
        activeTeamId={activeTeamId}
        role={role as WorkspaceRole}
        onTeamSelect={setActiveTeamId}
      />
      {isPersonalView ? (
        <ProjectsSection
          label="Personal projects"
          showNewProject={showNewPersonalProject}
          projectsFilter={personalProjectFilter}
          emptyLabel="No personal projects yet"
        />
      ) : (
        <ProjectsSection
          label={teamProjectsLabel}
          showNewProject={showNewTeamProject}
          projectsFilter={teamProjectFilter}
          newProjectHref={teamNewProjectHref}
          emptyLabel={activeTeam ? `No projects in ${activeTeam.name} yet` : 'No team projects yet'}
        />
      )}
    </div>
  )
}

// -- PersonaChatItem — rename / delete dropdown for individual persona chats ---

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
          href={isEditing ? undefined : `/agents/${personaId}/chat?chatId=${chat.id}`}
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

// -- Personas section - all personas, each collapsible with their chats -------

function PersonasSectionAll({ teamId }: { teamId?: string | null } = {}) {
  const { push }            = useRouter()
  const pathname            = usePathname()
  const personaSearchParams = useSearchParams()

  const personaMatch    = pathname?.match(/^\/agents\/([^/]+)\/chat/)
  const activePersonaId = personaMatch?.[1] ?? null
  const activeChatId    = personaSearchParams.get("chatId")

  const [personas,        setPersonas]        = useState<Persona[]>([])
  const [isLoading,       setIsLoading]       = useState(true)
  const [expandedIds,     setExpandedIds]     = useState<Set<string>>(new Set())
  const [personaChatsMap, setPersonaChatsMap] = useState<
    Record<string, { chats: PersonaChat[]; loaded: boolean; loading: boolean }>
  >({})

  // Load personas on mount; filter to team-shared only when teamId is provided.
  useEffect(() => {
    fetchPersonas()
      .then(list => setPersonas(personasForTeamContext(list, teamId ?? null)))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [teamId])

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

  // Re-fetch the persona list whenever a publish/delete/update busts the cache
  useEffect(() => {
    const handleListUpdated = () => {
      fetchPersonas()
        .then(list => setPersonas(personasForTeamContext(list, teamId ?? null)))
        .catch(console.error)
    }
    window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, handleListUpdated)
    return () => window.removeEventListener(PERSONAS_LIST_UPDATED_EVENT, handleListUpdated)
  }, [teamId])

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

  const [shown, setShown] = useState(true)

  return (
    <>
      <SidebarMenuItem fluid variant="header" label="Agents" shown={shown} onShowClick={() => setShown(s => !s)} />
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow: shown ? 'visible' : 'hidden' }}
      >
        <div style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} index={i} fluid />
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
              {teamId ? 'No shared agents for this team yet' : 'No agents yet'}
            </div>
          )}

          {personas.map(persona => {
            const isExpanded = expandedIds.has(persona.id)
            const isActive   = activePersonaId === persona.id
            const chatData   = personaChatsMap[persona.id]
            // Only show chats that belong to the persona's currently active version.
            // Chats without a versionId (optimistically created this session or
            // legacy rows) are kept so they don't vanish from under the user.
            const visibleChats = chatData?.chats.filter(
              c => !c.versionId || !persona.activeVersionId || c.versionId === persona.activeVersionId,
            ) ?? []

            const avatarIcon = persona.imageUrl
              ? <img src={persona.imageUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: 'var(--shadow-sidebar-item-avatar)' }} />
              : <UserAiIcon size={20} />

            return (
              <SidebarProjectsSection
                key={persona.id}
                fluid
                label={persona.name}
                icon={avatarIcon}
                active={isActive}
                expanded={isExpanded}
                onClick={() => push(`/agents/${persona.id}/chat`)}
                onExpandedChange={(v) => handleExpand(persona.id, v)}
                badge={persona.sourceShareId !== null ? (
                  <Badge color="Blue" label="Shared" />
                ) : undefined}
              >
                {/* New chat button */}
                <SidebarMenuItem
                  fluid
                  variant="default"
                  label="New chat"
                  icon={<PlusSignIcon size={20} />}
                  href={`/agents/${persona.id}/chat`}
                  onClick={() => push(`/agents/${persona.id}/chat`)}
                />

                {/* Loading skeletons */}
                {chatData?.loading && !chatData.loaded && Array.from({ length: 2 }).map((_, i) => (
                  <SidebarMenuSkeleton key={i} index={i} fluid />
                ))}

                {/* Chat items */}
                {visibleChats.map(chat => (
                  <PersonaChatItem
                    key={chat.id}
                    personaId={persona.id}
                    chat={chat}
                    isActive={isActive && chat.id === activeChatId}
                    onSelect={() => push(`/agents/${persona.id}/chat?chatId=${chat.id}`)}
                    onRename={(chatId, title) => handleChatRename(persona.id, chatId, title)}
                    onDelete={(chatId) => handleChatDelete(persona.id, chatId)}
                  />
                ))}

                {/* Empty state */}
                {chatData?.loaded && visibleChats.length === 0 && (
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

// -- Individual personas section — "Shared Agents" + "Your Agents" split -----
// Fetches all personas for the user (no teamId filter) and splits by
// sourceShareId: shared agents (accepted via Super Link) vs owned agents.

function PersonasSectionIndividual() {
  const { push }            = useRouter()
  const pathname            = usePathname()
  const personaSearchParams = useSearchParams()

  const personaMatch    = pathname?.match(/^\/agents\/([^/]+)\/chat/)
  const activePersonaId = personaMatch?.[1] ?? null
  const activeChatId    = personaSearchParams.get("chatId")

  const [personas,        setPersonas]        = useState<Persona[]>([])
  const [isLoading,       setIsLoading]       = useState(true)
  const [expandedIds,     setExpandedIds]     = useState<Set<string>>(new Set())
  const [personaChatsMap, setPersonaChatsMap] = useState<
    Record<string, { chats: PersonaChat[]; loaded: boolean; loading: boolean }>
  >({})

  useEffect(() => {
    fetchPersonas()
      .then(list => setPersonas(list))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

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

  useEffect(() => {
    if (!activePersonaId) return
    setExpandedIds(prev => {
      if (prev.has(activePersonaId)) return prev
      return new Set([...prev, activePersonaId])
    })
    loadPersonaChats(activePersonaId)
  }, [activePersonaId, loadPersonaChats])

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

  // Re-fetch the persona list whenever a publish/delete/update busts the cache
  useEffect(() => {
    const handleListUpdated = () => {
      fetchPersonas()
        .then(list => setPersonas(list))
        .catch(console.error)
    }
    window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, handleListUpdated)
    return () => window.removeEventListener(PERSONAS_LIST_UPDATED_EVENT, handleListUpdated)
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

  const sharedPersonas = personas.filter(p => p.sourceShareId !== null)
  const ownedPersonas  = personas.filter(p => p.sourceShareId === null)

  const [shownShared, setShownShared] = useState(true)
  const [shownOwned,  setShownOwned]  = useState(true)

  const renderPersonaRow = (persona: Persona) => {
    const isExpanded   = expandedIds.has(persona.id)
    const isActive     = activePersonaId === persona.id
    const chatData     = personaChatsMap[persona.id]
    const visibleChats = chatData?.chats.filter(
      c => !c.versionId || !persona.activeVersionId || c.versionId === persona.activeVersionId,
    ) ?? []

    const avatarIcon = persona.imageUrl
      ? <img src={persona.imageUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: 'var(--shadow-sidebar-item-avatar)' }} />
      : <UserAiIcon size={20} />

    return (
      <SidebarProjectsSection
        key={persona.id}
        fluid
        label={persona.name}
        icon={avatarIcon}
        active={isActive}
        expanded={isExpanded}
        onClick={() => push(`/agents/${persona.id}/chat`)}
        onExpandedChange={(v) => handleExpand(persona.id, v)}
      >
        <SidebarMenuItem
          fluid
          variant="default"
          label="New chat"
          icon={<BubbleChatAddIcon size={20} />}
          href={`/agents/${persona.id}/chat`}
          onClick={() => push(`/agents/${persona.id}/chat`)}
        />
        {chatData?.loading && !chatData.loaded && Array.from({ length: 2 }).map((_, i) => (
          <SidebarMenuSkeleton key={i} index={i} fluid />
        ))}
        {visibleChats.map(chat => (
          <PersonaChatItem
            key={chat.id}
            personaId={persona.id}
            chat={chat}
            isActive={isActive && chat.id === activeChatId}
            onSelect={() => push(`/agents/${persona.id}/chat?chatId=${chat.id}`)}
            onRename={(chatId, title) => handleChatRename(persona.id, chatId, title)}
            onDelete={(chatId) => handleChatDelete(persona.id, chatId)}
          />
        ))}
        {chatData?.loaded && visibleChats.length === 0 && (
          <div style={{ padding: "4px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
            No chats yet
          </div>
        )}
      </SidebarProjectsSection>
    )
  }

  return (
    <>
      {/* Shared Agents — only rendered when loading or at least one shared agent exists */}
      {(isLoading || sharedPersonas.length > 0) && (
        <>
          <SidebarMenuItem
            fluid
            variant="header"
            label="Shared Agents"
            shown={shownShared}
            onShowClick={() => setShownShared(s => !s)}
          />
          <m.div
            animate={shownShared ? 'open' : 'closed'}
            initial={false}
            variants={sectionHeightVariants}
            style={{ overflow: shownShared ? 'visible' : 'hidden' }}
          >
            <div style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
              {isLoading && Array.from({ length: 2 }).map((_, i) => (
                <SidebarMenuSkeleton key={i} index={i} fluid />
              ))}
              {!isLoading && sharedPersonas.map(renderPersonaRow)}
            </div>
          </m.div>
        </>
      )}

      {/* Your Agents — always rendered */}
      <SidebarMenuItem
        fluid
        variant="header"
        label="Your Agents"
        shown={shownOwned}
        onShowClick={() => setShownOwned(s => !s)}
      />
      <m.div
        animate={shownOwned ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow: shownOwned ? 'visible' : 'hidden' }}
      >
        <div style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <SidebarMenuItem
            fluid
            variant="default"
            label="New Agent"
            icon={<UserAddOneIcon size={20} />}
            onClick={() => push('/agents/templates')}
          />
          {isLoading && Array.from({ length: 2 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} index={i} fluid />
          ))}
          {!isLoading && ownedPersonas.length === 0 && (
            <div style={{ padding: "8px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
              No agents yet
            </div>
          )}
          {!isLoading && ownedPersonas.map(renderPersonaRow)}
        </div>
      </m.div>
    </>
  )
}

// -- Recent agent chats section -----------------------------------------------
// Fetches all agent chats across all personas and displays them chronologically.
// Acts as a second layer: the first layer shows chats nested under each agent,
// this layer shows all chats flat by recency regardless of which agent owns them.

type AgentChat = PersonaChat & { personaId: string }

function RecentAgentChatsSection() {
  const { push }            = useRouter()
  const pathname            = usePathname()
  const personaSearchParams = useSearchParams()

  const activePersonaId = pathname?.match(/^\/agents\/([^/]+)\/chat/)?.[1] ?? null
  const activeChatId    = personaSearchParams.get("chatId")

  const [allChats, setAllChats] = useState<AgentChat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [shown, setShown] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const personas = await fetchPersonas()
      const results  = await Promise.all(
        personas.map(p =>
          fetchPersonaChats(p.id).then(chats => chats.map(c => ({ ...c, personaId: p.id })))
        )
      )
      const merged = results.flat().sort((a, b) => {
        const at = a.updated_at ?? a.created_at ?? ''
        const bt = b.updated_at ?? b.created_at ?? ''
        return bt.localeCompare(at)
      })
      setAllChats(merged)
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Initial load with loading state
  useEffect(() => {
    setIsLoading(true)
    fetchAll().finally(() => setIsLoading(false))
  }, [fetchAll])

  // Silent re-fetch on persona publish/delete/update
  useEffect(() => {
    window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, fetchAll)
    return () => window.removeEventListener(PERSONAS_LIST_UPDATED_EVENT, fetchAll)
  }, [fetchAll])

  // Incremental updates for new chats and renames
  useEffect(() => {
    const handleCreated = (e: Event) => {
      const { personaId, chatId, title } = (e as CustomEvent<PersonaChatEventDetail>).detail
      const newChat: AgentChat = { id: chatId, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), personaId }
      setAllChats(prev => prev.some(c => c.id === chatId) ? prev : [newChat, ...prev])
    }
    const handleTitleUpdated = (e: Event) => {
      const { chatId, title } = (e as CustomEvent<PersonaChatEventDetail>).detail
      setAllChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c))
    }
    window.addEventListener("persona:chat-created",       handleCreated)
    window.addEventListener("persona:chat-title-updated", handleTitleUpdated)
    return () => {
      window.removeEventListener("persona:chat-created",       handleCreated)
      window.removeEventListener("persona:chat-title-updated", handleTitleUpdated)
    }
  }, [])

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Recent agent chats"
        shown={shown}
        onShowClick={() => setShown(s => !s)}
      />
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow: shown ? 'visible' : 'hidden' }}
      >
        <div style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} index={i} fluid />
          ))}
          {!isLoading && allChats.length === 0 && (
            <div style={{ padding: "8px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
              No agent chats yet
            </div>
          )}
          {!isLoading && allChats.map(chat => (
            <PersonaChatItem
              key={chat.id}
              personaId={chat.personaId}
              chat={chat}
              isActive={activePersonaId === chat.personaId && chat.id === activeChatId}
              onSelect={() => push(`/agents/${chat.personaId}/chat?chatId=${chat.id}`)}
              onRename={(chatId, title) => setAllChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c))}
              onDelete={(chatId) => setAllChats(prev => prev.filter(c => c.id !== chatId))}
            />
          ))}
        </div>
      </m.div>
    </>
  )
}

// -- Brain Scheduled Tasks section --------------------------------------------
// Receives pre-loaded tasks from LeftSidebarImpl so the list survives tab
// switches without re-fetching on each brain-tab mount/unmount cycle.

interface BrainScheduledTasksSectionProps {
  tasks: ScheduledTaskListItem[];
  loading: boolean;
}

function BrainScheduledTasksSection({ tasks, loading }: BrainScheduledTasksSectionProps) {
  const { push } = useRouter();
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Schedules"
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
        <div style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {loading ? (
            <>
              <SidebarMenuSkeleton index={0} fluid />
              <SidebarMenuSkeleton index={1} fluid />
            </>
          ) : tasks.length > 0 ? (
            tasks.map((task) => (
              <SidebarMenuItem
                key={task.id}
                fluid
                variant="chat-item"
                label={task.title}
                onClick={() => push("/brain/schedules")}
              />
            ))
          ) : null}
        </div>
      </m.div>
    </>
  );
}

// -- LeftSidebar ---------------------------------------------------------------

// Orgs are auto-named "<X>'s Organisation" / "<X>'s Workspace" at provisioning.
// The badge + account row should show just the "<X>" part, not the redundant
// possessive suffix. A real custom name (no trailing organisation/workspace
// descriptor) is left untouched.
function orgDisplayName(name: string | undefined | null): string | undefined {
  if (!name) return name ?? undefined
  const match = name.match(/^(.+?)['’]s\s+(organi[sz]ation|workspace)\s*$/i)
  return match ? match[1]!.trim() : name
}

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
  const { chats: projectChats, getProject } = useProjects();
  const { orgId, org, plan, orgRole, currentUserRole, teams, activeTeamId, setActiveTeamId } = useOrg();

  // -- Global search ---------------------------------------------------------
  const { searchOpen, openSearch } = useSearch();

  const isPersonaPage = pathname?.startsWith("/agents") || pathname?.startsWith("/agent");
  const isProjectPage = pathname?.startsWith("/project") ?? false;
  const isBrainPage   = pathname?.startsWith("/brain") ?? false;

  // Detect team project context: extract the project id from the path and look
  // up its teamId so the agents tab can show only team-shared agents.
  const currentProjectId   = isProjectPage ? (pathname?.match(/^\/project\/([^/]+)/)?.[1] ?? null) : null
  const currentProject     = currentProjectId ? getProject(currentProjectId) : undefined
  const currentProjectTeamId = currentProject?.teamId ?? null
  const isAdminPage   = pathname?.startsWith("/org") ?? false;
  const isTeamSettingsPage = pathname?.startsWith("/teams/") ?? false;
  const isNewChatPage = pathname === '/chat' && !chatSearchParams.get('id');
  const routeTeamId = isTeamSettingsPage ? pathname?.split('/')[2] : undefined
  const routeTeam = teams.find(team => team.id === routeTeamId)
  const requestedTeamSection = `team-${chatSearchParams.get('section') ?? 'projects'}`
  const teamSectionId = TEAM_SETTINGS_SECTIONS.has(requestedTeamSection)
    ? requestedTeamSection
    : 'team-projects'
  const teamSettingsGroups: SidebarAdminGroup[] = [{
    id: 'team-settings',
    label: routeTeam?.name ?? 'Team settings',
    items: [
      { id: 'team-projects', label: 'Projects' },
      { id: 'team-connectors', label: 'Connectors' },
      { id: 'team-requests', label: 'Requests' },
      { id: 'team-activity', label: 'Activity' },
    ],
  }]

  // Map the current /org/* path to its admin-section item id so the sidebar
  // can highlight the correct row on initial mount / page refresh.
  const adminItemId = isTeamSettingsPage ? teamSectionId
    : !isAdminPage ? undefined
    : pathname?.startsWith('/org/members')    ? 'members'
    : pathname?.startsWith('/org/teams')      ? 'teams'
    : pathname?.startsWith('/org/plans')      ? 'plans-usage'
    : pathname?.startsWith('/org/analytics')  ? 'analytics'
    : pathname?.startsWith('/org/connectors') ? 'connectors'
    : pathname?.startsWith('/org/souvenir-slack') ? 'souvenir-slack'
    : pathname?.startsWith('/org/activity')   ? 'activity-log'
    : 'general'

  // Determines which Sidebar key to use (triggers remount on section change).
  // Admin pages use a per-item key so the sidebar remounts on each admin page
  // navigation, allowing defaultSelectedItem to pre-highlight the right row.
  const sidebarSectionKey = isPersonaPage ? 'persona'
    : isProjectPage ? 'projects'
    : isBrainPage   ? 'brain'
    : isTeamSettingsPage ? `team-settings-${teamSectionId}`
    : isAdminPage   ? `admin-${adminItemId}`
    : isNewChatPage ? 'new-chat'
    : 'chat-board';

  const computedDefaultBodySection = (
    isPersonaPage ? 'agents'
    : isProjectPage ? 'projects'
    : isBrainPage   ? 'brain'
    : isAdminPage || isTeamSettingsPage ? 'admin'
    : isNewChatPage ? 'new-chat'
    : 'chats'
  ) as 'chats' | 'agents' | 'brain' | 'admin' | 'new-chat' | 'projects';

  const collapsedRef = useRef<boolean>(readCollapsed());

  // -- Brain scheduled tasks — fetched once when first visiting a brain page --
  // Lifted here so the list survives brain-tab switches without re-fetching.
  const [brainTasks, setBrainTasks] = useState<ScheduledTaskListItem[]>([]);
  const [brainTasksLoading, setBrainTasksLoading] = useState(false);
  const brainTasksFetchedRef = useRef(false);
  useEffect(() => {
    if (!isBrainPage || brainTasksFetchedRef.current) return;
    brainTasksFetchedRef.current = true;
    setBrainTasksLoading(true);
    listTasks()
      .then(setBrainTasks)
      .catch(() => {})
      .finally(() => setBrainTasksLoading(false));
  }, [isBrainPage]);

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

  // Keep a stable ref to addOptimistic so the event listener never captures a stale closure.
  const addOptimisticRef = useRef(chatHistory.addOptimistic);
  useEffect(() => { addOptimisticRef.current = chatHistory.addOptimistic });

  // Mirror chat:created window events (fired by the chat page alongside the context
  // addOptimistic call) so the sidebar always sees new chats immediately, even when
  // the key-based Sidebar remount races the React context propagation.
  useEffect(() => {
    const handle = (e: Event) => {
      const detail = (e as CustomEvent<ChatCreatedEventDetail>).detail;
      addOptimisticRef.current({
        id: detail.id,
        title: detail.title,
        created_at: detail.created_at,
        updated_at: detail.updated_at,
        starred: detail.starred,
        can_edit: detail.can_edit,
      });
    };
    window.addEventListener(CHAT_CREATED_EVENT, handle);
    return () => window.removeEventListener(CHAT_CREATED_EVENT, handle);
  }, []);

  const resolvedActiveChatId = activeChatId ?? chatSearchParams.get("id") ?? undefined;

  const handleCollapse = () => {
    collapsedRef.current = !collapsedRef.current;
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar_collapsed", String(collapsedRef.current));
    }
  };

  const handleNewChat = () => {
    if (isPersonaPage) {
      push("/agents");
      return;
    }
    const isAlreadyOnNewChat = pathname === "/chat" && !new URLSearchParams(window.location.search).get("id");
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

  // Role chip next to the wordmark.
  // admin/owner show their single org-level role — team roles don't add to it.
  // Members show their highest team role (editor beats member).
  // Hierarchy: owner > admin > editor > member.
  const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, editor: 2, member: 1 }
  const displayRole = (orgRole === 'owner' || orgRole === 'admin')
    ? orgRole
    : teams
        .map(t => t.myRole)
        .filter(Boolean)
        .reduce<string | undefined>(
          (best, r) => ((ROLE_RANK[r] ?? 0) > (ROLE_RANK[best ?? ''] ?? 0) ? r : best),
          undefined,
        ) ?? (orgId ? 'member' : undefined)
  const orgBadgeSublabel = orgId && displayRole
    ? displayRole.charAt(0).toUpperCase() + displayRole.slice(1)
    : undefined
  const orgBadgeChipColor: ChipColor =
    displayRole === 'owner'  ? 'Purple' :
    displayRole === 'admin'  ? 'Blue'   :
    displayRole === 'editor' ? 'Green'  :
    'Neutral'

  // Fall back to roleFit + billing snapshot to detect team accounts when orgId
  // hasn't resolved yet (e.g. owner whose profile lacks org_id, or org API failed).
  const billingSnap = (() => {
    try { const r = window?.sessionStorage?.getItem('kaya:billing:snapshot:v2'); return r ? JSON.parse(r) : null } catch { return null }
  })()
  const isTeamUser = Boolean(
    orgId ||
    user?.orgId ||
    user?.roleFit === 'small_team' ||
    user?.roleFit === 'large_team' ||
    billingSnap?.isTeamAccount
  )

  // Teams ? "Teams | <name>" | paid ? "Pro"/"Starter"/"Power" | trial ? "Free Trial" | none ? "No Plan Selected"
  const planLabel = isTeamUser
    ? (orgId ? `Teams | ${orgDisplayName(org?.name) ?? 'Teams'}` : 'Teams')
    : user?.planType
      ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
      : user?.isTrial
        ? 'Free Trial'
        : 'No Plan Selected'

  const planWarning = !isTeamUser && !user?.planType && !user?.isTrial

  // Credits shown in the account menu, by environment (kept isolated):
  //   • Organization ? the SHARED org pool remaining (org-context / getOrgPlan)
  //   • Individual / trial ? the personal balance (auth-context ? lib/credits.ts)
  // Org and personal balances never mix; we pick the source by environment.
  // Org and personal balances are already normalized to display credits.
  const accountCredits = orgId
    ? (plan ? org?.creditPool?.remaining : undefined)
    : (user?.creditsRemaining ?? undefined);

  const sectionProps: SectionProps = {
    activeChatId: resolvedActiveChatId,
    onSelectChat: handleSelectChat,
    chatHistory: filteredChatHistory,
  };

  return (
    <>
    <Sidebar
      key={sidebarSectionKey}
      recents={[]}
      defaultCollapsed={collapsedRef.current}
      defaultBodySection={computedDefaultBodySection}
      defaultSelectedItem={adminItemId}
      searchActive={searchOpen}
      onCollapse={handleCollapse}
      onNewChat={handleNewChat}
      newChatButtonSelected={
        isPersonaPage ? pathname === '/agents'
        : isBrainPage ? (pathname === '/brain' && !chatSearchParams.get('id'))
        : isNewChatPage
      }
      onSearch={openSearch}
      onChatTabClick={isPersonaPage ? () => push("/chat") : handleNewChat}
      onChatsClick={() => { toast.info("Opening Chat Board", { id: 'nav' }); push("/chats") }}
      onChatboardClick={() => { toast.info("Opening Chat Board", { id: 'nav' }); push("/chats") }}
      onManageAllThreadsClick={() => { toast.info("Opening Brain Threads", { id: 'nav' }); push("/brain/threads") }}
      // On a brain page the brain page owns the imperative new-thread reset
      // (URL navigation alone is unsafe — see handleNewChat in brain/page). Emit
      // the event it listens for; fall back to navigation from anywhere else.
      onNewBrainThread={() => { if (isBrainPage) emitBrainNewThread(); else push("/brain") }}
      onProjectsClick={() => { toast.info("Opening Projects", { id: 'nav' }); push("/projects") }}
      onPersonasClick={() => { toast.info("Opening Agents", { id: 'nav' }); push("/agents") }}
      onNewAgentChat={() => push("/agents")}
      agentItems={
        currentProjectTeamId ? <PersonasSectionAll teamId={currentProjectTeamId} />
        : isTeamUser         ? <PersonasSectionAll />
        :                      <PersonasSectionIndividual />
      }
      onAllAgentsClick={() => { toast.info("Opening Agents", { id: 'nav' }); push("/agents") }}
      onBrainClick={() => { toast.info("Opening Brain", { id: 'nav' }); push("/brain") }}
      // Clicking the admin tab switches the sidebar body to admin AND navigates
      // to General — always landing on General regardless of prior admin page.
      onOrganisationClick={() => push('/org/general')}
      // "Manage <org>" row (and its collapsed-rail twin) land on the same org
      // management entry point as the header org badge.
      onManageOrg={() => push('/org/general')}
      // adminGroups is intentionally NOT overridden — the Sidebar's default
      // groups (Organization / Models) are the canonical content.
      // We only wire behaviour: navigate where a page exists, else "coming soon".
      adminGroups={isTeamSettingsPage ? teamSettingsGroups : isAdminPage ? ORG_ADMIN_GROUPS : undefined}
      onAdminSectionClick={(id) => {
        if (isTeamSettingsPage && TEAM_SETTINGS_SECTIONS.has(id)) {
          push(`${pathname}?section=${id.replace('team-', '')}`)
          return
        }
        const href = ADMIN_SECTION_ROUTES[id]
        if (href) { push(href); return }
        const label = ADMIN_SECTION_COMING_SOON[id] ?? id
        toast.info(`${label} — coming soon`, { id: 'nav' })
      }}
      orgName={orgId ? orgDisplayName(org.name) : undefined}
      orgId={orgId ?? undefined}
      showAdmin={Boolean(orgId) && (orgRole === 'owner' || orgRole === 'admin')}
      orgBadgeSublabel={orgBadgeSublabel}
      orgBadgeChipColor={orgBadgeChipColor}
      accountMenu={(collapsed) => {
        if (!user) {
          return collapsed ? (
            <div style={{ padding: '12px 8px', display: 'flex', justifyContent: 'center' }}>
              <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
            </div>
          ) : (
            <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="kaya-skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div className="kaya-skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
                <div className="kaya-skeleton" style={{ height: 11, width: '42%', borderRadius: 4 }} />
              </div>
            </div>
          )
        }
        return (
          <AccountMenu
            name={displayName || "Account"}
            plan={planLabel}
            planWarning={planWarning}
            credits={accountCredits}
            avatarSrc={user?.profilePicture ?? undefined}
            collapsed={collapsed}
            panelWidth={274}
            roleBadge={orgId && displayRole ? (
              <Tooltip content={orgBadgeSublabel} side="top" delayDuration={300}>
                <span style={{ display: 'inline-flex' }}>
                  <RoleBadge role={displayRole as WorkspaceRole} showLabel={false} mode="solar" />
                </span>
              </Tooltip>
            ) : undefined}
            placement="top-start"
            onProfile={() => push("/settings/account")}
            onUpgradePlan={() => push("/settings/billing")}
            onSettings={() => push("/settings")}
            onOrganization={(orgId && (orgRole === 'owner' || orgRole === 'admin')) ? () => push("/org/general") : undefined}
            onWhatsNew={() => toast.info("What's new — coming soon!")}
            onHelp={() => push("/settings/help")}
            onLogOut={() => { if (isAuthenticated) { void logout() } else { push("/auth/login") } }}
          />
        )
      }}
      onSchedulesClick={() => { toast.info("Opening Schedules", { id: 'nav' }); push("/brain/schedules") }}
      projectItems={orgId ? (
        <TeamsSidebarContent
          role={currentUserRole}
          teams={teams}
          activeTeamId={activeTeamId}
          setActiveTeamId={setActiveTeamId}
        />
      ) : (
        <ProjectsSection label="Personal Projects" />
      )}
      scheduledTasksItems={isBrainPage ? <BrainScheduledTasksSection tasks={brainTasks} loading={brainTasksLoading} /> : undefined}
      brainRecentItems={
        <BrainSidebarSections
          activeChatId={isBrainPage ? (chatSearchParams.get('id') ?? null) : null}
          onThreadClick={(id) => push(`/brain?id=${id}`)}
        />
      }
      recentItems={
        !user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SidebarMenuSkeleton key={i} index={i} fluid />
            ))}
          </div>
        ) : isPersonaPage ? (
          // Both accounts: persona list is in agentItems; recent agent chats go here as a second layer
          <RecentAgentChatsSection />
        ) : isProjectPage ? null : isBrainPage ? null : (
          // Both sections share sectionProps; StarredSection self-hides when empty.
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <StarredSection {...sectionProps} />
            <RecentsSection {...sectionProps} />
          </div>
        )
      }
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
