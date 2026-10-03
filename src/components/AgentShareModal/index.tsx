'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { CancelOneIcon, CopyOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import { Spinner } from '@/components/Spinner'
import { createShare, listShares, revokeShare, type PersonaShare } from '@/lib/api/persona-shares'
import { ApiError } from '@/lib/api/client'
import { useAuth } from '@/context/auth-context'
import { getShareTokenLimit } from '@/lib/plan-config'
import { canonicalShareUrl } from '@/lib/share-url'
import { BOX_STYLE, HINT_STYLE, INPUT_STYLE, LABEL_STYLE } from '@/components/AgentEditor/styles'

// ── Agent share modal ─────────────────────────────────────────────────────────
// Opens from an agent card's Share button / ⋯ → Share, in place of sending the
// user to the old /agent/configure/sharing tab. Same persona-shares API as that
// tab: one Super Link per agent (copy / turn off) and per-address email invites
// (send / revoke). Each is repo-scoped, so it follows the agent's published version.
//
// Portaled to document.body for the same reason ProjectShareModal is: AppLayout's
// rounded content container isolates its stacking context, which would trap a
// fixed modal beneath the side panels.

export interface AgentShareModalProps {
  open:      boolean
  onClose:   () => void
  /** The persona repo to share. */
  repoId:    string
  agentName: string
  /** Called after a link or invite is created / revoked, so the list can refresh its badges. */
  onChanged?: () => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AgentShareModal({ open, onClose, repoId, agentName, onChanged }: AgentShareModalProps) {
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <ModalBody key={repoId} repoId={repoId} agentName={agentName} onClose={onClose} onChanged={onChanged} />,
    document.body,
  )
}

function ModalBody({ repoId, agentName, onClose, onChanged }: Omit<AgentShareModalProps, 'open'>) {
  const { user } = useAuth()
  const creditLimit = Math.floor(getShareTokenLimit(user?.planType) / 2)

  const [loading, setLoading] = useState(true)
  const [link, setLink] = useState<PersonaShare | null>(null)
  const [invites, setInvites] = useState<PersonaShare[]>([])
  const [busy, setBusy] = useState<'link' | 'email' | string | null>(null)
  const [email, setEmail] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    listShares()
      .then(all => {
        if (cancelled) return
        const mine = all.filter(share => share.persona_repo_id === repoId && share.is_active)
        setLink(mine.find(share => share.share_type === 'link') ?? null)
        setInvites(mine.filter(share => share.share_type === 'email'))
      })
      .catch(() => { if (!cancelled) { setLink(null); setInvites([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [repoId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const errorMessage = (err: unknown, fallback: string) => (err as ApiError)?.message ?? fallback

  async function turnOnLink() {
    setBusy('link')
    try {
      setLink(await createShare({ persona_repo_id: repoId, share_type: 'link', credit_limit: creditLimit }))
      onChanged?.()
      toast.success('Share link created')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create the link'))
    } finally { setBusy(null) }
  }

  async function turnOffLink() {
    if (!link) return
    setBusy('link')
    try {
      await revokeShare(link.id)
      setLink(null)
      onChanged?.()
      toast.success('Share link turned off')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to turn the link off'))
    } finally { setBusy(null) }
  }

  function copyLink() {
    if (!link?.share_url) return
    navigator.clipboard.writeText(canonicalShareUrl(link.share_url)).catch(() => {})
    toast.success('Link copied')
  }

  async function sendInvite() {
    const address = email.trim()
    if (!address) return
    if (!EMAIL_PATTERN.test(address)) { toast.error('Enter a valid email address'); return }
    setBusy('email')
    try {
      const share = await createShare({
        persona_repo_id: repoId, share_type: 'email', recipient_emails: [address], credit_limit: creditLimit,
      })
      setInvites(prev => [...prev, share])
      setEmail('')
      onChanged?.()
      toast.success(`Invite sent to ${address}`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to send the invite'))
    } finally { setBusy(null) }
  }

  async function revokeInvite(id: string) {
    setBusy(id)
    try {
      await revokeShare(id)
      setInvites(prev => prev.filter(share => share.id !== id))
      onChanged?.()
      toast.success('Invite revoked')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to revoke the invite'))
    } finally { setBusy(null) }
  }

  const linkUrl = link ? canonicalShareUrl(link.share_url) : ''
  const usage = link?.credit_limit
    ? `${link.credit_used.toLocaleString()} / ${link.credit_limit.toLocaleString()} credits used`
    : link ? 'Unlimited credits' : null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'color-mix(in srgb, var(--neutral-950) 40%, transparent)', backdropFilter: 'blur(2px)', zIndex: 100 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${agentName}`}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 101,
          width: 680, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 96px)', minHeight: 380,
          overflow: 'hidden', borderRadius: 16, backgroundColor: 'var(--neutral-white)',
          boxShadow: '0px 8px 32px rgba(18,12,8,0.18), 0px 0px 0px 1px var(--neutral-100)',
          padding: 32, display: 'flex', flexDirection: 'column', gap: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)' }}>
              Share agent
            </p>
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agentName}
            </p>
          </div>
          <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={onClose} />
        </div>

        {loading ? (
          <div role="status" aria-live="polite" style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size={22} /></div>
        ) : (
          <div className="kaya-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', minHeight: 0, padding: '8px 8px 10px', margin: '-8px -8px -10px' }}>

            {/* Super Link */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <p style={LABEL_STYLE}>Super Link</p>
                {link && <Badge color="Green" label="On" />}
              </div>
              {link ? (
                <>
                  <div style={{ ...BOX_STYLE, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 12px' }}>
                    <span title={linkUrl} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-code)', fontSize: 13, color: 'var(--neutral-800)' }}>
                      {linkUrl.replace(/^https?:\/\//, '')}
                    </span>
                    <Button variant="secondary" size="sm" leftIcon={<CopyOneIcon />} onClick={copyLink}>Copy</Button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <p style={HINT_STYLE}>{usage}</p>
                    <Button variant="ghost" size="sm" onClick={() => void turnOffLink()} loading={busy === 'link'} disabled={busy !== null}>Turn off</Button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <p style={{ ...HINT_STYLE, flex: 1 }}>Anyone with the link can add this agent and chat with it, within a credit limit.</p>
                  <Button variant="default" size="sm" onClick={() => void turnOnLink()} loading={busy === 'link'} disabled={busy !== null}>Create link</Button>
                </div>
              )}
            </section>

            {/* Email invites */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={LABEL_STYLE}>Invite by email</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="kaya-field" style={{ ...BOX_STYLE, flex: 1, minWidth: 0, padding: '7px 12px' }}>
                  <input
                    ref={inputRef}
                    type="email"
                    value={email}
                    placeholder="name@company.com"
                    aria-label="Email address"
                    onChange={event => setEmail(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void sendInvite() } }}
                    style={INPUT_STYLE}
                  />
                </div>
                <Button variant="default" size="sm" onClick={() => void sendInvite()} loading={busy === 'email'} disabled={busy !== null || !email.trim()}>Send invite</Button>
              </div>
              {invites.length > 0 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {invites.map(share => (
                    <li key={share.id} style={{ ...BOX_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 6px 6px 12px' }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-800)' }}>
                        {(share.recipient_emails ?? []).join(', ') || 'Invited'}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => void revokeInvite(share.id)} loading={busy === share.id} disabled={busy !== null}>Revoke</Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  )
}

export default AgentShareModal
