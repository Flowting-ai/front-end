"use client";

import React, { useCallback, useRef, useMemo, useState, useEffect, Suspense } from "react";
import { m } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { useGuardedRouter, useNavGuard } from "@/context/nav-guard-context";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AlertTwoIcon, BubbleChatAddIcon, CalendarThreeIcon, CircleIcon, DeleteTwoIcon, FolderAddIcon, FolderLibraryIcon, FolderOneIcon, LinkSixIcon, MoreHorizontalIcon, PenOneIcon, PinIcon, PlusSignIcon, QuillWriteTwoIcon, ShareOneIcon, UserAddOneIcon, UserAiIcon } from "@strange-huge/icons";
import { Sidebar, SidebarMenuItem, SidebarMenuSkeleton, SidebarProjectsSection, FlatSidebar, FlatSidebarRow, FlatSidebarProjectGroup, FlatSidebarSlackConnector, FlatSidebarProfileRow } from "@/components/ui";
import { DEFAULT_ADMIN_GROUPS } from "@/components/Sidebar";
import { AccountMenu } from "@/components/AccountMenu";
import { useAuth } from "@/context/auth-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { MoveToProjectModal } from "@/components/MoveToProjectModal";
import { addChatToProject } from "@/lib/api/projects";
import { fetchPersonas, fetchPersonaChats, renamePersonaChat, deletePersonaChat, personasForTeamContext, isPersonaOwnedByViewer, PERSONAS_LIST_UPDATED_EVENT } from "@/lib/api/personas";
import type { Persona, PersonaChat } from "@/lib/api/personas";
import { resolveViewerUserId } from "@/lib/api/teams";
import { usePersonas } from "@/lib/queries/personas";
import { listAutomations, getAutomation } from "@/lib/api/automations";
import type { Automation, AutomationRun } from "@/lib/api/automations";
import { CHAT_CREATED_EVENT, emitSidebarNewChat, emitAgentsSeeAll } from "@/hooks/use-sidebar-events";
import type { PersonaChatEventDetail, ChatCreatedEventDetail } from "@/hooks/use-sidebar-events";
import { BrainSidebarSections, FlatBrainSidebarSections } from "@/app/(app)/brain/BrainSidebarSections";
import { ChatHistoryItem } from "./ChatHistoryItem";
import { openDeleteChatDialog } from "./AppDialogs";
import type { UseChatHistoryResult } from "@/hooks/use-chat-history";
import type { Project, ProjectChat } from "@/context/projects-context";
import { useSearch } from "@/context/search-context";
import { useOrg } from "@/context/org-context";
import { getOrgSlackStatus } from "@/lib/api/slack";
import { RoleBadge } from "@/components/RoleBadge";
import type { WorkspaceRole } from "@/components/RoleBadge";
import { Tooltip } from "@/components/Tooltip";
import { Badge } from "@/components/Badge";
import { toast } from "sonner";
import type { ChipColor } from "@/components/Chip";
import { SIDEBAR_COLLAPSED_KEY, personaProfileKey } from "@/lib/storage-keys";
import {
  PROJECT_ROUTE,
  PROJECT_CHAT_ROUTE,
  PROJECT_CHAT_NEW_ROUTE,
  PROJECTS_ROUTE,
  PROJECTS_NEW_ROUTE,
  ORG_MEMBERS_ROUTE,
  ORG_ACTIVITY_ROUTE,
  ORG_PLANS_ROUTE,
  ORG_GENERAL_ROUTE,
  ORG_ANALYTICS_ROUTE,
  ORG_SOUVENIR_SLACK_ROUTE,
  AGENT_CHAT_ROUTE,
  AGENT_CONFIGURE_INSTRUCTIONS_ROUTE,
  AGENTS_ROUTE,
  AGENTS_TEMPLATES_ROUTE,
  BRAIN_ROUTE,
  BRAIN_THREADS_ROUTE,
  BRAIN_SCHEDULES_ROUTE,
  CHAT_ROUTE,
  CHATS_ROUTE,
  SETTINGS_ROUTE,
  SETTINGS_ACCOUNT_ROUTE,
  SETTINGS_BILLING_ROUTE,
  SETTINGS_HELP_ROUTE,
  SETTINGS_CONNECTORS_ROUTE,
  ORG_CONNECTORS_ROUTE,
  AUTH_LOGIN_ROUTE,
} from "@/lib/routes";
import { ReportBugModal } from "@/components/ReportBugModal";
import type { Chat } from "@/types/chat";

// -- Collapse state persistence ------------------------------------------------

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

// -- Draft avatar fallback ------------------------------------------------------
// Draft agents' active version often has no persisted image_url yet — the
// configure flow stashes the in-progress avatar in sessionStorage (same key the
// /agents grid reads) before it's reflected in the fetched persona record.
function personaAvatarUrl(persona: Persona): string | null {
  if (persona.imageUrl) return persona.imageUrl;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(personaProfileKey(persona.id));
    const draft = JSON.parse(raw ?? "null") as Record<string, unknown> | null;
    const draftAvatar = draft?.avatarUrl;
    return typeof draftAvatar === "string" && draftAvatar ? draftAvatar : null;
  } catch {
    return null;
  }
}

// -- Organization admin nav ----------------------------------------------------
// The sidebar's in-place "admin" body section (entered via the org badge) renders
// the Sidebar component's default groups — Organization / Models
// (DEFAULT_ADMIN_GROUPS), matching the design-system "Org section" story. We don't
// redefine that content here; we only wire each item's behaviour via
// onAdminSectionClick. The `id`s below are those default item ids.
//
// Items with a real destination navigate there; the rest surface a "coming soon"
// toast so nothing is ever a dead click. Reference the route constants (not
// literal strings) so this can never drift out of sync with an actual route
// move again — general/members/teams/plans-usage/analytics/activity-log live
// under /settings/* now; connectors/souvenir-slack stay under /org/*.
const ADMIN_SECTION_ROUTES: Record<string, string> = {
  general:           ORG_GENERAL_ROUTE,
  members:           ORG_MEMBERS_ROUTE,
  "plans-usage":     ORG_PLANS_ROUTE,
  analytics:         ORG_ANALYTICS_ROUTE,
  connectors:        ORG_CONNECTORS_ROUTE,
  "souvenir-slack":  ORG_SOUVENIR_SLACK_ROUTE,
  "activity-log":    ORG_ACTIVITY_ROUTE,
};

// Items with no page yet — surfaced as "coming soon" (id ? toast label).
const ADMIN_SECTION_COMING_SOON: Record<string, string> = {};

// Default admin groups without the "Company Data" section, and without the
// "Teams" item — Team is fully removed from the product model (Workspace
// Model v2: Teams entity gone, Projects are the org unit), and its page was
// already deleted (commit 2c8c1dcb) leaving this nav row a 404.
const ORG_ADMIN_GROUPS = DEFAULT_ADMIN_GROUPS
  .filter(g => g.id !== 'company-data')
  .map(g => g.id === 'organization' ? { ...g, items: g.items.filter(i => i.id !== 'teams') } : g);


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

// -- Item stagger animation - same three-layer pattern as Sidebar's Default*Items --
// Layer 2 - stagger orchestrator: delays children until after the height
// animation completes so items never appear mid-clip.
const sectionStaggerVariants = {
  open: {
    transition: { staggerChildren: 0.04, delayChildren: 0.24 },
  },
  closed: {
    transition: {},
  },
};

