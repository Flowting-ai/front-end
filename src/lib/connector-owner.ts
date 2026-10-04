import type { ConnectorConnection } from '@/lib/api/connectors'
import type { OrgMember } from '@/types/teams'

/** Resolve the connection's owner using the workspace's existing member list. */
export function connectionAddedBy(
  account: Pick<ConnectorConnection, 'owned' | 'ownerId'>,
  members: readonly Pick<OrgMember, 'id' | 'name' | 'email'>[],
): string {
  if (account.owned) return 'You'
  const owner = members.find(member => member.id === account.ownerId)
  return owner?.name || owner?.email || 'Another workspace member'
}
