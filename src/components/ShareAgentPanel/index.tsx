'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { CopyOneIcon } from '@strange-huge/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/Badge'
import { Spinner } from '@/components/Spinner'
import { Tooltip } from '@/components/Tooltip'
import { UsageMeter } from '@/components/UsageMeter'
import { BOX_STYLE, HINT_STYLE, INPUT_STYLE, LABEL_STYLE } from '@/components/AgentEditor/styles'
import { useAuth } from '@/context/auth-context'
import { ApiError } from '@/lib/api/client'
import { createShare, revokeShare } from '@/lib/api/persona-shares'
import { getShareTokenLimit } from '@/lib/plan-config'
import { canonicalShareUrl } from '@/lib/share-url'
import { copyShareLink } from '@/lib/share/copy-link'
import { EMAIL_PATTERN, defaultCreditLimit, linkUsageText, parseCreditLimit } from '@/lib/share/share-limit'
import { activeInvitesFor, activeLinkFor, forgetShare, personaSharesQuery, rememberShare } from '@/lib/share/share-queries'

export interface ShareAgentPanelProps {
  /** The persona repo to share (shares follow the agent's published version). */
  repoId: string
  /** Show per-address email invites (the share modal); the published page shows the link only. */
  invites?: boolean
  /** Ask for the link's credit limit before creating it; otherwise half the plan's share allowance. */
  askLimit?: boolean
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError ? (err.rawMessage || err.message || fallback) : fallback

/**
 * The one place an agent is shared: its Super Link (create, copy, turn off,
 * usage) and, optionally, email invites (send, revoke). Used by AgentShareModal
 * (cards, ⋯ menu, Super Links tab) and the agent's published page. Reads and
 * writes the shared `personaSharesQuery`, so every badge and dashboard updates.
 */
export function ShareAgentPanel({ repoId, invites: showInvites = true, askLimit = false }: ShareAgentPanelProps) {
  const { user } = useAuth()
  const planMax = getShareTokenLimit(user?.planType)
  const queryClient = useQueryClient()
  const sharesQ = useQuery(personaSharesQuery(!!repoId))
  const link = activeLinkFor(sharesQ.data, repoId)
  const invites = activeInvitesFor(sharesQ.data, repoId)
  const [busy, setBusy] = useState<'link' | 'email' | string | null>(null)
  const [email, setEmail] = useState('')
  const [limitText, setLimitText] = useState('')
  const typedLimit = parseCreditLimit(limitText, planMax)

  async function createLink() {
    const credit_limit = askLimit ? typedLimit : defaultCreditLimit(planMax)
    if (credit_limit === null) return
    setBusy('link')
    try {
      rememberShare(queryClient, await createShare({ persona_repo_id: repoId, share_type: 'link', credit_limit }))
      toast.success('Share link created')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create the link'))
    } finally { setBusy(null) }
  }

  async function revoke(id: string, done: string, failed: string) {
    setBusy(id === link?.id ? 'link' : id)
    try {
      await revokeShare(id)
      forgetShare(queryClient, id)
      toast.success(done)
    } catch (err) {
      toast.error(errorMessage(err, failed))
    } finally { setBusy(null) }
  }

  async function sendInvite() {
    const address = email.trim()
    if (!address) return
    if (!EMAIL_PATTERN.test(address)) { toast.error('Enter a valid email address'); return }
    setBusy('email')
    try {
      rememberShare(queryClient, await createShare({
        persona_repo_id: repoId, share_type: 'email', recipient_emails: [address], credit_limit: defaultCreditLimit(planMax),
      }))
      setEmail('')
      toast.success(`Invite sent to ${address}`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to send the invite'))
    } finally { setBusy(null) }
  }

  if (sharesQ.isPending) {
    return <div role="status" aria-live="polite" className="flex justify-center py-8"><Spinner size={22} /></div>
  }

  const linkUrl = link ? canonicalShareUrl(link.share_url) : ''
  const usedPct = link?.credit_limit ? Math.min(100, Math.round((link.credit_used / link.credit_limit) * 100)) : null

  return (
    <div className="flex flex-col gap-5">
      {/* What a recipient sees (the accept page's preview), so nothing surprises the sender. */}
      <p style={HINT_STYLE}>
        People you share with see the agent&apos;s name, description and instructions before they add it. Their chats run on your credits, up to the link&apos;s limit.
      </p>
      {/* Super Link */}
      <section className="flex flex-col gap-2" aria-label="Super Link">
        <div className="flex items-center justify-between gap-2">
          <p style={LABEL_STYLE}>Super Link</p>
          {link && <Badge color="Green" label="On" />}
        </div>
        {link ? (
          <>
            <div style={{ ...BOX_STYLE, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 12px' }}>
              <Tooltip content={linkUrl} maxWidth={280}>
                <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-code)] text-[13px] text-[var(--neutral-800)]">
                  {linkUrl.replace(/^https?:\/\//, '')}
                </span>
              </Tooltip>
              <Button variant="secondary" size="sm" leftIcon={<CopyOneIcon />} onClick={() => void copyShareLink(linkUrl, toast)}>Copy</Button>
            </div>
            {usedPct !== null && <UsageMeter value={usedPct} label="Link credits used" trailing={`${usedPct}%`} />}
            <div className="flex items-center justify-between gap-2">
              <p style={HINT_STYLE}>{linkUsageText(link)}</p>
              <Button variant="ghost" size="sm" onClick={() => void revoke(link.id, 'Share link turned off', 'Failed to turn the link off')} loading={busy === 'link'} disabled={busy !== null}>Turn off</Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p style={HINT_STYLE}>Anyone with the link can add this agent and chat with it without a Souvenir account, within a credit limit you cover.</p>
            <div className="flex items-center justify-end gap-2">
              {askLimit && (
                <label className="flex items-center gap-2">
                  <span style={HINT_STYLE}>Credit limit</span>
                  <span className="kaya-field" style={{ ...BOX_STYLE, padding: '4px 8px', width: 120 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={limitText}
                      placeholder={`Up to ${planMax.toLocaleString()}`}
                      aria-invalid={limitText !== '' && typedLimit === null}
                      onChange={e => setLimitText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void createLink() } }}
                      style={INPUT_STYLE}
                    />
                  </span>
                </label>
              )}
              <Button variant="default" size="sm" onClick={() => void createLink()} loading={busy === 'link'} disabled={busy !== null || (askLimit && typedLimit === null)}>
                Create link
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Email invites */}
      {showInvites && (
        <section className="flex flex-col gap-2" aria-label="Invite by email">
          <p style={LABEL_STYLE}>Invite by email</p>
          <div className="flex items-center gap-2">
            <div className="kaya-field" style={{ ...BOX_STYLE, flex: 1, minWidth: 0, padding: '7px 12px' }}>
              <input
                type="email"
                value={email}
                placeholder="name@company.com"
                aria-label="Email address"
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void sendInvite() } }}
                style={INPUT_STYLE}
              />
            </div>
            <Button variant="default" size="sm" onClick={() => void sendInvite()} loading={busy === 'email'} disabled={busy !== null || !email.trim()}>Send invite</Button>
          </div>
          {invites.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {invites.map(share => (
                <li key={share.id} style={{ ...BOX_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 6px 6px 12px' }}>
                  <span className="min-w-0 truncate text-sm text-[var(--neutral-800)]">{(share.recipient_emails ?? []).join(', ') || 'Invited'}</span>
                  <Button variant="ghost" size="sm" onClick={() => void revoke(share.id, 'Invite revoked', 'Failed to revoke the invite')} loading={busy === share.id} disabled={busy !== null}>Revoke</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
