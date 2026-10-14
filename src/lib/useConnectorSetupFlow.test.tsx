// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
vi.mock('@/lib/analytics/events', () => ({ trackBrowserEvent: vi.fn() }))
vi.mock('@/lib/connectorProvider', () => ({
  isApiProviderConnector: () => false,
  isMcpProviderConnector: () => false,
  isZapierProviderConnector: () => false,
  waitForZapierAuthId: vi.fn(),
  zapierConnectHref: (u: string) => u,
}))
vi.mock('@/lib/api/connectors', () => ({
  initiateLink: vi.fn(),
  pollConnectorUntilActive: vi.fn(),
  updateAccount: vi.fn(),
  completeZapierLink: vi.fn(),
  unlinkAccount: vi.fn(),
  ConnectorCatalog: class {},
}))

import { initiateLink, pollConnectorUntilActive, updateAccount } from '@/lib/api/connectors'
import { ConnectTimeoutError } from '@/lib/connectors/connect-errors'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { useConnectorSetupFlow, type SetupState } from './useConnectorSetupFlow'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })

type Flow = ReturnType<typeof useConnectorSetupFlow>
let root: Root
let container: HTMLDivElement
let flow: Flow
const onConnected = vi.fn()

function Harness() {
  flow = useConnectorSetupFlow({ connectorSlug: 'gmail', connectorName: 'Gmail', onConnected })
  return null
}

const popup = () => ({ closed: false, close: vi.fn(), location: { href: '' }, opener: {} })
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
const entryWith = (...ids: string[]) => ({ ownedConnections: ids.map(id => ({ id, connected: true })) })

beforeEach(async () => {
  vi.useFakeTimers()
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () => { root.render(<Harness />) })
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('connector setup flow', () => {
  it('opens the OAuth URL in the pre-opened popup, polls, and finishes', async () => {
    const win = popup()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    vi.mocked(initiateLink).mockResolvedValue({ redirectUrl: 'https://auth.example/x' } as never)
    vi.mocked(pollConnectorUntilActive).mockResolvedValue(entryWith('new') as never)

    act(() => flow.connect({ knownAccountIds: [] }))
    await flush()
    expect(win.location.href).toBe('https://auth.example/x')
    expect(win.opener).toBeNull()
    expect(vi.mocked(pollConnectorUntilActive).mock.calls[0][1]).toMatchObject({ target: { known: [] } })
    await flush()
    expect(onConnected).toHaveBeenCalledTimes(1)
    expect(win.close).toHaveBeenCalled()
    expect(flow.state).toBe<SetupState>('idle')
  })

  it('reports a blocked popup when the poll times out after the browser refused it', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(initiateLink).mockResolvedValue({ redirectUrl: 'https://auth.example/x' } as never)
    vi.mocked(pollConnectorUntilActive).mockRejectedValue(new ConnectTimeoutError('gmail', 120_000))

    act(() => flow.connect())
    await flush()
    await flush()
    expect(flow.state).toBe<SetupState>('error')
    expect(flow.error?.kind).toBe('popup_blocked')
    expect(trackBrowserEvent).toHaveBeenCalledWith('connector_connect_failed', { connector: 'gmail', reason: 'popup_blocked' })
  })

  it('applies sharing only to the account this link created', async () => {
    vi.spyOn(window, 'open').mockReturnValue(popup() as unknown as Window)
    vi.mocked(initiateLink).mockResolvedValue({ redirectUrl: 'https://auth.example/x' } as never)
    vi.mocked(pollConnectorUntilActive).mockResolvedValue(entryWith('old', 'new') as never)
    vi.mocked(updateAccount).mockResolvedValue({} as never)

    act(() => flow.connect({ shared: true, knownAccountIds: ['old'] }))
    await flush()
    await flush()
    expect(updateAccount).toHaveBeenCalledWith('new', { shared: true })
    await flush()
    expect(onConnected).toHaveBeenCalled()
  })

  it('aborts the poll and closes the popup when unmounted mid-flow', async () => {
    const win = popup()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    vi.mocked(initiateLink).mockResolvedValue({ redirectUrl: 'https://auth.example/x' } as never)
    let signal: AbortSignal | undefined
    vi.mocked(pollConnectorUntilActive).mockImplementation(((_slug: string, opts: { signal?: AbortSignal }) => {
      signal = opts.signal
      return new Promise(() => {})
    }) as never)

    act(() => flow.connect())
    await flush()
    expect(flow.state).toBe<SetupState>('polling')
    await act(async () => root.unmount())
    expect(signal?.aborted).toBe(true)
    expect(win.close).toHaveBeenCalled()
    // Re-create so afterEach can unmount cleanly.
    root = createRoot(container)
  })
})
