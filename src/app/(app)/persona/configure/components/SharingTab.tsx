'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/Button'
import { CancelOneIcon, ArrowUpRightOneIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import {
  createShare,
  listShares,
  revokeShare,
  type PersonaShare,
} from '@/lib/api/persona-shares'
import { ApiError } from '@/lib/api/client'
import { useAuth } from '@/context/auth-context'
import { getShareTokenLimit } from '@/lib/plan-config'
import { canonicalShareUrl } from '@/lib/share-url'
import { usePersonaConfigure } from '@/app/(app)/persona/configure/context'

// ── Types ─────────────────────────────────────────────────────────────────────

type Visibility = 'private' | 'team' | 'community'

export interface SharingTabProps {
  /** persona REPO id — passed as persona_repo_id when creating shares */
  repoId?: string
  /** persona VERSION id — used to filter the existing shares list */
  versionId?: string
  hasTeamsPlan?: boolean
}

// ── Team plan badge ────────────────────────────────────────────────────────────

function TeamPlanBadge() {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        padding: 2,
        borderRadius: 6,
        boxShadow: '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)',
        flexShrink: 0,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#cadcf1',
          borderRadius: 6,
          pointerEvents: 'none',
        }}
      />
      <span
        style={{
          position: 'relative',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: 12,
          lineHeight: '16px',
          color: '#135487',
          whiteSpace: 'nowrap',
          padding: '0 2px',
        }}
      >
        Team plan
      </span>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          borderRadius: 8,
        }}
      >
        <ArrowUpRightOneIcon size={20} color="#135487" />
      </div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow:
            'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// ── Visibility option row ──────────────────────────────────────────────────────

function VisibilityRow({
  label,
  description,
  selected,
  locked,
  badge,
  onClick,
}: {
  label: string
  description: string
  selected: boolean
  locked?: boolean
  badge?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '14px 16px',
        borderRadius: 12,
        border: 'none',
        cursor: locked ? 'default' : 'pointer',
        textAlign: 'left',
        backgroundColor: selected ? 'var(--neutral-50)' : locked ? 'var(--neutral-50)' : 'white',
        boxShadow: selected
          ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-800)'
          : locked
          ? '0px 0px 0px 1px var(--neutral-200)'
          : '0px 0px 0px 1px white',
        transition: 'box-shadow 150ms, background-color 150ms',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: 14,
            lineHeight: '22px',
            color: locked ? 'var(--neutral-400)' : 'var(--neutral-800)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: 12,
            lineHeight: '16px',
            color: locked ? 'var(--neutral-500)' : 'var(--neutral-600)',
            whiteSpace: 'nowrap',
          }}
        >
          {description}
        </span>
      </div>
      {badge}
    </button>
  )
}

// ── Token usage progress bar ───────────────────────────────────────────────────

function UsageBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div
      style={{
        position: 'relative',
        height: 4,
        backgroundColor: 'white',
        borderRadius: 2,
        width: '100%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${clamped}%`,
          backgroundColor: '#0d6eb2',
          borderRadius: 2,
          // eslint-disable-next-line react-doctor/no-layout-transition-inline -- progress bar width is dynamic state
          transition: 'width 300ms ease',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${clamped}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: '#0d6eb2',
          border: '1.5px solid white',
          boxShadow: '0px 0px 0px 1px rgba(13,110,178,0.5)',
        }}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SharingTab({ repoId, versionId, hasTeamsPlan = false }: SharingTabProps) {
  const { user } = useAuth()
  const maxTokenLimit = getShareTokenLimit(user?.planType)
  const { setHasShareLink } = usePersonaConfigure()

  const [visibility, setVisibility] = useState<Visibility>('private')

  // ── Link share state ───────────────────────────────────────────────────────
  const [superLinkEnabled, setSuperLinkEnabled] = useState(false)
  const [linkShare, setLinkShare] = useState<PersonaShare | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [tokenLimit, setTokenLimit] = useState(maxTokenLimit)

  // Sync share-link existence to shared progress indicator
  useEffect(() => { setHasShareLink(!!linkShare) }, [linkShare, setHasShareLink])

  // ── Email share state ──────────────────────────────────────────────────────
  const [emailShares, setEmailShares] = useState<PersonaShare[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [emailTokenLimit, setEmailTokenLimit] = useState(maxTokenLimit)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [revokingEmailId, setRevokingEmailId] = useState<string | null>(null)

  // ── Sync token limit defaults when plan resolves ──────────────────────────
  useEffect(() => {
    setTokenLimit(maxTokenLimit)
    setEmailTokenLimit(maxTokenLimit)
  }, [maxTokenLimit])

  // ── Load existing shares on mount ─────────────────────────────────────────
  const loadShares = useCallback(async () => {
    if (!versionId) return
    try {
      const all = await listShares()
      const mine = all.filter(s => s.persona_id === versionId && s.is_active)
      const existing = mine.find(s => s.share_type === 'link') ?? null
      setLinkShare(existing)
      setSuperLinkEnabled(existing !== null)
      setEmailShares(mine.filter(s => s.share_type === 'email'))
    } catch {
      // silently ignore — share list failing shouldn't break the page
    }
  }, [versionId])

  useEffect(() => { loadShares() }, [loadShares])

  // ── Link share handlers ────────────────────────────────────────────────────

  async function handleGenerateLink() {
    if (!repoId) {
      toast.error('Save the persona first before generating a share link.')
      return
    }
    setIsGenerating(true)
    try {
      const share = await createShare({
        persona_repo_id: repoId!,
        share_type: 'link',
        credit_limit: tokenLimit,
      })
      setLinkShare(share)
      toast.success('Share link generated')
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to generate link')
      setSuperLinkEnabled(false)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleRevokeLink() {
    if (!linkShare) return
    setIsRevoking(true)
    try {
      await revokeShare(linkShare.id)
      setLinkShare(null)
      setSuperLinkEnabled(false)
      toast.success('Share link revoked')
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to revoke link')
    } finally {
      setIsRevoking(false)
    }
  }

  function handleCopy() {
    if (!linkShare?.share_url) return
    navigator.clipboard.writeText(canonicalShareUrl(linkShare.share_url)).catch(() => {})
    toast.success('Link copied')
  }

  // ── Email share handlers ───────────────────────────────────────────────────

  async function handleSendEmailInvite() {
    const email = emailInput.trim()
    if (!email) return
    if (!repoId) {
      toast.error('Save the persona first before sending invites.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address')
      return
    }
    setIsSendingEmail(true)
    try {
      const share = await createShare({
        persona_repo_id: repoId!,
        share_type: 'email',
        recipient_emails: [email],
        credit_limit: emailTokenLimit,
      })
      setEmailShares(prev => [...prev, share])
      setEmailInput('')
      toast.success(`Invite sent to ${email}`)
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to send invite')
    } finally {
      setIsSendingEmail(false)
    }
  }

  async function handleRevokeEmailShare(id: string) {
    setRevokingEmailId(id)
    try {
      await revokeShare(id)
      setEmailShares(prev => prev.filter(s => s.id !== id))
      toast.success('Invite revoked')
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to revoke invite')
    } finally {
      setRevokingEmailId(null)
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const displayUrl = linkShare?.share_url
    ? canonicalShareUrl(linkShare.share_url).replace(/^https?:\/\//, '')
    : 'Your link will appear here'

  const usagePercent =
    linkShare && linkShare.credit_limit
      ? Math.min(100, Math.round((linkShare.credit_used / linkShare.credit_limit) * 100))
      : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>

      {/* ── Heading ─────────────────────────────────────────────────────────── */}
      <h1
        style={{
          fontFamily: 'var(--font-title)',
          fontWeight: 400,
          fontSize: 24,
          lineHeight: '32px',
          color: '#1a1916',
          margin: 0,
        }}
      >
        Sharing Configuration
      </h1>

      {/* ── Visibility ──────────────────────────────────────────────────────── */}
      <div data-help-id="help-sharing-visibility" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '0.07px',
            color: '#0a0a0a',
          }}
        >
          Visibility
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <VisibilityRow
            label="Private"
            description="Only you can use this persona"
            selected={visibility === 'private'}
            onClick={() => setVisibility('private')}
          />
          <VisibilityRow
            label="Team"
            description="Everyone in your workspace can use it."
            selected={visibility === 'team'}
            locked
            badge={<TeamPlanBadge />}
            onClick={() => {}}
          />
          <VisibilityRow
            label="Community"
            description="Listed publicly anyone can find and import this persona."
            selected={visibility === 'community'}
            locked
            onClick={() => {}}
          />
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 1, width: '100%', backgroundColor: 'rgba(59,54,50,0.15)' }} />

      {/* ── Super Link ──────────────────────────────────────────────────────── */}
      <div data-help-id="help-sharing-superlink" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Toggle header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '0.07px',
                color: '#0a0a0a',
              }}
            >
              Super Link
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 12,
                lineHeight: '16px',
                color: '#6a625d',
                maxWidth: 560,
              }}
            >
              Generate a shareable URL. Recipients get their own copy of this persona — you cover their token usage up to the limit you set.
            </span>
          </div>
          <Switch
            checked={superLinkEnabled}
            onCheckedChange={setSuperLinkEnabled}
            disabled={isGenerating || isRevoking}
          />
        </div>

        {/* URL bar — visible when toggle is on */}
        {superLinkEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* URL input row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'white',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
                padding: '8px 7px',
                height: 46,
              }}
            >
              {/* URL text */}
              <div style={{ flex: '1 0 0', minWidth: 0, overflow: 'hidden', paddingLeft: 8 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: linkShare ? 'var(--neutral-800)' : 'var(--neutral-300)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayUrl}
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {linkShare ? (
                  <>
                    <button
                      onClick={handleRevokeLink}
                      disabled={isRevoking}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        padding: '5px 8px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: isRevoking ? 'not-allowed' : 'pointer',
                        backgroundColor: 'transparent',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: isRevoking ? 'var(--neutral-400)' : '#ee3030',
                        opacity: isRevoking ? 0.6 : 1,
                        transition: 'opacity 150ms',
                      }}
                    >
                      <CancelOneIcon size={16} color={isRevoking ? 'var(--neutral-400)' : '#ee3030'} />
                      {isRevoking ? 'Revoking…' : 'Revoke link'}
                    </button>
                    <Button variant="secondary" size="sm" onClick={handleCopy}>
                      Copy
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleGenerateLink}
                    loading={isGenerating}
                    disabled={isGenerating}
                  >
                    Generate link
                  </Button>
                )}
              </div>
            </div>

            {/* Token limit — shown before generation so the user can configure it */}
            {!linkShare && (
              <div
                data-help-id="help-sharing-token"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: 'var(--neutral-700)',
                  }}
                >
                  Token limit
                </span>
                <div
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 8,
                    padding: 7,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="number"
                    value={tokenLimit}
                    min={1}
                    max={maxTokenLimit}
                    onChange={e => setTokenLimit(Math.min(maxTokenLimit, Math.max(1, parseInt(e.target.value) || 1)))}
                    style={{
                      width: 96,
                      border: 'none',
                      // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize: 12,
                      lineHeight: 'normal',
                      color: '#3b3632',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Token usage — shown after link is generated */}
            {linkShare && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: 'var(--neutral-700)',
                  }}
                >
                  {linkShare.credit_limit !== null
                    ? `${usagePercent}% used · ${linkShare.credit_used.toLocaleString()} / ${linkShare.credit_limit.toLocaleString()} tokens`
                    : `${linkShare.credit_used.toLocaleString()} tokens used · No limit`}
                </span>
                {linkShare.credit_limit !== null && <UsageBar percent={usagePercent} />}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 1, width: '100%', backgroundColor: 'rgba(59,54,50,0.15)' }} />

      {/* ── Email sharing ────────────────────────────────────────────────────── */}
      <div data-help-id="help-sharing-email" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: 14,
              lineHeight: 1.5,
              letterSpacing: '0.07px',
              color: '#0a0a0a',
            }}
          >
            Email Invite
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: 12,
              lineHeight: '16px',
              color: '#6a625d',
              maxWidth: 560,
            }}
          >
            Send the share link directly to someone via email. Their usage is billed to you up to the token limit you set.
          </span>
        </div>

        {/* Email input row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div
            style={{
              flex: '1 0 0',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'white',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
                padding: '8px 12px',
                height: 46,
              }}
            >
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSendEmailInvite() } }}
                placeholder="colleague@company.com"
                style={{
                  flex: 1,
                  border: 'none',
                  // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: '22px',
                  color: 'var(--neutral-900)',
                }}
              />
            </div>
          </div>

          {/* Token limit for this invite */}
          <div
            style={{
              backgroundColor: 'white',
              border: '1px solid var(--neutral-200)',
              borderRadius: 10,
              padding: '8px 12px',
              height: 46,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <input
              type="number"
              value={emailTokenLimit}
              min={1}
              max={maxTokenLimit}
              onChange={e => setEmailTokenLimit(Math.min(maxTokenLimit, Math.max(1, parseInt(e.target.value) || 1)))}
              style={{
                width: 80,
                border: 'none',
                // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                outline: 'none',
                backgroundColor: 'transparent',
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 12,
                lineHeight: 'normal',
                color: '#3b3632',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 12,
                color: 'var(--neutral-500)',
                marginLeft: 4,
                flexShrink: 0,
              }}
            >
              tokens
            </span>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={handleSendEmailInvite}
            loading={isSendingEmail}
            disabled={isSendingEmail || !emailInput.trim()}
            style={{ height: 46, flexShrink: 0 }}
          >
            Send invite
          </Button>
        </div>

        {/* Existing email shares */}
        {emailShares.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {emailShares.map(share => {
              const emails = share.recipient_emails ?? []
              const emailStr = emails.join(', ') || 'Unknown recipient'
              const pct = share.credit_limit
                ? Math.min(100, Math.round((share.credit_used / share.credit_limit) * 100))
                : null
              const isRevoking = revokingEmailId === share.id
              return (
                <div
                  key={share.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    backgroundColor: 'white',
                    boxShadow: '0px 0px 0px 1px var(--neutral-100)',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: 'var(--neutral-800)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {emailStr}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 400,
                        fontSize: 12,
                        lineHeight: '16px',
                        color: 'var(--neutral-500)',
                      }}
                    >
                      {share.credit_limit !== null
                        ? `${share.credit_used.toLocaleString()} / ${share.credit_limit.toLocaleString()} tokens${pct !== null ? ` · ${pct}% used` : ''}`
                        : `${share.credit_used.toLocaleString()} tokens used · No limit`}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRevokeEmailShare(share.id)}
                    disabled={isRevoking}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      padding: '4px 8px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: isRevoking ? 'not-allowed' : 'pointer',
                      backgroundColor: 'transparent',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize: 14,
                      lineHeight: '22px',
                      color: isRevoking ? 'var(--neutral-400)' : '#ee3030',
                      opacity: isRevoking ? 0.6 : 1,
                      flexShrink: 0,
                      transition: 'opacity 150ms',
                    }}
                  >
                    <CancelOneIcon size={14} color={isRevoking ? 'var(--neutral-400)' : '#ee3030'} />
                    {isRevoking ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
