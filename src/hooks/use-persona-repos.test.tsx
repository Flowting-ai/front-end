// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetchJson = vi.fn()
vi.mock('@/lib/api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiFetchJson: (...args: unknown[]) => apiFetchJson(...args),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function renderHook<T>(hook: () => T, client: QueryClient) {
  const result: { current: T | undefined } = { current: undefined }
  function Probe() { result.current = hook(); return null }
  const root = createRoot(document.createElement('div'))
  await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>))
  return { result, unmount: () => act(async () => root.unmount()) }
}

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

describe('usePersonaRepos', () => {
  beforeEach(() => { apiFetchJson.mockReset() })

  it('starts loading, then exposes the collection with an abort signal passed through', async () => {
    const { usePersonaRepos } = await import('./use-persona-repos')
    apiFetchJson.mockResolvedValue([])
    const { result, unmount } = await renderHook(usePersonaRepos, new QueryClient())
    await flush()
    expect(result.current?.isLoading).toBe(false)
    expect(result.current?.error).toBeNull()
    expect(result.current?.repos.get('missing')).toBeFalsy()
    expect(apiFetchJson.mock.calls[0][1]).toHaveProperty('signal')
    await unmount()
  })

  it('reports an error with an empty collection', async () => {
    const { usePersonaRepos } = await import('./use-persona-repos')
    apiFetchJson.mockRejectedValue(new Error('boom'))
    const { result, unmount } = await renderHook(usePersonaRepos, new QueryClient())
    await flush()
    expect(result.current?.isLoading).toBe(false)
    expect(result.current?.error).toBeInstanceOf(Error)
    expect(result.current?.repos.get('x')).toBeFalsy()
    await unmount()
  })

  it('refetches when the ["personas"] prefix is invalidated', async () => {
    const { usePersonaRepos } = await import('./use-persona-repos')
    apiFetchJson.mockResolvedValue([])
    const client = new QueryClient()
    const { unmount } = await renderHook(usePersonaRepos, client)
    await flush()
    expect(apiFetchJson).toHaveBeenCalledTimes(1)
    await act(async () => { await client.invalidateQueries({ queryKey: ['personas'] }) })
    expect(apiFetchJson).toHaveBeenCalledTimes(2)
    await unmount()
  })
})
