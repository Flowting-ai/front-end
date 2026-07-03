import { redirect } from 'next/navigation'
import { AGENT_CONFIGURE_INSTRUCTIONS_BASE_ROUTE } from '@/lib/routes'

export default async function PersonasConfigurePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map(val => [k, val]) : v !== undefined ? [[k, v]] : []
    )
  ).toString()
  redirect(`${AGENT_CONFIGURE_INSTRUCTIONS_BASE_ROUTE}${qs ? `?${qs}` : ''}`)
}
