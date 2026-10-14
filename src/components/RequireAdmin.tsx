'use client'

import { Skeleton } from '@/components/Skeleton'
import { LinkButton } from '@/components/Library/LinkButton'
import { useOrgIdentity } from '@/context/org-context'
import { adminGate } from '@/lib/org/role'
import { CHAT_ROUTE } from '@/lib/routes'

/**
 * Admin-only route content. Shows a placeholder while the role resolves and a
 * "no access" message for members, instead of a blank screen and a redirect.
 * Client-side gating is for UX only; the backend enforces every admin action.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { orgReady, currentUserRole } = useOrgIdentity()
  const gate = adminGate(orgReady, currentUserRole)

  if (gate === 'loading') {
    return (
      <div role="status" aria-label="Checking access" style={{ width: '100%', maxWidth: 908, margin: '0 auto', padding: '64px 24px', boxSizing: 'border-box' }}>
        <Skeleton width="30%" height={28} style={{ marginBottom: 16 }} />
        <Skeleton width="60%" height={14} style={{ marginBottom: 32 }} />
        <Skeleton height={160} radius={16} />
      </div>
    )
  }

  if (gate === 'denied') {
    return (
      <div role="status" style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)' }}>
          Only workspace admins can see this page
        </h1>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', maxWidth: 420 }}>
          Ask an admin in your workspace if you need a change here.
        </p>
        <LinkButton href={CHAT_ROUTE}>Back to chat</LinkButton>
      </div>
    )
  }

  return <>{children}</>
}
