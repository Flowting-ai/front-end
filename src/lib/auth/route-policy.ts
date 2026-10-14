import {
  INVITE_LANDING_BASE_ROUTE,
  ONBOARDING_BASE_ROUTE,
  ONBOARDING_PRICING_ROUTE,
  ONBOARDING_TEAM_BASE_ROUTE,
  SETTINGS_BILLING_CONFIRMATION_ROUTE,
  SLACK_LINK_ROUTE,
  TEAM_INVITE_BASE_ROUTE,
} from '@/lib/routes'

/**
 * Which gate a request path goes through in proxy.ts, as one table instead of
 * a run of ifs. Order matters and is the order below.
 *
 * - `dev-harness`: component verification pages, open without a session outside production.
 * - `removed-org-security`: the deleted /org/security page; redirect before any session work.
 * - `auth`: Auth0's own routes, served by its middleware.
 * - `api`: route handlers; need a session, get a JSON 401, never the onboarding gate.
 * - `public`: the pre-login invite landing (it is the sign-in/sign-up choice).
 * - `onboarding`: /onboarding/*; signed in, and blocked once onboarded (see below).
 * - `app`: everything else; signed in and onboarded (with the exemptions below).
 */
export type RoutePolicy = 'dev-harness' | 'removed-org-security' | 'auth' | 'api' | 'public' | 'onboarding' | 'app'

const DEV_HARNESSES = new Set(['/reasoning-verify', '/browser-verify'])

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

export function routePolicy(pathname: string, isProduction: boolean): RoutePolicy {
  if (!isProduction && DEV_HARNESSES.has(pathname)) return 'dev-harness'
  if (under(pathname, '/org/security')) return 'removed-org-security'
  if (pathname.startsWith('/auth/')) return 'auth'
  if (pathname.startsWith('/api/')) return 'api'
  if (pathname.startsWith(`${INVITE_LANDING_BASE_ROUTE}/`)) return 'public'
  if (pathname.startsWith(`${ONBOARDING_BASE_ROUTE}/`)) return 'onboarding'
  return 'app'
}

/**
 * Onboarding pages an onboarded user may still open: the pricing return page
 * and the team-invite flow (an onboarded user can be invited into a new team).
 */
export function onboardingOpenWhenOnboarded(pathname: string): boolean {
  return pathname.startsWith(ONBOARDING_PRICING_ROUTE) || pathname.startsWith(ONBOARDING_TEAM_BASE_ROUTE)
}

/**
 * App pages an un-onboarded user may reach instead of being sent to their next
 * onboarding step: the post-checkout confirmation (the webhook may lag), the
 * team invite accept page, the team-invite onboarding flow, and Slack's
 * Connect landing (it joins the org).
 */
export function exemptFromOnboardingRedirect(pathname: string): boolean {
  return (
    pathname.startsWith(SETTINGS_BILLING_CONFIRMATION_ROUTE) ||
    pathname.startsWith(TEAM_INVITE_BASE_ROUTE) ||
    pathname.startsWith(ONBOARDING_TEAM_BASE_ROUTE) ||
    pathname.startsWith(SLACK_LINK_ROUTE)
  )
}
