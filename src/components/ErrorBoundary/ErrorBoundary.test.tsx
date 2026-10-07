// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './index'
import { emitSidebarNewChat } from '@/hooks/use-sidebar-events'

vi.mock('next/navigation', () => ({ usePathname: () => '/chat' }))
vi.mock('@/components/Button', () => ({ Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button> }))
vi.mock('@strange-huge/icons', () => ({ AlertCircleIcon: () => null }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let shouldThrow = false
function Crashy() {
  if (shouldThrow) throw new Error('boom')
  return <p>healthy page</p>
}

describe('ErrorBoundary', () => {
  it('clears a caught error when the sidebar New chat event fires', async () => {
    
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const container = document.createElement('div')
    const root = createRoot(container)
    const page = (n: number) => <ErrorBoundary><Crashy key={n} /></ErrorBoundary>
    // Mounted healthy first, as in the app — the crash happens on a later render.
    await act(async () => root.render(page(0)))
    expect(container.textContent).toContain('healthy page')

    shouldThrow = true
    await act(async () => root.render(page(1)))
    expect(container.textContent).toContain('Something went wrong')

    shouldThrow = false
    await act(async () => { emitSidebarNewChat() })
    expect(container.textContent).toContain('healthy page')
    await act(async () => root.unmount())
  })
})
