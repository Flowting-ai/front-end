import type React from "react";
import type { Project, ProjectChat } from "@/context/projects-context";

// -- Projects section - reads from ProjectsContext ------------------------------

export const PROJECT_LIMIT = 5
// Sidebar folders only ever surface a quick-glance slice of a project's
// chats — "See all chats" is the entry point for the rest.
export const CHAT_LIMIT    = 5

export function sortChatsByRecency(chats: ProjectChat[]): ProjectChat[] {
  return [...chats].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// Sits where "See all chats" would — same 32px row height and 8px inset —
// for a project whose `chatCount` is genuinely 0, not just still loading.

export function sortProjectsByRecency(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// Extracts the project id from a pathname matching PROJECT_ROUTE's shape
// (`/project/{id}` or a nested route under it), or null if it doesn't match.
// Used to synchronously seed which project's sidebar row should start
// expanded, straight from the URL, instead of waiting for the projects list
// to load and an effect to react to it — pathname is identical on the server
// render and the client's first render, so this carries no hydration-mismatch
// risk (unlike branching on `typeof window` or reading sessionStorage).
// Closes the gap where the row used to animate open a beat after paint,
// which Lighthouse (correctly) measured as layout shift.
export function activeProjectIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/project\/([^/]+)/)
  return match ? match[1] : null
}

export interface ProjectsSectionProps {
  label?: string
  showNewProject?: boolean
  projectsFilter?: (project: Project) => boolean
  newProjectHref?: string
  emptyLabel?: string
  /** FlatProjectsSection only — persistent icon in the header row, left of the add button. */
  headerIcon?: React.ReactNode
}

// -- Teams sidebar components --------------------------------------------------
// Team no longer exists as a backend entity — "workspace projects" here means
// every project visible to the organization (visibility 'workspace' or
// 'shared'). NOT project.teamId !== null — an org member's own Personal
// project also carries the org's teamId server-side (project.py sets
// organizationId on every project a member creates, regardless of
// visibility), so a teamId check would wrongly pull personal projects into
// this list. Keyed off visibility to match /projects' own scope tabs.

export interface TeamsSidebarContentProps {
  role: 'admin' | 'member'
}

// Stable references so they don't defeat memoization in ProjectsSection/
// FlatProjectItemsList, which key their own useMemo off these functions.
export const isOrgSharedProject = (project: Project) => project.visibility === 'workspace' || project.visibility === 'shared'
// FlatTeamsSidebarContent merges the viewer's personal and org-shared
// projects into one list — no team layer left to filter by.
export const includeAllProjects = () => true
