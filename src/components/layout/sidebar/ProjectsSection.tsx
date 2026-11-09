"use client";

import React, { useMemo, useState } from "react";
import { m } from "framer-motion";
import { usePathname } from "next/navigation";
import { useGuardedRouter } from "@/context/nav-guard-context";
import { SidebarEmptyState } from "./SidebarEmptyState";
import { FolderAddIcon, MoreHorizontalIcon } from "@strange-huge/icons";
import { SidebarMenuItem, SidebarMenuSkeleton, SidebarProjectsSection } from "@/components/ui";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { PROJECT_ROUTE, PROJECT_CHAT_ROUTE, PROJECTS_ROUTE, PROJECTS_NEW_ROUTE } from "@/lib/routes";
import { sectionHeightVariants, sectionStaggerVariants, sectionItemVariants } from "./section-motion";
import { PROJECT_LIMIT, CHAT_LIMIT, sortChatsByRecency, activeProjectIdFromPathname, isOrgSharedProject } from "./project-helpers";
import type { ProjectsSectionProps, TeamsSidebarContentProps } from "./project-helpers";
import { ProjectChatItem } from "./ProjectChatItem";

export function ProjectsSection({
  label = "Projects",
  showNewProject = true,
  projectsFilter,
  newProjectHref = PROJECTS_NEW_ROUTE,
  emptyLabel = "No projects yet",
}: ProjectsSectionProps) {
  const { push }    = useGuardedRouter()
  const pathname    = usePathname()
  const chatHistory = useChatHistoryContext()
  const { projects: allProjects, loading: projectsLoading, getChats, removeChat, moveChatOutOfProject, renameChat, loadProjectChats } = useProjects()

  const [shown,        setShown]        = useState(true)
  const [overflow,     setOverflow]     = useState<"visible" | "hidden">("visible")
  const projects = useMemo(
    () => projectsFilter ? allProjects.filter(projectsFilter) : allProjects,
    [allProjects, projectsFilter],
  )
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(() => {
    const id = activeProjectIdFromPathname(pathname)
    return id ? new Set([id]) : new Set()
  })

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
                onClick={() => push(pathname === newProjectHref ? `${newProjectHref}?t=${Date.now()}` : newProjectHref)}
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
            <SidebarEmptyState
              label={emptyLabel}
              actionLabel="New project"
              onAction={() => push(pathname === newProjectHref ? newProjectHref + "?t=" + Date.now() : newProjectHref)}
            />
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
                      onRemoveFromProject={(chatId) => moveChatOutOfProject(project.id, chatId)}
                    />
                  ))}
                  {project.chatCount === 0 ? (
                    <SidebarEmptyState label="No chats yet" />
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

export function TeamsSidebarContent({ role }: TeamsSidebarContentProps) {
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