// Layer 3 - per-item: fade + drift
const sectionItemVariants = {
  open:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" as const } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: "easeIn"  as const } },
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
        <m.div
          animate={shown ? "open" : "closed"}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{
            paddingTop: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {starredChats.map((chat) => (
            <m.div key={chat.id} variants={sectionItemVariants}>
              <ChatHistoryItem
                chat={chat}
                isActive={chat.id === activeChatId}
                onSelect={onSelectChat}
                onRename={chatHistory.rename}
                onDelete={async (chatId) => { await chatHistory.remove(chatId) }}
                onStar={chatHistory.star}
              />
            </m.div>
          ))}
        </m.div>
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
    <m.div
      animate="open"
      initial="closed"
      variants={sectionStaggerVariants}
      style={{ display: "flex", flexDirection: "column", gap: "4px" }}
    >
      {chats.map((chat) => (
        <m.div key={chat.id} variants={sectionItemVariants}>
          <ChatHistoryItem
            chat={chat}
            isActive={chat.id === activeChatId}
            onSelect={onSelectChat}
            onRename={rename}
            onDelete={async (chatId) => { await remove(chatId) }}
            onStar={star}
          />
        </m.div>
      ))}
      {hasMore && (
        <m.div variants={sectionItemVariants}>
          <SidebarMenuItem
            fluid
            variant="default"
            label="Load more"
            onClick={loadMore}
          />
        </m.div>
      )}
    </m.div>
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

const PROJECT_LIMIT = 5
// Sidebar folders only ever surface a quick-glance slice of a project's
// chats — "See all chats" is the entry point for the rest.
const CHAT_LIMIT    = 2

function sortChatsByRecency(chats: ProjectChat[]): ProjectChat[] {
  return [...chats].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// Sits where "See all chats" would — same 32px row height and 8px inset —
// for a project whose `chatCount` is genuinely 0, not just still loading.
const NO_CHATS_YET_STYLE: React.CSSProperties = {
  height:     32,
  display:    'flex',
  alignItems: 'center',
  padding:    '0 8px',
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  color:      'var(--neutral-400)',
}

function sortProjectsByRecency(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

interface ProjectsSectionProps {
  label?: string
  showNewProject?: boolean
  projectsFilter?: (project: Project) => boolean
  newProjectHref?: string
  emptyLabel?: string
  /** FlatProjectsSection only — persistent icon in the header row, left of the add button. */
  headerIcon?: React.ReactNode
}

function ProjectsSection({
  label = "Projects",
  showNewProject = true,
  projectsFilter,
  newProjectHref = PROJECTS_NEW_ROUTE,
  emptyLabel = "No projects yet",
}: ProjectsSectionProps) {
  const { push }    = useGuardedRouter()
  const pathname    = usePathname()
  const chatHistory = useChatHistoryContext()
  const { projects: allProjects, loading: projectsLoading, getChats, removeChat, renameChat, loadProjectChats } = useProjects()

  const [shown,        setShown]        = useState(true)
  const [overflow,     setOverflow]     = useState<"visible" | "hidden">("visible")
  const projects = useMemo(
    () => projectsFilter ? allProjects.filter(projectsFilter) : allProjects,
    [allProjects, projectsFilter],
  )
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(() => new Set())

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
    const active = projects.find(p => pathname.startsWith(PROJECT_ROUTE(p.id)))
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
        <m.div
          animate={shown ? "open" : "closed"}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{
            paddingTop:    "4px",
            paddingLeft:   "6px",
            display:       "flex",
            flexDirection: "column",
            gap:           "4px",
          }}
        >
          {showNewProject && (
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                label="New project"
                icon={<FolderAddIcon size={20} />}
                href={newProjectHref}
                onClick={() => push(newProjectHref)}
              />
            </m.div>
          )}

          {projectsLoading && projects.length === 0 && (
            <>
              {Array.from({ length: 2 }).map((_, i) => (
                <SidebarMenuSkeleton key={i} index={i} fluid />
              ))}
            </>
          )}

          {!projectsLoading && projects.length === 0 && (
            <div style={{
              padding:    "8px 6px",
              fontFamily: "var(--font-body)",
              fontSize:   "var(--font-size-caption)",
              color:      "var(--neutral-400)",
            }}>
              {emptyLabel}
            </div>
          )}

          {!projectsLoading && visibleProjects.map(project => {
            // Only chats the user can actually edit belong in this fully-
            // interactive tree (rename/delete, opens the real chat page).
            // A chat merely visible here via another member's project
            // activity — or a read-only share — isn't "yours"; it's surfaced
            // properly through the project page's own tabs instead.
            const chats     = sortChatsByRecency(getChats(project.id).filter(c => c.canEdit !== false))
            const isActive  = pathname.startsWith(PROJECT_ROUTE(project.id))
            const isExpanded = expandedIds.has(project.id)

            return (
              <m.div key={project.id} variants={sectionItemVariants}>
                <SidebarProjectsSection
                  fluid
                  label={project.name}
                  active={isActive || isExpanded}
                  expanded={isExpanded}
                  onClick={() => push(PROJECT_ROUTE(project.id))}
                  onExpandedChange={(v) => toggleExpand(project.id, v)}
                >
                  {chats.slice(0, CHAT_LIMIT).map(chat => (
                    <ProjectChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={pathname === PROJECT_CHAT_ROUTE(project.id, chat.id)}
                      href={PROJECT_CHAT_ROUTE(project.id, chat.id)}
                      onSelect={() => push(PROJECT_CHAT_ROUTE(project.id, chat.id))}
                      onRename={async (chatId, title) => {
                        renameChat(project.id, chatId, title)
                        await chatHistory.rename(chatId, title)
                      }}
                      onDelete={(chatId) => removeChat(project.id, chatId)}
                    />
                  ))}
                  {project.chatCount === 0 ? (
                    <div style={NO_CHATS_YET_STYLE}>No chats yet</div>
                  ) : (
                    <SidebarMenuItem
                      fluid
                      variant="default"
                      icon={<MoreHorizontalIcon size={20} animated />}
                      label="See all chats"
                      selected={pathname === PROJECT_ROUTE(project.id)}
                      href={PROJECT_ROUTE(project.id)}
                      onClick={() => push(PROJECT_ROUTE(project.id))}
                    />
                  )}
                </SidebarProjectsSection>
              </m.div>
            )
          })}

          {hasMore && (
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} animated />}
                label="See all projects"
                href={PROJECTS_ROUTE}
                onClick={() => push(PROJECTS_ROUTE)}
              />
            </m.div>
          )}
        </m.div>
      </m.div>
    </>
  )
}

// -- Teams sidebar components --------------------------------------------------
// Team no longer exists as a backend entity — "team projects" here just means
// every project shared with the organization (project.teamId !== null).

interface TeamsSidebarContentProps {
  role: 'admin' | 'member'
}

// Stable references so they don't defeat memoization in ProjectsSection/
// FlatProjectItemsList, which key their own useMemo off these functions.
const isOrgSharedProject = (project: Project) => project.teamId !== null
// FlatTeamsSidebarContent merges the viewer's personal and org-shared
// projects into one list — no team layer left to filter by.
const includeAllProjects = () => true

function TeamsSidebarContent({ role }: TeamsSidebarContentProps) {
  const isAdmin = role !== 'member'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
      <ProjectsSection
        label="Workspace projects"
        showNewProject={isAdmin}
        projectsFilter={isOrgSharedProject}
        newProjectHref="/projects/new"
        emptyLabel="No team projects yet"
      />
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

// The sidebar shows a quick-glance slice of the agent list, not the whole
// library — /agents is where the full set lives, same "See all" pattern as
// projects/chats/schedules above.
const AGENT_LIST_LIMIT = 10

// Shared by every "See all agents" row below — same already-there guard as
// handleNewChat's "Already on new chat" toast, so clicking it while already
// on /agents surfaces feedback instead of a silent no-op navigation. Always
// lands on the "My Agents" tab specifically: a fresh /agents mount already
// defaults there, but an already-mounted page won't reset its own tab state
// from a same-URL push, so that case also emits AGENTS_SEE_ALL_EVENT for the
// page to act on (same pattern as BRAIN_NEW_THREAD_EVENT).
function goToAgentsLibrary(pathname: string | null, push: (href: string) => void) {
  if (pathname === AGENTS_ROUTE) {
    toast.info("Already showing agent library", { id: 'nav' })
    emitAgentsSeeAll()
    return
  }
  toast.info("Opening Agents", { id: 'nav' })
  push(AGENTS_ROUTE)
}

// Team has no backend route left at all, so there's no way to resolve a
// shared persona's real owner any more — isPersonaOwnedByViewer falls back to
// the coarse currentUserRole check for every org-shared persona (accepted
// capability gap). Module-level so its reference stays stable across renders
// instead of invalidating memoized values that depend on it every time.
const EMPTY_PERSONA_OWNER_MAP: Record<string, string> = {}

function PersonasSectionAll({ teamId }: { teamId?: string | null } = {}) {
  const { push }            = useGuardedRouter()
  const pathname            = usePathname()
  const personaSearchParams = useSearchParams()
  const { currentUserRole, members } = useOrg()
  const { user } = useAuth()
  // `user?.id` is never populated by the backend's /users/me — resolve the
  // viewer's internal id via the org member list instead (see resolveViewerUserId).
  const viewerUserId = resolveViewerUserId(members, user?.email)

  const personaMatch    = pathname?.match(/^\/agents\/([^/]+)\/chat/)
  const activePersonaId = personaMatch?.[1] ?? null
  const activeChatId    = personaSearchParams.get("chatId")

  const [expandedIds,     setExpandedIds]     = useState<Set<string>>(new Set())
  const [personaChatsMap, setPersonaChatsMap] = useState<
    Record<string, { chats: PersonaChat[]; loaded: boolean; loading: boolean }>
  >({})
  // Real per-persona ownership (not an org-role guess) — needed so the sidebar
  // never surfaces a team-shared agent this viewer doesn't own. Its "New chat"
  // button skips the clone-before-chat step the chat chip picker and Team
  // panel use, so an un-owned team-shared agent here would 404 on first send.
  const personaOwnerMap = EMPTY_PERSONA_OWNER_MAP

  // Shared cache/subscription across every usePersonas() consumer — still backed
  // by fetchPersonas() (same TTL, dedupe); filter to team-shared only when
  // teamId is provided, same as the old mount-effect did.
  const { data: allPersonas, isLoading } = usePersonas()

  const rawPersonas = useMemo(
    () => personasForTeamContext(allPersonas ?? [], teamId ?? null),
    [allPersonas, teamId],
  )

  const personas = useMemo(
    () => rawPersonas.filter(p => isPersonaOwnedByViewer(p, personaOwnerMap, viewerUserId, currentUserRole === 'admin')),
    [rawPersonas, personaOwnerMap, viewerUserId, currentUserRole],
  )

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

  // Re-fetch on publish/delete/update is now handled inside usePersonas() itself
  // (it invalidates the shared query on the same PERSONAS_LIST_UPDATED_EVENT).

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
        <m.div
          animate={shown ? 'open' : 'closed'}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}
        >
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

          {personas.slice(0, AGENT_LIST_LIMIT).map(persona => {
            const isExpanded = expandedIds.has(persona.id)
            const isActive   = activePersonaId === persona.id
            const isDraft    = persona.status === 'draft'
            const chatData   = personaChatsMap[persona.id]
            // Only show chats that belong to the persona's currently active version.
            // Chats without a versionId (optimistically created this session or
            // legacy rows) are kept so they don't vanish from under the user.
            const visibleChats = chatData?.chats.filter(
              c => !c.versionId || !persona.activeVersionId || c.versionId === persona.activeVersionId,
            ) ?? []

            const avatarUrl  = personaAvatarUrl(persona)
            const avatarIcon = avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: 'var(--shadow-sidebar-item-avatar)' }} />
              : <UserAiIcon size={20} />

            return (
              <m.div key={persona.id} variants={sectionItemVariants}>
                <SidebarProjectsSection
                  fluid
                  label={persona.name}
                  icon={avatarIcon}
                  active={isActive}
                  expanded={isDraft ? false : isExpanded}
                  onClick={() => isDraft
                    ? push(AGENT_CONFIGURE_INSTRUCTIONS_ROUTE(persona.id, { name: persona.name }))
                    : handleExpand(persona.id, !isExpanded)}
                  onExpandedChange={(v) => { if (!isDraft) handleExpand(persona.id, v) }}
                  showExpandArrow={!isDraft}
                  badge={isDraft ? (
                    <Badge color="Yellow" label="Draft" />
                  ) : persona.sourceShareId !== null ? (
                    <Badge color="Blue" label="Shared" />
                  ) : undefined}
                >
                  {!isDraft && (
                    <>
                      {/* New chat button */}
                      <SidebarMenuItem
                        fluid
                        variant="default"
                        label="New chat"
                        icon={<PlusSignIcon size={20} />}
                        href={`/agents/${persona.id}/chat`}
                        onClick={() => push(AGENT_CHAT_ROUTE(persona.id))}
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
                          onSelect={() => push(`${AGENT_CHAT_ROUTE(persona.id)}?chatId=${chat.id}`)}
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
                    </>
                  )}
                </SidebarProjectsSection>
              </m.div>
            )
          })}

          {personas.length > AGENT_LIST_LIMIT && (
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} animated />}
                label="See all agents"
                href={AGENTS_ROUTE}
                onClick={() => goToAgentsLibrary(pathname, push)}
              />
            </m.div>
          )}
        </m.div>
      </m.div>
    </>
  )
}

