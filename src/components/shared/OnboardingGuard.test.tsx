// @vitest-environment jsdom
//
// OnboardingGuard (AS-4, AS-5): a user who can't use the app yet goes to the same onboarding
// step the proxy would pick, someone back from checkout is let through, and a signed-out user
// is sent to login with `returnTo`.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type GuardUser = {
  onboardingCompleted?: boolean
  planType?: string | null
  subscriptionStatus?: string | null
  pendingInviteId?: string | null
}

const replace = vi.fn()
const redirectToLogin = vi.fn()
let auth: { isHydrated: boolean; isAuthenticated: boolean; user: GuardUser | null }
let pathname = '/library'
let profile: unknown = null

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => pathname }))
vi.mock('@/context/auth-context', () => ({ useAuth: () => auth }))
vi.mock('@/lib/auth/logout-state', () => ({ redirectToLogin: (route: string) => redirectToLogin(route) }))
vi.mock('@/lib/api/current-user', () => ({ currentUser: { peek: () => profile } }))

import { OnboardingGuard } from './OnboardingGuard'
// The proxy's gate re-exports the step function it uses; the guard must agree with it.
import { determineNextOnboardingPath } from '@/lib/onboarding-gate'
import { parseUserMeGate } from '@/lib/api/user-me-schema'

let container: HTMLDivElement
let root: Root

const notOnboarded: GuardUser = { onboardingCompleted: false, planType: null, subscriptionStatus: null }

async function render() {
  await act(async () => {
    root.render(<OnboardingGuard><p>app</p></OnboardingGuard>)
  })
}

const proxyStep = (raw: unknown) => determineNextOnboardingPath(parseUserMeGate(raw))

beforeEach(() => {
  replace.mockReset()
  redirectToLogin.mockReset()
  auth = { isHydrated: true, isAuthenticated: true, user: notOnboarded }
  pathname = '/library'
  profile = null
  window.history.replaceState(null, '', '/library')
  document.cookie = 'souvenir_checkout_complete=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('OnboardingGuard next step', () => {
  const states: Array<[string, Record<string, unknown>, string]> = [
    ['nothing saved yet', { onboarding: { completed: false } }, '/onboarding/setup'],
    ['workspace saved, no name', { onboarding: { completed: false, role_fit: 'small' } }, '/onboarding/profile'],
    ['workspace saved, half a name', { first_name: 'Ada', last_name: ' ', onboarding: { completed: false, role_fit: 'small' } }, '/onboarding/profile'],
    ['workspace and profile saved', { first_name: 'Ada', last_name: 'Lovelace', onboarding: { completed: false, role_fit: 'small' } }, '/onboarding/invite'],
    ['camelCase roleFit', { first_name: 'Ada', last_name: 'Lovelace', onboarding: { completed: false, roleFit: 'small' } }, '/onboarding/invite'],
    ['an invite waiting', { pending_invite_id: 'inv-1', onboarding: { completed: false, role_fit: 'small' } }, '/onboarding/team/inv-1'],
  ]

  it.each(states)('%s → the proxy\'s step', async (_name, raw, expected) => {
    profile = raw
    await render()
    expect(proxyStep(raw)).toBe(expected)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith(proxyStep(raw))
  })

  it('accepts the profile wrapped in `data`', async () => {
    profile = { data: { first_name: 'Ada', last_name: 'Lovelace', onboarding: { role_fit: 'small' } } }
    await render()
    expect(replace).toHaveBeenCalledWith('/onboarding/invite')
  })

  it('falls back to Setup when the profile has not loaded', async () => {
    await render()
    expect(replace).toHaveBeenCalledWith('/onboarding/setup')
  })

  it('falls back to the invite when the profile has not loaded but one is waiting', async () => {
    auth.user = { ...notOnboarded, pendingInviteId: 'inv-2' }
    await render()
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('inv-2'))
  })
})

describe('OnboardingGuard lets through', () => {
  it('an onboarded user', async () => {
    auth.user = { onboardingCompleted: true }
    await render()
    expect(replace).not.toHaveBeenCalled()
  })

  it('a user on an active paid plan', async () => {
    auth.user = { onboardingCompleted: false, planType: 'pro', subscriptionStatus: 'active' }
    await render()
    expect(replace).not.toHaveBeenCalled()
  })

  it('someone back from checkout (souvenir_checkout_complete)', async () => {
    document.cookie = 'souvenir_checkout_complete=1; path=/'
    await render()
    expect(replace).not.toHaveBeenCalled()
  })

  it.each(['/settings/billing/confirmation', '/team-invite/abc', '/slack/link'])('%s', async (path) => {
    pathname = path
    await render()
    expect(replace).not.toHaveBeenCalled()
  })

  it('nobody until the user has loaded', async () => {
    auth.user = null
    await render()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('OnboardingGuard signed out', () => {
  it('sends to login with returnTo = path + search', async () => {
    auth = { isHydrated: true, isAuthenticated: false, user: null }
    window.history.replaceState(null, '', '/library?q=deep')
    await render()
    expect(redirectToLogin).toHaveBeenCalledWith('/auth/login?returnTo=%2Flibrary%3Fq%3Ddeep')
    expect(replace).not.toHaveBeenCalled()
  })

  it('does nothing before hydration', async () => {
    auth = { isHydrated: false, isAuthenticated: false, user: null }
    await render()
    expect(redirectToLogin).not.toHaveBeenCalled()
  })
})
