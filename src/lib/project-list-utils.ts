import type { Project } from '@/context/projects-context'
import type { OrgMember } from '@/types/teams'
import type { SortKey } from '@/lib/project-filters'

export function sortProjects(projects: Project[], key: SortKey): Project[] {
  const copy = [...projects]
  if (key === 'az')     return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (key === 'za')     return copy.sort((a, b) => b.name.localeCompare(a.name))
  if (key === 'active') return copy.sort((a, b) => b.chatCount - a.chatCount)
  return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// A workspace/shared project's member count is its team's roster (everyone
// who can reach it); a personal project's is just its owner — there's no
// separate per-project membership list distinct from team membership.
// Gated on visibility, not teamId — an org member's own Personal project
// also carries the org's teamId, but has no roster of its own.
export function projectMemberCount(project: Project, members: OrgMember[]): number {
  if (project.visibility === 'personal' || !project.teamId) return 1
  const count = members.filter(m => m.teamMemberships.some(tm => tm.teamId === project.teamId)).length
  return count || 1
}

export function formatUpdated(iso: string) {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60)         return 'Updated just now'
  if (diff < 3600)       return `Updated ${Math.floor(diff / 60)}m ago`
  if (diff < 86400)      return `Updated ${Math.floor(diff / 3600)}h ago`
  const days  = Math.floor(diff / 86400)
  if (diff < 86400 * 7)  return `Updated ${days} ${days === 1 ? 'day' : 'days'} ago`
  const weeks = Math.floor(diff / 86400 / 7)
  if (diff < 86400 * 30) return `Updated ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  return 'Updated last month'
}