// -- Individual personas section — "Shared Agents" + "Your Agents" split -----
// Fetches all personas for the user (no teamId filter) and splits by
// sourceShareId: shared agents (accepted via Super Link) vs owned agents.

function PersonasSectionIndividual() {
  const { push }            = useGuardedRouter()
  const pathname            = usePathname()
  const personaSearchParams = useSearchParams()

  const personaMatch    = pathname?.match(/^\/agents\/([^/]+)\/chat/)
  const activePersonaId = personaMatch?.[1] ?? null
  const activeChatId    = personaSearchParams.get("chatId")

  const [expandedIds,     setExpandedIds]     = useState<Set<string>>(new Set())
  const [personaChatsMap, setPersonaChatsMap] = useState<
    Record<string, { chats: PersonaChat[]; loaded: boolean; loading: boolean }>
  >({})

  const { data: personas, isLoading } = usePersonas()

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

  // Re-fetch on publish/delete/update is now handled inside usePersonas() itself
  // (it invalidates the shared query on the same PERSONAS_LIST_UPDATED_EVENT).

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

  const sharedPersonas = (personas ?? []).filter(p => p.sourceShareId !== null)
  const ownedPersonas  = (personas ?? []).filter(p => p.sourceShareId === null)

  const [shownShared, setShownShared] = useState(true)
  const [shownOwned,  setShownOwned]  = useState(true)

  const renderPersonaRow = (persona: Persona) => {
    const isExpanded   = expandedIds.has(persona.id)
    const isActive     = activePersonaId === persona.id
    const isDraft      = persona.status === 'draft'
    const chatData     = personaChatsMap[persona.id]
    const visibleChats = chatData?.chats.filter(
      c => !c.versionId || !persona.activeVersionId || c.versionId === persona.activeVersionId,
    ) ?? []

    const avatarUrl  = personaAvatarUrl(persona)
    const avatarIcon = avatarUrl
      ? <img src={avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: 'var(--shadow-sidebar-item-avatar)' }} />
      : <UserAiIcon size={20} />

    return (
      <m.div key={persona.id} variants={sectionItemVariants}>
        <SidebarProjectsSection
          fluid
          label={persona.name}
          icon={avatarIcon}
          active={isActive}
          expanded={isDraft ? false : isExpanded}
          onClick={() => isDraft
            ? push(AGENT_CONFIGURE_INSTRUCTIONS_ROUTE(persona.id, { name: persona.name }))
            : handleExpand(persona.id, !isExpanded)}
          onExpandedChange={(v) => { if (!isDraft) handleExpand(persona.id, v) }}
          showExpandArrow={!isDraft}
          badge={isDraft ? <Badge color="Yellow" label="Draft" /> : undefined}
        >
          {!isDraft && (
            <>
              <SidebarMenuItem
                fluid
                variant="default"
                label="New chat"
                icon={<BubbleChatAddIcon size={20} />}
                href={`/agents/${persona.id}/chat`}
                onClick={() => push(AGENT_CHAT_ROUTE(persona.id))}
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
                  onSelect={() => push(`${AGENT_CHAT_ROUTE(persona.id)}?chatId=${chat.id}`)}
                  onRename={(chatId, title) => handleChatRename(persona.id, chatId, title)}
                  onDelete={(chatId) => handleChatDelete(persona.id, chatId)}
                />
              ))}
              {chatData?.loaded && visibleChats.length === 0 && (
                <div style={{ padding: "4px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
                  No chats yet
                </div>
              )}
            </>
          )}
        </SidebarProjectsSection>
      </m.div>
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
            <m.div
              animate={shownShared ? 'open' : 'closed'}
              initial="closed"
              variants={sectionStaggerVariants}
              style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}
            >
              {isLoading && Array.from({ length: 2 }).map((_, i) => (
                <SidebarMenuSkeleton key={i} index={i} fluid />
              ))}
              {!isLoading && sharedPersonas.slice(0, AGENT_LIST_LIMIT).map(renderPersonaRow)}
              {sharedPersonas.length > AGENT_LIST_LIMIT && (
                <m.div variants={sectionItemVariants}>
                  <SidebarMenuItem
                    fluid
                    variant="default"
                    icon={<MoreHorizontalIcon size={20} animated />}
                    label="See all agents"
                    href={AGENTS_ROUTE}
                    onClick={() => goToAgentsLibrary(pathname, push)}
                  />
                </m.div>
              )}
            </m.div>
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
        <m.div
          animate={shownOwned ? 'open' : 'closed'}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}
        >
          <m.div variants={sectionItemVariants}>
            <SidebarMenuItem
              fluid
              variant="default"
              label="New Agent"
              icon={<UserAddOneIcon size={20} />}
              onClick={() => push(AGENTS_TEMPLATES_ROUTE)}
            />
          </m.div>
          {isLoading && Array.from({ length: 2 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} index={i} fluid />
          ))}
          {!isLoading && ownedPersonas.length === 0 && (
            <div style={{ padding: "8px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
              No agents yet
            </div>
          )}
          {!isLoading && ownedPersonas.slice(0, AGENT_LIST_LIMIT).map(renderPersonaRow)}
          {ownedPersonas.length > AGENT_LIST_LIMIT && (
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} animated />}
                label="See all agents"
                href={AGENTS_ROUTE}
                onClick={() => goToAgentsLibrary(pathname, push)}
              />
            </m.div>
          )}
        </m.div>
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
  const { push }            = useGuardedRouter()
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
        <m.div
          animate={shown ? 'open' : 'closed'}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}
        >
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} index={i} fluid />
          ))}
          {!isLoading && allChats.length === 0 && (
            <div style={{ padding: "8px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
              No agent chats yet
            </div>
          )}
          {!isLoading && allChats.map(chat => (
            <m.div key={chat.id} variants={sectionItemVariants}>
              <PersonaChatItem
                personaId={chat.personaId}
                chat={chat}
                isActive={activePersonaId === chat.personaId && chat.id === activeChatId}
                onSelect={() => push(`${AGENT_CHAT_ROUTE(chat.personaId)}?chatId=${chat.id}`)}
                onRename={(chatId, title) => setAllChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c))}
                onDelete={(chatId) => setAllChats(prev => prev.filter(c => c.id !== chatId))}
              />
            </m.div>
          ))}
        </m.div>
      </m.div>
    </>
  )
}

