'use client'
// published persona confirmation page
import React, { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, LinkSixIcon, ShareOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-context'
import { getShareTokenLimit } from '@/lib/plan-config'
import { getPersonaRepo } from '@/lib/api/personas'
import {
  createShare,
  revokeShare,
  listShares,
  type PersonaShare,
} from '@/lib/api/persona-shares'
import { canonicalShareUrl } from '@/lib/share-url'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toHandle(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── Token usage bar ───────────────────────────────────────────────────────────

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
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: `${clamped}%`,
          transform: 'translate(-50%, -50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: '#0d6eb2',
          border: '1.5px solid white',
          boxShadow: '0px 0px 0px 1px rgba(13,110,178,0.5)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// ── Super link section ────────────────────────────────────────────────────────

function SuperLinkSection({
  share,
  onRevoke,
  isRevoking,
}: {
  share: PersonaShare
  onRevoke: () => void
  isRevoking: boolean
}) {
  const displayUrl = share.share_url ? canonicalShareUrl(share.share_url).replace(/^https?:\/\//, '') : ''
  const limit = share.credit_limit ?? 0
  const used = share.credit_used
  const usagePercent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  function handleCopy() {
    if (!share.share_url) return
    navigator.clipboard.writeText(canonicalShareUrl(share.share_url)).catch(() => {})
    toast.success('Link copied')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 719 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 }}>
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
          }}
        >
          Generate a shareable URL anyone can chat without a Souvenir account. You cover the credit cost.
        </span>
      </div>

      {/* URL row */}
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
        <div style={{ flex: '1 0 0', minWidth: 0, overflow: 'hidden', paddingLeft: 8 }}>
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: 14,
              lineHeight: '22px',
              color: 'var(--neutral-800)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayUrl}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onRevoke}
            disabled={isRevoking}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
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
        </div>
      </div>

      {/* Usage */}
      {limit > 0 && (
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
            {usagePercent}% used · {used.toLocaleString()} / {limit.toLocaleString()} credits
          </span>
          <UsageBar percent={usagePercent} />
        </div>
      )}
    </div>
  )
}

// ── Page content ──────────────────────────────────────────────────────────────

function PersonaPublishedContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const personaName  = searchParams.get('name')       ?? 'Persona'
  const repoId       = searchParams.get('repoId')     ?? ''
  const versionId    = searchParams.get('versionId')  ?? ''
  const isRepublished = searchParams.get('republished') === 'true'

  const { user } = useAuth()
  const maxTokenLimit = getShareTokenLimit(user?.planType)

  const [linkShare,      setLinkShare]      = useState<PersonaShare | null>(null)
  const [tokenLimit,     setTokenLimit]     = useState(maxTokenLimit)
  const [isGenerating,   setIsGenerating]   = useState(false)
  const [isRevoking,     setIsRevoking]     = useState(false)
  const [personaImageUrl, setPersonaImageUrl] = useState<string | null>(null)

  // Fetch the persona's avatar from the API using repoId.
  useEffect(() => {
    if (!repoId) return
    getPersonaRepo(repoId)
      .then(repo => setPersonaImageUrl(repo.active_version?.image_url ?? null))
      .catch(() => {})
  }, [repoId])

  // Sync token limit default when plan resolves
  useEffect(() => {
    setTokenLimit(maxTokenLimit)
  }, [maxTokenLimit])

  // Load existing link share on mount
  useEffect(() => {
    if (!versionId) return
    listShares()
      .then(all => {
        const existing = all.find(
          s => s.persona_id === versionId && s.share_type === 'link' && s.is_active,
        )
        if (existing) setLinkShare(existing)
      })
      .catch(() => {})
  }, [versionId])

  async function handleGenerateSuperLink() {
    if (!repoId) return
    setIsGenerating(true)
    try {
      const share = await createShare({
        persona_repo_id: repoId,
        share_type: 'link',
        credit_limit: tokenLimit,
      })
      setLinkShare(share)
    } catch {
      toast.error('Failed to generate link')
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
    } catch {
      toast.error('Failed to revoke link')
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#f7f2ed',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 0 0',
        minHeight: 0,
        position: 'relative',
      }}
    >
      {/* Inner card */}
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          border: '1px solid var(--neutral-200)',
          borderRadius: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: '1 0 0',
          minHeight: 0,
          overflow: 'hidden',
          paddingBottom: 12,
          paddingTop: 10,
          paddingLeft: 12,
          paddingRight: 12,
          alignItems: 'center',
        }}
      >
        {/* ── Top nav ─────────────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
            <IconButton
              variant="ghost"
              size="md"
              icon={<ArrowLeftOneIcon size={20} />}
              aria-label="Back to library"
              onClick={() => push('/personas')}
            />
          </div>
          <div style={{ height: 8, flexShrink: 0 }} />
        </div>

        {/* ── Scrollable content ────────────────────────────────────────────── */}
        <div
          className="kaya-scrollbar"
          style={{
            flex: '1 0 0',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 76,
              position: 'relative',
              paddingBottom: 48,
            }}
          >
            {/* Radial gradient blob */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translate(-50%, 0)',
                width: 716,
                height: 586,
                borderRadius: 28,
                // eslint-disable-next-line react-doctor/no-large-animated-blur -- static decorative background gradient, not animated
                filter: 'blur(108px)',
                mixBlendMode: 'hard-light',
                background:
                  'radial-gradient(ellipse at 50% 26%, rgba(212,126,81,0.21) 14.4%, rgba(157,129,111,0.45) 38%, rgba(101,132,141,0.7) 61.5%, rgba(95,120,135,0.7) 100%)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />

            {/* Title container */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 32,
                alignItems: 'center',
                width: 291,
                position: 'relative',
                zIndex: 1,
                paddingTop: 32,
              }}
            >
              {/* Persona image */}
              <div
                style={{
                  position: 'relative',
                  width: 152,
                  height: 152,
                  borderRadius: 32,
                  flexShrink: 0,
                  overflow: 'hidden',
                  boxShadow:
                    '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 5px var(--neutral-100)',
                  backgroundColor: 'var(--neutral-100)',
                }}
              >
                <Image
                  src={personaImageUrl ?? '/icons/persona-image.svg'}
                  alt={personaName}
                  fill
                  sizes="152px"
                  unoptimized
                  style={{ objectFit: 'cover' }}
                />
              </div>

              {/* Title + description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 400,
                    fontSize: 40,
                    lineHeight: '48px',
                    color: 'var(--neutral-900)',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 400,
                    textAlign: 'center',
                  }}
                >
                  {personaName}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 16,
                    lineHeight: '22px',
                    color: 'var(--neutral-700)',
                    margin: 0,
                    textAlign: 'center',
                    width: 392,
                  }}
                >
                  {isRepublished
                    ? `“${personaName}” is now live with your latest changes.`
                    : `“${personaName}” is now live for your team. Members can add it from the Add button in any conversation.`}
                </p>
              </div>
            </div>

            {/* ── What's next ──────────────────────────────────────────────── */}
            <div
              style={{
                display:        'flex',
                flexDirection:  'column',
                gap:            14,
                alignItems:     'center',
                position:       'relative',
                zIndex:         1,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: '0 0 4px' }}>
                  What&apos;s next?
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                  {linkShare
                    ? 'Share this link with anyone — no account needed to chat with your agent.'
                    : 'Generate a Super Link so anyone can chat with your agent — no account needed.'}
                </p>
              </div>

              {/* Super link section — shown once the link is generated */}
              {linkShare ? (
                <SuperLinkSection
                  share={linkShare}
                  onRevoke={handleRevokeLink}
                  isRevoking={isRevoking}
                />
              ) : (
                /* Pre-generation: token limit input + generate button */
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    alignItems: 'center',
                    width: 242,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 400,
                        fontSize: 13,
                        color: 'var(--neutral-600)',
                      }}
                    >
                      Credit limit
                    </span>
                    <div
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 8,
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="number"
                        value={tokenLimit}
                        min={1}
                        max={maxTokenLimit}
                        onChange={e =>
                          setTokenLimit(Math.min(maxTokenLimit, Math.max(1, parseInt(e.target.value) || 1)))
                        }
                        style={{
                          width: 72,
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
                  <Button
                    variant="default"
                    size="sm"
                    leftIcon={<LinkSixIcon size={16} />}
                    style={{ width: 242, justifyContent: 'center' }}
                    onClick={handleGenerateSuperLink}
                    loading={isGenerating}
                    disabled={isGenerating}
                  >
                    Generate Super Link
                  </Button>
                </div>
              )}

              {/* Share to community - disabled */}
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ShareOneIcon size={16} />}
                style={{ width: 242, justifyContent: 'center' }}
                disabled
              >
                Share to community
              </Button>

              {/* Back to library */}
              <button
                onClick={() => push('/personas')}
                style={{
                  width: 242,
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: '22px',
                  color: 'var(--neutral-700)',
                  textAlign: 'center',
                }}
              >
                Back to library
              </button>

              {/* Configure sharing shortcut — visible when no super link yet */}
              {!linkShare && repoId && versionId && (
                <button
                  onClick={() => push(`/persona/configure/sharing?repoId=${repoId}&versionId=${versionId}`)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 13,
                    lineHeight: '20px',
                    color: 'var(--neutral-400)',
                    textAlign: 'center',
                    padding: 0,
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Configure sharing settings →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PersonaPublishedPage() {
  return (
    <Suspense>
      <PersonaPublishedContent />
    </Suspense>
  )
}
