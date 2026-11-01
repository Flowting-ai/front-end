// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchRecommendations = vi.fn()
vi.mock('@/lib/api/recommendations', () => ({ fetchRecommendations: (...args: unknown[]) => fetchRecommendations(...args) }))
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const recs = (label: string) => ({ cards: [{ label }], sureConnectors: [], maybeConnectors: [], generatedAt: null, personalized: true })
const STORAGE_KEY = 'souvenir:recommendations:v1'

async function mount(client: QueryClient) {
  const { useRecommendationsState } = await import('./use-recommendations')
  let state: ReturnType<typeof useRecommendationsState> | undefined
  function Probe() { state = useRecommendationsState(); return null }
  const root = createRoot(document.createElement('div'))
  await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>))
  return { get: () => state, unmount: () => act(async () => root.unmount()) }
}

describe('useRecommendationsState', () => {
  beforeEach(() => { fetchRecommendations.mockReset(); window.sessionStorage.clear() })

  it('loads, then shows the cards and persists them for a reload', async () => {
    fetchRecommendations.mockResolvedValue(recs('fresh'))
    const view = await mount(new QueryClient())
    await flush()
    expect(view.get()).toEqual({ recommendations: recs('fresh'), loading: false })
    expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}').userKey).toBe('u1')
    await view.unmount()
  })

  it('serves a fresh stored copy without fetching', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userKey: 'u1', at: Date.now(), data: recs('stored') }))
    const view = await mount(new QueryClient())
    await flush()
    expect(view.get()?.recommendations).toEqual(recs('stored'))
    expect(fetchRecommendations).not.toHaveBeenCalled()
    await view.unmount()
  })

  it('shows a stale stored copy and refreshes it in the background', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userKey: 'u1', at: Date.now() - 10 * 60_000, data: recs('old') }))
    fetchRecommendations.mockResolvedValue(recs('new'))
    const view = await mount(new QueryClient())
    await flush()
    expect(fetchRecommendations).toHaveBeenCalledTimes(1)
    expect(view.get()?.recommendations).toEqual(recs('new'))
    await view.unmount()
  })

  it('stops loading with nothing to show when the request fails', async () => {
    fetchRecommendations.mockRejectedValue(new Error('down'))
    const view = await mount(new QueryClient())
    await flush()
    expect(view.get()).toEqual({ recommendations: null, loading: false })
    await view.unmount()
  })
})