// -- Brain Scheduled Tasks section --------------------------------------------
// Receives pre-loaded tasks from LeftSidebarImpl so the list survives tab
// switches without re-fetching on each brain-tab mount/unmount cycle.

/** Per-schedule run status derived from its run history (see computeScheduleRunInfo). */
interface ScheduleRunInfo {
  /** Outcome of the most recent run — null when there's no run yet or its
   *  status isn't one we render an indicator for (e.g. still "running"). */
  lastRunStatus: "success" | "failed" | null;
  /** Runs that happened after this schedule was last opened from the sidebar. */
  newRunsCount: number;
}

const SCHEDULE_SEEN_KEY_PREFIX = "brain-schedule-seen:";

function getScheduleLastSeenAt(taskId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SCHEDULE_SEEN_KEY_PREFIX + taskId);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function markScheduleSeen(taskId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SCHEDULE_SEEN_KEY_PREFIX + taskId, String(Date.now()));
  } catch {
    // Storage full/unavailable — the badge just won't clear until next reload; non-critical.
  }
}

function scheduleRunTimestamp(run: AutomationRun): number {
  const iso = run.finished_at ?? run.started_at;
  const ms = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

/** Never-seen schedules count every existing run as "new" — there's nothing
 *  more correct to compare against than "you haven't looked at this yet". */
function computeScheduleRunInfo(runs: AutomationRun[], lastSeenAt: number | null): ScheduleRunInfo {
  if (runs.length === 0) return { lastRunStatus: null, newRunsCount: 0 };
  const sorted = [...runs].sort((a, b) => scheduleRunTimestamp(b) - scheduleRunTimestamp(a));
  const latestStatus = sorted[0].status;
  const lastRunStatus = latestStatus === "succeeded" ? "success" : latestStatus === "failed" ? "failed" : null;
  const newRunsCount = lastSeenAt == null
    ? runs.length
    : sorted.filter((r) => scheduleRunTimestamp(r) > lastSeenAt).length;
  return { lastRunStatus, newRunsCount };
}

/** Blue circle = last run succeeded (or no run yet). Caution icon = last run
 *  failed / needs attention. Rendered via SidebarMenuItem's own `icon` slot
 *  (default variant), which injects `triggered` on hover itself — same as
 *  every other icon passed to that prop elsewhere in this file. */
function scheduleStatusIcon(status: ScheduleRunInfo["lastRunStatus"]): React.ReactElement<{ triggered?: boolean }> {
  if (status === "failed") {
    return <AlertTwoIcon size={14} color="var(--color-tag-Yellow-text)" aria-label="Needs attention" />;
  }
  // CircleIcon is stroke-only (fill: none on the <svg>) — pass `fill` as an
  // extra SVG prop so the circle renders solid instead of a hollow ring.
  return (
    <CircleIcon
      size={8}
      color="var(--color-tag-Blue-text)"
      fill="var(--color-tag-Blue-text)"
      aria-label={status === "success" ? "Last run succeeded" : "No runs yet"}
    />
  );
}

interface BrainScheduledTasksSectionProps {
  tasks: Automation[];
  loading: boolean;
  runInfo: Record<string, ScheduleRunInfo>;
  onTaskOpened: (taskId: string) => void;
}

// Sidebar preview is a bounded "recent" list — the dedicated /brain/schedules
// page is where the full set lives; "See all" always links there.
const SCHEDULE_PREVIEW_LIMIT = 5;

function BrainScheduledTasksSection({ tasks, loading, runInfo, onTaskOpened }: BrainScheduledTasksSectionProps) {
  const { push } = useGuardedRouter();
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");
  const visibleTasks = tasks.slice(0, SCHEDULE_PREVIEW_LIMIT);

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Recent schedules"
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
        <m.div
          animate={shown ? "open" : "closed"}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}
        >
          {loading ? (
            <>
              <SidebarMenuSkeleton index={0} fluid />
              <SidebarMenuSkeleton index={1} fluid />
            </>
          ) : (
            <>
              {visibleTasks.map((task) => {
                const info = runInfo[task.id];
                return (
                  <m.div key={task.id} variants={sectionItemVariants}>
                    <SidebarMenuItem
                      fluid
                      variant="default"
                      icon={scheduleStatusIcon(info?.lastRunStatus ?? null)}
                      label={task.name}
                      trailing={info && info.newRunsCount > 0 ? <Badge color="Neutral" label={`${info.newRunsCount} new`} /> : undefined}
                      onClick={() => { onTaskOpened(task.id); push(BRAIN_SCHEDULES_ROUTE); }}
                    />
                  </m.div>
                );
              })}
              <m.div variants={sectionItemVariants}>
                <SidebarMenuItem
                  fluid
                  variant="default"
                  icon={<MoreHorizontalIcon size={20} animated />}
                  label="See all"
                  href={BRAIN_SCHEDULES_ROUTE}
                  onClick={() => push(BRAIN_SCHEDULES_ROUTE)}
                />
              </m.div>
            </>
          )}
        </m.div>
      </m.div>
    </>
  );
}

// ── Flat sidebar (Souvenir V1.5) — new render layer, same data/hooks ──────────
// Everything below renders onto the new FlatSidebar primitives instead of the
// old Sidebar/SidebarMenuItem/SidebarProjectsSection. It deliberately reuses the
// exact same hooks, constants (PROJECT_LIMIT, CHAT_LIMIT...), and business logic
// as the section components above — only the container components differ, per
// docs/features/sidebar-current-state-audit.md's migration checklist. The
// components above this line are UNTOUCHED and keep serving Brain/Admin/
// team-settings pages via the old <Sidebar>.

const flatMenuItemStyle: React.CSSProperties = { ...menuItemStyle }
const flatMenuItemDestructiveStyle: React.CSSProperties = { ...menuItemDestructiveStyle }

// Canonical KDS dropdown-item hover treatment (see DropdownMenuItem/index.tsx)
// — token-driven background + outer ring shadow, plus a separate absolutely-
// positioned inner depth-shadow overlay, rather than a flat ad hoc color.
function FlatMenuItem({
  destructive,
  onSelect,
  children,
}: {
  destructive?: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const hoverBg     = destructive ? "var(--dropdown-menu-item-danger-hover-bg)" : "var(--dropdown-menu-item-hover-bg)"
  const hoverShadow = destructive ? "var(--shadow-dropdown-item-danger-hover)"  : "var(--shadow-dropdown-item-hover)"
  const innerShadow = destructive ? "var(--shadow-dropdown-item-danger-inner)" : "var(--shadow-item-inner)"
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...(destructive ? flatMenuItemDestructiveStyle : flatMenuItemStyle),
        position:        "relative",
        backgroundColor: hovered ? hoverBg : "transparent",
        boxShadow:       hovered ? hoverShadow : undefined,
        transition:      "background-color 150ms, box-shadow 150ms",
      }}
    >
      {children}
      {hovered && (
        <div
          aria-hidden
          style={{
            position:      "absolute",
            inset:         0,
            pointerEvents: "none",
            borderRadius:  "inherit",
            boxShadow:     innerShadow,
          }}
        />
      )}
    </DropdownMenu.Item>
  )
}

// -- FlatChatHistoryItem — rename/star/delete dropdown, onto FlatSidebarRow ----
// Deliberately scoped down vs. ChatHistoryItem: "Move to project" is deferred
// for this first pass (not in the locked v1.5 destinations/projects/recents
// scope) — flagged here rather than silently dropped.

interface FlatChatHistoryItemProps {
  chat: Chat
  isActive: boolean
  onSelect: (id: string) => void
  onRename: (chatId: string, title: string) => Promise<void>
  onDelete: (chatId: string) => Promise<void>
  onStar: (chatId: string) => Promise<void>
}

