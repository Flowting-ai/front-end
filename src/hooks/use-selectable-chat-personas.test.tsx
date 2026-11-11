// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchSelectable = vi.fn()
vi.mock('@/lib/chat-personas', () => ({ fetchSelectableChatPersonas: (...args: unknown[]) => fetchSelectable(...args) }))
vi.mock('@/context/org-context', () => ({ useOrg: () => ({ currentUserRole: 'admin', orgId: 'org-1', members: [] }) }))
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: { email: 'a@b.c' } }) }))
vi.mock('@/lib/api/teams', () => ({ resolveViewerUserId: () => 'viewer-1' }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

describe('useSelectableChatPersonas', () => {
  beforeEach(() => { fetchSelectable.mockReset() })

  it('fetches only while open, keyed by org/viewer/role, and empties on error', async () => {
    const { useSelectableChatPersonas } = await import('./use-selectable-chat-personas')
    const client = new QueryClient()
    let state: ReturnType<typeof useSelectableChatPersonas> | undefined
    function Probe({ open }: { open: boolean }) { state = useSelectableChatPersonas(open); return null }
    const root = createRoot(document.createElement('div'))
    const render = (open: boolean) => act(async () => root.render(<QueryClientProvider client={client}><Probe open={open} /></QueryClientProvider>))

    fetchSelectable.mockResolvedValue([{ id: 'p1', name: 'Agent' }])
    await render(false)
    expect(fetchSelectable).not.toHaveBeenCalled()
    expect(state).toEqual({ personas: [], loading: false })

    await render(true)
    await flush()
    expect(fetchSelectable).toHaveBeenCalledWith('org-1', 'viewer-1', true)
    expect(state).toEqual({ personas: [{ id: 'p1', name: 'Agent' }], loading: false })
    expect(client.getQueryData(['personas', 'selectable', 'org-1', 'viewer-1', 'admin'])).toBeTruthy()

    fetchSelectable.mockRejectedValue(new Error('x'))
    await act(async () => { await client.invalidateQueries({ queryKey: ['personas'] }) })
    await flush()
    expect(state?.personas).toEqual([])
    await act(async () => root.unmount())
  })
})
