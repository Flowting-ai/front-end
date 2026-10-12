'use client'

import { usePathname } from 'next/navigation'
import { AGENTS_ROUTE } from '@/lib/routes'
import { AgentRouteLoading } from './_components/AgentRouteLoading'
import { AgentsListLoading } from './_components/AgentsListLoading'

// This file also covers the nested agent routes (new, configure, edit…), so only the list itself
// gets the list-shaped skeleton; the others keep the generic form placeholder.
export default function AgentsLoading() {
  const pathname = usePathname()
  return pathname === AGENTS_ROUTE ? <AgentsListLoading /> : <AgentRouteLoading />
}
