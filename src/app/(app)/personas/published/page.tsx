'use client'

import React, { useState, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, LinkSixIcon, ShareOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Switch } from '@/components/Switch'

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

// ── Super link section (design 2) ─────────────────────────────────────────────

function SuperLinkSection({
  url,
  superLinkEnabled,
  onToggle,
  tokenLimit,
  onTokenLimitChange,
  tokensUsed,
}: {
  url: string
  superLinkEnabled: boolean
  onToggle: (v: boolean) => void
  tokenLimit: number
  onTokenLimitChange: (v: number) => void
  tokensUsed: number
}) {
  const usagePercent = Math.round((tokensUsed / tokenLimit) * 100)

  function handleCopy() {
    navigator.clipboard.writeText(`https://${url}`).catch(() => {})
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: 719,
      }}
    >
      {/* Toggle header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
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
            Generate a shareable URL anyone can chat without a Souvenir account. You cover the token cost.
          </span>
        </div>
        <Switch checked={superLinkEnabled} onCheckedChange={onToggle} />
      </div>

      {/* URL input row */}
      {superLinkEnabled && (
        <>
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
            {/* URL */}
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
                {url}
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {/* Revoke */}
              <button
                onClick={() => onToggle(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 8px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: '22px',
                  color: '#ee3030',
                }}
              >
                <CancelOneIcon size={16} color="#ee3030" />
                Revoke link
              </button>
              {/* Copy */}
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                Copy
              </Button>
            </div>
          </div>

          {/* Usage row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 14,
                lineHeight: '22px',
                color: 'var(--neutral-700)',
                whiteSpace: 'nowrap',
              }}
            >
              {usagePercent}% used · {tokensUsed.toLocaleString()} / {tokenLimit.toLocaleString()} tokens
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
                onChange={e => onTokenLimitChange(Math.max(1, parseInt(e.target.value) || 1))}
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

          {/* Progress bar */}
          <UsageBar percent={usagePercent} />
        </>
      )}
    </div>
  )
}

// ── Page content ──────────────────────────────────────────────────────────────

function PersonaPublishedContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const personaName = searchParams.get('name') ?? 'Persona'

  const [superLinkGenerated, setSuperLinkGenerated] = useState(false)
  const [superLinkEnabled, setSuperLinkEnabled] = useState(true)
  const [tokenLimit, setTokenLimit] = useState(10000)

  const tokensUsed = 1400
  const generatedUrl = `souvenir.app/p/${toHandle(personaName)}-a8b2c3`

  function handleGenerateSuperLink() {
    setSuperLinkGenerated(true)
    setSuperLinkEnabled(true)
  }

  function handleSuperLinkToggle(enabled: boolean) {
    setSuperLinkEnabled(enabled)
    if (!enabled) setSuperLinkGenerated(false)
  }

  return (
    <div
      style={{
        backgroundColor: '#f7f2ed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 10,
        width: '100%',
        height: '100%',
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
          height: '100%',
          minWidth: 0,
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
          <div style={{ height: 32, flexShrink: 0 }} />
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
                gap: 47,
                alignItems: 'center',
                width: 291,
                position: 'relative',
                zIndex: 1,
                paddingTop: 80,
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
                  src="/icons/persona-image.svg"
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
                  &ldquo;{personaName}&rdquo; is now live for your team. Members can add it from the Add button in any
                  conversation.
                </p>
              </div>
            </div>

            {/* ── Action buttons ───────────────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                alignItems: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Super link section (shown after generating) */}
              {superLinkGenerated && (
                <SuperLinkSection
                  url={generatedUrl}
                  superLinkEnabled={superLinkEnabled}
                  onToggle={handleSuperLinkToggle}
                  tokenLimit={tokenLimit}
                  onTokenLimitChange={setTokenLimit}
                  tokensUsed={tokensUsed}
                />
              )}

              {/* Generate Super Link (shown before generating) */}
              {!superLinkGenerated && (
                <Button
                  variant="default"
                  size="sm"
                  leftIcon={<LinkSixIcon size={16} />}
                  style={{ width: 242, justifyContent: 'center' }}
                  onClick={handleGenerateSuperLink}
                >
                  Generate Super Link
                </Button>
              )}

              {/* Share to community - disabled initially */}
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
