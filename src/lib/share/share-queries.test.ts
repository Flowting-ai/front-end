import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/persona-cache', () => ({ bustPersonasCache: vi.fn() }))

import { QueryClient } from '@tanstack/react-query'
import type { PersonaShare, ShareDashboardResponse } from '@/lib/api/persona-shares'
import { bustPersonasCache } from '@/lib/api/persona-cache'
import { queryKeys } from '@/lib/query-keys'
import { activeInvitesFor, activeLinkFor, activeLinkRepoIds, afterShareAccepted, forgetShare, rememberShare } from './share-queries'

const share = (id: string, repo: string, type: 'link' | 'email', active = true) =>
  ({ id, persona_repo_id: repo, share_type: type, is_active: active }) as PersonaShare

describe('selectors', () => {
  const all = [share('l1', 'r1', 'link'), share('l2', 'r2', 'link', false), share('e1', 'r1', 'email')]
  it('finds active links and invites per agent', () => {
    expect(activeLinkFor(all, 'r1')?.id).toBe('l1')
    expect(activeLinkFor(all, 'r2')).toBeNull()
    expect(activeInvitesFor(all, 'r1').map(s => s.id)).toEqual(['e1'])
    expect([...activeLinkRepoIds(all)]).toEqual(['r1'])
    expect(activeLinkFor(undefined, 'r1')).toBeNull()
  })
})

describe('cache writes', () => {
  it('remember/forget update the list and cached dashboards', () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.shares.persona(), [share('l1', 'r1', 'link')])
    qc.setQueryData(queryKeys.shares.dashboard(30), { links: [share('l1', 'r1', 'link')] } as unknown as ShareDashboardResponse)

    rememberShare(qc, share('e1', 'r1', 'email'))
    expect(qc.getQueryData<PersonaShare[]>(queryKeys.shares.persona())?.map(s => s.id)).toEqual(['l1', 'e1'])
    expect(qc.getQueryState(queryKeys.shares.dashboard(30))?.isInvalidated).toBe(true)

    forgetShare(qc, 'l1')
    expect(qc.getQueryData<PersonaShare[]>(queryKeys.shares.persona())?.map(s => s.id)).toEqual(['e1'])
    expect(qc.getQueryData<ShareDashboardResponse>(queryKeys.shares.dashboard(30))?.links).toEqual([])
  })

  it('accepting a share refreshes agents and received shares', () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.shares.received(), [])
    afterShareAccepted(qc)
    expect(bustPersonasCache).toHaveBeenCalled()
    expect(qc.getQueryState(queryKeys.shares.received())?.isInvalidated).toBe(true)
  })
})
