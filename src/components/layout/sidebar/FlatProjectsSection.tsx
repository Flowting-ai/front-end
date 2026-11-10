"use client";

import React, { useCallback, useMemo, useState } from "react";
import { m } from "framer-motion";
import { usePathname } from "next/navigation";
import { useGuardedRouter } from "@/context/nav-guard-context";
import { FolderLibraryIcon, FolderThreeIcon, MoreHorizontalIcon } from "@strange-huge/icons";
import { IconWithFallback } from "@/components/IconWithFallback";
import { SidebarMenuSkeleton, FlatSidebarRow, FlatSidebarProjectGroup } from "@/components/ui";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { emitProjectNewChat } from "@/hooks/use-sidebar-events";
import type { Project } from "@/context/projects-context";
import { PROJECT_ROUTE, PROJECT_CHAT_ROUTE, PROJECT_CHAT_NEW_ROUTE, PROJECTS_ROUTE, PROJECTS_NEW_ROUTE } from "@/lib/routes";
import { sectionHeightVariants, sectionStaggerVariants, sectionItemVariants } from "./section-motion";
import { PROJECT_LIMIT, CHAT_LIMIT, sortChatsByRecency, NO_CHATS_YET_STYLE, sortProjectsByRecency, activeProjectIdFromPathname, includeAllProjects } from "./project-helpers";
import type { ProjectsSectionProps, TeamsSidebarContentProps } from "./project-helpers";
import { FlatProjectChatItem } from "./FlatProjectChatItem";
import { SidebarEmptyState } from "./SidebarEmptyState";

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
  const { projects: allProjects, loading: projectsLoading, getChats, removeChat, moveChatOutOfProject, renameChat, loadProjectChats } = useProjects()

  // Sorted by recency so "top `limit`" means most-recently-updated, not just
  // whatever order the API happened to return — matters most for
  // FlatTeamsSidebarContent, which merges personal + active-team projects
  // into one filtered pool before slicing.
  const projects = useMemo(() => sortProjectsByRecency(allProjects.filter(projectsFilter)), [allProjects, projectsFilter])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const id = activeProjectIdFromPathname(pathname)
    return id ? new Set([id]) : new Set()
  })
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
        <SidebarEmptyState label={emptyLabel} actionLabel="New project" onAction={() => push(PROJECTS_NEW_ROUTE)} />
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
              onNewChat={() => {
                // Belt-and-suspenders alongside the push: if a chat in this
                // project was already created this session (new → real id via
                // the URL-swap trick), the router thinks it never left
                // `/project/[id]/chat/new`, so pushing that same URL again is a
                // no-op — see PROJECT_NEW_CHAT_EVENT. The project chat page
                // listens for this and force-remounts itself instead.
                emitProjectNewChat({ projectId: project.id })
                push(PROJECT_CHAT_NEW_ROUTE(project.id))
              }}
              onOpen={() => push(PROJECT_ROUTE(project.id))}
            >
              {chats.slice(0, CHAT_LIMIT).map(chat => (
                <FlatProjectChatItem
                  key={chat.id} chat={chat} isActive={pathname === PROJECT_CHAT_ROUTE(project.id, chat.id)}
                  href={PROJECT_CHAT_ROUTE(project.id, chat.id)} onSelect={() => push(PROJECT_CHAT_ROUTE(project.id, chat.id))}
                  onRename={async (chatId, title) => { renameChat(project.id, chatId, title); await chatHistory.rename(chatId, title) }}
                  onDelete={async (chatId) => { await removeChat(project.id, chatId) }}
                  onRemoveFromProject={(chatId) => moveChatOutOfProject(project.id, chatId)}
                />
              ))}
              {project.chatCount === 0 ? (
                <div style={NO_CHATS_YET_STYLE}>No chats yet</div>
              ) : project.chatCount > CHAT_LIMIT ? (
                // Only when there's more to see than the CHAT_LIMIT rows already
                // listed above — a project with CHAT_LIMIT or fewer chats has
                // nothing left for this link to reveal.
                <FlatSidebarRow
                  variant="default" icon={<MoreHorizontalIcon size={20} animated />} label="See all chats"
                  selected={pathname === PROJECT_ROUTE(project.id)} href={PROJECT_ROUTE(project.id)} onClick={() => push(PROJECT_ROUTE(project.id))}
                />
              ) : null}
            </FlatSidebarProjectGroup>
          </m.div>
        )
      })}
    </>
  )
}

// -- FlatProjectsSection — same PROJECT_LIMIT/CHAT_LIMIT/canEdit/auto-expand logic as ProjectsSection --

export function FlatProjectsSection({
  label = "Projects",
  showNewProject = true,
  projectsFilter,
  newProjectHref = PROJECTS_NEW_ROUTE,
  emptyLabel = "No projects yet",
  headerIcon,
}: ProjectsSectionProps) {
  const { push } = useGuardedRouter()
  const pathname = usePathname()
  const [shown, setShown] = useState(true)
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible")
  const filter = useCallback((p: Project) => (projectsFilter ? projectsFilter(p) : true), [projectsFilter])

  return (
    <>
      <FlatSidebarRow
        variant="header" label={label} shown={shown} onShowClick={() => setShown(s => !s)}
        onAddClick={showNewProject ? (e) => {
          e.stopPropagation()
          // Plain push() to the exact same URL is a no-op when already on
          // /projects/new (same class of bug as the sidebar's other "New X"
          // buttons) — a cache-busting query param forces the page's own
          // remount gate to reset the half-filled draft form.
          push(pathname === newProjectHref ? `${newProjectHref}?t=${Date.now()}` : newProjectHref)
        } : undefined} addLabel="New Project"
        headerIcon={headerIcon}
        onHeaderIconClick={headerIcon ? () => push(`${PROJECTS_ROUTE}?scope=all`) : undefined}
        headerIconLabel="All Projects"
        actionsAlwaysVisible
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

export function FlatTeamsSidebarContent({ role }: TeamsSidebarContentProps) {
  const { push } = useGuardedRouter()
  const isAdmin = role !== 'member'

  const [shown, setShown] = useState(true)
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible")

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <FlatSidebarRow
        variant="header" label="Projects" shown={shown} onShowClick={() => setShown(s => !s)}
        onAddClick={isAdmin ? (e) => { e.stopPropagation(); push('/projects/new') } : undefined} addLabel="New Project"
        headerIcon={
          <IconWithFallback
            icon={<FolderLibraryIcon size={16} animated />}
            fallback={<FolderThreeIcon size={16} animated />}
          />
        }
        onHeaderIconClick={() => push(`${PROJECTS_ROUTE}?scope=all`)}
        headerIconLabel="All Projects"
        actionsAlwaysVisible
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