function FlatChatHistoryItem({ chat, isActive, onSelect, onRename, onDelete, onStar }: FlatChatHistoryItemProps) {
  const { push } = useGuardedRouter()
  const { projects, addChat } = useProjects()
  const { removeLocal } = useChatHistoryContext()
  const isReadOnly = chat.can_edit === false && chat.visibility === 'team'
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const pendingRenameRef = useRef(false)

  const handleCommit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== chat.title) void onRename(chat.id, trimmed)
    setIsEditing(false)
  }
  const handleDelete = () => {
    openDeleteChatDialog({ chatId: chat.id, chatTitle: chat.title, onConfirm: () => onDelete(chat.id) })
  }
  // Same flow as the old ChatHistoryItem.tsx's "Move to project".
  const handleMoveToProject = async (projectId: string) => {
    setMoveModalOpen(false)
    try {
      await addChatToProject(projectId, chat.id)
      addChat(projectId, chat.id, chat.title)
      removeLocal(chat.id)
      const project = projects.find((p) => p.id === projectId)
      toast.success(`Moved to "${project?.name ?? "project"}"`)
    } catch {
      toast.error("Failed to move chat — please try again.")
    }
  }

  return (
    <>
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <div style={{ position: "relative", width: "100%" }}>
        <FlatSidebarRow
          variant={isEditing ? "chat-item-edit" : "chat-item"}
          label={chat.title}
          selected={isActive}
          href={isEditing ? undefined : `/chat?id=${chat.id}`}
          badge={!isEditing && chat.can_edit === false && chat.visibility === 'team' ? <Badge color="Red" label="Read only" /> : undefined}
          onClick={() => { if (!isEditing) onSelect(chat.id) }}
          onMoreClick={isReadOnly ? undefined : (e) => { e.stopPropagation(); setMenuOpen(true) }}
          onPinClick={(e) => { e.stopPropagation(); void onStar(chat.id) }}
          pinned={chat.starred}
          onRename={isReadOnly ? undefined : () => setIsEditing(true)}
          onCommit={handleCommit}
          onCancel={() => setIsEditing(false)}
        />
        <DropdownMenu.Trigger style={{ position: "absolute", right: "8px", top: "50%", width: 1, height: 1, opacity: 0, pointerEvents: "none", border: "none", background: "none", padding: 0 }} />
      </div>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right" align="start" sideOffset={8} avoidCollisions collisionPadding={8}
          onCloseAutoFocus={(e) => { if (pendingRenameRef.current) { e.preventDefault(); pendingRenameRef.current = false } }}
          style={{ backgroundColor: "var(--neutral-white)", borderRadius: "12px", padding: "4px", boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)", zIndex: 5, minWidth: "168px", outline: "none" }}
        >
          <FlatMenuItem onSelect={() => push(`/chat?id=${chat.id}&share=1`)}>
            <ShareOneIcon size={18} color="var(--neutral-600)" />
            Share
          </FlatMenuItem>
          <FlatMenuItem onSelect={() => { pendingRenameRef.current = true; setIsEditing(true) }}>
            <PenOneIcon animated size={18} color="var(--neutral-600)" />
            Rename
          </FlatMenuItem>
          {/* User-facing "Pin chat"/"Unpin chat" — the underlying field/API stays `starred` (see chat.starred, chatHistory.star). */}
          <FlatMenuItem onSelect={() => void onStar(chat.id)}>
            <PinIcon animated size={18} color="var(--neutral-600)" />
            {chat.starred ? "Unpin chat" : "Pin chat"}
          </FlatMenuItem>
          <FlatMenuItem onSelect={() => setMoveModalOpen(true)}>
            <FolderOneIcon size={18} color="var(--neutral-600)" variant="static" />
            Move to project
          </FlatMenuItem>
          {/* No archive endpoint exists yet (src/lib/api/chat.ts has no archive call) — surfaced as coming-soon, same pattern as other unwired nav items. */}
          <FlatMenuItem onSelect={() => toast.info("Archiving chats is coming soon")}>
            <FolderLibraryIcon size={18} color="var(--neutral-600)" />
            Archive
          </FlatMenuItem>
          <DropdownMenu.Separator style={{ height: "1px", backgroundColor: "var(--neutral-100)", margin: "4px 0" }} />
          <FlatMenuItem destructive onSelect={handleDelete}>
            <DeleteTwoIcon size={18} color="var(--red-500)" />
            Delete
          </FlatMenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    <MoveToProjectModal
      open={moveModalOpen}
      onClose={() => setMoveModalOpen(false)}
      onConfirm={handleMoveToProject}
      projects={projects.map((p) => ({ id: p.id, name: p.name, description: p.description }))}
      chatCount={1}
    />
    </>
  )
}

// -- FlatPinnedSection / FlatRecentsSection — same self-hide + hydration guard as originals.
// "Pinned" is the user-facing name for chat.starred — kept as `starred`/`star` internally
// to match the API contract (src/lib/api/chat.ts), mirroring the agent/persona split. --

function FlatPinnedSection({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const [shown, setShown] = useState(true)
  const pinnedChats = chatHistory.chats.filter((c) => c.starred)
  if (pinnedChats.length === 0) return null
  return (
    <>
      <FlatSidebarRow variant="header" label="Pinned" shown={shown} onShowClick={() => setShown((s) => !s)} />
      {shown && pinnedChats.map((chat) => (
        <FlatChatHistoryItem
          key={chat.id} chat={chat} isActive={chat.id === activeChatId} onSelect={onSelectChat}
          onRename={chatHistory.rename} onDelete={async (chatId) => { await chatHistory.remove(chatId) }} onStar={chatHistory.star}
        />
      ))}
      {/* Gap before Recent Chats — only takes up space when Pinned actually rendered (see the early return above). */}
      <div aria-hidden style={{ height: 12 }} />
    </>
  )
}

function FlatRecentsSection({ activeChatId, onSelectChat, chatHistory, onNewChat }: SectionProps & { onNewChat?: () => void }) {
  const { chats, isLoading, hasMore, loadMore, rename, remove, star } = chatHistory
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const loading = mounted && isLoading
  const [shown, setShown] = useState(true)
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible")

  return (
    <>
      <FlatSidebarRow
        variant="header" label="Recent Chats" shown={shown} onShowClick={() => setShown((s) => !s)}
        onAddClick={onNewChat ? (e) => { e.stopPropagation(); onNewChat() } : undefined} addLabel="New chat"
      />
      <m.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden") }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible") }}
      >
        <m.div
          animate={shown ? "open" : "closed"}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
        >
          {loading && chats.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => <SidebarMenuSkeleton key={i} index={i} fluid />)
          ) : chats.length === 0 ? (
            <div style={{ padding: "8px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>No chats yet</div>
          ) : (
            <>
              {chats.map((chat) => (
                <m.div key={chat.id} variants={sectionItemVariants}>
                  <FlatChatHistoryItem
                    chat={chat} isActive={chat.id === activeChatId} onSelect={onSelectChat}
                    onRename={rename} onDelete={async (chatId) => { await remove(chatId) }} onStar={star}
                  />
                </m.div>
              ))}
              {hasMore && (
                <m.div variants={sectionItemVariants}>
                  <FlatSidebarRow variant="default" label="Load more" onClick={loadMore} />
                </m.div>
              )}
            </>
          )}
        </m.div>
      </m.div>
    </>
  )
}

// -- FlatProjectChatItem — onto FlatSidebarProjectGroup's nested children -----

interface FlatProjectChatItemProps {
  chat: ProjectChat
  isActive: boolean
  href?: string
  onSelect: () => void
  onRename: (chatId: string, title: string) => Promise<void>
  onDelete: (chatId: string) => void
}

