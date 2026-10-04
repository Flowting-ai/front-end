import { redirect } from 'next/navigation'
import { AGENT_EDIT_ROUTE, AGENTS_ROUTE } from '@/lib/routes'

// Old entry point of the V1.5 configure flow. The editor now lives at
// /agents/[personaId]/edit; a link that still carries a repoId lands there.
export default async function PersonasConfigurePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { repoId } = await searchParams
  const id = Array.isArray(repoId) ? repoId[0] : repoId
  redirect(id ? AGENT_EDIT_ROUTE(encodeURIComponent(id)) : AGENTS_ROUTE)
}
