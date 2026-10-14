import { describe, expect, it } from 'vitest'
import { exemptFromOnboardingRedirect, onboardingOpenWhenOnboarded, routePolicy } from './route-policy'
import {
  INVITE_LANDING_BASE_ROUTE,
  ONBOARDING_PRICING_ROUTE,
  ONBOARDING_TEAM_BASE_ROUTE,
  SETTINGS_BILLING_CONFIRMATION_ROUTE,
  SLACK_LINK_ROUTE,
  TEAM_INVITE_BASE_ROUTE,
} from '@/lib/routes'

describe('routePolicy', () => {
  it.each([
    ['/reasoning-verify', false, 'dev-harness'],
    ['/reasoning-verify', true, 'app'],
    ['/org/security', true, 'removed-org-security'],
    ['/org/security/x', true, 'removed-org-security'],
    ['/org/securityx', true, 'app'],
    ['/auth/login', true, 'auth'],
    ['/api/chat', true, 'api'],
    [`${INVITE_LANDING_BASE_ROUTE}/abc`, true, 'public'],
    ['/onboarding/role', true, 'onboarding'],
    ['/chat', true, 'app'],
    ['/', true, 'app'],
  ] as const)('%s (production=%s) → %s', (path, production, expected) => {
    expect(routePolicy(path, production)).toBe(expected)
  })
})

describe('onboarding exemptions', () => {
  it('lets onboarded users back into pricing and the team-invite flow only', () => {
    expect(onboardingOpenWhenOnboarded(ONBOARDING_PRICING_ROUTE)).toBe(true)
    expect(onboardingOpenWhenOnboarded(`${ONBOARDING_TEAM_BASE_ROUTE}/inv1`)).toBe(true)
    expect(onboardingOpenWhenOnboarded('/onboarding/role')).toBe(false)
  })

  it('lets un-onboarded users reach checkout return, invites and Slack link', () => {
    for (const path of [SETTINGS_BILLING_CONFIRMATION_ROUTE, `${TEAM_INVITE_BASE_ROUTE}/x`, `${ONBOARDING_TEAM_BASE_ROUTE}/x`, SLACK_LINK_ROUTE]) {
      expect(exemptFromOnboardingRedirect(path)).toBe(true)
    }
    expect(exemptFromOnboardingRedirect('/chat')).toBe(false)
  })
})
