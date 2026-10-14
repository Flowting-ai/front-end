import { queryOptions } from '@tanstack/react-query'
import { fetchProjectMembers } from '@/lib/api/projects'
import { queryKeys } from '@/lib/query-keys'

/** Members of one project. Shared by the members panel, the add-members list and the leave modal. */
export const projectMembersQuery = (projectId: string, enabled = true) =>
  queryOptions({
    queryKey: queryKeys.projectMembers(projectId),
    queryFn: () => fetchProjectMembers(projectId),
    enabled: enabled && !!projectId,
  })