function FlatProjectChatItem({ chat, isActive, href, onSelect, onRename, onDelete }: FlatProjectChatItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pendingRenameRef = useRef(false)

  const handleCommit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== chat.title) void onRename(chat.id, trimmed)
    setIsEditing(false)
  }
  const handleDelete = () => {
    openDeleteChatDialog({ chatId: chat.id, chatTitle: chat.title, onConfirm: async () => onDelete(chat.id) })
  }

  return (
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <div style={{ position: "relative", width: "100%" }}>
        <FlatSidebarRow
          variant={isEditing ? "chat-item-edit" : "chat-item"}
          label={chat.title}
          selected={isActive}
          href={isEditing ? undefined : href}
          onClick={() => { if (!isEditing) onSelect() }}
          onMoreClick={(e) => { e.stopPropagation(); setMenuOpen(true) }}
          onRename={() => setIsEditing(true)}
          onCommit={handleCommit}
          onCancel={() => setIsEditing(false)}
        />
        <DropdownMenu.Trigger style={{ position: "absolute", right: "8px", top: "50%", width: 1, height: 1, opacity: 0, pointerEvents: "none", border: "none", background: "none", padding: 0 }} />
      </div>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right" align="start" sideOffset={8} avoidCollisions collisionPadding={8}
          onCloseAutoFocus={(e) => { if (pendingRenameRef.current) { e.preventDefault(); pendingRenameRef.current = false } }}
          style={{ backgroundColor: "var(--neutral-white)", borderRadius: "12px", padding: "4px", boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)", zIndex: 5, minWidth: "168px", outline: "none" }}
        >
          <FlatMenuItem onSelect={() => { pendingRenameRef.current = true; setIsEditing(true) }}>Rename</FlatMenuItem>
          <DropdownMenu.Separator style={{ height: "1px", backgroundColor: "var(--neutral-100)", margin: "4px 0" }} />
          <FlatMenuItem destructive onSelect={handleDelete}>Delete</FlatMenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// -- FlatProjectItemsList — the reusable body of a project section (loading
// skeleton, empty state, up to `limit` FlatSidebarProjectGroup rows). Shared
// by FlatProjectsSection (no-org case) and FlatTeamsSidebarContent (org case,
// personal + active-team projects merged into one filter) so both render off
// the same list logic. --

interface FlatProjectItemsListProps {
  projectsFilter: (project: Project) => boolean
  limit: number
  emptyLabel: string
}

function FlatProjectItemsList({ projectsFilter, limit, emptyLabel }: FlatProjectItemsListProps) {
  const { push } = useGuardedRouter()
  const pathname = usePathname()
  const chatHistory = useChatHistoryContext()
  const { projects: allProjects, loading: projectsLoading, getChats, removeChat, renameChat, loadProjectChats } = useProjects()

  // Sorted by recency so "top `limit`" means most-recently-updated, not just
  // whatever order the API happened to return — matters most for
  // FlatTeamsSidebarContent, which merges personal + active-team projects
  // into one filtered pool before slicing.
  const projects = useMemo(() => sortProjectsByRecency(allProjects.filter(projectsFilter)), [allProjects, projectsFilter])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const visibleProjects = useMemo(() => projects.slice(0, limit), [projects, limit])

  React.useEffect(() => {
    visibleProjects.forEach(project => {
      if (project.chatCount > 0 && getChats(project.id).length === 0) void loadProjectChats(project.id)
    })
  }, [visibleProjects, getChats, loadProjectChats])

  React.useEffect(() => {
    const active = projects.find(p => pathname.startsWith(PROJECT_ROUTE(p.id)))
    if (!active) return
    setExpandedIds(prev => {
      if (prev.has(active.id)) return prev
      const next = new Set(prev)
      next.add(active.id)
      return next
    })
  }, [pathname, projects])

  function toggleExpand(id: string, expanded: boolean) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      expanded ? next.add(id) : next.delete(id)
      return next
    })
  }

  return (
    <>
      {projectsLoading && projects.length === 0 && Array.from({ length: 2 }).map((_, i) => <SidebarMenuSkeleton key={i} index={i} fluid />)}
      {!projectsLoading && projects.length === 0 && (
        <div style={{ padding: "8px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>{emptyLabel}</div>
      )}
      {!projectsLoading && visibleProjects.map(project => {
        const chats = sortChatsByRecency(getChats(project.id).filter(c => c.canEdit !== false))
        const isActive = pathname.startsWith(PROJECT_ROUTE(project.id))
        const isExpanded = expandedIds.has(project.id)
        return (
          <m.div key={project.id} variants={sectionItemVariants}>
            <FlatSidebarProjectGroup
              label={project.name}
              active={isActive || isExpanded}
              expanded={isExpanded}
              onExpandedChange={(v) => toggleExpand(project.id, v)}
              onNewChat={() => push(PROJECT_CHAT_NEW_ROUTE(project.id))}
              onOpen={() => push(PROJECT_ROUTE(project.id))}
            >
              {chats.slice(0, CHAT_LIMIT).map(chat => (
                <FlatProjectChatItem
                  key={chat.id} chat={chat} isActive={pathname === PROJECT_CHAT_ROUTE(project.id, chat.id)}
                  href={PROJECT_CHAT_ROUTE(project.id, chat.id)} onSelect={() => push(PROJECT_CHAT_ROUTE(project.id, chat.id))}
                  onRename={async (chatId, title) => { renameChat(project.id, chatId, title); await chatHistory.rename(chatId, title) }}
                  onDelete={(chatId) => removeChat(project.id, chatId)}
                />
              ))}
              {project.chatCount === 0 ? (
                <div style={NO_CHATS_YET_STYLE}>No chats yet</div>
              ) : (
                <FlatSidebarRow
                  variant="default" icon={<MoreHorizontalIcon size={20} animated />} label="See all chats"
                  selected={pathname === PROJECT_ROUTE(project.id)} href={PROJECT_ROUTE(project.id)} onClick={() => push(PROJECT_ROUTE(project.id))}
                />
              )}
            </FlatSidebarProjectGroup>
          </m.div>
        )
      })}
    </>
  )
}

// -- FlatProjectsSection — same PROJECT_LIMIT/CHAT_LIMIT/canEdit/auto-expand logic as ProjectsSection --

function FlatProjectsSection({
  label = "Projects",
  showNewProject = true,
  projectsFilter,
  newProjectHref = PROJECTS_NEW_ROUTE,
  emptyLabel = "No projects yet",
  headerIcon,
}: ProjectsSectionProps) {
  const { push } = useGuardedRouter()
  const [shown, setShown] = useState(true)
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible")
  const filter = useCallback((p: Project) => (projectsFilter ? projectsFilter(p) : true), [projectsFilter])

  return (
    <>
      <FlatSidebarRow
        variant="header" label={label} shown={shown} onShowClick={() => setShown(s => !s)}
        onAddClick={showNewProject ? (e) => { e.stopPropagation(); push(newProjectHref) } : undefined} addLabel="New Project"
        headerIcon={headerIcon}
        onHeaderIconClick={headerIcon ? () => push(PROJECTS_ROUTE) : undefined}
        headerIconLabel="All Projects"
      />
      <m.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden") }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible") }}
      >
        <m.div
          animate={shown ? "open" : "closed"}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
        >
          <FlatProjectItemsList projectsFilter={filter} limit={PROJECT_LIMIT} emptyLabel={emptyLabel} />
        </m.div>
      </m.div>
    </>
  )
}

// -- FlatTeamsSidebarContent — one "Projects" header, one combined list:
// the viewer's personal projects and the active team's projects merged
// together, top PROJECT_LIMIT shown, one "See all projects" link. Team
// switching lives in the AccountMenu; switching teams here only changes
// which team's projects are merged in (key= remounts the list, resetting
// its expand state). --

function FlatTeamsSidebarContent({ role }: TeamsSidebarContentProps) {
  const { push } = useGuardedRouter()
  const isAdmin = role !== 'member'

  const [shown, setShown] = useState(true)
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible")

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <FlatSidebarRow
        variant="header" label="Projects" shown={shown} onShowClick={() => setShown(s => !s)}
        onAddClick={isAdmin ? (e) => { e.stopPropagation(); push('/projects/new') } : undefined} addLabel="New Project"
        headerIcon={<FolderOneIcon size={14} variant="static" />}
        onHeaderIconClick={() => push(PROJECTS_ROUTE)}
        headerIconLabel="All Projects"
      />
      <m.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden") }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible") }}
      >
        <m.div
          animate={shown ? "open" : "closed"}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
        >
          <FlatProjectItemsList
            projectsFilter={includeAllProjects}
            limit={PROJECT_LIMIT}
            emptyLabel="No projects yet"
          />
        </m.div>
      </m.div>
    </div>
  )
}

// -- FlatDestinations — New / Agents / Schedules / Connectors / Slack ---------
// Plain nav rows per the Figma scan (no expand arrows) — Agents/Schedules
// navigate straight to their pages rather than expanding an inline tree; see
// the open question in docs/features/sidebar-current-state-audit.md and the
// migration plan about confirming this against design before this ships.

interface FlatDestinationsProps {
  onNewChat: () => void
  isTeamUser: boolean
  /** New chat, or an idle (no thread loaded) Brain page — either counts as "New". */
  newChatSelected: boolean
  collapsed?: boolean
}

