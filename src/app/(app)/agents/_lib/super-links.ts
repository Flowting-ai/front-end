import { type PersonaShare, type ReceivedShareResponse } from '@/lib/api/persona-shares'
import type { SuperLinkDrawerSession } from '@/components/SuperLinkDrawer'
import { canonicalShareUrl } from '@/lib/share-url'
import type { SuperLinkStatus } from '@/components/SuperLinkRow'
import { type SuperLinkDrawerLink } from '@/components/SuperLinkDrawer'

// ── Received-share helpers ────────────────────────────────────────────────────

export type ReceivedStatus = 'active' | 'expired' | 'limit-reached' | 'revoked'

export function receivedShareStatus(share: ReceivedShareResponse): ReceivedStatus {
  if (!share.is_active)    return 'revoked'
  if (!share.is_available) return share.credit_limit !== null && share.credit_used >= share.credit_limit ? 'limit-reached' : 'expired'
  return 'active'
}

export const RECEIVED_STATUS_BADGE: Record<ReceivedStatus, { color: 'Green' | 'Red' | 'Yellow' | 'Neutral'; label: string }> = {
  'active':        { color: 'Green',   label: 'Active'        },
  'expired':       { color: 'Neutral', label: 'Expired'       },
  'limit-reached': { color: 'Red',     label: 'Limit reached' },
  'revoked':       { color: 'Neutral', label: 'Revoked'       },
}

export function fmtExpiry(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Super Links helpers ───────────────────────────────────────────────────────

export function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

const SL_COLORS = ['var(--violet-600)', 'var(--info-400)', 'var(--success-600)', 'var(--warning-500)', 'var(--danger-500)', 'var(--danger-400)', 'var(--info-600)']

export function colorFromName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return SL_COLORS[h % SL_COLORS.length]
}

export function shareStatus(share: PersonaShare): SuperLinkStatus {
  if (!share.is_active) return 'revoked'
  if (share.credit_limit !== null && share.credit_used >= share.credit_limit) return 'limit-reached'
  return 'active'
}

export const SENT_STATUS_BADGE: Record<SuperLinkStatus, { color: 'Green' | 'Neutral' | 'Red'; label: string }> = {
  'active':        { color: 'Green',   label: 'Active'        },
  'paused':        { color: 'Neutral', label: 'Paused'        },
  'limit-reached': { color: 'Red',     label: 'Limit reached' },
  'revoked':       { color: 'Neutral', label: 'Revoked'       },
}

export function fmtRelative(iso: string): string {
  // persona-shares timestamps are UTC without a zone ("2026-10-26T12:53:05.14"); read as local time
  // they were off by the viewer's UTC offset ("5h ago" for a link made minutes earlier).
  const then = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()
  if (Number.isNaN(then)) return ''
  const diffMin = Math.floor((Date.now() - then) / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)  return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function toDrawerLink(
  share: PersonaShare,
  personaName: string,
  avatarUrl: string | null,
  repoId: string,
  dailyTokens: number[],
): SuperLinkDrawerLink {
  const recipients = share.recipients ?? []
  const conversations = recipients.length
  const uniqueUsers = new Set(recipients.map(r => r.recipient_user_id)).size
  const tokensPerConvo = conversations > 0 ? Math.round(share.credit_used / conversations) : 0
  const sessions: SuperLinkDrawerSession[] = recipients.map(r => ({
    id:       r.recipient_user_id,
    time:     r.accepted_at,
    messages: r.message_count,
    tokens:   r.credit_used,
    status:   r.is_active ? 'active' : 'ended',
  }))
  return {
    id:             share.id,
    personaName,
    avatarColor:    colorFromName(personaName),
    avatarUrl,
    repoId,
    url:            canonicalShareUrl(share.share_url).replace(/^https?:\/\//, ''),
    tokenUsed:      share.credit_used,
    tokenLimit:     share.credit_limit ?? 0,
    conversations,
    uniqueUsers,
    tokensPerConvo,
    lastUsedAt:     share.updated_at ?? share.created_at,
    status:         shareStatus(share),
    dailyTokens,
    sessions,
  }
}

