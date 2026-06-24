import { fetchProjects, type ApiProjectSummary } from '@/lib/api/projects'
import {
  listProjectMembers,
  listTeamEditors,
  type ProjectMember,
} from '@/lib/api/teams'
import type { Team, TeamEditor, TeamMembership } from '@/types/teams'

interface TeamIdentity {
  name: string | null
  email: string | null
}

export interface TeamAccessSnapshot {
  editorsByTeamId: Map<string, TeamEditor[]>
  membershipsByUser: Map<string, TeamMembership[]>
  identitiesByUser: Map<string, TeamIdentity>
  projectsByTeamId: Map<string, ApiProjectSummary[]>
}

function mergeMembership(
  membershipsByUser: Map<string, TeamMembership[]>,
  userId: string,
  membership: TeamMembership,
) {
  const current = membershipsByUser.get(userId) ?? []
  const existingIndex = current.findIndex(entry => entry.teamId === membership.teamId)

  if (existingIndex === -1) {
    membershipsByUser.set(userId, [...current, membership])
    return
  }

  const existing = current[existingIndex]
  const next = [...current]
  next[existingIndex] = {
    ...existing,
    teamName: existing.teamName || membership.teamName,
    isTeamOwner: existing.isTeamOwner || membership.isTeamOwner,
  }
  membershipsByUser.set(userId, next)
}

function mergeIdentity(
  identitiesByUser: Map<string, TeamIdentity>,
  userId: string,
  identity: TeamIdentity,
) {
  const existing = identitiesByUser.get(userId)
  if (!existing) {
    identitiesByUser.set(userId, identity)
    return
  }

  identitiesByUser.set(userId, {
    name: existing.name || identity.name,
    email: existing.email || identity.email,
  })
}

function addEditorMemberships(
  membershipsByUser: Map<string, TeamMembership[]>,
  identitiesByUser: Map<string, TeamIdentity>,
  team: Pick<Team, 'id' | 'name'>,
  editors: TeamEditor[],
) {
  for (const editor of editors) {
    mergeMembership(membershipsByUser, editor.userId, {
      teamId: team.id,
      teamName: team.name,
      isTeamOwner: true,
    })
    mergeIdentity(identitiesByUser, editor.userId, {
      name: editor.name ?? null,
      email: editor.email ?? null,
    })
  }
}

function addProjectMemberships(
  membershipsByUser: Map<string, TeamMembership[]>,
  identitiesByUser: Map<string, TeamIdentity>,
  team: Pick<Team, 'id' | 'name'>,
  members: ProjectMember[],
) {
  for (const member of members) {
    mergeMembership(membershipsByUser, member.userId, {
      teamId: team.id,
      teamName: team.name,
      isTeamOwner: false,
    })
    mergeIdentity(identitiesByUser, member.userId, {
      name: member.name ?? null,
      email: member.email ?? null,
    })
  }
}

export async function fetchTeamAccessSnapshot(
  orgId: string,
  teams: Array<Pick<Team, 'id' | 'name'>>,
): Promise<TeamAccessSnapshot> {
  const editorsByTeamId = new Map<string, TeamEditor[]>()
  const membershipsByUser = new Map<string, TeamMembership[]>()
  const identitiesByUser = new Map<string, TeamIdentity>()
  const projectsByTeamId = new Map<string, ApiProjectSummary[]>()

  if (teams.length === 0) {
    return { editorsByTeamId, membershipsByUser, identitiesByUser, projectsByTeamId }
  }

  const teamsById = new Map(teams.map(team => [team.id, team]))

  const [editorRows, allProjects] = await Promise.all([
    Promise.all(
      teams.map(async team => ({
        team,
        editors: await listTeamEditors(orgId, team.id).catch(() => []),
      })),
    ),
    fetchProjects().catch(() => []),
  ])

  for (const { team, editors } of editorRows) {
    editorsByTeamId.set(team.id, editors)
    addEditorMemberships(membershipsByUser, identitiesByUser, team, editors)
  }

  const teamProjects = allProjects.filter(
    project => project.teamId && teamsById.has(project.teamId),
  )

  for (const project of teamProjects) {
    const teamId = project.teamId
    if (!teamId) continue
    const current = projectsByTeamId.get(teamId) ?? []
    current.push(project)
    projectsByTeamId.set(teamId, current)
  }

  const projectMembershipRows = await Promise.all(
    teamProjects.map(async project => {
      const teamId = project.teamId
      if (!teamId) {
        return { teamId: null, members: [] as ProjectMember[] }
      }
      return {
        teamId,
        members: await listProjectMembers(orgId, teamId, project.id).catch(() => []),
      }
    }),
  )

  for (const row of projectMembershipRows) {
    if (!row.teamId) continue
    const team = teamsById.get(row.teamId)
    if (!team) continue
    addProjectMemberships(membershipsByUser, identitiesByUser, team, row.members)
  }

  for (const [userId, memberships] of membershipsByUser) {
    membershipsByUser.set(
      userId,
      [...memberships].sort((a, b) => a.teamName.localeCompare(b.teamName)),
    )
  }

  for (const projects of projectsByTeamId.values()) {
    projects.sort((a, b) => a.title.localeCompare(b.title))
  }

  return { editorsByTeamId, membershipsByUser, identitiesByUser, projectsByTeamId }
}