function FlatDestinations({ onNewChat, isTeamUser, newChatSelected, collapsed = false }: FlatDestinationsProps) {
  const { push } = useGuardedRouter()
  const pathname = usePathname()
  const { orgId } = useOrg()
  const [slackConnected, setSlackConnected] = useState(false)

  useEffect(() => {
    if (!orgId) { setSlackConnected(false); return }
    let cancelled = false
    getOrgSlackStatus(orgId).then(status => { if (!cancelled) setSlackConnected(status.connected) }).catch(() => {})
    return () => { cancelled = true }
  }, [orgId])

  return (
    <>
      <FlatSidebarRow collapsed={collapsed} variant="default" icon={<QuillWriteTwoIcon size={20} animated />} label="New" selected={newChatSelected} onClick={onNewChat} />
      <FlatSidebarRow
        collapsed={collapsed} variant="default" icon={<UserAiIcon size={20} />} label="Agents"
        selected={pathname.startsWith(AGENTS_ROUTE) || pathname.startsWith('/agent/')}
        href={AGENTS_ROUTE} onClick={() => push(AGENTS_ROUTE)}
      />
      <FlatSidebarRow
        collapsed={collapsed} variant="default" icon={<CalendarThreeIcon size={20} animated />} label="Schedules"
        selected={pathname.startsWith(BRAIN_SCHEDULES_ROUTE)} href={BRAIN_SCHEDULES_ROUTE} onClick={() => push(BRAIN_SCHEDULES_ROUTE)}
      />
      <FlatSidebarRow
        collapsed={collapsed} variant="default" icon={<LinkSixIcon size={20} animated />} label="Connectors"
        selected={pathname.startsWith(ORG_CONNECTORS_ROUTE) || pathname.startsWith(SETTINGS_CONNECTORS_ROUTE)}
        href={isTeamUser ? ORG_CONNECTORS_ROUTE : SETTINGS_CONNECTORS_ROUTE}
        onClick={() => push(isTeamUser ? ORG_CONNECTORS_ROUTE : SETTINGS_CONNECTORS_ROUTE)}
      />
      {/* "Slack in Souvenir" / "Souvenir in Slack" — same feature, own dedicated
          top-level page (moved from /org/souvenir-slack to /souvenir-slack). */}
      <FlatSidebarSlackConnector
        collapsed={collapsed}
        connected={slackConnected}
        selected={pathname.startsWith(ORG_SOUVENIR_SLACK_ROUTE)}
        onAdd={() => push(ORG_SOUVENIR_SLACK_ROUTE)}
        onClick={() => push(ORG_SOUVENIR_SLACK_ROUTE)}
      />
    </>
  )
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
  const { push } = useGuardedRouter();
  const { guardedNavigate } = useNavGuard();
  const pathname = usePathname();
  const chatSearchParams = useSearchParams();
  const { user, logout, isAuthenticated } = useAuth();
  const chatHistory = useChatHistoryContext();
  const { chats: projectChats, getProject } = useProjects();
  const { orgId, org, plan, orgRole, currentUserRole } = useOrg();

  // -- Global search ---------------------------------------------------------
  const { searchOpen, openSearch } = useSearch();

  // -- Account menu: Report a bug modal ---------------------------------------
  const [reportBugOpen, setReportBugOpen] = useState(false);

  const isPersonaPage = pathname?.startsWith("/agents") || pathname?.startsWith("/agent");
  // Trailing slash matters: bare "/project" also prefix-matches "/projects"
  // and "/projects/new" (the listing pages), which must NOT be treated as a
  // project detail page here (unlike AppLayout's own, intentionally broader
  // isAnyProjectPage check).
  const isProjectPage = pathname?.startsWith("/project/") ?? false;
  const isBrainPage   = pathname?.startsWith("/brain") ?? false;

  // Detect team project context: extract the project id from the path and look
  // up its teamId so the agents tab can show only team-shared agents.
  const currentProjectId   = isProjectPage ? (pathname?.match(/^\/project\/([^/]+)/)?.[1] ?? null) : null
  const currentProject     = currentProjectId ? getProject(currentProjectId) : undefined
  const currentProjectTeamId = currentProject?.teamId ?? null
  const isAdminPage   = pathname?.startsWith("/org") ?? false;
  const isNewChatPage = pathname === CHAT_ROUTE && !chatSearchParams.get('id');
  // Flat sidebar's "New" row highlights for either flavor of "blank slate" —
  // a new chat or an idle (no thread loaded) Brain page — same condition the
  // old sidebar's newChatButtonSelected already used for the Brain case. Must
  // be an exact match on BRAIN_ROUTE, not the isBrainPage prefix check — that
  // also matches /brain/schedules and /brain/threads, which lit up "New"
  // alongside "Schedules" incorrectly.
  const isNewChatOrBrainThreadPage = isNewChatPage || (pathname === BRAIN_ROUTE && !chatSearchParams.get('id'));

  // Map the current /org/* path to its admin-section item id so the sidebar
  // can highlight the correct row on initial mount / page refresh. Connectors
  // and Souvenir-in-Slack moved to their own top-level routes (no longer under
  // /org/*), so everything actually left here is a transient redirect stub —
  // this id only needs a harmless fallback while that stub briefly renders.
  const adminItemId = !isAdminPage ? undefined
    : 'general'

  // Determines which Sidebar key to use (triggers remount on section change).
  // Admin pages use a per-item key so the sidebar remounts on each admin page
  // navigation, allowing defaultSelectedItem to pre-highlight the right row.
  const sidebarSectionKey = isPersonaPage ? 'persona'
    : isProjectPage ? 'projects'
    : isBrainPage   ? 'brain'
    : isAdminPage   ? `admin-${adminItemId}`
    : isNewChatPage ? 'new-chat'
    : 'chat-board';

  const computedDefaultBodySection = (
    isPersonaPage ? 'agents'
    : isProjectPage ? 'projects'
    : isBrainPage   ? 'brain'
    : isAdminPage ? 'admin'
    : isNewChatPage ? 'new-chat'
    : 'chats'
  ) as 'chats' | 'agents' | 'brain' | 'admin' | 'new-chat' | 'projects';

  const collapsedRef = useRef<boolean>(readCollapsed());

  // -- Brain scheduled tasks — fetched once when first visiting a brain page --
  // Lifted here so the list survives brain-tab switches without re-fetching.
  const [brainTasks, setBrainTasks] = useState<Automation[]>([]);
  const [brainTasksLoading, setBrainTasksLoading] = useState(false);
  const [brainTaskRunInfo, setBrainTaskRunInfo] = useState<Record<string, ScheduleRunInfo>>({});
  const brainTasksFetchedRef = useRef(false);
  useEffect(() => {
    if (!isBrainPage || brainTasksFetchedRef.current) return;
    brainTasksFetchedRef.current = true;
    setBrainTasksLoading(true);
    listAutomations()
      .then(async (tasks) => {
        setBrainTasks(tasks);
        // Per-task run history isn't on the list payload — fetch each task's
        // detail (already-existing endpoint) to derive the status dot + badge.
        const entries = await Promise.all(tasks.map(async (task) => {
          try {
            const detail = await getAutomation(task.id);
            const lastSeenAt = getScheduleLastSeenAt(task.id);
            const info = computeScheduleRunInfo(detail.runs ?? [], lastSeenAt);
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.debug("[BrainSchedules] run info", { taskId: task.id, name: task.name, runs: detail.runs?.length ?? 0, info });
            }
            return [task.id, info] as const;
          } catch (err) {
            console.error("[BrainSchedules] failed to fetch task detail for status indicator", task.id, err);
            return [task.id, { lastRunStatus: null, newRunsCount: 0 } as ScheduleRunInfo] as const;
          }
        }));
        setBrainTaskRunInfo(Object.fromEntries(entries));
      })
      .catch(() => {})
      .finally(() => setBrainTasksLoading(false));
  }, [isBrainPage]);

  const handleScheduleOpened = useCallback((taskId: string) => {
    markScheduleSeen(taskId);
    setBrainTaskRunInfo((prev) =>
      prev[taskId] ? { ...prev, [taskId]: { ...prev[taskId], newRunsCount: 0 } } : prev,
    );
  }, []);

  // Exclude project chats from the Recents/Starred lists - they are already
  // shown inside the Projects section and would be confusing duplicates.
  const projectChatIdSet = useMemo(
    () => new Set(projectChats.map(c => c.id)),
    [projectChats],
  );
  // Recent Chats is a personal, cross-workspace list: it always shows the
  // user's own recent chats regardless of which team/personal context the
  // team switcher currently points at (unlike Projects, which does split by
  // workspace). Only project-linked chats are excluded, since those already
  // surface inside the Projects section.
  const filteredChatHistory = useMemo(() => {
    const chats = chatHistory.chats.filter(c => !projectChatIdSet.has(c.id));
    return { ...chatHistory, chats };
  }, [chatHistory, projectChatIdSet]);

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
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsedRef.current));
    }
  };

  const handleNewChat = () => {
    // NOTE: previously short-circuited to push(AGENTS_ROUTE) when isPersonaPage —
    // that matched the old tabbed Sidebar, where this handler was never actually
    // invoked while on the Agents tab (it had its own separate onNewAgentChat).
    // The new flat sidebar's "New" row calls this unconditionally from every
    // page, so that branch just made "New" a no-op on /agents and any
    // /agents/[id]/chat page — removed; "New" now always opens a blank chat.
    const isAlreadyOnNewChat = pathname === CHAT_ROUTE && !new URLSearchParams(window.location.search).get("id");
    if (isAlreadyOnNewChat) {
      toast.info("Already on new chat");
      return;
    }
    toast.info("Opening new chat");
    if (onNewChat) {
      onNewChat();
    } else if (pathname === CHAT_ROUTE) {
      // Already mounted on the chat page (viewing an existing chat) — same
      // event-bus pattern Brain uses for its "New thread" button (see
      // BRAIN_NEW_THREAD_EVENT below): URL navigation alone isn't reliably
      // picked up by the page's own reactive id-change detection, so the
      // page resets itself directly off this event instead. Still push the
      // URL too, so it correctly reflects the reset (history/bookmarking).
      emitSidebarNewChat();
      push(CHAT_ROUTE);
    } else {
      push(CHAT_ROUTE);
    }
  };

  const handleSelectChat = (id: string) => {
    if (onSelectChat) {
      onSelectChat(id);
    } else {
      push(`${CHAT_ROUTE}?id=${id}`);
    }
  };

  const displayName = user
    ? user.firstName?.trim() || user.name?.split(" ")[0]?.trim() || ""
    : "";

  // Role chip next to the wordmark. admin/owner show their single org-level
  // role; anyone else in an org shows 'member' — there's no team-level role
  // to add to it any more.
  const displayRole = (orgRole === 'owner' || orgRole === 'admin')
    ? orgRole
    : (orgId ? 'member' : undefined)
  const orgBadgeSublabel = orgId && displayRole
    ? displayRole.charAt(0).toUpperCase() + displayRole.slice(1)
    : undefined
  const orgBadgeChipColor: ChipColor =
    displayRole === 'owner'  ? 'Purple' :
    displayRole === 'admin'  ? 'Blue'   :
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

  // Souvenir V1.5: Admin pages keep the old tabbed Sidebar completely
  // unchanged (see docs/features/sidebar-current-state-audit.md and the
  // migration plan for why); Brain now also gets the flat shell — its
  // Recents section falls back to the same personal/team chat recents every
  // other page shows (no inline Brain-thread list or per-schedule run-status
  // icons in the sidebar anymore; "Schedules" is still reachable as a plain
  // Destinations nav link to /brain/schedules).
  const useFlatSidebar = !isAdminPage;

  if (useFlatSidebar) {
    return (
      <>
        <FlatSidebar
          onSearch={openSearch}
          searchActive={searchOpen}
          onCollapse={handleCollapse}
          defaultCollapsed={collapsedRef.current}
          destinationsItems={(collapsed) => <FlatDestinations onNewChat={handleNewChat} isTeamUser={isTeamUser} newChatSelected={isNewChatOrBrainThreadPage} collapsed={collapsed} />}
          projectItems={orgId ? (
            <FlatTeamsSidebarContent role={currentUserRole} />
          ) : (
            <FlatProjectsSection label="Personal Projects" headerIcon={<FolderOneIcon size={14} variant="static" />} />
          )}
          recentItems={
            !user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SidebarMenuSkeleton key={i} index={i} fluid />
                ))}
              </div>
            ) : isBrainPage ? (
              // Task side of the Task/Chat tab (src/templates/Brain/index.tsx,
              // src/app/(app)/chat/page.tsx) — Recents shows Brain threads
              // instead of regular chats while on a Brain page.
              <FlatBrainSidebarSections
                activeChatId={chatSearchParams.get('id') ?? null}
                onThreadClick={(id) => push(`${BRAIN_ROUTE}?id=${id}`)}
              />
            ) : (
              <>
                <FlatPinnedSection {...sectionProps} />
                <FlatRecentsSection {...sectionProps} onNewChat={handleNewChat} />
              </>
            )
          }
          accountMenu={(collapsed) => {
            if (!user) {
              return (
                <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                  {!collapsed && (
                    <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div className="kaya-skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
                      <div className="kaya-skeleton" style={{ height: 11, width: '42%', borderRadius: 4 }} />
                    </div>
                  )}
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
                renderTrigger={({ onOpenSettingsClick }) => (
                  <FlatSidebarProfileRow
                    name={displayName || "Account"}
                    sublabel={planLabel}
                    avatarSrc={user?.profilePicture ?? undefined}
                    planLabel={!orgId && user?.planType ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1) : undefined}
                    onOpenSettingsClick={onOpenSettingsClick}
                    collapsed={collapsed}
                  />
                )}
                onProfile={() => push(SETTINGS_ACCOUNT_ROUTE)}
                onUpgradePlan={() => push(SETTINGS_BILLING_ROUTE)}
                onSettings={() => push(SETTINGS_ROUTE)}
                onOrganization={(orgId && (orgRole === 'owner' || orgRole === 'admin')) ? () => push(ORG_GENERAL_ROUTE) : undefined}
                onWhatsNew={() => toast.info("What's new — coming soon!")}
                onHelp={() => push(SETTINGS_HELP_ROUTE)}
                onManageConnectors={() => push(isTeamUser ? ORG_CONNECTORS_ROUTE : SETTINGS_CONNECTORS_ROUTE)}
                onReportBug={() => setReportBugOpen(true)}
                onLogOut={() => guardedNavigate(() => { if (isAuthenticated) { void logout() } else { push(AUTH_LOGIN_ROUTE) } })}
              />
            )
          }}
        />
        {reportBugOpen && <ReportBugModal onClose={() => setReportBugOpen(false)} />}
      </>
    );
  }

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
        isPersonaPage ? pathname === AGENTS_ROUTE
        : isBrainPage ? (pathname === BRAIN_ROUTE && !chatSearchParams.get('id'))
        : isNewChatPage
      }
      onSearch={openSearch}
      onChatTabClick={isPersonaPage ? () => push(CHAT_ROUTE) : handleNewChat}
      onChatsClick={() => { toast.info("Opening Chat Board", { id: 'nav' }); push(CHATS_ROUTE) }}
      onChatboardClick={() => { toast.info("Opening Chat Board", { id: 'nav' }); push(CHATS_ROUTE) }}
      onManageAllThreadsClick={() => { toast.info("Opening Brain Threads", { id: 'nav' }); push(BRAIN_THREADS_ROUTE) }}
      // Use a URL command so this works even when the current thread is an
      // unsaved session already at bare `/brain`. The page consumes `?new=1`,
      // performs its complete imperative reset, then cleans the URL.
      onNewBrainThread={() => push(`${BRAIN_ROUTE}?new=1`)}
      onProjectsClick={() => { toast.info("Opening Projects", { id: 'nav' }); push(PROJECTS_ROUTE) }}
      onPersonasClick={() => { toast.info("Opening Agents", { id: 'nav' }); push(AGENTS_ROUTE) }}
      onNewAgentChat={() => push(AGENTS_ROUTE)}
      agentItems={
        currentProjectTeamId ? <PersonasSectionAll teamId={currentProjectTeamId} />
        : isTeamUser         ? <PersonasSectionAll />
        :                      <PersonasSectionIndividual />
      }
      onAllAgentsClick={() => { toast.info("Opening Agents", { id: 'nav' }); push(AGENTS_ROUTE) }}
      onBrainClick={() => { toast.info("Opening Brain", { id: 'nav' }); push(BRAIN_ROUTE) }}
      // Clicking the admin tab switches the sidebar body to admin AND navigates
      // to General — always landing on General regardless of prior admin page.
      onOrganisationClick={() => push(ORG_GENERAL_ROUTE)}
      // "Manage <org>" row (and its collapsed-rail twin) land on the same org
      // management entry point as the header org badge.
      onManageOrg={() => push(ORG_GENERAL_ROUTE)}
      // adminGroups is intentionally NOT overridden — the Sidebar's default
      // groups (Organization / Models) are the canonical content.
      // We only wire behaviour: navigate where a page exists, else "coming soon".
      adminGroups={isAdminPage ? ORG_ADMIN_GROUPS : undefined}
      onAdminSectionClick={(id) => {
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
            onProfile={() => push(SETTINGS_ACCOUNT_ROUTE)}
            onUpgradePlan={() => push(SETTINGS_BILLING_ROUTE)}
            onSettings={() => push(SETTINGS_ROUTE)}
            onOrganization={(orgId && (orgRole === 'owner' || orgRole === 'admin')) ? () => push(ORG_GENERAL_ROUTE) : undefined}
            onWhatsNew={() => toast.info("What's new — coming soon!")}
            onHelp={() => push(SETTINGS_HELP_ROUTE)}
            onManageConnectors={() => push(SETTINGS_CONNECTORS_ROUTE)}
            onReportBug={() => setReportBugOpen(true)}
            onLogOut={() => guardedNavigate(() => { if (isAuthenticated) { void logout() } else { push(AUTH_LOGIN_ROUTE) } })}
          />
        )
      }}
      onSchedulesClick={() => { toast.info("Opening Schedules", { id: 'nav' }); push(BRAIN_SCHEDULES_ROUTE) }}
      projectItems={orgId ? (
        <TeamsSidebarContent role={currentUserRole} />
      ) : (
        <ProjectsSection label="Personal Projects" />
      )}
      scheduledTasksItems={isBrainPage ? (
        <BrainScheduledTasksSection
          tasks={brainTasks}
          loading={brainTasksLoading}
          runInfo={brainTaskRunInfo}
          onTaskOpened={handleScheduleOpened}
        />
      ) : undefined}
      brainRecentItems={
        <BrainSidebarSections
          activeChatId={isBrainPage ? (chatSearchParams.get('id') ?? null) : null}
          onThreadClick={(id) => push(`${BRAIN_ROUTE}?id=${id}`)}
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
        ) : isBrainPage ? null : (
          // Both sections share sectionProps; StarredSection self-hides when empty.
          // Rendered on every other page — including project pages, whose own
          // "projects" body-section tab is separate from this "chats" one — so
          // Recent Chats is never silently hidden behind a disconnected placeholder.
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <StarredSection {...sectionProps} />
            <RecentsSection {...sectionProps} />
          </div>
        )
      }
    />
    {reportBugOpen && <ReportBugModal onClose={() => setReportBugOpen(false)} />}
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
